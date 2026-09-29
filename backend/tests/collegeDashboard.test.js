const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');

test('college dashboard response exposes the real scoped collection payload expected by the dashboard UI', () => {
  const dashboardBlock = controllerSource.match(/const getCollegeDashboard[\s\S]*?res\.json\(\{\s*success:\s*true,\s*data:\s*responseData\s*\}\);/i)?.[0] || '';

  assert.match(dashboardBlock, /pendingRequests/i);
  assert.match(dashboardBlock, /recentAssignments/i);
  assert.match(dashboardBlock, /recentTransfers/i);
  assert.match(dashboardBlock, /recentReturns/i);
  assert.match(dashboardBlock, /maintenance\s*:/i);
  assert.match(dashboardBlock, /verification\s*:/i);
  assert.match(dashboardBlock, /recentActivity/i);
  assert.match(dashboardBlock, /activeAssets/i);
  assert.match(dashboardBlock, /damaged|conditionDistribution/i);
  assert.match(dashboardBlock, /underMaintenance|under_maintenance/i);
  assert.match(dashboardBlock, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
});

test('college department-assets endpoint is defined with college-scoped filtering and pagination', () => {
  assert.match(controllerSource, /listCollegeDepartmentAssets/i);
  assert.match(controllerSource, /req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /pagination\s*:\s*\{[^\}]*page[^\}]*limit[^\}]*total[^\}]*totalPages/i);
  assert.match(controllerSource, /summary\s*:\s*\{[^\}]*totalAssets/i);
});
