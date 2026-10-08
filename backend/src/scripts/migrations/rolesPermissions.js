const { DataTypes } = require('sequelize');
const { sequelize, Role, Permission, RolePermission, UserRole, User } = require('../../models');

const ROLE_SEEDS = [
  ['admin', 'Administrator', 'System administration'],
  ['ict_officer', 'ICT Officer', 'Information and communications technology operations'],
  ['college_manager', 'College Manager', 'College-level management'],
  ['store_manager', 'Store Manager', 'Store and inventory management'],
  ['maintenance', 'Maintenance Coordinator', 'Maintenance coordination'],
  ['infrastructure', 'Infrastructure / Facilities', 'Infrastructure and facilities management'],
  ['department_head', 'Department Head', 'Department leadership'],
  ['teaching_assistant', 'Teaching Assistant', 'Teaching assistant access'],
  ['finance', 'Finance', 'Financial review and accounting'],
];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'assign', 'transfer', 'maintain', 'report', 'configure'];
const LIMITED = {
  ict_officer: { delete: 'college', configure: 'college' },
  college_manager: { maintain: 'college' },
  store_manager: { delete: 'store', maintain: 'store', configure: 'store' },
  infrastructure: { configure: 'college' },
  department_head: { transfer: 'department', maintain: 'department' },
  finance: { create: 'college', edit: 'college' },
};
const DENIED = {
  college_manager: ['delete', 'configure'],
  maintenance: ['delete', 'assign', 'transfer', 'configure'],
  infrastructure: ['delete'],
  department_head: ['delete', 'configure'],
  finance: ['delete', 'assign', 'transfer', 'maintain', 'configure'],
};
const LEGACY_ROLE_NAMES = { college: 'college_manager', maint: 'maintenance' };

const getDefaultGrant = (roleName, action) => {
  if (roleName === 'teaching_assistant') return null;
  if (DENIED[roleName]?.includes(action)) return null;
  const scopeType = LIMITED[roleName]?.[action];
  return { limited: Boolean(scopeType), scopeType: scopeType || 'system' };
};

const getLegacyScope = (user, roleName) => {
  if (roleName === 'college_manager' && user.collegeId) {
    return { scopeType: 'college', scopeId: user.collegeId };
  }
  if (roleName === 'department_head' && user.departmentId) {
    return { scopeType: 'department', scopeId: user.departmentId };
  }
  if (roleName === 'finance' && user.collegeId) {
    return { scopeType: 'college', scopeId: user.collegeId };
  }
  if (roleName === 'college_manager' || roleName === 'department_head' || roleName === 'finance') {
    return { scopeType: 'own', scopeId: null };
  }
  return { scopeType: 'system', scopeId: null };
};

const applyRolesPermissionsMigration = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const roleColumns = await queryInterface.describeTable('roles');
  if (!roleColumns.description) {
    await queryInterface.addColumn('roles', 'description', {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '',
    });
  }
  if (!roleColumns.is_system) {
    await queryInterface.addColumn('roles', 'is_system', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }

  await sequelize.transaction(async (transaction) => {
    const roleRecords = new Map();
    for (const [name, displayName, description] of ROLE_SEEDS) {
      const [role] = await Role.findOrCreate({
        where: { name },
        defaults: { name, displayName, description, isSystem: true, active: true },
        transaction,
      });
      if (role.displayName !== displayName || !role.isSystem) {
        await role.update({ displayName, isSystem: true, description: role.description || description }, { transaction });
      }
      roleRecords.set(name, role);
    }

    const permissionRecords = new Map();
    for (const action of ACTIONS) {
      const key = `roles_permissions.${action}`;
      const [permission] = await Permission.findOrCreate({
        where: { key },
        defaults: { key, module: 'roles_permissions', action },
        transaction,
      });
      permissionRecords.set(action, permission);
    }

    for (const [roleName, role] of roleRecords) {
      for (const action of ACTIONS) {
        const defaults = getDefaultGrant(roleName, action);
        if (!defaults) continue;
        await RolePermission.findOrCreate({
          where: { roleId: role.id, permissionId: permissionRecords.get(action).id },
          defaults: { roleId: role.id, permissionId: permissionRecords.get(action).id, ...defaults },
          transaction,
        });
      }
    }

    const users = await User.findAll({
      attributes: ['id', 'role', 'collegeId', 'departmentId'],
      transaction,
    });
    for (const user of users) {
      const roleName = LEGACY_ROLE_NAMES[String(user.role || '').toLowerCase()] || String(user.role || '').toLowerCase();
      const role = roleRecords.get(roleName) || await Role.findOne({ where: { name: roleName }, transaction });
      if (!role) continue;
      const scope = getLegacyScope(user, roleName);
      const existing = await UserRole.findOne({
        where: { userId: user.id, roleId: role.id },
        transaction,
      });
      if (!existing) {
        await UserRole.create({
          userId: user.id,
          roleId: role.id,
          ...scope,
        }, { transaction });
      }
    }
  });
};

module.exports = { applyRolesPermissionsMigration, getDefaultGrant, getLegacyScope };
