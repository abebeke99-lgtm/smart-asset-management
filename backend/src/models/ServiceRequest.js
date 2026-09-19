const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ServiceRequest = sequelize.define('ServiceRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'request_code' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  justification: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  requestType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'maintenance' },
  category: { type: DataTypes.STRING(100), defaultValue: '' },
  assetId: { type: DataTypes.INTEGER, allowNull: true, field: 'asset_id' },
  priority: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'medium' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'submitted' },
  routedTo: { type: DataTypes.STRING(50), allowNull: true, field: 'routed_to' },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true, field: 'assigned_to' },
  reportedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'reported_by' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  acknowledgedAt: { type: DataTypes.DATE, allowNull: true, field: 'acknowledged_at' },
  escalated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  escalatedAt: { type: DataTypes.DATE, allowNull: true, field: 'escalated_at' },
  escalatedTo: { type: DataTypes.INTEGER, allowNull: true, field: 'escalated_to' },
  escalationReason: { type: DataTypes.STRING(500), allowNull: true, field: 'escalation_reason' },
  scheduledDate: { type: DataTypes.DATE, allowNull: true, field: 'scheduled_date' },
  startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
  completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  cancelledReason: { type: DataTypes.STRING(500), allowNull: true, field: 'cancelled_reason' },
  resolution: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'service_requests',
  timestamps: true,
  indexes: [{ fields: ['status'] }, { fields: ['request_type'] }, { fields: ['routed_to'] }, { fields: ['reported_by'] }, { fields: ['asset_id'] }],
});

module.exports = ServiceRequest;