require('dotenv').config();

const { Config, sequelize } = require('../../models');

const ROLE_PERMISSION_KEY = 'role_permissions';
const DEPARTMENT_HEAD_APPROVAL_PERMISSIONS = [
  'department_head.approvals.review',
  'department_head.approvals.approve',
  'department_head.approvals.reject',
  'department_head.approvals.request_changes',
  'department_head.approvals.escalate',
];

const backfillDepartmentApprovalPermissions = async ({ apply = false } = {}) => {
  const record = await Config.findByPk(ROLE_PERMISSION_KEY);
  if (!record) throw new Error('Saved role permission matrix is missing; no changes were made.');

  let matrix;
  try {
    matrix = JSON.parse(record.value);
  } catch {
    throw new Error('Saved role permission matrix is invalid JSON; no changes were made.');
  }
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    throw new Error('Saved role permission matrix must be an object; no changes were made.');
  }
  if (!Array.isArray(matrix.department_head)) {
    throw new Error('Department Head permissions are missing or invalid; no changes were made.');
  }

  const current = matrix.department_head;
  const missing = DEPARTMENT_HEAD_APPROVAL_PERMISSIONS.filter((permission) => !current.includes(permission));
  if (apply && missing.length) {
    await sequelize.transaction(async (transaction) => {
      const lockedRecord = await Config.findByPk(ROLE_PERMISSION_KEY, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lockedRecord) throw new Error('Saved role permission matrix disappeared; no changes were made.');

      let latestMatrix;
      try {
        latestMatrix = JSON.parse(lockedRecord.value);
      } catch {
        throw new Error('Saved role permission matrix changed to invalid JSON; no changes were made.');
      }
      if (!latestMatrix || typeof latestMatrix !== 'object' || Array.isArray(latestMatrix) || !Array.isArray(latestMatrix.department_head)) {
        throw new Error('Department Head permissions changed to an invalid value; no changes were made.');
      }

      const updatedMatrix = {
        ...latestMatrix,
        department_head: [...new Set([...latestMatrix.department_head, ...DEPARTMENT_HEAD_APPROVAL_PERMISSIONS])],
      };
      await lockedRecord.update({ value: JSON.stringify(updatedMatrix) }, { transaction });
    });
  }

  return { mode: apply ? 'apply' : 'dry-run', added: apply ? missing : [], missing: apply ? [] : missing };
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      const result = await backfillDepartmentApprovalPermissions({ apply: process.argv.includes('--apply') });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Department Head approval permission backfill failed:', error.message);
      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = { DEPARTMENT_HEAD_APPROVAL_PERMISSIONS, backfillDepartmentApprovalPermissions };
