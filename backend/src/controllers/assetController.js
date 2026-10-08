const { sequelize, Asset, AssetDocument, Inventory, Assignment, Transfer, Maintenance, RFIDLog, AuditLog, User, Department, College, Campus, Building, Room, Category } = require('../models');
const { Op } = require('sequelize');
const { nextDigitalId, buildAssetCodeFromConfig } = require('./assetExtendedController');
const { createAuditLog } = require('../services/auditLogService');
const { saveAssetDocument, removeStoredAssetDocument } = require('../services/assetDocumentStorage');
const { getRecoveryDays } = require('../services/assetRetentionService');
const { isCollegeScopedRole, getCollegeScopeId } = require('../middlewares/organizationScope');

const serializeAsset = (asset, assignment = null, laboratoryName = null) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const assignedToType = String(assignment?.assignedToType || 'user').toLowerCase();
  const assignedToName = assignedToType === 'department'
    ? assignment?.AssignedDepartment?.name || null
    : assignedToType === 'laboratory'
      ? assignment?.AssignedLaboratory?.roomName || null
      : assignment?.User?.fullName || assignment?.User?.username || null;
  return {
    ...data,
    asset_tag: data.assetCode,
    serial_number: data.serialNumber,
    rfid_tag: data.rfidTag,
    qrCode: data.qrCode || data.digitalId,
    condition: data.condition,
    condition_status: data.condition,
    department_name: data.department,
    purchase_date: data.purchaseDate,
    purchase_cost: Number(data.purchasePrice || 0),
    current_value: Number(data.currentValue || 0),
    warranty_expiry: data.warrantyExpiry,
    manufacturer: data.manufacturer,
    is_assigned: Boolean(assignment),
    assigned_to_name: assignedToName,
    assigned_to_type: assignment ? assignedToType : null,
    assigned_to_id: assignment?.assignedToId || assignment?.assignedTo || null,
    assigned_date: assignment?.assignedDate || assignment?.createdAt || null,
    campusName: data.CampusRecord?.campusName || null,
    collegeName: data.College?.collegeName || null,
    departmentName: data.DepartmentRecord?.name || data.department || null,
    laboratoryName: laboratoryName || (String(data.RoomRecord?.roomType || '').toLowerCase().includes('lab') ? data.RoomRecord.roomName : null),
    buildingName: data.BuildingRecord?.buildingName || null,
    roomName: data.RoomRecord?.roomName || null,
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
    const departmentHeadDepartmentId = req.user?.role === 'department_head'
      ? Number(req.organizationScope?.departmentId)
      : null;
    if (req.user?.role === 'department_head'
      && (!Number.isSafeInteger(departmentHeadDepartmentId) || departmentHeadDepartmentId < 1)) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    if (departmentHeadDepartmentId) {
      if (query.department_id && Number(query.department_id) !== departmentHeadDepartmentId) {
        return res.status(403).json({ success: false, message: 'Department is outside your organization scope' });
      }
      where.departmentId = departmentHeadDepartmentId;
      if (req.organizationScope.collegeId) where.collegeId = req.organizationScope.collegeId;
    }
    const teachingAssistantDepartmentId = req.user?.role === 'teaching_assistant'
      ? Number(req.organizationScope?.departmentId)
      : null;
    if (req.user?.role === 'teaching_assistant' && (!Number.isSafeInteger(teachingAssistantDepartmentId) || teachingAssistantDepartmentId < 1)) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    const department = req.user?.role === 'teaching_assistant'
      ? req.organizationScope.department.name
      : query.department;
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
    if (teachingAssistantDepartmentId) {
      where.departmentId = teachingAssistantDepartmentId;
      if (req.organizationScope.collegeId) where.collegeId = req.organizationScope.collegeId;
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
        { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName'], required: false },
        { model: College, attributes: ['id', 'collegeName'], required: false },
        { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false },
        { model: Building, as: 'BuildingRecord', attributes: ['id', 'buildingName'], required: false },
        { model: Room, as: 'RoomRecord', attributes: ['id', 'roomName', 'roomType', 'departmentId', 'buildingId'], required: false },
        { model: AssetDocument, where: { status: 'active' }, required: false },
      ],
      ...(includeDeleted ? { paranoid: false } : {}),
      distinct: true,
      order: [[orderField, orderDirection]],
      limit,
      offset: (page - 1) * limit,
    });
    const summaryWhere = {
      ...(collegeId ? { collegeId } : {}),
      ...(departmentHeadDepartmentId ? { departmentId: departmentHeadDepartmentId } : {}),
      ...(departmentHeadDepartmentId && req.organizationScope.collegeId
        ? { collegeId: req.organizationScope.collegeId }
        : {}),
      ...(teachingAssistantDepartmentId ? { departmentId: teachingAssistantDepartmentId } : {}),
      ...(teachingAssistantDepartmentId && req.organizationScope.collegeId
        ? { collegeId: req.organizationScope.collegeId }
        : {}),
    };
    const summaryRows = await Asset.findAll({ attributes: ['status'], raw: true, ...(Object.keys(summaryWhere).length ? { where: summaryWhere } : {}) });
    const summary = summaryRows.reduce((counts, asset) => {
      const status = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
      const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status === 'lost' || status === 'missing' ? 'missing' : status === 'disposed' || status === 'retired' ? 'retired' : status;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, { available: 0, assigned: 0, maintenance: 0, damaged: 0, missing: 0, retired: 0 });
    const assignments = await Assignment.findAll({
      where: { status: 'active', assetId: { [Op.in]: rows.map(asset => asset.id) } },
      include: [
        { model: User, attributes: ['username', 'fullName'], required: false },
        { model: Department, as: 'AssignedDepartment', attributes: ['id', 'name'], required: false },
        { model: Room, as: 'AssignedLaboratory', attributes: ['id', 'roomName'], required: false },
      ],
    });
    const laboratoryIds = rows.map((asset) => Number(asset.specifications?.laboratoryId || asset.roomId)).filter(Number.isInteger);
    const laboratories = laboratoryIds.length ? await Room.findAll({
      where: { id: { [Op.in]: laboratoryIds } },
      attributes: ['id', 'roomName', 'roomType'],
    }) : [];
    const laboratoryNames = new Map(laboratories
      .filter((laboratory) => String(laboratory.roomType || '').toLowerCase().includes('lab'))
      .map((laboratory) => [Number(laboratory.id), laboratory.roomName]));
    const serialized = rows.map(asset => serializeAsset(
      asset,
      assignments.find(assignment => assignment.assetId === asset.id),
      laboratoryNames.get(Number(asset.specifications?.laboratoryId || asset.roomId)) || null,
    ));
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
        { model: AssetDocument, where: { status: 'active' }, required: false },
      ],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const assignment = await Assignment.findOne({
      where: { assetId: asset.id, status: 'active' },
      include: [
        { model: User, attributes: ['username', 'fullName'], required: false },
        { model: Department, as: 'AssignedDepartment', attributes: ['id', 'name'], required: false },
        { model: Room, as: 'AssignedLaboratory', attributes: ['id', 'roomName'], required: false },
      ],
    });
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
  let savedManual;
  try {
    const providedAssetCode = String(body.assetCode || body.asset_id || '').trim();
    const serialNumber = String(body.serialNumber || body.serial_number || '').trim();
    const rfidTag = String(body.rfidTag || body.rfid_tag || '').trim() || null;
    const name = String(body.name || '').trim();
    const purchasePrice = body.purchasePrice ?? body.purchase_cost ?? 0;
    const purchaseDate = body.purchaseDate || body.purchase_date || null;
    const warrantyExpiry = body.warrantyExpiry || body.warranty_expiry || null;
    const adminRegistration = req.user?.role === 'admin';
    const requiredFields = [
      ['name', name],
      ['category', body.category],
      ['serialNumber', serialNumber],
      ['purchaseDate', purchaseDate],
      ['campusId', body.campusId ?? body.campus_id],
      ['collegeId', body.collegeId ?? body.college_id],
      ['departmentId', body.departmentId ?? body.department_id],
      ['laboratoryId', body.laboratoryId ?? body.laboratory_id],
      ['buildingId', body.buildingId ?? body.building_id],
      ['roomId', body.roomId ?? body.room_id],
      ['status', body.status],
      ['fundingSource', body.fundingSource ?? body.funding_source],
      ['warrantyCoverage', body.warrantyCoverage ?? body.warranty_coverage],
      ['equipmentManual', body.equipmentManual],
    ];
    if (adminRegistration) {
      const missingField = requiredFields.find(([, value]) => value === undefined || value === null || String(value).trim() === '');
      if (missingField) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `${missingField[0]} is required` });
      }
    } else if (!name) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Asset name is required' });
    }

    if (adminRegistration) {
      const [category, campus, college, department, laboratory, building, room] = await Promise.all([
        Category.findOne({ where: { name: String(body.category).trim(), status: 'active' }, transaction }),
        Campus.findByPk(body.campusId ?? body.campus_id, { transaction }),
        College.findByPk(body.collegeId ?? body.college_id, { transaction }),
        Department.findByPk(body.departmentId ?? body.department_id, { transaction }),
        Room.findByPk(body.laboratoryId ?? body.laboratory_id, { transaction }),
        Building.findByPk(body.buildingId ?? body.building_id, { transaction }),
        Room.findByPk(body.roomId ?? body.room_id, { transaction }),
      ]);
      if (!category) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Select an active asset category' }); }
      if (!campus || !college || !department || !laboratory || !building || !room) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Select valid campus, college, department, laboratory, building, and room records' });
      }
      if ([campus, college, department, laboratory, building, room].some((record) => record.status !== 'active')) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Select only active organization and location records' });
      }
      if (Number(building.campusId) !== Number(campus.id)
        || Number(room.buildingId) !== Number(building.id)
        || Number(room.campusId || building.campusId) !== Number(campus.id)
        || Number(laboratory.buildingId) !== Number(building.id)
        || Number(laboratory.id) !== Number(room.id)
        || !String(laboratory.roomType || '').toLowerCase().includes('lab')
        || Number(department.collegeId) !== Number(college.id)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Selected organization and location values do not match their hierarchy' });
      }
      if (!['available', 'in-use', 'under-maintenance', 'damaged'].includes(String(body.status).toLowerCase())) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Select a valid initial asset status' });
      }
      if (String(body.warrantyCoverage).toLowerCase() !== 'none' && (!warrantyExpiry || Number.isNaN(Date.parse(warrantyExpiry)))) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Select a valid warranty coverage period' });
      }
      if (String(body.warrantyCoverage).toLowerCase() === 'none' && warrantyExpiry) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Warranty expiry must be empty when no warranty is selected' });
      }
    }

    const quantity = Number(body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
    }
    if (adminRegistration && serialNumber && quantity !== 1) {
      await transaction.rollback();
      return res.status(422).json({ success: false, message: 'Serialized assets must have a quantity of one' });
    }
    const fundingSource = String(body.fundingSource ?? body.funding_source ?? '').trim();
    const normalizedFundingSource = /^none$/i.test(fundingSource) ? '' : fundingSource;
    const digitalId = body.digitalId || body.digital_id || await nextDigitalId(transaction);
    const configuredAssetCode = await buildAssetCodeFromConfig({ category: body.category || body.category_id || '', transaction });
    const assetCode = providedAssetCode || configuredAssetCode || digitalId;
    if (!assetCode) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset code could not be generated' }); }
    if (!Number.isFinite(Number(purchasePrice)) || Number(purchasePrice) < 0) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Purchase cost must be a non-negative number' }); }
    if (purchaseDate && Number.isNaN(Date.parse(purchaseDate))) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid purchase date' }); }
    if (warrantyExpiry && Number.isNaN(Date.parse(warrantyExpiry))) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid warranty expiry date' }); }
    if (purchaseDate && warrantyExpiry && new Date(warrantyExpiry) < new Date(purchaseDate)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Warranty expiry cannot precede purchase date' }); }

    const duplicate = await Asset.findOne({
      where: { [Op.or]: [{ assetCode }, ...(serialNumber ? [{ serialNumber }] : []), ...(rfidTag ? [{ rfidTag }] : [])] },
      transaction,
    });
    if (duplicate) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset code, serial number, or RFID tag already exists' }); }

    if (adminRegistration) savedManual = saveAssetDocument(body.equipmentManual, 'assets');

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
      specifications: {
        ...(body.specifications && typeof body.specifications === 'object' ? body.specifications : {}),
        ...(body.laboratoryId || body.laboratory_id ? { laboratoryId: Number(body.laboratoryId || body.laboratory_id) } : {}),
        ...(body.warrantyCoverage !== undefined ? { warrantyCoverage: String(body.warrantyCoverage) } : {}),
      },
      fundingSource: normalizedFundingSource,
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
    if (savedManual) {
      await AssetDocument.create({
        assetId: asset.id,
        documentType: 'manual',
        originalName: savedManual.originalName,
        storedName: savedManual.storedName,
        mimeType: savedManual.mimeType,
        fileSize: savedManual.fileSize,
        filePath: savedManual.filePath,
        uploadedBy: req.user.id,
      }, { transaction });
    }
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
    if (savedManual?.absolutePath) {
      try {
        await removeStoredAssetDocument(savedManual.absolutePath);
      } catch (cleanupError) {
        console.error('Failed to remove an uncommitted asset manual:', cleanupError);
      }
    }
    console.error('Asset creation failed:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Unable to create asset.' });
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
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DELETE_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: asset.toJSON(), details: { assetId: asset.id, recoveryDays }, transaction });
    await transaction.commit();
    res.json({ success: true, message: `Asset soft-deleted. It can be restored within ${recoveryDays} days.`, data: serializeAsset(asset) });
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
      ? await Asset.findOne({ where: { id: assetId, collegeId }, attributes: ['id', 'department', 'collegeId'], paranoid: false })
      : await Asset.findByPk(assetId, { attributes: ['id', 'department', 'collegeId'], paranoid: false });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const [assignments, transfers, maintenance, rfid, audits] = await Promise.all([
      Assignment.findAll({
        where: { assetId },
        include: [
          { model: User, attributes: ['id', 'fullName', 'username'], required: false },
          { model: Department, as: 'AssignedDepartment', attributes: ['id', 'name'], required: false },
          { model: Room, as: 'AssignedLaboratory', attributes: ['id', 'roomName'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      }),
      Transfer.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      Maintenance.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      RFIDLog.findAll({ where: { assetId }, order: [['createdAt', 'DESC']] }),
      AuditLog.findAll({ where: { entity: `asset:${assetId}`, action: { [Op.notIn]: ['ASSIGN_ASSET', 'TRANSFER_ASSET'] } }, order: [['createdAt', 'DESC']] }),
    ]);
    const history = [
      ...assignments.map((item) => {
        const targetType = String(item.assignedToType || 'user').toLowerCase();
        const targetName = targetType === 'department'
          ? item.AssignedDepartment?.name
          : targetType === 'laboratory'
            ? item.AssignedLaboratory?.roomName
            : item.User?.fullName || item.User?.username;
        return {
          action: item.status === 'returned' ? 'Asset Returned' : item.workflowStatus === 'reassigned' ? 'Asset Reassigned' : 'Asset Assigned',
          description: targetName || '',
          performedBy: item.assignedBy,
          date: item.assignedDate || item.createdAt,
          previousValue: null,
          newValue: { type: targetType, id: item.assignedToId || item.assignedTo, name: targetName || null },
          type: item.status === 'returned' ? 'returned' : item.workflowStatus === 'reassigned' ? 'reassigned' : 'assigned',
        };
      }),
      ...transfers.map(item => ({ action: 'Asset Transferred', description: item.transferReason, performedBy: item.createdBy, date: item.createdAt, previousValue: item.sourceDepartment, newValue: item.destinationDepartment, type: 'transferred' })),
      ...maintenance.map(item => ({ action: 'Maintenance', description: item.title, performedBy: item.requestedBy, date: item.createdAt, previousValue: null, newValue: item.status, type: 'maintained' })),
      ...rfid.map(item => ({ action: 'RFID Scan', description: item.notes, performedBy: null, date: item.createdAt, previousValue: null, newValue: item.tag, type: 'rfid' })),
      ...audits.map((item) => {
        let details = {};
        try { details = JSON.parse(item.details || '{}'); } catch (error) { details = { value: item.details || '' }; }
        return {
          action: item.action,
          description: item.entity,
          performedBy: item.userId,
          date: item.createdAt,
          previousValue: details.previousValue ?? details.oldValue ?? null,
          newValue: details.newValue ?? details.new_value ?? null,
          type: String(item.action || '').toLowerCase(),
        };
      }),
    ].sort((left, right) => new Date(right.date) - new Date(left.date));
    res.json({ success: true, history });
  } catch (error) { next(error); }
};

module.exports = { getAllAssets, getAssetById, createAsset, updateAsset, deleteAsset, getNextAssetId, checkAssetField, getAssetHistory };
