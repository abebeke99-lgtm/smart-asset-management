const { sequelize, Asset, Department, Inventory, InventoryTransaction, User, Maintenance, AssetMovement, AuditLog } = require('../models');
const { Op } = require('sequelize');

const roles = ['admin', 'store_manager', 'ict_officer'];
const canManage = (user) => user && roles.includes(user.role);

const normalizeInventory = (item) => {
  const data = item.toJSON();
  return {
    ...data,
    asset_id: data.assetId,
    item_id: `INV-${String(data.id).padStart(6, '0')}`,
    asset_tag: item.Asset?.assetCode,
    name: item.Asset?.name,
    category: item.Asset?.category,
    department: item.Department?.name || data.department || '',
    serial_number: item.Asset?.serialNumber,
    current_value: item.Asset?.currentValue,
    purchase_cost: item.Asset?.purchasePrice,
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

const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'serialNumber', 'currentValue', 'purchasePrice'] }, { model: Department, attributes: ['id', 'name'] }];

const getInventory = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.location) where.location = req.query.location;
    const items = await Inventory.findAll({ where, include, order: [['id', 'ASC']] });
    const normalized = items.map(normalizeInventory);
    return res.json({
      success: true,
      data: normalized,
      pagination: {
        page: 1,
        limit: normalized.length,
        total: normalized.length,
        totalPages: 1,
      }
    });
  } catch (error) { next(error); }
};

const getTransactions = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.asset_id) where.assetId = req.query.asset_id;
    const items = await InventoryTransaction.findAll({ where, include: [{ model: Asset, attributes: ['assetCode', 'name'] }, { model: User, attributes: ['username', 'fullName'] }], order: [['createdAt', 'DESC']] });
    res.json({ success: true, transactions: items, total: items.length });
  } catch (error) { next(error); }
};

const getStoreDashboard = async (req, res, next) => {
  try {
    const [items, transactions, activeUsers, departments, pendingMaintenance, rfidTagged] = await Promise.all([
      Inventory.findAll({ include, order: [['updatedAt', 'DESC']] }),
      InventoryTransaction.findAll({
        include: [{ model: Asset, attributes: ['assetCode', 'name'] }, { model: User, attributes: ['username', 'fullName'] }],
        order: [['createdAt', 'DESC']],
        limit: 500,
      }),
      User.count({ where: { active: true } }),
      Department.count(),
      Maintenance.count({ where: { status: 'Pending' } }),
      Asset.count({ where: { rfidTag: { [Op.ne]: '' } } }),
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
  const { asset_id, type, quantity, to_location, from_location, reason, notes, department_id, adjustment_type: adjustmentType } = req.body;
  const amount = Number(quantity);
  if (!asset_id || !type || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000 || !['receive', 'issue', 'return', 'transfer', 'damage', 'adjustment'].includes(type)) return res.status(400).json({ success: false, message: 'Valid asset, transaction type, and positive quantity are required' });

  const transaction = await sequelize.transaction();
  try {
    const item = await Inventory.findOne({ where: { assetId: asset_id }, include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'collegeId', 'status'] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const userCollegeId = req.user?.collegeId ?? req.user?.college_id;
    if (userCollegeId && Number(item.Asset?.collegeId) !== Number(userCollegeId)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Inventory item is outside your organization scope' }); }
    const previous = { quantity: item.quantity, availableQuantity: item.availableQuantity, reservedQuantity: item.reservedQuantity, damagedQuantity: item.damagedQuantity, location: item.location };
    const next = { quantity: item.quantity, availableQuantity: item.availableQuantity, damagedQuantity: item.damagedQuantity, location: to_location || item.location };
    if (type === 'receive') { next.quantity += amount; next.availableQuantity += amount; }
    if (type === 'issue') { if (item.availableQuantity < amount) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient available stock' }); } next.availableQuantity -= amount; }
    if (type === 'return') next.availableQuantity += amount;
    if (type === 'damage') { if (item.availableQuantity < amount) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient available stock' }); } next.availableQuantity -= amount; next.damagedQuantity += amount; }
    if (type === 'adjustment') {
      const direction = adjustmentType === 'decrease' ? -1 : 1;
      next.quantity += direction * amount;
      next.availableQuantity += direction * amount;
      if (next.quantity < 0 || next.availableQuantity < 0) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient stock for this adjustment' }); }
    }
    const adjustmentDetails = type === 'adjustment' ? { adjustmentType, previousQuantity: previous.quantity, adjustmentQuantity: amount, newQuantity: next.quantity, reference: req.body.reference || '', notes: notes || '' } : null;
    const receiptDetails = type === 'receive' ? { reference: req.body.reference || '', supplier: req.body.supplier || '', purchaseOrder: req.body.purchase_order || '', invoice: req.body.invoice || '', deliveryNote: req.body.delivery_note || '', notes: notes || '' } : null;
    const transactionNotes = adjustmentDetails ? JSON.stringify(adjustmentDetails) : receiptDetails ? JSON.stringify(receiptDetails) : notes || '';
    await item.update(next, { transaction });
    const record = await InventoryTransaction.create({ inventoryId: item.id, assetId: asset_id, userId: req.user.id, departmentId: department_id || null, type, quantity: amount, fromLocation: from_location || '', toLocation: to_location || '', reason: reason || '', notes: transactionNotes }, { transaction });
    if (type === 'receive') {
      await AssetMovement.create({ assetId: asset_id, movementType: 'stock_added', sourceType: 'supplier', sourceId: null, destinationType: 'store', destinationId: null, referenceType: 'inventory_transaction', referenceId: record.id, performedBy: req.user.id, notes: JSON.stringify({ previousQuantity: previous.quantity, addedQuantity: amount, newQuantity: next.quantity, ...receiptDetails }) }, { transaction });
      await AuditLog.create({ userId: req.user.id, action: 'STORE_STOCK_ADDED', entity: `inventory:${item.id}`, details: JSON.stringify({ assetId: asset_id, transactionId: record.id, previousQuantity: previous.quantity, addedQuantity: amount, newQuantity: next.quantity, location: next.location, ...receiptDetails }) }, { transaction });
    }
    if (type === 'adjustment') {
      await AssetMovement.create({ assetId: asset_id, movementType: 'stock_adjustment', sourceType: 'store', sourceId: null, destinationType: 'store', destinationId: null, referenceType: 'inventory_transaction', referenceId: record.id, performedBy: req.user.id, notes: transactionNotes }, { transaction });
      await AuditLog.create({ userId: req.user.id, action: 'STORE_STOCK_ADJUSTED', entity: `inventory:${item.id}`, details: JSON.stringify({ assetId: asset_id, transactionId: record.id, ...adjustmentDetails, location: next.location }) }, { transaction });
    }
    await transaction.commit();
    res.status(201).json({ success: true, transaction: record, inventory: normalizeInventory(await Inventory.findByPk(item.id, { include })) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const createStockAdjustment = async (req, res, next) => {
  const reason = String(req.body.reason || '').trim();
  const notes = String(req.body.notes || '').trim();
  if (!['increase', 'decrease'].includes(req.body.adjustment_type) || !reason || (reason.toLowerCase() === 'other' && notes.length < 5)) return res.status(400).json({ success: false, message: 'Adjustment direction and a meaningful reason are required; explain Other adjustments in the notes' });
  req.body.type = 'adjustment';
  return createTransaction(req, res, next);
};

const createReceipt = async (req, res, next) => {
  const quantity = Number(req.body.quantity);
  if (!String(req.body.reference || '').trim()) return res.status(400).json({ success: false, message: 'A receiving reference is required' });
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).json({ success: false, message: 'A positive receiving quantity is required' });
  req.body.type = 'receive';
  return createTransaction(req, res, next);
};

module.exports = { normalizeInventory, getInventory, getTransactions, getStoreDashboard, createTransaction, createStockAdjustment, createReceipt };
