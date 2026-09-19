const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Campus = sequelize.define('Campus', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campusCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'campus_code' },
  campusName: { type: DataTypes.STRING(255), allowNull: false, field: 'campus_name' },
  address: { type: DataTypes.STRING(500), defaultValue: '' },
  city: { type: DataTypes.STRING(150), defaultValue: '' },
  phone: { type: DataTypes.STRING(50), defaultValue: '' },
  email: { type: DataTypes.STRING(255), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, {
  tableName: 'campuses',
  timestamps: true,
  indexes: [{ fields: ['status'] }],
});

module.exports = Campus;