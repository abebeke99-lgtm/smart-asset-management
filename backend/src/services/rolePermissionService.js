const { Config } = require('../models');
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');

const normalizeRoleName = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  const aliases = {
    admin: 'admin',
    administrator: 'admin',
    college: 'college_manager',
    'college manager': 'college_manager',
    'college-manager': 'college_manager',
    college_manager: 'college_manager',
    'department head': 'department_head',
    'department-head': 'department_head',
    department_head: 'department_head',
    department: 'department_head',
    dept_head: 'department_head',
    'dept-head': 'department_head',
    'ict officer': 'ict_officer',
    'ict-officer': 'ict_officer',
    ict_officer: 'ict_officer',
    'infrastructure director': 'infrastructure',
    'infrastructure-director': 'infrastructure',
    'infrastructure directorate': 'infrastructure',
    'infrastructure-directorate': 'infrastructure',
    infrastructure_directorate: 'infrastructure',
    infra: 'infrastructure',
    'finance officer': 'finance',
    'store manager': 'store_manager',
    'store-manager': 'store_manager',
    store_manager: 'store_manager',
    maintenance: 'maintenance',
    maint: 'maintenance',
    staff: 'staff',
    student: 'student',
  };

  return aliases[normalized] || normalized.replace(/[\s-]+/g, '_');
};

const getRolePermissionMatrix = async () => {
  const record = await Config.findByPk('role_permissions');
  if (!record?.value) return { ...DEFAULT_ROLE_PERMISSIONS, admin: [...PERMISSIONS] };

  let matrix;
  try {
    matrix = JSON.parse(record.value);
  } catch (error) {
    throw new Error('Stored role permission matrix is not valid JSON.', { cause: error });
  }
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    throw new TypeError('Stored role permission matrix must be an object.');
  }

  const mergedMatrix = { ...DEFAULT_ROLE_PERMISSIONS };
  for (const [role, permissions] of Object.entries(matrix)) {
    if (!Array.isArray(permissions)) continue;
    // An explicitly saved role list is authoritative. Unioning it with defaults
    // makes removed permissions impossible to revoke.
    mergedMatrix[role] = [...new Set(permissions.map(String).filter(Boolean))];
  }

  mergedMatrix.admin = [...PERMISSIONS];
  return mergedMatrix;
};

const getConfiguredRolePermissions = async (role) => {
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === 'admin') return ['*'];
  const matrix = await getRolePermissionMatrix();
  const permissions = matrix[normalizedRole];
  return Array.isArray(permissions) ? [...new Set(permissions.map(String))] : [];
};

module.exports = { DEFAULT_ROLE_PERMISSIONS, getConfiguredRolePermissions, getRolePermissionMatrix };
