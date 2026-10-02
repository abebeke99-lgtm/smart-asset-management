require('dotenv').config();
require('../models');

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User } = require('../models');

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

async function resetDemoPasswords() {
  const password = String(process.env.SEED_DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || '').trim();
  if (!password) throw new Error();

  return sequelize.transaction(async (transaction) => {
    const usernames = Object.keys(EXPECTED_ROLES);
    const accounts = await User.findAll({
      where: { username: { [Op.in]: usernames } },
      attributes: ['id', 'username', 'role', 'active'],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (accounts.length !== usernames.length || accounts.some((user) => user.role !== EXPECTED_ROLES[user.username] || !user.active)) {
      throw new Error();
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userIds = accounts.map((user) => user.id);
    const [updatedCount] = await User.update(
      { password: passwordHash },
      { where: { id: { [Op.in]: userIds } }, transaction }
    );
    if (updatedCount !== usernames.length) throw new Error();

    const updatedUsers = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['username', 'active', 'password'],
      transaction,
    });
    const authenticationChecks = await Promise.all(
      updatedUsers.map((user) => bcrypt.compare(password, user.password))
    );

    if (
      updatedUsers.length !== usernames.length
      || updatedUsers.some((user) => !user.active)
      || authenticationChecks.some((valid) => !valid)
    ) {
      throw new Error();
    }

    return updatedCount;
  });
}

resetDemoPasswords()
  .then((updatedCount) => {
    console.log(`Password reset succeeded: ${updatedCount} accounts updated.`);
  })
  .catch(() => {
    console.error('Password reset failed; no credentials displayed.');
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());