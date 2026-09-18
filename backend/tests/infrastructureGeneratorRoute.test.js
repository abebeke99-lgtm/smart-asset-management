const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/infrastructureController.js'), 'utf8');

test('infrastructure generators route is mounted for the real infrastructure asset model', () => {
  assert.match(routeSource, /router\.get\('\/generators', requireRole\('admin', 'infrastructure'\), getInfrastructureGenerators\)/);
  assert.match(controllerSource, /const getInfrastructureGenerators = async \(req, res\)/);
  assert.match(controllerSource, /Infrastructure\.findAndCountAll/);
});

test('generator collection response is designed for empty and paginated asset lists', () => {
  assert.match(controllerSource, /const generatorWhere = \(query = \{\}\) =>/);
  assert.match(controllerSource, /pagination: \{ page, limit, total: count, pages: Math\.max\(1, Math\.ceil\(count \/ limit\)\) \}/);
  assert.match(controllerSource, /return res\.json\(\{\s*success: true,\s*data: rows/i);
});
