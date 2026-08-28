const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User, AuditLog, Config } = require('../models');
const { isValidEmail, isValidUsername } = require('../utils/validators');

const LOGIN_ALIASES = {
  admin: ['admin'],
  ict_officer: ['ict_officer', 'ict-officer', 'ict'],
  department_head: ['department_head', 'dept_head', 'department head', 'department'],
  finance: ['finance'],
  store_manager: ['store_manager', 'store-manager'],
  maintenance: ['maintenance'],
};

const normalizeLoginIdentity = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();
  const normalized = raw.toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [role, aliases] of Object.entries(LOGIN_ALIASES)) {
    if (aliases.some((alias) => normalizeAlias(alias) === normalized)) {
      return role;
    }
  }

  return normalized.replace(/\s+/g, '_');
};

const normalizeAlias = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s+/g, ' ').trim();

const resolveLoginAliases = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return [];
  }

  const canonical = normalizeLoginIdentity(raw);
  const aliases = new Set([raw.toLowerCase(), canonical]);

  for (const [role, roleAliases] of Object.entries(LOGIN_ALIASES)) {
    if (role === canonical || roleAliases.some((alias) => normalizeAlias(alias) === normalizeAlias(raw))) {
      for (const alias of roleAliases) {
        aliases.add(alias);
        aliases.add(alias.toLowerCase());
      }
    }
  }

  return [...aliases].filter(Boolean);
};

const DEFAULT_SECURITY_SETTINGS = { password_min_length: 8, password_require_uppercase: true, password_require_lowercase: true, password_require_numbers: true, password_require_special: true, session_timeout: 60, max_login_attempts: 5, account_lockout_duration: 30, jwt_expiry: 7 };

const getSecuritySettings = async () => {
  const record = await Config.findByPk('security');
  try {
    return { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
  } catch (error) {
    return DEFAULT_SECURITY_SETTINGS;
  }
};

const validatePassword = (password, settings) => {
  if (String(password).length < Number(settings.password_min_length)) return `Password must be at least ${settings.password_min_length} characters`;
  if (settings.password_require_uppercase && !/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (settings.password_require_lowercase && !/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (settings.password_require_numbers && !/\d/.test(password)) return 'Password must contain a number';
  if (settings.password_require_special && !/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
};

const generateToken = async (user) => {
  const settings = await getSecuritySettings();
  const jwtSeconds = Math.max(1, Number(settings.jwt_expiry) || 7) * 24 * 60 * 60;
  const sessionSeconds = Math.max(1, Number(settings.session_timeout) || 60) * 60;
  const expiresIn = Math.min(jwtSeconds, sessionSeconds);
  return jwt.sign(
  { id: user.id, role: user.role, email: user.email },
  process.env.JWT_SECRET || 'smart_asset_secret_key_2026',
  { expiresIn }
  );
};

const recordAuthEvent = async ({ userId = null, action, result, req }) => {
  try {
    await AuditLog.create({
      userId,
      action,
      entity: userId ? `user:${userId}` : 'auth',
      details: JSON.stringify({
        result,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      }),
    });
  } catch (error) {
    console.error('Authentication audit event failed:', error.message);
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const identity = username.trim();
    const candidateNames = resolveLoginAliases(identity);
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username: candidateNames },
          { email: candidateNames }
        ]
      }
    });

    if (!user) {
      await recordAuthEvent({ action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const security = await getSecuritySettings();
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      return res.status(429).json({ success: false, message: 'Account temporarily locked. Please try again later.' });
    }

    if (!user.active) {
      await recordAuthEvent({ userId: user.id, action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(403).json({ success: false, message: 'This account is disabled.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const failedAttempts = Number(user.failedLoginAttempts || 0) + 1;
      const locked = failedAttempts >= Number(security.max_login_attempts);
      await user.update({ failedLoginAttempts: locked ? 0 : failedAttempts, lockoutUntil: locked ? new Date(Date.now() + Number(security.account_lockout_duration) * 60000) : null });
      await recordAuthEvent({ userId: user.id, action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(locked ? 429 : 401).json({ success: false, message: locked ? 'Account temporarily locked. Please try again later.' : 'Invalid email or password.' });
    }

    await user.update({ failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date() });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      phone: user.phone,
      active: user.active,
      lastLoginAt: user.lastLoginAt,
    };

    await recordAuthEvent({ userId: user.id, action: 'LOGIN', result: 'Success', req });

    return res.json({
      success: true,
      token: await generateToken(user),
      user: safeUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password, fullName, role = 'student', department = '' } = req.body;

    if (!isValidUsername(username)) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    const security = await getSecuritySettings();
    const passwordError = validatePassword(password || '', security);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const exists = await User.findOne({ where: { [require('sequelize').Op.or]: [{ username }, { email }] } });
    if (exists) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName: fullName || username,
      role,
      department,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
      },
      token: await generateToken(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    const passwordError = validatePassword(newPassword, await getSecuritySettings());
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    const user = await User.findByPk(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    await user.update({ password: await bcrypt.hash(newPassword, 10) });
    await AuditLog.create({ userId: user.id, action: 'PASSWORD_CHANGED', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id }) });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const logout = async (req, res) => {
  await recordAuthEvent({ userId: req.user.id, action: 'LOGOUT', result: 'Success', req });
  res.json({ success: true });
};

const genericResetMessage = 'If an account is associated with that email, you\'ll receive instructions to reset your password.';

const getMailer = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) return null;
  return {
    transporter: nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }),
    from: SMTP_FROM,
  };
};

const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Valid email is required' });

    const user = await User.findOne({ where: { email } });
    const mailer = getMailer();
    if (!user) return res.json({ success: true, message: genericResetMessage });
    if (!mailer && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ success: false, message: 'Password reset email service is not configured.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.update({ resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt });

    const resetBaseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${resetBaseUrl.replace(/\/$/, '')}/reset-password/${rawToken}`;
    if (mailer) {
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: user.email,
        subject: 'Password reset instructions',
        text: `Use this link to reset your password. It expires in 1 hour: ${resetUrl}`,
      });
    } else {
      console.warn(`[DEVELOPMENT ONLY] Password reset URL for ${user.email}: ${resetUrl}`);
    }

    return res.json({ success: true, message: genericResetMessage });
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    return res.status(503).json({ success: false, message: 'Password reset email could not be delivered.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || password.length < 8 || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'A valid token and matching password of at least 8 characters are required.' });
    }
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ where: { resetTokenHash: tokenHash } });
    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });
    }
    await user.update({
      password: await bcrypt.hash(password, 10),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });
    return res.json({ success: true, message: 'Your password has been reset successfully.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
};

module.exports = {
  login,
  register,
  generateToken,
  normalizeLoginIdentity,
  resolveLoginAliases,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
};
