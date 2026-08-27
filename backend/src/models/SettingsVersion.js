const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SettingsVersion = sequelize.define('SettingsVersion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  settingsType: { type: DataTypes.STRING(50), allowNull: false },
  versionNumber: { type: DataTypes.INTEGER, allowNull: false },
  settingsJson: { type: DataTypes.TEXT, allowNull: false },
  changedBy: { type: DataTypes.INTEGER, allowNull: false },
  changeReason: { type: DataTypes.STRING(255), defaultValue: '' },
}, {
  tableName: 'settings_versions',
  timestamps: true,
  indexes: [
    { fields: ['settings_type', 'version_number'] },
    { fields: ['changed_by'] },
  ],
});

module.exports = SettingsVersion;