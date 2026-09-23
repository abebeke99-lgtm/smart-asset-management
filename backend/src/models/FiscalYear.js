const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('FiscalYear', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'CLOSED'), allowNull: false, defaultValue: 'DRAFT' },
}, { tableName: 'fiscal_years', timestamps: true });
