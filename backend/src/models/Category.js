const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'categories',
  timestamps: true,
});

module.exports = Category;
