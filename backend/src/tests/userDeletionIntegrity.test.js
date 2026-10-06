const test = require('node:test');
const assert = require('node:assert/strict');
const { User } = require('../models');
const userController = require('../controllers/userController');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('user deletion preserves assignment history and rejects a referenced account', async (t) => {
  const originals = { findByPk: User.findByPk, associations: User.associations };
  let destroyed = false;
  User.findByPk = async () => ({ id: 81, username: 'history-user', async destroy() { destroyed = true; } });
  User.associations = {
    AssignmentsReceived: { associationType: 'HasMany', as: 'AssignmentsReceived', foreignKey: 'assignedTo', target: { count: async ({ where }) => where.assignedTo === 81 ? 1 : 0 } },
  };
  t.after(() => { User.findByPk = originals.findByPk; User.associations = originals.associations; });

  const res = makeResponse();
  await userController.deleteUser({ params: { id: '81' }, user: { id: 1, username: 'admin' } }, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /linked to existing records/i);
  assert.equal(destroyed, false);
});
