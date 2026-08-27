const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transfer = sequelize.define('Transfer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  sourceDepartment: { type: DataTypes.STRING(255), allowNull: false },
  destinationDepartment: { type: DataTypes.STRING(255), allowNull: false },
  currentLocation: { type: DataTypes.STRING(255), defaultValue: '' },
  newLocation: { type: DataTypes.STRING(255), allowNull: false },
  transferReason: { type: DataTypes.TEXT, allowNull: false },
  transferDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Pending, Approved, Rejected, In Progress, Completed, Cancelled
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, defaultValue: null },
  approvedBy: { type: DataTypes.INTEGER, defaultValue: null },
  approvalDate: { type: DataTypes.DATE, defaultValue: null },
}, {
  tableName: 'transfers',
  timestamps: true,
});

module.exports = Transfer;
