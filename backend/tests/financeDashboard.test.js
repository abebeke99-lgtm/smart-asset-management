const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/financeRoutes.js'), 'utf8');

test('finance dashboard routes expose dashboard and dashboard filter endpoints for finance authorized access', () => {
  assert.match(routeSource, /router\.get\(['"]\/dashboard['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/dashboard\/filters['"]/i);
  assert.match(routeSource, /financeAccess/i);
});
