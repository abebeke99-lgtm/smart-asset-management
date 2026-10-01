require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, getDatabaseConfig } = require('../config/database');
const User = require('../models/User');
const { getSecuritySettings, validatePassword } = require('../controllers/authController');

const assertRepairTarget = () => {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Admin password repair is allowed only with NODE_ENV=production.');
  }

  if (!process.env.DATABASE_URL && !process.env.MYSQL_URL) {
    throw new Error('A production DATABASE_URL or MYSQL_URL is required.');
  }

  const config = getDatabaseConfig();
  if (!config.database || process.env.ADMIN_PASSWORD_REPAIR_DATABASE !== config.database) {
    throw new Error('ADMIN_PASSWORD_REPAIR_DATABASE must exactly match the configured database name.');
  }

  if (['localhost', '127.0.0.1', '::1'].includes(String(config.host).toLowerCase())) {
    throw new Error('Admin password repair refuses to target a local database.');
  }

  return config;
};

const repairExistingAdminPassword = async ({ userModel = User, password, settings, transaction } = {}) => {
  if (typeof password !== 'string' || !password) {
    throw new Error('ADMIN_PASSWORD_REPAIR_PASSWORD must be set in the local environment.');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('The repair password exceeds bcryptjs’s 72-byte limit.');
  }

  const passwordError = validatePassword(password, settings);
  if (passwordError) throw new Error(passwordError);

  const options = { where: { username: 'admin' } };
  if (transaction) {
    options.transaction = transaction;
    options.lock = transaction.LOCK.UPDATE;
  }

  const user = await userModel.findOne(options);
  if (!user) throw new Error('Existing admin account was not found; no account was created.');
  if (user.role !== 'admin' || !(user.active === true || user.active === 1)) {
    throw new Error('Existing admin account is inactive or does not have the admin role.');
  }

  if (await bcrypt.compare(password, user.password)) {
    return { userId: user.id, changed: false };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await user.update({ password: passwordHash }, { ...(transaction ? { transaction } : {}), silent: true });
  if (!(await bcrypt.compare(password, user.password))) {
    throw new Error('Password verification failed after repair.');
  }

  return { userId: user.id, changed: true };
};

const main = async () => {
  const database = assertRepairTarget().database;
  const password = process.env.ADMIN_PASSWORD_REPAIR_PASSWORD;
  await sequelize.authenticate();
  const settings = await getSecuritySettings();
  const transaction = await sequelize.transaction();

  try {
    const result = await repairExistingAdminPassword({ userModel: User, password, settings, transaction });
    await transaction.commit();
    console.log(JSON.stringify({ database, account: 'admin', role: 'admin', passwordUpdated: result.changed }));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => sequelize.close());
}

module.exports = { assertRepairTarget, repairExistingAdminPassword };