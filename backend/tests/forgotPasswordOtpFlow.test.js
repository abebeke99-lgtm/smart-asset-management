const test = require('node:test');
const assert = require('node:assert/strict');

const authController = require('../src/controllers/authController');
const { normalizePhoneNumber, sendOtpSms, isSmsConfigured } = require('../src/services/smsService');
const { User } = require('../src/models');

test('otp recovery support exposes the new request and verification functions', () => {
  assert.equal(typeof authController.requestForgotPasswordOtp, 'function');
  assert.equal(typeof authController.verifyForgotPasswordOtp, 'function');
  assert.equal(typeof authController.resetPasswordWithOtp, 'function');
});

test('phone normalization handles Ethiopian formats consistently', () => {
  assert.equal(normalizePhoneNumber('0912345678'), '+251912345678');
  assert.equal(normalizePhoneNumber('+251912345678'), '+251912345678');
  assert.equal(normalizePhoneNumber('251912345678'), '+251912345678');
  assert.equal(normalizePhoneNumber('invalid'), null);
});

test('sms abstraction exposes an OTP delivery function even when no provider is configured', async () => {
  const previousProvider = process.env.SMS_PROVIDER;
  delete process.env.SMS_PROVIDER;
  const result = await sendOtpSms('+251912345678', '123456');
  assert.equal(result.status, 'failed');
  if (previousProvider === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = previousProvider;
  assert.equal(typeof result.reason, 'string');
});

test('SMS availability rejects configured but unsupported providers', () => {
  const environmentKeys = ['SMS_PROVIDER', 'SMS_API_KEY', 'SMS_API_SECRET'];
  const previousEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

  process.env.SMS_PROVIDER = 'unsupported';
  process.env.SMS_API_KEY = 'configured-user';
  process.env.SMS_API_SECRET = 'configured-secret';

  try {
    assert.equal(isSmsConfigured(), false);
  } finally {
    environmentKeys.forEach((key) => {
      if (previousEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnvironment[key];
    });
  }
});

test('OTP recovery fails before account lookup when SMS delivery is unavailable', async () => {
  const environmentKeys = ['SMS_PROVIDER', 'SMS_API_KEY', 'SMS_API_SECRET'];
  const previousEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  const originalFindOne = User.findOne;
  let accountLookupAttempted = false;
  const response = {
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
  };

  environmentKeys.forEach((key) => delete process.env[key]);
  User.findOne = async () => {
    accountLookupAttempted = true;
    throw new Error('Account lookup should not run');
  };

  try {
    await authController.requestForgotPasswordOtp({ body: { phoneNumber: '0912345678' }, headers: {}, ip: '127.0.0.1' }, response);
  } finally {
    User.findOne = originalFindOne;
    environmentKeys.forEach((key) => {
      if (previousEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnvironment[key];
    });
  }

  assert.equal(isSmsConfigured(), false);
  assert.equal(accountLookupAttempted, false);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'We could not send the verification code right now. Please try again later.');
});
