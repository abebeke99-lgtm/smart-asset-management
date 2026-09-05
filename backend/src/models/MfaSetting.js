const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MfaSetting = sequelize.define('MfaSetting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  secretEncrypted: { type: DataTypes.TEXT, allowNull: false },
  backupCodesHash: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'mfa_settings',
  timestamps: true,
  indexes: [{ fields: ['user_id'] }],
});

module.exports = MfaSetting;
