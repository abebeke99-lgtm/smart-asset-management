const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceTask = sequelize.define('MaintenanceTask', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: true },
  workOrderId: { type: DataTypes.INTEGER, allowNull: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  assignedToId: { type: DataTypes.INTEGER, allowNull: false },
  taskDescription: { type: DataTypes.TEXT, defaultValue: '' },
  priority: { type: DataTypes.STRING(50), defaultValue: 'medium' }, // low, medium, high, critical
  startDate: { type: DataTypes.DATE, allowNull: true },
  dueDate: { type: DataTypes.DATE, allowNull: true },
  completedDate: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(100), defaultValue: 'pending' }, // pending, in-progress, completed, cancelled, overdue
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'maintenance_tasks',
  timestamps: true,
});

module.exports = MaintenanceTask;
