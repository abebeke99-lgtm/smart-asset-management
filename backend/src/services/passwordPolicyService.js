const { Config } = require('../models');

const DEFAULT_SECURITY_SETTINGS = {
  password_min_length: 8,
  password_max_length: 16,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_numbers: true,
  password_require_special: true,
  session_timeout: 60,
  max_login_attempts: 5,
  account_lockout_duration: 30,
  jwt_expiry: 7,
};

const getSecuritySettings = async () => {
  try {
    const record = await Config.findByPk('security');
    return { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
  } catch (error) {
    if (error?.name === 'SequelizeDatabaseError' || error?.parent?.code === 'SQLITE_ERROR') {
      return DEFAULT_SECURITY_SETTINGS;
    }
    return DEFAULT_SECURITY_SETTINGS;
  }
};

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length === 0) return 'Password is required.';
  if (password.length < 8 || password.length > 16) return 'Password must be 8–16 characters long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
};

module.exports = { DEFAULT_SECURITY_SETTINGS, getSecuritySettings, validatePassword };
