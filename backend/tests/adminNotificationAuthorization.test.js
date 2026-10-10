const test = require('node:test');
const assert = require('node:assert/strict');
const notificationRoutes = require('../src/routes/adminNotificationRoutes');

const getRoleGuard = (method, routePath) => {
  const route = notificationRoutes.stack.find((layer) => (
    layer.route?.path === routePath && layer.route.methods[method]
  ));
  assert.ok(route, `${method.toUpperCase()} ${routePath} exists`);
  return route.route.stack[1].handle;
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

test('administrator management endpoints reject non-administrators through direct API access', async () => {
  const protectedRoutes = [
    ['get', '/notifications'],
    ['get', '/notifications/:id'],
    ['post', '/notifications/bulk'],
    ['put', '/notifications/:id'],
    ['delete', '/notifications/:id'],
  ];

  for (const [method, routePath] of protectedRoutes) {
    const res = makeResponse();
    await getRoleGuard(method, routePath)({ user: { id: 3, role: 'ict_officer' } }, res, () => {
      assert.fail(`${method} ${routePath} must reject non-admin users`);
    });
    assert.equal(res.statusCode, 403, `${method} ${routePath} returns 403`);
  }
});

test('administrator role passes notification management authorization', async () => {
  const res = makeResponse();
  let continued = false;
  await getRoleGuard('delete', '/notifications/:id')({ user: { id: 1, role: 'admin' } }, res, () => {
    continued = true;
  });
  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
});
