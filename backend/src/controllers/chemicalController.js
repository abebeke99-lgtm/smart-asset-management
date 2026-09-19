const { Op, Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  Chemical,
  ChemicalTransaction,
  ChemicalTransfer,
  ChemicalDocument,
  HazardousWaste,
  StockOrder,
  User,
  Campus,
  Building,
  Room,
  AuditLog,
} = require('../models');
const { createBulkNotification } = require('../services/notificationService');

const ALLOWED_UNITS = ['L', 'mL', 'g', 'mg', 'kg', 'UNITS'];
const ALLOWED_STATES = ['solid', 'liquid', 'gas', 'mixed'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const normalizeUnit = (unit) => String(unit || 'L').trim();
const isExpired = (chemical, referenceDate = new Date()) => {
  if (!chemical.expirationDate) return false;
  return new Date(chemical.expirationDate) < new Date(referenceDate.toISOString().slice(0, 10));
};
const isLowStock = (chemical) => {
  const capacity = Number(chemical.capacity) > 0 ? Number(chemical.capacity) : null;
  const quantity = Number(chemical.quantity) || 0;
  if (!capacity) return false;
  const threshold = (capacity * (Number(chemical.lowStockThreshold) || 10)) / 100;
  return quantity <= threshold;
};
const uniqueRef = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 90) + 10)}`;
const ensureUploadDir = (subdir) => {
  const target = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', subdir);
  fs.mkdirSync(target, { recursive: true });
  return target;
};
const saveBase64File = ({ fileName = '', mimeType = '', data = '' }, subdir) => {
  const mime = String(mimeType || '').split(';')[0].trim();
  if (!ALLOWED_DOC_TYPES.includes(mime)) {
    const error = new Error(`Unsupported file type: ${mime || 'unknown'}. Allowed: PDF, JPG, PNG, WEBP.`);
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) {
    const error = new Error('File is empty or exceeds the 5 MB limit');
    error.statusCode = 400;
    throw error;
  }
  const ext = String(fileName).split('.').pop() || (mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] || 'bin');
  const storedName = `${Date.now()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}.${ext}`;
  const dir = ensureUploadDir(subdir);
  const fullPath = path.join(dir, storedName);
  fs.writeFileSync(fullPath, buffer);
  const relativePath = path.posix.join('uploads', subdir, storedName);
  return { originalName: String(fileName || storedName), storedName, mimeType: mime, fileSize: buffer.length, filePath: relativePath };
};

const serializeChemical = (chemical) => {
  const data = chemical.toJSON();
  const lowStock = isLowStock(chemical);
  const expired = isExpired(chemical);
  return {
    ...data,
    quantity: Number(data.quantity),
    capacity: data.capacity === null ? null : Number(data.capacity),
    low_stock: lowStock,
    low_stock_source: lowStock ? (Number(data.quantity) <= 0 ? 'ZERO_STOCK' : 'BELOW_THRESHOLD') : 'OK',
    expired,
    quarantine_source: data.quarantine ? (data.quarantineReason || 'quarantined') : null,
    status: expired ? 'expired' : data.quarantine ? 'quarantined' : lowStock ? 'low-stock' : data.status || 'active',
  };
};

const listChemicals = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const where = {};
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { chemicalCode: { [Op.like]: `%${search}%` } },
        { formula: { [Op.like]: `%${search}%` } },
        { casNumber: { [Op.like]: `%${search}%` } },
      ];
    }
    if (req.query.ghs_hazard_class || req.query.ghsHazardClass) where.ghsHazardClass = { [Op.like]: `%${req.query.ghs_hazard_class || req.query.ghsHazardClass}%` };
    if (req.query.state) where.state = String(req.query.state).toLowerCase();
    if (req.query.status === 'expired') where.quarantine = true;
    if (req.query.quarantine === 'true') where.quarantine = true;
    if (req.query.low_stock === 'true' || req.query.lowStock === 'true') {
      const chemicalsForThreshold = await Chemical.findAll({ where: { ...where, capacity: { [Op.gt]: 0 } }, attributes: ['id', 'quantity', 'capacity', 'lowStockThreshold'] });
      const ids = chemicalsForThreshold.filter(isLowStock).map((chemical) => chemical.id);
      where.id = { [Op.in]: ids.length ? ids : [-1] };
    }
    if (req.query.category) where.category = { [Op.like]: `%${req.query.category}%` };
    if (req.query.room_id) where.roomId = req.query.room_id;
    if (req.query.department_id) where.departmentId = req.query.department_id;
    const { count, rows } = await Chemical.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    const data = rows.map(serializeChemical);
    const all = await Chemical.findAll({ where });
    const summary = {
      total: all.length,
      lowStock: all.filter(isLowStock).length,
      expired: all.filter((chemical) => isExpired(chemical)).length,
      quarantined: all.filter((chemical) => chemical.quarantine).length,
      zeroStock: all.filter((chemical) => Number(chemical.quantity) <= 0).length,
    };
    res.json({ success: true, data, chemicals: data, total: count, summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getChemical = async (req, res, next) => {
  try {
    const chemical = await Chemical.findByPk(req.params.id);
    if (!chemical) return res.status(404).json({ success: false, message: 'Chemical not found' });
    const [transactions, transfers, documents, wastes] = await Promise.all([
      ChemicalTransaction.findAll({ where: { chemicalId: chemical.id }, order: [['createdAt', 'DESC']], limit: 100 }),
      ChemicalTransfer.findAll({ where: { chemicalId: chemical.id }, order: [['createdAt', 'DESC']], limit: 50 }),
      ChemicalDocument.findAll({ where: { chemicalId: chemical.id, status: 'active' } }),
      HazardousWaste.findAll({ where: { chemicalId: chemical.id }, order: [['createdAt', 'DESC']], limit: 50 }),
    ]);
    res.json({ success: true, data: serializeChemical(chemical), transactions, transfers, documents, wastes });
  } catch (error) { next(error); }
};

const scanChemical = async (req, res, next) => {
  try {
    const identifier = String(req.params.identifier || req.query.identifier || '').trim();
    if (!identifier) return res.status(400).json({ success: false, message: 'Identifier is required' });
    const chemical = await Chemical.findOne({
      where: { [Op.or]: [{ chemicalCode: identifier }, { casNumber: identifier }, { name: identifier }] },
      include: [
        { model: Room, as: 'RoomRecord', attributes: ['id', 'roomName', 'roomCode'] },
        { model: Building, as: 'BuildingRecord', attributes: ['id', 'buildingName', 'buildingCode'] },
        { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName', 'campusCode'] },
      ],
    });
    if (!chemical) return res.status(404).json({ success: false, message: 'Chemical not found for identifier' });
    res.json({ success: true, data: serializeChemical(chemical), chemical: serializeChemical(chemical) });
  } catch (error) { next(error); }
};

const createChemical = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Chemical name is required' });
    const unit = normalizeUnit(req.body.unit);
    if (!ALLOWED_UNITS.includes(unit)) return res.status(400).json({ success: false, message: 'Invalid unit. Allowed: L, mL, g, mg, kg, UNITS' });
    const state = String(req.body.state || 'liquid').toLowerCase();
    if (!ALLOWED_STATES.includes(state)) return res.status(400).json({ success: false, message: 'Invalid chemical state' });
    const quantity = Number(req.body.quantity ?? req.body.stock ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ success: false, message: 'Quantity must be a non-negative number' });
    const capacity = req.body.capacity === undefined || req.body.capacity === null || req.body.capacity === '' ? null : Number(req.body.capacity);
    if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
    if (req.body.expirationDate && Number.isNaN(Date.parse(req.body.expirationDate))) return res.status(400).json({ success: false, message: 'Invalid expiration date' });
    const chemicalCode = String(req.body.chemicalCode || req.body.code || '').trim().toUpperCase() || uniqueRef('CHEM');
    const duplicate = await Chemical.findOne({ where: { [Op.or]: [{ chemicalCode }, { name }] } });
    if (duplicate) return res.status(409).json({ success: false, message: 'Chemical code or name already exists' });

    const chemical = await Chemical.create({
      chemicalCode,
      name,
      formula: req.body.formula || '',
      casNumber: req.body.casNumber || req.body.cas_number || '',
      category: req.body.category || '',
      ghsHazardClass: req.body.ghsHazardClass || req.body.ghs_hazard_class || '',
      state,
      unit,
      quantity,
      capacity,
      lowStockThreshold: Number(req.body.lowStockThreshold || req.body.low_stock_threshold || 10),
      expirationDate: req.body.expirationDate || req.body.expiration_date || null,
      manufacturer: req.body.manufacturer || '',
      supplier: req.body.supplier || '',
      storageLocation: req.body.storageLocation || req.body.storage_location || '',
      hazardous: req.body.hazardous !== undefined ? Boolean(req.body.hazardous) : true,
      quarantine: req.body.quarantine ? true : false,
      quarantineReason: req.body.quarantineReason || '',
      departmentId: req.body.departmentId || req.body.department_id || null,
      collegeId: req.body.collegeId || req.body.college_id || null,
      campusId: req.body.campusId || req.body.campus_id || null,
      buildingId: req.body.buildingId || req.body.building_id || null,
      roomId: req.body.roomId || req.body.room_id || null,
      createdBy: req.user.id,
    });
    await ChemicalTransaction.create({ chemicalId: chemical.id, type: 'restock', quantity, unit, notes: 'Initial registration', recordedBy: req.user.id });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_CHEMICAL', entity: `chemical:${chemical.id}`, details: JSON.stringify({ chemicalId: chemical.id, newValue: chemical.toJSON() }) });
    res.status(201).json({ success: true, data: serializeChemical(chemical) });
  } catch (error) { next(error); }
};

const updateChemical = async (req, res, next) => {
  try {
    const chemical = await Chemical.findByPk(req.params.id);
    if (!chemical) return res.status(404).json({ success: false, message: 'Chemical not found' });
    if (chemical.quarantine && !req.body.quarantine && req.body.remove_quarantine !== true) {
      return res.status(409).json({ success: false, message: 'Quarantined chemical must be explicitly un-quarantined with remove_quarantine' });
    }
    const previousValue = chemical.toJSON();
    const updates = {};
    const passthrough = ['name', 'formula', 'casNumber', 'category', 'ghsHazardClass', 'manufacturer', 'supplier', 'storageLocation'];
    for (const field of passthrough) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (req.body.unit !== undefined) {
      const unit = normalizeUnit(req.body.unit);
      if (!ALLOWED_UNITS.includes(unit)) return res.status(400).json({ success: false, message: 'Invalid unit' });
      updates.unit = unit;
    }
    if (req.body.state !== undefined) {
      const state = String(req.body.state).toLowerCase();
      if (!ALLOWED_STATES.includes(state)) return res.status(400).json({ success: false, message: 'Invalid chemical state' });
      updates.state = state;
    }
    if (req.body.capacity !== undefined) {
      const capacity = req.body.capacity === null || req.body.capacity === '' ? null : Number(req.body.capacity);
      if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
      updates.capacity = capacity;
    }
    if (req.body.lowStockThreshold !== undefined) {
      const lowStockThreshold = Number(req.body.lowStockThreshold);
      if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 1 || lowStockThreshold > 100) return res.status(400).json({ success: false, message: 'Low stock threshold must be between 1 and 100 percent' });
      updates.lowStockThreshold = lowStockThreshold;
    }
    if (req.body.expirationDate !== undefined) {
      if (req.body.expirationDate && Number.isNaN(Date.parse(req.body.expirationDate))) return res.status(400).json({ success: false, message: 'Invalid expiration date' });
      updates.expirationDate = req.body.expirationDate || null;
    }
    if (req.body.hazardous !== undefined) updates.hazardous = Boolean(req.body.hazardous);
    if (req.body.remove_quarantine === true) {
      updates.quarantine = false;
      updates.quarantineReason = '';
    } else if (req.body.quarantine === true) {
      updates.quarantine = true;
      updates.quarantineReason = req.body.quarantineReason || 'Quarantined by user';
    }
    if (req.body.departmentId !== undefined) updates.departmentId = req.body.departmentId || null;
    if (req.body.collegeId !== undefined) updates.collegeId = req.body.collegeId || null;
    if (req.body.campusId !== undefined) updates.campusId = req.body.campusId || null;
    if (req.body.buildingId !== undefined) updates.buildingId = req.body.buildingId || null;
    if (req.body.roomId !== undefined) updates.roomId = req.body.roomId || null;
    await chemical.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_CHEMICAL', entity: `chemical:${chemical.id}`, details: JSON.stringify({ previousValue, newValue: chemical.toJSON() }) });
    res.json({ success: true, data: serializeChemical(chemical) });
  } catch (error) { next(error); }
};

const ensureExpiryLock = (chemical) => {
  if (isExpired(chemical)) {
    const error = new Error('This chemical has expired and is quarantined. Allocation is blocked.');
    error.statusCode = 409;
    throw error;
  }
  if (chemical.quarantine) {
    const error = new Error('This chemical is quarantined and cannot be allocated.');
    error.statusCode = 409;
    throw error;
  }
};

const consumeChemical = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const chemical = await Chemical.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!chemical) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Chemical not found' }); }
    ensureExpiryLock(chemical);
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Consumption quantity must be a positive number' }); }
    const current = Number(chemical.quantity);
    if (quantity > current) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Insufficient stock: have ${current}${chemical.unit}, request ${quantity}${chemical.unit}` }); }
    const previousValue = chemical.toJSON();
    const newQuantity = Number((current - quantity).toFixed(3));
    await chemical.update({ quantity: newQuantity }, { transaction });
    const materialized = { ...chemical.toJSON(), quantity: newQuantity };
    await ChemicalTransaction.create({
      chemicalId: chemical.id,
      type: 'consumption',
      quantity,
      unit: chemical.unit,
      laboratorySession: req.body.laboratorySession || req.body.session || '',
      notes: req.body.notes || '',
      recordedBy: req.user.id,
    }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CHEMICAL_CONSUMED', entity: `chemical:${chemical.id}`, details: JSON.stringify({ chemicalId: chemical.id, quantity, previousQuantity: current, newQuantity }) }, { transaction });
    await transaction.commit();

    const notifications = [];
    if (newQuantity <= 0) {
      const openOrder = await StockOrder.findOne({ where: { chemicalId: chemical.id, status: { [Op.in]: ['pending', 'approved'] } } });
      if (!openOrder) {
        const order = await StockOrder.create({ orderCode: uniqueRef('ORD'), chemicalId: chemical.id, itemType: 'chemical', itemName: chemical.name, quantity: chemical.capacity || 0, unit: chemical.unit, reason: 'stock reached zero (automatic order request)', requestedBy: null, status: 'pending' });
        notifications.push({ type: 'inventory', title: 'Automatic chemical order generated', message: `Stock for ${chemical.name} reached zero. Automatic order ${order.orderCode} was generated.` });
      } else {
        notifications.push({ type: 'inventory', title: 'Chemical stock empty', message: `Stock for ${chemical.name} is empty and an order request already exists (${openOrder.orderCode}).` });
      }
    } else if (isLowStock(materialized)) {
      notifications.push({ type: 'inventory', title: 'Low stock alert', message: `${chemical.name} is at low stock: ${newQuantity} ${chemical.unit} (below ${Number(chemical.lowStockThreshold) || 10}% of capacity ${chemical.capacity || 'n/a'}).` });
    }
    if (notifications.length && req.query.notify !== 'false') {
      try {
        await createBulkNotification({
          recipientType: 'role',
          roles: ['store_manager', 'admin'],
          title: notifications[0].title,
          message: notifications[0].message,
          type: 'inventory',
          priority: 'high',
          channel: 'in_app',
        }, req.user.id);
      } catch (notificationError) {
        console.error('Chemical stock notification failed:', notificationError.message);
      }
    }
    res.json({ success: true, data: serializeChemical(materialized), message: notifications[0]?.message || null });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const restockChemical = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const chemical = await Chemical.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!chemical) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Chemical not found' }); }
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Restock quantity must be a positive number' }); }
    const previousValue = chemical.toJSON();
    const newQuantity = Number((Number(chemical.quantity) + quantity).toFixed(3));
    await chemical.update({
      quantity: newQuantity,
      ...(chemical.quarantine && req.body.clear_quarantine === true ? { quarantine: false, quarantineReason: '' } : {}),
    }, { transaction });
    await ChemicalTransaction.create({ chemicalId: chemical.id, type: 'restock', quantity, unit: chemical.unit, notes: req.body.notes || '', recordedBy: req.user.id }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CHEMICAL_RESTOCKED', entity: `chemical:${chemical.id}`, details: JSON.stringify({ chemicalId: chemical.id, quantity, previousQuantity: previousValue.quantity, newQuantity }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, data: serializeChemical(await Chemical.findByPk(chemical.id)) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const adjustChemical = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const chemical = await Chemical.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!chemical) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Chemical not found' }); }
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Adjustment quantity must be a number' }); }
    const newQuantity = Number((Number(chemical.quantity) + quantity).toFixed(3));
    if (newQuantity < 0) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Adjustment would result in negative stock' }); }
    const previousValue = chemical.toJSON();
    await chemical.update({ quantity: newQuantity }, { transaction });
    const txType = quantity >= 0 ? 'restock' : 'adjustment';
    await ChemicalTransaction.create({ chemicalId: chemical.id, type: txType, quantity: Math.abs(quantity), unit: chemical.unit, notes: `Adjustment: ${req.body.notes || req.body.reason || ''}`, recordedBy: req.user.id }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CHEMICAL_ADJUSTED', entity: `chemical:${chemical.id}`, details: JSON.stringify({ chemicalId: chemical.id, adjustment: quantity, previousQuantity: previousValue.quantity, newQuantity }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, data: serializeChemical(await Chemical.findByPk(chemical.id)) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const transferChemical = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const chemical = await Chemical.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!chemical) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Chemical not found' }); }
    ensureExpiryLock(chemical);
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Transfer quantity must be a positive number' }); }
    const sourceLab = String(req.body.sourceLab || req.body.source_lab || chemical.storageLocation || '').trim();
    const destinationLab = String(req.body.destinationLab || req.body.destination_lab || '').trim();
    if (!sourceLab || !destinationLab) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Source and destination laboratories are required' }); }
    if (sourceLab.toLowerCase() === destinationLab.toLowerCase() && Number(req.body.sourceCampusId || req.body.source_campus_id || 0) === Number(req.body.destinationCampusId || req.body.destination_campus_id || 0)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Source and destination laboratories are identical' });
    }
    if (!req.body.safetyConfirmation && req.body.safety_confirmation !== true && req.body.safetyConfirmation !== true) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Safety confirmation is required for chemical transfer' });
    }
    if (quantity > Number(chemical.quantity)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Insufficient stock: have ${chemical.quantity}${chemical.unit}` }); }
    const newQuantity = Number((Number(chemical.quantity) - quantity).toFixed(3));
    await chemical.update({ quantity: newQuantity, storageLocation: destinationLab }, { transaction });
    const transfer = await ChemicalTransfer.create({
      transferCode: uniqueRef('CHEMT'),
      chemicalId: chemical.id,
      quantity,
      unit: chemical.unit,
      sourceLab,
      sourceCampusId: req.body.sourceCampusId || req.body.source_campus_id || chemical.campusId || null,
      destinationLab,
      destinationCampusId: req.body.destinationCampusId || req.body.destination_campus_id || null,
      requestedBy: req.user.id,
      requestedAt: new Date(),
      safetyConfirmation: true,
      safetyNotes: req.body.safetyNotes || '',
      status: 'completed',
      transferredAt: new Date(),
    }, { transaction });
    await ChemicalTransaction.create({ chemicalId: chemical.id, type: 'transfer-out', quantity, unit: chemical.unit, notes: `Transferred to ${destinationLab} (${transfer.transferCode})`, recordedBy: req.user.id }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CHEMICAL_TRANSFERRED', entity: `chemical:${chemical.id}`, details: JSON.stringify({ chemicalId: chemical.id, transferCode: transfer.transferCode, previousQuantity: Number(chemical.quantity) + quantity, newQuantity, sourceLab, destinationLab }) }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, data: serializeChemical(await Chemical.findByPk(chemical.id)), transfer });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const listTransfers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const { count, rows } = await ChemicalTransfer.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    res.json({ success: true, data: rows, transfers: rows, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const quarantineChemical = async (req, res, next) => {
  try {
    const chemical = await Chemical.findByPk(req.params.id);
    if (!chemical) return res.status(404).json({ success: false, message: 'Chemical not found' });
    await chemical.update({ quarantine: true, quarantineReason: req.body.quarantineReason || req.body.reason || 'Quarantined by user' });
    await AuditLog.create({ userId: req.user.id, action: 'CHEMICAL_QUARANTINED', entity: `chemical:${chemical.id}`, details: JSON.stringify({ chemicalId: chemical.id, reason: req.body.quarantineReason || req.body.reason || '' }) });
    res.json({ success: true, data: serializeChemical(chemical) });
  } catch (error) { next(error); }
};

const listQuarantine = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await Chemical.findAndCountAll({ where: { quarantine: true }, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const data = rows.map(serializeChemical);
    res.json({ success: true, data, chemicals: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const listHazardousWaste = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await HazardousWaste.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    res.json({ success: true, data: rows, wastes: rows, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createHazardousWaste = async (req, res, next) => {
  try {
    const wasteStream = String(req.body.wasteStream || req.body.waste_stream || '').trim();
    if (!wasteStream) return res.status(400).json({ success: false, message: 'Waste stream is required' });
    const volume = Number(req.body.volume ?? 0);
    if (!Number.isFinite(volume) || volume < 0) return res.status(400).json({ success: false, message: 'Volume must be a non-negative number' });
    const unit = normalizeUnit(req.body.unit);
    const chemicalId = req.body.chemicalId || req.body.chemical_id || null;
    const chemical = chemicalId ? await Chemical.findByPk(chemicalId) : null;
    const waste = await HazardousWaste.create({
      wasteCode: uniqueRef('WST'),
      wasteStream,
      chemicalId: chemicalId || null,
      chemicalName: chemical ? chemical.name : String(req.body.chemicalName || req.body.chemical_name || ''),
      volume,
      unit,
      generatedDate: req.body.generatedDate || req.body.generated_date || new Date().toISOString().slice(0, 10),
      disposalDate: req.body.disposalDate || req.body.disposal_date || null,
      disposalMethod: req.body.disposalMethod || req.body.disposal_method || '',
      responsiblePerson: req.body.responsiblePerson || req.body.responsible_person || null,
      notes: req.body.notes || '',
      status: req.body.status || 'stored',
    });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_HAZARDOUS_WASTE', entity: `waste:${waste.id}`, details: JSON.stringify({ wasteCode: waste.wasteCode, wasteStream, volume }) });
    res.status(201).json({ success: true, data: waste });
  } catch (error) { next(error); }
};

const updateHazardousWaste = async (req, res, next) => {
  try {
    const waste = await HazardousWaste.findByPk(req.params.id);
    if (!waste) return res.status(404).json({ success: false, message: 'Waste record not found' });
    const updates = {};
    for (const field of ['wasteStream', 'chemicalName', 'disposalMethod', 'status', 'notes']) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (req.body.volume !== undefined) {
      const volume = Number(req.body.volume);
      if (!Number.isFinite(volume) || volume < 0) return res.status(400).json({ success: false, message: 'Volume must be a non-negative number' });
      updates.volume = volume;
    }
    if (req.body.disposalDate !== undefined) updates.disposalDate = req.body.disposalDate || null;
    if (req.body.generatedDate !== undefined) updates.generatedDate = req.body.generatedDate || null;
    if (req.body.responsiblePerson !== undefined) updates.responsiblePerson = req.body.responsiblePerson || null;
    await waste.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_HAZARDOUS_WASTE', entity: `waste:${waste.id}`, details: JSON.stringify({ previousValue: waste.toJSON() }) });
    res.json({ success: true, data: waste });
  } catch (error) { next(error); }
};

const uploadChemicalDocument = async (req, res, next) => {
  try {
    const chemical = await Chemical.findByPk(req.params.id);
    if (!chemical) return res.status(404).json({ success: false, message: 'Chemical not found' });
    const upload = saveBase64File({ fileName: req.body.fileName || req.body.file_name || '', mimeType: req.body.mimeType || req.body.file_type || '', data: req.body.fileData || req.body.file_data || '' }, 'chemicals');
    const document = await ChemicalDocument.create({
      chemicalId: chemical.id,
      documentType: req.body.documentType || req.body.document_type || 'SDS',
      originalName: upload.originalName,
      storedName: upload.storedName,
      mimeType: upload.mimeType,
      fileSize: upload.fileSize,
      filePath: upload.filePath,
      uploadedBy: req.user.id,
    });
    await AuditLog.create({ userId: req.user.id, action: 'UPLOAD_CHEMICAL_DOCUMENT', entity: `chemical:${chemical.id}`, details: JSON.stringify({ documentId: document.id, documentType: document.documentType, originalName: upload.originalName }) });
    res.status(201).json({ success: true, data: document });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

const listChemicalDocuments = async (req, res, next) => {
  try {
    const documents = await ChemicalDocument.findAll({ where: { chemicalId: req.params.id, status: 'active' }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: documents, documents });
  } catch (error) { next(error); }
};

const listStockOrders = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await StockOrder.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    res.json({ success: true, data: rows, orders: rows, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const setStockOrderStatus = async (req, res, next) => {
  try {
    const order = await StockOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order request not found' });
    const status = String(req.body.status || '').toLowerCase();
    if (!['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid order status' });
    await order.update({ status, assignedTo: req.body.assignedTo || req.body.assigned_to || order.assignedTo });
    res.json({ success: true, data: order });
  } catch (error) { next(error); }
};

const listChemicalsForExpiration = async () => {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring = await Chemical.findAll({
    where: {
      expirationDate: { [Op.ne]: null, [Op.lte]: in30Days.toISOString().slice(0, 10) },
      quarantine: false,
    },
  });
  return expiring;
};

module.exports = {
  listChemicals,
  getChemical,
  scanChemical,
  createChemical,
  updateChemical,
  consumeChemical,
  restockChemical,
  adjustChemical,
  transferChemical,
  listTransfers,
  quarantineChemical,
  listQuarantine,
  listHazardousWaste,
  createHazardousWaste,
  updateHazardousWaste,
  uploadChemicalDocument,
  listChemicalDocuments,
  listStockOrders,
  setStockOrderStatus,
  listChemicalsForExpiration,
  isExpired,
  isLowStock,
};