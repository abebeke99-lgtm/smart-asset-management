const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Maintenance = sequelize.define('Maintenance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' },
  priority: { type: DataTypes.STRING(50), defaultValue: 'medium' },
}, {
  tableName: 'maintenances',
  timestamps: true,
});

module.exports = Maintenance;
