const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DepartmentAssetRequest = sequelize.define('DepartmentAssetRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestCode: { type: DataTypes.STRING(40), allowNull: false, unique: true, field: 'request_code' },
  departmentId: { type: DataTypes.INTEGER, allowNull: false, field: 'department_id' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'requested_by' },
  assetId: { type: DataTypes.INTEGER, allowNull: true, field: 'asset_id' },
  requestedItem: { type: DataTypes.STRING(255), allowNull: false, field: 'requested_item' },
  category: { type: DataTypes.STRING(120), allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'unit' },
  priority: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'medium' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Submitted' },
  justification: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  estimatedValue: { type: DataTypes.DECIMAL(15, 2), allowNull: true, field: 'estimated_value' },
  neededBy: { type: DataTypes.DATEONLY, allowNull: true, field: 'needed_by' },
}, {
  tableName: 'department_asset_requests',
  timestamps: true,
  indexes: [
    { fields: ['department_id', 'status'] },
    { fields: ['requested_by'] },
    { fields: ['asset_id'] },
  ],
});

module.exports = DepartmentAssetRequest;
