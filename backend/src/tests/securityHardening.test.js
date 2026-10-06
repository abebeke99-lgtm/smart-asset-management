const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getJwtSecret } = require('../config/jwt');
const { ROLE_NAMES, normalizeRoleForStorage } = require('../constants/rolePermissions');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('production JWT signing fails fast without JWT_SECRET and uses only its environment value', () => {
  const previousNodeEnvironment = process.env.NODE_ENV;
  const previousJwtSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(getJwtSecret, /JWT_SECRET must be configured in production/);
    process.env.JWT_SECRET = 'test-only-env-secret';
    assert.equal(getJwtSecret(), 'test-only-env-secret');
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvironment;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test('unused legacy MySQL server and its frontend script are removed', () => {
  const frontendPackage = JSON.parse(read('../../../frontend/package.json'));
  assert.equal(frontendPackage.scripts.mysql, undefined);
  assert.equal(fs.existsSync(path.join(__dirname, '../../../frontend/server.mysql.js')), false);
});

test('canonical administrator API mount requires JWT authentication and admin role', () => {
  const appSource = read('../app.js');
  assert.match(appSource, /app\.use\(['"]\/api\/admin['"],\s*requireAuth,\s*requireRole\(['"]admin['"]\),\s*adminSupportRoutes\)/);
  assert.match(appSource, /app\.use\(['"]\/api\/admin\/users['"],\s*requireAuth,\s*requireRole\(['"]admin['"]\),\s*userRoutes\)/);
  assert.match(appSource, /app\.use\(['"]\/api['"],\s*adminSupportRoutes\)/, 'legacy shared API aliases remain available with their route-specific scopes');
});

test('backup restore hides internal exception details in production responses', () => {
  const source = read('../routes/adminSupportRoutes.js');
  assert.match(source, /res\.status\(400\)\.json\(\{ success: false, message: 'Backup restore failed\.' \}\)/);
  assert.match(source, /console\.error\('Backup restore failed:', error\)/, 'technical details remain server-side only');
  assert.doesNotMatch(source, /RESTORE_FAILED[\s\S]{0,180}error: error\.message/);
});

test('maintenance create and update audit entries retain actor role and old/new values', () => {
  const source = read('../controllers/maintenanceController.js');
  assert.match(source, /action: 'CREATE_MAINTENANCE'[\s\S]*?createAuditLog\(\{/);
  assert.match(source, /action: 'UPDATE_MAINTENANCE'[\s\S]*?createAuditLog\(\{/);
  assert.match(source, /role: req\.user\.role/);
  assert.match(source, /oldValue: null[\s\S]*?newValue: item\.toJSON\(\)/);
  assert.match(source, /oldValue: previousValue[\s\S]*?newValue: item\.toJSON\(\)/);
});

test('public registration restricts role selection to unprivileged roles', () => {
  const authSource = read('../controllers/authController.js');
  assert.match(authSource, /publicRoles = \['student', 'staff'\]/);
  assert.match(authSource, /Role must be provided by an administrator/);
});

test('disposal workflow read + mutation routes are role-gated', () => {
  const source = read('../routes/adminSupportRoutes.js');
  const disposalRoutes = [...source.matchAll(/router\.(get|post)\('\/disposals[^']*'([^,{]*)/g)]
    .map((m) => `${m[1].toUpperCase()} ${m[2].trim() || m[1]}`);
  const gated = [...source.matchAll(/router\.(get|post)\('\/disposals[^']*', \.\.\.disposalAccess/g)].length;
  const total = [...source.matchAll(/router\.(get|post)\('\/disposals/g)].length;
  assert.ok(total >= 10, `expected disposal routes to exist (found ${total})`);
  assert.equal(gated, total, `every disposal route must use disposalAccess (${gated}/${total})`);
  assert.match(source, /const disposalAccess = \[requireAuth, requireRole\('admin', 'store_manager', 'ict_officer', 'finance'\)\]/);
});

test('rfid tag registration route requires a management role', () => {
  const source = read('../routes/adminSupportRoutes.js');
  assert.match(source, /router\.post\('\/rfid\/tags', requireAuth, requireRole\('admin', 'ict_officer', 'store_manager'\)/);
});

test('user profile lookups are gated away from unprivileged roles', () => {
  const userRoutes = read('../routes/userRoutes.js');
  const adminSource = read('../routes/adminSupportRoutes.js');
  assert.doesNotMatch(userRoutes, /router\.get\('\/:id', requireAuth, getUserById\)/);
  assert.match(userRoutes, /router\.get\('\/:id', requireAuth, requireRole\('admin', 'college', 'store_manager', 'ict_officer', 'maintenance'\), getUserById\)/);
  assert.match(adminSource, /router\.get\('\/users\/:id', requireAuth, requireRole\('admin', 'college', 'store_manager', 'ict_officer', 'maintenance'\)/);
  assert.match(adminSource, /router\.get\('\/users\/:id\/activity', requireAuth, requireRole\('admin'\)/);
});

test('inventory stock write routes require an authorized role', () => {
  const source = read('../routes/inventoryRoutes.js');
  assert.match(source, /const inventoryWriteAccess = \[requireAuth, requireRole\('admin', 'store_manager', 'ict_officer'\), resolveScopedInventoryCollegeScope\]/);
  assert.match(source, /const resolveScopedInventoryCollegeScope = .*isCollegeScopedRole\(req\.user\?\.role\).*resolveCollegeScope/);
  assert.doesNotMatch(source, /router\.post\('\/transactions', requireAuth, createTransaction\)/);
  assert.doesNotMatch(source, /router\.post\('\/:assetId\/movement', requireAuth,/);
});

test('inventory reads are restricted and scoped to the caller\'s college or department', () => {
  const source = read('../routes/inventoryRoutes.js');
  assert.match(source, /const inventoryReadAccess = \[requireAuth, requireRole\('admin', 'store_manager', 'college_manager', 'ict_officer', 'department_head'\), resolveInventoryReadScope\]/);
  assert.match(source, /const resolveInventoryReadScope = .*req\.user\?\.role === 'department_head' \? resolveDepartmentScope/);
  assert.match(read('../controllers/inventoryController.js'), /req\.user\?\.role === 'department_head' && .*departmentId/);
  assert.match(read('../controllers/inventoryController.js'), /req\.user\?\.role === 'ict_officer' && req\.organizationScope\?\.collegeId/);
});

test('admin user create/update handlers validate role and email', () => {
  const source = read('../routes/adminSupportRoutes.js');
  const userControllerSource = read('../controllers/userController.js');
  assert.match(source, /const allowedRoles = ROLE_NAMES;/);
  assert.match(userControllerSource, /normalizeRoleForStorage\(input\.role \|\| input\.roleId\)/);
  assert.match(userControllerSource, /const requestedRole = input\.role \|\| input\.roleId;/);
  assert.deepEqual(
    ['admin', 'store_manager', 'maintenance', 'department_head', 'college_manager', 'infrastructure', 'ict_officer']
      .filter((role) => !ROLE_NAMES.includes(role)),
    [],
  );
  assert.equal(normalizeRoleForStorage('dept_head'), 'department_head');
  assert.ok(ROLE_NAMES.includes(normalizeRoleForStorage('dept_head')));
  assert.match(source, /Invalid user role/);
});

test('asset update uses a field whitelist with numeric and date guards', () => {
  const source = read('../controllers/assetController.js');
  assert.match(source, /const updatableAssetFields = \[[\s\S]*\]/);
  assert.doesNotMatch(source, /const updates = \{ \.\.\.req\.body \};/);
  assert.match(source, /must be a non-negative number/);
  assert.match(source, /must be a valid date/);
});

test('assignment reassign validates typed targets and closes the previous history row', () => {
  const source = read('../routes/assignmentRoutes.js');
  assert.match(source, /req\.body\.new_user_id \|\| req\.body\.newUserId/);
  assert.match(source, /Assigned To type must be User, Department or Laboratory/);
  assert.match(source, /status: 'closed', workflowStatus: 'reassigned'/);
  assert.match(source, /Select an active user to receive this asset/);
});

test('backend error middleware never serializes internal 500 details to clients', () => {
  const source = read('../app.js');
  assert.match(source, /message:\s*status >= 500 \|\| process\.env\.NODE_ENV === 'production' \? 'Internal server error'/);
  assert.match(source, /status < 500 && err\.errors/);
});