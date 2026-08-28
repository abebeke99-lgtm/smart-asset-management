const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING(255),
    defaultValue: '',
  },
  role: {
    type: DataTypes.ENUM('admin', 'ict_officer', 'department_head', 'finance', 'store_manager', 'maintenance', 'student'),
    defaultValue: 'student',
  },
  department: {
    type: DataTypes.STRING(255),
    defaultValue: '',
  },
  phone: {
    type: DataTypes.STRING(50),
    defaultValue: '',
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'failed_login_attempts',
  },
  lockoutUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'lockout_until',
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at',
  },
  resetTokenHash: {
    type: DataTypes.STRING(128),
    allowNull: true,
    field: 'reset_token_hash',
  },
  resetTokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reset_token_expires_at',
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
