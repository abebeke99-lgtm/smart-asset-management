const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const { getAllUsers } = require('../src/controllers/userController');

test('store-manager user listing resolves missing college scope and rejects invalid scope', async () => {
  const originalCollegeFindOne = models.College.findOne;
  const originalUserFindAndCountAll = models.User.findAndCountAll;
  let queryOptions;

  models.College.findOne = async ({ where }) => (
    where.managerId === 23 ? { id: 7 } : null
  );
  models.User.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 0, rows: [] };
  };

  const createResponse = () => ({
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

  try {
    const scopedResponse = createResponse();
    await getAllUsers({ user: { id: 23, role: 'store_manager' }, query: {} }, scopedResponse);
    assert.equal(queryOptions.where.collegeId, 7);
    assert.equal(scopedResponse.statusCode, 200);

    queryOptions = undefined;
    const invalidResponse = createResponse();
    await getAllUsers({
      user: { id: 23, role: 'store_manager' },
      organizationScope: { collegeId: 'not-a-number' },
      query: {},
    }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 403);
    assert.equal(queryOptions, undefined);
  } finally {
    models.College.findOne = originalCollegeFindOne;
    models.User.findAndCountAll = originalUserFindAndCountAll;
  }
});