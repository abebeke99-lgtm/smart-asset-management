const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AssetCustody = sequelize.define('AssetCustody', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  custodianId: { type: DataTypes.INTEGER, allowNull: false, field: 'custodian_id' },
  handedOverBy: { type: DataTypes.INTEGER, allowNull: true, field: 'handed_over_by' },
  receivedDate: { type: DataTypes.DATE, allowNull: false, field: 'received_date' },
  returnedDate: { type: DataTypes.DATE, allowNull: true, field: 'returned_date' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'active' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'asset_custody',
  timestamps: true,
  indexes: [{ fields: ['asset_id'] }, { fields: ['custodian_id'] }, { fields: ['status'] }],
});

module.exports = AssetCustody;