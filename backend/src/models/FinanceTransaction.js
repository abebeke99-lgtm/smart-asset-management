const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinanceTransaction = sequelize.define('FinanceTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transactionNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  transactionDate: { type: DataTypes.DATEONLY, allowNull: false },
  transactionType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Payment' },
  referenceType: { type: DataTypes.STRING(100), allowNull: true },
  referenceId: { type: DataTypes.INTEGER, allowNull: true },
  referenceNumber: { type: DataTypes.STRING(100), allowNull: true },
  accountCode: { type: DataTypes.STRING(50), allowNull: true },
  accountName: { type: DataTypes.STRING(255), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  supplierId: { type: DataTypes.INTEGER, allowNull: true },
  supplierName: { type: DataTypes.STRING(255), allowNull: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  departmentName: { type: DataTypes.STRING(255), allowNull: true },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ETB' },
  debit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  credit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  paymentMethod: { type: DataTypes.STRING(50), allowNull: true },
  bankName: { type: DataTypes.STRING(255), allowNull: true },
  bankReference: { type: DataTypes.STRING(100), allowNull: true },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Posted' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  deletedBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'finance_transactions',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['transaction_date', 'id'], name: 'finance_transactions_date_id_idx' },
    { fields: ['status', 'transaction_date'], name: 'finance_transactions_status_date_idx' },
    { fields: ['transaction_type', 'transaction_date'], name: 'finance_transactions_type_date_idx' },
    { fields: ['reference_type', 'transaction_date'], name: 'finance_transactions_reference_date_idx' },
  ],
});

module.exports = FinanceTransaction;
