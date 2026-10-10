const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, Asset, ServiceRequest, Role } = require('../models');
const controller = require('../controllers/serviceRequestController');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('Department Head list ignores a caller-supplied department filter and scopes both list queries', async (t) => {
  const originals = { findAll: ServiceRequest.findAll, findAndCountAll: ServiceRequest.findAndCountAll };
  const observed = [];
  ServiceRequest.findAll = async (options) => { observed.push(options.where); return []; };
  ServiceRequest.findAndCountAll = async (options) => { observed.push(options.where); return { count: 0, rows: [] }; };
  t.after(() => Object.assign(ServiceRequest, originals));
  const res = response();
  await controller.listServiceRequests({ user: { id: 7, role: 'department_head', departmentId: 12 }, query: { department_id: '99' } }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(observed.map((where) => where.departmentId), [12, 12]);
});

test('Department Head detail lookup is constrained to its department', async (t) => {
  const original = ServiceRequest.findOne;
  let where;
  ServiceRequest.findOne = async (options) => { where = options.where; return null; };
  t.after(() => { ServiceRequest.findOne = original; });
  const res = response();
  await controller.getServiceRequest({ user: { role: 'department_head', departmentId: 12 }, params: { id: 44 } }, res, (err) => { throw err; });
  assert.deepEqual(where, { id: 44, departmentId: 12 });
  assert.equal(res.statusCode, 404);
});

test('Department Head without configured scope is forbidden and does not query requests', async (t) => {
  const original = ServiceRequest.findOne;
  ServiceRequest.findOne = async () => { assert.fail('must not query without scope'); };
  t.after(() => { ServiceRequest.findOne = original; });
  const res = response();
  await controller.getServiceRequest({ user: { role: 'department_head' }, params: { id: 44 } }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /Department scope/);
});

test('Department Head cannot create a request for an asset in another department', async (t) => {
  const originals = { transaction: sequelize.transaction, findAsset: Asset.findByPk, findRoles: Role.findAll };
  let rolledBack = false;
  sequelize.transaction = async () => ({ rollback: async () => { rolledBack = true; } });
  Asset.findByPk = async () => ({ id: 55, departmentId: 99, category: 'Network' });
  Role.findAll = async () => [{ id: 5, name: 'ict_officer', displayName: 'ICT Officer' }];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Asset.findByPk = originals.findAsset;
    Role.findAll = originals.findRoles;
  });
  const res = response();
  await controller.createServiceRequest({
    user: { id: 7, role: 'department_head', departmentId: 12 },
    body: { title: 'Repair', description: 'Network issue', justification: 'Needed for teaching', requestType: 'ict', assetId: 55 },
  }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /outside your department/);
  assert.equal(rolledBack, true);
});

test('Department Head cannot override its department in the create payload', async (t) => {
  const original = sequelize.transaction;
  let rolledBack = false;
  sequelize.transaction = async () => ({ rollback: async () => { rolledBack = true; } });
  t.after(() => { sequelize.transaction = original; });
  const res = response();
  await controller.createServiceRequest({
    user: { id: 7, role: 'department_head', departmentId: 12 },
    body: { department_id: 99, title: 'Repair', description: 'Network issue', justification: 'Needed for teaching' },
  }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 403);
  assert.equal(rolledBack, true);
});

test('Department Head cancellation lookup remains inside its department', async (t) => {
  const originals = { transaction: sequelize.transaction, findOne: ServiceRequest.findOne };
  let where;
  sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, rollback: async () => {}, commit: async () => {} });
  ServiceRequest.findOne = async (options) => { where = options.where; return null; };
  t.after(() => { sequelize.transaction = originals.transaction; ServiceRequest.findOne = originals.findOne; });
  const res = response();
  await controller.cancel({ user: { id: 7, role: 'department_head', departmentId: 12 }, params: { id: 44 }, body: {} }, res, (err) => { throw err; });
  assert.deepEqual(where, { id: 44, departmentId: 12 });
  assert.equal(res.statusCode, 404);
});

test('Department Head cannot submit feedback for a request in another department', async (t) => {
  const original = ServiceRequest.findOne;
  let where;
  ServiceRequest.findOne = async (options) => { where = options.where; return null; };
  t.after(() => { ServiceRequest.findOne = original; });
  const res = response();
  await controller.createFeedback({ user: { id: 7, role: 'department_head', departmentId: 12 }, params: { id: 44 }, body: { rating: 5 } }, res, (err) => { throw err; });
  assert.deepEqual(where, { id: 44, departmentId: 12 });
  assert.equal(res.statusCode, 404);
});
