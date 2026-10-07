const test = require('node:test');
const assert = require('node:assert/strict');
const maintenanceRoutes = require('../routes/maintenanceRoutes');

test('maintenance request list route uses the existing authenticated listing handler', () => {
  const getRoute = (path) => maintenanceRoutes.stack.find((layer) => (
    layer.route
    && layer.route.path === path
    && layer.route.methods.get
  ));

  const maintenanceListRoute = getRoute('/');
  const requestListRoute = getRoute('/requests');

  assert.ok(maintenanceListRoute, 'expected existing maintenance list route');
  assert.ok(requestListRoute, 'expected maintenance requests list route');
  assert.deepEqual(
    requestListRoute.route.stack.map((layer) => layer.handle),
    maintenanceListRoute.route.stack.map((layer) => layer.handle),
    'the alias must retain the existing authentication, role, and listing behavior'
  );
});
