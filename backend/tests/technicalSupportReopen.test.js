const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, ServiceRequest, RequestStatusHistory } = require('../src/models');
const controller = require('../src/controllers/technicalSupportController');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const makeTicket = (overrides = {}) => ({
  id: 5,
  requestType: 'support',
  status: 'closed',
  reportedBy: 42,
  assignedTo: 99,
  requestCode: 'TS-2026-000005',
  title: 'Cannot login',
  dueDate: null,
  ...overrides,
  async update(patch) { Object.assign(this, patch); return this; },
  toJSON() { return { id: this.id, requestType: 'support', status: this.status, reportedBy: this.reportedBy, assignedTo: this.assignedTo, requestCode: this.requestCode, title: this.title, dueDate: this.dueDate }; },
});

const installTicket = (t, ticket) => {
  const originals = { transaction: sequelize.transaction, findOne: ServiceRequest.findOne, history: RequestStatusHistory.create };
  let rolledBack = false;
  sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => { rolledBack = true; } });
  ServiceRequest.findOne = async () => ticket;
  RequestStatusHistory.create = async () => ({});
  t.after(() => { sequelize.transaction = originals.transaction; ServiceRequest.findOne = originals.findOne; RequestStatusHistory.create = originals.history; });
  return () => rolledBack;
};

test('the reporter can reopen their own support ticket', async (t) => {
  const ticket = makeTicket({ reportedBy: 42 });
  const wasRolledBack = installTicket(t, ticket);
  const res = response();
  await controller.updateStatus({ user: { id: 42, role: 'staff' }, params: { id: 5 }, body: { status: 'open' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.equal(ticket.status, 'open');
  assert.equal(wasRolledBack(), false);
});

test('an unrelated user cannot reopen a support ticket', async (t) => {
  const ticket = makeTicket({ reportedBy: 42 });
  const wasRolledBack = installTicket(t, ticket);
  const res = response();
  await controller.updateStatus({ user: { id: 7, role: 'staff' }, params: { id: 5 }, body: { status: 'open' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 403);
  assert.equal(ticket.status, 'closed');
  assert.equal(wasRolledBack(), true);
});

test('a support manager can reopen a support ticket', async (t) => {
  const ticket = makeTicket({ reportedBy: 42 });
  const wasRolledBack = installTicket(t, ticket);
  const res = response();
  await controller.updateStatus({ user: { id: 3, role: 'ict_officer' }, params: { id: 5 }, body: { status: 'open' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.equal(ticket.status, 'open');
  assert.equal(wasRolledBack(), false);
});

test('a non-manager cannot set a non-reopen status', async (t) => {
  const ticket = makeTicket({ reportedBy: 42, status: 'open' });
  const wasRolledBack = installTicket(t, ticket);
  const res = response();
  await controller.updateStatus({ user: { id: 42, role: 'staff' }, params: { id: 5 }, body: { status: 'closed' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 403);
  assert.equal(ticket.status, 'open');
  assert.equal(wasRolledBack(), true);
});
