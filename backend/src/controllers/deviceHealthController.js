const { Op } = require('sequelize');
const { Asset, Assignment, AuditLog, Maintenance, MaintenanceInspection, MaintenanceRepair, User } = require('../models');

const scopeWhere = (req) => req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId };
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
const activeMaintenanceStatuses = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing'];
const validConditions = ['Good', 'Fair', 'Poor', 'Critical', 'Unknown'];
const validHealthStatuses = ['Healthy', 'Warning', 'Critical', 'Unknown'];

const healthFromData = ({ asset, inspection, maintenance }) => {
  if (inspection?.healthStatus && validHealthStatuses.includes(inspection.healthStatus)) return inspection.healthStatus;
  const condition = normalize(inspection?.currentCondition || asset.condition);
  const assetStatus = normalize(asset.status);
  if (['critical', 'non-functional', 'broken', 'in-repair'].includes(condition) || ['broken', 'in-repair'].includes(assetStatus)) return 'Critical';
  if (activeMaintenanceStatuses.includes(maintenance?.status) || ['poor', 'fair', 'unsafe'].includes(condition) || ['under-maintenance', 'testing'].includes(assetStatus)) return 'Warning';
  if (['good', 'working', 'new'].includes(condition) || ['available', 'assigned', 'in-use', 'ready', 'idle'].includes(assetStatus)) return 'Healthy';
  return 'Unknown';
};

const scoreFor = (inspection) => Number.isFinite(Number(inspection?.healthScore)) ? Number(inspection.healthScore) : null;

const serialize = (asset, assignment, inspection, maintenance, repairCount, lastRepair) => ({
  id: asset.id,
  assetName: asset.name,
  assetTag: asset.assetCode,
  serialNumber: asset.serialNumber || null,
  category: asset.category || null,
  deviceType: asset.model || asset.category || null,
  location: asset.location || null,
  assignedUser: assignment?.User?.fullName || assignment?.User?.username || null,
  assetStatus: asset.status || null,
  condition: inspection?.currentCondition || asset.condition || 'Unknown',
  healthStatus: healthFromData({ asset, inspection, maintenance }),
  healthScore: scoreFor(inspection),
  lastInspection: inspection?.inspectionDate || null,
  nextInspection: inspection?.nextInspection || null,
  maintenanceStatus: maintenance?.status || 'none',
  lastMaintenance: maintenance?.updatedAt || null,
  lastRepair: lastRepair?.completionDate || lastRepair?.updatedAt || null,
  repairStatus: lastRepair?.status || 'none',
  repairCount,
  maintenanceDue: Boolean(maintenance && activeMaintenanceStatuses.includes(maintenance.status)),
  lastSeen: inspection?.lastSeen || null,
  technicalHealth: {
    hardwareStatus: inspection?.hardwareStatus || null,
    softwareStatus: inspection?.softwareStatus || null,
    batteryHealth: inspection?.batteryHealth || null,
    storageHealth: inspection?.storageHealth || null,
    memoryStatus: inspection?.memoryStatus || null,
    temperatureStatus: inspection?.temperatureStatus || null,
    networkStatus: inspection?.networkStatus || null,
    uptime: inspection?.uptime || null,
  },
  notes: inspection?.inspectionNotes || asset.notes || '',
});

const loadHealthData = async (assets) => {
  const ids = assets.map((asset) => asset.id);
  if (!ids.length) return new Map();
  const [assignments, inspections, maintenanceRows, repairs] = await Promise.all([
    Assignment.findAll({ where: { assetId: { [Op.in]: ids }, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] }),
    MaintenanceInspection.findAll({ where: { assetId: { [Op.in]: ids } }, order: [['inspectionDate', 'DESC'], ['createdAt', 'DESC']] }),
    Maintenance.findAll({ where: { assetId: { [Op.in]: ids } }, order: [['updatedAt', 'DESC']] }),
    MaintenanceRepair.findAll({ where: { assetId: { [Op.in]: ids } }, order: [['updatedAt', 'DESC']] }),
  ]);
  const result = new Map();
  assets.forEach((asset) => {
    const assetInspections = inspections.filter((item) => item.assetId === asset.id);
    const assetMaintenance = maintenanceRows.filter((item) => item.assetId === asset.id);
    const assetRepairs = repairs.filter((item) => item.assetId === asset.id);
    result.set(asset.id, serialize(
      asset,
      assignments.find((item) => item.assetId === asset.id),
      assetInspections[0],
      assetMaintenance[0],
      assetRepairs.length,
      assetRepairs[0],
    ));
    result.get(asset.id).history = assetInspections.map((item) => ({ id: item.id, date: item.inspectionDate, status: item.healthStatus || healthFromData({ asset, inspection: item, maintenance: assetMaintenance[0] }), condition: item.currentCondition, notes: item.inspectionNotes }));
    result.get(asset.id).maintenanceHistory = assetMaintenance.slice(0, 10).map((item) => ({ id: item.id, status: item.status, title: item.title, date: item.updatedAt || item.createdAt }));
    result.get(asset.id).repairHistory = assetRepairs.slice(0, 10).map((item) => ({ id: item.id, status: item.status, date: item.completionDate || item.updatedAt, notes: item.notes }));
  });
  return result;
};

const listDeviceHealth = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const where = { ...scopeWhere(req) };
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = ['name', 'assetCode', 'serialNumber', 'category', 'model', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    if (req.query.category) where.category = req.query.category;
    if (req.query.condition) where.condition = req.query.condition;
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    const derivedFilters = Boolean(req.query.healthStatus || req.query.maintenanceStatus || req.query.inspectionStatus);
    const { count, rows } = derivedFilters
      ? { count: null, rows: await Asset.findAll({ where, order: [['updatedAt', 'DESC']] }) }
      : await Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const allAssets = await Asset.findAll({ where, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'model', 'location', 'status', 'condition', 'notes'] });
    const healthMap = await loadHealthData(allAssets);
    let devices = allAssets.map((asset) => healthMap.get(asset.id));
    if (req.query.healthStatus) devices = devices.filter((device) => device.healthStatus === req.query.healthStatus);
    if (req.query.maintenanceStatus) devices = devices.filter((device) => req.query.maintenanceStatus === 'due' ? device.maintenanceDue : device.maintenanceStatus === req.query.maintenanceStatus);
    if (req.query.inspectionStatus) devices = devices.filter((device) => req.query.inspectionStatus === 'due' ? !device.lastInspection : Boolean(device.lastInspection));
    const summary = allAssets.map((asset) => healthMap.get(asset.id)).reduce((result, device) => {
      result.total += 1;
      result[device.healthStatus.toLowerCase()] = (result[device.healthStatus.toLowerCase()] || 0) + 1;
      if (device.maintenanceDue) result.maintenance += 1;
      if (!device.lastInspection) result.inspectionDue += 1;
      if (device.healthScore !== null) { result.scored += 1; result.scoreTotal += device.healthScore; }
      return result;
    }, { total: 0, healthy: 0, warning: 0, critical: 0, unknown: 0, maintenance: 0, inspectionDue: 0, scored: 0, scoreTotal: 0 });
    summary.averageHealthScore = summary.scored ? Math.round(summary.scoreTotal / summary.scored) : null;
    delete summary.scored;
    delete summary.scoreTotal;
    const total = derivedFilters ? devices.length : count;
    if (derivedFilters) devices = devices.slice((page - 1) * limit, page * limit);
    res.json({ success: true, devices, total, summary, pagination: { page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { next(error); }
};

const getDeviceHealth = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Device health record not found' });
    const health = (await loadHealthData([asset])).get(asset.id);
    return res.json({ success: true, device: health });
  } catch (error) { return next(error); }
};

const validateInspection = (body) => {
  const condition = body.condition || body.currentCondition || 'Unknown';
  const healthStatus = body.healthStatus || 'Unknown';
  if (!validConditions.includes(condition)) return 'Invalid condition';
  if (!validHealthStatuses.includes(healthStatus)) return 'Invalid health status';
  if (body.inspectionDate && Number.isNaN(Date.parse(body.inspectionDate))) return 'Invalid inspection date';
  if (body.nextInspection && Number.isNaN(Date.parse(body.nextInspection))) return 'Invalid next inspection date';
  if (body.healthScore !== undefined && (!Number.isInteger(Number(body.healthScore)) || Number(body.healthScore) < 0 || Number(body.healthScore) > 100)) return 'Health score must be an integer from 0 to 100';
  return null;
};

const createInspection = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.body.assetId || req.body.asset_id, ...scopeWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your authorized college scope' });
    const validationError = validateInspection(req.body);
    if (validationError) return res.status(422).json({ success: false, message: validationError });
    const inspection = await MaintenanceInspection.create({
      maintenanceId: req.body.maintenanceId || null,
      assetId: asset.id,
      inspectorId: req.user.id,
      inspectionDate: req.body.inspectionDate || new Date(),
      nextInspection: req.body.nextInspection || null,
      currentCondition: req.body.condition || req.body.currentCondition || 'Unknown',
      healthStatus: req.body.healthStatus || 'Unknown',
      healthScore: req.body.healthScore === undefined ? null : Number(req.body.healthScore),
      hardwareStatus: req.body.hardwareStatus || null,
      softwareStatus: req.body.softwareStatus || null,
      batteryHealth: req.body.batteryHealth || null,
      storageHealth: req.body.storageHealth || null,
      memoryStatus: req.body.memoryStatus || null,
      temperatureStatus: req.body.temperatureStatus || null,
      networkStatus: req.body.networkStatus || null,
      uptime: req.body.uptime || null,
      lastSeen: req.body.lastSeen || null,
      observedProblem: String(req.body.issuesFound || '').trim(),
      recommendation: String(req.body.recommendedAction || '').trim(),
      inspectionNotes: String(req.body.notes || '').trim(),
      inspectionResult: req.body.inspectionResult || 'Completed',
      status: 'completed',
    });
    await AuditLog.create({ userId: req.user.id, action: 'DEVICE_HEALTH_INSPECTION_CREATED', entity: `asset:${asset.id}`, details: JSON.stringify({ inspectionId: inspection.id, assetId: asset.id, healthStatus: inspection.healthStatus, condition: inspection.currentCondition }) });
    return res.status(201).json({ success: true, inspection });
  } catch (error) { return next(error); }
};

module.exports = { listDeviceHealth, getDeviceHealth, createInspection };