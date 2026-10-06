const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, PasswordRecovery, AuditLog, UserActivityLog, Config } = require('../models');
const { normalizePhoneNumber, sendOtpSms, isSmsConfigured } = require('../services/smsService');
const { validateEmailConfiguration, sendPasswordResetEmail, sendOtpEmail } = require('../services/emailService');
const { isValidEmail, isValidUsername } = require('../utils/validators');
const { getJwtSecret } = require('../config/jwt');
const { getRequestContext, getClientIp } = require('../middlewares/requestContext');
const { getConfiguredRolePermissions } = require('../services/rolePermissionService');
const { getSecuritySettings, validatePassword } = require('../services/passwordPolicyService');
const { isAccountActive } = require('../utils/accountStatus');

const LOGIN_ALIASES = {
  admin: ['admin'],
  ict_officer: ['ict_officer', 'ict-officer', 'ict'],
  college: ['college', 'college_manager', 'college manager', 'college-manager'],
  department_head: ['department_head', 'dept_head', 'department head', 'department'],
  finance: ['finance'],
  store_manager: ['store_manager', 'store-manager'],
  maintenance: ['maintenance'],
  infrastructure: ['infrastructure', 'infrastructure_directorate', 'infra', 'infrastructure directorate'],
};

const normalizeAlias = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeUniqueLookup = (value = '') => String(value ?? '').trim().toLowerCase();

const findExistingAccount = async ({ username = '', email = '', excludeUserId = null } = {}) => {
  const normalizedUsername = normalizeUniqueLookup(username);
  const normalizedEmail = normalizeUniqueLookup(email);
  if (!normalizedUsername && !normalizedEmail) return null;

  const where = {
    [Op.or]: [
      ...(normalizedUsername ? [{ username: { [Op.like]: `%${normalizedUsername}%` } }] : []),
      ...(normalizedEmail ? [{ email: { [Op.like]: `%${normalizedEmail}%` } }] : []),
    ],
  };
  if (excludeUserId) where.id = { [Op.ne]: excludeUserId };

  const matches = await User.findAll({ where });
  return matches.find((candidate) => {
    const candidateUsername = normalizeUniqueLookup(candidate.username);
    const candidateEmail = normalizeUniqueLookup(candidate.email ?? '');
    return (normalizedUsername && candidateUsername === normalizedUsername) || (normalizedEmail && candidateEmail === normalizedEmail);
  }) || null;
};

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

const rankLoginMatch = (user, identity, candidateNames = []) => {
  const normalizedIdentity = String(identity || '').trim().toLowerCase();
  const username = String(user?.username || '').trim().toLowerCase();
  const email = String(user?.email || '').trim().toLowerCase();
  const candidates = new Set(candidateNames.map((value) => String(value || '').trim().toLowerCase()));

  if (username === normalizedIdentity) return 0;
  if (email === normalizedIdentity) return 1;
  if (candidates.has(username)) return 2;
  if (candidates.has(email)) return 3;
  return 4;
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
    console.error('Authentication audit event failed.');
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
    let user = await User.findOne({
      where: {
        [Op.or]: [{ username: identity }, { email: identity }],
      },
    });
    if (!user && candidateNames.some((candidate) => candidate !== identity.toLowerCase())) {
      const matches = await User.findAll({
        where: {
          [Op.or]: [
            { username: { [Op.in]: candidateNames } },
            { email: { [Op.in]: candidateNames } }
          ]
        }
      });
      user = matches.sort((left, right) => rankLoginMatch(left, identity, candidateNames) - rankLoginMatch(right, identity, candidateNames))[0] || null;
    }

    if (!user) {
      await recordAuthEvent({ action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const security = await getSecuritySettings();
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      return res.status(429).json({ success: false, message: 'Account temporarily locked. Please try again later.' });
    }

    if (!isAccountActive(user.active) || ['inactive', 'suspended'].includes(String(user.status || '').toLowerCase())) {
      console.warn(`Login rejected for inactive account userId=${user.id}`);
      await recordAuthEvent({ userId: user.id, action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
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
    await UserActivityLog.create({
      userId: user.id,
      action: 'Successful login',
      ip: req.ip || req.socket?.remoteAddress || null,
      createdAt: new Date(),
    });

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
    const rolePermissions = await getConfiguredRolePermissions(user.role);
    if (rolePermissions !== null) safeUser.permissions = rolePermissions;

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

    const exists = await findExistingAccount({ username, email });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Username or email is already in use' });
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
  await req.user.update({ sessionVersion: Number(req.user.sessionVersion || 0) + 1 });
  await recordAuthEvent({ userId: req.user.id, action: 'LOGOUT', result: 'Success', req });
  res.json({ success: true });
};

const genericResetMessage = 'If an eligible account exists, password reset instructions will be sent.';
const getGenericOtpMessage = (method = 'phone') => (method === 'email'
  ? 'If this email address is registered, a verification code has been sent.'
  : 'If this phone number is registered, a verification code has been sent.');
const mapEmailDeliveryError = (error) => {
  const errorCode = String(error?.code || '').toUpperCase();
  if (errorCode === 'EMAIL_NOT_CONFIGURED') {
    return { code: 'EMAIL_NOT_CONFIGURED', message: 'Email service is temporarily unavailable. Please try again later.' };
  }
  if (errorCode === 'EAUTH' || Number(error?.responseCode) === 535) {
    return { code: 'EMAIL_AUTH_FAILED', message: 'Email service is temporarily unavailable. Please try again later.' };
  }
  return { code: 'EMAIL_NETWORK_ERROR', message: 'Email service is temporarily unavailable. Please try again later.' };
};
const RESET_TOKEN_TTL_MINUTES = Math.min(30, Math.max(15, Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 20));
const RESET_OTP_TTL_MINUTES = Math.min(15, Math.max(5, Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES) || 5));
const RESET_OTP_MAX_ATTEMPTS = Math.min(5, Math.max(1, Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) || 5));
const OTP_REQUEST_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_RATE_LIMIT_PER_EMAIL = 5;
const OTP_REQUEST_RATE_LIMIT_PER_PHONE = 4;
const OTP_REQUEST_RATE_LIMIT_PER_IP = 8;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const otpRequestBuckets = new Map();
const otpRequestIpBuckets = new Map();

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

const checkForOtpRateLimit = (destination, ipAddress, method = 'phone') => {
  const normalizedDestination = method === 'email'
    ? String(destination || '').trim().toLowerCase()
    : normalizePhoneNumber(destination || '');
  const safeIp = String(ipAddress || 'unknown').trim();
  const destinationState = getRateLimitState(
    otpRequestBuckets,
    normalizedDestination || (method === 'email' ? 'unknown-email' : 'unknown-phone'),
    method === 'email' ? OTP_REQUEST_RATE_LIMIT_PER_EMAIL : OTP_REQUEST_RATE_LIMIT_PER_PHONE,
    OTP_REQUEST_RATE_LIMIT_WINDOW_MS,
  );
  const ipState = getRateLimitState(otpRequestIpBuckets, safeIp, OTP_REQUEST_RATE_LIMIT_PER_IP, OTP_REQUEST_RATE_LIMIT_WINDOW_MS);
  return {
    blocked: destinationState.isBlocked || ipState.isBlocked,
    reason: destinationState.isBlocked ? method : ipState.isBlocked ? 'ip' : null,
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

const recordRecoveryEvent = ({ userId = null, event, result, req }) => recordAuthEvent({
  userId,
  action: `PASSWORD_RECOVERY_${event}`,
  result: result || (event.endsWith('_FAILED') ? 'Failure' : 'Success'),
  req,
});

const clearOtpState = async (recovery) => {
  if (!recovery) return;
  await recovery.update({
    otpHash: null,
    expiresAt: new Date(),
    attempts: 0,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    usedAt: new Date(),
  });
};
const normalizeRecoveryMethod = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (['phone', 'mobile', 'sms', 'tel'].includes(raw)) return 'phone';
  if (['email', 'mail'].includes(raw)) return 'email';
  return 'email';
};

const normalizeRecoveryDestination = (body = {}, method = 'email') => {
  const safeMethod = normalizeRecoveryMethod(method);
  const rawDestination = String(body.destination || body.email || body.phone || body.phoneNumber || body.mobile || '').trim();
  if (!rawDestination) return '';
  if (safeMethod === 'phone') return normalizePhoneNumber(rawDestination);
  return rawDestination.toLowerCase();
};

const getPhoneLookupCandidates = (phone, rawPhone = '') => {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) return [];

  return [...new Set([
    normalizedPhone,
    normalizedPhone.slice(1),
    `0${normalizedPhone.slice(4)}`,
    normalizedPhone.slice(4),
    String(rawPhone || '').trim(),
  ].filter(Boolean))];
};

const findUserByPhoneNumber = (phone, rawPhone = '') => {
  const phoneCandidates = getPhoneLookupCandidates(phone, rawPhone);
  if (!phoneCandidates.length) return null;
  return User.findOne({ where: { phone: { [Op.in]: phoneCandidates } } });
};

const requestForgotPassword = async (req, res) => {
  try {
    const method = normalizeRecoveryMethod(req.body?.method || req.body?.recoveryMethod || 'email');
    const destination = normalizeRecoveryDestination(req.body || {}, method);

    if (method === 'phone') {
      const requestBody = { ...req.body, phoneNumber: destination || req.body?.phoneNumber || req.body?.phone || req.body?.mobile || '' };
      return requestForgotPasswordOtp({ ...req, body: requestBody }, res);
    }

    const email = destination || String(req.body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const legacyRequest = { ...req, body: { ...req.body, method: 'email', email } };
    return forgotPassword(legacyRequest, res);
  } catch (error) {
    console.error('Recovery request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to process the recovery request.' });
  }
};

const verifyForgotPassword = async (req, res) => {
  try {
    const method = normalizeRecoveryMethod(req.body?.method || req.body?.recoveryMethod || 'phone');
    const destination = normalizeRecoveryDestination(req.body || {}, method);
    const requestBody = method === 'email'
      ? { ...req.body, method, email: destination || req.body?.email || '' }
      : { ...req.body, method, phoneNumber: destination || req.body?.phoneNumber || req.body?.phone || req.body?.mobile || '' };
    return verifyForgotPasswordOtp({ ...req, body: requestBody }, res);
  } catch (error) {
    console.error('Recovery verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify the recovery code.' });
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    if (req.body?.resetToken || req.body?.token) {
      return resetPasswordWithOtp(req, res);
    }
    return resetPassword(req, res);
  } catch (error) {
    console.error('Password reset flow failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
};

const requestForgotPasswordOtp = async (req, res) => {
  try {
    const method = normalizeRecoveryMethod(req.body?.method || req.body?.recoveryMethod || (req.body?.email ? 'email' : 'phone'));
    const email = String(req.body?.email || req.body?.destination || '').trim().toLowerCase();
    const rawPhone = String(req.body.phoneNumber || req.body.phone || req.body.mobile || req.body.destination || '').trim();
    const phone = normalizePhoneNumber(rawPhone);
    const ipAddress = getClientIp(req) || req.ip || 'unknown';

    if (method === 'email') {
      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }

      const rateLimitState = checkForOtpRateLimit(email, ipAddress, 'email');
      if (rateLimitState.blocked) {
        return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again later.' });
      }

      await recordRecoveryEvent({ event: 'REQUESTED', result: 'Success', req });
      const emailConfiguration = validateEmailConfiguration();
      const developmentOtpFallback = process.env.NODE_ENV === 'development' && !emailConfiguration.valid;
      if (!emailConfiguration.valid && !developmentOtpFallback) {
        console.warn(`Forgot password email configuration missing: ${(emailConfiguration.missingVariables || []).join(', ') || 'EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD'}`);
        return res.status(503).json({
          success: false,
          code: 'EMAIL_NOT_CONFIGURED',
          message: 'Email service is temporarily unavailable. Please try again later.',
        });
      }

      const user = await User.findOne({ where: { email } });
      if (!user || !user.active || (user.lockoutUntil && new Date(user.lockoutUntil) > new Date())) {
        return res.json({ success: true, message: getGenericOtpMessage('email') });
      }

      const previousRecovery = await PasswordRecovery.findOne({
        where: { userId: user.id, method, destination: email },
        order: [['createdAt', 'DESC']],
      });
      if (previousRecovery && Date.now() - new Date(previousRecovery.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
        return res.json({ success: true, message: getGenericOtpMessage('email') });
      }

      const otp = String(crypto.randomInt(100000, 1000000)).padStart(6, '0');
      const otpHash = hashValue(otp);
      const otpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);

      await PasswordRecovery.update({
        otpHash: null,
        expiresAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        usedAt: new Date(),
      }, { where: { userId: user.id, method, usedAt: null } });
      const recovery = await PasswordRecovery.create({
        userId: user.id,
        method,
        destination: email,
        otpHash,
        expiresAt: otpExpiresAt,
        attempts: 0,
      });

      if (developmentOtpFallback) {
        console.warn(`DEV ONLY: password reset OTP for ${email}: ${otp}`);
        await recordRecoveryEvent({ userId: user.id, event: 'OTP_SENT', result: 'Success', req });
        return res.json({ success: true, message: getGenericOtpMessage('email') });
      }

      try {
        await sendOtpEmail({
          to: user.email,
          fullName: user.fullName || user.username,
          otp,
          ttlMinutes: RESET_OTP_TTL_MINUTES,
        });
      } catch (error) {
        await clearOtpState(recovery);
        console.error(
          'Password reset OTP email delivery failed:',
          error.message || 'Unknown SMTP error',
          error.code || 'UNKNOWN',
          error.command || '',
          error.responseCode || '',
          error.errno || '',
          error.syscall || '',
        );
        const mappedError = mapEmailDeliveryError(error);
        return res.status(503).json({ success: false, ...mappedError });
      }

      await recordRecoveryEvent({ userId: user.id, event: 'OTP_SENT', result: 'Success', req });
      return res.json({ success: true, message: getGenericOtpMessage('email') });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid mobile phone number.' });
    }

    const rateLimitState = checkForOtpRateLimit(phone, ipAddress, 'phone');
    if (rateLimitState.blocked) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again later.' });
    }

    await recordRecoveryEvent({ event: 'REQUESTED', result: 'Success', req });
    if (!isSmsConfigured()) {
      return res.status(503).json({ success: false, code: 'SMS_NOT_CONFIGURED', message: 'SMS service is not available yet.' });
    }

    const user = await findUserByPhoneNumber(phone, rawPhone);
    if (!user || !user.active || (user.lockoutUntil && new Date(user.lockoutUntil) > new Date())) {
      return res.json({ success: true, message: getGenericOtpMessage('phone') });
    }

    const previousRecovery = await PasswordRecovery.findOne({
      where: { userId: user.id, method, destination: phone },
      order: [['createdAt', 'DESC']],
    });
    if (previousRecovery && Date.now() - new Date(previousRecovery.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.json({ success: true, message: getGenericOtpMessage('phone') });
    }

    const otp = String(crypto.randomInt(100000, 1000000)).padStart(6, '0');
    const otpHash = hashValue(otp);
    const otpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);

    await PasswordRecovery.update({
      otpHash: null,
      expiresAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      usedAt: new Date(),
    }, { where: { userId: user.id, method, usedAt: null } });
    const recovery = await PasswordRecovery.create({
      userId: user.id,
      method,
      destination: phone,
      otpHash,
      expiresAt: otpExpiresAt,
      attempts: 0,
    });

    const smsResult = await sendOtpSms(phone, otp, { ttlMinutes: RESET_OTP_TTL_MINUTES });
    if (smsResult.status !== 'sent') {
      await clearOtpState(recovery);
      console.error(
        'Password reset OTP SMS delivery failed for phone ending with',
        phone.slice(-4),
        'provider:',
        process.env.SMS_PROVIDER || 'unconfigured',
        'reason:',
        smsResult.reason || 'Unknown SMS provider error',
      );
      return res.status(503).json({ success: false, message: 'We could not send the verification code right now. Please try again later.' });
    }

    await recordRecoveryEvent({ userId: user.id, event: 'OTP_SENT', result: 'Success', req });

    return res.json({ success: true, message: getGenericOtpMessage('phone') });
  } catch (error) {
    await recordRecoveryEvent({ event: 'REQUEST_FAILED', result: 'Failure', req });
    console.error('Request password reset OTP failed:', error.message || 'Unknown recovery error', error.code || 'UNKNOWN');
    return res.status(500).json({ success: false, message: 'Unable to process the OTP request.' });
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const failVerification = async (status, message, userId = null) => {
      await recordRecoveryEvent({ userId, event: 'OTP_VERIFICATION_FAILED', result: 'Failure', req });
      return res.status(status).json({ success: false, message });
    };
    const method = normalizeRecoveryMethod(req.body?.method || req.body?.recoveryMethod || (req.body?.email ? 'email' : 'phone'));
    const rawPhone = String(req.body.phoneNumber || req.body.phone || req.body.mobile || req.body.destination || '').trim();
    const email = String(req.body.email || req.body.destination || '').trim().toLowerCase();
    const phone = normalizePhoneNumber(rawPhone);
    const otp = String(req.body.otp || '').trim();

    const targetEmail = method === 'email' ? email : '';
    const targetPhone = method === 'phone' ? phone : '';

    if (method === 'email') {
      if (!isValidEmail(targetEmail)) {
        return failVerification(400, 'Please enter a valid email address.');
      }
    } else if (!targetPhone) {
      return failVerification(400, 'Please enter a valid mobile phone number.');
    }

    if (!/^\d{6}$/.test(otp)) {
      return failVerification(400, 'Please enter a valid 6-digit verification code.');
    }

    const user = method === 'email'
      ? await User.findOne({ where: { email: targetEmail } })
      : await findUserByPhoneNumber(targetPhone, rawPhone);
    if (!user) return failVerification(400, 'Invalid or expired verification code.');

    const eligibility = await ensureEligibleResetUser(user, method);
    if (!eligibility.allowed) return failVerification(403, 'This account cannot complete password reset right now.', user.id);

    const destination = method === 'email' ? targetEmail : targetPhone;
    const recovery = await PasswordRecovery.findOne({
      where: { userId: user.id, method, destination, usedAt: null, verifiedAt: null },
      order: [['createdAt', 'DESC']],
    });
    if (!recovery || !recovery.otpHash || !recovery.expiresAt || new Date(recovery.expiresAt) < new Date()) {
      if (recovery) await clearOtpState(recovery);
      return failVerification(400, 'This verification code has expired.', user.id);
    }

    const enteredHash = hashValue(otp);
    if (!safeHashEquals(enteredHash, recovery.otpHash)) {
      const attempts = Number(recovery.attempts || 0) + 1;
      await recovery.update({ attempts });
      if (attempts >= RESET_OTP_MAX_ATTEMPTS) {
        await clearOtpState(recovery);
        return failVerification(429, 'Maximum verification attempts reached. Please request a new code.', user.id);
      }
      return failVerification(400, 'Invalid verification code.', user.id);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    const verifiedAt = new Date();
    const [verifiedCount] = await PasswordRecovery.update({
      otpHash: null,
      verifiedAt,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
      attempts: 0,
    }, {
      where: {
        id: recovery.id,
        userId: user.id,
        otpHash: recovery.otpHash,
        verifiedAt: null,
        usedAt: null,
        expiresAt: { [Op.gt]: verifiedAt },
      },
    });
    if (!verifiedCount) return failVerification(400, 'This verification code has expired.', user.id);

    await recordRecoveryEvent({ userId: user.id, event: 'OTP_VERIFICATION_SUCCEEDED', result: 'Success', req });

    return res.json({ success: true, message: 'Verification successful. Please create a new password.', resetToken: rawToken });
  } catch (error) {
    await recordRecoveryEvent({ event: 'OTP_VERIFICATION_FAILED', result: 'Failure', req });
    console.error('Password reset OTP verification failed.');
    return res.status(500).json({ success: false, message: 'Unable to verify the recovery code.' });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  let recoveryUserId = null;
  try {
    const token = String(req.body.resetToken || req.body.token || '').trim();
    const password = String(req.body.newPassword || req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || req.body.confirmPassword || '');
    const failReset = async (status, message, userId = recoveryUserId) => {
      await recordRecoveryEvent({ userId, event: 'PASSWORD_RESET_FAILED', result: 'Failure', req });
      return res.status(status).json({ success: false, message });
    };

    if (!token || !password || password !== confirmPassword) {
      return failReset(400, 'A valid reset token and matching passwords are required.');
    }

    const settings = await getSecuritySettings();
    const passwordError = validatePassword(password, settings);
    if (passwordError) return failReset(400, passwordError);

    const tokenHash = hashValue(token);
    const recovery = await PasswordRecovery.findOne({ where: { resetTokenHash: tokenHash, usedAt: null } });
    if (!recovery || !recovery.resetTokenExpiresAt || new Date(recovery.resetTokenExpiresAt) < new Date()) {
      return failReset(400, 'This password reset link is invalid or expired.');
    }

    recoveryUserId = recovery.userId;
    const user = await User.findOne({ where: { id: recovery.userId } });
    if (!user) return failReset(400, 'This password reset link is invalid or expired.');
    if (!user.active) {
      await recovery.update({ resetTokenHash: null, resetTokenExpiresAt: null, usedAt: new Date() });
      return failReset(403, 'This account cannot complete password reset right now.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const [claimedCount] = await PasswordRecovery.update({ resetTokenHash: null, usedAt: now }, {
      where: {
        id: recovery.id,
        userId: recovery.userId,
        resetTokenHash: tokenHash,
        usedAt: null,
        resetTokenExpiresAt: { [Op.gt]: now },
      },
    });
    if (!claimedCount) return failReset(400, 'This password reset link is invalid or expired.');

    const [updatedCount] = await User.update({
      password: hashedPassword,
      sessionVersion: (Number(user.sessionVersion) || 0) + 1,
    }, {
      where: { id: user.id, active: true },
    });

    if (!updatedCount) {
      return failReset(400, 'This password reset link is invalid or expired.');
    }

    await recordRecoveryEvent({ userId: user.id, event: 'PASSWORD_RESET_SUCCEEDED', result: 'Success', req });
    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET', result: 'Success', req });

    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    await recordRecoveryEvent({ userId: recoveryUserId, event: 'PASSWORD_RESET_FAILED', result: 'Failure', req });
    console.error('OTP-based password reset failed.');
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

    await recordRecoveryEvent({ event: 'REQUESTED', result: 'Success', req });
    const user = await User.findOne({ where: { email } });
    const eligibility = await ensureEligibleResetUser(user, 'email');
    if (!user || !eligibility.allowed) {
      return res.json({ success: true, message: genericResetMessage });
    }

    const emailConfiguration = validateEmailConfiguration();
    if (!emailConfiguration.valid) {
      return res.status(503).json({ success: false, message: 'Unable to process the password reset request.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    const resetUrl = `${getResetFrontendUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await PasswordRecovery.update({
      otpHash: null,
      expiresAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      usedAt: new Date(),
    }, { where: { userId: user.id, method: 'email', usedAt: null } });
    const recovery = await PasswordRecovery.create({
      userId: user.id,
      method: 'email',
      destination: email,
      otpHash: null,
      expiresAt,
      attempts: 0,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
    });

    // Any delivery failure, including a timeout, must not leave a usable token behind.
    const rollbackResetToken = async () => {
      try {
        await recovery.update({ resetTokenHash: null, resetTokenExpiresAt: null, usedAt: new Date() });
      } catch (rollbackError) {
        console.error('Failed to roll back password reset authorization.');
      }
    };

    const mailResult = await sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName || user.username,
      resetUrl,
      ttlMinutes: RESET_TOKEN_TTL_MINUTES,
    });

    if (mailResult.status !== 'sent') {
      await rollbackResetToken();
      console.error('Forgot password error: reset email not delivered -', mailResult.reason);
      return res.status(503).json({ success: false, message: 'Unable to process the password reset request.' });
    }

    await recordAuthEvent({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', result: 'Success', req });
    await recordRecoveryEvent({ userId: user.id, event: 'RESET_LINK_SENT', result: 'Success', req });

    return res.json({ success: true, message: genericResetMessage });
  } catch (error) {
    await recordRecoveryEvent({ event: 'REQUEST_FAILED', result: 'Failure', req });
    console.error('Forgot password request failed.');
    return res.status(503).json({ success: false, message: 'Unable to process the password reset request.' });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { phone, email, method, phoneNumber, destination } = req.body;
    const recoveryMethod = String(method || (phoneNumber || phone ? 'phone' : (email || destination ? 'email' : 'phone'))).trim().toLowerCase();

    if (recoveryMethod === 'phone') {
      return verifyForgotPasswordOtp(req, res);
    }

    if (recoveryMethod === 'email') {
      return verifyForgotPasswordOtp({ ...req, body: { ...req.body, method: 'email', email: email || destination || '' } }, res);
    }

    return res.status(400).json({ success: false, message: 'Unsupported recovery method for verification.' });
  } catch (error) {
    console.error('OTP verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify the recovery code.' });
  }
};

const resetPassword = async (req, res) => {
  const body = req.body || {};
  return resetPasswordWithOtp({
    ...req,
    body: {
      ...body,
      resetToken: body.resetToken || body.token,
      newPassword: body.newPassword || body.password,
    },
  }, res);
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
  requestForgotPassword,
  verifyForgotPassword,
  resetForgotPassword,
  verifyResetOtp,
  resetPassword,
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  getSecuritySettings,
  validatePassword,
};
