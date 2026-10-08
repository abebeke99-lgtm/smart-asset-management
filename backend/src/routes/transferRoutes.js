const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize,
  Transfer,
  Asset,
  Assignment,
  User,
  Department,
  College,
  Campus,
  Building,
  Room,
  AssetMovement,
  AuditLog,
  Notification,
} = require('../models');
const { requireAuth, requireRole, requirePermission } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');
const { createAuditLog } = require('../services/auditLogService');

const router = express.Router();
const transferRoles = ['admin', 'ict_officer', 'store_manager', 'college'];
const activeStatuses = ['Requested', 'Approved', 'Ready', 'In Transit', 'Pending', 'In Progress'];
const validStatuses = ['Requested', 'Approved', 'Rejected', 'In Transit', 'Received', 'Cancelled'];
const conditions = new Set(['excellent', 'good', 'fair', 'poor', 'damaged']);

const generateTransferNumber = () => {
  const year = new Date().getFullYear();
  const timestampPart = `${Date.now()}`.slice(-8);
  const randomPart = `${Math.floor(Math.random() * 9000) + 1000}`;
  return `TRF-${year}-${timestampPart}${randomPart}`;
};
const parseDateInput = (value) => {
  const normalized = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T12:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized ? date : null;
  }
  const date = new Date(normalized);
  return normalized && !Number.isNaN(date.getTime()) ? date : null;
};

const resolveTransferOrganizationScope = (req, res, next) => ['ict_officer', 'college_manager', 'store_manager'].includes(req.user.role)
  ? resolveCollegeScope(req, res, next)
  : next();

const normalizeTransferStatus = (status) => ({
  pending: 'Requested',
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  ready: 'Approved',
  'in progress': 'In Transit',
  'in transit': 'In Transit',
  completed: 'Received',
  received: 'Received',
  cancelled: 'Cancelled',
}[String(status || '').trim().toLowerCase()] || String(status || 'Requested'));

const toTransferResponse = (transfer) => {
  const data = transfer.toJSON();
  return {
    ...data,
    status: normalizeTransferStatus(data.status),
    asset_id: data.assetId,
    source_campus_id: data.sourceCampusId,
    source_college_id: data.sourceCollegeId,
    source_department_id: data.sourceDepartmentId,
    source_building_id: data.sourceBuildingId,
    source_room_id: data.sourceRoomId,
    source_floor: data.sourceFloor,
    destination_campus_id: data.destinationCampusId,
    destination_college_id: data.destinationCollegeId,
    destination_department_id: data.destinationDepartmentId,
    destination_building_id: data.destinationBuildingId,
    destination_room_id: data.destinationRoomId,
    destination_floor: data.destinationFloor,
    source_department: data.sourceDepartment,
    destination_department: data.destinationDepartment,
    current_location: data.currentLocation,
    new_location: data.newLocation,
    transfer_reason: data.transferReason,
    transfer_date: data.transferDate,
    expected_return_date: data.expectedReturnDate,
    notes: data.notes,
    requested_by: data.requestedBy,
    approved_by: data.approvedBy,
    received_by: data.receivedBy,
    approval_date: data.approvalDate,
    asset_name: transfer.Asset?.name,
    asset_code: transfer.Asset?.assetCode,
    serial_number: transfer.Asset?.serialNumber,
    requested_by_name: transfer.Requester?.fullName || transfer.Requester?.username || '',
    approved_by_name: transfer.Approver?.fullName || transfer.Approver?.username || '',
    received_by_name: transfer.Receiver?.fullName || transfer.Receiver?.username || '',
  };
};

const transferInclude = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'serialNumber', 'status', 'department', 'location', 'collegeId', 'departmentId', 'campusId', 'buildingId', 'roomId', 'condition'] },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Creator' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Requester' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Approver' },
  { model: User, attributes: ['id', 'username', 'fullName'], as: 'Receiver' },
];

const makeAuditDetails = (req, extra = {}) => ({
  ip: req.ip || req.headers['x-forwarded-for'] || null,
  sessionId: req.sessionID || req.user?.sessionId || req.user?.jti || null,
  ...extra,
});

const createTransferNotification = async ({ transaction, transfer, recipients, senderId, status }) => {
  const userIds = [...new Set(recipients.map(Number).filter((id) => Number.isInteger(id) && id > 0 && id !== Number(senderId)))];
  if (!userIds.length) return;
  const label = status === 'Requested' ? 'requested' : String(status || '').toLowerCase();
  await Notification.bulkCreate(userIds.map((userId) => ({
    userId,
    recipientId: userId,
    senderId: senderId || null,
    assetId: transfer.assetId,
    title: `Asset transfer ${label}`,
    message: `${transfer.transferNumber || `Transfer ${transfer.id}`} is ${label}.`,
    type: 'transfer',
    category: 'asset_transfer',
    entityType: 'transfer',
    entityId: transfer.id,
    actionUrl: '/admin/assets/transfer',
    metadata: { transferId: transfer.id, transferNumber: transfer.transferNumber, status },
    priority: 'medium',
    channel: 'in_app',
    status: 'sent',
    sentAt: new Date(),
  })), { transaction });
};

const assetIsTransferable = (asset) => {
  if (!asset || asset.deletedAt) return { ok: false, message: 'Asset is not available for transfer.' };
  const status = String(asset.status || '').trim().toLowerCase().replace(/[_ ]/g, '-');
  if (['disposed', 'retired', 'soft-deleted', 'deleted'].includes(status)) {
    return { ok: false, message: `Assets with status "${asset.status}" cannot be transferred.` };
  }
  if (['under-maintenance', 'in-maintenance', 'maintenance', 'testing'].includes(status)) {
    return { ok: false, message: 'Assets in maintenance or testing cannot be transferred until they are available.' };
  }
  if (['lost', 'missing', 'in-transfer'].includes(status)) {
    return { ok: false, message: `Assets with status "${asset.status}" cannot be transferred.` };
  }
  return { ok: true };
};

const validateSelectedLocation = async ({ campusId, collegeId, departmentId, buildingId, roomId, floor, transaction }) => {
  const parsedCampusId = campusId ? Number(campusId) : null;
  const parsedBuildingId = buildingId ? Number(buildingId) : null;
  const parsedRoomId = roomId ? Number(roomId) : null;
  const parsedFloor = floor === '' || floor === null || floor === undefined ? null : Number(floor);

  if ([parsedCampusId, parsedBuildingId, parsedRoomId].some((id) => id !== null && (!Number.isInteger(id) || id < 1))) {
    return { error: 'Destination campus, building, and laboratory must be valid database records.' };
  }
  if (parsedFloor !== null && (!Number.isInteger(parsedFloor) || parsedFloor < 0)) {
    return { error: 'Destination floor must be a valid floor number.' };
  }

  let campus = null;
  let building = null;
  let room = null;
  if (parsedCampusId) {
    campus = await Campus.findOne({ where: { id: parsedCampusId, status: 'active' }, transaction });
    if (!campus) return { error: 'Destination campus was not found or is inactive.' };
  }
  if (collegeId) {
    const college = await College.findOne({ where: { id: Number(collegeId), status: 'active' }, transaction });
    if (!college) return { error: 'Destination college was not found or is inactive.' };
    if (college.campusId && parsedCampusId && Number(college.campusId) !== parsedCampusId) return { error: 'Destination college does not belong to the selected campus.' };
  }
  if (parsedBuildingId) {
    building = await Building.findOne({ where: { id: parsedBuildingId, status: 'active' }, transaction });
    if (!building) return { error: 'Destination building was not found or is inactive.' };
    if (parsedCampusId && Number(building.campusId) !== parsedCampusId) return { error: 'Destination building does not belong to the selected campus.' };
  }
  if (parsedRoomId) {
    room = await Room.findOne({ where: { id: parsedRoomId, status: 'active' }, transaction });
    if (!room) return { error: 'Destination laboratory was not found or is inactive.' };
    if (!String(room.roomType || '').toLowerCase().includes('lab')) return { error: 'Destination must be an active laboratory.' };
    if (parsedBuildingId && Number(room.buildingId) !== parsedBuildingId) return { error: 'Destination laboratory does not belong to the selected building.' };
    if (parsedCampusId && Number(room.campusId) !== parsedCampusId) return { error: 'Destination laboratory does not belong to the selected campus.' };
    if (room.departmentId && departmentId && Number(room.departmentId) !== Number(departmentId)) return { error: 'Destination laboratory does not belong to the selected department.' };
    if (parsedFloor !== null && Number(room.floor) !== parsedFloor) return { error: 'Destination laboratory does not belong to the selected floor.' };
  }
  return { campus, building, room, floor: parsedFloor, campusId: parsedCampusId, buildingId: parsedBuildingId, roomId: parsedRoomId };
};

const userScope = (req) => req.organizationScope?.collegeId && req.user.role !== 'admin'
  ? { collegeId: req.organizationScope.collegeId }
  : {};

router.get('/', requireAuth, requireRole(...transferRoles), requirePermission('assets.view'), resolveTransferOrganizationScope, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20));
    const search = String(req.query.search || req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const campusId = Number(req.query.campusId || req.query.campus_id || 0);
    const collegeId = Number(req.query.collegeId || req.query.college_id || 0);
    const departmentId = Number(req.query.departmentId || req.query.department_id || 0);
    const dateFrom = String(req.query.dateFrom || req.query.date_from || '').trim();
    const dateTo = String(req.query.dateTo || req.query.date_to || '').trim();
    const where = {};

    if (status) {
      const legacyStatuses = {
        Requested: ['Requested', 'Pending'],
        Approved: ['Approved', 'Ready'],
        'In Transit': ['In Transit', 'In Progress'],
        Received: ['Received', 'Completed'],
      };
      where.status = { [Op.in]: legacyStatuses[status] || [status] };
    }
    if (campusId) where[Op.or] = [{ sourceCampusId: campusId }, { destinationCampusId: campusId }];
    if (collegeId) where[Op.and] = [...(where[Op.and] || []), { [Op.or]: [{ sourceCollegeId: collegeId }, { destinationCollegeId: collegeId }] }];
    if (departmentId) where[Op.and] = [...(where[Op.and] || []), { [Op.or]: [{ sourceDepartmentId: departmentId }, { destinationDepartmentId: departmentId }] }];
    if (req.organizationScope?.collegeId && req.user.role !== 'admin') {
      where[Op.and] = [...(where[Op.and] || []), { [Op.or]: [{ sourceCollegeId: req.organizationScope.collegeId }, { destinationCollegeId: req.organizationScope.collegeId }] }];
    }

    const dates = {};
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (Number.isNaN(from.getTime())) return res.status(400).json({ success: false, message: 'Invalid start date filter.' });
      dates[Op.gte] = from;
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999Z`);
      if (Number.isNaN(to.getTime())) return res.status(400).json({ success: false, message: 'Invalid end date filter.' });
      dates[Op.lte] = to;
    }
    if (Object.keys(dates).length) where.transferDate = dates;

    if (search) {
      const searchClause = { [Op.or]: [
        { transferNumber: { [Op.like]: `%${search}%` } },
        { sourceDepartment: { [Op.like]: `%${search}%` } },
        { destinationDepartment: { [Op.like]: `%${search}%` } },
        { currentLocation: { [Op.like]: `%${search}%` } },
        { newLocation: { [Op.like]: `%${search}%` } },
        { transferReason: { [Op.like]: `%${search}%` } },
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
        { '$Asset.serialNumber$': { [Op.like]: `%${search}%` } },
      ] };
      where[Op.and] = [...(where[Op.and] || []), searchClause];
    }

    const result = await Transfer.findAndCountAll({
      where,
      include: transferInclude,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const transfers = result.rows.map(toTransferResponse);
    const pages = Math.max(1, Math.ceil(result.count / limit));
    return res.json({
      success: true,
      data: transfers,
      transfers,
      pagination: { page, limit, total: result.count, pages, totalPages: pages },
      summary: { page, limit, total: result.count, pages, totalPages: pages },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, requireRole(...transferRoles), requirePermission('assets.view'), resolveTransferOrganizationScope, async (req, res, next) => {
  try {
    const transfer = await Transfer.findByPk(req.params.id, { include: transferInclude });
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found.' });
    const scope = userScope(req);
    if (scope.department && transfer.Asset?.department !== scope.department) return res.status(403).json({ success: false, message: 'Department access denied.' });
    if (scope.collegeId && Number(transfer.sourceCollegeId) !== Number(scope.collegeId) && Number(transfer.destinationCollegeId) !== Number(scope.collegeId)) return res.status(403).json({ success: false, message: 'Transfer is outside your organization scope.' });
    const [history, audit] = await Promise.all([
      Transfer.findAll({ where: { assetId: transfer.assetId }, include: transferInclude, order: [['createdAt', 'ASC']] }),
      AuditLog.findAll({ where: { entity: `transfer:${transfer.id}` }, order: [['createdAt', 'ASC']] }),
    ]);
    return res.json({ success: true, data: { ...toTransferResponse(transfer), history: history.map(toTransferResponse), audit } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, requireRole(...transferRoles), requirePermission('assets.transfer'), resolveTransferOrganizationScope, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const assetId = Number(req.body.assetId ?? req.body.asset_id);
    const destinationDepartmentId = Number(req.body.destinationDepartmentId ?? req.body.destination_department_id ?? req.body.destinationDepartment);
    const destinationCollegeIdValue = req.body.destinationCollegeId ?? req.body.destination_college_id;
    const destinationCampusIdValue = req.body.destinationCampusId ?? req.body.destination_campus_id;
    const destinationBuildingIdValue = req.body.destinationBuildingId ?? req.body.destination_building_id;
    const destinationRoomIdValue = req.body.destinationRoomId ?? req.body.destination_room_id ?? req.body.destinationLaboratoryId ?? req.body.destination_laboratory_id;
    const destinationFloorValue = req.body.destinationFloor ?? req.body.destination_floor;
    const newLocation = String(req.body.newLocation ?? req.body.new_location ?? req.body.destinationLocation ?? req.body.destination_location ?? '').trim();
    const transferReason = String(req.body.transferReason ?? req.body.reason ?? req.body.transfer_reason ?? '').trim();
    const requestedCondition = String(req.body.conditionAtTransfer ?? req.body.condition ?? '').trim();
    const requestedTransferDate = req.body.transferDate ?? req.body.transfer_date;
    const requestedExpectedReturnDate = req.body.expectedReturnDate ?? req.body.expected_return_date;
    const transferDate = requestedTransferDate ? parseDateInput(requestedTransferDate) : new Date();
    const expectedReturnDate = requestedExpectedReturnDate ? parseDateInput(requestedExpectedReturnDate) : null;
    const requestedTransferNumber = String(req.body.transferNumber ?? req.body.transfer_number ?? '').trim();
    const requestedSerialNumber = String(req.body.serialNumber ?? req.body.serial_number ?? '').trim();
    const notes = String(req.body.notes ?? '').trim();

    if (!transferDate || (requestedExpectedReturnDate && !expectedReturnDate)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Transfer date and expected return must be valid dates.' });
    }
    if (expectedReturnDate && expectedReturnDate < transferDate) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Expected return cannot be before the transfer date.' });
    }
    if (requestedTransferNumber.length > 40) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Transfer reference must be 40 characters or fewer.' });
    }

    if (!Number.isInteger(assetId) || assetId < 1 || !Number.isInteger(destinationCollegeIdValue === undefined ? 0 : Number(destinationCollegeIdValue)) || Number(destinationCollegeIdValue) < 1 || !Number.isInteger(destinationDepartmentId) || destinationDepartmentId < 1 || !destinationCampusIdValue || !destinationBuildingIdValue || destinationFloorValue === undefined || destinationFloorValue === '' || !destinationRoomIdValue || !newLocation || !transferReason) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Asset, destination campus, college, department, building, floor, laboratory, location, and reason are required.' });
    }
    if (newLocation.length > 255 || transferReason.length > 5000) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Destination location must be 255 characters or fewer and reason 5000 characters or fewer.' });
    }
    if (requestedCondition && !conditions.has(requestedCondition.toLowerCase())) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Condition must be Excellent, Good, Fair, Poor, or Damaged.' });
    }

    const asset = await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found or has been deleted.' });
    }
    if (requestedSerialNumber && requestedSerialNumber.toLowerCase() !== String(asset.serialNumber || '').trim().toLowerCase()) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Serial number does not match the selected asset.' });
    }
    const sourceCampusId = req.body.sourceCampusId ?? req.body.source_campus_id;
    const sourceCollegeId = req.body.sourceCollegeId ?? req.body.source_college_id;
    const sourceDepartmentId = req.body.sourceDepartmentId ?? req.body.source_department_id;
    if ([sourceCampusId, sourceCollegeId, sourceDepartmentId].some((value) => value !== undefined)) {
      const sourceMatchesAsset = Number(sourceCampusId || 0) === Number(asset.campusId || 0)
        && Number(sourceCollegeId || 0) === Number(asset.collegeId || 0)
        && Number(sourceDepartmentId || 0) === Number(asset.departmentId || 0);
      if (!sourceMatchesAsset) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Source location must match the asset’s current location.' });
      }
    }
    const eligibility = assetIsTransferable(asset);
    if (!eligibility.ok) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: eligibility.message });
    }
    if (req.organizationScope?.collegeId && req.user.role !== 'admin' && Number(asset.collegeId) !== Number(req.organizationScope.collegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your organization scope.' });
    }

    const destinationDepartment = await Department.findOne({ where: { id: destinationDepartmentId, status: 'active' }, transaction });
    if (!destinationDepartment) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Destination department was not found or is inactive.' });
    }
    const destinationCollegeId = Number(destinationCollegeIdValue);
    if (destinationCollegeId && Number(destinationDepartment.collegeId) !== destinationCollegeId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Destination department does not belong to the selected college.' });
    }
    const destinationCollege = destinationCollegeId
      ? await College.findOne({ where: { id: destinationCollegeId, status: 'active' }, transaction })
      : null;
    if (destinationCollegeId && !destinationCollege) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Destination college was not found or is inactive.' });
    }
    if (req.organizationScope?.collegeId && req.user.role !== 'admin' && Number(destinationCollegeId) !== Number(req.organizationScope.collegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Destination department is outside your organization scope.' });
    }

    const destinationLocation = await validateSelectedLocation({
      campusId: destinationCampusIdValue,
      collegeId: destinationCollegeId,
      departmentId: destinationDepartment.id,
      buildingId: destinationBuildingIdValue,
      roomId: destinationRoomIdValue,
      floor: destinationFloorValue,
      transaction,
    });
    if (destinationLocation.error) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: destinationLocation.error });
    }

    const sameDepartment = Number(asset.departmentId) === destinationDepartment.id;
    const sameCampus = !destinationLocation.campusId || Number(asset.campusId || 0) === destinationLocation.campusId;
    const sameBuilding = !destinationLocation.buildingId || Number(asset.buildingId || 0) === destinationLocation.buildingId;
    const sameRoom = !destinationLocation.roomId || Number(asset.roomId || 0) === destinationLocation.roomId;
    const sameTextLocation = String(asset.location || '').trim().toLowerCase() === newLocation.toLowerCase();
    const completeDestination = destinationLocation.campusId && destinationLocation.buildingId && destinationLocation.roomId;
    if ((completeDestination && sameDepartment && sameCampus && sameBuilding && sameRoom) || (!completeDestination && sameDepartment && sameTextLocation)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Destination must differ from the asset’s current location.' });
    }

    const duplicate = await Transfer.findOne({ where: { assetId: asset.id, status: { [Op.in]: activeStatuses } }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicate) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset already has an active transfer.' });
    }

    let transferNumber = requestedTransferNumber || generateTransferNumber();
    if (requestedTransferNumber && await Transfer.findOne({ where: { transferNumber }, transaction })) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Transfer reference is already in use.' });
    }
    while (!requestedTransferNumber && await Transfer.findOne({ where: { transferNumber }, transaction })) transferNumber = generateTransferNumber();
    const now = new Date();
    const sourceRoom = asset.roomId ? await Room.findByPk(asset.roomId, { transaction }) : null;
    const transfer = await Transfer.create({
      transferNumber,
      assetId: asset.id,
      sourceCampusId: asset.campusId || null,
      sourceCollegeId: asset.collegeId || null,
      sourceDepartment: asset.department || '',
      sourceDepartmentId: asset.departmentId || null,
      sourceBuildingId: asset.buildingId || null,
      sourceRoomId: asset.roomId || null,
      sourceFloor: sourceRoom?.floor ?? null,
      destinationCampusId: destinationLocation.campusId,
      destinationCollegeId: destinationCollegeId || null,
      destinationDepartment: destinationDepartment.name,
      destinationDepartmentId: destinationDepartment.id,
      destinationBuildingId: destinationLocation.buildingId,
      destinationRoomId: destinationLocation.roomId,
      destinationFloor: destinationLocation.floor,
      currentLocation: asset.location || '',
      newLocation,
      transferReason,
      conditionAtTransfer: requestedCondition || asset.condition || 'Good',
      transferDate,
      expectedReturnDate,
      notes,
      requestedAt: now,
      status: 'Requested',
      createdBy: req.user.id,
      requestedBy: req.user.id,
    }, { transaction });

    const approvers = await User.findAll({ where: { role: 'admin', active: true }, attributes: ['id'], transaction });
    await createTransferNotification({ transaction, transfer, recipients: approvers.map((user) => user.id), senderId: req.user.id, status: 'Requested' });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'TRANSFER_REQUESTED',
      entity: `transfer:${transfer.id}`,
      entityId: transfer.id,
      oldValue: { campusId: asset.campusId, collegeId: asset.collegeId, departmentId: asset.departmentId, buildingId: asset.buildingId, roomId: asset.roomId, location: asset.location, status: asset.status },
      newValue: { campusId: transfer.destinationCampusId, collegeId: transfer.destinationCollegeId, departmentId: transfer.destinationDepartmentId, buildingId: transfer.destinationBuildingId, roomId: transfer.destinationRoomId, location: transfer.newLocation, status: transfer.status },
      details: makeAuditDetails(req, { transferNumber }),
      transaction,
    });
    await transaction.commit();
    const populated = await Transfer.findByPk(transfer.id, { include: transferInclude });
    return res.status(201).json({ success: true, data: toTransferResponse(populated), message: 'Transfer request created.' });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
});

const requireTransferActionPermission = (req, res, next) => {
  const status = String(req.body.status || '').trim();
  const permission = ['Approved', 'Rejected'].includes(status) ? 'assets.transfer.approve' : 'assets.transfer';
  return requirePermission(permission)(req, res, next);
};

router.patch('/:id', requireAuth, requireRole(...transferRoles), requireTransferActionPermission, resolveTransferOrganizationScope, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const requestedStatus = String(req.body.status || '').trim();
    if (!validStatuses.includes(requestedStatus)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}.` });
    }
    const transfer = await Transfer.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!transfer) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Transfer not found.' });
    }
    const asset = await Asset.findByPk(transfer.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'The associated asset no longer exists.' });
    }
    if (req.organizationScope?.collegeId && req.user.role !== 'admin' && Number(transfer.sourceCollegeId) !== Number(req.organizationScope.collegeId) && Number(transfer.destinationCollegeId) !== Number(req.organizationScope.collegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your organization scope.' });
    }

    const currentStatus = normalizeTransferStatus(transfer.status);
    const transitions = {
      Requested: ['Approved', 'Rejected', 'Cancelled'],
      Approved: ['In Transit', 'Cancelled'],
      'In Transit': ['Received'],
      Received: [],
      Rejected: [],
      Cancelled: [],
    };
    if (!transitions[currentStatus]?.includes(requestedStatus)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Transfer cannot move from ${currentStatus} to ${requestedStatus}.` });
    }
    if (requestedStatus === 'Approved' && Number(transfer.requestedBy) === Number(req.user.id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'A requester cannot approve their own transfer.' });
    }
    if (requestedStatus === 'Cancelled' && req.user.role !== 'admin' && Number(transfer.requestedBy) !== Number(req.user.id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Only the requester or an administrator may cancel this transfer.' });
    }

    const now = new Date();
    const reason = String(req.body.reason || '').trim();
    const updates = { status: requestedStatus };
    if (requestedStatus === 'Approved') Object.assign(updates, { approvedBy: req.user.id, approvalDate: now, approvalReason: reason || null });

    if (requestedStatus === 'In Transit') {
      const eligibility = assetIsTransferable(asset);
      if (!eligibility.ok) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: eligibility.message });
      }
      Object.assign(updates, { dispatchedBy: req.user.id, dispatchedAt: now, assetStatusBeforeTransfer: asset.status });
      await asset.update({ status: 'in-transfer' }, { transaction });
    }

    if (requestedStatus === 'Received') {
      const destinationDepartment = await Department.findOne({ where: { id: transfer.destinationDepartmentId, status: 'active' }, transaction });
      if (!destinationDepartment) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: 'The destination department is no longer active.' });
      }
      const eligibility = assetIsTransferable({ ...asset.toJSON(), status: transfer.assetStatusBeforeTransfer || 'available' });
      if (!eligibility.ok) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: eligibility.message });
      }
      Object.assign(updates, { receivedBy: req.user.id, receivedAt: now });
      const previous = { status: asset.status, location: asset.location, campusId: asset.campusId, collegeId: asset.collegeId, departmentId: asset.departmentId, buildingId: asset.buildingId, roomId: asset.roomId, condition: asset.condition };
      await asset.update({
        campusId: transfer.destinationCampusId || null,
        collegeId: transfer.destinationCollegeId || destinationDepartment.collegeId || null,
        departmentId: destinationDepartment.id,
        department: destinationDepartment.name,
        buildingId: transfer.destinationBuildingId || null,
        roomId: transfer.destinationRoomId || null,
        location: transfer.newLocation,
        condition: transfer.conditionAtTransfer || asset.condition,
        status: transfer.assetStatusBeforeTransfer || 'available',
      }, { transaction });
      const assignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
      if (assignment) {
        await assignment.update({ departmentId: destinationDepartment.id, location: transfer.newLocation }, { transaction });
      }
      await AssetMovement.create({
        assetId: asset.id,
        movementType: 'transfer',
        sourceType: 'department',
        sourceId: transfer.sourceDepartmentId,
        destinationType: 'department',
        destinationId: destinationDepartment.id,
        referenceType: 'transfer',
        referenceId: transfer.id,
        performedBy: req.user.id,
        notes: transfer.transferReason,
      }, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'TRANSFER_RECEIVED',
        entity: `asset:${asset.id}`,
        entityId: asset.id,
        oldValue: previous,
        newValue: { status: asset.status, location: asset.location, campusId: asset.campusId, collegeId: asset.collegeId, departmentId: asset.departmentId, buildingId: asset.buildingId, roomId: asset.roomId, condition: asset.condition },
        details: makeAuditDetails(req, { transferId: transfer.id }),
        transaction,
      });
    }

    await transfer.update(updates, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: `TRANSFER_${requestedStatus.replace(/[\s-]/g, '_').toUpperCase()}`,
      entity: `transfer:${transfer.id}`,
      entityId: transfer.id,
      oldValue: { status: currentStatus },
      newValue: { status: requestedStatus, approvedBy: updates.approvedBy ?? transfer.approvedBy, receivedBy: updates.receivedBy ?? transfer.receivedBy },
      details: makeAuditDetails(req, { reason, transferNumber: transfer.transferNumber }),
      transaction,
    });
    await createTransferNotification({ transaction, transfer, recipients: [transfer.requestedBy], senderId: req.user.id, status: requestedStatus });
    await transaction.commit();
    const updated = await Transfer.findByPk(transfer.id, { include: transferInclude });
    return res.json({ success: true, data: toTransferResponse(updated), message: `Transfer ${requestedStatus.toLowerCase()}.` });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => res.status(405).json({ success: false, message: 'Transfer details are immutable after request. Create a new request instead.' }));
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => res.status(405).json({ success: false, message: 'Transfer history cannot be deleted.' }));

module.exports = router;
module.exports.generateTransferNumber = generateTransferNumber;
module.exports.normalizeTransferStatus = normalizeTransferStatus;
module.exports.assetIsTransferable = assetIsTransferable;
module.exports.requireTransferActionPermission = requireTransferActionPermission;
