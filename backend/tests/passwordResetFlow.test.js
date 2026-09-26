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

test('forgot-password uses the same generic response for unknown and ineligible accounts', async () => {
  const originalFindOne = User.findOne;
  const responses = [];
  const accounts = [
    null,
    { active: false, email: 'person@example.edu', lockoutUntil: null },
    { active: true, email: 'person@example.edu', lockoutUntil: new Date(Date.now() + 60_000) },
    { active: true, email: null, lockoutUntil: null },
  ];

  try {
    for (const account of accounts) {
      User.findOne = async () => account;
      const response = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          responses.push({ statusCode: this.statusCode, body });
          return this;
        },
      };

      await authController.forgotPassword({ body: { email: 'person@example.edu' }, ip: '127.0.0.1' }, response);
    }
  } finally {
    User.findOne = originalFindOne;
  }

  assert.equal(responses.length, accounts.length);
  assert.ok(responses.every(({ statusCode }) => statusCode === 200));
  assert.ok(responses.every(({ body }) => body.success === true));
  assert.ok(responses.every(({ body }) => body.message === responses[0].body.message));
});
