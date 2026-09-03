const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceHistory = sequelize.define('MaintenanceHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: true },
  actionType: { type: DataTypes.STRING(100), defaultValue: 'update' }, // created, updated, assigned, approved, rejected, started, completed, inspected, tested, etc.
  actionDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  actionTime: { type: DataTypes.STRING(20), defaultValue: '' },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  previousStatus: { type: DataTypes.STRING(100), defaultValue: '' },
  newStatus: { type: DataTypes.STRING(100), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  details: { type: DataTypes.JSON, defaultValue: {} },
}, {
  tableName: 'maintenance_history',
  timestamps: true,
});

module.exports = MaintenanceHistory;
