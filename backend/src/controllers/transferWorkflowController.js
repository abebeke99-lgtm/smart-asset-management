const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Transfer, Asset, Assignment, Department, User, AssetMovement, AuditLog, Notification } = require('../models');
const { createAuditLog } = require('../services/auditLogService');

const ACTIVE = ['Requested', 'Approved', 'Ready', 'In Transit', 'Pending', 'In Progress'];
const transitions = {
  Requested: ['Approved', 'Rejected', 'Cancelled'],
  Approved: ['Ready', 'Cancelled'],
  Ready: ['In Transit'],
  'In Transit': ['Received'],
  Received: [], Rejected: [], Cancelled: [],
};
const number = () => `TR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const notifyTransferUsers = async ({ transfer, userIds, senderId, status, transaction }) => {
  const recipients = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0 && id !== Number(senderId)))];
  if (!recipients.length) return;
  await Notification.bulkCreate(recipients.map((userId) => ({
    userId,
    recipientId: userId,
    senderId,
    assetId: transfer.assetId,
    eventKey: `asset_transfer:${transfer.id}:${status}:${userId}`,
    title: `Asset transfer ${String(status).toLowerCase()}`,
    message: `${transfer.transferNumber || `Transfer ${transfer.id}`} is now ${String(status).toLowerCase()}.`,
    type: 'transfer',
    category: 'asset_transfer',
    entityType: 'transfer',
    entityId: transfer.id,
    actionUrl: '/admin/assets/transfer',
    metadata: { transferId: transfer.id, status },
    priority: 'medium',
    channel: 'in_app',
    status: 'sent',
    sentAt: new Date(),
  })), { transaction });
};
const scopeWhere = (req) => {
  if (!req.organizationScope) return {};
  if (req.organizationScope.departmentId) {
    return {
      [Op.and]: [
        { [Op.or]: [{ sourceDepartmentId: req.organizationScope.departmentId }, { destinationDepartmentId: req.organizationScope.departmentId }] },
        ...(req.organizationScope.collegeId ? [{ [Op.or]: [{ sourceCollegeId: req.organizationScope.collegeId }, { destinationCollegeId: req.organizationScope.collegeId }] }] : []),
      ],
    };
  }
  return { [Op.or]: [{ sourceCollegeId: req.organizationScope.collegeId }, { destinationCollegeId: req.organizationScope.collegeId }] };
};
const normalize = (item) => {
  const data = item.toJSON();
  const asset = item.Asset || {};
  const requester = item.Requester || item.Creator || {};
  const approver = item.Approver || {};
  return {
    ...data,
    transfer_number: item.transferNumber,
    source_department_id: item.sourceDepartmentId,
    destination_department_id: item.destinationDepartmentId,
    asset_name: asset.name,
    asset_code: asset.assetCode,
    serial_number: asset.serialNumber,
    asset_status: asset.status,
    asset_department: asset.department,
    asset_location: asset.location,
    requested_by_name: requester.fullName || requester.username || '',
    approved_by_name: approver.fullName || approver.username || '',
  };
};

const transferInclude = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'status', 'department', 'location'] },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Requester' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Creator' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Approver' },
];

const listTransfers = async (req, res, next) => {
  try {
    const where = { ...scopeWhere(req) };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.search) where.transferNumber = { [Op.like]: `%${String(req.query.search).trim()}%` };
    const [rows, counts] = await Promise.all([
      Transfer.findAll({ where, include: transferInclude, order: [['createdAt', 'DESC']] }),
      Promise.all(['Requested', 'Approved', 'Ready', 'In Transit', 'Received', 'Rejected', 'Cancelled'].map(async (status) => [status, await Transfer.count({ where: { ...scopeWhere(req), status } })])),
    ]);
    const summary = Object.fromEntries(counts);
    summary.total = counts.reduce((total, [, count]) => total + count, 0);
    res.json({ success: true, data: rows.map(normalize), transfers: rows.map(normalize), summary });
  } catch (error) { next(error); }
};

const getTransfer = async (req, res, next) => {
  try {
    const row = await Transfer.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, include: transferInclude });
    if (!row) return res.status(404).json({ success: false, message: 'Transfer not found in your scope' });
    const [history, audit] = await Promise.all([
      Transfer.findAll({ where: { assetId: row.assetId, ...scopeWhere(req) }, include: transferInclude, order: [['createdAt', 'DESC']] }),
      AuditLog.findAll({ where: { entity: `transfer:${row.id}` }, order: [['createdAt', 'DESC']] }),
    ]);
    res.json({ success: true, data: { ...normalize(row), history: history.map(normalize), audit } });
  } catch (error) { next(error); }
};

const createTransfer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { asset_id: assetId, destination_department_id: destinationDepartmentId, destination_location: destinationLocation, reason } = req.body;
    if (!assetId || !destinationDepartmentId || !String(destinationLocation || '').trim() || !String(reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset, destination department, destination location, and reason are required' }); }
    const assetWhere = req.organizationScope.departmentId
      ? { id: assetId, departmentId: req.organizationScope.departmentId, ...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}) }
      : { id: assetId, collegeId: req.organizationScope.collegeId };
    const asset = await Asset.findOne({ where: assetWhere, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' }); }
    if (['disposed', 'retired', 'deleted', 'soft-deleted', 'lost', 'missing', 'under-maintenance', 'in-maintenance', 'maintenance', 'testing', 'in-transfer'].includes(String(asset.status).toLowerCase().replace(/[_ ]/g, '-'))) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is not eligible for transfer in its current status' }); }
    const destination = await Department.findOne({ where: { id: destinationDepartmentId, collegeId: asset.collegeId, status: 'active' }, transaction });
    if (!destination || (destination.id === asset.departmentId && String(asset.location || '').trim().toLowerCase() === String(destinationLocation).trim().toLowerCase())) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Destination must be a different location in an active department' }); }
    const duplicate = await Transfer.findOne({ where: { assetId, status: { [Op.in]: ACTIVE } }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicate) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset already has an active transfer' }); }
    const now = new Date();
    const row = await Transfer.create({
      transferNumber: number(),
      assetId: asset.id,
      sourceCampusId: asset.campusId || null,
      sourceCollegeId: asset.collegeId,
      sourceDepartmentId: asset.departmentId,
      sourceBuildingId: asset.buildingId || null,
      sourceRoomId: asset.roomId || null,
      destinationCampusId: asset.campusId || null,
      destinationCollegeId: destination.collegeId,
      destinationDepartmentId: destination.id,
      sourceDepartment: asset.department || '',
      destinationDepartment: destination.name,
      currentLocation: asset.location || '',
      newLocation: String(destinationLocation).trim(),
      transferReason: String(reason).trim(),
      transferDate: now,
      requestedBy: req.user.id,
      createdBy: req.user.id,
      requestedAt: now,
      status: 'Requested',
    }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'TRANSFER_REQUESTED',
      entity: `transfer:${row.id}`,
      entityId: row.id,
      oldValue: { campusId: asset.campusId, collegeId: asset.collegeId, departmentId: asset.departmentId, buildingId: asset.buildingId, roomId: asset.roomId, location: asset.location, status: asset.status },
      newValue: { destinationCollegeId: destination.collegeId, destinationDepartmentId: destination.id, location: row.newLocation, status: row.status },
      details: { ip: req.ip || req.headers['x-forwarded-for'] || null, sessionId: req.sessionID || req.user.sessionId || req.user.jti || null },
      transaction,
    });
    const adminUsers = await User.findAll({ where: { role: 'admin', active: true }, attributes: ['id'], transaction });
    await notifyTransferUsers({ transfer: row, userIds: adminUsers.map((user) => user.id), senderId: req.user.id, status: row.status, transaction });
    await transaction.commit();
    res.status(201).json({ success: true, message: 'Transfer request created', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const changeTransfer = (target, roles) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const row = await Transfer.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Transfer not found in your scope' }); }
    if (!roles.includes(req.user.role)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Transfer action is not authorized' }); }
    if (!transitions[row.status]?.includes(target)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid transfer transition from ${row.status} to ${target}` }); }
    if (target === 'Approved' && row.requestedBy === req.user.id) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A requester cannot approve their own transfer' }); }
    if (['Rejected', 'Cancelled'].includes(target) && !String(req.body.reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A reason is required' }); }
    const before = row.status;
    const asset = await Asset.findByPk(row.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The associated asset no longer exists' }); }
    const updates = { status: target };
    if (target === 'Approved') Object.assign(updates, { approvedBy: req.user.id, approvalDate: new Date(), approvalReason: String(req.body.reason || '').trim() });
    if (target === 'Ready') updates.readyAt = new Date();
    if (target === 'In Transit') {
      Object.assign(updates, { dispatchedBy: req.user.id, dispatchedAt: new Date(), assetStatusBeforeTransfer: asset.status });
      await asset.update({ status: 'in-transfer' }, { transaction });
    }
    if (target === 'Received') Object.assign(updates, { receivedBy: req.user.id, receivedAt: new Date() });
    await row.update(updates, { transaction });
    if (target === 'Received') {
      if (!asset || asset.status === 'disposed' || asset.status === 'missing') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset cannot be received in its current state' }); }
      const oldAssetValue = asset.toJSON();
      await asset.update({
        campusId: row.destinationCampusId || asset.campusId,
        collegeId: row.destinationCollegeId,
        departmentId: row.destinationDepartmentId,
        department: row.destinationDepartment,
        buildingId: row.destinationBuildingId || asset.buildingId,
        roomId: row.destinationRoomId || asset.roomId,
        location: row.newLocation,
        condition: row.conditionAtTransfer || asset.condition,
        status: row.assetStatusBeforeTransfer || 'available',
      }, { transaction });
      const assignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
      if (assignment) await assignment.update({ departmentId: row.destinationDepartmentId, location: row.newLocation }, { transaction });
      await AssetMovement.create({ assetId: asset.id, movementType: 'transfer', sourceType: 'department', sourceId: row.sourceDepartmentId, destinationType: 'department', destinationId: row.destinationDepartmentId, referenceType: 'transfer', referenceId: row.id, performedBy: req.user.id, notes: String(req.body.notes || '').trim() }, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'TRANSFER_RECEIVED',
        entity: `asset:${asset.id}`,
        entityId: asset.id,
        oldValue: oldAssetValue,
        newValue: asset.toJSON(),
        details: { transferId: row.id, ip: req.ip || req.headers['x-forwarded-for'] || null, sessionId: req.sessionID || req.user.sessionId || req.user.jti || null },
        transaction,
      });
    }
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: `TRANSFER_${target.replace(/ /g, '_').toUpperCase()}`,
      entity: `transfer:${row.id}`,
      entityId: row.id,
      oldValue: { status: before },
      newValue: { status: target, approvedBy: row.approvedBy, dispatchedBy: row.dispatchedBy, receivedBy: row.receivedBy },
      details: { reason: req.body.reason || '', ip: req.ip || req.headers['x-forwarded-for'] || null, sessionId: req.sessionID || req.user.sessionId || req.user.jti || null },
      transaction,
    });
    await notifyTransferUsers({ transfer: row, userIds: [row.requestedBy], senderId: req.user.id, status: target, transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Transfer status updated', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listTransfers, getTransfer, createTransfer, approveTransfer: changeTransfer('Approved', ['college', 'admin']), rejectTransfer: changeTransfer('Rejected', ['college', 'admin']), cancelTransfer: changeTransfer('Cancelled', ['department_head', 'college', 'admin']), readyTransfer: changeTransfer('Ready', ['store_manager']), dispatchTransfer: changeTransfer('In Transit', ['store_manager']), receiveTransfer: changeTransfer('Received', ['store_manager']) };
