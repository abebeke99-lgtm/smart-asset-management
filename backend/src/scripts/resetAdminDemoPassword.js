require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { sequelize, User, AuditLog } = require('../models');
const { login } = require('../controllers/authController');

const resetAdminDemoPassword = async () => {
  const password = String(process.env.SEED_DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || '').trim();
  if (!password || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('A valid configured demo password is required.');
  }

  await sequelize.authenticate();

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findOne({
      where: { username: 'admin' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user || user.role !== 'admin' || !(user.active === true || user.active === 1)) {
      throw new Error('An active admin account is required.');
    }

    const updates = { password: await bcrypt.hash(password, 10) };
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      updates.failedLoginAttempts = 0;
      updates.lockoutUntil = null;
    }
    await user.update(updates, { transaction, silent: true });
    if (!(await bcrypt.compare(password, user.password))) {
      throw new Error('Password verification failed after reset.');
    }
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }

  const verificationTransaction = await sequelize.transaction();
  const originalFindOne = User.findOne;
  const originalUpdate = User.prototype.update;
  const originalAuditCreate = AuditLog.create;
  let passwordVerificationSucceeded = false;

  try {
    User.findOne = function findOneWithTransaction(options = {}) {
      return originalFindOne.call(this, { ...options, transaction: options.transaction || verificationTransaction });
    };
    User.prototype.update = function updateWithTransaction(values, options = {}) {
      return originalUpdate.call(this, values, { ...options, transaction: options.transaction || verificationTransaction });
    };
    AuditLog.create = function createWithTransaction(values, options = {}) {
      return originalAuditCreate.call(this, values, { ...options, transaction: options.transaction || verificationTransaction });
    };

    let statusCode = 200;
    let responseBody;
    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    await login({
      body: { username: 'admin', password },
      headers: { 'user-agent': 'admin-password-reset-verification' },
      ip: '127.0.0.1',
    }, response);
    passwordVerificationSucceeded = statusCode === 200 && responseBody?.success === true;
  } finally {
    User.findOne = originalFindOne;
    User.prototype.update = originalUpdate;
    AuditLog.create = originalAuditCreate;
    if (!verificationTransaction.finished) await verificationTransaction.rollback();
  }

  const user = await User.findOne({ where: { username: 'admin' } });
  const accountActive = Boolean(user && (user.active === true || user.active === 1));
  const accountLocked = Boolean(user && user.lockoutUntil && new Date(user.lockoutUntil) > new Date());

  return { passwordVerificationSucceeded, accountActive, accountLocked };
};

if (require.main === module) {
  resetAdminDemoPassword()
    .then((result) => {
      console.log(JSON.stringify({
        'Password reset succeeded': 'YES',
        'Password verification succeeded': result.passwordVerificationSucceeded ? 'YES' : 'NO',
        'Account active': result.accountActive ? 'YES' : 'NO',
        'Account locked': result.accountLocked ? 'YES' : 'NO',
      }));
      if (!result.passwordVerificationSucceeded || !result.accountActive || result.accountLocked) process.exitCode = 1;
    })
    .catch(() => {
      console.log(JSON.stringify({
        'Password reset succeeded': 'NO',
        'Password verification succeeded': 'NO',
        'Account active': 'NO',
        'Account locked': 'NO',
      }));
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { resetAdminDemoPassword };