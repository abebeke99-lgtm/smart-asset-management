const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/ictAssetRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../controllers/deviceHealthController.js'), 'utf8');

test('device health routes are ICT-authenticated and scoped', () => {
  assert.ok(routeSource.includes("router.get('/device-health', ...scopedIctAccess"));
  assert.ok(routeSource.includes("router.get('/device-health/:id', ...scopedIctAccess"));
  assert.ok(routeSource.includes("router.post('/device-health', ...scopedIctAccess"));
  assert.ok(routeSource.includes("requireRole('admin', 'ict_officer')"));
  assert.ok(routeSource.includes('resolveCollegeScope'));
  assert.ok(controllerSource.includes('req.organizationScope.collegeId'));
  assert.ok(controllerSource.includes('req.user.id'));
  assert.ok(controllerSource.includes('DEVICE_HEALTH_INSPECTION_CREATED'));
});
