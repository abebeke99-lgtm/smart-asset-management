const { Config } = require('../models');
const {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  NOTIFICATION_DEFAULT_PERMISSIONS,
  normalizeRoleForStorage,
} = require('../constants/rolePermissions');

const getRolePermissionMatrix = async () => {
  const record = await Config.findByPk('role_permissions');
  if (!record?.value) return { ...DEFAULT_ROLE_PERMISSIONS, admin: PERMISSIONS };

  let matrix;
  try {
    matrix = JSON.parse(record.value);
  } catch {
    throw new Error('Saved role permission matrix is not valid JSON.');
  }
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    throw new Error('Saved role permission matrix must be an object.');
  }
  return { ...DEFAULT_ROLE_PERMISSIONS, ...matrix, admin: PERMISSIONS };
};

const getConfiguredRolePermissions = async (role) => {
  const normalizedRole = normalizeRoleForStorage(role);
  const matrix = await getRolePermissionMatrix();
  const permissions = matrix[normalizedRole];
  return [...new Set([
    ...(Array.isArray(permissions) ? permissions.map(String) : []),
    ...(NOTIFICATION_DEFAULT_PERMISSIONS[normalizedRole] || []),
  ])];
};

module.exports = { DEFAULT_ROLE_PERMISSIONS, getConfiguredRolePermissions, getRolePermissionMatrix };