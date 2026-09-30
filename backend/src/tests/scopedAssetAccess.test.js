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
  assert.match(routeSource, /router\.post\('\/:id\/restore'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.delete\('\/:id\/rfid'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
  assert.match(routeSource, /router\.get\('\/:id\/documents'.*resolveScopedCollegeAssetScope, verifyScopedCollegeAsset/);
});