const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/infrastructureController.js'), 'utf8');

test('infrastructure fuel routes are authenticated and infrastructure-scoped', () => {
  assert.match(routeSource, /router\.use\(requireAuth\)/);
  assert.match(routeSource, /router\.get\('\/fuel', requireRole\('admin', 'infrastructure'\), getInfrastructureFuel\)/);
  assert.match(routeSource, /router\.get\('\/fuel\/summary', requireRole\('admin', 'infrastructure'\), getInfrastructureFuelSummary\)/);
});

test('infrastructure fuel controller uses the real infrastructure model and server-side pagination', () => {
  assert.match(controllerSource, /const getInfrastructureFuel = async \(req, res\)/);
  assert.match(controllerSource, /Infrastructure\.findAndCountAll/);
  assert.match(controllerSource, /pagination: \{ page, limit, total: count, pages: Math.max\(1, Math\.ceil\(count \/ limit\)\) \}/);
  assert.match(controllerSource, /summary: \{/);
  assert.match(controllerSource, /AuditLog\.create/);
});
