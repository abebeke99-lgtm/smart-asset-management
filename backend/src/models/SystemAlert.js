const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SystemAlert = sequelize.define('SystemAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.STRING(80), allowNull: false },
  severity: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'info' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  source: { type: DataTypes.STRING(100), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'open' },
  resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
  resolvedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'resolved_by' },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, { tableName: 'system_alerts', timestamps: true });

module.exports = SystemAlert;
