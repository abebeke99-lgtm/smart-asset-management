const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Infrastructure, AuditLog } = require('../models');

const WATER_STATUS = ['Operational', 'Under Maintenance', 'Inactive', 'Failed', 'Fault'];
const WATER_CONDITION = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical', 'Damaged'];
const WATER_SPEC_FIELDS = [
  'zone', 'source', 'capacity', 'flowRate', 'pressure', 'tankCapacity',
  'pipeLength', 'pumpCount', 'installationDate', 'nextInspectionDate'
];

const waterWhere = () => ({
  [Op.or]: [
    { category: { [Op.like]: '%water%' } },
    { subcategory: { [Op.like]: '%water%' } },
    { type: { [Op.like]: '%water%' } },
    { name: { [Op.like]: '%water%' } },
    { category: { [Op.like]: '%pump%' } },
    { subcategory: { [Op.like]: '%pump%' } },
    { type: { [Op.like]: '%pump%' } },
    { name: { [Op.like]: '%pump%' } },
    { category: { [Op.like]: '%tank%' } },
    { subcategory: { [Op.like]: '%tank%' } },
    { type: { [Op.like]: '%tank%' } },
    { name: { [Op.like]: '%tank%' } },
    { category: { [Op.like]: '%borehole%' } },
    { subcategory: { [Op.like]: '%borehole%' } },
    { type: { [Op.like]: '%borehole%' } },
    { name: { [Op.like]: '%borehole%' } }
  ]
});

const clean = (value) => value === undefined || value === null ? '' : String(value).trim();
const specsOf = (asset) => asset?.specifications && typeof asset.specifications === 'object' ? asset.specifications : {};
const mergeWhere = (...clauses) => ({ [Op.and]: clauses.filter(Boolean) });
const pageParams = (query) => ({
  page: Math.max(1, Number(query.page) || 1),
  limit: Math.min(100, Math.max(1, Number(query.limit) || 10))
});
const canonical = (value, values, fallback) => {
  const match = values.find((item) => item.toLowerCase() === clean(value).toLowerCase());
  return match || fallback;
};
const errorResponse = (res, status, message) => res.status(status).json({ success: false, message });

const serialize = (asset) => {
  const row = asset.toJSON ? asset.toJSON() : asset;
  const specs = specsOf(row);
  return {
    ...row,
    code: row.assetCode,
    systemType: row.subcategory || row.type || row.category,
    ...Object.fromEntries(WATER_SPEC_FIELDS.map((field) => [field, specs[field] ?? null])),
    description: row.description || row.notes || null
  };
};

const filterWhere = (query) => {
  const conditions = [waterWhere()];
  const search = clean(query.search);
  if (search) conditions.push({ [Op.or]: ['name', 'assetCode', 'serialNumber', 'type', 'category', 'subcategory', 'building', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) });
  if (clean(query.status)) conditions.push({ status: canonical(query.status, WATER_STATUS, query.status) });
  if (clean(query.condition)) conditions.push({ condition: canonical(query.condition, WATER_CONDITION, query.condition) });
  if (clean(query.location)) conditions.push({ location: query.location });
  if (clean(query.building)) conditions.push({ building: query.building });
  if (clean(query.type)) conditions.push({ [Op.or]: [{ type: query.type }, { category: query.type }, { subcategory: query.type }] });
  return mergeWhere(...conditions);
};

const summaryFor = async () => {
  const assets = await Infrastructure.findAll({ where: waterWhere(), attributes: ['status', 'condition'], raw: true });
  return assets.reduce((summary, asset) => {
    const status = clean(asset.status).toLowerCase();
    const condition = clean(asset.condition).toLowerCase();
    summary.total += 1;
    if (['operational', 'active'].includes(status)) summary.operational += 1;
    if (status.includes('maintenance')) summary.maintenance += 1;
    if (['failed', 'fault'].includes(status)) summary.failed += 1;
    if (['inactive', 'decommissioned', 'disposed'].includes(status)) summary.inactive += 1;
    if (['critical', 'damaged'].includes(condition)) summary.critical += 1;
    return summary;
  }, { total: 0, operational: 0, maintenance: 0, failed: 0, inactive: 0, critical: 0 });
};

const filterOptions = async () => {
  const assets = await Infrastructure.findAll({ where: waterWhere(), attributes: ['type', 'category', 'subcategory', 'location', 'building', 'status', 'condition'], raw: true });
  const values = (field) => [...new Set(assets.map((asset) => asset[field]).filter(Boolean))].sort();
  return {
    types: [...new Set(assets.flatMap((asset) => [asset.type, asset.category, asset.subcategory]).filter(Boolean))].sort(),
    locations: values('location'),
    buildings: values('building'),
    statuses: values('status'),
    conditions: values('condition')
  };
};

const payloadForAsset = (body, existing) => {
  const currentSpecs = specsOf(existing);
  const payload = {};
  const fields = ['name', 'serialNumber', 'location', 'building', 'manufacturer', 'model', 'description', 'lastInspectionDate', 'department', 'notes'];
  fields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field] === '' ? null : body[field];
  });
  if (body.code !== undefined || body.assetCode !== undefined) payload.assetCode = clean(body.assetCode ?? body.code) || null;
  if (!existing) {
    payload.type = clean(body.systemType || body.type) || 'Water System';
    payload.category = 'Water Systems';
    payload.subcategory = clean(body.systemType || body.subcategory) || null;
  }
  if (body.status !== undefined) payload.status = canonical(body.status, WATER_STATUS, 'Operational');
  if (body.condition !== undefined) payload.condition = canonical(body.condition, WATER_CONDITION, 'Good');
  const nextSpecs = { ...currentSpecs };
  WATER_SPEC_FIELDS.forEach((field) => {
    if (body[field] !== undefined) nextSpecs[field] = body[field] === '' ? null : body[field];
  });
  payload.specifications = nextSpecs;
  return payload;
};

const validate = (body, isUpdate) => {
  if (!isUpdate && !clean(body.name)) return 'Water system name is required';
  if (!isUpdate && !clean(body.systemType || body.type)) return 'System type is required';
  if (!isUpdate && !clean(body.location)) return 'Location is required';
  if (body.status !== undefined && !WATER_STATUS.some((item) => item.toLowerCase() === clean(body.status).toLowerCase())) return 'Invalid water system status';
  if (body.condition !== undefined && !WATER_CONDITION.some((item) => item.toLowerCase() === clean(body.condition).toLowerCase())) return 'Invalid water system condition';
  for (const field of ['installationDate', 'nextInspectionDate']) if (body[field] && Number.isNaN(Date.parse(body[field]))) return `Invalid ${field}`;
  if (body.pumpCount !== undefined && body.pumpCount !== '' && (!Number.isInteger(Number(body.pumpCount)) || Number(body.pumpCount) < 0)) return 'Pump count must be a non-negative whole number';
  return null;
};

const getWaterSystems = async (req, res) => {
  try {
    const { page, limit } = pageParams(req.query);
    const where = filterWhere(req.query);
    const [{ count, rows }, summary, filters] = await Promise.all([
      Infrastructure.findAndCountAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit }),
      summaryFor(),
      filterOptions()
    ]);
    return res.json({ success: true, data: rows.map(serialize), summary, filters, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) {
    console.error('Error fetching water infrastructure:', error);
    return errorResponse(res, 500, 'Server error while loading water systems');
  }
};

const getWaterSystem = async (req, res) => {
  try {
    const asset = await Infrastructure.findOne({ where: mergeWhere({ id: req.params.id }, waterWhere()) });
    if (!asset) return errorResponse(res, 404, 'Water system not found');
    return res.json({ success: true, data: serialize(asset) });
  } catch (error) {
    return errorResponse(res, 500, 'Server error while loading water system');
  }
};

const createWaterSystem = async (req, res) => {
  const validation = validate(req.body || {}, false);
  if (validation) return errorResponse(res, 422, validation);
  const transaction = await sequelize.transaction();
  try {
    const payload = payloadForAsset(req.body, null);
    const identifiers = [{ assetCode: payload.assetCode }, { serialNumber: payload.serialNumber }].filter((item) => Object.values(item)[0]);
    if (identifiers.length && await Infrastructure.findOne({ where: { [Op.or]: identifiers }, transaction })) { await transaction.rollback(); return errorResponse(res, 409, 'Asset code or serial number already exists'); }
    const asset = await Infrastructure.create({ ...payload, createdBy: req.user.id }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_WATER_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: serialize(asset), message: 'Water system registered successfully' });
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return errorResponse(res, 409, 'Asset code or serial number already exists');
    console.error('Error creating water infrastructure:', error);
    return errorResponse(res, 500, 'Server error while creating water system');
  }
};

const updateWaterSystem = async (req, res) => {
  const validation = validate(req.body || {}, true);
  if (validation) return errorResponse(res, 422, validation);
  const transaction = await sequelize.transaction();
  try {
    const asset = await Infrastructure.findOne({ where: mergeWhere({ id: req.params.id }, waterWhere()), transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return errorResponse(res, 404, 'Water system not found'); }
    const payload = payloadForAsset(req.body, asset);
    const identifiers = [{ assetCode: payload.assetCode }, { serialNumber: payload.serialNumber }].filter((item) => Object.values(item)[0]);
    if (identifiers.length && await Infrastructure.findOne({ where: { id: { [Op.ne]: asset.id }, [Op.or]: identifiers }, transaction })) { await transaction.rollback(); return errorResponse(res, 409, 'Asset code or serial number already exists'); }
    await asset.update(payload, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_WATER_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(asset), message: 'Water system updated successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating water infrastructure:', error);
    return errorResponse(res, 500, 'Server error while updating water system');
  }
};

const deactivateWaterSystem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Infrastructure.findOne({ where: mergeWhere({ id: req.params.id }, waterWhere()), transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return errorResponse(res, 404, 'Water system not found'); }
    await asset.update({ status: 'Inactive' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_WATER_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(asset), message: 'Water system deactivated successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deactivating water infrastructure:', error);
    return errorResponse(res, 500, 'Server error while deactivating water system');
  }
};

module.exports = { getWaterSystems, getWaterSystem, createWaterSystem, updateWaterSystem, deactivateWaterSystem };
