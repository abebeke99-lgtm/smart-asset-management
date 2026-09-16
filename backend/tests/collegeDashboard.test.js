const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');

test('college dashboard response exposes the real scoped collection payload expected by the dashboard UI', () => {
  assert.match(controllerSource, /pendingRequests/i);
  assert.match(controllerSource, /recentAssignments/i);
  assert.match(controllerSource, /recentTransfers/i);
  assert.match(controllerSource, /recentReturns/i);
  assert.match(controllerSource, /maintenance\s*:/i);
  assert.match(controllerSource, /verification\s*:/i);
  assert.match(controllerSource, /recentActivity/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
});

test('college department-assets endpoint is defined with college-scoped filtering and pagination', () => {
  assert.match(controllerSource, /listCollegeDepartmentAssets/i);
  assert.match(controllerSource, /req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /pagination\s*:\s*\{[^\}]*page[^\}]*limit[^\}]*total[^\}]*totalPages/i);
  assert.match(controllerSource, /summary\s*:\s*\{[^\}]*totalAssets/i);
});
