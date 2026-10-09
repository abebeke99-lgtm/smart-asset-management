const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/enamRoutes');
const { Config, AuditLog } = require('../src/models');

const handlerFor = (method, path) => {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `expected ${method.toUpperCase()} ${path} route`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

const makeRes = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const settingsValue = {
  enabled: true,
  baseUrl: 'https://enam.example.gov.et',
  organizationCode: 'ORG-1',
  apiKeyHash: 'super-secret-hash',
  apiKeyMasked: '••••1234',
  syncAssets: true,
};

test('ENAM settings response never exposes the api key hash', async (t) => {
  const originalFindByPk = Config.findByPk;
  Config.findByPk = async (key) => (key === 'enam.settings' ? { value: JSON.stringify(settingsValue) } : null);
  t.after(() => { Config.findByPk = originalFindByPk; });

  const req = { user: { id: 1, role: 'admin' } };
  const res = makeRes();
  await handlerFor('get', '/')(req, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  const returned = res.body.data.settings;
  assert.equal('apiKeyHash' in returned, false);
  assert.equal('clientSecretHash' in returned, false);
  assert.notEqual(returned.apiKey, 'super-secret-hash');
  assert.equal(returned.apiKeyMasked, '••••1234');
});

test('ENAM connection test rejects private, loopback, and metadata targets before fetching', async (t) => {
  const originalFindByPk = Config.findByPk;
  const originalUpsert = Config.upsert;
  const originalAudit = AuditLog.create;
  const originalFetch = global.fetch;
  const fetched = [];
  Config.findByPk = async () => null;
  Config.upsert = async () => ({});
  AuditLog.create = async () => ({});
  global.fetch = async (url) => { fetched.push(url); return { ok: true, status: 200 }; };
  t.after(() => {
    Config.findByPk = originalFindByPk;
    Config.upsert = originalUpsert;
    AuditLog.create = originalAudit;
    global.fetch = originalFetch;
  });

  const handler = handlerFor('post', '/test');
  for (const baseUrl of [
    'http://127.0.0.1:8080',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5',
    'http://192.168.1.10',
    'http://172.16.5.5',
    'http://localhost:3000',
    'file:///etc/passwd',
    'http://user:pass@enam.example.gov.et',
  ]) {
    const res = makeRes();
    await handler({ user: { id: 1, role: 'admin' }, body: { baseUrl, organizationCode: 'ORG-1' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400, `expected rejection for ${baseUrl}`);
  }
  assert.deepEqual(fetched, []);
});

test('ENAM connection test allows a public http(s) target', async (t) => {
  const originalFindByPk = Config.findByPk;
  const originalUpsert = Config.upsert;
  const originalAudit = AuditLog.create;
  const originalFetch = global.fetch;
  const fetched = [];
  Config.findByPk = async () => null;
  Config.upsert = async () => ({});
  AuditLog.create = async () => ({});
  global.fetch = async (url) => { fetched.push(url); return { ok: true, status: 200 }; };
  t.after(() => {
    Config.findByPk = originalFindByPk;
    Config.upsert = originalUpsert;
    AuditLog.create = originalAudit;
    global.fetch = originalFetch;
  });

  const res = makeRes();
  await handlerFor('post', '/test')(
    { user: { id: 1, role: 'admin' }, body: { baseUrl: 'https://enam.example.gov.et', organizationCode: 'ORG-1' } },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(fetched.length, 1);
  assert.match(fetched[0], /^https:\/\/enam\.example\.gov\.et\/health$/);
});

test('ENAM settings save rejects unsafe base URLs', async (t) => {
  const originalFindByPk = Config.findByPk;
  const originalUpsert = Config.upsert;
  Config.findByPk = async () => null;
  Config.upsert = async () => ({});
  t.after(() => { Config.findByPk = originalFindByPk; Config.upsert = originalUpsert; });

  const res = makeRes();
  await handlerFor('put', '/')(
    { user: { id: 1, role: 'admin' }, body: { baseUrl: 'http://169.254.169.254/', enabled: true } },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.statusCode, 400);
});
