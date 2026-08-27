const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinancialRecord = sequelize.define('FinancialRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  recordedBy: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('valuation', 'revaluation', 'cost_addition', 'depreciation'), allowNull: false },
  purchaseCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  additionalCosts: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  residualValue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  usefulLife: { type: DataTypes.INTEGER, defaultValue: 5 },
  currentValue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  depreciationMethod: { type: DataTypes.STRING(50), defaultValue: 'straight-line' },
  depreciationAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'financial_records', timestamps: true });

module.exports = FinancialRecord;
