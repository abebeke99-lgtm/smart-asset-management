const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const userController = require('../src/controllers/userController');

const originalFindByPk = models.User.findByPk;
const originalAuditLogCreate = models.AuditLog.create;

test('updateProfile accepts camelCase payload and returns the updated user data', async () => {
  const savedUser = {
    id: 42,
    fullName: 'Old Name',
    email: 'old@example.com',
    phone: '1111111111',
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
    toJSON() {
      return { ...this };
    }
  };

  models.User.findByPk = async (id) => (id === savedUser.id ? savedUser : null);
  models.AuditLog.create = async () => ({ id: 1 });

  let responsePayload;
  const req = {
    user: { id: savedUser.id },
    body: {
      fullName: 'Updated Name',
      email: 'updated@example.com',
      phone: '2222222222'
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

  await userController.updateProfile(req, res);

  assert.equal(savedUser.fullName, 'Updated Name');
  assert.equal(savedUser.email, 'updated@example.com');
  assert.equal(savedUser.phone, '2222222222');
  assert.ok(responsePayload && responsePayload.success === true);
  assert.equal(responsePayload.data.fullName, 'Updated Name');
  assert.equal(responsePayload.data.email, 'updated@example.com');
  assert.equal(responsePayload.data.phone, '2222222222');

  models.User.findByPk = originalFindByPk;
  models.AuditLog.create = originalAuditLogCreate;
});
