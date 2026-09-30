const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8');

const routes = read('../routes/storeRoutes.js');
const storeController = read('../controllers/storeController.js');
const inventoryController = read('../controllers/inventoryController.js');
const assetController = read('../controllers/assetController.js');
const { InventoryTransaction } = require('../models');
const { getReceipts } = require('../controllers/storeController');
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
