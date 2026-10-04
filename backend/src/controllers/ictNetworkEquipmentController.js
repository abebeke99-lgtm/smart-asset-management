const net = require('net');
const { Op, fn, col } = require('sequelize');
const {
  sequelize,
  Asset,
  Assignment,
  User,
  Campus,
  Building,
  Room,
} = require('../models');
const { networkPredicate } = require('../utils/ictAssetFilters');
const { createAuditLog } = require('../services/auditLogService');

const EQUIPMENT_TYPES = [
  'Switch',
  'Router',
  'Firewall',
  'Access Point',
  'Network Rack',
  'Modem',
  'Server',
  'Other Network Equipment',
];
const STATUSES = [
  'active',
  'available',
  'assigned',
  'in-use',
  'maintenance',
  'under-maintenance',
  'repair',
  'faulty',
  'broken',
  'inactive',
  'missing',
  'retired',
  'disposed',
];
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'damaged'];
const networkAssetPredicate = () => ({
  [Op.or]: [
    ...networkPredicate()[Op.or],
    { category: { [Op.like]: '%server%' } },
  ],
});
const locationIncludes = [
  { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName'], required: false },
  { model: Building, as: 'BuildingRecord', attributes: ['id', 'buildingName'], required: false },
  { model: Room, as: 'RoomRecord', attributes: ['id', 'roomName', 'roomCode'], required: false },
];

const scopeWhere = (req) => (req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId });
const networkWhere = (req) => ({ ...scopeWhere(req), ...networkAssetPredicate() });
const normalized = (value) => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
const readSpecifications = (value) => {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  return {};
};

const serialize = (asset, assignment) => {
  const data = typeof asset.toJSON === 'function' ? asset.toJSON() : asset;
  const specifications = readSpecifications(data.specifications);
  const assignedTo = assignment?.User?.fullName || assignment?.User?.username || '';
  return {
    ...data,
    specifications,
    assetTag: data.assetCode || '',
    type: data.category || '',
    ipAddress: specifications.ipAddress || '',
    macAddress: specifications.macAddress || '',
    campus: specifications.campus || data.CampusRecord?.campusName || '',
    building: specifications.building || data.BuildingRecord?.buildingName || '',
    room: specifications.room || data.RoomRecord?.roomName || data.RoomRecord?.roomCode || '',
    assignedTo,
    assignedToId: assignment?.assignedTo || null,
    assignment: assignedTo || 'Unassigned',
    assignmentStatus: assignment ? 'assigned' : 'unassigned',
  };
};

const requestError = (res, message, status = 422) => res.status(status).json({ success: false, message });

const parseDate = (value, label, errors) => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    errors.push(`${label} must be a valid date in YYYY-MM-DD format`);
    return null;
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    errors.push(`${label} must be a valid date in YYYY-MM-DD format`);
    return null;
  }
  return date;
};

const validateBody = (body, currentSpecifications = {}) => {
  const errors = [];
  const name = String(body.name || '').trim();
  const type = String(body.type || body.category || '').trim();
  const status = normalized(body.status || 'available');
  const condition = normalized(body.condition || 'good');
  const assetTag = String(body.assetTag ?? body.assetCode ?? '').trim();
  const serialNumber = String(body.serialNumber || '').trim();
  const ipAddress = String(body.ipAddress || '').trim();
  const macAddress = String(body.macAddress || '').trim();
  const location = String(body.location || '').trim();
  const campus = String(body.campus || '').trim();
  const building = String(body.building || '').trim();
  const room = String(body.room || '').trim();
  const description = String(body.description || '').trim();

  if (!name || name.length > 255) errors.push('Equipment name is required and must be 255 characters or fewer');
  if (!EQUIPMENT_TYPES.includes(type)) errors.push('Select a supported network equipment type');
  if (!STATUSES.includes(status)) errors.push('Select a supported equipment status');
  if (!CONDITIONS.includes(condition)) errors.push('Select a supported equipment condition');
  if (assetTag.length > 255) errors.push('Asset tag must be 255 characters or fewer');
  if (serialNumber.length > 255) errors.push('Serial number must be 255 characters or fewer');
  if (ipAddress && net.isIP(ipAddress) === 0) errors.push('IP address must be a valid IPv4 or IPv6 address');
  if (macAddress && !/^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$|^(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}$/i.test(macAddress)) {
    errors.push('MAC address must use a valid colon, hyphen, or dotted format');
  }
  if ([location, campus, building, room].some((value) => value.length > 255)) errors.push('Location fields must be 255 characters or fewer');
  if (description.length > 10000) errors.push('Description must be 10,000 characters or fewer');

  const purchaseDate = parseDate(body.purchaseDate, 'Purchase date', errors);
  const warrantyExpiry = parseDate(body.warrantyExpiry, 'Warranty expiry', errors);
  if (purchaseDate && warrantyExpiry && warrantyExpiry < purchaseDate) {
    errors.push('Warranty expiry cannot precede purchase date');
  }

  const assignedToId = body.assignedToId === '' || body.assignedToId === null || body.assignedToId === undefined
    ? null
    : Number(body.assignedToId);
  if (assignedToId !== null && (!Number.isInteger(assignedToId) || assignedToId < 1)) {
    errors.push('Assignment must reference a valid user');
  }

  return {
    errors,
    assignedToId,
    values: {
      name,
      category: type,
      assetCode: assetTag,
      serialNumber,
      status,
      condition,
      description,
      location,
      purchaseDate,
      warrantyExpiry,
      specifications: {
        ...currentSpecifications,
        ipAddress,
        macAddress,
        campus,
        building,
        room,
      },
    },
  };
};

const getNetworkEquipment = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return requestError(res, 'A valid equipment ID is required');
    const asset = await Asset.findOne({
      where: { id, ...networkWhere(req) },
      include: locationIncludes,
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Network equipment not found' });
    const assignment = await Assignment.findOne({
      where: { assetId: id, status: 'active' },
      include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
    });
    return res.json({ success: true, data: serialize(asset, assignment) });
  } catch (error) {
    return next(error);
  }
};

const listNetworkEquipment = async (req, res, next) => {
  try {
    const where = networkWhere(req);
    const search = String(req.query.search || '').trim().slice(0, 150);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const sortFields = {
      name: 'name',
      assetTag: 'assetCode',
      serialNumber: 'serialNumber',
      type: 'category',
      status: 'status',
      condition: 'condition',
      location: 'location',
      purchaseDate: 'purchaseDate',
      updatedAt: 'updatedAt',
    };
    const sortBy = sortFields[String(req.query.sortBy || '')] || 'updatedAt';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const and = [];

    if (search) {
      and.push({
        [Op.or]: [
          ...['name', 'assetCode', 'serialNumber', 'category', 'location', 'description']
            .map((field) => ({ [field]: { [Op.like]: `%${search}%` } })),
          sequelize.where(
            fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col('specifications'), '$.ipAddress')),
            { [Op.like]: `%${search}%` },
          ),
          sequelize.where(
            fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col('specifications'), '$.macAddress')),
            { [Op.like]: `%${search}%` },
          ),
        ],
      });
    }
    if (req.query.type) where.category = { [Op.like]: `%${String(req.query.type).trim().slice(0, 100)}%` };
    if (req.query.status) where.status = normalized(req.query.status);
    if (req.query.condition) where.condition = normalized(req.query.condition);
    if (req.query.location) {
      const locationSearch = `%${String(req.query.location).trim().slice(0, 150)}%`;
      and.push({
        [Op.or]: [
          { location: { [Op.like]: locationSearch } },
          ...['campus', 'building', 'room'].map((key) => sequelize.where(
            fn('JSON_UNQUOTE', fn('JSON_EXTRACT', col('specifications'), `$.${key}`)),
            { [Op.like]: locationSearch },
          )),
        ],
      });
    }

    const activeAssignments = await Assignment.findAll({
      where: { status: 'active' },
      include: [{ model: Asset, where: networkWhere(req), attributes: [], required: true }],
      attributes: ['assetId'],
      raw: true,
    });
    const assignedIdSet = new Set(activeAssignments.map((item) => Number(item.assetId)));
    if (['assigned', 'unassigned'].includes(req.query.assignmentStatus)) {
      const statusAssignedRows = await Asset.findAll({
        where: {
          ...networkWhere(req),
          status: { [Op.in]: ['assigned', 'in-use', 'issued', 'allocated'] },
        },
        attributes: ['id'],
        raw: true,
      });
      statusAssignedRows.forEach((asset) => assignedIdSet.add(Number(asset.id)));
    }
    const assignedIds = [...assignedIdSet];
    if (req.query.assignmentStatus === 'assigned') {
      where.id = { [Op.in]: assignedIds.length ? assignedIds : [-1] };
    } else if (req.query.assignmentStatus === 'unassigned') {
      where.id = { [Op.notIn]: assignedIds.length ? assignedIds : [-1] };
    }
    if (and.length) where[Op.and] = and;

    const [result, summaryRows, users] = await Promise.all([
      Asset.findAndCountAll({
        where,
        include: locationIncludes,
        order: [[sortBy, sortOrder], ['id', 'ASC']],
        limit,
        offset: (page - 1) * limit,
      }),
      Asset.findAll({ where: networkWhere(req), attributes: ['id', 'status'], raw: true }),
      User.findAll({
        where: {
          active: true,
          ...(req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId }),
        },
        attributes: ['id', 'username', 'fullName'],
        order: [['fullName', 'ASC']],
      }),
    ]);
    const pageIds = result.rows.map((asset) => asset.id);
    const assignments = pageIds.length ? await Assignment.findAll({
      where: { assetId: { [Op.in]: pageIds }, status: 'active' },
      include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
    }) : [];
    const assignmentByAsset = new Map(assignments.map((assignment) => [assignment.assetId, assignment]));
    const assignedSet = new Set(assignedIds);
    const summary = summaryRows.reduce((counts, asset) => {
      const status = normalized(asset.status);
      counts.total += 1;
      if (assignedSet.has(Number(asset.id)) || ['assigned', 'in-use', 'issued', 'allocated'].includes(status)) {
        counts.assigned += 1;
      } else if (['maintenance', 'under-maintenance', 'in-maintenance'].includes(status)) {
        counts.maintenance += 1;
      } else if (['active', 'available', 'ready', 'idle', 'new'].includes(status)) {
        counts.active += 1;
      } else {
        counts.repair += 1;
      }
      return counts;
    }, { total: 0, active: 0, assigned: 0, maintenance: 0, repair: 0 });

    return res.json({
      success: true,
      data: result.rows.map((asset) => serialize(asset, assignmentByAsset.get(asset.id))),
      summary,
      options: {
        types: EQUIPMENT_TYPES,
        statuses: STATUSES,
        conditions: CONDITIONS,
        users: users.map((user) => ({ id: user.id, label: user.fullName || user.username })),
      },
      pagination: { page, limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const syncAssignment = async (asset, assignedToId, req, transaction) => {
  const current = await Assignment.findOne({
    where: { assetId: asset.id, status: 'active' },
    transaction,
  });
  if (assignedToId && Number(current?.assignedTo) === assignedToId) return;
  if (current) {
    await current.update({ status: 'returned', returnedAt: new Date() }, { transaction });
  }
  if (!assignedToId) return;

  const targetWhere = { id: assignedToId, active: true };
  if (req.user.role !== 'admin') targetWhere.collegeId = req.organizationScope.collegeId;
  const user = await User.findOne({ where: targetWhere, transaction });
  if (!user) {
    const error = new Error('The selected assignee is unavailable in your authorized college');
    error.statusCode = 422;
    throw error;
  }
  await Assignment.create({
    assetId: asset.id,
    assignedTo: user.id,
    assignedToType: 'user',
    assignedBy: req.user.id,
    departmentId: user.departmentId || null,
    location: asset.location || '',
    conditionAtAssignment: asset.condition || '',
    status: 'active',
    workflowStatus: 'assigned',
    notes: 'Network equipment assignment',
  }, { transaction });
};

const createNetworkEquipment = async (req, res, next) => {
  try {
    const { errors, values, assignedToId } = validateBody(req.body || {});
    if (errors.length) return requestError(res, errors.join('. '));
    const collegeId = req.user.role === 'admin'
      ? (req.body.collegeId ? Number(req.body.collegeId) : req.user.collegeId || null)
      : req.organizationScope.collegeId;
    if (req.user.role === 'admin' && req.body.collegeId && (!Number.isInteger(collegeId) || collegeId < 1)) {
      return requestError(res, 'College ID must be a valid positive integer');
    }

    const result = await sequelize.transaction(async (transaction) => {
      const asset = await Asset.create({
        ...values,
        collegeId,
        createdBy: req.user.id,
        quantity: 1,
      }, { transaction });
      await syncAssignment(asset, assignedToId, req, transaction);
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'NETWORK_EQUIPMENT_CREATED',
        entity: `asset:${asset.id}`,
        newValue: asset.toJSON(),
        transaction,
      });
      return asset;
    });
    const assignment = assignedToId ? await Assignment.findOne({
      where: { assetId: result.id, status: 'active' },
      include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
    }) : null;
    return res.status(201).json({ success: true, data: serialize(result, assignment) });
  } catch (error) {
    if (error.statusCode) return requestError(res, error.message, error.statusCode);
    return next(error);
  }
};

const updateNetworkEquipment = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return requestError(res, 'A valid equipment ID is required');
    const asset = await Asset.findOne({ where: { id, ...networkWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Network equipment not found' });
    const { errors, values, assignedToId } = validateBody(req.body || {}, readSpecifications(asset.specifications));
    if (errors.length) return requestError(res, errors.join('. '));
    const oldValue = asset.toJSON();

    const updated = await sequelize.transaction(async (transaction) => {
      await asset.update(values, { transaction });
      await syncAssignment(asset, assignedToId, req, transaction);
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'NETWORK_EQUIPMENT_UPDATED',
        entity: `asset:${asset.id}`,
        oldValue,
        newValue: asset.toJSON(),
        transaction,
      });
      return asset;
    });
    const assignment = await Assignment.findOne({
      where: { assetId: id, status: 'active' },
      include: [{ model: User, attributes: ['id', 'username', 'fullName'] }],
    });
    return res.json({ success: true, data: serialize(updated, assignment) });
  } catch (error) {
    if (error.statusCode) return requestError(res, error.message, error.statusCode);
    return next(error);
  }
};

const deleteNetworkEquipment = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return requestError(res, 'A valid equipment ID is required');
    const asset = await Asset.findOne({ where: { id, ...networkWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Network equipment not found' });
    await sequelize.transaction(async (transaction) => {
      await syncAssignment(asset, null, req, transaction);
      await asset.destroy({ transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'NETWORK_EQUIPMENT_DELETED',
        entity: `asset:${asset.id}`,
        oldValue: asset.toJSON(),
        transaction,
      });
    });
    return res.json({ success: true, message: 'Network equipment deleted' });
  } catch (error) {
    if (error.statusCode) return requestError(res, error.message, error.statusCode);
    return next(error);
  }
};

module.exports = {
  listNetworkEquipment,
  getNetworkEquipment,
  createNetworkEquipment,
  updateNetworkEquipment,
  deleteNetworkEquipment,
};
