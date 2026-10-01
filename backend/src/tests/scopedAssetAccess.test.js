const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Asset, Assignment, Inventory, sequelize } = require('../models');
const { getAllAssets, getAssetById, updateAsset, createAsset } = require('../controllers/assetController');
const { getInventory } = require('../controllers/inventoryController');
const { restoreAsset } = require('../controllers/assetExtendedController');

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
  assert.match(routeSource, /router\.get\('\/'.*resolveScopedCollegeAssetScope, getAllAssets/);
  assert.match(routeSource, /router\.post\('\/'.*requireRole\('admin'\)/);
  assert.match(routeSource, /router\.put\('\/:id'.*requireRole\('admin'\)/);
  assert.match(routeSource, /router\.post\('\/:id\/restore'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.delete\('\/:id\/rfid'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.get\('\/:id\/documents'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
});

test('asset list accepts validated filters, allowlisted sorting, search, and deleted rows', async () => {
  const models = require('../models');
  const originals = {
    assetFindAndCountAll: Asset.findAndCountAll,
    assetFindAll: Asset.findAll,
    departmentFindByPk: models.Department.findByPk,
    departmentFindAll: models.Department.findAll,
    collegeFindAll: models.College.findAll,
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
  }
});