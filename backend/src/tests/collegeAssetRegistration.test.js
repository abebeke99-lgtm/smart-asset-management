const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { requireRole, requirePermission } = require('../middlewares/auth');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/collegeRoutes.js'), 'utf8');
const assetControllerSource = fs.readFileSync(path.resolve(__dirname, '../controllers/assetController.js'), 'utf8');
const custodyControllerSource = fs.readFileSync(path.resolve(__dirname, '../controllers/assetExtendedController.js'), 'utf8');
const collegeControllerSource = fs.readFileSync(path.resolve(__dirname, '../controllers/collegeController.js'), 'utf8');

const makeResponse = () => ({
  status(code) {
    return { json: (payload) => ({ code, payload }) };
  },
});

test('college asset writes are limited to college managers with the matching permission', () => {
  assert.match(routeSource, /router\.post\('\/assets', requireRole\('college_manager'\), requirePermission\('college\.assets\.create'\), createAsset\)/);
  assert.match(routeSource, /router\.put\('\/assets\/:id', requireRole\('college_manager'\), requirePermission\('college\.assets\.update'\), updateAsset\)/);
  assert.match(routeSource, /router\.post\('\/assets\/:id\/custody', requireRole\('college_manager'\), requirePermission\('college\.assignments\.manage'\), requireCollegeAsset, createAssetCustody\)/);
  assert.match(routeSource, /router\.post\('\/assets\/:id\/custody\/:custodyId\/end', requireRole\('college_manager'\), requirePermission\('college\.assignments\.manage'\), requireCollegeAsset, endCustody\)/);
  assert.match(routeSource, /router\.use\(requireAuth, requireActiveAccount, requireRole\('college_manager', 'college'\), resolveCollegeScope\)/);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.college.includes('college.assets.create'), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.college.includes('college.assets.update'), false);
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.assets.create'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.assets.update'));

  const req = { user: { role: 'college', permissions: DEFAULT_ROLE_PERMISSIONS.college } };
  const result = requireRole('college_manager')(req, makeResponse(), () => assert.fail('college must not reach the write handler'));
  assert.equal(result.code, 403);

  let permitted = false;
  requirePermission('college.assets.create')(
    { user: { role: 'college_manager', permissions: DEFAULT_ROLE_PERMISSIONS.college_manager } },
    makeResponse(),
    () => { permitted = true; }
  );
  assert.equal(permitted, true);
});

test('college asset reference data is registered before the asset id route', () => {
  const optionsRouteIndex = routeSource.indexOf("router.get('/assets/registration-options'");
  const detailRouteIndex = routeSource.indexOf("router.get('/assets/:id',");
  assert.ok(optionsRouteIndex >= 0 && optionsRouteIndex < detailRouteIndex);
  assert.match(routeSource, /requirePermission\('college\.assets\.view'\), getCollegeAssetRegistrationOptions/);
});

test('asset creation validates college-owned departments and active college custodians', () => {
  assert.match(assetControllerSource, /Department\.findOne\(\{ where: \{ id: departmentId, collegeId \}/);
  assert.match(assetControllerSource, /where: \{ id: custodianId, active: true, \.\.\.\(scopedRole \? \{ collegeId \} : \{\}\) \}/);
  assert.match(assetControllerSource, /AssetCustody\.create\(/);
  assert.match(assetControllerSource, /action: 'CREATE_ASSET_CUSTODY'/);
  assert.match(custodyControllerSource, /isCollegeScopedRole\(req\.user\?\.role\) \? \{ collegeId: scopedCollegeId \} : \{\}/);
  assert.match(custodyControllerSource, /action: 'END_ASSET_CUSTODY'/);
});

test('college asset listing uses a safe sort allowlist and purchase-date range', () => {
  assert.match(collegeControllerSource, /allowedSortFields = new Set\(\['createdAt', 'updatedAt', 'purchaseDate', 'name', 'assetCode', 'status'\]\)/);
  assert.match(collegeControllerSource, /where\.purchaseDate = purchaseDate/);
  assert.match(collegeControllerSource, /where: \{ id: departmentId, collegeId \}/);
});

test('create permission is enforced independently of the role gate', () => {
  const req = { user: { role: 'college_manager', permissions: ['college.assets.view'] } };
  const result = requirePermission('college.assets.create')(req, makeResponse(), () => assert.fail('missing create permission must be denied'));
  assert.equal(result.code, 403);
});
