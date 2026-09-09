const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('AssetReturn', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  returnNumber: { type: DataTypes.STRING(40), allowNull: true, unique: true, field: 'return_number' },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  sourceUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_user_id' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'requested_by' },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'approved_by' },
  receivedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'received_by' },
  inspectedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'inspected_by' },
  reason: { type: DataTypes.STRING(100), allowNull: false },
  condition: { type: DataTypes.STRING(50), defaultValue: 'Good' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  inspectionNotes: { type: DataTypes.TEXT, defaultValue: '', field: 'inspection_notes' },
  status: { type: DataTypes.STRING(50), defaultValue: 'Requested' },
  outcome: { type: DataTypes.STRING(50), allowNull: true },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'requested_at' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  receivedAt: { type: DataTypes.DATE, allowNull: true, field: 'received_at' },
  inspectedAt: { type: DataTypes.DATE, allowNull: true, field: 'inspected_at' },
}, { tableName: 'asset_returns', timestamps: true });
