const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceInspection = sequelize.define('MaintenanceInspection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  inspectorId: { type: DataTypes.INTEGER, allowNull: false },
  inspectionDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  nextInspection: { type: DataTypes.DATE, allowNull: true },
  currentCondition: { type: DataTypes.STRING(100), defaultValue: 'Unknown' }, // Good, Fair, Poor, Critical
  healthStatus: { type: DataTypes.STRING(50), defaultValue: 'Unknown' },
  healthScore: { type: DataTypes.INTEGER, allowNull: true },
  hardwareStatus: { type: DataTypes.STRING(100), allowNull: true },
  softwareStatus: { type: DataTypes.STRING(100), allowNull: true },
  batteryHealth: { type: DataTypes.STRING(100), allowNull: true },
  storageHealth: { type: DataTypes.STRING(100), allowNull: true },
  memoryStatus: { type: DataTypes.STRING(100), allowNull: true },
  temperatureStatus: { type: DataTypes.STRING(100), allowNull: true },
  networkStatus: { type: DataTypes.STRING(100), allowNull: true },
  uptime: { type: DataTypes.STRING(100), allowNull: true },
  lastSeen: { type: DataTypes.DATE, allowNull: true },
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
