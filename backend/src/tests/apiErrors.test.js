const express = require('express');
const request = require('supertest');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { apiErrorHandler, apiNotFoundHandler } = require('../middlewares/apiErrors');

const createApp = () => {
  const app = express();
  app.get('/api/failure', (_req, _res, next) => next(new Error('database detail')));
  app.use('/api', apiNotFoundHandler);
  app.use(apiErrorHandler);
  return app;
};

test('API not-found responses are JSON and do not fall through to HTML', async () => {
  const response = await request(createApp()).get('/api/unknown');

  assert.equal(response.status, 404);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(response.body, { success: false, message: 'API endpoint not found' });
});

test('API errors return safe JSON and log the original error stack', async (t) => {
  const originalError = console.error;
  let loggedError;
  console.error = (...args) => { loggedError = args; };
  t.after(() => { console.error = originalError; });

  const response = await request(createApp()).get('/api/failure');

  assert.equal(response.status, 500);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(response.body, { success: false, message: 'Internal server error' });
  assert.equal(loggedError[0], 'Server Error:');
  assert.match(loggedError[1].stack, /database detail/);
  assert.doesNotMatch(JSON.stringify(response.body), /database detail/);
});
