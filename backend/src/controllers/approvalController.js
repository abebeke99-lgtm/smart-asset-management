const { sequelize, Approval, Asset, Department, User, AuditLog, AssetRegistrationRequest, Inventory, AssetMovement, Assignment, Transfer, Maintenance } = require('../models');
const { Op } = require('sequelize');
const { createFinanceNotification, createBulkNotification, createEventNotification } = require('../services/notificationService');
const { getCollegeScopeId } = require('../middlewares/organizationScope');
const { normalizeRoleValue } = require('../middlewares/auth');

const isStoreManager = (req) => normalizeRoleValue(req.user?.role) === 'store_manager';
const getRole = (req) => normalizeRoleValue(req.user?.role);
const isIssueRequest = (record) => String(record.type || '').toLowerCase().includes('issue');
const isPurchaseRequest = (record) => String(record.type || '').toLowerCase().includes('purchase');
const canReviewApproval = (req, record) => {
  const role = getRole(req);
  if (role === 'admin') return true;
  if (role === 'store_manager') {
    const collegeId = getCollegeScopeId(req);
    return Boolean(collegeId && isIssueRequest(record) && approvalBelongsToCollege(record, collegeId));
  }
  if (role === 'ict_officer') return !isPurchaseRequest(record);
  if (role === 'finance') return isPurchaseRequest(record);
  return false;
};
const canViewAllApprovals = (req) => ['admin', 'ict_officer', 'store_manager', 'finance'].includes(getRole(req));

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
const isReservableAssetRequest = (record) => Boolean(record.assetId) && isIssueRequest(record);
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

const parseDateFilter = (value) => {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : date;
};

const getApprovalWhere = (req) => {
  const role = getRole(req);
  const where = {};
  if (role === 'store_manager') {
    const collegeId = getCollegeScopeId(req);
    if (!collegeId) return { error: 'College scope is not configured for this account' };
    where[Op.and] = buildStoreApprovalPredicates(collegeId);
    where.type = { [Op.like]: '%issue%' };
  } else if (role === 'ict_officer') {
    where.type = { [Op.notLike]: '%purchase%' };
  } else if (role === 'finance') {
    where.type = { [Op.like]: '%purchase%' };
  } else if (!canViewAllApprovals(req)) {
    where.requestedBy = req.user.id;
  }

  const status = String(req.query.status || '').trim().toLowerCase();
  if (status) {
    if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) return { error: 'Invalid approval status filter' };
    where.status = status;
  }
  const priority = String(req.query.priority || '').trim().toLowerCase();
  if (priority) {
    if (!['low', 'normal', 'medium', 'high', 'urgent', 'critical'].includes(priority)) return { error: 'Invalid approval priority filter' };
    where.priority = priority;
  }
  const filters = [];
  if (role === 'store_manager') filters.push({ type: { [Op.like]: '%issue%' } });
  else if (role === 'ict_officer') filters.push({ type: { [Op.notLike]: '%purchase%' } });
  else if (role === 'finance') filters.push({ type: { [Op.like]: '%purchase%' } });
  if (req.query.type) filters.push({ type: String(req.query.type).trim() });
  if (filters.length) where[Op.and] = [...(where[Op.and] || []), ...filters];
  if (req.query.requested_by && canViewAllApprovals(req)) {
    const requestedBy = String(req.query.requested_by).trim();
    if (!/^[1-9]\d*$/.test(requestedBy) || !Number.isSafeInteger(Number(requestedBy))) return { error: 'Requester ID must be a positive integer' };
    where.requestedBy = Number(requestedBy);
  }
  if (req.query.departmentId || req.query.department_id) {
    const departmentText = String(req.query.departmentId || req.query.department_id).trim();
    if (!/^[1-9]\d*$/.test(departmentText) || !Number.isSafeInteger(Number(departmentText))) return { error: 'Department ID must be a positive integer' };
    if (!canViewAllApprovals(req)) return { error: 'Department filtering is not permitted for this account' };
    where.departmentId = Number(departmentText);
  }
  const search = String(req.query.search || '').trim();
  if (search) {
    const term = `%${search}%`;
    where[Op.or] = [
      { item: { [Op.like]: term } },
      { reason: { [Op.like]: term } },
      { comment: { [Op.like]: term } },
      { type: { [Op.like]: term } },
      { '$Requester.fullName$': { [Op.like]: term } },
      { '$Requester.username$': { [Op.like]: term } },
      { '$Department.name$': { [Op.like]: term } },
      { '$Asset.name$': { [Op.like]: term } },
    ];
  }
  const from = parseDateFilter(req.query.dateFrom);
  const to = parseDateFilter(req.query.dateTo);
  if (from === undefined || to === undefined || (from && to && from > to)) return { error: 'Approval date range is invalid' };
  if (from || to) {
    where.createdAt = {
      ...(from ? { [Op.gte]: from } : {}),
      ...(to ? { [Op.lt]: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }
  return { where };
};

const getApprovalHistory = async (approvalId) => {
  const rows = await AuditLog.findAll({
    where: { entity: `approval:${approvalId}` },
    attributes: ['id', 'userId', 'action', 'details', 'createdAt'],
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  });
  return rows.map((row) => {
    const data = typeof row.toJSON === 'function' ? row.toJSON() : row;
    let details = {};
    try { details = typeof data.details === 'string' ? JSON.parse(data.details) : data.details || {}; } catch { details = {}; }
    return {
      id: data.id,
      changedBy: data.userId,
      action: data.action,
      previousStatus: details.beforeStatus || (data.action === 'STORE_REQUEST_FULFILLED' ? 'approved' : null),
      newStatus: details.afterStatus || (data.action === 'REQUEST_SUBMITTED' ? 'pending' : data.action === 'STORE_REQUEST_FULFILLED' ? 'fulfilled' : null),
      comment: details.comment || '',
      createdAt: data.createdAt,
    };
  });
};

const listApprovals = async (req, res, next) => {
  try {
    const query = getApprovalWhere(req);
    if (query.error) return res.status(query.error.includes('scope') ? 403 : 400).json({ success: false, message: query.error });
    const pageValue = String(req.query.page || '1').trim();
    const limitValue = String(req.query.limit || '100').trim();
    if (!/^[1-9]\d*$/.test(pageValue) || !/^[1-9]\d*$/.test(limitValue)
      || !Number.isSafeInteger(Number(pageValue)) || !Number.isSafeInteger(Number(limitValue))
      || Number(limitValue) > 100) {
      return res.status(400).json({ success: false, message: 'Page must be positive and limit must be between 1 and 100' });
    }
    const page = Number(pageValue);
    const limit = Number(limitValue);
    const sortFields = new Set(['createdAt', 'updatedAt', 'status', 'priority', 'requiredDate']);
    const sortBy = sortFields.has(String(req.query.sortBy)) ? String(req.query.sortBy) : 'createdAt';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
    if (!['ASC', 'DESC'].includes(sortOrder)) return res.status(400).json({ success: false, message: 'Sort order must be ASC or DESC' });
    const result = await Approval.findAndCountAll({
      where: query.where,
      include,
      distinct: true,
      order: [[sortBy, sortOrder], ['id', sortOrder]],
      limit,
      offset: (page - 1) * limit,
    });
    const summaryRows = await Approval.findAll({
      where: query.where,
      attributes: ['status', 'fulfilledAt'],
      raw: true,
    });
    const summary = { total: summaryRows.length, pending: 0, approved: 0, rejected: 0, cancelled: 0, fulfilled: 0 };
    summaryRows.forEach(({ status }) => {
      if (Object.prototype.hasOwnProperty.call(summary, status)) summary[status] += 1;
    });
    summary.fulfilled = summaryRows.filter(({ fulfilledAt }) => Boolean(fulfilledAt)).length;
    const data = result.rows.map((record) => {
      const value = normalize(record);
      if (record.fulfilledAt) value.lifecycleStatus = 'fulfilled';
      return value;
    });
    res.json({
      success: true,
      requests: data,
      approvals: data,
      total: result.count,
      summary,
      pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) || 1 },
    });
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
    const isRequester = Number(record.requestedBy) === Number(req.user.id);
    if (!isRequester && !canReviewApproval(req, record)) return res.status(404).json({ success: false, message: 'Approval not found' });
    const request = normalize(record);
    request.lifecycleStatus = record.fulfilledAt ? 'fulfilled' : record.status;
    request.history = await getApprovalHistory(record.id);
    return res.json({ success: true, request, approval: request });
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
    const role = getRole(req);
    const supportedTypes = new Set(['new_asset', 'asset_issue', 'replacement', 'transfer', 'return', 'maintenance', 'other', 'purchase', 'purchase_request']);
    if (!requestType || requestType.length > 100
      || (!supportedTypes.has(requestType.toLowerCase()) && !requestType.toLowerCase().includes('purchase'))
      || !requestReason || requestReason.length > 5000
      || !Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ success: false, message: 'A supported request type, reason (up to 5000 characters), and a positive whole-number quantity are required' });
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
    const mayRequestForOthers = ['admin', 'ict_officer', 'store_manager'].includes(role);
    if (requestedForId !== null && !mayRequestForOthers && requestedForId !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You may only submit requests for yourself' });
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
    const authenticatedDepartment = req.user.department_id || req.user.departmentId || (Number.isInteger(Number(req.user.department)) ? Number(req.user.department) : null);
    const mayRequestAcrossDepartments = ['admin', 'ict_officer', 'finance', 'store_manager'].includes(role);
    if (!mayRequestAcrossDepartments && departmentIdInput && String(departmentIdInput) !== String(authenticatedDepartment) && String(departmentIdInput) !== String(req.user.department)) {
      return await reject(403, 'Department authorization required');
    }
    if (!mayRequestAcrossDepartments && asset && authenticatedDepartment && String(asset.departmentId || asset.department_id) !== String(authenticatedDepartment)) {
      return await reject(404, 'Asset not found in your department scope');
    }
    if (asset && department && Number(asset.collegeId) !== Number(department.collegeId)) return await reject(400, 'The selected asset and department must belong to the same college');
    if (role === 'college_manager' || role === 'college') {
      const collegeId = getCollegeScopeId(req);
      if (!collegeId) return await reject(403, 'College scope is not configured for this account');
      if ((asset && Number(asset.collegeId) !== Number(collegeId)) || (department && Number(department.collegeId) !== Number(collegeId))) {
        return await reject(404, 'Requested resource not found in your college scope');
      }
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
    if (!String(record.type).toLowerCase().includes('purchase')) {
      try {
        const isIssue = isIssueRequest(record);
        const reviewerWhere = isIssue
          ? {
            [Op.or]: [
              { role: 'store_manager', collegeId: department?.collegeId || asset?.collegeId },
              { role: { [Op.in]: ['ict_officer', 'admin'] } },
            ],
            active: true,
          }
          : { role: { [Op.in]: ['ict_officer', 'admin'] }, active: true };
        const reviewers = await User.findAll({ where: reviewerWhere, attributes: ['id'] });
        await createEventNotification({
          event: 'approval_request_submitted',
          eventKey: `approval:${record.id}:review`,
          entityType: 'approval',
          entityId: record.id,
          userIds: reviewers.map((reviewer) => reviewer.id),
          senderId: req.user.id,
          title: 'Asset request awaiting review',
          message: `Request REQ-${String(record.id).padStart(6, '0')} for ${record.item} requires review.`,
          type: 'approval',
          priority: record.priority === 'urgent' || record.priority === 'critical' ? 'urgent' : 'medium',
        });
      } catch (notificationError) {
        notificationStatus = 'failed';
        console.error(`Asset request reviewer notification failed for request ${record.id}:`, notificationError.message);
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
    const isRequester = Number(record.requestedBy) === Number(req.user.id);
    const isCancellation = status === 'cancelled';
    if (isStoreManager(req) && !approvalBelongsToCollege(record, getCollegeScopeId(req))) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }
    if (isCancellation) {
      const canCancelPending = isRequester && record.status === 'pending';
      const canCancelApprovedStoreIssue = record.status === 'approved' && isStoreManager(req) && canReviewApproval(req, record);
      const canCancelAsAdmin = getRole(req) === 'admin' && record.status !== 'cancelled';
      if (!canCancelPending && !canCancelApprovedStoreIssue && !canCancelAsAdmin) {
        await transaction.rollback();
        transactionFinished = true;
        return res.status(403).json({ success: false, message: 'You are not authorized to cancel this request' });
      }
    } else if (!canReviewApproval(req, record)) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(403).json({ success: false, message: 'Approval authorization required' });
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
    if (comment.length > 5000) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(400).json({ success: false, message: 'Decision comment must be 5000 characters or fewer' });
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
