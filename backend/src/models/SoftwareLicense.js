const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SoftwareLicense = sequelize.define('SoftwareLicense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  licenseNumber: { type: DataTypes.STRING(120), allowNull: true, field: 'license_number' },
  softwareName: { type: DataTypes.STRING(255), allowNull: false, field: 'software_name' },
  vendor: { type: DataTypes.STRING(255), allowNull: false },
  version: { type: DataTypes.STRING(120), allowNull: true, defaultValue: '' },
  licenseKey: { type: DataTypes.TEXT, allowNull: true, field: 'license_key' },
  licenseType: { type: DataTypes.STRING(40), allowNull: false, field: 'license_type' },
  description: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
  purchaseDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'purchase_date' },
  startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'expiry_date' },
  renewalDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'renewal_date' },
  renewalType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'manual', field: 'renewal_type' },
  autoRenewal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'auto_renewal' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  usedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'used_quantity' },
  purchaseCost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'purchase_cost' },
  renewalCost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'renewal_cost' },
  currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ETB' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  locationId: { type: DataTypes.INTEGER, allowNull: true, field: 'location_id' },
  supplierId: { type: DataTypes.INTEGER, allowNull: true, field: 'supplier_id' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  contractNumber: { type: DataTypes.STRING(120), allowNull: true, field: 'contract_number' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Active' },
  notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  archivedAt: { type: DataTypes.DATE, allowNull: true, field: 'archived_at' },
}, {
  tableName: 'software_licenses',
  timestamps: true,
  indexes: [
    { fields: ['software_name'] },
    { fields: ['vendor'] },
    { fields: ['status'] },
    { fields: ['expiry_date'] },
    { unique: true, fields: ['license_number'] },
  ],
});

module.exports = SoftwareLicense;
