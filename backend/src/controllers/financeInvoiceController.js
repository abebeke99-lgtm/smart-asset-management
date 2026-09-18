const { Op } = require('sequelize');
const { sequelize, AuditLog, Department, Invoice, InvoiceItem, PurchaseOrder, User } = require('../models');

const STATUSES = ['Draft', 'Pending', 'Approved', 'Due', 'Paid', 'Cancelled'];
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const fail = (message, status = 422) => Object.assign(new Error(message), { status });

const include = [
  { model: InvoiceItem, as: 'items' },
  { model: PurchaseOrder, as: 'PurchaseOrder', attributes: ['id', 'poNumber', 'supplierName', 'departmentId'] },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
  { model: User, as: 'Creator', attributes: ['id', 'username', 'fullName'], required: false },
];

const normalize = (record) => {
  const value = record.toJSON ? record.toJSON() : record;
  const totalAmount = number(value.totalAmount);
  const paidAmount = number(value.paidAmount);
  return {
    ...value,
    subtotal: number(value.subtotal),
    taxAmount: number(value.taxAmount),
    discountAmount: number(value.discountAmount),
    totalAmount,
    paidAmount,
    balanceAmount: Math.max(0, totalAmount - paidAmount),
    paymentStatus: paidAmount >= totalAmount && totalAmount > 0 ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Unpaid',
    purchaseOrderNumber: value.PurchaseOrder?.poNumber || '',
    departmentName: value.DepartmentRecord?.name || '',
    createdByName: value.Creator?.fullName || value.Creator?.username || '',
    items: (value.items || []).map((item) => ({ ...item, quantity: number(item.quantity), unitPrice: number(item.unitPrice), taxRate: number(item.taxRate), discount: number(item.discount), lineTotal: number(item.lineTotal) })),
  };
};

const buildWhere = (query) => {
  const where = {};
  const search = String(query.search || '').trim();
  if (search) where[Op.or] = [{ invoiceNumber: { [Op.like]: `%${search}%` } }, { supplierName: { [Op.like]: `%${search}%` } }];
  if (STATUSES.includes(query.status)) where.status = query.status;
  if (query.supplier) where.supplierName = { [Op.like]: `%${String(query.supplier).trim()}%` };
  const departmentId = Number(query.departmentId || query.department);
  if (Number.isInteger(departmentId) && departmentId > 0) where.departmentId = departmentId;
  return where;
};

const validateItems = (items) => {
  if (!Array.isArray(items) || !items.length) throw fail('At least one invoice item is required');
  return items.map((item) => {
    const description = String(item.description || item.itemName || '').trim();
    const quantity = number(item.quantity);
    const unitPrice = number(item.unitPrice);
    const taxRate = number(item.taxRate);
    const discount = number(item.discount);
    if (!description || quantity <= 0 || unitPrice < 0 || taxRate < 0 || discount < 0) throw fail('Each invoice item must have valid description, quantity, price, tax, and discount');
    const lineSubtotal = quantity * unitPrice;
    const lineTotal = Math.max(0, lineSubtotal - discount) * (1 + taxRate / 100);
    return { description, quantity, unit: String(item.unit || 'pcs').trim(), unitPrice, taxRate, discount, lineTotal };
  });
};

const payloadFor = async (body, transaction, existing = null) => {
  const items = body.items === undefined && existing ? existing.items : validateItems(body.items);
  const normalizedItems = Array.isArray(items) && items[0]?.lineTotal !== undefined ? items : validateItems(items);
  const purchaseOrderId = body.purchaseOrderId ? Number(body.purchaseOrderId) : existing?.purchaseOrderId || null;
  const purchaseOrder = purchaseOrderId ? await PurchaseOrder.findByPk(purchaseOrderId, { transaction }) : null;
  if (purchaseOrderId && !purchaseOrder) throw fail('Purchase order not found');
  const supplierName = String(body.supplierName || purchaseOrder?.supplierName || existing?.supplierName || '').trim();
  if (!supplierName) throw fail('Supplier name is required');
  const invoiceDate = body.invoiceDate || existing?.invoiceDate;
  if (!invoiceDate) throw fail('Invoice date is required');
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
  const taxAmount = normalizedItems.reduce((sum, item) => sum + Math.max(0, item.quantity * item.unitPrice - item.discount) * item.taxRate / 100, 0);
  return {
    values: {
      invoiceNumber: String(body.invoiceNumber || existing?.invoiceNumber || '').trim(), supplierName, purchaseOrderId,
      departmentId: body.departmentId ? Number(body.departmentId) : purchaseOrder?.departmentId || existing?.departmentId || null,
      invoiceDate, dueDate: body.dueDate || existing?.dueDate || null, currency: String(body.currency || existing?.currency || 'ETB').trim(),
      subtotal, taxAmount, discountAmount, totalAmount: Math.max(0, subtotal - discountAmount + taxAmount),
      paidAmount: number(body.paidAmount, existing ? number(existing.paidAmount) : 0),
      status: STATUSES.includes(body.status) ? body.status : existing?.status || 'Pending', paymentTerms: String(body.paymentTerms || existing?.paymentTerms || ''),
      taxNumber: String(body.taxNumber || existing?.taxNumber || ''), referenceNumber: String(body.referenceNumber || existing?.referenceNumber || ''), notes: String(body.notes || existing?.notes || ''),
    }, items: normalizedItems,
  };
};

const getInvoice = async (req, res, next) => {
  try {
    const record = await Invoice.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Invoice not found' });
    return res.json({ success: true, data: normalize(record) });
  } catch (error) { return next(error); }
};

const listInvoices = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 10));
    const where = buildWhere(req.query);
    const result = await Invoice.findAndCountAll({ where, include, distinct: true, limit, offset: (page - 1) * limit, order: [['createdAt', 'DESC']] });
    const rows = result.rows.map(normalize);
    const totalValue = rows.reduce((sum, row) => sum + row.totalAmount, 0);
    const outstanding = rows.reduce((sum, row) => sum + row.balanceAmount, 0);
    return res.json({ success: true, data: rows, summary: { total: result.count, totalValue, outstanding }, filters: { statuses: STATUSES }, pagination: { page, limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / limit)), pages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) { return next(error); }
};

const createInvoice = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const prepared = await payloadFor(req.body, transaction);
    if (!prepared.values.invoiceNumber) throw fail('Invoice number is required');
    const invoice = await Invoice.create({ ...prepared.values, createdBy: req.user.id }, { transaction });
    await InvoiceItem.bulkCreate(prepared.items.map((item) => ({ ...item, invoiceId: invoice.id })), { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'INVOICE_CREATED', entity: `invoice:${invoice.id}`, details: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }) }, { transaction });
    await transaction.commit();
    return getInvoice({ ...req, params: { id: invoice.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const updateInvoice = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.params.id, { include: [{ model: InvoiceItem, as: 'items' }], transaction, lock: transaction.LOCK.UPDATE });
    if (!invoice) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found' }); }
    const prepared = await payloadFor(req.body, transaction, invoice);
    if (prepared.values.invoiceNumber && prepared.values.invoiceNumber !== invoice.invoiceNumber) {
      const duplicate = await Invoice.findOne({ where: { invoiceNumber: prepared.values.invoiceNumber, id: { [Op.ne]: invoice.id } }, transaction });
      if (duplicate) throw fail('Invoice number already exists', 409);
    }
    if (prepared.values.paidAmount > prepared.values.totalAmount) throw fail('Paid amount cannot exceed invoice total');
    await invoice.update(prepared.values, { transaction });
    if (req.body.items !== undefined) { await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction }); await InvoiceItem.bulkCreate(prepared.items.map((item) => ({ ...item, invoiceId: invoice.id })), { transaction }); }
    await AuditLog.create({ userId: req.user.id, action: 'INVOICE_UPDATED', entity: `invoice:${invoice.id}`, details: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }) }, { transaction });
    await transaction.commit();
    return getInvoice({ ...req, params: { id: invoice.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const deleteInvoice = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!invoice) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found' }); }
    if (number(invoice.paidAmount) > 0 || ['Approved', 'Paid'].includes(invoice.status)) throw fail('Approved or paid invoices cannot be deleted', 409);
    await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction });
    await invoice.destroy({ transaction });
    await AuditLog.create({ userId: req.user.id, action: 'INVOICE_DELETED', entity: `invoice:${req.params.id}`, details: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice };
