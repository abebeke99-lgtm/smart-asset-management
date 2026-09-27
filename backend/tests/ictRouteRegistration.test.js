const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');

test('ICT asset routes are registered without the conflicting duplicate mount', () => {
  assert.doesNotMatch(appSource, /app\.use\('\/api\/ict\/assets',\s*ictAssetRoutes\)/);
  assert.match(appSource, /app\.use\('\/api\/ict',\s*ictAssetRoutes\)/);
  assert.match(routeSource, /router\.get\('\/assets',\s*\.\.\.scopedIctAccess,\s*controller\.listIctAssets\)/);
  assert.match(routeSource, /router\.get\('\/assets\/:id',\s*\.\.\.scopedIctAccess,\s*controller\.getIctAsset\)/);
  assert.match(routeSource, /router\.get\('\/reports',\s*\.\.\.scopedIctAccess,\s*reportController\.getIctReports\)/);
  assert.match(routeSource, /router\.get\('\/reports\/export',\s*\.\.\.scopedIctAccess,\s*reportController\.exportIctReport\)/);
  assert.match(routeSource, /const scopedIctAccess = \[requireAuth, requireRole\('admin', 'ict_officer'\)/);
});
