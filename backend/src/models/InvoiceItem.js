const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: false },
  quantity: { type: DataTypes.DECIMAL(15, 3), allowNull: false },
  unit: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pcs' },
  unitPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  taxRate: { type: DataTypes.DECIMAL(7, 3), allowNull: false, defaultValue: 0 },
  discount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  lineTotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
}, { tableName: 'invoice_items', timestamps: true });

module.exports = InvoiceItem;
