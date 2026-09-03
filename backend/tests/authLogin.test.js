const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveLoginAliases, normalizeLoginIdentity } = require('../src/controllers/authController');

test('normalizes canonical college role and legacy department assignments', () => {
  assert.deepEqual(normalizeLoginIdentity('college'), 'college');
  assert.deepEqual(normalizeLoginIdentity('Department Head'), 'college');
  assert.deepEqual(normalizeLoginIdentity('department_head'), 'college');
  assert.deepEqual(normalizeLoginIdentity('dept_head'), 'college');
  assert.deepEqual(normalizeLoginIdentity('ict officer'), 'ict_officer');
  assert.deepEqual(normalizeLoginIdentity('store manager'), 'store_manager');
});

test('resolves legacy login aliases while preserving the college role', () => {
  assert.deepEqual(resolveLoginAliases('department'), ['department', 'college', 'department_head', 'dept_head', 'department head']);
  assert.deepEqual(resolveLoginAliases('store manager'), ['store manager', 'store_manager', 'store-manager']);
  assert.deepEqual(resolveLoginAliases('ICT Officer'), ['ict officer', 'ict_officer', 'ict-officer', 'ict']);
});

test('accepts infrastructure as a canonical login identity', () => {
  assert.equal(normalizeLoginIdentity('infrastructure'), 'infrastructure');
  assert.equal(normalizeLoginIdentity('Infrastructure Directorate'), 'infrastructure');
  assert.deepEqual(resolveLoginAliases('infrastructure'), ['infrastructure', 'infrastructure_directorate', 'infra', 'infrastructure directorate']);
});
