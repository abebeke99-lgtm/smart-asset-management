const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AssetRegistrationRequest = sequelize.define('AssetRegistrationRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: false, field: 'department_id' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'requested_by' },
  approvalId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'approval_id' },
  name: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
  category: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
  serialNumber: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'serial_number',
    unique: true,
    set(value) { this.setDataValue('serialNumber', value ? String(value).trim() || null : null); },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { isInt: true, min: 1 },
  },
  condition: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
  location: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
  purchaseDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'purchase_date' },
  warrantyExpiry: { type: DataTypes.DATEONLY, allowNull: true, field: 'warranty_expiry' },
  justification: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Pending' },
}, {
  tableName: 'asset_requests',
  timestamps: true,
  validate: {
    purchaseDateNotInFuture() {
      if (this.purchaseDate && this.purchaseDate > new Date().toISOString().slice(0, 10)) {
        throw new Error('Purchase date cannot be in the future');
      }
    },
  },
  indexes: [
    { fields: ['department_id', 'status'] },
    { fields: ['requested_by'] },
  ],
});

module.exports = AssetRegistrationRequest;
