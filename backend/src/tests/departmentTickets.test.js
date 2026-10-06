const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { ServiceRequest, SupportTicketComment } = require('../models');
const controller = require('../controllers/departmentTicketController');
const departmentWorkspaceRoutes = require('../routes/departmentWorkspaceRoutes');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('ticket list always enforces department scope and supports monitor filters', async (t) => {
  const original = ServiceRequest.findAndCountAll;
  let query;
  ServiceRequest.findAndCountAll = async (options) => {
    query = options;
    return { rows: [], count: 0 };
  };
  t.after(() => { ServiceRequest.findAndCountAll = original; });

  const response = makeResponse();
  await controller.listTickets({
    organizationScope: { departmentId: 12 },
    query: { departmentId: '99', status: 'in-progress', priority: 'high', search: 'network', page: '2', limit: '5' },
  }, response, (error) => { throw error; });

  assert.equal(query.where.departmentId, 12);
  assert.equal(query.where.status, 'in-progress');
  assert.equal(query.where.priority, 'high');
  assert.ok(query.where[Op.or].some((field) => field.title));
  assert.equal(query.limit, 5);
  assert.equal(query.offset, 5);
  assert.equal(response.payload.total, 0);
});

test('ticket list rejects absent department scope and invalid filters', async (t) => {
  const original = ServiceRequest.findAndCountAll;
  let queryCount = 0;
  ServiceRequest.findAndCountAll = async (options) => {
    queryCount += 1;
    return { rows: [], count: 0 };
  };
  t.after(() => { ServiceRequest.findAndCountAll = original; });

  const noScope = makeResponse();
  await controller.listTickets({ organizationScope: {}, query: {} }, noScope, (error) => { throw error; });
  assert.equal(noScope.statusCode, 403);

  const response = makeResponse();
  await controller.listTickets({ organizationScope: { departmentId: 12 }, query: { status: 'all-access' } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /status filter/i);
  assert.equal(queryCount, 0);
});

test('ticket details are limited to the resolved department and return monitoring fields', async (t) => {
  const original = ServiceRequest.findOne;
  const originalComments = SupportTicketComment.findAll;
  let query;
  const ticket = {
    Assignee: { fullName: 'Alem Bekele' },
    toJSON: () => ({
      id: 4,
      requestCode: 'SR-2026-001',
      title: 'Repair network switch',
      category: 'Network',
      description: 'The switch is offline',
      requestType: 'ict',
      priority: 'high',
      status: 'scheduled',
      createdAt: '2026-10-01T09:00:00.000Z',
      acknowledgedAt: '2026-10-01T10:00:00.000Z',
      dueDate: '2026-10-03T10:00:00.000Z',
      escalated: true,
      escalatedAt: '2026-10-02T10:00:00.000Z',
      escalationReason: 'Past response deadline',
    }),
  };
  ServiceRequest.findOne = async (options) => { query = options; return ticket; };
  SupportTicketComment.findAll = async () => [];
  t.after(() => {
    ServiceRequest.findOne = original;
    SupportTicketComment.findAll = originalComments;
  });

  const response = makeResponse();
  await controller.getTicket({ organizationScope: { departmentId: 12 }, params: { id: '4' } }, response, (error) => { throw error; });
  assert.deepEqual(query.where, { id: '4', departmentId: 12 });
  assert.equal(response.payload.data.ticketId, 'SR-2026-001');
  assert.equal(response.payload.data.statusLabel, 'Scheduled');
  assert.equal(response.payload.data.assignedTechnician, 'Alem Bekele');
  assert.equal(response.payload.data.escalationState, 'Escalated');
  assert.equal(response.payload.data.acknowledgedAt, '2026-10-01T10:00:00.000Z');
  assert.equal(response.payload.data.dueDate, '2026-10-03T10:00:00.000Z');
});

test('ticket list and detail routes are read-only', () => {
  const ticketRoutes = departmentWorkspaceRoutes.stack
    .filter((layer) => ['/tickets', '/tickets/:id'].includes(layer.route?.path))
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
  assert.deepEqual(ticketRoutes, [
    { path: '/tickets', methods: ['get'] },
    { path: '/tickets/:id', methods: ['get'] },
  ]);
});
