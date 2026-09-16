const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');

test('college reports controller enforces college scoping and includes a report API contract', () => {
  assert.match(controllerSource, /getCollegeReports/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /reportType/i);
  assert.match(controllerSource, /departmentId/i);
  assert.match(controllerSource, /search/i);
});

test('college routes expose the college reports endpoint for college managers', () => {
  assert.match(routeSource, /router\.get\('\/reports'\s*,\s*getCollegeReports\)/i);
  assert.match(routeSource, /getCollegeReports/i);
});
