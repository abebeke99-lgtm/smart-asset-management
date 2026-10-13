const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VerificationCode = sequelize.define('VerificationCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  channel: {
    type: DataTypes.ENUM('email', 'phone'),
    allowNull: false,
  },
  codeHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'code_hash',
  },
  purpose: {
    type: DataTypes.ENUM('first_login', 'forgot_password'),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'verification_codes',
  timestamps: false,
  indexes: [
    { name: 'verification_codes_user_purpose_created_idx', fields: ['user_id', 'purpose', 'created_at'] },
    { name: 'verification_codes_expiry_idx', fields: ['expires_at'] },
  ],
});

module.exports = VerificationCode;
