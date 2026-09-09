const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const College = sequelize.define('College', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  collegeCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'college_code' },
  collegeName: { type: DataTypes.STRING(255), allowNull: false, field: 'college_name' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  managerId: { type: DataTypes.INTEGER, allowNull: true, field: 'manager_id' },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  address: { type: DataTypes.STRING(500), defaultValue: '' },
  phone: { type: DataTypes.STRING(50), defaultValue: '' },
  email: { type: DataTypes.STRING(255), defaultValue: '' },
  establishedDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'established_date' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, {
  tableName: 'colleges',
  timestamps: true,
  indexes: [{ fields: ['status'] }],
});

module.exports = College;
