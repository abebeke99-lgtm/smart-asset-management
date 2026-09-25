const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('IncidentHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incidentId: { type: DataTypes.INTEGER, allowNull: false, field: 'incident_id' },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  action: { type: DataTypes.STRING(80), allowNull: false },
  oldValue: { type: DataTypes.TEXT, allowNull: true, field: 'old_value' },
  newValue: { type: DataTypes.TEXT, allowNull: true, field: 'new_value' },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, { tableName: 'incident_history', timestamps: true, updatedAt: false, indexes: [{ fields: ['incident_id'] }, { fields: ['created_at'] }] });
