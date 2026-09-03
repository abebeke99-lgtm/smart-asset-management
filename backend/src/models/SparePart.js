const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SparePart = sequelize.define('SparePart', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  partName: { type: DataTypes.STRING(255), allowNull: false },
  partCode: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  category: { type: DataTypes.STRING(255), defaultValue: '' },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  minimumStock: { type: DataTypes.INTEGER, defaultValue: 10 },
  unitCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  supplier: { type: DataTypes.STRING(255), defaultValue: '' },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'available' }, // available, low-stock, out-of-stock
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'spare_parts',
  timestamps: true,
});

module.exports = SparePart;
