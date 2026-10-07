const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('AssetHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: false, field: 'department_id' },
  changedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'changed_by' },
  action: { type: DataTypes.STRING(100), allowNull: false },
  oldValue: { type: DataTypes.JSON, allowNull: true, field: 'old_value' },
  newValue: { type: DataTypes.JSON, allowNull: true, field: 'new_value' },
  details: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'asset_history',
  timestamps: true,
  indexes: [
    { fields: ['asset_id', 'created_at'] },
    { fields: ['department_id', 'created_at'] },
  ],
});
