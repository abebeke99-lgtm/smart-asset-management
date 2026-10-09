const test = require('node:test');
const assert = require('node:assert/strict');
const { logEmailDiagnostic } = require('../src/services/emailService');
const { withRequestContext } = require('../src/middlewares/requestContext');

test('email diagnostics correlate failures without logging SMTP error details', async () => {
  const originalConsoleError = console.error;
  let logged = '';
  console.error = (message) => { logged = message; };

  try {
    await withRequestContext({ requestId: 'req-email-test-123' }, async () => {
      logEmailDiagnostic('password_reset_otp', {
        code: 'EMAIL_AUTH_FAILED',
        error: Object.assign(new Error('private provider response'), {
          code: 'EAUTH',
          responseCode: 535,
          host: 'smtp.private.example',
          password: 'private-password',
        }),
      });
    });
  } finally {
    console.error = originalConsoleError;
  }

  const diagnostic = JSON.parse(logged);
  assert.equal(diagnostic.event, 'email_delivery_failed');
  assert.equal(diagnostic.operation, 'password_reset_otp');
  assert.equal(diagnostic.requestId, 'req-email-test-123');
  assert.equal(diagnostic.code, 'EMAIL_AUTH_FAILED');
  assert.equal(diagnostic.providerCode, 'EAUTH');
  assert.equal(diagnostic.responseCode, 535);
  assert.doesNotMatch(logged, /private provider response|smtp\.private\.example|private-password/);
});

test('email configuration diagnostics list missing variable names, never values', () => {
  const originalConsoleError = console.error;
  let logged = '';
  console.error = (message) => { logged = message; };

  try {
    logEmailDiagnostic('password_reset_otp', {
      code: 'EMAIL_NOT_CONFIGURED',
      missingVariables: ['EMAIL_HOST', 'EMAIL_PASSWORD', 'DATABASE_URL', 'secret-value'],
    }, 'req-config-test');
  } finally {
    console.error = originalConsoleError;
  }

  const diagnostic = JSON.parse(logged);
  assert.equal(diagnostic.requestId, 'req-config-test');
  assert.deepEqual(diagnostic.missingVariables, ['EMAIL_HOST', 'EMAIL_PASSWORD']);
  assert.doesNotMatch(logged, /DATABASE_URL|secret-value/);
});
