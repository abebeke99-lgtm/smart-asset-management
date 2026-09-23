const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoiceNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  supplierName: { type: DataTypes.STRING(255), allowNull: false },
  purchaseOrderId: { type: DataTypes.INTEGER, allowNull: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  invoiceDate: { type: DataTypes.DATEONLY, allowNull: false },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
  currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ETB' },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  discountAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  paidAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('Draft', 'Pending', 'Approved', 'Due', 'Paid', 'Cancelled'), allowNull: false, defaultValue: 'Pending' },
  verificationStatus: { type: DataTypes.ENUM('Pending', 'Verified', 'Rejected'), allowNull: false, defaultValue: 'Pending' },
  approvalStatus: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), allowNull: false, defaultValue: 'Pending' },
  verifiedBy: { type: DataTypes.INTEGER, allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  paymentTerms: { type: DataTypes.TEXT, defaultValue: '' },
  taxNumber: { type: DataTypes.STRING(100), defaultValue: '' },
  referenceNumber: { type: DataTypes.STRING(100), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'invoices', timestamps: true });

module.exports = Invoice;
