const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../routes/returnWorkflowRoutes');
const { createReturn, listReturns } = require('../controllers/returnWorkflowController');
const { sequelize, Asset, Assignment, AssetReturn, AuditLog, Maintenance, MaintenanceHistory, User } = require('../models');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const replace = (model, method, value) => {
  const original = model[method];
  model[method] = value;
  return () => { model[method] = original; };
};

const makeTransaction = () => ({
  LOCK: { UPDATE: 'UPDATE' },
  finished: false,
  async commit() { this.finished = 'commit'; },
  async rollback() { this.finished = 'rollback'; },
});

test('department return routes enforce the controlled view and manage permissions', async () => {
  for (const [path, method, permission] of [
    ['/department-head/returns', 'get', 'department_head.returns.view'],
    ['/department-head/returns', 'post', 'department_head.returns.manage'],
  ]) {
    const route = routes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
    assert.ok(route);
    const guard = route.route.stack[3]?.handle;
    assert.ok(guard, `${method.toUpperCase()} ${path} should include a permission guard`);
    const roleGuard = route.route.stack[1].handle;
    const wrongRole = response();
    roleGuard({ user: { role: 'store_manager', permissions: [permission] } }, wrongRole, () => assert.fail('must deny a non-department role'));
    assert.equal(wrongRole.statusCode, 403);
    const denied = response();
    guard({ user: { role: 'department_head', permissions: [] } }, denied, () => assert.fail('must deny missing permission'));
    assert.equal(denied.statusCode, 403);
    let allowed = false;
    guard({ user: { role: 'department_head', permissions: [permission] } }, response(), () => { allowed = true; });
    assert.equal(allowed, true);
  }
});

test('department return rejects an invalid condition before opening a transaction', async () => {
  const originalTransaction = sequelize.transaction;
  sequelize.transaction = async () => assert.fail('invalid return must not start a transaction');
  const res = response();
  try {
    await createReturn({ body: { asset_id: 5, condition: 'Broken' }, organizationScope: { departmentId: 7 }, user: { id: 3 } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /condition/i);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('damaged return records its assigned person, date, evidence, and opens one maintenance record', async () => {
  const transaction = makeTransaction();
  let maintenanceValues;
  let maintenanceHistoryValues;
  const restore = [
    replace(sequelize, 'transaction', async () => transaction),
    replace(Asset, 'findOne', async (options) => {
      assert.deepEqual(options.where, { id: 22, departmentId: 7 });
      return { id: 22, name: 'Laptop', assetCode: 'L-22', status: 'assigned', collegeId: 2, departmentId: 7 };
    }),
    replace(Assignment, 'findOne', async () => ({ id: 9, assetId: 22, assignedTo: 44 })),
    replace(AssetReturn, 'create', async (values) => ({
      id: 15,
      ...values,
      toJSON() { return { id: this.id, ...values }; },
    })),
    replace(User, 'findByPk', async () => ({ id: 44, fullName: 'Returning Person', username: 'returner', toJSON() { return this; } })),
    replace(Maintenance, 'findOne', async () => null),
    replace(Maintenance, 'create', async (values) => { maintenanceValues = values; return { id: 81, ...values }; }),
    replace(MaintenanceHistory, 'create', async (values) => { maintenanceHistoryValues = values; return values; }),
    replace(AuditLog, 'create', async (values) => values),
  ];
  const res = response();

  try {
    await createReturn({
      body: { asset_id: 22, return_date: '2026-10-05', condition: 'Damaged', notes: 'Screen cracked', evidence_url: '/uploads/return-photo.png' },
      organizationScope: { departmentId: 7, collegeId: 2 },
      user: { id: 3 },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.sourceUserId, 44);
    assert.equal(res.body.data.returning_person_name, 'Returning Person');
    assert.equal(res.body.data.return_date, '2026-10-05');
    assert.equal(res.body.data.evidence_url, '/uploads/return-photo.png');
    assert.equal(res.body.data.condition, 'Damaged');
    assert.equal(res.body.data.outcome, 'Maintenance Required');
    assert.equal(res.body.data.status, 'Requested');
    assert.equal(maintenanceValues.assetId, 22);
    assert.equal(maintenanceValues.requestedBy, 3);
    assert.equal(maintenanceValues.priority, 'high');
    assert.equal(maintenanceHistoryValues.details.returnId, 15);
    assert.equal(transaction.finished, 'commit');
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('damaged return reuses an existing open maintenance record', async () => {
  const transaction = makeTransaction();
  let maintenanceCreates = 0;
  const existingMaintenance = { id: 81, status: 'pending' };
  const restore = [
    replace(sequelize, 'transaction', async () => transaction),
    replace(Asset, 'findOne', async () => ({ id: 22, name: 'Laptop', status: 'assigned', collegeId: 2, departmentId: 7 })),
    replace(Assignment, 'findOne', async () => ({ id: 9, assetId: 22, assignedTo: 44 })),
    replace(AssetReturn, 'create', async (values) => ({ id: 15, ...values, toJSON() { return { id: this.id, ...values }; } })),
    replace(User, 'findByPk', async () => ({ id: 44, fullName: 'Returning Person', username: 'returner' })),
    replace(Maintenance, 'findOne', async () => existingMaintenance),
    replace(Maintenance, 'create', async () => { maintenanceCreates += 1; }),
    replace(AuditLog, 'create', async (values) => values),
  ];
  const res = response();
  try {
    await createReturn({
      body: { asset_id: 22, condition: 'Non-functional' },
      organizationScope: { departmentId: 7 },
      user: { id: 3 },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 201);
    assert.equal(maintenanceCreates, 0);
    assert.equal(transaction.finished, 'commit');
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('return history queries only the department and normalizes linked asset and person details', async () => {
  let query;
  const record = {
    toJSON() {
      return {
        id: 15,
        returnNumber: 'RET-15',
        assetId: 22,
        returnDate: '2026-10-05',
        Asset: { id: 22, name: 'Laptop' },
        ReturningPerson: { id: 44, fullName: 'Returning Person' },
      };
    },
  };
  const restore = replace(AssetReturn, 'findAndCountAll', async (options) => {
    query = options;
    return { rows: [record], count: 1 };
  });
  const res = response();
  try {
    await listReturns({ organizationScope: { departmentId: 7 }, query: {} }, res, (error) => { throw error; });
    assert.deepEqual(query.where, { departmentId: 7 });
    assert.ok(query.include.some((include) => include.as === 'ReturningPerson'));
    assert.equal(res.body.data[0].asset_name, 'Laptop');
    assert.equal(res.body.data[0].returning_person_name, 'Returning Person');
    assert.equal(res.body.data[0].return_date, '2026-10-05');
  } finally {
    restore();
  }
});
