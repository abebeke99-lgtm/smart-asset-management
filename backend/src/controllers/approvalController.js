const { sequelize, Approval, Asset, Department, User, AuditLog, AssetRegistrationRequest, Inventory, AssetMovement, Assignment, Transfer, Maintenance } = require('../models');
const { Op } = require('sequelize');
const { createFinanceNotification, createBulkNotification } = require('../services/notificationService');
const { getCollegeScopeId } = require('../middlewares/organizationScope');
const { normalizeRoleValue } = require('../middlewares/auth');

const isStoreManager = (req) => normalizeRoleValue(req.user?.role) === 'store_manager';

const normalize = (item) => {
  const data = item.toJSON();
  return { ...data, request_id: `REQ-${String(data.id).padStart(6, '0')}`, requested_by: item.Requester?.fullName || item.Requester?.username, requested_by_id: data.requestedBy, requested_for: data.requestedFor, requested_for_name: item.Beneficiary?.fullName || item.Beneficiary?.username, required_date: data.requiredDate, purpose: data.reason, remarks: data.comment, department: item.Department?.name, approved_by: item.Reviewer?.fullName || item.Reviewer?.username, created_at: data.createdAt, updated_at: data.updatedAt, approval_comment: data.comment };
};
const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'department', 'collegeId'] }, { model: Department, attributes: ['id', 'name', 'collegeId'] }, { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'department'] }, { model: User, as: 'Beneficiary', attributes: ['id', 'username', 'fullName', 'collegeId'] }, { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'] }];

const buildStoreApprovalPredicates = (collegeId) => [
  { [Op.or]: [{ departmentId: null }, { '$Department.college_id$': collegeId }] },
  { [Op.or]: [{ assetId: null }, { '$Asset.college_id$': collegeId }] },
  { [Op.or]: [{ '$Department.college_id$': collegeId }, { '$Asset.college_id$': collegeId }] },
  { [Op.or]: [{ requestedFor: null }, { '$Beneficiary.college_id$': collegeId }] },
];

const approvalBelongsToCollege = (record, collegeId) => {
  if (record.departmentId && Number(record.Department?.collegeId) !== collegeId) return false;
  if (record.assetId && Number(record.Asset?.collegeId) !== collegeId) return false;
  if (record.requestedFor && Number(record.Beneficiary?.collegeId) !== collegeId) return false;
  return Boolean(record.departmentId || record.assetId);
};
const isReservableAssetRequest = (record) => Boolean(record.assetId)
  && String(record.type || '').toLowerCase().includes('issue');
const isValidDateOnly = (value) => {
  if (value == null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const normalizeAssetState = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
const isEligibleAsset = (asset) => {
  const eligibleStatuses = new Set(['available', 'in store', 'active', 'assigned', 'reserved', 'in use', 'issued']);
  const blockedConditions = new Set(['damaged', 'broken', 'unusable', 'heavily damaged', 'non-functional', 'quarantined']);
  const status = normalizeAssetState(asset.status);
  const condition = normalizeAssetState(asset.condition);
  const expiryDate = asset.expiryDate || asset.expiry_date;
  return eligibleStatuses.has(status)
    && !blockedConditions.has(condition)
    && (!expiryDate || String(expiryDate).slice(0, 10) >= new Date().toISOString().slice(0, 10));
};

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
  } catch (error) {
    console.error('Failed to list approvals:', {
      name: error.name,
      message: error.message,
      code: error.original?.code,
      sqlMessage: error.original?.sqlMessage,
      sql: error.sql,
    });
    return res.status(500).json({ message: 'Failed to load approvals' });
  }
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
  let transaction;
  let transactionFinished = false;
  try {
    const { type, asset_id, department_id, requested_for, required_date, item, quantity = 1, priority = 'medium', reason, comment } = req.body;
    const requestType = String(type || '').trim();
    const requestReason = String(reason || '').trim();
    const requestComment = String(comment || '').trim();
    const requestItem = String(item || '').trim();
    const normalizedPriority = String(priority || '').trim().toLowerCase();
    const parsedQuantity = Number(quantity);
    if (!requestType || requestType.length > 100 || !requestReason || requestReason.length > 5000
      || !Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ success: false, message: 'Type, reason (up to 5000 characters), and a positive whole-number quantity are required' });
    }
    if (requestComment.length > 5000 || requestItem.length > 255) {
      return res.status(400).json({ success: false, message: 'Item must be 255 characters or fewer and remarks must be 5000 characters or fewer' });
    }
    if (!['low', 'normal', 'medium', 'high', 'urgent', 'critical'].includes(normalizedPriority)) {
      return res.status(400).json({ success: false, message: 'Priority must be Normal, High, or Urgent' });
    }
    const requestedForId = requested_for === undefined || requested_for === null || requested_for === '' ? null : Number(requested_for);
    if ((requestedForId !== null && (!Number.isSafeInteger(requestedForId) || requestedForId <= 0)) || !isValidDateOnly(required_date)) {
      return res.status(400).json({ success: false, message: 'Requested-for user or required date is invalid' });
    }
    const storeManager = isStoreManager(req);
    const collegeId = storeManager ? getCollegeScopeId(req) : null;
    if (storeManager && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    if (storeManager && (!asset_id || !department_id)) return res.status(400).json({ success: false, message: 'A valid asset and department are required' });
    if (requestType.toLowerCase().includes('issue') && (!asset_id || !department_id)) {
      return res.status(400).json({ success: false, message: 'An asset and department are required for an asset issue request' });
    }
    transaction = await sequelize.transaction();
    const reject = async (statusCode, message) => {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(statusCode).json({ success: false, message });
    };
    const assetId = asset_id == null || asset_id === '' ? null : Number(asset_id);
    const departmentIdInput = department_id == null || department_id === '' ? null : Number(department_id);
    if (assetId !== null && (!Number.isSafeInteger(assetId) || assetId < 1)) return await reject(400, 'A valid asset ID is required');
    if (departmentIdInput !== null && (!Number.isSafeInteger(departmentIdInput) || departmentIdInput < 1)) return await reject(400, 'A valid department ID is required');
    const asset = assetId ? await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (assetId && !asset) return await reject(404, 'Asset not found');
    if (storeManager && Number(asset.collegeId) !== collegeId) return await reject(404, 'Asset not found');
    const department = departmentIdInput ? await Department.findByPk(departmentIdInput, { transaction }) : null;
    if (departmentIdInput && !department) return await reject(404, 'Department not found');
    if (department && ['inactive', 'suspended', 'deleted'].includes(normalizeAssetState(department.status))) {
      return await reject(400, 'The selected department is inactive');
    }
    if (storeManager && Number(department.collegeId) !== collegeId) return await reject(404, 'Department not found');
    const beneficiary = requestedForId ? await User.findByPk(requestedForId, { transaction }) : null;
    if (requestedForId && (!beneficiary || beneficiary.active === false || String(beneficiary.status || '').toLowerCase() !== 'active')) {
      return await reject(404, 'Requested-for user not found or inactive');
    }
    if (storeManager && beneficiary && Number(beneficiary.collegeId) !== collegeId) return await reject(404, 'Requested-for user not found');
    if (beneficiary && department && Number(beneficiary.collegeId) !== Number(department.collegeId)) {
      return await reject(404, 'Requested-for user not found in the selected department scope');
    }
    if (req.user.role === 'college' && asset && asset.department !== req.user.department) return await reject(403, 'Department authorization required');
    const authenticatedDepartment = req.user.department_id || req.user.departmentId || (Number.isInteger(Number(req.user.department)) ? Number(req.user.department) : null);
    if (req.user.role === 'college' && departmentIdInput && String(departmentIdInput) !== String(authenticatedDepartment) && String(departmentIdInput) !== String(req.user.department)) {
      return await reject(403, 'Department authorization required');
    }
    if (asset && requestType.toLowerCase().includes('issue')) {
      if (!isEligibleAsset(asset)) return await reject(409, 'The selected asset is inactive or otherwise ineligible for issue');
      const inventory = await Inventory.findOne({
        where: { assetId: asset.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!inventory || !Number.isSafeInteger(Number(inventory.availableQuantity)) || Number(inventory.availableQuantity) < parsedQuantity) {
        return await reject(409, 'Insufficient available inventory for the requested quantity');
      }
      const normalizedSerial = String(asset.serialNumber || '').trim();
      const [activeAssignment, activeTransfer, activeMaintenance] = await Promise.all([
        normalizedSerial
          ? Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction })
          : Promise.resolve(null),
        Transfer.findOne({
          where: { assetId: asset.id, status: { [Op.in]: ['Requested', 'Approved', 'Ready', 'In Progress', 'In Transit'] } },
          transaction,
        }),
        Maintenance.findOne({
          where: { assetId: asset.id, status: { [Op.in]: ['pending', 'approved', 'assigned', 'in-progress', 'under maintenance'] } },
          transaction,
        }),
      ]);
      if (activeAssignment || activeTransfer || activeMaintenance) {
        return await reject(409, 'The selected asset is assigned, transferring, or under maintenance');
      }
    }
    const record = await Approval.create({
      type: requestType,
      assetId: asset?.id || null,
      requestedBy: req.user.id,
      requestedFor: requestedForId,
      departmentId: storeManager ? department.id : authenticatedDepartment || departmentIdInput || null,
      item: asset?.name || requestItem,
      quantity: parsedQuantity,
      priority: normalizedPriority,
      reason: requestReason,
      comment: requestComment,
      requiredDate: required_date || null,
    }, { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: 'REQUEST_SUBMITTED',
      entity: `approval:${record.id}`,
      details: JSON.stringify({ requestId: record.id, type: record.type, departmentId: record.departmentId }),
    }, { transaction });
    await transaction.commit();
    transactionFinished = true;
    let notificationStatus = 'sent';
    try {
      await createBulkNotification({
        recipientType: 'users',
        userIds: [req.user.id],
        title: 'Asset request received',
        message: `Request REQ-${String(record.id).padStart(6, '0')} for ${record.item} (${record.quantity}) was received.`,
        type: 'approval',
        priority: record.priority === 'urgent' || record.priority === 'critical' ? 'urgent' : 'medium',
        channel: 'in_app',
        eventKey: `approval:${record.id}:submitted:${req.user.id}`,
        entityType: 'approval',
        entityId: record.id,
      }, req.user.id);
    } catch (notificationError) {
      notificationStatus = 'failed';
      console.error(`Asset request receipt notification failed for request ${record.id}:`, notificationError.message);
    }
    if (String(record.type).toLowerCase().includes('purchase')) {
      try {
        await createFinanceNotification({ event: 'finance_purchase_request_submitted', eventKey: `finance_purchase_request_submitted:${record.id}`, entityId: record.id, senderId: req.user.id, type: 'procurement', title: 'Purchase request awaiting approval', message: `Purchase request REQ-${String(record.id).padStart(6, '0')} requires approval.` });
      } catch (notificationError) {
        notificationStatus = 'failed';
        console.error(`Purchase request reviewer notification failed for request ${record.id}:`, notificationError.message);
      }
    }
    return res.status(201).json({ success: true, request: normalize(record), notificationStatus });
  } catch (error) {
    if (transaction && !transactionFinished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Approval creation transaction rollback failed:', rollbackError.message);
      }
    }
    return next(error);
  }
};

const decideApproval = async (req, res, next) => {
  let transaction;
  let transactionFinished = false;
  try {
    if (!['admin', 'college', 'college_manager', 'finance', 'store_manager'].includes(normalizeRoleValue(req.user.role))) return res.status(403).json({ success: false, message: 'Approval authorization required' });
    const status = String(req.body.status || '').toLowerCase();
    if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid approval status' });
    const comment = String(req.body.comment || req.body.reason || '').trim();
    if (status === 'rejected' && !comment) return res.status(400).json({ success: false, message: 'A rejection reason is required' });
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
    if (status === 'approved' && Number(record.requestedBy) === Number(req.user.id)) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(403).json({ success: false, message: 'A requester cannot approve their own request' });
    }
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
    await record.update({ status, reviewedBy: req.user.id, comment }, { transaction });
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
