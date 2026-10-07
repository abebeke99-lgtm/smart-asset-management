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
  SupportTicketComment,
} = require('../models');
const { createBulkNotification } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');
const { getEscalationHours, runServiceRequestEscalation } = require('../services/serviceRequestEscalationService');

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

const isDepartmentHead = (req) => String(req.user?.role || '').toLowerCase() === 'department_head';
const departmentScopeId = (req) => {
  const value = req.organizationScope?.departmentId ?? req.user?.departmentId ?? req.user?.department_id;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const ROUTING_BY_CATEGORY = [
  { pattern: 'network', subscribe: /(network|router|switch|firewall|wireless|access point)/i, route: 'ictd' },
  { pattern: 'ict', subscribe: /(computer|laptop|ict|server|monitor|printer|scanner|projector|workstation|desktop|processor|cpu)/i, route: 'ictd' },
  { pattern: 'facility', subscribe: /(building|facility|electrical|electric|generator|transformer|ups|water|plumb|paint|furniture|door|window|air condition|pump)/i, route: 'gs_facilities' },
];
const DEFAULT_ROUTE = 'maintenance';
const ROUTE_LABELS = { ictd: 'ICTD / Network', gs_facilities: 'GS / Facilities', maintenance: 'Maintenance' };
const ROUTE_NOTIFY_ROLES = {
  ictd: ['ict_officer', 'admin'],
  gs_facilities: ['infrastructure', 'admin'],
  maintenance: ['maintenance', 'ict_officer', 'admin'],
};

const routeRequest = (requestType, category, assetCategory) => {
  const haystack = [category, assetCategory, requestType].filter(Boolean).join(' ');
  const match = ROUTING_BY_CATEGORY.find((rule) => rule.subscribe.test(haystack));
  if (match) return match.route;
  return DEFAULT_ROUTE;
};

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
    const scopedDepartmentId = isDepartmentHead(req) ? departmentScopeId(req) : null;
    if (isDepartmentHead(req) && !scopedDepartmentId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    const requestedDepartmentId = req.body.departmentId ?? req.body.department_id;
    if (scopedDepartmentId && requestedDepartmentId != null && Number(requestedDepartmentId) !== scopedDepartmentId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Cannot create a service request for another department' });
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
    const assetId = req.body.assetId || req.body.asset_id || null;
    const requestedLaboratoryId = req.body.laboratoryId ?? req.body.laboratory_id ?? null;
    let asset = null;
    if (assetId) {
      asset = await Asset.findByPk(assetId, { transaction });
      if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
      if (scopedDepartmentId && Number(asset.departmentId ?? asset.department_id) !== scopedDepartmentId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Cannot create a service request for an asset outside your department' });
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
    const departmentId = scopedDepartmentId || req.user.departmentId || req.user.department_id || req.body.departmentId || req.body.department_id || null;
    const collegeId = scopedDepartmentId ? (req.organizationScope?.collegeId ?? req.user.collegeId ?? null) : (req.body.collegeId || req.body.college_id || req.user.collegeId || null);
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
      reportedBy,
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

    const notifyRoles = ROUTE_NOTIFY_ROLES[routedTo] || ROUTE_NOTIFY_ROLES[DEFAULT_ROUTE];
    try {
      await createBulkNotification({
        recipientType: 'role',
        roles: notifyRoles,
        title: `New ${ROUTE_LABELS[routedTo]} service request`,
        message: `Service request ${request.requestCode}: ${request.title}. Priority: ${request.priority}.`,
        type: 'maintenance',
        priority: request.priority === 'critical' || request.priority === 'high' ? 'high' : 'medium',
        channel: 'in_app',
      }, req.user.id);
    } catch (notificationError) {
      console.error('Service request notification failed:', notificationError.message);
    }
    res.status(201).json({ success: true, data: serializeRequest(request), request: serializeRequest(request), routedTo: routeRequest(requestType, req.body.category || '', asset?.category || ''), routed_to_label: ROUTE_LABELS[routedTo] });
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
    if (isDepartmentHead(req)) {
      const scopeId = departmentScopeId(req);
      if (!scopeId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
      where.departmentId = scopeId;
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
    const data = rows.map(serializeRequest);
    res.json({ success: true, data, requests: data, total: count, summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getServiceRequest = async (req, res, next) => {
  try {
    const where = { id: req.params.id };
    if (isDepartmentHead(req)) {
      const scopeId = departmentScopeId(req);
      if (!scopeId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
      where.departmentId = scopeId;
    }
    const item = await ServiceRequest.findOne({ where, include: defaultInclude() });
    if (!item) return res.status(404).json({ success: false, message: 'Service request not found' });
    const feedback = await Feedback.findOne({ where: { requestId: item.id } });
    res.json({ success: true, data: serializeRequest(item), request: serializeRequest(item), feedback });
  } catch (error) { next(error); }
};

const transitionStatus = async (req, res, next, applyToBody) => {
  const transaction = await sequelize.transaction();
  try {
    if (applyToBody) applyToBody(req.body);
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
    const allowedFrom = { submitted: ['scheduled', 'in-progress', 'cancelled'], scheduled: ['in-progress', 'cancelled'], 'in-progress': ['completed', 'cancelled'], completed: [], cancelled: [], escalated: ['scheduled', 'in-progress', 'completed'] };
    if (!allowedFrom[item.status]?.includes(status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid transition from ${STATUS_LABELS[item.status]} to ${STATUS_LABELS[status]}` }); }
    const previousStatus = item.status;
    const updates = { status };
    if (status === 'scheduled') updates.scheduledDate = req.body.scheduledDate || req.body.scheduled_date || item.scheduledDate || new Date();
    if (status === 'in-progress') updates.startedAt = req.body.startedAt || req.body.started_at || item.startedAt || new Date();
    if (status === 'completed') updates.completedAt = req.body.completedAt || req.body.completed_at || new Date();
    await RequestStatusHistory.create({ requestId: item.id, previousStatus, newStatus: status, changedBy: req.user.id, comment: req.body.comment || req.body.notes || '' }, { transaction });
    await item.update(updates, { transaction });
    await transaction.commit();
    if (status === 'completed') {
      try {
        await createBulkNotification({
          recipientType: 'users',
          userIds: [item.reportedBy],
          title: 'Service request completed',
          message: `Service request ${item.requestCode} (${item.title}) has been completed. Please provide your feedback.`,
          type: 'maintenance',
          priority: 'medium',
          channel: 'in_app',
        }, req.user.id);
      } catch (notificationError) {
        console.error('Completion notification failed:', notificationError.message);
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
    const item = await ServiceRequest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Service request not found' }); }
    if (!['submitted', 'escalated'].includes(item.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only submitted or escalated requests can be acknowledged' }); }
    await item.update({ acknowledgedAt: new Date(), status: 'scheduled', scheduledDate: new Date() }, { transaction });
    await RequestStatusHistory.create({ requestId: item.id, previousStatus: item.status, newStatus: 'scheduled', changedBy: req.user.id, comment: 'Acknowledged by service unit' }, { transaction });
    await transaction.commit();
    res.json({ success: true, data: serializeRequest(await ServiceRequest.findByPk(item.id, { include: defaultInclude() })) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const assignTicket = async (req, res, next) => {
  try {
    const item = await ServiceRequest.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Service request not found' });
    const assigneeId = Number(req.body.assignedTo || req.body.assigned_to || req.body.technician_id);
    if (!Number.isInteger(assigneeId)) return res.status(400).json({ success: false, message: 'A valid user id is required' });
    const assignee = await User.findByPk(assigneeId);
    if (!assignee || !assignee.active) return res.status(400).json({ success: false, message: 'Assignee user not found or inactive' });
    await item.update({ assignedTo: assigneeId });
    await RequestStatusHistory.create({ requestId: item.id, previousStatus: item.status, newStatus: item.status, changedBy: req.user.id, comment: `Assigned to ${assignee.fullName || assignee.username}` });
    try {
      await createBulkNotification({
        recipientType: 'users',
        userIds: [assigneeId],
        title: 'Technician assigned',
        message: `You have been assigned service request ${item.requestCode}: ${item.title}.`,
        type: 'assignment',
        priority: item.priority === 'critical' ? 'urgent' : 'high',
        channel: 'in_app',
      }, req.user.id);
    } catch (notificationError) {
      console.error('Assignment notification failed:', notificationError.message);
    }
    res.json({ success: true, data: serializeRequest(await ServiceRequest.findByPk(item.id, { include: defaultInclude() })) });
  } catch (error) { next(error); }
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
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await Feedback.findAndCountAll({ where, include: [{ model: User, as: 'Submitter', attributes: ['id', 'username', 'fullName'] }], order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    res.json({ success: true, data: rows, feedback: rows, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createFeedback = async (req, res, next) => {
  try {
    const item = await ServiceRequest.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Service request not found' });
    if (isDepartmentHead(req)) {
      const scopeId = departmentScopeId(req);
      if (!scopeId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
      if (Number(item.departmentId) !== scopeId) return res.status(404).json({ success: false, message: 'Service request not found' });
    }
    if (item.status !== 'completed') return res.status(409).json({ success: false, message: 'Feedback is only available after the request is completed' });
    if (item.reportedBy !== req.user.id && !['admin', 'college', 'department_head'].includes(req.user.role)) {
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
    const users = await User.findAll({ where: { active: true, role: { [Op.in]: ['maintenance', 'ict_officer', 'infrastructure'] } }, attributes: ['id', 'username', 'fullName', 'role', 'department'], order: [['fullName', 'ASC']] });
    res.json({ success: true, data: users, technicians: users });
  } catch (error) { next(error); }
};

const getRoutingOptions = async (req, res, next) => {
  try {
    const escalationHours = await getEscalationHours();
  res.json({
    success: true,
    data: {
      default_route: DEFAULT_ROUTE,
      routes: ROUTE_LABELS,
      rules: ROUTING_BY_CATEGORY.map((rule) => ({ pattern: rule.pattern, keywords: String(rule.subscribe).match(/\(([^)]+)\)/)?.[1] || '', route: rule.route })),
      escalation_hours: escalationHours,
      max_open_old_tickets: MAX_OPEN_OLD_TICKETS,
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
  getRoutingOptions,
  routeRequest,
  serializeRequest,
  defaultInclude,
  verifyTicketLimit,
  departmentScopeId,
};
