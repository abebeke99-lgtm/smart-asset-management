const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('Budget', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fiscalYearId: { type: DataTypes.INTEGER, allowNull: false },
  budgetCode: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  budgetName: { type: DataTypes.STRING(255), allowNull: false },
  fundSourceId: { type: DataTypes.INTEGER, allowNull: false },
  collegeId: { type: DataTypes.INTEGER, allowNull: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  allocation: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  status: { type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'SUSPENDED', 'CANCELLED'), allowNull: false, defaultValue: 'DRAFT' },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'budgets', timestamps: true });
