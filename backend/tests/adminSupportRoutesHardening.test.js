const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const router = require('../src/routes/adminSupportRoutes');
const { MaintenanceCost, Notification } = require('../src/models');

const handlerFor = (method, path) => {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `expected ${method.toUpperCase()} ${path} route`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

const makeRes = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('maintenance cost list serializes records without throwing', async (t) => {
  const original = MaintenanceCost.findAndCountAll;
  const row = {
    id: 1,
    maintenanceId: 2,
    assetId: 3,
    costCategory: 'labor',
    amount: '150.50',
    quantity: 1,
    unitCost: '150.50',
    costDate: new Date('2026-01-01T00:00:00.000Z'),
    approvedBy: 9,
    status: 'pending',
    notes: '',
    Maintenance: { id: 2, title: 'Fix printer', status: 'open', priority: 'high' },
    Asset: { id: 3, name: 'Laptop', assetCode: 'A-3', category: 'IT', department: 'IT', location: 'Store' },
    ApprovedByUser: { id: 9, username: 'admin', fullName: 'Admin User' },
    toJSON() { const { toJSON, ...rest } = this; return rest; },
  };
  MaintenanceCost.findAndCountAll = async () => ({ count: 1, rows: [row] });
  t.after(() => { MaintenanceCost.findAndCountAll = original; });

  const res = makeRes();
  await handlerFor('get', '/maintenance/costs')(
    { user: { id: 1, role: 'admin' }, query: {} },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.statusCode, 200);
  const item = res.body.data[0];
  assert.equal(item.maintenance_id, 2);
  assert.equal(item.total_cost, 150.5);
  assert.equal(item.cost_category, 'labor');
  assert.equal(item.maintenance.title, 'Fix printer');
  assert.equal(item.asset.assetCode, 'A-3');
  assert.equal(item.approved_by_user.username, 'admin');
});

test('delete-all notifications is scoped to the caller and broadcast rows', async (t) => {
  const original = Notification.destroy;
  let captured;
  Notification.destroy = async (arg) => { captured = arg; return 3; };
  t.after(() => { Notification.destroy = original; });

  const handler = handlerFor('delete', '/notifications/all');
  assert.equal(handler.length, 3);
  const res = makeRes();
  await handler({ user: { id: 7, role: 'admin' } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.ok(captured && captured.where && captured.where[Op.or], 'expected scoped destroy where clause');
  assert.notDeepEqual(captured.where, {});
});

test('notification read routes forward failures to the error handler', async (t) => {
  const original = Notification.findAll;
  Notification.findAll = async () => { throw new Error('db down'); };
  t.after(() => { Notification.findAll = original; });

  let forwarded;
  const handler = handlerFor('get', '/notifications');
  assert.equal(handler.length, 3);
  await handler({ user: { id: 7, role: 'admin' } }, makeRes(), (error) => { forwarded = error; });
  assert.match(forwarded.message, /db down/);
});
