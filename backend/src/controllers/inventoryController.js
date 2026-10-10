const { sequelize, Asset, Department, Inventory, InventoryTransaction, User, Maintenance, AssetMovement, AuditLog, Supplier } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { isCollegeScopedRole, getCollegeScopeId } = require('../middlewares/organizationScope');

const roles = ['admin', 'store_manager', 'ict_officer'];
const canManage = (user) => user && roles.includes(user.role);

const normalizeInventory = (item) => {
  const data = item.toJSON();
  return {
    ...data,
    asset_id: data.assetId,
    inventory_id: `INV-${String(data.id).padStart(6, '0')}`,
    item_id: `INV-${String(data.id).padStart(6, '0')}`,
    asset_tag: item.Asset?.assetCode,
    name: item.Asset?.name,
    category: item.Asset?.category,
    subcategory: item.Asset?.subcategory || '',
    unit: item.Asset?.unit || 'unit',
    description: item.Asset?.description || data.description || '',
    supplier: item.Asset?.supplier || data.supplier || '',
    location: data.location || item.Asset?.location || '',
    department: item.Department?.name || data.department || '',
    serial_number: item.Asset?.serialNumber,
      assetStatus: item.Asset?.status,
      condition: item.Asset?.condition,
    qr_code: item.Asset?.digitalId || '',
    rfid: item.Asset?.rfidTag || '',
    purchase_date: item.Asset?.purchaseDate || null,
    current_value: item.Asset?.currentValue,
    purchase_cost: item.Asset?.purchasePrice,
    expiry_date: item.Asset?.expiryDate || null,
    batch_lot: item.Asset?.batchLot || '',
    warranty_expiry: item.Asset?.warrantyExpiry || null,
    campus: item.Asset?.CampusRecord?.campusName || '',
    building: item.Asset?.BuildingRecord?.buildingName || '',
    room: item.Asset?.RoomRecord?.roomName || '',
    available_quantity: data.availableQuantity,
    issued_quantity: Math.max(0, data.quantity - data.availableQuantity - data.reservedQuantity - data.damagedQuantity),
    reserved_quantity: data.reservedQuantity,
    damaged_quantity: data.damagedQuantity,
    min_stock: data.minimumQuantity,
    is_low_stock: data.availableQuantity <= data.minimumQuantity,
    stock_status: data.damagedQuantity > 0 ? 'Damaged' : data.availableQuantity <= data.minimumQuantity ? 'Low Stock' : 'Normal',
    last_updated: data.updatedAt,
  };
};

const include = [{ model: Asset, attributes: ['id', 'assetCode', 'digitalId', 'name', 'category', 'subcategory', 'unit', 'serialNumber', 'rfidTag', 'currentValue', 'purchasePrice', 'purchaseDate', 'supplier', 'warrantyExpiry', 'expiryDate', 'batchLot', 'location', 'campusId', 'buildingId', 'roomId', 'condition', 'status'], include: [{ model: require('../models/Campus'), as: 'CampusRecord', attributes: ['campusName'] }, { model: require('../models/Building'), as: 'BuildingRecord', attributes: ['buildingName'] }, { model: require('../models/Room'), as: 'RoomRecord', attributes: ['roomName'] }] }, { model: Department, attributes: ['id', 'name'] }];

const getInventory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 20));
    const where = {};
    const scopedRole = isCollegeScopedRole(req.user?.role);
    const departmentHeadScope = req.user?.role === 'department_head' && (req.organizationScope?.departmentId ?? req.user?.departmentId ?? req.user?.department_id);
    const collegeId = scopedRole ? getCollegeScopeId(req) : null;
    const departmentId = departmentHeadScope ? Number(req.organizationScope?.departmentId ?? req.user?.departmentId ?? req.user?.department_id) : null;
    if (scopedRole && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    if (departmentHeadScope && (!Number.isSafeInteger(departmentId) || departmentId < 1)) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    const assetWhere = departmentHeadScope
      ? { departmentId, collegeId: req.organizationScope?.collegeId || req.user?.collegeId || req.user?.college_id || undefined }
      : scopedRole
        ? { collegeId }
        : req.user?.role === 'ict_officer' && req.organizationScope?.collegeId
          ? { collegeId: Number(req.organizationScope.collegeId) }
          : {};
    if (departmentHeadScope) {
      where.departmentId = departmentId;
    }
    const search = String(req.query.search || '').trim();
    const stockLevel = String(req.query.stockLevel || '').toLowerCase();
    if (req.query.location) where.location = String(req.query.location);
    if (req.query.status) assetWhere.status = String(req.query.status).toLowerCase();
    if (req.query.category) assetWhere.category = String(req.query.category);
    if (search) assetWhere[Op.or] = ['assetCode', 'name', 'category', 'serialNumber', 'rfidTag', 'supplier'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    if (stockLevel === 'available') {
      where[Op.and] = [
        Sequelize.where(Sequelize.col('available_quantity'), Op.gt, Sequelize.col('minimum_quantity')),
      ];
    }
    if (stockLevel === 'low') {
      where[Op.and] = [
        Sequelize.where(Sequelize.col('available_quantity'), Op.gt, 0),
        Sequelize.where(Sequelize.col('available_quantity'), Op.lte, Sequelize.col('minimum_quantity')),
      ];
    }
    if (stockLevel === 'out') {
      where.availableQuantity = { [Op.lte]: 0 };
    }
    const allowedSorts = { name: [Asset, 'name'], quantity: ['quantity'], category: [Asset, 'category'], location: ['location'], updatedAt: ['updatedAt'] };
    const sort = allowedSorts[req.query.sortBy] || ['updatedAt'];
    const order = [[...sort, String(req.query.sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC']];
    const result = await Inventory.findAndCountAll({ where, include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'serialNumber', 'rfidTag', 'currentValue', 'purchasePrice', 'description', 'supplier', 'status', 'location'], where: assetWhere, required: true }, { model: Department, attributes: ['id', 'name'] }], order, limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const normalized = result.rows.map(normalizeInventory);
    const allItems = await Inventory.findAll({ where, include: [{ model: Asset, attributes: ['status'], where: assetWhere, required: true }] });
    const summary = allItems.reduce((stats, item) => {
      const available = Number(item.availableQuantity || 0);
      const minimum = Number(item.minimumQuantity || 0);
      stats.totalItems += 1;
      stats.totalQuantity += Number(item.quantity || 0);
      stats.availableQuantity += available;
      stats.lowStock += available > 0 && available <= minimum ? 1 : 0;
      stats.outOfStock += available <= 0 ? 1 : 0;
      return stats;
    }, { totalItems: 0, totalQuantity: 0, availableQuantity: 0, lowStock: 0, outOfStock: 0 });
    return res.json({
      success: true,
      data: normalized,
      summary,
      pagination: { page, limit: pageSize, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
    });
  } catch (error) { next(error); }
};

const getTransactions = async (req, res, next) => {
  try {
    const where = {};
    const scopedRole = isCollegeScopedRole(req.user?.role);
    const userCollegeId = scopedRole ? getCollegeScopeId(req) : req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id;
    if (scopedRole && !userCollegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const assetWhere = userCollegeId ? { collegeId: Number(userCollegeId) } : {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.asset_id) where.assetId = req.query.asset_id;
    const items = await InventoryTransaction.findAll({
      where,
      include: [
        { model: Asset, attributes: ['id', 'assetCode', 'name', 'department', 'location', 'collegeId'], required: true, where: assetWhere },
        { model: User, attributes: ['id', 'username', 'fullName', 'role', 'departmentId'] },
        { model: Department, attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, transactions: items.map((item) => item.toJSON()), total: items.length });
  } catch (error) { next(error); }
};

const getReceiptSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { status: 'active' },
      attributes: ['id', 'supplierCode', 'supplierName'],
      order: [['supplierName', 'ASC']],
      limit: 500,
    });
    return res.json({ success: true, data: suppliers });
  } catch (error) {
    return next(error);
  }
};

const getStoreDashboard = async (req, res, next) => {
  try {
    const scopedRole = isCollegeScopedRole(req.user?.role);
    const collegeId = scopedRole ? getCollegeScopeId(req) : null;
    if (scopedRole && !collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const scopedAssetInclude = collegeId
      ? [{ ...include[0], where: { collegeId }, required: true }, include[1]]
      : include;
    const [items, transactions, activeUsers, departments, pendingMaintenance, rfidTagged] = await Promise.all([
      Inventory.findAll({ include: scopedAssetInclude, order: [['updatedAt', 'DESC']] }),
      InventoryTransaction.findAll({
        include: [{ model: Asset, attributes: ['assetCode', 'name'], ...(collegeId ? { where: { collegeId }, required: true } : {}) }, { model: User, attributes: ['username', 'fullName'] }],
        order: [['createdAt', 'DESC']],
        limit: 500,
      }),
      User.count({ where: { active: true, ...(collegeId ? { collegeId } : {}) } }),
      Department.count({ where: collegeId ? { collegeId } : {} }),
      Maintenance.count({ where: { status: 'Pending' }, ...(collegeId ? { include: [{ model: Asset, where: { collegeId }, required: true }] } : {}) }),
      Asset.count({ where: { rfidTag: { [Op.ne]: '' }, ...(collegeId ? { collegeId } : {}) } }),
    ]);

    const inventory = items.map(normalizeInventory);
    const countBy = (key) => inventory.reduce((counts, item) => {
      const value = item[key] || 'Unassigned';
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
    const totalInventory = inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const available = inventory.reduce((sum, item) => sum + Number(item.available_quantity || 0), 0);
    const issued = inventory.reduce((sum, item) => sum + Number(item.issued_quantity || 0), 0);
    const days = req.query.range === 'month' ? 30 : req.query.range === 'year' ? 365 : 7;
    const movement = Array.from({ length: req.query.range === 'year' ? 12 : days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - index - 1));
      const day = date.toISOString().slice(0, 10);
      const dayTransactions = transactions.filter((item) => String(item.createdAt || '').slice(0, 10) === day);
      return {
        date: req.query.range === 'week' ? date.toLocaleDateString('en', { weekday: 'short' }) : date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        issued: dayTransactions.filter((item) => item.type === 'issue').length,
        returned: dayTransactions.filter((item) => item.type === 'return').length,
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalInventory,
          available,
          issued,
          lowStock: inventory.filter((item) => item.is_low_stock).length,
          pendingRequests: pendingMaintenance,
        },
        distribution: {
          byStatus: countBy('stock_status'),
          byCategory: countBy('category'),
          byLocation: countBy('location'),
          byDepartment: countBy('department'),
        },
        activeUsers,
        departments,
        rfidTagged,
        movement,
        recentTransactions: transactions.slice(0, 10),
        health: { server: 'Connected', database: 'Connected', rfid: rfidTagged ? 'Active' : 'No events', backup: 'Not configured' },
      },
    });
  } catch (error) { next(error); }
};

const createTransaction = async (req, res, next) => {
  if (!canManage(req.user)) return res.status(403).json({ success: false, message: 'Store or ICT authorization required' });
  const { type, quantity, to_location, from_location, reason, notes, adjustment_type: adjustmentType } = req.body;
  const assetId = Number(req.body.asset_id ?? req.body.assetId);
  const supplierIdValue = req.body.supplier_id ?? req.body.supplierId ?? '';
  const unitPriceValue = req.body.unit_price ?? req.body.unitPrice ?? '';
  const submissionId = String(req.body.submission_id || '').trim();
  const isStockAddition = req.body.operation === 'stock_addition';
  const referenceKey = (type === 'receive' || isStockAddition) ? String(req.body.reference || '').trim().toLowerCase() : null;
  const adjustmentCollegeId = type === 'adjustment'
    ? Number(req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id)
    : null;
  if (type === 'adjustment' && (!Number.isSafeInteger(adjustmentCollegeId) || adjustmentCollegeId <= 0)) return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' });
  const amount = Number(quantity);
  if (!Number.isSafeInteger(assetId) || assetId <= 0 || !type || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000 || !['receive', 'issue', 'return', 'transfer', 'damage', 'adjustment'].includes(type)) return res.status(400).json({ success: false, message: 'Valid asset, transaction type, and positive quantity are required' });
  if (supplierIdValue !== '' && (!Number.isSafeInteger(Number(supplierIdValue)) || Number(supplierIdValue) <= 0)) return res.status(400).json({ success: false, message: 'A valid supplier is required' });
  const unitPrice = unitPriceValue === '' || unitPriceValue == null ? null : Number(unitPriceValue);
  if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 9999999999.99)) return res.status(400).json({ success: false, message: 'Unit price must be a valid non-negative amount' });
  if (type === 'receive' && unitPrice !== null && amount * unitPrice > 9999999999.99) return res.status(400).json({ success: false, message: 'Total receipt cost exceeds the supported amount' });
  if (type !== 'receive' && !isStockAddition && (supplierIdValue !== '' || unitPrice !== null)) return res.status(400).json({ success: false, message: 'Supplier and unit price are only valid for stock receipts' });
  if (type === 'receive' && !/^[a-zA-Z0-9-]{16,100}$/.test(submissionId)) return res.status(400).json({ success: false, message: 'A valid receipt submission ID is required' });
  if (isStockAddition && !/^[a-zA-Z0-9-]{16,100}$/.test(submissionId)) return res.status(400).json({ success: false, message: 'A valid stock addition submission ID is required' });
  if (isStockAddition && unitPrice !== null && amount * unitPrice > 9999999999.99) return res.status(400).json({ success: false, message: 'Total stock addition cost exceeds the supported amount' });

  const transaction = await sequelize.transaction();
  try {
    const assetScope = adjustmentCollegeId ? { where: { collegeId: adjustmentCollegeId }, required: true } : {};
    const item = await Inventory.findOne({ where: { assetId }, include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'unit', 'collegeId', 'status', 'serialNumber'], ...assetScope }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const userCollegeId = adjustmentCollegeId ?? req.user?.collegeId ?? req.user?.college_id;
    if (userCollegeId && Number(item.Asset?.collegeId) !== Number(userCollegeId)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Inventory item is outside your organization scope' }); }
    if ((type === 'receive' || isStockAddition) && ['retired', 'disposed', 'quarantined', 'deleted'].includes(String(item.Asset?.status || '').toLowerCase())) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Stock cannot be added to a retired, disposed, quarantined, or deleted asset' });
    }
    if (type === 'receive' || isStockAddition) {
      const duplicate = await InventoryTransaction.findOne({
        where: { submissionId, type },
        transaction,
      });
      if (duplicate) {
        await transaction.rollback();
        return res.status(200).json({ success: true, duplicate: true, transaction: duplicate, inventory: normalizeInventory(item) });
      }
      const existingReference = await InventoryTransaction.findOne({
        where: { assetId, referenceKey },
        transaction,
      });
      if (existingReference) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: 'This reference has already been used for this inventory item' });
      }
    }
    let supplier = null;
    if ((type === 'receive' || isStockAddition) && supplierIdValue !== '') {
      supplier = await Supplier.findOne({
        where: { id: Number(supplierIdValue), status: 'active' },
        attributes: ['id', 'supplierName'],
        transaction,
      });
      if (!supplier) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Supplier not found or inactive' }); }
    }
    const previous = { quantity: item.quantity, availableQuantity: item.availableQuantity, reservedQuantity: item.reservedQuantity, damagedQuantity: item.damagedQuantity, location: item.location };
    const next = { quantity: item.quantity, availableQuantity: item.availableQuantity, reservedQuantity: item.reservedQuantity, damagedQuantity: item.damagedQuantity, location: to_location || item.location };
    if (type === 'receive') {
      next.quantity += amount;
      if (req.body.condition === 'Damaged') next.damagedQuantity += amount;
      else next.availableQuantity += amount;
    }
    if (type === 'issue') {
      if (Number(item.availableQuantity || 0) + Number(item.reservedQuantity || 0) < amount) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient available stock' }); }
      const issuedFromReserved = Math.min(amount, Number(item.reservedQuantity || 0));
      next.reservedQuantity = Number(item.reservedQuantity || 0) - issuedFromReserved;
      next.availableQuantity -= amount - issuedFromReserved;
    }
    if (type === 'return') next.availableQuantity += amount;
    if (type === 'damage') { if (item.availableQuantity < amount) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient available stock' }); } next.availableQuantity -= amount; next.damagedQuantity += amount; }
    if (type === 'adjustment') {
      const direction = adjustmentType === 'decrease' ? -1 : 1;
      next.quantity += direction * amount;
      next.availableQuantity += direction * amount;
      if (next.quantity < 0 || next.availableQuantity < 0) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient stock for this adjustment' }); }
    }
    if (String(item.Asset?.serialNumber || '').trim() && next.quantity > 1) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Serialized assets must have a quantity of one' }); }
    const adjustmentDetails = type === 'adjustment' ? {
      adjustmentType,
      previousQuantity: previous.quantity,
      adjustmentQuantity: amount,
      newQuantity: next.quantity,
      reference: String(req.body.reference || '').trim(),
      notes: notes || '',
      ...(isStockAddition ? {
        operation: 'stock_addition',
        supplier: supplier?.supplierName || '',
        supplierId: supplier?.id || null,
        unitPrice: unitPrice === null ? null : Number(unitPrice.toFixed(2)),
        totalCost: unitPrice === null ? null : Number((amount * unitPrice).toFixed(2)),
        additionDate: req.body.addition_date,
        submissionId,
      } : {}),
    } : null;
    const receiptDetails = type === 'receive' ? {
      reference: String(req.body.reference || '').trim(),
      supplier: supplier?.supplierName || String(req.body.supplier || '').trim(),
      supplierId: supplier?.id || null,
      unitPrice: unitPrice === null ? null : Number(unitPrice.toFixed(2)),
      purchaseOrder: req.body.purchase_order || '',
      invoice: req.body.invoice || '',
      deliveryNote: req.body.delivery_note || '',
      receivedDate: req.body.received_date || null,
      condition: req.body.condition || 'Good',
      batchNumber: String(req.body.batch_number || '').trim(),
      expiryDate: req.body.expiry_date || null,
      unit: item.Asset?.unit || 'unit',
      category: item.Asset?.category || '',
      totalCost: unitPrice === null ? null : Number((amount * unitPrice).toFixed(2)),
      submissionId,
      notes: notes || '',
    } : null;
    const transactionNotes = adjustmentDetails ? JSON.stringify(adjustmentDetails) : receiptDetails ? JSON.stringify(receiptDetails) : notes || '';
    await item.update(next, { transaction });
    const record = await InventoryTransaction.create({ inventoryId: item.id, assetId, userId: req.user.id, departmentId: item.departmentId || null, type, quantity: amount, fromLocation: from_location || '', toLocation: to_location || next.location || '', reason: reason || '', notes: transactionNotes, ...(type === 'receive' || isStockAddition ? { submissionId, referenceKey } : {}) }, { transaction });
    if (type === 'receive') {
      await AssetMovement.create({ assetId, movementType: 'stock_added', sourceType: 'supplier', sourceId: supplier?.id || null, destinationType: 'store', destinationId: null, referenceType: 'inventory_transaction', referenceId: record.id, performedBy: req.user.id, notes: JSON.stringify({ previousQuantity: previous.quantity, addedQuantity: amount, newQuantity: next.quantity, ...receiptDetails }) }, { transaction });
      await AuditLog.create({ userId: req.user.id, action: 'STORE_STOCK_ADDED', entity: `inventory:${item.id}`, details: JSON.stringify({ assetId, transactionId: record.id, previousQuantity: previous.quantity, addedQuantity: amount, newQuantity: next.quantity, location: next.location, ...receiptDetails }) }, { transaction });
    }
    if (isStockAddition) {
      await AssetMovement.create({ assetId, movementType: 'stock_added', sourceType: 'store', sourceId: null, destinationType: 'store', destinationId: null, referenceType: 'inventory_transaction', referenceId: record.id, performedBy: req.user.id, notes: transactionNotes }, { transaction });
      await AuditLog.create({ userId: req.user.id, action: 'STORE_STOCK_ADDED', entity: `inventory:${item.id}`, details: JSON.stringify({ assetId, transactionId: record.id, previousQuantity: previous.quantity, addedQuantity: amount, newQuantity: next.quantity, location: next.location, ...adjustmentDetails }) }, { transaction });
    }
    if (type === 'adjustment') {
      if (!isStockAddition) {
        await AssetMovement.create({ assetId, movementType: 'stock_adjustment', sourceType: 'store', sourceId: null, destinationType: 'store', destinationId: null, referenceType: 'inventory_transaction', referenceId: record.id, performedBy: req.user.id, notes: transactionNotes }, { transaction });
        await AuditLog.create({ userId: req.user.id, action: 'STORE_STOCK_ADJUSTED', entity: `inventory:${item.id}`, details: JSON.stringify({ assetId, transactionId: record.id, ...adjustmentDetails, location: next.location }) }, { transaction });
      }
    }
    if (type === 'issue' || type === 'return') {
      await AssetMovement.create({ assetId, movementType: type === 'issue' ? 'issue' : 'return', sourceType: 'store', sourceId: null, destinationType: 'store', destinationId: null, referenceType: 'inventory_transaction', referenceId: record.id, performedBy: req.user.id, notes: transactionNotes }, { transaction });
      await AuditLog.create({ userId: req.user.id, action: type === 'issue' ? 'STORE_STOCK_ISSUED' : 'STORE_STOCK_RETURNED', entity: `inventory:${item.id}`, details: JSON.stringify({ assetId, transactionId: record.id, quantity: amount, location: next.location }) }, { transaction });
    }
    await transaction.commit();
    res.status(201).json({ success: true, transaction: record, inventory: normalizeInventory(await Inventory.findByPk(item.id, { include })) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if ((type === 'receive' || isStockAddition) && (error.original?.code === 'ER_DUP_ENTRY' || error.original?.errno === 1062)) {
      return res.status(409).json({ success: false, message: 'This stock reference or submission has already been used' });
    }
    next(error);
  }
};

const createStockAdjustment = async (req, res, next) => {
  const collegeId = Number(req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id);
  if (!Number.isSafeInteger(collegeId) || collegeId <= 0) return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' });
  const reason = String(req.body.reason || '').trim();
  const notes = String(req.body.notes || '').trim();
  if (!['increase', 'decrease'].includes(req.body.adjustment_type) || !reason || (reason.toLowerCase() === 'other' && notes.length < 5)) return res.status(400).json({ success: false, message: 'Adjustment direction and a meaningful reason are required; explain Other adjustments in the notes' });
  req.body.operation = undefined;
  req.body.type = 'adjustment';
  return createTransaction(req, res, next);
};

const createStockAddition = async (req, res, next) => {
  if (!req.user || req.user.role !== 'store_manager') return res.status(403).json({ success: false, message: 'Store Manager authorization required' });
  const reference = String(req.body.reference || '').trim();
  const reason = String(req.body.reason || '').trim();
  const additionDate = String(req.body.addition_date || '');
  const parsedDate = additionDate ? new Date(`${additionDate}T00:00:00.000Z`) : null;
  if (!reference || reference.length > 100) return res.status(400).json({ success: false, message: 'A stock addition reference between 1 and 100 characters is required' });
  if (!reason || reason.length > 255) return res.status(400).json({ success: false, message: 'A stock addition reason between 1 and 255 characters is required' });
  if (!additionDate || !/^\d{4}-\d{2}-\d{2}$/.test(additionDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== additionDate) return res.status(400).json({ success: false, message: 'A valid stock addition date is required' });
  if (req.body.unit_price !== '' && req.body.unit_price != null && (!Number.isFinite(Number(req.body.unit_price)) || Number(req.body.unit_price) < 0 || Number(req.body.unit_price) > 9999999999.99)) return res.status(400).json({ success: false, message: 'Unit cost must be a valid non-negative amount' });
  req.body.type = 'adjustment';
  req.body.adjustment_type = 'increase';
  req.body.operation = 'stock_addition';
  return createTransaction(req, res, next);
};

const createReceipt = async (req, res, next) => {
  const reference = String(req.body.reference || '').trim();
  const quantity = Number(req.body.quantity);
  const assetId = Number(req.body.asset_id);
  const submissionId = String(req.body.submission_id || '').trim();
  const location = String(req.body.to_location || '').trim();
  const condition = String(req.body.condition || 'Good');
  const receivedDate = String(req.body.received_date || '');
  const parsedReceivedDate = receivedDate ? new Date(`${receivedDate}T00:00:00.000Z`) : null;
  const expiryDate = String(req.body.expiry_date || '');
  const parsedExpiryDate = expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`) : null;
  const batchNumber = String(req.body.batch_number || '').trim();
  if (!reference || reference.length > 100) return res.status(400).json({ success: false, message: 'A receiving reference between 1 and 100 characters is required' });
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(submissionId)) return res.status(400).json({ success: false, message: 'A valid receipt submission ID is required' });
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return res.status(400).json({ success: false, message: 'A valid inventory item is required' });
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).json({ success: false, message: 'A positive receiving quantity is required' });
  if (!location || location.length > 255) return res.status(400).json({ success: false, message: 'A receiving location between 1 and 255 characters is required' });
  if (req.body.condition && !['Good', 'Fair', 'Damaged'].includes(condition)) return res.status(400).json({ success: false, message: 'A valid received condition is required' });
  if (!receivedDate || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) || Number.isNaN(parsedReceivedDate.getTime()) || parsedReceivedDate.toISOString().slice(0, 10) !== receivedDate) return res.status(400).json({ success: false, message: 'A valid received date is required' });
  if (expiryDate && (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || Number.isNaN(parsedExpiryDate.getTime()) || parsedExpiryDate.toISOString().slice(0, 10) !== expiryDate)) return res.status(400).json({ success: false, message: 'A valid expiry date is required' });
  if (expiryDate && receivedDate && expiryDate < receivedDate) return res.status(400).json({ success: false, message: 'Expiry date cannot be before the received date' });
  if (expiryDate && !batchNumber) return res.status(400).json({ success: false, message: 'A batch number is required for stock with an expiry date' });
  if (batchNumber.length > 100) return res.status(400).json({ success: false, message: 'Batch number cannot exceed 100 characters' });
  req.body.supplier_id = req.body.supplier_id ?? req.body.supplierId ?? '';
  req.body.unit_price = req.body.unit_price ?? req.body.unitPrice ?? '';
  req.body.asset_id = assetId;
  req.body.reference = reference;
  req.body.to_location = location;
  req.body.type = 'receive';
  return createTransaction(req, res, next);
};

module.exports = { normalizeInventory, getInventory, getTransactions, getReceiptSuppliers, getStoreDashboard, createTransaction, createStockAdjustment, createStockAddition, createReceipt };
