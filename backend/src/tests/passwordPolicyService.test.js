const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword } = require('../services/passwordPolicyService');

test('password validation enforces the exact length and character requirements', () => {
  const cases = [
    ['Abc12345', null],
    ['Abc1234567890123', null],
    ['Abc1234', 'Password must be 8–16 characters long.'],
    ['Abc12345678901234', 'Password must be 8–16 characters long.'],
    ['abcdefgh', 'Password must contain at least one letter and one number.'],
    ['12345678', 'Password must contain at least one letter and one number.'],
    ['', 'Password is required.'],
    [' Abc12345', null],
    ['Abc12345 ', null],
    ['Abc1234567890123 ', 'Password must be 8–16 characters long.'],
  ];

  for (const [password, expected] of cases) {
    assert.equal(validatePassword(password), expected);
  }
});
