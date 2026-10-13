const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('VerificationItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sessionId: { type: DataTypes.INTEGER, allowNull: false, field: 'session_id' },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  state: { type: DataTypes.ENUM('pending', 'verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'), defaultValue: 'pending' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  observedLocation: { type: DataTypes.STRING(255), allowNull: true, field: 'observed_location' },
  verifiedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'verified_by' },
}, {
  tableName: 'verification_items',
  timestamps: true,
  indexes: [{ unique: true, fields: ['session_id', 'asset_id'], name: 'verification_items_session_asset_unique' }],
});
