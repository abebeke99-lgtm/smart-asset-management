const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Transfer } = require('../models');
const workflow = require('../controllers/transferWorkflowController');

test('transfer list applies organization scope, legacy status aliases, search, dates, pagination, and scoped summaries', async (t) => {
  const originalFindAndCountAll = Transfer.findAndCountAll;
  const originalCount = Transfer.count;
  let query;
  let response;
  const countQueries = [];
  t.after(() => {
    Transfer.findAndCountAll = originalFindAndCountAll;
    Transfer.count = originalCount;
  });

  Transfer.findAndCountAll = async (options) => {
    query = options;
    return { count: 21, rows: [] };
  };
  Transfer.count = async (options) => {
    countQueries.push(options);
    const { where } = options;
    const statuses = where.status?.[Op.in];
    if (!statuses) return 30;
    if (statuses.length === 2 && statuses.includes('Requested')) return 8;
    if (statuses.includes('Approved') && statuses.includes('In Transit')) return 9;
    if (statuses.includes('Received') && statuses.includes('Completed')) return 7;
    if (statuses.includes('Rejected') && statuses.includes('Cancelled')) return 6;
    if (statuses.includes('Pending')) return 2;
    if (statuses.includes('Ready')) return 3;
    if (statuses.includes('In Progress')) return 4;
    if (statuses.includes('Rejected')) return 5;
    if (statuses.includes('Cancelled')) return 1;
    return 10;
  };

  await workflow.listTransfers({
    organizationScope: { departmentId: 14, collegeId: 3 },
    query: { status: 'Pending', search: 'AST-029', dateFrom: '2026-05-01', dateTo: '2026-05-31', page: '2', limit: '10' },
  }, {
    json(payload) {
      response = payload;
      return payload;
    },
    status(code) {
      return { json(payload) { response = { statusCode: code, ...payload }; return response; } };
    },
  }, (error) => { throw error; });

  assert.deepEqual(query.where.status[Op.in], ['Requested', 'Pending']);
  assert.equal(query.where.transferDate[Op.gte].toISOString(), '2026-05-01T00:00:00.000Z');
  assert.equal(query.where.transferDate[Op.lte].toISOString(), '2026-05-31T23:59:59.999Z');
  assert.equal(query.limit, 10);
  assert.equal(query.offset, 10);
  assert.equal(query.distinct, true);
  const clauses = query.where[Op.and];
  assert.ok(clauses.some((clause) => clause[Op.or]?.some((term) => term['$Asset.name$'] || term['$Asset.assetCode$'])));
  assert.ok(clauses[0][Op.or].some((term) => term['$Asset.departmentId$'] === 14));
  assert.ok(clauses[1][Op.or].some((term) => term['$Asset.collegeId$'] === 3));
  assert.ok(countQueries[0].include.some((include) => include.model === require('../models').Asset));
  assert.equal(countQueries[0].distinct, true);
  assert.equal(response.success, true);
  assert.equal(response.pagination.total, 21);
  assert.equal(response.pagination.pages, 3);
  assert.equal(response.summary.total, 30);
  assert.equal(response.summary.pending, 8);
  assert.equal(response.summary.approved, 9);
  assert.equal(response.summary.received, 7);
  assert.equal(response.summary.rejectedCancelled, 6);
});

test('transfer list rejects invalid date filters', async (t) => {
  const originalFindAndCountAll = Transfer.findAndCountAll;
  let statusCode;
  let response;
  t.after(() => { Transfer.findAndCountAll = originalFindAndCountAll; });
  Transfer.findAndCountAll = async () => assert.fail('invalid filters must not query transfers');

  await workflow.listTransfers({ organizationScope: { collegeId: 3 }, query: { dateFrom: 'not-a-date' } }, {
    json(payload) { response = payload; },
    status(code) {
      statusCode = code;
      return { json(payload) { response = payload; } };
    },
  }, (error) => { throw error; });

  assert.equal(statusCode, 400);
  assert.equal(response.message, 'Invalid start date filter.');
});
