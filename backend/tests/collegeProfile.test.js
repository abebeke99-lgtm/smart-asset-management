const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const collegeController = require('../src/controllers/collegeController');

const originalFindByPk = models.College.findByPk;
const originalAuditLogCreate = models.AuditLog.create;

test('college profile update keeps changes scoped and records old/new values in the audit trail', async () => {
  const originalCollege = {
    id: 12,
    collegeName: 'Old College',
    collegeCode: 'CLG-OLD',
    description: 'Old description',
    location: 'Old location',
    phone: '0911111111',
    email: 'old@example.com',
    status: 'active',
    toJSON() {
      return { ...this };
    },
    async update(changes) {
      Object.assign(this, changes);
      return this;
    }
  };

  models.College.findByPk = async (id) => (id === originalCollege.id ? originalCollege : null);

  let auditPayload = null;
  models.AuditLog.create = async (payload) => {
    auditPayload = payload;
    return { id: 77 };
  };

  let responsePayload;
  const req = {
    user: { id: 9, role: 'college_manager' },
    organizationScope: { collegeId: originalCollege.id },
    body: {
      collegeName: 'New College',
      description: 'New description',
      location: 'New location',
      phone: '0922222222',
      email: 'new@example.com',
    }
  };
  const res = {
    json(payload) {
      responsePayload = payload;
    },
    status(code) {
      return { json: (payload) => {
        responsePayload = payload;
        this.statusCode = code;
      } };
    }
  };

  await collegeController.updateCollegeProfile(req, res);

  assert.equal(originalCollege.collegeName, 'New College');
  assert.equal(originalCollege.description, 'New description');
  assert.equal(originalCollege.location, 'New location');
  assert.equal(originalCollege.phone, '0922222222');
  assert.equal(originalCollege.email, 'new@example.com');
  assert.ok(responsePayload && responsePayload.success === true);
  assert.ok(auditPayload);
  assert.ok(typeof auditPayload.details === 'string');
  const auditDetails = JSON.parse(auditPayload.details);
  assert.deepEqual(auditDetails.oldValue.collegeName, 'Old College');
  assert.deepEqual(auditDetails.newValue.collegeName, 'New College');
  assert.deepEqual(auditDetails.entity, `college:${originalCollege.id}`);

  models.College.findByPk = originalFindByPk;
  models.AuditLog.create = originalAuditLogCreate;
});

test('college profile update rejects unauthorized mass-assignment keys', async () => {
  const originalCollege = {
    id: 13,
    collegeName: 'Secure College',
    collegeCode: 'CLG-SEC',
    description: 'Initial description',
    location: 'Initial location',
    phone: '0999999999',
    email: 'secure@example.com',
    status: 'active',
    toJSON() {
      return { ...this };
    },
    async update(changes) {
      Object.assign(this, changes);
      return this;
    }
  };

  models.College.findByPk = async (id) => (id === originalCollege.id ? originalCollege : null);
  models.AuditLog.create = async () => ({ id: 88 });

  let responsePayload;
  const req = {
    user: { id: 10, role: 'college_manager' },
    organizationScope: { collegeId: originalCollege.id },
    body: {
      collegeName: 'Attempted Change',
      role: 'admin',
      permissions: ['*'],
      collegeId: 999,
      status: 'inactive'
    }
  };
  const res = {
    json(payload) { responsePayload = payload; },
    status(code) {
      return { json: (payload) => {
        responsePayload = payload;
        this.statusCode = code;
      } };
    }
  };

  await collegeController.updateCollegeProfile(req, res);

  assert.equal(originalCollege.collegeName, 'Secure College');
  assert.equal(responsePayload.success, false);
  assert.equal(responsePayload.message, 'Unsupported college profile fields were supplied.');

  models.College.findByPk = originalFindByPk;
  models.AuditLog.create = originalAuditLogCreate;
});
