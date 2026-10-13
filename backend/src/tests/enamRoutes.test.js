const test = require('node:test');
const assert = require('node:assert/strict');
const enamRoutes = require('../routes/enamRoutes');
const { Config } = require('../models');

const rootGetRoute = enamRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get);

test('ENAM API exposes its page, settings, mappings, status and synchronization endpoints', () => {
  const routes = enamRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

  for (const route of [
    'GET /',
    'GET /status',
    'GET /mappings',
    'GET /logs',
    'GET /syncs',
    'PUT /',
    'POST /sync',
    'POST /test',
  ]) {
    assert.ok(routes.includes(route), `Missing ENAM endpoint ${route}`);
  }
});

test('an unconfigured ENAM integration returns a JSON default with empty sync history', async (t) => {
  const originalFindByPk = Config.findByPk;
  Config.findByPk = async () => null;
  t.after(() => { Config.findByPk = originalFindByPk; });

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await rootGetRoute.route.stack.at(-1).handle({ user: { id: 1 } }, response, (error) => {
    if (error) throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);
  assert.equal(response.payload.data.enabled, false);
  assert.equal(response.payload.data.settings.baseUrl, '');
  assert.equal(response.payload.data.statistics.totalSynced, 0);
  assert.equal(response.payload.data.statistics.successfulSyncs, 0);
  assert.equal(response.payload.data.statistics.failedSyncs, 0);
  assert.equal(response.payload.data.statistics.mappings, 0);
  assert.deepEqual(response.payload.data.stats, response.payload.data.statistics);
  assert.deepEqual(response.payload.data.logs, []);
  assert.deepEqual(response.payload.data.mappings, []);
  assert.equal(response.payload.data.lastSync, null);
});

test('ENAM storage/database failures are forwarded instead of masquerading as an unconfigured integration', async (t) => {
  const originalFindByPk = Config.findByPk;
  const databaseError = new Error('database unavailable');
  Config.findByPk = async () => { throw databaseError; };
  t.after(() => { Config.findByPk = originalFindByPk; });

  let forwardedError;
  await rootGetRoute.route.stack.at(-1).handle({ user: { id: 1 } }, {}, (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError, databaseError);
});
