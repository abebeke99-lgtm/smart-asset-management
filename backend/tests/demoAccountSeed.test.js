const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const { DEMO_USERS, seedDatabase, seedOperationalData } = require('../src/config/seed');

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
    seedOperationalData: false,
  };

  const firstRun = await seedDatabase(options);
  assert.deepEqual(firstRun, { created: DEMO_USERS.length - 1, existing: 1 });
  assert.equal(models.users.size, DEMO_USERS.length);
  assert.equal(models.users.get('finance').password, existingPasswordHash);
  assert.equal(await bcrypt.compare('seed-test-password', models.users.get('admin').password), true);
  assert.equal(models.users.get('admin').password.startsWith('$2'), true);

  const secondRun = await seedDatabase(options);
  assert.deepEqual(secondRun, { created: 0, existing: DEMO_USERS.length });
  assert.equal(models.users.get('finance').password, existingPasswordHash);
});

test('demo seeding does not claim an email address already used by another account', async () => {
  const models = createSeedModels([
    { username: 'existing_user', email: 'ict@bekelei.com', role: 'staff', password: 'existing-hash' },
  ]);

  await seedDatabase({ ...models, password: 'seed-test-password', seedOperationalData: false });

  assert.equal(models.users.get('existing_user').password, 'existing-hash');
  assert.equal(models.users.get('ict_officer').email, 'ict_officer@bekelei.com');
});

function createOperationalSeedModels() {
  const rows = {
    colleges: [],
    departments: [],
    locations: [],
    assets: [],
    assignments: [],
    maintenances: [],
    notifications: [],
  };
  const idState = { colleges: 1, departments: 1, locations: 1, assets: 1, assignments: 1, maintenances: 1, notifications: 1, users: 1 };

  const memoryModel = (table) => ({
    rows,
    async findOne({ where }) {
      const orConditions = where?.[Op.or];
      const conditions = Array.isArray(orConditions) ? orConditions : [where];
      for (const condition of conditions || []) {
        if (!condition) continue;
        const match = rows[table].find((row) => (
          Object.entries(condition).every(([key, value]) => row[key] === value)
        ));
        if (match) return match;
      }
      return null;
    },
    async findOrCreate({ where = {}, defaults = {} }) {
      const existing = await this.findOne({ where });
      if (existing) return [existing, false];
      const row = { id: idState[table]++, ...defaults };
      for (const [key, value] of Object.entries(where)) {
        if (row[key] === undefined) row[key] = value;
      }
      rows[table].push(row);
      return [row, true];
    },
    async create(values) {
      const row = { id: idState[table]++, ...values };
      rows[table].push(row);
      return row;
    },
    async update(values) {
      Object.assign(this, values);
    },
    async findAll() {
      return [];
    },
  });

  return {
    rows,
    assetModel: memoryModel('assets'),
    assignmentModel: memoryModel('assignments'),
    maintenanceModel: memoryModel('maintenances'),
    notificationModel: memoryModel('notifications'),
    userModel: memoryModel('users'),
    collegeModel: memoryModel('colleges'),
    departmentModel: memoryModel('departments'),
    locationModel: memoryModel('locations'),
  };
}

test('operational demo seeding keeps every sample asset, college, department, and location distinct', async () => {
  const models = createOperationalSeedModels();
  await seedOperationalData(models);
  const firstRun = Object.fromEntries(Object.entries(models.rows).map(([key, value]) => [key, value.length]));

  assert.equal(models.rows.assets.length, 20);
  assert.equal(models.rows.colleges.length, 2);
  assert.equal(models.rows.departments.length, 5);
  assert.equal(models.rows.locations.length, 5);
  assert.equal(
    models.rows.assets.length,
    new Set(models.rows.assets.map((asset) => asset.digitalId)).size
  );

  await seedOperationalData(models);
  const secondRun = Object.fromEntries(Object.entries(models.rows).map(([key, value]) => [key, value.length]));
  assert.deepEqual(secondRun, firstRun, 're-running the seed must not overwrite or duplicate demo rows');
});