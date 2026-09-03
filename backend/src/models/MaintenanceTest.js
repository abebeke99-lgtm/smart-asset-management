const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceTest = sequelize.define('MaintenanceTest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: false },
  workOrderId: { type: DataTypes.INTEGER, allowNull: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  testerId: { type: DataTypes.INTEGER, allowNull: false },
  testDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  functionalResult: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Passed, Failed, N/A
  safetyResult: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Passed, Failed, N/A
  qualityResult: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Passed, Failed, N/A
  overallResult: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Passed, Failed, Retest Required
  problemsFound: { type: DataTypes.TEXT, defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' }, // pending, in-progress, passed, failed, retest-required, completed
}, {
  tableName: 'maintenance_tests',
  timestamps: true,
});

module.exports = MaintenanceTest;
