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
  Role,
} = require('../src/models');
const notificationService = require('../src/services/notificationService');
const notificationCalls = [];
notificationService.createBulkNotification = async (payload) => {
  notificationCalls.push(payload);
  return { recipientCount: 1 };
};
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
    count: ServiceRequest.count,
    history: RequestStatusHistory.create,
    audit: AuditLog.create,
    findRoles: Role.findAll,
  };
  let createdPayload;
  sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} });
  ServiceRequest.count = async () => 0;
  Role.findAll = async () => [{ id: 9, name: 'maintenance', displayName: 'Maintenance Coordinator', description: 'Maintenance support' }];
  ServiceRequest.create = async (payload) => {
    createdPayload = payload;
    return { id: 321, requestCode: payload.requestCode, ...payload, toJSON: () => ({ id: 321, ...payload, status: 'submitted', routedTo: payload.routedTo }) };
  };
  RequestStatusHistory.create = async () => ({});
  AuditLog.create = async () => ({});
  t.after(() => {
    sequelize.transaction = originals.transaction;
    ServiceRequest.create = originals.create;
    ServiceRequest.count = originals.count;
    RequestStatusHistory.create = originals.history;
    AuditLog.create = originals.audit;
    Role.findAll = originals.findRoles;
  });

  const res = response();
  await controller.createServiceRequest({
    user: { id: 77, role: 'staff' },
    body: { title: 'Broken projector', description: 'The projector will not power on', justification: 'Needed for lectures' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(createdPayload.reportedBy, 77);
  assert.equal(createdPayload.responsibleRole, 'maintenance');
  assert.equal(res.payload.data.status, 'submitted');
  assert.equal(res.payload.notificationStatus, 'sent');
  assert.equal(notificationCalls.at(-1).recipientType, 'role');
  assert.deepEqual(notificationCalls.at(-1).roles, ['maintenance']);
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

test('service processor list is scoped to requests routed to its responsible role', async (t) => {
  const originals = { findAll: ServiceRequest.findAll, findAndCountAll: ServiceRequest.findAndCountAll };
  let where;
  ServiceRequest.findAll = async (options) => { where = options.where; return []; };
  ServiceRequest.findAndCountAll = async (options) => { where = options.where; return { count: 0, rows: [] }; };
  t.after(() => Object.assign(ServiceRequest, originals));

  const res = response();
  await controller.listServiceRequests({ user: { id: 28, role: 'ict_officer' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  const clauses = where[Op.and] || [];
  assert(clauses.some((clause) => (clause[Op.or] || []).some((condition) => condition.responsibleRole === 'ict_officer')));
  assert(clauses.some((clause) => (clause[Op.or] || []).some((condition) => condition.routedTo === 'ictd')));
});

test('inactive or unknown role identifiers cannot be assigned during request creation', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    create: ServiceRequest.create,
    count: ServiceRequest.count,
    findRoles: Role.findAll,
    findRole: Role.findOne,
  };
  let created = false;
  sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} });
  ServiceRequest.count = async () => 0;
  ServiceRequest.create = async () => { created = true; };
  Role.findAll = async () => [{ id: 9, name: 'maintenance', displayName: 'Maintenance Coordinator' }];
  Role.findOne = async () => null;
  t.after(() => {
    sequelize.transaction = originals.transaction;
    ServiceRequest.create = originals.create;
    ServiceRequest.count = originals.count;
    Role.findAll = originals.findRoles;
    Role.findOne = originals.findRole;
  });

  const res = response();
  await controller.createServiceRequest({
    user: { id: 77, role: 'staff' },
    body: {
      title: 'Repair the classroom',
      description: 'The ceiling light is broken.',
      justification: 'The classroom is in use.',
      category: 'Maintenance',
      responsibleRoleId: 999,
    },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 404);
  assert.match(res.payload.message, /not found or is inactive/i);
  assert.equal(created, false);
});

test('service processor cannot change status on another role-targeted request', async (t) => {
  const originals = { transaction: sequelize.transaction, findOne: ServiceRequest.findOne };
  let rolledBack = false;
  sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => {},
    rollback: async () => { rolledBack = true; },
  });
  ServiceRequest.findOne = async () => ({
    reportedBy: 5,
    responsibleRole: 'maintenance',
    routedTo: 'maintenance',
    assignedTo: null,
    status: 'submitted',
    departmentId: null,
    collegeId: null,
  });
  t.after(() => {
    sequelize.transaction = originals.transaction;
    ServiceRequest.findOne = originals.findOne;
  });

  const res = response();
  await controller.setStatus({
    user: { id: 28, role: 'ict_officer' },
    params: { id: '44' },
    body: { status: 'scheduled' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.equal(rolledBack, true);
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
  const originalRoles = Role.findAll;
  Config.findByPk = async () => null;
  Role.findAll = async () => [{ id: 9, name: 'maintenance', displayName: 'Maintenance Coordinator', description: 'Maintenance support' }];
  t.after(() => {
    Config.findByPk = original;
    Role.findAll = originalRoles;
  });

  const res = response();
  await controller.getRoutingOptions({ user: { id: 1, role: 'admin' }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.payload.data.max_open_old_tickets, 'number');
  assert.equal(res.payload.data.roles_by_category.Facilities[0].id, 9);
});
