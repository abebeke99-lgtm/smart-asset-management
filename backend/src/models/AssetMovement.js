const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('AssetMovement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  movementType: { type: DataTypes.STRING(50), allowNull: false, field: 'movement_type' },
  sourceType: { type: DataTypes.STRING(50), allowNull: false, field: 'source_type' },
  sourceId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_id' },
  destinationType: { type: DataTypes.STRING(50), allowNull: false, field: 'destination_type' },
  destinationId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_id' },
  referenceType: { type: DataTypes.STRING(50), allowNull: false, field: 'reference_type' },
  referenceId: { type: DataTypes.INTEGER, allowNull: false, field: 'reference_id' },
  performedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'performed_by' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'asset_movements', timestamps: true });
