const { Op } = require('sequelize');
const { Permission, RolePermission, Role, UserRole } = require('../models');
const { createAuditLog } = require('../services/auditLogService');

const SCOPES = new Set(['system', 'college', 'department', 'store', 'location', 'own']);
const HIGH_RISK_ACTIONS = new Set(['delete', 'approve', 'transfer', 'configure']);

const getEffectiveUserRoles = async (user) => {
  const assignments = await UserRole.findAll({
    where: { userId: user.id },
    include: [{
      model: Role,
      required: true,
      where: { active: true },
      through: { attributes: ['scopeType', 'scopeId'] },
    }],
  });
  if (assignments.length) {
    return assignments.map((assignment) => ({
      role: assignment.Role,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
    }));
  }

  const legacyRole = await Role.findOne({ where: { name: String(user.role || '').toLowerCase(), active: true } });
  return legacyRole ? [{ role: legacyRole, scopeType: 'system', scopeId: null }] : [];
};

const matchesAssignmentScope = (assignment, grant, target, userId) => {
  const grantScope = grant.scopeType;
  const assignmentScope = assignment.scopeType;
  const targetScopes = target?.scopes || {};

  if (grantScope === 'own') {
    return Number(target?.ownerId) === Number(userId);
  }
  if (assignmentScope === 'own') return Number(target?.ownerId) === Number(userId);
  if (grantScope === 'system' && !grant.limited) {
    if (assignmentScope === 'system') return true;
    const assignedTargetId = targetScopes[assignmentScope];
    return assignedTargetId !== undefined
      && assignedTargetId !== null
      && Number(assignment.scopeId) === Number(assignedTargetId);
  }
  const targetScopeId = targetScopes[grantScope];
  if (targetScopeId === undefined || targetScopeId === null) return false;
  if (assignmentScope === 'system') return true;
  return assignmentScope === grantScope && Number(assignment.scopeId) === Number(targetScopeId);
};

const getDatabasePermissionKeys = async (user) => {
  const roles = await getEffectiveUserRoles(user);
  if (!roles.length) return [];
  const grants = await RolePermission.findAll({
    where: { roleId: { [Op.in]: roles.map(({ role }) => role.id) } },
    include: [{ model: Permission, required: true }],
  });
  return grants
    .filter((grant) => {
      const assignment = roles.find(({ role }) => role.id === grant.roleId);
      return assignment && (grant.scopeType === 'system' && !grant.limited
        || assignment.scopeType === 'system'
        || assignment.scopeType === grant.scopeType);
    })
    .map((grant) => grant.Permission.key);
};

const authorize = (permissionKey, options = {}) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const [moduleName, ...actionParts] = String(permissionKey || '').split('.');
  const action = actionParts[actionParts.length - 1] || '';
  if (!moduleName || !action || (HIGH_RISK_ACTIONS.has(action) && permissionKey === '*')) {
    return res.status(403).json({ success: false, message: 'An explicit permission is required.' });
  }

  try {
    const permission = await Permission.findOne({ where: { key: permissionKey } });
    const target = typeof options.resolveTarget === 'function' ? await options.resolveTarget(req) : null;
    const roles = await getEffectiveUserRoles(req.user);
    let allowed = false;

    if (permission) {
      const roleIds = roles.map(({ role }) => role.id);
      if (roleIds.length) {
        const grants = await RolePermission.findAll({
          where: { roleId: { [Op.in]: roleIds }, permissionId: permission.id },
        });
        allowed = grants.some((grant) => {
          const assignment = roles.find(({ role }) => role.id === grant.roleId);
          return assignment && matchesAssignmentScope(assignment, grant, target, req.user.id);
        });
      }
    }

    await (options.audit || createAuditLog)({
      userId: req.user.id,
      role: req.user.role,
      action: 'AUTHORIZE_PERMISSION',
      entity: `permission:${permissionKey}`,
      details: { result: allowed ? 'success' : 'denied', method: req.method, path: req.originalUrl, target },
    });

    if (!allowed) {
      return res.status(403).json({ success: false, message: `You do not have permission to ${action} ${moduleName}.` });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { authorize, matchesAssignmentScope, getDatabasePermissionKeys };
