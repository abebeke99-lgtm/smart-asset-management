const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, User, Role, Department, College, AuditLog, UserActivityLog, Config } = require('../models');
const { createUser, updateUser, updateUserStatus } = require('../controllers/userController');

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const trackedMethods = [
  [sequelize, 'transaction'],
  [Role, 'findOne'],
  [User, 'count'],
  [User, 'findAll'],
  [User, 'create'],
  [Department, 'findByPk'],
  [College, 'findByPk'],
  [AuditLog, 'create'],
  [UserActivityLog, 'create'],
  [Config, 'findByPk'],
];

const authenticatedAdmin = { id: 1, username: 'admin', role: 'admin' };
const validInput = {
  username: 'unit.department.head',
  fullName: 'Department Head',
  email: 'department.head@example.edu',
  role: 'department_head',
  collegeId: 3,
  departmentId: 8,
  password: 'SecurePass123',
  confirmPassword: 'SecurePass123',
};

const setupCreate = (t, overrides = {}) => {
  const originals = trackedMethods.map(([model, method]) => [model, method, model[method]]);
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  sequelize.transaction = async (callback) => callback(transaction);
  Role.findOne = async () => ({ id: 4, name: 'department_head', active: true });
  User.count = async () => 0;
  User.findAll = async () => [];
  User.create = async (values) => ({
    id: 42,
    ...values,
    toJSON() {
      const { password, ...safe } = this;
      return safe;
    },
  });
  Department.findByPk = async (id) => Number(id) === 8 ? { id: 8, name: 'Physics', collegeId: 3, status: 'active' } : null;
  College.findByPk = async (id) => Number(id) === 3 ? { id: 3, status: 'active' } : null;
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  Config.findByPk = async () => null;
  Object.entries(overrides).forEach(([key, implementation]) => {
    const separator = key.indexOf('.');
    const modelName = key.slice(0, separator);
    const method = key.slice(separator + 1);
    const model = { sequelize, Role, User, Department, College, AuditLog, UserActivityLog, Config }[modelName];
    model[method] = implementation;
  });
  t.after(() => originals.forEach(([model, method, original]) => { model[method] = original; }));
};

const createRequest = (body = validInput) => ({ body, user: authenticatedAdmin, ip: '127.0.0.1' });

test('administrator can provision a department head in a validated active college and department', async (t) => {
  setupCreate(t);
  let inserted;
  User.create = async (values) => {
    inserted = values;
    return { id: 42, ...values, toJSON() { const { password, ...safe } = this; return safe; } };
  };

  const res = response();
  await createUser(createRequest(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(inserted.role, 'department_head');
  assert.equal(inserted.collegeId, 3);
  assert.equal(inserted.departmentId, 8);
  assert.equal(inserted.department, 'Physics');
  assert.match(inserted.password, /^\$2[aby]\$/);
  assert.equal(res.payload.data.password, undefined);
});

test('department-head creation rejects a missing college or department before persistence', async (t) => {
  setupCreate(t);
  User.create = async () => assert.fail('invalid organization scope must not create a user');

  const noCollege = response();
  await createUser(createRequest({ ...validInput, collegeId: '', departmentId: '' }), noCollege);
  assert.equal(noCollege.statusCode, 400);
  assert.match(noCollege.payload.message, /college is required/i);

  const noDepartment = response();
  await createUser(createRequest({ ...validInput, departmentId: '' }), noDepartment);
  assert.equal(noDepartment.statusCode, 400);
  assert.match(noDepartment.payload.message, /department is required/i);
});

test('account creation rejects a department belonging to another selected college', async (t) => {
  setupCreate(t, {
    'Department.findByPk': async () => ({ id: 8, name: 'Physics', collegeId: 9, status: 'active' }),
  });
  User.create = async () => assert.fail('cross-college department must not create a user');

  const res = response();
  await createUser(createRequest(), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /does not belong to the selected college/i);
});

test('inactive organization records cannot be assigned to newly provisioned accounts', async (t) => {
  setupCreate(t, {
    'College.findByPk': async () => ({ id: 3, status: 'inactive' }),
  });
  User.create = async () => assert.fail('inactive college must not be assigned');

  const res = response();
  await createUser(createRequest(), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /active college/i);
});

test('duplicate username or email remains a conflict and database failures do not expose details', async (t) => {
  setupCreate(t);
  User.findAll = async () => [{ username: 'UNIT.DEPARTMENT.HEAD', email: 'other@example.edu' }];
  User.create = async () => assert.fail('duplicate identity must not create a user');

  const duplicate = response();
  await createUser(createRequest(), duplicate);
  assert.equal(duplicate.statusCode, 409);

  const databaseError = new Error('private SQL server details');
  User.findAll = async () => { throw databaseError; };
  const unavailable = response();
  const consoleError = console.error;
  console.error = () => {};
  try {
    await createUser(createRequest(), unavailable);
  } finally {
    console.error = consoleError;
  }
  assert.equal(unavailable.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(unavailable.payload), /private SQL server details/);
});

test('administrator edits preserve validated department scope and reject cross-college assignments', async (t) => {
  const originals = {
    userFindByPk: User.findByPk,
    userFindAll: User.findAll,
    departmentFindByPk: Department.findByPk,
    departmentFindOne: Department.findOne,
    collegeFindByPk: College.findByPk,
    auditCreate: AuditLog.create,
    activityCreate: UserActivityLog.create,
  };
  const user = {
    id: 42,
    username: 'unit.department.head',
    email: 'department.head@example.edu',
    role: 'department_head',
    fullName: 'Department Head',
    phone: '',
    collegeId: 3,
    departmentId: 8,
    status: 'active',
    active: true,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    toJSON() {
      const { password, ...safe } = this;
      return safe;
    },
  };
  User.findByPk = async () => user;
  User.findAll = async () => assert.fail('partial edits must not run duplicate identity lookups');
  Department.findByPk = async () => ({ id: 8, name: 'Physics', collegeId: 3, status: 'active' });
  Department.findOne = async () => ({ id: 8, name: 'Physics', collegeId: 3, status: 'active' });
  College.findByPk = async () => ({ id: 3, status: 'active' });
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  t.after(() => {
    User.findByPk = originals.userFindByPk;
    User.findAll = originals.userFindAll;
    Department.findByPk = originals.departmentFindByPk;
    Department.findOne = originals.departmentFindOne;
    College.findByPk = originals.collegeFindByPk;
    AuditLog.create = originals.auditCreate;
    UserActivityLog.create = originals.activityCreate;
  });

  const req = {
    params: { id: '42' },
    body: { fullName: 'Updated Department Head', collegeId: '3', departmentId: '8' },
    user: authenticatedAdmin,
  };
  const updated = response();
  await updateUser(req, updated);
  assert.equal(updated.statusCode, 200);
  assert.equal(user.fullName, 'Updated Department Head');
  assert.equal(updated.payload.data.password, undefined);

  Department.findByPk = async () => ({ id: 8, name: 'Physics', collegeId: 9, status: 'active' });
  Department.findOne = async () => ({ id: 8, name: 'Physics', collegeId: 9, status: 'active' });
  const rejected = response();
  await updateUser({ ...req, body: { ...req.body, fullName: 'Cross College' } }, rejected);
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.payload.message, /does not belong to the selected college/i);
  assert.equal(user.fullName, 'Updated Department Head');
});

test('administrator status changes persist active, inactive, and suspended states and protect self-access', async (t) => {
  const originals = {
    userFindByPk: User.findByPk,
    auditCreate: AuditLog.create,
    activityCreate: UserActivityLog.create,
  };
  const makeUser = (id) => ({
    id,
    status: 'active',
    active: true,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    toJSON() {
      return { ...this };
    },
  });
  const user = makeUser(42);
  User.findByPk = async (id) => Number(id) === authenticatedAdmin.id ? makeUser(authenticatedAdmin.id) : user;
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  t.after(() => {
    User.findByPk = originals.userFindByPk;
    AuditLog.create = originals.auditCreate;
    UserActivityLog.create = originals.activityCreate;
  });

  for (const status of ['inactive', 'suspended', 'active']) {
    const res = response();
    await updateUserStatus({ params: { id: '42' }, body: { status }, user: authenticatedAdmin }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.status, status);
    assert.equal(user.active, status === 'active');
  }

  const self = response();
  await updateUserStatus({ params: { id: '1' }, body: { status: 'inactive' }, user: authenticatedAdmin }, self);
  assert.equal(self.statusCode, 400);
  assert.match(self.payload.message, /cannot deactivate or suspend their own account/i);

  const invalid = response();
  await updateUserStatus({ params: { id: '42' }, body: { status: 'paused' }, user: authenticatedAdmin }, invalid);
  assert.equal(invalid.statusCode, 400);
});
