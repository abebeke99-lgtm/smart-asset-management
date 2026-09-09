const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('VerificationItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sessionId: { type: DataTypes.INTEGER, allowNull: false, field: 'session_id' },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  state: { type: DataTypes.ENUM('verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'), defaultValue: 'needs_review' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'verification_items', timestamps: true });
