const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

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
  assert.match(source, /const inventoryWriteAccess = \[requireAuth, requireRole\('admin', 'store_manager', 'ict_officer'\)\]/);
  assert.doesNotMatch(source, /router\.post\('\/transactions', requireAuth, createTransaction\)/);
  assert.doesNotMatch(source, /router\.post\('\/:assetId\/movement', requireAuth,/);
});

test('admin user create/update handlers validate role and email', () => {
  const source = read('../routes/adminSupportRoutes.js');
  assert.match(source, /const allowedRoles = \['admin', 'ict_officer', 'store_manager', 'college', 'finance', 'maintenance', 'department_head', 'student', 'staff'\]/);
  assert.match(source, /Invalid user role/);
});

test('asset update uses a field whitelist with numeric and date guards', () => {
  const source = read('../controllers/assetController.js');
  assert.match(source, /const updatableAssetFields = \[[\s\S]*\]/);
  assert.doesNotMatch(source, /const updates = \{ \.\.\.req\.body \};/);
  assert.match(source, /must be a non-negative number/);
  assert.match(source, /must be a valid date/);
});

test('assignment transfer validates the new assignee id', () => {
  const source = read('../routes/assignmentRoutes.js');
  assert.match(source, /Number\(req\.body\.new_user_id \|\| req\.body\.newUserId\)/);
  assert.match(source, /Cannot transfer an assignment to an inactive user/);
});