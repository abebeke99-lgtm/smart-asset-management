const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceQualityControl = sequelize.define('MaintenanceQualityControl', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: false },
  workOrderId: { type: DataTypes.INTEGER, allowNull: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  testId: { type: DataTypes.INTEGER, allowNull: true },
  technicianId: { type: DataTypes.INTEGER, allowNull: true },
  testerId: { type: DataTypes.INTEGER, allowNull: true },
  reviewerId: { type: DataTypes.INTEGER, allowNull: true },
  reviewDate: { type: DataTypes.DATE, allowNull: true },
  dueDate: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(80), defaultValue: 'pending' },
  decision: { type: DataTypes.STRING(80), defaultValue: 'pending' },
  findings: { type: DataTypes.TEXT, defaultValue: '' },
  rejectionReason: { type: DataTypes.TEXT, defaultValue: '' },
  failedRequirement: { type: DataTypes.TEXT, defaultValue: '' },
  correctiveAction: { type: DataTypes.TEXT, defaultValue: '' },
  conditions: { type: DataTypes.TEXT, defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  requiredChecklistCompleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  documentationComplete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  readyForReturn: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'maintenance_quality_controls',
  timestamps: true,
});

module.exports = MaintenanceQualityControl;
