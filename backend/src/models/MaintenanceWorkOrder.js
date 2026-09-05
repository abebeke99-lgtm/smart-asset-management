const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceWorkOrder = sequelize.define('MaintenanceWorkOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: false },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  workOrderNumber: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  technicianId: { type: DataTypes.INTEGER, allowNull: true },
  priority: { type: DataTypes.STRING(50), defaultValue: 'medium' }, // low, medium, high, critical
  problemDescription: { type: DataTypes.TEXT, defaultValue: '' },
  diagnosis: { type: DataTypes.TEXT, defaultValue: '' },
  requiredWork: { type: DataTypes.TEXT, defaultValue: '' },
  startDate: { type: DataTypes.DATE, allowNull: true },
  expectedCompletionDate: { type: DataTypes.DATE, allowNull: true },
  actualCompletionDate: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' }, // pending, assigned, in-progress, on-hold, completed, cancelled
  estimatedCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  actualCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'maintenance_work_orders',
  timestamps: true,
});

module.exports = MaintenanceWorkOrder;
