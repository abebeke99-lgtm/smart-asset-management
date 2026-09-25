const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('IncidentAttachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incidentId: { type: DataTypes.INTEGER, allowNull: false, field: 'incident_id' },
  uploadedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'uploaded_by' },
  fileName: { type: DataTypes.STRING(255), allowNull: false, field: 'file_name' },
  filePath: { type: DataTypes.STRING(500), allowNull: false, field: 'file_path' },
  mimeType: { type: DataTypes.STRING(120), allowNull: false, field: 'mime_type' },
  fileSize: { type: DataTypes.INTEGER, allowNull: false, field: 'file_size' },
}, { tableName: 'incident_attachments', timestamps: true, indexes: [{ fields: ['incident_id'] }] });
