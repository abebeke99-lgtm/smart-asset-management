const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const noStore = require('../middlewares/noStore');

test('noStore prevents conditional API requests from returning bodyless 304 responses', async () => {
  const app = express();
  app.set('etag', false);
  app.use('/api', noStore);
  app.get('/api/dynamic', (_req, res) => {
    res.set('Last-Modified', 'Wed, 21 Oct 2015 07:28:00 GMT');
    return res.json({ success: true, data: { value: 7 } });
  });
  const firstResponse = await request(app).get('/api/dynamic');
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.headers.etag, undefined);

  const response = await request(app)
    .get('/api/dynamic')
    .set('If-None-Match', '"stale-validator"')
    .set('If-Modified-Since', 'Wed, 21 Oct 2015 07:28:00 GMT');

  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, { success: true, data: { value: 7 } });
});

test('the configured API app disables ETags and applies no-store to all API responses', async () => {
  const app = require('../app');
  assert.equal(app.get('etag'), false);

  const response = await request(app)
    .get('/api/__smoke_unmatched_route')
    .set('If-None-Match', '"stale-validator"');

  assert.equal(response.status, 404);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers.etag, undefined);
  assert.equal(response.body.message, 'API endpoint not found');
});
