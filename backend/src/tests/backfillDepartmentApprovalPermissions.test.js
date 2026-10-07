const test = require('node:test');
const assert = require('node:assert/strict');
const { Config, sequelize } = require('../models');
const {
  DEPARTMENT_HEAD_APPROVAL_PERMISSIONS,
  backfillDepartmentApprovalPermissions,
} = require('../scripts/migrations/backfillDepartmentApprovalPermissions');

test('dry run reports only missing approval grants and leaves the saved matrix untouched', async (t) => {
  const originalFindByPk = Config.findByPk;
  let updates = 0;
  Config.findByPk = async () => ({
    value: JSON.stringify({ department_head: ['assets.view'], finance: ['financial.view'] }),
    async update() { updates += 1; },
  });
  t.after(() => { Config.findByPk = originalFindByPk; });

  const result = await backfillDepartmentApprovalPermissions();
  assert.equal(result.mode, 'dry-run');
  assert.deepEqual(result.missing, DEPARTMENT_HEAD_APPROVAL_PERMISSIONS);
  assert.deepEqual(result.added, []);
  assert.equal(updates, 0);
});

test('apply adds only the missing approval grants and preserves every other role permission', async (t) => {
  const originals = { findByPk: Config.findByPk, transaction: sequelize.transaction };
  const matrix = {
    department_head: ['assets.view', 'department_head.approvals.review'],
    finance: ['financial.view'],
    unrelatedSetting: { retained: true },
  };
  let writes = 0;
  Config.findByPk = async (_key, options = {}) => ({
    value: JSON.stringify(matrix),
    async update(values, updateOptions) {
      assert.equal(options.transaction, updateOptions.transaction);
      Object.assign(matrix, JSON.parse(values.value));
      writes += 1;
    },
  });
  sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
  t.after(() => {
    Config.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
  });

  const result = await backfillDepartmentApprovalPermissions({ apply: true });
  assert.equal(result.mode, 'apply');
  assert.deepEqual(result.added, DEPARTMENT_HEAD_APPROVAL_PERMISSIONS.filter((permission) => permission !== 'department_head.approvals.review'));
  assert.deepEqual(matrix.department_head, ['assets.view', ...DEPARTMENT_HEAD_APPROVAL_PERMISSIONS]);
  assert.deepEqual(matrix.finance, ['financial.view']);
  assert.deepEqual(matrix.unrelatedSetting, { retained: true });
  assert.equal(writes, 1);
});

test('fails safely when the saved permission matrix cannot be parsed or scoped', async (t) => {
  const originalFindByPk = Config.findByPk;
  let updates = 0;
  Config.findByPk = async () => ({
    value: '{"department_head":"invalid"}',
    async update() { updates += 1; },
  });
  t.after(() => { Config.findByPk = originalFindByPk; });

  await assert.rejects(backfillDepartmentApprovalPermissions({ apply: true }), /Department Head permissions are missing or invalid/);
  assert.equal(updates, 0);
});
