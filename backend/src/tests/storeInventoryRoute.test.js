const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8');

const routes = read('../routes/storeRoutes.js');
const storeController = read('../controllers/storeController.js');
const inventoryController = read('../controllers/inventoryController.js');
const assetController = read('../controllers/assetController.js');
const { InventoryTransaction, Inventory, AssetMovement, AuditLog, Supplier, sequelize } = require('../models');
const { getReceipts } = require('../controllers/storeController');
const { createReceipt, getReceiptSuppliers } = require('../controllers/inventoryController');
const assetModel = read('../models/Asset.js');
const sync = read('../config/sync.js');
const page = read('../../../frontend/src/components/store/StoreInventory.jsx');

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
});

test('inventory page exposes sorting, both export formats, details, and all stock workflows', () => {
  assert.match(page, /apiClient\.get\('\/api\/store\/inventory\/export'/);
  assert.match(page, /apiClient\.get\(`\/api\/store\/inventory\/\$\{item\.id\}`\)/);
  assert.match(page, /exportInventory\('xlsx'\)/);
  assert.match(page, /exportInventory\('csv'\)/);
  for (const route of ['/store/requests', '/store/receive', '/store/issue', '/store/returns', '/store/transfers', '/store/stock-adjustments']) {
    assert.ok(page.includes(route), `missing inventory action route ${route}`);
  }
  assert.match(page, /navigate\('\/store\/receive\?addStock=true'\)/);
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
        id: 12, notes: JSON.stringify({ reference: 'GRN-12', supplier: 'Test supplier' }), createdAt: new Date('2026-09-30T10:00:00.000Z'),
        assetId: 4, quantity: 2, toLocation: 'Main store',
        Asset: { name: 'Paper', assetCode: 'ST-4', collegeId: 9 },
        User: { fullName: 'Store Operator', username: 'operator' },
      }],
      count: 1,
    };
  };
  InventoryTransaction.sum = async () => { throw new Error('summary query unavailable'); };
  console.error = () => {};

  try {
    await getReceipts(
      { organizationScope: { collegeId: 9 }, user: { id: 3 }, query: { page: '1', pageSize: '25' } },
      { json: (body) => { responseBody = body; } },
      (error) => { throw error; },
    );
    assert.equal(queryOptions.include[0].where.collegeId, 9);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.items[0].receiptNumber, 'GRN-12');
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
    Asset: { id: 22, assetCode: 'P-22', name: 'Printer paper', collegeId: 9, serialNumber: '' },
    update: async (values) => { Object.assign(stored, values); Object.assign(item, values); },
    toJSON: () => ({ id: 8, assetId: 22, quantity: stored.quantity, availableQuantity: stored.availableQuantity, damagedQuantity: stored.damagedQuantity }),
  };
  let responseBody;
  let responseStatus;
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => item;
  Inventory.findByPk = async () => item;
  InventoryTransaction.create = async (values) => { calls.ledger = values; return { id: 77, ...values }; };
  AssetMovement.create = async (values) => { calls.movement = values; };
  AuditLog.create = async (values) => { calls.audit = values; };

  try {
    await createReceipt(
      {
        user: { id: 3, role: 'store_manager', collegeId: 9 },
        organizationScope: { collegeId: 9 },
        body: { asset_id: 22, quantity: 3, unit_price: '', supplier_id: '', condition: 'Good', notes: 'Restock' },
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
    assert.equal(calls.movement.referenceId, 77);
    assert.equal(calls.audit.action, 'STORE_STOCK_ADDED');
    assert.equal(calls.committed, true);
    assert.equal(calls.rolledBack, false);
  } finally {
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.findOne;
    Inventory.findByPk = originals.findByPk;
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
      { user: { id: 3, role: 'store_manager' }, body: { asset_id: 22, quantity: -1 } },
      { status: (status) => { responseStatus = status; return { json: () => {} }; } },
      (error) => { throw error; },
    );
    assert.equal(responseStatus, 400);
  } finally {
    sequelize.transaction = originalTransaction;
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
