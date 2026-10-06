const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DepartmentAssetRequestHistory = sequelize.define('DepartmentAssetRequestHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  previousStatus: { type: DataTypes.STRING(30), allowNull: true, field: 'previous_status' },
  newStatus: { type: DataTypes.STRING(30), allowNull: false, field: 'new_status' },
  changedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'changed_by' },
  comment: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
}, {
  tableName: 'department_asset_request_histories',
  timestamps: true,
  indexes: [{ fields: ['request_id'] }],
});

module.exports = DepartmentAssetRequestHistory;
