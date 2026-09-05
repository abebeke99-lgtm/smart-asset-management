const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceCost = sequelize.define('MaintenanceCost', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: true },
  repairId: { type: DataTypes.INTEGER, allowNull: true },
  workOrderId: { type: DataTypes.INTEGER, allowNull: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  costCategory: { type: DataTypes.STRING(100), defaultValue: 'other' }, // labor, parts, service, repair, other
  description: { type: DataTypes.TEXT, defaultValue: '' },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  quantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  unitCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  costDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' }, // pending, approved, paid
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'maintenance_costs',
  timestamps: true,
});

module.exports = MaintenanceCost;
