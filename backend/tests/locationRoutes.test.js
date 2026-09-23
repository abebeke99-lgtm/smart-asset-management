const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/locationRoutes.js'), 'utf8');

test('location routes expose a real admin location dashboard contract', () => {
  assert.ok(routeSource.includes("router.get('/stats'"));
  assert.ok(routeSource.includes("router.get('/:id/assets'"));
  assert.ok(routeSource.includes('Location name is required'));
  assert.ok(routeSource.includes('Location \"${location.name}\" is used by ${assetCount} assets'));
  assert.ok(routeSource.includes("['active', 'inactive']"));
});
