const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const { sequelize, FinanceTransaction, AuditLog } = require('../models');
const financeRoutes = require('../routes/financeRoutes');
const authMiddleware = require('../middlewares/auth');
const handlers = require('../controllers/financeTransactionController');

const invoke = async (handler, request = {}) => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextError;
  await handler({
    user: { id: 27, role: 'finance' },
    query: {},
    params: {},
    body: {},
    ...request,
  }, response, (error) => { nextError = error; });
  assert.equal(nextError, undefined, nextError?.message);
  return response;
};

const routeFor = (method, routePath) => financeRoutes.stack
  .find((layer) => layer.route?.path === routePath && layer.route.methods[method])?.route;

const transactionRecord = (values = {}) => ({
  id: 9,
  transactionNumber: 'TXN-2026-000009',
  type: 'debit',
  status: 'pending',
  amount: '125.50',
  currency: 'ETB',
  transactionDate: '2026-10-07',
  referenceType: 'other',
  createdBy: 27,
  ...values,
  async update(changes, options) {
    this.updateOptions = options;
    Object.assign(this, changes);
  },
  toJSON() {
    const { updateOptions, ...data } = this;
    return data;
  },
});

const withTransactionMocks = async (testBody, overrides = {}) => {
  const originals = {
    transaction: sequelize.transaction,
    findByPk: FinanceTransaction.findByPk,
    create: FinanceTransaction.create,
    audit: AuditLog.create,
  };
  const calls = [];
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() { this.finished = 'commit'; calls.push('commit'); },
    async rollback() { this.finished = 'rollback'; calls.push('rollback'); },
  };
  sequelize.transaction = async () => transaction;
  FinanceTransaction.findByPk = overrides.findByPk || (async () => transactionRecord());
  FinanceTransaction.create = overrides.create || (async (values, options) => {
    calls.push('create');
    return transactionRecord({ ...values, id: 31, createOptions: options });
  });
  AuditLog.create = overrides.audit || (async (entry, options) => {
    calls.push(entry.action);
    assert.equal(options.transaction, transaction);
  });
  try {
    await testBody({ calls, transaction });
  } finally {
    sequelize.transaction = originals.transaction;
    FinanceTransaction.findByPk = originals.findByPk;
    FinanceTransaction.create = originals.create;
    AuditLog.create = originals.audit;
  }
};

const validInput = (overrides = {}) => ({
  transactionNumber: 'TXN-2026-000009',
  transactionDate: '2026-10-07',
  type: 'debit',
  amount: 125.5,
  status: 'pending',
  referenceType: 'other',
  ...overrides,
});

test('financial transaction model and migration match persistent lifecycle schema', () => {
  assert.equal(FinanceTransaction.getTableName(), 'financial_transactions');
  assert.equal(FinanceTransaction.options.paranoid, false);
  for (const field of ['transactionNumber', 'type', 'status', 'amount', 'transactionDate', 'referenceType', 'referenceId', 'supplierId', 'createdBy', 'postedBy', 'postedAt', 'voidedBy', 'voidedAt', 'voidReason']) {
    assert.ok(FinanceTransaction.rawAttributes[field], `expected ${field} model attribute`);
  }
  const migration = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/20261008_financial_transactions_lifecycle.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS financial_transactions/);
  assert.match(migration, /financial_transactions_reference_idx/);
});

test('finance transaction routes require authentication and finance/admin roles and never hard-delete', () => {
  const expected = [
    ['get', '/transactions'],
    ['get', '/transactions/:id'],
    ['post', '/transactions'],
    ['put', '/transactions/:id'],
    ['post', '/transactions/:id/post'],
    ['post', '/transactions/:id/void'],
  ];
  for (const [method, routePath] of expected) {
    const route = routeFor(method, routePath);
    assert.ok(route, `expected ${method.toUpperCase()} ${routePath}`);
    assert.equal(route.stack[0].handle, authMiddleware.requireAuth);
    assert.equal(typeof route.stack[1].handle, 'function');
  }
  assert.equal(financeRoutes.stack.some((layer) => layer.route?.path.startsWith('/transactions') && layer.route.methods.delete), false);
});

test('finance transaction RBAC rejects unauthenticated and non-finance roles with 401 and 403', () => {
  const authorize = routeFor('get', '/transactions').stack[1].handle;
  const call = (user) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let passed = false;
    authorize({ user }, response, () => { passed = true; });
    return { response, passed };
  };
  assert.equal(call({ id: 1, role: 'finance' }).passed, true);
  assert.equal(call({ id: 2, role: 'admin' }).passed, true);
  assert.equal(call({ id: 3, role: 'finance_manager' }).response.statusCode, 403);
  assert.equal(call({ id: 4, role: 'department_head' }).response.statusCode, 403);
  assert.equal(call(undefined).response.statusCode, 401);
});

test('lists filtered persistent transactions with pagination and filtered summary totals', async () => {
  const originals = {
    findAndCountAll: FinanceTransaction.findAndCountAll,
    findOne: FinanceTransaction.findOne,
  };
  let listOptions;
  let summaryOptions;
  FinanceTransaction.findAndCountAll = async (options) => {
    listOptions = options;
    return { count: 12, rows: [transactionRecord()] };
  };
  FinanceTransaction.findOne = async (options) => {
    summaryOptions = options;
    return { totalCount: '12', postedCount: '5', pendingCount: '4', totalDebits: '900.50', totalCredits: '230.25' };
  };
  try {
    const response = await invoke(handlers.listFinanceTransactions, {
      query: {
        page: '2',
        pageSize: '5',
        search: 'INV-9',
        status: 'posted',
        type: 'credit',
        referenceType: 'invoice',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].debit, 125.5);
    assert.deepEqual(response.body.pagination, { page: 2, pageSize: 5, total: 12, totalPages: 3 });
    assert.deepEqual(response.body.summary, {
      totalCount: 12,
      postedCount: 5,
      pendingCount: 4,
      totalDebits: 900.5,
      totalCredits: 230.25,
    });
    assert.equal(listOptions.limit, 5);
    assert.equal(listOptions.offset, 5);
    assert.equal(listOptions.where.status, 'posted');
    assert.equal(listOptions.where.type, 'credit');
    assert.equal(listOptions.where.referenceType, 'invoice');
    assert.equal(listOptions.where.transactionDate[Op.gte], '2026-10-01');
    assert.equal(listOptions.where.transactionDate[Op.lte], '2026-10-31');
    assert.equal(listOptions.where[Op.or][0].transactionNumber[Op.like], '%INV-9%');
    assert.deepEqual(summaryOptions.where, listOptions.where);
  } finally {
    FinanceTransaction.findAndCountAll = originals.findAndCountAll;
    FinanceTransaction.findOne = originals.findOne;
  }
});

test('empty transaction listing returns zero rows and zero totals', async () => {
  const originals = {
    findAndCountAll: FinanceTransaction.findAndCountAll,
    findOne: FinanceTransaction.findOne,
  };
  FinanceTransaction.findAndCountAll = async () => ({ count: 0, rows: [] });
  FinanceTransaction.findOne = async () => ({
    totalCount: 0,
    postedCount: 0,
    pendingCount: 0,
    totalDebits: 0,
    totalCredits: 0,
  });
  try {
    const response = await invoke(handlers.listFinanceTransactions);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.pagination, { page: 1, pageSize: 10, total: 0, totalPages: 0 });
    assert.equal(response.body.summary.totalCount, 0);
    assert.equal(response.body.summary.totalDebits, 0);
  } finally {
    FinanceTransaction.findAndCountAll = originals.findAndCountAll;
    FinanceTransaction.findOne = originals.findOne;
  }
});

test('validates amount, entry type, lifecycle status, date, and reference type', async () => {
  for (const body of [
    validInput({ amount: 0 }),
    validInput({ type: 'transfer' }),
    validInput({ status: 'draft' }),
    validInput({ transactionDate: '2026-02-30' }),
    validInput({ referenceType: 'invoice' }),
  ]) {
    const response = await invoke(handlers.createFinanceTransaction, { body });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
  }
});

test('creates pending transactions persistently and audits creation in same database transaction', async () => {
  await withTransactionMocks(async ({ calls, transaction }) => {
    const response = await invoke(handlers.createFinanceTransaction, { body: validInput() });
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.data.status, 'pending');
    assert.equal(response.body.data.type, 'debit');
    assert.equal(response.body.data.debit, 125.5);
    assert.ok(calls.includes('FINANCE_TRANSACTION_CREATED'));
    assert.equal(transaction.finished, 'commit');
  }, {
    create: async (values, options) => {
      assert.equal(values.createdBy, 27);
      assert.equal(values.status, 'pending');
      assert.equal(options.transaction.finished, false);
      return transactionRecord({ ...values, id: 31 });
    },
  });
});

test('updates only pending transactions and audits the old and new values', async () => {
  await withTransactionMocks(async ({ calls, transaction }) => {
    const response = await invoke(handlers.updateFinanceTransaction, {
      params: { id: '9' },
      body: { ...validInput(), amount: 500 },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.amount, 500);
    assert.ok(calls.includes('FINANCE_TRANSACTION_UPDATED'));
    assert.equal(transaction.finished, 'commit');
  });
});

test('rejects editing a posted transaction', async () => {
  await withTransactionMocks(async ({ transaction }) => {
    const response = await invoke(handlers.updateFinanceTransaction, { params: { id: '9' }, body: validInput() });
    assert.equal(response.statusCode, 409);
    assert.equal(transaction.finished, 'rollback');
  }, { findByPk: async () => transactionRecord({ status: 'posted' }) });
});

test('posts pending transactions and records poster/time with audit log', async () => {
  await withTransactionMocks(async ({ calls, transaction }) => {
    const response = await invoke(handlers.postFinanceTransaction, { params: { id: '9' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.status, 'posted');
    assert.equal(response.body.data.postedBy, 27);
    assert.ok(response.body.data.postedAt);
    assert.ok(calls.includes('FINANCE_TRANSACTION_POSTED'));
    assert.equal(transaction.finished, 'commit');
  });
});

test('voids a transaction only with a required reason and never deletes the row', async () => {
  await withTransactionMocks(async ({ calls, transaction }) => {
    const response = await invoke(handlers.voidFinanceTransaction, {
      params: { id: '9' },
      body: { reason: 'Duplicate source document' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.status, 'voided');
    assert.equal(response.body.data.voidReason, 'Duplicate source document');
    assert.equal(response.body.data.voidedBy, 27);
    assert.ok(calls.includes('FINANCE_TRANSACTION_VOIDED'));
    assert.equal(transaction.finished, 'commit');
  });
  const invalid = await invoke(handlers.voidFinanceTransaction, { params: { id: '9' }, body: {} });
  assert.equal(invalid.statusCode, 400);
});

test('GET transaction detail returns persisted record or 404', async () => {
  const original = FinanceTransaction.findByPk;
  FinanceTransaction.findByPk = async () => transactionRecord();
  try {
    assert.equal((await invoke(handlers.getFinanceTransaction, { params: { id: '9' } })).statusCode, 200);
    FinanceTransaction.findByPk = async () => null;
    assert.equal((await invoke(handlers.getFinanceTransaction, { params: { id: '9' } })).statusCode, 404);
  } finally {
    FinanceTransaction.findByPk = original;
  }
});

test('frontend consumes API filters, persistent summaries, and lifecycle endpoints', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/components/finance/FinanceTransactions.jsx'), 'utf8');
  assert.match(page, /api\.get\(\s*["']\/finance\/transactions["']/);
  assert.match(page, /params\.type = type/);
  assert.match(page, /summary\.totalDebits/);
  assert.match(page, /api\.post\("\/finance\/transactions"/);
  assert.match(page, /api\.put\(`\/finance\/transactions\//);
  assert.match(page, /\/void`/);
  assert.doesNotMatch(page, /api\.delete\(/);
});
