const test = require('node:test');
const assert = require('node:assert/strict');
const { getMailerStatus, readMailerConfig, resetTransporter } = require('../src/utils/mailer');

const MAIL_ENV_KEYS = [
  'MAIL_DRIVER',
  'EMAIL_DRIVER',
  'SMTP_DRIVER',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_SECURE',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

test('an explicit development mail driver is not overridden by SMTP-looking placeholders', () => {
  const previous = Object.fromEntries(MAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    MAIL_DRIVER: 'log',
    EMAIL_HOST: 'localhost',
    EMAIL_PORT: '1025',
    EMAIL_USER: 'dev@example.com',
    EMAIL_PASSWORD: 'placeholder-password',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_USER: 'dev@example.com',
    SMTP_PASS: 'placeholder-password',
  });

  try {
    assert.equal(readMailerConfig().driver, 'log');
    assert.equal(getMailerStatus().configured, false);
    assert.equal(getMailerStatus().driver, 'log');
  } finally {
    MAIL_ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
    resetTransporter();
  }
});

test('SMTP port 465 selects implicit TLS and port 587 selects STARTTLS', () => {
  const previous = Object.fromEntries(MAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    MAIL_DRIVER: 'smtp',
    EMAIL_HOST: 'smtp.example.edu',
    EMAIL_USER: 'mailer@example.edu',
    EMAIL_PASSWORD: 'placeholder-password',
    EMAIL_PORT: '465',
    EMAIL_SECURE: 'false',
  });

  try {
    assert.equal(readMailerConfig().secure, true);
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_SECURE = 'true';
    assert.equal(readMailerConfig().secure, false);
  } finally {
    MAIL_ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
    resetTransporter();
  }
});
