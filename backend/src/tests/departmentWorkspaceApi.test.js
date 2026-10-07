const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/departmentWorkspaceRoutes');

const routePaths = router.stack
  .filter((layer) => layer.route)
  .map((layer) => layer.route.path);

test('department-head API exposes its primary workflow, report, tracking, and analytics endpoints', () => {
  for (const path of [
    '/profile',
    '/staff',
    '/locations',
    '/laboratories',
    '/assets',
    '/inventory',
    '/requests',
    '/approvals',
    '/assignments',
    '/transfers',
    '/returns',
    '/verification',
    '/service-requests',
    '/maintenance',
    '/history',
    '/tickets',
    '/escalated-tickets',
    '/tracking/scan/:identifier',
    '/asset-history',
    '/reports',
    '/reports/assets',
    '/reports/maintenance',
    '/reports/inventory',
    '/reports/assignments',
    '/reports/transfers',
    '/reports/verification',
    '/reports/escalations',
    '/analytics',
    '/analytics/assets',
    '/analytics/inventory',
    '/analytics/approvals',
    '/analytics/service',
    '/analytics/ticket-aging',
    '/dashboard/kpis',
    '/tracking/:id/verify-location',
    '/tracking/:id/verify-assignment',
    '/notifications',
  ]) {
    assert.ok(
      routePaths.includes(path) || router.stack.some((layer) => layer.regexp?.test(path)),
      `Expected a department-head route for ${path}`,
    );
  }
});

test('department-head API middleware is installed before protected route handlers', () => {
  assert.equal(router.stack[0].handle.name, 'requireAuth');
  assert.match(router.stack[1].handle.toString(), /Access denied for this role/);
  assert.equal(router.stack[2].handle.name, 'resolveDepartmentScope');
});

test('department reports require Department Head auth and scope but not optional report or asset permissions', () => {
  const dashboardIndex = router.stack.findIndex((layer) => layer.route?.path === '/dashboard' && layer.route.methods.get);
  const reportIndexes = [];
  assert.ok(dashboardIndex >= 0, 'Expected the protected department dashboard route');

  for (const path of ['/reports', '/reports/assets', '/reports/maintenance', '/reports/inventory', '/reports/assignments', '/reports/transfers', '/reports/verification', '/reports/escalations']) {
    const routeIndex = router.stack.findIndex((layer) => layer.route?.path === path && layer.route.methods.get);
    assert.ok(routeIndex >= 0, `Expected ${path} route`);
    assert.ok(routeIndex < dashboardIndex, `${path} must be registered before the shared asset permission gate`);
    assert.equal(router.stack[routeIndex].route.stack.length, 1, `${path} must not require optional per-role report permissions`);
    reportIndexes.push(routeIndex);
  }

  const assetPermissionGateIndex = router.stack.findIndex((layer, index) =>
    index > Math.max(...reportIndexes) && index < dashboardIndex && !layer.route
  );
  assert.ok(assetPermissionGateIndex >= 0, 'Expected the shared asset permission gate');
});

test('department maintenance routes require Department Head auth and scope but not optional permissions', () => {
  const dashboardIndex = router.stack.findIndex((layer) => layer.route?.path === '/dashboard' && layer.route.methods.get);
  assert.ok(dashboardIndex >= 0, 'Expected the protected department dashboard route');

  for (const [path, method, handler] of [
    ['/maintenance', 'get', 'getOversightList'],
    ['/maintenance', 'post', 'createRequest'],
    ['/maintenance/:id', 'get', 'getOversightDetail'],
    ['/maintenance/:id/cancel', 'post', 'cancelRequest'],
  ]) {
    const routeIndex = router.stack.findIndex((layer) => layer.route?.path === path && layer.route.methods[method]);
    const route = router.stack[routeIndex]?.route;
    assert.ok(route, `Expected ${method.toUpperCase()} ${path}`);
    assert.ok(routeIndex < dashboardIndex, `${method.toUpperCase()} ${path} must be registered before the shared asset permission gate`);
    assert.equal(route.stack.length, 1, `${method.toUpperCase()} ${path} must not require optional per-role permissions`);
    assert.equal(route.stack[0].handle.name, handler);
  }
});

test('department activity history requires Department Head auth and scope but not optional permissions', () => {
  const routeIndex = router.stack.findIndex((layer) => layer.route?.path === '/history' && layer.route.methods.get);
  const route = router.stack[routeIndex]?.route;
  const dashboardIndex = router.stack.findIndex((layer) => layer.route?.path === '/dashboard' && layer.route.methods.get);

  assert.ok(route, 'Expected GET /history');
  assert.ok(routeIndex < dashboardIndex, 'Activity history must be registered before the shared assets.view gate');
  assert.equal(route.stack.length, 1, 'Activity history must not require optional per-role permissions');
  assert.equal(route.stack[0].handle.name, 'getDepartmentHistory');
});
