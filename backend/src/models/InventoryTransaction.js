const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryTransaction = sequelize.define('InventoryTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  inventoryId: { type: DataTypes.INTEGER, allowNull: false },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.ENUM('receive', 'issue', 'return', 'transfer', 'damage', 'adjustment'), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  fromLocation: { type: DataTypes.STRING(255), defaultValue: '' },
  toLocation: { type: DataTypes.STRING(255), defaultValue: '' },
  reason: { type: DataTypes.STRING(255), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'inventory_transactions', timestamps: true });

module.exports = InventoryTransaction;
