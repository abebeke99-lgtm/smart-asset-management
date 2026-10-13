const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const {
  sequelize,
  Campus,
  College,
  CollegeRegistrationApplication,
  User,
  AuditLog,
  Config,
} = require('../models');
const controller = require('../controllers/collegeRegistrationController');
const adminRoutes = require('../routes/adminCollegeRegistrationRoutes');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const validPayload = {
  collegeName: 'College of Natural Sciences',
  collegeCode: 'CNS-01',
  campusId: '2',
  collegeDescription: 'Science and research.',
  collegeEmail: 'science@example.edu',
  collegePhone: '+251 11 123 4567',
  officeLocation: 'Main campus, Building A',
  representativeFullName: 'Authorized Representative',
  representativeUsername: 'science.manager',
  representativeEmail: 'manager@example.edu',
  representativePhone: '+251 91 234 5678',
  password: 'ManagerPass123',
  confirmPassword: 'ManagerPass123',
};

const setupModels = (t, overrides = {}) => {
  const originals = {
    transaction: sequelize.transaction,
    campusFindOne: Campus.findOne,
    campusFindAll: Campus.findAll,
    collegeFindOne: College.findOne,
    collegeCreate: College.create,
    applicationFindOne: CollegeRegistrationApplication.findOne,
    applicationFindByPk: CollegeRegistrationApplication.findByPk,
    applicationCreate: CollegeRegistrationApplication.create,
    applicationFindAndCountAll: CollegeRegistrationApplication.findAndCountAll,
    userFindOne: User.findOne,
    userCreate: User.create,
    auditCreate: AuditLog.create,
    configFindByPk: Config.findByPk,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  sequelize.transaction = async (callback) => callback(transaction);
  Campus.findOne = async () => ({ id: 2, status: 'active' });
  Campus.findAll = async () => [];
  College.findOne = async () => null;
  College.create = async (values) => ({
    id: 70,
    ...values,
    update: async function updateCollege(patch) { Object.assign(this, patch); },
  });
  CollegeRegistrationApplication.findOne = async () => null;
  CollegeRegistrationApplication.findByPk = async () => null;
  CollegeRegistrationApplication.create = async (values) => ({ id: 40, ...values });
  CollegeRegistrationApplication.findAndCountAll = async () => ({ rows: [], count: 0 });
  User.findOne = async () => null;
  User.create = async (values) => ({ id: 80, ...values });
  AuditLog.create = async () => ({ id: 1 });
  Config.findByPk = async () => null;
  Object.entries(overrides).forEach(([key, value]) => {
    const [modelName, methodName] = key.split('.');
    const model = { sequelize, Campus, College, CollegeRegistrationApplication, User, AuditLog, Config }[modelName];
    model[methodName] = value;
  });
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Campus.findOne = originals.campusFindOne;
    Campus.findAll = originals.campusFindAll;
    College.findOne = originals.collegeFindOne;
    College.create = originals.collegeCreate;
    CollegeRegistrationApplication.findOne = originals.applicationFindOne;
    CollegeRegistrationApplication.findByPk = originals.applicationFindByPk;
    CollegeRegistrationApplication.create = originals.applicationCreate;
    CollegeRegistrationApplication.findAndCountAll = originals.applicationFindAndCountAll;
    User.findOne = originals.userFindOne;
    User.create = originals.userCreate;
    AuditLog.create = originals.auditCreate;
    Config.findByPk = originals.configFindByPk;
  });
  return transaction;
};

test('valid college registration reserves identifiers, hashes credentials, and remains pending', async (t) => {
  setupModels(t);
  let inserted;
  CollegeRegistrationApplication.create = async (values) => {
    inserted = values;
    return { id: 40, ...values };
  };
  const response = makeResponse();

  await controller.submitApplication({ body: validPayload }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.application.status, 'pending');
  assert.equal(response.payload.application.id, 40);
  assert.equal(inserted.collegeCode, 'CNS-01');
  assert.equal(inserted.reservedCollegeCode, 'CNS-01');
  assert.equal(inserted.reservedUsername, 'science.manager');
  assert.equal(inserted.reservedEmail, 'manager@example.edu');
  assert.equal(await bcrypt.compare(validPayload.password, inserted.representativePasswordHash), true);
  assert.equal(inserted.role, undefined);
  assert.equal(inserted.password, undefined);
  assert.notEqual(inserted.statusTokenHash, response.payload.statusToken);
  assert.equal(response.payload.application.representativePasswordHash, undefined);
});

test('registration rejects invalid fields, password mismatch, duplicate college, and duplicate account', async (t) => {
  setupModels(t);
  CollegeRegistrationApplication.create = async () => assert.fail('invalid or duplicate applications must not be created');

  const invalid = makeResponse();
  await controller.submitApplication({ body: { ...validPayload, collegeCode: 'x', representativePhone: 'bad' } }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);
  assert.ok(invalid.payload.errors.collegeCode);
  assert.ok(invalid.payload.errors.representativePhone);

  const mismatch = makeResponse();
  await controller.submitApplication({ body: { ...validPayload, confirmPassword: 'DifferentPass123' } }, mismatch, (error) => { throw error; });
  assert.equal(mismatch.statusCode, 400);
  assert.match(mismatch.payload.errors.confirmPassword, /do not match/);

  College.findOne = async () => ({ id: 10 });
  const collegeConflict = makeResponse();
  await controller.submitApplication({ body: validPayload }, collegeConflict, (error) => { throw error; });
  assert.equal(collegeConflict.statusCode, 409);

  College.findOne = async () => null;
  User.findOne = async () => ({ id: 11 });
  const userConflict = makeResponse();
  await controller.submitApplication({ body: validPayload }, userConflict, (error) => { throw error; });
  assert.equal(userConflict.statusCode, 409);
});

test('application status requires its private status token and does not expose credentials', async (t) => {
  setupModels(t);
  const token = 'a'.repeat(64);
  const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
  CollegeRegistrationApplication.findByPk = async () => ({
    id: 40,
    collegeName: validPayload.collegeName,
    status: 'rejected',
    submittedAt: new Date(),
    reviewedAt: new Date(),
    rejectionReason: 'Please provide an official contact.',
    statusTokenHash: tokenHash,
    representativePasswordHash: 'must-not-leak',
  });

  const unauthorized = makeResponse();
  await controller.getApplicationStatus({ params: { id: '40' }, get: () => 'b'.repeat(64) }, unauthorized, (error) => { throw error; });
  assert.equal(unauthorized.statusCode, 404);

  const authorized = makeResponse();
  await controller.getApplicationStatus({ params: { id: '40' }, get: () => token }, authorized, (error) => { throw error; });
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.payload.application.status, 'rejected');
  assert.equal(authorized.payload.application.rejectionReason, 'Please provide an official contact.');
  assert.equal(JSON.stringify(authorized.payload).includes('must-not-leak'), false);
});

test('administrator approval atomically creates one college and manager; repeated approval is idempotent', async (t) => {
  const transaction = setupModels(t);
  const application = {
    id: 40,
    status: 'pending',
    collegeName: validPayload.collegeName,
    collegeCode: validPayload.collegeCode,
    campusId: 2,
    collegeDescription: validPayload.collegeDescription,
    collegeEmail: validPayload.collegeEmail,
    collegePhone: validPayload.collegePhone,
    officeLocation: validPayload.officeLocation,
    representativeFullName: validPayload.representativeFullName,
    representativeUsername: validPayload.representativeUsername,
    representativeEmail: validPayload.representativeEmail,
    representativePhone: validPayload.representativePhone,
    representativePasswordHash: await bcrypt.hash(validPayload.password, 10),
    update: async function updateApplication(patch) { Object.assign(this, patch); },
  };
  CollegeRegistrationApplication.findByPk = async (id, options) => {
    assert.equal(id, '40');
    assert.equal(options.transaction, transaction);
    return application;
  };
  let collegeCreated = 0;
  let userCreated = 0;
  College.create = async (values) => {
    collegeCreated += 1;
    assert.equal(values.status, 'active');
    return { id: 70, ...values, update: async function updateCollege(patch) { Object.assign(this, patch); } };
  };
  User.create = async (values) => {
    userCreated += 1;
    assert.equal(values.role, 'college_manager');
    assert.equal(values.collegeId, 70);
    assert.equal(await bcrypt.compare(validPayload.password, values.password), true);
    return { id: 80, ...values };
  };
  const request = { params: { id: '40' }, user: { id: 5 } };
  const first = makeResponse();
  await controller.approveApplication(request, first, (error) => { throw error; });
  assert.equal(first.statusCode, 200);
  assert.equal(application.status, 'approved');
  assert.equal(application.reviewedBy, 5);
  assert.equal(application.collegeId, 70);
  assert.equal(application.userId, 80);
  assert.equal(application.representativePasswordHash, null);
  assert.equal(application.reservedCollegeCode, null);

  const repeated = makeResponse();
  await controller.approveApplication(request, repeated, (error) => { throw error; });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.payload.message, 'Registration was already approved.');
  assert.equal(collegeCreated, 1);
  assert.equal(userCreated, 1);
});

test('administrator rejection releases reservations and requires an explanation', async (t) => {
  setupModels(t);
  const application = {
    id: 40,
    status: 'pending',
    update: async function updateApplication(patch) { Object.assign(this, patch); },
  };
  CollegeRegistrationApplication.findByPk = async () => application;

  const missingReason = makeResponse();
  await controller.rejectApplication({ params: { id: '40' }, body: {}, user: { id: 5 } }, missingReason, (error) => { throw error; });
  assert.equal(missingReason.statusCode, 400);

  const rejected = makeResponse();
  await controller.rejectApplication({ params: { id: '40' }, body: { reason: 'Incomplete official college details.' }, user: { id: 5 } }, rejected, (error) => { throw error; });
  assert.equal(rejected.statusCode, 200);
  assert.equal(application.status, 'rejected');
  assert.equal(application.rejectionReason, 'Incomplete official college details.');
  assert.equal(application.representativePasswordHash, null);
  assert.equal(application.reservedCollegeCode, null);
});

test('approval transaction rolls back college creation if representative creation fails', async (t) => {
  const transaction = setupModels(t);
  const application = {
    id: 40,
    status: 'pending',
    collegeName: validPayload.collegeName,
    collegeCode: validPayload.collegeCode,
    campusId: 2,
    collegeDescription: validPayload.collegeDescription,
    collegeEmail: validPayload.collegeEmail,
    collegePhone: validPayload.collegePhone,
    officeLocation: validPayload.officeLocation,
    representativeFullName: validPayload.representativeFullName,
    representativeUsername: validPayload.representativeUsername,
    representativeEmail: validPayload.representativeEmail,
    representativePhone: validPayload.representativePhone,
    representativePasswordHash: await bcrypt.hash(validPayload.password, 10),
    update: async function updateApplication(patch) { Object.assign(this, patch); },
  };
  let rolledBack = false;
  sequelize.transaction = async (callback) => {
    try {
      return await callback(transaction);
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  };
  CollegeRegistrationApplication.findByPk = async () => application;
  College.create = async (values) => ({ id: 70, ...values, update: async () => {} });
  User.create = async () => { throw new Error('representative insert failed'); };
  const errors = [];

  await controller.approveApplication({ params: { id: '40' }, user: { id: 5 } }, makeResponse(), (error) => errors.push(error));

  assert.equal(rolledBack, true);
  assert.match(errors[0].message, /representative insert failed/);
  assert.equal(application.status, 'pending');
});

test('administrator review routes require authentication and the administrator role', () => {
  const route = adminRoutes.stack.find((layer) => layer.route?.path === '/:id/approve');
  assert.ok(route);
  assert.deepEqual(adminRoutes.stack.slice(0, 2).map((layer) => layer.name), ['requireAuth', 'requireRoleMiddleware']);
});
