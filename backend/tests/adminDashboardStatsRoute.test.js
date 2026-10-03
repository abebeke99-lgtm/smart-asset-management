const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin dashboard uses the existing administrator-only endpoint and live dashboard contract', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminSupportRoutes.js'), 'utf8');
  const analyticsRouteSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/analyticsRoutes.js'), 'utf8');
  const settingsRouteSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminSettingsRoutes.js'), 'utf8');
  const dashboardSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/admin/AdminDashboard.jsx'), 'utf8');
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/App.jsx'), 'utf8');

  assert.match(routeSource, /router\.get\(\['\/dashboard', '\/admin\/dashboard'\], \.\.\.requireAdmin/);
  assert.match(routeSource, /getDashboardAnalytics\(\)/);
  assert.doesNotMatch(analyticsRouteSource, /router\.get\(['"]\/dashboard/);
  assert.match(settingsRouteSource, /req\.params\.section === 'dashboard' \? requireAdmin/);
  assert.match(dashboardSource, /\/api\/admin\/dashboard/);
  assert.match(dashboardSource, /statistics\.organization/);
  assert.match(dashboardSource, /assetByCondition/);
  assert.match(dashboardSource, /assetByCategory/);
  assert.match(dashboardSource, /recentActivity/);
  assert.match(appSource, /path="\/admin".*ProtectedRoute allowedRoles=\{\['admin'\]\}/);
});