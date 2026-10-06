const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { AuditLog, Asset, Department, Maintenance, MaintenanceHistory, Transfer, User } = require('../models');
const { getDepartmentAssetHistory, getDepartmentHistory } = require('../controllers/departmentHistoryController');

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

const replaceMethods = (t, model, replacements) => {
  const originals = Object.fromEntries(Object.keys(replacements).map((name) => [name, model[name]]));
  Object.assign(model, replacements);
  t.after(() => Object.assign(model, originals));
};

test('department history is scoped, newest-first, and maps audit fields without exposing audit details', async (t) => {
  const departmentUsers = [{ id: 7 }];
  const departmentAssets = [{ id: 42 }];
  const candidates = [
    { id: 1, userId: 7, action: 'ASSET_UPDATED', entity: 'asset:42', details: JSON.stringify({ afterStatus: 'Assigned' }), createdAt: new Date('2026-06-03T10:00:00.000Z') },
    { id: 2, userId: 99, action: 'REQUEST_APPROVED', entity: 'department_asset_request:12', details: JSON.stringify({ departmentId: 12, requestId: 12, beforeStatus: 'Submitted', afterStatus: 'Approved' }), createdAt: new Date('2026-06-04T10:00:00.000Z') },
    { id: 3, userId: 99, action: 'REQUEST_APPROVED', entity: 'department_asset_request:13', details: JSON.stringify({ departmentId: 123, requestId: 13, afterStatus: 'Approved' }), createdAt: new Date('2026-06-05T10:00:00.000Z') },
    { id: 4, userId: 88, action: 'GLOBAL_UPDATE', entity: 'asset:90', details: '{}', createdAt: new Date('2026-06-06T10:00:00.000Z') },
  ];
  let auditQuery;
  replaceMethods(t, Department, { findByPk: async () => ({ id: 12, name: 'Engineering' }) });
  replaceMethods(t, Asset, { findAll: async () => departmentAssets });
  replaceMethods(t, User, {
    findAll: async ({ where }) => {
      if (where.departmentId === 12) return departmentUsers;
      return [{ id: 7, fullName: 'Department User', username: 'dept-user' }, { id: 99, fullName: 'College Reviewer', username: 'reviewer' }];
    },
  });
  replaceMethods(t, AuditLog, {
    findAll: async (query) => {
      auditQuery = query;
      return candidates;
    },
  });

  const res = makeResponse();
  await getDepartmentHistory({ organizationScope: { departmentId: 12 }, query: {} }, res, (error) => { throw error; });

  assert.equal(auditQuery.where[Op.or].length >= 3, true);
  assert.deepEqual(res.payload.data.map((row) => row.id), [2, 1]);
  assert.equal(res.payload.data[0].user, 'College Reviewer');
  assert.equal(res.payload.data[0].entity, 'department_asset_request');
  assert.equal(res.payload.data[0].entityId, '12');
  assert.equal(res.payload.data[0].status, 'Approved');
  assert.equal(res.payload.data[0].department, 'Engineering');
  assert.equal(res.payload.data[1].user, 'Department User');
  assert.equal(res.payload.data[1].status, 'Assigned');
  assert.equal(res.payload.data[1].dateTime, '2026-06-03T10:00:00.000Z');
  assert.equal(Object.hasOwn(res.payload.data[0], 'details'), false);
});

test('department history filters exact department metadata and supports date, user, action, entity, and status', async (t) => {
  replaceMethods(t, Department, { findByPk: async () => ({ id: 12, name: 'Engineering' }) });
  replaceMethods(t, Asset, { findAll: async () => [] });
  replaceMethods(t, User, {
    findAll: async ({ where }) => (where.departmentId === 12
      ? [{ id: 7 }]
      : [{ id: 7, fullName: 'Ada User', username: 'ada' }]),
  });
  replaceMethods(t, AuditLog, {
    findAll: async () => [
      { id: 5, userId: 7, action: 'REQUEST_APPROVED', entity: 'department_asset_request:5', details: JSON.stringify({ departmentId: 12, afterStatus: 'Approved' }), createdAt: new Date('2026-06-04T10:00:00.000Z') },
      { id: 6, userId: 7, action: 'REQUEST_REJECTED', entity: 'department_asset_request:6', details: JSON.stringify({ departmentId: 12, afterStatus: 'Rejected' }), createdAt: new Date('2026-06-03T10:00:00.000Z') },
    ],
  });

  const res = makeResponse();
  await getDepartmentHistory({
    organizationScope: { departmentId: 12 },
    query: { date: '2026-06-04', user: 'ada', action: 'approved', entity: 'request', status: 'approv' },
  }, res, (error) => { throw error; });
  assert.deepEqual(res.payload.data.map((row) => row.id), [5]);
});

test('department history rejects invalid filters and missing scope', async () => {
  const invalid = makeResponse();
  await getDepartmentHistory({ organizationScope: { departmentId: 12 }, query: { date: '2026-02-30' } }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);

  const missingScope = makeResponse();
  await getDepartmentHistory({ organizationScope: {}, query: {} }, missingScope, (error) => { throw error; });
  assert.equal(missingScope.statusCode, 403);
});

test('department asset history returns real linked audit values and excludes unrelated department and actor activity', async (t) => {
  const candidateLogs = [
    {
      id: 21,
      userId: 99,
      action: 'ASSIGN_ASSET',
      entity: 'asset:42',
      details: JSON.stringify({
        old_value: { status: 'available', apiToken: 'hidden' },
        new_value: { status: 'assigned' },
      }),
      createdAt: new Date('2026-06-04T10:00:00.000Z'),
    },
    {
      id: 22,
      userId: 98,
      action: 'RETURN_ASSET',
      entity: 'assignment:8',
      details: JSON.stringify({ assetId: 42, previousStatus: 'assigned', newStatus: 'available' }),
      createdAt: new Date('2026-06-03T10:00:00.000Z'),
    },
    {
      id: 23,
      userId: 97,
      action: 'TRANSFER_RECEIVED',
      entity: 'transfer:4',
      details: JSON.stringify({ old_value: { departmentId: 12 }, new_value: { departmentId: 19, status: 'Received' } }),
      createdAt: new Date('2026-06-02T10:00:00.000Z'),
    },
    {
      id: 24,
      userId: 7,
      action: 'UNRELATED_USER_ACTION',
      entity: 'asset:90',
      details: '{}',
      createdAt: new Date('2026-06-06T10:00:00.000Z'),
    },
    {
      id: 25,
      userId: 99,
      action: 'OTHER_DEPARTMENT_ASSET',
      entity: 'asset:91',
      details: JSON.stringify({ assetId: 91, departmentId: 123 }),
      createdAt: new Date('2026-06-05T10:00:00.000Z'),
    },
  ];
  let auditQuery;
  replaceMethods(t, Department, { findByPk: async () => ({ id: 12, name: 'Engineering' }) });
  replaceMethods(t, Asset, {
    findAll: async ({ where }) => (where.departmentId === 12
      ? [{ id: 42, name: 'Department laptop', assetCode: 'AST-42' }]
      : [{ id: 42, name: 'Department laptop', assetCode: 'AST-42' }, { id: 77, name: 'Transferred device', assetCode: 'AST-77' }]),
  });
  replaceMethods(t, Transfer, {
    findAll: async () => [{ id: 4, assetId: 77, sourceDepartmentId: 12, destinationDepartmentId: 19 }],
  });
  replaceMethods(t, Maintenance, { findAll: async () => [] });
  replaceMethods(t, MaintenanceHistory, { findAll: async () => [] });
  replaceMethods(t, User, {
    findAll: async () => [
      { id: 99, fullName: 'Asset Manager', username: 'asset-manager' },
      { id: 98, fullName: 'Department Head', username: 'department-head' },
      { id: 97, fullName: 'Receiving Manager', username: 'receiving-manager' },
    ],
  });
  replaceMethods(t, AuditLog, {
    findAll: async (query) => {
      auditQuery = query;
      return candidateLogs;
    },
  });

  const res = makeResponse();
  await getDepartmentAssetHistory({ organizationScope: { departmentId: 12 }, query: {} }, res, (error) => { throw error; });

  assert.deepEqual(res.payload.data.map((row) => row.id), [21, 22, 23]);
  assert.equal(auditQuery.where[Op.or].some((condition) => Object.hasOwn(condition, 'userId')), false);
  assert.equal(res.payload.data[0].user, 'Asset Manager');
  assert.equal(res.payload.data[0].entity, 'Department laptop (AST-42)');
  assert.equal(res.payload.data[0].previousValue.status, 'available');
  assert.equal(Object.hasOwn(res.payload.data[0].previousValue, 'apiToken'), false);
  assert.equal(res.payload.data[0].newValue.status, 'assigned');
  assert.equal(res.payload.data[0].status, 'assigned');
  assert.deepEqual(res.payload.data[1].previousValue, { status: 'assigned' });
  assert.deepEqual(res.payload.data[1].newValue, { status: 'available' });
  assert.equal(res.payload.data[2].entity, 'Transferred device (AST-77)');
  assert.equal(res.payload.data[2].auditEntity, 'transfer:4');
  assert.equal(Object.hasOwn(res.payload.data[0], 'details'), false);
});

test('department asset history includes stored maintenance lifecycle status changes', async (t) => {
  replaceMethods(t, Department, { findByPk: async () => ({ id: 12, name: 'Engineering' }) });
  replaceMethods(t, Asset, {
    findAll: async ({ where }) => (where.departmentId === 12
      ? [{ id: 42, name: 'Department laptop', assetCode: 'AST-42' }]
      : [{ id: 42, name: 'Department laptop', assetCode: 'AST-42' }]),
  });
  replaceMethods(t, Transfer, { findAll: async () => [] });
  replaceMethods(t, Maintenance, { findAll: async () => [] });
  replaceMethods(t, MaintenanceHistory, {
    findAll: async () => [{
      id: 31,
      assetId: 42,
      userId: 98,
      actionType: 'repair_completed',
      actionDate: new Date('2026-06-07T10:00:00.000Z'),
      previousStatus: 'in-progress',
      newStatus: 'completed',
    }],
  });
  replaceMethods(t, AuditLog, { findAll: async () => [] });
  replaceMethods(t, User, { findAll: async () => [{ id: 98, fullName: 'Repair Technician', username: 'repairer' }] });

  const res = makeResponse();
  await getDepartmentAssetHistory({ organizationScope: { departmentId: 12 }, query: {} }, res, (error) => { throw error; });

  assert.equal(res.payload.data.length, 1);
  assert.equal(res.payload.data[0].id, 'maintenance-history:31');
  assert.equal(res.payload.data[0].action, 'repair_completed');
  assert.equal(res.payload.data[0].user, 'Repair Technician');
  assert.deepEqual(res.payload.data[0].previousValue, { status: 'in-progress' });
  assert.deepEqual(res.payload.data[0].newValue, { status: 'completed' });
  assert.equal(res.payload.data[0].status, 'completed');
});

test('department asset history requires department scope and rejects invalid filters', async () => {
  const missingScope = makeResponse();
  await getDepartmentAssetHistory({ organizationScope: {}, query: {} }, missingScope, (error) => { throw error; });
  assert.equal(missingScope.statusCode, 403);

  const invalidFilter = makeResponse();
  await getDepartmentAssetHistory({ organizationScope: { departmentId: 12 }, query: { date: '2026-02-30' } }, invalidFilter, (error) => { throw error; });
  assert.equal(invalidFilter.statusCode, 400);
});
