const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PreventiveMaintenance = sequelize.define('PreventiveMaintenance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  maintenanceType: { type: DataTypes.STRING(255), defaultValue: '' },
  scheduleDate: { type: DataTypes.DATE, allowNull: false },
  frequency: { type: DataTypes.STRING(50), defaultValue: 'once' }, // daily, weekly, monthly, quarterly, semi-annual, annual, custom
  technicianId: { type: DataTypes.INTEGER, allowNull: true },
  checklist: { type: DataTypes.TEXT, defaultValue: '' }, // JSON or comma-separated items
  estimatedCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' }, // pending, due, overdue, completed, skipped, cancelled
  lastCompletedDate: { type: DataTypes.DATE, allowNull: true },
  nextScheduleDate: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'preventive_maintenance',
  timestamps: true,
});

module.exports = PreventiveMaintenance;
