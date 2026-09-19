const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AssetGrant = sequelize.define('AssetGrant', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  grantNumber: { type: DataTypes.STRING(150), allowNull: false, field: 'grant_number' },
  grantName: { type: DataTypes.STRING(500), allowNull: false, field: 'grant_name' },
  fundingOrganization: { type: DataTypes.STRING(500), allowNull: false, field: 'funding_organization' },
  principalInvestigator: { type: DataTypes.STRING(255), allowNull: true, field: 'principal_investigator' },
  fundingAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: true, field: 'funding_amount' },
  acquisitionDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'acquisition_date' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'asset_grants',
  timestamps: true,
  indexes: [{ fields: ['asset_id'] }, { fields: ['grant_number'] }],
});

module.exports = AssetGrant;