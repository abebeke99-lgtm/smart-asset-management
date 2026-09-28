const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const routeFile = path.resolve(__dirname, '../routes/maintenanceRoutes.js');
const maintenanceController = require('../controllers/maintenanceController');

test('maintenance reports endpoints are defined and summary reporting function exists', () => {
  assert.ok(typeof maintenanceController.getMaintenanceReportsSummary === 'function', 'expected summary report function');

  const routeSource = fs.readFileSync(routeFile, 'utf8');
  assert.match(routeSource, /router\.get\(['"]\/reports\/summary['"]/, 'expected report summary route');
  assert.match(routeSource, /router\.get\(['"]\/reports\//, 'expected report route');
});
