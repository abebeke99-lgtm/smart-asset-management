const test = require('node:test');
const assert = require('node:assert/strict');

const { User } = require('../src/models');
const authController = require('../src/controllers/authController');

test('auth controller exposes password reset and OTP verification entry points', () => {
  assert.equal(typeof authController.forgotPassword, 'function');
  assert.equal(typeof authController.resetPassword, 'function');
  assert.equal(typeof authController.verifyResetOtp, 'function');
});

test('user model stores reset tokens and OTPs with expiry and usage tracking', () => {
  assert.ok(User.rawAttributes.resetTokenHash, 'resetTokenHash should exist');
  assert.ok(User.rawAttributes.resetTokenExpiresAt, 'resetTokenExpiresAt should exist');
  assert.ok(User.rawAttributes.resetOtpHash, 'resetOtpHash should exist');
  assert.ok(User.rawAttributes.resetOtpExpiresAt, 'resetOtpExpiresAt should exist');
  assert.ok(User.rawAttributes.resetOtpAttempts, 'resetOtpAttempts should exist');
  assert.ok(User.rawAttributes.resetOtpUsedAt, 'resetOtpUsedAt should exist');
});
