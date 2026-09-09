const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotificationDelivery = sequelize.define('NotificationDelivery', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  notificationId: { type: DataTypes.INTEGER, allowNull: false, field: 'notification_id' },
  recipientId: { type: DataTypes.INTEGER, allowNull: false, field: 'recipient_id' },
  channel: { type: DataTypes.STRING(30), allowNull: false },
  provider: { type: DataTypes.STRING(80), allowNull: true },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
  providerMessageId: { type: DataTypes.STRING(255), allowNull: true, field: 'provider_message_id' },
  errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },
  sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
  deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },
  failedAt: { type: DataTypes.DATE, allowNull: true, field: 'failed_at' },
}, { tableName: 'notification_deliveries', timestamps: true });

module.exports = NotificationDelivery;
