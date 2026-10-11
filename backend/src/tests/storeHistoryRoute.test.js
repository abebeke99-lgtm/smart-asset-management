const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const storeRoutes = require('../routes/storeRoutes');
const assignmentRoutes = require('../routes/assignmentRoutes');
const userRoutes = require('../routes/userRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const departmentRoutes = require('../routes/departmentRoutes');
const returnWorkflowRoutes = require('../routes/returnWorkflowRoutes');
const { createReceipt, createStockAdjustment } = require('../controllers/inventoryController');
const { getInventory, getHistory, getDashboard, getLowStock, updateReorderLevel, getStockAdjustments, getReceipts } = require('../controllers/storeController');
const { processStoreReturn } = require('../controllers/returnWorkflowController');
const { Approval, Asset, Assignment, AssetMovement, AssetReturn, AuditLog, College, Department, Inventory, InventoryTransaction, Maintenance, Transfer, VerificationItem, VerificationSession, sequelize } = require('../models');

test('store routes expose a store manager movement history endpoint', () => {
  const historyRoute = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/history' && layer.route.methods.get);
  const dashboardRoute = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/dashboard' && layer.route.methods.get);

  assert.ok(historyRoute, 'expected /history GET route in the store router');
  assert.equal(historyRoute.route.path, '/history');
  assert.ok(dashboardRoute, 'expected /dashboard GET route in the store router');
  assert.equal(dashboardRoute.route.stack.length, 4);
  assert.match(dashboardRoute.route.stack[2].handle.name, /ensureStoreScope/);
});

test('low-stock route requires authentication and Store Manager role before resolving College scope', () => {
  const route = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/low-stock' && layer.route.methods.get);
  assert.ok(route, 'expected GET /low-stock route');
  assert.equal(route.route.stack[0].handle.name, 'noStore');
  assert.equal(route.route.stack[1].handle.name, 'requireAuth');

  const requireStoreManager = route.route.stack[2].handle;
  for (const [user, expectedStatus] of [[null, 401], [{ role: 'admin' }, 403]]) {
    let responseStatus;
    const response = {
      status(code) { responseStatus = code; return this; },
      json() { return this; },
    };
    requireStoreManager({ user }, response, () => assert.fail('unauthorized user must not reach the handler'));
    assert.equal(responseStatus, expectedStatus);
  }
});

test('profile and notification unread counters opt out of conditional response caching', () => {
  const profileRoute = userRoutes.stack.find((layer) => layer.route && layer.route.path === '/profile' && layer.route.methods.get);
  const unreadRoute = notificationRoutes.stack.find((layer) => layer.route && layer.route.path === '/notifications/unread-count' && layer.route.methods.get);
  const unreadAliasRoute = notificationRoutes.stack.find((layer) => layer.route && layer.route.path === '/notifications/unread/count' && layer.route.methods.get);
  assert.ok(profileRoute);
  assert.ok(unreadRoute);
  assert.ok(unreadAliasRoute);
  assert.equal(profileRoute.route.stack[0].handle.name, 'noStore');
  assert.equal(unreadRoute.route.stack[0].handle.name, 'noStore');
  assert.equal(unreadAliasRoute.route.stack[0].handle.name, 'noStore');
});

test('store dashboard, low-stock, and adjustment routes reject unresolved college scope', async () => {
  const originalFindAll = College.findAll;
  College.findAll = async () => [];
  const routes = [['/dashboard', 'get'], ['/low-stock', 'get'], ['/inventory/:id/reorder-level', 'patch'], ['/stock-adjustments', 'get'], ['/stock-adjustments', 'post']];

  try {
    for (const [path, method] of routes) {
      const route = storeRoutes.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
      assert.ok(route, `expected ${method.toUpperCase()} ${path}`);
      const ensureStoreScope = route.route.stack[path === '/low-stock' ? 3 : 2].handle;
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

test('store adjustment and receipt query errors are logged and returned as message-only 500s', async (t) => {
  const originalFindAndCountAll = InventoryTransaction.findAndCountAll;
  const originalConsoleError = console.error;
  const databaseError = Object.assign(new Error('Unknown inventory column'), {
    name: 'SequelizeDatabaseError',
    original: { code: 'ER_BAD_FIELD_ERROR', sqlMessage: "Unknown column 'missing_column'" },
    sql: 'SELECT missing_column FROM inventory_transactions',
  });
  const logs = [];
  InventoryTransaction.findAndCountAll = async () => { throw databaseError; };
  console.error = (...args) => logs.push(args);
  t.after(() => {
    InventoryTransaction.findAndCountAll = originalFindAndCountAll;
    console.error = originalConsoleError;
  });

  for (const [handler, expectedMessage] of [
    [getStockAdjustments, 'Failed to load stock adjustments'],
    [getReceipts, 'Failed to load receipts'],
  ]) {
    const response = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ organizationScope: { collegeId: 7 }, user: {}, query: {} }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: expectedMessage });
  }

  assert.equal(logs.length, 2);
  assert.deepEqual(logs[0][1], {
    name: 'SequelizeDatabaseError',
    message: 'Unknown inventory column',
    code: 'ER_BAD_FIELD_ERROR',
    sqlMessage: "Unknown column 'missing_column'",
    sql: 'SELECT missing_column FROM inventory_transactions',
  });
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
    const stockCountQueries = queries.filter(({ model, method }) => model === Inventory && method === 'count');
    assert.equal(stockCountQueries.length, 2);
    const outOfStockQuery = stockCountQueries.find(({ options }) => options.where[Op.and]);
    assert.ok(outOfStockQuery);
    assert.equal(outOfStockQuery.options.where[Op.and][0].attribute.col, 'available_quantity');
    assert.equal(outOfStockQuery.options.where[Op.and][1].availableQuantity[Op.lte], 0);
    assert.ok(outOfStockQuery.options.include[0].where[Op.and].some((condition) => condition.attribute.fn === 'LOWER'));
    const aggregateQueries = queries
      .filter(({ model, method }) => model === InventoryTransaction && method === 'findAll')
      .filter(({ options }) => options.attributes.some((attribute) => attribute[1] === 'quantity'));
    assert.equal(aggregateQueries.length, 2);
    for (const { options } of aggregateQueries) {
      const quantitySum = options.attributes.find((attribute) => attribute[1] === 'quantity')[0];
      assert.equal(quantitySum.args[0].col, 'InventoryTransaction.quantity');
      assert.ok(options.group.includes('InventoryTransaction.type'));
    }
    const monthlyAggregate = aggregateQueries.find(({ options }) => options.attributes.some((attribute) => attribute[1] === 'month'));
    const monthFormat = monthlyAggregate.options.attributes.find((attribute) => attribute[1] === 'month')[0];
    assert.equal(monthFormat.args[0].col, 'InventoryTransaction.created_at');
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
    assert.equal(lowStock.data.items[0].reorderLevel, 3);
    assert.equal(lowStock.data.items[0].severity, 'CRITICAL');
    assert.equal(lowStock.data.items[0].available, 1);
    assert.deepEqual(lowStock.data.filters, { categories: ['Own College'], locations: ['Store'] });
    for (const options of inventoryQueries) assert.equal(options.include[0].where.collegeId, 7);
    let stockAdjustments;
    await getStockAdjustments({ organizationScope: { collegeId: 7 }, user: {}, query: {} }, { json(body) { stockAdjustments = body; } }, (error) => { throw error; });
    assert.equal(stockAdjustments.data.items[0].item, 'Own item');
    for (const options of adjustmentQueries) assert.equal(options.include[0].where.collegeId, 7);
  } finally {
    [Inventory.findAndCountAll, Inventory.findAll, InventoryTransaction.findAndCountAll, InventoryTransaction.findAll] = originals;
  }
});

test('low-stock uses the configured default for legacy zero thresholds and reports negative balances', async () => {
  const originals = [Inventory.findAndCountAll, Inventory.findAll];
  const item = {
    id: 5, assetId: 51, quantity: 8, availableQuantity: -1, reservedQuantity: 1, damagedQuantity: 0, minimumQuantity: 0,
    updatedAt: new Date(), Asset: { id: 51, name: 'Gloves', assetCode: 'G-51', category: 'Safety', location: 'Store', status: 'available', condition: 'Good', unit: 'box', collegeId: 7 },
  };
  let listQuery;
  let responseBody;
  Inventory.findAndCountAll = async (options) => { listQuery = options; return { rows: [item], count: 1 }; };
  Inventory.findAll = async () => [item];
  try {
    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query: { severity: 'out_of_stock', sortBy: 'available', sortOrder: 'asc' } },
      { json(body) { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.equal(responseBody.data.items[0].reorderLevel, responseBody.data.defaultReorderLevel);
    assert.equal(responseBody.data.items[0].thresholdSource, 'system_default');
    assert.equal(responseBody.data.items[0].severity, 'OUT_OF_STOCK');
    assert.equal(responseBody.data.items[0].dataIntegrityError, true);
    assert.equal(responseBody.data.summary.dataIntegrityErrors, 1);
    assert.equal(listQuery.order[0][0], 'availableQuantity');
    assert.equal(listQuery.order[0][1], 'ASC');
    assert.ok(listQuery.include[0].where[Op.and]);
    const statusFilter = listQuery.include[0].where[Op.and][0];
    assert.equal(statusFilter.attribute.fn, 'LOWER');
    assert.equal(statusFilter.attribute.args[0].fn, 'REPLACE');
    assert.equal(statusFilter.attribute.args[0].args[0].fn, 'REPLACE');
    assert.ok(statusFilter.logic[Op.notIn].includes('under maintenance'));
  } finally {
    [Inventory.findAndCountAll, Inventory.findAll] = originals;
  }
});

test('low-stock includes balances exactly at threshold and sorts using effective severity and threshold', async () => {
  const originals = [Inventory.findAndCountAll, Inventory.findAll];
  const item = {
    id: 6, assetId: 61, quantity: 10, availableQuantity: 5, reservedQuantity: 2, damagedQuantity: 1, minimumQuantity: 5,
    location: 'Warehouse B', updatedAt: new Date(),
    Asset: { id: 61, name: 'Gloves', assetCode: 'G-61', category: 'Safety', location: '', status: 'available', condition: 'Good', unit: 'box', collegeId: 7 },
  };
  let listQuery;
  let responseBody;
  Inventory.findAndCountAll = async (options) => { listQuery = options; return { rows: [item], count: 1 }; };
  Inventory.findAll = async () => [item];
  try {
    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query: { location: 'Warehouse B', sortBy: 'severity', sortOrder: 'desc' } },
      { json(body) { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.equal(responseBody.data.items[0].available, 5);
    assert.equal(responseBody.data.items[0].reserved, 2);
    assert.equal(responseBody.data.items[0].assigned, 2);
    assert.equal(responseBody.data.items[0].severity, 'LOW');
    assert.deepEqual(responseBody.data.filters.locations, ['Warehouse B']);
    assert.equal(listQuery.where[Op.and][0].attribute.col, 'available_quantity');
    assert.equal(listQuery.order[0][0].val.includes('CASE WHEN available_quantity <= 0'), true);

    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query: { sortBy: 'reorderLevel' } },
      { json(body) { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.match(listQuery.order[0][0].val, /CASE WHEN minimum_quantity > 0 THEN minimum_quantity ELSE/);
  } finally {
    [Inventory.findAndCountAll, Inventory.findAll] = originals;
  }
});

test('low-stock filter choices cover all eligible rows and use the displayed inventory location fallback', async () => {
  const originals = [Inventory.findAndCountAll, Inventory.findAll];
  const rows = [
    {
      id: 8, assetId: 81, quantity: 12, availableQuantity: 4, reservedQuantity: 2, damagedQuantity: 0, minimumQuantity: 5,
      location: 'Warehouse B', Asset: { id: 81, name: 'Gloves', category: 'Equipment', location: '', status: 'available', condition: 'Good', collegeId: 7 },
    },
    {
      id: 9, assetId: 91, quantity: 7, availableQuantity: 2, reservedQuantity: 1, damagedQuantity: 0, minimumQuantity: 4,
      location: 'Main Store', Asset: { id: 91, name: 'Masks', category: 'Supplies', location: 'Main Store', status: 'available', condition: 'Good', collegeId: 7 },
    },
  ];
  let listQuery;
  let responseBody;
  Inventory.findAndCountAll = async (options) => { listQuery = options; return { rows: [rows[0]], count: 1 }; };
  Inventory.findAll = async () => rows;
  try {
    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query: { category: 'Equipment', location: 'Warehouse B' } },
      { json(body) { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.deepEqual(responseBody.data.filters, {
      categories: ['Equipment', 'Supplies'],
      locations: ['Main Store', 'Warehouse B'],
    });
    assert.equal(listQuery.include[0].where.category, 'Equipment');
    assert.equal(listQuery.where[Op.and][1].attribute.fn, 'COALESCE');
  } finally {
    [Inventory.findAndCountAll, Inventory.findAll] = originals;
  }
});

test('low-stock reports invalid balances instead of coercing them to zero', async () => {
  const originals = [Inventory.findAndCountAll, Inventory.findAll];
  const item = {
    id: 7, assetId: 71, quantity: null, availableQuantity: null, reservedQuantity: 0, damagedQuantity: 0, minimumQuantity: 4,
    Asset: { id: 71, name: 'Unknown balance', assetCode: 'U-71', category: 'Safety', location: 'Store', status: 'available', condition: 'Good', collegeId: 7 },
  };
  let responseBody;
  Inventory.findAndCountAll = async () => ({ rows: [item], count: 1 });
  Inventory.findAll = async () => [item];
  try {
    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query: {} },
      { json(body) { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.equal(responseBody.data.items[0].available, null);
    assert.equal(responseBody.data.items[0].onHand, null);
    assert.equal(responseBody.data.items[0].assigned, null);
    assert.equal(responseBody.data.items[0].shortage, null);
    assert.equal(responseBody.data.items[0].severity, 'DATA_ERROR');
    assert.equal(responseBody.data.items[0].dataIntegrityError, true);
    assert.equal(responseBody.data.summary.dataIntegrityErrors, 1);
  } finally {
    [Inventory.findAndCountAll, Inventory.findAll] = originals;
  }
});

test('low-stock rejects invalid pagination and sort selectors', async () => {
  for (const query of [
    { page: '-1' },
    { pageSize: '101' },
    { sortBy: 'createdAt' },
    { sortOrder: 'sideways' },
    { search: 'x'.repeat(101) },
    { category: ['multiple', 'values'] },
  ]) {
    let statusCode;
    let responseBody;
    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query },
      { status(code) { statusCode = code; return this; }, json(body) { responseBody = body; return body; } },
      (error) => { throw error; },
    );
    assert.equal(statusCode, 400);
    assert.equal(responseBody.success, false);
  }
});

test('low-stock database failures are forwarded to the application error handler', async () => {
  const originalFindAll = Inventory.findAll;
  const databaseError = new Error('Inventory database query failed');
  Inventory.findAll = async () => { throw databaseError; };
  try {
    let forwardedError;
    await getLowStock(
      { organizationScope: { collegeId: 7 }, user: {}, query: {} },
      { json() { assert.fail('database failure must not return a success-shaped response'); } },
      (error) => { forwardedError = error; },
    );
    assert.equal(forwardedError, databaseError);
  } finally {
    Inventory.findAll = originalFindAll;
  }
});

test('Store Manager reorder-level writes are college-scoped, transactional, and audited', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    auditCreate: AuditLog.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: null, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  const inventory = { id: 9, assetId: 91, minimumQuantity: 2, Asset: { id: 91, collegeId: 7 }, async update(values) { Object.assign(this, values); } };
  let findOptions;
  let audit;
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async (options) => { findOptions = options; return inventory; };
  AuditLog.create = async (values, options) => { audit = { values, options }; };
  try {
    let responseBody;
    await updateReorderLevel(
      { params: { id: '9' }, body: { reorderLevel: 4 }, organizationScope: { collegeId: 7 }, user: { id: 3 } },
      { status() { return this; }, json(body) { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.equal(responseBody.data.reorderLevel, 4);
    assert.equal(inventory.minimumQuantity, 4);
    assert.equal(transaction.finished, 'commit');
    assert.equal(findOptions.include[0].where.collegeId, 7);
    assert.equal(audit.values.action, 'Inventory Reorder Level Updated');
    assert.equal(audit.options.transaction, transaction);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    AuditLog.create = originals.auditCreate;
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
  assert.equal(availableAssets.route.stack[0].handle.name, 'requireAuth');
  assert.equal(typeof availableAssets.route.stack[1].handle, 'function');
  const denied = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  availableAssets.route.stack[1].handle({ user: { role: 'admin' } }, denied, () => assert.fail('admin must not pass Store Manager RBAC'));
  assert.equal(denied.statusCode, 403);
  assert.match(availableAssets.route.stack[2].handle.name, /ensureStoreScope/);

  for (const route of [
    assignmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.get),
    assignmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.post),
  ]) {
    assert.ok(route);
    const permissionIndex = route.route.stack.findIndex((layer) => layer.handle.name === 'requireDepartmentPermission');
    const scopeIndex = route.route.stack.findIndex((layer) => layer.handle.name === 'resolveAssignmentOrganizationScope');
    assert.ok(permissionIndex >= 0, 'assignment routes must enforce Department Head permissions');
    assert.ok(scopeIndex > permissionIndex, 'assignment routes must resolve organization scope after role permissions');
  }

  const users = userRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.get);
  const departments = departmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.get);
  assert.match(users.route.stack[2].handle.toString(), /store_manager/);
  const departmentRoleGuard = departments.route.stack[1].handle;
  let storeManagerAllowed = false;
  departmentRoleGuard({ user: { role: 'store_manager' } }, {
    status(code) { this.statusCode = code; return this; },
    json() { return this; },
  }, () => { storeManagerAllowed = true; });
  assert.equal(storeManagerAllowed, true, 'Store Managers must pass the department read role guard');
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

test('approved-request fulfillment is protected by the Store Manager assignment route', () => {
  const route = assignmentRoutes.stack.find((layer) => layer.route?.path === '/fulfill-request/:id' && layer.route.methods.post);
  assert.ok(route, 'expected a Store Manager request-fulfillment endpoint');
  assert.equal(route.route.stack.length, 4);
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
  let called = false;
  route.route.stack[1].handle({ user: { role: 'admin' } }, response, () => { called = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(called, false);
});

test('approved-request fulfillment consumes the reserved quantity and records assignment history', async () => {
  const originals = {
    transaction: sequelize.transaction,
    approvalFindByPk: Approval.findByPk,
    inventoryFindOne: Inventory.findOne,
    assetFindOne: Asset.findOne,
    assignmentCreate: Assignment.create,
    inventoryUpdate: Inventory.update,
    assetUpdate: Asset.update,
    inventoryTransactionCreate: InventoryTransaction.create,
    movementCreate: AssetMovement.create,
    auditCreate: AuditLog.create,
  };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const inventory = {
    id: 18,
    availableQuantity: 1,
    reservedQuantity: 3,
    location: 'Main Store',
    async update(values, options) {
      Object.assign(this, values);
      assert.equal(options.transaction, transaction);
    },
  };
  const approval = {
    id: 25,
    assetId: 3,
    departmentId: 12,
    type: 'asset_issue',
    status: 'approved',
    quantity: 2,
    reason: 'Department equipment request',
    fulfilledAt: null,
    Asset: { id: 3, collegeId: 1, serialNumber: null },
    Department: { id: 12, collegeId: 1 },
    async update(values, options) {
      Object.assign(this, values);
      assert.equal(options.transaction, transaction);
    },
  };
  const asset = { id: 3, collegeId: 1, serialNumber: null, location: 'Main Store', condition: 'Good' };
  let assignmentValues;
  let transactionValues;
  let assetUpdateValues;
  sequelize.transaction = async () => transaction;
  Approval.findByPk = async (id, options) => {
    assert.equal(id, '25');
    assert.equal(options.transaction, transaction);
    return approval;
  };
  Inventory.findOne = async () => inventory;
  Asset.findOne = async () => asset;
  Assignment.create = async (values, options) => {
    assignmentValues = values;
    assert.equal(options.transaction, transaction);
    return { id: 73, ...values, toJSON() { return { id: this.id, ...values }; } };
  };
  Asset.update = async (values, options) => {
    assetUpdateValues = values;
    assert.equal(options.transaction, transaction);
  };
  InventoryTransaction.create = async (values, options) => {
    transactionValues = values;
    assert.equal(options.transaction, transaction);
    return { id: 111, ...values };
  };
  AssetMovement.create = async (values, options) => { assert.equal(options.transaction, transaction); return values; };
  AuditLog.create = async (values, options) => { assert.equal(options.transaction, transaction); return values; };

  try {
    const route = assignmentRoutes.stack.find((layer) => layer.route?.path === '/fulfill-request/:id' && layer.route.methods.post);
    const handler = route.route.stack[3].handle;
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({
      params: { id: '25' },
      user: { id: 9, role: 'store_manager' },
      organizationScope: { collegeId: 1 },
    }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 201);
    assert.equal(assignmentValues.approvalId, 25);
    assert.equal(assignmentValues.quantity, 2);
    assert.equal(assignmentValues.assignedToType, 'department');
    assert.equal(inventory.reservedQuantity, 1);
    assert.equal(transactionValues.type, 'issue');
    assert.equal(transactionValues.quantity, 2);
    assert.equal(assetUpdateValues.status, 'available');
    assert.ok(approval.fulfilledAt instanceof Date);
    assert.equal(transaction.finished, 'commit');
  } finally {
    sequelize.transaction = originals.transaction;
    Approval.findByPk = originals.approvalFindByPk;
    Inventory.findOne = originals.inventoryFindOne;
    Asset.findOne = originals.assetFindOne;
    Assignment.create = originals.assignmentCreate;
    Inventory.update = originals.inventoryUpdate;
    Asset.update = originals.assetUpdate;
    InventoryTransaction.create = originals.inventoryTransactionCreate;
    AssetMovement.create = originals.movementCreate;
    AuditLog.create = originals.auditCreate;
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

test('Store return restores the complete quantity from a fulfilled assignment', async () => {
  const originals = {
    transaction: sequelize.transaction,
    assetFindOne: Asset.findOne,
    assetUpdate: Asset.update,
    assignmentFindOne: Assignment.findOne,
    inventoryFindOne: Inventory.findOne,
    assetReturnCreate: AssetReturn.create,
    inventoryTransactionCreate: InventoryTransaction.create,
    movementCreate: AssetMovement.create,
    auditCreate: AuditLog.create,
  };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const assignment = {
    id: 72,
    assetId: 5,
    assignedTo: null,
    quantity: 4,
    async update(values, options) { Object.assign(this, values); this.updateOptions = options; },
  };
  const inventory = {
    id: 18,
    availableQuantity: 1,
    reservedQuantity: 0,
    damagedQuantity: 0,
    location: 'Old Store',
    async update(values, options) { Object.assign(this, values); this.updateOptions = options; },
  };
  let returnValues;
  let transactionValues;
  let assetUpdateValues;
  sequelize.transaction = async () => transaction;
  Asset.findOne = async () => ({
    id: 5,
    collegeId: 1,
    departmentId: 12,
    status: 'assigned',
    condition: 'Good',
    _previousDataValues: { status: 'assigned' },
    async update(values, options) {
      assetUpdateValues = values;
      Object.assign(this, values);
      assert.equal(options.transaction, transaction);
    },
  });
  Assignment.findOne = async () => assignment;
  Inventory.findOne = async () => inventory;
  AssetReturn.create = async (values, options) => {
    returnValues = values;
    assert.equal(options.transaction, transaction);
    return { id: 91, ...values, toJSON() { return { id: this.id, ...values }; } };
  };
  InventoryTransaction.create = async (values, options) => {
    transactionValues = values;
    assert.equal(options.transaction, transaction);
    return { id: 111, ...values };
  };
  AssetMovement.create = async (values, options) => { assert.equal(options.transaction, transaction); return values; };
  AuditLog.create = async (values, options) => { assert.equal(options.transaction, transaction); return values; };

  try {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await processStoreReturn({
      body: { asset_id: 5, location: 'Store Room', return_date: '2026-10-09', condition: 'Good' },
      organizationScope: { collegeId: 1 },
      user: { id: 7, collegeId: 1 },
    }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 201);
    assert.equal(returnValues.quantity, 4);
    assert.equal(inventory.availableQuantity, 5);
    assert.equal(inventory.location, 'Store Room');
    assert.equal(transactionValues.quantity, 4);
    assert.equal(assetUpdateValues.status, 'available');
    assert.equal(transaction.finished, 'commit');
  } finally {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.assetFindOne;
    Asset.update = originals.assetUpdate;
    Assignment.findOne = originals.assignmentFindOne;
    Inventory.findOne = originals.inventoryFindOne;
    AssetReturn.create = originals.assetReturnCreate;
    InventoryTransaction.create = originals.inventoryTransactionCreate;
    AssetMovement.create = originals.movementCreate;
    AuditLog.create = originals.auditCreate;
  }
});

test('receipt writes reject invalid required fields before opening a database transaction', async (context) => {
  const validReceipt = {
    reference: 'GRN-1',
    submission_id: 'stock-1234567890-abc1234',
    asset_id: 1,
    quantity: 2,
    to_location: 'Store',
    received_date: '2026-10-10',
  };
  const cases = [
    [{ ...validReceipt, reference: '' }, 'A receiving reference between 1 and 100 characters is required'],
    [{ ...validReceipt, submission_id: '' }, 'A valid receipt submission ID is required'],
    [{ ...validReceipt, asset_id: 0 }, 'A valid inventory item is required'],
    [{ ...validReceipt, quantity: 0 }, 'A positive receiving quantity is required'],
    [{ ...validReceipt, to_location: '' }, 'A receiving location between 1 and 255 characters is required'],
    [{ ...validReceipt, condition: 'Unknown' }, 'A valid received condition is required'],
    [{ ...validReceipt, received_date: '2026-02-30' }, 'A valid received date is required'],
    [{ ...validReceipt, expiry_date: '2026-10-09', batch_number: 'BATCH-1' }, 'Expiry date cannot be before the received date'],
    [{ ...validReceipt, expiry_date: '2026-10-11' }, 'A batch number is required for stock with an expiry date'],
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
  const originalAssetFindAll = Asset.findAll;
  const originalDepartmentFindAll = Department.findAll;
  let query;
  const movementQueries = [];
  let responseBody;
  AssetMovement.findAndCountAll = async (options) => { query = options; return { rows: [], count: 0 }; };
  AssetMovement.findAll = async (options) => { movementQueries.push(options); return []; };
  Asset.findAll = async () => [];
  Department.findAll = async () => [];

  try {
    await getHistory(
      { user: { collegeId: null }, organizationScope: { collegeId: 1 }, query: { assetId: '42' } },
      { json: (body) => { responseBody = body; } },
      (error) => { throw error; }
    );
    assert.deepEqual(query.include[0].where, { collegeId: 1, id: 42 });
    assert.equal(Object.hasOwn(movementQueries[0].where, 'collegeId'), false);
    assert.deepEqual(movementQueries[0].include[0].where, { collegeId: 1 });
    assert.ok(movementQueries[0].where.createdAt[Op.gte] instanceof Date);
    assert.equal(responseBody.data.items.length, 0);
  } finally {
    AssetMovement.findAndCountAll = originalFindAndCountAll;
    AssetMovement.findAll = originalFindAll;
    Asset.findAll = originalAssetFindAll;
    Department.findAll = originalDepartmentFindAll;
  }
});
