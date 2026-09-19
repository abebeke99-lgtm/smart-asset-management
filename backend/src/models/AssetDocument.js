const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AssetDocument = sequelize.define('AssetDocument', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  documentType: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'warranty', field: 'document_type' },
  originalName: { type: DataTypes.STRING(500), allowNull: false, field: 'original_name' },
  storedName: { type: DataTypes.STRING(500), allowNull: false, field: 'stored_name' },
  mimeType: { type: DataTypes.STRING(120), allowNull: true, field: 'mime_type' },
  fileSize: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'file_size' },
  filePath: { type: DataTypes.STRING(1000), allowNull: false, field: 'file_path' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  uploadedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'uploaded_by' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'asset_documents',
  timestamps: true,
  indexes: [{ fields: ['asset_id'] }],
});

module.exports = AssetDocument;