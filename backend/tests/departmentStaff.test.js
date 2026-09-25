const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/departmentController.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/departmentWorkspaceRoutes.js'), 'utf8');

test('department staff listing is authenticated, department-scoped, and paginated', () => {
  assert.match(routeSource, /router\.use\(\.\.\.requireDepartmentHead, resolveDepartmentScope\)/);
  assert.match(routeSource, /router\.get\('\/staff', listDepartmentStaff\)/);
  assert.match(controllerSource, /departmentId: req\.organizationScope\.departmentId/);
  assert.match(controllerSource, /collegeId = req\.organizationScope\.collegeId/);
  assert.match(controllerSource, /findAndCountAll\(\{ where,.*limit, offset \}/s);
  assert.match(controllerSource, /summary: \{ total, active, inactive \}/);
});

test('department staff search and status filters use real User fields', () => {
  assert.match(controllerSource, /fullName: \{ \[Op\.like\]:/);
  assert.match(controllerSource, /username: \{ \[Op\.like\]:/);
  assert.match(controllerSource, /email: \{ \[Op\.like\]:/);
  assert.match(controllerSource, /phone: \{ \[Op\.like\]:/);
  assert.match(controllerSource, /if \(req\.query\.status === 'active'\) where\.active = true/);
  assert.match(controllerSource, /if \(req\.query\.status === 'inactive'\) where\.active = false/);
});