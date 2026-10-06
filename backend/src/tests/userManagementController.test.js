const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { User, Role, UserActivityLog } = require('../models');
const { getAllUsers, getUserStats } = require('../controllers/userController');

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('user-management models map the documented status, password and activity columns', () => {
  assert.equal(User.rawAttributes.password.field, 'password_hash');
  assert.equal(User.rawAttributes.lastLoginAt.field, 'last_login');
  assert.deepEqual(User.rawAttributes.status.type.values, ['active', 'inactive', 'suspended']);
  assert.equal(Role.getTableName(), 'roles');
  assert.equal(UserActivityLog.getTableName(), 'user_activity_logs');
  assert.equal(UserActivityLog.rawAttributes.userId.field, 'user_id');
});

test('user statistics report all explicit account statuses and retain legacy aliases', async (t) => {
  const originalFindAll = User.findAll;
  User.findAll = async ({ attributes }) => (
    attributes[0] === 'status'
      ? [
        { status: 'active', count: '7' },
        { status: 'inactive', count: '2' },
        { status: 'suspended', count: '1' },
      ]
      : [
        { role: 'admin', count: '1' },
        { role: 'staff', count: '9' },
      ]
  );
  t.after(() => { User.findAll = originalFindAll; });

  const res = makeResponse();
  await getUserStats({}, res, (error) => { throw error; });

  assert.deepEqual(res.payload.data, {
    total: 10,
    totalUsers: 10,
    active: 7,
    activeUsers: 7,
    inactive: 2,
    inactiveUsers: 2,
    suspended: 1,
    admins: 1,
    adminCount: 1,
    roleCounts: { admin: 1, staff: 9 },
  });
});

test('user list applies status, role, college, search and pagination filters', async (t) => {
  const originalFindAndCountAll = User.findAndCountAll;
  let query;
  User.findAndCountAll = async (options) => {
    query = options;
    return { count: 0, rows: [] };
  };
  t.after(() => { User.findAndCountAll = originalFindAndCountAll; });

  const req = {
    user: { id: 1, role: 'admin' },
    query: {
      status: 'suspended',
      role: 'ict_officer',
      collegeId: '4',
      search: 'network',
      page: '2',
      limit: '5',
    },
  };
  const res = makeResponse();
  await getAllUsers(req, res);

  assert.equal(query.where.status, 'suspended');
  assert.equal(query.where.role, 'ict_officer');
  assert.equal(query.where.collegeId, 4);
  assert.equal(query.limit, 5);
  assert.equal(query.offset, 5);
  assert.ok(query.where[Op.or].some((condition) => condition['$College.collegeName$']));
  assert.equal(res.payload.pagination.page, 2);
  assert.equal(res.payload.pagination.total, 0);
});
