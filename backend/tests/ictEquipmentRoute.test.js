const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const controller = require('../src/controllers/ictAssetController');
const { Asset } = require('../src/models');

const originalFindAndCountAll = Asset.findAndCountAll;
const originalFindAll = Asset.findAll;
const originalFindOne = Asset.findOne;

const buildReq = (overrides = {}) => ({
  user: { id: 1, role: 'admin' },
  query: {},
  ...overrides,
});

test('ICT equipment list returns normalized database summary totals for all dashboard cards', async () => {
  Asset.findAndCountAll = async () => ({
    count: 4,
    rows: [
      { id: 1, name: 'Laptop 01', status: 'available', condition: 'Good', category: 'Laptop', department: 'IT', location: 'Lab' },
      { id: 2, name: 'Desktop 01', status: 'assigned', condition: 'Good', category: 'Computer', department: 'IT', location: 'Office' },
      { id: 3, name: 'Printer 01', status: 'maintenance', condition: 'Fair', category: 'Printer', department: 'IT', location: 'Office' },
      { id: 4, name: 'Monitor 01', status: 'damaged', condition: 'Poor', category: 'Monitor', department: 'IT', location: 'Store' },
    ],
  });

  Asset.findAll = async ({ attributes } = {}) => {
    if (Array.isArray(attributes) && attributes.includes('status')) {
      return [
        { status: 'available' },
        { status: 'assigned' },
        { status: 'maintenance' },
        { status: 'damaged' },
      ];
    }
    return [];
  };

  const req = buildReq();
  const res = {
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };

  await controller.listIctEquipment(req, res, () => {
    throw new Error('next should not be called');
  });

  assert.ok(res.payload.summary, 'expected summary payload');
  assert.equal(res.payload.summary.total, 4);
  assert.equal(res.payload.summary.available, 1);
  assert.equal(res.payload.summary.assigned, 1);
  assert.equal(res.payload.summary.maintenance, 1);
  assert.equal(res.payload.summary.repair, 1);
  assert.equal(res.payload.summary.retired, 0);
  assert.equal(res.payload.equipment.length, 4);
});

test('IT equipment routes use scoped CRUD handlers on the central inventory asset controller', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/equipment', \.\.\.scopedIctAccess, controller\.listIctEquipment\)/);
  assert.match(routeSource, /router\.get\('\/equipment\/:id', \.\.\.scopedIctAccess, controller\.getIctEquipment\)/);
  assert.match(routeSource, /router\.post\('\/equipment', \.\.\.scopedIctAccess, controller\.createIctEquipment\)/);
  assert.match(routeSource, /router\.put\('\/equipment\/:id', \.\.\.scopedIctAccess, controller\.updateIctEquipment\)/);
  assert.match(routeSource, /router\.delete\('\/equipment\/:id', \.\.\.scopedIctAccess, controller\.deleteIctEquipment\)/);
  assert.ok(routeSource.indexOf("router.get('/equipment/options'") < routeSource.indexOf("router.get('/equipment/:id'"));
});

test('IT equipment creation rejects incomplete records before attempting database writes', async () => {
  const req = { body: {}, user: { id: 3, role: 'admin' } };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.createIctEquipment(req, res, (error) => {
    throw error || new Error('Unexpected error middleware call');
  });

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.message, 'Asset name is required');
});

test('IT equipment creation rejects a serial number already used by a central inventory asset', async () => {
  Asset.findOne = async () => ({ id: 9 });
  const req = {
    body: {
      name: 'Workstation',
      category: 'Computing',
      serialNumber: 'SERIAL-9',
      quantity: 1,
      campusId: 1,
      status: 'Available',
      condition: 'Functional',
    },
    user: { id: 3, role: 'admin' },
  };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.createIctEquipment(req, res, (error) => {
    throw error || new Error('Unexpected error middleware call');
  });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, 'Serial number already exists');
});

test('IT equipment list applies all filters, sorting, pagination, and clamps an out-of-range page', async () => {
  const queries = [];
  Asset.findAndCountAll = async (query) => {
    queries.push(query);
    return { count: 21, rows: [] };
  };
  Asset.findAll = async () => [];
  const req = buildReq({
    query: {
      search: 'Room 204',
      category: 'Display',
      status: 'Under Maintenance',
      condition: 'Needs Repair',
      page: '9',
      limit: '10',
      sortBy: 'name',
      sortOrder: 'ASC',
    },
  });
  const res = {
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };

  await controller.listIctEquipment(req, res, (error) => {
    throw error || new Error('Unexpected error middleware call');
  });

  assert.equal(queries.length, 2);
  assert.equal(queries[0].offset, 80);
  assert.equal(queries[1].offset, 20);
  assert.equal(queries[1].limit, 10);
  assert.deepEqual(queries[1].order, [['name', 'ASC']]);
  assert.equal(queries[1].where[Op.and].length, 4);
  const searchFields = queries[1].where[Op.and][0][Op.or].flatMap((entry) => Object.keys(entry));
  for (const field of ['$College.collegeName$', '$CampusRecord.campusName$', '$BuildingRecord.buildingName$', '$RoomRecord.roomName$']) {
    assert.ok(searchFields.includes(field));
  }
  assert.deepEqual(res.payload.pagination, { page: 3, limit: 10, total: 21, pages: 3, totalPages: 3 });
});

test.afterEach(() => {
  Asset.findAndCountAll = originalFindAndCountAll;
  Asset.findAll = originalFindAll;
  Asset.findOne = originalFindOne;
});
