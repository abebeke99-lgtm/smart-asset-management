const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { requirePermission } = require('../src/middlewares/auth');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/userRoutes.js'), 'utf8');

const runPermission = (permission, permissions) => {
  const req = { user: { role: 'admin', permissions } };
  let nextCalled = false;
  let statusCode = null;
  const res = { status(code) { statusCode = code; return { json() {} }; } };
  requirePermission(permission)(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode };
};

test('user update and delete routes require dedicated permissions', () => {
  assert.match(routeSource, /router\.put\('\/:id', requireAuth, requireRole\('admin'\), requirePermission\('users\.update'\), updateUser\)/);
  assert.match(routeSource, /router\.delete\('\/:id', requireAuth, requireRole\('admin'\), requirePermission\('users\.delete'\), deleteUser\)/);
});

test('user create, update and delete permissions are mutually independent', () => {
  const denied = runPermission('users.update', ['users.create']);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.statusCode, 403);

  const allowed = runPermission('users.update', ['users.update']);
  assert.equal(allowed.nextCalled, true);

  const deleteDenied = runPermission('users.delete', ['users.update']);
  assert.equal(deleteDenied.nextCalled, false);
  assert.equal(deleteDenied.statusCode, 403);

  const deleteAllowed = runPermission('users.delete', ['users.delete']);
  assert.equal(deleteAllowed.nextCalled, true);
});
