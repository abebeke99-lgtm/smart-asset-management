const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  poNumber: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  purchaseRequestId: { type: DataTypes.INTEGER, allowNull: true },
  supplierName: { type: DataTypes.STRING(255), allowNull: false },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  orderDate: { type: DataTypes.DATEONLY, allowNull: false },
  expectedDeliveryDate: { type: DataTypes.DATEONLY, allowNull: true },
  currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ETB' },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  discountAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('Draft', 'Pending Approval', 'Approved', 'Issued', 'Completed', 'Cancelled'), allowNull: false, defaultValue: 'Draft' },
  priority: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Normal' },
  paymentTerms: { type: DataTypes.TEXT, defaultValue: '' },
  deliveryTerms: { type: DataTypes.TEXT, defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'purchase_orders', timestamps: true });

module.exports = PurchaseOrder;