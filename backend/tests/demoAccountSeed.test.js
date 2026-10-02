const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { DEMO_USERS, seedDatabase } = require('../src/config/seed');

function createSeedModels(initialUsers = []) {
  const users = new Map(initialUsers.map((user) => [user.username, { ...user }]));
  let nextId = users.size + 1;

  const userModel = {
    async findOne({ where }) {
      if (where.username) return users.get(where.username) || null;
      return [...users.values()].find((user) => user.email === where.email) || null;
    },
    async findOrCreate({ where, defaults }) {
      const existing = users.get(where.username);
      if (existing) return [existing, false];

      const user = {
        ...defaults,
        id: nextId++,
        async update(values) {
          Object.assign(this, values);
        },
      };
      users.set(user.username, user);
      return [user, true];
    },
  };

  const collegeModel = {
    async findOne() {
      return { id: 1, collegeName: 'Engineering', status: 'active' };
    },
  };
  const departmentModel = {
    async findOne() {
      return { id: 1, collegeId: 1, name: 'Engineering', status: 'active' };
    },
  };

  return { users, userModel, collegeModel, departmentModel };
}

test('demo seeding hashes passwords, preserves existing users, and is idempotent', async () => {
  const existingPasswordHash = await bcrypt.hash('existing-account-password', 4);
  const models = createSeedModels([
    { username: 'finance', email: 'finance@bekelei.com', role: 'finance', password: existingPasswordHash },
  ]);
  const options = {
    ...models,
    password: 'seed-test-password',
  };

  const firstRun = await seedDatabase(options);
  assert.deepEqual(firstRun, { created: DEMO_USERS.length - 1, existing: 1 });
  assert.equal(models.users.size, DEMO_USERS.length);
  assert.equal(models.users.get('finance').password, existingPasswordHash);
  assert.equal(await bcrypt.compare('seed-test-password', models.users.get('admin').password), true);

  const secondRun = await seedDatabase(options);
  assert.deepEqual(secondRun, { created: 0, existing: DEMO_USERS.length });
  assert.equal(models.users.get('finance').password, existingPasswordHash);
});

test('demo seeding does not claim an email address already used by another account', async () => {
  const models = createSeedModels([
    { username: 'existing_user', email: 'ict@bekelei.com', role: 'staff', password: 'existing-hash' },
  ]);

  await seedDatabase({ ...models, password: 'seed-test-password' });

  assert.equal(models.users.get('existing_user').password, 'existing-hash');
  assert.equal(models.users.get('ict_officer').email, null);
});