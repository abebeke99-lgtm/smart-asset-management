const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');

test('college maintenance route is scoped to the authenticated college manager and exposes paginated data', () => {
  assert.match(routeSource, /router\.get\('\/maintenance',\s*listCollegeMaintenance\)/);
  assert.match(routeSource, /router\.get\('\/maintenance\/:id',\s*getCollegeMaintenance\)/);
  assert.match(controllerSource, /listCollegeMaintenance/i);
  assert.match(controllerSource, /getCollegeMaintenance/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /pagination\s*:\s*\{[\s\S]*page[\s\S]*limit[\s\S]*total[\s\S]*totalPages/i);
  assert.match(controllerSource, /summary\s*:\s*\{[\s\S]*total\s*:/i);
});

test('college maintenance query enforces real college scope and department filters', () => {
  assert.match(controllerSource, /Department\.findAll\(\s*\{\s*where\s*:\s*\{\s*collegeId\s*[,}]/i);
  assert.match(controllerSource, /if \(departmentId\s*&&\s*departmentIds\.includes\(departmentId\)\)|if \(departmentId\)\s*\{\s*if \(!departmentIds\.includes\(departmentId\)\)/i);
  assert.match(controllerSource, /model:\s*Asset\s*,\s*where\s*:\s*assetWhere\s*,\s*required\s*:\s*true/i);
});
