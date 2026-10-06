const { Op } = require('sequelize');
const { ServiceRequest, SupportTicketComment, User } = require('../models');
const escalationService = require('../services/serviceRequestEscalationService');

const STATUS_LABELS = {
  submitted: 'Submitted',
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  escalated: 'Escalated',
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = Object.keys(STATUS_LABELS);

const serializeTicket = (ticket, comments = []) => {
  const record = ticket.toJSON();
  const followUps = comments.map((comment) => ({
    id: comment.id,
    comment: comment.comment,
    createdAt: comment.createdAt,
    author: comment.Author?.fullName || comment.Author?.username || null,
  }));
  return {
    id: record.id,
    ticketId: record.requestCode,
    request: record.title,
    category: record.category || record.requestType,
    description: record.description,
    requestType: record.requestType,
    priority: record.priority,
    status: record.status,
    statusLabel: STATUS_LABELS[record.status] || record.status,
    assignedTechnician: ticket.Assignee?.fullName || ticket.Assignee?.username || null,
    currentOwner: ticket.Assignee?.fullName || ticket.Assignee?.username || null,
    createdAt: record.createdAt,
    acknowledgedAt: record.acknowledgedAt,
    dueDate: record.dueDate,
    escalationState: record.escalated ? 'Escalated' : 'Not escalated',
    escalatedAt: record.escalatedAt,
    escalationTime: record.escalatedAt,
    escalationReason: record.escalationReason,
    followUps,
    followUp: followUps[0]?.comment || '',
    resolution: record.resolutionSummary || record.resolution || record.resolutionType || '',
  };
};

const findFollowUps = async (ticketIds) => {
  if (!ticketIds.length) return [];
  return SupportTicketComment.findAll({
    where: { ticketId: { [Op.in]: ticketIds }, commentType: 'PUBLIC_COMMENT' },
    include: [{ model: User, as: 'Author', attributes: ['id', 'fullName', 'username'] }],
    order: [['createdAt', 'DESC']],
  });
};

const getDepartmentId = (req, res) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  if (Number.isSafeInteger(departmentId) && departmentId > 0) return departmentId;
  res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  return null;
};

const listTickets = async (req, res, next) => {
  const departmentId = getDepartmentId(req, res);
  if (!departmentId) return;

  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = { departmentId };
    const status = String(req.query.status || '').trim().toLowerCase();
    const priority = String(req.query.priority || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const search = String(req.query.search || '').trim();

    if (status && !STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid ticket status filter' });
    if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid ticket priority filter' });
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { requestCode: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where,
      include: [{ model: User, as: 'Assignee', attributes: ['id', 'fullName', 'username'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const data = rows.map(serializeTicket);
    res.json({
      success: true,
      data,
      total: count,
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    next(error);
  }
};

const getTicket = async (req, res, next) => {
  const departmentId = getDepartmentId(req, res);
  if (!departmentId) return;

  try {
    const ticket = await ServiceRequest.findOne({
      where: { id: req.params.id, departmentId },
      include: [{ model: User, as: 'Assignee', attributes: ['id', 'fullName', 'username'] }],
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found in your department' });
    const comments = await findFollowUps([ticket.id]);
    res.json({ success: true, data: serializeTicket(ticket, comments) });
  } catch (error) {
    next(error);
  }
};

const listEscalatedTickets = async (req, res, next) => {
  const departmentId = getDepartmentId(req, res);
  if (!departmentId) return;

  try {
    await escalationService.runServiceRequestEscalation();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = { departmentId, escalated: true };
    const search = String(req.query.search || '').trim();
    const priority = String(req.query.priority || '').trim().toLowerCase();
    if (PRIORITIES.includes(priority)) where.priority = priority;
    if (search) {
      where[Op.or] = [
        { requestCode: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } },
        { escalationReason: { [Op.like]: `%${search}%` } },
      ];
    }
    const { count, rows } = await ServiceRequest.findAndCountAll({
      where,
      include: [{ model: User, as: 'Assignee', attributes: ['id', 'fullName', 'username'] }],
      order: [['escalatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const comments = await findFollowUps(rows.map((ticket) => ticket.id));
    const commentsByTicket = new Map();
    for (const comment of comments) {
      const ticketComments = commentsByTicket.get(comment.ticketId) || [];
      ticketComments.push(comment);
      commentsByTicket.set(comment.ticketId, ticketComments);
    }
    const data = rows.map((ticket) => serializeTicket(ticket, commentsByTicket.get(ticket.id) || []));
    return res.json({
      success: true,
      data,
      total: count,
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const addTicketFollowUp = async (req, res, next) => {
  const departmentId = getDepartmentId(req, res);
  if (!departmentId) return;
  const comment = String(req.body.comment || '').trim();
  if (!comment) return res.status(400).json({ success: false, message: 'A follow-up comment is required' });
  if (comment.length > 1000) return res.status(400).json({ success: false, message: 'Follow-up comments must be 1000 characters or fewer' });

  try {
    const ticket = await ServiceRequest.findOne({
      where: { id: req.params.id, departmentId, escalated: true },
      attributes: ['id'],
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Escalated ticket not found in your department' });
    const followUp = await SupportTicketComment.create({
      ticketId: ticket.id,
      userId: req.user.id,
      comment,
      commentType: 'PUBLIC_COMMENT',
    });
    const author = await User.findByPk(req.user.id, { attributes: ['id', 'fullName', 'username'] });
    return res.status(201).json({
      success: true,
      data: {
        id: followUp.id,
        comment: followUp.comment,
        createdAt: followUp.createdAt,
        author: author?.fullName || author?.username || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listTickets, listEscalatedTickets, getTicket, addTicketFollowUp, serializeTicket };
