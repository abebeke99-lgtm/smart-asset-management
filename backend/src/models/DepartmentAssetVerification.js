const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('DepartmentAssetVerification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: false, field: 'department_id' },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  assetCode: { type: DataTypes.STRING(255), allowNull: false, field: 'asset_code' },
  assetName: { type: DataTypes.STRING(255), allowNull: false, field: 'asset_name' },
  expectedLocation: { type: DataTypes.STRING(255), allowNull: false, field: 'expected_location' },
  actualLocation: { type: DataTypes.STRING(255), allowNull: false, field: 'actual_location' },
  expectedCondition: { type: DataTypes.STRING(100), allowNull: false, field: 'expected_condition' },
  actualCondition: { type: DataTypes.STRING(100), allowNull: false, field: 'actual_condition' },
  verificationDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'verification_date' },
  verifiedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'verified_by' },
  scannedQrCode: { type: DataTypes.STRING(100), allowNull: true, field: 'scanned_qr_code' },
  exceptions: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
}, {
  tableName: 'department_asset_verifications',
  timestamps: true,
  indexes: [
    { fields: ['department_id', 'verification_date'] },
    { fields: ['asset_id', 'verification_date'] },
  ],
});
