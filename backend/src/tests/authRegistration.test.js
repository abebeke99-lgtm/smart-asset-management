const test = require('node:test');
const assert = require('node:assert/strict');
const { User, Config } = require('../models');
const { register } = require('../controllers/authController');

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const payload = {
  fullName: 'Public Student',
  username: 'public.student',
  email: 'PUBLIC.STUDENT@example.edu',
  phone: '+1 555 123 4567',
  department: 'Physics',
  role: 'student',
  collegeId: 9999,
  departmentId: 9999,
  password: 'StudentPass123',
  confirmPassword: 'StudentPass123',
};

const setupRegistration = (t, { existing = [], create } = {}) => {
  const originalFindAll = User.findAll;
  const originalCreate = User.create;
  const originalConfigFindByPk = Config.findByPk;
  User.findAll = async () => existing;
  User.create = create || (async (values) => ({ id: 50, ...values }));
  Config.findByPk = async () => null;
  t.after(() => {
    User.findAll = originalFindAll;
    User.create = originalCreate;
    Config.findByPk = originalConfigFindByPk;
  });
};

test('public registration creates only a student/staff account without accepting organization identifiers or returning secrets', async (t) => {
  setupRegistration(t);
  let inserted;
  User.create = async (values) => {
    inserted = values;
    return { id: 50, ...values };
  };
  const res = response();

  await register({ body: payload, requestId: 'registration-test' }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(inserted.role, 'student');
  assert.equal(inserted.collegeId, undefined);
  assert.equal(inserted.departmentId, undefined);
  assert.equal(inserted.phone, '+1 555 123 4567');
  assert.notEqual(inserted.password, payload.password);
  assert.equal(res.payload.user.password, undefined);
  assert.equal(res.payload.token, undefined);
});

test('public registration rejects privileged roles and invalid identity/password values', async (t) => {
  setupRegistration(t);
  User.create = async () => assert.fail('invalid public registration must not create an account');

  const privileged = response();
  await register({ body: { ...payload, role: 'admin' } }, privileged);
  assert.equal(privileged.statusCode, 400);

  const missingName = response();
  await register({ body: { ...payload, fullName: ' ' } }, missingName);
  assert.equal(missingName.statusCode, 400);

  const badPhone = response();
  await register({ body: { ...payload, phone: 'x' } }, badPhone);
  assert.equal(badPhone.statusCode, 400);
});

test('public registration rejects duplicate usernames/emails and maps uniqueness races to conflict', async (t) => {
  setupRegistration(t, { existing: [{ username: 'PUBLIC.STUDENT', email: 'another@example.edu' }] });
  User.create = async () => assert.fail('duplicate accounts must not be created');

  const duplicate = response();
  await register({ body: payload }, duplicate);
  assert.equal(duplicate.statusCode, 409);

  User.findAll = async () => [];
  User.create = async () => { const error = new Error('unique'); error.name = 'SequelizeUniqueConstraintError'; throw error; };
  const race = response();
  await register({ body: payload }, race);
  assert.equal(race.statusCode, 409);
});

test('public registration hides database failure details', async (t) => {
  setupRegistration(t, { create: async () => { throw new Error('private database credentials'); } });
  const res = response();
  const originalError = console.error;
  console.error = () => {};
  try {
    await register({ body: payload }, res);
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(res.payload), /private database credentials/);
});
