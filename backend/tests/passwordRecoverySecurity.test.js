const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// The controller reads these once at module load, so they must be set before it is required.
process.env.PASSWORD_RESET_OTP_TTL_MINUTES = '8';
process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS = '3';

const nodemailer = require('nodemailer');
const { resetTransporter } = require('../src/utils/mailer');
const { normalizePhoneNumber, sendSMS } = require('../src/services/smsService');
const { User, PasswordRecovery, Config, AuditLog } = require('../src/models');
const authController = require('../src/controllers/authController');

const EXPECTED_OTP_TTL_MINUTES = 8;
const EXPECTED_OTP_MAX_ATTEMPTS = 3;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
let testUserSequence = 0;

const SMS_ENV_KEYS = ['SMS_PROVIDER', 'SMS_API_KEY', 'SMS_API_SECRET', 'SMS_SENDER_ID', 'SMS_SENDER'];

const withEnvironment = (overrides) => {
  const previous = Object.fromEntries(SMS_ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  });
  return () => {
    SMS_ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  };
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const createUser = (overrides = {}) => ({
  id: 7,
  active: true,
  email: `student-${++testUserSequence}@university.edu`,
  username: 'student',
  fullName: 'Test Student',
  phone: '+251911000001',
  lockoutUntil: null,
  resetTokenHash: null,
  resetTokenExpiresAt: null,
  resetTokenUsedAt: null,
  resetOtpHash: null,
  resetOtpExpiresAt: null,
  resetOtpUsedAt: null,
  resetOtpAttempts: 0,
  password: 'stored-hash-placeholder',
  updatedAt: new Date(0),
  async update(changes) {
    Object.assign(this, changes);
    return this;
  },
  ...overrides,
});

const matchesCondition = (actual, condition) => {
  if (condition === null) return actual === null || actual === undefined;
  if (condition && typeof condition === 'object' && condition[Op.gt] !== undefined) {
    if (!actual) return false;
    return new Date(actual) > new Date(condition[Op.gt]);
  }
  if (condition && typeof condition === 'object' && condition[Op.ne] !== undefined) return actual !== condition[Op.ne];
  return actual === condition;
};

const matchesWhere = (user, where = {}) => Object.entries(where).every(([key, condition]) => matchesCondition(user[key], condition));

// An in-memory stand-in for the users table so single-use token semantics are exercised for real.
const createUserStore = (user) => ({
  findOne: async ({ where } = {}) => (user && matchesWhere(user, where) ? user : null),
  update: async (values, options = {}) => {
    if (options.where && !matchesWhere(user, options.where)) return [0];
    Object.assign(user, values);
    return [1];
  },
});

const createRecoveryStore = (user) => {
  const method = user?.recoveryMethod || 'phone';
  const destination = method === 'email' ? user?.email : user?.phone;
  const records = user && (user.resetOtpHash || user.resetTokenHash) ? [{
    id: 1,
    userId: user.id,
    method,
    destination,
    otpHash: user.resetOtpHash,
    expiresAt: user.resetOtpExpiresAt || new Date(0),
    attempts: user.resetOtpAttempts || 0,
    verifiedAt: user.resetOtpUsedAt,
    usedAt: user.resetTokenUsedAt,
    resetTokenHash: user.resetTokenHash,
    resetTokenExpiresAt: user.resetTokenExpiresAt,
    createdAt: user.updatedAt || new Date(0),
  }] : [];

  const syncLegacyTestFields = (record) => {
    if (!user || record?.userId !== user.id) return;
    user.resetOtpHash = record.otpHash;
    user.resetOtpExpiresAt = record.otpHash ? record.expiresAt : null;
    user.resetOtpAttempts = record.attempts;
    user.resetOtpUsedAt = record.verifiedAt;
    user.resetTokenHash = record.resetTokenHash;
    user.resetTokenExpiresAt = record.resetTokenExpiresAt;
    user.resetTokenUsedAt = record.usedAt;
  };

  records.forEach((record) => {
    record.update = async (changes) => {
      Object.assign(record, changes, { updatedAt: new Date() });
      syncLegacyTestFields(record);
      return record;
    };
  });

  return {
    findOne: async ({ where = {}, order = [] } = {}) => {
      const matches = records.filter((record) => matchesWhere(record, where));
      if (order.length) matches.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      return matches[0] || null;
    },
    create: async (values) => {
      const record = {
        id: records.length + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...values,
        async update(changes) {
          Object.assign(this, changes, { updatedAt: new Date() });
          syncLegacyTestFields(this);
          return this;
        },
      };
      records.push(record);
      syncLegacyTestFields(record);
      return record;
    },
    update: async (values, options = {}) => {
      const matches = records.filter((record) => matchesWhere(record, options.where));
      matches.forEach((record) => {
        Object.assign(record, values, { updatedAt: new Date() });
        syncLegacyTestFields(record);
      });
      return [matches.length];
    },
  };
};

const withStubs = async ({ user, onFetch, onSendMail, onCreateTransport }, run) => {
  resetTransporter();
  const originalFindOne = User.findOne;
  const originalUpdate = User.update;
  const originalRecoveryFindOne = PasswordRecovery.findOne;
  const originalRecoveryCreate = PasswordRecovery.create;
  const originalRecoveryUpdate = PasswordRecovery.update;
  const originalConfigFindByPk = Config.findByPk;
  const originalAuditCreate = AuditLog.create;
  const originalFetch = global.fetch;
  const originalCreateTransport = nodemailer.createTransport;
  const emailEnvironment = {
    EMAIL_HOST: 'smtp.example.edu',
    EMAIL_PORT: '587',
    EMAIL_USER: 'test@example.edu',
    EMAIL_PASSWORD: 'test-password',
    EMAIL_FROM: 'no-reply@example.edu',
  };
  const previousEmailEnvironment = Object.fromEntries(Object.keys(emailEnvironment).map((key) => [key, process.env[key]]));
  Object.assign(process.env, emailEnvironment);

  const store = createUserStore(user);
  const recoveryStore = createRecoveryStore(user);
  User.findOne = store.findOne;
  User.update = store.update;
  PasswordRecovery.findOne = recoveryStore.findOne;
  PasswordRecovery.create = recoveryStore.create;
  PasswordRecovery.update = recoveryStore.update;
  Config.findByPk = async () => null;
  AuditLog.create = async () => ({});
  global.fetch = onFetch || (async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ SMSMessageData: { Recipients: [{ status: 'Success', messageId: 'smoke-1' }] } }),
  }));
  nodemailer.createTransport = (options) => {
    if (onCreateTransport) onCreateTransport(options);
    return {
      sendMail: onSendMail || (async () => ({ messageId: 'mail-1' })),
    };
  };

  try {
    return await run();
  } finally {
    User.findOne = originalFindOne;
    User.update = originalUpdate;
    PasswordRecovery.findOne = originalRecoveryFindOne;
    PasswordRecovery.create = originalRecoveryCreate;
    PasswordRecovery.update = originalRecoveryUpdate;
    Config.findByPk = originalConfigFindByPk;
    AuditLog.create = originalAuditCreate;
    global.fetch = originalFetch;
    nodemailer.createTransport = originalCreateTransport;
    Object.entries(previousEmailEnvironment).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    resetTransporter();
  }
};

const configureSmsProvider = () => withEnvironment({
  SMS_PROVIDER: 'africastalking',
  SMS_API_KEY: 'unit-test-username',
  SMS_API_SECRET: 'unit-test-api-key',
  SMS_SENDER: 'SMARTASSET',
});

test('normalizes Ethiopian 09 and 07 mobile formats to international form', () => {
  assert.equal(normalizePhoneNumber('0912345678'), '+251912345678');
  assert.equal(normalizePhoneNumber('0712345678'), '+251712345678');
  assert.equal(normalizePhoneNumber('+251912345678'), '+251912345678');
  assert.equal(normalizePhoneNumber('+251712345678'), '+251712345678');
});

test('does not report SMS success unless the provider confirms acceptance', async () => {
  const restoreEnvironment = configureSmsProvider();
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ SMSMessageData: { Recipients: [{ status: 'Failed' }] } }),
  });

  try {
    const result = await sendSMS('0911000001', 'test message');
    assert.equal(result.status, 'failed');
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment();
  }
});

const requestOtp = (response, phoneNumber = '0911000001') => authController.requestForgotPasswordOtp(
  { body: { phoneNumber }, headers: {}, ip: '127.0.0.1' },
  response,
);

const requestEmailOtp = (response, email) => {
  const sequence = Number(String(email).match(/(\d+)@university\.edu$/)?.[1] || 0);
  const ip = `192.0.2.${(sequence % 253) + 1}`;
  return authController.requestForgotPasswordOtp(
    { body: { method: 'email', email }, headers: {}, ip },
    response,
  );
};

const verifyOtp = (response, otp, phoneNumber = '+251911000001') => authController.verifyForgotPasswordOtp(
  { body: { phoneNumber, otp }, headers: {}, ip: '127.0.0.1' },
  response,
);

test('email recovery uses the OTP flow and delivers the code through SMTP', async () => {
  const user = createUser();
  let delivered = null;

  await withStubs({
    user,
    onSendMail: async (options) => {
      delivered = options;
      return { messageId: 'mail-otp-1' };
    },
  }, async () => {
    const response = createResponse();
    await requestEmailOtp(response, user.email);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
  });

  assert.ok(delivered, 'the email OTP must be delivered');
  assert.equal(delivered.to, user.email);
  const deliveredCode = delivered.text.match(/(\d{6})/)[1];
  assert.equal(user.resetOtpHash, sha256(deliveredCode), 'the persisted value must be the SHA-256 hash of the email code');
  assert.ok(delivered.text.includes(`${EXPECTED_OTP_TTL_MINUTES} minutes`), 'the email must include the configured OTP lifetime');
  assert.ok(new Date(user.resetOtpExpiresAt) > new Date(), 'an expiry must be stored for the email code');
});

test('OTP request delivers a real SMS and stores only a hash of the code', async () => {
  const restoreEnvironment = configureSmsProvider();
  const user = createUser();
  let providerRequest = null;

  try {
    await withStubs({
      user,
      onFetch: async (url, options) => {
        providerRequest = { url, body: options.body };
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ SMSMessageData: { Recipients: [{ status: 'Success', messageId: 'smoke-1' }] } }),
        };
      },
    }, async () => {
      const response = createResponse();
      await requestOtp(response);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
    });
  } finally {
    restoreEnvironment();
  }

  assert.ok(providerRequest, 'the configured SMS provider must be contacted');
  assert.ok(providerRequest.url.includes('africastalking.com'), 'the configured provider endpoint must be used');

  const sentMessage = JSON.parse(providerRequest.body).message;
  const deliveredCode = sentMessage.match(/(\d{6})/)[1];

  assert.equal(user.resetOtpHash, sha256(deliveredCode), 'the persisted value must be the SHA-256 hash of the delivered code');
  assert.notEqual(user.resetOtpHash, deliveredCode, 'the plaintext code must never be persisted');
  assert.ok(!sentMessage.includes(user.resetOtpHash), 'the stored hash must not be exposed in the SMS body');
  assert.ok(
    sentMessage.includes(`${EXPECTED_OTP_TTL_MINUTES} minutes`),
    `the SMS must state the configured ${EXPECTED_OTP_TTL_MINUTES} minute OTP lifetime`,
  );
  assert.ok(new Date(user.resetOtpExpiresAt) > new Date(), 'an expiry must be stored');
});

test('email OTP requests use the same generic response for registered and unregistered addresses', async () => {
  const user = createUser();

  await withStubs({ user }, async () => {
    const registered = createResponse();
    const unregistered = createResponse();
    await requestEmailOtp(registered, user.email);
    await requestEmailOtp(unregistered, `unknown-${testUserSequence}@university.edu`);

    assert.equal(registered.statusCode, 200);
    assert.equal(unregistered.statusCode, 200);
    assert.equal(registered.body.message, unregistered.body.message);
    assert.equal(registered.body.message, 'If this email address is registered, a verification code has been sent.');
  });
});

test('the sixth email OTP request in fifteen minutes is rate limited', async () => {
  const user = createUser();

  await withStubs({ user }, async () => {
    const responses = [];
    for (let requestNumber = 0; requestNumber < 6; requestNumber += 1) {
      const response = createResponse();
      await requestEmailOtp(response, user.email);
      responses.push(response);
    }

    assert.ok(responses.slice(0, 5).every((response) => response.statusCode === 200));
    assert.equal(responses[5].statusCode, 429);
    assert.equal(responses[5].body.message, 'Too many OTP requests. Please try again later.');
  });
});

test('development mode prints an OTP with a DEV ONLY label when SMTP is not configured', async () => {
  const user = createUser();
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWarn = console.warn;
  const emailKeys = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  let warning = '';
  process.env.NODE_ENV = 'development';
  console.warn = (...args) => { warning += `${args.join(' ')}\n`; };

  try {
    await withStubs({ user }, async () => {
      emailKeys.forEach((key) => delete process.env[key]);
      const response = createResponse();
      await requestEmailOtp(response, user.email);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.message, 'If this email address is registered, a verification code has been sent.');
    });
  } finally {
    console.warn = originalWarn;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }

  const printedOtp = warning.match(new RegExp(`DEV ONLY: password reset OTP for ${user.email}: (\\d{6})`));
  assert.ok(printedOtp, 'the console warning must contain the OTP and DEV ONLY label');
  assert.equal(user.resetOtpHash, sha256(printedOtp[1]), 'only the hash is stored');
});

test('SMTP failure details stay in server logs and the client receives only a safe response', async () => {
  const user = createUser();
  const originalConsoleError = console.error;
  let serverLog = '';
  let response;
  console.error = (...args) => { serverLog += `${args.join(' ')}\n`; };

  try {
    await withStubs({
      user,
      onSendMail: async () => {
        const error = new Error('server-only diagnostic secret-value');
        error.code = 'EAUTH';
        throw error;
      },
    }, async () => {
      response = createResponse();
      await requestEmailOtp(response, user.email);
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'EMAIL_AUTH_FAILED');
  assert.doesNotMatch(JSON.stringify(response.body), /secret-value|diagnostic|stack|password/i);
  assert.match(serverLog, /server-only diagnostic secret-value/);
  assert.match(serverLog, /EAUTH/);
});

test('a failed provider delivery leaves no usable code behind', async () => {
  const restoreEnvironment = configureSmsProvider();
  const user = createUser();

  try {
    await withStubs({
      user,
      onFetch: async () => ({ ok: false, status: 500, text: async () => 'provider error' }),
    }, async () => {
      const response = createResponse();
      await requestOtp(response);

      assert.equal(response.statusCode, 503);
      assert.equal(response.body.success, false);
    });
  } finally {
    restoreEnvironment();
  }

  assert.equal(user.resetOtpHash, null, 'a code that was never delivered must not stay usable');
  assert.equal(user.resetOtpExpiresAt, null);
});

test('OTP verification returns a reset token while persisting only its hash', async () => {
  const restoreEnvironment = configureSmsProvider();
  const otp = '123456';
  const user = createUser({
    resetOtpHash: sha256(otp),
    resetOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await verifyOtp(response, otp);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(typeof response.body.resetToken, 'string');
      assert.equal(response.body.resetToken.length, 64);
      assert.equal(user.resetTokenHash, sha256(response.body.resetToken), 'only the token hash may be stored');
      assert.notEqual(user.resetTokenHash, response.body.resetToken);
      assert.equal(user.resetOtpHash, null, 'the OTP must be cleared after it is redeemed');
      assert.ok(user.resetOtpUsedAt, 'OTP redemption must be recorded');
    });
  } finally {
    restoreEnvironment();
  }
});

test('an expired OTP is rejected and its stored state is cleared', async () => {
  const restoreEnvironment = configureSmsProvider();
  const user = createUser({
    resetOtpHash: sha256('123456'),
    resetOtpExpiresAt: new Date(Date.now() - 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await verifyOtp(response, '123456');

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.success, false);
      assert.equal(user.resetOtpHash, null);
    });
  } finally {
    restoreEnvironment();
  }
});

test('a malformed code is refused without spending an attempt', async () => {
  const restoreEnvironment = configureSmsProvider();
  const user = createUser({
    resetOtpHash: sha256('123456'),
    resetOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await verifyOtp(response, '12ab');

      assert.equal(response.statusCode, 400);
      assert.match(response.body.message, /6-digit/i);
      assert.equal(user.resetOtpAttempts, 0, 'a malformed code must not count towards the attempt limit');
      assert.ok(user.resetOtpHash, 'the code must survive a malformed submission');
    });
  } finally {
    restoreEnvironment();
  }
});

test('repeated wrong codes count towards the limit and then invalidate the code', async () => {
  const restoreEnvironment = configureSmsProvider();
  const user = createUser({
    resetOtpHash: sha256('123456'),
    resetOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      for (let attempt = 1; attempt < EXPECTED_OTP_MAX_ATTEMPTS; attempt += 1) {
        const response = createResponse();
        await verifyOtp(response, '000000');
        assert.equal(response.statusCode, 400, `attempt ${attempt} must be rejected as invalid`);
        assert.equal(user.resetOtpAttempts, attempt);
        assert.ok(user.resetOtpHash, 'the code must survive until the attempt limit is reached');
      }

      const finalResponse = createResponse();
      await verifyOtp(finalResponse, '000000');

      assert.equal(finalResponse.statusCode, 429);
      assert.equal(user.resetOtpHash, null, 'the code must be destroyed once the limit is hit');
      assert.equal(user.resetOtpAttempts, 0);
    });
  } finally {
    restoreEnvironment();
  }
});

test('completing an OTP based reset stores a bcrypt hash and burns the token exactly once', async () => {
  const restoreEnvironment = configureSmsProvider();
  const resetToken = crypto.randomBytes(32).toString('hex');
  const user = createUser({
    resetTokenHash: sha256(resetToken),
    resetTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    resetOtpUsedAt: new Date(),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await authController.resetPasswordWithOtp(
        { body: { resetToken, newPassword: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.notEqual(user.password, 'Str0ng!Pass', 'the password must never be stored in plaintext');
      assert.match(user.password, /^\$2[aby]\$\d{2}\$/, 'the stored password must be a bcrypt hash');
      assert.equal(await bcrypt.compare('Str0ng!Pass', user.password), true);
      assert.equal(user.resetTokenHash, null, 'the token hash must be cleared after use');
      assert.ok(user.resetTokenUsedAt, 'token consumption must be recorded');

      const replay = createResponse();
      await authController.resetPasswordWithOtp(
        { body: { resetToken, newPassword: 'An0ther!Pass', confirmPassword: 'An0ther!Pass' }, headers: {}, ip: '127.0.0.1' },
        replay,
      );

      assert.equal(replay.statusCode, 400, 'a consumed token must not be reusable');
      assert.equal(replay.body.success, false);
      assert.equal(await bcrypt.compare('An0ther!Pass', user.password), false, 'the replay must not change the password');
    });
  } finally {
    restoreEnvironment();
  }
});

test('a weak new password is refused before any database write happens', async () => {
  const restoreEnvironment = configureSmsProvider();
  const resetToken = crypto.randomBytes(32).toString('hex');
  const user = createUser({
    resetTokenHash: sha256(resetToken),
    resetTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await authController.resetPasswordWithOtp(
        { body: { resetToken, newPassword: 'weak', confirmPassword: 'weak' }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.success, false);
      assert.match(response.body.message, /at least 8 characters/i);
    });
  } finally {
    restoreEnvironment();
  }

  assert.equal(user.password, 'stored-hash-placeholder', 'the stored password must be untouched');
});

test('mismatched confirmation is rejected without touching the account', async () => {
  const restoreEnvironment = configureSmsProvider();
  const resetToken = crypto.randomBytes(32).toString('hex');
  const user = createUser({
    resetTokenHash: sha256(resetToken),
    resetTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await authController.resetPasswordWithOtp(
        { body: { resetToken, newPassword: 'Str0ng!Pass', confirmPassword: 'Different!1' }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.success, false);
    });
  } finally {
    restoreEnvironment();
  }

  assert.equal(user.password, 'stored-hash-placeholder');
});

test('an account deactivated after the code was issued cannot finish the reset', async () => {
  const restoreEnvironment = configureSmsProvider();
  const resetToken = crypto.randomBytes(32).toString('hex');
  const user = createUser({
    active: false,
    resetTokenHash: sha256(resetToken),
    resetTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await authController.resetPasswordWithOtp(
        { body: { resetToken, newPassword: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 403);
      assert.equal(response.body.success, false);
    });
  } finally {
    restoreEnvironment();
  }

  assert.equal(user.password, 'stored-hash-placeholder', 'a deactivated account must not have its password written');
  assert.equal(user.resetTokenHash, null, 'the token must be invalidated');
});

test('the email link reset burns its token and refuses a second attempt', async () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const user = createUser({
    resetTokenHash: sha256(resetToken),
    resetTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  await withStubs({ user }, async () => {
    const response = createResponse();
    await authController.resetPassword(
      { body: { token: resetToken, password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' }, headers: {}, ip: '127.0.0.1' },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.match(user.password, /^\$2[aby]\$\d{2}\$/, 'the stored password must be a bcrypt hash');
    assert.equal(user.resetTokenHash, null);
    assert.ok(user.resetTokenUsedAt, 'token consumption must be recorded');

    const replay = createResponse();
    await authController.resetPassword(
      { body: { token: resetToken, password: 'An0ther!Pass', confirmPassword: 'An0ther!Pass' }, headers: {}, ip: '127.0.0.1' },
      replay,
    );

    assert.equal(replay.statusCode, 400, 'a consumed token must not be reusable');
    assert.equal(await bcrypt.compare('An0ther!Pass', user.password), false, 'the replay must not change the password');
  });
});

test('an expired email link token is rejected', async () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const user = createUser({
    resetTokenHash: sha256(resetToken),
    resetTokenExpiresAt: new Date(Date.now() - 1000),
  });

  await withStubs({ user }, async () => {
    const response = createResponse();
    await authController.resetPassword(
      { body: { token: resetToken, password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' }, headers: {}, ip: '127.0.0.1' },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
  });

  assert.equal(user.password, 'stored-hash-placeholder');
});

test('an unknown reset token is rejected as invalid or expired', async () => {
  await withStubs({ user: null }, async () => {
    const response = createResponse();
    await authController.resetPassword(
      { body: { token: 'not-a-real-token', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' }, headers: {}, ip: '127.0.0.1' },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
  });
});

test('code verification supports the email recovery channel with the same OTP flow', async () => {
  const restoreEnvironment = configureSmsProvider();
  const otp = '123456';
  const user = createUser({
    recoveryMethod: 'email',
    resetOtpHash: sha256(otp),
    resetOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await authController.verifyResetOtp(
        { body: { method: 'email', email: user.email, otp }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(user.resetTokenHash, sha256(response.body.resetToken));
    });
  } finally {
    restoreEnvironment();
  }
});

test('code verification still supports the phone recovery channel', async () => {
  const restoreEnvironment = configureSmsProvider();
  const otp = '123456';
  const user = createUser({
    resetOtpHash: sha256(otp),
    resetOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  try {
    await withStubs({ user }, async () => {
      const response = createResponse();
      await authController.verifyResetOtp(
        { body: { method: 'phone', phone: '0911000001', otp }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(user.resetTokenHash, sha256(response.body.resetToken));
    });
  } finally {
    restoreEnvironment();
  }
});

test('forgot password rejects a malformed email address before any lookup', async () => {
  await withStubs({ user: createUser() }, async () => {
    const response = createResponse();
    await authController.forgotPassword({ body: { email: 'not-an-email' }, headers: {}, ip: '127.0.0.1' }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /valid email/i);
  });
});

test('an eligible account only ever has a token hash stored, never the emailed token', async () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://assets.example.edu';

  const user = createUser();
  let delivered = null;

  try {
    await withStubs({
      user,
      onSendMail: async (options) => {
        delivered = options;
        return { messageId: 'mail-1' };
      },
    }, async () => {
      const response = createResponse();
      await authController.forgotPassword(
        { body: { email: user.email }, headers: {}, ip: '127.0.0.1' },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
    });
  } finally {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  }

  assert.ok(delivered, 'the reset email must actually be dispatched');
  assert.equal(delivered.to, user.email);

  const emailedLink = delivered.html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const resetToken = new URL(emailedLink).searchParams.get('token');

  assert.equal(resetToken.length, 64, 'the emailed token must be a 256 bit value');
  assert.equal(user.resetTokenHash, sha256(resetToken), 'only the token hash may be persisted');
  assert.notEqual(user.resetTokenHash, resetToken);
  assert.ok(!delivered.text.includes(user.resetTokenHash), 'the stored hash must not be emailed');
  assert.ok(delivered.text.includes(resetToken), 'the reset link itself must reach the user');
  assert.ok(!/new password is|your password is/i.test(delivered.text), 'no password may be emailed');
  assert.ok(new Date(user.resetTokenExpiresAt) > new Date(), 'the emailed token must carry an expiry');
});

test('the emailed reset link points at the configured frontend and carries no secret material', async () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://assets.example.edu';

  const user = createUser();
  let delivered = null;

  try {
    await withStubs({
      user,
      onSendMail: async (options) => {
        delivered = options;
        return { messageId: 'mail-1' };
      },
    }, async () => {
      await authController.forgotPassword(
        { body: { email: user.email }, headers: {}, ip: '127.0.0.1' },
        createResponse(),
      );
    });
  } finally {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  }

  const emailedLink = delivered.html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const parsed = new URL(emailedLink);

  assert.equal(parsed.origin, 'https://assets.example.edu');
  assert.equal(parsed.pathname, '/reset-password');
  assert.deepEqual([...parsed.searchParams.keys()], ['token'], 'only the token may appear in the link');
  assert.ok(!delivered.text.includes('password_hash'), 'no internal field may be exposed');
});

const SMTP_ENV_KEYS = ['SMTP_CONNECTION_TIMEOUT_MS', 'SMTP_GREETING_TIMEOUT_MS', 'SMTP_SOCKET_TIMEOUT_MS', 'SMTP_DNS_TIMEOUT_MS', 'SMTP_HARD_TIMEOUT_MS', 'FRONTEND_URL'];

const withSmtpEnvironment = (overrides) => {
  const previous = Object.fromEntries(SMTP_ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  });
  return () => {
    SMTP_ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  };
};

const requestEmailReset = (response, email) => authController.forgotPassword(
  { body: { email }, headers: {}, ip: '127.0.0.1' },
  response,
);

test('the SMTP transport is created with connection, greeting and socket timeouts', async () => {
  const user = createUser();
  let transportOptions = null;

  await withStubs({
    user,
    onCreateTransport: (options) => { transportOptions = options; },
  }, async () => {
    const response = createResponse();
    await requestEmailReset(response, user.email);
    assert.equal(response.statusCode, 200);
  });

  assert.ok(transportOptions, 'a transport must be created');
  assert.ok(transportOptions.connectionTimeout > 0, 'connectionTimeout must be bounded');
  assert.ok(transportOptions.greetingTimeout > 0, 'greetingTimeout must be bounded');
  assert.ok(transportOptions.socketTimeout > 0, 'socketTimeout must be bounded');
  assert.ok(transportOptions.dnsTimeout > 0, 'dnsTimeout must be bounded');
});

test('an SMTP send that never settles is abandoned instead of hanging the request', async () => {
  const restoreEnvironment = withSmtpEnvironment({ SMTP_HARD_TIMEOUT_MS: 60 });
  const user = createUser();

  try {
    await withStubs({ user, onSendMail: () => new Promise(() => {}) }, async () => {
      const response = createResponse();
      await requestEmailReset(response, user.email);

      assert.equal(response.statusCode, 503);
      assert.equal(response.body.success, false);
    });
  } finally {
    restoreEnvironment();
  }

  assert.equal(user.resetTokenHash, null, 'a timed out delivery must not leave a usable token');
  assert.equal(user.resetTokenExpiresAt, null);
  assert.ok(user.resetTokenUsedAt, 'the abandoned token must be marked as consumed');
});

test('a rejected SMTP send rolls the reset token back', async () => {
  const user = createUser();

  await withStubs({
    user,
    onSendMail: async () => { throw new Error('535 authentication failed'); },
  }, async () => {
    const response = createResponse();
    await requestEmailReset(response, user.email);

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.success, false);
  });

  assert.equal(user.resetTokenHash, null, 'a failed delivery must invalidate the token');
  assert.equal(user.resetTokenExpiresAt, null);
  assert.ok(user.resetTokenUsedAt, 'the rolled back token must be marked as consumed');
});

test('a rolled back token cannot be used to reset the password', async () => {
  const restoreEnvironment = withSmtpEnvironment({ SMTP_HARD_TIMEOUT_MS: 60 });
  const user = createUser();
  let capturedToken = null;

  try {
    await withStubs({
      user,
      onSendMail: async (options) => {
        const link = options.html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
        capturedToken = new URL(link).searchParams.get('token');
        throw new Error('SMTP unavailable');
      },
    }, async () => {
      await requestEmailReset(createResponse(), user.email);
    });
  } finally {
    restoreEnvironment();
  }

  assert.ok(capturedToken, 'the link must have been built before the failure');

  const store = createUserStore(user);
  const recoveryStore = createRecoveryStore(user);
  const originalFindOne = User.findOne;
  const originalUpdate = User.update;
  const originalRecoveryFindOne = PasswordRecovery.findOne;
  const originalRecoveryCreate = PasswordRecovery.create;
  const originalRecoveryUpdate = PasswordRecovery.update;
  User.findOne = store.findOne;
  User.update = store.update;
  PasswordRecovery.findOne = recoveryStore.findOne;
  PasswordRecovery.create = recoveryStore.create;
  PasswordRecovery.update = recoveryStore.update;

  try {
    const response = createResponse();
    await authController.resetPassword(
      { body: { token: capturedToken, password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' }, headers: {}, ip: '127.0.0.1' },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(user.password, 'stored-hash-placeholder', 'the password must be untouched');
  } finally {
    User.findOne = originalFindOne;
    User.update = originalUpdate;
    PasswordRecovery.findOne = originalRecoveryFindOne;
    PasswordRecovery.create = originalRecoveryCreate;
    PasswordRecovery.update = originalRecoveryUpdate;
  }
});
