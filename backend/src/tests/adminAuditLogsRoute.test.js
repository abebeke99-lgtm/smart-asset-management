const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { AuditLog } = require('../models');
const adminSupportRoutes = require('../routes/adminSupportRoutes');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const getAuditListHandler = () => {
  const layer = adminSupportRoutes.stack.find((entry) => (
    entry.route?.methods.get
    && (Array.isArray(entry.route.path) ? entry.route.path.includes('/audit-logs') : entry.route.path === '/audit-logs')
  ));
  assert.ok(layer, 'expected GET /audit-logs route');
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

test('audit list separates all-time events from filtered matches and provides dataset-wide statistics', async (t) => {
  const originals = {
    findAndCountAll: AuditLog.findAndCountAll,
    count: AuditLog.count,
  };
  let listOptions;
  const countOptions = [];
  AuditLog.findAndCountAll = async (options) => {
    listOptions = options;
    return { count: 20, rows: [] };
  };
  AuditLog.count = async (options) => {
    if (options) countOptions.push(options);
    if (!options) return 617;
    if (options.distinct) return 2;
    return 12;
  };
  t.after(() => {
    AuditLog.findAndCountAll = originals.findAndCountAll;
    AuditLog.count = originals.count;
  });

  const response = makeResponse();
  await getAuditListHandler()({ query: { page: '1', limit: '15' } }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.totalEvents, 617);
  assert.equal(response.payload.stats.filtered, 20);
  assert.equal(response.payload.stats.uniqueUsers, 2);
  assert.equal(response.payload.pagination.total, 20);
  assert.equal(response.payload.pagination.pages, 2);
  assert.equal(listOptions.limit, 15);
  assert.equal(countOptions.length, 4);
  assert.ok(countOptions.every((options) => options.include?.length));
});

test('audit category and status filters are applied to the server-side filtered count', async (t) => {
  const originals = {
    findAndCountAll: AuditLog.findAndCountAll,
    count: AuditLog.count,
  };
  let listOptions;
  const countOptions = [];
  AuditLog.findAndCountAll = async (options) => {
    listOptions = options;
    return { count: 3, rows: [] };
  };
  AuditLog.count = async (options) => {
    if (options) countOptions.push(options);
    return options?.distinct ? 1 : 3;
  };
  t.after(() => {
    AuditLog.findAndCountAll = originals.findAndCountAll;
    AuditLog.count = originals.count;
  });

  const response = makeResponse();
  await getAuditListHandler()({
    query: { category: 'security', status: 'failed', search: 'denied' },
  }, response, (error) => { throw error; });

  const clauses = listOptions.where[Op.and];
  assert.ok(Array.isArray(clauses));
  assert.ok(clauses.some((clause) => clause?.[Op.or]?.some((part) => part.action || part.entity)));
  assert.ok(clauses.some((clause) => String(clause?.attribute?.val || '').includes('JSON_EXTRACT')));
  assert.ok(clauses.some((clause) => clause?.[Op.or]?.some((part) => part['$User.username$'])));
  assert.equal(response.payload.totalEvents, 3);
  assert.equal(response.payload.stats.filtered, 3);
  assert.ok(countOptions.every((options) => options.include?.length));
});

test('audit list rejects invalid date filters as JSON instead of querying the database', async (t) => {
  const originalFindAndCountAll = AuditLog.findAndCountAll;
  let queryCalled = false;
  AuditLog.findAndCountAll = async () => {
    queryCalled = true;
    return { count: 0, rows: [] };
  };
  t.after(() => { AuditLog.findAndCountAll = originalFindAndCountAll; });

  const response = makeResponse();
  await getAuditListHandler()({ query: { dateFrom: 'not-a-date' } }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.payload, {
    success: false,
    message: 'Audit date filters must be valid dates in YYYY-MM-DD format.',
  });
  assert.equal(queryCalled, false);
});
