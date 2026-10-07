const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const { FinanceTransaction } = require('../models');
const financeRoutes = require('../routes/financeRoutes');
const authMiddleware = require('../middlewares/auth');
const {
  listFinanceTransactions,
  getFinanceTransaction,
} = require('../controllers/financeTransactionController');

const invoke = async (handler, request = {}) => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
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

test('finance transaction model is registered with soft deletion and audit actors', () => {
  assert.ok(FinanceTransaction);
  assert.equal(FinanceTransaction.options.paranoid, true);
  for (const field of ['transactionNumber', 'transactionDate', 'amount', 'debit', 'credit', 'createdBy', 'updatedBy', 'deletedBy']) {
    assert.ok(FinanceTransaction.rawAttributes[field], `expected ${field} model attribute`);
  }
});

test('finance transaction API is read-only and requires authentication and finance/admin roles', () => {
  const expected = [
    ['get', '/transactions'],
    ['get', '/transactions/:id'],
  ];
  for (const [method, routePath] of expected) {
    const route = financeRoutes.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method])?.route;
    assert.ok(route, `expected ${method.toUpperCase()} ${routePath}`);
    assert.equal(route.stack[0].handle, authMiddleware.requireAuth);
    assert.equal(route.stack.length, 3, 'expected authentication, role authorization, and controller');
  }
});

test('finance transactions expose no create endpoint or controller', () => {
  assert.equal(financeRoutes.stack.some((layer) => layer.route?.path === '/transactions'
    && layer.route.methods.post), false);
  assert.equal(require('../controllers/financeTransactionController').createFinanceTransaction, undefined);
});

test('finance transactions expose no update endpoints or controller', () => {
  assert.equal(financeRoutes.stack.some((layer) => layer.route?.path === '/transactions/:id'
    && (layer.route.methods.put || layer.route.methods.patch)), false);
  assert.equal(require('../controllers/financeTransactionController').updateFinanceTransaction, undefined);
});

test('finance transactions expose no delete endpoint or controller', () => {
  assert.equal(financeRoutes.stack.some((layer) => layer.route?.path === '/transactions/:id'
    && layer.route.methods.delete), false);
  assert.equal(require('../controllers/financeTransactionController').deleteFinanceTransaction, undefined);
});

test('finance transaction page uses only read APIs', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/components/finance/FinanceTransactions.jsx'), 'utf8');
  assert.match(page, /api\.get\(\s*["']\/finance\/transactions["']/);
  assert.doesNotMatch(page, /api\.(post|put|patch|delete)\(/);
});

test('finance route role middleware rejects unauthenticated and unrelated roles', () => {
  const route = financeRoutes.stack.find((layer) => layer.route?.path === '/transactions' && layer.route.methods.get)?.route;
  const authorize = route.stack[1].handle;
  const run = (user) => {
    const response = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let nextCalled = false;
    authorize({ user }, response, () => { nextCalled = true; });
    return { response, nextCalled };
  };

  assert.equal(run({ id: 1, role: 'finance' }).nextCalled, true);
  assert.equal(run({ id: 2, role: 'admin' }).nextCalled, true);
  const unauthorizedRole = run({ id: 3, role: 'department_head' });
  assert.equal(unauthorizedRole.response.statusCode, 403);
  const unauthenticated = run(undefined);
  assert.equal(unauthenticated.response.statusCode, 401);
});

test('lists persistent transactions with filters, stable newest-first ordering, pagination, and summary', async () => {
  const originalFindAndCountAll = FinanceTransaction.findAndCountAll;
  const originalFindOne = FinanceTransaction.findOne;
  let queryOptions;
  FinanceTransaction.findAndCountAll = async (options) => {
    queryOptions = options;
    return {
      count: 2,
      rows: [{
        toJSON: () => ({ id: 8, transactionNumber: 'TXN-8', amount: '100.50', debit: '100.50', credit: '0', currency: 'ETB' }),
      }],
    };
  };
  FinanceTransaction.findOne = async (options) => {
    assert.equal(options.raw, true);
    return { amountTotal: '300.75', debitTotal: '200.50', creditTotal: '100.25' };
  };
  try {
    const response = await invoke(listFinanceTransactions, {
      query: {
        page: '2',
        pageSize: '5',
        search: 'TXN',
        status: 'Posted',
        transactionType: 'Payment',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data[0].amount, 100.5);
    assert.equal(response.body.summary.amountTotal, 300.75);
    assert.deepEqual(response.body.pagination, { page: 2, pageSize: 5, limit: 5, total: 2, totalPages: 1, pages: 1 });
    assert.deepEqual(queryOptions.order, [['transactionDate', 'DESC'], ['id', 'DESC']]);
    assert.equal(queryOptions.limit, 5);
    assert.equal(queryOptions.offset, 5);
    assert.equal(queryOptions.where.status, 'Posted');
    assert.equal(queryOptions.where.transactionType, 'Payment');
    assert.equal(queryOptions.where.transactionDate[Op.gte], '2026-10-01');
    assert.equal(queryOptions.where.transactionDate[Op.lte], '2026-10-31');
    assert.equal(queryOptions.where[Op.or][0].transactionNumber[Op.like], '%TXN%');
  } finally {
    FinanceTransaction.findAndCountAll = originalFindAndCountAll;
    FinanceTransaction.findOne = originalFindOne;
  }
});

test('gets a persistent transaction by ID', async () => {
  const originalFindByPk = FinanceTransaction.findByPk;
  const record = {
    id: 9,
    transactionNumber: 'TXN-2026-0001',
    currency: 'ETB',
    notes: '',
    toJSON() { return { id: this.id, transactionNumber: this.transactionNumber, currency: 'ETB' }; },
  };
  FinanceTransaction.findByPk = async () => record;
  try {
    const getResponse = await invoke(getFinanceTransaction, { params: { id: '9' } });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.body.data.id, 9);
  } finally {
    FinanceTransaction.findByPk = originalFindByPk;
  }
});

test('returns 404 for missing transaction details', async () => {
  const originalFindByPk = FinanceTransaction.findByPk;
  FinanceTransaction.findByPk = async () => null;
  try {
    const response = await invoke(getFinanceTransaction, { params: { id: '99999' } });
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.message, 'Transaction not found');
  } finally {
    FinanceTransaction.findByPk = originalFindByPk;
  }
});
