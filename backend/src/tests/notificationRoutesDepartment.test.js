const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Notification } = require('../models');
const notificationRoutes = require('../routes/notificationRoutes');

const endpoint = (method, path) => {
  const layer = notificationRoutes.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} route exists`);
  assert.ok(layer.route.stack.length >= 3, 'endpoint is protected by authentication and role middleware');
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

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

test('notification history filters to the logged-in user and explicit shared scopes', async (t) => {
  const originalFindAll = Notification.findAll;
  const originalCount = Notification.count;
  let query;
  Notification.findAll = async (options) => {
    query = options;
    return [{
      id: 33,
      title: 'Approval update',
      read: true,
      readAt: new Date('2026-10-06T12:00:00.000Z'),
      createdAt: new Date('2026-10-06T11:00:00.000Z'),
      toJSON() {
        return {
          id: this.id,
          title: this.title,
          read: this.read,
          readAt: this.readAt,
          createdAt: this.createdAt,
        };
      },
    }];
  };
  Notification.count = async () => 1;
  t.after(() => {
    Notification.findAll = originalFindAll;
    Notification.count = originalCount;
  });

  const response = makeResponse();
  await endpoint('get', '/notifications')({
    user: { id: 8, role: 'department_head', departmentId: 3, collegeId: 2 },
    query: { read: 'read', dateFrom: '2026-10-01', dateTo: '2026-10-06' },
  }, response, (error) => { throw error; });

  const visibility = query.where[Op.and][0];
  const visibilityClauses = visibility[Op.or];
  assert.ok(visibilityClauses.some((clause) => clause.userId === 8));
  assert.ok(visibilityClauses.some((clause) => clause.recipientId === 8));
  assert.equal(visibilityClauses.some((clause) => clause.departmentId === 3 && !clause.scope), false);
  assert.equal(response.payload.notifications[0].is_read, true);
  assert.equal(response.payload.notifications[0].read_at.toISOString(), '2026-10-06T12:00:00.000Z');
});

test('mark-as-read addresses only a notification visible to the logged-in recipient', async (t) => {
  const originalFindOne = Notification.findOne;
  const originalCount = Notification.count;
  let query;
  let updated;
  Notification.findOne = async (options) => {
    query = options;
    return {
      async update(values) {
        updated = values;
        Object.assign(this, values);
      },
      toJSON() {
        return { id: 55, read: this.read, readAt: this.readAt };
      },
    };
  };
  Notification.count = async () => 0;
  t.after(() => {
    Notification.findOne = originalFindOne;
    Notification.count = originalCount;
  });

  const response = makeResponse();
  await endpoint('patch', '/notifications/:id/read')({
    user: { id: 8, role: 'department_head', departmentId: 3 },
    params: { id: '55' },
  }, response, (error) => { throw error; });

  assert.deepEqual(query.where[Op.and][0], { id: 55 });
  const clauses = query.where[Op.and][1][Op.or];
  assert.deepEqual(clauses, [
    { userId: 8 },
    { recipientId: 8 },
    { scope: 'GLOBAL' },
    { scope: 'DEPARTMENT', departmentId: 3 },
    { scope: 'ROLE', role: 'department_head' },
  ]);
  assert.equal(updated.read, true);
  assert.ok(updated.readAt instanceof Date);
  assert.equal(response.payload.unreadCount, 0);
});

test('mark-all returns how many visible unread notifications were updated', async (t) => {
  const originalUpdate = Notification.update;
  const originalCount = Notification.count;
  let query;
  Notification.update = async (_values, options) => {
    query = options;
    return [2];
  };
  Notification.count = async () => 0;
  t.after(() => {
    Notification.update = originalUpdate;
    Notification.count = originalCount;
  });

  const response = makeResponse();
  await endpoint('patch', '/notifications/read-all')({
    user: { id: 8, role: 'department_head', departmentId: 3 },
  }, response, (error) => { throw error; });

  const clauses = query.where[Op.and][0][Op.or];
  assert.ok(clauses.some((clause) => clause.userId === 8));
  assert.equal(response.payload.updatedCount, 2);
  assert.equal(response.payload.unreadCount, 0);
});
