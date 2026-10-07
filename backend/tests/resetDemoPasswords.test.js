const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { EXPECTED_ROLES, resetDemoPasswords } = require('../src/scripts/resetDemoPasswords');

const createResetHarness = (overrides = {}) => {
  const usernames = Object.keys(EXPECTED_ROLES);
  const accounts = usernames.map((username, index) => ({
    id: index + 1,
    username,
    role: EXPECTED_ROLES[username],
    active: true,
    status: 'active',
    lockoutUntil: null,
    password: 'old-hash',
  }));
  const calls = { authenticate: 0, transaction: 0, updates: [] };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const database = {
    authenticate: async () => { calls.authenticate += 1; },
    transaction: async (callback) => {
      calls.transaction += 1;
      return callback(transaction);
    },
  };
  const userModel = {
    findAll: async (options) => {
      if (options.attributes.includes('password')) return accounts;
      return accounts;
    },
    update: async (values, options) => {
      calls.updates.push({ values, options });
      accounts.forEach((account) => {
        account.password = values.password;
      });
      return [accounts.length];
    },
  };

  return {
    accounts,
    calls,
    database: overrides.database || database,
    userModel: overrides.userModel || userModel,
  };
};

test('password reset requires SEED_DEMO_PASSWORD before connecting or updating', async () => {
  const harness = createResetHarness();
  await assert.rejects(
    resetDemoPasswords({
      password: '',
      database: harness.database,
      userModel: harness.userModel,
      getRolePermissions: async () => [],
    }),
    /SEED_DEMO_PASSWORD is required/
  );
  assert.equal(harness.calls.authenticate, 0);
  assert.equal(harness.calls.transaction, 0);
  assert.equal(harness.calls.updates.length, 0);
});

test('password reset does not start a transaction when database authentication fails', async () => {
  const harness = createResetHarness({
    database: {
      authenticate: async () => { throw new Error('connection failed'); },
      transaction: async () => { harness.calls.transaction += 1; },
    },
  });
  await assert.rejects(resetDemoPasswords({
    password: 'test-only-password',
    database: harness.database,
    userModel: harness.userModel,
    getRolePermissions: async () => [],
  }), /connection failed/);
  assert.equal(harness.calls.transaction, 0);
  assert.equal(harness.calls.updates.length, 0);
});

test('password reset updates only password and verifies all eight account roles, access and permissions', async () => {
  const harness = createResetHarness();
  const permissions = {
    admin: ['*'],
    ict_officer: ['ict.assets.view'],
    college_manager: ['college.dashboard.view'],
    department_head: ['department.profile.view'],
    finance: ['financial.view'],
    store_manager: ['inventory.view'],
    maintenance: ['maintenance.view'],
    infrastructure: ['assets.view'],
  };

  const usernames = await resetDemoPasswords({
    password: 'test-only-password',
    database: harness.database,
    userModel: harness.userModel,
    getRolePermissions: async (role) => permissions[role],
  });

  assert.deepEqual(usernames, Object.keys(EXPECTED_ROLES));
  assert.equal(harness.calls.authenticate, 1);
  assert.equal(harness.calls.transaction, 1);
  assert.equal(harness.calls.updates.length, 1);
  assert.deepEqual(Object.keys(harness.calls.updates[0].values), ['password']);
  assert.equal(harness.accounts.every((account) => account.role === EXPECTED_ROLES[account.username]), true);
  assert.equal(harness.accounts.every((account) => account.active && account.status === 'active'), true);
  assert.equal(
    await Promise.all(harness.accounts.map((account) => bcrypt.compare('test-only-password', account.password))).then((checks) => checks.every(Boolean)),
    true
  );
});

test('password reset aborts before updates if an account is inactive or has a changed role', async () => {
  for (const mutate of [
    (accounts) => { accounts[3].active = false; },
    (accounts) => { accounts[3].role = 'staff'; },
  ]) {
    const harness = createResetHarness();
    mutate(harness.accounts);

    await assert.rejects(resetDemoPasswords({
      password: 'test-only-password',
      database: harness.database,
      userModel: harness.userModel,
      getRolePermissions: async () => [],
    }), /missing, inactive, locked, or have unexpected roles/);
    assert.equal(harness.calls.updates.length, 0);
  }
});
