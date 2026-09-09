const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  code: { type: DataTypes.STRING(80), allowNull: true, unique: true, defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  icon: { type: DataTypes.STRING(80), allowNull: true, defaultValue: 'layers' },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'categories',
  timestamps: true,
});

module.exports = Category;
