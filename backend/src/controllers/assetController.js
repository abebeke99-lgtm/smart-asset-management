const { sequelize, Asset, Inventory, Assignment, Transfer, Maintenance, RFIDLog, AuditLog, User, Department } = require('../models');
const { Op } = require('sequelize');
const { nextDigitalId } = require('./assetExtendedController');

const serializeAsset = (asset, assignment = null) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  return {
    ...data,
    asset_tag: data.assetCode,
    serial_number: data.serialNumber,
    rfid_tag: data.rfidTag,
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
    const where = {};
    if (req.user.role === 'college' && req.query.department && req.query.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    const department = req.user.role === 'college' ? req.user.department : req.query.department;
    if (department) where.department = department;
    if (req.query.status) where.status = { [Op.in]: [req.query.status, String(req.query.status).toLowerCase(), String(req.query.status).replace(/[_ ]/g, '-').toLowerCase()] };
    if (req.query.category) where.category = req.query.category;
    if (req.query.location) where.location = req.query.location;
    if (req.query.condition) where.condition = { [Op.in]: [req.query.condition, String(req.query.condition).toLowerCase()] };
    if (req.query.department_id) {
      const department = await Department.findByPk(req.query.department_id);
      if (department) where.department = department.name;
    }
    if (req.query.search) {
      const search = String(req.query.search).trim();
      const matchingUsers = await User.findAll({ where: { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] });
      const matchingAssignments = matchingUsers.length ? await Assignment.findAll({ where: { assignedTo: { [Op.in]: matchingUsers.map(item => item.id) }, status: 'active' }, attributes: ['assetId'] }) : [];
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { id: { [Op.in]: matchingAssignments.map(item => item.assetId) } },
      ];
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 10));
    const sortFields = { name: 'name', created_at: 'createdAt', createdAt: 'createdAt', current_value: 'currentValue', status: 'status' };
    const orderField = sortFields[req.query.sort_by] || 'id';
    const orderDirection = String(req.query.sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const { count, rows } = await Asset.findAndCountAll({ where, order: [[orderField, orderDirection]], limit, offset: (page - 1) * limit });
    const summaryRows = await Asset.findAll({ attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((counts, asset) => {
      const status = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
      const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status === 'lost' || status === 'missing' ? 'missing' : status === 'disposed' || status === 'retired' ? 'retired' : status;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, { available: 0, assigned: 0, maintenance: 0, damaged: 0, missing: 0, retired: 0 });
    const assignments = await Assignment.findAll({ where: { status: 'active', assetId: { [Op.in]: rows.map(asset => asset.id) } }, include: [{ model: User, attributes: ['username', 'fullName'] }] });
    const serialized = rows.map(asset => serializeAsset(asset, assignments.find(assignment => assignment.assetId === asset.id)));
    res.json({ success: true, data: serialized, assets: serialized, total: count, summary: { total: summaryRows.length, ...summary }, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (req.user.role === 'college' && asset.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    const assignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['username', 'fullName'] }] });
    res.json({ success: true, data: serializeAsset(asset, assignment), asset: serializeAsset(asset, assignment) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAsset = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body || {};
    const assetCode = String(body.assetCode || body.asset_id || '').trim();
    const serialNumber = String(body.serialNumber || body.serial_number || '').trim();
    const rfidTag = String(body.rfidTag || body.rfid_tag || '').trim();
    const name = String(body.name || '').trim();
    const purchasePrice = body.purchasePrice ?? body.purchase_cost ?? 0;
    const purchaseDate = body.purchaseDate || body.purchase_date || null;
    const warrantyExpiry = body.warrantyExpiry || body.warranty_expiry || null;

    if (!name || !assetCode) return res.status(400).json({ success: false, message: 'Asset name and code are required' });
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

    const asset = await Asset.create({
      name,
      assetCode,
      digitalId,
      category: body.category || body.category_id || '',
      description: body.description || '',
      serialNumber,
      rfidTag,
      department: body.department || body.department_id || '',
      collegeId: body.collegeId || body.college_id || null,
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
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, newValue: asset.toJSON() }) }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatableAssetFields = ['assetCode', 'digitalId', 'name', 'category', 'description', 'serialNumber', 'rfidTag', 'status', 'condition', 'department', 'collegeId', 'departmentId', 'campusId', 'buildingId', 'roomId', 'location', 'quantity', 'specifications', 'fundingSource', 'purchaseDate', 'purchasePrice', 'supplier', 'manufacturer', 'model', 'warrantyExpiry', 'notes', 'currentValue', 'healthScore'];

const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const previousValue = asset.toJSON();
    const updates = {};
    const aliases = {
      asset_id: 'assetCode', serial_number: 'serialNumber', rfid_tag: 'rfidTag',
      condition_status: 'condition', purchase_cost: 'purchasePrice', warranty_expiry: 'warrantyExpiry',
    };
    for (const [alias, field] of Object.entries(aliases)) {
      if (req.body[alias] !== undefined) updates[field] = req.body[alias];
    }
    for (const field of updatableAssetFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
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
    await asset.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: asset.toJSON() }) });
    res.json({ success: true, data: serializeAsset(asset) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAsset = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const previousValue = asset.toJSON();
    const updates = { deletedBy: req.user.id };
    if (asset.status !== 'disposed') updates.status = 'disposed';
    await asset.update(updates, { transaction });
    await asset.destroy({ transaction });
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, deletedAt: new Date(), previousValue, newValue: asset.toJSON() }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Asset soft-deleted. It can be restored within 30 days.', data: serializeAsset(asset) });
  } catch (error) {
    await transaction.rollback();
    if (next) return next(error);
    res.status(500).json({ success: false, message: error.message });
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
    const asset = await Asset.findByPk(assetId, { attributes: ['id', 'department'] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (req.user.role === 'college' && asset.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Department access denied' });
    }
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
