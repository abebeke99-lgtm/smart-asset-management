const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  sequelize,
  ServiceRequest,
  RequestStatusHistory,
  Feedback,
  AuditLog,
  Config,
} = require('../src/models');
const controller = require('../src/controllers/serviceRequestController');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const scopedBySelf = (where, id) => {
  const clauses = where[Op.and] || [];
  return clauses.some((clause) => {
    const or = clause[Op.or] || [];
    return or.some((entry) => entry.reportedBy === id) && or.some((entry) => entry.assignedTo === id);
  });
};

test('createServiceRequest stores reportedBy from the authenticated user (no ReferenceError)', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    create: ServiceRequest.create,
    history: RequestStatusHistory.create,
    audit: AuditLog.create,
  };
  let createdPayload;
  sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} });
  ServiceRequest.create = async (payload) => {
    createdPayload = payload;
    return { id: 321, requestCode: payload.requestCode, ...payload, toJSON: () => ({ id: 321, ...payload, status: 'submitted', routedTo: payload.routedTo }) };
  };
  RequestStatusHistory.create = async () => ({});
  AuditLog.create = async () => ({});
  t.after(() => {
    sequelize.transaction = originals.transaction;
    ServiceRequest.create = originals.create;
    RequestStatusHistory.create = originals.history;
    AuditLog.create = originals.audit;
  });

  const res = response();
  await controller.createServiceRequest({
    user: { id: 77, role: 'staff' },
    body: { title: 'Broken projector', description: 'The projector will not power on', justification: 'Needed for lectures' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(createdPayload.reportedBy, 77);
});

test('staff list is scoped to their own reported and assigned requests', async (t) => {
  const originals = { findAll: ServiceRequest.findAll, findAndCountAll: ServiceRequest.findAndCountAll };
  const observed = [];
  ServiceRequest.findAll = async (options) => { observed.push(options.where); return []; };
  ServiceRequest.findAndCountAll = async (options) => { observed.push(options.where); return { count: 0, rows: [] }; };
  t.after(() => Object.assign(ServiceRequest, originals));

  const res = response();
  await controller.listServiceRequests({ user: { id: 9, role: 'staff' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(observed.length, 2);
  observed.forEach((where) => {
    assert.equal(where.departmentId, undefined);
    assert.equal(scopedBySelf(where, 9), true);
  });
});

test('admin list is not restricted by department or ownership', async (t) => {
  const originals = { findAll: ServiceRequest.findAll, findAndCountAll: ServiceRequest.findAndCountAll };
  const observed = [];
  ServiceRequest.findAll = async (options) => { observed.push(options.where); return []; };
  ServiceRequest.findAndCountAll = async (options) => { observed.push(options.where); return { count: 0, rows: [] }; };
  t.after(() => Object.assign(ServiceRequest, originals));

  const res = response();
  await controller.listServiceRequests({ user: { id: 1, role: 'admin' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(observed[0].departmentId, undefined);
  assert.equal(observed[0][Op.and], undefined);
});

test('college manager list is scoped to their college', async (t) => {
  const originals = { findAll: ServiceRequest.findAll, findAndCountAll: ServiceRequest.findAndCountAll };
  const observed = [];
  ServiceRequest.findAll = async (options) => { observed.push(options.where); return []; };
  ServiceRequest.findAndCountAll = async (options) => { observed.push(options.where); return { count: 0, rows: [] }; };
  t.after(() => Object.assign(ServiceRequest, originals));

  const res = response();
  await controller.listServiceRequests({ user: { id: 4, role: 'college_manager', collegeId: 6 }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  observed.forEach((where) => assert.equal(where.collegeId, 6));
});

test('college manager without a configured college is forbidden', async (t) => {
  const original = ServiceRequest.findAll;
  ServiceRequest.findAll = async () => { assert.fail('must not query without scope'); };
  t.after(() => { ServiceRequest.findAll = original; });

  const res = response();
  await controller.listServiceRequests({ user: { id: 4, role: 'college_manager' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /College scope/);
});

test('staff detail lookup is constrained to their own requests', async (t) => {
  const original = ServiceRequest.findOne;
  let where;
  ServiceRequest.findOne = async (options) => { where = options.where; return null; };
  t.after(() => { ServiceRequest.findOne = original; });

  const res = response();
  await controller.getServiceRequest({ user: { id: 9, role: 'staff' }, params: { id: 44 } }, res, (error) => { throw error; });

  assert.equal(where.id, 44);
  assert.equal(scopedBySelf(where, 9), true);
  assert.equal(res.statusCode, 404);
});

test('staff feedback listing is scoped to feedback they submitted', async (t) => {
  const original = Feedback.findAndCountAll;
  let where;
  Feedback.findAndCountAll = async (options) => { where = options.where; return { count: 0, rows: [] }; };
  t.after(() => { Feedback.findAndCountAll = original; });

  const res = response();
  await controller.listFeedback({ user: { id: 9, role: 'staff' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(where.submittedBy, 9);
});

test('routing options expose max_open_old_tickets without a ReferenceError', async (t) => {
  const original = Config.findByPk;
  Config.findByPk = async () => null;
  t.after(() => { Config.findByPk = original; });

  const res = response();
  await controller.getRoutingOptions({ user: { id: 1, role: 'admin' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.payload.data.max_open_old_tickets, 'number');
});
