const test = require('node:test');
const assert = require('node:assert/strict');
const { getDefaultGrant, getLegacyScope } = require('../scripts/migrations/rolesPermissions');

test('default permission grants implement the specified role matrix', () => {
  const actions = ['view', 'create', 'edit', 'delete', 'approve', 'assign', 'transfer', 'maintain', 'report', 'configure'];
  const matrix = {
    admin: 'YYYYYYYYYY',
    ict_officer: 'YYYLYYYYYL',
    college_manager: 'YYY-YYYLY-',
    store_manager: 'YYYLYYYLYL',
    maintenance: 'YYY-Y--YY-',
    infrastructure: 'YYY-YYYYYL',
    department_head: 'YYY-YYLLY-',
    teaching_assistant: '----------',
    finance: 'YLL-Y---Y-',
  };
  for (const [role, expected] of Object.entries(matrix)) {
    assert.equal(expected.length, actions.length);
    actions.forEach((action, index) => {
      const grant = getDefaultGrant(role, action);
      const actual = !grant ? '-' : grant.limited ? 'L' : 'Y';
      assert.equal(actual, expected[index], `${role} ${action}`);
    });
  }
  assert.deepEqual(getDefaultGrant('ict_officer', 'delete'), { limited: true, scopeType: 'college' });
  assert.deepEqual(getDefaultGrant('store_manager', 'maintain'), { limited: true, scopeType: 'store' });
  assert.deepEqual(getDefaultGrant('department_head', 'transfer'), { limited: true, scopeType: 'department' });
  assert.deepEqual(getDefaultGrant('finance', 'create'), { limited: true, scopeType: 'college' });
});

test('legacy college and department roles are backfilled to their assigned organization', () => {
  assert.deepEqual(getLegacyScope({ collegeId: 3 }, 'college_manager'), { scopeType: 'college', scopeId: 3 });
  assert.deepEqual(getLegacyScope({ departmentId: 8 }, 'department_head'), { scopeType: 'department', scopeId: 8 });
  assert.deepEqual(getLegacyScope({ collegeId: null }, 'college_manager'), { scopeType: 'own', scopeId: null });
});
