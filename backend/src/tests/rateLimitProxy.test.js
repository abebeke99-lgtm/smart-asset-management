const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');
const rateLimitKeyGenerator = require('../utils/rateLimitKeyGenerator');

test('rate limiters ignore untrusted forwarded IP headers when proxy trust is disabled', async () => {
  const app = express();
  app.set('trust proxy', false);
  app.get('/', rateLimit({
    windowMs: 60_000,
    limit: 1,
    keyGenerator: rateLimitKeyGenerator,
    standardHeaders: false,
    legacyHeaders: false,
  }), (_req, res) => res.sendStatus(200));

  const firstResponse = await request(app).get('/').set('X-Forwarded-For', '203.0.113.10');
  const secondResponse = await request(app).get('/').set('X-Forwarded-For', '203.0.113.11');

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 429);
});
