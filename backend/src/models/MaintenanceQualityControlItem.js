const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceQualityControlItem = sequelize.define('MaintenanceQualityControlItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  qualityControlId: { type: DataTypes.INTEGER, allowNull: false },
  requirement: { type: DataTypes.STRING(255), allowNull: false },
  expectedCondition: { type: DataTypes.TEXT, defaultValue: '' },
  actualCondition: { type: DataTypes.TEXT, defaultValue: '' },
  result: { type: DataTypes.STRING(40), defaultValue: 'pass' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'maintenance_quality_control_items',
  timestamps: true,
});

module.exports = MaintenanceQualityControlItem;
