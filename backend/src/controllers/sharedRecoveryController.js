const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, PasswordRecovery } = require('../models');
const { normalizePhoneNumber } = require('../services/smsService');
const { sendVerificationCode, verifyVerificationCode, resolveDestination } = require('../services/verificationCodeService');

const RESET_TOKEN_TTL_MINUTES = 15;
const genericMessage = 'If an active account matches that contact method, a verification code has been sent.';
const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const findUserForContact = async (channel, value) => {
  if (channel === 'email') return User.findOne({ where: { email: value } });
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return null;
  const candidates = await User.findAll({
    where: { phone: { [Op.like]: `%${normalized.slice(-8)}%` } },
  });
  return candidates.find((candidate) => normalizePhoneNumber(candidate.phone) === normalized) || null;
};

const requestCode = async (req, res) => {
  const channel = String(req.body?.method || req.body?.channel || (req.body?.email ? 'email' : 'phone'));
  const destination = channel === 'email'
    ? String(req.body?.email || req.body?.destination || '').trim().toLowerCase()
    : normalizePhoneNumber(req.body?.phoneNumber || req.body?.phone || req.body?.mobile || req.body?.destination);
  if (!['email', 'phone'].includes(channel) || !destination) {
    return res.status(400).json({ success: false, message: channel === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid mobile phone number.' });
  }
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  try {
    const user = await findUserForContact(channel, destination);
    if (!user || !user.active || (user.lockoutUntil && new Date(user.lockoutUntil) > new Date())) {
      return res.json({ success: true, message: genericMessage });
    }
    await sendVerificationCode({ user, channel, purpose: 'forgot_password', requestId: req.requestId });
    return res.json({ success: true, message: genericMessage });
  } catch (error) {
    if (error.statusCode === 429) return res.status(429).json({ success: false, message: 'Too many verification requests. Please try again later.' });
    if (error.deliveryFailure) {
      return res.status(503).json({
        success: false,
        code: error.code === 'EMAIL_NOT_CONFIGURED' ? error.code : undefined,
        message: channel === 'phone'
          ? 'We could not send the verification code by phone. Try another method.'
          : 'Email verification is temporarily unavailable. Try another method.',
      });
    }
    console.error('Password recovery code request failed.', {
      errorType: error.name || 'Error',
      code: error.code || error.parent?.code || 'UNKNOWN',
      requestId: req.requestId || null,
    });
    return res.status(500).json({ success: false, message: 'Unable to process the verification request.' });
  }
};

const verifyCode = async (req, res) => {
  const channel = String(req.body?.method || req.body?.channel || (req.body?.email ? 'email' : 'phone'));
  const destination = channel === 'email'
    ? String(req.body?.email || req.body?.destination || '').trim().toLowerCase()
    : normalizePhoneNumber(req.body?.phoneNumber || req.body?.phone || req.body?.mobile || req.body?.destination);
  if (!['email', 'phone'].includes(channel) || !destination) {
    return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
  }
  try {
    const user = await findUserForContact(channel, destination);
    if (!user || !user.active || (user.lockoutUntil && new Date(user.lockoutUntil) > new Date())) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }
    const verified = await verifyVerificationCode({
      userId: user.id,
      channel,
      purpose: 'forgot_password',
      code: req.body?.otp || req.body?.code,
      consume: true,
    });
    if (!verified.valid) {
      return res.status(verified.reason === 'attempts' ? 429 : 400).json({
        success: false,
        message: verified.reason === 'attempts'
          ? 'Maximum verification attempts reached. Request a new code.'
          : verified.reason === 'expired'
            ? 'This verification code has expired.'
            : 'Invalid verification code.',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    await PasswordRecovery.create({
      userId: user.id,
      method: channel,
      destination: resolveDestination(user, channel),
      otpHash: null,
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      attempts: 0,
      verifiedAt: now,
      usedAt: null,
      resetTokenHash: hashValue(rawToken),
      resetTokenExpiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });
    return res.json({ success: true, message: 'Verification successful. Please create a new password.', resetToken: rawToken });
  } catch (error) {
    console.error('Password recovery code verification failed.', {
      errorType: error.name || 'Error',
      code: error.code || error.parent?.code || 'UNKNOWN',
      requestId: req.requestId || null,
    });
    return res.status(500).json({ success: false, message: 'Unable to verify the recovery code.' });
  }
};

module.exports = { requestCode, verifyCode, findUserForContact };
