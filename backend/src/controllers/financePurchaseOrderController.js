const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Approval, AuditLog, Department, PurchaseOrder, PurchaseOrderItem, User } = require('../models');

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Issued', 'Completed', 'Cancelled'];
const include = [
  { model: PurchaseOrderItem, as: 'items' },
  { model: Approval, as: 'PurchaseRequest', attributes: ['id', 'item', 'quantity', 'status'] },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'] },
  { model: User, as: 'Creator', attributes: ['id', 'username', 'fullName'] },
  { model: User, as: 'Approver', attributes: ['id', 'username', 'fullName'], required: false },
];

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalize = (record) => {
  const value = record.toJSON();
  return {
    ...value,
    subtotal: number(value.subtotal),
    taxAmount: number(value.taxAmount),
    discountAmount: number(value.discountAmount),
    totalAmount: number(value.totalAmount),
    items: (value.items || []).map((item) => ({ ...item, quantity: number(item.quantity), unitPrice: number(item.unitPrice), taxRate: number(item.taxRate), discount: number(item.discount), lineTotal: number(item.lineTotal) })),
    requestNumber: value.PurchaseRequest ? `REQ-${String(value.PurchaseRequest.id).padStart(6, '0')}` : '',
    supplierName: value.supplierName,
    departmentName: value.DepartmentRecord?.name || '',
    requestedBy: value.PurchaseRequest?.requestedBy || '',
    createdByName: value.Creator?.fullName || value.Creator?.username || '',
    approvedByName: value.Approver?.fullName || value.Approver?.username || '',
  };
};

const buildWhere = (query) => {
  const where = {};
  const search = String(query.search || '').trim();
  if (search) where[Op.or] = [{ poNumber: { [Op.like]: `%${search}%` } }, { supplierName: { [Op.like]: `%${search}%` } }];
  if (STATUSES.includes(query.status)) where.status = query.status;
  if (query.supplier) where.supplierName = { [Op.like]: `%${String(query.supplier).trim()}%` };
  const departmentId = Number(query.departmentId || query.department);
  if (Number.isInteger(departmentId) && departmentId > 0) where.departmentId = departmentId;
  if (query.dateFrom || query.dateTo) where.orderDate = {};
  if (query.dateFrom) where.orderDate[Op.gte] = query.dateFrom;
  if (query.dateTo) where.orderDate[Op.lte] = query.dateTo;
  return where;
};

const audit = (transaction, req, action, orderId, details = {}) => AuditLog.create({ userId: req.user.id, action, entity: `purchase_order:${orderId}`, details: JSON.stringify(details) }, { transaction });

const listPurchaseOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = buildWhere(req.query);
    const result = await PurchaseOrder.findAndCountAll({ where, include, distinct: true, limit, offset: (page - 1) * limit, order: [['createdAt', 'DESC']] });
    const statusCounts = await Promise.all(STATUSES.map(async (status) => [status, await PurchaseOrder.count({ where: { ...where, status } })]));
    const totalValue = await PurchaseOrder.sum('totalAmount', { where });
    const departments = await Department.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] });
    return res.json({ success: true, data: { orders: result.rows.map(normalize), summary: { total: result.count, totalValue: number(totalValue), ...Object.fromEntries(statusCounts) }, filters: { statuses: STATUSES, departments } }, pagination: { page, limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / limit)), pages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) { return next(error); }
};

const getPurchaseOrder = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    return res.json({ success: true, data: normalize(record) });
  } catch (error) { return next(error); }
};

const validatePayload = async (body, transaction, id = null) => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!String(body.supplierName || '').trim()) throw Object.assign(new Error('Supplier name is required'), { status: 422 });
  if (!items.length) throw Object.assign(new Error('At least one purchase item is required'), { status: 422 });
  const normalizedItems = items.map((item) => {
    const quantity = number(item.quantity);
    const unitPrice = number(item.unitPrice);
    const discount = number(item.discount);
    const taxRate = number(item.taxRate);
    if (!String(item.itemName || '').trim() || quantity <= 0 || unitPrice < 0 || discount < 0 || taxRate < 0) throw Object.assign(new Error('Each purchase item must have valid name, quantity, price, discount, and tax rate'), { status: 422 });
    const subtotal = quantity * unitPrice;
    const lineTotal = Math.max(0, subtotal - discount) * (1 + taxRate / 100);
    return { itemName: String(item.itemName).trim(), description: String(item.description || '').trim(), quantity, unit: String(item.unit || 'pcs').trim(), unitPrice, taxRate, discount, lineTotal };
  });
  const purchaseRequestId = body.purchaseRequestId ? Number(body.purchaseRequestId) : null;
  let departmentId = body.departmentId ? Number(body.departmentId) : null;
  if (purchaseRequestId) {
    const request = await Approval.findByPk(purchaseRequestId, { transaction });
    if (!request || request.status !== 'approved') throw Object.assign(new Error('Purchase request must exist and be approved'), { status: 422 });
    const existing = await PurchaseOrder.findOne({ where: { purchaseRequestId, ...(id ? { id: { [Op.ne]: id } } : {}) }, transaction });
    if (existing) throw Object.assign(new Error('This purchase request already has a purchase order'), { status: 409 });
    departmentId = request.departmentId || departmentId;
  }
  if (departmentId && !(await Department.findByPk(departmentId, { transaction }))) throw Object.assign(new Error('Department not found'), { status: 422 });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = normalizedItems.reduce((sum, item) => sum + Math.max(0, item.quantity * item.unitPrice - item.discount) * item.taxRate / 100, 0);
  const discountAmount = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
  return { purchaseRequestId, departmentId, items: normalizedItems, subtotal, taxAmount, discountAmount, totalAmount: Math.max(0, subtotal - discountAmount + taxAmount) };
};

const createPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const validated = await validatePayload(req.body, transaction);
    const poNumber = String(req.body.poNumber || `PO-${Date.now()}`).trim();
    const order = await PurchaseOrder.create({ poNumber, purchaseRequestId: validated.purchaseRequestId, supplierName: String(req.body.supplierName).trim(), departmentId: validated.departmentId, orderDate: req.body.orderDate || new Date(), expectedDeliveryDate: req.body.expectedDeliveryDate || null, currency: req.body.currency || 'ETB', status: req.body.status === 'Pending Approval' ? 'Pending Approval' : 'Draft', priority: req.body.priority || 'Normal', paymentTerms: req.body.paymentTerms || '', deliveryTerms: req.body.deliveryTerms || '', notes: req.body.notes || '', createdBy: req.user.id, ...validated }, { transaction });
    await PurchaseOrderItem.bulkCreate(validated.items.map((item) => ({ ...item, purchaseOrderId: order.id })), { transaction });
    await audit(transaction, req, 'PURCHASE_ORDER_CREATED', order.id, { poNumber });
    await transaction.commit();
    return getPurchaseOrder({ ...req, params: { id: order.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const updatePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const order = await PurchaseOrder.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Purchase order not found' }); }
    if (!['Draft', 'Pending Approval'].includes(order.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only draft or pending purchase orders can be edited' }); }
    const validated = await validatePayload(req.body, transaction, order.id);
    await order.update({ poNumber: String(req.body.poNumber || order.poNumber).trim(), supplierName: String(req.body.supplierName).trim(), orderDate: req.body.orderDate || order.orderDate, expectedDeliveryDate: req.body.expectedDeliveryDate || null, currency: req.body.currency || order.currency, priority: req.body.priority || order.priority, paymentTerms: req.body.paymentTerms || '', deliveryTerms: req.body.deliveryTerms || '', notes: req.body.notes || '', ...validated }, { transaction });
    await PurchaseOrderItem.destroy({ where: { purchaseOrderId: order.id }, transaction });
    await PurchaseOrderItem.bulkCreate(validated.items.map((item) => ({ ...item, purchaseOrderId: order.id })), { transaction });
    await audit(transaction, req, 'PURCHASE_ORDER_UPDATED', order.id);
    await transaction.commit();
    return getPurchaseOrder({ ...req, params: { id: order.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const transition = (targetStatus, action) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const order = await PurchaseOrder.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Purchase order not found' }); }
    if (targetStatus === 'Approved' && !['Draft', 'Pending Approval'].includes(order.status)) throw Object.assign(new Error('Only draft or pending purchase orders can be approved'), { status: 409 });
    if (targetStatus === 'Cancelled' && ['Cancelled', 'Completed'].includes(order.status)) throw Object.assign(new Error('This purchase order has already been processed'), { status: 409 });
    await order.update({ status: targetStatus, ...(targetStatus === 'Approved' ? { approvedBy: req.user.id, approvedAt: new Date() } : {}) }, { transaction });
    await audit(transaction, req, action, order.id, { previousStatus: order.previous('status'), status: targetStatus });
    await transaction.commit();
    return getPurchaseOrder({ ...req, params: { id: order.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const deletePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const order = await PurchaseOrder.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Purchase order not found' }); }
    if (order.status !== 'Draft') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only draft purchase orders can be deleted' }); }
    await audit(transaction, req, 'PURCHASE_ORDER_DELETED', order.id);
    await order.destroy({ transaction });
    await transaction.commit();
    return res.json({ success: true, message: 'Purchase order deleted' });
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, approvePurchaseOrder: transition('Approved', 'PURCHASE_ORDER_APPROVED'), cancelPurchaseOrder: transition('Cancelled', 'PURCHASE_ORDER_CANCELLED'), deletePurchaseOrder };