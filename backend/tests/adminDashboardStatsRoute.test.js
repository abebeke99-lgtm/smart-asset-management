const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin dashboard exposes the persisted college count expected by its frontend', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminSupportRoutes.js'), 'utf8');
  const dashboardRoute = routeSource.slice(routeSource.indexOf("router.get('/admin/dashboard'"));
  const dashboardSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/admin/AdminDashboard.jsx'), 'utf8');

  assert.match(dashboardRoute, /totalColleges:\s*colleges\.length/);
  assert.match(dashboardSource, /source\.totalColleges/);
});