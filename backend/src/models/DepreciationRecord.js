const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DepreciationRecord = sequelize.define('DepreciationRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  recordedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'recorded_by' },
  period: { type: DataTypes.STRING(7), allowNull: false },
  method: { type: DataTypes.STRING(50), allowNull: false },
  openingBookValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'opening_book_value' },
  depreciationAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'depreciation_amount' },
  accumulatedDepreciation: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'accumulated_depreciation' },
  closingBookValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'closing_book_value' },
  residualValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'residual_value' },
  usefulLife: { type: DataTypes.INTEGER, allowNull: false, field: 'useful_life' },
  depreciationStartDate: { type: DataTypes.DATE, allowNull: true, field: 'depreciation_start_date' },
  status: { type: DataTypes.ENUM('CALCULATED', 'POSTED'), allowNull: false, defaultValue: 'POSTED' },
}, {
  tableName: 'depreciation_records',
  timestamps: true,
  indexes: [{ unique: true, fields: ['asset_id', 'period'] }],
});

module.exports = DepreciationRecord;
