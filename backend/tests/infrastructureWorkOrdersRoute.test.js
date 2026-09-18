const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/infrastructureController.js'), 'utf8');

test('infrastructure work-order routes are authenticated and infrastructure-scoped', () => {
  assert.match(routeSource, /router\.use\(requireAuth\)/);
  assert.match(routeSource, /router\.get\('\/work-orders', requireRole\('admin', 'infrastructure'\)/);
  assert.match(routeSource, /router\.post\('\/work-orders', requireRole\('admin', 'infrastructure'\)/);
  assert.match(routeSource, /router\.patch\('\/work-orders\/:id\/status', requireRole\('admin', 'infrastructure'\)/);
});

test('infrastructure work-order controller uses server-side pagination, scope, and transitions', () => {
  assert.match(controllerSource, /MaintenanceWorkOrder\.findAndCountAll/);
  assert.match(controllerSource, /pagination: \{ page, limit, total: count, pages/);
  assert.match(controllerSource, /infrastructureAssetWhere/);
  assert.match(controllerSource, /workOrderStatusTransitions/);
  assert.match(controllerSource, /AuditLog\.create/);
});
