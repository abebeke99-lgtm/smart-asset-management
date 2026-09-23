const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UploadRecord = sequelize.define('UploadRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  originalName: { type: DataTypes.STRING(500), allowNull: false, field: 'original_name' },
  filename: { type: DataTypes.STRING(500), allowNull: false, field: 'filename' },
  mimeType: { type: DataTypes.STRING(120), allowNull: false, field: 'mime_type' },
  fileSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'file_size' },
  category: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'files', field: 'category' },
  filePath: { type: DataTypes.STRING(1000), allowNull: false, field: 'file_path' },
  url: { type: DataTypes.STRING(1000), allowNull: false, field: 'url' },
  uploadedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'uploaded_by' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'active', field: 'status' },
}, {
  tableName: 'upload_records',
  timestamps: true,
  indexes: [{ fields: ['uploaded_by'] }, { fields: ['category'] }],
});

module.exports = UploadRecord;
