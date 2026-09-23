const { Op } = require('sequelize');
const { sequelize, AuditLog, Invoice, Payment, User } = require('../models');
const { createFinanceNotification } = require('../services/notificationService');

const METHODS = ['BANK_TRANSFER', 'CHEQUE', 'OTHER_APPROVED_METHOD'];
const number = (value) => Number(value);
const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const userInclude = (as) => ({ model: User, as, attributes: ['id', 'username', 'fullName'], required: false });
const include = [
  { model: Invoice, as: 'InvoiceRecord', attributes: ['id', 'invoiceNumber', 'supplierName', 'totalAmount', 'paidAmount', 'currency', 'status', 'verificationStatus', 'approvalStatus'] },
  userInclude('Requester'),
  userInclude('Approver'),
  userInclude('Processor'),
];

const nameOf = (user) => user?.fullName || user?.username || '';
const normalize = (record) => {
  const value = record.toJSON ? record.toJSON() : record;
  const invoice = value.InvoiceRecord || {};
  return {
    ...value,
    amount: Number(value.amount || 0),
    invoiceNumber: invoice.invoiceNumber || '',
    supplierName: invoice.supplierName || '',
    outstandingAmount: Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0)),
    requestedByName: nameOf(value.Requester),
    approvedByName: nameOf(value.Approver),
    processedByName: nameOf(value.Processor),
  };
};

const listPayments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
    const search = String(req.query.search || '').trim();
    const where = {};
    if (search) where[Op.or] = [{ paymentNumber: { [Op.like]: `%${search}%` } }, { referenceNumber: { [Op.like]: `%${search}%` } }];
    if (METHODS.includes(req.query.paymentMethod)) where.paymentMethod = req.query.paymentMethod;
    if (req.query.status) where.status = req.query.status;
    const result = await Payment.findAndCountAll({ where, include, distinct: true, limit: pageSize, offset: (page - 1) * pageSize, order: [['createdAt', 'DESC']] });
    const data = result.rows.map(normalize);
    return res.json({ success: true, data, summary: { total: result.count, pending: data.filter((row) => row.status === 'PENDING_APPROVAL').length, approved: data.filter((row) => row.status === 'APPROVED').length, processed: data.filter((row) => row.status === 'COMPLETED').length }, pagination: { page, pageSize, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / pageSize)) }, filters: { methods: METHODS, statuses: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'] } });
  } catch (error) { return next(error); }
};

const getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findByPk(req.params.id, { include });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    return res.json({ success: true, data: normalize(payment) });
  } catch (error) { return next(error); }
};

const createPaymentRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.body.invoiceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!invoice) throw fail('Invoice not found', 404);
    if (invoice.verificationStatus !== 'Verified') throw fail('Invoice must be verified before requesting payment', 409);
    if (invoice.status === 'Cancelled') throw fail('Cancelled invoices cannot be paid', 409);
    const amount = number(req.body.amount);
    const outstanding = Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount));
    if (!Number.isFinite(amount) || amount <= 0) throw fail('Payment amount must be greater than zero');
    if (amount > outstanding) throw fail(`Payment amount exceeds the invoice outstanding amount of ${outstanding.toFixed(2)}`, 409);
    const paymentMethod = String(req.body.paymentMethod || '');
    if (!METHODS.includes(paymentMethod)) throw fail('Unsupported payment method');
    if (!String(req.body.paymentNumber || '').trim()) throw fail('Payment number is required');
    if (!String(req.body.referenceNumber || '').trim()) throw fail('Reference number is required');
    const payment = await Payment.create({ paymentNumber: String(req.body.paymentNumber).trim(), invoiceId: invoice.id, paymentDate: req.body.paymentDate || new Date(), amount, currency: invoice.currency, paymentMethod, referenceNumber: String(req.body.referenceNumber).trim(), bankName: req.body.bankName || null, bankAccount: req.body.bankAccount || null, requestedBy: req.user.id, notes: String(req.body.notes || '') }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'PAYMENT_REQUEST_CREATED', entity: `payment:${payment.id}`, details: JSON.stringify({ invoiceId: invoice.id, amount }) }, { transaction });
    await transaction.commit();
    await createFinanceNotification({ event: 'finance_payment_submitted', eventKey: `finance_payment_submitted:${payment.id}`, entityId: payment.id, senderId: req.user.id, type: 'financial', title: 'Payment awaiting approval', message: `Payment ${payment.paymentNumber} for invoice ${invoice.invoiceNumber} is awaiting approval.` });
    return getPayment({ ...req, params: { id: payment.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const transitionPayment = (action) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) throw fail('Payment not found', 404);
    const invoice = await Invoice.findByPk(payment.invoiceId, { transaction, lock: transaction.LOCK.UPDATE });
    const updates = { updatedAt: new Date() };
    if (action === 'approve') { if (payment.status !== 'PENDING_APPROVAL') throw fail('Only pending payment requests can be approved', 409); updates.status = 'APPROVED'; updates.approvedBy = req.user.id; updates.approvedAt = new Date(); }
    if (action === 'reject') { if (payment.status !== 'PENDING_APPROVAL') throw fail('Only pending payment requests can be rejected', 409); updates.status = 'REJECTED'; }
    if (action === 'process') {
      if (payment.status !== 'APPROVED') throw fail('Only approved payment requests can be processed', 409);
      const outstanding = Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount));
      if (Number(payment.amount) > outstanding) throw fail('Payment exceeds the current invoice outstanding amount', 409);
      updates.status = 'COMPLETED'; updates.processedBy = req.user.id; updates.processedAt = new Date();
      const paidAmount = Number(invoice.paidAmount) + Number(payment.amount);
      await invoice.update({ paidAmount, status: paidAmount >= Number(invoice.totalAmount) ? 'Paid' : 'Due' }, { transaction });
    }
    if (action === 'cancel') { if (['COMPLETED', 'CANCELLED'].includes(payment.status)) throw fail('Completed payments cannot be cancelled', 409); updates.status = 'CANCELLED'; }
    await payment.update(updates, { transaction });
    await AuditLog.create({ userId: req.user.id, action: `PAYMENT_${action.toUpperCase()}`, entity: `payment:${payment.id}`, details: JSON.stringify({ status: updates.status }) }, { transaction });
    await transaction.commit();
    return getPayment({ ...req, params: { id: payment.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = { listPayments, getPayment, createPaymentRequest, approvePayment: transitionPayment('approve'), rejectPayment: transitionPayment('reject'), processPayment: transitionPayment('process'), cancelPayment: transitionPayment('cancel') };
