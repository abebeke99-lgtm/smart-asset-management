const { sequelize, Asset, Inventory, Assignment, Transfer, Maintenance, RFIDLog, AuditLog, User, Department, College, Campus, Building, Room } = require('../models');
const { Op } = require('sequelize');
const { nextDigitalId, buildAssetCodeFromConfig } = require('./assetExtendedController');
const { createAuditLog } = require('../services/auditLogService');
const { isCollegeScopedRole, getCollegeScopeId } = require('../middlewares/organizationScope');

const serializeAsset = (asset, assignment = null) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  return {
    ...data,
    asset_tag: data.assetCode,
    serial_number: data.serialNumber,
    rfid_tag: data.rfidTag,
    qrCode: data.digitalId,
    condition: data.condition,
    condition_status: data.condition,
    department_name: data.department,
    purchase_date: data.purchaseDate,
    purchase_cost: Number(data.purchasePrice || 0),
    current_value: Number(data.currentValue || 0),
    warranty_expiry: data.warrantyExpiry,
    manufacturer: data.manufacturer,
    is_assigned: Boolean(assignment),
    assigned_to_name: assignment?.User?.fullName || assignment?.User?.username || null,
    assigned_date: assignment?.createdAt || null,
  };
};

const getAllAssets = async (req, res) => {
  try {
    const query = req.query || {};
    const allowedSortFields = { created_at: 'createdAt', name: 'name', status: 'status', purchaseDate: 'purchaseDate', assetCode: 'assetCode' };
    const allowedParameters = new Set([
      'page', 'limit', 'search', 'status', 'category', 'location', 'condition', 'department', 'department_id', 'departmentId',
      'campus', 'campus_id', 'campusId', 'college', 'college_id', 'collegeId', 'laboratory', 'laboratory_id', 'laboratoryId', 'purchase_from', 'purchase_to',
      'research_grant', 'maintenance_status', 'deleted', 'include_deleted', 'sort_by', 'sort_order',
    ]);
    const unsupportedParameter = Object.keys(query).find((key) => !allowedParameters.has(key));
    if (unsupportedParameter) return res.status(400).json({ success: false, message: `Unsupported asset filter: ${unsupportedParameter}` });
    if (query.sort_by && !allowedSortFields[query.sort_by]) return res.status(400).json({ success: false, message: 'Unsupported asset sort field' });
    if (query.sort_order && !['asc', 'desc'].includes(String(query.sort_order).toLowerCase())) return res.status(400).json({ success: false, message: 'sort_order must be asc or desc' });
    for (const field of ['campus_id', 'college_id', 'department_id', 'departmentId', 'campusId', 'collegeId', 'laboratory_id', 'laboratoryId']) {
      if (query[field] && (!Number.isInteger(Number(query[field])) || Number(query[field]) < 1)) return res.status(400).json({ success: false, message: `${field} must be a positive integer` });
    }
    for (const field of ['purchase_from', 'purchase_to']) {
      if (query[field] && Number.isNaN(Date.parse(query[field]))) return res.status(400).json({ success: false, message: `${field} must be a valid date` });
    }
    if (query.purchase_from && query.purchase_to && new Date(query.purchase_from) > new Date(query.purchase_to)) return res.status(400).json({ success: false, message: 'purchase_from cannot be after purchase_to' });
    const where = {};
    const collegeId = isCollegeScopedRole(req.user?.role) ? getCollegeScopeId(req) : null;
    if (isCollegeScopedRole(req.user?.role) && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    if (collegeId) where.collegeId = collegeId;
    const department = query.department;
    if (department) where.department = department;
    if (query.status) where.status = { [Op.in]: [query.status, String(query.status).toLowerCase(), String(query.status).replace(/[_ ]/g, '-').toLowerCase()] };
    if (query.category) where.category = query.category;
    if (query.location) where.location = { [Op.like]: `%${String(query.location).trim()}%` };
    if (query.condition) where.condition = { [Op.in]: [query.condition, String(query.condition).toLowerCase()] };
    if (query.department_id) {
      where.departmentId = query.department_id;
      const requestedDepartment = await Department.findByPk(query.department_id);
      if (requestedDepartment && (!collegeId || Number(requestedDepartment.collegeId) === collegeId)) where.department = requestedDepartment.name;
    }
    for (const [parameter, field] of [['campus_id', 'campusId'], ['college_id', 'collegeId']]) {
      if (query[parameter]) {
        if (field === 'collegeId' && collegeId) continue;
        if (!Asset.rawAttributes[field]) return res.status(400).json({ success: false, message: `${parameter} filtering is not supported by the asset schema` });
        where[field] = query[parameter];
      }
    }
    if (query.campus) where.campusId = query.campus;
    if (query.college) {
      const College = require('../models').College;
      const matchingColleges = await College.findAll({ where: { collegeName: { [Op.like]: `%${String(query.college).trim()}%` } }, attributes: ['id'] });
      const matchingCollegeIds = matchingColleges.map((item) => Number(item.id));
      where.collegeId = collegeId ? (matchingCollegeIds.includes(Number(collegeId)) ? collegeId : -1) : { [Op.in]: matchingCollegeIds };
    }
    if (query.laboratory_id || query.laboratory) {
      if (query.laboratory_id && Asset.rawAttributes.roomId) where.roomId = query.laboratory_id;
      else where.location = { [Op.like]: `%${String(query.laboratory).trim()}%` };
    }
    if (query.purchase_from || query.purchase_to) {
      where.purchaseDate = {};
      if (query.purchase_from) where.purchaseDate[Op.gte] = new Date(query.purchase_from);
      if (query.purchase_to) where.purchaseDate[Op.lte] = new Date(`${String(query.purchase_to).slice(0, 10)}T23:59:59.999Z`);
    }
    if (query.research_grant && !['any', 'has', 'none'].includes(query.research_grant)) return res.status(400).json({ success: false, message: 'research_grant must be any, has, or none' });
    if (query.research_grant === 'has') where.fundingSource = { [Op.ne]: '' };
    if (query.research_grant === 'none') where[Op.or] = [{ fundingSource: '' }, { fundingSource: null }];
    if (query.maintenance_status) {
      const validMaintenanceStatuses = ['open', 'pending', 'in_progress', 'completed', 'cancelled'];
      const normalizedMaintenanceStatus = String(query.maintenance_status).toLowerCase().replace(/[ -]/g, '_');
      if (!validMaintenanceStatuses.includes(normalizedMaintenanceStatus)) return res.status(400).json({ success: false, message: 'Unsupported maintenance_status' });
      const matchingMaintenance = await Maintenance.findAll({ where: { status: normalizedMaintenanceStatus }, attributes: ['assetId'] });
      where.id = { [Op.in]: matchingMaintenance.map((item) => item.assetId) };
    }
    const includeDeleted = ['true', '1'].includes(String(query.deleted || query.include_deleted || '').toLowerCase());
    if (includeDeleted) where.deletedAt = { [Op.not]: null };
    if (query.search) {
      const search = String(query.search).trim();
      const matchingUsers = await User.findAll({ where: { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] });
      const matchingAssignments = matchingUsers.length ? await Assignment.findAll({ where: { assignedTo: { [Op.in]: matchingUsers.map(item => item.id) }, status: 'active' }, attributes: ['assetId'] }) : [];
      const [matchingColleges, matchingCampuses, matchingBuildings, matchingRooms] = await Promise.all([
        College.findAll({ where: { collegeName: { [Op.like]: `%${search}%` } }, attributes: ['id'] }),
        Campus.findAll({ where: { campusName: { [Op.like]: `%${search}%` } }, attributes: ['id'] }),
        Building.findAll({ where: { buildingName: { [Op.like]: `%${search}%` } }, attributes: ['id'] }),
        Room.findAll({ where: { roomName: { [Op.like]: `%${search}%` } }, attributes: ['id'] }),
      ]);
      const matchingDepartments = await Department.findAll({ where: { name: { [Op.like]: `%${search}%` } }, attributes: ['id'] });
      where[Op.and] = [{ [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { collegeId: { [Op.in]: matchingColleges.map((item) => item.id) } },
        { departmentId: { [Op.in]: matchingDepartments.map((item) => item.id) } },
        { campusId: { [Op.in]: matchingCampuses.map((item) => item.id) } },
        { buildingId: { [Op.in]: matchingBuildings.map((item) => item.id) } },
        { roomId: { [Op.in]: matchingRooms.map((item) => item.id) } },
        { id: { [Op.in]: matchingAssignments.map(item => item.assetId) } },
      ] }];
    }
    const page = Math.max(1, Number(query.page) || 1);
    const requestedLimit = Number(query.limit) || 10;
    if (![10, 25, 50].includes(requestedLimit)) return res.status(400).json({ success: false, message: 'limit must be 10, 25, or 50' });
    const limit = requestedLimit;
    const orderField = allowedSortFields[query.sort_by] || 'createdAt';
    const orderDirection = String(query.sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const { count, rows } = await Asset.findAndCountAll({
      where,
      include: [
        { model: Campus, as: 'CampusRecord', required: false },
        { model: College, required: false },
        { model: Department, as: 'DepartmentRecord', required: false },
        { model: Building, as: 'BuildingRecord', required: false },
        { model: Room, as: 'RoomRecord', required: false },
      ],
      ...(includeDeleted ? { paranoid: false } : {}),
      order: [[orderField, orderDirection]],
      limit,
      offset: (page - 1) * limit,
    });
    const summaryRows = await Asset.findAll({ attributes: ['status'], raw: true, ...(collegeId ? { where: { collegeId } } : {}) });
    const summary = summaryRows.reduce((counts, asset) => {
      const status = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
      const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status === 'lost' || status === 'missing' ? 'missing' : status === 'disposed' || status === 'retired' ? 'retired' : status;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, { available: 0, assigned: 0, maintenance: 0, damaged: 0, missing: 0, retired: 0 });
    const assignments = await Assignment.findAll({ where: { status: 'active', assetId: { [Op.in]: rows.map(asset => asset.id) } }, include: [{ model: User, attributes: ['username', 'fullName'], required: false }] });
    const serialized = rows.map(asset => serializeAsset(asset, assignments.find(assignment => assignment.assetId === asset.id)));
    res.json({ success: true, data: serialized, assets: serialized, total: count, summary: { total: summaryRows.length, ...summary }, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Asset list request failed:', error.stack || error);
    res.status(500).json({ success: false, message: 'Unable to load assets.' });
  }
};

const getAssetById = async (req, res) => {
  try {
    const collegeId = isCollegeScopedRole(req.user?.role) ? getCollegeScopeId(req) : null;
    if (isCollegeScopedRole(req.user?.role) && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const asset = await Asset.findOne({
      where: { id: req.params.id, ...(collegeId ? { collegeId } : {}) },
      paranoid: false,
      include: [
        { model: Campus, as: 'CampusRecord', required: false },
        { model: College, required: false },
        { model: Department, as: 'DepartmentRecord', required: false },
        { model: Building, as: 'BuildingRecord', required: false },
        { model: Room, as: 'RoomRecord', required: false },
      ],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const assignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['username', 'fullName'] }] });
    res.json({ success: true, data: serializeAsset(asset, assignment), asset: serializeAsset(asset, assignment) });
  } catch (error) {
    console.error('Asset detail request failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load asset.' });
  }
};

const createAsset = async (req, res) => {
  const body = req.body || {};
  const scopedRole = isCollegeScopedRole(req.user?.role);
  const collegeId = scopedRole ? getCollegeScopeId(req) : null;
  if (scopedRole && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
  const providedCollegeId = body.collegeId ?? body.college_id;
  if (scopedRole && providedCollegeId !== undefined && Number(providedCollegeId) !== collegeId) return res.status(403).json({ success: false, message: 'Asset College is outside your organization scope' });
  const transaction = await sequelize.transaction();
  try {
    const providedAssetCode = String(body.assetCode || body.asset_id || '').trim();
    const serialNumber = String(body.serialNumber || body.serial_number || '').trim();
    const rfidTag = String(body.rfidTag || body.rfid_tag || '').trim() || null;
    const name = String(body.name || '').trim();
    const purchasePrice = body.purchasePrice ?? body.purchase_cost ?? 0;
    const purchaseDate = body.purchaseDate || body.purchase_date || null;
    const warrantyExpiry = body.warrantyExpiry || body.warranty_expiry || null;

    if (!name) return res.status(400).json({ success: false, message: 'Asset name is required' });
    const assetCode = providedAssetCode || await buildAssetCodeFromConfig({ category: body.category || body.category_id || '', transaction });
    if (!assetCode) return res.status(400).json({ success: false, message: 'Asset code could not be generated' });
    if (!Number.isFinite(Number(purchasePrice)) || Number(purchasePrice) < 0) return res.status(400).json({ success: false, message: 'Purchase cost must be a non-negative number' });
    if (purchaseDate && Number.isNaN(Date.parse(purchaseDate))) return res.status(400).json({ success: false, message: 'Invalid purchase date' });
    if (warrantyExpiry && Number.isNaN(Date.parse(warrantyExpiry))) return res.status(400).json({ success: false, message: 'Invalid warranty expiry date' });
    if (purchaseDate && warrantyExpiry && new Date(warrantyExpiry) < new Date(purchaseDate)) return res.status(400).json({ success: false, message: 'Warranty expiry cannot precede purchase date' });

    const duplicate = await Asset.findOne({
      where: { [Op.or]: [{ assetCode }, ...(serialNumber ? [{ serialNumber }] : []), ...(rfidTag ? [{ rfidTag }] : [])] },
      transaction,
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'Asset code, serial number, or RFID tag already exists' });

    const digitalId = body.digitalId || body.digital_id || await nextDigitalId(transaction);
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
    if (serialNumber && quantity !== 1) return res.status(422).json({ success: false, message: 'Serialized assets must have a quantity of one' });

    const asset = await Asset.create({
      name,
      assetCode,
      digitalId,
      category: body.category || body.category_id || '',
      subcategory: body.subcategory || '',
      unit: body.unit || 'unit',
      description: body.description || '',
      serialNumber,
      rfidTag,
      department: body.department || body.department_id || '',
      collegeId: scopedRole ? collegeId : (body.collegeId || body.college_id || null),
      departmentId: body.departmentId || body.department_id || null,
      campusId: body.campusId || body.campus_id || null,
      buildingId: body.buildingId || body.building_id || null,
      roomId: body.roomId || body.room_id || null,
      location: body.location || '',
      quantity,
      specifications: body.specifications || null,
      fundingSource: body.fundingSource || body.funding_source || '',
      condition: body.condition || body.condition_status || 'Good',
      status: body.status || 'available',
      purchaseDate,
      expiryDate: body.expiryDate || body.expiry_date || null,
      batchLot: body.batchLot || body.batch_lot || null,
      purchasePrice: Number(purchasePrice),
      supplier: body.supplier || '',
      manufacturer: body.manufacturer || body.brand || '',
      model: body.model || '',
      warrantyExpiry,
      notes: body.notes || '',
      createdBy: req.user.id,
    }, { transaction });
    await Inventory.create({
      assetId: asset.id,
      quantity: Number(req.body.quantity || 1),
      availableQuantity: Number(req.body.quantity || 1),
      departmentId: req.body.departmentId || null,
      location: req.body.location || '',
    }, { transaction });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, newValue: asset.toJSON(), details: { assetId: asset.id }, transaction });
    await transaction.commit();
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    await transaction.rollback();
    console.error('Asset creation failed:', error);
    res.status(500).json({ success: false, message: 'Unable to create asset.' });
  }
};

const updatableAssetFields = ['assetCode', 'digitalId', 'name', 'category', 'subcategory', 'unit', 'description', 'serialNumber', 'rfidTag', 'status', 'condition', 'department', 'collegeId', 'departmentId', 'campusId', 'buildingId', 'roomId', 'location', 'quantity', 'specifications', 'fundingSource', 'purchaseDate', 'expiryDate', 'batchLot', 'purchasePrice', 'supplier', 'manufacturer', 'model', 'warrantyExpiry', 'notes', 'currentValue', 'healthScore'];

const updateAsset = async (req, res) => {
  try {
    const scopedRole = isCollegeScopedRole(req.user?.role);
    const collegeId = scopedRole ? getCollegeScopeId(req) : null;
    if (scopedRole && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const providedCollegeId = req.body?.collegeId ?? req.body?.college_id;
    if (scopedRole && (req.body?.collegeId !== undefined || req.body?.college_id !== undefined) && Number(providedCollegeId) !== collegeId) return res.status(403).json({ success: false, message: 'Asset College is outside your organization scope' });
    const asset = collegeId
      ? await Asset.findOne({ where: { id: req.params.id, collegeId } })
      : await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const previousValue = asset.toJSON();
    const updates = {};
    const aliases = {
      asset_id: 'assetCode', serial_number: 'serialNumber', rfid_tag: 'rfidTag',
      condition_status: 'condition', purchase_cost: 'purchasePrice', warranty_expiry: 'warrantyExpiry',
      expiry_date: 'expiryDate', batch_lot: 'batchLot', college_id: 'collegeId',
    };
    for (const [alias, field] of Object.entries(aliases)) {
      if (req.body[alias] !== undefined) updates[field] = req.body[alias];
    }
    for (const field of updatableAssetFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (scopedRole) updates.collegeId = collegeId;
    for (const field of ['purchasePrice', 'currentValue', 'quantity', 'healthScore']) {
      if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
        const value = Number(updates[field]);
        if (!Number.isFinite(value) || value < 0) return res.status(422).json({ success: false, message: `${field} must be a non-negative number` });
        updates[field] = value;
      }
    }
    for (const field of ['purchaseDate', 'warrantyExpiry']) {
      if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '' && Number.isNaN(Date.parse(updates[field]))) {
        return res.status(422).json({ success: false, message: `${field} must be a valid date` });
      }
    }
    const serialNumber = String(updates.serialNumber ?? asset.serialNumber ?? '').trim();
    const quantity = Number(updates.quantity ?? asset.quantity ?? 1);
    if (serialNumber && quantity !== 1) return res.status(422).json({ success: false, message: 'Serialized assets must have a quantity of one' });
    if (serialNumber && serialNumber !== String(asset.serialNumber || '').trim()) {
      const duplicate = await Asset.findOne({ where: { serialNumber, id: { [Op.ne]: asset.id } } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Serial number already exists' });
    }
    await asset.update(updates);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: asset.toJSON(), details: { assetId: asset.id } });
    res.json({ success: true, data: serializeAsset(asset) });
  } catch (error) {
    console.error('Asset update failed:', error);
    res.status(500).json({ success: false, message: 'Unable to update asset.' });
  }
};

const deleteAsset = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const previousValue = asset.toJSON();
    await asset.update({ deletedBy: req.user.id }, { transaction });
    await asset.destroy({ transaction });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DELETE_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: asset.toJSON(), details: { assetId: asset.id }, transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Asset soft-deleted. It can be restored within 30 days.', data: serializeAsset(asset) });
  } catch (error) {
    await transaction.rollback();
    if (next) return next(error);
    console.error('Asset deletion failed:', error);
    res.status(500).json({ success: false, message: 'Unable to delete asset.' });
  }
};

const getNextAssetId = async (req, res) => {
  const count = await Asset.count();
  res.json({ success: true, asset_id: `ICT-${String(count + 1).padStart(6, '0')}` });
};

const checkAssetField = (field) => async (req, res, next) => {
  try {
    const exists = await Asset.count({ where: { [field]: req.params.value } });
    res.json({ success: true, exists: exists > 0 });
  } catch (error) { next(error); }
};

const getAssetHistory = async (req, res, next) => {
  try {
    const assetId = Number(req.params.id);
    const collegeId = isCollegeScopedRole(req.user?.role) ? getCollegeScopeId(req) : null;
    if (isCollegeScopedRole(req.user?.role) && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const asset = collegeId
      ? await Asset.findOne({ where: { id: assetId, collegeId }, attributes: ['id', 'department', 'collegeId'] })
      : await Asset.findByPk(assetId, { attributes: ['id', 'department', 'collegeId'] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const [assignments, transfers, maintenance, rfid, audits] = await Promise.all([
      Assignment.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      Transfer.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      Maintenance.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      RFIDLog.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      AuditLog.findAll({ where: { entity: `asset:${assetId}` }, order: [['createdAt', 'DESC']] }),
    ]);
    const history = [
      ...assignments.map(item => ({ action: item.status === 'returned' ? 'Asset Returned' : 'Asset Assigned', description: item.notes || '', performedBy: item.assignedBy, date: item.createdAt, previousValue: null, newValue: item.assignedTo, type: item.status === 'returned' ? 'returned' : 'assigned' })),
      ...transfers.map(item => ({ action: 'Asset Transferred', description: item.transferReason, performedBy: item.createdBy, date: item.createdAt, previousValue: item.sourceDepartment, newValue: item.destinationDepartment, type: 'transferred' })),
      ...maintenance.map(item => ({ action: 'Maintenance', description: item.title, performedBy: item.requestedBy, date: item.createdAt, previousValue: null, newValue: item.status, type: 'maintained' })),
      ...rfid.map(item => ({ action: 'RFID Scan', description: item.notes, performedBy: null, date: item.createdAt, previousValue: null, newValue: item.tag, type: 'rfid' })),
      ...audits.map(item => ({ action: item.action, description: item.entity, performedBy: item.userId, date: item.createdAt, previousValue: item.details, newValue: null, type: item.action.toLowerCase() })),
    ].sort((left, right) => new Date(right.date) - new Date(left.date));
    res.json({ success: true, history });
  } catch (error) { next(error); }
};

module.exports = { getAllAssets, getAssetById, createAsset, updateAsset, deleteAsset, getNextAssetId, checkAssetField, getAssetHistory };
