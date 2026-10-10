const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Role, Permission, RolePermission, UserRole, User } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');
const { createAuditLog } = require('../services/auditLogService');
const { getAdministratorAssignmentError } = require('../services/roleGovernanceService');
const { ROLE_NAMES } = require('../constants/rolePermissions');

const router = express.Router();
const SCOPES = new Set(['system', 'college', 'department', 'store', 'location', 'own']);
router.use(requireAuth);

const requireModuleAction = (action) => [
  requireRole('admin'),
  authorize('roles_permissions.configure'),
  authorize(`roles_permissions.${action}`),
];

const getAssignedUserCount = async (role, transaction) => {
  const [users, assignments] = await Promise.all([
    User.findAll({ where: { role: role.name }, attributes: ['id'], ...(transaction ? { transaction } : {}) }),
    UserRole.findAll({ where: { roleId: role.id }, attributes: ['userId'], ...(transaction ? { transaction } : {}) }),
  ]);
  return new Set([
    ...users.map((user) => Number(user.id)),
    ...assignments.map((assignment) => Number(assignment.userId)),
  ]).size;
};

const serializeRole = async (role) => {
  const [userCount, permissions] = await Promise.all([
    getAssignedUserCount(role),
    RolePermission.findAll({
      where: { roleId: role.id },
      include: [{ model: Permission, required: true }],
      order: [[Permission, 'action', 'ASC']],
    }),
  ]);
  return {
    id: role.id,
    name: role.name,
    label: role.displayName,
    description: role.description,
    isSystem: role.isSystem,
    active: role.active,
    userCount,
    permissions: permissions.map((grant) => ({
      id: grant.Permission.id,
      key: grant.Permission.key,
      action: grant.Permission.action,
      scopeType: grant.scopeType,
      limited: grant.limited,
    })),
  };
};

const auditChange = (req, action, entity, oldValue, newValue, transaction) => createAuditLog({
  userId: req.user.id,
  role: req.user.role,
  action,
  entity,
  oldValue,
  newValue,
  details: { result: 'success' },
  transaction,
});

const auditDenied = (req, action, entity, details) => createAuditLog({
  userId: req.user.id,
  role: req.user.role,
  action,
  entity,
  details: { result: 'denied', ...details },
});

router.get('/roles', ...requireModuleAction('view'), async (_req, res, next) => {
  try {
    const roles = await Role.findAll({ order: [['displayName', 'ASC']] });
    const data = await Promise.all(roles.map(serializeRole));
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.get('/permissions', ...requireModuleAction('view'), async (_req, res, next) => {
  try {
    const permissions = await Permission.findAll({ where: { module: 'roles_permissions' }, order: [['action', 'ASC']] });
    return res.json({ success: true, data: permissions });
  } catch (error) { return next(error); }
});

router.get('/users', ...requireModuleAction('view'), async (req, res, next) => {
  try {
    const query = String(req.query.search || '').trim();
    const where = query ? {
      [Op.or]: [
        { username: { [Op.like]: `%${query}%` } },
        { fullName: { [Op.like]: `%${query}%` } },
        { email: { [Op.like]: `%${query}%` } },
      ],
    } : {};
    const users = await User.findAll({
      where,
      attributes: ['id', 'username', 'fullName', 'email', 'active', 'collegeId', 'departmentId'],
      include: [{ model: Role, through: { attributes: ['scopeType', 'scopeId'] }, required: false }],
      order: [['fullName', 'ASC']],
      limit: 100,
    });
    return res.json({
      success: true,
      data: users.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        active: user.active,
        roles: (user.Roles || []).map((role) => ({
          id: role.id,
          name: role.displayName,
          scopeType: role.UserRole.scopeType,
          scopeId: role.UserRole.scopeId,
        })),
      })),
    });
  } catch (error) { return next(error); }
});

router.post('/roles', ...requireModuleAction('create'), async (req, res, next) => {
  const name = String(req.body.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const description = String(req.body.description || '').trim();
  const displayName = String(req.body.displayName || req.body.name || '').trim();
  if (!name || !displayName || displayName.length > 150 || description.length > 500) {
    return res.status(400).json({ success: false, message: 'Provide a valid role name and description.' });
  }
  try {
    const role = await sequelize.transaction(async (transaction) => {
      const created = await Role.create({ name, displayName, description, isSystem: false, active: true }, { transaction });
      await auditChange(req, 'CREATE_ROLE', `role:${created.id}`, null, { name: created.name, displayName, description }, transaction);
      return created;
    });
    return res.status(201).json({ success: true, data: await serializeRole(role) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'A role with that name already exists.' });
    }
    return next(error);
  }
});

router.put('/roles/:roleId', ...requireModuleAction('edit'), async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    const oldValue = { displayName: role.displayName, description: role.description, active: role.active };
    const displayName = req.body.displayName === undefined ? role.displayName : String(req.body.displayName).trim();
    const description = req.body.description === undefined ? role.description : String(req.body.description).trim();
    if (!displayName || displayName.length > 150 || description.length > 500) {
      return res.status(400).json({ success: false, message: 'Provide a valid role name and description.' });
    }
    if (req.body.active === false && role.name === 'admin') {
      await auditDenied(req, 'DEACTIVATE_ROLE', `role:${role.id}`, { reason: 'administrator role is protected' });
      return res.status(403).json({ success: false, message: 'The Administrator role cannot be deactivated.' });
    }
    await sequelize.transaction(async (transaction) => {
      await role.update({ displayName, description, ...(typeof req.body.active === 'boolean' ? { active: req.body.active } : {}) }, { transaction });
      await auditChange(req, 'UPDATE_ROLE', `role:${role.id}`, oldValue, { displayName, description, active: role.active }, transaction);
    });
    return res.json({ success: true, data: await serializeRole(role) });
  } catch (error) { return next(error); }
});

router.delete('/roles/:roleId', ...requireModuleAction('delete'), async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    if (role.isSystem || ROLE_NAMES.includes(role.name)) {
      await auditDenied(req, 'DELETE_ROLE', `role:${role.id}`, { reason: 'system roles cannot be deleted' });
      return res.status(409).json({ success: false, message: 'System roles cannot be deleted. Deactivate the role instead.' });
    }
    const assignedUserCount = await getAssignedUserCount(role);
    if (assignedUserCount) {
      await auditDenied(req, 'DELETE_ROLE', `role:${role.id}`, {
        reason: 'role is assigned',
        userCount: assignedUserCount,
      });
      return res.status(409).json({ success: false, message: 'Remove all user assignments before deleting this role.' });
    }
    await sequelize.transaction(async (transaction) => {
      await RolePermission.destroy({ where: { roleId: role.id }, transaction });
      await role.destroy({ transaction });
      await auditChange(req, 'DELETE_ROLE', `role:${role.id}`, { name: role.name }, null, transaction);
    });
    return res.json({ success: true, message: 'Role deleted.' });
  } catch (error) { return next(error); }
});

router.put('/roles/:roleId/permissions', ...requireModuleAction('edit'), async (req, res, next) => {
  if (!Array.isArray(req.body.grants)) {
    return res.status(400).json({ success: false, message: 'A grants array is required.' });
  }
  try {
    const role = await Role.findByPk(req.params.roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    const permissions = await Permission.findAll({ where: { module: 'roles_permissions' } });
    const ids = new Set(permissions.map((permission) => permission.id));
    const grants = req.body.grants;
    for (const grant of grants) {
      if (!ids.has(Number(grant.permissionId))
        || !['full', 'limited', 'none'].includes(grant.state)
        || !SCOPES.has(grant.scopeType)) {
        return res.status(400).json({ success: false, message: 'Invalid permission grant or scope.' });
      }
      if (grant.state === 'limited' && grant.scopeType === 'system') {
        return res.status(400).json({ success: false, message: 'Limited permissions require a non-system scope.' });
      }
    }
    const deduplicated = new Map(grants.map((grant) => [Number(grant.permissionId), grant]));
    if (deduplicated.size !== grants.length) {
      return res.status(400).json({ success: false, message: 'Each permission may only be included once.' });
    }
    const nextGrants = [...deduplicated.values()].filter((grant) => grant.state !== 'none');
    await sequelize.transaction(async (transaction) => {
      const previous = await RolePermission.findAll({ where: { roleId: role.id }, transaction });
      if (role.name === 'admin'
        && !nextGrants.some((grant) => (
          Number(grant.permissionId) === permissions.find((permission) => permission.action === 'configure')?.id
          && grant.state === 'full'
        ))) {
        await auditDenied(req, 'CHANGE_PERMISSION', `role:${role.id}`, { reason: 'last Administrator would lose configure permission' });
        const error = new Error('The active Administrator role must retain Configure permission.');
        error.status = 409;
        throw error;
      }
      await RolePermission.destroy({ where: { roleId: role.id }, transaction });
      if (nextGrants.length) {
        await RolePermission.bulkCreate(nextGrants.map((grant) => ({
          roleId: role.id,
          permissionId: Number(grant.permissionId),
          limited: grant.state === 'limited',
          scopeType: grant.state === 'full' ? 'system' : grant.scopeType,
        })), { transaction });
      }
      await auditChange(req, 'CHANGE_PERMISSION', `role:${role.id}`, previous, nextGrants, transaction);
    });
    return res.json({ success: true, data: await serializeRole(role) });
  } catch (error) { return next(error); }
});

router.put('/matrix', ...requireModuleAction('edit'), async (req, res, next) => {
  if (!Array.isArray(req.body.roles)) {
    return res.status(400).json({ success: false, message: 'A roles matrix array is required.' });
  }
  try {
    const allRoles = await Role.findAll();
    const roleById = new Map(allRoles.map((role) => [role.id, role]));
    const permissions = await Permission.findAll({ where: { module: 'roles_permissions' } });
    const permissionIds = new Set(permissions.map((permission) => permission.id));
    const configurePermission = permissions.find((permission) => permission.action === 'configure');
    const requested = new Map();
    for (const item of req.body.roles) {
      const roleId = Number(item.roleId);
      if (!roleById.has(roleId) || !Array.isArray(item.grants) || requested.has(roleId)) {
        return res.status(400).json({ success: false, message: 'The roles matrix contains an invalid role or grant list.' });
      }
      const grants = new Map();
      for (const grant of item.grants) {
        const permissionId = Number(grant.permissionId);
        if (!permissionIds.has(permissionId)
          || grants.has(permissionId)
          || !['full', 'limited', 'none'].includes(grant.state)
          || !SCOPES.has(grant.scopeType)
          || (grant.state === 'limited' && grant.scopeType === 'system')) {
          return res.status(400).json({ success: false, message: 'The roles matrix contains an invalid permission grant or scope.' });
        }
        grants.set(permissionId, grant);
      }
      if (grants.size !== permissionIds.size) {
        return res.status(400).json({ success: false, message: 'Each role needs a state for every permission.' });
      }
      requested.set(roleId, grants);
    }

    await sequelize.transaction(async (transaction) => {
      for (const [roleId, grants] of requested) {
        const role = roleById.get(roleId);
        const nextConfigure = configurePermission && grants.get(configurePermission.id);
        if (role.name === 'admin' && (!nextConfigure || nextConfigure.state !== 'full')) {
          await auditDenied(req, 'CHANGE_PERMISSION', `role:${role.id}`, { reason: 'last Administrator would lose configure permission' });
          const error = new Error('The Administrator role must retain Configure permission.');
          error.status = 409;
          throw error;
        }
        const previous = await RolePermission.findAll({ where: { roleId }, transaction });
        await RolePermission.destroy({ where: { roleId }, transaction });
        const activeGrants = [...grants.entries()]
          .map(([permissionId, grant]) => ({ permissionId, grant }))
          .filter(({ grant }) => grant.state !== 'none');
        if (activeGrants.length) {
          await RolePermission.bulkCreate(activeGrants.map(({ permissionId, grant }) => ({
            roleId,
            permissionId,
            limited: grant.state === 'limited',
            scopeType: grant.state === 'full' ? 'system' : grant.scopeType,
          })), { transaction });
        }
        await auditChange(req, 'CHANGE_PERMISSION', `role:${role.id}`, previous, activeGrants, transaction);
      }
    });
    const updatedRoles = await Promise.all([...requested.keys()].map((roleId) => serializeRole(roleById.get(roleId))));
    return res.json({ success: true, data: updatedRoles });
  } catch (error) { return next(error); }
});

router.put('/users/:userId/roles', ...requireModuleAction('assign'), async (req, res, next) => {
  if (!Array.isArray(req.body.assignments)) {
    return res.status(400).json({ success: false, message: 'An assignments array is required.' });
  }
  try {
    if (new Set(req.body.assignments.map((item) => Number(item.roleId))).size !== req.body.assignments.length) {
      return res.status(400).json({ success: false, message: 'A user may only be assigned each role once.' });
    }
    const targetUser = await User.findByPk(req.params.userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });
    const roles = await Role.findAll({ where: { id: req.body.assignments.map((item) => Number(item.roleId)), active: true } });
    if (roles.length !== new Set(req.body.assignments.map((item) => Number(item.roleId))).size) {
      return res.status(400).json({ success: false, message: 'One or more selected roles are invalid or inactive.' });
    }
    for (const assignment of req.body.assignments) {
      if (!SCOPES.has(assignment.scopeType)
        || (assignment.scopeType !== 'system' && assignment.scopeType !== 'own'
          && (!Number.isSafeInteger(Number(assignment.scopeId)) || Number(assignment.scopeId) < 1))) {
        return res.status(400).json({ success: false, message: 'Every role assignment needs a valid scope.' });
      }
    }
    const existingAdmin = await Role.findOne({ where: { name: 'admin' } });
    const assignmentHasAdmin = (assignments) => assignments.some((item) => Number(item.roleId) === existingAdmin?.id);
    await sequelize.transaction(async (transaction) => {
      if (existingAdmin) await Role.findByPk(existingAdmin.id, { transaction, lock: transaction.LOCK.UPDATE });
      const existing = await UserRole.findAll({ where: { userId: targetUser.id }, transaction });
      const actorIsAdmin = existing.some((item) => item.roleId === existingAdmin?.id);
      if (Number(req.user.id) === Number(targetUser.id) && actorIsAdmin && !assignmentHasAdmin(req.body.assignments)) {
        await auditDenied(req, 'ASSIGN_USER_ROLE', `user:${targetUser.id}`, { reason: 'users cannot remove their own Administrator role' });
        const error = new Error('You cannot remove your own Administrator access.');
        error.status = 403;
        throw error;
      }
      if (existingAdmin && existing.some((item) => item.roleId === existingAdmin.id) && !assignmentHasAdmin(req.body.assignments)) {
        const assignments = await UserRole.findAll({
          where: { roleId: existingAdmin.id },
          attributes: ['userId'],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const adminUsers = new Set(assignments.map((item) => Number(item.userId)));
        const protectionError = getAdministratorAssignmentError({
          actorId: req.user.id,
          targetUserId: targetUser.id,
          wasAdministrator: true,
          willBeAdministrator: false,
          activeAdministratorCount: adminUsers.size,
        });
        if (protectionError) {
          await auditDenied(req, 'ASSIGN_USER_ROLE', `user:${targetUser.id}`, { reason: protectionError.reason });
          const error = new Error(protectionError.message);
          error.status = protectionError.status;
          throw error;
        }
      }
      await UserRole.destroy({ where: { userId: targetUser.id }, transaction });
      if (req.body.assignments.length) {
        await UserRole.bulkCreate(req.body.assignments.map((item) => ({
          userId: targetUser.id,
          roleId: Number(item.roleId),
          scopeType: item.scopeType,
          scopeId: item.scopeType === 'system' || item.scopeType === 'own' ? null : Number(item.scopeId),
        })), { transaction });
      }
      const primaryRoleId = req.body.assignments.length ? Number(req.body.assignments[0].roleId) : null;
      const primaryRole = primaryRoleId ? roles.find((role) => role.id === primaryRoleId) : null;
      const nextLegacyRole = primaryRole && ROLE_NAMES.includes(primaryRole.name)
        ? primaryRole.name
        : 'student';
      if (targetUser.role !== nextLegacyRole) {
        await targetUser.update({ role: nextLegacyRole }, { transaction });
      }
      await auditChange(req, 'ASSIGN_USER_ROLE', `user:${targetUser.id}`, existing, req.body.assignments, transaction);
    });
    return res.json({ success: true, message: 'User roles updated.' });
  } catch (error) { return next(error); }
});

module.exports = router;
