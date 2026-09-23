const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  paymentNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ETB' },
  paymentMethod: { type: DataTypes.ENUM('BANK_TRANSFER', 'CHEQUE', 'OTHER_APPROVED_METHOD'), allowNull: false },
  referenceNumber: { type: DataTypes.STRING(100), allowNull: false },
  bankName: { type: DataTypes.STRING(255), allowNull: true },
  bankAccount: { type: DataTypes.STRING(255), allowNull: true },
  status: { type: DataTypes.ENUM('PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'), allowNull: false, defaultValue: 'PENDING_APPROVAL' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  processedBy: { type: DataTypes.INTEGER, allowNull: true },
  processedAt: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
}, { tableName: 'payments', timestamps: true });

module.exports = Payment;
