const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockOrder = sequelize.define('StockOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'order_code' },
  chemicalId: { type: DataTypes.INTEGER, allowNull: true, field: 'chemical_id' },
  itemType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'chemical' },
  itemName: { type: DataTypes.STRING(255), allowNull: false, field: 'item_name' },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'L' },
  reason: { type: DataTypes.STRING(500), allowNull: false, defaultValue: 'stock reached zero' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'requested_by' },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true, field: 'assigned_to' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
}, {
  tableName: 'stock_orders',
  timestamps: true,
  indexes: [{ fields: ['chemical_id'] }, { fields: ['status'] }],
});

module.exports = StockOrder;