const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/ictAssetController.js'), 'utf8');

test('ICT asset history routes are authenticated, role-gated, and college-scoped', () => {
  assert.match(routeSource, /router\.get\('\/asset-history', \.\.\.scopedIctAccess\('ict\.history\.view'\), controller\.listIctAssetHistory\)/);
  assert.match(routeSource, /router\.get\('\/asset-history\/asset\/:assetId', \.\.\.scopedIctAccess\('ict\.history\.view'\), controller\.getIctAssetHistoryByAsset\)/);
  assert.match(routeSource, /const scopedIctAccess = \(permission\) => \[/);
  assert.match(routeSource, /requirePermission\(permission\)/);
  assert.match(routeSource, /resolveCollegeScope/);
});

test('ICT asset history reads persisted audit logs with server-side pagination', () => {
  assert.match(controllerSource, /AuditLog\.findAndCountAll/);
  assert.match(controllerSource, /entity: \{ \[Op\.in\]: assetIds\.map/);
  assert.match(controllerSource, /collegeId: req\.organizationScope\.collegeId/);
  assert.match(controllerSource, /totalPages/);
});
