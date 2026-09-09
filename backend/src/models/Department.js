const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  code: { type: DataTypes.STRING(100), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  headId: { type: DataTypes.INTEGER, defaultValue: null },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  locationId: { type: DataTypes.INTEGER, allowNull: true, field: 'location_id' },
  phone: { type: DataTypes.STRING(50), defaultValue: '' },
  email: { type: DataTypes.STRING(255), defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, {
  tableName: 'departments',
  timestamps: true,
});

module.exports = Department;
