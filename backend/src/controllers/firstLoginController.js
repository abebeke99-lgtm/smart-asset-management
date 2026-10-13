const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');
const { generateToken, validatePassword } = require('./authController');
const { sendVerificationCode, verifyVerificationCode } = require('../services/verificationCodeService');
const { getConfiguredRolePermissions } = require('../services/rolePermissionService');
const { getDatabasePermissionKeys } = require('../middlewares/authorize');

const sendCode = async (req, res) => {
  try {
    const channel = String(req.body?.channel || '');
    await sendVerificationCode({
      user: req.user,
      channel,
      purpose: 'first_login',
      requestId: req.requestId,
    });
    return res.json({ success: true, message: 'If the selected contact method is available, a verification code has been sent.' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.deliveryFailure) {
      return res.status(503).json({
        success: false,
        message: error.code === 'EMAIL_NOT_CONFIGURED'
          ? 'Email verification is unavailable. Choose another contact method.'
          : 'We could not send the verification code. Choose another contact method or try again later.',
      });
    }
    console.error('First-login verification request failed.', {
      errorType: error.name || 'Error',
      code: error.code || error.parent?.code || 'UNKNOWN',
      requestId: req.requestId || null,
    });
    return res.status(500).json({ success: false, message: 'Unable to send the verification code right now.' });
  }
};

const verifyCode = async (req, res) => {
  try {
    const result = await verifyVerificationCode({
      userId: req.user.id,
      channel: String(req.body?.channel || ''),
      purpose: 'first_login',
      code: req.body?.code,
    });
    if (!result.valid) {
      const status = result.reason === 'attempts' ? 429 : 400;
      const message = result.reason === 'attempts'
        ? 'Maximum verification attempts reached. Request a new code.'
        : result.reason === 'expired'
          ? 'This verification code has expired. Request a new code.'
          : 'Invalid verification code.';
      return res.status(status).json({ success: false, message });
    }
    return res.json({ success: true, message: 'Verification code accepted.' });
  } catch (error) {
    console.error('First-login verification failed.', {
      errorType: error.name || 'Error',
      code: error.code || error.parent?.code || 'UNKNOWN',
      requestId: req.requestId || null,
    });
    return res.status(500).json({ success: false, message: 'Unable to verify the code right now.' });
  }
};

const completeFirstLogin = async (req, res) => {
  const { channel, code, newPassword, confirmPassword } = req.body || {};
  if (!['email', 'phone'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Choose a valid verification method.' });
  }
  if (typeof newPassword !== 'string' || !newPassword || typeof confirmPassword !== 'string' || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'New password and confirmation are required.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ success: false, message: passwordError });
  if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ success: false, message: 'Password must include uppercase and lowercase letters, a number, and a symbol.' });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.mustChangePassword) {
      return res.status(403).json({ success: false, message: 'This first-login session is no longer valid. Sign in again.' });
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ success: false, message: 'Your new password must be different from the temporary password.' });
    }

    const preverifiedCode = await verifyVerificationCode({
      userId: user.id,
      channel,
      purpose: 'first_login',
      code,
    });
    if (!preverifiedCode.valid) {
      const status = preverifiedCode.reason === 'attempts' ? 429 : 400;
      const message = preverifiedCode.reason === 'attempts'
        ? 'Maximum verification attempts reached. Request a new code.'
        : preverifiedCode.reason === 'expired'
          ? 'This verification code has expired. Request a new code.'
          : 'Invalid verification code.';
      return res.status(status).json({ success: false, message });
    }

    const changedAt = new Date();
    const savedUser = await sequelize.transaction(async (transaction) => {
      const currentUser = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!currentUser || !currentUser.mustChangePassword) {
        const error = new Error('This first-login session is no longer valid. Sign in again.');
        error.statusCode = 403;
        throw error;
      }
      const verification = await verifyVerificationCode({
        userId: currentUser.id,
        channel,
        purpose: 'first_login',
        code,
        consume: true,
        transaction,
      });
      if (!verification.valid) {
        const error = new Error(verification.reason === 'expired'
          ? 'This verification code has expired. Request a new code.'
          : verification.reason === 'attempts'
            ? 'Maximum verification attempts reached. Request a new code.'
            : 'Invalid verification code.');
        error.statusCode = verification.reason === 'attempts' ? 429 : 400;
        throw error;
      }

      await currentUser.update({
        password: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
        passwordChangedAt: changedAt,
        ...(channel === 'email' ? { emailVerifiedAt: changedAt } : { phoneVerifiedAt: changedAt }),
        sessionVersion: Number(currentUser.sessionVersion || 0) + 1,
      }, { transaction });
      return currentUser;
    });

    const rolePermissions = await getConfiguredRolePermissions(savedUser.role);
    const databasePermissions = await getDatabasePermissionKeys(savedUser);
    const userPayload = {
      id: savedUser.id,
      username: savedUser.username,
      email: savedUser.email,
      fullName: savedUser.fullName,
      role: savedUser.role,
      department: savedUser.department,
      collegeId: savedUser.collegeId ?? null,
      departmentId: savedUser.departmentId ?? null,
      active: savedUser.active,
      permissions: [...new Set([...(rolePermissions || []), ...databasePermissions])],
    };
    return res.json({
      success: true,
      message: 'Your password has been updated.',
      token: await generateToken(savedUser),
      user: userPayload,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error('First-login password change failed.', {
      errorType: error.name || 'Error',
      code: error.code || error.parent?.code || 'UNKNOWN',
      requestId: req.requestId || null,
    });
    return res.status(500).json({ success: false, message: 'Unable to update your password right now.' });
  }
};

module.exports = { sendCode, verifyCode, completeFirstLogin };
