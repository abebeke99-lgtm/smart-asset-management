const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/chemicalRoutes.js'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

const REQUIRED = "requireRole('admin', 'store_manager', 'maintenance')";

test('chemical read routes require an authorized role, not authentication alone', () => {
  assert.match(routeSource, new RegExp(`router\\.get\\('/', requireAuth, ${REQUIRED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, listChemicals\\)`));
  assert.match(routeSource, /router\.get\('\/quarantine', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), listQuarantine\)/);
  assert.match(routeSource, /router\.get\('\/transfers', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), listTransfers\)/);
  assert.match(routeSource, /router\.get\('\/waste', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), listHazardousWaste\)/);
  assert.match(routeSource, /router\.get\('\/stock-orders', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), listStockOrders\)/);
  assert.match(routeSource, /router\.get\('\/scan\/:identifier', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), scanChemical\)/);
  assert.match(routeSource, /router\.get\('\/:id', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), getChemical\)/);
  assert.match(routeSource, /router\.get\('\/:id\/documents', requireAuth, requireRole\('admin', 'store_manager', 'maintenance'\), listChemicalDocuments\)/);
});

test('no chemical read route is guarded by authentication only', () => {
  const unguarded = routeSource
    .split('\n')
    .filter((line) => /router\.get\(/.test(line) && !/requireRole\(/.test(line));
  assert.deepEqual(unguarded, []);
});

test('the public /api/chemicals mount relies on the route-level role guards', () => {
  assert.match(appSource, /app\.use\('\/api\/chemicals', chemicalRoutes\)/);
});
