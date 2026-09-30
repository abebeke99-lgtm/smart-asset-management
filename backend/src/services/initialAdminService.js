const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ADMIN_USERNAME = 'admin';
const ADMIN_EMAIL = 'admin@bekelei.com';
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

const validateInitialAdminPassword = (password) => {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be a valid bcrypt-compatible password.');
  }

  if (
    password.length < 8
    || !/[A-Z]/.test(password)
    || !/[a-z]/.test(password)
    || !/\d/.test(password)
    || !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error('INITIAL_ADMIN_PASSWORD does not meet the configured password policy.');
  }
};

const verifyExistingAdmin = (user) => {
  const active = user.active === true || user.active === 1;
  const adminRole = String(user.role || '').toLowerCase() === 'admin';
  const validPasswordHash = typeof user.password === 'string' && BCRYPT_HASH_PATTERN.test(user.password);

  if (!active || !adminRole || !validPasswordHash) {
    throw new Error('Existing admin account failed verification. Check its active status, role, and bcrypt password hash.');
  }

  return { created: false, userId: user.id };
};

const initializeInitialAdmin = async ({ userModel = User } = {}) => {
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Set INITIAL_ADMIN_PASSWORD in the backend environment before initializing the first admin.');
  }

  const existingAdmin = await userModel.findOne({ where: { username: ADMIN_USERNAME } });
  if (existingAdmin) {
    return verifyExistingAdmin(existingAdmin);
  }

  validateInitialAdminPassword(password);
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await userModel.create({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: passwordHash,
      fullName: 'System Administrator',
      role: 'admin',
      department: 'Administration',
      active: true,
    });

    return { created: true, userId: user.id };
  } catch (error) {
    if (error.name !== 'SequelizeUniqueConstraintError') {
      throw error;
    }

    const createdByAnotherProcess = await userModel.findOne({ where: { username: ADMIN_USERNAME } });
    if (createdByAnotherProcess) {
      return verifyExistingAdmin(createdByAnotherProcess);
    }

    throw error;
  }
};

module.exports = { initializeInitialAdmin };