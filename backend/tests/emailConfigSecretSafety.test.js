const test = require('node:test');
const assert = require('node:assert/strict');
const emailService = require('../src/services/emailService');

const ENV_KEYS = [
  'MAIL_DRIVER', 'EMAIL_DRIVER', 'SMTP_DRIVER',
  'EMAIL_HOST', 'SMTP_HOST', 'EMAIL_PORT', 'SMTP_PORT',
  'EMAIL_USER', 'SMTP_USER', 'EMAIL_PASSWORD', 'SMTP_PASSWORD', 'SMTP_PASS', 'EMAIL_PASS',
  'EMAIL_SECURE', 'EMAIL_FROM', 'SMTP_FROM', 'MAIL_FROM',
];

test('email configuration diagnostics never expose the SMTP password', (t) => {
  const original = {};
  for (const key of ENV_KEYS) original[key] = process.env[key];
  t.after(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  process.env.MAIL_DRIVER = 'smtp';
  process.env.EMAIL_HOST = 'smtp.example.com';
  process.env.EMAIL_PORT = '587';
  process.env.EMAIL_USER = 'mailer@example.com';
  process.env.EMAIL_PASSWORD = 'top-secret-password';
  process.env.EMAIL_FROM = 'no-reply@example.com';

  const result = emailService.validateEmailConfiguration();
  assert.equal(result.valid, true);
  assert.equal('password' in result.config, false);
  assert.equal(result.config.password, undefined);
  assert.equal(result.config.host, 'smtp.example.com');
  assert.equal(result.config.user, 'mailer@example.com');
  assert.equal(result.config.from, 'no-reply@example.com');
  assert.doesNotMatch(JSON.stringify(result), /top-secret-password/);
});
