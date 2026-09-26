const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { User, AuditLog, Config } = require('../models');
const { normalizePhoneNumber, sendOtpSms, isSmsConfigured } = require('../services/smsService');
const { validateEmailConfiguration } = require('../services/emailService');
const { isValidEmail, isValidUsername } = require('../utils/validators');
const { getJwtSecret } = require('../config/jwt');
const { getRequestContext, getClientIp } = require('../middlewares/requestContext');

const LOGIN_ALIASES = {
  admin: ['admin'],
  ict_officer: ['ict_officer', 'ict-officer', 'ict'],
  college: ['college'],
  department_head: ['department_head', 'dept_head', 'department head', 'department'],
  finance: ['finance'],
  store_manager: ['store_manager', 'store-manager'],
  maintenance: ['maintenance'],
  infrastructure: ['infrastructure', 'infrastructure_directorate', 'infra', 'infrastructure directorate'],
};

const normalizeAlias = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeLoginIdentity = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();
  const normalized = normalizeAlias(raw);

  for (const [role, aliases] of Object.entries(LOGIN_ALIASES)) {
    if (aliases.some((alias) => normalizeAlias(alias) === normalized)) {
      return role;
    }
  }

  return normalized.replace(/\s+/g, '_');
};

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
  try {
    const record = await Config.findByPk('security');
    return { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
  } catch (error) {
    if (error?.name === 'SequelizeDatabaseError' || error?.parent?.code === 'SQLITE_ERROR') {
      return DEFAULT_SECURITY_SETTINGS;
    }
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
  {
    id: user.id,
    role: user.role,
    email: user.email,
    sessionVersion: user.sessionVersion || 0,
    collegeId: user.collegeId ?? null,
    departmentId: user.departmentId ?? null,
  },
  getJwtSecret(),
  { expiresIn }
  );
};

const recordAuthEvent = async ({ userId = null, action, result, req }) => {
  try {
    const context = getRequestContext() || {
      requestId: req?.requestId || null,
      ipAddress: getClientIp(req) || req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
    };

    await AuditLog.create({
      userId,
      action,
      entity: userId ? `user:${userId}` : 'auth',
      details: JSON.stringify({
        result,
        requestId: context.requestId || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
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
      collegeId: user.collegeId ?? null,
      departmentId: user.departmentId ?? null,
      phone: user.phone,
      active: user.active,
      profilePhoto: user.profilePhoto || null,
      profile_photo: user.profilePhoto || null,
      lastLoginAt: user.lastLoginAt,
      forcePasswordChange: Boolean(user.forcePasswordChange),
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

    const publicRoles = ['student', 'staff'];
    if (!publicRoles.includes(String(role || 'student').toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Role must be provided by an administrator' });
    }

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
    await user.update({ password: await bcrypt.hash(newPassword, 10), forcePasswordChange: false, sessionVersion: (user.sessionVersion || 0) + 1 });
    await AuditLog.create({ userId: user.id, action: 'PASSWORD_CHANGED', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id }) });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const logout = async (req, res) => {
  await recordAuthEvent({ userId: req.user.id, action: 'LOGOUT', result: 'Success', req });
  res.json({ success: true });
};

const genericResetMessage = 'If an eligible account exists, password reset instructions will be sent.';
const GENERIC_OTP_MESSAGE = 'If this phone number is registered, a verification code has been sent.';
const RESET_TOKEN_TTL_MINUTES = Math.min(30, Math.max(15, Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 20));
const RESET_OTP_TTL_MINUTES = Math.min(15, Math.max(5, Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES) || 5));
const RESET_OTP_MAX_ATTEMPTS = Math.max(3, Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) || 5);
const OTP_REQUEST_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_RATE_LIMIT_PER_PHONE = 4;
const OTP_REQUEST_RATE_LIMIT_PER_IP = 8;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const otpRequestBuckets = new Map();
const otpRequestIpBuckets = new Map();

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const safeHashEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const rateLimitPruneState = { lastPrunedAt: 0 };

const pruneRateLimitBuckets = () => {
  const now = Date.now();
  if (now - rateLimitPruneState.lastPrunedAt < RATE_LIMIT_PRUNE_INTERVAL_MS) return;
  rateLimitPruneState.lastPrunedAt = now;

  [otpRequestBuckets, otpRequestIpBuckets].forEach((bucket) => {
    for (const [key, entries] of bucket.entries()) {
      const recent = entries.filter((timestamp) => now - timestamp < OTP_REQUEST_RATE_LIMIT_WINDOW_MS);
      if (recent.length === 0) bucket.delete(key);
      else bucket.set(key, recent);
    }
  });
};

const getRateLimitState = (bucket, key, maxRequests, windowMs) => {
  pruneRateLimitBuckets();
  const now = Date.now();
  const entries = bucket.get(key) || [];
  const recent = entries.filter((timestamp) => now - timestamp < windowMs);
  bucket.set(key, recent);
  const isBlocked = recent.length >= maxRequests;
  if (!isBlocked) {
    recent.push(now);
    bucket.set(key, recent);
  }
  return { isBlocked, remaining: Math.max(0, maxRequests - recent.length), retryAfterMs: windowMs };
};

const checkForOtpRateLimit = (phoneNumber, ipAddress) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber || '');
  const safeIp = String(ipAddress || 'unknown').trim();
  const phoneState = getRateLimitState(otpRequestBuckets, normalizedPhone || 'unknown-phone', OTP_REQUEST_RATE_LIMIT_PER_PHONE, OTP_REQUEST_RATE_LIMIT_WINDOW_MS);
  const ipState = getRateLimitState(otpRequestIpBuckets, safeIp, OTP_REQUEST_RATE_LIMIT_PER_IP, OTP_REQUEST_RATE_LIMIT_WINDOW_MS);
  return {
    blocked: phoneState.isBlocked || ipState.isBlocked,
    reason: phoneState.isBlocked ? 'phone' : ipState.isBlocked ? 'ip' : null,
  };
};

const getMailer = () => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) return null;
  return {
    transporter: nodemailer.createTransport({
      host: validation.config.host,
      port: Number(validation.config.port),
      secure: Number(validation.config.port) === 465,
      auth: { user: validation.config.user, pass: validation.config.password },
    }),
    from: validation.config.from,
  };
};

const getResetFrontendUrl = () => {
  const configuredUrl = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || '').trim().replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    if (!configuredUrl || !configuredUrl.startsWith('https://')) {
      throw new Error('FRONTEND_URL must be configured with HTTPS in production');
    }
    return configuredUrl;
  }
  return configuredUrl || 'http://localhost:3000';
};

const ensureEligibleResetUser = async (user, accountType = 'email') => {
  if (!user) {
    return { allowed: false, reason: 'not_found' };
  }

  if (!user.active) {
    return { allowed: false, reason: 'inactive' };
  }

  if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
    return { allowed: false, reason: 'locked' };
  }

  if (accountType === 'email' && !user.email) {
    return { allowed: false, reason: 'email_missing' };
  }

  if (accountType === 'phone' && !user.phone) {
    return { allowed: false, reason: 'phone_missing' };
  }

  return { allowed: true };
};

const clearOtpState = async (user) => {
  if (!user) return;
  await user.update({
    resetOtpHash: null,
    resetOtpExpiresAt: null,
    resetOtpUsedAt: null,
    resetOtpAttempts: 0,
  });
};

const requestForgotPasswordOtp = async (req, res) => {
  try {
    const rawPhone = String(req.body.phoneNumber || req.body.phone || req.body.mobile || '').trim();
    const phone = normalizePhoneNumber(rawPhone);
    const ipAddress = getClientIp(req) || req.ip || 'unknown';

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid mobile phone number.' });
    }

    const rateLimitState = checkForOtpRateLimit(phone, ipAddress);
    if (rateLimitState.blocked) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again later.' });
    }

    if (!isSmsConfigured()) {
      return res.status(503).json({ success: false, message: 'We could not send the verification code right now. Please try again later.' });
    }

    const user = await User.findOne({ where: { phone } });
    if (!user || !user.active || (user.lockoutUntil && new Date(user.lockoutUntil) > new Date())) {
      return res.json({ success: true, message: GENERIC_OTP_MESSAGE });
    }

    const previousOtp = user.resetOtpExpiresAt && new Date(user.resetOtpExpiresAt) > new Date() ? user.resetOtpHash : null;
    if (previousOtp) {
      const lastOtpRequestedAt = user.updatedAt || new Date(Date.now() - OTP_RESEND_COOLDOWN_MS);
      if (Date.now() - new Date(lastOtpRequestedAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
        return res.status(429).json({ success: false, message: 'Please wait before requesting a new OTP.' });
      }
    }

    const otp = String(crypto.randomInt(100000, 1000000)).padStart(6, '0');
    const otpHash = hashValue(otp);
    const otpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);

    await user.update({
      resetOtpHash: otpHash,
      resetOtpExpiresAt: otpExpiresAt,
      resetOtpUsedAt: null,
      resetOtpAttempts: 0,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetTokenUsedAt: null,
    });

    const smsResult = await sendOtpSms(phone, otp, { ttlMinutes: RESET_OTP_TTL_MINUTES });
    if (smsResult.status !== 'sent') {
      await clearOtpState(user);
      console.error('Password reset OTP SMS delivery failed for phone ending with', phone.slice(-4), 'provider:', process.env.SMS_PROVIDER || 'unconfigured');
      return res.status(503).json({ success: false, message: 'We could not send the verification code right now. Please try again later.' });
    }

    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET_OTP_REQUESTED', result: 'Success', req });

    return res.json({ success: true, message: GENERIC_OTP_MESSAGE });
  } catch (error) {
    console.error('Request password reset OTP failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to process the OTP request.' });
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const rawPhone = String(req.body.phoneNumber || req.body.phone || req.body.mobile || '').trim();
    const phone = normalizePhoneNumber(rawPhone);
    const otp = String(req.body.otp || '').trim();

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid mobile phone number.' });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit verification code.' });
    }

    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    const eligibility = await ensureEligibleResetUser(user, 'phone');
    if (!eligibility.allowed) {
      return res.status(403).json({ success: false, message: 'This account cannot complete password reset right now.' });
    }

    if (!user.resetOtpHash || !user.resetOtpExpiresAt || new Date(user.resetOtpExpiresAt) < new Date()) {
      await clearOtpState(user);
      return res.status(400).json({ success: false, message: 'This verification code has expired.' });
    }

    const enteredHash = hashValue(otp);
    if (!safeHashEquals(enteredHash, user.resetOtpHash)) {
      const attempts = Number(user.resetOtpAttempts || 0) + 1;
      await user.update({ resetOtpAttempts: attempts });
      if (attempts >= RESET_OTP_MAX_ATTEMPTS) {
        await clearOtpState(user);
        return res.status(429).json({ success: false, message: 'Maximum verification attempts reached. Please request a new code.' });
      }
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await user.update({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
      resetTokenUsedAt: null,
      resetOtpHash: null,
      resetOtpExpiresAt: null,
      resetOtpUsedAt: new Date(),
      resetOtpAttempts: 0,
    });

    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET_OTP_VERIFIED', result: 'Success', req });

    return res.json({ success: true, message: 'Verification successful. Please create a new password.', resetToken: rawToken });
  } catch (error) {
    console.error('Password reset OTP verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify the recovery code.' });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const token = String(req.body.resetToken || req.body.token || '').trim();
    const password = String(req.body.newPassword || req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || req.body.confirmPassword || '');

    if (!token || !password || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'A valid reset token and matching passwords are required.' });
    }

    const settings = await getSecuritySettings();
    const passwordError = validatePassword(password, settings);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const tokenHash = hashValue(token);
    const user = await User.findOne({ where: { resetTokenHash: tokenHash, resetTokenUsedAt: null } });
    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });
    }

    if (!user.active) {
      await user.update({ resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: new Date() });
      return res.status(403).json({ success: false, message: 'This account cannot complete password reset right now.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [updatedCount] = await User.update({
      password: hashedPassword,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetTokenUsedAt: new Date(),
      resetOtpHash: null,
      resetOtpExpiresAt: null,
      resetOtpUsedAt: new Date(),
      resetOtpAttempts: 0,
    }, {
      where: {
        id: user.id,
        resetTokenHash: tokenHash,
        resetTokenUsedAt: null,
        resetTokenExpiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!updatedCount) {
      return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });
    }

    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET', result: 'Success', req });

    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    console.error('OTP-based password reset failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const method = String(req.body.method || 'email').trim().toLowerCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    const rawPhone = String(req.body.phone || req.body.mobile || '').trim();

    if (method === 'phone') {
      return requestForgotPasswordOtp(req, res);
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const user = await User.findOne({ where: { email } });
    const eligibility = await ensureEligibleResetUser(user, 'email');
    if (!user || !eligibility.allowed) {
      return res.json({ success: true, message: genericResetMessage });
    }

    const emailConfiguration = validateEmailConfiguration();
    if (!emailConfiguration.valid) {
      console.error('Forgot password error:\nEmail service configuration missing');
      return res.status(503).json({ success: false, message: 'Password reset email service is not configured.' });
    }

    const mailer = getMailer();
    if (!mailer) {
      console.error('Forgot password error:\nEmail service configuration missing');
      return res.status(503).json({ success: false, message: 'Password reset email service is not configured.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    const resetUrl = `${getResetFrontendUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const greetingName = escapeHtml(user.fullName || user.username);
    const safeResetUrl = escapeHtml(resetUrl);

    await user.update({ resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt, resetTokenUsedAt: null, resetOtpHash: null, resetOtpExpiresAt: null, resetOtpUsedAt: null, resetOtpAttempts: 0 });
    try {
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: user.email,
        subject: 'Reset Your University Asset Management System Password',
        text: `Mekdela Amba University Asset Management System\n\nHello ${user.fullName || user.username},\n\nA password reset was requested for your account.\n\nReset your password here:\n${resetUrl}\n\nThis link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once. If you did not request this, you can safely ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><div style="background:#0EA5E9;padding:24px;color:#fff"><h1 style="margin:0;font-size:22px">Mekdela Amba University</h1><p style="margin:8px 0 0">University Asset Management System</p></div><div style="padding:28px;border:1px solid #dbe4ef"><h2>Reset Your Password</h2><p>Hello ${greetingName},</p><p>A password reset was requested for your account.</p><p><a href="${safeResetUrl}" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:700">Reset Password</a></p><p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.</p><p>If you did not request this, you can safely ignore this email.</p></div></div>`,
      });
    } catch (mailError) {
      await user.update({ resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: null });
      throw mailError;
    }

    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', result: 'Success', req });

    return res.json({ success: true, message: genericResetMessage });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to process the password reset request.' });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { phone, method, phoneNumber } = req.body;
    const recoveryMethod = String(method || (phoneNumber || phone ? 'phone' : 'email')).trim().toLowerCase();

    if (recoveryMethod !== 'phone') {
      return res.status(400).json({ success: false, message: 'Code verification is only available for mobile phone recovery. Use the reset link sent to your email address instead.' });
    }

    return verifyForgotPasswordOtp(req, res);
  } catch (error) {
    console.error('OTP verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify the recovery code.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (!token || !password || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'A valid token and matching password are required.' });
    }
    const passwordError = validatePassword(password, await getSecuritySettings());
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    const tokenHash = hashValue(token);
    const user = await User.findOne({ where: { resetTokenHash: tokenHash, resetTokenUsedAt: null } });
    if (!user || user.resetTokenUsedAt || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });
    }
    if (!user.active) {
      await user.update({ resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: new Date() });
      return res.status(403).json({ success: false, message: 'This account cannot complete password reset right now.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [updatedCount] = await User.update({
      password: hashedPassword,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetTokenUsedAt: new Date(),
      resetOtpHash: null,
      resetOtpExpiresAt: null,
      resetOtpUsedAt: new Date(),
      resetOtpAttempts: 0,
    }, {
      where: {
        id: user.id,
        resetTokenHash: tokenHash,
        resetTokenUsedAt: null,
        resetTokenExpiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!updatedCount) {
      return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });
    }

    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET', result: 'Success', req });

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
  verifyResetOtp,
  resetPassword,
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
};
