const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');
const routesSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');

test('college department performance API is defined with college-scoped security checks', () => {
  assert.match(controllerSource, /getCollegeDepartmentPerformance/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /status\s*:\s*String\(req\.query\.status\s*\|\|\s*''\)/i);
  assert.match(controllerSource, /departmentId\s*:\s*Number\(req\.query\.departmentId\)|departmentId\s*\?\s*Number\(req\.query\.departmentId\)/i);
  assert.match(controllerSource, /pagination\s*:\s*\{\s*page\s*:\s*page\s*,\s*limit\s*:\s*limit\s*,\s*total\s*:\s*result\.count|total\s*:\s*result\.count/i);
});

test('college routes expose the department-performance endpoint under the college manager router', () => {
  assert.match(routesSource, /router\.get\(['"]\/department-performance['"],\s*getCollegeDepartmentPerformance/i);
});

test('college department analytics route is protected and scoped to the authenticated college', () => {
  assert.match(controllerSource, /getCollegeDepartmentReports/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
  assert.match(routesSource, /router\.get\(['"]\/analytics\/departments['"],\s*getCollegeDepartmentReports/i);
  assert.match(controllerSource, /summary\s*:\s*\{|department report rows|departmentId/i);
});
