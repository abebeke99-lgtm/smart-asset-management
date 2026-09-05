const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  availableQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  reservedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  damagedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  minimumQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'available' },
}, { tableName: 'inventory', timestamps: true });

module.exports = Inventory;
