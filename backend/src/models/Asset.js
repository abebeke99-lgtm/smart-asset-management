const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Asset = sequelize.define('Asset', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(255), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  serialNumber: { type: DataTypes.STRING(255), defaultValue: '' },
  assetCode: { type: DataTypes.STRING(255), defaultValue: '' },
  rfidTag: { type: DataTypes.STRING(255), defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'available' },
  condition: { type: DataTypes.STRING(100), defaultValue: 'Good' },
  department: { type: DataTypes.STRING(255), defaultValue: '' },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  purchaseDate: { type: DataTypes.DATE, allowNull: true },
  purchasePrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  supplier: { type: DataTypes.STRING(255), defaultValue: '' },
  manufacturer: { type: DataTypes.STRING(255), defaultValue: '' },
  model: { type: DataTypes.STRING(255), defaultValue: '' },
  warrantyExpiry: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  currentValue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  healthScore: { type: DataTypes.INTEGER, defaultValue: 100 },
  createdBy: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'assets',
  timestamps: true,
});

module.exports = Asset;
