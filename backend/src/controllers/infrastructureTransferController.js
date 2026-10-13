const { Op } = require('sequelize');
const { sequelize, Infrastructure, Transfer, AuditLog, User } = require('../models');

const ACTIVE_STATUSES = ['Pending', 'Approved', 'In Progress'];
const FINAL_STATUSES = ['Completed', 'Rejected', 'Cancelled'];
const InfrastructureTransfers = Transfer.unscoped();

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

const getList = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '10', 10) || 10));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const where = { assetType: 'infrastructure' };
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

    const { count, rows } = await InfrastructureTransfers.findAndCountAll({ where, include: transferInclude, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    const assets = await Infrastructure.findAll({ where: { id: { [Op.in]: rows.map((row) => row.assetId) } }, raw: true });
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const result = rows.map((row) => serialize(row, byId.get(row.assetId), row.Requester, row.Approver));
    const summaryRows = await InfrastructureTransfers.findAll({ where: { assetType: 'infrastructure' }, attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((counts, row) => { counts.total += 1; counts[row.status] = (counts[row.status] || 0) + 1; return counts; }, { total: 0 });
    const totalPages = Math.max(1, Math.ceil(count / limit));
    return res.json({ success: true, data: result, transfers: result, summary, pagination: { page, limit, total: count, totalPages, pages: totalPages } });
  } catch (error) { return next(error); }
};

const getOne = async (req, res, next) => {
  try {
    const row = await InfrastructureTransfers.findOne({ where: { id: req.params.id, assetType: 'infrastructure' }, include: transferInclude });
    if (!row) return res.status(404).json({ success: false, message: 'Transfer not found' });
    const asset = await Infrastructure.findByPk(row.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Infrastructure asset not found' });
    const [history, audit] = await Promise.all([
      InfrastructureTransfers.findAll({ where: { assetType: 'infrastructure', assetId: row.assetId }, order: [['createdAt', 'DESC']] }),
      AuditLog.findAll({ where: { entity: `transfer:${row.id}` }, order: [['createdAt', 'ASC']] }),
    ]);
    return res.json({ success: true, data: { ...serialize(row, asset, row.Requester, row.Approver), history, audit } });
  } catch (error) { return next(error); }
};

const getFormData = async (req, res, next) => {
  try {
    const assets = await Infrastructure.findAll({ where: { status: { [Op.notIn]: ['Disposed', 'disposed', 'Missing', 'missing', 'Inactive', 'inactive', 'Under Maintenance', 'under maintenance'] } }, order: [['name', 'ASC']] });
    const locationRows = await Infrastructure.findAll({ attributes: ['location'], where: { location: { [Op.ne]: '' } }, group: ['location'], order: [['location', 'ASC']], raw: true });
    const locations = locationRows.map((row) => ({ id: row.location, name: row.location }));
    const assigneeIds = [...new Set(assets.map((asset) => Number(asset.assignedTo)).filter((id) => Number.isInteger(id) && id > 0))];
    const assignees = assigneeIds.length
      ? await User.findAll({ where: { id: { [Op.in]: assigneeIds } }, attributes: ['id', 'fullName', 'username'], raw: true })
      : [];
    const assigneeNames = new Map(assignees.map((user) => [Number(user.id), user.fullName || user.username || '']));
    const assetData = assets.map((asset) => ({
      ...asset.toJSON(),
      assignedToName: assigneeNames.get(Number(asset.assignedTo)) || '',
      assigned_to_name: assigneeNames.get(Number(asset.assignedTo)) || '',
    }));
    return res.json({ success: true, assets: assetData, locations, data: { assets: assetData, locations } });
  } catch (error) { return next(error); }
};

const create = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const assetId = Number(req.body.assetId ?? req.body.asset_id);
    const source = String(req.body.fromLocationId ?? req.body.from_location ?? req.body.currentLocation ?? '').trim();
    const destination = String(req.body.toLocationId ?? req.body.to_location ?? req.body.newLocation ?? '').trim();
    const reason = String(req.body.reason ?? req.body.transferReason ?? '').trim();
    const transferDate = req.body.transferDate ? new Date(req.body.transferDate) : new Date();
    const destinationDepartment = String(req.body.destinationDepartment || req.body.destination_department || '').trim();
    if (!Number.isSafeInteger(assetId) || assetId < 1 || !source || !destination || !reason) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Asset, source location, destination location, and reason are required' }); }
    if (destinationDepartment.length > 255) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Destination department must be 255 characters or fewer' }); }
    if (Number.isNaN(transferDate.getTime())) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Transfer date must be valid' }); }
    if (normalize(source) === normalize(destination)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Source and destination locations must be different' }); }
    const asset = await Infrastructure.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Infrastructure asset not found' }); }
    const blocked = ['disposed', 'missing', 'inactive', 'under maintenance', 'under-maintenance', 'retired'];
    if (blocked.includes(normalize(asset.status))) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Asset cannot be transferred while its status is ${asset.status}` }); }
    if (normalize(asset.location) !== normalize(source)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Source location does not match the asset current location' }); }
    const active = await InfrastructureTransfers.findOne({ where: { assetType: 'infrastructure', assetId, status: { [Op.in]: ACTIVE_STATUSES } }, transaction, lock: transaction.LOCK.UPDATE });
    if (active) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset already has an active transfer' }); }
    const row = await InfrastructureTransfers.create({
      assetType: 'infrastructure',
      assetId,
      sourceDepartment: asset.department || '',
      destinationDepartment: destinationDepartment || asset.department || '',
      currentLocation: source,
      newLocation: destination,
      transferReason: reason,
      notes: String(req.body.notes || '').trim(),
      transferDate,
      transferNumber: `TRF-${new Date().getFullYear()}-${Date.now()}`,
      status: 'Pending',
      assetStatusBeforeTransfer: asset.status,
      conditionAtTransfer: asset.condition,
      requestedBy: req.user.id,
      createdBy: req.user.id,
      requestedAt: new Date(),
    }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'TRANSFER_CREATED', entity: `transfer:${row.id}`, details: JSON.stringify({ assetId, afterStatus: row.status, source, destination }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: serialize(row, asset, null, null), message: 'Transfer request created' });
  } catch (error) { if (transaction && !transaction.finished) await transaction.rollback(); return next(error); }
};

const changeStatus = (target) => async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const row = await InfrastructureTransfers.findOne({ where: { id: req.params.id, assetType: 'infrastructure' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Transfer not found' }); }
    const asset = await Infrastructure.findByPk(row.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Infrastructure asset not found' }); }
    const allowed = target === 'Approved' || target === 'Rejected'
      ? row.status === 'Pending'
      : target === 'Completed'
        ? row.status === 'Approved'
        : ['Pending', 'Approved'].includes(row.status);
    if (!allowed || FINAL_STATUSES.includes(row.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Transfer cannot change from ${row.status} to ${target}` }); }
    const beforeStatus = row.status;
    const updates = { status: target };
    if (target === 'Approved' || target === 'Rejected') {
      Object.assign(updates, {
        approvedBy: target === 'Approved' ? req.user.id : null,
        approvalDate: new Date(),
        approvalReason: target === 'Rejected' ? String(req.body.reason || '').trim() || 'Transfer request rejected' : null,
      });
    }
    if (target === 'Completed') Object.assign(updates, { receivedBy: req.user.id, receivedAt: new Date() });
    await row.update(updates, { transaction });
    if (target === 'Completed') {
      await asset.update({
        location: row.newLocation,
        department: row.destinationDepartment || asset.department,
      }, { transaction });
    }
    await AuditLog.create({
      userId: req.user.id,
      action: `TRANSFER_${target.toUpperCase()}`,
      entity: `transfer:${row.id}`,
      details: JSON.stringify({
        assetId: asset.id,
        beforeStatus,
        afterStatus: target,
        fromLocation: row.currentLocation,
        toLocation: row.newLocation,
        sourceDepartment: row.sourceDepartment,
        destinationDepartment: row.destinationDepartment,
      }),
    }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: serialize(row, asset, null, null), message: 'Transfer updated' });
  } catch (error) { if (transaction && !transaction.finished) await transaction.rollback(); return next(error); }
};

module.exports = { getList, getOne, getFormData, create, approve: changeStatus('Approved'), reject: changeStatus('Rejected'), complete: changeStatus('Completed'), cancel: changeStatus('Cancelled') };
