const test = require('node:test');
const assert = require('node:assert/strict');
const { Maintenance } = require('../models');
const { getOversightList, getOversightDetail } = require('../controllers/maintenanceRequestWorkflowController');

test('department maintenance oversight scopes Asset include with model attributes and valid history columns', async () => {
  const originalFindAndCountAll = Maintenance.findAndCountAll;
  const originalFindAll = Maintenance.findAll;
  let queryOptions;
  Maintenance.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 0, rows: [] };
  };
  Maintenance.findAll = async () => [];

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await getOversightList({
      organizationScope: { departmentId: 42, collegeId: 7 },
      query: { limit: '100' },
    }, response, (error) => { throw error; });
  } finally {
    Maintenance.findAndCountAll = originalFindAndCountAll;
    Maintenance.findAll = originalFindAll;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(queryOptions.include[0].where, { departmentId: 42 });
  assert.equal(queryOptions.include[0].required, true);
  const historyInclude = queryOptions.include.find((include) => include.model.name === 'MaintenanceHistory');
  assert.deepEqual(historyInclude.attributes, ['id', 'actionType', 'description', 'actionDate', 'userId']);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.length, 0);
});

test('college maintenance oversight falls back to college-scoped Asset attributes', async () => {
  const originalFindAndCountAll = Maintenance.findAndCountAll;
  const originalFindAll = Maintenance.findAll;
  let queryOptions;
  Maintenance.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 0, rows: [] };
  };
  Maintenance.findAll = async () => [];

  try {
    await getOversightList({
      organizationScope: { departmentId: null, collegeId: 7 },
      query: {},
    }, { json() {} }, (error) => { throw error; });
  } finally {
    Maintenance.findAndCountAll = originalFindAndCountAll;
    Maintenance.findAll = originalFindAll;
  }

  assert.deepEqual(queryOptions.include[0].where, { collegeId: 7 });
});

test('department maintenance detail scopes the Asset include with model attributes', async () => {
  const originalFindOne = Maintenance.findOne;
  let queryOptions;
  Maintenance.findOne = async (options) => {
    queryOptions = options;
    return null;
  };
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await getOversightDetail({
      organizationScope: { departmentId: 42, collegeId: 7 },
      params: { id: '15' },
    }, response, (error) => { throw error; });
  } finally {
    Maintenance.findOne = originalFindOne;
  }

  assert.equal(response.statusCode, 404);
  assert.deepEqual(queryOptions.include[0].where, { departmentId: 42 });
  assert.equal(queryOptions.include[0].required, true);
});
