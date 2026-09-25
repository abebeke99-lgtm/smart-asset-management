const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const {
  sequelize, Incident, IncidentComment, IncidentHistory, IncidentAttachment,
  User, Asset, Department, Location, AuditLog,
} = require('../models');
const { createBulkNotification } = require('../services/notificationService');

const STATUSES = ['new', 'assigned', 'investigating', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled', 'escalated'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const IMPACTS = ['individual', 'department', 'multiple_departments', 'organization_wide'];
const URGENCIES = ['low', 'medium', 'high', 'critical'];
const COMMENT_TYPES = ['public_comment', 'internal_note', 'investigation_note', 'resolution_note'];
const ACTIVE_STATUSES = ['new', 'assigned', 'investigating', 'in_progress', 'pending', 'escalated'];
const OPERATIONAL_ROLES = ['admin', 'ict_officer', 'maintenance', 'infrastructure'];
const transitions = {
  new: ['assigned', 'investigating', 'escalated', 'cancelled'],
  assigned: ['investigating', 'in_progress', 'escalated', 'cancelled'],
  investigating: ['in_progress', 'pending', 'resolved', 'escalated', 'cancelled'],
  in_progress: ['pending', 'resolved', 'escalated', 'cancelled'],
  pending: ['investigating', 'in_progress', 'resolved', 'cancelled'],
  escalated: ['investigating', 'assigned', 'cancelled'],
  resolved: ['closed', 'investigating'],
  closed: ['investigating'],
  cancelled: [],
};

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const role = (req) => String(req.user?.role || '').toLowerCase();
const isOperator = (req) => OPERATIONAL_ROLES.includes(role(req));
const parseId = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const displayUser = { attributes: ['id', 'username', 'fullName', 'email', 'role', 'departmentId'] };

const include = (details = false) => [
  { model: User, as: 'Reporter', ...displayUser },
  { model: User, as: 'Technician', ...displayUser },
  { model: User, as: 'Resolver', ...displayUser },
  { model: User, as: 'Closer', ...displayUser },
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'location', 'department'] },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] },
  { model: Location, as: 'LocationRecord', attributes: ['id', 'name', 'code'] },
  ...(details ? [
    { model: IncidentComment, include: [{ model: User, as: 'Author', ...displayUser }], separate: true, order: [['createdAt', 'DESC']] },
    { model: IncidentHistory, include: [{ model: User, as: 'Actor', ...displayUser }], separate: true, order: [['createdAt', 'DESC']] },
    { model: IncidentAttachment, include: [{ model: User, as: 'Uploader', ...displayUser }], separate: true, order: [['createdAt', 'DESC']] },
  ] : []),
];

const canView = (req, incident) => isOperator(req) || incident.reporterId === req.user.id || incident.assignedTechnicianId === req.user.id;
const assertView = (req, incident) => { if (!canView(req, incident)) throw fail('You do not have permission to access this incident', 403); };
const audit = (userId, action, incidentId, details = {}) => AuditLog.create({ userId, action, entity: `incident:${incidentId}`, details: JSON.stringify(details) });
const notifyUsers = (userIds, title, message, senderId, entityId) => createBulkNotification({ recipientType: 'users', userIds: [...new Set(userIds.filter(Boolean))], title, message, type: 'alert', priority: 'high', channel: 'in_app', eventKey: `incident:${entityId}:${title}` }, senderId).catch(() => null);
const history = (incidentId, userId, action, oldValue = null, newValue = null, metadata = null, transaction) => IncidentHistory.create({ incidentId, userId, action, oldValue: oldValue == null ? null : String(oldValue), newValue: newValue == null ? null : String(newValue), metadata }, { transaction });

const serialize = (item) => {
  const value = item.toJSON ? item.toJSON() : item;
  const overdue = value.dueDate && ACTIVE_STATUSES.includes(value.status) && new Date(value.dueDate) < new Date();
  return {
    ...value,
    overdue: Boolean(overdue),
    daysOverdue: overdue ? Math.max(1, Math.ceil((Date.now() - new Date(value.dueDate).getTime()) / 86400000)) : 0,
    reporterName: value.Reporter?.fullName || value.Reporter?.username || null,
    technicianName: value.Technician?.fullName || value.Technician?.username || null,
    assetName: value.Asset?.name || null,
    departmentName: value.DepartmentRecord?.name || null,
    locationName: value.LocationRecord?.name || null,
  };
};

const getIncident = async (id, details = false) => Incident.findByPk(id, { include: include(details) });
const incidentNumber = async (transaction) => {
  const year = new Date().getFullYear();
  const count = await Incident.count({ where: { createdAt: { [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`) } }, transaction });
  return `INC-${year}-${String(count + 1).padStart(6, '0')}`;
};

const listIncidents = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = {};
    if (!isOperator(req)) where[Op.or] = [{ reporterId: req.user.id }, { assignedTechnicianId: req.user.id }];
    const fields = ['status', 'priority', 'impact', 'urgency', 'category', 'subcategory', 'reporterId', 'assignedTechnicianId', 'departmentId', 'locationId', 'assetId', 'supportTeam', 'escalationLevel'];
    fields.forEach((field) => { const queryName = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`); if (req.query[field] || req.query[queryName]) where[field] = req.query[field] || req.query[queryName]; });
    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      where[Op.and] = [{ [Op.or]: [{ incidentNumber: { [Op.like]: search } }, { title: { [Op.like]: search } }, { description: { [Op.like]: search } }, { '$Reporter.fullName$': { [Op.like]: search } }, { '$Reporter.username$': { [Op.like]: search } }, { '$Technician.fullName$': { [Op.like]: search } }, { '$Asset.assetCode$': { [Op.like]: search } }, { '$Asset.serialNumber$': { [Op.like]: search } }] }];
    }
    if (req.query.overdue === 'true') where.dueDate = { [Op.lt]: new Date() };
    if (req.query.dateFrom || req.query.dateTo) where.createdAt = { ...(req.query.dateFrom ? { [Op.gte]: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { [Op.lte]: new Date(`${req.query.dateTo}T23:59:59.999Z`) } : {}) };
    const sortMap = { incidentNumber: 'incidentNumber', createdAt: 'createdAt', updatedAt: 'updatedAt', priority: 'priority', dueDate: 'dueDate', status: 'status', resolvedAt: 'resolvedAt' };
    const sort = sortMap[req.query.sort] || 'createdAt';
    const direction = String(req.query.direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const { count, rows } = await Incident.findAndCountAll({ where, include: include(), distinct: true, order: [[sort, direction]], limit, offset: (page - 1) * limit });
    res.json({ success: true, data: rows.map(serialize), incidents: rows.map(serialize), pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createIncident = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || '').trim();
    const reporterId = parseId(body.reporterId || body.reporter_id) || req.user.id;
    if (!title || !description || !category) throw fail('Title, description, and category are required', 422);
    if (!isOperator(req) && reporterId !== req.user.id) throw fail('You may only report incidents for yourself', 403);
    const reporter = await User.findByPk(reporterId, { transaction });
    if (!reporter) throw fail('Reporter not found', 422);
    const assetId = parseId(body.assetId || body.asset_id);
    if (assetId && !await Asset.findByPk(assetId, { transaction })) throw fail('Affected asset not found', 422);
    const reportedAt = body.reportedAt || body.reported_at || new Date();
    const dueDate = body.dueDate || body.due_date || null;
    if (dueDate && new Date(dueDate) < new Date(reportedAt)) throw fail('Due date cannot be before reported date', 422);
    const priority = String(body.priority || 'medium').toLowerCase();
    const impact = String(body.impact || 'individual').toLowerCase();
    const urgency = String(body.urgency || 'medium').toLowerCase();
    if (!PRIORITIES.includes(priority) || !IMPACTS.includes(impact) || !URGENCIES.includes(urgency)) throw fail('Invalid priority, impact, or urgency', 422);
    const incident = await Incident.create({ incidentNumber: await incidentNumber(transaction), title, description, category, subcategory: body.subcategory || null, priority, impact, urgency, status: 'new', reporterId, employeeId: parseId(body.employeeId || body.employee_id), departmentId: parseId(body.departmentId || body.department_id) || reporter.departmentId || null, assetId, locationId: parseId(body.locationId || body.location_id), assignedTechnicianId: parseId(body.assignedTechnicianId || body.assigned_technician_id), supportTeam: body.supportTeam || null, reportedAt, dueDate, targetResolutionDate: body.targetResolutionDate || body.target_resolution_date || null, responseDeadline: body.responseDeadline || body.response_deadline || null, resolutionDeadline: body.resolutionDeadline || body.resolution_deadline || null, isRecurring: Boolean(body.isRecurring || body.is_recurring), parentIncidentId: parseId(body.parentIncidentId || body.parent_incident_id) }, { transaction });
    await history(incident.id, req.user.id, 'INCIDENT_CREATED', null, incident.status, { incidentNumber: incident.incidentNumber }, transaction);
    await transaction.commit();
    await audit(req.user.id, 'INCIDENT_CREATED', incident.id, { incidentNumber: incident.incidentNumber, title });
    const recipients = [incident.reporterId, incident.assignedTechnicianId].filter(Boolean);
    if (recipients.length) notifyUsers(recipients, 'Incident created', `${incident.incidentNumber}: ${incident.title}`, req.user.id, incident.id);
    res.status(201).json({ success: true, message: 'Incident created successfully', data: serialize(await getIncident(incident.id)) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const getIncidentDetails = async (req, res, next) => { try { const incident = await getIncident(req.params.id, true); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' }); assertView(req, incident); res.json({ success: true, data: serialize(incident) }); } catch (error) { next(error); } };

const updateIncident = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const incident = await Incident.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!incident) throw fail('Incident not found', 404); assertView(req, incident); if (!isOperator(req) && incident.reporterId !== req.user.id) throw fail('Only incident operators may update incident fields', 403);
    const allowed = ['title', 'description', 'category', 'subcategory', 'priority', 'impact', 'urgency', 'departmentId', 'locationId', 'dueDate', 'targetResolutionDate', 'supportTeam', 'responseDeadline', 'resolutionDeadline', 'isRecurring', 'parentIncidentId'];
    const changes = {}; allowed.forEach((field) => { if (req.body[field] !== undefined) changes[field] = req.body[field]; });
    if (changes.priority && !PRIORITIES.includes(String(changes.priority).toLowerCase())) throw fail('Invalid priority', 422);
    await incident.update(changes, { transaction });
    await history(incident.id, req.user.id, 'INCIDENT_UPDATED', null, null, { fields: Object.keys(changes) }, transaction);
    await transaction.commit(); await audit(req.user.id, 'INCIDENT_UPDATED', incident.id, { fields: Object.keys(changes) });
    res.json({ success: true, data: serialize(await getIncident(incident.id)) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const transition = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const incident = await Incident.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!incident) throw fail('Incident not found', 404); assertView(req, incident); if (!isOperator(req)) throw fail('Incident operator permission required', 403);
    const nextStatus = String(req.body.status || '').toLowerCase();
    if (!STATUSES.includes(nextStatus) || !transitions[incident.status]?.includes(nextStatus)) throw fail(`Invalid transition from ${incident.status} to ${nextStatus}`, 409);
    const updates = { status: nextStatus };
    if (nextStatus === 'resolved') { if (!String(req.body.resolutionSummary || req.body.resolution_summary || '').trim()) throw fail('Resolution summary is required', 422); Object.assign(updates, { resolutionSummary: req.body.resolutionSummary || req.body.resolution_summary, rootCause: req.body.rootCause || req.body.root_cause || null, resolutionType: req.body.resolutionType || req.body.resolution_type || null, preventiveAction: req.body.preventiveAction || req.body.preventive_action || null, resolvedAt: new Date(), resolvedBy: req.user.id }); }
    if (nextStatus === 'closed' && !incident.resolutionSummary) throw fail('Resolve the incident before closing it', 422);
    if (nextStatus === 'closed') Object.assign(updates, { closedAt: new Date(), closedBy: req.user.id });
    if (incident.status === 'closed' && nextStatus === 'investigating') Object.assign(updates, { reopenedAt: new Date(), reopenedBy: req.user.id, reopenReason: String(req.body.reopenReason || req.body.reopen_reason || '').trim() || null });
    await incident.update(updates, { transaction }); await history(incident.id, req.user.id, nextStatus === 'closed' ? 'INCIDENT_CLOSED' : nextStatus === 'resolved' ? 'INCIDENT_RESOLVED' : incident.status === 'closed' ? 'INCIDENT_REOPENED' : 'STATUS_CHANGED', incident.status, nextStatus, { reason: req.body.reason || req.body.reopenReason || null }, transaction); await transaction.commit();
    await audit(req.user.id, `INCIDENT_${nextStatus.toUpperCase()}`, incident.id, { oldStatus: incident.status, newStatus: nextStatus });
    res.json({ success: true, data: serialize(await getIncident(incident.id)) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const assignIncident = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try { const incident = await Incident.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }); if (!incident) throw fail('Incident not found', 404); if (!isOperator(req)) throw fail('Assignment permission required', 403); const assignedTechnicianId = parseId(req.body.assignedTechnicianId || req.body.assigned_technician_id); if (assignedTechnicianId && !await User.findByPk(assignedTechnicianId, { transaction })) throw fail('Technician not found', 422); const old = incident.assignedTechnicianId; await incident.update({ assignedTechnicianId, supportTeam: req.body.supportTeam || req.body.support_team || incident.supportTeam, status: incident.status === 'new' && assignedTechnicianId ? 'assigned' : incident.status }, { transaction }); await history(incident.id, req.user.id, old ? 'TECHNICIAN_REASSIGNED' : 'TECHNICIAN_ASSIGNED', old, assignedTechnicianId, null, transaction); await transaction.commit(); await audit(req.user.id, old ? 'INCIDENT_REASSIGNED' : 'INCIDENT_ASSIGNED', incident.id, { old, assignedTechnicianId }); if (assignedTechnicianId) notifyUsers([assignedTechnicianId], 'Incident assigned', `${incident.incidentNumber}: ${incident.title}`, req.user.id, incident.id); res.json({ success: true, data: serialize(await getIncident(incident.id)) }); } catch (error) { await transaction.rollback(); next(error); }
};

const escalateIncident = async (req, res, next) => { try { const incident = await getIncident(req.params.id); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' }); if (!isOperator(req)) throw fail('Escalation permission required', 403); const transaction = await sequelize.transaction(); await incident.update({ status: 'escalated', escalationLevel: req.body.escalationLevel || req.body.escalation_level || 'support_manager', escalatedTo: req.body.escalatedTo || req.body.escalated_to || null, escalationReason: String(req.body.reason || req.body.escalationReason || '').trim() || null }, { transaction }); await history(incident.id, req.user.id, 'ESCALATED', incident.status, 'escalated', null, transaction); await transaction.commit(); await audit(req.user.id, 'INCIDENT_ESCALATED', incident.id, { escalationLevel: incident.escalationLevel }); res.json({ success: true, data: serialize(await getIncident(incident.id)) }); } catch (error) { next(error); } };

const listComments = async (req, res, next) => { try { const incident = await getIncident(req.params.id); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' }); assertView(req, incident); const where = { incidentId: incident.id }; if (!isOperator(req)) where.commentType = 'public_comment'; const comments = await IncidentComment.findAll({ where, include: [{ model: User, as: 'Author', ...displayUser }], order: [['createdAt', 'ASC']] }); res.json({ success: true, data: comments }); } catch (error) { next(error); } };
const addComment = async (req, res, next) => { try { const incident = await getIncident(req.params.id); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' }); assertView(req, incident); const comment = String(req.body.comment || '').trim(); const commentType = String(req.body.commentType || req.body.comment_type || 'public_comment').toLowerCase(); if (!comment) throw fail('Comment is required', 422); if (!COMMENT_TYPES.includes(commentType)) throw fail('Invalid comment type', 422); if (commentType !== 'public_comment' && !isOperator(req)) throw fail('Internal note permission required', 403); const created = await IncidentComment.create({ incidentId: incident.id, userId: req.user.id, comment, commentType }); await IncidentHistory.create({ incidentId: incident.id, userId: req.user.id, action: 'COMMENT_ADDED', newValue: commentType, metadata: { commentId: created.id } }); await audit(req.user.id, 'INCIDENT_COMMENT_ADDED', incident.id, { commentType }); res.status(201).json({ success: true, data: created }); } catch (error) { next(error); } };
const listHistory = async (req, res, next) => { try { const incident = await getIncident(req.params.id); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' }); assertView(req, incident); const rows = await IncidentHistory.findAll({ where: { incidentId: incident.id }, include: [{ model: User, as: 'Actor', ...displayUser }], order: [['createdAt', 'DESC']] }); res.json({ success: true, data: rows }); } catch (error) { next(error); } };
const addAttachment = async (req, res, next) => { try { const incident = await getIncident(req.params.id); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' }); assertView(req, incident); if (!isOperator(req)) throw fail('Attachment permission required', 403); const input = req.body || {}; const mimeType = String(input.mimeType || input.mime_type || '').toLowerCase(); const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'application/zip', 'application/json']; if (!allowed.includes(mimeType)) throw fail('Unsupported attachment type', 422); const buffer = Buffer.from(String(input.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64'); if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw fail('Attachment must be between 1 byte and 10 MB', 422); const directory = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'incidents'); fs.mkdirSync(directory, { recursive: true }); const safeName = String(input.fileName || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_'); const storedName = `${Date.now()}-${safeName}`; fs.writeFileSync(path.join(directory, storedName), buffer); const attachment = await IncidentAttachment.create({ incidentId: incident.id, uploadedBy: req.user.id, fileName: safeName, filePath: path.posix.join('uploads', 'incidents', storedName), mimeType, fileSize: buffer.length }); await IncidentHistory.create({ incidentId: incident.id, userId: req.user.id, action: 'ATTACHMENT_ADDED', newValue: safeName, metadata: { attachmentId: attachment.id } }); await audit(req.user.id, 'INCIDENT_ATTACHMENT_ADDED', incident.id, { attachmentId: attachment.id, fileName: safeName }); res.status(201).json({ success: true, data: attachment }); } catch (error) { next(error); } };
const statistics = async (req, res, next) => { try { const where = isOperator(req) ? {} : { [Op.or]: [{ reporterId: req.user.id }, { assignedTechnicianId: req.user.id }] }; const rows = await Incident.findAll({ where, attributes: ['status', 'priority', 'createdAt', 'resolvedAt', 'dueDate', 'assignedTechnicianId'], raw: true }); const by = (field) => rows.reduce((result, item) => { result[item[field]] = (result[item[field]] || 0) + 1; return result; }, {}); const active = rows.filter((item) => ACTIVE_STATUSES.includes(item.status)); const overdue = active.filter((item) => item.dueDate && new Date(item.dueDate) < new Date()).length; const resolved = rows.filter((item) => item.resolvedAt); const averageResolutionHours = resolved.length ? resolved.reduce((sum, item) => sum + (new Date(item.resolvedAt) - new Date(item.createdAt)) / 3600000, 0) / resolved.length : 0; const today = new Date(); const incidentsToday = rows.filter((item) => new Date(item.createdAt).toDateString() === today.toDateString()).length; res.json({ success: true, data: { total: rows.length, open: active.length, investigating: rows.filter((item) => item.status === 'investigating').length, inProgress: rows.filter((item) => item.status === 'in_progress').length, resolved: rows.filter((item) => item.status === 'resolved').length, closed: rows.filter((item) => item.status === 'closed').length, critical: rows.filter((item) => item.priority === 'critical').length, high: rows.filter((item) => item.priority === 'high').length, overdue, escalated: rows.filter((item) => item.status === 'escalated').length, incidentsToday, averageResolutionHours: Number(averageResolutionHours.toFixed(2)), byStatus: by('status'), byPriority: by('priority') } }); } catch (error) { next(error); } };
const overdue = async (req, res, next) => { req.query.overdue = 'true'; req.query.status = undefined; return listIncidents(req, res, next); };
const myIncidents = async (req, res, next) => { req.query.assignedTechnicianId = req.user.id; return listIncidents(req, res, next); };
const removeIncident = async (req, res, next) => { try { if (!isOperator(req) || role(req) !== 'admin') throw fail('Only administrators may delete incidents', 403); const deleted = await Incident.destroy({ where: { id: req.params.id } }); if (!deleted) return res.status(404).json({ success: false, message: 'Incident not found' }); await audit(req.user.id, 'INCIDENT_ARCHIVED', req.params.id); res.json({ success: true, message: 'Incident archived' }); } catch (error) { next(error); } };

module.exports = { listIncidents, createIncident, getIncidentDetails, updateIncident, transition, assignIncident, escalateIncident, listComments, addComment, listHistory, addAttachment, statistics, overdue, myIncidents, removeIncident };
