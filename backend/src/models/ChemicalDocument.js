const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChemicalDocument = sequelize.define('ChemicalDocument', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chemicalId: { type: DataTypes.INTEGER, allowNull: true, field: 'chemical_id' },
  documentType: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'SDS', field: 'document_type' },
  originalName: { type: DataTypes.STRING(500), allowNull: false, field: 'original_name' },
  storedName: { type: DataTypes.STRING(500), allowNull: false, field: 'stored_name' },
  mimeType: { type: DataTypes.STRING(120), allowNull: true, field: 'mime_type' },
  fileSize: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'file_size' },
  filePath: { type: DataTypes.STRING(1000), allowNull: false, field: 'file_path' },
  uploadedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'uploaded_by' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'chemical_documents',
  timestamps: true,
  indexes: [{ fields: ['chemical_id'] }],
});

module.exports = ChemicalDocument;