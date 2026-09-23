const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DisposalFinancialRecord = sequelize.define('DisposalFinancialRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  disposalRequestId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'disposal_request_id' },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  recordedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'recorded_by' },
  disposalDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'disposal_date' },
  disposalMethod: { type: DataTypes.STRING(50), allowNull: false, field: 'disposal_method' },
  originalCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'original_cost' },
  accumulatedDepreciation: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'accumulated_depreciation' },
  netBookValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'net_book_value' },
  disposalProceeds: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'disposal_proceeds' },
  disposalCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'disposal_cost' },
  gainLoss: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'gain_loss' },
  referenceNumber: { type: DataTypes.STRING(100), allowNull: true, field: 'reference_number' },
  buyer: { type: DataTypes.STRING(255), allowNull: true },
  approvalNumber: { type: DataTypes.STRING(100), allowNull: true, field: 'approval_number' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
  accountingStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'not_integrated', field: 'accounting_status' },
  accountingReference: { type: DataTypes.STRING(100), allowNull: true, field: 'accounting_reference' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'disposal_financial_records', timestamps: true });

module.exports = DisposalFinancialRecord;