const { Op, col, fn } = require('sequelize');
const { FinanceTransaction } = require('../models');

const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const respondWithError = (error, res, next) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  return next(error);
};

const nullableString = (value, field, limit = 2000) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw fail(`${field} must be text`);
  const normalized = String(value).trim();
  if (normalized.length > limit) throw fail(`${field} must be ${limit} characters or fewer`);
  return normalized || null;
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

const serialize = (record) => {
  const transaction = record.toJSON ? record.toJSON() : record;
  return {
    ...transaction,
    amount: Number(transaction.amount || 0),
    debit: Number(transaction.debit || 0),
    credit: Number(transaction.credit || 0),
    currency: transaction.currency || 'ETB',
    notes: transaction.notes || '',
  };
};

const parsePositiveInteger = (value, field, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw fail(`${field} must be a valid positive integer`);
  }
  return parsed;
};

const parseDateFilter = (value, field) => (value ? dateOnly(value, field) : null);

const listFinanceTransactions = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', 1);
    const pageSize = parsePositiveInteger(req.query.pageSize ?? req.query.limit, 'pageSize', 10, 100);
    const search = nullableString(req.query.search, 'search', 100);
    const transactionType = nullableString(req.query.transactionType ?? req.query.type, 'transactionType', 50);
    const referenceType = nullableString(req.query.referenceType ?? req.query.reference_type, 'referenceType', 100);
    const status = nullableString(req.query.status, 'status', 30);
    const dateFrom = parseDateFilter(req.query.dateFrom ?? req.query.date_from, 'dateFrom');
    const dateTo = parseDateFilter(req.query.dateTo ?? req.query.date_to, 'dateTo');
    if (dateFrom && dateTo && dateFrom > dateTo) throw fail('dateFrom cannot be later than dateTo');

    const where = {};
    if (transactionType) where.transactionType = transactionType;
    if (referenceType) where.referenceType = referenceType;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate[Op.gte] = dateFrom;
      if (dateTo) where.transactionDate[Op.lte] = dateTo;
    }
    if (search) {
      where[Op.or] = ['transactionNumber', 'referenceNumber', 'description', 'supplierName', 'accountName']
        .map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    }

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
          [fn('COALESCE', fn('SUM', col('amount')), 0), 'amountTotal'],
          [fn('COALESCE', fn('SUM', col('debit')), 0), 'debitTotal'],
          [fn('COALESCE', fn('SUM', col('credit')), 0), 'creditTotal'],
        ],
        raw: true,
      }),
    ]);

    const total = result.count;
    const transactions = result.rows.map(serialize);
    const summaryValues = summary || {};
    const pagination = {
      page,
      pageSize,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
    return res.json({
      success: true,
      data: transactions,
      transactions,
      summary: {
        count: total,
        amountTotal: Number(summaryValues.amountTotal || 0),
        debitTotal: Number(summaryValues.debitTotal || 0),
        creditTotal: Number(summaryValues.creditTotal || 0),
      },
      pagination: { ...pagination, pages: pagination.totalPages },
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

module.exports = { listFinanceTransactions, getFinanceTransaction };
