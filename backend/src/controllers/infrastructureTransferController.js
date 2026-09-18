const { Op } = require('sequelize');
const { sequelize, Infrastructure, Transfer, AuditLog, User } = require('../models');

const ACTIVE_STATUSES = ['Pending', 'Approved', 'In Progress'];
const FINAL_STATUSES = ['Completed', 'Rejected', 'Cancelled'];

const normalize = (value) => String(value || '').trim().toLowerCase();
const displayName = (user) => user?.fullName || user?.username || '';

const serialize = (transfer, asset, requester, approver) => {
  const data = transfer.toJSON();
  return {
    ...data,
    assetId: asset?.id || data.assetId,
    asset_id: asset?.id || data.assetId,
    assetName: asset?.name || '',
    asset_name: asset?.name || '',
    assetCode: asset?.assetCode || '',
    asset_code: asset?.assetCode || '',
    serialNumber: asset?.serialNumber || '',
    serial_number: asset?.serialNumber || '',
    category: asset?.category || '',
    assetStatus: asset?.status || '',
    asset_status: asset?.status || '',
    fromLocation: data.currentLocation || '',
    from_location: data.currentLocation || '',
    toLocation: data.newLocation || '',
    to_location: data.newLocation || '',
    requestedByName: displayName(requester),
    requested_by_name: displayName(requester),
    approvedByName: displayName(approver),
    approved_by_name: displayName(approver),
    completedDate: data.receivedAt || null,
    completed_date: data.receivedAt || null,
  };
};

const transferInclude = [
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Requester' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Approver' },
];

const infrastructureIds = async () => (await Infrastructure.findAll({ attributes: ['id'], raw: true })).map((asset) => asset.id);

const getList = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '10', 10) || 10));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const where = { assetId: { [Op.in]: await infrastructureIds() } };
    if (status) where.status = status;
    if (req.query.sourceLocation) where.currentLocation = String(req.query.sourceLocation).trim();
    if (req.query.destinationLocation) where.newLocation = String(req.query.destinationLocation).trim();
    if (req.query.dateFrom || req.query.dateTo) {
      where.transferDate = {};
      if (req.query.dateFrom) where.transferDate[Op.gte] = new Date(req.query.dateFrom);
      if (req.query.dateTo) where.transferDate[Op.lte] = new Date(`${req.query.dateTo}T23:59:59.999Z`);
    }

    const assetWhere = search ? { [Op.or]: [
      { name: { [Op.like]: `%${search}%` } },
      { assetCode: { [Op.like]: `%${search}%` } },
      { serialNumber: { [Op.like]: `%${search}%` } },
      { location: { [Op.like]: `%${search}%` } },
    ] } : {};
    const matchingAssets = await Infrastructure.findAll({ where: assetWhere, attributes: ['id'], raw: true });
    if (search) {
      where.assetId = { [Op.in]: matchingAssets.map((asset) => asset.id) };
      where[Op.or] = [
        { transferNumber: { [Op.like]: `%${search}%` } },
        { currentLocation: { [Op.like]: `%${search}%` } },
        { newLocation: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Transfer.findAndCountAll({ where, include: transferInclude, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    const assets = await Infrastructure.findAll({ where: { id: { [Op.in]: rows.map((row) => row.assetId) } }, raw: true });
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const result = rows.map((row) => serialize(row, byId.get(row.assetId), row.Requester, row.Approver));
    const summaryRows = await Transfer.findAll({ where: { assetId: { [Op.in]: await infrastructureIds() } }, attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((counts, row) => { counts.total += 1; counts[row.status] = (counts[row.status] || 0) + 1; return counts; }, { total: 0 });
    const totalPages = Math.max(1, Math.ceil(count / limit));
    return res.json({ success: true, data: result, transfers: result, summary, pagination: { page, limit, total: count, totalPages, pages: totalPages } });
  } catch (error) { return next(error); }
};

const getOne = async (req, res, next) => {
  try {
    const row = await Transfer.findByPk(req.params.id, { include: transferInclude });
    if (!row) return res.status(404).json({ success: false, message: 'Transfer not found' });
    const asset = await Infrastructure.findByPk(row.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Infrastructure asset not found' });
    return res.json({ success: true, data: serialize(row, asset, row.Requester, row.Approver) });
  } catch (error) { return next(error); }
};

const getFormData = async (req, res, next) => {
  try {
    const assets = await Infrastructure.findAll({ where: { status: { [Op.notIn]: ['Disposed', 'disposed', 'Missing', 'missing', 'Inactive', 'inactive', 'Under Maintenance', 'under maintenance'] } }, order: [['name', 'ASC']] });
    const locationRows = await Infrastructure.findAll({ attributes: ['location'], where: { location: { [Op.ne]: '' } }, group: ['location'], order: [['location', 'ASC']], raw: true });
    const locations = locationRows.map((row) => ({ id: row.location, name: row.location }));
    return res.json({ success: true, assets, locations, data: { assets, locations } });
  } catch (error) { return next(error); }
};

const create = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const assetId = Number(req.body.assetId ?? req.body.asset_id);
    const source = String(req.body.fromLocationId ?? req.body.from_location ?? req.body.currentLocation ?? '').trim();
    const destination = String(req.body.toLocationId ?? req.body.to_location ?? req.body.newLocation ?? '').trim();
    const reason = String(req.body.reason ?? req.body.transferReason ?? '').trim();
    if (!assetId || !source || !destination || !reason) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Asset, source location, destination location, and reason are required' }); }
    if (source === destination) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Source and destination locations must be different' }); }
    const asset = await Infrastructure.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Infrastructure asset not found' }); }
    const blocked = ['disposed', 'missing', 'inactive', 'under maintenance', 'under-maintenance', 'retired'];
    if (blocked.includes(normalize(asset.status))) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Asset cannot be transferred while its status is ${asset.status}` }); }
    if (normalize(asset.location) !== normalize(source)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Source location does not match the asset current location' }); }
    const active = await Transfer.findOne({ where: { assetId, status: { [Op.in]: ACTIVE_STATUSES } }, transaction, lock: transaction.LOCK.UPDATE });
    if (active) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset already has an active transfer' }); }
    const row = await Transfer.create({ assetId, sourceDepartment: asset.department || '', destinationDepartment: asset.department || '', currentLocation: source, newLocation: destination, transferReason: reason, notes: String(req.body.notes || '').trim(), transferDate: req.body.transferDate ? new Date(req.body.transferDate) : new Date(), transferNumber: `TRF-${new Date().getFullYear()}-${Date.now()}`, status: 'Pending', requestedBy: req.user.id, createdBy: req.user.id, requestedAt: new Date() }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'TRANSFER_CREATED', entity: `transfer:${row.id}`, details: JSON.stringify({ assetId, afterStatus: row.status, source, destination }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: serialize(row, asset, null, null), message: 'Transfer request created' });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const changeStatus = (target) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const row = await Transfer.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Transfer not found' }); }
    const asset = await Infrastructure.findByPk(row.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Infrastructure asset not found' }); }
    const allowed = target === 'Approved' ? row.status === 'Pending' : target === 'Completed' ? row.status === 'Approved' : ACTIVE_STATUSES.includes(row.status);
    if (!allowed || FINAL_STATUSES.includes(row.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Transfer cannot change from ${row.status} to ${target}` }); }
    const beforeStatus = row.status;
    const updates = { status: target };
    if (target === 'Approved') Object.assign(updates, { approvedBy: req.user.id, approvalDate: new Date() });
    if (target === 'Completed') Object.assign(updates, { receivedBy: req.user.id, receivedAt: new Date() });
    await row.update(updates, { transaction });
    if (target === 'Completed') await asset.update({ location: row.newLocation, status: 'Operational' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: `TRANSFER_${target.toUpperCase()}`, entity: `transfer:${row.id}`, details: JSON.stringify({ assetId: asset.id, beforeStatus, afterStatus: target }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(row, asset, null, null), message: 'Transfer updated' });
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = { getList, getOne, getFormData, create, approve: changeStatus('Approved'), complete: changeStatus('Completed'), cancel: changeStatus('Cancelled') };
