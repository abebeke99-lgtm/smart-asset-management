const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveLoginAliases, normalizeLoginIdentity } = require('../src/controllers/authController');

test('normalizes canonical role usernames and legacy aliases', () => {
  assert.deepEqual(normalizeLoginIdentity('department_head'), 'department_head');
  assert.deepEqual(normalizeLoginIdentity('Department'), 'department_head');
  assert.deepEqual(normalizeLoginIdentity('dept_head'), 'department_head');
  assert.deepEqual(normalizeLoginIdentity('ict officer'), 'ict_officer');
  assert.deepEqual(normalizeLoginIdentity('store manager'), 'store_manager');
});

test('resolves legacy login aliases for each role', () => {
  assert.deepEqual(resolveLoginAliases('department'), ['department', 'department_head', 'dept_head', 'department head']);
  assert.deepEqual(resolveLoginAliases('store manager'), ['store manager', 'store_manager', 'store-manager']);
  assert.deepEqual(resolveLoginAliases('ICT Officer'), ['ict officer', 'ict_officer', 'ict-officer', 'ict']);
});
