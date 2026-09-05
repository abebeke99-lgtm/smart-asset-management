const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SparePartTransaction = sequelize.define('SparePartTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sparePartId: { type: DataTypes.INTEGER, allowNull: false },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: true },
  repairId: { type: DataTypes.INTEGER, allowNull: true },
  transactionType: { type: DataTypes.STRING(50), allowNull: false }, // issue, receive, return, adjustment
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  previousQuantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  newQuantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  transactionDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'spare_part_transactions',
  timestamps: true,
});

module.exports = SparePartTransaction;
