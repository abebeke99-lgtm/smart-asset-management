const express = require('express');
const { Maintenance, Asset, User } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const supportAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance')];

const statusToTicket = {
  pending: 'Open',
  approved: 'Open',
  assigned: 'Open',
  'in-progress': 'In Progress',
  testing: 'In Progress',
  completed: 'Resolved',
  rejected: 'Closed',
  cancelled: 'Closed'
};

const ticketToStatus = {
  open: 'pending',
  'in progress': 'in-progress',
  resolved: 'completed',
  closed: 'cancelled'
};

const serializeTicket = (item) => {
  const value = item.toJSON();
  return {
    id: value.id,
    ticket_id: `TKT-${String(value.id).padStart(5, '0')}`,
    problem: value.title || value.description || 'Support request',
    description: value.description || '',
    priority: value.priority,
    status: statusToTicket[value.status] || value.status,
    requester: item.Requester?.fullName || item.Requester?.username || '',
    requester_id: value.requestedBy,
    asset: item.Asset?.assetCode || item.Asset?.name || '',
    asset_id: value.assetId,
    assigned_to: item.Technician?.fullName || item.Technician?.username || '',
    assigned_to_id: value.assignedTo,
    created_at: value.createdAt,
    resolved_at: value.status === 'completed' ? value.updatedAt : null,
    resolution: value.status === 'completed' ? value.description || '' : null,
    notes: ''
  };
};

const include = [
  { model: Asset, attributes: ['assetCode', 'name'] },
  { model: User, as: 'Requester', attributes: ['username', 'fullName'] },
  { model: User, as: 'Technician', attributes: ['username', 'fullName'] }
];

router.get('/', ...supportAccess, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const records = await Maintenance.findAll({ include, order: [['createdAt', 'DESC']], limit });
    const tickets = records.map(serializeTicket);
    res.json({ success: true, data: tickets, tickets, total: tickets.length });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', ...supportAccess, async (req, res, next) => {
  try {
    const item = await Maintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Support ticket not found' });

    const requestedStatus = String(req.body.status || '').trim().toLowerCase();
    const nextStatus = ticketToStatus[requestedStatus] || requestedStatus;
    if (!Object.prototype.hasOwnProperty.call(statusToTicket, nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid support ticket status' });
    }

    await item.update({ status: nextStatus });
    const updated = await Maintenance.findByPk(item.id, { include });
    res.json({ success: true, data: serializeTicket(updated), ticket: serializeTicket(updated) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
