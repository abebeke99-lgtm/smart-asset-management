const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/workspaceRequestController.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');

test('college manager department requests controller enforces college scope and pagination metadata', () => {
  assert.match(controllerSource, /listCollegeDepartmentRequests/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /pagination\s*:\s*\{\s*page\s*,\s*limit\s*,\s*total\s*:\s*result\.count\s*,\s*totalPages\s*:\s*Math\.ceil\(result\.count\s*\/\s*limit\)/i);
  assert.match(controllerSource, /summary\s*,\s*filters\s*:\s*\{/i);
});

test('college routes expose the department-requests endpoint for college managers', () => {
  assert.match(routeSource, /department-requests/i);
  assert.match(routeSource, /listCollegeDepartmentRequests/i);
});
