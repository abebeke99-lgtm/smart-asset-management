const express = require('express');
const { Config, User, sequelize } = require('../models');
const { requireAuth, requireRole, requirePermission } = require('../middlewares/auth');
const { createAuditLog } = require('../services/auditLogService');
const { getRolePermissionMatrix } = require('../services/rolePermissionService');
const { PERMISSIONS, ROLE_NAMES } = require('../constants/rolePermissions');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const requireAdminPermission = (permission) => [...requireAdmin, requirePermission(permission)];
const CORE_ROLES = ROLE_NAMES;
const ROLE_STATUS_VALUES = ['active', 'inactive'];
const PERMISSION_ALIASES = {
  ...Object.fromEntries(PERMISSIONS.flatMap((permission) => {
    const [module, action] = permission.split('.');
    const dotted = `${module}.${action}`;
    return dotted === permission ? [[`${module}_${action}`, permission]] : [];
  })),
  view_assets: 'assets.view',
  create_asset: 'assets.create',
  edit_asset: 'assets.update',
  delete_asset: 'assets.delete',
  assign_asset: 'assets.assign',
  transfer_asset: 'assets.transfer',
  return_asset: 'assets.return',
  view_inventory: 'inventory.view',
  stock_in: 'inventory.stock_in',
  stock_out: 'inventory.stock_out',
  stock_movement: 'inventory.stock_movement',
  view_requests: 'maintenance.view',
  create_request: 'maintenance.request.create',
  assign_technician: 'maintenance.technician.assign',
  update_maintenance: 'maintenance.update',
  complete_maintenance: 'maintenance.complete',
  view_users: 'users.view',
  create_user: 'users.create',
  edit_user: 'users.update',
  delete_user: 'users.delete',
  activate_deactivate: 'users.activate',
  manage_roles: 'roles.manage',
  manage_permissions: 'permissions.manage',
  view_reports: 'reports.view',
  generate_reports: 'reports.generate',
  export_reports: 'reports.export',
  print_reports: 'reports.print',
  settings: 'settings.manage',
  backup: 'backup.manage',
  restore: 'backup.restore',
  audit_logs: 'audit.view',
};
const defaultRoleDescriptions = {
  admin: 'System administration and full authorized access',
  ict_officer: 'Information and communications technology operations and asset support',
  college: 'Legacy college-level operational management and oversight',
  college_manager: 'College-level operational management and oversight for an assigned college',
  department_head: 'Department leadership and local asset coordination',
  finance: 'Financial review, accounting, and value management',
  store_manager: 'Inventory, receiving, issue, and stock control',
  maintenance: 'Maintenance coordination and technical service management',
  infrastructure: 'Infrastructure and building asset management',
  staff: 'Standard staff access for routine operational tasks',
  student: 'Student access for learning and limited asset visibility',
};
const normalizePermission = (permission) => PERMISSION_ALIASES[permission] || permission;
const normalizeRoleName = (role) => String(role || '').trim().toLowerCase();
const ensureValidStatus = (status) => (ROLE_STATUS_VALUES.includes(String(status || 'active').toLowerCase()) ? String(status).toLowerCase() : 'active');
const humanizeRoleName = (role) => String(role || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const readMatrix = async () => {
  return getRolePermissionMatrix();
};

const readRoleRegistry = async () => {
  try {
    const record = await Config.findByPk('role_registry');
    if (!record || !record.value) return {};
    const parsed = JSON.parse(record.value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const readRoleStatusMap = async () => {
  try {
    const record = await Config.findByPk('role_statuses');
    if (!record || !record.value) return {};
    const parsed = JSON.parse(record.value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeRoleRegistry = async (nextRegistry) => {
  const [record] = await Config.findOrCreate({ where: { key: 'role_registry' }, defaults: { key: 'role_registry', value: JSON.stringify(nextRegistry) } });
  if (record.value !== JSON.stringify(nextRegistry)) {
    await record.update({ value: JSON.stringify(nextRegistry) });
  }
};

const writeRoleStatusMap = async (nextStatuses) => {
  const [record] = await Config.findOrCreate({ where: { key: 'role_statuses' }, defaults: { key: 'role_statuses', value: JSON.stringify(nextStatuses) } });
  if (record.value !== JSON.stringify(nextStatuses)) {
    await record.update({ value: JSON.stringify(nextStatuses) });
  }
};

const getRoleRecord = async (roleName) => {
  const normalizedRole = normalizeRoleName(roleName);
  const registry = await readRoleRegistry();
  const statuses = await readRoleStatusMap();
  const matrix = await readMatrix();
  const permissions = [...new Set((matrix[normalizedRole] || []).map(normalizePermission))];
  const userCount = await User.count({ where: { role: normalizedRole } });
  const record = registry[normalizedRole] || {};
  return {
    id: normalizedRole,
    name: normalizedRole,
    label: humanizeRoleName(normalizedRole),
    description: record.description || defaultRoleDescriptions[normalizedRole] || 'Role access configuration',
    status: ensureValidStatus(record.status || statuses[normalizedRole] || 'active'),
    protected: Boolean(record.protected || normalizedRole === 'admin'),
    system: Boolean(record.system || CORE_ROLES.includes(normalizedRole)),
    users: userCount,
    permissions,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
};

const listRoleRecords = async () => {
  const registry = await readRoleRegistry();
  const statuses = await readRoleStatusMap();
  const matrix = await readMatrix();
  const roles = await Promise.all(CORE_ROLES.map(async (role) => {
    const record = registry[role] || {};
    const permissions = [...new Set((matrix[role] || []).map(normalizePermission))];
    const status = ensureValidStatus(record.status || statuses[role] || 'active');
    const userCount = await User.count({ where: { role } });

    return {
      id: role,
      name: role,
      label: humanizeRoleName(role),
      displayName: humanizeRoleName(role),
      description: record.description || defaultRoleDescriptions[role] || 'Role access configuration',
      users: userCount,
      permissions,
      permissionCount: permissions.length,
      status,
      protected: Boolean(record.protected || role === 'admin'),
      system: Boolean(record.system || CORE_ROLES.includes(role)),
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    };
  }));

  return roles;
};

const ensureRoleGovernancePermissions = (role, permissions) => {
  const normalized = [...new Set(permissions.map(normalizePermission))];
  if (role === 'admin') return [...PERMISSIONS];
  return normalized;
};

const validateRolePayload = (roleName, payload = {}) => {
  const name = String(payload.name || roleName || '').trim();
  const description = String(payload.description || '').trim();
  const status = ensureValidStatus(payload.status || 'active');

  if (!name) {
    return { valid: false, message: 'Role name is required.' };
  }

  if (name.length > 100) {
    return { valid: false, message: 'Role name must be 100 characters or fewer.' };
  }

  if (description.length > 500) {
    return { valid: false, message: 'Role description must be 500 characters or fewer.' };
  }

  if (!ROLE_STATUS_VALUES.includes(status)) {
    return { valid: false, message: 'Role status must be active or inactive.' };
  }

  return { valid: true, name, description, status };
};

router.get('/roles', ...requireAdminPermission('roles.view'), async (req, res, next) => {
  try {
    const roles = await listRoleRecords();
    return res.json({ success: true, data: roles, roles, total: roles.length });
  } catch (error) { next(error); }
});

router.get('/roles/:role', ...requireAdminPermission('roles.view'), async (req, res, next) => {
  try {
    const normalizedRole = normalizeRoleName(req.params.role);
    if (!CORE_ROLES.includes(normalizedRole)) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }
    const role = await getRoleRecord(normalizedRole);
    return res.json({ success: true, data: role, role });
  } catch (error) { next(error); }
});

router.get('/permissions', ...requireAdminPermission('permissions.view'), async (req, res, next) => {
  try {
    const permissions = PERMISSIONS.map((name) => ({
      name,
      key: name,
      label: name,
      module: name.split('.')[0],
      action: name.split('.').at(-1) || '',
      status: 'active',
    }));
    return res.json({ success: true, data: permissions, permissions, total: permissions.length });
  } catch (error) { next(error); }
});

router.get('/roles/:role/permissions', ...requireAdminPermission('roles.view'), async (req, res, next) => {
  try {
    const normalizedRole = normalizeRoleName(req.params.role);
    if (!CORE_ROLES.includes(normalizedRole)) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }
    const matrix = await readMatrix();
    const permissions = [...new Set((matrix[normalizedRole] || []).map(normalizePermission))];
    return res.json({ success: true, data: { role: normalizedRole, permissions }, permissions });
  } catch (error) { next(error); }
});

router.get('/roles/:role/users', ...requireAdminPermission('roles.view'), async (req, res, next) => {
  try {
    const normalizedRole = normalizeRoleName(req.params.role);
    if (!CORE_ROLES.includes(normalizedRole)) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }
    const users = await User.findAll({
      where: { role: normalizedRole },
      attributes: ['id', 'username', 'fullName', 'email', 'active', 'collegeId', 'departmentId'],
      order: [['fullName', 'ASC']],
    });
    return res.json({ success: true, data: users, users });
  } catch (error) { next(error); }
});

router.post('/roles', ...requireAdminPermission('roles.manage'), async (req, res, next) => {
  try {
    const payload = validateRolePayload(req.body.name || req.body.role, req.body);
    if (!payload.valid) {
      return res.status(400).json({ success: false, message: payload.message });
    }

    if (!CORE_ROLES.includes(payload.name)) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists.' });
    }

    const registry = await readRoleRegistry();
    const statuses = await readRoleStatusMap();
    const existing = registry[payload.name] || {};
    if (existing.name || CORE_ROLES.includes(payload.name)) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists.' });
    }

    const nextRegistry = { ...registry, [payload.name]: { ...existing, name: payload.name, description: payload.description, status: payload.status, protected: payload.name === 'admin', system: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    const nextStatuses = { ...statuses, [payload.name]: payload.status };
    await writeRoleRegistry(nextRegistry);
    await writeRoleStatusMap(nextStatuses);

    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CHANGE_ROLE', entity: `role:${payload.name}`, entityId: payload.name, oldValue: null, newValue: { name: payload.name, description: payload.description, status: payload.status }, details: { operation: 'create', legacyAction: 'ROLE_CREATED' } });

    const role = await getRoleRecord(payload.name);
    return res.status(201).json({ success: true, data: role, role });
  } catch (error) { next(error); }
});

router.put('/roles/:role', ...requireAdminPermission('roles.manage'), async (req, res, next) => {
  try {
    const normalizedRole = normalizeRoleName(req.params.role);
    if (!CORE_ROLES.includes(normalizedRole)) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    const payload = validateRolePayload(normalizedRole, req.body);
    if (!payload.valid) {
      return res.status(400).json({ success: false, message: payload.message });
    }

    const registry = await readRoleRegistry();
    const statuses = await readRoleStatusMap();
    const previousRole = registry[normalizedRole] || { status: statuses[normalizedRole] || 'active', description: defaultRoleDescriptions[normalizedRole] || '' };
    const nextRegistry = {
      ...registry,
      [normalizedRole]: {
        ...previousRole,
        name: normalizedRole,
        description: payload.description,
        status: payload.status,
        protected: Boolean(previousRole.protected || normalizedRole === 'admin'),
        system: Boolean(previousRole.system || CORE_ROLES.includes(normalizedRole)),
        updatedAt: new Date().toISOString(),
      },
    };
    const nextStatuses = { ...statuses, [normalizedRole]: payload.status };
    await writeRoleRegistry(nextRegistry);
    await writeRoleStatusMap(nextStatuses);

    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CHANGE_ROLE', entity: `role:${normalizedRole}`, entityId: normalizedRole, oldValue: previousRole, newValue: nextRegistry[normalizedRole], details: { operation: 'update', legacyAction: 'ROLE_UPDATED' } });

    const role = await getRoleRecord(normalizedRole);
    return res.json({ success: true, data: role, role });
  } catch (error) { next(error); }
});

router.patch('/roles/:role/status', ...requireAdminPermission('roles.manage'), async (req, res, next) => {
  try {
    const normalizedRole = normalizeRoleName(req.params.role);
    if (!CORE_ROLES.includes(normalizedRole)) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    const nextStatus = ensureValidStatus(req.body.status || req.body.active === false ? 'inactive' : 'active');
    const registry = await readRoleRegistry();
    const statuses = await readRoleStatusMap();
    const existing = registry[normalizedRole] || {};
    const previousStatus = ensureValidStatus(existing.status || statuses[normalizedRole] || 'active');

    const nextRegistry = { ...registry, [normalizedRole]: { ...existing, name: normalizedRole, status: nextStatus, updatedAt: new Date().toISOString() } };
    const nextStatuses = { ...statuses, [normalizedRole]: nextStatus };
    await writeRoleRegistry(nextRegistry);
    await writeRoleStatusMap(nextStatuses);

    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CHANGE_ROLE', entity: `role:${normalizedRole}`, entityId: normalizedRole, oldValue: { status: previousStatus }, newValue: { status: nextStatus }, details: { operation: 'status', legacyAction: nextStatus === 'active' ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED' } });

    const role = await getRoleRecord(normalizedRole);
    return res.json({ success: true, data: role, role });
  } catch (error) { next(error); }
});

router.delete('/roles/:role', ...requireAdminPermission('roles.manage'), async (req, res, next) => {
  try {
    const normalizedRole = normalizeRoleName(req.params.role);
    const registry = await readRoleRegistry();
    const roleMeta = registry[normalizedRole] || {};

    if (normalizedRole === 'admin' || roleMeta.protected) {
      return res.status(403).json({ success: false, message: 'This system role is protected and cannot be deleted.' });
    }

    const userCount = await User.count({ where: { role: normalizedRole } });
    if (userCount > 0) {
      return res.status(409).json({ success: false, message: 'Cannot delete this role because it is assigned to existing users.' });
    }

    const nextRegistry = { ...registry };
    delete nextRegistry[normalizedRole];
    await writeRoleRegistry(nextRegistry);

    const statuses = await readRoleStatusMap();
    if (statuses[normalizedRole]) {
      const nextStatuses = { ...statuses };
      delete nextStatuses[normalizedRole];
      await writeRoleStatusMap(nextStatuses);
    }

    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CHANGE_ROLE', entity: `role:${normalizedRole}`, entityId: normalizedRole, oldValue: roleMeta, newValue: null, details: { operation: 'delete', userCount, legacyAction: 'ROLE_DELETED' } });

    return res.json({ success: true, message: 'Role deleted successfully.' });
  } catch (error) { next(error); }
});

router.put('/roles/:role/permissions', ...requireAdminPermission('permissions.manage'), async (req, res, next) => {
  try {
    const role = normalizeRoleName(req.params.role);
    if (!CORE_ROLES.includes(role)) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    if (!Array.isArray(req.body.permissions) || req.body.permissions.some((permission) => typeof permission !== 'string')) {
      return res.status(400).json({ success: false, message: 'Permissions must be an array of permission names.' });
    }

    const previous = await readMatrix();
    const requestedPermissions = req.body.permissions;
    const permissions = ensureRoleGovernancePermissions(role, [...new Set(requestedPermissions.map(normalizePermission))]);
    const invalid = permissions.filter((permission) => !PERMISSIONS.includes(permission));
    if (invalid.length) {
      return res.status(400).json({ success: false, message: 'Unknown permissions supplied.', errors: invalid });
    }

    if (role === 'admin' && (!permissions.includes('roles.manage') || !permissions.includes('permissions.manage') || !permissions.includes('settings.manage'))) {
      return res.status(400).json({ success: false, message: 'The administrator role must retain governance permissions.' });
    }

    const next = { ...previous, [role]: permissions };
    await sequelize.transaction(async (transaction) => {
      const [record] = await Config.findOrCreate({
        where: { key: 'role_permissions' },
        defaults: { key: 'role_permissions', value: JSON.stringify(next) },
        transaction,
      });
      if (record.value !== JSON.stringify(next)) {
        await record.update({ value: JSON.stringify(next) }, { transaction });
      }

      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'CHANGE_PERMISSION',
        entity: `role:${role}`,
        entityId: role,
        oldValue: previous[role] || [],
        newValue: permissions,
        details: { role, legacyAction: 'ROLE_PERMISSIONS_UPDATED' },
        transaction,
      });
    });

    return res.json({ success: true, data: { role, permissions }, permissions });
  } catch (error) { next(error); }
});

module.exports = router;