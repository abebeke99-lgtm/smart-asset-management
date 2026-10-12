const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  AssetCustody,
  AuditLog,
  Department,
  Inventory,
  User,
  UserActivityLog,
} = require('../models');
const { createAuditLog } = require('../services/auditLogService');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');
const controller = require('../controllers/collegeStaffController');
const collegeController = require('../controllers/collegeController');
const routes = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../routes/collegeRoutes.js'), 'utf8');
const assignmentRoutes = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../routes/assignmentRoutes.js'), 'utf8');

const AUDIT_INTEGRATION_DB = process.env.COLLEGE_AUDIT_INTEGRATION_DB === '1';

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('staff write routes require College Manager role and staff-management permission', () => {
  assert.match(routes, /router\.post\('\/staff', requireRole\('college_manager'\), requirePermission\('college\.staff\.manage'\), collegeStaff\.create\)/);
  assert.match(routes, /router\.put\('\/staff\/:id', requireRole\('college_manager'\), requirePermission\('college\.staff\.manage'\), collegeStaff\.update\)/);
  assert.match(routes, /router\.patch\('\/staff\/:id\/status', requireRole\('college_manager'\), requirePermission\('college\.staff\.manage'\), collegeStaff\.setStatus\)/);
  assert.match(routes, /router\.get\('\/staff\/:id\/assignment-options', requireRole\('college_manager'\), requirePermission\('college\.assignments\.manage'\)/);
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.staff.manage'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.staff.view'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college.includes('college.staff.view'));
  assert.ok(!DEFAULT_ROLE_PERMISSIONS.college.includes('college.staff.manage'));
});

test('College assignment create and return reuse the central transactional workflow behind manager permissions', () => {
  assert.match(assignmentRoutes, /const canManageAssignments = \[requireAuth, requireRole\('admin', 'ict_officer', 'store_manager', 'department_head'\)\]/);
  assert.match(assignmentRoutes, /const canManageCollegeAssignments = \[requireAuth, requireRole\('admin', 'ict_officer', 'store_manager', 'department_head', 'college_manager'\)\]/);
  assert.match(assignmentRoutes, /router\.post\('\/', \.\.\.canManageCollegeAssignments, requireDepartmentPermission\('assets\.assign'\), resolveAssignmentOrganizationScope/);
  assert.match(assignmentRoutes, /if \(req\.user\?\.role === 'college_manager'\) return requirePermission\('college\.assignments\.manage'\)\(req, res, next\)/);
  assert.match(assignmentRoutes, /router\.post\('\/:id\/return', \.\.\.canManageCollegeAssignments, requireCollegeManagerAssignmentPermission, resolveAssignmentOrganizationScope/);
  assert.match(assignmentRoutes, /router\.post\('\/:id\/transfer', \.\.\.canManageAssignments, requireCollegeManagerAssignmentPermission, resolveAssignmentOrganizationScope/);
  assert.match(assignmentRoutes, /router\.delete\('\/:id', \.\.\.canManageAssignments/);
  assert.match(assignmentRoutes, /req\.user\.role === 'college_manager' && \(assignedToType !== 'user' \|\| assignee\?\.role !== 'staff'\)/);
  assert.match(assignmentRoutes, /Number\(assignee\.collegeId\) !== managerCollegeId/);
});

test('assignment options are loaded from available college inventory and active college staff', async (t) => {
  const originals = { inventory: Inventory.findAll, users: User.findAll, departments: Department.findAll };
  let inventoryQuery;
  let userQuery;
  let departmentQuery;
  Inventory.findAll = async (options) => {
    inventoryQuery = options;
    return [{
      toJSON: () => ({
        availableQuantity: 3,
        Asset: { id: 29, name: 'Microscope', assetCode: 'AST-029', category: 'Laboratory', serialNumber: 'SN-029' },
      }),
    }];
  };
  User.findAll = async (options) => {
    userQuery = options;
    return [{
      toJSON: () => ({
        id: 18,
        username: 'staff-18',
        fullName: 'Staff Member',
        departmentId: 14,
        DepartmentRecord: { id: 14, name: 'Physics', code: 'PHY' },
      }),
    }];
  };
  Department.findAll = async (options) => {
    departmentQuery = options;
    return [{ id: 14, name: 'Physics', code: 'PHY' }];
  };
  t.after(() => {
    Inventory.findAll = originals.inventory;
    User.findAll = originals.users;
    Department.findAll = originals.departments;
  });
  const response = makeResponse();
  await collegeController.getCollegeAssignmentOptions({ organizationScope: { collegeId: 4 } }, response, (error) => { throw error; });
  assert.equal(inventoryQuery.where.availableQuantity[Op.gt], 0);
  assert.equal(inventoryQuery.include[0].where.collegeId, 4);
  assert.deepEqual(userQuery.where, { collegeId: 4, role: 'staff', active: true, status: 'active' });
  assert.deepEqual(departmentQuery.where, { collegeId: 4, status: 'active' });
  assert.equal(response.payload.data.assets[0].availableQuantity, 3);
  assert.equal(response.payload.data.staff[0].department.name, 'Physics');
});

test('staff listing is college-scoped, filters server-side, and returns independent summary counts', async (t) => {
  const originals = {
    findAndCountAll: User.findAndCountAll,
    count: User.count,
    deptFind: Department.findAll,
    deptOne: Department.findOne,
    custody: AssetCustody.findAll,
  };
  let listOptions;
  User.findAndCountAll = async (options) => {
    listOptions = options;
    return { rows: [{ id: 18, username: 'EMP-018', fullName: 'Staff Member', toJSON: () => ({ id: 18, username: 'EMP-018', fullName: 'Staff Member', role: 'staff', departmentId: 14, active: true, DepartmentRecord: { id: 14, name: 'Physics' } }) }], count: 1 };
  };
  User.count = async ({ where }) => where.active ? 3 : 5;
  Department.findAll = async () => [{ id: 14, name: 'Physics' }];
  Department.findOne = async () => ({ id: 14 });
  AssetCustody.findAll = async () => [{ custodianId: 18 }, { custodianId: 18 }, { custodianId: 19 }];
  t.after(() => {
    User.findAndCountAll = originals.findAndCountAll;
    User.count = originals.count;
    Department.findAll = originals.deptFind;
    Department.findOne = originals.deptOne;
    AssetCustody.findAll = originals.custody;
  });

  const response = makeResponse();
  await controller.list({
    organizationScope: { collegeId: 4 },
    query: { departmentId: '14', status: 'active', search: 'EMP', page: '2', limit: '4', sortBy: 'createdAt', sortOrder: 'DESC' },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(listOptions.where.collegeId, 4);
  assert.equal(listOptions.where.role, 'staff');
  assert.equal(listOptions.where.departmentId, 14);
  assert.equal(listOptions.where.active, true);
  assert.equal(listOptions.limit, 4);
  assert.equal(listOptions.offset, 4);
  assert.deepEqual(response.payload.summary, { total: 5, active: 3, inactive: 2, activeAssetAssignments: 3, withAssignedAssets: 2 });
  assert.equal(response.payload.data[0].assignedAssetsCount, 2);
  assert.equal(response.payload.data[0].staffId, 'EMP-018');
});

test('staff creation makes a manager-scoped staff account and returns a one-time forced-change password', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    department: Department.findOne,
    userFind: User.findOne,
    userCreate: User.create,
    audit: AuditLog.create,
  };
  const transaction = { finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  let saved;
  let audit;
  sequelize.transaction = async () => transaction;
  Department.findOne = async () => ({ id: 14, name: 'Physics' });
  User.findOne = async () => null;
  User.create = async (values) => {
    saved = values;
    return { id: 21, ...values, toJSON: () => ({ id: 21, ...values }) };
  };
  AuditLog.create = async (values) => { audit = values; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findOne = originals.department;
    User.findOne = originals.userFind;
    User.create = originals.userCreate;
    AuditLog.create = originals.audit;
  });

  const response = makeResponse();
  await controller.create({
    organizationScope: { collegeId: 4 },
    user: { id: 2, role: 'college_manager' },
    body: { fullName: 'Staff Member', staffId: 'EMP-021', email: 'staff@example.edu', phone: '+251 911 234567', departmentId: 14 },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 201);
  assert.equal(saved.role, 'staff');
  assert.equal(saved.collegeId, 4);
  assert.equal(saved.departmentId, 14);
  assert.equal(saved.forcePasswordChange, true);
  assert.equal(saved.status, 'active');
  assert.equal(await require('bcryptjs').compare(response.payload.temporaryPassword, saved.password), true);
  assert.equal(response.payload.temporaryPassword.length, 16);
  assert.equal(response.payload.data.password, undefined);
  assert.equal(audit.action, 'COLLEGE_STAFF_CREATED');
  assert.equal(JSON.stringify(audit).includes(response.payload.temporaryPassword), false);
  assert.deepEqual(Object.keys(audit).sort(), ['action', 'createdAt', 'details', 'entity', 'updatedAt', 'userId']);
  const auditPayload = JSON.parse(audit.details);
  assert.equal(auditPayload.entity, 'user:21');
  assert.equal(auditPayload.entity_id, 21);
  assert.equal(auditPayload.collegeId, 4);
  assert.equal(auditPayload.staffId, 'EMP-021');
  assert.equal(auditPayload.staffRole, 'staff');
  assert.equal(auditPayload.user.role, 'college_manager');
  assert.equal(transaction.finished, 'commit');
});

test('staff update records before/after values in the audit trail without sensitive data', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    department: Department.findOne,
    userFind: User.findOne,
    audit: AuditLog.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const user = {
    id: 18,
    username: 'EMP-018',
    fullName: 'Staff Member',
    email: 'staff@example.edu',
    phone: '+251 911 234567',
    departmentId: 14,
    department: 'Physics',
    collegeId: 4,
    role: 'staff',
    active: true,
    status: 'active',
    toJSON() {
      return { id: this.id, username: this.username, fullName: this.fullName, email: this.email, phone: this.phone, departmentId: this.departmentId, department: this.department, collegeId: this.collegeId, role: this.role, active: this.active, status: this.status };
    },
    update: async (values) => Object.assign(user, values),
  };
  let audit;
  sequelize.transaction = async () => transaction;
  Department.findOne = async () => ({ id: 14, name: 'Physics' });
  User.findOne = async ({ where }) => (where && typeof where.id === 'object' ? null : user);
  AuditLog.create = async (values) => { audit = values; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findOne = originals.department;
    User.findOne = originals.userFind;
    AuditLog.create = originals.audit;
  });

  const response = makeResponse();
  await controller.update({
    organizationScope: { collegeId: 4 },
    user: { id: 2, role: 'college_manager' },
    params: { id: '18' },
    body: { fullName: 'Updated Name' },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(audit.action, 'COLLEGE_STAFF_UPDATED');
  assert.deepEqual(Object.keys(audit).sort(), ['action', 'createdAt', 'details', 'entity', 'updatedAt', 'userId']);
  const auditPayload = JSON.parse(audit.details);
  assert.equal(auditPayload.entity, 'user:18');
  assert.equal(auditPayload.entity_id, 18);
  assert.equal(auditPayload.old_value.fullName, 'Staff Member');
  assert.equal(auditPayload.new_value.fullName, 'Updated Name');
  assert.equal(auditPayload.old_value.username, 'EMP-018');
  assert.equal(auditPayload.new_value.email, 'staff@example.edu');
  assert.equal(JSON.stringify(audit).includes('password'), false);
});

test('staff details include only same-college assignment history and recent account activity', async (t) => {
  const originals = { userFind: User.findOne, custody: AssetCustody.findAll, activity: UserActivityLog.findAll };
  const savedStaff = {
    id: 18,
    username: 'EMP-018',
    fullName: 'Staff Member',
    role: 'staff',
    active: true,
    departmentId: 14,
    toJSON: () => ({ id: 18, username: 'EMP-018', fullName: 'Staff Member', role: 'staff', active: true, departmentId: 14, DepartmentRecord: { id: 14, name: 'Physics' } }),
  };
  let custodyOptions;
  User.findOne = async ({ where }) => {
    assert.deepEqual(where, { id: '18', collegeId: 4, role: 'staff' });
    return savedStaff;
  };
  AssetCustody.findAll = async (options) => {
    custodyOptions = options;
    return [{
      toJSON: () => ({
        id: 43,
        status: 'returned',
        receivedDate: '2025-03-01T10:00:00.000Z',
        returnedDate: '2025-03-04T10:00:00.000Z',
        Asset: { id: 9, assetCode: 'AST-009', name: 'Microscope', condition: 'Good', collegeId: 4 },
      }),
    }];
  };
  UserActivityLog.findAll = async () => [{ action: 'LOGIN', createdAt: '2025-03-05T10:00:00.000Z' }];
  t.after(() => {
    User.findOne = originals.userFind;
    AssetCustody.findAll = originals.custody;
    UserActivityLog.findAll = originals.activity;
  });
  const response = makeResponse();
  await controller.detail({ organizationScope: { collegeId: 4 }, params: { id: '18' } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(custodyOptions.include[0].where.collegeId, 4);
  assert.equal(response.payload.data.assignedAssets[0].asset.assetCode, 'AST-009');
  assert.equal(response.payload.data.activity[0].type, 'LOGIN');
  assert.equal(response.payload.data.password, undefined);
});

test('staff creation rejects a department from another college without creating a user', async (t) => {
  const originals = { transaction: sequelize.transaction, department: Department.findOne, userCreate: User.create };
  let created = false;
  let rolledBack = false;
  sequelize.transaction = async () => ({ finished: undefined, commit: async () => {}, rollback: async () => { rolledBack = true; } });
  Department.findOne = async () => null;
  User.create = async () => { created = true; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findOne = originals.department;
    User.create = originals.userCreate;
  });
  const response = makeResponse();
  await controller.create({
    organizationScope: { collegeId: 4 },
    user: { id: 2 },
    body: { fullName: 'Staff Member', staffId: 'EMP-022', departmentId: 99 },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /not active in your college/i);
  assert.equal(created, false);
  assert.equal(rolledBack, true);
});

test('staff status changes update authentication state and revoke sessions on deactivation', async (t) => {
  const originals = { transaction: sequelize.transaction, userFind: User.findOne, audit: AuditLog.create };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const user = {
    id: 21,
    status: 'active',
    active: true,
    sessionVersion: 3,
    update: async (values) => Object.assign(user, values),
  };
  let audit;
  sequelize.transaction = async () => transaction;
  User.findOne = async () => user;
  AuditLog.create = async (values) => { audit = values; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    User.findOne = originals.userFind;
    AuditLog.create = originals.audit;
  });
  const response = makeResponse();
  await controller.setStatus({
    organizationScope: { collegeId: 4 },
    user: { id: 2 },
    params: { id: '21' },
    body: { status: 'inactive' },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(user.active, false);
  assert.equal(user.status, 'inactive');
  assert.equal(user.sessionVersion, 4);
  assert.equal(audit.action, 'COLLEGE_STAFF_DEACTIVATED');
  const auditPayload = JSON.parse(audit.details);
  assert.equal(auditPayload.entity_id, 21);
  assert.equal(auditPayload.sessionsRevoked, true);
  assert.equal(auditPayload.previousStatus, 'active');
  assert.equal(auditPayload.status, 'inactive');
  assert.equal(JSON.stringify(audit).includes('password'), false);
});

test('staff ID and email must be unique and an inactive staff department cannot be selected', async (t) => {
  const originals = { transaction: sequelize.transaction, department: Department.findOne, userFind: User.findOne, userCreate: User.create };
  let userCreated = false;
  const transaction = { finished: undefined, commit: async () => {}, rollback: async () => { transaction.finished = 'rollback'; } };
  sequelize.transaction = async () => transaction;
  Department.findOne = async () => ({ id: 14, name: 'Physics' });
  User.findOne = async ({ where }) => {
    assert.equal(where.collegeId, 4);
    assert.equal(where.role, 'staff');
    assert.ok(where[Op.or]);
    return { id: 1 };
  };
  User.create = async () => { userCreated = true; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findOne = originals.department;
    User.findOne = originals.userFind;
    User.create = originals.userCreate;
  });
  const response = makeResponse();
  await controller.create({
    organizationScope: { collegeId: 4 },
    user: { id: 2 },
    body: { fullName: 'Duplicate Staff', staffId: 'EMP-001', email: 'duplicate@example.edu', departmentId: 14 },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /already exists/i);
  assert.equal(userCreated, false);
});

test('college staff audit rows persist actor, entity, and before/after values on the real AuditLog schema', { skip: !AUDIT_INTEGRATION_DB }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'database write tests are disabled in production');
  await sequelize.authenticate();
  const marker = randomUUID();
  const transaction = await sequelize.transaction();
  try {
    const created = await createAuditLog({
      userId: 1,
      role: 'college_manager',
      action: 'COLLEGE_STAFF_TEST_PERSIST',
      entity: `user:${marker}`,
      entityId: 999,
      oldValue: { fullName: 'Before Name', department: 'Physics' },
      newValue: { fullName: 'After Name', department: 'Physics' },
      details: { marker, collegeId: 4, staffId: marker },
      transaction,
    });
    const saved = await AuditLog.findByPk(created.id, { transaction });
    assert.equal(saved.userId, 1);
    assert.equal(saved.action, 'COLLEGE_STAFF_TEST_PERSIST');
    assert.equal(saved.entity, `user:${marker}`);
    assert.deepEqual(Object.keys(saved.dataValues).sort(), ['action', 'createdAt', 'details', 'entity', 'id', 'updatedAt', 'userId']);
    const details = JSON.parse(saved.details);
    assert.equal(details.entity_id, 999);
    assert.equal(details.entity, `user:${marker}`);
    assert.equal(details.marker, marker);
    assert.equal(details.collegeId, 4);
    assert.equal(details.old_value.fullName, 'Before Name');
    assert.equal(details.new_value.fullName, 'After Name');
    assert.equal(details.user.id, 1);
    assert.equal(details.user.role, 'college_manager');
    assert.ok(details.timestamp);
    assert.equal(JSON.stringify(details).includes('password'), false);
  } finally {
    if (!transaction.finished) await transaction.rollback();
  }
});
