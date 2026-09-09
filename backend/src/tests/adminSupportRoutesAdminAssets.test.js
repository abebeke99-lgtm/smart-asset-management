const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminSupportRoutes = require('../routes/adminSupportRoutes');

test('admin support router exposes an admin-protected assets list route', () => {
  const assetRoute = adminSupportRoutes.stack.find((layer) => layer.route && layer.route.path === '/assets' && layer.route.methods.get);

  assert.ok(assetRoute, 'expected /assets GET route in the admin support router');
  assert.equal(assetRoute.route.path, '/assets');
  assert.equal(typeof assetRoute.route.stack[0].handle, 'function');
});

test('admin support assets route contract carries college and location scope query aliases', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/adminSupportRoutes.js'), 'utf8');

  assert.match(routeSource, /collegeId\s*\|\||college_id\s*\|\||collegeId\s*\?\?|college_id\s*\?\?/i, 'expected college scope alias normalization in the admin asset query route');
  assert.match(routeSource, /locationId\s*\|\||location_id\s*\|\||locationId\s*\?\?|location_id\s*\?\?/i, 'expected location scope alias normalization in the admin asset query route');
});

test('admin support router exposes protected RFID scan, assets and device route aliases through the admin surface', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/adminSupportRoutes.js'), 'utf8');

  assert.match(routeSource, /router\.get\('\/rfid\/scans'/, 'expected RFID scans route in the admin support router');
  assert.match(routeSource, /router\.get\('\/rfid\/assets'/, 'expected RFID assets route in the admin support router');
  assert.match(routeSource, /router\.get\('\/rfid\/devices'/, 'expected RFID devices route in the admin support router');
  assert.match(routeSource, /router\.post\('\/rfid\/tags'/, 'expected RFID tag registration route in the admin support router');
});

test('admin support router exposes canonical maintenance cost route aliases through the admin surface', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/adminSupportRoutes.js'), 'utf8');

  assert.match(routeSource, /router\.get\('\/maintenance\/costs'/, 'expected maintenance cost list route in the admin support router');
  assert.match(routeSource, /router\.post\('\/maintenance\/costs'/, 'expected maintenance cost create route in the admin support router');
  assert.match(routeSource, /router\.put\('\/maintenance\/costs\/:id'/, 'expected maintenance cost update route in the admin support router');
});

test('admin support router provides the locations endpoint with an Express next callback in scope', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/adminSupportRoutes.js'), 'utf8');

  assert.match(routeSource, /router\.get\('\/locations', requireAuth, async \(req, res, next\)/, 'expected /locations route to accept next for safe error flow');
});
