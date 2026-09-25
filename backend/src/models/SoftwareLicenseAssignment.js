const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SoftwareLicenseAssignment = sequelize.define('SoftwareLicenseAssignment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  softwareLicenseId: { type: DataTypes.INTEGER, allowNull: false, field: 'software_license_id' },
  userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
  employeeId: { type: DataTypes.INTEGER, allowNull: true, field: 'employee_id' },
  assetId: { type: DataTypes.INTEGER, allowNull: true, field: 'asset_id' },
  assignmentType: { type: DataTypes.STRING(30), allowNull: false, field: 'assignment_type' },
  assignedDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'assigned_date' },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'expiry_date' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
}, {
  tableName: 'software_license_assignments',
  timestamps: true,
  indexes: [
    { fields: ['software_license_id', 'status'] },
    { fields: ['user_id'] },
    { fields: ['asset_id'] },
  ],
});

module.exports = SoftwareLicenseAssignment;
