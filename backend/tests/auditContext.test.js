const test = require('node:test');
const assert = require('node:assert/strict');
const { withRequestContext, getRequestContext } = require('../src/middlewares/requestContext');
const AuditLog = require('../src/models/AuditLog');

test('audit request context adds request metadata during validation', async () => {
  const requestId = 'req_test_123';
  const ip = '203.0.113.44';
  const userAgent = 'Mozilla/5.0 test';

  await withRequestContext({ requestId, ip, userAgent }, async () => {
    const log = AuditLog.build({
      userId: 1,
      action: 'LOGIN_SUCCESS',
      entity: 'user:1',
      details: JSON.stringify({ result: 'success' }),
    });
    await log.validate();

    const details = JSON.parse(log.details);
    assert.equal(details.requestId, requestId);
    assert.equal(details.ipAddress, ip);
    assert.equal(details.userAgent, userAgent);
  });

  const active = getRequestContext();
  assert.equal(active, null);
});
