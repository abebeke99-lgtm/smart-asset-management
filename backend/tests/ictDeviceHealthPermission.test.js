const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../src/constants/rolePermissions');
const { requirePermission } = require('../src/middlewares/auth');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');

const runPermission = (permission, permissions) => {
  const req = { user: { role: 'ict_officer', permissions } };
  let nextCalled = false;
  let statusCode = null;
  const res = { status(code) { statusCode = code; return { json() {} }; } };
  requirePermission(permission)(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode };
};

test('ict.devicehealth.manage is registered and granted to ICT officers', () => {
  assert.ok(PERMISSIONS.includes('ict.devicehealth.manage'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.ict_officer.includes('ict.devicehealth.manage'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes('ict.devicehealth.manage'));
});

test('device-health writes require the manage permission while reads require view', () => {
  assert.match(routeSource, /router\.get\('\/device-health',\s*\.\.\.scopedIctAccess\('ict\.devicehealth\.view'\),\s*deviceHealthController\.listDeviceHealth\)/);
  assert.match(routeSource, /router\.get\('\/device-health\/:id',\s*\.\.\.scopedIctAccess\('ict\.devicehealth\.view'\),\s*deviceHealthController\.getDeviceHealth\)/);
  assert.match(routeSource, /router\.post\('\/device-health',\s*\.\.\.scopedIctAccess\('ict\.devicehealth\.manage'\),\s*deviceHealthController\.createInspection\)/);
});

test('a view-only ICT officer cannot create a device-health inspection', () => {
  const denied = runPermission('ict.devicehealth.manage', ['ict.devicehealth.view']);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.statusCode, 403);

  const allowed = runPermission('ict.devicehealth.manage', ['ict.devicehealth.view', 'ict.devicehealth.manage']);
  assert.equal(allowed.nextCalled, true);
});
