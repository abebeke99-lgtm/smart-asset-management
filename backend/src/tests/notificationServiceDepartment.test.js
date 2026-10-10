const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const models = require('../models');
const auditLogService = require('../services/auditLogService');
const originalAuditCreate = auditLogService.createAuditLog;
auditLogService.createAuditLog = async () => {};
const notificationService = require('../services/notificationService');

test('personal notifications are not visible only because they share a department', () => {
  const visibility = notificationService.buildNotificationVisibilityWhere({
    id: 8,
    role: 'department_head',
    departmentId: 3,
    collegeId: 2,
  });
  const clauses = visibility[Op.or];
  assert.ok(clauses.some((clause) => clause.userId === 8));
  assert.ok(clauses.some((clause) => clause.recipientId === 8));
  assert.ok(clauses.some((clause) => clause.scope === 'DEPARTMENT' && clause.departmentId === 3));
  assert.equal(clauses.some((clause) => clause.departmentId === 3 && !clause.scope), false);
  assert.equal(clauses.some((clause) => clause.scope === 'USER' && clause.userId === 19), false);
});

test('department-head notification creation persists the scoped recipient, entity, and unread state', async (t) => {
  const { User, Config, Notification, NotificationDelivery, sequelize } = models;
  const originals = {
    userFindAll: User.findAll,
    userFindByPk: User.findByPk,
    configFindByPk: Config.findByPk,
    notificationFindOne: Notification.findOne,
    notificationCreate: Notification.create,
    deliveryCreate: NotificationDelivery.create,
    transaction: sequelize.transaction,
  };
  const created = [];
  const head = { id: 12, departmentId: 3, collegeId: 2, organizationId: null };

  User.findAll = async ({ where }) => {
    if (where.role === 'department_head') return [head];
    if (where.id?.[Op.in]) return [head];
    return [];
  };
  User.findByPk = async () => ({ id: 5, role: 'department_head' });
  Config.findByPk = async () => ({ value: JSON.stringify({ enabled: true, inAppEnabled: true }) });
  Notification.findOne = async () => null;
  Notification.create = async (values) => {
    created.push(values);
    return { id: 91, ...values, toJSON() { return this; } };
  };
  NotificationDelivery.create = async () => ({ update: async () => {} });
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {} });
  t.after(() => {
    User.findAll = originals.userFindAll;
    User.findByPk = originals.userFindByPk;
    Config.findByPk = originals.configFindByPk;
    Notification.findOne = originals.notificationFindOne;
    Notification.create = originals.notificationCreate;
    NotificationDelivery.create = originals.deliveryCreate;
    sequelize.transaction = originals.transaction;
    auditLogService.createAuditLog = originalAuditCreate;
  });

  const result = await notificationService.createDepartmentEventNotification({
    event: 'department_request_submitted',
    eventKey: 'department_request_submitted:77',
    departmentId: 3,
    senderId: 5,
    entityType: 'department_asset_request',
    entityId: 77,
    actionUrl: '/department-head/asset-requests',
    type: 'approval',
    title: 'New department asset request',
    message: 'Request AR-77 requires review.',
  });

  assert.equal(result.notifications.length, 1);
  assert.equal(created.length, 1);
  assert.equal(created[0].userId, 12);
  assert.equal(created[0].recipientId, 12);
  assert.equal(created[0].departmentId, 3);
  assert.equal(created[0].scope, 'USER');
  assert.equal(created[0].read, false);
  assert.equal(created[0].eventKey, 'department_request_submitted:77');
  assert.equal(created[0].entityType, 'department_asset_request');
  assert.equal(created[0].entityId, 77);
  assert.equal(created[0].actionUrl, '/department-head/asset-requests');
});

test('department notification recipient resolution excludes inactive and other-department accounts', async (t) => {
  const { User } = models;
  const originalFindAll = User.findAll;
  let query;
  User.findAll = async (options) => {
    query = options;
    return [{ id: 10 }, { id: 11 }];
  };
  t.after(() => { User.findAll = originalFindAll; });

  const recipients = await notificationService.getDepartmentHeadRecipients(4);
  assert.deepEqual(query.where, { departmentId: 4, role: 'department_head', active: true });
  assert.deepEqual(recipients.map((recipient) => recipient.id), [10, 11]);
});
