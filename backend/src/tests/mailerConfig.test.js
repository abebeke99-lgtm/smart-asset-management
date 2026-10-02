const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const keys = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
const savedEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const { getMailerStatus, getTransporter, readMailerConfig } = require('../utils/mailer');

before(() => {
  keys.forEach((key) => { delete process.env[key]; });
});

after(() => {
  keys.forEach((key) => {
    if (savedEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnvironment[key];
  });
});

test('mailer reports missing email credentials without exposing values', () => {
  const status = getMailerStatus();
  assert.equal(status.configured, false);
  assert.deepEqual(status.missingVariables, ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD']);
});

test('mailer strips app-password whitespace and enables implicit TLS on port 465', () => {
  Object.assign(process.env, {
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: '465',
    EMAIL_SECURE: 'false',
    EMAIL_USER: 'unit-test@example.invalid',
    EMAIL_PASSWORD: 'abcd efgh ijkl mnop',
  });

  const config = readMailerConfig();
  assert.equal(config.password, 'abcdefghijklmnop');
  assert.equal(config.secure, true);
  assert.equal(config.from, 'unit-test@example.invalid');

  const firstTransporter = getTransporter();
  assert.equal(firstTransporter.options.secure, true);
  assert.equal(firstTransporter.options.auth.pass, 'abcdefghijklmnop');
  assert.strictEqual(getTransporter(), firstTransporter);
});

test('mailer disables implicit TLS on port 587 even if EMAIL_SECURE is true', () => {
  process.env.EMAIL_PORT = '587';
  process.env.EMAIL_SECURE = 'true';

  assert.equal(readMailerConfig().secure, false);
  assert.equal(getTransporter().options.secure, false);
});
