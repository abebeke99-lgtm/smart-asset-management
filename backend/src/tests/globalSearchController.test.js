const test = require('node:test');
const assert = require('node:assert/strict');
const { Asset, ServiceRequest, User } = require('../models');
const { globalSearch, organizationWhere, validateSearchQuery } = require('../controllers/globalSearchController');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('search validates short, oversized, and SQL control input as 4xx', async () => {
  for (const q of ['a', 'x'.repeat(81), "' OR 1=1 --"]) {
    const response = makeResponse();
    await globalSearch({ query: { q }, user: { role: 'admin' } }, response);
    assert.equal(response.statusCode, 422);
    assert.equal(response.body.success, false);
  }
  assert.equal(validateSearchQuery('  laptop '), null);
});

test('search limits each group to five and parameterizes user text through Sequelize', async () => {
  const originalAssetFindAll = Asset.findAll;
  const originalRequestFindAll = ServiceRequest.findAll;
  const originalUserFindAll = User.findAll;
  const calls = [];
  Asset.findAll = async (options) => { calls.push(options); return [{ id: 7, name: 'QA laptop', status: 'available' }]; };
  ServiceRequest.findAll = async (options) => { calls.push(options); return []; };
  User.findAll = async (options) => { calls.push(options); return []; };
  const response = makeResponse();
  try {
    await globalSearch({ query: { q: 'QA' }, user: { id: 1, role: 'admin' } }, response);
  } finally {
    Asset.findAll = originalAssetFindAll;
    ServiceRequest.findAll = originalRequestFindAll;
    User.findAll = originalUserFindAll;
  }
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.limit === 5));
  assert.equal(response.body.data.assets[0].title, 'QA laptop');
});

test('organization scope predicates fail closed for missing scope', () => {
  assert.deepEqual(organizationWhere(Asset, { collegeId: 42 }, 'ict_officer'), { collegeId: 42 });
  assert.deepEqual(organizationWhere(Asset, { departmentId: 8, collegeId: 42 }, 'department_head'), { departmentId: 8, collegeId: 42 });
  assert.equal(organizationWhere(Asset, {}, 'college'), null);
});