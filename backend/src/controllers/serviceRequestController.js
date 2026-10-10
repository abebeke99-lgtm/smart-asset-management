const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  ServiceRequest,
  RequestAttachment,
  RequestStatusHistory,
  Feedback,
  Asset,
  Room,
  User,
  Department,
  College,
  Role,
  SupportTicketComment,
} = require('../models');
const { createBulkNotification } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');
const { getEscalationHours, runServiceRequestEscalation } = require('../services/serviceRequestEscalationService');
const { normalizeRoleForStorage } = require('../constants/rolePermissions');

const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_UNACKNOWLEDGED_TICKETS = 10;
const VALID_STATUSES = ['submitted', 'scheduled', 'in-progress', 'completed', 'cancelled', 'escalated'];
const STATUS_LABELS = {
  submitted: 'Submitted',
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  escalated: 'Escalated',
};
const isPositiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

const isDepartmentHead = (req) => String(req.user?.role || '').toLowerCase() === 'department_head';
const departmentScopeId = (req) => {
  const value = req.organizationScope?.departmentId ?? req.user?.departmentId ?? req.user?.department_id;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const PROCESSING_REQUEST_ROLES = ['maintenance', 'ict_officer', 'infrastructure'];
const COLLEGE_REQUEST_ROLES = ['college', 'college_manager'];
const collegeScopeId = (req) => {
  const value = req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const applyServiceRequestScope = (where, req) => {
  const role = normalizeRoleForStorage(req.user?.role);
  if (role === 'admin') return true;
  if (PROCESSING_REQUEST_ROLES.includes(role)) {
    const legacyRoute = { maintenance: 'maintenance', ict_officer: 'ictd', infrastructure: 'gs_facilities' }[role];
    where[Op.and] = [...(where[Op.and] || []), {
      [Op.or]: [
        { responsibleRole: role },
        { assignedTo: req.user.id },
        { reportedBy: req.user.id },
        { responsibleRole: null, routedTo: legacyRoute },
      ],
    }];
    return true;
  }
  if (role === 'department_head') {
    const scopeId = departmentScopeId(req);
    if (!scopeId) return false;
    where.departmentId = scopeId;
    return true;
  }
  if (COLLEGE_REQUEST_ROLES.includes(role)) {
    const scopeId = collegeScopeId(req);
    if (!scopeId) return false;
    where.collegeId = scopeId;
    return true;
  }
  where[Op.and] = [...(where[Op.and] || []), {
    [Op.or]: [
      { reportedBy: req.user.id },
      { assignedTo: req.user.id },
      ...(role ? [{ responsibleRole: role }] : []),
    ],
  }];
  return true;
};
const scopeErrorMessage = (req) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'department_head') return 'Department scope is not configured for this account';
  if (COLLEGE_REQUEST_ROLES.includes(role)) return 'College scope is not configured for this account';
  return 'Scope is not configured for this account';
};

const ROUTING_BY_CATEGORY = [
  { pattern: 'network', subscribe: /(network|router|switch|firewall|wireless|access point)/i, route: 'ictd' },
  { pattern: 'ict', subscribe: /(computer|laptop|ict|server|monitor|printer|scanner|projector|workstation|desktop|processor|cpu)/i, route: 'ictd' },
  { pattern: 'facility', subscribe: /(building|facility|electrical|electric|generator|transformer|ups|water|plumb|paint|furniture|door|window|air condition|pump)/i, route: 'gs_facilities' },
];
const DEFAULT_ROUTE = 'maintenance';
const ROUTE_LABELS = { ictd: 'ICTD / Network', gs_facilities: 'GS / Facilities', maintenance: 'Maintenance' };
const RESPONSIBLE_ROLE_RULES = [
  { pattern: /(network|router|switch|firewall|wireless|access point|computer|laptop|ict|server|monitor|printer|scanner|projector|workstation|desktop|processor|cpu)/i, roles: ['ict_officer'] },
  { pattern: /(inventory|stock|issue|issuance|store|suppl(?:y|ies))/i, roles: ['store_manager'] },
  { pattern: /(financial|finance|payment|invoice|budget|cost)/i, roles: ['finance'] },
  { pattern: /(department|departmental)/i, roles: ['department_head'] },
  { pattern: /(college)/i, roles: ['college_manager'] },
  { pattern: /(system administration|administrator|security administration)/i, roles: ['admin'], adminOnly: true },
  { pattern: /(building|facility|facilities|electrical|electric|generator|transformer|ups|water|plumb|paint|furniture|door|window|air condition|pump)/i, roles: ['infrastructure', 'maintenance'] },
  { pattern: /(maintenance|repair|equipment)/i, roles: ['maintenance'] },
];
const RESPONSIBLE_ROLE_LABELS = {
  admin: 'Administrator',
  ict_officer: 'ICT Officer',
  college_manager: 'College Manager',
  department_head: 'Department Head',
  finance: 'Finance',
  store_manager: 'Store Manager',
  maintenance: 'Maintenance Coordinator',
  infrastructure: 'Infrastructure / Facilities',
};

const routeRequest = (requestType, category, assetCategory) => {
  const haystack = [category, assetCategory, requestType].filter(Boolean).join(' ');
  const match = ROUTING_BY_CATEGORY.find((rule) => rule.subscribe.test(haystack));
  if (match) return match.route;
  return DEFAULT_ROUTE;
};

const getResponsibleRoleNames = (requestType, category, assetCategory, requesterRole) => {
  const haystack = [category, assetCategory, requestType].filter(Boolean).join(' ');
  const rule = RESPONSIBLE_ROLE_RULES.find((candidate) => candidate.pattern.test(haystack));
  if (rule?.adminOnly && normalizeRoleForStorage(requesterRole) !== 'admin') return [];
  return rule?.roles || ['maintenance'];
};

const getActiveResponsibleRoles = async (requestType, category, assetCategory, requesterRole) => {
  const names = getResponsibleRoleNames(requestType, category, assetCategory, requesterRole);
  if (!names.length) return [];
  const roles = await Role.findAll({
    where: { active: true, name: { [Op.in]: names } },
    attributes: ['id', 'name', 'displayName', 'description'],
    order: [['displayName', 'ASC']],
  });
  const byName = new Map(roles.map((role) => [normalizeRoleForStorage(role.name), role]));
  return names.map((name) => byName.get(name)).filter(Boolean);
};

const userRoleValues = (role) => role === 'college_manager' ? ['college_manager', 'college'] : [role];

const requestOrganizationScope = (req) => ({
  departmentId: Number(req.organizationScope?.departmentId ?? req.user?.departmentId ?? req.user?.department_id) || null,
  collegeId: Number(req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id) || null,
});

const isRequestInUserOrganization = (request, req) => {
  const role = normalizeRoleForStorage(req.user?.role);
  const scope = requestOrganizationScope(req);
  if (role === 'department_head') return Boolean(scope.departmentId && Number(request.departmentId) === scope.departmentId);
  if (role === 'college_manager' || role === 'college') return Boolean(scope.collegeId && Number(request.collegeId) === scope.collegeId);
  if (scope.departmentId && request.departmentId && Number(request.departmentId) !== scope.departmentId) return false;
  if (scope.collegeId && request.collegeId && Number(request.collegeId) !== scope.collegeId) return false;
  return true;
};

const canManageServiceRequest = (request, req) => {
  const role = normalizeRoleForStorage(req.user?.role);
  if (role === 'admin') return true;
  if (!isRequestInUserOrganization(request, req)) return false;
  if (PROCESSING_REQUEST_ROLES.includes(role)) {
    const legacyRoute = { maintenance: 'maintenance', ict_officer: 'ictd', infrastructure: 'gs_facilities' }[role];
    return normalizeRoleForStorage(request.responsibleRole) === role
      || (!request.responsibleRole && request.routedTo === legacyRoute)
      || Number(request.assignedTo) === Number(req.user?.id);
  }
  return normalizeRoleForStorage(request.responsibleRole) === role
    || Number(request.assignedTo) === Number(req.user?.id);
};

const isAssigneeInServiceRequestScope = (assignee, request) => {
  const requestDepartmentId = Number(request.departmentId) || null;
  const requestCollegeId = Number(request.collegeId) || null;
  const assigneeDepartmentId = Number(assignee.departmentId ?? assignee.department_id) || null;
  const assigneeCollegeId = Number(assignee.collegeId ?? assignee.college_id) || null;
  if (requestDepartmentId && requestDepartmentId !== assigneeDepartmentId) return false;
  if (requestCollegeId && requestCollegeId !== assigneeCollegeId) return false;
  return true;
};

const isAssigneeInRequestScope = (assignee, req) => {
  if (normalizeRoleForStorage(req.user?.role) === 'admin') return true;
  const scope = requestOrganizationScope(req);
  if (scope.departmentId && Number(assignee.departmentId ?? assignee.department_id) !== scope.departmentId) return false;
  if (scope.collegeId && Number(assignee.collegeId ?? assignee.college_id) !== scope.collegeId) return false;
  return true;
};

const requestCapabilities = (request, req) => ({
  can_process: canManageServiceRequest(request, req),
  can_cancel: canManageServiceRequest(request, req)
    || (Number(request.reportedBy) === Number(req.user?.id)
      && ['submitted', 'scheduled', 'in-progress'].includes(request.status)),
});

const uniqueRef = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 90) + 10)}`;

const ensureUploadDir = (subdir) => {
  const target = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', subdir);
  fs.mkdirSync(target, { recursive: true });
  return target;
};

const saveAttachment = ({ fileName = '', mimeType = '', data = '' }) => {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_ATTACHMENT_TYPES.includes(mime)) {
    const error = new Error(`Unsupported photo type: ${mime || 'unknown'}. Allowed: JPG, JPEG, PNG, WEBP`);
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_SIZE) {
    const error = new Error('Photo is empty or exceeds the 5 MB limit');
    error.statusCode = 400;
    throw error;
  }
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const storedName = `${Date.now()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}.${ext}`;
  const dir = ensureUploadDir('requests');
  fs.writeFileSync(path.join(dir, storedName), buffer);
  return { originalName: String(fileName || storedName), storedName, mimeType: mime, fileSize: buffer.length, filePath: path.posix.join('uploads', 'requests', storedName) };
};

const serializeRequest = (item) => {
  const data = item.toJSON();
  return {
    ...data,
    status_label: STATUS_LABELS[data.status] || data.status,
    routed_to_label: ROUTE_LABELS[data.routedTo] || data.routedTo,
    responsible_role: data.responsibleRole || null,
    responsible_role_label: RESPONSIBLE_ROLE_LABELS[data.responsibleRole] || data.responsibleRole || null,
    reporter_name: item.Reporter?.fullName || item.Reporter?.username || null,
    assignee_name: item.Assignee?.fullName || item.Assignee?.username || null,
    asset_name: item.Asset?.name || null,
    asset_code: item.Asset?.assetCode || null,
    reported_by: data.reportedBy,
    assigned_to: data.assignedTo,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
};

const defaultInclude = () => [
  { model: User, as: 'Reporter', attributes: ['id', 'username', 'fullName', 'department'] },
  { model: User, as: 'Assignee', attributes: ['id', 'username', 'fullName', 'department'] },
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'serialNumber'] },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] },
  { model: College, as: 'CollegeRecord', attributes: ['id', 'collegeName', 'collegeCode'] },
  { model: RequestAttachment, attributes: ['id', 'originalName', 'mimeType', 'filePath', 'attachmentType', 'fileSize', 'createdAt'] },
  { model: RequestStatusHistory, order: [['createdAt', 'DESC']], limit: 50 },
];

const verifyTicketLimit = async (departmentId, transaction, priority = 'medium') => {
  if (!departmentId) return 0;
  if (transaction) {
    await Department.findByPk(departmentId, {
      attributes: ['id'],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }
  const unacknowledgedTickets = await ServiceRequest.count({
    where: {
      departmentId,
      status: { [Op.in]: ['submitted', 'scheduled', 'in-progress', 'escalated'] },
      acknowledgedAt: null,
    },
    transaction,
  });
  if (unacknowledgedTickets > MAX_UNACKNOWLEDGED_TICKETS && !['high', 'critical'].includes(priority)) {
    const error = new Error(`New normal service requests are temporarily blocked. This department has ${unacknowledgedTickets} unacknowledged tickets. Please resolve or acknowledge existing tickets first.`);
    error.statusCode = 409;
    throw error;
  }
  return unacknowledgedTickets;
};

const createServiceRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const isAdmin = normalizeRoleForStorage(req.user.role) === 'admin';
    const scopedDepartmentId = isDepartmentHead(req) ? departmentScopeId(req) : null;
    if (isDepartmentHead(req) && !scopedDepartmentId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    const requestedDepartmentId = req.body.departmentId ?? req.body.department_id;
    const userDepartmentId = Number(req.organizationScope?.departmentId ?? req.user.departmentId ?? req.user.department_id) || null;
    if (!isAdmin && requestedDepartmentId != null
      && (!userDepartmentId || Number(requestedDepartmentId) !== userDepartmentId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Cannot create a service request for another department' });
    }
    const scopedCollegeId = Number(req.organizationScope?.collegeId ?? req.user.collegeId ?? req.user.college_id) || null;
    const requestedCollegeId = req.body.collegeId ?? req.body.college_id;
    if (!isAdmin && requestedCollegeId != null
      && (!scopedCollegeId || Number(requestedCollegeId) !== scopedCollegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Cannot create a service request for another college' });
    }
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || req.body.problem || '').trim();
    const justification = String(req.body.justification || req.body.justification_text || '').trim();
    if (!title) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Request title is required' }); }
    if (!description) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Request description is required' }); }
    if (!justification) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A justification is required for every service request' }); }
    const requestType = String(req.body.requestType || req.body.request_type || 'maintenance').toLowerCase();
    if (!['maintenance', 'facility', 'ict', 'general'].includes(requestType)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid request type' }); }
    const priority = String(req.body.priority || 'medium').toLowerCase();
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid priority' }); }
    const requestedRoleId = req.body.responsibleRoleId ?? req.body.responsible_role_id ?? null;
    const requestedRoleName = req.body.responsibleRole ?? req.body.responsible_role ?? '';
    const eligibleRoles = await getActiveResponsibleRoles(requestType, req.body.category || '', '', req.user.role);
    if (!eligibleRoles.length) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'No active responsible role is available for this request category' });
    }
    let responsibleRole = null;
    if (requestedRoleId != null && requestedRoleId !== '') {
      const roleId = Number(requestedRoleId);
      if (!Number.isSafeInteger(roleId) || roleId < 1) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'A valid responsible role ID is required' });
      }
      responsibleRole = await Role.findOne({ where: { id: roleId, active: true }, transaction });
      if (!responsibleRole) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Responsible role was not found or is inactive' });
      }
      if (!eligibleRoles.some((role) => Number(role.id) === roleId)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'This role is not authorized for the selected request category' });
      }
    } else if (requestedRoleName) {
      const roleName = normalizeRoleForStorage(requestedRoleName);
      responsibleRole = eligibleRoles.find((role) => normalizeRoleForStorage(role.name) === roleName) || null;
      if (!responsibleRole) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'This role is not authorized for the selected request category' });
      }
    } else {
      [responsibleRole] = eligibleRoles;
    }
    const assignedToValue = req.body.assignedTo ?? req.body.assigned_to ?? '';
    let assignee = null;
    if (assignedToValue !== '') {
      const assigneeId = Number(assignedToValue);
      if (!Number.isSafeInteger(assigneeId) || assigneeId < 1) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'A valid responsible user ID is required' });
      }
      assignee = await User.findOne({
        where: { id: assigneeId, active: true, status: 'active', role: { [Op.in]: userRoleValues(normalizeRoleForStorage(responsibleRole.name)) } },
        attributes: ['id', 'role', 'departmentId', 'collegeId'],
        transaction,
      });
      if (!assignee) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Responsible user was not found, is inactive, or does not have the selected role' });
      }
      if (!isAssigneeInRequestScope(assignee, req)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Cannot assign this request to a user outside your organization' });
      }
    }
    const assetId = req.body.assetId || req.body.asset_id || null;
    if (assetId && (!Number.isSafeInteger(Number(assetId)) || Number(assetId) < 1)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid asset ID is required' });
    }
    const requestedLaboratoryId = req.body.laboratoryId ?? req.body.laboratory_id ?? null;
    let asset = null;
    if (assetId) {
      asset = await Asset.findByPk(assetId, { transaction });
      if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
      const userScope = requestOrganizationScope(req);
      if (userScope.departmentId && Number(asset.departmentId ?? asset.department_id) !== userScope.departmentId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Cannot create a service request for an asset outside your department' });
      }
      if (userScope.collegeId && Number(asset.collegeId ?? asset.college_id) !== userScope.collegeId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Cannot create a service request for an asset outside your college' });
      }
    }
    const hasExplicitLaboratory = requestedLaboratoryId !== null && requestedLaboratoryId !== '';
    let laboratoryId = !hasExplicitLaboratory
      ? null
      : Number(requestedLaboratoryId);
    if (laboratoryId !== null && (!Number.isSafeInteger(laboratoryId) || laboratoryId < 1)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid laboratory is required' });
    }
    if (laboratoryId && scopedDepartmentId) {
      const laboratory = await Room.findOne({
        where: {
          id: laboratoryId,
          departmentId: scopedDepartmentId,
          roomType: { [Op.like]: '%lab%' },
        },
        attributes: ['id'],
        transaction,
      });
      if (!laboratory) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Laboratory not found in your department' });
      }
    } else if (!hasExplicitLaboratory && scopedDepartmentId && asset) {
      let specifications = asset.specifications;
      if (typeof specifications === 'string') {
        specifications = JSON.parse(specifications || '{}');
      }
      const candidateLaboratoryIds = [...new Set([
        asset.roomId,
        specifications?.laboratoryId,
      ].map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
      if (candidateLaboratoryIds.length) {
        const assetLaboratory = await Room.findOne({
          where: {
            id: { [Op.in]: candidateLaboratoryIds },
            departmentId: scopedDepartmentId,
            roomType: { [Op.like]: '%lab%' },
          },
          attributes: ['id'],
          transaction,
        });
        laboratoryId = assetLaboratory?.id || null;
      }
    }
    const departmentValue = scopedDepartmentId || req.user.departmentId || req.user.department_id
      || (isAdmin ? req.body.departmentId || req.body.department_id : null) || null;
    const departmentId = departmentValue == null ? null : Number(departmentValue);
    if (departmentId !== null && (!Number.isSafeInteger(departmentId) || departmentId < 1)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid department ID is required' });
    }
    const department = departmentId
      ? await Department.findByPk(departmentId, { attributes: ['id', 'collegeId'], transaction })
      : null;
    if (departmentId && !department) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    if (!isAdmin && department?.collegeId && scopedCollegeId && Number(department.collegeId) !== scopedCollegeId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Cannot create a service request outside your college' });
    }
    const collegeValue = isAdmin ? req.body.collegeId || req.body.college_id || department?.collegeId : department?.collegeId || scopedCollegeId;
    const collegeId = collegeValue == null ? null : Number(collegeValue);
    if (collegeId !== null && (!Number.isSafeInteger(collegeId) || collegeId < 1)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid college ID is required' });
    }
    if (collegeId) {
      const college = await College.findByPk(collegeId, { attributes: ['id'], transaction });
      if (!college) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'College not found' });
      }
      if (department?.collegeId && Number(department.collegeId) !== collegeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'The selected department does not belong to the selected college' });
      }
    }
    await verifyTicketLimit(departmentId, transaction, priority);

    const routedTo = routeRequest(requestType, req.body.category || '', asset?.category || '');
    const request = await ServiceRequest.create({
      requestCode: uniqueRef('SR'),
      title,
      description,
      justification,
      requestType,
      category: req.body.category || asset?.category || '',
      assetId: asset ? asset.id : null,
      laboratoryId,
      priority,
      status: 'submitted',
      routedTo,
      responsibleRole: normalizeRoleForStorage(responsibleRole.name),
      assignedTo: assignee?.id || null,
      reportedBy: req.user.id,
      departmentId,
      collegeId,
    }, { transaction });
    await RequestStatusHistory.create({ requestId: request.id, previousStatus: null, newStatus: 'submitted', changedBy: req.user.id, comment: 'Request submitted' }, { transaction });

    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
    for (const attachment of attachments) {
      const saved = saveAttachment(attachment);
      await RequestAttachment.create({ requestId: request.id, ...saved, attachmentType: attachment.attachmentType || attachment.attachment_type || 'photo', uploadedBy: req.user.id }, { transaction });
    }
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'SERVICE_REQUEST_CREATED',
      entity: `service_request:${request.id}`,
      entityId: request.id,
      newValue: { requestCode: request.requestCode, departmentId, laboratoryId, assetId: request.assetId, status: request.status },
      transaction,
    });
    await transaction.commit();

    let notificationStatus = 'sent';
    try {
      await createBulkNotification({
        recipientType: assignee ? 'users' : 'role',
        ...(assignee
          ? { userIds: [assignee.id] }
          : { roles: [normalizeRoleForStorage(responsibleRole.name)] }),
        title: `New service request ${request.requestCode}`,
        message: `${request.title} · ${request.category || request.requestType} · ${request.priority} priority`,
        type: 'maintenance',
        priority: request.priority === 'critical' || request.priority === 'high' ? 'high' : 'medium',
        channel: 'in_app',
        eventKey: `service_request_created:${request.id}`,
        entityType: 'service_request',
        entityId: request.id,
        actionUrl: '/department-head/service-requests',
      }, req.user.id);
    } catch (notificationError) {
      notificationStatus = 'failed';
      console.error(`Service request notification failed for request ${request.id}:`, notificationError.stack || notificationError);
    }
    res.status(201).json({
      success: true,
      data: serializeRequest(request),
      request: serializeRequest(request),
      routedTo,
      routed_to_label: ROUTE_LABELS[routedTo],
      notificationStatus,
      ...(notificationStatus === 'failed' ? { warning: 'Request was saved, but the responsible role notification could not be delivered.' } : {}),
    });
  } catch (error) {
    await transaction.rollback();
    if (error.statusCode === 409) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

const listServiceRequests = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const where = {};
    if (!applyServiceRequestScope(where, req)) {
      return res.status(403).json({ success: false, message: scopeErrorMessage(req) });
    }
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.routed_to || req.query.routedTo) where.routedTo = req.query.routed_to || req.query.routedTo;
    if (req.query.request_type || req.query.requestType) where.requestType = req.query.request_type || req.query.requestType;
    if (req.query.asset_id || req.query.assetId) where.assetId = req.query.asset_id || req.query.assetId;
    if (!isDepartmentHead(req) && (req.query.department_id || req.query.departmentId)) where.departmentId = req.query.department_id || req.query.departmentId;
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
    if (req.query.assigned_to || req.query.assignedTo) where.assignedTo = req.query.assigned_to || req.query.assignedTo;
    if (req.query.my === 'true') where.reportedBy = req.user.id;
    if (req.query.scope === 'assignee' && ['maintenance', 'ict_officer', 'infrastructure'].includes(req.user.role)) where.assignedTo = req.user.id;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { requestCode: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
      ];
    }
    const statusCounts = await ServiceRequest.findAll({ where, attributes: ['status'], raw: true });
    const summary = statusCounts.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, { total: statusCounts.length });
    const { count, rows } = await ServiceRequest.findAndCountAll({ where, include: defaultInclude(), order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit, distinct: true });
    const data = rows.map((item) => ({ ...serializeRequest(item), ...requestCapabilities(item, req) }));
    res.json({ success: true, data, requests: data, total: count, summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getServiceRequest = async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ success: false, message: 'A valid service request ID is required' });
    const where = { id: req.params.id };
    if (!applyServiceRequestScope(where, req)) {
      return res.status(403).json({ success: false, message: scopeErrorMessage(req) });
    }
    const item = await ServiceRequest.findOne({ where, include: defaultInclude() });
    if (!item) return res.status(404).json({ success: false, message: 'Service request not found' });
    const feedback = await Feedback.findOne({ where: { requestId: item.id } });
    const data = { ...serializeRequest(item), ...requestCapabilities(item, req) };
    res.json({ success: true, data, request: data, feedback });
  } catch (error) { next(error); }
};

const transitionStatus = async (req, res, next, applyToBody) => {
  const transaction = await sequelize.transaction();
  try {
    if (applyToBody) applyToBody(req.body);
    if (!isPositiveInteger(req.params.id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid service request ID is required' });
    }
    const where = { id: req.params.id };
    if (isDepartmentHead(req)) {
      const scopeId = departmentScopeId(req);
      if (!scopeId) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' }); }
      where.departmentId = scopeId;
    }
    const item = await ServiceRequest.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Service request not found' }); }
    const status = String(req.body.status || '').toLowerCase();
    if (!VALID_STATUSES.includes(status)) { await transaction.rollback(); return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` }); }
    const isRequesterCancellation = status === 'cancelled' && Number(item.reportedBy) === Number(req.user.id);
    if (!canManageServiceRequest(item, req) && !isRequesterCancellation) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'You are not authorized to process this service request' });
    }
    const allowedFrom = { submitted: ['scheduled', 'in-progress', 'cancelled'], scheduled: ['in-progress', 'cancelled'], 'in-progress': ['completed', 'cancelled'], completed: [], cancelled: [], escalated: ['scheduled', 'in-progress', 'completed'] };
    if (!allowedFrom[item.status]?.includes(status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid transition from ${STATUS_LABELS[item.status]} to ${STATUS_LABELS[status]}` }); }
    const previousStatus = item.status;
    const updates = { status };
    if (status === 'scheduled') updates.scheduledDate = req.body.scheduledDate || req.body.scheduled_date || item.scheduledDate || new Date();
    if (status === 'in-progress') updates.startedAt = req.body.startedAt || req.body.started_at || item.startedAt || new Date();
    if (status === 'completed') updates.completedAt = req.body.completedAt || req.body.completed_at || new Date();
    if (status === 'completed' && req.body.resolution != null) updates.resolution = String(req.body.resolution);
    if (status === 'cancelled') updates.cancelledReason = String(req.body.cancelledReason || req.body.cancelled_reason || req.body.reason || '');
    await RequestStatusHistory.create({ requestId: item.id, previousStatus, newStatus: status, changedBy: req.user.id, comment: req.body.comment || req.body.notes || '' }, { transaction });
    await item.update(updates, { transaction });
    await transaction.commit();
    if (['scheduled', 'cancelled', 'completed'].includes(status)) {
      try {
        await createBulkNotification({
          recipientType: 'users',
          userIds: [item.reportedBy],
          title: `Service request ${STATUS_LABELS[status].toLowerCase()}`,
          message: `Service request ${item.requestCode} (${item.title}) is now ${STATUS_LABELS[status].toLowerCase()}.`,
          type: 'maintenance',
          priority: 'medium',
          channel: 'in_app',
          eventKey: `service_request_status:${item.id}:${status}`,
          entityType: 'service_request',
          entityId: item.id,
          actionUrl: '/department-head/service-requests',
        }, req.user.id);
      } catch (notificationError) {
        console.error(`Service request status notification failed for request ${item.id}:`, notificationError.stack || notificationError);
      }
    }
    res.json({ success: true, data: serializeRequest(await ServiceRequest.findByPk(item.id, { include: defaultInclude() })) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const setStatus = (req, res, next) => transitionStatus(req, res, next, (body) => {
  body.status = String(req.body.status || req.query.status || '').toLowerCase();
});

const acknowledge = (req, res, next) => transitionStatus(req, res, next, (body) => {
  body.status = 'scheduled';
  body.scheduledDate = new Date();
  body.comment = body.comment || 'Request acknowledged by service unit';
});
const start = (req, res, next) => transitionStatus(req, res, next, (body) => { body.status = 'in-progress'; body.startedAt = new Date(); });
const complete = (req, res, next) => transitionStatus(req, res, next, (body) => {
  body.status = 'completed';
  body.completedAt = new Date();
  body.resolution = req.body.resolution || '';
});
const cancel = (req, res, next) => transitionStatus(req, res, next, (body) => { body.status = 'cancelled'; body.cancelledReason = body.cancelledReason || body.reason || ''; });

const acknowledgeTicket = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!isPositiveInteger(req.params.id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid service request ID is required' });
    }
    const item = await ServiceRequest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Service request not found' }); }
    if (!canManageServiceRequest(item, req)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'You are not authorized to acknowledge this service request' });
    }
    if (!['submitted', 'escalated'].includes(item.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only submitted or escalated requests can be acknowledged' }); }
    await item.update({ acknowledgedAt: new Date(), status: 'scheduled', scheduledDate: new Date() }, { transaction });
    await RequestStatusHistory.create({ requestId: item.id, previousStatus: item.status, newStatus: 'scheduled', changedBy: req.user.id, comment: 'Acknowledged by service unit' }, { transaction });
    await transaction.commit();
    try {
      await createBulkNotification({
        recipientType: 'users',
        userIds: [item.reportedBy],
        title: `Service request ${STATUS_LABELS.scheduled.toLowerCase()}`,
        message: `Service request ${item.requestCode} (${item.title}) is now ${STATUS_LABELS.scheduled.toLowerCase()}.`,
        type: 'maintenance',
        priority: 'medium',
        channel: 'in_app',
        eventKey: `service_request_status:${item.id}:scheduled`,
        entityType: 'service_request',
        entityId: item.id,
        actionUrl: '/department-head/service-requests',
      }, req.user.id);
    } catch (notificationError) {
      console.error(`Service request acknowledgement notification failed for request ${item.id}:`, notificationError.stack || notificationError);
    }
    res.json({ success: true, data: serializeRequest(await ServiceRequest.findByPk(item.id, { include: defaultInclude() })) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const assignTicket = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!isPositiveInteger(req.params.id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid service request ID is required' });
    }
    const item = await ServiceRequest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }
    if (!canManageServiceRequest(item, req)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'You are not authorized to assign this service request' });
    }
    const assigneeId = Number(req.body.assignedTo || req.body.assigned_to || req.body.technician_id);
    if (!Number.isSafeInteger(assigneeId) || assigneeId < 1) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'A valid user id is required' });
    }
    const assignee = await User.findByPk(assigneeId, { transaction });
    if (!assignee || !assignee.active) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Assignee user not found or inactive' });
    }
    const existingRole = normalizeRoleForStorage(item.responsibleRole);
    const eligibleRoleNames = getResponsibleRoleNames(item.requestType, item.category, '', req.user.role);
    if ((existingRole && normalizeRoleForStorage(assignee.role) !== existingRole)
      || (!existingRole && !eligibleRoleNames.includes(normalizeRoleForStorage(assignee.role)))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Assignee does not have the responsible role for this request' });
    }
    if (!isAssigneeInServiceRequestScope(assignee, item)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Cannot assign this request outside its organization scope' });
    }
    const responsibleRole = existingRole || normalizeRoleForStorage(assignee.role);
    const previousAssignedTo = item.assignedTo;
    const previousResponsibleRole = item.responsibleRole;
    await item.update({ assignedTo: assigneeId, responsibleRole }, { transaction });
    await RequestStatusHistory.create({ requestId: item.id, previousStatus: item.status, newStatus: item.status, changedBy: req.user.id, comment: `Assigned to ${assignee.fullName || assignee.username}` }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'SERVICE_REQUEST_ASSIGNED',
      entity: `service_request:${item.id}`,
      entityId: item.id,
      oldValue: { assignedTo: previousAssignedTo, responsibleRole: previousResponsibleRole },
      newValue: { assignedTo: assigneeId, responsibleRole },
      transaction,
    });
    await transaction.commit();
    try {
      await createBulkNotification({
        recipientType: 'users',
        userIds: [assigneeId],
        title: 'Service request assigned',
        message: `${item.requestCode}: ${item.title} (${item.category || item.requestType}, ${item.priority} priority).`,
        type: 'assignment',
        priority: item.priority === 'critical' ? 'urgent' : 'high',
        channel: 'in_app',
        eventKey: `service_request_assigned:${item.id}:${assigneeId}`,
        entityType: 'service_request',
        entityId: item.id,
        actionUrl: '/department-head/service-requests',
      }, req.user.id);
    } catch (notificationError) {
      console.error(`Service request assignment notification failed for request ${item.id}:`, notificationError.stack || notificationError);
    }
    res.json({ success: true, data: serializeRequest(await ServiceRequest.findByPk(item.id, { include: defaultInclude() })) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const escalateTickets = async (req, res, next) => {
  try {
    const result = await runServiceRequestEscalation();
    const escalated = result.escalated;
    return res.json({
      success: true,
      escalated: escalated.map((item) => serializeRequest(item)),
      escalatedCount: escalated.length,
      notificationFailures: result.notificationFailures,
      message: escalated.length ? `${escalated.length} ticket(s) escalated` : 'No unacknowledged tickets exceeded the escalation window',
    });
  } catch (error) { next(error); }
};

const listFeedback = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.request_id) where.requestId = req.query.request_id;
    const role = normalizeRoleForStorage(req.user?.role);
    const include = [{ model: User, as: 'Submitter', attributes: ['id', 'username', 'fullName'] }];
    if (role !== 'admin') {
      if (!['department_head', 'college_manager', 'college', 'maintenance', 'ict_officer', 'infrastructure', 'finance', 'store_manager'].includes(role)) {
        where.submittedBy = req.user.id;
      }
      const requestWhere = {};
      if (!applyServiceRequestScope(requestWhere, req)) {
        return res.status(403).json({ success: false, message: scopeErrorMessage(req) });
      }
      include.push({ model: ServiceRequest, required: true, attributes: [], where: requestWhere });
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await Feedback.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit, distinct: true });
    res.json({ success: true, data: rows, feedback: rows, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createFeedback = async (req, res, next) => {
  try {
    const requestWhere = { id: req.params.id };
    if (!applyServiceRequestScope(requestWhere, req)) {
      return res.status(403).json({ success: false, message: scopeErrorMessage(req) });
    }
    const item = await ServiceRequest.findOne({ where: requestWhere });
    if (!item) return res.status(404).json({ success: false, message: 'Service request not found' });
    if (item.status !== 'completed') return res.status(409).json({ success: false, message: 'Feedback is only available after the request is completed' });
    if (item.reportedBy !== req.user.id && !['admin', 'college_manager', 'department_head'].includes(normalizeRoleForStorage(req.user.role))) {
      return res.status(403).json({ success: false, message: 'Only the requester can provide feedback' });
    }
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    const existing = await Feedback.findOne({ where: { requestId: item.id } });
    if (existing) {
      await existing.update({ rating, feedback: req.body.feedback || '', comment: req.body.comment || '', submittedBy: req.user.id });
      return res.json({ success: true, data: existing });
    }
    const feedback = await Feedback.create({ requestId: item.id, rating, feedback: req.body.feedback || '', comment: req.body.comment || '', submittedBy: req.user.id });
    res.status(201).json({ success: true, data: feedback });
  } catch (error) { next(error); }
};

const listTechnicianCandidates = async (req, res, next) => {
  try {
    const where = { active: true, status: 'active', role: { [Op.in]: ['maintenance', 'ict_officer', 'infrastructure'] } };
    if (normalizeRoleForStorage(req.user.role) !== 'admin') {
      const scope = requestOrganizationScope(req);
      if (scope.departmentId) where.departmentId = scope.departmentId;
      if (scope.collegeId) where.collegeId = scope.collegeId;
    }
    const users = await User.findAll({ where, attributes: ['id', 'username', 'fullName', 'role', 'department'], order: [['fullName', 'ASC']] });
    res.json({ success: true, data: users, technicians: users });
  } catch (error) { next(error); }
};

const listEligibleAssignees = async (req, res, next) => {
  try {
  const responsibleRole = normalizeRoleForStorage(req.query.role);
  const category = String(req.query.category || '').trim();
  if (!responsibleRole || !category) return res.status(400).json({ success: false, message: 'A request category and responsible role are required' });
  const roles = await getActiveResponsibleRoles('maintenance', category, '', req.user.role);
  const role = roles.find((candidate) => normalizeRoleForStorage(candidate.name) === responsibleRole);
  if (!role) return res.status(403).json({ success: false, message: 'This role is not authorized for the selected request category' });

  const where = { active: true, status: 'active', role: { [Op.in]: userRoleValues(responsibleRole) } };
  if (normalizeRoleForStorage(req.user.role) !== 'admin') {
    const scope = requestOrganizationScope(req);
    if (scope.departmentId) where.departmentId = scope.departmentId;
    if (scope.collegeId) where.collegeId = scope.collegeId;
  }
  const users = await User.findAll({
    where,
    attributes: ['id', 'username', 'fullName', 'role'],
    order: [['fullName', 'ASC'], ['id', 'ASC']],
    limit: 100,
  });
  return res.json({
    success: true,
    data: users.map((user) => ({ id: user.id, name: user.fullName || user.username, role: responsibleRole })),
  });
  } catch (error) { return next(error); }
};

const getRoutingOptions = async (req, res, next) => {
  try {
  const escalationHours = await getEscalationHours();
  const categories = ['Facilities', 'ICTD', 'Maintenance', 'Inventory / Store', 'Finance', 'Department', 'College', 'Other'];
  if (normalizeRoleForStorage(req.user.role) === 'admin') categories.push('System Administration');
  const roleNames = [...new Set(categories.flatMap((category) => getResponsibleRoleNames('maintenance', category, '', req.user.role)))];
  const roles = roleNames.length ? await Role.findAll({
    where: { active: true, name: { [Op.in]: roleNames } },
    attributes: ['id', 'name', 'displayName', 'description'],
    order: [['displayName', 'ASC']],
  }) : [];
  const byName = new Map(roles.map((role) => [normalizeRoleForStorage(role.name), role]));
  const rolesByCategory = Object.fromEntries(categories.map((category) => [
    category,
    getResponsibleRoleNames('maintenance', category, '', req.user.role)
      .map((name) => byName.get(name))
      .filter(Boolean)
      .map((role) => ({ id: role.id, name: normalizeRoleForStorage(role.name), displayName: role.displayName, description: role.description })),
  ]));
  res.json({
    success: true,
    data: {
      default_route: DEFAULT_ROUTE,
      routes: ROUTE_LABELS,
      rules: ROUTING_BY_CATEGORY.map((rule) => ({ pattern: rule.pattern, keywords: String(rule.subscribe).match(/\(([^)]+)\)/)?.[1] || '', route: rule.route })),
      categories,
      roles_by_category: rolesByCategory,
      escalation_hours: escalationHours,
      max_open_old_tickets: MAX_UNACKNOWLEDGED_TICKETS,
    },
  });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequest,
  setStatus,
  acknowledge,
  acknowledgeTicket,
  start,
  complete,
  cancel,
  assignTicket,
  escalateTickets,
  listFeedback,
  createFeedback,
  listTechnicianCandidates,
  listEligibleAssignees,
  getRoutingOptions,
  routeRequest,
  serializeRequest,
  defaultInclude,
  verifyTicketLimit,
  departmentScopeId,
};
