const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Location = sequelize.define('Location', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  code: { type: DataTypes.STRING(80), allowNull: true, unique: true, defaultValue: null },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'locations',
  timestamps: true,
});

module.exports = Location;