const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { User } = require('../models');
const notificationService = require('../services/notificationService');
const { createDepartmentNotification } = require('../controllers/departmentNotificationController');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('department notification recipients cannot cross department scope', async (t) => {
  const originals = { findAll: User.findAll, create: notificationService.createBulkNotification };
  let userQuery;
  let notificationPayload;
  User.findAll = async (options) => {
    userQuery = options;
    return [{ id: 8 }];
  };
  notificationService.createBulkNotification = async (payload) => {
    notificationPayload = payload;
    return { notifications: [{ id: 22 }], recipientCount: 1 };
  };
  t.after(() => {
    User.findAll = originals.findAll;
    notificationService.createBulkNotification = originals.create;
  });

  const response = makeResponse();
  await createDepartmentNotification({
    organizationScope: { departmentId: 17 },
    user: { id: 3, role: 'department_head' },
    body: { title: 'Lab closure', message: 'The lab is closed today', userIds: [8] },
  }, response, (error) => { throw error; });

  assert.equal(userQuery.where.departmentId, 17);
  assert.equal(userQuery.where.id[Op.in][0], 8);
  assert.equal(notificationPayload.departmentId, 17);
  assert.deepEqual(notificationPayload.userIds, [8]);
  assert.equal(response.statusCode, 201);
});

test('department notification rejects foreign, malformed and unscoped recipients', async (t) => {
  const original = User.findAll;
  User.findAll = async () => [];
  t.after(() => { User.findAll = original; });

  const foreign = makeResponse();
  await createDepartmentNotification({
    organizationScope: { departmentId: 17 },
    user: { id: 3 },
    body: { title: 'Notice', message: 'Message', userIds: [99] },
  }, foreign, (error) => { throw error; });
  assert.equal(foreign.statusCode, 400);

  const invalid = makeResponse();
  await createDepartmentNotification({
    organizationScope: { departmentId: 17 },
    user: { id: 3 },
    body: { title: 'Notice', message: 'Message', userIds: '99' },
  }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);

  const unscoped = makeResponse();
  await createDepartmentNotification({ organizationScope: {}, user: { id: 3 }, body: {} }, unscoped, (error) => { throw error; });
  assert.equal(unscoped.statusCode, 403);
});
