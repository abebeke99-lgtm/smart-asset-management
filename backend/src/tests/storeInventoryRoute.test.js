const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');

const read = (file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8');

const routes = read('../routes/storeRoutes.js');
const storeRouter = require('../routes/storeRoutes');
const storeController = read('../controllers/storeController.js');
const inventoryController = read('../controllers/inventoryController.js');
const assetController = read('../controllers/assetController.js');
const { InventoryTransaction, Inventory, AssetMovement, AuditLog, Supplier, sequelize } = require('../models');
const { getInventory, getReceipts } = require('../controllers/storeController');
const { createReceipt, createStockAddition, getReceiptSuppliers } = require('../controllers/inventoryController');
const assetModel = read('../models/Asset.js');
const inventoryTransactionModel = read('../models/InventoryTransaction.js');
const sync = read('../config/sync.js');
const page = read('../../../frontend/src/components/store/StoreInventory.jsx');
const lowStockPage = read('../../../frontend/src/components/store/StoreLowStock.jsx');

test('store inventory detail and export routes require store role and college scope', () => {
  assert.match(routes, /router\.get\('\/inventory\/export', requireAuth, requireRole\('store_manager'\), ensureStoreScope, exportInventory\)/);
  assert.match(routes, /router\.get\('\/inventory\/:id', requireAuth, requireRole\('store_manager'\), ensureStoreScope, getInventoryDetail\)/);
  assert.match(storeController, /Inventory\.findOne\(\{ where: \{ id: inventoryId \}, include: inventoryIncludes\(storeScope\(req\)\) \}\)/);
});

test('inventory listing uses allowlisted server sorting with stable pagination', () => {
  assert.match(storeController, /const inventorySortFields = \{/);
  assert.match(storeController, /const sortField = inventorySortFields\[req\.query\.sortBy\] \|\| inventorySortFields\.id/);
  assert.match(storeController, /const direction = String\(req\.query\.sortOrder\)\.toLowerCase\(\) === 'desc' \? 'DESC' : 'ASC'/);
  assert.match(storeController, /order, limit: pageSize, offset: \(page - 1\) \* pageSize/);
  assert.match(storeController, /search\.match\(\/\^INV-\(\\d\+\)\$\/i\)/);
});

test('inventory export writes the required audit action after resolving scoped rows', () => {
  assert.match(storeController, /const items = await Inventory\.findAll\(\{ where: inventoryWhere, include: inventoryIncludes\(assetWhere\), order, distinct: true \}\)/);
  assert.match(storeController, /action: 'Inventory Exported'/);
  assert.match(storeController, /entity: 'inventory:export'/);
});

test('inventory spec fields use additive schema changes and serialized assets stay unique units', () => {
  for (const field of ['subcategory', 'unit', 'expiryDate', 'batchLot']) assert.match(assetModel, new RegExp(`${field}:`));
  for (const column of ['subcategory', 'unit', 'expiry_date', 'batch_lot']) assert.match(sync, new RegExp(`${column}: \\{`));
  assert.match(assetController, /if \(serialNumber && quantity !== 1\)/);
  assert.match(assetController, /if \(serialNumber && serialNumber !== String\(asset\.serialNumber/);
  assert.match(inventoryController, /String\(item\.Asset\?\.serialNumber \|\| ''\)\.trim\(\) && next\.quantity > 1/);
  assert.match(inventoryTransactionModel, /referenceKey:.*field: 'reference_key'/);
  assert.match(sync, /inventory_transactions_asset_reference_unique/);
});

test('inventory page exposes sorting, both export formats, details, and all stock workflows', () => {
  assert.match(page, /apiClient\.get\('\/api\/store\/inventory\/export'/);
  assert.match(page, /apiClient\.get\(`\/api\/store\/inventory\/\$\{item\.id\}`\)/);
  assert.match(page, /exportInventory\('xlsx'\)/);
  assert.match(page, /exportInventory\('csv'\)/);
  for (const route of ['/store/requests', '/store/receive', '/store/issue', '/store/returns', '/store/transfers', '/store/stock-adjustments']) {
    assert.ok(page.includes(route), `missing inventory action route ${route}`);
  }
  assert.match(page, /apiClient\.post\('\/api\/store\/stock-additions'/);
  assert.match(page, /onClick=\{openAddStock\}/);
  assert.doesNotMatch(page, /navigate\('\/store\/receive\?addStock=true'\)/);
  assert.match(lowStockPage, /navigate\(`\/store\/inventory\?addStock=true&assetId=\$\{item\.assetId\}`\)/);
});

test('stock addition route is authenticated, Store Manager-only, and College-scoped', () => {
  const route = storeRouter.stack.find((layer) => layer.route && layer.route.path === '/stock-additions' && layer.route.methods.post);
  assert.ok(route, 'expected POST /stock-additions route');
  assert.equal(route.route.stack.length, 4);
  assert.match(route.route.stack[2].handle.name, /ensureStoreScope/);
  const denied = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  route.route.stack[1].handle({ user: { role: 'admin' } }, denied, () => assert.fail('non-store role passed authorization'));
  assert.equal(denied.statusCode, 403);
});

test('receipt records remain available when optional summary aggregation fails', async () => {
  const originalFindAndCountAll = InventoryTransaction.findAndCountAll;
  const originalSum = InventoryTransaction.sum;
  const originalConsoleError = console.error;
  let responseBody;
  let queryOptions;
  InventoryTransaction.findAndCountAll = async (options) => {
    queryOptions = options;
    return {
      rows: [{
        id: 12, notes: JSON.stringify({ reference: 'GRN-12', supplier: 'Test supplier', category: 'Supplies', unit: 'pack', unitPrice: 2.5, totalCost: 5, batchNumber: 'B-12', expiryDate: '2027-09-30' }), createdAt: new Date('2026-09-30T10:00:00.000Z'),
        assetId: 4, quantity: 2, toLocation: 'Main store',
        Asset: { name: 'Paper', assetCode: 'ST-4', category: 'Supplies', unit: 'pack', collegeId: 9 },
        User: { fullName: 'Store Operator', username: 'operator' },
      }],
      count: 1,
    };
  };
  InventoryTransaction.sum = async () => { throw new Error('summary query unavailable'); };
  console.error = () => {};

  try {
    await getReceipts(
      { organizationScope: { collegeId: 9 }, user: { id: 3 }, query: { page: '1', pageSize: '25', search: 'Paper' } },
      { json: (body) => { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.equal(queryOptions.include[0].where.collegeId, 9);
    assert.equal(queryOptions.where[Op.or].length, 5);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.items[0].receiptNumber, 'GRN-12');
    assert.equal(responseBody.data.items[0].category, 'Supplies');
    assert.equal(responseBody.data.items[0].unit, 'pack');
    assert.equal(responseBody.data.items[0].unitPrice, 2.5);
    assert.equal(responseBody.data.items[0].totalCost, 5);
    assert.equal(responseBody.data.items[0].batchNumber, 'B-12');
    assert.equal(responseBody.data.items[0].expiryDate, '2027-09-30');
    assert.equal(responseBody.data.summary.receivedToday, null);
    assert.equal(responseBody.data.summary.receivedThisMonth, null);
  } finally {
    InventoryTransaction.findAndCountAll = originalFindAndCountAll;
    InventoryTransaction.sum = originalSum;
    console.error = originalConsoleError;
  }
});

test('stock receipt accepts optional metadata and atomically increments inventory with ledger and audit records', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    findByPk: Inventory.findByPk,
    transactionFindOne: InventoryTransaction.findOne,
    inventoryTransactionCreate: InventoryTransaction.create,
    assetMovementCreate: AssetMovement.create,
    auditLogCreate: AuditLog.create,
  };
  const stored = { quantity: 5, availableQuantity: 4, damagedQuantity: 1, location: 'Store A' };
  const calls = { committed: false, rolledBack: false, ledger: null, movement: null, audit: null };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => { calls.committed = true; },
    rollback: async () => { calls.rolledBack = true; },
  };
  const item = {
    id: 8,
    assetId: 22,
    departmentId: 4,
    quantity: 5,
    availableQuantity: 4,
    damagedQuantity: 1,
    Asset: { id: 22, assetCode: 'P-22', name: 'Printer paper', category: 'Supplies', unit: 'pack', collegeId: 9, status: 'available', serialNumber: '' },
    update: async (values) => { Object.assign(stored, values); Object.assign(item, values); },
    toJSON: () => ({ id: 8, assetId: 22, quantity: stored.quantity, availableQuantity: stored.availableQuantity, damagedQuantity: stored.damagedQuantity }),
  };
  let responseBody;
  let responseStatus;
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => item;
  Inventory.findByPk = async () => item;
  InventoryTransaction.findOne = async () => null;
  InventoryTransaction.create = async (values) => { calls.ledger = values; return { id: 77, ...values }; };
  AssetMovement.create = async (values) => { calls.movement = values; };
  AuditLog.create = async (values) => { calls.audit = values; };

  try {
    await createReceipt(
      {
        user: { id: 3, role: 'store_manager', collegeId: 9 },
        organizationScope: { collegeId: 9 },
        body: { asset_id: 22, quantity: 3, unit_price: '', supplier_id: '', condition: 'Good', reference: 'GRN-22', received_date: '2026-10-10', batch_number: 'BATCH-22', expiry_date: null, submission_id: 'stock-1234567890-abc1234', to_location: 'Store A', notes: 'Restock' },
      },
      {
        status: (status) => { responseStatus = status; return { json: (body) => { responseBody = body; } }; },
      },
      (error) => { throw error; },
    );

    assert.equal(responseStatus, 201);
    assert.equal(responseBody.success, true);
    assert.equal(stored.quantity, 8);
    assert.equal(stored.availableQuantity, 7);
    assert.equal(calls.ledger.quantity, 3);
    assert.equal(calls.ledger.departmentId, 4);
    assert.equal(JSON.parse(calls.ledger.notes).unitPrice, null);
    assert.equal(JSON.parse(calls.ledger.notes).batchNumber, 'BATCH-22');
    assert.equal(JSON.parse(calls.ledger.notes).unit, 'pack');
    assert.equal(calls.ledger.submissionId, 'stock-1234567890-abc1234');
    assert.equal(calls.movement.referenceId, 77);
    assert.equal(JSON.parse(calls.movement.notes).totalCost, null);
    assert.equal(calls.audit.action, 'STORE_STOCK_ADDED');
    assert.equal(calls.committed, true);
    assert.equal(calls.rolledBack, false);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    Inventory.findByPk = originals.findByPk;
    InventoryTransaction.findOne = originals.transactionFindOne;
    InventoryTransaction.create = originals.inventoryTransactionCreate;
    AssetMovement.create = originals.assetMovementCreate;
    AuditLog.create = originals.auditLogCreate;
  }
});

test('stock receipt rejects invalid quantities before opening a database transaction', async () => {
  const originalTransaction = sequelize.transaction;
  let responseStatus;
  sequelize.transaction = async () => { throw new Error('transaction should not start'); };
  try {
    await createReceipt(
      { user: { id: 3, role: 'store_manager' }, body: { reference: 'GRN-22', to_location: 'Store A', asset_id: 22, quantity: -1 } },
      { status: (status) => { responseStatus = status; return { json: () => {} }; } },
      (error) => { throw error; },
    );
    assert.equal(responseStatus, 400);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('stock addition validates required details before opening a transaction and denies other roles', async () => {
  const originalTransaction = sequelize.transaction;
  let started = false;
  sequelize.transaction = async () => { started = true; throw new Error('transaction should not start'); };
  try {
    const invalidResponse = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createStockAddition({
      user: { id: 3, role: 'store_manager' },
      organizationScope: { collegeId: 9 },
      body: { asset_id: 22, quantity: 1, reference: 'ADD-1', reason: 'Inventory correction', addition_date: '2026-10-10' },
    }, invalidResponse, (error) => { throw error; });
    assert.equal(invalidResponse.statusCode, 400);
    assert.match(invalidResponse.body.message, /submission ID/);

    const deniedResponse = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createStockAddition({ user: { id: 4, role: 'ict_officer' }, body: {} }, deniedResponse, (error) => { throw error; });
    assert.equal(deniedResponse.statusCode, 403);
    const malformedDateResponse = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createStockAddition({
      user: { id: 3, role: 'store_manager' },
      organizationScope: { collegeId: 9 },
      body: { asset_id: 22, quantity: 1, reference: 'ADD-1', reason: 'Inventory correction', addition_date: '2026-02-30', submission_id: 'add-1234567890-abcdef' },
    }, malformedDateResponse, (error) => { throw error; });
    assert.equal(malformedDateResponse.statusCode, 400);
    assert.match(malformedDateResponse.body.message, /valid stock addition date/);
    assert.equal(started, false);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('stock addition atomically updates inventory and records its own idempotent movement and audit history', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    findByPk: Inventory.findByPk,
    transactionFindOne: InventoryTransaction.findOne,
    inventoryTransactionCreate: InventoryTransaction.create,
    assetMovementCreate: AssetMovement.create,
    auditLogCreate: AuditLog.create,
    supplierFindOne: Supplier.findOne,
  };
  const stored = { quantity: 5, availableQuantity: 4, reservedQuantity: 0, damagedQuantity: 1, location: 'Store A' };
  const calls = { committed: false, rollbacks: 0, ledger: null, movement: null, audit: null, updated: false };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => { calls.committed = true; },
    rollback: async () => { calls.rollbacks += 1; },
  };
  const item = {
    id: 8,
    assetId: 22,
    departmentId: 4,
    quantity: 5,
    availableQuantity: 4,
    reservedQuantity: 0,
    damagedQuantity: 1,
    location: 'Store A',
    Asset: { id: 22, assetCode: 'P-22', name: 'Printer paper', category: 'Supplies', unit: 'pack', collegeId: 9, status: 'available', serialNumber: '' },
    update: async (values) => { calls.updated = true; Object.assign(stored, values); Object.assign(item, values); },
    toJSON: () => ({ id: 8, assetId: 22, quantity: stored.quantity, availableQuantity: stored.availableQuantity, reservedQuantity: stored.reservedQuantity, damagedQuantity: stored.damagedQuantity, location: stored.location }),
  };
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => item;
  Inventory.findByPk = async () => item;
  InventoryTransaction.findOne = async (options) => {
    if (options.where.submissionId === 'add-1234567890-abcdef') return calls.ledger ? { id: 77, ...calls.ledger } : null;
    return null;
  };
  InventoryTransaction.create = async (values) => { calls.ledger = values; return { id: 77, ...values }; };
  AssetMovement.create = async (values) => { calls.movement = values; };
  AuditLog.create = async (values) => { calls.audit = values; };
  Supplier.findOne = async (options) => {
    assert.deepEqual(options.where, { id: 5, status: 'active' });
    return { id: 5, supplierName: 'Campus Supplies' };
  };

  try {
    const request = {
      user: { id: 3, role: 'store_manager', collegeId: 9 },
      organizationScope: { collegeId: 9 },
      body: {
        asset_id: 22, quantity: 3, unit_price: '12.50', supplier_id: '5',
        reference: 'ADD-REF-22', addition_date: '2026-10-10',
        reason: 'Verified opening stock', submission_id: 'add-1234567890-abcdef',
      },
    };
    const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
    const response = makeResponse();
    await createStockAddition(request, response, (error) => { throw error; });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.success, true);
    assert.equal(stored.quantity, 8);
    assert.equal(stored.availableQuantity, 7);
    assert.equal(calls.ledger.type, 'adjustment');
    assert.equal(calls.ledger.quantity, 3);
    assert.equal(calls.ledger.reason, 'Verified opening stock');
    assert.equal(calls.ledger.submissionId, 'add-1234567890-abcdef');
    assert.equal(calls.ledger.referenceKey, 'add-ref-22');
    const details = JSON.parse(calls.ledger.notes);
    assert.equal(details.operation, 'stock_addition');
    assert.equal(details.additionDate, '2026-10-10');
    assert.equal(details.supplier, 'Campus Supplies');
    assert.equal(details.totalCost, 37.5);
    assert.equal(calls.movement.movementType, 'stock_added');
    assert.equal(calls.movement.sourceType, 'store');
    assert.equal(calls.audit.action, 'STORE_STOCK_ADDED');
    assert.equal(calls.committed, true);

    const duplicateResponse = makeResponse();
    await createStockAddition(request, duplicateResponse, (error) => { throw error; });
    assert.equal(duplicateResponse.statusCode, 200);
    assert.equal(duplicateResponse.body.duplicate, true);
    assert.equal(calls.updated, true);
    assert.equal(calls.rollbacks, 1);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    Inventory.findByPk = originals.findByPk;
    InventoryTransaction.findOne = originals.transactionFindOne;
    InventoryTransaction.create = originals.inventoryTransactionCreate;
    AssetMovement.create = originals.assetMovementCreate;
    AuditLog.create = originals.auditLogCreate;
    Supplier.findOne = originals.supplierFindOne;
  }
});

test('stock addition rejects a reference already used by either stock workflow for the same asset', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    transactionFindOne: InventoryTransaction.findOne,
  };
  let rollbacks = 0;
  let updated = false;
  sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, rollback: async () => { rollbacks += 1; } });
  Inventory.findOne = async () => ({
    id: 8,
    assetId: 22,
    quantity: 5,
    availableQuantity: 4,
    reservedQuantity: 0,
    damagedQuantity: 1,
    Asset: { id: 22, collegeId: 9, status: 'available', serialNumber: '' },
    update: async () => { updated = true; },
  });
  InventoryTransaction.findOne = async ({ where }) => where.submissionId
    ? null
    : { id: 91, type: 'receive', referenceKey: 'add-ref-22' };

  try {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createStockAddition({
      user: { id: 3, role: 'store_manager', collegeId: 9 },
      organizationScope: { collegeId: 9 },
      body: {
        asset_id: 22, quantity: 3, reference: 'ADD-REF-22', addition_date: '2026-10-10',
        reason: 'Verified opening stock', submission_id: 'add-1234567890-abcdef',
      },
    }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /reference has already been used/);
    assert.equal(rollbacks, 1);
    assert.equal(updated, false);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    InventoryTransaction.findOne = originals.transactionFindOne;
  }
});

test('stock addition history failure rolls back the inventory update and ledger transaction', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    findByPk: Inventory.findByPk,
    transactionFindOne: InventoryTransaction.findOne,
    inventoryTransactionCreate: InventoryTransaction.create,
    assetMovementCreate: AssetMovement.create,
  };
  const calls = { committed: false, rolledBack: false, updated: false };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => { calls.committed = true; },
    rollback: async () => { calls.rolledBack = true; },
  };
  const item = {
    id: 8,
    assetId: 22,
    quantity: 5,
    availableQuantity: 4,
    reservedQuantity: 0,
    damagedQuantity: 1,
    location: 'Store A',
    Asset: { id: 22, collegeId: 9, status: 'available', serialNumber: '' },
    update: async () => { calls.updated = true; },
  };
  const failure = new Error('movement write failed');
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => item;
  Inventory.findByPk = async () => item;
  InventoryTransaction.findOne = async () => null;
  InventoryTransaction.create = async () => ({ id: 77 });
  AssetMovement.create = async () => { throw failure; };

  try {
    let forwarded;
    await createStockAddition({
      user: { id: 3, role: 'store_manager', collegeId: 9 },
      organizationScope: { collegeId: 9 },
      body: {
        asset_id: 22, quantity: 3, reference: 'ADD-REF-23', addition_date: '2026-10-10',
        reason: 'Verified opening stock', submission_id: 'add-1234567890-abcdef',
      },
    }, { status() { return this; }, json() { assert.fail('failed movement must not return success'); } }, (error) => { forwarded = error; });

    assert.equal(forwarded, failure);
    assert.equal(calls.updated, true);
    assert.equal(calls.rolledBack, true);
    assert.equal(calls.committed, false);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    Inventory.findByPk = originals.findByPk;
    InventoryTransaction.findOne = originals.transactionFindOne;
    InventoryTransaction.create = originals.inventoryTransactionCreate;
    AssetMovement.create = originals.assetMovementCreate;
  }
});

test('duplicate stock receipt submission rolls back without incrementing stock again', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    transactionFindOne: InventoryTransaction.findOne,
  };
  const calls = { rolledBack: false, updated: false };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    rollback: async () => { calls.rolledBack = true; },
  };
  const item = {
    id: 8,
    assetId: 22,
    quantity: 5,
    availableQuantity: 4,
    reservedQuantity: 0,
    damagedQuantity: 1,
    location: 'Store A',
    Asset: { id: 22, collegeId: 9, status: 'available', assetCode: 'P-22', name: 'Printer paper' },
    update: async () => { calls.updated = true; },
    toJSON: () => ({ id: 8, assetId: 22, quantity: 5, availableQuantity: 4, reservedQuantity: 0, damagedQuantity: 1, location: 'Store A' }),
  };
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => item;
  InventoryTransaction.findOne = async () => ({ id: 77, submissionId: 'stock-1234567890-abc1234' });

  try {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await createReceipt({
      user: { id: 3, role: 'store_manager', collegeId: 9 },
      organizationScope: { collegeId: 9 },
      body: { asset_id: 22, quantity: 3, reference: 'GRN-22', received_date: '2026-10-10', submission_id: 'stock-1234567890-abc1234', to_location: 'Store A' },
    }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.duplicate, true);
    assert.equal(response.body.inventory.quantity, 5);
    assert.equal(calls.rolledBack, true);
    assert.equal(calls.updated, false);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    InventoryTransaction.findOne = originals.transactionFindOne;
  }
});

test('receipt history failure rolls back the inventory transaction and does not return success', async () => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: Inventory.findOne,
    findByPk: Inventory.findByPk,
    transactionFindOne: InventoryTransaction.findOne,
    inventoryTransactionCreate: InventoryTransaction.create,
    assetMovementCreate: AssetMovement.create,
  };
  const calls = { committed: false, rolledBack: false };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => { calls.committed = true; },
    rollback: async () => { calls.rolledBack = true; },
  };
  const item = {
    id: 8,
    assetId: 22,
    quantity: 5,
    availableQuantity: 4,
    reservedQuantity: 0,
    damagedQuantity: 1,
    location: 'Store A',
    Asset: { id: 22, collegeId: 9, status: 'available', assetCode: 'P-22', name: 'Printer paper' },
    update: async () => {},
    toJSON: () => ({ id: 8, assetId: 22, quantity: 5, availableQuantity: 4, reservedQuantity: 0, damagedQuantity: 1, location: 'Store A' }),
  };
  const failure = new Error('movement write failed');
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => item;
  Inventory.findByPk = async () => item;
  InventoryTransaction.findOne = async () => null;
  InventoryTransaction.create = async () => ({ id: 77 });
  AssetMovement.create = async () => { throw failure; };

  try {
    let forwarded;
    await createReceipt({
      user: { id: 3, role: 'store_manager', collegeId: 9 },
      organizationScope: { collegeId: 9 },
      body: { asset_id: 22, quantity: 3, reference: 'GRN-22', received_date: '2026-10-10', submission_id: 'stock-1234567890-abc1234', to_location: 'Store A' },
    }, { status() { return this; }, json() { assert.fail('failed history write must not return a success response'); } }, (error) => { forwarded = error; });

    assert.equal(forwarded, failure);
    assert.equal(calls.rolledBack, true);
    assert.equal(calls.committed, false);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    Inventory.findByPk = originals.findByPk;
    InventoryTransaction.findOne = originals.transactionFindOne;
    InventoryTransaction.create = originals.inventoryTransactionCreate;
    AssetMovement.create = originals.assetMovementCreate;
  }
});

test('supplier choices are loaded from active database records behind the scoped store route', async () => {
  const originalFindAll = Supplier.findAll;
  let options;
  let responseBody;
  Supplier.findAll = async (queryOptions) => {
    options = queryOptions;
    return [{ id: 5, supplierCode: 'SUP-5', supplierName: 'Campus Supplies' }];
  };
  try {
    await getReceiptSuppliers({}, { json: (body) => { responseBody = body; } }, (error) => { throw error; });
    assert.deepEqual(options.where, { status: 'active' });
    assert.deepEqual(options.attributes, ['id', 'supplierCode', 'supplierName']);
    assert.equal(responseBody.data[0].supplierName, 'Campus Supplies');
    assert.match(routes, /router\.get\('\/receive\/suppliers', requireAuth, requireRole\('store_manager'\), ensureStoreScope, getReceiptSuppliers\)/);
  } finally {
    Supplier.findAll = originalFindAll;
  }
});

test('inventory summary reports consistent normal, low, and critical item counts', async () => {
  const originals = {
    findAndCountAll: Inventory.findAndCountAll,
    findAll: Inventory.findAll,
  };
  let queryOptions;
  let responseBody;
  Inventory.findAndCountAll = async () => ({ rows: [], count: 3 });
  Inventory.findAll = async (options) => {
    queryOptions = options;
    return [
      { quantity: 5, availableQuantity: 5, minimumQuantity: 2, reservedQuantity: 0, damagedQuantity: 0, Asset: { status: 'available' } },
      { quantity: 3, availableQuantity: 1, minimumQuantity: 2, reservedQuantity: 0, damagedQuantity: 0, Asset: { status: 'available' } },
      { quantity: 2, availableQuantity: 0, minimumQuantity: 0, reservedQuantity: 0, damagedQuantity: 0, Asset: { status: 'available' } },
    ];
  };

  try {
    await getInventory(
      {
        organizationScope: { collegeId: 9 },
        user: { id: 3, role: 'store_manager', collegeId: 9 },
        query: { location: 'Main Store' },
      },
      { json: (body) => { responseBody = body; } },
      (error) => { throw error; },
    );

    assert.equal(queryOptions.where[Op.or][0].location, 'Main Store');
    assert.equal(queryOptions.where[Op.or][1].attribute.col, 'Asset.location');
    assert.equal(responseBody.summary.normalStock, 1);
    assert.equal(responseBody.summary.lowStock, 2);
    assert.equal(responseBody.summary.criticalStock, 1);
  } finally {
    Inventory.findAndCountAll = originals.findAndCountAll;
    Inventory.findAll = originals.findAll;
  }
});
