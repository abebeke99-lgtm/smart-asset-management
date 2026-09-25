const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('IncidentComment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incidentId: { type: DataTypes.INTEGER, allowNull: false, field: 'incident_id' },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  comment: { type: DataTypes.TEXT, allowNull: false },
  commentType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'public_comment', field: 'comment_type' },
}, { tableName: 'incident_comments', timestamps: true, indexes: [{ fields: ['incident_id'] }, { fields: ['user_id'] }] });
