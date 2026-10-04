const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const models = require('../models');
const controller = require('../controllers/ictNetworkEquipmentController');

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const stub = (model, method, replacement) => {
  const original = model[method];
  model[method] = replacement;
  return () => { model[method] = original; };
};

const networkUser = { id: 9, role: 'ict_officer' };
const networkScope = { collegeId: 5 };
const validEquipment = {
  name: 'Core Switch',
  type: 'Switch',
  assetTag: 'NET-01',
  serialNumber: 'SER-01',
  ipAddress: '192.168.1.2',
  macAddress: '00:1A:2B:3C:4D:5E',
  status: 'active',
  condition: 'good',
  campus: 'Main Campus',
  building: 'ICT Building',
  room: 'Server Room',
  location: 'Rack 2',
  purchaseDate: '2024-01-10',
  warrantyExpiry: '2027-01-10',
  description: 'Core network switch',
  assignedToId: '',
};

const makeAsset = (id, initialValues = {}) => {
  const state = { id, ...initialValues };
  return {
    id,
    state,
    toJSON: () => ({
      ...state,
      specifications: state.specifications || {},
    }),
    async update(values) {
      Object.assign(state, values);
      return this;
    },
    async destroy() {
      state.deleted = true;
    },
  };
};

test('network equipment list returns database rows, assignment summary, and pagination', async () => {
  const restore = [
    stub(models.Assignment, 'findAll', async () => []),
    stub(models.User, 'findAll', async () => []),
    stub(models.Asset, 'findAndCountAll', async () => ({
      rows: [{ toJSON: () => ({
        id: 12,
        name: 'Core Switch',
        category: 'Switch',
        assetCode: 'NET-12',
        status: 'active',
        condition: 'good',
        specifications: { ipAddress: '192.168.1.12', macAddress: '00:1A:2B:3C:4D:5E' },
      }) }],
      count: 1,
    })),
    stub(models.Asset, 'findAll', async () => [{ id: 12, status: 'active' }]),
  ];
  try {
    const res = response();
    let nextError;
    await controller.listNetworkEquipment({
      user: networkUser,
      organizationScope: networkScope,
      query: { search: '192.168.1.12', page: '2', limit: '10' },
    }, res, (error) => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data[0].ipAddress, '192.168.1.12');
    assert.equal(res.body.data[0].assignment, 'Unassigned');
    assert.deepEqual(res.body.summary, { total: 1, active: 1, assigned: 0, maintenance: 0, repair: 0 });
    assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 1, totalPages: 1 });
    assert.deepEqual(res.body.options.types, [
      'Switch', 'Router', 'Firewall', 'Access Point', 'Network Rack', 'Modem', 'Server', 'Other Network Equipment',
    ]);
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});

test('network equipment CRUD uses the shared asset register and validates device identifiers', async () => {
  let asset = null;
  let persistedValues;
  const restore = [
    stub(models.sequelize, 'transaction', async (work) => work({})),
    stub(models.Asset, 'create', async (values) => {
      persistedValues = values;
      asset = makeAsset(42, values);
      return asset;
    }),
    stub(models.Asset, 'findOne', async () => asset),
    stub(models.Assignment, 'findOne', async () => null),
    stub(models.Assignment, 'create', async () => null),
    stub(models.AuditLog, 'create', async () => ({ id: 1 })),
  ];
  try {
    const req = { user: networkUser, organizationScope: networkScope, body: validEquipment, params: { id: '42' } };
    const createResponseValue = response();
    await controller.createNetworkEquipment(req, createResponseValue, assert.fail);
    assert.equal(createResponseValue.statusCode, 201);
    assert.equal(createResponseValue.body.data.id, 42);
    assert.equal(persistedValues.collegeId, networkScope.collegeId);
    assert.equal(persistedValues.category, 'Switch');
    assert.equal(persistedValues.specifications.ipAddress, '192.168.1.2');
    assert.equal(persistedValues.specifications.macAddress, '00:1A:2B:3C:4D:5E');

    const readResponse = response();
    await controller.getNetworkEquipment({ ...req, body: {}, params: { id: '42' } }, readResponse, assert.fail);
    assert.equal(readResponse.body.data.name, 'Core Switch');

    const updateResponse = response();
    await controller.updateNetworkEquipment({
      ...req,
      body: { ...validEquipment, name: 'Updated Core Switch', ipAddress: '192.168.1.3' },
    }, updateResponse, assert.fail);
    assert.equal(updateResponse.body.data.name, 'Updated Core Switch');
    assert.equal(updateResponse.body.data.ipAddress, '192.168.1.3');

    const deleteResponse = response();
    await controller.deleteNetworkEquipment({ ...req, body: {} }, deleteResponse, assert.fail);
    assert.equal(deleteResponse.body.success, true);
    assert.equal(asset.state.deleted, true);

    const invalidResponse = response();
    await controller.createNetworkEquipment({
      ...req,
      body: { ...validEquipment, ipAddress: '300.1.2.3' },
    }, invalidResponse, assert.fail);
    assert.equal(invalidResponse.statusCode, 422);
    assert.match(invalidResponse.body.message, /valid IPv4 or IPv6/);
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});

test('network equipment search filters by network metadata in specifications', async () => {
  const restore = [
    stub(models.Assignment, 'findAll', async () => []),
    stub(models.User, 'findAll', async () => []),
    stub(models.Asset, 'findAndCountAll', async () => ({ rows: [], count: 0 })),
    stub(models.Asset, 'findAll', async () => []),
  ];
  try {
    let listQuery;
    const original = models.Asset.findAndCountAll;
    models.Asset.findAndCountAll = async (query) => {
      listQuery = query;
      return original(query);
    };
    const res = response();
    await controller.listNetworkEquipment({
      user: networkUser,
      organizationScope: networkScope,
      query: { search: 'AA:BB:CC:DD:EE:FF', location: 'Main Campus' },
    }, res, assert.fail);
    const searchOr = listQuery.where[Op.and][0][Op.or];
    assert.equal(searchOr.length, 8);
    assert.ok(listQuery.where[Op.and].length >= 2);
    assert.equal(res.body.pagination.total, 0);
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});
