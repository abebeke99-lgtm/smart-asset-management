const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');

test('transfer permissions follow the existing role capabilities', () => {
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes('assets.transfer'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes('assets.transfer.approve'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.transfers.view'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.transfers.manage'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('assets.transfer.approve'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.department_head.includes('assets.transfer'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.store_manager.includes('assets.transfer'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.ict_officer.includes('ict.assets.transfer'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college.includes('college.transfers.view'));
  assert.ok(!DEFAULT_ROLE_PERMISSIONS.college.includes('college.transfers.manage'));
});

test('finance, infrastructure, maintenance, teaching assistant, staff, and student do not gain transfer actions', () => {
  for (const role of ['finance', 'infrastructure', 'maintenance', 'teaching_assistant', 'staff', 'student']) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    assert.ok(!permissions.some((permission) => /(^|\.)(transfers?|transfer\.approve)(\.|$)/.test(permission)), `${role} should not gain transfer permissions`);
  }
});
