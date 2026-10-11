const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const noStore = require('../middlewares/noStore');

test('noStore prevents conditional API requests from returning bodyless 304 responses', async () => {
  const app = express();
  app.get('/dynamic', noStore, (_req, res) => {
    res.set('Last-Modified', 'Wed, 21 Oct 2015 07:28:00 GMT');
    return res.json({ success: true, data: { value: 7 } });
  });
  const firstResponse = await request(app).get('/dynamic');
  assert.equal(firstResponse.status, 200);

  const response = await request(app)
    .get('/dynamic')
    .set('If-None-Match', firstResponse.headers.etag)
    .set('If-Modified-Since', 'Wed, 21 Oct 2015 07:28:00 GMT');

  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, { success: true, data: { value: 7 } });
});
