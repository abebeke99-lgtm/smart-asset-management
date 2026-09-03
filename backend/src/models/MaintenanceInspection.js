const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceInspection = sequelize.define('MaintenanceInspection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: false },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  inspectorId: { type: DataTypes.INTEGER, allowNull: false },
  inspectionDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  currentCondition: { type: DataTypes.STRING(100), defaultValue: 'Unknown' }, // Good, Fair, Poor, Critical
  physicalDamage: { type: DataTypes.TEXT, defaultValue: '' },
  functionalCondition: { type: DataTypes.STRING(100), defaultValue: 'Unknown' }, // Working, Partial, Non-functional
  safetyCondition: { type: DataTypes.STRING(100), defaultValue: 'Safe' }, // Safe, Unsafe, Hazardous
  missingParts: { type: DataTypes.TEXT, defaultValue: '' },
  observedProblem: { type: DataTypes.TEXT, defaultValue: '' },
  inspectionNotes: { type: DataTypes.TEXT, defaultValue: '' },
  recommendation: { type: DataTypes.TEXT, defaultValue: '' },
  inspectionResult: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Pass, Fail, Needs Repair, Needs Parts, Further Inspection
  status: { type: DataTypes.STRING(100), defaultValue: 'completed' },
}, {
  tableName: 'maintenance_inspections',
  timestamps: true,
});

module.exports = MaintenanceInspection;
