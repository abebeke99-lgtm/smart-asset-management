const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinanceTransaction = sequelize.define('FinanceTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transactionNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'transaction_number' },
  type: { type: DataTypes.ENUM('debit', 'credit'), allowNull: false },
  category: { type: DataTypes.STRING(100), allowNull: true },
  transactionType: { type: DataTypes.STRING(50), allowNull: true, field: 'transaction_type' },
  status: { type: DataTypes.ENUM('pending', 'posted', 'voided'), allowNull: false, defaultValue: 'pending' },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0.01 } },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ETB' },
  transactionDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'transaction_date' },
  referenceType: { type: DataTypes.ENUM('invoice', 'payment', 'purchase_order', 'budget', 'asset', 'other'), allowNull: false, defaultValue: 'other', field: 'reference_type' },
  referenceId: { type: DataTypes.INTEGER, allowNull: true, field: 'reference_id' },
  referenceNumber: { type: DataTypes.STRING(100), allowNull: true, field: 'reference_number' },
  supplierId: { type: DataTypes.INTEGER, allowNull: true, field: 'supplier_id' },
  supplierName: { type: DataTypes.STRING(255), allowNull: true, field: 'supplier_name' },
  accountCode: { type: DataTypes.STRING(50), allowNull: true, field: 'account_code' },
  accountName: { type: DataTypes.STRING(255), allowNull: true, field: 'account_name' },
  description: { type: DataTypes.TEXT, allowNull: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  departmentName: { type: DataTypes.STRING(255), allowNull: true, field: 'department_name' },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },
  postedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'posted_by' },
  postedAt: { type: DataTypes.DATE, allowNull: true, field: 'posted_at' },
  voidedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'voided_by' },
  voidedAt: { type: DataTypes.DATE, allowNull: true, field: 'voided_at' },
  voidReason: { type: DataTypes.TEXT, allowNull: true, field: 'void_reason' },
  debit: {
    type: DataTypes.VIRTUAL,
    get() { return this.type === 'debit' ? Number(this.amount || 0) : 0; },
  },
  credit: {
    type: DataTypes.VIRTUAL,
    get() { return this.type === 'credit' ? Number(this.amount || 0) : 0; },
  },
}, {
  tableName: 'financial_transactions',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status'], name: 'financial_transactions_status_idx' },
    { fields: ['type'], name: 'financial_transactions_type_idx' },
    { fields: ['transaction_date'], name: 'financial_transactions_date_idx' },
    { fields: ['reference_type', 'reference_id'], name: 'financial_transactions_reference_idx' },
  ],
});

module.exports = FinanceTransaction;
