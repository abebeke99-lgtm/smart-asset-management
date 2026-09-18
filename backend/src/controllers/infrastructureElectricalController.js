const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Infrastructure, AuditLog } = require('../models');

const electricalWhere = () => ({
  [Op.or]: [
    { category: { [Op.like]: '%electrical%' } },
    { type: { [Op.like]: '%electrical%' } },
    { subcategory: { [Op.like]: '%electrical%' } },
    { category: { [Op.like]: '%power distribution%' } },
    { subcategory: { [Op.like]: '%power distribution%' } }
  ]
});

const mergeWhere = (...clauses) => ({ [Op.and]: clauses.filter(Boolean) });
const pageParams = (query) => ({
  page: Math.max(1, Number(query.page) || 1),
  limit: Math.min(100, Math.max(1, Number(query.limit) || 10))
});
const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());
const specifications = (asset) => (asset.specifications && typeof asset.specifications === 'object' ? asset.specifications : {});

const serialize = (asset) => {
  const row = asset.toJSON ? asset.toJSON() : asset;
  const specs = specifications(row);
  return {
    ...row,
    systemType: row.subcategory || row.type || row.category,
    code: row.assetCode,
    voltage: specs.voltage ?? specs.voltageRating ?? null,
    capacity: specs.capacity ?? specs.powerCapacity ?? specs.rating ?? null,
    installationDate: row.purchaseDate,
    nextInspectionDate: specs.nextInspectionDate ?? null,
    description: row.description || row.notes || null
  };
};

const errorResponse = (res, status, message) => res.status(status).json({ success: false, message });

const getElectricalSystems = async (req, res) => {
  try {
    const { page, limit } = pageParams(req.query);
    const where = electricalWhere();
    const conditions = [where];
    const search = clean(req.query.search);
    const filters = ['status', 'condition', 'building', 'location'];
    filters.forEach((field) => {
      if (clean(req.query[field])) conditions.push({ [field]: clean(req.query[field]) });
    });
    if (clean(req.query.type)) {
      conditions.push({ [Op.or]: [{ type: clean(req.query.type) }, { category: clean(req.query.type) }, { subcategory: clean(req.query.type) }] });
    }
    if (search) {
      conditions.push({ [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { subcategory: { [Op.like]: `%${search}%` } },
        { building: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ] });
    }
    const scopedWhere = mergeWhere(...conditions);
    const { count, rows } = await Infrastructure.findAndCountAll({
      where: scopedWhere,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });
    const [typeRows, buildingRows, locationRows, statusRows, conditionRows] = await Promise.all([
      Infrastructure.findAll({ where: mergeWhere(...conditions.slice(0, 1)), attributes: ['type', 'category', 'subcategory'], raw: true }),
      Infrastructure.findAll({ where: mergeWhere(...conditions.slice(0, 1)), attributes: ['building'], group: ['building'], raw: true }),
      Infrastructure.findAll({ where: mergeWhere(...conditions.slice(0, 1)), attributes: ['location'], group: ['location'], raw: true }),
      Infrastructure.findAll({ where: mergeWhere(...conditions.slice(0, 1)), attributes: ['status'], group: ['status'], raw: true }),
      Infrastructure.findAll({ where: mergeWhere(...conditions.slice(0, 1)), attributes: ['condition'], group: ['condition'], raw: true })
    ]);
    const types = [...new Set(typeRows.flatMap((row) => [row.type, row.category, row.subcategory]).filter(Boolean))].sort();
    return res.json({
      success: true,
      data: rows.map(serialize),
      filters: {
        types,
        buildings: buildingRows.map((row) => row.building).filter(Boolean).sort(),
        locations: locationRows.map((row) => row.location).filter(Boolean).sort(),
        statuses: statusRows.map((row) => row.status).filter(Boolean).sort(),
        conditions: conditionRows.map((row) => row.condition).filter(Boolean).sort()
      },
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) }
    });
  } catch (error) {
    console.error('Error fetching electrical infrastructure:', error);
    return errorResponse(res, 500, 'Server error while loading electrical systems');
  }
};

const getElectricalSystem = async (req, res) => {
  const asset = await Infrastructure.findOne({ where: mergeWhere({ id: req.params.id }, electricalWhere()) });
  if (!asset) return errorResponse(res, 404, 'Electrical system not found');
  return res.json({ success: true, data: serialize(asset) });
};

const payloadForAsset = (body, existing = null) => {
  const allowed = ['name', 'assetCode', 'serialNumber', 'location', 'building', 'block', 'floor', 'room', 'status', 'condition', 'manufacturer', 'model', 'brand', 'description', 'lastInspectionDate', 'department', 'notes'];
  const payload = {};
  allowed.forEach((field) => { if (body[field] !== undefined) payload[field] = body[field] === '' ? null : body[field]; });
  if (!existing) {
    payload.type = clean(body.type) || 'Electrical Equipment';
    payload.category = clean(body.category) || 'Electrical Equipment';
    payload.subcategory = clean(body.subcategory) || null;
  }
  const specs = { ...(existing ? specifications(existing) : {}) };
  ['voltage', 'voltageRating', 'capacity', 'powerCapacity', 'rating', 'nextInspectionDate'].forEach((field) => {
    if (body[field] !== undefined) specs[field] = body[field] === '' ? null : body[field];
  });
  if (body.specifications !== undefined && body.specifications && typeof body.specifications === 'object') Object.assign(specs, body.specifications);
  payload.specifications = specs;
  return payload;
};

const validatePayload = (body, isUpdate) => {
  if (!isUpdate && !clean(body.name)) return 'Asset name is required';
  if (body.status !== undefined && !clean(body.status)) return 'Status cannot be empty';
  if (body.condition !== undefined && !clean(body.condition)) return 'Condition cannot be empty';
  if (body.assetCode !== undefined && !clean(body.assetCode)) return 'Asset code cannot be empty';
  return null;
};

const createElectricalSystem = async (req, res) => {
  const validation = validatePayload(req.body, false);
  if (validation) return errorResponse(res, 422, validation);
  const transaction = await sequelize.transaction();
  try {
    const payload = payloadForAsset(req.body);
    const duplicate = payload.assetCode ? await Infrastructure.findOne({ where: { assetCode: payload.assetCode }, transaction }) : null;
    if (duplicate) { await transaction.rollback(); return errorResponse(res, 409, 'Asset code already exists'); }
    const asset = await Infrastructure.create({ ...payload, createdBy: req.user.id }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_ELECTRICAL_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: serialize(asset), message: 'Electrical system created successfully' });
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return errorResponse(res, 409, 'Asset identifier already exists');
    console.error('Error creating electrical infrastructure:', error);
    return errorResponse(res, 500, 'Server error while creating electrical system');
  }
};

const updateElectricalSystem = async (req, res) => {
  const validation = validatePayload(req.body, true);
  if (validation) return errorResponse(res, 422, validation);
  const transaction = await sequelize.transaction();
  try {
    const asset = await Infrastructure.findOne({ where: mergeWhere({ id: req.params.id }, electricalWhere()), transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return errorResponse(res, 404, 'Electrical system not found'); }
    const payload = payloadForAsset(req.body, asset);
    if (payload.assetCode && payload.assetCode !== asset.assetCode) {
      const duplicate = await Infrastructure.findOne({ where: { assetCode: payload.assetCode, id: { [Op.ne]: asset.id } }, transaction });
      if (duplicate) { await transaction.rollback(); return errorResponse(res, 409, 'Asset code already exists'); }
    }
    const before = asset.toJSON();
    await asset.update(payload, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_ELECTRICAL_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ before, after: asset.toJSON() }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(asset), message: 'Electrical system updated successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating electrical infrastructure:', error);
    return errorResponse(res, 500, 'Server error while updating electrical system');
  }
};

const deactivateElectricalSystem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Infrastructure.findOne({ where: mergeWhere({ id: req.params.id }, electricalWhere()), transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return errorResponse(res, 404, 'Electrical system not found'); }
    const previousStatus = asset.status;
    await asset.update({ status: 'Inactive' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_ELECTRICAL_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ beforeStatus: previousStatus, afterStatus: asset.status }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(asset), message: 'Electrical system deactivated successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deactivating electrical infrastructure:', error);
    return errorResponse(res, 500, 'Server error while deactivating electrical system');
  }
};

module.exports = { getElectricalSystems, getElectricalSystem, createElectricalSystem, updateElectricalSystem, deactivateElectricalSystem };
