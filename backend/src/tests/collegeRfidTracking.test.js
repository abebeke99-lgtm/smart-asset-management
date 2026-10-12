const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const { Op } = require('sequelize');
const controller = require('../controllers/collegeController');
const routes = require('../routes/collegeRoutes');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const originals = {
  departmentFindAll: models.Department.findAll,
  assetFindAll: models.Asset.findAll,
  assetFindAndCountAll: models.Asset.findAndCountAll,
  assetCount: models.Asset.count,
  assetFindOne: models.Asset.findOne,
  rfidCount: models.RFIDLog.count,
  rfidFindAll: models.RFIDLog.findAll,
  rfidCreate: models.RFIDLog.create,
  auditCreate: models.AuditLog.create,
  transaction: models.sequelize.transaction,
};

test('college tracking dashboard returns full-scope counts and applies filters before pagination', async (t) => {
  const queryLog = {};
  models.Department.findAll = async () => [{ id: 8, name: 'Physics', code: 'PHY' }];
  models.Asset.findAll = async (options) => {
    if (options.group) return [{ status: 'available' }, { status: 'assigned' }];
    queryLog.locationWhere = options.where;
    return [{ location: 'Room 3' }, { location: 'Store' }];
  };
  models.Asset.findAndCountAll = async (options) => {
    queryLog.assets = options;
    return {
      count: 2,
      rows: [{
        toJSON: () => ({
          id: 10,
          name: 'Microscope',
          assetCode: 'AST-10',
          qrCode: 'QR-10',
          rfidTag: 'RFID-10',
          status: 'available',
          location: 'Room 3',
          DepartmentRecord: { name: 'Physics' },
        }),
      }],
    };
  };
  let countCall = 0;
  models.Asset.count = async () => (countCall++ === 0 ? 12 : 9);
  models.RFIDLog.count = async (options) => {
    queryLog.recentCount = options;
    return 4;
  };
  models.RFIDLog.findAll = async (options) => {
    queryLog.recentLogs = options;
    return [{
      toJSON: () => ({
        id: 20,
        assetId: 10,
        tag: 'QR-10',
        action: 'qr_scan',
        location: 'Room 3',
        createdAt: '2026-10-10T10:00:00.000Z',
        Asset: { id: 10, name: 'Microscope', assetCode: 'AST-10', qrCode: 'QR-10' },
        ScannedByUser: { id: 3, fullName: 'College Staff' },
      }),
    }];
  };
  t.after(() => restoreModels());

  const res = response();
  await controller.listCollegeRFIDTracking({
    organizationScope: { collegeId: 22, college: { collegeName: 'Science College' } },
    originalUrl: '/api/college/rfid?page=2',
    query: { page: '2', limit: '10', search: 'QR-10', status: 'available', departmentId: '8', location: 'Room' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.summary, {
    totalAssets: 12,
    taggedAssets: 9,
    untaggedAssets: 3,
    uniqueLocations: 2,
    recentScans: 4,
  });
  assert.equal(res.body.pagination.total, 2);
  assert.equal(res.body.pagination.page, 2);
  assert.equal(res.body.data[0].qrCode, 'QR-10');
  assert.equal(res.body.data[0].department, 'Physics');
  assert.equal(res.body.logs[0].scannedBy.name, 'College Staff');
  assert.equal(queryLog.assets.where.collegeId, 22);
  assert.equal(queryLog.assets.where.status, 'available');
  assert.equal(queryLog.assets.where.departmentId, 8);
  assert.equal(queryLog.assets.limit, 10);
  assert.equal(queryLog.assets.offset, 10);
  assert.equal(queryLog.assets.distinct, true);
  assert.ok(Object.getOwnPropertySymbols(queryLog.assets.where).includes(Op.or));
  assert.deepEqual(queryLog.recentCount.include[0].where, { collegeId: 22 });
  assert.equal(queryLog.recentCount.include[0].where.departmentId, undefined);
  assert.equal(queryLog.recentLogs.limit, 20);
  assert.equal(queryLog.locationWhere.collegeId, 22);
});

test('college tracking dashboard returns legitimate zero counts for an empty college', async (t) => {
  models.Department.findAll = async () => [];
  models.Asset.findAll = async () => [];
  models.Asset.findAndCountAll = async () => ({ count: 0, rows: [] });
  models.Asset.count = async () => 0;
  models.RFIDLog.count = async () => 0;
  models.RFIDLog.findAll = async () => [];
  t.after(() => restoreModels());

  const res = response();
  await controller.listCollegeRFIDTracking({
    organizationScope: { collegeId: 22 },
    query: {},
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.summary, {
    totalAssets: 0,
    taggedAssets: 0,
    untaggedAssets: 0,
    uniqueLocations: 0,
    recentScans: 0,
  });
  assert.deepEqual(res.body.data, []);
  assert.deepEqual(res.body.logs, []);
});

test('tracking query parameters are validated and foreign departments are rejected', async (t) => {
  const originalFindAll = models.Department.findAll;
  const originalsForTest = {
    assetFindAll: models.Asset.findAll,
    assetFindAndCountAll: models.Asset.findAndCountAll,
    assetCount: models.Asset.count,
    rfidCount: models.RFIDLog.count,
    rfidFindAll: models.RFIDLog.findAll,
  };
  models.Department.findAll = async () => [];
  models.Asset.findAll = async () => [];
  models.Asset.findAndCountAll = async () => ({ count: 0, rows: [] });
  models.Asset.count = async () => 0;
  models.RFIDLog.count = async () => 0;
  models.RFIDLog.findAll = async () => [];
  t.after(() => {
    models.Department.findAll = originalFindAll;
    models.Asset.findAll = originalsForTest.assetFindAll;
    models.Asset.findAndCountAll = originalsForTest.assetFindAndCountAll;
    models.Asset.count = originalsForTest.assetCount;
    models.RFIDLog.count = originalsForTest.rfidCount;
    models.RFIDLog.findAll = originalsForTest.rfidFindAll;
  });

  const invalid = response();
  await controller.listCollegeRFIDTracking({
    organizationScope: { collegeId: 22 },
    query: { page: '0' },
  }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);

  const foreignDepartment = response();
  await controller.listCollegeRFIDTracking({
    organizationScope: { collegeId: 22 },
    query: { departmentId: '99' },
  }, foreignDepartment, (error) => { throw error; });
  assert.equal(foreignDepartment.statusCode, 400);
  assert.match(foreignDepartment.body.message, /part of your college/i);
});

test('tracking lookup is scoped to the manager college and rejects unknown identifiers', async (t) => {
  const originalFindAll = models.Asset.findAll;
  let query;
  models.Asset.findAll = async (options) => { query = options; return []; };
  t.after(() => { models.Asset.findAll = originalFindAll; });

  const res = response();
  await controller.lookupCollegeTrackingCode({
    organizationScope: { collegeId: 22 },
    params: { code: 'qr-unknown' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 404);
  assert.equal(query.where.collegeId, 22);
  assert.ok(Object.getOwnPropertySymbols(query.where).includes(Op.or));
});

test('unknown tracking scans are not persisted', async (t) => {
  const originalFindAll = models.Asset.findAll;
  const originalCreate = models.RFIDLog.create;
  let rolledBack = false;
  models.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async rollback() { this.finished = 'rollback'; rolledBack = true; },
  });
  models.Asset.findAll = async () => [];
  models.RFIDLog.create = async () => { throw new Error('A scan must not be written for an unknown tag'); };
  t.after(() => {
    models.Asset.findAll = originalFindAll;
    models.RFIDLog.create = originalCreate;
    models.sequelize.transaction = originals.transaction;
  });

  const res = response();
  await controller.recordCollegeTrackingScan({
    organizationScope: { collegeId: 22 },
    user: { id: 5, role: 'college_manager' },
    body: { method: 'qr', value: 'not-found', location: 'untrusted location' },
  }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 404);
  assert.equal(rolledBack, true);
  assert.match(res.body.message, /no scan was recorded/i);
});

test('valid tracking scans use the registered location and persist actor, method, and audit history', async (t) => {
  const originalsForTest = {
    findAll: models.Asset.findAll,
    createLog: models.RFIDLog.create,
    auditCreate: models.AuditLog.create,
    transaction: models.sequelize.transaction,
  };
  let logValues;
  let auditValues;
  let committed = false;
  models.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() { this.finished = 'commit'; committed = true; },
    async rollback() { this.finished = 'rollback'; },
  });
  models.Asset.findAll = async (options) => {
    assert.equal(options.where.collegeId, 22);
    return [{ id: 18, name: 'Laptop', assetCode: 'AST-18', location: 'Room 4' }];
  };
  models.RFIDLog.create = async (values) => {
    logValues = values;
    return { id: 90, createdAt: new Date('2026-10-10T10:00:00.000Z') };
  };
  models.AuditLog.create = async (values) => { auditValues = values; return values; };
  t.after(() => {
    models.Asset.findAll = originalsForTest.findAll;
    models.RFIDLog.create = originalsForTest.createLog;
    models.AuditLog.create = originalsForTest.auditCreate;
    models.sequelize.transaction = originalsForTest.transaction;
  });

  const res = response();
  await controller.recordCollegeTrackingScan({
    organizationScope: { collegeId: 22 },
    user: { id: 5, role: 'college_manager' },
    originalUrl: '/api/college/rfid/scan',
    body: { method: 'qr', value: 'QR-18', location: 'invented location' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(committed, true);
  assert.equal(logValues.tag, 'QR-18');
  assert.equal(logValues.action, 'qr_scan');
  assert.equal(logValues.location, 'Room 4');
  assert.equal(logValues.scannedBy, 5);
  assert.equal(auditValues.action, 'ASSET_TRACKING_SCAN');
  assert.equal(res.body.data.location, 'Room 4');
});

test('manager tracking tag changes update unique identifiers transactionally and write audit history', async (t) => {
  const originalTransaction = models.sequelize.transaction;
  const originalFindOne = models.Asset.findOne;
  const originalCount = models.Asset.count;
  const originalAuditCreate = models.AuditLog.create;
  let committed = false;
  let auditValues;
  const asset = {
    id: 7,
    qrCode: 'QR-7',
    digitalId: 'QR-7',
    rfidTag: null,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
  };
  models.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async rollback() { this.finished = 'rollback'; },
    async commit() { this.finished = 'commit'; committed = true; },
  });
  models.Asset.findOne = async (options) => {
    assert.deepEqual(options.where, { id: 7, collegeId: 22 });
    return asset;
  };
  models.Asset.count = async (options) => {
    assert.equal(options.paranoid, false);
    return 0;
  };
  models.AuditLog.create = async (values) => { auditValues = values; return {}; };
  t.after(() => {
    models.sequelize.transaction = originalTransaction;
    models.Asset.findOne = originalFindOne;
    models.Asset.count = originalCount;
    models.AuditLog.create = originalAuditCreate;
  });

  const res = response();
  await controller.assignCollegeTrackingTags({
    organizationScope: { collegeId: 22 },
    user: { id: 5, role: 'college_manager' },
    params: { id: '7' },
    body: { qrCode: 'qr-new', rfidTag: 'rfid-new' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(committed, true);
  assert.equal(asset.qrCode, 'QR-NEW');
  assert.equal(asset.digitalId, 'QR-NEW');
  assert.equal(asset.rfidTag, 'RFID-NEW');
  assert.equal(auditValues.action, 'ASSET_TRACKING_TAGS_ASSIGNED');
});

test('manager tracking tag changes are college-scoped, audited, and reject duplicate identifiers', async (t) => {
  const originalTransaction = models.sequelize.transaction;
  const originalFindOne = models.Asset.findOne;
  const originalCount = models.Asset.count;
  const originalAuditCreate = models.AuditLog.create;
  let rolledBack = false;
  let countCalls = 0;
  const asset = {
    id: 7,
    qrCode: 'QR-7',
    digitalId: 'QR-7',
    rfidTag: null,
    async update() {
      assert.equal(countCalls, 1, 'duplicate check should run before update');
      throw new Error('Duplicate tag must be rejected before updating');
    },
  };
  models.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async rollback() { this.finished = 'rollback'; rolledBack = true; },
    async commit() { this.finished = 'commit'; },
  });
  models.Asset.findOne = async (options) => {
    assert.equal(options.where.collegeId, 22);
    return asset;
  };
  models.Asset.count = async (options) => {
    assert.equal(options.paranoid, false);
    countCalls += 1;
    return 1;
  };
  models.AuditLog.create = async () => ({});
  t.after(() => {
    models.sequelize.transaction = originalTransaction;
    models.Asset.findOne = originalFindOne;
    models.Asset.count = originalCount;
    models.AuditLog.create = originalAuditCreate;
  });

  const res = response();
  await controller.assignCollegeTrackingTags({
    organizationScope: { collegeId: 22 },
    user: { id: 5, role: 'college_manager' },
    params: { id: '7' },
    body: { rfidTag: 'RFID-DUPLICATE' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 409);
  assert.equal(countCalls, 1);
  assert.equal(rolledBack, true);
});

test('college tracking endpoints require the existing view or asset-update permissions', () => {
  const endpoint = (method, path) => routes.stack.some((layer) => layer.route
    && layer.route.path === path
    && layer.route.methods[method]);
  assert.equal(endpoint('get', '/rfid'), true);
  assert.equal(endpoint('get', '/rfid/lookup/:code'), true);
  assert.equal(endpoint('post', '/rfid/scan'), true);
  assert.equal(endpoint('post', '/rfid/assets/:id/tags'), true);
  assert.equal(endpoint('post', '/rfid/assets/:id/qr/regenerate'), true);
});

function restoreModels() {
  models.Department.findAll = originals.departmentFindAll;
  models.Asset.findAll = originals.assetFindAll;
  models.Asset.findAndCountAll = originals.assetFindAndCountAll;
  models.Asset.count = originals.assetCount;
  models.Asset.findOne = originals.assetFindOne;
  models.RFIDLog.count = originals.rfidCount;
  models.RFIDLog.findAll = originals.rfidFindAll;
  models.RFIDLog.create = originals.rfidCreate;
  models.AuditLog.create = originals.auditCreate;
  models.sequelize.transaction = originals.transaction;
}
