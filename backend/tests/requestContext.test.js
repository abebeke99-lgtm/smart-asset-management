const test = require('node:test');
const assert = require('node:assert/strict');
const { getRequestContext, requestContextMiddleware } = require('../src/middlewares/requestContext');

const runMiddleware = (requestId) => {
  const request = {
    headers: requestId === undefined ? {} : { 'x-request-id': requestId },
    method: 'GET',
    originalUrl: '/health',
    socket: { remoteAddress: '127.0.0.1' },
  };
  const responseHeaders = {};
  const response = { setHeader: (name, value) => { responseHeaders[name] = value; } };
  let context;

  requestContextMiddleware(request, response, () => {
    context = getRequestContext();
  });

  return { request, responseHeaders, context };
};

test('request context echoes a valid request ID in the response header', () => {
  const { request, responseHeaders, context } = runMiddleware('request-123.ab');

  assert.equal(request.requestId, 'request-123.ab');
  assert.equal(responseHeaders['X-Request-ID'], 'request-123.ab');
  assert.equal(context.requestId, 'request-123.ab');
});

test('request context replaces malformed request IDs before logging or returning them', () => {
  const { request, responseHeaders, context } = runMiddleware('bad\r\nx-secret:private');

  assert.match(request.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(responseHeaders['X-Request-ID'], request.requestId);
  assert.equal(context.requestId, request.requestId);
  assert.doesNotMatch(request.requestId, /private|secret/);
});
