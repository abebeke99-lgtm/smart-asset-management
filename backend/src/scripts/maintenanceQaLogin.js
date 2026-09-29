const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const { sequelize, User, Department, AuditLog } = require('../models');

const identity = {
  username: 'qa_e2e_maintenance',
  email: 'qa-e2e-maintenance@local.test',
  fullName: 'QA E2E Maintenance User',
  role: 'maintenance',
};

const assertNonProduction = () => {
  if (process.env.NODE_ENV === 'production') throw new Error('QA login accounts may only be managed in local or staging environments.');
};

const findAccount = async (transaction) => {
  const user = await User.findOne({ where: { username: identity.username }, transaction });
  if (user && (user.email !== identity.email || user.fullName !== identity.fullName || user.role !== identity.role)) {
    throw new Error(`Refusing to modify ${identity.username}: existing account identity does not match.`);
  }
  return user;
};

const main = async () => {
  assertNonProduction();
  const command = process.argv[2] || '--inspect';
  if (!['--inspect', '--create', '--deactivate'].includes(command)) throw new Error('Use --inspect, --create, or --deactivate.');

  if (command === '--inspect') {
    const user = await findAccount();
    console.log(JSON.stringify({ database: sequelize.config.database, nodeEnvironment: process.env.NODE_ENV || 'development', username: identity.username, exists: Boolean(user), id: user?.id || null, active: Boolean(user?.active) }, null, 2));
    return;
  }

  if (command === '--create') {
    const password = String(process.env.QA_MAINTENANCE_PASSWORD || '');
    if (password.length < 12) throw new Error('Set QA_MAINTENANCE_PASSWORD to a password of at least 12 characters in the local environment.');
  }

  const transaction = await sequelize.transaction();
  try {
    const user = await findAccount(transaction);
    if (command === '--create') {
      const department = await Department.findOne({ where: { name: 'Engineering' }, transaction });
      const values = {
        ...identity,
        department: department?.name || '',
        departmentId: department?.id || null,
        password: await bcrypt.hash(process.env.QA_MAINTENANCE_PASSWORD, 12),
        active: true,
        forcePasswordChange: false,
        sessionVersion: Number(user?.sessionVersion || 0) + 1,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        resetOtpHash: null,
        resetOtpExpiresAt: null,
      };
      const saved = user ? await user.update(values, { transaction }) : await User.create(values, { transaction });
      await AuditLog.create({ userId: null, action: 'QA_E2E_LOGIN_CREATED', entity: `user:${saved.id}`, details: JSON.stringify({ username: identity.username, active: true }) }, { transaction });
      await transaction.commit();
      console.log(JSON.stringify({ action: 'created_or_reset', id: saved.id, username: identity.username, active: true }, null, 2));
      return;
    }

    if (!user) {
      await transaction.rollback();
      console.log(JSON.stringify({ action: 'no_change', username: identity.username, exists: false }, null, 2));
      return;
    }
    await user.update({
      active: false,
      password: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
      sessionVersion: Number(user.sessionVersion || 0) + 1,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetOtpHash: null,
      resetOtpExpiresAt: null,
    }, { transaction });
    await AuditLog.create({ userId: null, action: 'QA_E2E_LOGIN_DEACTIVATED', entity: `user:${user.id}`, details: JSON.stringify({ username: identity.username, active: false }) }, { transaction });
    await transaction.commit();
    console.log(JSON.stringify({ action: 'deactivated', id: user.id, username: identity.username, active: false }, null, 2));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});
