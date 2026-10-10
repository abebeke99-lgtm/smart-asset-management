const { sequelize, Approval, Asset, Department, User, AuditLog, AssetRegistrationRequest, Inventory, AssetMovement } = require('../models');
const { Op } = require('sequelize');
const { createFinanceNotification, createBulkNotification } = require('../services/notificationService');
const { getCollegeScopeId } = require('../middlewares/organizationScope');
const { normalizeRoleValue } = require('../middlewares/auth');

const isStoreManager = (req) => normalizeRoleValue(req.user?.role) === 'store_manager';

const normalize = (item) => {
  const data = item.toJSON();
  return { ...data, request_id: `REQ-${String(data.id).padStart(6, '0')}`, requested_by: item.Requester?.fullName || item.Requester?.username, requested_by_id: data.requestedBy, department: item.Department?.name, approved_by: item.Reviewer?.fullName || item.Reviewer?.username, created_at: data.createdAt, updated_at: data.updatedAt, approval_comment: data.comment };
};
const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'department', 'collegeId'] }, { model: Department, attributes: ['id', 'name', 'collegeId'] }, { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'department'] }, { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'] }];

const buildStoreApprovalPredicates = (collegeId) => [
  { [Op.or]: [{ departmentId: null }, { '$Department.collegeId$': collegeId }] },
  { [Op.or]: [{ assetId: null }, { '$Asset.collegeId$': collegeId }] },
  { [Op.or]: [{ '$Department.collegeId$': collegeId }, { '$Asset.collegeId$': collegeId }] },
];

const approvalBelongsToCollege = (record, collegeId) => {
  if (record.departmentId && Number(record.Department?.collegeId) !== collegeId) return false;
  if (record.assetId && Number(record.Asset?.collegeId) !== collegeId) return false;
  return Boolean(record.departmentId || record.assetId);
};
const isReservableAssetRequest = (record) => Boolean(record.assetId)
  && String(record.type || '').toLowerCase().includes('issue');

const listApprovals = async (req, res, next) => {
  try {
    const where = {};
    if (isStoreManager(req)) {
      const collegeId = getCollegeScopeId(req);
      if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
      where[Op.and] = buildStoreApprovalPredicates(collegeId);
    }
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.type) where.type = req.query.type;
    if (req.query.requested_by) where.requestedBy = req.query.requested_by;
    const result = await Approval.findAll({ where, include, order: [['createdAt', 'DESC']] });
    res.json({ success: true, requests: result.map(normalize), approvals: result.map(normalize), total: result.length });
  } catch (error) { next(error); }
};

const getApprovalById = async (req, res, next) => {
  try {
    const record = await Approval.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Approval not found' });
    if (isStoreManager(req)) {
      const collegeId = getCollegeScopeId(req);
      if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
      if (!approvalBelongsToCollege(record, collegeId)) return res.status(404).json({ success: false, message: 'Approval not found' });
    }
    return res.json({ success: true, request: normalize(record), approval: normalize(record) });
  } catch (error) { return next(error); }
};

const createApproval = async (req, res, next) => {
  try {
    const { type, asset_id, department_id, item, quantity = 1, priority = 'medium', reason } = req.body;
    if (!type || !reason || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return res.status(400).json({ success: false, message: 'Type, reason, and positive quantity are required' });
    const storeManager = isStoreManager(req);
    const collegeId = storeManager ? getCollegeScopeId(req) : null;
    if (storeManager && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    if (storeManager && (!asset_id || !department_id)) return res.status(400).json({ success: false, message: 'A valid asset and department are required' });
    const asset = asset_id ? await Asset.findByPk(asset_id) : null;
    if (asset_id && !asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (storeManager && Number(asset.collegeId) !== collegeId) return res.status(404).json({ success: false, message: 'Asset not found' });
    const department = storeManager ? await Department.findByPk(department_id) : null;
    if (storeManager && (!department || Number(department.collegeId) !== collegeId)) return res.status(404).json({ success: false, message: 'Department not found' });
    if (req.user.role === 'college' && asset && asset.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department authorization required' });
    const authenticatedDepartment = req.user.department_id || req.user.departmentId || (Number.isInteger(Number(req.user.department)) ? Number(req.user.department) : null);
    if (req.user.role === 'college' && department_id && String(department_id) !== String(authenticatedDepartment) && String(department_id) !== String(req.user.department)) return res.status(403).json({ success: false, message: 'Department authorization required' });
    const record = await Approval.create({ type, assetId: asset_id || null, requestedBy: req.user.id, departmentId: storeManager ? department.id : authenticatedDepartment || department_id || null, item: item || '', quantity, priority, reason });
    await AuditLog.create({ userId: req.user.id, action: 'REQUEST_SUBMITTED', entity: `approval:${record.id}`, details: JSON.stringify({ requestId: record.id, type: record.type, departmentId: record.departmentId }) });
    if (String(type).toLowerCase().includes('purchase')) await createFinanceNotification({ event: 'finance_purchase_request_submitted', eventKey: `finance_purchase_request_submitted:${record.id}`, entityId: record.id, senderId: req.user.id, type: 'procurement', title: 'Purchase request awaiting approval', message: `Purchase request REQ-${String(record.id).padStart(6, '0')} requires approval.` });
    res.status(201).json({ success: true, request: normalize(record) });
  } catch (error) { next(error); }
};

const decideApproval = async (req, res, next) => {
  let transaction;
  let transactionFinished = false;
  try {
    if (!['admin', 'college', 'finance', 'store_manager'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Approval authorization required' });
    const status = String(req.body.status || '').toLowerCase();
    if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid approval status' });
    transaction = await sequelize.transaction();
    const record = await Approval.findByPk(req.params.id, { include, transaction, lock: transaction.LOCK.UPDATE });
    if (!record) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }
    if (isStoreManager(req)) {
      const collegeId = getCollegeScopeId(req);
      if (!collegeId) {
        await transaction.rollback();
        transactionFinished = true;
        return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
      }
      if (!approvalBelongsToCollege(record, collegeId)) {
        await transaction.rollback();
        transactionFinished = true;
        return res.status(404).json({ success: false, message: 'Approval not found' });
      }
    }
    const cancellingApprovedRequest = status === 'cancelled' && record.status === 'approved';
    if (record.status !== 'pending' && !cancellingApprovedRequest) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(409).json({ success: false, message: 'Only pending requests can be decided' });
    }
    if (cancellingApprovedRequest && record.fulfilledAt) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(409).json({ success: false, message: 'A fulfilled request cannot be cancelled' });
    }
    if (status === 'approved' && record.requestedBy === req.user.id) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(403).json({ success: false, message: 'A requester cannot approve their own request' });
    }
    const comment = String(req.body.comment || req.body.reason || '').trim();
    let reservationAudit = null;
    if (status === 'approved' && isReservableAssetRequest(record)) {
      const quantity = Number(record.quantity);
      const inventory = await Inventory.findOne({
        where: { assetId: record.assetId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || !inventory || !Number.isSafeInteger(Number(inventory.availableQuantity)) || !Number.isSafeInteger(Number(inventory.reservedQuantity)) || inventory.availableQuantity < quantity) {
        await transaction.rollback();
        transactionFinished = true;
        return res.status(409).json({ success: false, message: 'Insufficient available inventory to approve this request' });
      }
      const before = { availableQuantity: inventory.availableQuantity, reservedQuantity: inventory.reservedQuantity };
      await inventory.update({
        availableQuantity: inventory.availableQuantity - quantity,
        reservedQuantity: inventory.reservedQuantity + quantity,
      }, { transaction });
      await AssetMovement.create({
        assetId: record.assetId,
        movementType: 'reserved',
        sourceType: 'store',
        sourceId: null,
        destinationType: 'department',
        destinationId: record.departmentId,
        referenceType: 'approval',
        referenceId: record.id,
        performedBy: req.user.id,
        notes: JSON.stringify({ quantity, reason: record.reason || '' }),
      }, { transaction });
      reservationAudit = {
        action: 'reserved',
        quantity,
        before,
        after: { availableQuantity: inventory.availableQuantity, reservedQuantity: inventory.reservedQuantity },
      };
    }
    if (cancellingApprovedRequest && isReservableAssetRequest(record)) {
      const quantity = Number(record.quantity);
      const inventory = await Inventory.findOne({
        where: { assetId: record.assetId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || !inventory || !Number.isSafeInteger(Number(inventory.availableQuantity)) || !Number.isSafeInteger(Number(inventory.reservedQuantity)) || inventory.reservedQuantity < quantity) {
        await transaction.rollback();
        transactionFinished = true;
        return res.status(409).json({ success: false, message: 'The request reservation could not be released safely' });
      }
      const before = { availableQuantity: inventory.availableQuantity, reservedQuantity: inventory.reservedQuantity };
      await inventory.update({
        availableQuantity: inventory.availableQuantity + quantity,
        reservedQuantity: inventory.reservedQuantity - quantity,
      }, { transaction });
      await AssetMovement.create({
        assetId: record.assetId,
        movementType: 'released',
        sourceType: 'department',
        sourceId: record.departmentId,
        destinationType: 'store',
        destinationId: null,
        referenceType: 'approval',
        referenceId: record.id,
        performedBy: req.user.id,
        notes: JSON.stringify({ quantity, reason: comment }),
      }, { transaction });
      reservationAudit = {
        action: 'released',
        quantity,
        before,
        after: { availableQuantity: inventory.availableQuantity, reservedQuantity: inventory.reservedQuantity },
      };
    }
    await record.update({ status, reviewedBy: req.user.id, comment: req.body.comment || req.body.reason || '' }, { transaction });
    if (String(record.type || '').toLowerCase().includes('purchase')) {
      const registrationStatus = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Cancelled';
      await AssetRegistrationRequest.update(
        { status: registrationStatus },
        { where: { approvalId: record.id }, transaction },
      );
    }
    await AuditLog.create({ userId: req.user.id, action: `REQUEST_${status.toUpperCase()}`, entity: `approval:${record.id}`, details: JSON.stringify({ requestId: record.id, beforeStatus: cancellingApprovedRequest ? 'approved' : 'pending', afterStatus: status, comment, reservation: reservationAudit }) }, { transaction });
    await transaction.commit();
    transactionFinished = true;
    try {
      await createBulkNotification({
        recipientType: 'users',
        userIds: [record.requestedBy],
        type: 'approval',
        priority: 'medium',
        channel: 'in_app',
        eventKey: `approval:${record.id}:${status}`,
        title: `Asset request ${status}`,
        message: `Request REQ-${String(record.id).padStart(6, '0')} was ${status}.${comment ? ` Comment: ${comment}` : ''}`,
      }, req.user.id);
    } catch (notificationError) {
      console.error('Approval notification failed:', notificationError.message);
    }
    return res.json({ success: true, request: normalize(record) });
  } catch (error) {
    if (transaction && !transactionFinished) {
      try { await transaction.rollback(); } catch (rollbackError) { console.error('Approval transaction rollback failed:', rollbackError.message); }
    }
    return next(error);
  }
};

module.exports = { listApprovals, getApprovalById, createApproval, decideApproval };
