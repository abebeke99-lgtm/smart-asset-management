const { Op, fn, col } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { sequelize, Approval, Asset, Assignment, AuditLog, Inventory, InventoryTransaction, Category, Campus, College, Department, Building, Room, Incident, IncidentHistory, Maintenance, MaintenanceHistory, Notification, PreventiveMaintenance, RFIDLog, RfidDevice, RequestStatusHistory, ServiceRequest, SoftwareLicense, Transfer, User, AssetDocument } = require('../models');
const { createAuditLog } = require('../services/auditLogService');
const { getRecoveryDays } = require('../services/assetRetentionService');
const { nextDigitalId, buildAssetCodeFromConfig } = require('./assetExtendedController');
const { equipmentTerms, networkTerms, equipmentCategoryTermsByName, equipmentPredicate, networkPredicate } = require('../utils/ictAssetFilters');

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_DOC_SIZE = 10 * 1024 * 1024;
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

const saveIctDocument = ({ fileName = '', mimeType = '', data = '' }, subdir) => {
  const mime = String(mimeType || '').split(';')[0].trim();
  if (!ALLOWED_DOC_TYPES.includes(mime)) {
    const error = new Error(`Unsupported file type: ${mime || 'unknown'}. Allowed: PDF, JPG, PNG, WEBP.`);
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_DOC_SIZE) {
    const error = new Error('File is empty or exceeds the 10 MB limit');
    error.statusCode = 400;
    throw error;
  }
  const ext = String(fileName).split('.').pop() || (mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] || 'bin');
  const storedName = `${Date.now()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}.${ext}`;
  const dir = path.join(uploadRoot, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, storedName), buffer);
  return { originalName: String(fileName || storedName), storedName, mimeType: mime, fileSize: buffer.length, filePath: path.posix.join('uploads', subdir, storedName) };
};

const scopeWhere = (req) => req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId };

const equipmentWhere = (req) => ({ ...scopeWhere(req), ...equipmentPredicate() });
const networkWhere = (req) => ({ ...scopeWhere(req), ...networkPredicate() });
const equipmentLocationIncludes = [
  { model: College, attributes: ['id', 'collegeName'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false },
  { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName'], required: false },
  { model: Building, as: 'BuildingRecord', attributes: ['id', 'buildingName', 'buildingCode'], required: false },
  { model: Room, as: 'RoomRecord', attributes: ['id', 'roomName', 'roomCode'], required: false },
];
const equipmentCategories = ['Computing', 'Networking', 'Printing', 'Display', 'Power', 'Storage', 'Communication'];
const equipmentStatuses = ['Available', 'Assigned', 'Under Maintenance', 'In Transit', 'Retired', 'Disposed'];
const equipmentConditions = ['Functional', 'Needs Repair', 'Damaged', 'Missing', 'Expired', 'Replaced'];
const validDate = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const equipmentInputError = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });
const equipmentPayload = (body = {}) => ({
  name: String(body.name || '').trim(),
  category: String(body.category || '').trim(),
  serialNumber: String(body.serialNumber || '').trim(),
  quantity: Number(body.quantity),
  campusId: Number(body.campusId),
  collegeId: body.collegeId ? Number(body.collegeId) : null,
  departmentId: body.departmentId ? Number(body.departmentId) : null,
  buildingId: body.buildingId ? Number(body.buildingId) : null,
  roomId: body.roomId ? Number(body.roomId) : null,
  status: String(body.status || '').trim(),
  condition: String(body.condition || '').trim(),
  purchaseDate: body.purchaseDate || null,
  purchasePrice: body.purchasePrice === '' || body.purchasePrice === undefined
    ? (body.purchaseCost === undefined ? 0 : Number(body.purchaseCost))
    : Number(body.purchasePrice),
  warrantyExpiry: body.warrantyExpiry || null,
  description: String(body.description || '').trim(),
});
const validateEquipmentPayload = (input, { creating, current = null } = {}) => {
  if (creating || input.name !== undefined) {
    if (!input.name) throw equipmentInputError('Asset name is required');
    if (input.name.length > 255) throw equipmentInputError('Asset name must be 255 characters or fewer');
  }
  if (creating || input.category !== undefined) {
    if (!equipmentCategories.includes(input.category)) throw equipmentInputError('Select a valid equipment category');
  }
  if (creating || input.quantity !== undefined) {
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw equipmentInputError('Quantity must be a positive whole number');
  }
  if (creating || input.campusId !== undefined) {
    if (!Number.isSafeInteger(input.campusId) || input.campusId < 1) throw equipmentInputError('Select a campus');
  }
  for (const field of ['collegeId', 'departmentId', 'buildingId', 'roomId']) {
    if (input[field] !== undefined && input[field] !== null && (!Number.isSafeInteger(input[field]) || input[field] < 1)) {
      throw equipmentInputError(`Select a valid ${field.replace('Id', '').toLowerCase()}`);
    }
  }
  if (creating || input.status !== undefined) {
    if (!equipmentStatuses.includes(input.status)) throw equipmentInputError('Select a valid equipment status');
  }
  if (creating || input.condition !== undefined) {
    if (!equipmentConditions.includes(input.condition)) throw equipmentInputError('Select a valid equipment condition');
  }
  if (input.serialNumber !== undefined && input.serialNumber.length > 255) throw equipmentInputError('Serial number must be 255 characters or fewer');
  if (input.description !== undefined && input.description.length > 10000) throw equipmentInputError('Description must be 10,000 characters or fewer');
  if (input.purchasePrice !== undefined && (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0)) {
    throw equipmentInputError('Purchase cost must be a non-negative number');
  }
  for (const field of ['purchaseDate', 'warrantyExpiry']) {
    if (input[field] !== undefined && !validDate(input[field])) throw equipmentInputError(`${field === 'purchaseDate' ? 'Purchase date' : 'Warranty expiry'} must be a valid date`);
  }
  const purchaseDate = input.purchaseDate ?? current?.purchaseDate;
  const warrantyExpiry = input.warrantyExpiry ?? current?.warrantyExpiry;
  if (purchaseDate && warrantyExpiry && new Date(warrantyExpiry) < new Date(purchaseDate)) {
    throw equipmentInputError('Warranty expiry cannot precede purchase date');
  }
};
const resolveEquipmentLocations = async (req, values, transaction) => {
  const scopeCollegeId = req.user.role === 'admin' ? null : Number(req.organizationScope.collegeId);
  const collegeId = values.collegeId || scopeCollegeId;
  if (scopeCollegeId && collegeId !== scopeCollegeId) {
    throw equipmentInputError('College is outside your authorized scope', 403);
  }
  const [campus, college, department, building, room] = await Promise.all([
    Campus.findOne({ where: { id: values.campusId, status: 'active' }, transaction }),
    collegeId ? College.findOne({ where: { id: collegeId, status: 'active' }, transaction }) : null,
    values.departmentId ? Department.findOne({ where: { id: values.departmentId, status: 'active' }, transaction }) : null,
    values.buildingId ? Building.findOne({ where: { id: values.buildingId, status: 'active' }, transaction }) : null,
    values.roomId ? Room.findOne({ where: { id: values.roomId, status: 'active' }, transaction }) : null,
  ]);
  if (!campus) throw equipmentInputError('Select an active campus');
  if (collegeId && !college) throw equipmentInputError('Select a valid college');
  if (values.departmentId && !department) throw equipmentInputError('Select a valid department');

  if (college?.campusId && Number(college.campusId) !== Number(campus.id)) {
    throw equipmentInputError('College must belong to the selected campus');
  }
  if (department && !collegeId && req.user.role === 'admin') {
    throw equipmentInputError('Select the college that owns the department');
  }
  if (values.buildingId && !building) throw equipmentInputError('Select a valid building');
  if (building && Number(building.campusId) !== Number(campus.id)) {
    throw equipmentInputError('Building must belong to the selected campus');
  }
  if (values.roomId && !room) throw equipmentInputError('Select a valid room');
  if (room && (!building || Number(room.buildingId) !== Number(building.id) || Number(room.campusId || building.campusId) !== Number(campus.id))) {
    throw equipmentInputError('Room must belong to the selected building and campus');
  }
  if (department && collegeId && Number(department.collegeId) !== Number(collegeId)) {
    throw equipmentInputError('Department must belong to the selected college');
  }
  return {
    campus,
    college,
    department,
    building,
    room,
    collegeId: collegeId || department?.collegeId || null,
  };
};
const ictTerms = [...new Set([...equipmentTerms, ...networkTerms, 'ict'])];
const ictAssetWhere = (req) => ({
  ...scopeWhere(req),
  [Op.or]: ictTerms.flatMap((term) => [
    { category: { [Op.like]: `%${term}%` } },
    { name: { [Op.like]: `%${term}%` } },
  ]),
});
const ictCategoryWhere = {
  status: 'active',
  [Op.or]: ictTerms.map((term) => ({ name: { [Op.like]: `%${term}%` } })),
};

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
const equipmentStatusForStorage = (value) => {
  const status = normalizeStatus(value);
  return status === 'assigned' ? 'in-use' : status;
};

const summarizeEquipmentStatus = (value = '') => {
  const normalized = normalizeStatus(value);
  if (['available', 'ready', 'idle', 'new'].includes(normalized)) return 'available';
  if (['assigned', 'in-use', 'in use', 'issued', 'allocated'].includes(normalized)) return 'assigned';
  if (['maintenance', 'under-maintenance', 'in-maintenance', 'in maintenance'].includes(normalized)) return 'maintenance';
  if (['repair', 'in-repair', 'under-repair', 'damaged', 'broken', 'faulty'].includes(normalized)) return 'repair';
  if (['missing', 'lost', 'stolen'].includes(normalized)) return 'missing';
  if (['retired', 'disposed', 'decommissioned'].includes(normalized)) return 'retired';
  return normalized || 'unknown';
};

const incidentInclude = [
  { model: User, as: 'Reporter', attributes: ['id', 'fullName', 'username', 'collegeId'], required: false },
  { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username'], required: false },
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'collegeId'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'collegeId'], required: false },
];

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

const serialize = (asset, assignment) => {
  const data = asset && typeof asset.toJSON === 'function' ? asset.toJSON() : (asset || {});
  return {
    ...data,
    assetTag: data.assetCode || data.assetTag || null,
    assignedTo: assignment?.User?.fullName || assignment?.User?.username || null,
    assignedToId: assignment?.assignedTo || null,
    assignmentId: assignment?.id || null,
    assignmentStatus: assignment ? 'assigned' : 'unassigned',
  };
};

const listIctAssets = async (req, res, next) => {
  try {
    const where = { ...ictAssetWhere(req) };
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
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
      cost: 'purchasePrice',
      purchasePrice: 'purchasePrice',
      manufacturer: 'manufacturer',
      model: 'model',
      serialNumber: 'serialNumber',
    };
    const orderField = allowedSortFields[sortBy] || 'updatedAt';
    const orderDirection = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';
    const andFilters = [];
    const scopedAssignmentAsset = [{ model: Asset, where: ictAssetWhere(req), attributes: [], required: true }];

    if (req.query.category) where.category = req.query.category;
    if (req.query.status) where.status = req.query.status;
    if (req.query.condition) where.condition = req.query.condition;
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    if (req.query.department) where.department = req.query.department;
    if (search) {
      const users = await User.findAll({ where: { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] });
      const assignments = users.length ? await Assignment.findAll({ where: { assignedTo: { [Op.in]: users.map((user) => user.id) }, status: 'active' }, attributes: ['assetId'], include: scopedAssignmentAsset }) : [];
      const searchFilters = ['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'supplier', 'department', 'location']
        .map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
      if (/^\d+$/.test(search)) searchFilters.push({ id: Number(search) });
      searchFilters.push({ id: { [Op.in]: assignments.map((assignment) => assignment.assetId) } });
      andFilters.push({ [Op.or]: searchFilters });
    }
    if (req.query.assignmentStatus === 'assigned' || req.query.assignmentStatus === 'unassigned') {
      const assignedIds = (await Assignment.findAll({ where: { status: 'active' }, attributes: ['assetId'], include: scopedAssignmentAsset })).map((item) => item.assetId);
      andFilters.push({ id: req.query.assignmentStatus === 'assigned' ? { [Op.in]: assignedIds } : { [Op.notIn]: assignedIds.length ? assignedIds : [0] } });
    }
    const statusTab = String(req.query.statusTab || '').trim().toLowerCase();
    const statusGroups = {
      assigned: ['assigned', 'in-use'],
      available: ['available', 'ready', 'idle', 'new'],
      maintenance: ['maintenance', 'under-maintenance', 'under maintenance', 'in-maintenance', 'in maintenance'],
      missing: ['missing', 'lost'],
    };
    if (statusGroups[statusTab]) {
      const tabFilters = [{ status: { [Op.in]: statusGroups[statusTab] } }];
      if (statusTab === 'assigned') {
        const assignedIds = (await Assignment.findAll({ where: { status: 'active' }, attributes: ['assetId'], include: scopedAssignmentAsset })).map((item) => item.assetId);
        if (assignedIds.length) tabFilters.push({ id: { [Op.in]: assignedIds } });
      }
      andFilters.push({ [Op.or]: tabFilters });
    }
    if (andFilters.length) where[Op.and] = andFilters;
    const { count, rows } = await Asset.findAndCountAll({ where, order: [[orderField, orderDirection]], limit, offset: (page - 1) * limit });
    const assignments = await Assignment.findAll({ where: { assetId: { [Op.in]: rows.map((asset) => asset.id) }, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] });
    const summaryRows = await Asset.findAll({ where: ictAssetWhere(req), attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((result, row) => {
      const key = summarizeEquipmentStatus(row.status);
      if (['assigned', 'available', 'maintenance', 'missing'].includes(key)) result[key] += 1;
      return result;
    }, { total: summaryRows.length, assigned: 0, available: 0, maintenance: 0, missing: 0 });
    const pages = Math.max(1, Math.ceil(count / limit));
    res.json({ success: true, assets: rows.map((asset) => serialize(asset, assignments.find((item) => item.assetId === asset.id))), total: count, summary, pagination: { page, limit, total: count, pages, totalPages: pages } });
  } catch (error) { next(error); }
};

const listIctEquipment = async (req, res, next) => {
  try {
    const baseWhere = equipmentWhere(req);
    const search = String(req.query.search || '').trim();
    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isSafeInteger(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;
    const sortBy = String(req.query.sortBy || 'updatedAt').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
    const allowedSortFields = ['id', 'name', 'assetCode', 'category', 'serialNumber', 'quantity', 'status', 'condition', 'location', 'department', 'purchaseDate', 'warrantyExpiry', 'updatedAt'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const orderDirection = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';
    const where = { ...baseWhere };

    if (search) {
      where[Op.and] = [{ [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { manufacturer: { [Op.like]: `%${search}%` } },
        { model: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { '$College.collegeName$': { [Op.like]: `%${search}%` } },
        { '$DepartmentRecord.name$': { [Op.like]: `%${search}%` } },
        { '$CampusRecord.campusName$': { [Op.like]: `%${search}%` } },
        { '$BuildingRecord.buildingName$': { [Op.like]: `%${search}%` } },
        { '$RoomRecord.roomName$': { [Op.like]: `%${search}%` } },
      ] }];
    }
    const category = String(req.query.category || req.query.type || '').trim();
    if (category) {
      const categoryTerms = equipmentCategoryTermsByName[category.toLowerCase()] || [category];
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: categoryTerms.map((term) => ({ category: { [Op.like]: `%${term}%` } })) },
      ];
    }
    if (req.query.status) {
      const status = normalizeStatus(req.query.status);
      const statusAliases = {
        available: ['available', 'active'],
        assigned: ['assigned', 'in-use', 'in use'],
        'under-maintenance': ['under-maintenance', 'under maintenance', 'maintenance'],
        'in-transit': ['in-transit', 'in transit'],
        retired: ['retired'],
        disposed: ['disposed'],
      };
      where[Op.and] = [
        ...(where[Op.and] || []),
        sequelize.where(fn('LOWER', col('status')), { [Op.in]: statusAliases[status] || [status] }),
      ];
    }
    if (req.query.condition) {
      const condition = String(req.query.condition).trim().toLowerCase();
      const conditionAliases = {
        functional: ['functional', 'good', 'excellent'],
        'needs repair': ['needs repair', 'fair', 'poor', 'needs-repair'],
        damaged: ['damaged'],
        missing: ['missing'],
        expired: ['expired'],
        replaced: ['replaced'],
      };
      where[Op.and] = [
        ...(where[Op.and] || []),
        sequelize.where(fn('LOWER', col('condition')), { [Op.in]: conditionAliases[condition] || [condition] }),
      ];
    }
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    if (req.query.department) where.department = String(req.query.department).trim();

    const [initialResult, summaryRows] = await Promise.all([
      Asset.findAndCountAll({ where, include: equipmentLocationIncludes, distinct: true, order: [[orderField, orderDirection]], limit, offset: (page - 1) * limit }),
      Asset.findAll({ where: baseWhere, attributes: ['status'], raw: true }),
    ]);
    const totalPages = Math.max(1, Math.ceil(initialResult.count / limit));
    const currentPage = Math.min(page, totalPages);
    const result = currentPage === page
      ? initialResult
      : await Asset.findAndCountAll({
        where,
        include: equipmentLocationIncludes,
        distinct: true,
        order: [[orderField, orderDirection]],
        limit,
        offset: (currentPage - 1) * limit,
      });

    const summary = summaryRows.reduce((resultValue, row) => {
      const keyedStatus = summarizeEquipmentStatus(row.status);
      if (keyedStatus === 'available') resultValue.available += 1;
      if (keyedStatus === 'assigned') resultValue.assigned += 1;
      if (keyedStatus === 'maintenance') resultValue.maintenance += 1;
      if (keyedStatus === 'repair') resultValue.repair += 1;
      if (keyedStatus === 'missing') resultValue.missing += 1;
      if (keyedStatus === 'retired') resultValue.retired += 1;
      if (keyedStatus !== 'unknown') resultValue.total += 1;
      return resultValue;
    }, { total: 0, available: 0, assigned: 0, maintenance: 0, repair: 0, missing: 0, retired: 0 });

    const payload = {
      success: true,
      equipment: result.rows.map((asset) => serialize(asset)),
      data: result.rows.map((asset) => serialize(asset)),
      total: result.count,
      summary: { ...summary, total: result.count },
      pagination: { page: currentPage, limit, total: result.count, pages: totalPages, totalPages },
    };
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

const getIctEquipment = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, ...equipmentWhere(req) },
      include: equipmentLocationIncludes,
    });
    if (!asset) return res.status(404).json({ success: false, message: 'IT equipment not found' });
    return res.json({ success: true, equipment: serialize(asset), data: serialize(asset) });
  } catch (error) {
    return next(error);
  }
};

const listIctEquipmentOptions = async (req, res, next) => {
  try {
    const collegeWhere = req.user.role === 'admin' ? { status: 'active' } : { collegeId: req.organizationScope.collegeId, status: 'active' };
    const [colleges, departments, allCampuses, allBuildings, allRooms] = await Promise.all([
      College.findAll({ where: collegeWhere, attributes: ['id', 'collegeName', 'campusId'], order: [['collegeName', 'ASC']] }),
      Department.findAll({
        where: req.user.role === 'admin' ? { status: 'active' } : { collegeId: req.organizationScope.collegeId, status: 'active' },
        attributes: ['id', 'name', 'collegeId'],
        order: [['name', 'ASC']],
      }),
      Campus.findAll({ where: { status: 'active' }, attributes: ['id', 'campusName'], order: [['campusName', 'ASC']] }),
      Building.findAll({ where: { status: 'active' }, attributes: ['id', 'campusId', 'buildingName'], order: [['buildingName', 'ASC']] }),
      Room.findAll({ where: { status: 'active' }, attributes: ['id', 'campusId', 'buildingId', 'roomName', 'roomCode'], order: [['roomName', 'ASC']] }),
    ]);
    const allowedCampusIds = new Set(colleges.map((college) => Number(college.campusId)).filter(Boolean));
    const campuses = req.user.role === 'admin'
      ? allCampuses
      : allCampuses.filter((campus) => allowedCampusIds.has(Number(campus.id)));
    const campusIds = new Set(campuses.map((campus) => Number(campus.id)));
    const buildings = allBuildings.filter((building) => campusIds.has(Number(building.campusId)));
    const buildingIds = new Set(buildings.map((building) => Number(building.id)));
    const rooms = allRooms.filter((room) => buildingIds.has(Number(room.buildingId)));
    return res.json({
      success: true,
      campuses,
      colleges,
      departments,
      buildings,
      rooms,
      categories: equipmentCategories,
      statuses: equipmentStatuses,
      conditions: equipmentConditions,
    });
  } catch (error) {
    return next(error);
  }
};

const createIctEquipment = async (req, res, next) => {
  try {
    const values = equipmentPayload(req.body);
    validateEquipmentPayload(values, { creating: true });
    validateEquipmentPayload(values, { creating: true });
    const serialNumber = values.serialNumber;
    if (serialNumber) {
      const duplicate = await Asset.findOne({ where: { serialNumber } });
      if (duplicate) throw equipmentInputError('Serial number already exists', 409);
    }
    const result = await sequelize.transaction(async (transaction) => {
      const locations = await resolveEquipmentLocations(req, values, transaction);
      if (serialNumber) {
        const duplicate = await Asset.findOne({ where: { serialNumber }, transaction });
        if (duplicate) throw equipmentInputError('Serial number already exists', 409);
      }
      const digitalId = await nextDigitalId(transaction);
      const assetCode = await buildAssetCodeFromConfig({ category: values.category, transaction }) || digitalId;
      const status = equipmentStatusForStorage(values.status);
      const asset = await Asset.create({
        name: values.name,
        assetCode,
        digitalId,
        category: values.category,
        description: values.description,
        serialNumber,
        quantity: values.quantity,
        status,
        condition: values.condition,
        campusId: locations.campus.id,
        collegeId: locations.collegeId,
        departmentId: locations.department?.id || null,
        department: locations.department?.name || '',
        buildingId: locations.building?.id || null,
        roomId: locations.room?.id || null,
        location: locations.room?.roomName || locations.building?.buildingName || locations.campus.campusName,
        purchaseDate: values.purchaseDate,
        purchasePrice: values.purchasePrice,
        currentValue: values.purchasePrice,
        warrantyExpiry: values.warrantyExpiry,
        createdBy: req.user.id,
      }, { transaction });
      await Inventory.create({
        assetId: asset.id,
        departmentId: locations.department?.id || null,
        quantity: values.quantity,
        availableQuantity: values.quantity,
        location: asset.location,
        status,
      }, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'CREATE_ICT_EQUIPMENT',
        entity: `asset:${asset.id}`,
        entityId: asset.id,
        newValue: asset.toJSON(),
        transaction,
      });
      return Asset.findOne({ where: { id: asset.id }, include: equipmentLocationIncludes, transaction });
    });
    return res.status(201).json({ success: true, equipment: serialize(result), data: serialize(result), message: 'IT equipment created successfully' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

const updateIctEquipment = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...equipmentWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'IT equipment not found' });
    const values = equipmentPayload({ ...asset.toJSON(), ...req.body });
    validateEquipmentPayload(values, { creating: true, current: asset });
    validateEquipmentPayload(values, { creating: true, current: asset });
    if (values.serialNumber && values.serialNumber !== asset.serialNumber) {
      const duplicate = await Asset.findOne({ where: { id: { [Op.ne]: asset.id }, serialNumber: values.serialNumber } });
      if (duplicate) throw equipmentInputError('Serial number already exists', 409);
    }
    const updated = await sequelize.transaction(async (transaction) => {
      const locations = await resolveEquipmentLocations(req, values, transaction);
      const previousValue = asset.toJSON();
      const status = equipmentStatusForStorage(values.status);
      await asset.update({
        name: values.name,
        category: values.category,
        description: values.description,
        serialNumber: values.serialNumber,
        quantity: values.quantity,
        status,
        condition: values.condition,
        campusId: locations.campus.id,
        collegeId: locations.collegeId,
        departmentId: locations.department?.id || null,
        department: locations.department?.name || '',
        buildingId: locations.building?.id || null,
        roomId: locations.room?.id || null,
        location: locations.room?.roomName || locations.building?.buildingName || locations.campus.campusName,
        purchaseDate: values.purchaseDate,
        purchasePrice: values.purchasePrice,
        warrantyExpiry: values.warrantyExpiry,
      }, { transaction });
      const inventory = await Inventory.findOne({ where: { assetId: asset.id }, transaction });
      const inventoryValues = {
        departmentId: locations.department?.id || null,
        quantity: values.quantity,
        availableQuantity: inventory
          ? Math.max(0, Number(inventory.availableQuantity) + values.quantity - Number(inventory.quantity))
          : values.quantity,
        location: asset.location,
        status,
      };
      if (inventory) await inventory.update(inventoryValues, { transaction });
      else await Inventory.create({ assetId: asset.id, ...inventoryValues }, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'UPDATE_ICT_EQUIPMENT',
        entity: `asset:${asset.id}`,
        entityId: asset.id,
        oldValue: previousValue,
        newValue: asset.toJSON(),
        transaction,
      });
      return Asset.findOne({ where: { id: asset.id }, include: equipmentLocationIncludes, transaction });
    });
    return res.json({ success: true, equipment: serialize(updated), data: serialize(updated), message: 'IT equipment updated successfully' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

const deleteIctEquipment = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...equipmentWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'IT equipment not found' });
    await sequelize.transaction(async (transaction) => {
      const previousValue = asset.toJSON();
      const recoveryDays = await getRecoveryDays();
      const deletedAt = new Date();
      await asset.update({
        deletedBy: req.user.id,
        status: 'deleted',
        specifications: {
          ...(asset.specifications && typeof asset.specifications === 'object' ? asset.specifications : {}),
          recoveryInfo: { previousStatus: asset.status, deletedAt: deletedAt.toISOString(), recoveryDays },
        },
      }, { transaction });
      await asset.destroy({ transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'DELETE_ICT_EQUIPMENT',
        entity: `asset:${asset.id}`,
        entityId: asset.id,
        oldValue: previousValue,
        newValue: asset.toJSON(),
        details: { recoveryDays },
        transaction,
      });
    });
    return res.json({ success: true, message: 'IT equipment deleted successfully' });
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
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const { VerificationItem, Transfer } = require('../models');
    const [assignment, maintenance, history, verification, assignmentHistory, transfers] = await Promise.all([
      Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] }),
      Maintenance.findAll({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']], limit: 10 }),
      AuditLog.findAll({ where: { entity: `asset:${asset.id}` }, order: [['createdAt', 'DESC']], limit: 20 }),
      VerificationItem.findAll({ where: { assetId: asset.id }, order: [['updatedAt', 'DESC']], limit: 10 }),
      Assignment.findAll({ where: { assetId: asset.id }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }], order: [['createdAt', 'DESC']], limit: 10 }),
      Transfer.findAll({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']], limit: 10 }),
    ]);
    res.json({ success: true, asset: serialize(asset, assignment), data: serialize(asset, assignment), maintenance, history, verification, assignmentHistory, transfers });
  } catch (error) { next(error); }
};

const retireIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });

    const reason = String(req.body?.reason || req.query?.reason || 'Retired from IT equipment module').trim();
    const previousValue = asset.toJSON();
    await asset.update({ status: 'retired', notes: reason ? `${asset.notes || ''}\n${reason}`.trim() : asset.notes || '' });
    await AuditLog.create({
      userId: req.user.id,
      action: 'RETIRE_ICT_ASSET',
      entity: `asset:${asset.id}`,
      details: JSON.stringify({ previousValue, newValue: asset.toJSON(), reason })
    });

    return res.json({ success: true, asset: serialize(asset), data: serialize(asset), message: 'Asset retired successfully' });
  } catch (error) {
    return next(error);
  }
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
    await asset.update({ rfidTag: null });
    await RFIDLog.create({ assetId: asset.id, tag: previousValue, action: 'unlink', location: asset.location || '', notes: `RFID tag unassigned by user ${req.user.id}` });
    await AuditLog.create({ userId: req.user.id, action: 'RFID_TAG_UNASSIGNED', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue }) });
    return res.json({ success: true, data: trackingRow(asset, null, null) });
  } catch (error) { next(error); }
};

const updateIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const allowed = ['name', 'category', 'description', 'serialNumber', 'assetCode', 'status', 'condition', 'department', 'departmentId', 'location', 'purchaseDate', 'purchasePrice', 'supplier', 'manufacturer', 'model', 'warrantyExpiry', 'notes'];
    const updates = Object.fromEntries(allowed.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    if (updates.department !== undefined || updates.departmentId !== undefined) {
      const departmentWhere = updates.departmentId
        ? { id: Number(updates.departmentId) }
        : { name: String(updates.department || '').trim() };
      if (req.user.role !== 'admin') departmentWhere.collegeId = req.organizationScope.collegeId;
      const department = await Department.findOne({ where: departmentWhere });
      if (!department) return res.status(422).json({ success: false, message: 'Department is outside your authorized college or does not exist' });
      updates.department = department.name;
      updates.departmentId = department.id;
    }
    if (updates.category !== undefined) {
      const categoryName = String(updates.category || '').trim();
      const category = categoryName ? await Category.findOne({ where: { name: categoryName, status: 'active' } }) : null;
      if (!category || !ictTerms.some((term) => category.name.toLowerCase().includes(term))) {
        return res.status(422).json({ success: false, message: 'Select a supported ICT asset category' });
      }
      updates.category = category.name;
    }
    if (updates.name !== undefined && !String(updates.name).trim()) {
      return res.status(422).json({ success: false, message: 'Asset name is required' });
    }
    if (updates.assetCode !== undefined && !String(updates.assetCode).trim()) return res.status(422).json({ success: false, message: 'Asset code is required' });
    if (updates.purchasePrice !== undefined) {
      if (updates.purchasePrice === '') updates.purchasePrice = null;
      else if (!Number.isFinite(Number(updates.purchasePrice)) || Number(updates.purchasePrice) < 0) {
        return res.status(422).json({ success: false, message: 'Purchase cost must be a non-negative number' });
      } else updates.purchasePrice = Number(updates.purchasePrice);
    }
    for (const field of ['purchaseDate', 'warrantyExpiry']) {
      if (updates[field] === undefined) continue;
      if (!updates[field]) updates[field] = null;
      else if (Number.isNaN(Date.parse(updates[field]))) {
        return res.status(422).json({ success: false, message: `${field} must be a valid date` });
      }
    }
    const purchaseDate = updates.purchaseDate === undefined ? asset.purchaseDate : updates.purchaseDate;
    const warrantyExpiry = updates.warrantyExpiry === undefined ? asset.warrantyExpiry : updates.warrantyExpiry;
    if (purchaseDate && warrantyExpiry && new Date(warrantyExpiry) < new Date(purchaseDate)) {
      return res.status(422).json({ success: false, message: 'Warranty expiry cannot precede purchase date' });
    }
    const duplicateFields = ['assetCode', 'serialNumber'].filter((field) => updates[field] && String(updates[field]).trim());
    if (duplicateFields.length) {
      const duplicate = await Asset.findOne({
        where: {
          id: { [Op.ne]: asset.id },
          [Op.or]: duplicateFields.map((field) => ({ [field]: String(updates[field]).trim() })),
        },
      });
      if (duplicate) return res.status(409).json({ success: false, message: 'Asset code or serial number already exists' });
      duplicateFields.forEach((field) => { updates[field] = String(updates[field]).trim(); });
    }
    const previousValue = asset.toJSON();
    await asset.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_ICT_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ previousValue, newValue: asset.toJSON() }) });
    res.json({ success: true, asset: asset.toJSON() });
  } catch (error) { next(error); }
};

const createIctMaintenanceRequest = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    req.body = { ...req.body, asset_id: asset.id };
    return require('./maintenanceController').createMaintenance(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const createIctAsset = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const assetCode = String(body.assetCode || body.asset_id || '').trim();
    const serialNumber = String(body.serialNumber || body.serial_number || '').trim();
    const categoryValue = body.categoryId || body.category_id || body.category;
    const departmentValue = body.departmentId || body.department_id || body.department;
    if (!name || !categoryValue || !departmentValue) {
      return res.status(422).json({ success: false, message: 'Name, category, and department are required' });
    }

    const departmentWhere = Number.isInteger(Number(departmentValue))
      ? { id: Number(departmentValue) }
      : { name: String(departmentValue).trim() };
    if (req.user.role !== 'admin') departmentWhere.collegeId = req.organizationScope.collegeId;
    const department = await Department.findOne({ where: departmentWhere });
    if (!department) return res.status(422).json({ success: false, message: 'Select a department in your authorized college' });

    const categoryWhere = Number.isInteger(Number(categoryValue))
      ? { id: Number(categoryValue) }
      : { name: String(categoryValue).trim() };
    const category = await Category.findOne({ where: categoryWhere });
    if (!category) return res.status(422).json({ success: false, message: 'Select a valid asset category' });
    if (!ictTerms.some((term) => category.name.toLowerCase().includes(term))) {
      return res.status(422).json({ success: false, message: 'Select a supported ICT asset category' });
    }

    const duplicateFields = [
      ...(assetCode ? [{ assetCode }] : []),
      ...(serialNumber ? [{ serialNumber }] : []),
    ];
    if (duplicateFields.length) {
      const duplicate = await Asset.findOne({ where: { [Op.or]: duplicateFields } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Asset code or serial number already exists' });
    }

    const purchasePrice = body.purchasePrice ?? body.purchase_cost ?? 0;
    if (!Number.isFinite(Number(purchasePrice)) || Number(purchasePrice) < 0) {
      return res.status(422).json({ success: false, message: 'Purchase cost must be a non-negative number' });
    }
    const purchaseDate = body.purchaseDate || body.purchase_date || null;
    const warrantyExpiry = body.warrantyExpiry || body.warranty_expiry || null;
    if ((purchaseDate && Number.isNaN(Date.parse(purchaseDate))) || (warrantyExpiry && Number.isNaN(Date.parse(warrantyExpiry)))) {
      return res.status(422).json({ success: false, message: 'Purchase and warranty dates must be valid dates' });
    }
    if (purchaseDate && warrantyExpiry && new Date(warrantyExpiry) < new Date(purchaseDate)) {
      return res.status(422).json({ success: false, message: 'Warranty expiry cannot precede purchase date' });
    }
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(422).json({ success: false, message: 'Quantity must be a positive integer' });
    }

    req.body = {
      ...body,
      name,
      assetCode,
      serialNumber,
      category: category.name,
      department: department.name,
      departmentId: department.id,
      collegeId: req.user.role === 'admin' ? department.collegeId : req.organizationScope.collegeId,
      quantity,
    };
    return require('./assetController').createAsset(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const getIctOptions = async (req, res, next) => {
  try {
    const [categories, departments, statuses, conditions] = await Promise.all([
      Category.findAll({ where: ictCategoryWhere, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Department.findAll({ where: req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId, status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ where: ictAssetWhere(req), attributes: [[Asset.sequelize.fn('DISTINCT', Asset.sequelize.col('status')), 'value']], raw: true }),
      Asset.findAll({ where: ictAssetWhere(req), attributes: [[Asset.sequelize.fn('DISTINCT', Asset.sequelize.col('condition')), 'value']], raw: true }),
    ]);
    res.json({ success: true, categories, departments, statuses: statuses.map((item) => item.value).filter(Boolean), conditions: conditions.map((item) => item.value).filter(Boolean) });
  } catch (error) { next(error); }
};

const getIctDashboard = async (req, res, next) => {
  try {
    await sequelize.authenticate();
    const isAdmin = req.user.role === 'admin';
    const collegeId = req.organizationScope?.collegeId ?? req.user?.collegeId;
    const departments = isAdmin ? [] : await Department.findAll({ where: { collegeId }, attributes: ['id'], raw: true });
    const departmentIds = departments.map((department) => department.id);
    const assetScope = {
      ...scopeWhere(req),
      [Op.or]: [...equipmentTerms, ...networkTerms].flatMap((term) => [
        { category: { [Op.like]: `%${term}%` } },
        { name: { [Op.like]: `%${term}%` } },
      ]),
    };
    const organizationScope = isAdmin ? {} : {
      [Op.or]: [
        { collegeId },
        ...(departmentIds.length ? [{ departmentId: { [Op.in]: departmentIds } }] : []),
      ],
    };
    const approvalScope = isAdmin ? {} : { departmentId: { [Op.in]: departmentIds.length ? departmentIds : [-1] } };
    const notificationScope = isAdmin ? {} : {
      [Op.or]: [
        { userId: req.user.id },
        { recipientId: req.user.id },
        {
          collegeId,
          [Op.or]: [
            { role: 'ict_officer' },
            { type: { [Op.like]: '%ict%' } },
            { category: { [Op.like]: '%ict%' } },
            { entityType: { [Op.in]: ['asset', 'maintenance', 'incident', 'service_request'] } },
          ],
        },
      ],
    };
    const [assetIdsRows, assetStatusRows, assetCategoryRows, recentAssets] = await Promise.all([
      Asset.findAll({ where: assetScope, attributes: ['id'], raw: true }),
      Asset.findAll({ where: assetScope, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Asset.findAll({ where: assetScope, attributes: ['category', [fn('COUNT', col('id')), 'count']], group: ['category'], order: [[fn('COUNT', col('id')), 'DESC']], raw: true }),
      Asset.findAll({ where: assetScope, order: [['createdAt', 'DESC']], limit: 30 }),
    ]);
    const assetIds = assetIdsRows.map((asset) => asset.id);
    const assetIdScope = { assetId: { [Op.in]: assetIds.length ? assetIds : [-1] } };
    const incidentScope = isAdmin ? {} : {
      [Op.or]: [
        ...(assetIds.length ? [{ assetId: { [Op.in]: assetIds } }] : []),
        ...(departmentIds.length ? [{ departmentId: { [Op.in]: departmentIds } }] : []),
        ...(!assetIds.length && !departmentIds.length ? [{ id: -1 }] : []),
      ],
    };
    const organizationScopeForLicenses = isAdmin ? {} : {
      [Op.or]: [
        { collegeId },
        ...(departmentIds.length ? [{ departmentId: { [Op.in]: departmentIds } }] : []),
      ],
    };
    const pendingApprovalWhere = { status: 'pending', ...approvalScope };
    const pendingServiceWhere = {
      ...organizationScope,
      status: { [Op.in]: ['submitted', 'pending'] },
      requestType: { [Op.notIn]: ['support', 'incident'] },
    };
    const openTicketStatuses = ['open', 'assigned', 'in-progress', 'pending-user', 'pending-parts'];
    const openIncidentStatuses = ['new', 'assigned', 'investigating', 'in_progress', 'pending', 'escalated'];
    const now = new Date();
    const maintenanceWindowEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    const today = now.toISOString().slice(0, 10);
    const ninetyDaysFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const upcomingMaintenanceWhere = {
      ...assetIdScope,
      status: { [Op.notIn]: ['completed', 'skipped', 'cancelled'] },
      [Op.or]: [
        { scheduleDate: { [Op.between]: [now, maintenanceWindowEnd] } },
        { nextScheduleDate: { [Op.between]: [now, maintenanceWindowEnd] } },
      ],
    };
    const licenseWhere = {
      ...organizationScopeForLicenses,
      status: { [Op.notIn]: ['expired', 'revoked', 'cancelled'] },
      expiryDate: { [Op.between]: [today, ninetyDaysFromNow] },
    };
    const [activeAssignmentCount, pendingApprovalCount, pendingServiceCount, openSupportTicketCount, openIncidentCount, expiringLicenseCount, upcomingMaintenanceCount, approvals, pendingServiceRequests, notifications, supportTicketRows, incidentRows, upcomingMaintenanceRows, activeAssignments, maintenanceRows, recentIncidentRows, recentServiceRequests] = await Promise.all([
      Assignment.count({ distinct: true, col: 'asset_id', where: { ...assetIdScope, status: 'active' } }),
      Approval.count({ where: pendingApprovalWhere }),
      ServiceRequest.count({ where: pendingServiceWhere }),
      ServiceRequest.count({ where: { ...organizationScope, requestType: 'support', status: { [Op.in]: openTicketStatuses } } }),
      Incident.count({ where: { ...incidentScope, status: { [Op.in]: openIncidentStatuses } } }),
      SoftwareLicense.count({ where: licenseWhere }),
      PreventiveMaintenance.count({ where: upcomingMaintenanceWhere }),
      Approval.findAll({ where: pendingApprovalWhere, include: [{ model: Asset, attributes: ['id', 'name', 'category'] }, { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] }, { model: Department, attributes: ['id', 'name'] }], order: [['createdAt', 'DESC']], limit: 12 }),
      ServiceRequest.findAll({ where: pendingServiceWhere, include: [{ model: User, as: 'Reporter', attributes: ['id', 'username', 'fullName'] }, { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] }, { model: Asset, attributes: ['id', 'name', 'category'] }], order: [['createdAt', 'DESC']], limit: 12 }),
      Notification.findAll({ where: notificationScope, attributes: ['id', 'title', 'message', 'type', 'priority', 'status', 'read', 'createdAt', 'actionUrl', 'entityType', 'entityId'], order: [['createdAt', 'DESC']], limit: 10 }),
      ServiceRequest.findAll({ where: { ...organizationScope, requestType: 'support', status: { [Op.in]: openTicketStatuses } }, attributes: ['id', 'requestCode', 'title', 'status', 'priority', 'createdAt'], order: [['createdAt', 'DESC']], limit: 10 }),
      Incident.findAll({ where: { ...incidentScope, status: { [Op.in]: openIncidentStatuses } }, order: [['createdAt', 'DESC']], limit: 10 }),
      PreventiveMaintenance.findAll({ where: upcomingMaintenanceWhere, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'] }], order: [['scheduleDate', 'ASC']], limit: 10 }),
      Assignment.findAll({ where: { ...assetIdScope, status: 'active' }, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'] }, { model: User, attributes: ['id', 'username', 'fullName'] }], order: [['createdAt', 'DESC']], limit: 20 }),
      Maintenance.findAll({ where: assetIdScope, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'] }], order: [['createdAt', 'DESC']], limit: 20 }),
      Incident.findAll({ where: incidentScope, include: incidentInclude, attributes: ['id', 'title', 'createdAt'], order: [['createdAt', 'DESC']], limit: 30 }),
      ServiceRequest.findAll({ where: organizationScope, attributes: ['id', 'requestCode', 'requestType', 'title', 'createdAt'], order: [['createdAt', 'DESC']], limit: 30 }),
    ]);
    const lifecycleRequestIds = recentServiceRequests.map((request) => request.id);
    const [incidentHistoryRows, maintenanceHistoryRows, requestStatusHistoryRows] = await Promise.all([
      recentIncidentRows.length ? IncidentHistory.findAll({ where: { incidentId: { [Op.in]: recentIncidentRows.map((incident) => incident.id) } }, order: [['createdAt', 'DESC']], limit: 30 }) : [],
      assetIds.length ? MaintenanceHistory.findAll({ where: { assetId: { [Op.in]: assetIds } }, order: [['actionDate', 'DESC']], limit: 30 }) : [],
      lifecycleRequestIds.length ? RequestStatusHistory.findAll({ where: { requestId: { [Op.in]: lifecycleRequestIds } }, order: [['createdAt', 'DESC']], limit: 30 }) : [],
    ]);
    const auditLogs = assetIds.length
      ? await AuditLog.findAll({ where: { entity: { [Op.in]: assetIds.map((id) => `asset:${id}`) } }, order: [['createdAt', 'DESC']], limit: 40 })
      : [];
    const countForStatus = (statuses) => assetStatusRows.reduce((total, row) => statuses.includes(normalizeStatus(row.status)) ? total + Number(row.count || 0) : total, 0);
    const pendingRequests = Number(pendingApprovalCount) + Number(pendingServiceCount);
    const summary = {
      totalAssets: assetIdsRows.length,
      assignedAssets: Number(activeAssignmentCount),
      availableAssets: countForStatus(['available', 'ready', 'idle', 'new']),
      maintenanceAssets: countForStatus(['maintenance', 'under-maintenance', 'in-maintenance']),
      repairAssets: countForStatus(['repair', 'in-repair', 'under-repair', 'broken']),
      pendingRequests,
      openIncidents: Number(openIncidentCount),
      supportTickets: Number(openSupportTicketCount),
      expiringLicenses: Number(expiringLicenseCount),
      upcomingMaintenance: Number(upcomingMaintenanceCount),
      retiredAssets: countForStatus(['retired', 'disposed', 'decommissioned']),
    };
    const requests = [
      ...approvals.map((request) => ({ id: `approval-${request.id}`, requestId: request.id, requester: request.Requester?.fullName || request.Requester?.username || 'Unknown requester', department: request.Department?.name || 'Not recorded', type: 'Asset request', item: request.item || request.type, priority: request.priority, status: request.status, createdAt: request.createdAt })),
      ...pendingServiceRequests.map((request) => ({ id: `service-${request.id}`, requestId: request.requestCode, requester: request.Reporter?.fullName || request.Reporter?.username || 'Unknown requester', department: request.DepartmentRecord?.name || 'Not recorded', type: normalizeStatus(request.requestType).replace(/-/g, ' '), item: request.title, priority: request.priority, status: request.status, createdAt: request.createdAt })),
    ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 12);
    const recentActivity = [
      ...auditLogs.map((log) => {
        const details = parseAuditDetails(log.details);
        return { id: `audit-${log.id}`, kind: eventLabel(log.action), detail: details.description || log.entity, time: log.createdAt, icon: 'history' };
      }),
      ...recentAssets.filter((asset) => asset.createdAt).map((asset) => ({ id: `asset-${asset.id}`, kind: 'Asset registered', detail: asset.name || asset.assetCode, time: asset.createdAt, icon: 'package' })),
      ...activeAssignments.filter((assignment) => assignment.createdAt).map((assignment) => ({ id: `assignment-${assignment.id}`, kind: 'Asset assigned', detail: assignment.Asset?.name || `Asset #${assignment.assetId}`, time: assignment.createdAt, icon: 'user-check' })),
      ...maintenanceRows.filter((maintenance) => maintenance.createdAt).map((maintenance) => ({ id: `maintenance-${maintenance.id}`, kind: 'Maintenance created', detail: maintenance.Asset?.name || `Maintenance #${maintenance.id}`, time: maintenance.createdAt, icon: 'wrench' })),
      ...maintenanceHistoryRows.filter((entry) => entry.actionDate).map((entry) => ({ id: `maintenance-history-${entry.id}`, kind: eventLabel(entry.actionType), detail: entry.description || entry.newStatus || `Maintenance #${entry.maintenanceId || entry.assetId}`, time: entry.actionDate, icon: 'wrench' })),
      ...recentIncidentRows.filter((incident) => incident.createdAt).map((incident) => ({ id: `incident-${incident.id}`, kind: 'Incident created', detail: incident.title, time: incident.createdAt, icon: 'activity' })),
      ...incidentHistoryRows.filter((entry) => entry.createdAt).map((entry) => ({ id: `incident-history-${entry.id}`, kind: eventLabel(entry.action), detail: entry.newValue || `Incident #${entry.incidentId}`, time: entry.createdAt, icon: 'activity' })),
      ...recentServiceRequests.filter((request) => request.createdAt).map((request) => ({ id: `request-record-${request.id}`, kind: request.requestType === 'support' ? 'Support ticket created' : 'Request submitted', detail: request.title || request.requestCode, time: request.createdAt, icon: 'activity' })),
      ...requestStatusHistoryRows.filter((entry) => entry.createdAt).map((entry) => ({ id: `request-history-${entry.id}`, kind: `Request ${eventLabel(entry.newStatus)}`, detail: entry.comment || `Request #${entry.requestId}`, time: entry.createdAt, icon: 'activity' })),
      ...approvals.filter((request) => request.createdAt).map((request) => ({ id: `approval-${request.id}`, kind: 'Request submitted', detail: request.item || request.type, time: request.createdAt, icon: 'activity' })),
    ].sort((left, right) => new Date(right.time) - new Date(left.time)).slice(0, 8);
    const assetStatus = assetStatusRows.map((row) => ({ label: row.status || 'Unspecified', count: Number(row.count || 0) }));
    const assetCategories = assetCategoryRows.map((row) => ({ label: row.category || 'Uncategorized', count: Number(row.count || 0) }));
    const databaseStatus = { status: 'connected', checkedAt: new Date().toISOString() };
    const legacySummary = {
      total: summary.totalAssets,
      assigned: summary.assignedAssets,
      available: summary.availableAssets,
      maintenance: summary.maintenanceAssets,
      repair: summary.repairAssets,
      retired: summary.retiredAssets,
      pendingRequests: summary.pendingRequests,
      openSupportTickets: summary.supportTickets,
      openIncidents: summary.openIncidents,
      upcomingMaintenance: summary.upcomingMaintenance,
      expiringLicenses: summary.expiringLicenses,
    };
    const summaryPayload = {
      ...summary,
      ...legacySummary,
      totalAssets: summary.totalAssets,
      assignedAssets: summary.assignedAssets,
      availableAssets: summary.availableAssets,
      maintenanceAssets: summary.maintenanceAssets,
      repairAssets: summary.repairAssets,
      retiredAssets: summary.retiredAssets,
      pendingRequests: summary.pendingRequests,
      supportTickets: summary.supportTickets,
      openIncidents: summary.openIncidents,
      upcomingMaintenance: summary.upcomingMaintenance,
      expiringLicenses: summary.expiringLicenses,
    };

    res.json({ success: true, dashboard: {
      ...summaryPayload,
      assetStatus,
      assetCategories,
      recentActivity,
      notifications,
      requests,
      supportTicketRecords: supportTicketRows,
      incidents: incidentRows,
      upcomingMaintenanceRecords: upcomingMaintenanceRows,
      operationalOverview: { openIncidents: summary.openIncidents, upcomingMaintenance: summary.upcomingMaintenance, databaseStatus },
      databaseStatus,
      summary: summaryPayload,
      stats: legacySummary,
      assets: recentAssets,
      assignments: activeAssignments,
      maintenance: maintenanceRows,
      recentActivities: recentActivity,
      health: { success: true, database: 'connected' },
    } });
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

const globalIctSearch = async (req, res, next) => {
  try {
    const search = String(req.query.search || req.query.q || '').trim();
    if (!search) return res.json({ success: true, data: { assets: [], tickets: [], incidents: [], maintenance: [], users: [], locations: [] } });
    const like = { [Op.like]: `%${search}%` };
    const assetWhere = { ...ictAssetWhere(req), [Op.or]: [{ name: like }, { assetCode: like }, { serialNumber: like }, { digitalId: like }, { rfidTag: like }] };
    const orgScope = req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId };
    const incidentScope = req.user.role === 'admin' ? {} : {
      [Op.or]: [
        { '$Reporter.college_id$': req.organizationScope.collegeId },
        { '$Asset.college_id$': req.organizationScope.collegeId },
        { '$DepartmentRecord.college_id$': req.organizationScope.collegeId },
      ],
    };
    const [assets, tickets, incidents, maintenance, users, locations] = await Promise.all([
      Asset.findAll({ where: assetWhere, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'condition', 'location', 'department'], limit: 10 }),
      ServiceRequest.findAll({ where: { ...orgScope, requestType: 'support', [Op.or]: [{ title: like }, { requestCode: like }, { description: like }] }, attributes: ['id', 'requestCode', 'title', 'status', 'priority', 'createdAt'], limit: 10 }),
      Incident.findAll({
        where: { ...incidentScope, [Op.and]: [{ [Op.or]: [{ title: like }, { incidentNumber: like }, { description: like }] }] },
        include: incidentInclude,
        attributes: ['id', 'incidentNumber', 'title', 'status', 'priority', 'createdAt'],
        limit: 10,
        subQuery: false,
      }),
      Maintenance.findAll({ where: { [Op.or]: [{ description: like }, { assetId: { [Op.in]: (await Asset.findAll({ where: assetWhere, attributes: ['id'], raw: true })).map((a) => a.id) } }] }, attributes: ['id', 'assetId', 'title', 'status', 'description', 'createdAt'], limit: 10 }),
      req.user.role === 'admin' ? User.findAll({ where: { [Op.or]: [{ username: like }, { fullName: like }, { email: like }] }, attributes: ['id', 'username', 'fullName', 'email', 'role'], limit: 10 }) : [],
      req.user.role === 'admin' ? Location.findAll({ where: { [Op.or]: [{ name: like }, { type: like }] }, attributes: ['id', 'name', 'type'], limit: 10 }) : [],
    ]);
    return res.json({ success: true, data: { assets, tickets, incidents, maintenance, users, locations } });
  } catch (error) { next(error); }
};

const listIctPreventiveMaintenance = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const assetWhere = ictAssetWhere(req);
    const assetIds = (await Asset.findAll({ where: assetWhere, attributes: ['id'], raw: true })).map((a) => a.id);
    if (!assetIds.length) return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    const where = { assetId: { [Op.in]: assetIds } };
    if (req.query.status) where.status = String(req.query.status).trim();
    const { count, rows } = await PreventiveMaintenance.findAndCountAll({ where, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category'] }], order: [['scheduleDate', 'ASC']], limit, offset: (page - 1) * limit });
    return res.json({ success: true, data: rows, pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createIctPreventiveMaintenance = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.body.assetId, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const scheduleDate = new Date(req.body.scheduleDate);
    if (Number.isNaN(scheduleDate.getTime())) return res.status(422).json({ success: false, message: 'Valid schedule date is required' });
    const record = await PreventiveMaintenance.create({ assetId: asset.id, type: req.body.type || 'inspection', status: 'scheduled', description: req.body.description || '', scheduleDate, nextScheduleDate: req.body.nextScheduleDate || null, createdBy: req.user.id });
    await AuditLog.create({ userId: req.user.id, action: 'ICT_PREVENTIVE_MAINTENANCE_CREATED', entity: `asset:${asset.id}`, details: JSON.stringify({ maintenanceId: record.id, type: record.type, scheduleDate }) });
    return res.status(201).json({ success: true, data: record });
  } catch (error) { next(error); }
};

const assignIctAsset = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'ICT asset not found' });
    }
    const assigneeId = Number(req.body.assignedTo || req.body.userId);
    if (!Number.isInteger(assigneeId) || assigneeId < 1) {
      await transaction.rollback();
      return res.status(422).json({ success: false, message: 'Valid assignee user ID is required' });
    }
    const assignee = await User.findOne({ where: { id: assigneeId, active: true }, transaction, lock: transaction.LOCK.UPDATE });
    if (!assignee) {
      await transaction.rollback();
      return res.status(422).json({ success: false, message: 'Assignee not found or inactive' });
    }
    if (String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-') !== 'available') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Asset cannot be assigned while its status is "${asset.status}"` });
    }
    if (req.user.role === 'ict_officer' && Number(assignee.collegeId) !== Number(req.organizationScope.collegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Recipient is outside your organization scope.' });
    }
    const existing = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is already assigned to another user' });
    }
    const inventory = await Inventory.findOne({ where: { assetId: asset.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory || Number(inventory.availableQuantity) < 1) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is not available in inventory.' });
    }
    const assignedDate = new Date();
    const departmentId = Number(assignee.departmentId || 0) || null;
    const location = String(req.body.location || asset.location || '').trim();
    const condition = String(req.body.condition_at_assignment || req.body.condition || asset.condition || 'Good');
    const expectedReturnDate = req.body.expectedReturnDate || req.body.expected_return_date || null;
    if (location.length > 255) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Location must be 255 characters or fewer.' });
    }
    if (!['excellent', 'good', 'fair', 'poor', 'damaged'].includes(condition.toLowerCase())) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Condition must be Excellent, Good, Fair, Poor or Damaged.' });
    }
    if (expectedReturnDate && (Number.isNaN(Date.parse(expectedReturnDate)) || new Date(expectedReturnDate) < assignedDate)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Expected return date must be a valid future date.' });
    }
    const previousValue = asset.toJSON();
    await inventory.update({ availableQuantity: inventory.availableQuantity - 1 }, { transaction });
    const assignment = await Assignment.create({
      assetId: asset.id,
      assignedTo: assigneeId,
      assignedToType: 'user',
      assignedToId: assigneeId,
      assignedBy: req.user.id,
      status: 'active',
      workflowStatus: 'assigned',
      assignedDate,
      expectedReturnDate,
      departmentId,
      location,
      conditionAtAssignment: condition,
      notes: JSON.stringify({ notes: req.body.notes || '', departmentId, location, condition }),
    }, { transaction });
    await asset.update({ status: 'assigned', ...(departmentId ? { departmentId } : {}), location }, { transaction });
    await InventoryTransaction.create({ inventoryId: inventory.id, assetId: asset.id, userId: req.user.id, type: 'issue', quantity: 1, reason: 'Asset assignment', notes: req.body.notes || '' }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'ASSIGN_ASSET',
      entity: `asset:${asset.id}`,
      entityId: asset.id,
      oldValue: previousValue,
      newValue: { asset: asset.toJSON(), assignment: assignment.toJSON() },
      details: { assignmentId: assignment.id, assignedTo: { type: 'user', id: assigneeId }, ip: req.ip, sessionId: req.sessionID || null },
      transaction,
    });
    await transaction.commit();
    try {
      await Notification.create({ userId: assigneeId, title: 'Asset Assigned', message: `You have been assigned ${asset.name} (${asset.assetCode || asset.id})`, type: 'assignment', priority: 'medium', entityType: 'asset', entityId: asset.id, actionUrl: `/ict/assets` });
    } catch (notificationError) { console.error('Assignment notification failed:', notificationError.message); }
    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

const transferIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const toDepartmentId = Number(req.body.toDepartmentId || req.body.departmentId);
    if (!Number.isInteger(toDepartmentId) || toDepartmentId < 1) return res.status(422).json({ success: false, message: 'Valid destination department is required' });
    const department = await Department.findOne({ where: { id: toDepartmentId } });
    if (!department) return res.status(422).json({ success: false, message: 'Destination department not found' });
    if (['under-maintenance', 'lost', 'retired'].includes(String(asset.status).toLowerCase())) {
      return res.status(409).json({ success: false, message: `Asset cannot be transferred while its status is "${asset.status}"` });
    }
    const activeTransfer = await Transfer.findOne({ where: { assetId: asset.id, status: { [Op.in]: ['Pending', 'Approved', 'In Progress'] } } });
    if (activeTransfer) return res.status(409).json({ success: false, message: 'Asset already has an active transfer in progress' });
    const transfer = await Transfer.create({
      assetId: asset.id,
      sourceDepartment: asset.department,
      destinationDepartment: department.name,
      sourceDepartmentId: asset.departmentId,
      destinationDepartmentId: department.id,
      currentLocation: asset.location || '',
      newLocation: req.body.newLocation || asset.location || '',
      transferReason: req.body.reason || req.body.transferReason || 'ICT asset transfer',
      status: 'Pending',
      requestedBy: req.user.id,
      createdBy: req.user.id,
    });
    await AuditLog.create({ userId: req.user.id, action: 'ICT_TRANSFER_REQUESTED', entity: `asset:${asset.id}`, details: JSON.stringify({ transferId: transfer.id, fromDepartment: asset.department, toDepartment: department.name }) });
    return res.status(201).json({ success: true, data: transfer, message: 'Transfer request created. Pending approval.' });
  } catch (error) { next(error); }
};

const listIctAssetDocuments = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const documents = await AssetDocument.findAll({ where: { assetId: asset.id, status: 'active' }, order: [['createdAt', 'DESC']] });
    return res.json({ success: true, data: documents });
  } catch (error) { next(error); }
};

const uploadIctAssetDocument = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const saved = saveIctDocument(req.body, 'assets');
    const document = await AssetDocument.create({
      assetId: asset.id,
      documentType: req.body.documentType || req.body.document_type || 'other',
      originalName: saved.originalName,
      storedName: saved.storedName,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      filePath: saved.filePath,
      description: req.body.description || '',
      uploadedBy: req.user.id,
    });
    await AuditLog.create({ userId: req.user.id, action: 'ICT_DOCUMENT_UPLOADED', entity: `asset:${asset.id}`, details: JSON.stringify({ documentId: document.id, documentType: document.documentType, originalName: saved.originalName }) });
    return res.status(201).json({ success: true, data: document });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

const deleteIctAssetDocument = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const document = await AssetDocument.findOne({ where: { id: req.params.documentId, assetId: asset.id } });
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    await document.update({ status: 'removed' });
    await AuditLog.create({ userId: req.user.id, action: 'ICT_DOCUMENT_REMOVED', entity: `asset:${asset.id}`, details: JSON.stringify({ documentId: document.id }) });
    return res.json({ success: true, message: 'Document removed' });
  } catch (error) { next(error); }
};

const getIctWarrantyInfo = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...ictAssetWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const warrantyStatus = !asset.warrantyExpiry ? 'no_warranty' : new Date(asset.warrantyExpiry) < new Date() ? 'expired' : 'active';
    const daysUntilExpiry = asset.warrantyExpiry ? Math.ceil((new Date(asset.warrantyExpiry) - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const documents = await AssetDocument.findAll({ where: { assetId: asset.id, status: 'active', documentType: 'warranty' }, order: [['createdAt', 'DESC']] });
    return res.json({ success: true, data: { assetId: asset.id, assetName: asset.name, assetCode: asset.assetCode, warrantyExpiry: asset.warrantyExpiry, warrantyStatus, daysUntilExpiry, warrantyDocuments: documents } });
  } catch (error) { next(error); }
};

const listIctWarranties = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const assetWhere = { ...ictAssetWhere(req), warrantyExpiry: { [Op.not]: null } };
    if (req.query.status) {
      const status = String(req.query.status).toLowerCase();
      if (status === 'expired') assetWhere.warrantyExpiry[Op.lt] = new Date();
      else if (status === 'active') assetWhere.warrantyExpiry[Op.gte] = new Date();
      else if (status === 'expiring') {
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        assetWhere.warrantyExpiry[Op.and] = [{ [Op.gte]: new Date() }, { [Op.lte]: thirtyDaysFromNow }];
      }
    }
    const { count, rows } = await Asset.findAndCountAll({ where: assetWhere, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'department', 'location', 'warrantyExpiry', 'purchaseDate', 'purchasePrice', 'supplier', 'manufacturer', 'model'], order: [['warrantyExpiry', 'ASC']], limit, offset: (page - 1) * limit });
    const data = rows.map((asset) => {
      const data = asset.toJSON ? asset.toJSON() : asset;
      const daysUntilExpiry = data.warrantyExpiry ? Math.ceil((new Date(data.warrantyExpiry) - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      return { ...data, warrantyStatus: !data.warrantyExpiry ? 'no_warranty' : new Date(data.warrantyExpiry) < new Date() ? 'expired' : 'active', daysUntilExpiry };
    });
    return res.json({ success: true, data, pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

module.exports = { listIctAssets, listIctEquipment, getIctEquipment, listIctEquipmentOptions, createIctEquipment, updateIctEquipment, deleteIctEquipment, listNetworkEquipment, getNetworkEquipment, getIctAsset, retireIctAsset, createIctMaintenanceRequest, createIctAsset, updateIctAsset, getIctOptions, getIctDashboard, listIctTracking, getIctTracking, scanIctTracking, assignIctRfid, unassignIctRfid, listIctAssetHistory, getIctAssetHistoryRecord, getIctAssetHistoryByAsset, globalIctSearch, listIctPreventiveMaintenance, createIctPreventiveMaintenance, assignIctAsset, transferIctAsset, listIctAssetDocuments, uploadIctAssetDocument, deleteIctAssetDocument, getIctWarrantyInfo, listIctWarranties };