const test = require('node:test');
const assert = require('node:assert/strict');
const { getMailerStatus, getTransporter, readMailerConfig, resetTransporter } = require('../src/utils/mailer');

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

test('a provider mailbox used as EMAIL_HOST is resolved to the real SMTP host', () => {
  const previous = Object.fromEntries(MAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  Object.assign(process.env, {
    MAIL_DRIVER: 'smtp',
    EMAIL_HOST: 'abebebeke99@gmail.com',
    EMAIL_PORT: '587',
    EMAIL_SECURE: 'false',
    EMAIL_USER: 'abebebeke99@gmail.com',
    EMAIL_PASSWORD: 'abcd efgh ijkl mnop',
  });

  try {
    const config = readMailerConfig();
    assert.equal(config.host, 'smtp.gmail.com');
    assert.equal(config.hostNormalized, true);
    assert.equal(config.hostInvalid, false);
    assert.equal(config.secure, false);
    assert.equal(config.password, 'abcdefghijklmnop');
    assert.equal(getMailerStatus().configured, true);

    const transporter = getTransporter();
    assert.equal(transporter.options.host, 'smtp.gmail.com');
    assert.equal(transporter.options.port, 587);
    assert.equal(transporter.options.secure, false);
  } finally {
    MAIL_ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
    resetTransporter();
  }
});

test('a bare provider domain is normalized and an unknown mailbox host is rejected as configuration', () => {
  const previous = Object.fromEntries(MAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.MAIL_DRIVER = 'smtp';
  process.env.EMAIL_PORT = '587';
  process.env.EMAIL_USER = 'mailer@example.edu';
  process.env.EMAIL_PASSWORD = 'placeholder-password';

  try {
    process.env.EMAIL_HOST = 'gmail.com';
    assert.equal(readMailerConfig().host, 'smtp.gmail.com');
    assert.equal(readMailerConfig().hostNormalized, true);

    process.env.EMAIL_HOST = 'someone@myuniversity.edu';
    const invalidConfig = readMailerConfig();
    assert.equal(invalidConfig.host, '');
    assert.equal(invalidConfig.hostInvalid, true);
    assert.equal(getMailerStatus().configured, false);
    assert.ok(getMailerStatus().missingVariables.includes('EMAIL_HOST'));
    assert.equal(getTransporter(), null);
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
