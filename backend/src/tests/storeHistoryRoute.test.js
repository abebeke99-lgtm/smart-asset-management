const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const storeRoutes = require('../routes/storeRoutes');
const assignmentRoutes = require('../routes/assignmentRoutes');
const userRoutes = require('../routes/userRoutes');
const departmentRoutes = require('../routes/departmentRoutes');
const returnWorkflowRoutes = require('../routes/returnWorkflowRoutes');
const { createReceipt } = require('../controllers/inventoryController');
const { getInventory, getHistory } = require('../controllers/storeController');
const { processStoreReturn } = require('../controllers/returnWorkflowController');
const { AssetMovement, Inventory } = require('../models');

test('store routes expose a store manager movement history endpoint', () => {
  const historyRoute = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/history' && layer.route.methods.get);

  assert.ok(historyRoute, 'expected /history GET route in the store router');
  assert.equal(historyRoute.route.path, '/history');
});

test('receipt endpoints enforce authentication, Store Manager role, and organization scope', () => {
  for (const method of ['get', 'post']) {
    const route = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/receive' && layer.route.methods[method]);
    assert.ok(route, `expected /receive ${method.toUpperCase()} route`);
    assert.equal(route.route.stack.length, 4);
    assert.match(route.route.stack[2].handle.name, /ensureStoreScope/);

    const roleMiddleware = route.route.stack[1].handle;
    const denied = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
    roleMiddleware({ user: { role: 'admin' } }, denied, () => assert.fail('admin must not pass Store Manager RBAC'));
    assert.equal(denied.statusCode, 403);
    let authorized = false;
    roleMiddleware({ user: { role: 'store_manager' } }, {}, () => { authorized = true; });
    assert.equal(authorized, true);
  }
});

test('Store issue form data routes retain College scope middleware', () => {
  const availableAssets = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/available-assets' && layer.route.methods.get);
  assert.match(availableAssets.route.stack[2].handle.name, /ensureStoreScope/);

  for (const route of [
    assignmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.get),
    assignmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.post),
  ]) {
    assert.ok(route);
    assert.match(route.route.stack[2].handle.name, /resolveAssignmentOrganizationScope/);
  }

  const users = userRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.get);
  const departments = departmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.get);
  assert.match(users.route.stack[2].handle.toString(), /store_manager/);
  assert.match(departments.route.stack[1].handle.toString(), /store_manager/);
});

test('Store return endpoints enforce Store Manager role and College scope', () => {
  const expectedRoutes = [
    ['/store/returns', 'get'],
    ['/store/returns', 'post'],
    ['/store/returns/:id/receive', 'post'],
    ['/store/returns/:id/inspect', 'post'],
  ];

  for (const [path, method] of expectedRoutes) {
    const route = returnWorkflowRoutes.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
    assert.ok(route, `expected ${method.toUpperCase()} ${path}`);
    assert.equal(route.route.stack.length, 4);
    assert.match(route.route.stack[2].handle.name, /resolveCollegeScope/);
  }
});

test('Store transfer endpoints enforce Store Manager role and College scope', () => {
  const expectedRoutes = [
    ['/store/transfers', 'get'],
    ['/store/transfers/:id/ready', 'post'],
    ['/store/transfers/:id/dispatch', 'post'],
    ['/store/transfers/:id/receive', 'post'],
  ];

  for (const [path, method] of expectedRoutes) {
    const route = require('../routes/transferWorkflowRoutes').stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
    assert.ok(route, `expected ${method.toUpperCase()} ${path}`);
    assert.equal(route.route.stack.length, 4);
    assert.match(route.route.stack[2].handle.name, /resolveCollegeScope/);
  }
});

test('Store return writes reject invalid input before opening a database transaction', async (context) => {
  const cases = [
    [{}, 'A valid assigned asset and return location are required'],
    [{ asset_id: 4, location: 'Store', condition: 'Unknown' }, 'A valid returned asset condition is required'],
    [{ asset_id: 4, location: 'Store', reason: 'Unknown' }, 'A valid return reason is required'],
    [{ asset_id: 4, location: 'Store', reason: 'Damage', notes: 'x' }, 'Additional explanation is required for this return reason'],
  ];

  for (const [body, expectedMessage] of cases) {
    await context.test(expectedMessage, async () => {
      const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      await processStoreReturn({ body }, response, (error) => { throw error; });
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.message, expectedMessage);
    });
  }
});

test('receipt writes reject invalid required fields before opening a database transaction', async (context) => {
  const cases = [
    [{}, 'A receiving reference is required'],
    [{ reference: 'GRN-1' }, 'A valid inventory item is required'],
    [{ reference: 'GRN-1', asset_id: 1 }, 'A positive receiving quantity is required'],
    [{ reference: 'GRN-1', asset_id: 1, quantity: 2 }, 'A receiving location is required'],
    [{ reference: 'GRN-1', asset_id: 1, quantity: 2, to_location: 'Store', condition: 'Unknown' }, 'A valid received condition is required'],
  ];

  for (const [body, expectedMessage] of cases) {
    await context.test(expectedMessage, async () => {
      const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      await createReceipt({ body }, response, (error) => { throw error; });
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.message, expectedMessage);
    });
  }
});

test('Store inventory filters remain scoped to the resolved College', async () => {
  const originalFindAndCountAll = Inventory.findAndCountAll;
  const originalFindAll = Inventory.findAll;
  let query;
  let responseBody;
  Inventory.findAndCountAll = async (options) => { query = options; return { rows: [], count: 0 }; };
  Inventory.findAll = async () => [];

  try {
    await getInventory(
      { user: { role: 'store_manager', collegeId: null }, organizationScope: { collegeId: 1 }, query: { condition: 'Damaged', lowStockOnly: 'true' } },
      { json: (body) => { responseBody = body; } },
      (error) => { throw error; }
    );
    assert.deepEqual(query.include[0].where, { collegeId: 1, condition: 'Damaged' });
    assert.ok(query.where[Op.and], 'low-stock filtering must be applied to inventory records');
    assert.ok(Array.isArray(responseBody.data));
    assert.deepEqual(responseBody.filters, { categories: [], locations: [], conditions: [] });
  } finally {
    Inventory.findAndCountAll = originalFindAndCountAll;
    Inventory.findAll = originalFindAll;
  }
});

test('Store history scopes the selected asset to its resolved College', async () => {
  const originalFindAndCountAll = AssetMovement.findAndCountAll;
  const originalFindAll = AssetMovement.findAll;
  let query;
  let responseBody;
  AssetMovement.findAndCountAll = async (options) => { query = options; return { rows: [], count: 0 }; };
  AssetMovement.findAll = async () => [];

  try {
    await getHistory(
      { user: { collegeId: null }, organizationScope: { collegeId: 1 }, query: { assetId: '42' } },
      { json: (body) => { responseBody = body; } },
      (error) => { throw error; }
    );
    assert.deepEqual(query.include[0].where, { collegeId: 1, id: 42 });
    assert.equal(responseBody.data.items.length, 0);
  } finally {
    AssetMovement.findAndCountAll = originalFindAndCountAll;
    AssetMovement.findAll = originalFindAll;
  }
});
