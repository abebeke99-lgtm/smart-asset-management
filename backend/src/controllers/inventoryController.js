const { sequelize, Asset, Department, Inventory, InventoryTransaction, User, Maintenance } = require('../models');
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
    res.json({ success: true, inventory: items.map(normalizeInventory), total: items.length });
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
  const { asset_id, type, quantity, to_location, from_location, reason, notes, department_id } = req.body;
  const amount = Number(quantity);
  if (!asset_id || !type || !Number.isInteger(amount) || amount <= 0 || !['receive', 'issue', 'return', 'transfer', 'damage', 'adjustment'].includes(type)) return res.status(400).json({ success: false, message: 'Valid asset, transaction type, and positive quantity are required' });

  const transaction = await sequelize.transaction();
  try {
    const item = await Inventory.findOne({ where: { assetId: asset_id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const next = { quantity: item.quantity, availableQuantity: item.availableQuantity, damagedQuantity: item.damagedQuantity, location: to_location || item.location };
    if (type === 'receive') { next.quantity += amount; next.availableQuantity += amount; }
    if (type === 'issue') { if (item.availableQuantity < amount) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient available stock' }); } next.availableQuantity -= amount; }
    if (type === 'return') next.availableQuantity += amount;
    if (type === 'damage') { if (item.availableQuantity < amount) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Insufficient available stock' }); } next.availableQuantity -= amount; next.damagedQuantity += amount; }
    if (type === 'adjustment') next.availableQuantity += amount;
    await item.update(next, { transaction });
    const record = await InventoryTransaction.create({ inventoryId: item.id, assetId: asset_id, userId: req.user.id, departmentId: department_id || null, type, quantity: amount, fromLocation: from_location || '', toLocation: to_location || '', reason: reason || '', notes: notes || '' }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, transaction: record, inventory: normalizeInventory(await Inventory.findByPk(item.id, { include })) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { getInventory, getTransactions, getStoreDashboard, createTransaction };
