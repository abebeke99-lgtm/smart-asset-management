const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Approval = sequelize.define('Approval', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: true },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING(100), allowNull: false },
  item: { type: DataTypes.STRING(255), defaultValue: '' },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  priority: { type: DataTypes.STRING(50), defaultValue: 'medium' },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'), defaultValue: 'pending' },
  reason: { type: DataTypes.TEXT, defaultValue: '' },
  comment: { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'approvals', timestamps: true });

module.exports = Approval;
