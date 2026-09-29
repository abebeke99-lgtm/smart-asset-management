const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');

test('college staff route enforces the read-only permission contract', () => {
  assert.match(routeSource, /router\.get\('\/staff',\s*requirePermission\('college\.staff\.view'\),\s*listCollegeStaff\)/);
  assert.match(routeSource, /router\.get\('\/staff\/:id',\s*requirePermission\('college\.staff\.view'\),\s*getCollegeStaffMember\)/);
});

test('college staff queries scope staff lookups to the authenticated college', () => {
  assert.match(controllerSource, /collegeId:\s*req\.organizationScope\.collegeId/);
  assert.match(controllerSource, /id:\s*req\.params\.id,\s*collegeId:\s*req\.organizationScope\.collegeId/);
  assert.match(controllerSource, /Department\.findOne\(\{\s*where:\s*\{\s*id:\s*departmentId,\s*collegeId\s*\}/);
});
