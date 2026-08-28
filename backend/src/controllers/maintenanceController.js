const { Op } = require('sequelize');
const { sequelize, Maintenance, Asset, User, Assignment, AuditLog } = require('../models');

const managerRoles = ['admin', 'maintenance', 'ict_officer'];
const canManage = (req) => managerRoles.includes(req.user.role);
const include = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'status', 'condition', 'warrantyExpiry'] },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'department'] },
  { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
];
const normalize = (item) => {
  const data = item.toJSON();
  return { ...data, status: displayStatus(data.status), asset_id: data.assetId, requested_by: data.requestedBy, assigned_to: data.assignedTo, asset: item.Asset, asset_name: item.Asset?.name, asset_tag: item.Asset?.assetCode, requested_by_name: item.Requester?.fullName || item.Requester?.username, assigned_to_name: item.Technician?.fullName || item.Technician?.username, created_at: data.createdAt, updated_at: data.updatedAt };
};
const normalizeStatus = (status) => String(status || '').trim().toLowerCase().replace(/\s+/g, '-');
const displayStatus = (status) => ({ 'pending': 'Pending', 'approved': 'Approved', 'assigned': 'Assigned', 'in-progress': 'In Progress', 'waiting-for-parts': 'Waiting for Parts', 'testing': 'Testing', 'completed': 'Completed', 'rejected': 'Rejected', 'cancelled': 'Cancelled' }[status] || status);
const allowedTransitions = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['assigned', 'rejected', 'cancelled'],
  assigned: ['in-progress', 'cancelled'],
  'in-progress': ['waiting-for-parts', 'testing', 'completed'],
  'waiting-for-parts': ['in-progress', 'completed'],
  testing: ['in-progress', 'completed'],
  completed: [],
  rejected: [],
  cancelled: []
};

const getAllMaintenance = async (req, res, next) => {
  try { 
    const where = {}; 
    if (req.query.status) where.status = normalizeStatus(req.query.status); 
    if (req.query.priority) where.priority = String(req.query.priority).trim().toLowerCase();
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
        { '$Technician.fullName$': { [Op.like]: `%${search}%` } },
        { '$Technician.username$': { [Op.like]: `%${search}%` } },
        ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : [])
      ];
    }
    if (req.query.assigned_to) where.assignedTo = req.query.assigned_to; 
    if (req.query.scope === 'assigned' && req.user.role === 'maintenance') where.assignedTo = req.user.id;
    if (req.query.asset_id) where.assetId = req.query.asset_id;
      const scopedInclude = req.user.role === 'department_head' ? [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'status', 'condition', 'warrantyExpiry'], where: { department: req.user.department }, required: true }, include[1], include[2]] : include; 
      const items = await Maintenance.findAll({ where, include: scopedInclude, order: [['id', 'DESC']] }); 
    const requests = items.map(normalize); 
    res.json({ success: true, data: requests, requests, total: requests.length }); 
  } catch (error) { next(error); }
};

const createMaintenance = async (req, res, next) => {
  try { 
    const { asset_id, title, problem, description, priority = 'medium', requested_date, preferred_repair_date, estimated_cost } = req.body; 
    const requestTitle = title || problem;
    if (!asset_id || !requestTitle) return res.status(400).json({ success: false, message: 'Asset and problem are required' }); 
    const asset = await Asset.findByPk(asset_id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (req.user.role === 'department_head' && asset.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department authorization required' });
    const normalizedPriority = String(priority).toLowerCase();
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedPriority)) return res.status(400).json({ success: false, message: 'Invalid maintenance priority' });
    const requestDescription = String(description || problem || '').trim();
    if (!requestDescription) return res.status(400).json({ success: false, message: 'Maintenance description is required' });
    if (requested_date && Number.isNaN(Date.parse(requested_date))) return res.status(400).json({ success: false, message: 'Invalid requested date' });
    if (preferred_repair_date && Number.isNaN(Date.parse(preferred_repair_date))) return res.status(400).json({ success: false, message: 'Invalid preferred repair date' });
    if (estimated_cost !== undefined && (!Number.isFinite(Number(estimated_cost)) || Number(estimated_cost) < 0)) return res.status(400).json({ success: false, message: 'Estimated cost cannot be negative' });
    const duplicate = await Maintenance.findOne({ where: { assetId: asset_id, requestedBy: req.user.id, status: { [Op.in]: ['pending', 'approved', 'assigned', 'in-progress'] } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'An open maintenance request already exists for this asset' });
    const item = await Maintenance.create({ assetId: asset_id, requestedBy: req.user.id, title: requestTitle, description: requestDescription, priority: normalizedPriority });
    res.status(201).json({ success: true, data: normalize(item) }); 
  } catch (error) { next(error); }
};

const updateMaintenance = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ success: false, message: 'Maintenance authorization required' });
    const item = await Maintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    const previousStatus = item.status;
    const updates = {
      title: req.body.title ?? item.title,
      description: req.body.description ?? item.description,
      priority: String(req.body.priority ?? item.priority).toLowerCase(),
      assignedTo: req.body.assigned_to ?? item.assignedTo
    };
    if (!['low', 'medium', 'high', 'critical'].includes(updates.priority)) return res.status(400).json({ success: false, message: 'Invalid maintenance priority' });
    if (updates.assignedTo !== null && updates.assignedTo !== undefined && updates.assignedTo !== '') {
      const technician = await User.findOne({ where: { id: updates.assignedTo, active: true, role: 'maintenance' } });
      if (!technician) return res.status(400).json({ success: false, message: 'A valid active maintenance technician is required' });
      updates.assignedTo = technician.id;
    } else if (updates.assignedTo === '') updates.assignedTo = null;
    if (req.body.status) {
      const nextStatus = normalizeStatus(req.body.status);
      if (!allowedTransitions[item.status]?.includes(nextStatus)) return res.status(409).json({ success: false, message: `Invalid status transition from ${displayStatus(item.status)} to ${displayStatus(nextStatus)}` });
      updates.status = nextStatus;
    }
    await item.update(updates);
    if (updates.status && updates.status !== previousStatus) await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_STATUS_CHANGED', entity: `maintenance:${item.id}`, details: JSON.stringify({ requestId: item.id, assetId: item.assetId, previousStatus: displayStatus(previousStatus), newStatus: displayStatus(updates.status), comment: req.body.comment || req.body.notes || '' }) });
    res.json({ success: true, data: normalize(item) });
  } catch (error) { next(error); }
};
const setStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!canManage(req)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Maintenance authorization required' }); }
    const item = await Maintenance.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance request not found' }); }
    const status = normalizeStatus(req.body.status);
    const actualCost = req.body.actual_cost === undefined ? undefined : Number(req.body.actual_cost);
    if (actualCost !== undefined && (!Number.isFinite(actualCost) || actualCost < 0)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Actual cost cannot be negative' });
    }
    if (!['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'rejected', 'cancelled'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid maintenance status' });
    }
    if (!allowedTransitions[item.status]?.includes(status)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Invalid status transition from ${displayStatus(item.status)} to ${displayStatus(status)}` });
    }
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const previousStatus = item.status;
    await item.update({ status }, { transaction });
    if (status === 'in-progress') {
      await asset.update({ status: 'under-maintenance' }, { transaction });
    } else if (status === 'testing') {
      await asset.update({ status: 'testing' }, { transaction });
    } else if (status === 'completed') {
      const activeAssignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction });
      await asset.update({ status: activeAssignment ? 'assigned' : 'available' }, { transaction });
    }
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_STATUS_CHANGED', entity: `maintenance:${item.id}`, details: JSON.stringify({ requestId: item.id, assetId: item.assetId, previousStatus: displayStatus(previousStatus), newStatus: displayStatus(status), comment: req.body.comment || req.body.reason || req.body.notes || '', completion: status === 'completed' ? { resolution: req.body.resolution || '', partsUsed: req.body.parts_used || '', actualCost: actualCost || 0 } : undefined }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, data: normalize(item) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
const approve = (req, res, next) => { req.body.status = 'approved'; return setStatus(req, res, next); };
const reject = (req, res, next) => { req.body.status = 'rejected'; return setStatus(req, res, next); };
const start = (req, res, next) => { req.body.status = 'in-progress'; return setStatus(req, res, next); };
const complete = (req, res, next) => { req.body.status = 'completed'; return setStatus(req, res, next); };
const assign = (req, res, next) => { req.body.assigned_to = req.body.technician_id || req.body.assigned_to; req.body.status = 'assigned'; return updateMaintenance(req, res, next); };
const removeMaintenance = async (req, res, next) => { try { if (!canManage(req)) return res.status(403).json({ success: false, message: 'Maintenance authorization required' }); const deleted = await Maintenance.destroy({ where: { id: req.params.id } }); if (!deleted) return res.status(404).json({ success: false, message: 'Maintenance request not found' }); res.json({ success: true }); } catch (error) { next(error); } };
const dashboard = async (req, res, next) => { try { const items = await Maintenance.findAll(); const byStatus = items.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}); res.json({ success: true, data: { total: items.length, pending: byStatus.pending || 0, active: (byStatus.assigned || 0) + (byStatus['in-progress'] || 0), completed: byStatus.completed || 0, byStatus } }); } catch (error) { next(error); } };

module.exports = { getAllMaintenance, createMaintenance, updateMaintenance, setStatus, approve, reject, start, complete, assign, removeMaintenance, dashboard };
