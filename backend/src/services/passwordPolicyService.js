const { Config } = require('../models');

const DEFAULT_SECURITY_SETTINGS = {
  password_min_length: 8,
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

const validatePassword = (password, settings) => {
  if (String(password).length < Number(settings.password_min_length)) return `Password must be at least ${settings.password_min_length} characters`;
  if (settings.password_require_uppercase && !/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (settings.password_require_lowercase && !/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (settings.password_require_numbers && !/\d/.test(password)) return 'Password must contain a number';
  if (settings.password_require_special && !/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
};

module.exports = { DEFAULT_SECURITY_SETTINGS, getSecuritySettings, validatePassword };
