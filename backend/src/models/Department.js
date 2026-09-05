const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  code: { type: DataTypes.STRING(100), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  headId: { type: DataTypes.INTEGER, defaultValue: null },
}, {
  tableName: 'departments',
  timestamps: true,
});

module.exports = Department;
