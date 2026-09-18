const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Supplier = sequelize.define('Supplier', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  supplierCode: { type: DataTypes.STRING(80), allowNull: false, unique: true, field: 'supplier_code' },
  supplierName: { type: DataTypes.STRING(255), allowNull: false, field: 'supplier_name' },
  contactPerson: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '', field: 'contact_person' },
  phone: { type: DataTypes.STRING(80), allowNull: true, defaultValue: '' },
  email: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '' },
  address: { type: DataTypes.STRING(500), allowNull: true, defaultValue: '' },
  taxIdentificationNumber: { type: DataTypes.STRING(120), allowNull: true, defaultValue: '', field: 'tax_identification_number' },
  paymentTerms: { type: DataTypes.TEXT, allowNull: true, defaultValue: '', field: 'payment_terms' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
}, { tableName: 'suppliers', timestamps: true, indexes: [{ unique: true, fields: ['supplier_code'] }] });

module.exports = Supplier;