const { Op } = require('sequelize');
const { sequelize, Maintenance, MaintenanceRepair, MaintenanceHistory, Asset, User, Assignment, AuditLog } = require('../models');
const { createEventNotification } = require('../services/notificationService');

const managerRoles = ['admin', 'maintenance', 'ict_officer', 'store_manager', 'infrastructure'];
const canManage = (req) => managerRoles.includes(req.user.role);
const infrastructureRoles = ['admin', 'infrastructure'];
const infrastructureAssetWhere = {
  [Op.or]: [
    { category: { [Op.like]: '%infrastructure%' } },
    { category: { [Op.like]: '%building%' } },
    { category: { [Op.like]: '%facility%' } },
    { category: { [Op.like]: '%electrical%' } },
    { category: { [Op.like]: '%generator%' } },
    { category: { [Op.like]: '%transformer%' } },
    { category: { [Op.like]: '%water%' } },
    { category: { [Op.like]: '%solar%' } },
    { category: { [Op.like]: '%ups%' } },
    { category: { [Op.like]: '%road%' } },
  ],
};
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
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {}; 
    const assetWhere = req.infrastructureScope ? infrastructureAssetWhere : undefined;
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
      const scopedInclude = req.user.role === 'college'
        ? [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'status', 'condition', 'warrantyExpiry'], where: { department: req.user.department }, required: true }, include[1], include[2]]
        : [{ ...include[0], ...(assetWhere ? { where: assetWhere, required: true } : {}) }, include[1], include[2]];
      const { count, rows: items } = await Maintenance.findAndCountAll({ where, include: scopedInclude, order: [['id', 'DESC']], limit, offset: (page - 1) * limit, distinct: true });
    const requests = items.map(normalize); 
    const summaryItems = await Maintenance.findAll({ where, include: scopedInclude, attributes: ['status', 'priority'], distinct: true });
    const summary = summaryItems.reduce((result, item) => {
      const itemStatus = normalizeStatus(item.status);
      result.total += 1;
      result[itemStatus] = (result[itemStatus] || 0) + 1;
      return result;
    }, { total: 0 });
    res.json({ success: true, data: requests, requests, total: count, summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getInfrastructureMaintenance = (req, res, next) => {
  req.infrastructureScope = true;
  return getAllMaintenance(req, res, next);
};

const getInfrastructureMaintenanceAssets = async (req, res, next) => {
  try {
    const assets = await Asset.findAll({ where: { ...infrastructureAssetWhere, status: { [Op.notIn]: ['disposed', 'Disposed'] } }, attributes: ['id', 'name', 'assetCode', 'category', 'location', 'department'], order: [['name', 'ASC']] });
    return res.json({ success: true, data: assets });
  } catch (error) { return next(error); }
};

const createMaintenance = async (req, res, next) => {
  try { 
    const { asset_id, title, problem, description, priority = 'medium', requested_date, preferred_repair_date } = req.body;
    const requestTitle = title || problem;
    if (!asset_id || !requestTitle) return res.status(400).json({ success: false, message: 'Asset and problem are required' }); 
    const asset = await Asset.findByPk(asset_id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (req.infrastructureScope && !infrastructureRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Infrastructure authorization required' });
    if (req.infrastructureScope && !(await Asset.findOne({ where: { id: asset_id, ...infrastructureAssetWhere } }))) return res.status(403).json({ success: false, message: 'Asset is outside the infrastructure scope' });
    if (req.user.role === 'college' && asset.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department authorization required' });
    const normalizedPriority = String(priority).toLowerCase();
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedPriority)) return res.status(400).json({ success: false, message: 'Invalid maintenance priority' });
    const requestDescription = String(description || problem || '').trim();
    if (!requestDescription) return res.status(400).json({ success: false, message: 'Maintenance description is required' });
    if (requested_date && Number.isNaN(Date.parse(requested_date))) return res.status(400).json({ success: false, message: 'Invalid requested date' });
    if (preferred_repair_date && Number.isNaN(Date.parse(preferred_repair_date))) return res.status(400).json({ success: false, message: 'Invalid preferred repair date' });
    const duplicate = await Maintenance.findOne({ where: { assetId: asset_id, requestedBy: req.user.id, status: { [Op.in]: ['pending', 'approved', 'assigned', 'in-progress'] } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'An open maintenance request already exists for this asset' });
    const item = await Maintenance.create({ assetId: asset_id, requestedBy: req.user.id, title: requestTitle, description: requestDescription, priority: normalizedPriority });
    const technicians = await User.findAll({ where: { active: true, role: 'maintenance' }, attributes: ['id'] });
    try {
      await createEventNotification({ event: 'maintenance_created', eventKey: `maintenance_created:${item.id}`, entityId: item.id, userIds: technicians.map((user) => user.id), senderId: req.user.id, assetId: asset.id, type: 'maintenance', title: 'Maintenance request created', message: `Maintenance request ${item.id} was created for ${asset.name || asset.assetCode}.` });
    } catch (notificationError) { console.error('Maintenance creation notification failed:', notificationError.message); }
    res.status(201).json({ success: true, data: normalize(item) }); 
  } catch (error) { next(error); }
};

const updateMaintenance = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ success: false, message: 'Maintenance authorization required' });
    const item = await Maintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    if (req.infrastructureScope && !(await Asset.findOne({ where: { id: item.assetId, ...infrastructureAssetWhere } }))) return res.status(403).json({ success: false, message: 'Maintenance record is outside the infrastructure scope' });
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
    if (updates.status && updates.status !== previousStatus) {
      try { await createEventNotification({ event: 'maintenance_status_changed', eventKey: `maintenance_status_changed:${item.id}:${updates.status}`, entityId: item.id, userIds: [item.requestedBy, item.assignedTo].filter(Boolean), senderId: req.user.id, assetId: item.assetId, type: 'maintenance', title: `Maintenance ${displayStatus(updates.status)}`, message: `Maintenance request ${item.id} is now ${displayStatus(updates.status)}.` }); } catch (notificationError) { console.error('Maintenance status notification failed:', notificationError.message); }
    }
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
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_STATUS_CHANGED', entity: `maintenance:${item.id}`, details: JSON.stringify({ requestId: item.id, assetId: item.assetId, previousStatus: displayStatus(previousStatus), newStatus: displayStatus(status), comment: req.body.comment || req.body.reason || req.body.notes || '', completion: status === 'completed' ? { resolution: req.body.resolution || '', partsUsed: req.body.parts_used || '' } : undefined }) }, { transaction });
    await transaction.commit();
    try { await createEventNotification({ event: 'maintenance_status_changed', eventKey: `maintenance_status_changed:${item.id}:${status}`, entityId: item.id, userIds: [item.requestedBy, item.assignedTo].filter(Boolean), senderId: req.user.id, assetId: item.assetId, type: 'maintenance', title: `Maintenance ${displayStatus(status)}`, message: `Maintenance request ${item.id} is now ${displayStatus(status)}.` }); } catch (notificationError) { console.error('Maintenance status notification failed:', notificationError.message); }
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
const removeMaintenance = async (req, res, next) => { try { if (!canManage(req)) return res.status(403).json({ success: false, message: 'Maintenance authorization required' }); const item = await Maintenance.findByPk(req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Maintenance request not found' }); if (req.infrastructureScope && !(await Asset.findOne({ where: { id: item.assetId, ...infrastructureAssetWhere } }))) return res.status(403).json({ success: false, message: 'Maintenance record is outside the infrastructure scope' }); await item.destroy(); res.json({ success: true }); } catch (error) { next(error); } };
const dashboard = async (req, res, next) => { try { const items = await Maintenance.findAll(); const byStatus = items.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}); res.json({ success: true, data: { total: items.length, pending: byStatus.pending || 0, active: (byStatus.assigned || 0) + (byStatus['in-progress'] || 0), completed: byStatus.completed || 0, byStatus } }); } catch (error) { next(error); } };

const repairInclude = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition', 'warrantyExpiry'] },
  { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
  { model: MaintenanceRepair, required: false, attributes: ['id', 'diagnosis', 'repairAction', 'partsUsed', 'totalCost', 'completionDate', 'notes'] },
];
const repairScope = (req) => req.user.collegeId ? { '$Asset.collegeId$': req.user.collegeId } : {};
const normalizeRepair = (item) => {
  const data = item.toJSON();
  const repair = data.MaintenanceRepairs?.[0] || data.MaintenanceRepair || {};
  return {
    ...data,
    repairId: `REP-${String(data.id).padStart(3, '0')}`,
    asset: data.Asset,
    assetTag: data.Asset?.assetCode,
    serialNumber: data.Asset?.serialNumber,
    technician: data.Technician?.fullName || data.Technician?.username || '',
    diagnosis: repair.diagnosis || '',
    repairAction: repair.repairAction || '',
    partsReplaced: repair.partsUsed || '',
    repairCost: Number(repair.totalCost || 0),
    completionDate: repair.completionDate || (data.status === 'completed' ? data.updatedAt : null),
    notes: repair.notes || '',
    status: displayStatus(data.status),
  };
};

const getRepairHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = {};
    if (req.query.status) where.status = normalizeStatus(req.query.status);
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [{ title: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }, { '$Asset.name$': { [Op.like]: `%${search}%` } }, { '$Asset.assetCode$': { [Op.like]: `%${search}%` } }, { '$Technician.fullName$': { [Op.like]: `%${search}%` } }, ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : [])];
    }
    const { count, rows } = await Maintenance.findAndCountAll({ where: { ...where, ...repairScope(req) }, include: repairInclude, distinct: true, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const statsRows = await Maintenance.findAll({ where: { ...where, ...repairScope(req) }, include: [{ model: Asset, attributes: [], required: true }, { model: MaintenanceRepair, required: false, attributes: ['totalCost'] }], attributes: ['status'], raw: true });
    const stats = statsRows.reduce((result, row) => { const status = normalizeStatus(row.status); result.totalRepairs += 1; result.totalRepairCost += Number(row['MaintenanceRepairs.totalCost'] || 0); if (status === 'completed') result.completedRepairs += 1; if (['assigned', 'in-progress', 'waiting-for-parts', 'testing'].includes(status)) result.activeRepairs += 1; if (status === 'waiting-for-parts') result.awaitingParts += 1; return result; }, { totalRepairs: 0, activeRepairs: 0, completedRepairs: 0, awaitingParts: 0, totalRepairCost: 0 });
    res.json({ success: true, records: rows.map(normalizeRepair), total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)), stats });
  } catch (error) { next(error); }
};

const getRepairDetails = async (req, res, next) => {
  try {
    const item = await Maintenance.findOne({ where: { id: req.params.id, ...repairScope(req) }, include: repairInclude });
    if (!item) return res.status(404).json({ success: false, message: 'Repair record not found' });
    const history = await MaintenanceHistory.findAll({ where: { maintenanceId: item.id }, order: [['actionDate', 'ASC']] });
    res.json({ success: true, data: { ...normalizeRepair(item), timeline: history } });
  } catch (error) { next(error); }
};

const createRepair = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { asset_id, problem, diagnosis = '', repair_action = '', parts_replaced = '', technician_id = null, vendor = '', cost = 0, repair_date, completion_date = null, status = 'pending', priority = 'medium', notes = '' } = req.body;
    if (!asset_id || !String(problem || '').trim()) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Asset and problem are required' }); }
    const numericCost = Number(cost);
    if (!Number.isFinite(numericCost) || numericCost < 0) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Repair cost must be a valid non-negative number' }); }
    if (!['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'cancelled'].includes(normalizeStatus(status))) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid repair status' }); }
    const asset = await Asset.findOne({ where: { id: asset_id, ...(req.user.collegeId ? { collegeId: req.user.collegeId } : {}) }, transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found in your college scope' }); }
    const item = await Maintenance.create({ assetId: asset.id, requestedBy: req.user.id, assignedTo: technician_id || null, title: String(problem).trim().slice(0, 255), description: String(problem).trim(), priority: String(priority).toLowerCase(), status: normalizeStatus(status) }, { transaction });
    await MaintenanceRepair.create({ maintenanceId: item.id, assetId: asset.id, technicianId: technician_id || null, problemDescription: problem, diagnosis, repairAction: repair_action, partsUsed: parts_replaced, totalCost: numericCost, completionDate: completion_date || null, notes, serviceCost: 0, laborCost: 0, partsCost: 0 }, { transaction });
    await MaintenanceHistory.create({ assetId: asset.id, maintenanceId: item.id, userId: req.user.id, actionType: 'created', description: 'Repair record created', newStatus: item.status }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'REPAIR_CREATED', entity: `maintenance:${item.id}`, details: JSON.stringify({ assetId: asset.id }) }, { transaction });
    await transaction.commit();
    const created = await Maintenance.findOne({ where: { id: item.id }, include: repairInclude });
    res.status(201).json({ success: true, data: normalizeRepair(created) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const updateRepair = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await Maintenance.findOne({ where: { id: req.params.id, ...repairScope(req) }, include: [{ model: MaintenanceRepair, required: false }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Repair record not found' }); }
    const repair = item.MaintenanceRepairs?.[0];
    const status = req.body.status ? normalizeStatus(req.body.status) : item.status;
    if (!['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'cancelled'].includes(status)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid repair status' }); }
    await item.update({ description: req.body.problem ?? item.description, title: String(req.body.problem ?? item.title).slice(0, 255), priority: String(req.body.priority ?? item.priority).toLowerCase(), status, assignedTo: req.body.technician_id ?? item.assignedTo }, { transaction });
    if (repair) await repair.update({ diagnosis: req.body.diagnosis ?? repair.diagnosis, repairAction: req.body.repair_action ?? repair.repairAction, partsUsed: req.body.parts_replaced ?? repair.partsUsed, totalCost: req.body.cost ?? repair.totalCost, completionDate: req.body.completion_date ?? repair.completionDate, notes: req.body.notes ?? repair.notes, technicianId: req.body.technician_id ?? repair.technicianId }, { transaction });
    await MaintenanceHistory.create({ assetId: item.assetId, maintenanceId: item.id, userId: req.user.id, actionType: 'updated', description: 'Repair record updated', newStatus: status }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'REPAIR_UPDATED', entity: `maintenance:${item.id}`, details: JSON.stringify({ status }) }, { transaction });
    await transaction.commit();
    const updated = await Maintenance.findOne({ where: { id: item.id }, include: repairInclude });
    res.json({ success: true, data: normalizeRepair(updated) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { getAllMaintenance, getInfrastructureMaintenance, getInfrastructureMaintenanceAssets, createMaintenance, updateMaintenance, setStatus, approve, reject, start, complete, assign, removeMaintenance, dashboard, getRepairHistory, getRepairDetails, createRepair, updateRepair };
