require('dotenv').config();
require('../models');

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const { getConfiguredRolePermissions } = require('../services/rolePermissionService');
const { isAccountActive } = require('../utils/accountStatus');

const EXPECTED_ROLES = {
  admin: 'admin',
  ict_officer: 'ict_officer',
  college_manager: 'college_manager',
  department_head: 'department_head',
  finance: 'finance',
  store_manager: 'store_manager',
  maintenance: 'maintenance',
  infrastructure: 'infrastructure',
};

async function resetDemoPasswords({
  password: configuredPassword = process.env.SEED_DEMO_PASSWORD,
  database = sequelize,
  userModel = User,
  getRolePermissions = getConfiguredRolePermissions,
} = {}) {
  const password = String(configuredPassword ?? '').trim();
  if (!password) throw new Error('SEED_DEMO_PASSWORD is required.');

  await database.authenticate();

  return database.transaction(async (transaction) => {
    const usernames = Object.keys(EXPECTED_ROLES);
    const accounts = await userModel.findAll({
      where: { username: { [Op.in]: usernames } },
      attributes: ['id', 'username', 'role', 'active', 'status', 'lockoutUntil'],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      accounts.length !== usernames.length
      || accounts.some((user) => (
        user.role !== EXPECTED_ROLES[user.username]
        || !isAccountActive(user.active)
        || ['inactive', 'suspended'].includes(String(user.status || '').toLowerCase())
        || (user.lockoutUntil && new Date(user.lockoutUntil) > new Date())
      ))
    ) {
      throw new Error('Demo accounts are missing, inactive, locked, or have unexpected roles.');
    }

    const permissionsBefore = await Promise.all(
      usernames.map(async (username) => [username, await getRolePermissions(EXPECTED_ROLES[username])])
    );
    const passwordHash = await bcrypt.hash(password, 10);
    const userIds = accounts.map((user) => user.id);
    const [updatedCount] = await userModel.update(
      { password: passwordHash },
      { where: { id: { [Op.in]: userIds } }, transaction }
    );
    if (updatedCount !== usernames.length) throw new Error('Not all demo account passwords were updated.');

    const updatedUsers = await userModel.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['username', 'role', 'active', 'status', 'password'],
      transaction,
    });
    const usersByName = new Map(updatedUsers.map((user) => [user.username, user]));
    const authenticationChecks = await Promise.all(
      usernames.map(async (username) => {
        const user = usersByName.get(username);
        return Boolean(
          user
          && user.role === EXPECTED_ROLES[username]
          && isAccountActive(user.active)
          && !['inactive', 'suspended'].includes(String(user.status || '').toLowerCase())
          && await bcrypt.compare(password, user.password)
        );
      })
    );
    const permissionsAfter = await Promise.all(
      usernames.map(async (username) => [username, await getRolePermissions(EXPECTED_ROLES[username])])
    );

    if (
      updatedUsers.length !== usernames.length
      || authenticationChecks.some((valid) => !valid)
      || JSON.stringify(permissionsAfter) !== JSON.stringify(permissionsBefore)
    ) {
      throw new Error('Post-reset password, account, or permission verification failed.');
    }

    return usernames;
  });
}

if (require.main === module) {
  resetDemoPasswords()
    .then((usernames) => {
      usernames.forEach((username) => console.log(`${username}: PASS`));
      console.log(`Password reset succeeded: ${usernames.length} accounts updated.`);
    })
    .catch(() => {
      console.error('Password reset failed. No credentials displayed.');
      process.exitCode = 1;
    })
    .finally(async () => sequelize.close());
}

module.exports = { EXPECTED_ROLES, resetDemoPasswords };
