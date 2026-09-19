const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Building = sequelize.define('Building', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campusId: { type: DataTypes.INTEGER, allowNull: false, field: 'campus_id' },
  buildingCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'building_code' },
  buildingName: { type: DataTypes.STRING(255), allowNull: false, field: 'building_name' },
  floorCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, {
  tableName: 'buildings',
  timestamps: true,
  indexes: [{ fields: ['campus_id'] }, { fields: ['status'] }],
});

module.exports = Building;