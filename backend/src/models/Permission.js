const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('Permission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING(191), allowNull: false, unique: true },
  module: { type: DataTypes.STRING(100), allowNull: false },
  action: { type: DataTypes.STRING(50), allowNull: false },
}, {
  tableName: 'permissions',
  timestamps: true,
  indexes: [{ unique: true, fields: ['module', 'action'] }],
});
