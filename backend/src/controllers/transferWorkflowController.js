const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Transfer, Asset, Assignment, Department, User, AssetMovement, AuditLog, Notification } = require('../models');
const { createAuditLog } = require('../services/auditLogService');
const { createDepartmentEventNotification } = require('../services/notificationService');

const ACTIVE = ['Requested', 'Approved', 'Ready', 'In Transit', 'Pending', 'In Progress'];
const transitions = {
  Requested: ['Approved', 'Rejected', 'Cancelled'],
  Approved: ['Ready', 'Cancelled'],
  Ready: ['In Transit'],
  'In Transit': ['Received'],
  Received: [], Rejected: [], Cancelled: [],
};
const number = () => `TR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const statusAliases = {
  requested: ['Requested', 'Pending'],
  pending: ['Requested', 'Pending'],
  approved: ['Approved', 'Ready', 'In Transit', 'In Progress'],
  ready: ['Ready'],
  'in transit': ['In Transit', 'In Progress'],
  received: ['Received', 'Completed'],
  completed: ['Received', 'Completed'],
  rejected: ['Rejected'],
  cancelled: ['Cancelled'],
  canceled: ['Cancelled'],
  rejected_cancelled: ['Rejected', 'Cancelled'],
  'rejected-cancelled': ['Rejected', 'Cancelled'],
  'rejected/cancelled': ['Rejected', 'Cancelled'],
  'rejected / cancelled': ['Rejected', 'Cancelled'],
};
const parseDateFilter = (value, endOfDay = false) => {
  const input = String(value || '').trim();
  if (!input) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input)
    ? `${input}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : input);
  return Number.isNaN(date.getTime()) ? null : date;
};
const notifyTransferUsers = async ({ transfer, userIds, senderId, status, transaction }) => {
  const recipients = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0 && id !== Number(senderId)))];
  if (!recipients.length) return;
  await Notification.bulkCreate(recipients.map((userId) => ({
    userId,
    recipientId: userId,
    senderId,
    assetId: transfer.assetId,
    scope: 'USER',
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
const notifyDepartmentHeads = async (transfer, status, senderId) => {
  const departmentIds = [...new Set([transfer.sourceDepartmentId, transfer.destinationDepartmentId].map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  for (const departmentId of departmentIds) {
    await createDepartmentEventNotification({
      event: 'department_asset_transferred',
      eventKey: `department_asset_transferred:${transfer.id}:${status}:${departmentId}`,
      departmentId,
      senderId,
      entityType: 'transfer',
      entityId: transfer.id,
      assetId: transfer.assetId,
      type: 'transfer',
      title: `Asset transfer ${String(status).toLowerCase()}`,
      message: `${transfer.transferNumber || `Transfer ${transfer.id}`} is now ${String(status).toLowerCase()}.`,
    });
  }
};
const scopeWhere = (req) => {
  if (!req.organizationScope) return {};
  if (req.organizationScope.departmentId) {
    return {
      [Op.and]: [
        { [Op.or]: [
          { sourceDepartmentId: req.organizationScope.departmentId },
          { destinationDepartmentId: req.organizationScope.departmentId },
          { '$Asset.departmentId$': req.organizationScope.departmentId },
        ] },
        ...(req.organizationScope.collegeId ? [{ [Op.or]: [
          { sourceCollegeId: req.organizationScope.collegeId },
          { destinationCollegeId: req.organizationScope.collegeId },
          { '$Asset.collegeId$': req.organizationScope.collegeId },
        ] }] : []),
      ],
    };
  }
  return { [Op.or]: [
    { sourceCollegeId: req.organizationScope.collegeId },
    { destinationCollegeId: req.organizationScope.collegeId },
    { '$Asset.collegeId$': req.organizationScope.collegeId },
  ] };
};
const normalize = (item) => {
  const data = item.toJSON();
  const asset = item.Asset || {};
  const requester = item.Requester || item.Creator || {};
  const approver = item.Approver || {};
  const dispatcher = item.Dispatcher || {};
  const receiver = item.Receiver || {};
  const status = ({
    pending: 'Requested',
    completed: 'Received',
    'in progress': 'In Transit',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
  })[String(data.status || '').trim().toLowerCase()] || data.status;
  return {
    ...data,
    status,
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
    dispatched_by_name: dispatcher.fullName || dispatcher.username || '',
    received_by_name: receiver.fullName || receiver.username || '',
  };
};

const transferInclude = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'status', 'department', 'location'] },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Requester' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Creator' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Approver' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Dispatcher' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Receiver' },
];

const listTransfers = async (req, res, next) => {
  try {
    const where = { ...scopeWhere(req) };
    const requestedStatus = String(req.query.status || '').trim();
    const matchingStatuses = statusAliases[requestedStatus.toLowerCase()];
    if (matchingStatuses) where.status = { [Op.in]: matchingStatuses };
    else if (requestedStatus && !['all', 'all statuses', 'all_statuses'].includes(requestedStatus.toLowerCase())) where.status = requestedStatus;

    const search = String(req.query.search || req.query.q || '').trim();
    if (search) {
      const searchClause = {
        [Op.or]: [
          { transferNumber: { [Op.like]: `%${search}%` } },
          { sourceDepartment: { [Op.like]: `%${search}%` } },
          { destinationDepartment: { [Op.like]: `%${search}%` } },
          { currentLocation: { [Op.like]: `%${search}%` } },
          { newLocation: { [Op.like]: `%${search}%` } },
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
          { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
          { '$Asset.serialNumber$': { [Op.like]: `%${search}%` } },
        ],
      };
      where[Op.and] = [...(where[Op.and] || []), searchClause];
    }

    const dateFrom = String(req.query.dateFrom || req.query.date_from || '').trim();
    const dateTo = String(req.query.dateTo || req.query.date_to || '').trim();
    const from = parseDateFilter(dateFrom);
    const to = parseDateFilter(dateTo, true);
    if (dateFrom && !from) return res.status(400).json({ success: false, message: 'Invalid start date filter.' });
    if (dateTo && !to) return res.status(400).json({ success: false, message: 'Invalid end date filter.' });
    if (from || to) {
      const dateWhere = {};
      if (from) dateWhere[Op.gte] = from;
      if (to) dateWhere[Op.lte] = to;
      where.transferDate = dateWhere;
    }

    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20));
    const summaryWhere = scopeWhere(req);
    const countForStatuses = (statuses) => Transfer.count({
      where: { ...summaryWhere, status: { [Op.in]: statuses } },
      include: transferInclude,
      distinct: true,
    });
    const [result, total, pending, approved, received, rejectedCancelled, requested, legacyPending, exactApproved, ready, inTransit, rejected, cancelled] = await Promise.all([
      Transfer.findAndCountAll({
        where,
        include: transferInclude,
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
      }),
      Transfer.count({ where: summaryWhere, include: transferInclude, distinct: true }),
      countForStatuses(['Requested', 'Pending']),
      countForStatuses(['Approved', 'Ready', 'In Transit', 'In Progress']),
      countForStatuses(['Received', 'Completed']),
      countForStatuses(['Rejected', 'Cancelled']),
      countForStatuses(['Requested']),
      countForStatuses(['Pending']),
      countForStatuses(['Approved']),
      countForStatuses(['Ready']),
      countForStatuses(['In Transit', 'In Progress']),
      countForStatuses(['Rejected']),
      countForStatuses(['Cancelled']),
    ]);
    const pages = Math.max(1, Math.ceil(result.count / limit));
    const transfers = result.rows.map(normalize);
    const summary = {
      total,
      pending,
      approved,
      received,
      rejectedCancelled,
      Requested: requested,
      Pending: legacyPending,
      Approved: exactApproved,
      Ready: ready,
      'In Transit': inTransit,
      Received: received,
      Rejected: rejected,
      Cancelled: cancelled,
      'Rejected / Cancelled': rejectedCancelled,
    };
    return res.json({
      success: true,
      data: transfers,
      transfers,
      pagination: { page, limit, total: result.count, pages, totalPages: pages },
      summary,
    });
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
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const assetId = Number(req.body.asset_id ?? req.body.assetId);
    const destinationDepartmentId = Number(req.body.destination_department_id ?? req.body.destinationDepartmentId);
    const destinationLocation = req.body.destination_location ?? req.body.destinationLocation;
    const reason = req.body.reason ?? req.body.transfer_reason;
    const transferDate = req.body.transfer_date ?? req.body.transferDate;
    const expectedReturnDate = req.body.expected_return_date ?? req.body.expectedReturnDate;
    const notes = req.body.notes ?? req.body.description;
    const parsedTransferDate = parseDateFilter(transferDate);
    const parsedExpectedReturnDate = parseDateFilter(expectedReturnDate);
    if (!Number.isSafeInteger(assetId) || assetId < 1 || !Number.isSafeInteger(destinationDepartmentId) || destinationDepartmentId < 1 || !String(destinationLocation || '').trim() || !String(reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset, destination department, destination location, and reason are required' }); }
    if (transferDate && !parsedTransferDate) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Transfer date must be a valid date.' }); }
    if (expectedReturnDate && !parsedExpectedReturnDate) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Expected return date must be a valid date.' }); }
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
    let transferNumber = number();
    while (await Transfer.findOne({ where: { transferNumber }, transaction, lock: transaction.LOCK.UPDATE })) transferNumber = number();
    const row = await Transfer.create({
      assetType: 'asset',
      transferNumber,
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
      transferDate: parsedTransferDate || now,
      expectedReturnDate: parsedExpectedReturnDate,
      notes: String(notes || '').trim(),
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
    const reviewers = await User.findAll({
      where: {
        active: true,
        [Op.or]: [
          { role: 'admin' },
          {
            role: 'college_manager',
            ...(req.organizationScope?.collegeId ? { collegeId: req.organizationScope.collegeId } : {}),
          },
        ],
      },
      attributes: ['id'],
      transaction,
    });
    await notifyTransferUsers({ transfer: row, userIds: reviewers.map((user) => user.id), senderId: req.user.id, status: row.status, transaction });
    const data = normalize(row);
    await transaction.commit();
    try { await notifyDepartmentHeads(row, row.status, req.user.id); } catch (notificationError) { console.error('Department transfer notification failed:', notificationError.message); }
    return res.status(201).json({ success: true, message: 'Transfer request created', data });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        return next(rollbackError);
      }
    }
    return next(error);
  }
};

const changeTransfer = (target, roles) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const row = await Transfer.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Transfer not found in your scope' }); }
    if (!roles.includes(req.user.role)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Transfer action is not authorized' }); }
    if (target === 'Received' && req.user.role === 'department_head' && Number(req.organizationScope?.departmentId) !== Number(row.destinationDepartmentId)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Only the destination department can confirm receipt' }); }
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
      if (assignment) {
        const previousAssignment = assignment.toJSON();
        await assignment.update({ status: 'closed', workflowStatus: 'reassigned' }, { transaction });
        const nextAssignment = await Assignment.create({
          assetId: assignment.assetId,
          approvalId: assignment.approvalId || null,
          quantity: Number(assignment.quantity || 1),
          assignedTo: assignment.assignedTo || null,
          assignedToType: assignment.assignedToType || 'user',
          assignedToId: assignment.assignedToId || assignment.assignedTo || null,
          assignedBy: req.user.id,
          status: 'active',
          workflowStatus: 'assigned',
          assignedDate: new Date(),
          expectedReturnDate: assignment.expectedReturnDate || null,
          departmentId: row.destinationDepartmentId,
          location: row.newLocation,
          conditionAtAssignment: row.conditionAtTransfer || assignment.conditionAtAssignment || asset.condition,
          notes: assignment.notes || '',
        }, { transaction });
        await createAuditLog({
          userId: req.user.id,
          role: req.user.role,
          action: 'REASSIGN_ASSET',
          entity: `assignment:${nextAssignment.id}`,
          entityId: nextAssignment.id,
          oldValue: previousAssignment,
          newValue: nextAssignment.toJSON(),
          details: { previousAssignmentId: assignment.id, transferId: row.id },
          transaction,
        });
      }
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
    try { await notifyDepartmentHeads(row, target, req.user.id); } catch (notificationError) { console.error('Department transfer notification failed:', notificationError.message); }
    res.json({ success: true, message: 'Transfer status updated', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listTransfers, getTransfer, createTransfer, approveTransfer: changeTransfer('Approved', ['college', 'college_manager', 'admin']), rejectTransfer: changeTransfer('Rejected', ['college', 'college_manager', 'admin']), cancelTransfer: changeTransfer('Cancelled', ['department_head', 'college', 'college_manager', 'admin']), readyTransfer: changeTransfer('Ready', ['store_manager']), dispatchTransfer: changeTransfer('In Transit', ['store_manager']), receiveTransfer: changeTransfer('Received', ['department_head', 'store_manager']) };
