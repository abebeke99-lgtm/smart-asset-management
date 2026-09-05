const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceRepair = sequelize.define('MaintenanceRepair', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: false },
  workOrderId: { type: DataTypes.INTEGER, allowNull: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  technicianId: { type: DataTypes.INTEGER, allowNull: true },
  problemDescription: { type: DataTypes.TEXT, defaultValue: '' },
  diagnosis: { type: DataTypes.TEXT, defaultValue: '' },
  repairAction: { type: DataTypes.TEXT, defaultValue: '' },
  partsUsed: { type: DataTypes.TEXT, defaultValue: '' }, // JSON or comma-separated
  laborCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  partsCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  serviceCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  totalCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  repairResult: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Success, Partial, Failed
  completionDate: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' },
}, {
  tableName: 'maintenance_repairs',
  timestamps: true,
});

module.exports = MaintenanceRepair;
