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
  testType: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Functional' },
  procedure: { type: DataTypes.TEXT, defaultValue: '' },
  expectedResult: { type: DataTypes.TEXT, defaultValue: '' },
  actualResult: { type: DataTypes.TEXT, defaultValue: '' },
  failureReason: { type: DataTypes.TEXT, defaultValue: '' },
  failedCheck: { type: DataTypes.STRING(255), defaultValue: '' },
  recommendedAction: { type: DataTypes.TEXT, defaultValue: '' },
  checklist: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  measurements: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  parentTestId: { type: DataTypes.INTEGER, allowNull: true },
  qualityStatus: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'not-reviewed' },
  reviewerId: { type: DataTypes.INTEGER, allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  rejectionReason: { type: DataTypes.TEXT, defaultValue: '' },
  correctiveAction: { type: DataTypes.TEXT, defaultValue: '' },
  problemsFound: { type: DataTypes.TEXT, defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' }, // pending, in-progress, passed, failed, retest-required, completed
}, {
  tableName: 'maintenance_tests',
  timestamps: true,
});

module.exports = MaintenanceTest;
