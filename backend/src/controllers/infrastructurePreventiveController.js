const { Op } = require('sequelize');
const { sequelize, PreventiveMaintenance, Asset, User, AuditLog } = require('../models');

const frequencies = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'semi-annual', 'annual'];
const statuses = ['pending', 'due', 'overdue', 'completed', 'skipped', 'cancelled'];
const infrastructureTerms = ['infrastructure', 'building', 'facility', 'electrical', 'generator', 'transformer', 'ups', 'inverter', 'solar', 'water', 'pump', 'tank', 'road', 'drainage'];

const assetScope = (req) => ({
  ...(req.user?.collegeId ? { collegeId: req.user.collegeId } : {}),
  [Op.or]: infrastructureTerms.flatMap((term) => [{ category: { [Op.like]: `%${term}%` } }, { name: { [Op.like]: `%${term}%` } }]),
});

const includes = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'location', 'department', 'collegeId'], where: {}, required: true },
  { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'role', 'department', 'collegeId'] },
];

const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/_/g, '-');
const effectiveStatus = (item) => {
  const status = normalizeStatus(item.status);
  if (['completed', 'cancelled', 'skipped'].includes(status) || !item.nextScheduleDate) return status || 'pending';
  const due = new Date(item.nextScheduleDate);
  if (Number.isNaN(due.getTime())) return status || 'pending';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today ? 'overdue' : (due.getTime() === today.getTime() ? 'due' : (status === 'overdue' ? 'pending' : status || 'pending'));
};

const normalize = (item) => {
  const data = item.toJSON();
  const asset = item.Asset || {};
  const technician = item.Technician || null;
  return {
    ...data,
    status: effectiveStatus(item),
    planNumber: `PM-${data.id}`,
    title: data.maintenanceType || 'Preventive maintenance',
    category: asset.category || null,
    assetName: asset.name || null,
    assetNumber: asset.assetCode || null,
    location: asset.location || null,
    assignedTo: technician?.fullName || technician?.username || null,
    technicianName: technician?.fullName || technician?.username || null,
    technician,
    lastMaintenanceDate: data.lastCompletedDate,
    nextMaintenanceDate: data.nextScheduleDate,
    description: data.notes || null,
    remarks: data.notes || null,
  };
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validatePayload = async (req, body, existing, transaction) => {
  const assetId = Number(body.assetId ?? body.asset_id ?? existing?.assetId);
  if (!Number.isInteger(assetId) || assetId < 1) return { error: 'A valid infrastructure asset is required' };
  const asset = await Asset.findOne({ where: { id: assetId, ...assetScope(req), status: { [Op.notIn]: ['disposed', 'Disposed'] } }, transaction });
  if (!asset) return { error: 'A valid infrastructure asset is required' };
  const technicianIdValue = body.technicianId ?? body.assignedTo ?? existing?.technicianId ?? null;
  const technicianId = technicianIdValue === '' || technicianIdValue === null ? null : Number(technicianIdValue);
  if (technicianId !== null && (!Number.isInteger(technicianId) || !(await User.findOne({ where: { id: technicianId, role: 'maintenance', active: true, ...(req.user?.collegeId ? { collegeId: req.user.collegeId } : {}) }, transaction })))) return { error: 'A valid active maintenance technician is required' };
  const frequency = String(body.frequency ?? existing?.frequency ?? 'once').trim().toLowerCase().replace('yearly', 'annual');
  if (!frequencies.includes(frequency)) return { error: 'Invalid preventive maintenance frequency' };
  const scheduleDate = parseDate(body.scheduleDate ?? body.nextMaintenanceDate ?? existing?.scheduleDate);
  if (!scheduleDate) return { error: 'A valid schedule date is required' };
  const nextValue = body.nextScheduleDate ?? body.nextMaintenanceDate ?? existing?.nextScheduleDate;
  const nextScheduleDate = parseDate(nextValue);
  if (nextValue && !nextScheduleDate) return { error: 'Invalid next schedule date' };
  const lastValue = body.lastCompletedDate ?? body.lastMaintenanceDate ?? existing?.lastCompletedDate;
  const lastCompletedDate = parseDate(lastValue);
  if (lastValue && !lastCompletedDate) return { error: 'Invalid last maintenance date' };
  const status = normalizeStatus(body.status ?? existing?.status ?? 'pending');
  if (!statuses.includes(status)) return { error: 'Invalid preventive maintenance status' };
  const estimatedCost = body.estimatedCost === undefined ? (existing?.estimatedCost ?? 0) : Number(body.estimatedCost || 0);
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) return { error: 'Estimated cost must be a non-negative number' };
  const maintenanceType = String(body.maintenanceType ?? existing?.maintenanceType ?? '').trim();
  if (!maintenanceType) return { error: 'Maintenance type is required' };
  return { asset, payload: { assetId, maintenanceType, scheduleDate, frequency, technicianId, checklist: String(body.checklist ?? existing?.checklist ?? '').trim(), estimatedCost, notes: String(body.notes ?? body.description ?? body.remarks ?? existing?.notes ?? '').trim(), status, lastCompletedDate, nextScheduleDate: nextScheduleDate || scheduleDate } };
};

const getPreventiveIncludes = (req) => includes.map((item, index) => index === 0 ? { ...item, where: assetScope(req) } : item);

const getInfrastructurePreventive = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {};
    if (req.query.frequency) where.frequency = String(req.query.frequency).toLowerCase().replace('yearly', 'annual');
    if (req.query.status && !['overdue', 'due'].includes(normalizeStatus(req.query.status))) where.status = normalizeStatus(req.query.status);
    if (req.query.technicianId) where.technicianId = Number(req.query.technicianId);
    if (req.query.assetId) where.assetId = Number(req.query.assetId);
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [{ maintenanceType: { [Op.like]: `%${search}%` } }, { checklist: { [Op.like]: `%${search}%` } }, { notes: { [Op.like]: `%${search}%` } }, { '$Asset.name$': { [Op.like]: `%${search}%` } }, { '$Asset.assetCode$': { [Op.like]: `%${search}%` } }, { '$Technician.fullName$': { [Op.like]: `%${search}%` } }, { '$Technician.username$': { [Op.like]: `%${search}%` } }];
    if (req.query.location) where['$Asset.location$'] = String(req.query.location);
    if (req.query.category) where['$Asset.category$'] = String(req.query.category);
    const include = getPreventiveIncludes(req);
    const { count, rows } = await PreventiveMaintenance.findAndCountAll({ where, include, order: [['nextScheduleDate', 'ASC'], ['id', 'DESC']], limit, offset: (page - 1) * limit, distinct: true });
    let data = rows.map(normalize);
    if (['overdue', 'due'].includes(normalizeStatus(req.query.status))) data = data.filter((item) => item.status === normalizeStatus(req.query.status));
    const all = await PreventiveMaintenance.findAll({ include, order: [['id', 'DESC']] });
    const normalizedAll = all.map(normalize);
    const summary = normalizedAll.reduce((result, item) => { result.total += 1; result[item.status] = (result[item.status] || 0) + 1; return result; }, { total: 0 });
    const technicians = await User.findAll({ where: { role: 'maintenance', active: true, ...(req.user?.collegeId ? { collegeId: req.user.collegeId } : {}) }, attributes: ['id', 'username', 'fullName'], order: [['fullName', 'ASC']] });
    const assets = await Asset.findAll({ where: { ...assetScope(req), status: { [Op.notIn]: ['disposed', 'Disposed'] } }, attributes: ['id', 'name', 'assetCode', 'category', 'location'], order: [['name', 'ASC']] });
    return res.json({ success: true, data, summary, filters: { frequencies, statuses, categories: [...new Set(normalizedAll.map((item) => item.category).filter(Boolean))], locations: [...new Set(normalizedAll.map((item) => item.location).filter(Boolean))], technicians, assets }, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { console.error('Error fetching infrastructure preventive maintenance:', error); return res.status(500).json({ success: false, message: 'Failed to fetch preventive maintenance plans' }); }
};

const getInfrastructurePreventiveById = async (req, res) => {
  try {
    const item = await PreventiveMaintenance.findOne({ where: { id: req.params.id }, include: getPreventiveIncludes(req) });
    if (!item) return res.status(404).json({ success: false, message: 'Preventive maintenance plan not found' });
    return res.json({ success: true, data: normalize(item) });
  } catch (error) { return res.status(500).json({ success: false, message: 'Failed to fetch preventive maintenance plan' }); }
};

const saveInfrastructurePreventive = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const existing = req.params.id ? await PreventiveMaintenance.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (req.params.id && !existing) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Preventive maintenance plan not found' }); }
    const validated = await validatePayload(req, req.body || {}, existing?.toJSON(), transaction);
    if (validated.error) { await transaction.rollback(); return res.status(422).json({ success: false, message: validated.error }); }
    const item = existing ? await existing.update(validated.payload, { transaction }) : await PreventiveMaintenance.create(validated.payload, { transaction });
    await AuditLog.create({ userId: req.user.id, action: existing ? 'UPDATE_INFRASTRUCTURE_PREVENTIVE' : 'CREATE_INFRASTRUCTURE_PREVENTIVE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ assetId: item.assetId, organizationScope: req.user.collegeId || null }) }, { transaction });
    await transaction.commit();
    const saved = await PreventiveMaintenance.findByPk(item.id, { include: getPreventiveIncludes(req) });
    return res.status(existing ? 200 : 201).json({ success: true, data: normalize(saved) });
  } catch (error) { await transaction.rollback(); console.error('Error saving infrastructure preventive maintenance:', error); return res.status(500).json({ success: false, message: 'Failed to save preventive maintenance plan' }); }
};

const deleteInfrastructurePreventive = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await PreventiveMaintenance.findOne({ where: { id: req.params.id }, include: getPreventiveIncludes(req), transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Preventive maintenance plan not found' }); }
    await item.update({ status: 'cancelled' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CANCEL_INFRASTRUCTURE_PREVENTIVE', entity: `preventive_maintenance:${item.id}`, details: JSON.stringify({ assetId: item.assetId }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: normalize(item) });
  } catch (error) { await transaction.rollback(); console.error('Error cancelling infrastructure preventive maintenance:', error); return res.status(500).json({ success: false, message: 'Failed to cancel preventive maintenance plan' }); }
};

module.exports = { getInfrastructurePreventive, getInfrastructurePreventiveById, saveInfrastructurePreventive, deleteInfrastructurePreventive };