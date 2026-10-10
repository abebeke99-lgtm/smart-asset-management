const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Notification } = require('../src/models');
const adminSupportRoutes = require('../src/routes/adminSupportRoutes');

const findRoute = (method, routePath) => {
  const route = adminSupportRoutes.stack.find((layer) => (
    layer.route?.path === routePath && layer.route.methods[method]
  ));
  assert.ok(route, `${method.toUpperCase()} ${routePath} exists`);
  return route.route;
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

test('legacy notification API requires explicit view and delete permissions', async () => {
  const getRoute = findRoute('get', '/notifications');
  const deleteRoute = findRoute('delete', '/notifications/:id');
  const deniedGet = makeResponse();
  const deniedDelete = makeResponse();

  getRoute.stack[1].handle({ user: { id: 4, role: 'student', permissions: [] } }, deniedGet, () => {
    assert.fail('notification listing must require view permission');
  });
  deleteRoute.stack[1].handle({ user: { id: 4, role: 'student', permissions: ['notifications.view'] } }, deniedDelete, () => {
    assert.fail('notification deletion must require delete permission');
  });

  assert.equal(deniedGet.statusCode, 403);
  assert.equal(deniedDelete.statusCode, 403);
});

test('legacy notification listing applies recipient visibility and omits private fields', async (t) => {
  const originalFindAll = Notification.findAll;
  let query;
  Notification.findAll = async (options) => {
    query = options;
    return [{
      toJSON: () => ({
        id: 12,
        title: 'Visible notification',
        message: 'Message',
        userId: 4,
        recipientId: 4,
        senderId: 1,
        metadata: { private: true },
      }),
    }];
  };
  t.after(() => { Notification.findAll = originalFindAll; });

  const route = findRoute('get', '/notifications');
  const res = makeResponse();
  await route.stack.at(-1).handle({ user: { id: 4, role: 'ict_officer' } }, res, (error) => { throw error; });

  assert.ok(query.where[Op.or].some((clause) => clause.userId === 4));
  assert.ok(query.where[Op.or].some((clause) => clause.recipientId === 4));
  assert.equal(res.payload.notifications[0].senderId, undefined);
  assert.equal(res.payload.notifications[0].metadata, undefined);
  assert.equal(res.payload.notifications[0].userId, undefined);
});
