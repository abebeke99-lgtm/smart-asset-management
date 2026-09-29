const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PasswordRecovery = sequelize.define('PasswordRecovery', {
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
  method: {
    type: DataTypes.ENUM('email', 'phone'),
    allowNull: false,
  },
  destination: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  otpHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'otp_hash',
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
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'verified_at',
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at',
  },
  resetTokenHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'reset_token_hash',
  },
  resetTokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reset_token_expires_at',
  },
}, {
  tableName: 'password_recoveries',
  timestamps: true,
  indexes: [
    { name: 'password_recoveries_user_id_idx', fields: ['user_id'] },
    { name: 'password_recoveries_destination_idx', fields: ['destination'] },
    { name: 'password_recoveries_expires_at_idx', fields: ['expires_at'] },
    { name: 'password_recoveries_reset_token_hash_idx', fields: ['reset_token_hash'] },
  ],
});

module.exports = PasswordRecovery;