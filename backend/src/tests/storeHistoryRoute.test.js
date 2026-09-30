const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const storeRoutes = require('../routes/storeRoutes');
const assignmentRoutes = require('../routes/assignmentRoutes');
const userRoutes = require('../routes/userRoutes');
const departmentRoutes = require('../routes/departmentRoutes');
const returnWorkflowRoutes = require('../routes/returnWorkflowRoutes');
const { createReceipt, createStockAdjustment } = require('../controllers/inventoryController');
const { getInventory, getHistory, getDashboard, getLowStock, getStockAdjustments } = require('../controllers/storeController');
const { processStoreReturn } = require('../controllers/returnWorkflowController');
const { Approval, Asset, AssetMovement, AssetReturn, College, Inventory, InventoryTransaction, Maintenance, Transfer, VerificationItem, VerificationSession, sequelize } = require('../models');

test('store routes expose a store manager movement history endpoint', () => {
  const historyRoute = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/history' && layer.route.methods.get);
  const dashboardRoute = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/dashboard' && layer.route.methods.get);

  assert.ok(historyRoute, 'expected /history GET route in the store router');
  assert.equal(historyRoute.route.path, '/history');
  assert.ok(dashboardRoute, 'expected /dashboard GET route in the store router');
  assert.equal(dashboardRoute.route.stack.length, 4);
  assert.match(dashboardRoute.route.stack[2].handle.name, /ensureStoreScope/);
});

test('store dashboard, low-stock, and adjustment routes reject unresolved college scope', async () => {
  const originalFindAll = College.findAll;
  College.findAll = async () => [];
  const routes = [['/dashboard', 'get'], ['/low-stock', 'get'], ['/stock-adjustments', 'get'], ['/stock-adjustments', 'post']];

  try {
    for (const [path, method] of routes) {
      const route = storeRoutes.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
      assert.ok(route, `expected ${method.toUpperCase()} ${path}`);
      const ensureStoreScope = route.route.stack[2].handle;
      const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await ensureStoreScope({ user: { role: 'store_manager', collegeId: null, college_id: null } }, response, () => assert.fail(`${method.toUpperCase()} ${path} must reject unresolved scope`));
      assert.equal(response.statusCode, 403);
      assert.equal(Object.hasOwn(response.body, 'data'), false);
    }
  } finally {
    College.findAll = originalFindAll;
  }
});

test('store dashboard, low-stock, and adjustment handlers fail closed without college scope', async () => {
  for (const handler of [getDashboard, getLowStock, getStockAdjustments]) {
    let error;
    const response = { status() { return this; }, json() { assert.fail('scope failure must not return data'); } };
    await handler({ user: { collegeId: null, college_id: null }, query: {} }, response, (caught) => { error = caught; });
    assert.equal(error.statusCode, 403);
  }
});

test('store dashboard queries include only assets from the resolved College', async () => {
  const methods = [
    [Inventory, 'findAll'], [Inventory, 'count'], [Approval, 'count'], [AssetReturn, 'count'], [Transfer, 'count'],
    [Maintenance, 'count'], [VerificationItem, 'count'], [InventoryTransaction, 'findAll'], [AssetMovement, 'findAll'],
    [VerificationSession, 'findOne'],
  ];
  const originals = methods.map(([model, method]) => [model, method, model[method]]);
  const queries = [];
  const ownInventory = { quantity: 2, availableQuantity: 1, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 3, status: 'available', Asset: { id: 12, collegeId: 7, status: 'available', category: 'Own College' } };

  try {
    for (const [model, method] of methods) {
      model[method] = async (options) => {
        queries.push({ model, method, options });
        if (model === Inventory && method === 'findAll') return [ownInventory];
        if (model === VerificationSession && method === 'findOne') return null;
        return method === 'findAll' ? [] : 0;
      };
    }
    let responseBody;
    await getDashboard({ organizationScope: { collegeId: 7 }, user: {}, query: {} }, { json(body) { responseBody = body; } }, (error) => { throw error; });
    assert.equal(responseBody.data.kpis.totalInventory, 2);
    for (const { model, options } of queries) {
      if (model === VerificationSession) assert.equal(options.where.collegeId, 7);
      else if (model === VerificationItem) assert.equal(options.include[0].where.collegeId, 7);
      else assert.equal(options.include.find((entry) => entry.model === Asset).where.collegeId, 7);
    }
  } finally {
    for (const [model, method, original] of originals) model[method] = original;
  }
});

test('low-stock and adjustment listings return and query only own-College assets', async () => {
  const originals = [Inventory.findAndCountAll, Inventory.findAll, InventoryTransaction.findAndCountAll, InventoryTransaction.findAll];
  const asset = { id: 12, collegeId: 7, name: 'Own item', assetCode: 'OWN-12', category: 'Own College', location: 'Store', status: 'available', condition: 'Good' };
  const inventory = { id: 1, assetId: 12, quantity: 2, availableQuantity: 1, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 3, updatedAt: new Date(), Asset: asset };
  const adjustment = { id: 3, notes: '{"adjustmentType":"increase"}', createdAt: new Date(), assetId: 12, quantity: 1, reason: 'Correction', Asset: asset, User: { fullName: 'Store Manager' } };
  const inventoryQueries = [];
  const adjustmentQueries = [];
  Inventory.findAndCountAll = async (options) => { inventoryQueries.push(options); return { rows: [inventory], count: 1 }; };
  Inventory.findAll = async (options) => { inventoryQueries.push(options); return [inventory]; };
  InventoryTransaction.findAndCountAll = async (options) => { adjustmentQueries.push(options); return { rows: [adjustment], count: 1 }; };
  InventoryTransaction.findAll = async (options) => { adjustmentQueries.push(options); return [{ quantity: 1, notes: adjustment.notes, createdAt: adjustment.createdAt }]; };

  try {
    let lowStock;
    await getLowStock({ organizationScope: { collegeId: 7 }, user: {}, query: {} }, { json(body) { lowStock = body; } }, (error) => { throw error; });
    assert.equal(lowStock.data.items[0].item, 'Own item');
    for (const options of inventoryQueries) assert.equal(options.include[0].where.collegeId, 7);
    let stockAdjustments;
    await getStockAdjustments({ organizationScope: { collegeId: 7 }, user: {}, query: {} }, { json(body) { stockAdjustments = body; } }, (error) => { throw error; });
    assert.equal(stockAdjustments.data.items[0].item, 'Own item');
    for (const options of adjustmentQueries) assert.equal(options.include[0].where.collegeId, 7);
  } finally {
    [Inventory.findAndCountAll, Inventory.findAll, InventoryTransaction.findAndCountAll, InventoryTransaction.findAll] = originals;
  }
});

test('stock-adjustment writes require and query the resolved College scope', async () => {
  const originalTransaction = sequelize.transaction;
  const originalFindOne = Inventory.findOne;
  let transactionStarted = false;
  let queryOptions;
  sequelize.transaction = async () => { transactionStarted = true; return { LOCK: { UPDATE: 'UPDATE' }, rollback: async () => {} }; };
  Inventory.findOne = async (options) => { queryOptions = options; return null; };

  try {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createStockAdjustment({ user: { role: 'store_manager' }, body: { asset_id: 12, quantity: 1, adjustment_type: 'increase', reason: 'Correction' } }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 403);
    assert.equal(transactionStarted, false);

    const scopedResponse = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createStockAdjustment({ user: { id: 2, role: 'store_manager' }, organizationScope: { collegeId: 7 }, body: { asset_id: 12, quantity: 1, adjustment_type: 'increase', reason: 'Correction' } }, scopedResponse, (error) => { throw error; });
    assert.equal(scopedResponse.statusCode, 404);
    assert.equal(queryOptions.include[0].where.collegeId, 7);
    assert.equal(queryOptions.include[0].required, true);
  } finally {
    sequelize.transaction = originalTransaction;
    Inventory.findOne = originalFindOne;
  }
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
