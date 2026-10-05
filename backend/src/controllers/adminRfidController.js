const crypto = require('node:crypto');
const { Op, QueryTypes, fn, col, where } = require('sequelize');
const {
  sequelize,
  Asset,
  Assignment,
  Transfer,
  Maintenance,
  MaintenanceWorkOrder,
  MaintenanceRepair,
  PreventiveMaintenance,
  MaintenanceCost,
  RFIDLog,
  AuditLog,
  User,
  Department,
  College,
  Campus,
  Building,
  Room,
  AssetMovement,
} = require('../models');
const { createAuditLog } = require('../services/auditLogService');

const respond = (res, status, data, message) => res.status(status).json({
  success: status < 400,
  data: data ?? null,
  message: message || (status < 400 ? 'Request completed.' : 'Request failed.'),
});
const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();
const notBlank = (field) => where(col(TRACKING_COLUMNS[field]), { [Op.regexp]: '[^[:space:]]' });
const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
const TRACKING_COLUMNS = { qrCode: 'qr_code', rfidTag: 'rfid_tag', digitalId: 'digital_id' };
const TRACKING_SUMMARY_SQL = `
  SELECT
    COUNT(*) AS totalAssets,
    COALESCE(SUM(CASE WHEN rfid_tag REGEXP '[^[:space:]]' THEN 1 ELSE 0 END), 0) AS rfidAssigned,
    COALESCE(SUM(CASE WHEN qr_code REGEXP '[^[:space:]]' THEN 1 ELSE 0 END), 0) AS qrAssigned,
    COALESCE(SUM(CASE WHEN rfid_tag REGEXP '[^[:space:]]' AND qr_code REGEXP '[^[:space:]]' THEN 1 ELSE 0 END), 0) AS fullyTracked
  FROM assets
  WHERE deleted_at IS NULL
`;

const assetLocationIncludes = [
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false },
  { model: College, attributes: ['id', 'collegeName'], required: false },
  { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName'], required: false },
  { model: Building, as: 'BuildingRecord', attributes: ['id', 'buildingName'], required: false },
  { model: Room, as: 'RoomRecord', attributes: ['id', 'roomName', 'floor'], required: false },
];

const getSummaryCounts = async (transaction) => {
  const [counts] = await sequelize.query(TRACKING_SUMMARY_SQL, {
    type: QueryTypes.SELECT,
    transaction,
  });
  const totalAssets = Number(counts.totalAssets);
  const rfidAssigned = Number(counts.rfidAssigned);
  const qrAssigned = Number(counts.qrAssigned);
  const fullyTracked = Number(counts.fullyTracked);
  return {
    totalAssets,
    rfidAssigned,
    qrAssigned,
    fullyTracked,
    notFullyTracked: totalAssets - fullyTracked,
  };
};

const summary = async (_req, res) => {
  try {
    return respond(res, 200, await getSummaryCounts(), 'Tracking summary loaded.');
  } catch (error) {
    console.error('Admin RFID tracking summary query failed:', error);
    return respond(res, 500, null, 'Unable to load tracking summary.');
  }
};

const listAssets = async (req, res, next) => {
  try {
    const searchValue = req.query.search ?? '';
    const statusValue = req.query.status ?? '';
    if (typeof searchValue !== 'string' || searchValue.length > 255
      || typeof statusValue !== 'string' || statusValue.length > 100) {
      return respond(res, 400, null, 'Search and status values must be valid text.');
    }
    const search = searchValue.trim();
    const status = statusValue.trim();
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return respond(res, 400, null, 'Page must be positive and limit must be between 1 and 100.');
    }
    const whereClause = {};
    if (status) {
      whereClause[Op.and] = [
        where(fn('LOWER', fn('REPLACE', fn('REPLACE', col('Asset.status'), '_', '-'), ' ', '-')), normalizeStatus(status)),
      ];
    }
    if (search) {
      const pattern = `%${search}%`;
      whereClause[Op.or] = [
        { assetCode: { [Op.like]: pattern } },
        { name: { [Op.like]: pattern } },
        { serialNumber: { [Op.like]: pattern } },
        { qrCode: { [Op.like]: pattern } },
        { rfidTag: { [Op.like]: pattern } },
        { department: { [Op.like]: pattern } },
      ];
    }
    const result = await Asset.findAndCountAll({
      where: whereClause,
      include: assetLocationIncludes,
      order: [['assetCode', 'ASC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const rows = result.rows.map((asset) => ({
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      category: asset.category,
      serialNumber: asset.serialNumber,
      status: asset.status,
      condition: asset.condition,
      department: asset.DepartmentRecord?.name || asset.department || null,
      qrCode: asset.qrCode || asset.digitalId || null,
      rfidTag: asset.rfidTag || null,
    }));
    return respond(res, 200, {
      items: rows,
      pagination: {
        page,
        limit,
        total: result.count,
        pages: Math.ceil(result.count / limit),
      },
    }, 'Tracking assets loaded.');
  } catch (error) {
    return next(error);
  }
};

const findUniqueExact = async (fieldNames, value) => {
  const canonical = normalizeCode(value);
  const matches = await Asset.findAll({
    where: {
      [Op.or]: fieldNames.map((field) => where(
        fn('UPPER', fn('TRIM', col(`Asset.${TRACKING_COLUMNS[field]}`))),
        canonical,
      )),
    },
    include: assetLocationIncludes,
    limit: 2,
  });
  if (matches.length > 1) return { duplicate: true };
  return { asset: matches[0] || null };
};

const serializeLookupAsset = (asset) => ({
  id: asset.id,
  assetCode: asset.assetCode,
  name: asset.name,
  category: asset.category,
  serialNumber: asset.serialNumber,
  status: asset.status,
  condition: asset.condition,
  department: asset.DepartmentRecord?.name || asset.department || null,
  qrCode: asset.qrCode || asset.digitalId || null,
  rfidTag: asset.rfidTag || null,
});

const lookupAssetId = async (req, res, next) => {
  try {
    const value = String(req.params.assetId ?? '').trim();
    if (!value || value.length > 255) return respond(res, 400, null, 'A valid asset ID is required.');
    const matches = await Asset.findAll({
      where: {
        [Op.or]: [
          where(fn('UPPER', fn('TRIM', col('Asset.asset_code'))), normalizeCode(value)),
          ...(/^\d+$/.test(value) ? [{ id: Number(value) }] : []),
        ],
      },
      include: assetLocationIncludes,
      limit: 2,
    });
    if (matches.length > 1) return respond(res, 409, null, 'More than one asset matches this ID.');
    if (!matches[0]) return respond(res, 404, null, 'Asset not found.');
    return respond(res, 200, { asset: serializeLookupAsset(matches[0]) }, 'Asset found.');
  } catch (error) {
    return next(error);
  }
};

const lookupCode = async (req, res, next) => {
  try {
    const raw = String(req.params.code ?? '').trim();
    if (!raw || raw.length > 255 || /[\u0000-\u001f]/.test(raw)) {
      return respond(res, 400, null, 'A valid QR or RFID value is required.');
    }
    const matches = await findUniqueExact(['qrCode', 'rfidTag', 'digitalId'], raw);
    if (matches.duplicate) return respond(res, 409, null, 'This tracking value is assigned to more than one asset.');
    if (!matches.asset) return respond(res, 404, null, 'Asset not found.');
    return respond(res, 200, { asset: serializeLookupAsset(matches.asset) }, 'Asset found.');
  } catch (error) {
    return next(error);
  }
};

const getTracking = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return respond(res, 400, null, 'A valid asset ID is required.');
    const asset = await Asset.findByPk(id, { include: assetLocationIncludes });
    if (!asset) return respond(res, 404, null, 'Asset not found.');

    const [assignments, transfers, maintenance, preventive, repairs, workOrders, costs, movement] = await Promise.all([
      Assignment.findAll({
        where: { assetId: id },
        include: [
          {
            model: User,
            required: false,
            attributes: ['id', 'fullName', 'username'],
            include: [{ model: Department, as: 'DepartmentRecord', required: false, attributes: ['id', 'name'] }],
          },
          { model: User, as: 'AssignedByUser', required: false, attributes: ['id', 'fullName', 'username'] },
          { model: Department, as: 'AssignedDepartment', required: false, attributes: ['id', 'name'] },
          { model: Room, as: 'AssignedLaboratory', required: false, attributes: ['id', 'roomName'] },
        ],
        order: [['assignedDate', 'DESC'], ['createdAt', 'DESC']],
      }),
      Transfer.findAll({
        where: { assetId: id },
        include: [
          { model: User, as: 'Creator', required: false, attributes: ['id', 'fullName', 'username'] },
          { model: User, as: 'Approver', required: false, attributes: ['id', 'fullName', 'username'] },
        ],
        order: [['transferDate', 'DESC'], ['createdAt', 'DESC']],
      }),
      Maintenance.findAll({
        where: { assetId: id },
        include: [{ model: User, as: 'Technician', required: false, attributes: ['id', 'fullName', 'username'] }],
        order: [['createdAt', 'DESC']],
      }),
      PreventiveMaintenance.findAll({
        where: { assetId: id },
        include: [{ model: User, as: 'Technician', required: false, attributes: ['id', 'fullName', 'username'] }],
        order: [['scheduleDate', 'DESC']],
      }),
      MaintenanceRepair.findAll({
        where: { assetId: id },
        include: [{ model: User, as: 'Technician', required: false, attributes: ['id', 'fullName', 'username'] }],
        order: [['completionDate', 'DESC'], ['createdAt', 'DESC']],
      }),
      MaintenanceWorkOrder.findAll({
        where: { assetId: id },
        include: [{ model: User, as: 'Technician', required: false, attributes: ['id', 'fullName', 'username'] }],
        order: [['createdAt', 'DESC']],
      }),
      MaintenanceCost.findAll({ where: { assetId: id }, attributes: ['maintenanceId', 'workOrderId', 'amount'] }),
      AssetMovement.findOne({
        where: { assetId: id },
        include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const assignmentHistory = assignments.map((row, index) => ({
      id: row.id,
      assignedTo: row.assignedToType === 'department'
        ? row.AssignedDepartment?.name || null
        : row.assignedToType === 'laboratory'
          ? row.AssignedLaboratory?.roomName || null
          : row.User?.fullName || row.User?.username || null,
      department: row.AssignedDepartment?.name || row.User?.DepartmentRecord?.name || row.User?.department || null,
      from: assignments[index + 1]?.location || null,
      to: row.location || null,
      assignedAt: row.assignedDate || row.createdAt,
      returnedAt: row.returnedAt,
      assignedBy: row.AssignedByUser?.fullName || row.AssignedByUser?.username || null,
      status: row.status,
    }));
    const currentAssignment = assignmentHistory.find((row) => normalizeStatus(row.status) === 'active') || null;
    const transferHistory = transfers.map((row) => ({
      id: row.id,
      fromLocation: row.currentLocation || null,
      toLocation: row.newLocation || null,
      fromDepartment: row.sourceDepartment || null,
      toDepartment: row.destinationDepartment || null,
      date: row.transferDate || row.createdAt,
      approvedBy: row.Approver?.fullName || row.Approver?.username || null,
      reason: row.transferReason || null,
      status: row.status,
    }));
    const workOrderByMaintenance = new Map(workOrders.filter((row) => row.maintenanceId).map((row) => [row.maintenanceId, row]));
    const repairByMaintenance = new Map(repairs.map((row) => [row.maintenanceId, row]));
    const correctiveHistory = maintenance.map((row) => {
      const workOrder = workOrderByMaintenance.get(row.id);
      const repair = repairByMaintenance.get(row.id);
      const relatedCosts = costs
        .filter((cost) => cost.maintenanceId === row.id || (workOrder && cost.workOrderId === workOrder.id))
        .reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
      return {
        id: row.id,
        date: repair?.completionDate || row.completedAt || row.updatedAt || row.createdAt,
        type: /preventive/i.test(`${row.title} ${row.description}`) ? 'preventive' : 'corrective',
        ticketId: workOrder?.workOrderNumber || (repair ? `MR-${repair.id}` : `MT-${row.id}`),
        workOrderId: workOrder?.workOrderNumber || null,
        technician: repair?.Technician?.fullName || repair?.Technician?.username
          || workOrder?.Technician?.fullName || workOrder?.Technician?.username
          || row.Technician?.fullName || row.Technician?.username || null,
        cost: Number(repair?.totalCost) > 0 ? Number(repair.totalCost)
          : Number(workOrder?.actualCost) > 0 ? Number(workOrder.actualCost) : relatedCosts,
        status: repair?.status || workOrder?.status || row.status,
        outcome: repair?.repairAction || repair?.diagnosis || workOrder?.diagnosis || workOrder?.requiredWork || row.description || null,
      };
    });
    const preventiveHistory = preventive.map((row) => ({
      id: `PM-${row.id}`,
      date: row.lastCompletedDate || row.scheduleDate,
      type: 'preventive',
      ticketId: `PM-${row.id}`,
      workOrderId: null,
      technician: row.Technician?.fullName || row.Technician?.username || null,
      cost: Number(row.estimatedCost || 0),
      status: row.status,
      outcome: row.notes || row.checklist || null,
    }));
    const maintenanceHistory = [...correctiveHistory, ...preventiveHistory]
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());

    return respond(res, 200, {
      asset: {
        id: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        category: asset.category,
        serialNumber: asset.serialNumber,
        department: asset.DepartmentRecord?.name || asset.department || null,
        status: asset.status,
        qrCode: asset.qrCode || asset.digitalId || null,
        rfidTag: asset.rfidTag || null,
        purchaseDate: asset.purchaseDate,
        condition: asset.condition,
      },
      currentLocation: {
        college: asset.College?.collegeName || null,
        department: asset.DepartmentRecord?.name || asset.department || null,
        building: asset.BuildingRecord?.buildingName || null,
        room: asset.RoomRecord?.roomName || asset.location || null,
        floor: asset.RoomRecord?.floor ?? null,
        lastUpdated: movement?.createdAt || asset.updatedAt || null,
        updatedBy: movement?.User?.fullName || movement?.User?.username || null,
      },
      currentAssignment,
      assignmentHistory,
      transferHistory,
      maintenanceHistory,
    }, 'Asset tracking details loaded.');
  } catch (error) {
    return next(error);
  }
};

const scanLog = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const body = req.body || {};
    const assetId = Number(body.asset_id);
    const method = typeof body.method === 'string' ? body.method.trim().toLowerCase() : '';
    const value = typeof body.value === 'string' ? body.value.trim() : '';
    if (!Number.isSafeInteger(assetId) || assetId < 1 || !['qr', 'rfid', 'manual'].includes(method)
      || !value || value.length > 255) {
      await transaction.rollback();
      return respond(res, 400, null, 'asset_id, a valid scan method, and scan value are required.');
    }
    const asset = await Asset.findByPk(assetId, { transaction });
    if (!asset) {
      await transaction.rollback();
      return respond(res, 404, null, 'Asset not found.');
    }
    const log = await RFIDLog.create({
      assetId,
      tag: value,
      action: `${method}_scan`,
      notes: JSON.stringify({ method }),
      scannedBy: req.user.id,
    }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'ASSET_TRACKING_SCAN',
      entity: `asset:${assetId}`,
      details: { method, value, scanId: log.id },
      transaction,
    });
    await transaction.commit();
    return respond(res, 201, { id: log.id, assetId, method, scannedBy: req.user.id, timestamp: log.createdAt }, 'Scan recorded.');
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const isUniqueConstraintError = (error) => error?.name === 'SequelizeUniqueConstraintError'
  || error?.original?.code === 'ER_DUP_ENTRY';
const isCodeUsed = async (field, value, excludeId, transaction) => {
  const columns = field === 'qrCode' ? ['qr_code', 'digital_id'] : ['rfid_tag'];
  const clauses = columns.map((name) => where(fn('UPPER', fn('TRIM', col(`Asset.${name}`))), normalizeCode(value)));
  return Asset.count({
    where: {
      [Op.and]: [
        { [Op.or]: clauses },
        ...(excludeId ? [{ id: { [Op.ne]: excludeId } }] : []),
      ],
    },
    transaction,
  }) > 0;
};

const saveTags = async (req, res, next, regenerate = false) => {
  let transaction;
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return respond(res, 400, null, 'A valid asset ID is required.');
    const body = req.body || {};
    if (!regenerate && ((body.qrCode !== undefined && typeof body.qrCode !== 'string')
      || (body.rfidTag !== undefined && typeof body.rfidTag !== 'string'))) {
      return respond(res, 400, null, 'QR and RFID values must be text.');
    }
    const requestedQr = regenerate ? null : body.qrCode;
    const requestedRfid = regenerate ? undefined : body.rfidTag;
    if (!regenerate && requestedQr === undefined && requestedRfid === undefined) {
      return respond(res, 400, null, 'Provide a QR code or RFID tag to assign.');
    }
    let qrCode = regenerate
      ? `QR-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`
      : requestedQr === undefined ? undefined : normalizeCode(requestedQr);
    const rfidTag = requestedRfid === undefined ? undefined : normalizeCode(requestedRfid);
    if (qrCode !== undefined && (!qrCode || qrCode.length > 100)) return respond(res, 400, null, 'QR code must be between 1 and 100 characters.');
    if (rfidTag !== undefined && (!rfidTag || rfidTag.length > 255)) return respond(res, 400, null, 'RFID tag must be between 1 and 255 characters.');

    transaction = await sequelize.transaction();
    const asset = await Asset.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return respond(res, 404, null, 'Asset not found.');
    }
    if (regenerate) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        qrCode = `QR-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
        if (!await isCodeUsed('qrCode', qrCode, id, transaction)) break;
      }
      if (await isCodeUsed('qrCode', qrCode, id, transaction)) {
        await transaction.rollback();
        return respond(res, 409, null, 'Unable to generate a unique QR value. Please try again.');
      }
    }
    if (qrCode !== undefined && await isCodeUsed('qrCode', qrCode, id, transaction)) {
      await transaction.rollback();
      return respond(res, 409, null, 'That QR value is already assigned.');
    }
    if (rfidTag !== undefined && await isCodeUsed('rfidTag', rfidTag, id, transaction)) {
      await transaction.rollback();
      return respond(res, 409, null, 'That RFID value is already assigned.');
    }
    const before = { qrCode: asset.qrCode || asset.digitalId || null, rfidTag: asset.rfidTag || null };
    const update = {};
    if (qrCode !== undefined) {
      update.qrCode = qrCode;
      update.digitalId = qrCode;
    }
    if (rfidTag !== undefined) update.rfidTag = rfidTag;
    await asset.update(update, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: regenerate ? 'ASSET_QR_REGENERATED' : 'ASSET_TRACKING_TAGS_ASSIGNED',
      entity: `asset:${id}`,
      oldValue: before,
      newValue: { qrCode: asset.qrCode, rfidTag: asset.rfidTag },
      transaction,
    });
    await transaction.commit();
    return respond(res, 200, {
      id: asset.id,
      qrCode: asset.qrCode || asset.digitalId || null,
      rfidTag: asset.rfidTag || null,
    }, regenerate ? 'QR code regenerated.' : 'Tracking tags updated.');
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (isUniqueConstraintError(error)) return respond(res, 409, null, 'That QR or RFID value is already assigned.');
    return next(error);
  }
};

const assignTags = (req, res, next) => saveTags(req, res, next);
const regenerateQr = (req, res, next) => saveTags(req, res, next, true);

module.exports = {
  summary,
  getSummaryCounts,
  listAssets,
  lookupAssetId,
  lookupCode,
  getTracking,
  scanLog,
  assignTags,
  regenerateQr,
};
