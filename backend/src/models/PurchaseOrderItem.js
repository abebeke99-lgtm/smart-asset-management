const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  purchaseOrderId: { type: DataTypes.INTEGER, allowNull: false },
  itemName: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  quantity: { type: DataTypes.DECIMAL(15, 3), allowNull: false },
  unit: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pcs' },
  unitPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  taxRate: { type: DataTypes.DECIMAL(7, 3), allowNull: false, defaultValue: 0 },
  discount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  lineTotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
}, { tableName: 'purchase_order_items', timestamps: true });

module.exports = PurchaseOrderItem;