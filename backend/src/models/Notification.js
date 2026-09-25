const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  recipientId: { type: DataTypes.INTEGER, allowNull: true, field: 'recipient_id' },
  senderId: { type: DataTypes.INTEGER, allowNull: true, field: 'sender_id' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  assetId: { type: DataTypes.INTEGER, allowNull: true, field: 'asset_id' },
  eventKey: { type: DataTypes.STRING(160), allowNull: true, field: 'event_key' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.TEXT, defaultValue: '' },
  type: { type: DataTypes.STRING(100), defaultValue: 'system' },
  category: { type: DataTypes.STRING(100), allowNull: true },
  scope: { type: DataTypes.STRING(30), allowNull: true, defaultValue: 'USER' },
  role: { type: DataTypes.STRING(120), allowNull: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: true, field: 'organization_id' },
  entityType: { type: DataTypes.STRING(120), allowNull: true, field: 'entity_type' },
  entityId: { type: DataTypes.INTEGER, allowNull: true, field: 'entity_id' },
  actionUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'action_url' },
  metadata: { type: DataTypes.JSON, allowNull: true },
  priority: { type: DataTypes.STRING(30), defaultValue: 'medium' },
  channel: { type: DataTypes.STRING(100), defaultValue: 'in_app' },
  status: { type: DataTypes.STRING(30), defaultValue: 'sent' },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
  scheduledAt: { type: DataTypes.DATE, allowNull: true, field: 'scheduled_at' },
  sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
  expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' },
  archivedAt: { type: DataTypes.DATE, allowNull: true, field: 'archived_at' },
  archivedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'archived_by' },
}, {
  tableName: 'notifications',
  timestamps: true,
});

module.exports = Notification;
