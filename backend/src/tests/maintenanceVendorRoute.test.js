const test = require('node:test');
const assert = require('node:assert/strict');
const maintenanceRoutes = require('../routes/maintenanceRoutes');

const vendorRoutes = {
  list: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/vendors' && layer.route.methods.get),
  detail: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/vendors/:id' && layer.route.methods.get),
  create: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/vendors' && layer.route.methods.post),
  status: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/vendors/:id/status' && layer.route.methods.patch),
};

test('maintenance vendor routes expose the supplier-backed vendor management API', () => {
  assert.ok(vendorRoutes.list, 'expected GET /api/maintenance/vendors route');
  assert.ok(vendorRoutes.detail, 'expected GET /api/maintenance/vendors/:id route');
  assert.ok(vendorRoutes.create, 'expected POST /api/maintenance/vendors route');
  assert.ok(vendorRoutes.status, 'expected PATCH /api/maintenance/vendors/:id/status route');
  for (const route of Object.values(vendorRoutes)) {
    assert.ok(route, 'expected maintenance vendor route to be mounted');
    assert.ok(Array.isArray(route.route.stack), 'expected mounted route handlers');
    assert.ok(route.route.stack.length > 0, 'expected at least one handler');
  }
});
