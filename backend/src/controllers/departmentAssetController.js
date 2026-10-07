const { Op } = require('sequelize');
const {
  sequelize, Asset, AssetHistory, AssetRegistrationRequest, Assignment, User, Approval, AuditLog, Maintenance,
} = require('../models');
const { createAuditLog } = require('../services/auditLogService');

const editableFields = new Set(['location', 'condition', 'assignedUserId', 'note']);
const activeAssignmentWhere = { status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } };
const allowedSortFields = new Set([
  'id', 'name', 'assetCode', 'digitalId', 'category', 'status', 'condition', 'location',
  'quantity', 'purchaseDate', 'warrantyExpiry', 'createdAt', 'updatedAt', 'qrCode', 'rfidTag',
  'assignedUser', 'maintenanceStatus',
]);

const departmentScope = (req) => {
  const id = Number(req.organizationScope?.departmentId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const filtersForAudit = (query = {}) => [
  'search', 'category', 'status', 'condition', 'location',
  'assignedUser', 'assignedUserId', 'maintenanceStatus', 'warranty',
].filter((key) => query[key] !== undefined && query[key] !== '');

const buildAssetWhere = (req, departmentId) => {
  const where = { departmentId };
  for (const field of ['category', 'status', 'condition', 'location']) {
    if (req.query[field] !== undefined && String(req.query[field]).trim()) {
      where[field] = String(req.query[field]).trim();
    }
  }
  const search = String(req.query.search || '').trim();
  if (search) {
    const term = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.like]: term } },
      { assetCode: { [Op.like]: term } },
      { digitalId: { [Op.like]: term } },
      { serialNumber: { [Op.like]: term } },
      { rfidTag: { [Op.like]: term } },
      { category: { [Op.like]: term } },
      { location: { [Op.like]: term } },
    ];
    if (/^\d+$/.test(search)) where[Op.or].push({ id: Number(search) });
  }
  return { where };
};

const applyAssignmentAndMaintenanceFilters = async (req, where, departmentId) => {
  const assignedUser = String(req.query.assignedUser || '').trim();
  const assignedUserId = req.query.assignedUserId === undefined ? null : Number(req.query.assignedUserId);
  let matchingAssetIds = null;
  const intersectAssetIds = (nextIds) => {
    const next = new Set(nextIds);
    matchingAssetIds = matchingAssetIds === null
      ? next
      : new Set([...matchingAssetIds].filter((id) => next.has(id)));
  };
  if (assignedUserId !== null && (!Number.isSafeInteger(assignedUserId) || assignedUserId < 1)) {
    return { error: 'assignedUserId must be a valid user ID' };
  }
  if (assignedUser || assignedUserId !== null) {
    const assignedUserAsId = assignedUser && /^\d+$/.test(assignedUser) ? Number(assignedUser) : null;
    if (assignedUserAsId !== null && (!Number.isSafeInteger(assignedUserAsId) || assignedUserAsId < 1)) {
      return { error: 'assignedUser must be a valid staff name or ID' };
    }
    const userWhere = assignedUserAsId !== null
      ? { id: assignedUserAsId }
      : assignedUser
        ? { [Op.or]: [{ fullName: assignedUser }, { username: assignedUser }] }
        : { id: assignedUserId };
    if (assignedUserId !== null) userWhere.id = assignedUserId;
    const matches = await Assignment.findAll({
      where: activeAssignmentWhere,
      attributes: ['assetId'],
      include: [
        { model: Asset, where: { departmentId }, required: true, attributes: [] },
        { model: User, where: userWhere, required: true, attributes: [] },
      ],
      raw: true,
    });
    intersectAssetIds(matches.map((item) => Number(item.assetId)));
  }

  const maintenanceStatus = String(req.query.maintenanceStatus || '').trim();
  if (maintenanceStatus) {
    const records = await Maintenance.findAll({
      attributes: ['assetId', 'status', 'updatedAt', 'createdAt'],
      include: [{ model: Asset, where: { departmentId }, required: true, attributes: [] }],
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
      raw: true,
    });
    const latestStatusByAsset = new Map();
    records.forEach((record) => {
      const assetId = Number(record.assetId);
      if (!latestStatusByAsset.has(assetId)) latestStatusByAsset.set(assetId, String(record.status || '').toLowerCase());
    });
    intersectAssetIds([...latestStatusByAsset]
      .filter(([, status]) => status === maintenanceStatus.toLowerCase())
      .map(([assetId]) => assetId));
  }

  const warranty = String(req.query.warranty || '').trim().toLowerCase();
  if (warranty) {
    if (!['valid', 'expired'].includes(warranty)) return { error: 'warranty must be valid or expired' };
    where.warrantyExpiry = warranty === 'valid'
      ? { [Op.gte]: new Date(new Date().toISOString().slice(0, 10)) }
      : { [Op.lt]: new Date(new Date().toISOString().slice(0, 10)) };
  }
  if (matchingAssetIds !== null) where.id = { [Op.in]: [...matchingAssetIds] };
  return {};
};

const getListOptions = (req, where, pagination = true) => {
  const requestedSort = String(req.query.sortBy || req.query.sort || 'updatedAt');
  const aliases = { assetId: 'assetCode', warranty: 'warrantyExpiry' };
  const sortField = aliases[requestedSort] || requestedSort;
  const sort = allowedSortFields.has(sortField) ? sortField : 'updatedAt';
  const direction = String(req.query.sortOrder || req.query.order || req.query.direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const order = sort === 'assignedUser'
    ? [[{ model: Assignment }, { model: User }, 'fullName', direction]]
    : sort === 'maintenanceStatus'
      ? [[{ model: Maintenance }, 'status', direction]]
      : [[sort, direction]];
  const options = { where, order };
  if (pagination) {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    Object.assign(options, { page, limit, offset: (page - 1) * limit });
  }
  return options;
};

const getFilterOptions = async (departmentId) => {
  const assets = await Asset.findAll({
    where: { departmentId },
    attributes: ['id', 'category', 'status', 'condition', 'location', 'warrantyExpiry'],
    raw: true,
  });
  const assetIds = assets.map((asset) => Number(asset.id));
  const [assignmentRows, maintenanceRows] = assetIds.length
    ? await Promise.all([
      Assignment.findAll({
        where: { assetId: { [Op.in]: assetIds }, ...activeAssignmentWhere },
        attributes: ['assignedTo'],
        include: [{ model: User, attributes: ['fullName', 'username'], required: true }],
      }),
      Maintenance.findAll({
        where: { assetId: { [Op.in]: assetIds } },
        attributes: ['status'],
        raw: true,
      }),
    ])
    : [[], []];
  const distinct = (values) => [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const assignedUsers = [...new Map(assignmentRows.map((row) => [
    Number(row.assignedTo),
    { id: Number(row.assignedTo), name: row.User?.fullName || row.User?.username || '', username: row.User?.username || '' },
  ]).filter(([id, value]) => Number.isSafeInteger(id) && id > 0 && value.name)).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    categories: distinct(assets.map((asset) => asset.category)),
    statuses: distinct(assets.map((asset) => asset.status)),
    conditions: distinct(assets.map((asset) => asset.condition)),
    locations: distinct(assets.map((asset) => asset.location)),
    users: assignedUsers.map(({ id, name }) => ({ id, name })),
    assignedUsers,
    maintenanceStatuses: distinct(maintenanceRows.map((row) => row.status)),
    warranties: ['valid', 'expired'],
    warrantyStatuses: ['valid', 'expired'],
  };
};

const currentAssignmentInclude = {
  model: Assignment,
  required: false,
  where: activeAssignmentWhere,
  include: [{ model: User, attributes: ['id', 'username', 'fullName', 'role'] }],
};
const currentMaintenanceInclude = {
  model: Maintenance,
  required: false,
  attributes: ['id', 'status', 'updatedAt'],
};

const listAssets = async (req, res, next) => {
  try {
    const departmentId = departmentScope(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const built = buildAssetWhere(req, departmentId);
    if (built.error) return res.status(400).json({ success: false, message: built.error });
    const relationalFilters = await applyAssignmentAndMaintenanceFilters(req, built.where, departmentId);
    if (relationalFilters.error) return res.status(400).json({ success: false, message: relationalFilters.error });
    const options = getListOptions(req, built.where);
    const [result, filterOptions] = await Promise.all([
      Asset.findAndCountAll({
        where: options.where,
        include: [currentAssignmentInclude, currentMaintenanceInclude],
        distinct: true,
        order: options.order,
        limit: options.limit,
        offset: options.offset,
      }),
      getFilterOptions(departmentId),
    ]);
    const data = result.rows.map((asset) => {
      const serialized = asset.toJSON();
      const assignment = (serialized.Assignments || []).find((record) => !['returned', 'cancelled', 'closed'].includes(String(record.status || '').toLowerCase()));
      serialized.assignedUser = assignment?.User ? {
        id: assignment.User.id,
        name: assignment.User.fullName || assignment.User.username,
        fullName: assignment.User.fullName || assignment.User.username,
        username: assignment.User.username,
      } : null;
      serialized.assignedUserId = assignment?.assignedTo ?? null;
      const latestMaintenance = (serialized.Maintenances || [])
        .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0];
      serialized.maintenanceStatus = latestMaintenance?.status || null;
      delete serialized.Assignments;
      delete serialized.Maintenances;
      return serialized;
    });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'DEPARTMENT_ASSET_LIST_VIEWED',
      entity: `department:${departmentId}:assets`,
      details: {
        departmentId,
        resultCount: result.count,
        page: options.page,
        limit: options.limit,
        filterNames: filtersForAudit(req.query),
      },
    });
    const pagination = { page: options.page, limit: options.limit, total: result.count, pages: Math.ceil(result.count / options.limit) };
    const scopeDepartment = req.organizationScope?.department;
    const department = scopeDepartment ? {
      id: scopeDepartment.id,
      name: scopeDepartment.name,
      code: scopeDepartment.code || null,
    } : { id: departmentId };
    const filters = {
      search: req.query.search || '',
      category: req.query.category || '',
      status: req.query.status || '',
      condition: req.query.condition || '',
      location: req.query.location || '',
      assignedUser: req.query.assignedUser || '',
      maintenanceStatus: req.query.maintenanceStatus || '',
      warranty: req.query.warranty || '',
    };
    return res.json({
      success: true,
      assets: data,
      data: { assets: data, pagination, department, filterOptions },
      pagination,
      department,
      filterOptions,
      filters,
    });
  } catch (error) {
    return next(error);
  }
};

const getAsset = async (req, res, next) => {
  try {
    const departmentId = departmentScope(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const asset = await Asset.findOne({
      where: { id: req.params.id, departmentId },
      include: [currentAssignmentInclude, currentMaintenanceInclude],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your department' });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'DEPARTMENT_ASSET_VIEWED',
      entity: `asset:${asset.id}`,
      entityId: asset.id,
      details: { departmentId, assetId: asset.id },
    });
    const data = asset.toJSON();
    const assignment = (data.Assignments || []).find((record) => !['returned', 'cancelled', 'closed'].includes(String(record.status || '').toLowerCase()));
    data.assignedUser = assignment?.User ? {
      id: assignment.User.id,
      name: assignment.User.fullName || assignment.User.username,
      username: assignment.User.username,
    } : null;
    data.assignedUserId = assignment?.assignedTo ?? null;
    data.maintenanceStatus = (data.Maintenances || [])
      .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0]?.status || null;
    delete data.Assignments;
    delete data.Maintenances;
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const updateAsset = async (req, res, next) => {
  let transaction;
  try {
    const departmentId = departmentScope(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const body = req.body || {};
    const unknownFields = Object.keys(body).filter((field) => !editableFields.has(field));
    if (unknownFields.length) {
      return res.status(400).json({ success: false, message: `Unsupported asset field(s): ${unknownFields.join(', ')}` });
    }
    if (!Object.keys(body).length) return res.status(400).json({ success: false, message: 'At least one editable asset field is required' });
    if (Object.hasOwn(body, 'location') && (typeof body.location !== 'string' || body.location.trim().length > 255)) {
      return res.status(400).json({ success: false, message: 'Location must be text no longer than 255 characters' });
    }
    if (Object.hasOwn(body, 'condition') && (typeof body.condition !== 'string' || !body.condition.trim() || body.condition.trim().length > 100)) {
      return res.status(400).json({ success: false, message: 'Condition must be text between 1 and 100 characters' });
    }
    if (Object.hasOwn(body, 'note') && (typeof body.note !== 'string' || body.note.length > 1000)) {
      return res.status(400).json({ success: false, message: 'Note must be text no longer than 1000 characters' });
    }
    let assignedUserId;
    if (Object.hasOwn(body, 'assignedUserId')) {
      assignedUserId = body.assignedUserId === null || body.assignedUserId === '' ? null : Number(body.assignedUserId);
      if (assignedUserId !== null && (!Number.isSafeInteger(assignedUserId) || assignedUserId < 1)) {
        return res.status(400).json({ success: false, message: 'assignedUserId must be a valid user ID or null' });
      }
    }

    transaction = await sequelize.transaction();
    const asset = await Asset.findOne({ where: { id: req.params.id, departmentId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found in your department' });
    }
    const oldValue = { location: asset.location, condition: asset.condition, note: asset.notes || '', assignedUserId: null };
    const updates = {};
    if (Object.hasOwn(body, 'location')) updates.location = body.location.trim();
    if (Object.hasOwn(body, 'condition')) updates.condition = body.condition.trim();
    if (Object.hasOwn(body, 'note')) updates.notes = body.note;
    if (assignedUserId !== undefined) {
      const activeAssignment = await Assignment.findOne({
        where: { assetId: asset.id, ...activeAssignmentWhere },
        transaction,
        lock: transaction.LOCK.UPDATE,
        order: [['updatedAt', 'DESC']],
      });
      oldValue.assignedUserId = activeAssignment?.assignedTo ?? null;
      if (assignedUserId !== null) {
        const staff = await User.findOne({
          where: {
            id: assignedUserId,
            departmentId,
            ...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}),
            active: true,
            status: 'active',
          },
          attributes: ['id'],
          transaction,
        });
        if (!staff) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Assigned user must be active staff in your department' });
        }
      }
      if (activeAssignment && activeAssignment.assignedTo !== assignedUserId) {
        if (assignedUserId === null) {
          await activeAssignment.update({ status: 'returned', workflowStatus: 'returned', returnedAt: new Date() }, { transaction });
        } else {
          await activeAssignment.update({ assignedTo: assignedUserId, assignedToType: 'user', assignedToId: assignedUserId }, { transaction });
        }
      } else if (!activeAssignment && assignedUserId !== null) {
        await Assignment.create({
          assetId: asset.id,
          assignedTo: assignedUserId,
          assignedToType: 'user',
          assignedToId: assignedUserId,
          assignedBy: req.user.id,
          status: 'active',
          workflowStatus: 'assigned',
          departmentId,
          location: Object.hasOwn(body, 'location') ? body.location.trim() : asset.location,
          conditionAtAssignment: Object.hasOwn(body, 'condition') ? body.condition.trim() : asset.condition,
        }, { transaction });
      }
    }
    if (Object.keys(updates).length) await asset.update(updates, { transaction });
    const newValue = {
      ...oldValue,
      ...(Object.hasOwn(updates, 'notes') ? { note: updates.notes } : {}),
      ...Object.fromEntries(Object.entries(updates).filter(([key]) => key !== 'notes')),
    };
    if (assignedUserId !== undefined) newValue.assignedUserId = assignedUserId;
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'DEPARTMENT_ASSET_UPDATED',
      entity: `asset:${asset.id}`,
      entityId: asset.id,
      oldValue,
      newValue,
      details: { departmentId, changedFields: Object.keys(body), note: body.note ?? null },
      transaction,
    });
    await AssetHistory.create({
      assetId: asset.id,
      departmentId,
      changedBy: req.user.id,
      action: 'DEPARTMENT_ASSET_UPDATED',
      oldValue,
      newValue,
      details: { changedFields: Object.keys(body), note: body.note ?? null },
    }, { transaction });
    await transaction.commit();
    return res.json({
      success: true,
      data: {
        ...asset.toJSON(),
        note: asset.notes || '',
        assignedUserId: assignedUserId === undefined ? oldValue.assignedUserId : assignedUserId,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const exportFields = [
  ['Asset ID', 'assetCode'], ['Database ID', 'id'], ['Name', 'name'], ['Digital ID', 'digitalId'],
  ['QR Code', 'qrCode'], ['RFID Tag', 'rfidTag'], ['Category', 'category'], ['Subcategory', 'subcategory'],
  ['Unit', 'unit'], ['Description', 'description'], ['Serial Number', 'serialNumber'], ['Status', 'status'],
  ['Condition', 'condition'], ['Department', 'department'], ['Department ID', 'departmentId'],
  ['College ID', 'collegeId'], ['Campus ID', 'campusId'], ['Building ID', 'buildingId'],
  ['Room ID', 'roomId'], ['Location', 'location'], ['Quantity', 'quantity'],
  ['Specifications', 'specifications'], ['Funding Source', 'fundingSource'], ['Purchase Date', 'purchaseDate'],
  ['Expiry Date', 'expiryDate'], ['Batch/Lot', 'batchLot'], ['Purchase Price', 'purchasePrice'],
  ['Supplier', 'supplier'], ['Manufacturer', 'manufacturer'], ['Model', 'model'],
  ['Warranty Expiry', 'warrantyExpiry'], ['Notes', 'notes'], ['Current Value', 'currentValue'],
  ['Health Score', 'healthScore'], ['Created By', 'createdBy'], ['Deleted By', 'deletedBy'], ['Created At', 'createdAt'],
  ['Updated At', 'updatedAt'], ['Maintenance Status', 'maintenanceStatus'],
  ['Assigned User ID', 'assignedUserId'], ['Assigned User', 'assignedUser'],
];
const exportHeaders = exportFields.map(([label]) => label);
const assetExportRow = (asset) => exportFields.map(([, field]) => {
  if (field === 'assignedUserId') return asset.Assignments?.[0]?.assignedTo ?? '';
  if (field === 'assignedUser') return asset.Assignments?.[0]?.User?.fullName || asset.Assignments?.[0]?.User?.username || '';
  if (field === 'maintenanceStatus') return asset.Maintenances?.[0]?.status || '';
  const value = asset[field];
  return value && typeof value === 'object' ? JSON.stringify(value) : value;
});
const parseDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Dates must use YYYY-MM-DD format' };
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return { error: 'Enter a valid calendar date' };
  return { value };
};

const makePdf = (rows) => {
  const escape = (text) => String(text ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/([\\()])/g, '\\$1');
  const lines = rows.map((row) => Array.isArray(row)
    ? row.map((value) => String(value ?? '')).join(' | ')
    : String(row ?? ''));
  const wrappedLines = lines.flatMap((line) => {
    const chunks = [];
    for (let index = 0; index < line.length; index += 110) chunks.push(line.slice(index, index + 110));
    return chunks.length ? chunks : [''];
  });
  const pages = [];
  for (let start = 0; start < wrappedLines.length; start += 65) pages.push(wrappedLines.slice(start, start + 65));
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const pageIds = [];
  const streamIds = [];
  pages.forEach((page) => {
    const commands = ['BT', '/F1 7 Tf', '30 800 Td', '10 TL', ...page.flatMap((line, index) => [
      index ? 'T*' : '',
      `(${escape(line)}) Tj`,
    ]).filter(Boolean), 'ET'].join('\n');
    streamIds.push(add(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`));
    pageIds.push(add(''));
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  pageIds.forEach((pageId, index) => {
    objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamIds[index]} 0 R >>`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

const exportAssets = async (req, res, next) => {
  try {
    const departmentId = departmentScope(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const format = String(req.query.format || req.query.export || 'csv').toLowerCase();
    if (!['csv', 'xlsx', 'excel', 'pdf'].includes(format)) {
      return res.status(400).json({ success: false, message: 'Export format must be csv, xlsx, or pdf' });
    }
    const built = buildAssetWhere(req, departmentId);
    if (built.error) return res.status(400).json({ success: false, message: built.error });
    const relationalFilters = await applyAssignmentAndMaintenanceFilters(req, built.where, departmentId);
    if (relationalFilters.error) return res.status(400).json({ success: false, message: relationalFilters.error });
    const options = getListOptions(req, built.where, false);
    const total = await Asset.count({ where: options.where });
    const date = new Date().toISOString().slice(0, 10);
    const department = req.organizationScope?.department;
    const departmentCode = String(department?.code || `dept-${departmentScope(req)}`).trim().replace(/[^A-Za-z0-9_-]+/g, '_');
    const departmentName = String(department?.name || `Department ${departmentScope(req)}`);
    const exporter = String(req.user?.fullName || req.user?.username || `User ${req.user?.id || ''}`).trim();
    const filenameFormat = format === 'excel' ? 'xlsx' : format;
    const filename = `assets_${departmentCode}_${date}.${filenameFormat}`;
    const metadataRows = [
      ['Department', departmentName],
      ['Export Date', date],
      ['Exported By', exporter],
      [],
    ];
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'DEPARTMENT_ASSETS_EXPORTED',
      entity: `department:${departmentId}:assets`,
      details: {
        departmentId,
        resultCount: total,
        format: filenameFormat,
        filterNames: filtersForAudit(req.query),
      },
    });
    if (format === 'csv') {
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
      res.write('\uFEFF');
      for (const row of [...metadataRows, exportHeaders]) {
        res.write(`${row.map(csvEscape).join(',')}\r\n`);
      }
      const batchSize = 500;
      for (let offset = 0; offset < total; offset += batchSize) {
        const batch = await Asset.findAll({
          where: options.where,
          include: [currentAssignmentInclude, currentMaintenanceInclude],
          distinct: true,
          order: options.order,
          limit: batchSize,
          offset,
        });
        for (const asset of batch) {
          const data = asset.toJSON();
          data.Assignments = (data.Assignments || []).filter((item) => !['returned', 'cancelled', 'closed'].includes(String(item.status || '').toLowerCase()));
          const latestMaintenance = (data.Maintenances || [])
            .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0];
          data.Maintenances = latestMaintenance ? [latestMaintenance] : [];
          const writable = res.write(`${assetExportRow(data).map(csvEscape).join(',')}\r\n`);
          if (!writable) await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      return res.end();
    }
    const formatLimit = format === 'pdf' ? 2000 : 5000;
    if (total > formatLimit) {
      return res.status(413).json({
        success: false,
        message: `${filenameFormat.toUpperCase()} exports are limited to ${formatLimit} assets per request to bound memory. Use CSV for larger exports.`,
        maxAssets: formatLimit,
        total,
      });
    }
    const records = [];
    const batchSize = 500;
    for (let offset = 0; offset < total; offset += batchSize) {
      const batch = await Asset.findAll({
        where: options.where,
        include: [currentAssignmentInclude, currentMaintenanceInclude],
        distinct: true,
        order: options.order,
        limit: Math.min(batchSize, total - offset),
        offset,
      });
      records.push(...batch.map((asset) => {
        const data = asset.toJSON();
        data.Assignments = (data.Assignments || []).filter((item) => !['returned', 'cancelled', 'closed'].includes(String(item.status || '').toLowerCase()));
        const latestMaintenance = (data.Maintenances || [])
          .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0];
        data.Maintenances = latestMaintenance ? [latestMaintenance] : [];
        return data;
      }));
    }
    const sheetRows = [...metadataRows, exportHeaders, ...records.map(assetExportRow)];
    if (format === 'xlsx' || format === 'excel') {
      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), 'Assets');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.send(buffer);
    }
    if (format === 'pdf') {
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.send(makePdf(sheetRows));
    }
  } catch (error) {
    return next(error);
  }
};

const createAssetRequest = async (req, res, next) => {
  const departmentId = departmentScope(req);
  if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  const item = String(req.body?.item || req.body?.requestedItem || req.body?.name || '').trim();
  const reason = String(req.body?.reason || req.body?.justification || '').trim();
  const quantity = Number(req.body?.quantity ?? 1);
  const priority = String(req.body?.priority || 'medium').toLowerCase();
  const category = String(req.body?.category || '').trim();
  const condition = String(req.body?.condition || '').trim();
  const location = String(req.body?.location || '').trim();
  const serialNumber = String(req.body?.serialNumber || '').trim() || null;
  if (!item || item.length > 255 || !category || category.length > 255
    || !condition || condition.length > 100 || !location || location.length > 255
    || !reason || reason.length > 2000 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    return res.status(400).json({ success: false, message: 'Name, category, condition, location, justification, and a positive whole-number quantity are required' });
  }
  if (serialNumber && serialNumber.length > 255) return res.status(400).json({ success: false, message: 'Serial number must be 255 characters or fewer' });
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    return res.status(400).json({ success: false, message: 'Invalid request priority' });
  }
  const purchaseDate = parseDateOnly(req.body?.purchaseDate);
  const warrantyExpiry = parseDateOnly(req.body?.warrantyExpiry);
  if (purchaseDate.error || warrantyExpiry.error) {
    return res.status(400).json({ success: false, message: purchaseDate.error || warrantyExpiry.error });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (purchaseDate.value && purchaseDate.value > today) {
    return res.status(400).json({ success: false, message: 'Purchase date cannot be in the future' });
  }
  let transaction;
  try {
    const assetId = req.body.assetId == null || req.body.assetId === '' ? null : Number(req.body.assetId);
    if (assetId !== null) {
      if (!Number.isSafeInteger(assetId) || assetId < 1) return res.status(400).json({ success: false, message: 'Invalid assetId' });
      const inScope = await Asset.findOne({ where: { id: assetId, departmentId }, attributes: ['id'] });
      if (!inScope) return res.status(404).json({ success: false, message: 'Asset not found in your department' });
    }
    if (serialNumber) {
      const [existingAsset, existingRegistration] = await Promise.all([
        Asset.findOne({ where: { serialNumber }, attributes: ['id'] }),
        AssetRegistrationRequest.findOne({ where: { serialNumber }, attributes: ['id'] }),
      ]);
      if (existingAsset || existingRegistration) {
        return res.status(409).json({ success: false, message: 'Serial number is already registered or requested' });
      }
    }
    transaction = await sequelize.transaction();
    const record = await Approval.create({
      type: 'purchase',
      assetId,
      requestedBy: req.user.id,
      departmentId,
      item,
      quantity,
      priority,
      status: 'pending',
      reason,
    }, { transaction });
    const registration = await AssetRegistrationRequest.create({
      departmentId,
      requestedBy: req.user.id,
      approvalId: record.id,
      name: item,
      category,
      serialNumber,
      quantity,
      condition,
      location,
      purchaseDate: purchaseDate.value,
      warrantyExpiry: warrantyExpiry.value,
      justification: reason,
      status: 'Pending',
    }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'ASSET_REQUEST_SUBMITTED',
      entity: `approval:${record.id}`,
      entityId: record.id,
      oldValue: null,
      newValue: {
        departmentId, item, category, serialNumber, quantity, condition, location,
        purchaseDate: purchaseDate.value, warrantyExpiry: warrantyExpiry.value,
        justification: reason, priority, status: registration.status,
      },
      details: { departmentId, registrationRequestId: registration.id, approvalId: record.id },
      transaction,
    });
    await transaction.commit();
    try {
      const { createFinanceNotification } = require('../services/notificationService');
      await createFinanceNotification({
        event: 'finance_purchase_request_submitted',
        eventKey: `finance_purchase_request_submitted:${record.id}`,
        entityId: record.id,
        senderId: req.user.id,
        type: 'procurement',
        title: 'Asset request awaiting approval',
        message: `Asset request REQ-${String(record.id).padStart(6, '0')} for ${item} requires approval.`,
      });
    } catch (notificationError) {
      console.error('Asset request notification failed:', notificationError.stack || notificationError);
    }
    return res.status(201).json({
      success: true,
      message: 'Asset request submitted for approval',
      data: { ...registration.toJSON(), approval: record },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Serial number is already registered or requested' });
    }
    return next(error);
  }
};

module.exports = { listAssets, getAsset, updateAsset, exportAssets, createAssetRequest };
