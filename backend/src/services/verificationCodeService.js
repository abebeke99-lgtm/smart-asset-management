const crypto = require('crypto');
const { Op } = require('sequelize');
const { VerificationCode } = require('../models');
const { sendOtpEmail } = require('./emailService');
const { normalizePhoneNumber, sendOtpSms } = require('./smsService');

const CODE_TTL_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const USER_SEND_LIMIT = 5;
const USER_SEND_WINDOW_MS = 15 * 60 * 1000;

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const secureCodeMatch = (candidate, expected) => {
  const candidateHash = Buffer.from(hashCode(candidate), 'hex');
  const expectedHash = Buffer.from(String(expected || ''), 'hex');
  return candidateHash.length === expectedHash.length && crypto.timingSafeEqual(candidateHash, expectedHash);
};

const resolveDestination = (user, channel) => {
  if (channel === 'email') {
    const email = String(user.email || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  return normalizePhoneNumber(user.phone);
};

const sendVerificationCode = async ({ user, channel, purpose, requestId }) => {
  if (!['email', 'phone'].includes(channel) || !['first_login', 'forgot_password'].includes(purpose)) {
    const error = new Error('Invalid verification request.');
    error.statusCode = 400;
    throw error;
  }
  const destination = resolveDestination(user, channel);
  if (!destination) {
    const error = new Error(`A valid ${channel === 'email' ? 'email address' : 'mobile phone number'} is not available.`);
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const recent = await VerificationCode.findAll({
    where: { userId: user.id, purpose, createdAt: { [Op.gte]: new Date(now.getTime() - USER_SEND_WINDOW_MS) } },
    order: [['createdAt', 'DESC']],
    limit: USER_SEND_LIMIT,
  });
  const lastOnChannel = await VerificationCode.findOne({
    where: { userId: user.id, purpose, channel },
    order: [['createdAt', 'DESC']],
  });
  if (recent.length >= USER_SEND_LIMIT || (lastOnChannel && now.getTime() - new Date(lastOnChannel.createdAt).getTime() < RESEND_COOLDOWN_MS)) {
    const error = new Error('Please wait before requesting another verification code.');
    error.statusCode = 429;
    throw error;
  }

  await VerificationCode.update({ usedAt: now }, { where: { userId: user.id, purpose, usedAt: null } });
  const code = String(crypto.randomInt(100000, 1000000));
  const record = await VerificationCode.create({
    userId: user.id,
    channel,
    codeHash: hashCode(code),
    purpose,
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
    attempts: 0,
  });

  try {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[DEV ONLY] Verification code for userId=${user.id} channel=${channel}: ${code}`);
    } else if (channel === 'email') {
      await sendOtpEmail({
        to: destination,
        fullName: user.fullName || user.username,
        otp: code,
        ttlMinutes: CODE_TTL_MINUTES,
        purpose,
      });
    } else {
      const smsResult = await sendOtpSms(destination, code, { ttlMinutes: CODE_TTL_MINUTES });
      if (smsResult.status !== 'sent') {
        const error = new Error(smsResult.reason || 'SMS delivery is unavailable.');
        error.code = smsResult.code || 'SMS_DELIVERY_FAILED';
        throw error;
      }
    }
  } catch (error) {
    await record.update({ usedAt: new Date() });
    console.error('Verification code delivery failed.', {
      userId: user.id,
      channel,
      purpose,
      code: error.code || 'DELIVERY_FAILED',
      requestId: requestId || null,
    });
    error.deliveryFailure = true;
    throw error;
  }

  return { expiresInSeconds: CODE_TTL_MINUTES * 60 };
};

const verifyVerificationCode = async ({ userId, channel, purpose, code, consume = false, transaction }) => {
  if (!/^\d{6}$/.test(String(code || ''))) return { valid: false, reason: 'invalid' };
  const now = new Date();
  const record = await VerificationCode.findOne({
    where: { userId, channel, purpose, usedAt: null },
    order: [['createdAt', 'DESC']],
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!record || new Date(record.expiresAt) <= now) return { valid: false, reason: 'expired' };

  if (!secureCodeMatch(String(code), record.codeHash)) {
    const attempts = Number(record.attempts || 0) + 1;
    await record.update({
      attempts,
      ...(attempts >= CODE_MAX_ATTEMPTS ? { usedAt: now } : {}),
    }, transaction ? { transaction } : {});
    return { valid: false, reason: attempts >= CODE_MAX_ATTEMPTS ? 'attempts' : 'invalid' };
  }

  if (consume) {
    const [updated] = await VerificationCode.update({ usedAt: now }, {
      where: { id: record.id, usedAt: null, expiresAt: { [Op.gt]: now } },
      ...(transaction ? { transaction } : {}),
    });
    if (!updated) return { valid: false, reason: 'expired' };
  }
  return { valid: true, record };
};

module.exports = {
  CODE_TTL_MINUTES,
  CODE_MAX_ATTEMPTS,
  sendVerificationCode,
  verifyVerificationCode,
  resolveDestination,
};
