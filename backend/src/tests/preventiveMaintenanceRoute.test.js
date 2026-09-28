const test = require('node:test');
const assert = require('node:assert/strict');
const maintenanceRoutes = require('../routes/maintenanceRoutes');

const preventiveRoutes = {
  list: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive' && layer.route.methods.get),
  detail: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id' && layer.route.methods.get),
  start: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id/start' && layer.route.methods.patch),
};

test('maintenance preventive routes expose the real schedule-backed API surface', () => {
  assert.ok(preventiveRoutes.list, 'expected GET /api/maintenance/preventive route');
  assert.ok(preventiveRoutes.detail, 'expected GET /api/maintenance/preventive/:id route');
  assert.ok(preventiveRoutes.start, 'expected PATCH /api/maintenance/preventive/:id/start route');
  for (const route of Object.values(preventiveRoutes)) {
    assert.ok(route, 'expected preventive maintenance route to be mounted');
    assert.ok(Array.isArray(route.route.stack), 'expected mounted route handlers');
    assert.ok(route.route.stack.length > 0, 'expected at least one handler');
  }
});
