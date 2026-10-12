const test = require('node:test');
const assert = require('node:assert/strict');
const financeRoutes = require('../routes/financeRoutes');
const authMiddleware = require('../middlewares/auth');
const { AuditLog, User } = require('../models');
const financeController = require('../controllers/financeController');

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
  await handler(
    {
      user: { id: 27, role: 'finance' },
      query: {},
      params: {},
      body: {},
      ...request,
    },
    response,
    (error) => {
      nextError = error;
    }
  );

  assert.equal(nextError, undefined, nextError?.message);
  return response;
};

const routeFor = (method, routePath) => financeRoutes.stack.find(
  (layer) => layer.route?.path === routePath && layer.route.methods[method]
)?.route;

const auditRecord = (overrides = {}) => ({
  id: 101,
  userId: 27,
  action: 'VALUATION_CHANGE',
  entity: 'asset',
  details: JSON.stringify({ asset_id: 16, old_value: 1500, new_value: 1800 }),
  createdAt: '2026-10-07T10:00:00.000Z',
  User: { id: 27, username: 'finance_user', fullName: 'Finance User', role: 'finance' },
  ...overrides,
});

test('finance audit routes require authentication and finance/admin access', () => {
  for (const routePath of ['/audit', '/audit/finance']) {
    const route = routeFor('get', routePath);
    assert.ok(route, `expected GET ${routePath}`);
    assert.equal(route.stack[0].handle, authMiddleware.requireAuth);
    assert.equal(typeof route.stack[1].handle, 'function');
  }
});

test('finance audit RBAC rejects non-finance roles with 403 and unauthenticated requests with 401', () => {
  const authorize = routeFor('get', '/audit').stack[1].handle;

  const call = (user) => {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let passed = false;
    authorize({ user }, response, () => {
      passed = true;
    });
    return { response, passed };
  };

  assert.equal(call({ id: 1, role: 'finance' }).passed, true);
  assert.equal(call({ id: 2, role: 'admin' }).passed, true);
  assert.equal(call({ id: 3, role: 'department_head' }).response.statusCode, 403);
  assert.equal(call(undefined).response.statusCode, 401);
});

test('listAudit loads actual audit log rows from the database for finance users', async () => {
  const originalFindAll = AuditLog.findAll;
  try {
    AuditLog.findAll = async ({ include, order }) => {
      assert.ok(Array.isArray(include));
      assert.deepEqual(include[0].model, User);
      assert.deepEqual(include[0].attributes, ['username', 'fullName', 'role']);
      assert.deepEqual(order, [['createdAt', 'DESC']]);
      return [auditRecord()];
    };

    const response = await invoke(financeController.listAudit, { user: { id: 27, role: 'finance' } });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.logs.length, 1);
    assert.equal(response.body.logs[0].action, 'VALUATION_CHANGE');
    assert.equal(response.body.logs[0].User.username, 'finance_user');
  } finally {
    AuditLog.findAll = originalFindAll;
  }
});

test('listAudit logs database diagnostics and returns a generic 500 response', async () => {
  const originalFindAll = AuditLog.findAll;
  const consoleError = console.error;
  const error = new Error('database details must not be exposed');
  error.original = {
    code: 'ER_BAD_FIELD_ERROR',
    sqlMessage: 'Unknown column audit_logs.created_at',
  };
  error.sql = 'SELECT private audit data';
  const logged = [];

  try {
    AuditLog.findAll = async () => {
      throw error;
    };
    console.error = (...arguments_) => logged.push(arguments_);

    const response = await invoke(financeController.listAudit, { user: { id: 27, role: 'finance' } });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: 'Unable to load finance audit records' });
    assert.equal(logged.length, 1);
    assert.deepEqual(logged[0][1], {
      code: 'ER_BAD_FIELD_ERROR',
      sqlMessage: 'Unknown column audit_logs.created_at',
      sql: 'SELECT private audit data',
    });
    assert.equal(JSON.stringify(response.body).includes('private audit data'), false);
  } finally {
    AuditLog.findAll = originalFindAll;
    console.error = consoleError;
  }
});
