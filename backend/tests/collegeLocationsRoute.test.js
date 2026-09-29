const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const collegeRoutes = require('../src/routes/collegeRoutes');
const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '../src/controllers/collegeController.js'), 'utf8');

test('college router exposes location routes with the required view and manage permissions', () => {
  const viewRoute = collegeRoutes.stack.find((layer) => layer.route && layer.route.path === '/locations' && layer.route.methods.get);
  const detailRoute = collegeRoutes.stack.find((layer) => layer.route && layer.route.path === '/locations/:id' && layer.route.methods.get);
  const createRoute = collegeRoutes.stack.find((layer) => layer.route && layer.route.path === '/locations' && layer.route.methods.post);
  const updateRoute = collegeRoutes.stack.find((layer) => layer.route && layer.route.path === '/locations/:id' && layer.route.methods.put);
  const deleteRoute = collegeRoutes.stack.find((layer) => layer.route && layer.route.path === '/locations/:id' && layer.route.methods.delete);

  assert.ok(viewRoute, 'expected /locations GET route in the college router');
  assert.ok(detailRoute, 'expected /locations/:id GET route in the college router');
  assert.ok(createRoute, 'expected /locations POST route in the college router');
  assert.ok(updateRoute, 'expected /locations/:id PUT route in the college router');
  assert.ok(deleteRoute, 'expected /locations/:id DELETE route in the college router');

  assert.match(routeSource, /requirePermission\('college\.locations\.view'\)/, 'route source should enforce the location view permission');
  assert.match(routeSource, /requirePermission\('college\.locations\.manage'\)/, 'route source should enforce the location manage permission');
  assert.match(controllerSource, /ensureCollegeLocationAccess|buildCollegeLocationTree/, 'controller should use the canonical location hierarchy with scope checks');
});

test('college locations controller uses the canonical campus/building/room hierarchy for college-level location scope', () => {
  assert.match(controllerSource, /buildCollegeLocationTree/, 'expected the college controller to build a college-scoped location tree');
  assert.match(controllerSource, /Campus|Building|Room/, 'expected the college controller to reference the canonical location hierarchy');
  assert.match(controllerSource, /ensureCollegeLocationAccess/, 'expected a college-scope authorization guard for location records');
});
