const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../src/constants/rolePermissions');
const { requirePermission } = require('../src/middlewares/auth');
const collegeRoutes = require('../src/routes/collegeRoutes');

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');

const findRoute = (method, routePath) => collegeRoutes.stack.find(
  (layer) => layer.route && layer.route.path === routePath && layer.route.methods[method],
);

const runPermission = (permission, permissions) => {
  const req = { user: { role: 'college_manager', active: true, permissions } };
  let nextCalled = false;
  let statusCode = null;
  const res = { status(code) { statusCode = code; return { json() { return { code }; } }; } };
  const result = requirePermission(permission)(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, result };
};

test('college.departments.manage is a registered permission granted to college managers', () => {
  assert.ok(PERMISSIONS.includes('college.departments.manage'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.departments.manage'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes('college.departments.manage'));
});

test('department write routes require the manage permission while reads require view', () => {
  assert.ok(findRoute('post', '/departments'), 'expected POST /departments');
  assert.ok(findRoute('put', '/departments/:id'), 'expected PUT /departments/:id');
  assert.ok(findRoute('patch', '/departments/:id/status'), 'expected PATCH /departments/:id/status');
  assert.ok(findRoute('delete', '/departments/:id'), 'expected DELETE /departments/:id');

  assert.match(routeSource, /router\.post\('\/departments', requirePermission\('college\.departments\.manage'\)/);
  assert.match(routeSource, /router\.put\('\/departments\/:id', requirePermission\('college\.departments\.manage'\)/);
  assert.match(routeSource, /router\.patch\('\/departments\/:id\/status', requirePermission\('college\.departments\.manage'\)/);
  assert.match(routeSource, /router\.delete\('\/departments\/:id', requirePermission\('college\.departments\.manage'\)/);
  assert.match(routeSource, /router\.get\('\/departments', requirePermission\('college\.departments\.view'\)/);
});

test('a view-only college manager cannot manage departments', () => {
  const denied = runPermission('college.departments.manage', ['college.departments.view']);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.statusCode, 403);

  const allowed = runPermission('college.departments.manage', ['college.departments.view', 'college.departments.manage']);
  assert.equal(allowed.nextCalled, true);
});
