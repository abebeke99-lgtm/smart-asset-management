const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SupportTicketComment = sequelize.define('SupportTicketComment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticketId: { type: DataTypes.INTEGER, allowNull: false, field: 'ticket_id' },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  comment: { type: DataTypes.TEXT, allowNull: false },
  commentType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PUBLIC_COMMENT', field: 'comment_type' },
}, {
  tableName: 'support_ticket_comments',
  timestamps: true,
  indexes: [{ fields: ['ticket_id'] }, { fields: ['comment_type'] }],
});

module.exports = SupportTicketComment;