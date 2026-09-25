const { Op } = require('sequelize');
const { sequelize, ServiceRequest, RequestStatusHistory, RequestAttachment, SupportTicketComment, Asset, User, Department } = require('../models');
const { createBulkNotification } = require('../services/notificationService');

const STATUSES = ['open', 'assigned', 'in-progress', 'pending-user', 'pending-parts', 'resolved', 'closed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['hardware', 'software', 'network', 'printer', 'server', 'account / access', 'security', 'email', 'internet', 'system', 'other'];
const ACTIVE_STATUSES = ['open', 'assigned', 'in-progress', 'pending-user', 'pending-parts'];
const MANAGER_ROLES = ['admin', 'ict_officer', 'maintenance', 'infrastructure'];

const include = [
  { model: User, as: 'Reporter', attributes: ['id', 'username', 'fullName', 'email', 'phone', 'department'] },
  { model: User, as: 'Assignee', attributes: ['id', 'username', 'fullName', 'email', 'department'] },
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'location', 'serialNumber', 'status'] },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] },
];

const clean = (value) => String(value || '').trim();
const isManager = (req) => MANAGER_ROLES.includes(req.user.role);
const ticketNumber = (id) => `TS-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`;
const serialize = (item) => {
  const data = item.toJSON();
  const overdue = data.dueDate && ACTIVE_STATUSES.includes(data.status) && new Date(data.dueDate) < new Date();
  return {
    ...data,
    ticketNumber: data.requestCode,
    ticket_number: data.requestCode,
    subject: data.title,
    requester: item.Reporter?.fullName || item.Reporter?.username || '',
    requester_id: data.reportedBy,
    assigned_technician: item.Assignee?.fullName || item.Assignee?.username || '',
    assigned_technician_id: data.assignedTo,
    department_name: item.DepartmentRecord?.name || null,
    asset_name: item.Asset?.name || null,
    asset_tag: item.Asset?.assetCode || null,
    overdue: Boolean(overdue),
    overdue_days: overdue ? Math.max(1, Math.ceil((Date.now() - new Date(data.dueDate).getTime()) / 86400000)) : 0,
  };
};

const getTicket = (id, options = {}) => ServiceRequest.findOne({ where: { id, requestType: 'support' }, include, ...options });
const validateCommon = (body) => {
  const subject = clean(body.subject || body.title);
  const description = clean(body.description || body.problem);
  const category = clean(body.category).toLowerCase();
  const priority = clean(body.priority || 'medium').toLowerCase();
  if (!subject || !description || !category) return 'Subject, description, and category are required';
  if (!CATEGORIES.includes(category)) return 'Invalid support category';
  if (!PRIORITIES.includes(priority)) return 'Invalid support priority';
  if (body.dueDate && body.createdDate && new Date(body.dueDate) < new Date(body.createdDate)) return 'Due date cannot be before created date';
  return null;
};

const listTickets = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = { requestType: 'support' };
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
    if (req.query.category) where.category = String(req.query.category).toLowerCase();
    if (req.query.technician) where.assignedTo = req.query.technician;
    if (req.query.department) where.departmentId = req.query.department;
    if (req.query.asset) where.assetId = req.query.asset;
    if (req.query.from || req.query.to) where.createdAt = { ...(req.query.from ? { [Op.gte]: new Date(req.query.from) } : {}), ...(req.query.to ? { [Op.lte]: new Date(req.query.to) } : {}) };
    if (req.query.my === 'true') where[Op.or] = [{ reportedBy: req.user.id }, { assignedTo: req.user.id }];
    if (req.query.search) {
      const search = `%${clean(req.query.search)}%`;
      where[Op.or] = [{ requestCode: { [Op.like]: search } }, { title: { [Op.like]: search } }, { description: { [Op.like]: search } }, { '$Reporter.fullName$': { [Op.like]: search } }, { '$Asset.assetCode$': { [Op.like]: search } }];
    }
    const sortMap = { ticket_number: 'requestCode', created_at: 'createdAt', updated_at: 'updatedAt', priority: 'priority', due_date: 'dueDate', status: 'status' };
    const orderColumn = sortMap[req.query.sort] || 'createdAt';
    const direction = String(req.query.direction).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const { count, rows } = await ServiceRequest.findAndCountAll({ where, include, distinct: true, order: [[orderColumn, direction]], limit, offset: (page - 1) * limit });
    const data = rows.map(serialize);
    res.json({ success: true, data, tickets: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createTicket = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const validationError = validateCommon(req.body);
    if (validationError) { await transaction.rollback(); return res.status(422).json({ success: false, message: validationError }); }
    const requesterId = isManager(req) && req.body.requesterId ? Number(req.body.requesterId) : req.user.id;
    const requester = await User.findByPk(requesterId, { transaction });
    if (!requester) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Requester not found' }); }
    const assetId = req.body.assetId ? Number(req.body.assetId) : null;
    if (assetId && !(await Asset.findByPk(assetId, { transaction }))) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Asset not found' }); }
    const temporaryCode = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const item = await ServiceRequest.create({ requestCode: temporaryCode, title: clean(req.body.subject || req.body.title), description: clean(req.body.description || req.body.problem), justification: clean(req.body.notes), requestType: 'support', category: clean(req.body.category).toLowerCase(), priority: clean(req.body.priority || 'medium').toLowerCase(), status: 'open', reportedBy: requesterId, departmentId: req.body.departmentId || requester.departmentId || null, assetId, assignedTo: isManager(req) && req.body.assignedTechnicianId ? Number(req.body.assignedTechnicianId) : null, dueDate: req.body.dueDate || null, supportTeam: clean(req.body.supportTeam) || null, supportLocation: clean(req.body.location) || null }, { transaction });
    await item.update({ requestCode: ticketNumber(item.id) }, { transaction });
    await RequestStatusHistory.create({ requestId: item.id, previousStatus: null, newStatus: 'open', changedBy: req.user.id, comment: 'Support ticket created' }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, message: 'Support ticket created successfully', data: serialize(await getTicket(item.id)) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const getTicketDetails = async (req, res, next) => { try { const item = await getTicket(req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Support ticket not found' }); res.json({ success: true, data: serialize(item) }); } catch (error) { next(error); } };

const updateStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await getTicket(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Support ticket not found' }); }
    const nextStatus = clean(req.body.status).toLowerCase();
    if (!STATUSES.includes(nextStatus)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid support ticket status' }); }
    if (item.status === 'closed' && nextStatus !== 'open') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Closed tickets must be reopened before changing status' }); }
    if (item.status === 'cancelled' && nextStatus !== 'open') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Cancelled tickets must be reopened before changing status' }); }
    const updates = { status: nextStatus };
    if (nextStatus === 'resolved') Object.assign(updates, { resolvedBy: req.user.id, completedAt: new Date(), resolutionSummary: clean(req.body.resolutionSummary || req.body.resolution) });
    if (nextStatus === 'closed') Object.assign(updates, { closedBy: req.user.id });
    const previousStatus = item.status;
    await item.update(updates, { transaction });
    await RequestStatusHistory.create({ requestId: item.id, previousStatus, newStatus: nextStatus, changedBy: req.user.id, comment: clean(req.body.comment) }, { transaction });
    await transaction.commit();
    res.json({ success: true, data: serialize(await getTicket(item.id)) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const assignTicket = async (req, res, next) => { try { const item = await getTicket(req.params.id); const assigneeId = req.body.technicianId || req.body.assignedTechnicianId; if (!item) return res.status(404).json({ success: false, message: 'Support ticket not found' }); const assignee = await User.findOne({ where: { id: assigneeId, active: true } }); if (!assignee) return res.status(422).json({ success: false, message: 'Technician not found or inactive' }); const old = item.assignedTo; await item.update({ assignedTo: assignee.id, status: item.status === 'open' ? 'assigned' : item.status }); await RequestStatusHistory.create({ requestId: item.id, previousStatus: item.status, newStatus: item.status, changedBy: req.user.id, comment: `${old ? 'Reassigned' : 'Assigned'} to ${assignee.fullName || assignee.username}` }); try { await createBulkNotification({ recipientType: 'users', userIds: [assignee.id], title: 'Support ticket assigned', message: `You have been assigned ${item.requestCode}: ${item.title}`, type: 'assignment', priority: 'high', channel: 'in_app' }, req.user.id); } catch (notificationError) { console.error('Support assignment notification failed:', notificationError.message); } res.json({ success: true, data: serialize(await getTicket(item.id)) }); } catch (error) { next(error); } };

const listComments = async (req, res, next) => { try { const rows = await SupportTicketComment.findAll({ where: { ticketId: req.params.id, ...(isManager(req) ? {} : { commentType: 'PUBLIC_COMMENT' }) }, include: [{ model: User, as: 'Author', attributes: ['id', 'username', 'fullName'] }], order: [['createdAt', 'ASC']] }); res.json({ success: true, data: rows }); } catch (error) { next(error); } };
const createComment = async (req, res, next) => { try { if (!clean(req.body.comment)) return res.status(422).json({ success: false, message: 'Comment is required' }); if (!(await getTicket(req.params.id, { attributes: ['id'] }))) return res.status(404).json({ success: false, message: 'Support ticket not found' }); const commentType = clean(req.body.commentType || 'PUBLIC_COMMENT').toUpperCase(); if (!['PUBLIC_COMMENT', 'INTERNAL_NOTE', 'RESOLUTION_NOTE'].includes(commentType)) return res.status(422).json({ success: false, message: 'Invalid comment type' }); if (commentType !== 'PUBLIC_COMMENT' && !isManager(req)) return res.status(403).json({ success: false, message: 'Internal notes require support permission' }); const row = await SupportTicketComment.create({ ticketId: req.params.id, userId: req.user.id, comment: clean(req.body.comment), commentType }); await RequestStatusHistory.create({ requestId: req.params.id, previousStatus: null, newStatus: (await ServiceRequest.findByPk(req.params.id)).status, changedBy: req.user.id, comment: `Comment added: ${commentType}` }); res.status(201).json({ success: true, data: row }); } catch (error) { next(error); } };
const listHistory = async (req, res, next) => { try { const rows = await RequestStatusHistory.findAll({ where: { requestId: req.params.id }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }], order: [['createdAt', 'DESC']] }); res.json({ success: true, data: rows }); } catch (error) { next(error); } };
const statistics = async (req, res, next) => { try { const rows = await ServiceRequest.findAll({ where: { requestType: 'support' }, attributes: ['status', 'priority', 'createdAt', 'dueDate', 'completedAt'], raw: true }); const today = new Date(); const monthStart = new Date(today.getFullYear(), today.getMonth(), 1); const stats = { total: rows.length, open: 0, assigned: 0, inProgress: 0, pending: 0, pendingUser: 0, pendingParts: 0, resolved: 0, closed: 0, cancelled: 0, highPriority: 0, overdue: 0, createdToday: 0, createdThisMonth: 0, averageResolutionHours: 0 }; let resolutionHours = 0; let resolvedCount = 0; rows.forEach((row) => { const key = row.status === 'in-progress' ? 'inProgress' : row.status === 'pending-user' ? 'pendingUser' : row.status === 'pending-parts' ? 'pendingParts' : row.status; if (Object.prototype.hasOwnProperty.call(stats, key)) stats[key] += 1; if (['pending-user', 'pending-parts'].includes(row.status)) stats.pending += 1; if (['high', 'critical'].includes(row.priority)) stats.highPriority += 1; if (row.dueDate && ACTIVE_STATUSES.includes(row.status) && new Date(row.dueDate) < today) stats.overdue += 1; if (new Date(row.createdAt).toDateString() === today.toDateString()) stats.createdToday += 1; if (new Date(row.createdAt) >= monthStart) stats.createdThisMonth += 1; if (row.completedAt) { resolutionHours += (new Date(row.completedAt) - new Date(row.createdAt)) / 3600000; resolvedCount += 1; } }); stats.averageResolutionHours = resolvedCount ? Math.round((resolutionHours / resolvedCount) * 10) / 10 : 0; res.json({ success: true, data: stats }); } catch (error) { next(error); } };
const technicians = async (req, res, next) => { try { const rows = await User.findAll({ where: { active: true, role: { [Op.in]: MANAGER_ROLES.filter((role) => role !== 'admin') } }, attributes: ['id', 'username', 'fullName', 'role'], order: [['fullName', 'ASC']] }); res.json({ success: true, data: rows }); } catch (error) { next(error); } };
const overdueTickets = async (req, res, next) => { req.query = { ...req.query, status: ACTIVE_STATUSES.join(',') }; try { const rows = await ServiceRequest.findAll({ where: { requestType: 'support', status: { [Op.in]: ACTIVE_STATUSES }, dueDate: { [Op.lt]: new Date() } }, include, order: [['dueDate', 'ASC']] }); res.json({ success: true, data: rows.map(serialize), total: rows.length }); } catch (error) { next(error); } };

module.exports = { listTickets, createTicket, getTicketDetails, updateStatus, assignTicket, listComments, createComment, listHistory, statistics, technicians, overdueTickets };