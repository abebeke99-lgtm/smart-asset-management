const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');

test('infrastructure asset collection and detail reads require an infrastructure role', () => {
  assert.match(
    routeSource,
    /router\.get\('\/', requireRole\('admin', 'infrastructure'\), getAllInfrastructureAssets\)/,
    'GET / must require the admin or infrastructure role',
  );
  assert.match(
    routeSource,
    /router\.get\('\/:id', requireRole\('admin', 'infrastructure'\), getInfrastructureAsset\)/,
    'GET /:id must require the admin or infrastructure role',
  );
});

test('no infrastructure asset read route is left with authentication only', () => {
  const unguardedReads = routeSource
    .split('\n')
    .filter((line) => /router\.(get|post|put|patch|delete)\('[^']*',\s*(getAllInfrastructureAssets|getInfrastructureAsset)\)/.test(line));
  assert.deepEqual(unguardedReads, []);
});
