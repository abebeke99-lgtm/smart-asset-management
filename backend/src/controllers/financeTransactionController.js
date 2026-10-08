const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize,
  FinanceTransaction,
  AuditLog,
  Supplier,
  Invoice,
  Payment,
  PurchaseOrder,
  Budget,
  Asset,
} = require('../models');

const REFERENCE_MODELS = {
  invoice: Invoice,
  payment: Payment,
  purchase_order: PurchaseOrder,
  budget: Budget,
  asset: Asset,
};
const REFERENCE_TYPES = [...Object.keys(REFERENCE_MODELS), 'other'];
const ENTRY_TYPES = ['debit', 'credit'];
const STATUSES = ['pending', 'posted', 'voided'];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const respondWithError = (error, res, next) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  return next(error);
};

const parsePositiveInteger = (value, field, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw fail(`${field} must be a valid positive integer`);
  return parsed;
};

const nullableString = (value, field, limit = 2000) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw fail(`${field} must be text`);
  const normalized = String(value).trim();
  if (normalized.length > limit) throw fail(`${field} must be ${limit} characters or fewer`);
  return normalized || null;
};

const normalizeEnum = (value, values, field, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!values.includes(normalized)) throw fail(`${field} must be one of: ${values.join(', ')}`);
  return normalized;
};

const dateOnly = (value, field) => {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))
    || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    throw fail(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return date;
};

const parseDateFilter = (value, field) => (value ? dateOnly(value, field) : null);

const serialize = (record) => {
  const transaction = record.toJSON ? record.toJSON() : record;
  const amount = Number(transaction.amount || 0);
  return {
    ...transaction,
    amount,
    debit: transaction.type === 'debit' ? amount : 0,
    credit: transaction.type === 'credit' ? amount : 0,
    transactionType: transaction.transactionType || transaction.category || '',
    currency: transaction.currency || 'ETB',
    notes: transaction.notes || '',
  };
};

const validateReferences = async (values, transaction) => {
  if (values.supplierId && !(await Supplier.findByPk(values.supplierId, { transaction }))) {
    throw fail('Supplier was not found', 404);
  }
  if (values.referenceId && values.referenceType !== 'other') {
    const Model = REFERENCE_MODELS[values.referenceType];
    if (!(await Model.findByPk(values.referenceId, { transaction }))) {
      throw fail(`${values.referenceType} reference was not found`, 404);
    }
  }
};

const normalizeInput = (body, current = {}) => {
  const input = { ...current, ...body };
  const transactionNumber = nullableString(input.transactionNumber, 'transactionNumber', 100);
  if (!transactionNumber) throw fail('transactionNumber is required');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    throw fail('amount must be greater than zero and have at most two decimal places');
  }
  if (!input.transactionDate) throw fail('transactionDate is required');
  const currency = nullableString(input.currency || 'ETB', 'currency', 3);
  if (!currency || !/^[A-Za-z]{3}$/.test(currency)) throw fail('currency must be a three-letter code');
  const referenceType = normalizeEnum(input.referenceType, REFERENCE_TYPES, 'referenceType', 'other');
  const referenceId = input.referenceId === '' || input.referenceId == null
    ? null
    : parsePositiveInteger(input.referenceId, 'referenceId');
  if (referenceType !== 'other' && !referenceId) {
    throw fail(`referenceId is required for ${referenceType} references`);
  }
  const supplierId = input.supplierId === '' || input.supplierId == null
    ? null
    : parsePositiveInteger(input.supplierId, 'supplierId');
  const departmentId = input.departmentId === '' || input.departmentId == null
    ? null
    : parsePositiveInteger(input.departmentId, 'departmentId');

  return {
    transactionNumber,
    type: normalizeEnum(input.type ?? input.entryType, ENTRY_TYPES, 'type', 'debit'),
    category: nullableString(input.category || input.transactionType, 'category', 100),
    transactionType: nullableString(input.transactionType || input.category, 'transactionType', 50),
    status: normalizeEnum(input.status, STATUSES, 'status', 'pending'),
    amount: Number(amount.toFixed(2)),
    currency: currency.toUpperCase(),
    transactionDate: dateOnly(input.transactionDate, 'transactionDate'),
    referenceType,
    referenceId,
    referenceNumber: nullableString(input.referenceNumber, 'referenceNumber', 100),
    supplierId,
    supplierName: nullableString(input.supplierName, 'supplierName', 255),
    accountCode: nullableString(input.accountCode, 'accountCode', 50),
    accountName: nullableString(input.accountName, 'accountName', 255),
    description: nullableString(input.description, 'description'),
    departmentId,
    departmentName: nullableString(input.departmentName, 'departmentName', 255),
  };
};

const buildWhere = (query) => {
  const where = {};
  if (query.status) where.status = normalizeEnum(query.status, STATUSES, 'status');
  if (query.type) where.type = normalizeEnum(query.type, ENTRY_TYPES, 'type');
  if (query.referenceType) where.referenceType = normalizeEnum(query.referenceType, REFERENCE_TYPES, 'referenceType');
  const dateFrom = parseDateFilter(query.dateFrom ?? query.date_from, 'dateFrom');
  const dateTo = parseDateFilter(query.dateTo ?? query.date_to, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) throw fail('dateFrom cannot be later than dateTo');
  if (dateFrom || dateTo) {
    where.transactionDate = {};
    if (dateFrom) where.transactionDate[Op.gte] = dateFrom;
    if (dateTo) where.transactionDate[Op.lte] = dateTo;
  }
  const search = nullableString(query.search, 'search', 100);
  if (search) {
    where[Op.or] = ['transactionNumber', 'referenceNumber', 'supplierName', 'accountName', 'accountCode', 'description']
      .map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
  }
  return where;
};

const listFinanceTransactions = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', 1);
    const pageSize = parsePositiveInteger(req.query.pageSize, 'pageSize', 10, 100);
    const where = buildWhere(req.query);
    const [result, summary] = await Promise.all([
      FinanceTransaction.findAndCountAll({
        where,
        order: [['transactionDate', 'DESC'], ['id', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      FinanceTransaction.findOne({
        where,
        attributes: [
          [fn('COUNT', col('id')), 'totalCount'],
          [fn('COALESCE', fn('SUM', literal("CASE WHEN `status` = 'posted' THEN 1 ELSE 0 END")), 0), 'postedCount'],
          [fn('COALESCE', fn('SUM', literal("CASE WHEN `status` = 'pending' THEN 1 ELSE 0 END")), 0), 'pendingCount'],
          [fn('COALESCE', fn('SUM', literal("CASE WHEN `type` = 'debit' THEN `amount` ELSE 0 END")), 0), 'totalDebits'],
          [fn('COALESCE', fn('SUM', literal("CASE WHEN `type` = 'credit' THEN `amount` ELSE 0 END")), 0), 'totalCredits'],
        ],
        raw: true,
      }),
    ]);
    const totals = summary || {};
    const total = Number(result.count);
    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    return res.json({
      success: true,
      data: result.rows.map(serialize),
      pagination: { page, pageSize, total, totalPages },
      summary: {
        totalCount: Number(totals.totalCount ?? total),
        postedCount: Number(totals.postedCount || 0),
        pendingCount: Number(totals.pendingCount || 0),
        totalDebits: Number(totals.totalDebits || 0),
        totalCredits: Number(totals.totalCredits || 0),
      },
    });
  } catch (error) {
    return respondWithError(error, res, next);
  }
};

const getFinanceTransaction = async (req, res, next) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'id');
    const transaction = await FinanceTransaction.findByPk(id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: serialize(transaction) });
  } catch (error) {
    return respondWithError(error, res, next);
  }
};

const recordAudit = async ({ userId, action, record, oldValue, newValue, transaction }) => {
  await AuditLog.create({
    userId,
    action,
    entity: `financial_transaction:${record.id}`,
    details: JSON.stringify({ oldValue: oldValue || null, newValue: newValue || null }),
  }, { transaction });
};

const createFinanceTransaction = async (req, res, next) => {
  let transaction;
  try {
    const values = normalizeInput(req.body || {});
    if (values.status !== 'pending') throw fail('New transactions must start as pending');
    transaction = await sequelize.transaction();
    await validateReferences(values, transaction);
    const record = await FinanceTransaction.create({ ...values, createdBy: req.user.id }, { transaction });
    await recordAudit({ userId: req.user.id, action: 'FINANCE_TRANSACTION_CREATED', record, newValue: serialize(record), transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: serialize(record) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Transaction number already exists' });
    return respondWithError(error, res, next);
  }
};

const updateFinanceTransaction = async (req, res, next) => {
  let transaction;
  try {
    const id = parsePositiveInteger(req.params.id, 'id');
    transaction = await sequelize.transaction();
    const record = await FinanceTransaction.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (record.status !== 'pending') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Only pending transactions can be edited' });
    }
    const oldValue = serialize(record);
    const values = normalizeInput({ ...req.body, status: 'pending' }, oldValue);
    await validateReferences(values, transaction);
    await record.update({ ...values, status: 'pending' }, { transaction });
    await recordAudit({ userId: req.user.id, action: 'FINANCE_TRANSACTION_UPDATED', record, oldValue, newValue: serialize(record), transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(record) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Transaction number already exists' });
    return respondWithError(error, res, next);
  }
};

const postFinanceTransaction = async (req, res, next) => {
  let transaction;
  try {
    const id = parsePositiveInteger(req.params.id, 'id');
    transaction = await sequelize.transaction();
    const record = await FinanceTransaction.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (record.status !== 'pending') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Only pending transactions can be posted' });
    }
    const oldValue = serialize(record);
    await record.update({ status: 'posted', postedBy: req.user.id, postedAt: new Date() }, { transaction });
    await recordAudit({ userId: req.user.id, action: 'FINANCE_TRANSACTION_POSTED', record, oldValue, newValue: serialize(record), transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(record) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return respondWithError(error, res, next);
  }
};

const voidFinanceTransaction = async (req, res, next) => {
  let transaction;
  try {
    const id = parsePositiveInteger(req.params.id, 'id');
    const reason = nullableString(req.body?.reason, 'reason', 2000);
    if (!reason) throw fail('A void reason is required');
    transaction = await sequelize.transaction();
    const record = await FinanceTransaction.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (record.status === 'voided') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Transaction is already voided' });
    }
    const oldValue = serialize(record);
    await record.update({ status: 'voided', voidedBy: req.user.id, voidedAt: new Date(), voidReason: reason }, { transaction });
    await recordAudit({ userId: req.user.id, action: 'FINANCE_TRANSACTION_VOIDED', record, oldValue, newValue: serialize(record), transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(record) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return respondWithError(error, res, next);
  }
};

module.exports = {
  listFinanceTransactions,
  getFinanceTransaction,
  createFinanceTransaction,
  updateFinanceTransaction,
  postFinanceTransaction,
  voidFinanceTransaction,
  normalizeInput,
};
