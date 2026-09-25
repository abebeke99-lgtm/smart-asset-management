const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');

test('ICT asset routes are registered without the conflicting duplicate mount', () => {
  assert.doesNotMatch(appSource, /app\.use\('\/api\/ict\/assets',\s*ictAssetRoutes\)/);
  assert.match(routeSource, /router\.get\('\/assets',\s*\.\.\.scopedIctAccess,\s*controller\.listIctAssets\)/);
  assert.match(routeSource, /router\.get\('\/assets\/:id',\s*\.\.\.scopedIctAccess,\s*controller\.getIctAsset\)/);
});
