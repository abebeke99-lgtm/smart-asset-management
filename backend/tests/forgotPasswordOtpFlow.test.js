const test = require('node:test');
const assert = require('node:assert/strict');

const authController = require('../src/controllers/authController');
const { normalizePhoneNumber, sendOtpSms } = require('../src/services/smsService');

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
