const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const models = require('../src/models');
const collegeController = require('../src/controllers/collegeController');

const modelMethods = {
  Department: ['findAll'],
  User: ['findAll'],
  VerificationItem: ['findAll'],
  VerificationSession: ['findAndCountAll', 'findOne', 'count'],
  Asset: ['count', 'findAll'],
};

const originals = Object.fromEntries(Object.entries(modelMethods).map(([modelName, methods]) => [
  modelName,
  Object.fromEntries(methods.map((method) => [method, models[modelName][method]])),
]));

const restoreModels = () => {
  Object.entries(originals).forEach(([modelName, methods]) => {
    Object.entries(methods).forEach(([method, original]) => { models[modelName][method] = original; });
  });
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('verification listing applies college filters, server pagination, and per-session status counts', async (t) => {
  let listQuery;
  let assetItemQuery;
  const resultStates = ['pending', 'verified', 'missing', 'wrong_location', 'damaged', 'needs_review'];
  models.Department.findAll = async (options) => options.raw
    ? [{ id: 17, name: 'Engineering', code: 'ENG' }]
    : [{ id: 17 }];
  models.User.findAll = async () => [{ id: 5 }];
  models.VerificationItem.findAll = async (options) => {
    if (options.attributes.includes('sessionId')) {
      assetItemQuery = options;
      return [{ sessionId: 82 }];
    }
    return resultStates.map((state) => ({ state }));
  };
  models.VerificationSession.findAndCountAll = async (options) => {
    listQuery = options;
    return { count: 0, rows: [] };
  };
  models.VerificationSession.findOne = async (options) => options.where.status === 'in_progress'
    ? { id: 82, status: 'in_progress', departmentId: 17 }
    : null;
  models.VerificationSession.count = async () => 4;
  models.Asset.count = async () => 6;
  models.Asset.findAll = async (options) => options.attributes[0] === 'location'
    ? [{ location: 'Lab 1' }]
    : [{ status: 'active' }];
  t.after(restoreModels);

  const res = response();
  await collegeController.listCollegeVerification({
    organizationScope: { collegeId: 22, departmentId: 17 },
    query: {
      page: '2',
      limit: '5',
      search: 'QR-1',
      departmentId: '17',
      status: 'in_progress',
      resultState: 'damaged',
      assetStatus: 'active',
      locationId: 'Lab',
    },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(listQuery.limit, 5);
  assert.equal(listQuery.offset, 5);
  assert.equal(listQuery.distinct, true);
  assert.deepEqual(listQuery.where.collegeId, 22);
  assert.equal(listQuery.where.departmentId, 17);
  assert.equal(listQuery.where.status, 'in_progress');
  assert.ok(assetItemQuery.where.state === 'damaged');
  const assetInclude = assetItemQuery.include.find((include) => include.model === models.Asset);
  assert.equal(assetInclude.where.collegeId, 22);
  assert.equal(assetInclude.where.departmentId, 17);
  assert.equal(assetInclude.where.status, 'active');
  assert.deepEqual(assetInclude.where.location, { [Op.like]: '%Lab%' });
  assert.equal(res.body.data.summary.totalAssets, 6);
  assert.equal(res.body.data.summary.verified, 1);
  assert.equal(res.body.data.summary.pending, 1);
  assert.equal(res.body.data.summary.notFound, 1);
  assert.equal(res.body.data.summary.discrepancies, 3);
  assert.deepEqual(res.body.data.summary.statusCounts, {
    verified: 1,
    pending: 1,
    missing: 1,
    wrong_location: 1,
    damaged: 1,
    needs_review: 1,
  });
  assert.equal(res.body.data.pagination.page, 2);
  assert.equal(res.body.data.pagination.total, 0);
});

test('verification result filters reject unsupported states', async (t) => {
  let databaseRead = false;
  models.Department.findAll = async () => { databaseRead = true; return []; };
  t.after(restoreModels);

  const res = response();
  await collegeController.listCollegeVerification({
    organizationScope: { collegeId: 22 },
    query: { resultState: 'administrator' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 400);
  assert.equal(databaseRead, false);
});
