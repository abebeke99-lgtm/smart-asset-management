const { Op } = require('sequelize');
const {
  AuditLog,
  Asset,
  Maintenance,
  MaintenanceInspection,
  MaintenanceWorkOrder,
  User,
} = require('../models');
const { createAuditLog } = require('../services/auditLogService');

const inspectionTypes = ['Routine Inspection', 'Preventive Inspection', 'Corrective Inspection', 'Safety Inspection', 'Post-Repair Inspection', 'Pre-Use Inspection', 'Other'];
const conditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const safetyStatuses = ['Safe', 'Unsafe', 'Hazardous'];
const priorities = ['low', 'medium', 'high', 'critical'];
const statuses = ['scheduled', 'in-progress', 'completed', 'failed', 'follow-up-required', 'cancelled'];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
const validDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value))
    && date.toISOString().slice(0, 10) === String(value).slice(0, 10);
};
const dateValue = (value) => (value ? new Date(value) : null);
const assetInclude = { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'location', 'status', 'condition'] };
const inspectionIncludes = [
  assetInclude,
  { model: User, as: 'Inspector', attributes: ['id', 'username', 'fullName'] },
  { model: Maintenance, attributes: ['id', 'title', 'status', 'priority'], required: false },
  { model: MaintenanceWorkOrder, as: 'WorkOrder', attributes: ['id', 'workOrderNumber', 'status'], required: false },
];

const validateInspection = (body) => {
  if (!body.assetId) return 'Asset is required.';
  if (!validDate(body.inspectionDate)) return 'A valid inspection date is required.';
  if (!inspectionTypes.includes(body.inspectionType)) return 'Select a valid inspection type.';
  if (!body.inspectorId) return 'Inspector is required.';
  if (!conditions.includes(body.condition)) return 'Select a valid asset condition.';
  if (!statuses.includes(normalize(body.status))) return 'Select a valid inspection status.';
  if (body.priority && !priorities.includes(normalize(body.priority))) return 'Select a valid priority.';
  if (body.safetyStatus && !safetyStatuses.includes(body.safetyStatus)) return 'Select a valid safety status.';
  if (body.nextInspectionDate && !validDate(body.nextInspectionDate)) return 'Enter a valid next inspection date.';
  if (body.nextInspectionDate && new Date(body.nextInspectionDate) < new Date(body.inspectionDate)) return 'Next inspection date cannot be before the inspection date.';
  return null;
};

const toPayload = (body, previous = {}) => {
  const currentCondition = body.condition ?? previous.currentCondition;
  const safetyCondition = body.safetyStatus ?? previous.safetyCondition ?? 'Safe';
  const status = normalize(body.status ?? previous.status ?? 'scheduled');
  const followUpRequired = body.followUpRequired === undefined ? Boolean(previous.followUpRequired) : Boolean(body.followUpRequired);
  const healthStatus = ['Critical', 'Unsafe', 'Hazardous'].includes(currentCondition) || ['Unsafe', 'Hazardous'].includes(safetyCondition)
    ? 'Critical'
    : ['Fair', 'Poor'].includes(currentCondition) ? 'Warning' : ['Excellent', 'Good'].includes(currentCondition) ? 'Healthy' : 'Unknown';
  return {
    inspectionDate: dateValue(body.inspectionDate ?? previous.inspectionDate),
    inspectionType: body.inspectionType ?? previous.inspectionType,
    inspectorId: body.inspectorId ?? previous.inspectorId,
    currentCondition,
    safetyCondition,
    healthStatus,
    observedProblem: String(body.findings ?? previous.observedProblem ?? '').trim(),
    physicalDamage: String(body.defects ?? previous.physicalDamage ?? '').trim(),
    recommendation: String(body.recommendedAction ?? previous.recommendation ?? '').trim(),
    priority: normalize(body.priority ?? previous.priority ?? 'medium'),
    followUpRequired,
    nextInspection: dateValue(body.nextInspectionDate ?? previous.nextInspection),
    inspectionNotes: String(body.notes ?? previous.inspectionNotes ?? '').trim(),
    status,
    inspectionResult: status === 'failed' ? 'Fail' : followUpRequired ? 'Further Inspection' : status === 'completed' ? 'Pass' : 'Pending',
    maintenanceId: body.maintenanceId === undefined ? (previous.maintenanceId || null) : (body.maintenanceId || null),
    workOrderId: body.workOrderId === undefined ? (previous.workOrderId || null) : (body.workOrderId || null),
  };
};

const getInspectionOptions = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const assetWhere = { status: { [Op.notIn]: ['disposed', 'Disposed'] } };
    if (search) assetWhere[Op.or] = ['name', 'assetCode', 'serialNumber', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    const assetId = req.query.assetId ? Number(req.query.assetId) : null;
    const [assets, inspectors, maintenanceRows, workOrders] = await Promise.all([
      Asset.findAll({ where: { ...assetWhere, ...(assetId ? { id: assetId } : {}) }, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'location', 'status', 'condition'], order: [['name', 'ASC']], limit: 50 }),
      User.findAll({ where: { active: true, role: 'maintenance' }, attributes: ['id', 'username', 'fullName'], order: [['fullName', 'ASC'], ['username', 'ASC']] }),
      Maintenance.findAll({ where: assetId ? { assetId } : {}, attributes: ['id', 'assetId', 'title', 'status'], order: [['createdAt', 'DESC']], limit: 100 }),
      MaintenanceWorkOrder.findAll({ where: assetId ? { assetId } : {}, attributes: ['id', 'assetId', 'maintenanceId', 'workOrderNumber', 'status'], order: [['createdAt', 'DESC']], limit: 100 }),
    ]);
    return res.json({ success: true, data: { assets, inspectors, maintenance: maintenanceRows, workOrders } });
  } catch (error) { return next(error); }
};

const listInspections = async (req, res, next) => {
  try {
    if ((req.query.from && !validDate(req.query.from)) || (req.query.to && !validDate(req.query.to))) return res.status(422).json({ success: false, message: 'Inspection date filters must be valid dates.' });
    if (req.query.from && req.query.to && req.query.from > req.query.to) return res.status(422).json({ success: false, message: 'The start date cannot be after the end date.' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {};
    const search = String(req.query.search || '').trim();
    if (req.query.status) where.status = normalize(req.query.status);
    if (req.query.condition) where.currentCondition = req.query.condition;
    if (req.query.priority) where.priority = normalize(req.query.priority);
    if (req.query.inspectionType) where.inspectionType = req.query.inspectionType;
    if (req.query.inspectorId) where.inspectorId = Number(req.query.inspectorId);
    if (req.query.from || req.query.to) {
      const inspectionDate = {};
      if (req.query.from && validDate(req.query.from)) inspectionDate[Op.gte] = new Date(`${req.query.from.slice(0, 10)}T00:00:00`);
      if (req.query.to) {
        const endDate = new Date(`${req.query.to.slice(0, 10)}T00:00:00`);
        endDate.setDate(endDate.getDate() + 1);
        inspectionDate[Op.lt] = endDate;
      }
      if (Object.keys(inspectionDate).length) where.inspectionDate = inspectionDate;
    }
    if (search) where[Op.or] = [
      { inspectionNumber: { [Op.like]: `%${search}%` } },
      { observedProblem: { [Op.like]: `%${search}%` } },
      { recommendation: { [Op.like]: `%${search}%` } },
      { physicalDamage: { [Op.like]: `%${search}%` } },
      { '$Asset.name$': { [Op.like]: `%${search}%` } },
      { '$Asset.asset_code$': { [Op.like]: `%${search}%` } },
      { '$Asset.serial_number$': { [Op.like]: `%${search}%` } },
      { '$Inspector.full_name$': { [Op.like]: `%${search}%` } },
      { '$Inspector.username$': { [Op.like]: `%${search}%` } },
      ...(String(search).match(/^(?:INS-)?0*(\d+)$/i) ? [{ id: Number(String(search).match(/^(?:INS-)?0*(\d+)$/i)[1]) }] : []),
    ];
    const { count, rows } = await MaintenanceInspection.findAndCountAll({
      where,
      include: inspectionIncludes,
      order: [['inspectionDate', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const [total, scheduled, completed, followUp, failedCritical] = await Promise.all([
      MaintenanceInspection.count(),
      MaintenanceInspection.count({ where: { status: 'scheduled' } }),
      MaintenanceInspection.count({ where: { status: 'completed' } }),
      MaintenanceInspection.count({ where: { status: 'follow-up-required' } }),
      MaintenanceInspection.count({ where: { [Op.or]: [{ status: 'failed' }, { currentCondition: 'Critical' }] } }),
    ]);
    const summary = { total, scheduled, completed, followUp, failedCritical };
    return res.json({ success: true, data: rows, summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { return next(error); }
};

const getInspection = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ success: false, message: 'Invalid inspection ID.' });
    const inspection = await MaintenanceInspection.findByPk(Number(req.params.id), { include: inspectionIncludes });
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found.' });
    const historyRows = await AuditLog.findAll({ where: { entity: `maintenance_inspection:${inspection.id}` }, attributes: ['id', 'action', 'details', 'createdAt'], order: [['createdAt', 'DESC']] });
    const history = historyRows.map((row) => {
      let details = {};
      try { details = JSON.parse(row.details || '{}'); } catch { details = {}; }
      return { id: row.id, action: row.action, date: row.createdAt, oldValue: details.old_value || null, newValue: details.new_value || null };
    });
    return res.json({ success: true, data: inspection, history });
  } catch (error) { return next(error); }
};

const validateLinks = async ({ assetId, inspectorId, maintenanceId, workOrderId }) => {
  const [asset, inspector, maintenance, workOrder] = await Promise.all([
    Asset.findByPk(assetId),
    User.findOne({ where: { id: inspectorId, active: true, role: 'maintenance' } }),
    maintenanceId ? Maintenance.findByPk(maintenanceId) : null,
    workOrderId ? MaintenanceWorkOrder.findByPk(workOrderId) : null,
  ]);
  if (!asset) return { error: 'The selected asset could not be found.' };
  if (!inspector) return { error: 'Select an active maintenance inspector.' };
  if (maintenanceId && (!maintenance || Number(maintenance.assetId) !== Number(assetId))) return { error: 'The selected maintenance request does not belong to this asset.' };
  if (workOrderId && (!workOrder || Number(workOrder.assetId) !== Number(assetId))) return { error: 'The selected work order does not belong to this asset.' };
  if (workOrderId && maintenanceId && Number(workOrder.maintenanceId) !== Number(maintenanceId)) return { error: 'The selected work order does not belong to this maintenance request.' };
  return { workOrder };
};

const createInspection = async (req, res, next) => {
  try {
    const payload = { ...req.body, assetId: Number(req.body.assetId), inspectorId: Number(req.body.inspectorId) };
    const validationError = validateInspection(payload);
    if (validationError) return res.status(422).json({ success: false, message: validationError });
    const links = await validateLinks({ assetId: payload.assetId, inspectorId: payload.inspectorId, maintenanceId: payload.maintenanceId, workOrderId: payload.workOrderId });
    if (links.error) return res.status(404).json({ success: false, message: links.error });
    const inspection = await MaintenanceInspection.create({ ...toPayload({ ...payload, maintenanceId: payload.maintenanceId || links.workOrder?.maintenanceId }), assetId: payload.assetId, createdBy: req.user.id });
    const inspectionNumber = `INS-${String(inspection.id).padStart(6, '0')}`;
    await inspection.update({ inspectionNumber });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_MAINTENANCE_INSPECTION', entity: `maintenance_inspection:${inspection.id}`, entityId: inspection.id, newValue: inspection.toJSON(), details: { assetId: inspection.assetId } });
    const saved = await MaintenanceInspection.findByPk(inspection.id, { include: inspectionIncludes });
    return res.status(201).json({ success: true, data: saved });
  } catch (error) { return next(error); }
};

const updateInspection = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ success: false, message: 'Invalid inspection ID.' });
    const inspection = await MaintenanceInspection.findByPk(Number(req.params.id));
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found.' });
    const payload = {
      ...req.body,
      assetId: Number(req.body.assetId ?? inspection.assetId),
      inspectorId: Number(req.body.inspectorId ?? inspection.inspectorId),
      inspectionDate: req.body.inspectionDate ?? (inspection.inspectionDate ? String(inspection.inspectionDate).slice(0, 10) : ''),
      inspectionType: req.body.inspectionType ?? inspection.inspectionType,
      condition: req.body.condition ?? inspection.currentCondition,
      status: req.body.status ?? inspection.status,
    };
    const validationError = validateInspection(payload);
    if (validationError) return res.status(422).json({ success: false, message: validationError });
    const links = await validateLinks({ assetId: payload.assetId, inspectorId: payload.inspectorId, maintenanceId: req.body.maintenanceId ?? inspection.maintenanceId, workOrderId: req.body.workOrderId ?? inspection.workOrderId });
    if (links.error) return res.status(404).json({ success: false, message: links.error });
    const oldValue = inspection.toJSON();
    await inspection.update({ ...toPayload({ ...payload, maintenanceId: payload.maintenanceId || links.workOrder?.maintenanceId }, inspection.toJSON()), assetId: payload.assetId });
    const action = oldValue.status !== inspection.status ? 'UPDATE_MAINTENANCE_INSPECTION_STATUS' : 'UPDATE_MAINTENANCE_INSPECTION';
    await createAuditLog({ userId: req.user.id, role: req.user.role, action, entity: `maintenance_inspection:${inspection.id}`, entityId: inspection.id, oldValue, newValue: inspection.toJSON(), details: { assetId: inspection.assetId, statusChanged: oldValue.status !== inspection.status } });
    const saved = await MaintenanceInspection.findByPk(inspection.id, { include: inspectionIncludes });
    return res.json({ success: true, data: saved });
  } catch (error) { return next(error); }
};

const deleteInspection = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ success: false, message: 'Invalid inspection ID.' });
    const inspection = await MaintenanceInspection.findByPk(Number(req.params.id));
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found.' });
    const oldValue = inspection.toJSON();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DELETE_MAINTENANCE_INSPECTION', entity: `maintenance_inspection:${inspection.id}`, entityId: inspection.id, oldValue, details: { assetId: inspection.assetId } });
    await inspection.destroy();
    return res.json({ success: true, message: 'Inspection archived.' });
  } catch (error) { return next(error); }
};

module.exports = { listInspections, getInspection, getInspectionOptions, createInspection, updateInspection, deleteInspection, validateInspection };