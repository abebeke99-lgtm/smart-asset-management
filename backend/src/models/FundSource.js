const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('FundSource', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
}, { tableName: 'fund_sources', timestamps: true });
