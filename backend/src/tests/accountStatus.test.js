const test = require('node:test');
const assert = require('node:assert/strict');
const { isAccountActive } = require('../utils/accountStatus');

test('active account flags do not override inactive or suspended account states', () => {
  for (const status of ['inactive', 'disabled', 'suspended', 'blocked']) {
    assert.equal(isAccountActive(true, status), false, `${status} accounts must be rejected`);
    assert.equal(isAccountActive('1', status.toUpperCase()), false, `${status} status matching is case-insensitive`);
  }
});

test('active accounts remain authorized and inactive flags remain rejected', () => {
  assert.equal(isAccountActive(true, 'active'), true);
  assert.equal(isAccountActive('1', null), true);
  assert.equal(isAccountActive(false, 'active'), false);
});
