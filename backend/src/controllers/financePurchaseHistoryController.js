const { Op } = require('sequelize');
const { Approval, Department, PurchaseOrder, PurchaseOrderItem, User } = require('../models');

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Issued', 'Completed', 'Cancelled'];
const include = [
  { model: PurchaseOrderItem, as: 'items' },
  { model: Approval, as: 'PurchaseRequest', attributes: ['id', 'item', 'quantity', 'requestedBy', 'status'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
  { model: User, as: 'Creator', attributes: ['id', 'username', 'fullName'], required: false },
  { model: User, as: 'Approver', attributes: ['id', 'username', 'fullName'], required: false },
];

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const validateDate = (value, name) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    const error = new Error(`${name} must use YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return value;
};

const buildWhere = (query) => {
  const where = {};
  const search = String(query.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where[Op.or] = [
      { poNumber: { [Op.like]: like } },
      { supplierName: { [Op.like]: like } },
      { '$items.itemName$': { [Op.like]: like } },
      { '$items.description$': { [Op.like]: like } },
      { '$PurchaseRequest.item$': { [Op.like]: like } },
    ];
  }
  if (query.status && !STATUSES.includes(query.status)) {
    const error = new Error('Invalid purchase status');
    error.status = 400;
    throw error;
  }
  if (query.status) where.status = query.status;
  if (query.supplier) where.supplierName = query.supplier;
  const departmentId = Number(query.departmentId || query.department);
  if (query.departmentId || query.department) {
    if (!Number.isInteger(departmentId) || departmentId < 1) {
      const error = new Error('Department filter must be a valid department id');
      error.status = 400;
      throw error;
    }
    where.departmentId = departmentId;
  }
  const dateFrom = validateDate(query.dateFrom, 'dateFrom');
  const dateTo = validateDate(query.dateTo, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('dateFrom cannot be later than dateTo');
    error.status = 400;
    throw error;
  }
  if (dateFrom || dateTo) {
    where.orderDate = {};
    if (dateFrom) where.orderDate[Op.gte] = dateFrom;
    if (dateTo) where.orderDate[Op.lte] = dateTo;
  }
  return where;
};

const normalize = (record) => {
  const value = record.toJSON();
  const items = (value.items || []).map((item) => ({
    ...item,
    quantity: number(item.quantity),
    unitPrice: number(item.unitPrice),
    taxRate: number(item.taxRate),
    discount: number(item.discount),
    lineTotal: number(item.lineTotal),
  }));
  return {
    id: value.id,
    purchaseNumber: value.poNumber,
    poNumber: value.poNumber,
    requestNumber: value.PurchaseRequest ? `REQ-${String(value.PurchaseRequest.id).padStart(6, '0')}` : '',
    supplierName: value.supplierName,
    departmentName: value.DepartmentRecord?.name || '',
    departmentId: value.departmentId,
    description: items.map((item) => item.itemName).filter(Boolean).join(', '),
    quantity: items.reduce((total, item) => total + item.quantity, 0),
    orderDate: value.orderDate,
    expectedDeliveryDate: value.expectedDeliveryDate,
    currency: value.currency,
    subtotal: number(value.subtotal),
    taxAmount: number(value.taxAmount),
    discountAmount: number(value.discountAmount),
    totalAmount: number(value.totalAmount),
    status: value.status,
    priority: value.priority,
    paymentTerms: value.paymentTerms,
    deliveryTerms: value.deliveryTerms,
    notes: value.notes,
    createdByName: value.Creator?.fullName || value.Creator?.username || '',
    approvedByName: value.Approver?.fullName || value.Approver?.username || '',
    createdAt: value.createdAt,
    approvedAt: value.approvedAt,
    items,
    purchaseRequest: value.PurchaseRequest || null,
  };
};

const listPurchaseHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = buildWhere(req.query);
    const [result, totalValue, statusCounts, suppliers, departments] = await Promise.all([
      PurchaseOrder.findAndCountAll({ where, include, distinct: true, limit, offset: (page - 1) * limit, order: [['orderDate', 'DESC'], ['id', 'DESC']] }),
      PurchaseOrder.sum('totalAmount', { where }),
      Promise.all(STATUSES.map(async (status) => [status, await PurchaseOrder.count({ where: { ...where, status } })])),
      PurchaseOrder.findAll({ attributes: ['supplierName'], group: ['supplierName'], order: [['supplierName', 'ASC']], raw: true }),
      Department.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
    ]);
    return res.json({
      success: true,
      data: {
        purchases: result.rows.map(normalize),
        summary: { total: result.count, totalValue: number(totalValue), ...Object.fromEntries(statusCounts) },
        filters: { statuses: STATUSES, suppliers: suppliers.map((row) => row.supplierName).filter(Boolean), departments },
      },
      pagination: { page, limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / limit)), pages: Math.max(1, Math.ceil(result.count / limit)) },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    return next(error);
  }
};

const getPurchaseHistory = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Purchase history record not found' });
    return res.json({ success: true, data: normalize(record) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listPurchaseHistory, getPurchaseHistory };