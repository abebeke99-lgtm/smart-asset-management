const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RequestAttachment = sequelize.define('RequestAttachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  originalName: { type: DataTypes.STRING(500), allowNull: false, field: 'original_name' },
  storedName: { type: DataTypes.STRING(500), allowNull: false, field: 'stored_name' },
  mimeType: { type: DataTypes.STRING(120), allowNull: true, field: 'mime_type' },
  fileSize: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'file_size' },
  filePath: { type: DataTypes.STRING(1000), allowNull: false, field: 'file_path' },
  attachmentType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'photo', field: 'attachment_type' },
  uploadedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'uploaded_by' },
}, {
  tableName: 'request_attachments',
  timestamps: true,
  indexes: [{ fields: ['request_id'] }],
});

module.exports = RequestAttachment;