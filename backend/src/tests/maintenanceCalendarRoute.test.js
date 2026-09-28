const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routesFile = path.join(__dirname, '../routes/maintenanceRoutes.js');
const controllerFile = path.join(__dirname, '../controllers/maintenanceController.js');

const routeSource = fs.readFileSync(routesFile, 'utf8');
const controllerSource = fs.readFileSync(controllerFile, 'utf8');

test('maintenance calendar route is registered on the maintenance API', () => {
  assert.match(routeSource, /router\.get\('\/calendar'/, 'expected calendar route in maintenance router');
});

test('calendar event query logic exists in the maintenance controller', () => {
  assert.match(controllerSource, /getCalendar|calendar.*events|Calendar.*summary/i, 'expected calendar logic in maintenance controller');
});
