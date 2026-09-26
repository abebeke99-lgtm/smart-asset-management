const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// The controller reads these once at module load, so they must be set before it is required.
process.env.PASSWORD_RESET_OTP_TTL_MINUTES = '8';
process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS = '3';

const nodemailer = require('nodemailer');
const { User, Config, AuditLog } = require('../src/models');
const authController = require('../src/controllers/authController');

const EXPECTED_OTP_TTL_MINUTES = 8;
const EXPECTED_OTP_MAX_ATTEMPTS = 3;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

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
  email: 'student@university.edu',
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

const withStubs = async ({ user, onFetch, onSendMail }, run) => {
  const originalFindOne = User.findOne;
  const originalUpdate = User.update;
  const originalConfigFindByPk = Config.findByPk;
  const originalAuditCreate = AuditLog.create;
  const originalFetch = global.fetch;
  const originalCreateTransport = nodemailer.createTransport;

  const store = createUserStore(user);
  User.findOne = store.findOne;
  User.update = store.update;
  Config.findByPk = async () => null;
  AuditLog.create = async () => ({});
  global.fetch = onFetch || (async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ SMSMessageData: { Recipients: [{ status: 'Success', messageId: 'smoke-1' }] } }),
  }));
  nodemailer.createTransport = () => ({
    sendMail: onSendMail || (async () => ({ messageId: 'mail-1' })),
  });

  try {
    return await run();
  } finally {
    User.findOne = originalFindOne;
    User.update = originalUpdate;
    Config.findByPk = originalConfigFindByPk;
    AuditLog.create = originalAuditCreate;
    global.fetch = originalFetch;
    nodemailer.createTransport = originalCreateTransport;
  }
};

const configureSmsProvider = () => withEnvironment({
  SMS_PROVIDER: 'africastalking',
  SMS_API_KEY: 'unit-test-username',
  SMS_API_SECRET: 'unit-test-api-key',
  SMS_SENDER: 'SMARTASSET',
});

const requestOtp = (response, phoneNumber = '0911000001') => authController.requestForgotPasswordOtp(
  { body: { phoneNumber }, headers: {}, ip: '127.0.0.1' },
  response,
);

const verifyOtp = (response, otp, phoneNumber = '+251911000001') => authController.verifyForgotPasswordOtp(
  { body: { phoneNumber, otp }, headers: {}, ip: '127.0.0.1' },
  response,
);

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

test('code verification rejects the email channel instead of pretending an email code exists', async () => {
  await withStubs({ user: createUser() }, async () => {
    const response = createResponse();
    await authController.verifyResetOtp(
      { body: { method: 'email', email: 'student@university.edu', otp: '123456' }, headers: {}, ip: '127.0.0.1' },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /email address/i);
  });
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
        { body: { email: 'student@university.edu' }, headers: {}, ip: '127.0.0.1' },
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
  assert.equal(delivered.to, 'student@university.edu');

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
        { body: { email: 'student@university.edu' }, headers: {}, ip: '127.0.0.1' },
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
