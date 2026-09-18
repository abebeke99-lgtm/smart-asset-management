const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');

test('infrastructure tracking routes expose authenticated scan and lookup endpoints', () => {
  assert.match(routeSource, /router\.get\('\/tracking'/);
  assert.match(routeSource, /router\.post\('\/tracking\/scan'/);
  assert.match(routeSource, /requireRole\('admin', 'infrastructure'\)/);
});
