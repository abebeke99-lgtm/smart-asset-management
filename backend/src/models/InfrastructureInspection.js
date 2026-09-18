const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InfrastructureInspection = sequelize.define('InfrastructureInspection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  inspectionNumber: { type: DataTypes.STRING(100), unique: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  assetId: { type: DataTypes.STRING(50) },
  assetName: { type: DataTypes.STRING(255) },
  assetTag: { type: DataTypes.STRING(255) },
  category: { type: DataTypes.STRING(255) },
  location: { type: DataTypes.STRING(255), allowNull: false },
  inspectionType: { type: DataTypes.STRING(100), defaultValue: 'Routine' },
  inspectionDate: { type: DataTypes.DATE, allowNull: false },
  nextInspectionDate: { type: DataTypes.DATE },
  inspector: { type: DataTypes.STRING(255) },
  condition: { type: DataTypes.STRING(100), defaultValue: 'Good' },
  status: { type: DataTypes.STRING(100), defaultValue: 'Completed' },
  priority: { type: DataTypes.STRING(50), defaultValue: 'Medium' },
  safetyStatus: { type: DataTypes.STRING(100), defaultValue: 'Safe' },
  operationalStatus: { type: DataTypes.STRING(100), defaultValue: 'Operational' },
  defects: { type: DataTypes.TEXT },
  findings: { type: DataTypes.TEXT },
  recommendations: { type: DataTypes.TEXT },
  correctiveAction: { type: DataTypes.TEXT },
  estimatedCost: { type: DataTypes.DECIMAL(12, 2) },
  actualCost: { type: DataTypes.DECIMAL(12, 2) },
  photos: { type: DataTypes.TEXT },
  remarks: { type: DataTypes.TEXT }
}, {
  tableName: 'infrastructure_inspections',
  timestamps: true,
  underscored: true
});

module.exports = InfrastructureInspection;