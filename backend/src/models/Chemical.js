const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Chemical = sequelize.define('Chemical', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chemicalCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'chemical_code' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  formula: { type: DataTypes.STRING(255), allowNull: true },
  casNumber: { type: DataTypes.STRING(100), allowNull: true, field: 'cas_number' },
  category: { type: DataTypes.STRING(255), defaultValue: '' },
  ghsHazardClass: { type: DataTypes.STRING(255), allowNull: true, field: 'ghs_hazard_class' },
  state: { type: DataTypes.ENUM('solid', 'liquid', 'gas', 'mixed'), allowNull: false, defaultValue: 'liquid' },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'L' },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
  capacity: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  lowStockThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  expirationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'expiration_date' },
  manufacturer: { type: DataTypes.STRING(255), defaultValue: '' },
  supplier: { type: DataTypes.STRING(255), defaultValue: '' },
  storageLocation: { type: DataTypes.STRING(255), defaultValue: '' },
  hazardous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  quarantine: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  quarantineReason: { type: DataTypes.STRING(500), allowNull: true, field: 'quarantine_reason' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'active' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  campusId: { type: DataTypes.INTEGER, allowNull: true, field: 'campus_id' },
  buildingId: { type: DataTypes.INTEGER, allowNull: true, field: 'building_id' },
  roomId: { type: DataTypes.INTEGER, allowNull: true, field: 'room_id' },
  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
}, {
  tableName: 'chemicals',
  timestamps: true,
  indexes: [{ fields: ['ghs_hazard_class'] }, { fields: ['state'] }, { fields: ['expiration_date'] }, { fields: ['quarantine'] }],
});

module.exports = Chemical;