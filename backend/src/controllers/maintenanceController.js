const { Op, Sequelize } = require('sequelize');
const { sequelize, Maintenance, MaintenanceRepair, MaintenanceHistory, MaintenanceWorkOrder, PreventiveMaintenance, MaintenanceInspection, Asset, User, Assignment, AuditLog, Inventory, InventoryTransaction, Department, Supplier } = require('../models');
const { createEventNotification } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');

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
const normalizeStatus = (status) => String(status || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
const displayStatus = (status) => ({ 'pending': 'Pending', 'approved': 'Approved', 'assigned': 'Assigned', 'in-progress': 'In Progress', 'waiting-for-parts': 'Waiting for Parts', 'testing': 'Testing', 'completed': 'Completed', 'rejected': 'Rejected', 'cancelled': 'Cancelled' }[status] || status);
const normalizePreventiveStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/[_\s-]+/g, '-');
  const aliases = {
    pending: 'scheduled',
    due: 'due',
    overdue: 'overdue',
    'in-progress': 'in-progress',
    'waiting-for-parts': 'waiting-for-parts',
    'awaiting-testing': 'awaiting-testing',
    'awaiting-quality-control': 'awaiting-quality-control',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
    scheduled: 'scheduled',
    ready: 'scheduled',
  };
  return aliases[normalized] || normalized || 'scheduled';
};
const displayPreventiveStatus = (status) => ({
  scheduled: 'Scheduled',
  due: 'Due',
  overdue: 'Overdue',
  'in-progress': 'In Progress',
  'waiting-for-parts': 'Waiting for Parts',
  'awaiting-testing': 'Awaiting Testing',
  'awaiting-quality-control': 'Awaiting Quality Control',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}[normalizePreventiveStatus(status)] || 'Scheduled');
const buildPreventiveSummary = (rows = []) => rows.reduce((summary, row) => {
  const status = normalizePreventiveStatus(row.status || row.Status || 'scheduled');
  const dueDate = row.nextScheduleDate || row.scheduleDate || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueToday = dueDate && new Date(dueDate).toDateString() === today.toDateString();
  const isUpcoming = dueDate && new Date(dueDate).getTime() > today.getTime();
  const isOverdue = dueDate && new Date(dueDate).getTime() < today.getTime() && !['completed', 'cancelled', 'failed'].includes(status);
  summary.totalPreventiveTasks += 1;
  if (dueToday) summary.dueToday += 1;
  if (isUpcoming) summary.upcoming += 1;
  if (isOverdue) summary.overdue += 1;
  if (status === 'in-progress') summary.inProgress += 1;
  if (status === 'awaiting-testing') summary.awaitingTesting += 1;
  if (status === 'awaiting-quality-control') summary.awaitingQualityControl += 1;
  if (status === 'completed') summary.completed += 1;
  return summary;
}, {
  totalPreventiveTasks: 0,
  dueToday: 0,
  upcoming: 0,
  overdue: 0,
  inProgress: 0,
  awaitingTesting: 0,
  awaitingQualityControl: 0,
  completed: 0,
});
const parseDateLike = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const serializePreventiveItem = (item) => {
  const asset = item.Asset || {};
  const technician = item.Technician || null;
  const status = normalizePreventiveStatus(item.status || 'scheduled');
  const dueDate = item.nextScheduleDate || item.scheduleDate || item.dueDate || null;
  return {
    id: item.id,
    scheduleId: item.scheduleId || item.id,
    assetId: item.assetId,
    assetName: asset.name || asset.assetCode || 'Unknown asset',
    assetCode: asset.assetCode || '',
    serialNumber: asset.serialNumber || '',
    digitalId: asset.digitalId || '',
    category: asset.category || '',
    department: asset.department || '',
    location: asset.location || '',
    status,
    statusLabel: displayPreventiveStatus(status),
    maintenanceType: item.maintenanceType || 'Routine Maintenance',
    frequency: item.frequency || 'monthly',
    dueDate,
    nextScheduleDate: item.nextScheduleDate || item.scheduleDate || null,
    scheduleDate: item.scheduleDate || item.nextScheduleDate || null,
    assignedTechnician: technician ? (technician.fullName || technician.username || 'Unassigned') : 'Unassigned',
    technicianId: item.technicianId || null,
    priority: item.priority || 'medium',
    progress: item.progress || 0,
    startTime: item.startedAt || null,
    completionTime: item.completedAt || null,
    cost: Number(item.totalCost || item.estimatedCost || 0),
    checklist: item.checklist || '',
    notes: item.notes || '',
    description: item.description || item.notes || '',
    technician: technician ? (technician.fullName || technician.username || '') : '',
    asset: asset || null,
  };
};
const normalizeRepairStatus = (status) => {
  const normalized = normalizeStatus(status);
  const aliases = {
    pending: 'open',
    open: 'open',
    approved: 'assigned',
    assigned: 'assigned',
    diagnosing: 'diagnosing',
    'in-progress': 'in-progress',
    'waiting-for-parts': 'waiting-for-parts',
    testing: 'testing',
    completed: 'completed',
    failed: 'failed',
    rework: 'rework',
    cancelled: 'cancelled',
  };
  return aliases[normalized] || normalized;
};
const displayRepairStatus = (status) => ({
  open: 'Open',
  assigned: 'Assigned',
  diagnosing: 'Diagnosing',
  'in-progress': 'In Progress',
  'waiting-for-parts': 'Waiting for Parts',
  testing: 'Testing',
  completed: 'Completed',
  failed: 'Failed',
  rework: 'Rework',
  cancelled: 'Cancelled',
}[normalizeRepairStatus(status)] || displayStatus(status));
const repairStatusTransitions = {
  open: ['assigned', 'diagnosing', 'cancelled'],
  assigned: ['diagnosing', 'in-progress', 'waiting-for-parts', 'cancelled'],
  diagnosing: ['in-progress', 'waiting-for-parts', 'failed', 'rework', 'cancelled'],
  'in-progress': ['waiting-for-parts', 'testing', 'completed', 'failed', 'rework'],
  'waiting-for-parts': ['in-progress', 'assigned', 'diagnosing', 'rework', 'cancelled'],
  testing: ['completed', 'failed', 'rework'],
  completed: [],
  failed: ['rework', 'cancelled'],
  rework: ['in-progress', 'testing', 'failed', 'cancelled'],
  cancelled: [],
};
const buildRepairSummary = (rows = []) => {
  const stats = { totalRepairs: 0, open: 0, assigned: 0, diagnosing: 0, inProgress: 0, waitingForParts: 0, completed: 0, failed: 0, rework: 0, cancelled: 0, totalOpen: 0 };
  rows.forEach((row) => {
    const status = normalizeRepairStatus(row && (row.status || row.Status || row.statusRaw || row.newStatus));
    if (!status) return;
    stats.totalRepairs += 1;
    if (status === 'open') stats.open += 1;
    if (status === 'assigned') stats.assigned += 1;
    if (status === 'diagnosing') stats.diagnosing += 1;
    if (status === 'in-progress') stats.inProgress += 1;
    if (status === 'waiting-for-parts') stats.waitingForParts += 1;
    if (status === 'completed') stats.completed += 1;
    if (status === 'failed') stats.failed += 1;
    if (status === 'rework') stats.rework += 1;
    if (status === 'cancelled') stats.cancelled += 1;
    if (['open', 'assigned', 'diagnosing'].includes(status)) stats.totalOpen += 1;
  });
  return stats;
};
const normalizeLifecycleStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '-');
  const aliases = {
    'under-maintenance': 'in-repair',
    'under-maintenance-asset': 'in-repair',
    maintenance: 'in-repair',
    'in-maintenance': 'in-repair',
    'in-repair': 'in-repair',
    repair: 'in-repair',
    'awaiting-inspection': 'awaiting-inspection',
    'awaiting-inspection-asset': 'awaiting-inspection',
    'inspection-pending': 'awaiting-inspection',
    inspected: 'work-order-created',
    'work-order-created': 'work-order-created',
    'work-order': 'work-order-created',
    'waiting-for-parts': 'waiting-for-parts',
    'waiting-for-vendor': 'waiting-for-vendor',
    testing: 'testing',
    'quality-control': 'quality-control',
    'ready-for-return': 'ready-for-return',
    'returned-to-service': 'completed',
    completed: 'completed',
  };
  return aliases[normalized] || normalized;
};
const humanizeLifecycleStatus = (value) => {
  const map = {
    'awaiting-inspection': 'Awaiting Inspection',
    'work-order-created': 'Work Order Created',
    'in-repair': 'In Repair',
    'waiting-for-parts': 'Waiting for Parts',
    'waiting-for-vendor': 'Waiting for Vendor',
    testing: 'Testing',
    'quality-control': 'Quality Control',
    'ready-for-return': 'Ready for Return',
    completed: 'Completed',
  };
  return map[normalizeLifecycleStatus(value)] || String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};
const buildAssetMaintenanceSummary = (rows = []) => rows.reduce((summary, row) => {
  const status = normalizeLifecycleStatus(row.status || row.currentStatus || 'in-repair');
  summary.totalUnderMaintenance += 1;
  if (status === 'awaiting-inspection') summary.awaitingInspection += 1;
  if (status === 'in-repair') summary.inRepair += 1;
  if (status === 'waiting-for-parts') summary.waitingForParts += 1;
  if (status === 'testing' || status === 'quality-control') summary.testingQualityControl += 1;
  if (row.isOverdue || row.overdue === true) summary.overdue += 1;
  if (status === 'ready-for-return') summary.readyForReturn += 1;
  return summary;
}, {
  totalUnderMaintenance: 0,
  awaitingInspection: 0,
  inRepair: 0,
  waitingForParts: 0,
  testingQualityControl: 0,
  overdue: 0,
  readyForReturn: 0,
});
const validateAssetMaintenanceTransition = (currentStatus, nextStatus) => {
  const current = normalizeLifecycleStatus(currentStatus);
  const next = normalizeLifecycleStatus(nextStatus);
  const transitions = {
    'awaiting-inspection': ['in-repair', 'waiting-for-parts', 'waiting-for-vendor', 'testing', 'quality-control', 'ready-for-return'],
    'work-order-created': ['in-repair', 'waiting-for-parts', 'waiting-for-vendor', 'testing', 'quality-control'],
    'in-repair': ['waiting-for-parts', 'waiting-for-vendor', 'testing', 'quality-control', 'ready-for-return'],
    'waiting-for-parts': ['in-repair', 'waiting-for-vendor'],
    'waiting-for-vendor': ['in-repair', 'testing'],
    testing: ['quality-control', 'ready-for-return'],
    'quality-control': ['ready-for-return', 'in-repair'],
    'ready-for-return': ['completed'],
  };
  return Boolean(transitions[current] && transitions[current].includes(next));
};
const normalizeWorkOrderStatus = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
const displayWorkOrderStatus = (status) => ({
  draft: 'Draft',
  open: 'Open',
  pending: 'Open',
  assigned: 'Assigned',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}[normalizeWorkOrderStatus(status)] || displayStatus(status));
const displayPriority = (priority) => ({ low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }[String(priority || '').toLowerCase()] || 'Medium');
const periodStart = (period) => {
  const days = { today: 1, '7days': 7, '30days': 30, '90days': 90 }[period];
  if (!days) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return start;
};
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

const workOrderStatusTransitions = {
  draft: ['open', 'cancelled'],
  open: ['assigned', 'in-progress', 'on-hold', 'cancelled'],
  pending: ['open', 'assigned', 'in-progress', 'cancelled'],
  assigned: ['in-progress', 'on-hold', 'cancelled'],
  'in-progress': ['on-hold', 'completed', 'cancelled'],
  'on-hold': ['assigned', 'in-progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

const normalizeMaintenanceWorkOrder = (item) => {
  const data = item && typeof item.toJSON === 'function' ? item.toJSON() : (item || {});
  const asset = item?.Asset || data?.Asset || {};
  const maintenance = item?.Maintenance || data?.Maintenance || {};
  const technician = item?.Technician || data?.Technician || null;
  const statusKey = normalizeWorkOrderStatus(data.status || item?.status || 'open');
  const rawPriority = String(data.priority || item?.priority || 'medium').toLowerCase();
  const progress = Number(data.progress ?? item?.progress ?? (statusKey === 'completed' ? 100 : statusKey === 'in-progress' ? 50 : statusKey === 'on-hold' ? 40 : statusKey === 'assigned' ? 25 : statusKey === 'draft' ? 10 : 15));

  return {
    ...data,
    ...item,
    id: data.id ?? item?.id,
    workOrderNumber: data.workOrderNumber || item?.workOrderNumber || `WO-${String(data.id ?? item?.id ?? Date.now()).padStart(4, '0')}`,
    assetId: data.assetId ?? item?.assetId,
    assetName: asset.name || data.assetName || 'Unassigned asset',
    assetCode: asset.assetCode || data.assetCode || '',
    serialNumber: asset.serialNumber || data.serialNumber || '',
    category: asset.category || data.category || '',
    location: asset.location || data.location || '',
    currentStatus: asset.status || data.currentStatus || '',
    maintenanceId: data.maintenanceId ?? item?.maintenanceId ?? null,
    maintenanceType: data.maintenanceType || maintenance.title || data.title || 'Maintenance',
    title: data.title || maintenance.title || data.problemDescription || item?.problemDescription || 'Maintenance work order',
    description: data.problemDescription || data.description || maintenance.description || '',
    priority: displayPriority(rawPriority),
    priorityRaw: rawPriority,
    priorityLabel: displayPriority(rawPriority),
    technician: technician?.fullName || technician?.username || data.technician || 'Unassigned',
    technicianId: data.technicianId ?? item?.technicianId ?? null,
    requestedDate: data.requestedDate || item?.requestedDate || data.createdAt || item?.createdAt || null,
    scheduledDate: data.scheduledDate || item?.scheduledDate || data.startDate || item?.startDate || null,
    dueDate: data.dueDate || item?.dueDate || data.expectedCompletionDate || item?.expectedCompletionDate || null,
    completedDate: data.completedDate || item?.completedDate || data.actualCompletionDate || item?.actualCompletionDate || null,
    status: displayWorkOrderStatus(statusKey),
    statusRaw: statusKey,
    progress,
    estimatedHours: Number(data.estimatedHours ?? item?.estimatedHours ?? 0),
    estimatedCost: Number(data.estimatedCost ?? item?.estimatedCost ?? 0),
    actualCost: Number(data.actualCost ?? item?.actualCost ?? 0),
    createdAt: data.createdAt || item?.createdAt,
    updatedAt: data.updatedAt || item?.updatedAt,
  };
};

const getMaintenanceWorkOrderSummary = (rows = []) => {
  const normalized = rows.map((row) => normalizeMaintenanceWorkOrder(row));
  return normalized.reduce((summary, row) => {
    const status = normalizeWorkOrderStatus(row.statusRaw || row.status || 'open');
    summary.total += 1;
    if (['open', 'pending', 'draft'].includes(status)) summary.open += 1;
    if (status === 'in-progress') summary.inProgress += 1;
    if (status === 'on-hold') summary.onHold += 1;
    if (status === 'completed') summary.completed += 1;
    if (status === 'open' && row.dueDate && new Date(row.dueDate).getTime() < Date.now()) summary.overdue += 1;
    return summary;
  }, { total: 0, open: 0, inProgress: 0, onHold: 0, completed: 0, overdue: 0 });
};

const getPreventiveMaintenance = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const where = {};
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const department = String(req.query.department || '').trim();
    const technician = String(req.query.technician || '').trim();
    const assetId = req.query.assetId || req.query.asset_id || null;
    if (status) where.status = normalizePreventiveStatus(status);
    if (assetId) where.assetId = Number(assetId);
    if (department) where['$Asset.department$'] = department;
    if (technician) where['$Technician.fullName$'] = { [Op.like]: `%${technician}%` };
    if (search) {
      const needle = `%${search}%`;
      where[Op.or] = [
        { id: Number.isInteger(Number(search)) ? Number(search) : undefined },
        { maintenanceType: { [Op.like]: needle } },
        { '$Asset.name$': { [Op.like]: needle } },
        { '$Asset.assetCode$': { [Op.like]: needle } },
        { '$Asset.serialNumber$': { [Op.like]: needle } },
        { '$Asset.digitalId$': { [Op.like]: needle } },
        { '$Technician.fullName$': { [Op.like]: needle } },
        { '$Technician.username$': { [Op.like]: needle } },
        { '$Asset.department$': { [Op.like]: needle } },
        { '$Asset.location$': { [Op.like]: needle } },
      ].filter((part) => part !== undefined);
    }
    const { count, rows } = await PreventiveMaintenance.findAndCountAll({
      where,
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'digitalId', 'category', 'department', 'location', 'status', 'condition'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
      ],
      order: [['nextScheduleDate', 'ASC'], ['scheduleDate', 'ASC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const data = rows.map(serializePreventiveItem);
    const summary = buildPreventiveSummary(data);
    const filters = {
      statuses: ['Scheduled', 'Due', 'Overdue', 'In Progress', 'Waiting for Parts', 'Awaiting Testing', 'Awaiting Quality Control', 'Completed', 'Failed', 'Cancelled'],
      maintenanceTypes: ['Inspection', 'Cleaning', 'Calibration', 'Lubrication', 'Software Maintenance', 'Hardware Maintenance', 'Safety Check', 'Routine Maintenance'],
      departments: [...new Set(data.map((row) => row.department).filter(Boolean))].sort(),
      technicians: [...new Set(data.map((row) => row.assignedTechnician).filter(Boolean))].sort(),
    };
    return res.json({ success: true, data, summary, filters, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) {
    return next(error);
  }
};

const getPreventiveMaintenanceById = async (req, res, next) => {
  try {
    const item = await PreventiveMaintenance.findOne({
      where: { id: req.params.id },
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'digitalId', 'category', 'department', 'location', 'status', 'condition'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
      ],
    });
    if (!item) return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' });
    const data = serializePreventiveItem(item);
    const checklist = item.checklist ? String(item.checklist).split(/\n|\r\n|\|/).filter(Boolean) : [];
    return res.json({ success: true, data: { ...data, checklist, assetInfo: data.asset, scheduleInfo: { frequency: item.frequency || 'monthly', previousMaintenance: item.lastCompletedDate || null, currentDueDate: item.nextScheduleDate || item.scheduleDate || null, nextDueDate: item.nextScheduleDate || item.scheduleDate || null, priority: item.priority || 'medium' }, maintenanceInfo: { maintenanceType: item.maintenanceType || 'Routine Maintenance', description: item.notes || '', instructions: item.notes || '', assignedTechnician: data.assignedTechnician, status: data.status, startTime: item.startedAt || null, expectedDuration: null, actualDuration: null } } });
  } catch (error) {
    return next(error);
  }
};

const createPreventiveMaintenance = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const assetId = Number(req.body.assetId ?? req.body.asset_id);
    if (!assetId) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset is required' }); }
    const asset = await Asset.findByPk(assetId, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const technicianId = req.body.technicianId ?? req.body.technician_id ?? null;
    const scheduledDate = parseDateLike(req.body.scheduleDate || req.body.schedule_date || req.body.dueDate || new Date());
    const nextScheduleDate = parseDateLike(req.body.nextScheduleDate || req.body.next_schedule_date || scheduledDate);
    const status = normalizePreventiveStatus(req.body.status || 'scheduled');
    const item = await PreventiveMaintenance.create({
      assetId: asset.id,
      maintenanceType: String(req.body.maintenanceType || req.body.type || 'Routine Maintenance').trim() || 'Routine Maintenance',
      scheduleDate: scheduledDate || new Date(),
      nextScheduleDate: nextScheduleDate || scheduledDate || new Date(),
      frequency: String(req.body.frequency || 'monthly').trim().toLowerCase() || 'monthly',
      technicianId: technicianId ? Number(technicianId) : null,
      checklist: typeof req.body.checklist === 'string' ? req.body.checklist : JSON.stringify(req.body.checklist || []),
      estimatedCost: Number(req.body.estimatedCost || 0),
      notes: String(req.body.notes || req.body.description || '').trim(),
      status,
      lastCompletedDate: req.body.lastCompletedDate || null,
      priority: String(req.body.priority || 'medium').toLowerCase(),
      startedAt: status === 'in-progress' ? new Date() : null,
      completedAt: status === 'completed' ? new Date() : null,
      description: String(req.body.description || req.body.notes || '').trim(),
    }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_PREVENTIVE_MAINTENANCE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ assetId: asset.id, status, maintenanceType: item.maintenanceType }) }, { transaction });
    await transaction.commit();
    const created = await PreventiveMaintenance.findByPk(item.id, { include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'digitalId', 'category', 'department', 'location', 'status', 'condition'] }, { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] }] });
    res.status(201).json({ success: true, data: serializePreventiveItem(created) });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const startPreventiveMaintenance = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await PreventiveMaintenance.findOne({ where: { id: req.params.id }, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'status', 'department', 'location'] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' }); }
    const activeStatuses = ['scheduled', 'due', 'overdue', 'in-progress', 'waiting-for-parts', 'awaiting-testing', 'awaiting-quality-control'];
    const duplicate = await PreventiveMaintenance.findOne({ where: { assetId: item.assetId, status: { [Op.in]: activeStatuses }, scheduleDate: item.scheduleDate, id: { [Op.ne]: item.id } }, transaction });
    if (duplicate) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Another active preventive maintenance record already exists for this asset and schedule.' }); }
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const technicianId = req.body.technicianId ?? req.body.technician_id ?? item.technicianId;
    const updated = await item.update({ status: 'in-progress', technicianId: technicianId || item.technicianId, startedAt: new Date() }, { transaction });
    await asset.update({ status: 'under-maintenance' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'START_PREVENTIVE_MAINTENANCE', entity: `preventive_maintenance:${updated.id}`, details: JSON.stringify({ assetId: asset.id, technicianId: updated.technicianId }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serializePreventiveItem(updated) });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const pausePreventiveMaintenance = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await PreventiveMaintenance.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' }); }
    const previousStatus = item.status;
    const pausedStatus = normalizePreventiveStatus(req.body.status || 'waiting-for-parts');
    await item.update({ status: pausedStatus, notes: [item.notes, req.body.reason ? `Pause reason: ${req.body.reason}` : ''].filter(Boolean).join('\n') }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'PAUSE_PREVENTIVE_MAINTENANCE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ previousStatus, newStatus: pausedStatus, reason: req.body.reason || '' }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serializePreventiveItem(item) });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const resumePreventiveMaintenance = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await PreventiveMaintenance.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' }); }
    const previousStatus = item.status;
    await item.update({ status: 'in-progress', startedAt: item.startedAt || new Date() }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'RESUME_PREVENTIVE_MAINTENANCE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ previousStatus, newStatus: 'in-progress' }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serializePreventiveItem(item) });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const assignPreventiveMaintenance = async (req, res, next) => {
  try {
    const item = await PreventiveMaintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' });
    const technicianId = Number(req.body.technicianId ?? req.body.technician_id);
    if (!technicianId) return res.status(400).json({ success: false, message: 'A valid technician is required' });
    const technician = await User.findOne({ where: { id: technicianId, role: 'maintenance', active: true } });
    if (!technician) return res.status(404).json({ success: false, message: 'Technician not found' });
    await item.update({ technicianId, status: normalizePreventiveStatus(item.status || 'scheduled') });
    await AuditLog.create({ userId: req.user.id, action: 'ASSIGN_PREVENTIVE_MAINTENANCE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ technicianId, assignedBy: req.user.id }) });
    return res.json({ success: true, data: serializePreventiveItem(item) });
  } catch (error) { return next(error); }
};

const updatePreventiveChecklist = async (req, res, next) => {
  try {
    const item = await PreventiveMaintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' });
    const checklist = Array.isArray(req.body.checklist) ? req.body.checklist : (typeof req.body.checklist === 'string' ? req.body.checklist : item.checklist);
    await item.update({ checklist: Array.isArray(checklist) ? JSON.stringify(checklist) : String(checklist) });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_PREVENTIVE_CHECKLIST', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ checklistCount: Array.isArray(checklist) ? checklist.length : 0 }) });
    return res.json({ success: true, data: serializePreventiveItem(item) });
  } catch (error) { return next(error); }
};

const updatePreventiveFindings = async (req, res, next) => {
  try {
    const item = await PreventiveMaintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' });
    const notes = String(req.body.notes || req.body.findings || '').trim();
    await item.update({ notes: notes || item.notes, status: normalizePreventiveStatus(item.status || 'scheduled') });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_PREVENTIVE_FINDINGS', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ findings: notes }) });
    return res.json({ success: true, data: serializePreventiveItem(item) });
  } catch (error) { return next(error); }
};

const completePreventiveMaintenance = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await PreventiveMaintenance.findOne({ where: { id: req.params.id }, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'status', 'department', 'location'] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Preventive maintenance record not found' }); }
    const checklistValue = String(item.checklist || '');
    const checklistCount = checklistValue ? checklistValue.split(/\n|\r\n|\|/).filter(Boolean).length : 0;
    if (checklistCount > 0 && !checklistValue.includes('true') && !checklistValue.includes('completed')) {
      await transaction.rollback();
      return res.status(422).json({ success: false, message: 'Checklist completion is required before finishing the preventive maintenance record.' });
    }
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const completedAt = new Date();
    const nextDue = item.nextScheduleDate || item.scheduleDate || new Date();
    await item.update({ status: 'completed', completedAt, notes: String(req.body.notes || item.notes || '').trim() || item.notes, lastCompletedDate: completedAt, nextScheduleDate: nextDue }, { transaction });
    await asset.update({ status: 'available' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'COMPLETE_PREVENTIVE_MAINTENANCE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ assetId: asset.id, completedAt: completedAt.toISOString() }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serializePreventiveItem(item) });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const getAllMaintenance = async (req, res, next) => {
  try { 
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {}; 
    const assetWhere = req.infrastructureScope ? infrastructureAssetWhere : undefined;
    const createdAfter = periodStart(String(req.query.period || '').toLowerCase());
    if (createdAfter) where.createdAt = { [Op.gte]: createdAfter };
    if (req.query.status) where.status = normalizeStatus(req.query.status); 
    if (req.query.priority) where.priority = String(req.query.priority).trim().toLowerCase();
    if (req.query.department) where['$Asset.department$'] = String(req.query.department).trim();
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

const getAssetsUnderMaintenance = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const departmentFilter = String(req.query.department || '').trim();
    const locationFilter = String(req.query.location || '').trim();
    const technicianFilter = String(req.query.technician || '').trim();

    const activeAssetStatuses = ['under-maintenance', 'under maintenance', 'in-repair', 'damaged', 'testing', 'quality-control', 'waiting-for-parts', 'waiting-for-vendor', 'ready-for-return', 'awaiting-inspection'];
    const activeMaintenanceStatuses = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'waiting-for-vendor', 'testing'];

    const [assetRows, maintenanceRows] = await Promise.all([
      Asset.findAll({
        where: { status: { [Op.in]: activeAssetStatuses } },
        attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition', 'quantity', 'digitalId', 'purchaseDate', 'warrantyExpiry', 'updatedAt'],
        include: [{ model: Maintenance, limit: 1, order: [['createdAt', 'DESC']], include: [{ model: MaintenanceWorkOrder, order: [['createdAt', 'DESC']], limit: 1 }, { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username', 'department'] }] }],
        order: [['updatedAt', 'DESC']],
      }),
      Maintenance.findAll({
        where: { status: { [Op.in]: activeMaintenanceStatuses } },
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition', 'quantity', 'digitalId', 'purchaseDate', 'warrantyExpiry', 'updatedAt'] },
          { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username', 'department'] },
          { model: MaintenanceWorkOrder, limit: 1, order: [['createdAt', 'DESC']] },
        ],
        order: [['updatedAt', 'DESC']],
      }),
    ]);

    const mapRow = (item, asset = item.Asset) => {
      const workOrder = Array.isArray(item.MaintenanceWorkOrders) ? item.MaintenanceWorkOrders[0] : (item.WorkOrder || item.MaintenanceWorkOrder || null);
      const assetStatus = normalizeLifecycleStatus(asset?.status || item.status || 'in-repair');
      const startDate = workOrder?.startDate || item.createdAt || asset?.updatedAt || null;
      const expectedDate = workOrder?.expectedCompletionDate || null;
      const now = new Date();
      const overdue = Boolean(expectedDate && new Date(expectedDate).getTime() < now.getTime() && !['completed', 'ready-for-return'].includes(assetStatus));
      return {
        id: item.id || asset.id,
        assetId: item.assetId || asset.id,
        assetName: asset?.name || item.assetName || 'Unknown asset',
        assetCode: asset?.assetCode || item.assetCode || '',
        serialNumber: asset?.serialNumber || item.serialNumber || '',
        category: asset?.category || item.category || '',
        department: asset?.department || '',
        location: asset?.location || '',
        condition: asset?.condition || 'Unknown',
        status: assetStatus,
        displayStatus: humanizeLifecycleStatus(assetStatus),
        priority: item.priority || 'medium',
        problem: item.description || item.title || 'No problem captured',
        technician: item.Technician?.fullName || item.Technician?.username || workOrder?.Technician?.fullName || '',
        technicianId: item.assignedTo || workOrder?.technicianId || null,
        maintenanceRequestId: item.id || null,
        workOrderNumber: workOrder?.workOrderNumber || 'N/A',
        workOrderId: workOrder?.id || null,
        maintenanceType: item.MaintenanceType || 'Corrective',
        startDate,
        expectedCompletionDate: expectedDate,
        lastUpdated: item.updatedAt || asset?.updatedAt || null,
        actualCost: Number(workOrder?.actualCost || 0),
        downtimeHours: startDate ? Math.max(0, Math.round(((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60)) * 10) / 10) : 0,
        isOverdue: overdue,
        digitalId: asset?.digitalId || '',
        quantity: asset?.quantity || 1,
        purchaseDate: asset?.purchaseDate || null,
        warrantyExpiry: asset?.warrantyExpiry || null,
      };
    };

    const maintenanceRowsMapped = maintenanceRows.map((item) => mapRow(item, item.Asset));
    const assetRowsMapped = assetRows
      .filter((asset) => !maintenanceRowsMapped.some((row) => Number(row.assetId) === Number(asset.id)))
      .map((asset) => {
        const latestMaintenance = Array.isArray(asset.Maintenances) ? asset.Maintenances[0] : null;
        if (!latestMaintenance) return null;
        return mapRow(latestMaintenance, asset);
      })
      .filter(Boolean);

    let mergedRows = [...maintenanceRowsMapped, ...assetRowsMapped];
    if (statusFilter) {
      const target = normalizeLifecycleStatus(statusFilter);
      mergedRows = mergedRows.filter((row) => normalizeLifecycleStatus(row.status) === target);
    }
    if (departmentFilter) {
      mergedRows = mergedRows.filter((row) => String(row.department || '').toLowerCase().includes(departmentFilter.toLowerCase()));
    }
    if (locationFilter) {
      mergedRows = mergedRows.filter((row) => String(row.location || '').toLowerCase().includes(locationFilter.toLowerCase()));
    }
    if (technicianFilter) {
      mergedRows = mergedRows.filter((row) => String(row.technician || '').toLowerCase().includes(technicianFilter.toLowerCase()));
    }
    if (search) {
      const needle = search.toLowerCase();
      mergedRows = mergedRows.filter((row) => [row.assetName, row.assetCode, row.serialNumber, row.department, row.location, row.workOrderNumber, row.technician, row.problem].some((value) => String(value || '').toLowerCase().includes(needle)));
    }

    const total = mergedRows.length;
    const paginated = mergedRows.slice((page - 1) * limit, page * limit);
    const summary = buildAssetMaintenanceSummary(mergedRows);

    return res.json({ success: true, data: paginated, summary, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { next(error); }
};

const getAssetMaintenanceDetail = async (req, res, next) => {
  try {
    const identifier = Number(req.params.id);
    const maintenance = await Maintenance.findOne({
      where: identifier ? { [Op.or]: [{ id: identifier }, { assetId: identifier }] } : { id: req.params.id },
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition', 'quantity', 'digitalId', 'purchaseDate', 'warrantyExpiry'] },
        { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username', 'department'] },
        { model: User, as: 'Requester', attributes: ['id', 'fullName', 'username', 'department'] },
        { model: MaintenanceWorkOrder, order: [['createdAt', 'DESC']], limit: 1, include: [{ model: User, as: 'Technician', attributes: ['id', 'fullName', 'username', 'department'] }] },
        { model: MaintenanceInspection, order: [['inspectionDate', 'DESC']], limit: 20 },
        { model: MaintenanceHistory, order: [['actionDate', 'DESC']], limit: 50 },
      ],
      order: [['updatedAt', 'DESC']],
    });
    if (!maintenance) return res.status(404).json({ success: false, message: 'Asset under maintenance record not found' });
    const workOrder = Array.isArray(maintenance.MaintenanceWorkOrders) ? maintenance.MaintenanceWorkOrders[0] : null;
    const latestInspection = Array.isArray(maintenance.MaintenanceInspections) ? maintenance.MaintenanceInspections[0] : null;
    const asset = maintenance.Asset;
    const row = {
      id: maintenance.id,
      assetId: asset.id,
      assetName: asset.name,
      assetCode: asset.assetCode,
      serialNumber: asset.serialNumber,
      category: asset.category,
      department: asset.department,
      location: asset.location,
      condition: asset.condition,
      assetStatus: asset.status,
      digitalId: asset.digitalId,
      purchaseDate: asset.purchaseDate,
      warrantyExpiry: asset.warrantyExpiry,
      status: normalizeLifecycleStatus(maintenance.status || asset.status || 'in-repair'),
      displayStatus: humanizeLifecycleStatus(maintenance.status || asset.status || 'in-repair'),
      priority: maintenance.priority || 'medium',
      title: maintenance.title,
      description: maintenance.description,
      technician: maintenance.Technician?.fullName || maintenance.Technician?.username || '',
      technicianId: maintenance.assignedTo || workOrder?.technicianId || null,
      workOrderNumber: workOrder?.workOrderNumber || 'N/A',
      workOrderStatus: workOrder?.status || 'pending',
      expectedCompletionDate: workOrder?.expectedCompletionDate || null,
      startDate: workOrder?.startDate || maintenance.createdAt || null,
      actualCompletionDate: workOrder?.actualCompletionDate || null,
      downtimeHours: workOrder?.startDate ? Math.max(0, Math.round(((Date.now() - new Date(workOrder.startDate).getTime()) / (1000 * 60 * 60)) * 10) / 10) : 0,
      inspection: latestInspection ? { ...latestInspection.toJSON(), findings: latestInspection.observedProblem || latestInspection.inspectionNotes || '' } : null,
      history: maintenance.MaintenanceHistories || [],
      workOrder: workOrder ? workOrder.toJSON() : null,
    };
    return res.json({ success: true, data: row });
  } catch (error) { next(error); }
};

const sumNumber = (value) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildMaintenanceHistoryRows = ({ maintenanceRows = [], workOrderRows = [], repairRows = [], preventiveRows = [], testRows = [], qcRows = [], costRows = [] }) => {
  const toMaintenanceKey = (value) => Number(value ?? 0) || null;
  const recordFromMaintenance = (item) => {
    const asset = item.Asset || {};
    const workOrder = workOrderRows.find((row) => toMaintenanceKey(row.maintenanceId) === toMaintenanceKey(item.id)) || null;
    const repair = repairRows.find((row) => toMaintenanceKey(row.maintenanceId) === toMaintenanceKey(item.id)) || null;
    const test = testRows.find((row) => toMaintenanceKey(row.maintenanceId) === toMaintenanceKey(item.id)) || null;
    const qc = qcRows.find((row) => toMaintenanceKey(row.maintenanceId) === toMaintenanceKey(item.id)) || null;
    const maintenanceCosts = costRows.filter((row) => toMaintenanceKey(row.maintenanceId) === toMaintenanceKey(item.id));
    const partsCost = maintenanceCosts.filter((row) => /part|spare|material/i.test(String(row.costCategory || ''))).reduce((total, row) => total + sumNumber(row.amount), 0);
    const laborCost = maintenanceCosts.filter((row) => /labor|service|technician/i.test(String(row.costCategory || ''))).reduce((total, row) => total + sumNumber(row.amount), 0);
    const totalCost = repair ? sumNumber(repair.totalCost) || maintenanceCosts.reduce((total, row) => total + sumNumber(row.amount), 0) : maintenanceCosts.reduce((total, row) => total + sumNumber(row.amount), 0);
    const technician = item.Technician?.fullName || item.Technician?.username || workOrder?.Technician?.fullName || repair?.Technician?.fullName || 'Unassigned';
    const maintenanceType = workOrder ? 'Corrective' : repair ? 'Repair' : (item.title || '').toLowerCase().includes('preventive') ? 'Preventive' : 'Corrective';
    const startDate = workOrder?.startDate || item.createdAt || null;
    const completionDate = [workOrder?.actualCompletionDate, repair?.completionDate, item.updatedAt].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
    const durationHours = startDate && completionDate ? ((new Date(completionDate) - new Date(startDate)) / (1000 * 60 * 60)) : 0;
    return {
      id: item.id,
      historyId: `MAINT-${String(item.id).padStart(5, '0')}`,
      maintenanceId: item.id,
      assetId: item.assetId,
      assetName: asset.name || 'Unknown asset',
      serialNumber: asset.serialNumber || '',
      department: asset.department || '',
      location: asset.location || '',
      maintenanceType,
      workOrder: workOrder?.workOrderNumber || '',
      technician,
      vendor: '',
      startDate: startDate || null,
      completionDate: completionDate || null,
      duration: durationHours > 0 ? `${Number(durationHours).toFixed(2)} hours` : '0.00 hours',
      status: displayStatus(normalizeStatus(item.status || workOrder?.status || repair?.status || 'completed')),
      testResult: test?.overallResult || test?.functionalResult || test?.qualityResult || '',
      qcResult: qc?.decision || qc?.status || '',
      partsCost: Number(partsCost || 0),
      laborCost: Number(laborCost || 0),
      totalCost: Number(totalCost || 0),
      assetCategory: asset.category || '',
      assetStatus: asset.status || '',
      source: 'maintenance',
      summary: repair?.repairAction || workOrder?.requiredWork || item.title || 'Maintenance activity',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  };

  const rows = maintenanceRows.map(recordFromMaintenance);

  preventiveRows.forEach((item) => {
    const asset = item.Asset || {};
    const startDate = item.scheduleDate || item.createdAt || null;
    const completionDate = item.lastCompletedDate || item.completedAt || item.updatedAt || null;
    const durationHours = startDate && completionDate ? ((new Date(completionDate) - new Date(startDate)) / (1000 * 60 * 60)) : 0;
    rows.push({
      id: item.id,
      historyId: `PM-${String(item.id).padStart(5, '0')}`,
      maintenanceId: item.id,
      assetId: item.assetId,
      assetName: asset.name || 'Unknown asset',
      serialNumber: asset.serialNumber || '',
      department: asset.department || '',
      location: asset.location || '',
      maintenanceType: String(item.maintenanceType || 'Preventive').trim() || 'Preventive',
      workOrder: '',
      technician: item.Technician?.fullName || item.Technician?.username || 'Unassigned',
      vendor: '',
      startDate,
      completionDate,
      duration: durationHours > 0 ? `${Number(durationHours).toFixed(2)} hours` : '0.00 hours',
      status: displayPreventiveStatus(normalizePreventiveStatus(item.status || 'completed')),
      testResult: '',
      qcResult: '',
      partsCost: 0,
      laborCost: 0,
      totalCost: Number(item.estimatedCost || 0),
      assetCategory: asset.category || '',
      assetStatus: asset.status || '',
      source: 'preventive',
      summary: item.notes || item.checklist || 'Preventive maintenance activity',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  });

  repairRows.forEach((item) => {
    const asset = item.Asset || {};
    const workOrder = item.WorkOrder || null;
    const maintenanceKey = toMaintenanceKey(item.maintenanceId);
    if (maintenanceKey && rows.some((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey)) return;
    const test = testRows.find((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey) || null;
    const qc = qcRows.find((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey) || null;
    const maintenanceCosts = costRows.filter((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey);
    const totalCost = sumNumber(item.totalCost) || maintenanceCosts.reduce((total, row) => total + sumNumber(row.amount), 0);
    rows.push({
      id: item.id,
      historyId: `REP-${String(item.id).padStart(5, '0')}`,
      maintenanceId: item.maintenanceId || item.id,
      assetId: item.assetId,
      assetName: asset.name || 'Unknown asset',
      serialNumber: asset.serialNumber || '',
      department: asset.department || '',
      location: asset.location || '',
      maintenanceType: 'Repair',
      workOrder: workOrder?.workOrderNumber || '',
      technician: item.Technician?.fullName || item.Technician?.username || 'Unassigned',
      vendor: '',
      startDate: item.createdAt || null,
      completionDate: item.completionDate || item.updatedAt || null,
      duration: '0.00 hours',
      status: displayRepairStatus(normalizeRepairStatus(item.status || 'completed')),
      testResult: test?.overallResult || '',
      qcResult: qc?.decision || '',
      partsCost: Number(item.partsCost || 0),
      laborCost: Number(item.laborCost || 0),
      totalCost: Number(totalCost || 0),
      assetCategory: asset.category || '',
      assetStatus: asset.status || '',
      source: 'repair',
      summary: item.repairAction || item.diagnosis || 'Repair activity',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  });

  workOrderRows.forEach((item) => {
    const asset = item.Asset || {};
    const maintenanceKey = toMaintenanceKey(item.maintenanceId);
    if (maintenanceKey && rows.some((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey)) return;
    const repair = repairRows.find((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey) || null;
    const test = testRows.find((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey) || null;
    const qc = qcRows.find((row) => toMaintenanceKey(row.maintenanceId) === maintenanceKey) || null;
    const startDate = item.startDate || item.createdAt || null;
    const completionDate = item.actualCompletionDate || item.updatedAt || null;
    const durationHours = startDate && completionDate ? ((new Date(completionDate) - new Date(startDate)) / (1000 * 60 * 60)) : 0;
    rows.push({
      id: item.id,
      historyId: `WO-${String(item.id).padStart(5, '0')}`,
      maintenanceId: item.maintenanceId || item.id,
      assetId: item.assetId,
      assetName: asset.name || 'Unknown asset',
      serialNumber: asset.serialNumber || '',
      department: asset.department || '',
      location: asset.location || '',
      maintenanceType: repair ? 'Repair' : 'Corrective',
      workOrder: item.workOrderNumber || '',
      technician: item.Technician?.fullName || item.Technician?.username || 'Unassigned',
      vendor: '',
      startDate,
      completionDate,
      duration: durationHours > 0 ? `${Number(durationHours).toFixed(2)} hours` : '0.00 hours',
      status: displayWorkOrderStatus(normalizeWorkOrderStatus(item.status || 'open')),
      testResult: test?.overallResult || '',
      qcResult: qc?.decision || '',
      partsCost: 0,
      laborCost: 0,
      totalCost: Number(item.actualCost || item.estimatedCost || 0),
      assetCategory: asset.category || '',
      assetStatus: asset.status || '',
      source: 'work_order',
      summary: item.requiredWork || item.problemDescription || 'Work order activity',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  });

  return rows.sort((a, b) => new Date(b.completionDate || b.createdAt || 0) - new Date(a.completionDate || a.createdAt || 0));
};

const getMaintenanceHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const departmentFilter = String(req.query.department || '').trim();
    const technicianFilter = String(req.query.technician || '').trim();
    const vendorFilter = String(req.query.vendor || '').trim();
    const typeFilter = String(req.query.maintenanceType || req.query.type || '').trim();
    const assetFilter = String(req.query.assetId || req.query.asset_id || '').trim();
    const startDateFilter = req.query.startDate || req.query.start_date || null;
    const endDateFilter = req.query.endDate || req.query.end_date || null;

    const where = {};
    if (req.user.role === 'college') where['$Asset.department$'] = req.user.department;
    if (req.query.assetId || req.query.asset_id) where.assetId = Number(req.query.assetId || req.query.asset_id);
    if (statusFilter) where.status = normalizeStatus(statusFilter);
    if (req.query.assignedTo) where.assignedTo = Number(req.query.assignedTo);

    const [maintenanceRows, workOrderRows, repairRows, preventiveRows, testRows, qcRows, costRows] = await Promise.all([
      Maintenance.findAll({
        where,
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
          { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      }),
      MaintenanceWorkOrder.findAll({
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['actualCompletionDate', 'DESC'], ['updatedAt', 'DESC'], ['id', 'DESC']],
      }),
      MaintenanceRepair.findAll({
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
          { model: MaintenanceWorkOrder, attributes: ['id', 'workOrderNumber'] },
        ],
        order: [['completionDate', 'DESC'], ['updatedAt', 'DESC'], ['id', 'DESC']],
      }),
      PreventiveMaintenance.findAll({
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['lastCompletedDate', 'DESC'], ['nextScheduleDate', 'DESC'], ['id', 'DESC']],
      }),
      require('../models').MaintenanceTest ? require('../models').MaintenanceTest.findAll({
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
          { model: User, as: 'Tester', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['testDate', 'DESC'], ['id', 'DESC']],
      }) : [],
      require('../models').MaintenanceQualityControl ? require('../models').MaintenanceQualityControl.findAll({
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
          { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['reviewDate', 'DESC'], ['id', 'DESC']],
      }) : [],
      require('../models').MaintenanceCost ? require('../models').MaintenanceCost.findAll({
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'department', 'category', 'location'] }],
        order: [['costDate', 'DESC'], ['id', 'DESC']],
      }) : [],
    ]);

    let rows = buildMaintenanceHistoryRows({ maintenanceRows, workOrderRows, repairRows, preventiveRows, testRows, qcRows, costRows });

    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) => [
        row.assetName,
        row.serialNumber,
        row.department,
        row.location,
        row.maintenanceType,
        row.workOrder,
        row.technician,
        row.vendor,
        row.summary,
        row.historyId,
        row.maintenanceId,
      ].some((value) => String(value || '').toLowerCase().includes(needle)));
    }

    if (statusFilter) {
      rows = rows.filter((row) => String(row.status || '').toLowerCase() === String(statusFilter).toLowerCase());
    }

    if (departmentFilter) {
      rows = rows.filter((row) => String(row.department || '').toLowerCase().includes(departmentFilter.toLowerCase()));
    }

    if (technicianFilter) {
      rows = rows.filter((row) => String(row.technician || '').toLowerCase().includes(technicianFilter.toLowerCase()));
    }

    if (vendorFilter) {
      rows = rows.filter((row) => String(row.vendor || '').toLowerCase().includes(vendorFilter.toLowerCase()));
    }

    if (typeFilter) {
      rows = rows.filter((row) => String(row.maintenanceType || '').toLowerCase() === String(typeFilter).toLowerCase());
    }

    if (assetFilter) {
      rows = rows.filter((row) => Number(row.assetId) === Number(assetFilter));
    }

    if (startDateFilter || endDateFilter) {
      const startDate = startDateFilter ? new Date(startDateFilter) : null;
      const endDate = endDateFilter ? new Date(endDateFilter) : null;
      rows = rows.filter((row) => {
        const rowDate = row.completionDate || row.startDate || row.createdAt;
        if (!rowDate) return false;
        const date = new Date(rowDate);
        if (Number.isNaN(date.getTime())) return false;
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    }

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: pageRows,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) { next(error); }
};

const buildMaintenanceReportsData = async (req) => {
  const period = String(req.query.period || '').trim().toLowerCase();
  const startDate = periodStart(period);
  const where = {};
  if (startDate) where.createdAt = { [Op.gte]: startDate };
  if (req.query.department) where['$Asset.department$'] = String(req.query.department).trim();
  if (req.query.assetId) where.assetId = Number(req.query.assetId);
  if (req.query.technicianId) where.assignedTo = Number(req.query.technicianId);
  if (req.query.status) where.status = normalizeStatus(req.query.status);
  if (req.query.priority) where.priority = String(req.query.priority).trim().toLowerCase();
  if (req.query.category) where['$Asset.category$'] = String(req.query.category).trim();
  const search = String(req.query.search || '').trim();
  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { '$Asset.name$': { [Op.like]: `%${search}%` } },
      { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
      { '$Technician.fullName$': { [Op.like]: `%${search}%` } },
      ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
    ];
  }

  const [maintenanceRows, workOrderRows, repairRows, preventiveRows, technicianRows, supplierRows, testRows, inventoryTransactions] = await Promise.all([
    Maintenance.findAll({
      where,
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    }),
    MaintenanceWorkOrder.findAll({
      where: startDate ? { createdAt: { [Op.gte]: startDate } } : {},
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
        { model: Maintenance, attributes: ['id', 'title', 'status'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    }),
    MaintenanceRepair.findAll({
      where: startDate ? { createdAt: { [Op.gte]: startDate } } : {},
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    }),
    PreventiveMaintenance.findAll({
      where: startDate ? { createdAt: { [Op.gte]: startDate } } : {},
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
      ],
      order: [['nextScheduleDate', 'ASC'], ['id', 'DESC']],
    }),
    User.findAll({ where: { role: 'maintenance', active: true }, attributes: ['id', 'username', 'fullName', 'department'] }),
    Supplier.findAll({ attributes: ['id', 'supplierName', 'supplierCode', 'email', 'phone', 'status'] }),
    require('../models').MaintenanceTest ? require('../models').MaintenanceTest.findAll({ include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'department'] }, { model: User, as: 'Tester', attributes: ['id', 'username', 'fullName'] }] }) : [],
    InventoryTransaction.findAll({
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'department', 'category'] },
        { model: Inventory, attributes: ['id'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    }),
  ]);

  const activity = maintenanceRows.map((item) => {
    const data = normalize(item);
    const created = data.created ? new Date(data.created) : null;
    const updated = data.updated ? new Date(data.updated) : created;
    const durationHours = created && updated ? ((updated.getTime() - created.getTime()) / 3600000).toFixed(2) : '0.00';
    return {
      ...data,
      maintenanceId: data.mntId,
      duration: `${durationHours}h`,
      department: data.department || item.Asset?.department || '',
      assetName: data.asset || item.Asset?.name || '',
      assetCode: item.Asset?.assetCode || '',
      technician: data.technician || item.Technician?.fullName || item.Technician?.username || '',
      type: item.title || data.title || 'Maintenance',
    };
  });

  const workOrders = workOrderRows.map((item) => normalizeMaintenanceWorkOrder(item));
  const repairs = repairRows.map((item) => normalizeRepair(item));
  const preventive = preventiveRows.map((item) => serializePreventiveItem(item));
  const vendors = supplierRows.map((item) => item.toJSON());
  const testing = testRows.map((item) => item.toJSON());
  const departments = Array.from(new Set(activity.map((item) => item.department).filter(Boolean))).sort();
  const totalCost = [...workOrders, ...repairs].reduce((sum, item) => sum + Number(item.actualCost || item.estimatedCost || item.repairCost || 0), 0);
  const totalDowntimeHours = workOrders.reduce((sum, item) => {
    if (!item.dueDate) return sum;
    const due = new Date(item.dueDate).getTime();
    const created = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
    const hours = due > created ? (due - created) / 3600000 : 0;
    return sum + hours;
  }, 0);
  const summary = {
    totalRequests: maintenanceRows.length,
    totalWorkOrders: workOrders.length,
    completedMaintenance: activity.filter((item) => normalizeStatus(item.statusRaw || item.status) === 'completed').length,
    preventiveMaintenance: preventiveRows.length,
    repairs: repairRows.length,
    openMaintenance: activity.filter((item) => !['completed', 'rejected', 'cancelled'].includes(normalizeStatus(item.statusRaw || item.status))).length,
    overdueWork: workOrders.filter((item) => item.dueDate && new Date(item.dueDate).getTime() < Date.now() && !['completed', 'cancelled'].includes(normalizeWorkOrderStatus(item.statusRaw || item.status))).length,
    totalCost,
    totalDowntimeHours,
  };

  return {
    summary,
    activity,
    history: activity,
    workOrders,
    repairs,
    preventive,
    assets: Array.from(new Map((maintenanceRows || []).map((item) => [String(item.assetId), { id: item.assetId, name: item.Asset?.name || 'Unknown', category: item.Asset?.category || '', department: item.Asset?.department || '', assetCode: item.Asset?.assetCode || '', status: item.Asset?.status || item.status }])).values()),
    technicians: technicianRows.map((item) => item.toJSON()),
    vendors,
    testing,
    costs: { partsCost: 0, laborCost: 0, vendorCost: 0, otherCost: 0, totalCost },
    downtime: { totalDowntimeHours, rows: workOrders },
    departments: departments.map((department) => ({ department, maintenanceCount: activity.filter((item) => item.department === department).length })),
    filters: { period, department: req.query.department || '', status: req.query.status || '', priority: req.query.priority || '', technicianId: req.query.technicianId || '', assetId: req.query.assetId || '', category: req.query.category || '' },
  };
};

const getMaintenanceReportsSummary = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: payload });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsActivity = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.activity } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsHistory = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.history } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsWorkOrders = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.workOrders } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsRepairs = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.repairs } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsPreventive = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.preventive } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsAssets = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.assets } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsTechnicians = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.technicians } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsVendors = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.vendors } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsTesting = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.testing } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsCosts = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.costs } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsDowntime = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.downtime.rows } });
  } catch (error) { return next(error); }
};

const getMaintenanceReportsDepartments = async (req, res, next) => {
  try {
    const payload = await buildMaintenanceReportsData(req);
    return res.json({ success: true, data: { summary: payload.summary, records: payload.departments } });
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
    await MaintenanceHistory.create({ assetId: asset.id, maintenanceId: item.id, userId: req.user.id, actionType: 'created', actionDate: new Date(), newStatus: item.status, description: 'Maintenance request created', details: { requestId: item.id } });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'CREATE_MAINTENANCE',
      entity: `maintenance:${item.id}`,
      entityId: item.id,
      oldValue: null,
      newValue: item.toJSON(),
      details: { assetId: asset.id },
    });
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
    const previousValue = item.toJSON();
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
    await MaintenanceHistory.create({
      assetId: item.assetId,
      maintenanceId: item.id,
      userId: req.user.id,
      actionType: updates.status && updates.status !== previousStatus ? 'status_changed' : 'updated',
      actionDate: new Date(),
      previousStatus,
      newStatus: updates.status || previousStatus,
      description: updates.status && updates.status !== previousStatus
        ? `Maintenance status changed from ${displayStatus(previousStatus)} to ${displayStatus(updates.status)}`
        : 'Maintenance request updated',
      details: { requestId: item.id },
    });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'UPDATE_MAINTENANCE',
      entity: `maintenance:${item.id}`,
      entityId: item.id,
      oldValue: previousValue,
      newValue: item.toJSON(),
      details: { assetId: item.assetId, previousStatus: displayStatus(previousStatus) },
    });
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
    const previousValue = item.toJSON();
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
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'UPDATE_MAINTENANCE',
      entity: `maintenance:${item.id}`,
      entityId: item.id,
      oldValue: previousValue,
      newValue: item.toJSON(),
      details: { assetId: item.assetId, previousStatus: displayStatus(previousStatus), newStatus: displayStatus(status), comment: req.body.comment || req.body.reason || req.body.notes || '' },
      transaction,
    });
    await MaintenanceHistory.create({ assetId: asset.id, maintenanceId: item.id, userId: req.user.id, actionType: status === 'completed' ? 'completed' : 'status_changed', actionDate: new Date(), previousStatus, newStatus: status, description: req.body.comment || req.body.reason || req.body.notes || `Maintenance status changed from ${displayStatus(previousStatus)} to ${displayStatus(status)}`, details: { requestId: item.id } }, { transaction });
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
const assign = async (req, res, next) => {
  try {
    const item = await Maintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    req.body.assigned_to = req.body.technician_id || req.body.assigned_to;
    if (item.status !== 'assigned') req.body.status = 'assigned';
    return updateMaintenance(req, res, next);
  } catch (error) {
    return next(error);
  }
};
const removeMaintenance = async (req, res, next) => { try { if (!canManage(req)) return res.status(403).json({ success: false, message: 'Maintenance authorization required' }); const item = await Maintenance.findByPk(req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Maintenance request not found' }); if (req.infrastructureScope && !(await Asset.findOne({ where: { id: item.assetId, ...infrastructureAssetWhere } }))) return res.status(403).json({ success: false, message: 'Maintenance record is outside the infrastructure scope' }); await item.destroy(); res.json({ success: true }); } catch (error) { next(error); } };
const dashboard = async (req, res, next) => {
  try {
    const createdAfter = periodStart(String(req.query.period || '').toLowerCase());
    const maintenanceWhere = createdAfter ? { createdAt: { [Op.gte]: createdAfter } } : {};
    const assetScope = req.user.role === 'college' ? { department: req.user.department } : undefined;
    const [maintenanceRows, workOrderRows, assets, preventiveRows, technicians, completedEvents, inspections, repairRows] = await Promise.all([
      Maintenance.findAll({
        attributes: ['id', 'assetId', 'assignedTo', 'title', 'status', 'priority', 'createdAt', 'updatedAt'],
        where: maintenanceWhere,
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'department'], ...(assetScope ? { where: assetScope, required: true } : {}) },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      }),
      MaintenanceWorkOrder.findAll({
        attributes: ['id', 'maintenanceId', 'assetId', 'workOrderNumber', 'technicianId', 'priority', 'status', 'expectedCompletionDate', 'startDate', 'createdAt'],
        where: maintenanceWhere,
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'department'], ...(assetScope ? { where: assetScope, required: true } : {}) },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      }),
      Asset.findAll({ where: assetScope, attributes: ['id', 'condition', 'status'], raw: true }),
      PreventiveMaintenance.findAll({
        attributes: ['id', 'assetId', 'maintenanceType', 'scheduleDate', 'nextScheduleDate', 'technicianId', 'status'],
        where: { status: { [Op.notIn]: ['completed', 'cancelled', 'skipped'] } },
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'department'], ...(assetScope ? { where: assetScope, required: true } : {}) },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
        ],
        order: [['nextScheduleDate', 'ASC'], ['scheduleDate', 'ASC']],
      }),
      User.findAll({ where: { role: 'maintenance', active: true, ...(req.user.collegeId ? { collegeId: req.user.collegeId } : {}) }, attributes: ['id', 'username', 'fullName'], order: [['fullName', 'ASC'], ['username', 'ASC']] }),
      MaintenanceHistory.findAll({
        attributes: ['maintenanceId', 'actionDate', 'newStatus', 'actionType'],
        where: {
          ...(createdAfter ? { actionDate: { [Op.gte]: createdAfter } } : {}),
          [Op.or]: [{ actionType: 'completed' }, { newStatus: 'completed' }],
        },
      }),
      MaintenanceInspection.findAll({
        attributes: ['id', 'maintenanceId', 'inspectionResult', 'safetyCondition'],
        where: createdAfter ? { createdAt: { [Op.gte]: createdAfter } } : {},
        include: [{ model: Asset, attributes: [], ...(assetScope ? { where: assetScope, required: true } : {}) }],
      }),
      MaintenanceRepair.findAll({
        attributes: ['id', 'maintenanceId', 'status', 'completionDate', 'createdAt'],
        where: createdAfter ? { createdAt: { [Op.gte]: createdAfter } } : {},
        include: [{ model: Asset, attributes: [], ...(assetScope ? { where: assetScope, required: true } : {}) }],
      }),
    ]);

    const toRecord = (item) => (item && typeof item.toJSON === 'function' ? item.toJSON() : item || {});
    const maintenances = maintenanceRows.map(toRecord);
    const workOrders = workOrderRows.map(toRecord);
    const schedules = preventiveRows.map(toRecord);
    const repairs = repairRows.map(toRecord);
    const normalizeRecordStatus = (item) => normalizeStatus(item.status);
    const byStatus = maintenances.reduce((acc, item) => {
      const status = normalizeRecordStatus(item);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const countAssetField = (field) => assets.reduce((acc, asset) => {
      const value = String(asset[field] || 'Unspecified').trim();
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    const assetStatus = countAssetField('status');
    const assetCondition = countAssetField('condition');
    const terminalStatuses = ['completed', 'closed', 'cancelled', 'rejected'];
    const isActive = (status) => !terminalStatuses.includes(normalizeStatus(status));
    const dueByMaintenance = new Map();
    workOrders.forEach((order) => {
      if (!order.expectedCompletionDate) return;
      const existing = dueByMaintenance.get(order.maintenanceId);
      if (!existing || new Date(order.expectedCompletionDate) < new Date(existing)) dueByMaintenance.set(order.maintenanceId, order.expectedCompletionDate);
    });
    const now = Date.now();
    const overdueWorkOrders = workOrders.filter((order) => order.expectedCompletionDate && new Date(order.expectedCompletionDate).getTime() < now && isActive(order.status));
    const activeMaintenance = maintenances.filter((item) => isActive(item.status));
    const activeCriticalRequests = activeMaintenance.filter((item) => ['high', 'critical'].includes(String(item.priority || '').toLowerCase()));
    const activeCriticalWorkOrders = workOrders.filter((item) => ['high', 'critical'].includes(String(item.priority || '').toLowerCase()) && isActive(item.status));
    const failedInspections = inspections.map(toRecord).filter((item) => {
      const result = normalizeStatus(item.inspectionResult);
      const safety = normalizeStatus(item.safetyCondition);
      return ['fail', 'failed', 'needs-repair', 'needs-parts', 'further-inspection'].includes(result) || ['unsafe', 'hazardous'].includes(safety);
    });

    const assignments = new Map();
    const addAssignment = (technicianId, maintenanceId, status, sourcePriority) => {
      if (!technicianId) return;
      const key = maintenanceId ? `maintenance:${maintenanceId}:technician:${technicianId}` : `work-order:${technicianId}`;
      const existing = assignments.get(key);
      if (!existing || sourcePriority > existing.sourcePriority || (sourcePriority === existing.sourcePriority && normalizeStatus(status) === 'in-progress' && normalizeStatus(existing.status) !== 'in-progress')) {
        assignments.set(key, { technicianId, status: normalizeStatus(status), sourcePriority });
      }
    };
    maintenances.forEach((item) => addAssignment(item.assignedTo, item.id, item.status, 0));
    workOrders.forEach((order) => {
      const maintenance = maintenances.find((item) => Number(item.id) === Number(order.maintenanceId));
      addAssignment(order.technicianId, order.maintenanceId || order.id, order.status === 'pending' && maintenance ? maintenance.status : order.status, 1);
    });
    const technicianById = new Map(technicians.map((item) => {
      const data = toRecord(item);
      return [String(data.id), data];
    }));
    const workloadByTechnician = new Map();
    assignments.forEach(({ technicianId, status }) => {
      const technician = technicianById.get(String(technicianId));
      if (!technician) return;
      const row = workloadByTechnician.get(String(technicianId)) || {
        technicianId: technician.id,
        name: technician.fullName || technician.username,
        assigned: 0,
        inProgress: 0,
        completed: 0,
      };
      row.assigned += 1;
      if (status === 'in-progress') row.inProgress += 1;
      if (status === 'completed') row.completed += 1;
      workloadByTechnician.set(String(technicianId), row);
    });
    const technicianWorkload = [...workloadByTechnician.values()].sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));
    const assignedJobs = technicianWorkload.reduce((total, item) => total + item.assigned, 0);
    const completedAssignedJobs = technicianWorkload.reduce((total, item) => total + item.completed, 0);

    const trendByMonth = new Map();
    const trendKey = (date) => {
      const value = new Date(date);
      return ['today', '7days'].includes(String(req.query.period || '').toLowerCase())
        ? value.toISOString().slice(0, 10)
        : value.toISOString().slice(0, 7);
    };
    maintenances.forEach((item) => {
      if (!item.createdAt) return;
      const bucket = trendKey(item.createdAt);
      const row = trendByMonth.get(bucket) || { period: bucket, requests: 0, completed: 0 };
      row.requests += 1;
      trendByMonth.set(bucket, row);
    });
    completedEvents.map(toRecord).forEach((event) => {
      if (!event.actionDate) return;
      const bucket = trendKey(event.actionDate);
      const row = trendByMonth.get(bucket) || { period: bucket, requests: 0, completed: 0 };
      row.completed += 1;
      trendByMonth.set(bucket, row);
    });
    const monthlyTrend = [...trendByMonth.values()].sort((a, b) => a.period.localeCompare(b.period));

    const nextSchedule = schedules
      .map((item) => ({ ...item, effectiveDate: item.nextScheduleDate || item.scheduleDate }))
      .filter((item) => item.effectiveDate && new Date(item.effectiveDate).getTime() >= new Date(new Date().setHours(0, 0, 0, 0)).getTime())
      .sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate))[0];
    const criticalAlertIds = new Set([
      ...activeCriticalRequests.map((item) => `maintenance:${item.id}`),
      ...activeCriticalWorkOrders.map((item) => `work-order:${item.id}`),
      ...overdueWorkOrders.map((item) => `work-order:${item.id}`),
      ...failedInspections.map((item) => `inspection:${item.id}`),
    ]);
    const requests = maintenances.slice(0, 5).map((item) => ({
      id: item.id,
      requestId: `REQ-${String(item.id).padStart(3, '0')}`,
      asset: item.Asset?.name || item.Asset?.assetCode || '—',
      status: displayStatus(normalizeRecordStatus(item)),
      priority: String(item.priority || '').replace(/^./, (letter) => letter.toUpperCase()),
      dueDate: dueByMaintenance.get(item.id) || null,
      createdAt: item.createdAt || null,
    }));
    const recentWorkOrders = workOrders.slice(0, 5).map((item) => ({
      id: item.id,
      workOrderNumber: item.workOrderNumber,
      asset: item.Asset?.name || item.Asset?.assetCode || '—',
      technician: item.Technician?.fullName || item.Technician?.username || '',
      status: displayStatus(normalizeStatus(item.status)),
      assignedDate: item.startDate || (item.technicianId ? item.createdAt : null),
    }));
    const pendingStatuses = ['pending', 'waiting', 'waiting-for-approval', 'awaiting-approval'];
    const pendingCount = Object.entries(byStatus).reduce((total, [status, count]) => total + (pendingStatuses.includes(status) ? count : 0), 0);
    const countActivePhase = (status) => {
      const ids = new Set();
      maintenances.filter((item) => normalizeRecordStatus(item) === status).forEach((item) => ids.add(`maintenance:${item.id}`));
      repairs.filter((item) => normalizeRepairStatus(item.status) === status).forEach((item) => ids.add(`maintenance:${item.maintenanceId || `repair-${item.id}`}`));
      workOrders.filter((item) => normalizeWorkOrderStatus(item.status) === status).forEach((item) => ids.add(`maintenance:${item.maintenanceId || `work-order-${item.id}`}`));
      return ids.size;
    };
    const waitingForParts = countActivePhase('waiting-for-parts');
    const testingCount = countActivePhase('testing');
    const completedMaintenanceIds = new Set(maintenances.filter((item) => normalizeRecordStatus(item) === 'completed').map((item) => String(item.id)));
    completedEvents.map(toRecord).forEach((event) => {
      if (event.maintenanceId) completedMaintenanceIds.add(String(event.maintenanceId));
    });
    const completedRepairRows = repairs.filter((item) => normalizeStatus(item.status) === 'completed');
    const completedRepairMaintenanceIds = new Set(completedRepairRows.map((item) => String(item.maintenanceId)));
    const completedCount = completedRepairRows.length + [...completedMaintenanceIds].filter((id) => !completedRepairMaintenanceIds.has(id)).length;
    const statusDistribution = Object.entries(byStatus).map(([status, count]) => ({ status, label: displayStatus(status), count }));
    res.json({
      success: true,
      data: {
        period: req.query.period || 'all',
        summary: {
          totalRequests: maintenances.length,
          pendingRequests: pendingCount,
          inProgress: byStatus['in-progress'] || 0,
          completedRepairs: completedCount,
          overdueWorkOrders: overdueWorkOrders.length,
          assetsUnderMaintenance: assets.filter((asset) => ['under-maintenance', 'under maintenance', 'under_maintenance', 'in_maintenance', 'in-maintenance'].includes(normalizeStatus(asset.status))).length,
          waitingForParts,
          inTesting: testingCount,
          assignedStaff: technicians.length,
          technicianEfficiency: assignedJobs ? Math.round((completedAssignedJobs / assignedJobs) * 100) : null,
          criticalAlerts: criticalAlertIds.size,
          hasRecords: maintenances.length > 0 || workOrders.length > 0 || schedules.length > 0,
        },
        byStatus,
        statusDistribution,
        monthlyTrend,
        workPhases: { completedJobs: completedCount, waitingForParts, testing: testingCount },
        technicianWorkload,
        recentRequests: requests,
        recentWorkOrders,
        nextScheduledMaintenance: nextSchedule ? {
          asset: nextSchedule.Asset?.name || nextSchedule.Asset?.assetCode || '—',
          maintenanceType: nextSchedule.maintenanceType || 'Preventive maintenance',
          scheduledDate: nextSchedule.effectiveDate,
          technician: nextSchedule.Technician?.fullName || nextSchedule.Technician?.username || '',
        } : null,
        total: maintenances.length,
        pending: pendingCount,
        active: byStatus['in-progress'] || 0,
        completed: completedCount,
        totalAssets: assets.length,
        assetsUnderMaintenance: assets.filter((asset) => ['under-maintenance', 'under maintenance', 'under_maintenance', 'in_maintenance', 'in-maintenance'].includes(normalizeStatus(asset.status))).length,
        assetStatus,
        assetCondition,
      },
    });
  } catch (error) { next(error); }
};

const resolveWorkloadThresholds = (config = null) => {
  const fallback = { low: 1, normal: 3, high: 5, overloaded: 8 };
  if (!config || typeof config !== 'object') return fallback;
  return {
    low: Number(config.low ?? config.workloadLow ?? fallback.low),
    normal: Number(config.normal ?? config.workloadNormal ?? fallback.normal),
    high: Number(config.high ?? config.workloadHigh ?? fallback.high),
    overloaded: Number(config.overloaded ?? config.workloadOverloaded ?? fallback.overloaded),
  };
};

const getWorkloadLevelLabel = (count, thresholds = null) => {
  const config = resolveWorkloadThresholds(thresholds);
  if (count >= (config.overloaded ?? Number.MAX_SAFE_INTEGER)) return 'Overloaded';
  if (count >= (config.high ?? config.normal ?? 5)) return 'High';
  if (count >= (config.normal ?? 3)) return 'Normal';
  if (count >= (config.low ?? 1)) return 'Low';
  return 'Low';
};

const getTechnicianDirectory = async (req, res, next) => {
  try {
    const userWhere = { role: 'maintenance' };
    if (req.query.active !== undefined) userWhere.active = String(req.query.active).toLowerCase() === 'true';
    if (req.user && req.user.collegeId) userWhere.collegeId = req.user.collegeId;
    if (req.user && req.user.role === 'college' && req.user.department) userWhere.department = req.user.department;

    const users = await User.findAll({
      where: userWhere,
      attributes: ['id', 'username', 'fullName', 'email', 'phone', 'department', 'role', 'active', 'collegeId'],
      order: [['fullName', 'ASC'], ['username', 'ASC']],
    });

    const technicianIds = users.map((user) => user.id);
    const [maintenanceRows, workOrders, preventiveRows] = await Promise.all([
      Maintenance.findAll({
        where: technicianIds.length ? { assignedTo: { [Op.in]: technicianIds } } : { id: -1 },
        attributes: ['id', 'assignedTo', 'status', 'priority', 'createdAt', 'updatedAt'],
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'location', 'department'] }],
      }),
      MaintenanceWorkOrder.findAll({
        where: technicianIds.length ? { technicianId: { [Op.in]: technicianIds } } : { id: -1 },
        attributes: ['id', 'technicianId', 'status', 'priority', 'createdAt', 'expectedCompletionDate'],
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'location', 'department'] }],
      }),
      PreventiveMaintenance.findAll({
        where: technicianIds.length ? { technicianId: { [Op.in]: technicianIds } } : { id: -1 },
        attributes: ['id', 'technicianId', 'status', 'maintenanceType', 'nextScheduleDate', 'createdAt'],
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'location', 'department'] }],
      }),
    ]);

    const tasksByTechnician = new Map();
    const addTask = (techId, task) => {
      if (!techId) return;
      const group = tasksByTechnician.get(Number(techId)) || { active: 0, completed: 0, overdue: 0, highPriority: 0, workOrders: 0, preventive: 0 };
      const status = normalizeStatus(task.status || 'pending');
      if (['completed', 'closed', 'cancelled', 'rejected'].includes(status)) {
        group.completed += 1;
      } else {
        group.active += 1;
      }
      if (['high', 'critical'].includes(String(task.priority || '').toLowerCase())) group.highPriority += 1;
      if (task.expectedCompletionDate && status !== 'completed' && new Date(task.expectedCompletionDate).getTime() < Date.now()) group.overdue += 1;
      tasksByTechnician.set(Number(techId), group);
    };

    maintenanceRows.forEach((row) => addTask(row.assignedTo, row));
    workOrders.forEach((row) => {
      const status = normalizeStatus(row.status || 'open');
      if (['completed', 'closed', 'cancelled', 'rejected'].includes(status)) {
        const group = tasksByTechnician.get(Number(row.technicianId)) || { active: 0, completed: 0, overdue: 0, highPriority: 0, workOrders: 0, preventive: 0 };
        group.completed += 1;
        group.workOrders += 1;
        tasksByTechnician.set(Number(row.technicianId), group);
      } else {
        const group = tasksByTechnician.get(Number(row.technicianId)) || { active: 0, completed: 0, overdue: 0, highPriority: 0, workOrders: 0, preventive: 0 };
        group.active += 1;
        group.workOrders += 1;
        if (['high', 'critical'].includes(String(row.priority || '').toLowerCase())) group.highPriority += 1;
        if (row.expectedCompletionDate && new Date(row.expectedCompletionDate).getTime() < Date.now()) group.overdue += 1;
        tasksByTechnician.set(Number(row.technicianId), group);
      }
    });
    preventiveRows.forEach((row) => {
      const status = normalizeStatus(row.status || 'scheduled');
      const group = tasksByTechnician.get(Number(row.technicianId)) || { active: 0, completed: 0, overdue: 0, highPriority: 0, workOrders: 0, preventive: 0 };
      if (status === 'completed') group.completed += 1;
      else group.active += 1;
      group.preventive += 1;
      tasksByTechnician.set(Number(row.technicianId), group);
    });

    const rows = users.map((user) => {
      const stats = tasksByTechnician.get(Number(user.id)) || { active: 0, completed: 0, overdue: 0, highPriority: 0, workOrders: 0, preventive: 0 };
      const availability = !user.active ? 'Inactive' : stats.active >= 3 ? 'Busy' : stats.active > 0 ? 'Assigned' : 'Available';
      const status = user.active ? 'Active' : 'Inactive';
      const workloadLevel = getWorkloadLevelLabel(stats.active || 0);
      return {
        id: user.id,
        technicianId: `TECH-${String(user.id).padStart(4, '0')}`,
        employeeId: `EMP-${String(user.id).padStart(4, '0')}`,
        name: user.fullName || user.username,
        username: user.username,
        email: user.email || '—',
        phone: user.phone || '—',
        department: user.department || 'General Maintenance',
        specialization: 'General Maintenance',
        skills: [user.department || 'Maintenance'],
        contact: user.phone || user.email || '—',
        status,
        availability,
        activeAssignments: stats.active,
        activeWorkOrders: stats.workOrders,
        workload: stats.active,
        workloadLevel,
        completedTasks: stats.completed,
        overdueTasks: stats.overdue,
        highPriority: stats.highPriority,
        preventiveTasks: stats.preventive,
      };
    });

    const summary = {
      totalTechnicians: users.filter((user) => user.active).length,
      available: rows.filter((row) => row.availability === 'Available').length,
      assigned: rows.filter((row) => ['Assigned', 'Busy'].includes(row.availability)).length,
      onLeave: rows.filter((row) => row.availability === 'On Leave').length,
      overloaded: rows.filter((row) => row.workloadLevel === 'Overloaded').length,
      activeWorkOrders: workOrders.filter((row) => !['completed', 'closed', 'cancelled', 'rejected'].includes(normalizeStatus(row.status || 'open'))).length,
      overdueTasks: rows.reduce((total, row) => total + row.overdueTasks, 0),
    };

    res.json({
      success: true,
      message: 'Technician directory retrieved successfully',
      summary,
      data: rows,
      filters: {
        statuses: ['Active', 'Inactive'],
        availabilities: ['Available', 'Assigned', 'Busy', 'On Leave', 'Unavailable'],
        departments: [...new Set(rows.map((row) => row.department))].sort(),
        workloadLevels: ['Low', 'Normal', 'High', 'Overloaded'],
      },
      pagination: { page: Number(req.query.page || 1), limit: Number(req.query.limit || rows.length || 25), total: rows.length, pages: Math.max(1, Math.ceil(rows.length / (Number(req.query.limit) || Math.max(1, rows.length || 1)))) },
    });
  } catch (error) {
    next(error);
  }
};

const repairInclude = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition', 'warrantyExpiry'] },
  { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
  { model: MaintenanceRepair, required: true, attributes: ['id', 'workOrderId', 'technicianId', 'status', 'diagnosis', 'repairAction', 'partsUsed', 'totalCost', 'completionDate', 'notes'] },
];
const repairScope = (req) => req.user.collegeId ? { '$Asset.collegeId$': req.user.collegeId } : {};
const normalizeRepair = (item) => {
  const data = item.toJSON();
  const repair = data.MaintenanceRepairs?.[0] || data.MaintenanceRepair || {};
  const repairStatus = normalizeRepairStatus(data.status || repair.status || 'open');
  return {
    ...data,
    repairId: `REP-${String(data.id).padStart(3, '0')}`,
    asset: data.Asset,
    assetTag: data.Asset?.assetCode,
    serialNumber: data.Asset?.serialNumber,
    technician: data.Technician?.fullName || data.Technician?.username || '',
    technicianId: data.Technician?.id || repair.technicianId || data.assignedTo || null,
    diagnosis: repair.diagnosis || '',
    repairAction: repair.repairAction || '',
    partsReplaced: repair.partsUsed || '',
    repairCost: Number(repair.totalCost || 0),
    completionDate: repair.completionDate || (data.status === 'completed' ? data.updatedAt : null),
    notes: repair.notes || '',
    status: displayRepairStatus(repairStatus),
    statusRaw: repairStatus,
    workOrderId: repair.workOrderId || null,
    progress: Number(data.progress ?? repair.progress ?? (repairStatus === 'completed' ? 100 : repairStatus === 'in-progress' ? 70 : repairStatus === 'testing' ? 80 : repairStatus === 'waiting-for-parts' ? 45 : repairStatus === 'diagnosing' ? 30 : repairStatus === 'assigned' ? 20 : repairStatus === 'failed' ? 50 : repairStatus === 'rework' ? 60 : 10)),
  };
};

const normalizeSparePartStatus = (available, reserved, minimum, status = '') => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (['inactive', 'archived', 'disposed', 'deleted'].includes(normalizedStatus)) return 'Inactive';
  if (available <= 0) return 'Out of Stock';
  if (reserved > 0 && available > 0) return 'Reserved';
  if (available <= minimum && available > 0) return 'Low Stock';
  return 'In Stock';
};

const normalizeSparePartRecord = (item) => {
  const data = item.toJSON ? item.toJSON() : item;
  const asset = data.Asset || {};
  const available = Number(data.availableQuantity ?? data.available_quantity ?? 0);
  const reserved = Number(data.reservedQuantity ?? data.reserved_quantity ?? 0);
  const minimum = Number(data.minimumQuantity ?? data.min_stock ?? 0);
  const quantity = Number(data.quantity ?? 0);
  const issued = Math.max(0, quantity - available - reserved - Number(data.damagedQuantity ?? data.damaged_quantity ?? 0));
  const status = normalizeSparePartStatus(available, reserved, minimum, data.status || asset.status || 'available');

  return {
    id: data.id,
    partId: `SP-${String(data.id).padStart(5, '0')}`,
    inventoryId: data.id,
    partNumber: data.partNumber || asset.assetCode || data.assetCode || `INV-${String(data.id).padStart(6, '0')}`,
    name: asset.name || data.name || 'Unnamed inventory item',
    sku: asset.serialNumber || data.serialNumber || '',
    category: asset.category || data.category || 'Uncategorized',
    compatibleEquipment: asset.category || data.compatibleEquipment || 'General equipment',
    unit: data.unit || 'pcs',
    availableQuantity: available,
    reservedQuantity: reserved,
    issuedQuantity: issued,
    consumedQuantity: Number(data.consumedQuantity ?? 0),
    totalQuantity: quantity,
    minimumStock: minimum,
    reorderLevel: Number(data.reorderLevel ?? minimum ?? 0),
    status,
    location: data.location || asset.location || 'Store',
    lastUpdated: data.updatedAt || data.updated_at || data.createdAt || null,
    supplier: asset.supplier || data.supplier || '—',
    manufacturer: asset.manufacturer || data.manufacturer || '—',
    unitCost: Number(data.unitCost ?? asset.purchasePrice ?? 0),
    description: asset.description || data.description || '',
    stockStatus: status,
  };
};

const getSpareParts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const assetWhere = {};
    const inventoryWhere = {};

    if (req.query.category) {
      assetWhere.category = String(req.query.category).trim();
    }
    if (req.query.location) {
      inventoryWhere.location = String(req.query.location).trim();
    }
    if (req.query.stockStatus) {
      const stockStatus = String(req.query.stockStatus).trim().toLowerCase();
      if (stockStatus === 'in-stock') inventoryWhere.availableQuantity = { [Op.gt]: 0 };
      if (stockStatus === 'low-stock') inventoryWhere.availableQuantity = { [Op.gt]: 0 };
      if (stockStatus === 'out-of-stock') inventoryWhere.availableQuantity = { [Op.lte]: 0 };
      if (stockStatus === 'reserved') inventoryWhere.reservedQuantity = { [Op.gt]: 0 };
      if (stockStatus === 'inactive') inventoryWhere.status = 'inactive';
    }
    if (search) {
      assetWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { supplier: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Inventory.findAndCountAll({
      where: inventoryWhere,
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'supplier', 'manufacturer', 'description', 'status'], where: Object.keys(assetWhere).length ? assetWhere : undefined, required: true },
        { model: Department, attributes: ['id', 'name'] },
      ],
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    const data = rows.map(normalizeSparePartRecord);
    const summary = {
      totalParts: rows.length,
      availableStock: data.reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0),
      lowStock: data.filter((item) => item.status === 'Low Stock').length,
      outOfStock: data.filter((item) => item.status === 'Out of Stock').length,
      reserved: data.reduce((sum, item) => sum + Number(item.reservedQuantity || 0), 0),
      issued: data.reduce((sum, item) => sum + Number(item.issuedQuantity || 0), 0),
      consumed: data.reduce((sum, item) => sum + Number(item.consumedQuantity || 0), 0),
      pendingRequests: await Maintenance.count({ where: { status: { [Op.in]: ['pending', 'approved', 'waiting-for-parts', 'assigned'] } } }),
    };

    return res.json({
      success: true,
      data,
      summary,
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) { next(error); }
};

const getSparePartDetail = async (req, res, next) => {
  try {
    const item = await Inventory.findOne({
      where: { id: req.params.id },
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'supplier', 'manufacturer', 'description', 'status', 'purchasePrice'] },
        { model: Department, attributes: ['id', 'name'] },
        {
          model: InventoryTransaction,
          include: [{ model: User, attributes: ['id', 'fullName', 'username', 'role'] }],
          order: [['createdAt', 'DESC']],
          limit: 25,
        },
      ],
    });

    if (!item) return res.status(404).json({ success: false, message: 'Spare part not found' });

    const normalized = normalizeSparePartRecord(item);
    const detail = {
      ...normalized,
      inventory: {
        totalStock: Number(item.quantity || 0),
        available: Number(item.availableQuantity || 0),
        reserved: Number(item.reservedQuantity || 0),
        issued: Math.max(0, Number(item.quantity || 0) - Number(item.availableQuantity || 0) - Number(item.reservedQuantity || 0) - Number(item.damagedQuantity || 0)),
        consumed: 0,
        minimumLevel: Number(item.minimumQuantity || 0),
        reorderLevel: Number(item.minimumQuantity || 0),
        storageLocation: item.location || item.Asset?.location || 'Store',
      },
      procurement: {
        supplier: item.Asset?.supplier || item.supplier || '—',
        unitCost: Number(item.Asset?.purchasePrice || 0),
        purchaseDate: item.createdAt || null,
        lastPurchase: item.updatedAt || null,
      },
      compatibility: {
        assetCategory: item.Asset?.category || 'General',
        equipmentType: item.Asset?.category || 'General',
        supportedModels: item.Asset?.name || 'General',
      },
      transactionHistory: (item.InventoryTransactions || []).map((transaction) => ({
        id: transaction.id,
        date: transaction.createdAt,
        transactionType: transaction.type,
        quantity: Number(transaction.quantity || 0),
        previousBalance: Number(transaction.notes ? null : 0),
        newBalance: Number(transaction.notes ? null : 0),
        maintenanceJob: transaction.notes || 'Inventory transaction',
        workOrder: null,
        asset: item.Asset,
        user: transaction.User ? (transaction.User.fullName || transaction.User.username) : '—',
        reference: transaction.reason || transaction.type,
        notes: transaction.notes || '',
      })),
    };

    return res.json({ success: true, data: detail });
  } catch (error) { next(error); }
};

const getMaintenanceWorkOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const where = {};
    if (req.query.status) where.status = normalizeWorkOrderStatus(req.query.status);
    if (req.query.priority) where.priority = String(req.query.priority).trim().toLowerCase();
    if (req.query.assetId) where.assetId = Number(req.query.assetId);
    if (req.query.technicianId) where.technicianId = Number(req.query.technicianId);
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) {
        where[Op.or] = [
          { workOrderNumber: { [Op.like]: `%${search}%` } },
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
          { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
          { '$Asset.serialNumber$': { [Op.like]: `%${search}%` } },
          { '$Technician.fullName$': { [Op.like]: `%${search}%` } },
          { [Op.or]: [{ problemDescription: { [Op.like]: `%${search}%` } }, { notes: { [Op.like]: `%${search}%` } }] },
        ];
      }
    }

    const include = [
      { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'status'] },
      { model: Maintenance, attributes: ['id', 'title', 'description', 'status', 'priority'] },
      { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
    ];

    const { count, rows } = await MaintenanceWorkOrder.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    const data = rows.map(normalizeMaintenanceWorkOrder);
    const summary = getMaintenanceWorkOrderSummary(data);
    res.json({
      success: true,
      data,
      summary,
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) { next(error); }
};

const getMaintenanceWorkOrder = async (req, res, next) => {
  try {
    const item = await MaintenanceWorkOrder.findOne({
      where: { id: req.params.id },
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'status'] },
        { model: Maintenance, attributes: ['id', 'title', 'description', 'status', 'priority'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
      ],
    });
    if (!item) return res.status(404).json({ success: false, message: 'Work order not found' });
    return res.json({ success: true, data: normalizeMaintenanceWorkOrder(item) });
  } catch (error) { next(error); }
};

const getMaintenanceWorkOrderOptions = async (req, res, next) => {
  try {
    const collegeAssetScope = req.user.collegeId ? { collegeId: req.user.collegeId } : undefined;
    const [assets, technicians, maintenanceRequests] = await Promise.all([
      Asset.findAll({ where: collegeAssetScope, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'status'], order: [['name', 'ASC']] }),
      User.findAll({ where: { role: 'maintenance', active: true, ...(req.user.collegeId ? { collegeId: req.user.collegeId } : {}) }, attributes: ['id', 'username', 'fullName', 'department'], order: [['fullName', 'ASC'], ['username', 'ASC']] }),
      Maintenance.findAll({
        where: { status: { [Op.notIn]: ['completed', 'rejected', 'cancelled'] } },
        attributes: ['id', 'assetId', 'title', 'status', 'priority', 'createdAt'],
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'], ...(collegeAssetScope ? { where: collegeAssetScope, required: true } : {}) }],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: 100,
      }),
    ]);
    return res.json({
      success: true,
      data: {
        assets,
        technicians,
        maintenanceRequests: maintenanceRequests.map((request) => {
          const data = request.toJSON();
          return {
            id: data.id,
            assetId: data.assetId,
            title: data.title,
            status: displayWorkOrderStatus(data.status),
            priority: displayPriority(data.priority),
            createdAt: data.createdAt,
            asset: data.Asset,
          };
        }),
      },
    });
  } catch (error) { next(error); }
};

const createMaintenanceWorkOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body || {};
    const assetId = body.assetId ?? body.asset_id;
    if (!assetId) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Asset is required' }); }
    const maintenanceId = body.maintenanceId ?? body.maintenance_id;
    if (!maintenanceId) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'A maintenance request is required' }); }
    const asset = await Asset.findByPk(assetId, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const maintenance = await Maintenance.findByPk(maintenanceId, { transaction });
    if (!maintenance) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance request not found' }); }
    if (Number(maintenance.assetId) !== Number(asset.id)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'The maintenance request must belong to the selected asset' }); }

    const technicianId = body.technicianId ?? body.technician_id ?? null;
    if (technicianId) {
      const technician = await User.findOne({ where: { id: technicianId, role: 'maintenance', active: true }, transaction });
      if (!technician) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'A valid active maintenance technician is required' }); }
    }

    const status = normalizeWorkOrderStatus(body.status || 'open');
    const statusReady = Object.keys(workOrderStatusTransitions).includes(status) ? status : 'open';
    const number = String(body.workOrderNumber || '').trim() || `WO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
    const parsedCost = Number(body.estimatedCost ?? body.estimated_cost ?? 0);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Estimated cost must be a valid non-negative number' }); }

    const item = await MaintenanceWorkOrder.create({
      maintenanceId: maintenanceId || null,
      assetId,
      workOrderNumber: number,
      technicianId: technicianId || null,
      priority: String(body.priority || 'medium').toLowerCase(),
      status: statusReady,
      problemDescription: String(body.problemDescription || body.problem || '').trim(),
      diagnosis: String(body.diagnosis || '').trim(),
      requiredWork: String(body.requiredWork || body.required_work || '').trim(),
      startDate: body.scheduledDate || body.startDate || null,
      expectedCompletionDate: body.dueDate || body.expectedCompletionDate || null,
      actualCompletionDate: body.completedDate || body.actualCompletionDate || null,
      estimatedCost: parsedCost,
      actualCost: Number(body.actualCost ?? body.actual_cost ?? 0),
      notes: String(body.notes || '').trim(),
      progress: Number(body.progress ?? (statusReady === 'completed' ? 100 : 0)),
    }, { transaction });

    await MaintenanceHistory.create({
      assetId: asset.id,
      maintenanceId: maintenanceId || item.id,
      userId: req.user.id,
      actionType: 'work_order_created',
      actionDate: new Date(),
      newStatus: statusReady,
      description: `Work order ${number} created`,
      details: { workOrderId: item.id },
    }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_MAINTENANCE_WORK_ORDER', entity: `maintenance_work_order:${item.id}`, details: JSON.stringify({ workOrderId: item.id, assetId: asset.id }) }, { transaction });
    await transaction.commit();
    const created = await MaintenanceWorkOrder.findByPk(item.id, { include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'status'] }, { model: Maintenance, attributes: ['id', 'title', 'description', 'status', 'priority'] }, { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] }] });
    return res.status(201).json({ success: true, data: normalizeMaintenanceWorkOrder(created) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const updateMaintenanceWorkOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceWorkOrder.findByPk(req.params.id, { include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'location', 'status'] }, { model: Maintenance, attributes: ['id', 'title', 'description', 'status', 'priority'] }, { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Work order not found' }); }
    const body = req.body || {};
    const status = body.status ? normalizeWorkOrderStatus(body.status) : item.status;
    if (status && !Object.keys(workOrderStatusTransitions).includes(status)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid work order status' }); }

    const technicianId = body.technicianId ?? body.technician_id ?? item.technicianId;
    if (technicianId) {
      const technician = await User.findOne({ where: { id: technicianId, role: 'maintenance', active: true }, transaction });
      if (!technician) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'A valid active maintenance technician is required' }); }
    }

    const updates = {
      workOrderNumber: body.workOrderNumber ? String(body.workOrderNumber).trim() : item.workOrderNumber,
      maintenanceId: body.maintenanceId ?? body.maintenance_id ?? item.maintenanceId,
      assetId: body.assetId ?? body.asset_id ?? item.assetId,
      technicianId: technicianId || null,
      priority: String(body.priority || item.priority || 'medium').toLowerCase(),
      status,
      problemDescription: body.problemDescription ?? body.problem ?? item.problemDescription,
      diagnosis: body.diagnosis ?? item.diagnosis,
      requiredWork: body.requiredWork ?? body.required_work ?? item.requiredWork,
      startDate: body.scheduledDate ?? body.startDate ?? item.startDate,
      expectedCompletionDate: body.dueDate ?? body.expectedCompletionDate ?? item.expectedCompletionDate,
      actualCompletionDate: body.completedDate ?? body.actualCompletionDate ?? item.actualCompletionDate,
      estimatedCost: Number(body.estimatedCost ?? body.estimated_cost ?? item.estimatedCost ?? 0),
      actualCost: Number(body.actualCost ?? body.actual_cost ?? item.actualCost ?? 0),
      notes: body.notes ?? item.notes,
      progress: Number(body.progress ?? item.progress ?? (status === 'completed' ? 100 : 0)),
    };

    await item.update(updates, { transaction });
    await MaintenanceHistory.create({ assetId: item.assetId, maintenanceId: item.maintenanceId || item.id, userId: req.user.id, actionType: 'work_order_updated', actionDate: new Date(), newStatus: status, description: 'Work order updated', details: { workOrderId: item.id } }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_MAINTENANCE_WORK_ORDER', entity: `maintenance_work_order:${item.id}`, details: JSON.stringify({ workOrderId: item.id }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: normalizeMaintenanceWorkOrder(item) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const updateMaintenanceWorkOrderStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceWorkOrder.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Work order not found' }); }
    const previousStatus = normalizeWorkOrderStatus(item.status);
    const nextStatus = normalizeWorkOrderStatus(req.body?.status || 'open');
    if (!Object.keys(workOrderStatusTransitions).includes(nextStatus) || !workOrderStatusTransitions[previousStatus]?.includes(nextStatus)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Invalid status transition from ${displayWorkOrderStatus(previousStatus)} to ${displayWorkOrderStatus(nextStatus)}` });
    }

    const updates = { status: nextStatus, progress: Number(req.body?.progress ?? (nextStatus === 'completed' ? 100 : item.progress ?? 0)) };
    if (nextStatus === 'completed') updates.actualCompletionDate = new Date();
    await item.update(updates, { transaction });
    await MaintenanceHistory.create({ assetId: item.assetId, maintenanceId: item.maintenanceId || item.id, userId: req.user.id, actionType: 'status_changed', actionDate: new Date(), previousStatus, newStatus: nextStatus, description: `Work order status changed from ${displayWorkOrderStatus(previousStatus)} to ${displayWorkOrderStatus(nextStatus)}`, details: { workOrderId: item.id } }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_MAINTENANCE_WORK_ORDER_STATUS', entity: `maintenance_work_order:${item.id}`, details: JSON.stringify({ previousStatus, newStatus: nextStatus }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: normalizeMaintenanceWorkOrder(item) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const assignMaintenanceWorkOrder = async (req, res, next) => {
  try {
    const item = await MaintenanceWorkOrder.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Work order not found' });
    const technicianId = req.body.technicianId ?? req.body.technician_id ?? null;
    if (technicianId) {
      const technician = await User.findOne({ where: { id: technicianId, role: 'maintenance', active: true } });
      if (!technician) return res.status(422).json({ success: false, message: 'A valid active maintenance technician is required' });
    }
    await item.update({ technicianId: technicianId || null, status: technicianId ? 'assigned' : item.status, progress: Number(req.body.progress ?? item.progress ?? 0) });
    return res.json({ success: true, data: normalizeMaintenanceWorkOrder(item) });
  } catch (error) { next(error); }
};

const getRepairHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = {};
    const createdAfter = periodStart(String(req.query.period || '').toLowerCase());
    const repairWhere = createdAfter ? { createdAt: { [Op.gte]: createdAfter } } : {};
    if (req.query.status) where.status = normalizeRepairStatus(req.query.status);
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [{ title: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }, { '$Asset.name$': { [Op.like]: `%${search}%` } }, { '$Asset.assetCode$': { [Op.like]: `%${search}%` } }, { '$Technician.fullName$': { [Op.like]: `%${search}%` } }, ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : [])];
    }
    const scopedRepairInclude = repairInclude.map((item) => item.model === MaintenanceRepair ? { ...item, where: repairWhere } : item);
    const { count, rows } = await Maintenance.findAndCountAll({ where: { ...where, ...repairScope(req) }, include: scopedRepairInclude, distinct: true, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const statsRows = await Maintenance.findAll({ where: { ...where, ...repairScope(req) }, include: [{ model: Asset, attributes: [], required: true }, { model: MaintenanceRepair, required: true, attributes: ['totalCost', 'status'], where: repairWhere }], attributes: ['status'], raw: true });
    const summary = buildRepairSummary(statsRows.map((row) => ({ status: row['MaintenanceRepairs.status'] || row.status })));
    const stats = {
      ...summary,
      totalRepairs: summary.totalRepairs,
      totalRepairCost: statsRows.reduce((total, row) => total + Number(row['MaintenanceRepairs.totalCost'] || 0), 0),
      activeRepairs: (summary.inProgress || 0) + (summary.waitingForParts || 0) + (summary.assigned || 0) + (summary.diagnosing || 0) + (summary.failed || 0),
      completedRepairs: summary.completed || 0,
      awaitingParts: summary.waitingForParts || 0,
      openRepairs: summary.totalOpen || 0,
    };
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
    const { asset_id, problem, diagnosis = '', repair_action = '', parts_replaced = '', technician_id = null, vendor = '', cost = 0, repair_date, completion_date = null, status = 'open', priority = 'medium', notes = '', work_order_id = null } = req.body;
    if (!asset_id || !String(problem || '').trim()) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Asset and problem are required' }); }
    const numericCost = Number(cost);
    if (!Number.isFinite(numericCost) || numericCost < 0) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Repair cost must be a valid non-negative number' }); }
    const nextRepairStatus = normalizeRepairStatus(status || 'open');
    if (!Object.keys(repairStatusTransitions).includes(nextRepairStatus)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid repair status' }); }
    const asset = await Asset.findOne({ where: { id: asset_id, ...(req.user.collegeId ? { collegeId: req.user.collegeId } : {}) }, transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found in your college scope' }); }
    const item = await Maintenance.create({ assetId: asset.id, requestedBy: req.user.id, assignedTo: technician_id || null, title: String(problem).trim().slice(0, 255), description: String(problem).trim(), priority: String(priority).toLowerCase(), status: nextRepairStatus }, { transaction });
    await MaintenanceRepair.create({ maintenanceId: item.id, assetId: asset.id, workOrderId: work_order_id || null, technicianId: technician_id || null, problemDescription: problem, diagnosis, repairAction: repair_action, partsUsed: parts_replaced, totalCost: numericCost, completionDate: completion_date || null, notes, serviceCost: 0, laborCost: 0, partsCost: 0, status: nextRepairStatus }, { transaction });
    await MaintenanceHistory.create({ assetId: asset.id, maintenanceId: item.id, userId: req.user.id, actionType: 'created', description: 'Repair record created', newStatus: nextRepairStatus }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'REPAIR_CREATED', entity: `maintenance:${item.id}`, details: JSON.stringify({ assetId: asset.id, status: nextRepairStatus }) }, { transaction });
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
    const status = req.body.status ? normalizeRepairStatus(req.body.status) : normalizeRepairStatus(item.status || 'open');
    if (!Object.keys(repairStatusTransitions).includes(status)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid repair status' }); }
    await item.update({ description: req.body.problem ?? item.description, title: String(req.body.problem ?? item.title).slice(0, 255), priority: String(req.body.priority ?? item.priority).toLowerCase(), status, assignedTo: req.body.technician_id ?? item.assignedTo }, { transaction });
    if (repair) await repair.update({ diagnosis: req.body.diagnosis ?? repair.diagnosis, repairAction: req.body.repair_action ?? repair.repairAction, partsUsed: req.body.parts_replaced ?? repair.partsUsed, totalCost: req.body.cost ?? repair.totalCost, completionDate: req.body.completion_date ?? repair.completionDate, notes: req.body.notes ?? repair.notes, technicianId: req.body.technician_id ?? repair.technicianId, workOrderId: req.body.work_order_id ?? repair.workOrderId, status }, { transaction });
    await MaintenanceHistory.create({ assetId: item.assetId, maintenanceId: item.id, userId: req.user.id, actionType: 'updated', description: 'Repair record updated', newStatus: status }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'REPAIR_UPDATED', entity: `maintenance:${item.id}`, details: JSON.stringify({ status }) }, { transaction });
    await transaction.commit();
    const updated = await Maintenance.findOne({ where: { id: item.id }, include: repairInclude });
    res.json({ success: true, data: normalizeRepair(updated) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const calendarEventsSummary = (events = []) => ({
  total: events.length,
  scheduled: events.filter((event) => String(event.statusRaw || '').toLowerCase() === 'scheduled').length,
  due: events.filter((event) => String(event.statusRaw || '').toLowerCase() === 'due').length,
  overdue: events.filter((event) => String(event.statusRaw || '').toLowerCase() === 'overdue').length,
  'in-progress': events.filter((event) => String(event.statusRaw || '').toLowerCase() === 'in-progress').length,
  completed: events.filter((event) => String(event.statusRaw || '').toLowerCase() === 'completed').length,
  cancelled: events.filter((event) => String(event.statusRaw || '').toLowerCase() === 'cancelled').length,
});

const getMaintenanceCalendar = async (req, res, next) => {
  try {
    const start = req.query.start ? new Date(req.query.start) : null;
    const end = req.query.end ? new Date(req.query.end) : null;
    const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
    const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
    const normalizeString = (value) => String(value || '').trim();
    const statusFilter = normalizeString(req.query.status).toLowerCase();
    const priorityFilter = normalizeString(req.query.priority).toLowerCase();
    const technicianFilter = normalizeString(req.query.technician).toLowerCase();
    const departmentFilter = normalizeString(req.query.department).toLowerCase();
    const assetFilter = normalizeString(req.query.asset).toLowerCase();
    const typeFilter = normalizeString(req.query.maintenanceType).toLowerCase();
    const searchFilter = normalizeString(req.query.search).toLowerCase();

    const matchesValue = (value, needle) => !needle || String(value || '').toLowerCase().includes(needle);

    const maintenanceWhere = {};
    if (validStart || validEnd) {
      maintenanceWhere[Op.or] = [
        ...(validStart ? [{ createdAt: { [Op.gte]: validStart } }] : []),
        ...(validEnd ? [{ createdAt: { [Op.lte]: validEnd } }] : []),
      ];
    }
    if (statusFilter) maintenanceWhere.status = normalizeStatus(statusFilter);
    if (priorityFilter) maintenanceWhere.priority = priorityFilter;
    if (searchFilter) {
      maintenanceWhere[Op.or] = [
        { title: { [Op.like]: `%${searchFilter}%` } },
        { description: { [Op.like]: `%${searchFilter}%` } },
        { '$Asset.name$': { [Op.like]: `%${searchFilter}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${searchFilter}%` } },
        { '$Technician.fullName$': { [Op.like]: `%${searchFilter}%` } },
      ];
    }

    const preventiveWhere = {};
    if (validStart || validEnd) {
      preventiveWhere[Op.or] = [
        ...(validStart ? [{ scheduleDate: { [Op.gte]: validStart } }] : []),
        ...(validEnd ? [{ scheduleDate: { [Op.lte]: validEnd } }] : []),
        ...(validStart ? [{ nextScheduleDate: { [Op.gte]: validStart } }] : []),
        ...(validEnd ? [{ nextScheduleDate: { [Op.lte]: validEnd } }] : []),
      ];
    }
    if (statusFilter) preventiveWhere.status = normalizePreventiveStatus(statusFilter);
    if (searchFilter) {
      preventiveWhere[Op.or] = [
        { maintenanceType: { [Op.like]: `%${searchFilter}%` } },
        { notes: { [Op.like]: `%${searchFilter}%` } },
        { '$Asset.name$': { [Op.like]: `%${searchFilter}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${searchFilter}%` } },
        { '$Asset.serialNumber$': { [Op.like]: `%${searchFilter}%` } },
        { '$Technician.fullName$': { [Op.like]: `%${searchFilter}%` } },
      ];
    }

    const [maintenanceRows, preventiveRows] = await Promise.all([
      Maintenance.findAll({
        where: maintenanceWhere,
        attributes: ['id', 'assetId', 'title', 'description', 'status', 'priority', 'createdAt', 'updatedAt', 'assignedTo'],
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition'] },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
          { model: MaintenanceWorkOrder, limit: 1, order: [['createdAt', 'DESC']], include: [{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] }] },
        ],
        order: [['createdAt', 'ASC']],
        limit: 500,
      }),
      PreventiveMaintenance.findAll({
        where: preventiveWhere,
        attributes: ['id', 'assetId', 'maintenanceType', 'status', 'scheduleDate', 'nextScheduleDate', 'frequency', 'technicianId', 'notes', 'createdAt'],
        include: [
          { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition'] },
          { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] },
        ],
        order: [['nextScheduleDate', 'ASC'], ['scheduleDate', 'ASC']],
        limit: 500,
      }),
    ]);

    const maintenanceEvents = maintenanceRows
      .map((item) => {
        const data = item.toJSON();
        const workOrder = Array.isArray(data.MaintenanceWorkOrders) && data.MaintenanceWorkOrders[0] ? data.MaintenanceWorkOrders[0] : null;
        const asset = data.Asset || {};
        const technician = data.Technician?.fullName || data.Technician?.username || workOrder?.Technician?.fullName || workOrder?.Technician?.username || '';
        const startDate = workOrder?.startDate || data.createdAt || new Date();
        const endDate = workOrder?.expectedCompletionDate || new Date(new Date(startDate).getTime() + 60 * 60 * 1000);
        const eventStatus = normalizeStatus(data.status || 'pending');
        const eventPriority = String(data.priority || 'medium').toLowerCase();
        return {
          id: `maintenance-${data.id}`,
          type: 'maintenance',
          source: 'maintenance',
          title: data.title || 'Maintenance activity',
          start: startDate,
          end: endDate,
          status: displayStatus(eventStatus),
          statusRaw: eventStatus,
          priority: displayPriority(eventPriority),
          priorityRaw: eventPriority,
          maintenanceType: data.title || 'Maintenance',
          assetId: data.assetId,
          assetName: asset.name || asset.assetCode || 'Unknown asset',
          assetCode: asset.assetCode || '',
          serialNumber: asset.serialNumber || '',
          category: asset.category || '',
          department: asset.department || '',
          location: asset.location || '',
          technician,
          technicianId: data.assignedTo || workOrder?.technicianId || null,
          durationHours: 1,
          allDay: false,
          asset,
          workOrderNumber: workOrder?.workOrderNumber || null,
          scheduleId: data.id,
        };
      })
      .filter((event) => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const includeEvent = (!validStart || startDate >= validStart) && (!validEnd || endDate <= validEnd || startDate <= validEnd);
        const matches =
          matchesValue(event.assetName, assetFilter)
          && matchesValue(event.department, departmentFilter)
          && matchesValue(event.technician, technicianFilter)
          && matchesValue(event.maintenanceType, typeFilter)
          && matchesValue(event.statusRaw, statusFilter)
          && matchesValue(event.priorityRaw, priorityFilter)
          && (!searchFilter || [event.title, event.assetName, event.assetCode, String(event.assetId || ''), event.technician, event.workOrderNumber, event.department, event.location].some((value) => String(value || '').toLowerCase().includes(searchFilter)));
        return includeEvent && matches;
      });

    const preventiveEvents = preventiveRows
      .map((item) => {
        const data = item.toJSON();
        const asset = data.Asset || {};
        const technician = data.Technician?.fullName || data.Technician?.username || '';
        const dueDate = data.nextScheduleDate || data.scheduleDate || new Date();
        const eventStatus = normalizePreventiveStatus(data.status || 'scheduled');
        return {
          id: `preventive-${data.id}`,
          type: 'preventive',
          source: 'preventive',
          title: data.maintenanceType || 'Preventive maintenance',
          start: dueDate,
          end: dueDate,
          status: displayPreventiveStatus(eventStatus),
          statusRaw: eventStatus,
          priority: 'Medium',
          priorityRaw: 'medium',
          maintenanceType: data.maintenanceType || 'Preventive',
          assetId: data.assetId,
          assetName: asset.name || asset.assetCode || 'Unknown asset',
          assetCode: asset.assetCode || '',
          serialNumber: asset.serialNumber || '',
          category: asset.category || '',
          department: asset.department || '',
          location: asset.location || '',
          technician,
          technicianId: data.technicianId || null,
          durationHours: 2,
          allDay: false,
          asset,
          scheduleId: data.id,
        };
      })
      .filter((event) => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const includeEvent = (!validStart || startDate >= validStart) && (!validEnd || endDate <= validEnd || startDate <= validEnd);
        const matches =
          matchesValue(event.assetName, assetFilter)
          && matchesValue(event.department, departmentFilter)
          && matchesValue(event.technician, technicianFilter)
          && matchesValue(event.maintenanceType, typeFilter)
          && matchesValue(event.statusRaw, statusFilter)
          && matchesValue(event.priorityRaw, priorityFilter)
          && (!searchFilter || [event.title, event.assetName, event.assetCode, String(event.assetId || ''), event.technician, event.department, event.location].some((value) => String(value || '').toLowerCase().includes(searchFilter)));
        return includeEvent && matches;
      });

    const events = [...maintenanceEvents, ...preventiveEvents].sort((left, right) => new Date(left.start || 0) - new Date(right.start || 0));
    const summary = calendarEventsSummary(events);

    return res.json({
      success: true,
      data: events,
      summary,
    });
  } catch (error) { return next(error); }
};

const vendorPayload = (body = {}, existing = {}) => {
  const value = {
    supplierCode: String(body.supplierCode ?? body.vendorCode ?? existing.supplierCode ?? '').trim(),
    supplierName: String(body.supplierName ?? body.vendorName ?? body.name ?? existing.supplierName ?? '').trim(),
    legalName: String(body.legalName ?? existing.legalName ?? '').trim(),
    vendorType: String(body.vendorType ?? body.type ?? existing.vendorType ?? 'Other').trim(),
    registrationNumber: String(body.registrationNumber ?? existing.registrationNumber ?? '').trim(),
    taxIdentificationNumber: String(body.taxIdentificationNumber ?? body.taxId ?? existing.taxIdentificationNumber ?? '').trim(),
    contactPerson: String(body.contactPerson ?? existing.contactPerson ?? '').trim(),
    phone: String(body.phone ?? existing.phone ?? '').trim(),
    email: String(body.email ?? existing.email ?? '').trim(),
    website: String(body.website ?? existing.website ?? '').trim(),
    address: String(body.address ?? existing.address ?? '').trim(),
    city: String(body.city ?? existing.city ?? '').trim(),
    country: String(body.country ?? existing.country ?? '').trim(),
    paymentTerms: String(body.paymentTerms ?? existing.paymentTerms ?? '').trim(),
    notes: String(body.notes ?? existing.notes ?? '').trim(),
    status: String(body.status ?? existing.status ?? 'active').trim().toLowerCase(),
  };
  if (!value.supplierCode) value.supplierCode = `VND-${Date.now()}`;
  if (!value.supplierName) throw Object.assign(new Error('Vendor name is required'), { status: 422 });
  if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) throw Object.assign(new Error('Enter a valid vendor email address'), { status: 422 });
  if (!['active', 'inactive'].includes(value.status)) throw Object.assign(new Error('Vendor status must be active or inactive'), { status: 422 });
  return value;
};

const listMaintenanceVendors = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const where = {};
    if (['active', 'inactive'].includes(String(req.query.status || '').toLowerCase())) where.status = String(req.query.status).toLowerCase();
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = ['supplierCode', 'supplierName', 'contactPerson', 'phone', 'email', 'vendorType'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    const result = await Supplier.findAndCountAll({ where, order: [['supplierName', 'ASC'], ['id', 'ASC']], limit, offset: (page - 1) * limit });
    return res.json({ success: true, data: result.rows.map((item) => item.toJSON()), pagination: { page, limit, total: result.count, pages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) { return next(error); }
};

const getMaintenanceVendor = async (req, res, next) => {
  try {
    const vendor = await Supplier.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    return res.json({ success: true, data: vendor.toJSON() });
  } catch (error) { return next(error); }
};

const createMaintenanceVendor = async (req, res, next) => {
  try {
    const vendor = await Supplier.create(vendorPayload(req.body));
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_VENDOR_CREATED', entity: `supplier:${vendor.id}`, details: JSON.stringify({ supplierCode: vendor.supplierCode }) });
    return res.status(201).json({ success: true, data: vendor.toJSON() });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Vendor code already exists' });
    return next(error);
  }
};

const updateMaintenanceVendor = async (req, res, next) => {
  try {
    const vendor = await Supplier.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await vendor.update(vendorPayload(req.body, vendor));
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_VENDOR_UPDATED', entity: `supplier:${vendor.id}`, details: JSON.stringify({ supplierCode: vendor.supplierCode }) });
    return res.json({ success: true, data: vendor.toJSON() });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Vendor code already exists' });
    return next(error);
  }
};

const setMaintenanceVendorStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '').trim().toLowerCase();
    if (!['active', 'inactive'].includes(status)) return res.status(422).json({ success: false, message: 'Vendor status must be active or inactive' });
    const vendor = await Supplier.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await vendor.update({ status });
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_VENDOR_STATUS_CHANGED', entity: `supplier:${vendor.id}`, details: JSON.stringify({ status }) });
    return res.json({ success: true, data: vendor.toJSON() });
  } catch (error) { return next(error); }
};

module.exports = {
  getAllMaintenance,
  getPreventiveMaintenance,
  getPreventiveMaintenanceById,
  createPreventiveMaintenance,
  startPreventiveMaintenance,
  pausePreventiveMaintenance,
  resumePreventiveMaintenance,
  assignPreventiveMaintenance,
  updatePreventiveChecklist,
  updatePreventiveFindings,
  completePreventiveMaintenance,
  getInfrastructureMaintenance,
  getInfrastructureMaintenanceAssets,
  getAssetsUnderMaintenance,
  getAssetMaintenanceDetail,
  getMaintenanceHistory,
  buildMaintenanceHistoryRows,
  buildMaintenanceReportsData,
  getMaintenanceReportsSummary,
  getMaintenanceReportsActivity,
  getMaintenanceReportsHistory,
  getMaintenanceReportsWorkOrders,
  getMaintenanceReportsRepairs,
  getMaintenanceReportsPreventive,
  getMaintenanceReportsAssets,
  getMaintenanceReportsTechnicians,
  getMaintenanceReportsVendors,
  getMaintenanceReportsTesting,
  getMaintenanceReportsCosts,
  getMaintenanceReportsDowntime,
  getMaintenanceReportsDepartments,
  createMaintenance,
  updateMaintenance,
  setStatus,
  approve,
  reject,
  start,
  complete,
  assign,
  removeMaintenance,
  dashboard,
  normalizeMaintenanceWorkOrder,
  getMaintenanceWorkOrderSummary,
  getMaintenanceWorkOrders,
  getMaintenanceWorkOrder,
  getMaintenanceWorkOrderOptions,
  createMaintenanceWorkOrder,
  updateMaintenanceWorkOrder,
  updateMaintenanceWorkOrderStatus,
  assignMaintenanceWorkOrder,
  getRepairHistory,
  buildRepairSummary,
  getRepairDetails,
  createRepair,
  updateRepair,
  getSpareParts,
  getSparePartDetail,
  getTechnicianDirectory,
  getMaintenanceCalendar,
  listMaintenanceVendors,
  getMaintenanceVendor,
  createMaintenanceVendor,
  updateMaintenanceVendor,
  setMaintenanceVendorStatus,
  buildAssetMaintenanceSummary,
  validateAssetMaintenanceTransition,
};
