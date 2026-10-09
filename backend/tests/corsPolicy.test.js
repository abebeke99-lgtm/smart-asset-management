const test = require('node:test');
const assert = require('node:assert/strict');

const ALLOWED_ORIGIN = 'https://smart-asset-management-six.vercel.app';
process.env.FRONTEND_URL = ALLOWED_ORIGIN;

const request = require('supertest');
const app = require('../src/app');

const preflight = (origin, method = 'POST') => request(app)
  .options('/api/auth/login')
  .set('Access-Control-Request-Method', method)
  .set('Origin', origin);

test('allowed production origin completes a credentialed CORS preflight with 204', async () => {
  const response = await preflight(ALLOWED_ORIGIN);

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
  assert.notEqual(response.headers['access-control-allow-origin'], '*');
});

test('disallowed origin preflight is rejected with 403 and a stable error contract', async () => {
  const response = await preflight('https://untrusted.invalid');

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    success: false,
    code: 'CORS_ORIGIN_NOT_ALLOWED',
    message: 'Origin is not allowed',
  });
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('disallowed origin on an actual request is rejected before reaching the route', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'https://untrusted.invalid')
    .send({ email: 'nobody@example.com', password: 'not-a-real-password' });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'CORS_ORIGIN_NOT_ALLOWED');
  assert.equal(response.body.message, 'Origin is not allowed');
});

test('CORS error responses never reflect the origin, stack traces, or secrets', async () => {
  const response = await preflight('https://untrusted.invalid');
  const raw = String(response.text);

  assert.doesNotMatch(raw, /untrusted\.invalid/);
  assert.doesNotMatch(raw, /\bat\s+\S+\s+\(.*:\d+:\d+\)/);
  assert.doesNotMatch(raw, /Error:|secret|password|process\.env|node_modules/i);
});

test('requests without an Origin header are not blocked by CORS', async () => {
  const response = await request(app).get('/api/this-route-does-not-exist');

  assert.equal(response.status, 404);
  assert.notEqual(response.status, 403);
});

test('request ID header is generated and echoed for API requests', async () => {
  const supplied = 'cors-policy.request-123';
  const echoed = await request(app)
    .get('/api/this-route-does-not-exist')
    .set('X-Request-ID', supplied);
  assert.equal(echoed.headers['x-request-id'], supplied);

  const generated = await request(app).get('/api/this-route-does-not-exist');
  assert.match(generated.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});

test('malformed request IDs are replaced before being echoed', async () => {
  const response = await request(app)
    .get('/api/this-route-does-not-exist')
    .set('X-Request-ID', 'invalid id with spaces');

  assert.match(response.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  assert.notEqual(response.headers['x-request-id'], 'invalid id with spaces');
});
