const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  sequelize,
  Config,
  ServiceRequest,
  RequestStatusHistory,
  Department,
  College,
  User,
  SupportTicketComment,
} = require('../models');
const serviceRequestController = require('../controllers/serviceRequestController');
const departmentTickets = require('../controllers/departmentTicketController');
const escalationService = require('../services/serviceRequestEscalationService');

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('the configured escalation threshold defaults to and permits 72 hours', async (t) => {
  const original = Config.findByPk;
  Config.findByPk = async () => null;
  t.after(() => { Config.findByPk = original; });

  assert.equal(await escalationService.getEscalationHours(), 72);
});

test('unacknowledged tickets escalate at the actual 72-hour timestamp and notify scoped recipients', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    config: Config.findByPk,
    findAll: ServiceRequest.findAll,
    findOne: ServiceRequest.findOne,
    historyCreate: RequestStatusHistory.create,
    departmentFind: Department.findByPk,
    collegeFind: College.findByPk,
    userFindAll: User.findAll,
  };
  const now = new Date('2026-10-06T12:00:00.000Z');
  const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const tickets = [
    {
      id: 41,
      requestCode: 'SR-41',
      title: 'Projector repair',
      createdAt: cutoff,
      acknowledgedAt: null,
      status: 'submitted',
      escalated: false,
      departmentId: 12,
      collegeId: 5,
      assignedTo: 30,
      update: async function update(values) { Object.assign(this, values); },
    },
    {
      id: 42,
      createdAt: new Date(cutoff.getTime() + 1),
      acknowledgedAt: null,
      status: 'submitted',
      escalated: false,
      departmentId: 12,
      collegeId: 5,
    },
    {
      id: 43,
      createdAt: new Date(cutoff.getTime() - 1),
      acknowledgedAt: new Date(now.getTime() - 1000),
      status: 'submitted',
      escalated: false,
      departmentId: 12,
      collegeId: 5,
    },
  ];
  let history;
  let notification;
  let escalatedQuery;
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    commit: async function commit() { this.finished = 'commit'; },
    rollback: async function rollback() { this.finished = 'rollback'; },
  };
  sequelize.transaction = async () => ({ ...transaction, LOCK: transaction.LOCK });
  Config.findByPk = async () => null;
  ServiceRequest.findAll = async ({ where }) => {
    escalatedQuery = where;
    const dueAt = where.createdAt[Op.lte];
    return tickets
      .filter((ticket) => ticket.createdAt <= dueAt && ticket.acknowledgedAt === null && ticket.status === 'submitted' && !ticket.escalated)
      .map(({ id }) => ({ id }));
  };
  ServiceRequest.findOne = async ({ where }) => tickets.find((ticket) => (
    ticket.id === where.id
      && ticket.createdAt <= where.createdAt[Op.lte]
      && ticket.acknowledgedAt === null
      && ticket.status === 'submitted'
      && !ticket.escalated
  )) || null;
  RequestStatusHistory.create = async (values) => { history = values; };
  Department.findByPk = async () => ({ headId: 50 });
  College.findByPk = async () => ({ managerId: 60 });
  User.findAll = async () => [{ id: 70 }];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Config.findByPk = originals.config;
    ServiceRequest.findAll = originals.findAll;
    ServiceRequest.findOne = originals.findOne;
    RequestStatusHistory.create = originals.historyCreate;
    Department.findByPk = originals.departmentFind;
    College.findByPk = originals.collegeFind;
    User.findAll = originals.userFindAll;
  });

  const result = await escalationService.runServiceRequestEscalation(now, async (payload) => {
    notification = payload;
    return { skipped: false };
  });

  assert.deepEqual(escalatedQuery.acknowledgedAt, null);
  assert.equal(escalatedQuery.createdAt[Op.lte].toISOString(), cutoff.toISOString());
  assert.equal(escalatedQuery.status, 'submitted');
  assert.deepEqual(result.escalated.map((ticket) => ticket.id), [41]);
  assert.equal(tickets[0].status, 'escalated');
  assert.equal(tickets[0].escalated, true);
  assert.equal(tickets[0].escalatedAt.toISOString(), now.toISOString());
  assert.equal(tickets[0].escalatedTo, 50);
  assert.equal(history.newStatus, 'escalated');
  assert.match(history.comment, /72 hours/);
  assert.equal(notification.event, 'service_request_escalated');
  assert.deepEqual(notification.userIds.sort(), [30, 50, 60, 70]);
});

test('the >10 old unacknowledged ticket restriction uses the configured threshold and department', async (t) => {
  const originals = { config: Config.findByPk, count: ServiceRequest.count };
  let query;
  Config.findByPk = async () => ({ value: JSON.stringify({ escalationHours: 72 }) });
  ServiceRequest.count = async (options) => {
    query = options;
    return 10;
  };
  t.after(() => {
    Config.findByPk = originals.config;
    ServiceRequest.count = originals.count;
  });

  await serviceRequestController.verifyTicketLimit(8, 12);
  assert.equal(query.where.departmentId, 12);
  assert.ok(query.where.status[Op.in].includes('escalated'));
  assert.equal(query.where.createdAt[Op.lt] instanceof Date, true);

  ServiceRequest.count = async () => 11;
  await assert.rejects(serviceRequestController.verifyTicketLimit(8, 12), { statusCode: 409 });
});

test('department escalated-ticket listing cannot be widened to another department', async (t) => {
  const originals = {
    runEscalation: escalationService.runServiceRequestEscalation,
    findAndCountAll: ServiceRequest.findAndCountAll,
    commentsFindAll: SupportTicketComment.findAll,
  };
  let query;
  escalationService.runServiceRequestEscalation = async () => ({ escalated: [], notificationFailures: [] });
  ServiceRequest.findAndCountAll = async (options) => {
    query = options;
    return { count: 0, rows: [] };
  };
  SupportTicketComment.findAll = async () => [];
  t.after(() => {
    escalationService.runServiceRequestEscalation = originals.runEscalation;
    ServiceRequest.findAndCountAll = originals.findAndCountAll;
    SupportTicketComment.findAll = originals.commentsFindAll;
  });

  const res = makeResponse();
  await departmentTickets.listEscalatedTickets({
    organizationScope: { departmentId: 12 },
    query: { departmentId: 34, page: 1, limit: 10 },
  }, res, (error) => { throw error; });

  assert.equal(query.where.departmentId, 12);
  assert.equal(query.where.escalated, true);
  assert.equal(Object.hasOwn(query.where, 'departmentId') && query.where.departmentId === 34, false);
  assert.deepEqual(res.payload.data, []);
});
