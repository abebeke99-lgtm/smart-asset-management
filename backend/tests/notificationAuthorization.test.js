const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/notificationRoutes.js'), 'utf8');
const { DEFAULT_ROLE_PERMISSIONS } = require('../src/constants/rolePermissions');
const { Notification, NotificationDelivery, AuditLog, sequelize, Config } = require('../src/models');
const { getConfiguredRolePermissions } = require('../src/services/rolePermissionService');
const notificationRoutes = require('../src/routes/notificationRoutes');

const getRoute = (method, routePath) => {
  const layer = notificationRoutes.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${routePath} route exists`);
  return layer.route.stack;
};

const response = () => ({
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

test('notification routes enforce user-scoped access and expose compatibility endpoints', () => {
  assert.match(routeSource, /buildNotificationVisibilityWhere/i);
  assert.match(routeSource, /\/notifications\/unread\/count|\/notifications\/unread-count/i);
  assert.match(routeSource, /\/notifications\/count/i);
  assert.match(routeSource, /\/notifications\/settings/i);
  assert.match(routeSource, /read:\s*false/i);
  assert.match(routeSource, /req\.user\s*\|\|\s*\{\}/i);
});

test('the required roles have notification viewing and deletion, but no default create or edit grant', () => {
  const roles = [
    'admin',
    'ict_officer',
    'college_manager',
    'department_head',
    'finance',
    'store_manager',
    'maintenance',
    'infrastructure',
  ];
  for (const role of roles) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[role];
    assert.ok(permissions.includes('notifications.view'), `${role} can view`);
    assert.ok(permissions.includes('notifications.delete'), `${role} can delete`);
    if (role !== 'admin') {
      assert.equal(permissions.includes('notifications.create'), false, `${role} cannot create by default`);
      assert.equal(permissions.includes('notifications.update'), false, `${role} cannot edit by default`);
      assert.equal(permissions.includes('notifications.manage'), false, `${role} cannot manage by default`);
    }
  }
});

test('explicit role matrices retain mandatory notification access without changing other grants', async (t) => {
  const originalFindByPk = Config.findByPk;
  Config.findByPk = async () => ({ value: JSON.stringify({ college_manager: ['assets.view'] }) });
  t.after(() => { Config.findByPk = originalFindByPk; });

  const permissions = await getConfiguredRolePermissions('college_manager');
  assert.deepEqual(permissions, ['assets.view', 'college.notifications.view', 'notifications.view', 'notifications.delete']);
});

test('notification viewing and deletion return 403 for a role without explicit permission', async () => {
  for (const [method, routePath] of [
    ['get', '/notifications'],
    ['delete', '/notifications/:id'],
  ]) {
    const permissionMiddleware = getRoute(method, routePath)[1].handle;
    const res = response();
    await permissionMiddleware({ user: { id: 4, role: 'student' } }, res, () => {
      assert.fail(`${method} ${routePath} must not authorize a student by default`);
    });
    assert.equal(res.statusCode, 403);
  }
});

test('deleting a visible notification removes only its delivery rows and records an audit event transactionally', async (t) => {
  const original = {
    transaction: sequelize.transaction,
    findOne: Notification.findOne,
    destroy: NotificationDelivery.destroy,
    auditCreate: AuditLog.create,
  };
  const transaction = { commit: async () => { transaction.committed = true; }, rollback: async () => { transaction.rolledBack = true; } };
  let query;
  let notificationDestroyed = false;
  let deliveryQuery;
  let audit;
  sequelize.transaction = async () => transaction;
  Notification.findOne = async (options) => {
    query = options;
    return {
      id: 42,
      title: 'Department request update',
      type: 'approval',
      scope: 'USER',
      status: 'sent',
      destroy: async ({ transaction: usedTransaction }) => {
        assert.equal(usedTransaction, transaction);
        notificationDestroyed = true;
      },
    };
  };
  NotificationDelivery.destroy = async (options) => {
    deliveryQuery = options;
    return 2;
  };
  AuditLog.create = async (record, options) => {
    audit = { record, options };
  };
  t.after(() => {
    sequelize.transaction = original.transaction;
    Notification.findOne = original.findOne;
    NotificationDelivery.destroy = original.destroy;
    AuditLog.create = original.auditCreate;
  });

  const res = response();
  await getRoute('delete', '/notifications/:id').at(-1).handle({
    user: { id: 8, role: 'department_head', departmentId: 3, permissions: ['notifications.delete'] },
    params: { id: '42' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(query.where[Op.and][0], { id: 42 });
  assert.ok(query.where[Op.and][1][Op.or].some((clause) => clause.userId === 8));
  assert.deepEqual(deliveryQuery.where, { notificationId: 42 });
  assert.equal(notificationDestroyed, true);
  assert.equal(audit.record.action, 'NOTIFICATION_DELETED');
  assert.equal(audit.record.entity, 'notification:42');
  assert.equal(audit.options.transaction, transaction);
  assert.equal(transaction.committed, true);
});

test('notification list responses omit recipient identifiers and metadata for non-administrators', async (t) => {
  const originalFindAll = Notification.findAll;
  const originalCount = Notification.count;
  Notification.findAll = async () => [{
    toJSON: () => ({
      id: 42,
      title: 'Shared update',
      userId: 19,
      recipientId: 19,
      senderId: 3,
      collegeId: 5,
      departmentId: 7,
      organizationId: 9,
      metadata: { private: 'value' },
      scope: 'GLOBAL',
      read: false,
    }),
  }];
  Notification.count = async () => 1;
  t.after(() => {
    Notification.findAll = originalFindAll;
    Notification.count = originalCount;
  });
  const res = response();
  await getRoute('get', '/notifications').at(-1).handle({
    user: { id: 8, role: 'ict_officer', permissions: ['notifications.view'] },
    query: {},
  }, res, (error) => { throw error; });

  const item = res.payload.notifications[0];
  for (const privateField of ['userId', 'recipientId', 'senderId', 'collegeId', 'departmentId', 'organizationId', 'metadata']) {
    assert.equal(Object.hasOwn(item, privateField), false, `${privateField} is omitted`);
  }
  assert.equal(item.title, 'Shared update');
});
