const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const { Notification } = require('../src/models');
const collegeRoutes = require('../src/routes/collegeRoutes');

const collegeRoutesSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');

test('college routes expose a scoped notifications endpoint for college managers', () => {
  assert.match(collegeRoutesSource, /router\.get\(['"]\/notifications['"]/i);
  assert.match(collegeRoutesSource, /req\.organizationScope\.collegeId/i);
  assert.match(collegeRoutesSource, /findAndCountAll|count\s*\(/i);
  assert.match(collegeRoutesSource, /readAll|mark all as read|\/read-all/i);
});

test('college notification listing does not reveal another user private records from the same college', async (t) => {
  const originalFindAndCountAll = Notification.findAndCountAll;
  const originalCount = Notification.count;
  let query;
  Notification.findAndCountAll = async (options) => {
    query = options;
    return { count: 0, rows: [] };
  };
  Notification.count = async () => 0;
  t.after(() => {
    Notification.findAndCountAll = originalFindAndCountAll;
    Notification.count = originalCount;
  });

  const route = collegeRoutes.stack.find((entry) => entry.route?.path === '/notifications' && entry.route.methods.get);
  assert.ok(route, 'college notifications list route exists');
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await route.route.stack.at(-1).handle({
    user: { id: 8, role: 'college_manager' },
    organizationScope: { collegeId: 2 },
    query: {},
  }, res, (error) => { throw error; });

  const clauses = query.where[Op.or];
  assert.ok(clauses.some((clause) => clause.userId === 8));
  assert.ok(clauses.some((clause) => clause.recipientId === 8));
  assert.ok(clauses.some((clause) => clause.scope === 'COLLEGE' && clause.collegeId === 2));
  assert.ok(clauses.some((clause) => clause.scope === 'ROLE' && clause.role === 'college_manager'));
  assert.equal(clauses.some((clause) => Object.keys(clause).length === 1 && clause.collegeId === 2), false);
});

test('college notification deletion requires delete permission, not view permission', async () => {
  const route = collegeRoutes.stack.find((entry) => entry.route?.path === '/notifications/:id' && entry.route.methods.delete);
  assert.ok(route, 'college notification delete route exists');
  const authorize = route.route.stack[0].handle;
  const denied = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json() { return this; },
  };
  await authorize({ user: { id: 8, role: 'college', permissions: ['college.notifications.view'] } }, denied, () => assert.fail('view permission must not authorize deletion'));
  assert.equal(denied.statusCode, 403);
});
