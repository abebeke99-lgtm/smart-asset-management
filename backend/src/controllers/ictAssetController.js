const { Op, fn, col } = require('sequelize');
const { Approval, Asset, Assignment, AuditLog, Category, Department, Maintenance, Notification, RFIDLog, RfidDevice, ServiceRequest, User } = require('../models');

const scopeWhere = (req) => req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId };

const equipmentTerms = ['computer', 'desktop', 'laptop', 'monitor', 'printer', 'scanner', 'projector', 'ups', 'server', 'tablet', 'peripheral', 'keyboard', 'mouse', 'docking', 'storage', 'hard drive', 'it equipment'];

const equipmentWhere = (req) => ({
  ...scopeWhere(req),
  [Op.or]: equipmentTerms.flatMap((term) => [
    { category: { [Op.like]: `%${term}%` } },
    { name: { [Op.like]: `%${term}%` } },
  ]),
});

const networkTerms = ['network', 'router', 'switch', 'firewall', 'wireless', 'access point', 'gateway', 'modem', 'bridge', 'repeater', 'patch panel', 'network rack'];

const networkWhere = (req) => ({
  ...scopeWhere(req),
  [Op.or]: networkTerms.flatMap((term) => [
    { category: { [Op.like]: `%${term}%` } },
    { name: { [Op.like]: `%${term}%` } },
  ]),
});

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysUntil = (value) => {
  const current = toDate(value);
  if (!current) return Number.POSITIVE_INFINITY;
  return (current.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
};

const serialize = (asset, assignment) => ({
  ...asset.toJSON(),
  assetTag: asset.assetCode,
  assignedTo: assignment?.User?.fullName || assignment?.User?.username || null,
  assignedToId: assignment?.assignedTo || null,
  assignmentStatus: assignment ? 'assigned' : 'unassigned',
});

const listIctAssets = async (req, res, next) => {
  try {
    const where = { ...scopeWhere(req) };
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
    const sortBy = String(req.query.sortBy || req.query.sort_by || 'updatedAt').trim();
    const sortOrder = String(req.query.sortOrder || req.query.sort_order || 'DESC').trim().toUpperCase();
    const allowedSortFields = {
      name: 'name',
      assetCode: 'assetCode',
      category: 'category',
      department: 'department',
      location: 'location',
      status: 'status',
      condition: 'condition',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      purchaseDate: 'purchaseDate',
      manufacturer: 'manufacturer',
      model: 'model',
      serialNumber: 'serialNumber',
    };
    const orderField = allowedSortFields[sortBy] || 'updatedAt';
    const orderDirection = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

    if (req.query.category) where.category = req.query.category;
    if (req.query.status) where.status = req.query.status;
    if (req.query.condition) where.condition = req.query.condition;
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    if (req.query.department) where.department = req.query.department;
    if (search) {
      const users = await User.findAll({ where: { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] });
      const assignments = users.length ? await Assignment.findAll({ where: { assignedTo: { [Op.in]: users.map((user) => user.id) }, status: 'active' }, attributes: ['assetId'] }) : [];
      where[Op.or] = ['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'department', 'location']
        .map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
      where[Op.or].push({ id: { [Op.in]: assignments.map((assignment) => assignment.assetId) } });
    }
    if (req.query.assignmentStatus === 'assigned' || req.query.assignmentStatus === 'unassigned') {
      const assignedIds = (await Assignment.findAll({ where: { status: 'active' }, attributes: ['assetId'] })).map((item) => item.assetId);
      where.id = req.query.assignmentStatus === 'assigned' ? { [Op.in]: assignedIds } : { [Op.notIn]: assignedIds };
    }
    const { count, rows } = await Asset.findAndCountAll({ where, order: [[orderField, orderDirection]], limit, offset: (page - 1) * limit });
    const assignments = await Assignment.findAll({ where: { assetId: { [Op.in]: rows.map((asset) => asset.id) }, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] });
    const summaryRows = await Asset.findAll({ where: scopeWhere(req), attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((result, row) => { const status = String(row.status || '').toLowerCase().replace(/[_ ]/g, '-'); const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status; result[key] = (result[key] || 0) + 1; return result; }, { total: summaryRows.length });
    res.json({ success: true, assets: rows.map((asset) => serialize(asset, assignments.find((item) => item.assetId === asset.id))), total: count, summary, pagination: { page, limit, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listIctEquipment = async (req, res, next) => {
  try {
    const where = equipmentWhere(req);
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const sortBy = String(req.query.sortBy || 'updatedAt').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
    const allowedSortFields = ['name', 'assetCode', 'category', 'status', 'condition', 'location', 'department', 'purchaseDate', 'updatedAt'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const orderDirection = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

    if (search) {
      where[Op.and] = [{ [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { manufacturer: { [Op.like]: `%${search}%` } },
        { model: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ] }];
    }
    if (req.query.type) where.category = { [Op.like]: `%${String(req.query.type).trim()}%` };
    if (req.query.status) where.status = String(req.query.status).trim();
    if (req.query.condition) where.condition = String(req.query.condition).trim();
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    if (req.query.department) where.department = String(req.query.department).trim();

    const [result, summaryRows] = await Promise.all([
      Asset.findAndCountAll({ where, order: [[orderField, orderDirection]], limit, offset: (page - 1) * limit }),
      Asset.findAll({ where: equipmentWhere(req), attributes: ['status'], raw: true }),
    ]);
    const summary = summaryRows.reduce((resultValue, row) => {
      const status = normalizeStatus(row.status);
      const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status;
      resultValue[key] = (resultValue[key] || 0) + 1;
      resultValue.total += 1;
      return resultValue;
    }, { total: 0 });
    return res.json({
      success: true,
      equipment: result.rows.map((asset) => serialize(asset)),
      total: result.count,
      summary,
      pagination: { page, limit, pages: Math.ceil(result.count / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

const listNetworkEquipment = async (req, res, next) => {
  try {
    const where = networkWhere(req);
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const sortBy = String(req.query.sortBy || 'updatedAt').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
    const allowedSortFields = ['name', 'assetCode', 'category', 'status', 'condition', 'location', 'department', 'purchaseDate', 'updatedAt'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const orderDirection = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

    if (search) {
      where[Op.and] = [{ [Op.or]: ['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'department', 'location', 'specifications'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }];
    }
    if (req.query.type) where.category = { [Op.like]: `%${String(req.query.type).trim()}%` };
    if (req.query.status) where.status = String(req.query.status).trim();
    if (req.query.condition) where.condition = String(req.query.condition).trim();
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    if (req.query.department) where.department = String(req.query.department).trim();

    if (req.query.assignmentStatus === 'assigned' || req.query.assignmentStatus === 'unassigned') {
      const assignmentIds = (await Assignment.findAll({
        where: { status: 'active' },
        include: [{ model: Asset, where: networkWhere(req), attributes: [], required: true }],
        attributes: ['assetId'],
        raw: true,
      })).map((assignment) => assignment.assetId);
      where.id = req.query.assignmentStatus === 'assigned'
        ? { [Op.in]: assignmentIds }
        : { [Op.notIn]: assignmentIds.length ? assignmentIds : [0] };
    }

    const [result, summaryRows] = await Promise.all([
      Asset.findAndCountAll({ where, order: [[orderField, orderDirection]], limit, offset: (page - 1) * limit }),
      Asset.findAll({ where: networkWhere(req), attributes: ['status'], raw: true }),
    ]);
    const assignments = result.rows.length ? await Assignment.findAll({
      where: { assetId: { [Op.in]: result.rows.map((asset) => asset.id) }, status: 'active' },
      include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
    }) : [];
    const summary = summaryRows.reduce((resultValue, row) => {
      const status = normalizeStatus(row.status);
      const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status || 'unknown';
      resultValue[key] = (resultValue[key] || 0) + 1;
      resultValue.total += 1;
      return resultValue;
    }, { total: 0 });
    return res.json({ success: true, equipment: result.rows.map((asset) => serialize(asset, assignments.find((item) => item.assetId === asset.id))), total: result.count, summary, pagination: { page, limit, pages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) {
    return next(error);
  }
};

const getNetworkEquipment = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...networkWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Network equipment not found' });
    const assignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] });
    return res.json({ success: true, equipment: serialize(asset, assignment) });
  } catch (error) {
    return next(error);
  }
};

const getIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const [assignment, maintenance, history] = await Promise.all([
      Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] }),
      Maintenance.findAll({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']], limit: 10 }),
      AuditLog.findAll({ where: { entity: `asset:${asset.id}` }, order: [['createdAt', 'DESC']], limit: 20 }),
    ]);
    res.json({ success: true, asset: serialize(asset, assignment), maintenance, history });
  } catch (error) { next(error); }
};

const nonBlank = (field) => ({ [field]: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } });

const trackingScope = (req) => req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId };

const buildTrackingWhere = (req) => {
  const where = { ...trackingScope(req) };
  const search = String(req.query.search || '').trim();
  let performerIds = [];
  const trackingType = String(req.query.trackingType || '').trim().toLowerCase().replace(/\s+/g, '_');

  if (req.query.category) where.category = String(req.query.category).trim();
  if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
  if (req.query.condition) where.condition = String(req.query.condition).trim();
  if (req.query.status) where.status = String(req.query.status).trim();
  if (trackingType === 'qr') where.assetCode = nonBlank('assetCode').assetCode;
  if (trackingType === 'rfid') where.rfidTag = nonBlank('rfidTag').rfidTag;
  if (trackingType === 'qr_rfid') {
    where.assetCode = nonBlank('assetCode').assetCode;
    where.rfidTag = nonBlank('rfidTag').rfidTag;
  }
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { assetCode: { [Op.like]: `%${search}%` } },
      { digitalId: { [Op.like]: `%${search}%` } },
      { serialNumber: { [Op.like]: `%${search}%` } },
      { rfidTag: { [Op.like]: `%${search}%` } },
    ];
  }
  return where;
};

const trackingRow = (asset, lastLog, assignment) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const hasQr = Boolean(String(data.assetCode || data.digitalId || '').trim());
  const hasRfid = Boolean(String(data.rfidTag || '').trim());
  return {
    id: data.id,
    name: data.name,
    assetTag: data.assetCode || null,
    serialNumber: data.serialNumber || null,
    category: data.category || null,
    qrIdentifier: data.digitalId || data.assetCode || null,
    rfidUid: data.rfidTag || null,
    trackingType: hasQr && hasRfid ? 'QR + RFID' : hasRfid ? 'RFID' : hasQr ? 'QR' : 'Unknown',
    trackingStatus: lastLog ? 'Active' : hasRfid ? 'Not detected' : hasQr ? 'QR enabled' : 'Unknown',
    lastScan: lastLog?.createdAt || null,
    lastDetected: lastLog?.createdAt || null,
    trackingLocation: lastLog?.location || null,
    location: data.location || null,
    status: data.status || null,
    condition: data.condition || null,
    department: data.department || null,
    assignedTo: assignment?.User?.fullName || assignment?.User?.username || null,
    assignedToId: assignment?.assignedTo || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const listIctTracking = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const where = buildTrackingWhere(req);
    const [{ count, rows }, qrEnabled, rfidEnabled, recentlyScanned] = await Promise.all([
      Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC'], ['name', 'ASC']], limit, offset: (page - 1) * limit }),
      Asset.count({ where: { ...where, ...nonBlank('assetCode') } }),
      Asset.count({ where: { ...where, ...nonBlank('rfidTag') } }),
      RFIDLog.count({ distinct: true, col: 'assetId', include: [{ model: Asset, where, required: true, attributes: [] }], where: { createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);
    const assetIds = rows.map((asset) => asset.id);
    const [logs, assignments] = await Promise.all([
      assetIds.length ? RFIDLog.findAll({ where: { assetId: { [Op.in]: assetIds } }, order: [['createdAt', 'DESC']] }) : [],
      assetIds.length ? Assignment.findAll({ where: { assetId: { [Op.in]: assetIds }, status: 'active' }, include: [{ model: User, attributes: ['id', 'fullName', 'username'] }] }) : [],
    ]);
    const latestByAsset = new Map();
    logs.forEach((log) => { if (!latestByAsset.has(log.assetId)) latestByAsset.set(log.assetId, log); });
    const assignmentByAsset = new Map(assignments.map((assignment) => [assignment.assetId, assignment]));
    const data = rows.map((asset) => trackingRow(asset, latestByAsset.get(asset.id), assignmentByAsset.get(asset.id)));
    return res.json({
      success: true,
      data,
      summary: { totalTrackedAssets: count, qrEnabled, rfidEnabled, recentlyScanned },
      filters: {
        categories: [...new Set(rows.map((asset) => asset.category).filter(Boolean))].sort(),
        locations: [...new Set(rows.map((asset) => asset.location).filter(Boolean))].sort(),
        statuses: [...new Set(rows.map((asset) => asset.status).filter(Boolean))].sort(),
        conditions: [...new Set(rows.map((asset) => asset.condition).filter(Boolean))].sort(),
      },
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) { next(error); }
};

const getIctTracking = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...trackingScope(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Tracking record not found' });
    const [logs, assignment] = await Promise.all([
      RFIDLog.findAll({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']], limit: 20 }),
      Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['id', 'fullName', 'username'] }] }),
    ]);
    return res.json({ success: true, data: { ...trackingRow(asset, logs[0], assignment), history: logs.map((log) => ({ id: log.id, action: log.action, tag: log.tag, location: log.location || null, timestamp: log.createdAt })) } });
  } catch (error) { next(error); }
};

const scanIctTracking = async (req, res, next) => {
  try {
    const identifier = String(req.params.identifier || '').trim();
    if (!identifier) return res.status(422).json({ success: false, message: 'Identifier is required' });
    const asset = await Asset.findOne({ where: { ...trackingScope(req), [Op.or]: [{ assetCode: identifier }, { digitalId: identifier }, { serialNumber: identifier }, { rfidTag: identifier }, ...(Number.isInteger(Number(identifier)) ? [{ id: Number(identifier) }] : [])] } });
    if (!asset) return res.status(404).json({ success: false, message: 'QR code not recognized. No matching asset was found.' });
    const log = await RFIDLog.findOne({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']] });
    return res.json({ success: true, data: trackingRow(asset, log, null) });
  } catch (error) { next(error); }
};

const assignIctRfid = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.body.assetId || req.body.asset_id, ...trackingScope(req) } });
    const tag = String(req.body.rfidUid || req.body.rfid_tag || req.body.tag || '').trim();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your authorized college scope' });
    if (!/^[A-Za-z0-9._:-]{2,255}$/.test(tag)) return res.status(422).json({ success: false, message: 'RFID UID contains invalid characters' });
    const duplicate = await Asset.findOne({ where: { rfidTag: tag, id: { [Op.ne]: asset.id } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'RFID UID is already assigned to another asset' });
    const previousValue = asset.rfidTag || null;
    await asset.update({ rfidTag: tag });
    await RFIDLog.create({ assetId: asset.id, tag, action: previousValue ? 'change' : 'register', location: asset.location || '', notes: `RFID tag ${previousValue ? 'changed' : 'assigned'} by user ${req.user.id}` });
    await AuditLog.create({ userId: req.user.id, action: previousValue ? 'RFID_TAG_CHANGED' : 'RFID_TAG_ASSIGNED', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, tag }) });
    return res.json({ success: true, data: trackingRow(asset, null, null) });
  } catch (error) { next(error); }
};

const unassignIctRfid = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...trackingScope(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Tracking record not found' });
    const previousValue = asset.rfidTag || null;
    if (!previousValue) return res.status(409).json({ success: false, message: 'No RFID UID is assigned to this asset' });
    await asset.update({ rfidTag: '' });
    await RFIDLog.create({ assetId: asset.id, tag: previousValue, action: 'unlink', location: asset.location || '', notes: `RFID tag unassigned by user ${req.user.id}` });
    await AuditLog.create({ userId: req.user.id, action: 'RFID_TAG_UNASSIGNED', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue }) });
    return res.json({ success: true, data: trackingRow(asset, null, null) });
  } catch (error) { next(error); }
};

const updateIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const allowed = ['name', 'category', 'description', 'serialNumber', 'assetCode', 'status', 'condition', 'department', 'departmentId', 'location', 'purchaseDate', 'manufacturer', 'model', 'warrantyExpiry', 'notes'];
    const updates = Object.fromEntries(allowed.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    const previousValue = asset.toJSON();
    await asset.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_ICT_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ previousValue, newValue: asset.toJSON() }) });
    res.json({ success: true, asset: asset.toJSON() });
  } catch (error) { next(error); }
};

const getIctOptions = async (req, res, next) => {
  try {
    const assetWhere = scopeWhere(req);
    const [categories, departments, statuses, conditions] = await Promise.all([
      Category.findAll({ where: { status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Department.findAll({ where: req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId, status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ where: assetWhere, attributes: [[Asset.sequelize.fn('DISTINCT', Asset.sequelize.col('status')), 'value']], raw: true }),
      Asset.findAll({ where: assetWhere, attributes: [[Asset.sequelize.fn('DISTINCT', Asset.sequelize.col('condition')), 'value']], raw: true }),
    ]);
    res.json({ success: true, categories, departments, statuses: statuses.map((item) => item.value).filter(Boolean), conditions: conditions.map((item) => item.value).filter(Boolean) });
  } catch (error) { next(error); }
};

const getIctDashboard = async (req, res, next) => {
  try {
    const assetScope = scopeWhere(req);
    const userScope = req.user.role === 'admin' ? {} : { collegeId: req.organizationScope?.collegeId ?? req.user?.collegeId };
    const notificationScope = req.user.role === 'admin' ? {} : { [Op.or]: [{ userId: req.user.id }, { collegeId: userScope.collegeId }] };
    const approvalScope = req.user.role === 'admin'
      ? {}
      : { departmentId: { [Op.in]: (await Department.findAll({ where: { collegeId: userScope.collegeId }, attributes: ['id'], raw: true })).map((department) => department.id) } };

    const [assetCount, assetStatusRows, assetCategoryRows, approvals, serviceRequests, notifications, rfidDevices, assets] = await Promise.all([
      Asset.count({ where: assetScope }),
      Asset.findAll({ where: assetScope, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Asset.findAll({ where: assetScope, attributes: ['category', [fn('COUNT', col('id')), 'count']], group: ['category'], order: [[fn('COUNT', col('id')), 'DESC']], raw: true }),
      Approval.findAll({ where: { status: 'pending', ...approvalScope }, order: [['updatedAt', 'DESC']], limit: 20 }),
      ServiceRequest.findAll({ where: userScope, order: [['updatedAt', 'DESC']], limit: 30 }),
      Notification.findAll({
        where: notificationScope,
        attributes: ['id', 'userId', 'recipientId', 'senderId', 'collegeId', 'departmentId', 'assetId', 'title', 'message', 'type', 'priority', 'channel', 'status', 'read', 'readAt', 'scheduledAt', 'sentAt', 'expiresAt', 'archivedAt', 'archivedBy', 'eventKey', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        limit: 10,
      }),
      RfidDevice.findAll({ order: [['updatedAt', 'DESC']], limit: 20 }),
      Asset.findAll({ where: assetScope, order: [['updatedAt', 'DESC']], limit: 250 }),
    ]);

    const assetIds = assets.map((asset) => asset.id);
    const [activeAssignments, maintenanceRows, rfidLogs] = await Promise.all([
      assetIds.length
        ? Assignment.findAll({
            where: { assetId: { [Op.in]: assetIds }, status: 'active' },
            include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
            order: [['updatedAt', 'DESC']],
            limit: 100,
          })
        : [],
      assetIds.length
        ? Maintenance.findAll({
            where: { assetId: { [Op.in]: assetIds } },
            include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'] }],
            order: [['updatedAt', 'DESC']],
            limit: 50,
          })
        : [],
      assetIds.length
        ? RFIDLog.findAll({ where: { assetId: { [Op.in]: assetIds } }, order: [['createdAt', 'DESC']], limit: 25 })
        : [],
    ]);
      const [activeAssignmentCount, openSupportTicketCount, openIncidentCount] = await Promise.all([
        Assignment.count({
          distinct: true,
          col: 'asset_id',
          where: { status: 'active' },
          include: [{ model: Asset, where: assetScope, required: true, attributes: [] }],
        }),
        ServiceRequest.count({ where: { ...userScope, status: { [Op.notIn]: ['completed', 'resolved', 'closed', 'cancelled'] }, [Op.or]: [{ requestType: 'support' }, { requestType: { [Op.like]: '%support%' } }, { category: { [Op.like]: '%support%' } }] } }),
        ServiceRequest.count({ where: { ...userScope, status: { [Op.notIn]: ['completed', 'resolved', 'closed', 'cancelled'] }, [Op.or]: [{ requestType: 'incident' }, { requestType: { [Op.like]: '%incident%' } }, { category: { [Op.like]: '%incident%' } }] } }),
      ]);

    const summary = {
      total: assetCount,
      available: 0,
      assigned: activeAssignmentCount,
      maintenance: 0,
      repair: 0,
      retired: 0,
      pendingRequests: approvals.length,
      openSupportTickets: openSupportTicketCount,
      openIncidents: openIncidentCount,
      upcomingMaintenance: maintenanceRows.filter((entry) => !['completed', 'resolved', 'cancelled'].includes(normalizeStatus(entry.status))).length,
      expiringLicenses: 0,
    };

    assetStatusRows.forEach((row) => {
      const status = normalizeStatus(row.status);
      const count = Number(row.count || 0);
      if (['available', 'ready', 'idle', 'new'].includes(status)) summary.available += count;
      else if (['maintenance', 'under-maintenance'].includes(status)) summary.maintenance += count;
      else if (['repair', 'in-repair', 'broken'].includes(status)) summary.repair += count;
      else if (['retired', 'disposed', 'decommissioned'].includes(status)) summary.retired += count;
    });

    const expiringLicenses = assets.filter((asset) => {
      const expiry = toDate(asset.warrantyExpiry || asset.purchaseDate);
      return expiry && daysUntil(expiry) >= 0 && daysUntil(expiry) <= 90;
    });

    const openSupportTickets = serviceRequests.filter((request) => {
      const status = normalizeStatus(request.status);
      const category = normalizeStatus(request.category || request.requestType || 'support');
      const isOpen = !['completed', 'resolved', 'closed', 'cancelled'].includes(status);
      return isOpen && (category.includes('support') || category.includes('ticket') || request.requestType === 'support');
    });
    const openIncidents = serviceRequests.filter((request) => {
      const status = normalizeStatus(request.status);
      const category = normalizeStatus(request.category || request.requestType || 'incident');
      const isOpen = !['completed', 'resolved', 'closed', 'cancelled'].includes(status);
      return isOpen && (category.includes('incident') || request.requestType === 'incident');
    });
    summary.openSupportTickets = openSupportTicketCount;
    summary.openIncidents = openIncidentCount;

    const recentActivities = [];
    assets.slice(0, 8).forEach((asset) => {
      const time = asset.createdAt || asset.updatedAt;
      if (time) {
        recentActivities.push({ id: `asset-${asset.id}`, kind: 'Asset created', detail: asset.name || asset.assetCode || 'Asset record', time, icon: 'package' });
      }
    });

    activeAssignments.slice(0, 8).forEach((assignment) => {
      const time = assignment.createdAt || assignment.updatedAt;
      if (time) {
        recentActivities.push({ id: `assignment-${assignment.id}`, kind: 'Asset assigned', detail: assignment.Asset?.name || `Asset #${assignment.assetId}`, time, icon: 'user-check' });
      }
    });

    maintenanceRows.slice(0, 8).forEach((entry) => {
      const time = entry.createdAt || entry.updatedAt;
      if (time) {
        recentActivities.push({ id: `maintenance-${entry.id}`, kind: 'Maintenance updated', detail: entry.Asset?.name || `Maintenance #${entry.id}`, time, icon: 'wrench' });
      }
    });

    rfidLogs.slice(0, 8).forEach((log) => {
      const time = log.createdAt || log.updatedAt;
      if (time) {
        recentActivities.push({ id: `rfid-${log.id}`, kind: 'RFID scan', detail: log.location || 'Asset scan', time, icon: 'radio' });
      }
    });

    recentActivities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const limitedRecentActivities = recentActivities.slice(0, 8);

    const response = {
      success: true,
      dashboard: {
        stats: summary,
        summary,
        assets,
        assignments: activeAssignments,
        maintenance: maintenanceRows,
        requests: approvals,
        serviceRequests,
        assetStatus: assetStatusRows.map((row) => ({ label: row.status || 'Unspecified', count: Number(row.count || 0) })),
        assetCategories: assetCategoryRows.map((row) => ({ label: row.category || 'Uncategorized', count: Number(row.count || 0) })),
        notifications,
        recentNotifications: notifications.slice(0, 5),
        recentActivities: limitedRecentActivities,
        supportTickets: openSupportTickets,
        incidents: openIncidents,
        upcomingMaintenance: maintenanceRows.filter((entry) => !['completed', 'resolved', 'cancelled'].includes(normalizeStatus(entry.status))).slice(0, 5),
        expiringLicenses: expiringLicenses.slice(0, 10),
        rfidStatus: rfidDevices.length > 0 ? 'Operational' : 'Not configured',
      },
    };

    res.json(response);
  } catch (error) { next(error); }
};

const parseAuditDetails = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
  } catch {
    return { value };
  }
};

const assetHistoryScope = (req) => (req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId });

const eventLabel = (action) => String(action || '')
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const serializeHistoryRecord = (log, asset) => {
  const details = parseAuditDetails(log.details);
  const previousValue = details.previousValue ?? details.previous ?? details.oldValue ?? details.before ?? null;
  const newValue = details.newValue ?? details.next ?? details.after ?? null;
  const location = details.location ?? (newValue && typeof newValue === 'object' ? newValue.location : null);

  return {
    id: log.id,
    eventType: log.action,
    eventLabel: eventLabel(log.action),
    description: details.description || details.comment || details.reason || '',
    previousValue,
    newValue,
    performedAt: log.createdAt,
    performedBy: log.User ? {
      id: log.User.id,
      name: log.User.fullName || log.User.username || 'Unknown user',
      username: log.User.username,
    } : null,
    reference: details.referenceType || details.referenceId || details.assignmentId || details.transferId || details.requestId || null,
    location,
    asset: {
      id: asset.id,
      name: asset.name,
      assetTag: asset.assetCode,
      serialNumber: asset.serialNumber,
      category: asset.category,
      department: asset.department,
      location: asset.location,
    },
    metadata: details,
  };
};

const findHistoryAssets = async (req) => {
  const assetWhere = { ...assetHistoryScope(req) };
  const assetId = req.query.assetId ? Number(req.query.assetId) : null;
  if (req.query.assetId && (!Number.isInteger(assetId) || assetId < 1)) {
    const error = new Error('Invalid asset history assetId');
    error.status = 422;
    throw error;
  }
  if (req.query.category) assetWhere.category = String(req.query.category).trim();
  if (req.query.departmentId) {
    const departmentId = Number(req.query.departmentId);
    if (!Number.isInteger(departmentId) || departmentId < 1) {
      const error = new Error('Invalid history department filter');
      error.status = 422;
      throw error;
    }
    assetWhere.departmentId = departmentId;
  }
  if (req.query.location) assetWhere.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
  if (assetId) assetWhere.id = assetId;

  const search = String(req.query.search || '').trim();
  if (search) {
    const users = await User.findAll({
      where: {
        ...(req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId }),
        [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }],
      },
      attributes: ['id'],
    });
    performerIds = users.map((user) => user.id);
    assetWhere[Op.or] = [
      ...['name', 'assetCode', 'serialNumber', 'category'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })),
    ];
  }

  const assets = await Asset.findAll({ where: assetWhere, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location'] });
  if (!performerIds.length) return { assets, performerIds };

  const performerLogs = await AuditLog.findAll({ where: { userId: { [Op.in]: performerIds }, entity: { [Op.like]: 'asset:%' } }, attributes: ['entity'], raw: true });
  const performerAssetIds = [...new Set(performerLogs.map((log) => Number(String(log.entity).split(':')[1])).filter(Number.isInteger))];
  if (!performerAssetIds.length) return { assets, performerIds };
  const performerAssets = await Asset.findAll({ where: { ...assetHistoryScope(req), id: { [Op.in]: performerAssetIds } }, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location'] });
  const uniqueAssets = new Map([...assets, ...performerAssets].map((asset) => [asset.id, asset]));
  return { assets: [...uniqueAssets.values()], performerIds };
};

const listIctAssetHistory = async (req, res, next) => {
  try {
    const pageValue = Number(req.query.page || 1);
    const limitValue = Number(req.query.limit || 25);
    if (!Number.isInteger(pageValue) || pageValue < 1 || !Number.isInteger(limitValue) || ![10, 25, 50, 100].includes(limitValue)) return res.status(422).json({ success: false, message: 'Invalid history pagination parameters' });
    const page = pageValue;
    const limit = limitValue;
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const { assets, performerIds } = await findHistoryAssets(req);
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const assetIds = assets.map((asset) => asset.id);

    if (!assetIds.length) {
      return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0, pages: 0 }, eventTypes: [] });
    }

    const historyWhere = { entity: { [Op.in]: assetIds.map((id) => `asset:${id}`) } };
    if (req.query.eventType) historyWhere.action = String(req.query.eventType).trim();
    if (req.query.userId) {
      const userId = Number(req.query.userId);
      if (!Number.isInteger(userId) || userId < 1) return res.status(422).json({ success: false, message: 'Invalid history user filter' });
      historyWhere.userId = userId;
    } else if (performerIds.length) {
      historyWhere.userId = { [Op.in]: performerIds };
    }
    if (req.query.dateFrom || req.query.dateTo) {
      historyWhere.createdAt = {};
      if (req.query.dateFrom && Number.isNaN(Date.parse(req.query.dateFrom))) return res.status(422).json({ success: false, message: 'Invalid history start date' });
      if (req.query.dateTo && Number.isNaN(Date.parse(req.query.dateTo))) return res.status(422).json({ success: false, message: 'Invalid history end date' });
      if (req.query.dateFrom) historyWhere.createdAt[Op.gte] = new Date(`${req.query.dateFrom}T00:00:00.000Z`);
      if (req.query.dateTo) {
        const endDate = new Date(`${req.query.dateTo}T00:00:00.000Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        historyWhere.createdAt[Op.lt] = endDate;
      }
    }

    const [{ count, rows }, eventRows] = await Promise.all([
      AuditLog.findAndCountAll({
        where: historyWhere,
        include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
        order: [['createdAt', sortOrder], ['id', sortOrder]],
        limit,
        offset: (page - 1) * limit,
      }),
      AuditLog.findAll({ where: historyWhere, attributes: [[fn('DISTINCT', col('action')), 'value']], raw: true }),
    ]);

    const data = rows.map((row) => {
      const assetIdFromEntity = Number(String(row.entity).split(':')[1]);
      return serializeHistoryRecord(row, assetById.get(assetIdFromEntity));
    });
    return res.json({ success: true, data, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit), pages: Math.ceil(count / limit) }, eventTypes: eventRows.map((row) => row.value).filter(Boolean) });
  } catch (error) {
    return next(error);
  }
};

const getIctAssetHistoryRecord = async (req, res, next) => {
  try {
    const log = await AuditLog.findByPk(req.params.id, { include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] });
    if (!log || !/^asset:\d+$/.test(String(log.entity))) return res.status(404).json({ success: false, message: 'Asset history record not found' });
    const assetId = Number(String(log.entity).split(':')[1]);
    const asset = await Asset.findOne({ where: { id: assetId, ...assetHistoryScope(req) }, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location'] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset history record not found' });
    return res.json({ success: true, data: serializeHistoryRecord(log, asset) });
  } catch (error) {
    return next(error);
  }
};

const getIctAssetHistoryByAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: Number(req.params.assetId), ...assetHistoryScope(req) }, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location'] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    req.query.assetId = asset.id;
    return listIctAssetHistory(req, res, next);
  } catch (error) {
    return next(error);
  }
};

module.exports = { listIctAssets, listIctEquipment, listNetworkEquipment, getNetworkEquipment, getIctAsset, updateIctAsset, getIctOptions, getIctDashboard, listIctTracking, getIctTracking, scanIctTracking, assignIctRfid, unassignIctRfid, listIctAssetHistory, getIctAssetHistoryRecord, getIctAssetHistoryByAsset };