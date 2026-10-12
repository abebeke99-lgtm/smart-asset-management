const test = require('node:test');
const assert = require('node:assert/strict');

const nodemailer = require('nodemailer');
const { classifyEmailError, getMailerStatus, getTransporter, readMailerConfig, resetTransporter } = require('../src/utils/mailer');
const { logEmailDiagnostic, sendMail, validateEmailConfiguration } = require('../src/services/emailService');

const EMAIL_ENV_KEYS = [
  'NODE_ENV',
  'MAIL_DRIVER',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_SECURE',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'EMAIL_PASS',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_REQUIRE_TLS',
];

const withEnv = (overrides) => {
  const previous = Object.fromEntries(EMAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  EMAIL_ENV_KEYS.forEach((key) => { delete process.env[key]; });
  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== undefined) process.env[key] = String(value);
  });
  resetTransporter();
  return () => {
    EMAIL_ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
    resetTransporter();
  };
};

const GMAIL_CONFIG = {
  MAIL_DRIVER: 'smtp',
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: '587',
  EMAIL_SECURE: 'false',
  EMAIL_USER: 'abebebeke99@gmail.com',
  EMAIL_PASSWORD: 'abcdefghijklmnop',
  EMAIL_FROM: 'Asset Management <abebebeke99@gmail.com>',
};

test('a correct Gmail STARTTLS configuration builds a usable transporter', () => {
  const restore = withEnv(GMAIL_CONFIG);
  try {
    const config = readMailerConfig();
    assert.equal(config.host, 'smtp.gmail.com');
    assert.equal(config.port, 587);
    assert.equal(config.secure, false);
    assert.equal(config.requireTls, true, 'port 587 must require STARTTLS');
    assert.equal(config.password, 'abcdefghijklmnop');
    assert.equal(getMailerStatus().configured, true);
    assert.equal(validateEmailConfiguration().valid, true);

    const transporter = getTransporter();
    assert.equal(transporter.options.host, 'smtp.gmail.com');
    assert.equal(transporter.options.requireTLS, true);
  } finally {
    restore();
  }
});

test('conflicting EMAIL_* and SMTP_* values fail closed without exposing values', () => {
  const restore = withEnv({
    ...GMAIL_CONFIG,
    SMTP_HOST: 'smtp.sendgrid.net',
    SMTP_USER: 'someone-else@gmail.com',
    SMTP_PASSWORD: 'zzzzzzzzzzzzzzzz',
  });
  try {
    const status = getMailerStatus();
    assert.equal(status.configured, false);
    assert.equal(status.code, 'EMAIL_CONFIG_CONFLICT');
    assert.deepEqual(status.conflicts, ['EMAIL_HOST', 'SMTP_HOST', 'EMAIL_USER', 'SMTP_USER', 'EMAIL_PASSWORD', 'SMTP_PASSWORD']);
    assert.equal(getTransporter(), null, 'a conflicting configuration must not build a transporter');

    const validation = validateEmailConfiguration();
    assert.equal(validation.valid, false);
    assert.equal(validation.code, 'EMAIL_CONFIG_CONFLICT');
    assert.doesNotMatch(JSON.stringify(validation), /sendgrid|someone-else|zzzz/i, 'only variable names may be reported');
  } finally {
    restore();
  }
});

test('identical EMAIL_* and SMTP_* aliases are not reported as a conflict', () => {
  const restore = withEnv({
    ...GMAIL_CONFIG,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'abebebeke99@gmail.com',
    SMTP_PASS: 'abcd efgh ijkl mnop',
  });
  try {
    const status = getMailerStatus();
    assert.equal(status.code, null);
    assert.equal(status.configured, true);
    assert.deepEqual(status.conflicts, []);
    assert.ok(getTransporter(), 'equal aliases must not block delivery');
  } finally {
    restore();
  }
});

test('a development logging driver is rejected in production instead of silently disabling email', () => {
  const restore = withEnv({ NODE_ENV: 'production', MAIL_DRIVER: 'log', ...GMAIL_CONFIG, MAIL_DRIVER: 'log' });
  try {
    const config = readMailerConfig();
    assert.equal(config.driverInvalid, true);
    const status = getMailerStatus();
    assert.equal(status.configured, false);
    assert.equal(status.code, 'EMAIL_DRIVER_INVALID');
    assert.equal(getTransporter(), null);
  } finally {
    restore();
  }
});

test('the same logging driver remains usable outside production', () => {
  const restore = withEnv({ NODE_ENV: 'test', MAIL_DRIVER: 'log' });
  try {
    assert.equal(readMailerConfig().driverInvalid, false);
    assert.equal(getMailerStatus().configured, false);
    assert.ok(getTransporter(), 'a development stream transport is expected outside production');
  } finally {
    restore();
  }
});

test('implicit TLS on port 465 disables requireTLS and EMAIL_SECURE is honoured', () => {
  const restore = withEnv({ ...GMAIL_CONFIG, EMAIL_PORT: '465' });
  try {
    const config = readMailerConfig();
    assert.equal(config.secure, true);
    assert.equal(config.requireTls, false);
  } finally {
    restore();
  }
});

test('SMTP_REQUIRE_TLS can be turned off explicitly for a server without STARTTLS', () => {
  const restore = withEnv({ ...GMAIL_CONFIG, EMAIL_HOST: 'mail.example.edu', SMTP_REQUIRE_TLS: 'false' });
  try {
    assert.equal(readMailerConfig().requireTls, false);
  } finally {
    restore();
  }
});

test('authentication, TLS, timeout, connection and provider failures are classified separately', () => {
  const authError = Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 });
  assert.equal(classifyEmailError(authError), 'EMAIL_AUTH_FAILED');

  const tlsError = Object.assign(new Error('self signed certificate'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  assert.equal(classifyEmailError(tlsError), 'EMAIL_TLS_ERROR');
  assert.equal(classifyEmailError(Object.assign(new Error('wrong version number'), { code: 'ESOCKET' })), 'EMAIL_TLS_ERROR');
  assert.equal(classifyEmailError(Object.assign(new Error('connection failed'), { code: 'ETIMEDOUT' })), 'EMAIL_CONNECTION_TIMEOUT');
  assert.equal(classifyEmailError(Object.assign(new Error('connection failed'), { code: 'ECONNREFUSED' })), 'EMAIL_CONNECTION_FAILED');
  assert.equal(classifyEmailError(Object.assign(new Error('rejected'), { responseCode: 550, response: '550 5.1.1 mailbox unavailable' })), 'EMAIL_PROVIDER_REJECTED');
});

test('a failed SMTP delivery never reports success and never logs the credential', async () => {
  const restore = withEnv(GMAIL_CONFIG);
  const originalCreateTransport = nodemailer.createTransport;
  const originalConsoleError = console.error;
  let serverLog = '';
  console.error = (...args) => { serverLog += `${args.join(' ')}\n`; };
  nodemailer.createTransport = () => ({
    sendMail: async () => {
      const error = new Error(`535-5.7.8 username and password not accepted for ${process.env.EMAIL_PASSWORD}`);
      error.code = 'EAUTH';
      error.responseCode = 535;
      throw error;
    },
  });

  try {
    resetTransporter();
    const result = await sendMail({ to: 'student@university.edu', subject: 'Reset', text: 'body', html: '<p>body</p>' });
    assert.equal(result.status, 'failed');
    assert.equal(result.code, 'EAUTH');
    assert.doesNotMatch(serverLog, /abcdefghijklmnop/, 'the app password must never be logged');
    assert.match(serverLog, /EMAIL_AUTH_FAILED/);
    assert.match(serverLog, /EAUTH/);
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    console.error = originalConsoleError;
    restore();
  }
});

test('conflict diagnostics list only variable names, never values', () => {
  const originalConsoleError = console.error;
  let logged = '';
  console.error = (message) => { logged = message; };
  try {
    logEmailDiagnostic('password_reset_otp', {
      code: 'EMAIL_CONFIG_CONFLICT',
      conflicts: ['EMAIL_HOST', 'SMTP_HOST', 'EMAIL_PASSWORD', 'not-a-variable', 'secret-value'],
    }, 'req-conflict-1');
  } finally {
    console.error = originalConsoleError;
  }
  const diagnostic = JSON.parse(logged);
  assert.deepEqual(diagnostic.conflicts, ['EMAIL_HOST', 'SMTP_HOST', 'EMAIL_PASSWORD']);
  assert.doesNotMatch(logged, /secret-value|not-a-variable/);
});
