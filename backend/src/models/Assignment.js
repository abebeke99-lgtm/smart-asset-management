const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Assignment = sequelize.define('Assignment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: false },
  assignedBy: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(100), defaultValue: 'active' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'assignments',
  timestamps: true,
});

module.exports = Assignment;
