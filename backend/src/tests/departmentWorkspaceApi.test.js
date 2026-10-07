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
