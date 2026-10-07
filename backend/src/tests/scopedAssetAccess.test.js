const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const { Asset, Assignment, Inventory, sequelize } = require('../models');
const { getAllAssets, getAssetById, updateAsset, createAsset } = require('../controllers/assetController');
const { getInventory } = require('../controllers/inventoryController');
const { restoreAsset, lookupByQr, permanentDeleteAsset } = require('../controllers/assetExtendedController');
const assetRoutes = require('../routes/assetRoutes');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/assetRoutes.js'), 'utf8');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const scopedRequest = (overrides = {}) => ({
  user: { id: 5, role: 'store_manager', collegeId: 1 },
  organizationScope: { collegeId: 1 },
  params: { id: '42' },
  query: {},
  body: {},
  ...overrides,
});

test('generic asset list intersects caller filters and summary with the resolved College', async () => {
  const originals = { findAndCountAll: Asset.findAndCountAll, findAll: Asset.findAll, findByPk: require('../models').Department.findByPk, assignmentFindAll: Assignment.findAll };
  let listOptions;
  let summaryOptions;
  Asset.findAndCountAll = async (options) => { listOptions = options; return { count: 0, rows: [] }; };
  Asset.findAll = async (options) => { summaryOptions = options; return []; };
  require('../models').Department.findByPk = async () => ({ id: 2, name: 'Foreign department', collegeId: 2 });
  Assignment.findAll = async () => [];
  try {
    const response = makeResponse();
    await getAllAssets(scopedRequest({ query: { collegeId: '2', department: 'Caller department', department_id: '2' } }), response);
    assert.equal(listOptions.where.collegeId, 1);
    assert.equal(listOptions.where.department, 'Caller department');
    assert.equal(summaryOptions.where.collegeId, 1);
    assert.equal(response.statusCode, 200);

    const collegeManagerResponse = makeResponse();
    await getAllAssets(scopedRequest({ user: { id: 8, role: 'college_manager', collegeId: 1 }, query: { college_id: '2' } }), collegeManagerResponse);
    assert.equal(listOptions.where.collegeId, 1);
    assert.equal(collegeManagerResponse.statusCode, 200);
  } finally {
    Asset.findAndCountAll = originals.findAndCountAll;
    Asset.findAll = originals.findAll;
    require('../models').Department.findByPk = originals.findByPk;
    Assignment.findAll = originals.assignmentFindAll;
  }
});

test('Teaching Assistant asset list and summary remain restricted to the assigned department', async () => {
  const originals = {
    findAndCountAll: Asset.findAndCountAll,
    findAll: Asset.findAll,
    departmentFindByPk: require('../models').Department.findByPk,
    assignmentFindAll: Assignment.findAll,
  };
  let listOptions;
  let summaryOptions;
  Asset.findAndCountAll = async (options) => { listOptions = options; return { count: 0, rows: [] }; };
  Asset.findAll = async (options) => { summaryOptions = options; return []; };
  require('../models').Department.findByPk = async () => ({ id: 22, name: 'Another department', collegeId: 3 });
  Assignment.findAll = async () => [];
  try {
    const response = makeResponse();
    await getAllAssets(scopedRequest({
      user: { id: 17, role: 'teaching_assistant', departmentId: 4, collegeId: 2 },
      organizationScope: { departmentId: 4, collegeId: 2, department: { id: 4, name: 'Teaching Department' } },
      query: { department: 'Another department', department_id: '22', college_id: '3' },
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(listOptions.where.departmentId, 4);
    assert.equal(listOptions.where.collegeId, 2);
    assert.equal(summaryOptions.where.departmentId, 4);
    assert.equal(summaryOptions.where.collegeId, 2);
  } finally {
    Asset.findAndCountAll = originals.findAndCountAll;
    Asset.findAll = originals.findAll;
    require('../models').Department.findByPk = originals.departmentFindByPk;
    Assignment.findAll = originals.assignmentFindAll;
  }
});

test('Department Head asset list and summary ignore caller-selected departments', async () => {
  const originals = {
    findAndCountAll: Asset.findAndCountAll,
    findAll: Asset.findAll,
    assignmentFindAll: Assignment.findAll,
  };
  let listOptions;
  let summaryOptions;
  Asset.findAndCountAll = async (options) => { listOptions = options; return { count: 0, rows: [] }; };
  Asset.findAll = async (options) => { summaryOptions = options; return []; };
  Assignment.findAll = async () => [];
  try {
    const response = makeResponse();
    await getAllAssets(scopedRequest({
      user: { id: 19, role: 'department_head', departmentId: 7, collegeId: 3 },
      organizationScope: { departmentId: 7, collegeId: 3, department: { id: 7, name: 'Authorized Department' } },
      query: { department: 'Another Department' },
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(listOptions.where.departmentId, 7);
    assert.equal(listOptions.where.collegeId, 3);
    assert.equal(summaryOptions.where.departmentId, 7);
    assert.equal(summaryOptions.where.collegeId, 3);

    const mismatchResponse = makeResponse();
    await getAllAssets(scopedRequest({
      user: { id: 19, role: 'department_head', departmentId: 7, collegeId: 3 },
      organizationScope: { departmentId: 7, collegeId: 3 },
      query: { department_id: '8' },
    }), mismatchResponse);
    assert.equal(mismatchResponse.statusCode, 403);
  } finally {
    Asset.findAndCountAll = originals.findAndCountAll;
    Asset.findAll = originals.findAll;
    Assignment.findAll = originals.assignmentFindAll;
  }
});

test('Department Head QR lookup constrains identification to the authorized department', async () => {
  const originalFindOne = Asset.findOne;
  let lookupOptions;
  Asset.findOne = async (options) => { lookupOptions = options; return null; };
  try {
    const response = makeResponse();
    await lookupByQr({
      user: { id: 19, role: 'department_head', departmentId: 7 },
      organizationScope: { departmentId: 7, collegeId: 3 },
      params: { identifier: 'QR-FOREIGN-ASSET' },
      query: {},
    }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 404);
    assert.equal(lookupOptions.where.departmentId, 7);
    assert.equal(lookupOptions.where.collegeId, 3);
  } finally {
    Asset.findOne = originalFindOne;
  }
});

test('Teaching Assistant detail route verifies the requested asset belongs to its department', async () => {
  const detailRoute = assetRoutes.stack.find((layer) => layer.route?.path === '/:id' && layer.route.methods.get)?.route;
  assert.ok(detailRoute);
  const scopeMiddleware = detailRoute.stack.find((layer) => layer.handle.name === 'resolveTeachingAssistantDepartmentScope')?.handle;
  const assetMiddleware = detailRoute.stack.find((layer) => layer.handle.name === 'verifyTeachingAssistantAsset')?.handle;
  assert.equal(typeof scopeMiddleware, 'function');
  assert.equal(typeof assetMiddleware, 'function');

  const models = require('../models');
  const originalDepartmentFindOne = models.Department.findOne;
  const originalAssetFindOne = Asset.findOne;
  let assetWhere;
  models.Department.findOne = async () => ({ id: 4, name: 'Teaching Department', collegeId: 2 });
  Asset.findOne = async (options) => { assetWhere = options.where; return null; };
  try {
    const req = { user: { role: 'teaching_assistant', departmentId: 4 }, params: { id: '99' }, query: {} };
    const response = makeResponse();
    let scopeAdvanced = false;
    await scopeMiddleware(req, response, () => { scopeAdvanced = true; });
    assert.equal(scopeAdvanced, true);
    assert.deepEqual(req.organizationScope, {
      department: { id: 4, name: 'Teaching Department', collegeId: 2 },
      departmentId: 4,
      collegeId: 2,
    });
    await assetMiddleware(req, response, () => assert.fail('out-of-scope asset must not continue'));
    assert.deepEqual(assetWhere, { id: '99', departmentId: 4, collegeId: 2 });
    assert.equal(response.statusCode, 403);
  } finally {
    models.Department.findOne = originalDepartmentFindOne;
    Asset.findOne = originalAssetFindOne;
  }
});

test('Department Head detail route rejects assets outside the resolved department', async () => {
  const detailRoute = assetRoutes.stack.find((layer) => layer.route?.path === '/:id' && layer.route.methods.get)?.route;
  assert.ok(detailRoute);
  const scopeMiddleware = detailRoute.stack.find((layer) => layer.handle.name === 'resolveDepartmentHeadAssetScope')?.handle;
  const assetMiddleware = detailRoute.stack.find((layer) => layer.handle.name === 'verifyDepartmentHeadAsset')?.handle;
  assert.equal(typeof scopeMiddleware, 'function');
  assert.equal(typeof assetMiddleware, 'function');

  const models = require('../models');
  const originalDepartmentFindOne = models.Department.findOne;
  const originalAssetFindOne = Asset.findOne;
  let assetWhere;
  models.Department.findOne = async () => ({ id: 7, name: 'Authorized Department', collegeId: 3 });
  Asset.findOne = async (options) => { assetWhere = options.where; return null; };
  try {
    const req = { user: { role: 'department_head', departmentId: 7 }, params: { id: '99' }, query: {} };
    const response = makeResponse();
    let scopeAdvanced = false;
    await scopeMiddleware(req, response, () => { scopeAdvanced = true; });
    assert.equal(scopeAdvanced, true);
    await assetMiddleware(req, response, () => assert.fail('out-of-department asset must not continue'));
    assert.deepEqual(assetWhere, { id: '99', departmentId: 7, collegeId: 3 });
    assert.equal(response.statusCode, 403);
  } finally {
    models.Department.findOne = originalDepartmentFindOne;
    Asset.findOne = originalAssetFindOne;
  }
});

test('department QR/RFID lookup is case-insensitive and constrains matches to the authorized department', async () => {
  const originalFindOne = Asset.findOne;
  let lookupOptions;
  Asset.findOne = async (options) => { lookupOptions = options; return null; };
  try {
    const response = makeResponse();
    await lookupByQr({
      user: { id: 5, role: 'department_head', departmentId: 7 },
      organizationScope: { departmentId: 7, collegeId: 3 },
      params: { identifier: 'rfid-outside' },
      query: {},
    }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 404);
    assert.equal(lookupOptions.where.departmentId, 7);
    assert.equal(lookupOptions.where.collegeId, 3);
    const identifierClauses = lookupOptions.where[Op.and][0][Op.or];
    const normalizedFields = identifierClauses
      .filter((clause) => clause.attribute?.fn === 'UPPER')
      .map((clause) => ({
        column: clause.attribute.args[0].args[0].col,
        value: clause.logic,
      }));
    assert.deepEqual(normalizedFields, [
      { column: 'Asset.digital_id', value: 'RFID-OUTSIDE' },
      { column: 'Asset.qr_code', value: 'RFID-OUTSIDE' },
      { column: 'Asset.asset_code', value: 'RFID-OUTSIDE' },
      { column: 'Asset.serial_number', value: 'RFID-OUTSIDE' },
      { column: 'Asset.rfid_tag', value: 'RFID-OUTSIDE' },
    ]);
    assert.equal(identifierClauses.at(-1).id, -1);
  } finally {
    Asset.findOne = originalFindOne;
  }
});

test('department tracking history routes require asset-view permission and department ownership', () => {
  for (const suffix of ['location', 'assignments', 'transfers', 'maintenance']) {
    const route = assetRoutes.stack.find((layer) => layer.route?.path === `/:id/${suffix}` && layer.route.methods.get)?.route;
    assert.ok(route, `missing tracking route for ${suffix}`);
    assert.match(routeSource, new RegExp(`router\\.get\\('\\/:id\\/${suffix}'.*trackingReadAccess`));
  }
  assert.match(routeSource, /const trackingReadAccess = \[[\s\S]*requireAnyPermission\('assets\.view'\)[\s\S]*resolveDepartmentHeadAssetScope[\s\S]*verifyDepartmentHeadAsset/);
});

test('generic asset detail, update, and recovery cannot access another College asset', async () => {
  const originalFindOne = Asset.findOne;
  const originalTransaction = sequelize.transaction;
  const lookups = [];
  Asset.findOne = async (options) => { lookups.push(options); return null; };
  sequelize.transaction = async () => ({ rollback: async () => {}, commit: async () => {}, LOCK: { UPDATE: 'UPDATE' } });
  try {
    const detailResponse = makeResponse();
    await getAssetById(scopedRequest(), detailResponse);
    assert.equal(detailResponse.statusCode, 404);
    assert.deepEqual(lookups[0].where, { id: '42', collegeId: 1 });

    const updateResponse = makeResponse();
    await updateAsset(scopedRequest(), updateResponse);
    assert.equal(updateResponse.statusCode, 404);
    assert.deepEqual(lookups[1].where, { id: '42', collegeId: 1 });

    const restoreResponse = makeResponse();
    await restoreAsset(scopedRequest(), restoreResponse, (error) => { throw error; });
    assert.equal(restoreResponse.statusCode, 404);
    assert.deepEqual(lookups[2].where, { id: '42', collegeId: 1 });
    assert.equal(lookups[2].paranoid, false);
  } finally {
    Asset.findOne = originalFindOne;
    sequelize.transaction = originalTransaction;
  }
});

test('scoped asset writes reject caller-supplied College mismatches', async () => {
  const createResponse = makeResponse();
  await createAsset(scopedRequest({ body: { name: 'External asset', college_id: 2 } }), createResponse);
  assert.equal(createResponse.statusCode, 403);

  const updateResponse = makeResponse();
  await updateAsset(scopedRequest({ body: { collegeId: 2 } }), updateResponse);
  assert.equal(updateResponse.statusCode, 403);
});

test('generic inventory list constrains joined assets to the resolved College', async () => {
  const originalFindAndCountAll = Inventory.findAndCountAll;
  const originalFindAll = Inventory.findAll;
  let listOptions;
  Inventory.findAndCountAll = async (options) => { listOptions = options; return { count: 0, rows: [] }; };
  Inventory.findAll = async () => [];
  try {
    const response = makeResponse();
    await getInventory(scopedRequest({ query: { collegeId: '2', limit: '10' } }), response, (error) => { throw error; });
    assert.equal(listOptions.include[0].where.collegeId, 1);
    assert.equal(listOptions.include[0].required, true);
    assert.equal(response.statusCode, 200);
  } finally {
    Inventory.findAndCountAll = originalFindAndCountAll;
    Inventory.findAll = originalFindAll;
  }
});

test('scoped asset ID routes resolve College and verify ownership before dispatch', () => {
  assert.match(routeSource, /const resolveScopedCollegeAssetScope = .*resolveCollegeScope/);
  assert.match(routeSource, /const verifyScopedCollegeAsset = async/);
  assert.match(routeSource, /router\.get\('\/'.*resolveScopedCollegeAssetScope, resolveDepartmentHeadAssetScope, resolveTeachingAssistantDepartmentScope, getAllAssets/);
  assert.match(routeSource, /requireAnyPermission\('assets\.view', 'ict\.assets\.view', 'college\.assets\.view'\)/);
  assert.match(routeSource, /router\.post\('\/'.*requireRole\('admin'\)/);
  assert.match(routeSource, /router\.put\('\/:id'.*requireRole\('admin'\)/);
  assert.match(routeSource, /router\.post\('\/:id\/restore'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.delete\('\/:id\/rfid'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.get\('\/:id\/documents'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.get\('\/:id\/documents'.*resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset/);
  assert.match(routeSource, /router\.get\('\/:id\/documents\/:documentId\/file'.*resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset/);
  assert.match(routeSource, /router\.get\('\/scan\/:identifier'.*'department_head'.*resolveDepartmentHeadAssetScope, lookupByQr/);
  assert.match(routeSource, /router\.get\('\/:id\/history'.*'department_head'.*verifyDepartmentHeadAsset, getAssetHistory/);
});

test('asset list accepts validated filters, allowlisted sorting, search, and deleted rows', async () => {
  const models = require('../models');
  const originals = {
    assetFindAndCountAll: Asset.findAndCountAll,
    assetFindAll: Asset.findAll,
    departmentFindByPk: models.Department.findByPk,
    departmentFindAll: models.Department.findAll,
    collegeFindAll: models.College.findAll,
    campusFindAll: models.Campus.findAll,
    buildingFindAll: models.Building.findAll,
    roomFindAll: models.Room.findAll,
    userFindAll: models.User.findAll,
    assignmentFindAll: Assignment.findAll,
    maintenanceFindAll: models.Maintenance.findAll,
  };
  let listOptions;
  let collegeFindOptions;
  Asset.findAndCountAll = async (options) => { listOptions = options; return { count: 0, rows: [] }; };
  Asset.findAll = async () => [];
  models.Department.findByPk = async () => ({ id: 4, name: 'ICT', collegeId: 3 });
  models.Department.findAll = async () => [];
  models.College.findAll = async (options) => { collegeFindOptions = options; return []; };
  models.Campus.findAll = async () => [];
  models.Building.findAll = async () => [];
  models.Room.findAll = async () => [];
  models.User.findAll = async () => [];
  Assignment.findAll = async () => [];
  models.Maintenance.findAll = async () => [];
  try {
    const response = makeResponse();
    await getAllAssets(scopedRequest({
      user: { id: 5, role: 'admin' },
      query: {
        page: '2', limit: '25', search: 'Lab', status: 'available', category: 'Computing', campus_id: '2',
        college_id: '3', department_id: '4', laboratory_id: '5', purchase_from: '2024-01-01',
        purchase_to: '2024-12-31', research_grant: 'has', maintenance_status: 'open', deleted: 'true',
        sort_by: 'assetCode', sort_order: 'asc',
      },
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(listOptions.limit, 25);
    assert.equal(listOptions.offset, 25);
    assert.deepEqual(listOptions.order, [['assetCode', 'ASC']]);
    assert.equal(listOptions.paranoid, false);
    assert.equal(listOptions.where.campusId, '2');
    assert.equal(listOptions.where.collegeId, '3');
    assert.equal(listOptions.where.departmentId, '4');
    assert.equal(listOptions.where.roomId, '5');
    assert.equal(listOptions.where.deletedAt[require('sequelize').Op.not], null);
    assert.ok(listOptions.where[require('sequelize').Op.and]);
    assert.deepEqual(Object.keys(collegeFindOptions.where), ['collegeName']);

    const invalidResponse = makeResponse();
    await getAllAssets(scopedRequest({ user: { id: 5, role: 'admin' }, query: { sort_by: 'password' } }), invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);
  } finally {
    Asset.findAndCountAll = originals.assetFindAndCountAll;
    Asset.findAll = originals.assetFindAll;
    models.Department.findByPk = originals.departmentFindByPk;
    models.Department.findAll = originals.departmentFindAll;
    models.College.findAll = originals.collegeFindAll;
    models.Campus.findAll = originals.campusFindAll;
    models.Building.findAll = originals.buildingFindAll;
    models.Room.findAll = originals.roomFindAll;
    models.User.findAll = originals.userFindAll;
    Assignment.findAll = originals.assignmentFindAll;
    models.Maintenance.findAll = originals.maintenanceFindAll;
  }
});

test('expired asset recovery purge uses configured days and keeps a system audit record', async () => {
  const models = require('../models');
  const { purgeExpiredAssets, getRecoveryDays } = require('../services/assetRetentionService');
  const originals = {
    configFindByPk: models.Config.findByPk,
    assetFindAll: Asset.findAll,
    assetFindOne: Asset.findOne,
    transaction: sequelize.transaction,
    documentDestroy: models.AssetDocument.destroy,
    grantDestroy: models.AssetGrant.destroy,
    custodyDestroy: models.AssetCustody.destroy,
    auditCreate: models.AuditLog.create,
    referenceCounts: [...new Set(Object.values(Asset.associations).filter((association) => ['HasMany', 'HasOne'].includes(association.associationType)).map((association) => association.target))]
      .map((model) => [model, model.count]),
  };
  let listOptions;
  let auditRecord;
  let destroyOptions;
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const asset = {
    id: 9,
    deletedAt: new Date(Date.now() - 46 * 86400000),
    toJSON() { return { id: this.id, deletedAt: this.deletedAt }; },
    async destroy(options) { destroyOptions = options; },
  };
  models.Config.findByPk = async () => ({ value: JSON.stringify({ recoveryDays: 45 }) });
  Asset.findAll = async (options) => { listOptions = options; return [{ id: 9 }]; };
  Asset.findOne = async () => asset;
  sequelize.transaction = async () => transaction;
  models.AssetDocument.destroy = async () => 1;
  models.AssetGrant.destroy = async () => 1;
  models.AssetCustody.destroy = async () => 1;
  models.AuditLog.create = async (record) => { auditRecord = record; return record; };
  for (const [model] of originals.referenceCounts) model.count = async () => 0;
  try {
    assert.equal(await getRecoveryDays(), 45);
    const result = await purgeExpiredAssets();
    assert.equal(result.deletedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.recoveryDays, 45);
    assert.ok(listOptions.where.deletedAt[require('sequelize').Op.lte] instanceof Date);
    assert.equal(destroyOptions.force, true);
    assert.equal(transaction.finished, 'commit');
    assert.equal(auditRecord.action, 'PERMANENT_DELETE_ASSET');
    assert.equal(auditRecord.userId, null);
    assert.match(auditRecord.details, /recovery_period_expired/);
  } finally {
    models.Config.findByPk = originals.configFindByPk;
    Asset.findAll = originals.assetFindAll;
    Asset.findOne = originals.assetFindOne;
    sequelize.transaction = originals.transaction;
    models.AssetDocument.destroy = originals.documentDestroy;
    models.AssetGrant.destroy = originals.grantDestroy;
    models.AssetCustody.destroy = originals.custodyDestroy;
    models.AuditLog.create = originals.auditCreate;
    for (const [model, count] of originals.referenceCounts) model.count = count;
  }
});

test('asset recovery purge preserves an expired asset while historical records reference it', async () => {
  const models = require('../models');
  const { purgeExpiredAssets } = require('../services/assetRetentionService');
  const targets = [...new Set(Object.values(Asset.associations).filter((association) => ['HasMany', 'HasOne'].includes(association.associationType)).map((association) => association.target))];
  const originalCounts = targets.map((model) => [model, model.count]);
  const originals = { config: models.Config.findByPk, assets: Asset.findAll, asset: Asset.findOne, transaction: sequelize.transaction };
  let destroyed = false;
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: null, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  models.Config.findByPk = async () => ({ value: JSON.stringify({ recoveryDays: 30 }) });
  Asset.findAll = async () => [{ id: 9 }];
  Asset.findOne = async () => ({ id: 9, deletedAt: new Date(Date.now() - 40 * 86400000), toJSON() { return { id: this.id }; }, async destroy() { destroyed = true; } });
  sequelize.transaction = async () => transaction;
  for (const model of targets) model.count = async () => (model === models.Assignment ? 1 : 0);
  try {
    const result = await purgeExpiredAssets();
    assert.equal(result.deletedCount, 0);
    assert.equal(result.failedCount, 0);
    assert.equal(result.preservedCount, 1);
    assert.equal(destroyed, false);
    assert.equal(transaction.finished, 'commit');
  } finally {
    models.Config.findByPk = originals.config;
    Asset.findAll = originals.assets;
    Asset.findOne = originals.asset;
    sequelize.transaction = originals.transaction;
    for (const [model, count] of originalCounts) model.count = count;
  }
});

test('permanent asset deletion is blocked when an assignment keeps historical reference', async () => {
  const models = require('../models');
  const targets = [...new Set(Object.values(Asset.associations).filter((association) => ['HasMany', 'HasOne'].includes(association.associationType)).map((association) => association.target))];
  const originalCounts = targets.map((model) => [model, model.count]);
  const originals = { transaction: sequelize.transaction, findOne: Asset.findOne };
  let destroyed = false;
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: null, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  sequelize.transaction = async () => transaction;
  Asset.findOne = async () => ({ id: 9, deletedAt: new Date(Date.now() - 40 * 86400000), toJSON() { return { id: this.id }; }, async destroy() { destroyed = true; } });
  for (const model of targets) model.count = async () => (model === models.Assignment ? 1 : 0);
  try {
    const response = makeResponse();
    await permanentDeleteAsset(scopedRequest({ user: { id: 1, role: 'admin' }, params: { id: '9' } }), response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /linked history/i);
    assert.equal(destroyed, false);
    assert.equal(transaction.finished, 'rollback');
  } finally {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.findOne;
    for (const [model, count] of originalCounts) model.count = count;
  }
});
