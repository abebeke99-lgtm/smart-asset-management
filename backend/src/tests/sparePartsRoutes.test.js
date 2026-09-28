const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('maintenance spare parts route is exposed and backed by inventory data', () => {
  const routeSource = read('../routes/maintenanceRoutes.js');
  const controllerSource = read('../controllers/maintenanceController.js');

  assert.match(routeSource, /router\.get\('\/spare-parts'[^\n]*getSpareParts/);
  assert.match(routeSource, /router\.get\('\/spare-parts\/:id'[^\n]*getSparePartDetail/);
  assert.match(controllerSource, /const getSpareParts = async \(req, res, next\)/);
  assert.match(controllerSource, /const getSparePartDetail = async \(req, res, next\)/);
  assert.match(controllerSource, /InventoryTransaction/);
});
