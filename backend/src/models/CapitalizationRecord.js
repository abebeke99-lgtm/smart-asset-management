const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CapitalizationRecord = sequelize.define('CapitalizationRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false, field: 'invoice_id' },
  purchaseOrderId: { type: DataTypes.INTEGER, allowNull: false, field: 'purchase_order_id' },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },
  capitalizedAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, field: 'capitalized_amount' },
  acquisitionDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'acquisition_date' },
  capitalizationDate: { type: DataTypes.DATE, allowNull: false, field: 'capitalization_date' },
  status: { type: DataTypes.ENUM('CAPITALIZED', 'REVERSED'), allowNull: false, defaultValue: 'CAPITALIZED' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'capitalization_records',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['invoice_id'] },
    { unique: true, fields: ['asset_id'] },
  ],
});

module.exports = CapitalizationRecord;
