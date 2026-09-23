const { Op } = require('sequelize');
const { sequelize, Asset, CapitalizationRecord, Invoice, InvoiceItem, PurchaseOrder, PurchaseOrderItem, InventoryTransaction, AuditLog, User, Department } = require('../models');
const { buildAssetCodeFromConfig } = require('../controllers/assetExtendedController');

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const fail = (message, status = 422) => Object.assign(new Error(message), { status });

const getReceiving = async (purchaseOrder, transaction) => {
  const rows = await InventoryTransaction.findAll({ where: { type: 'receive' }, order: [['createdAt', 'ASC']], transaction });
  const poNumber = String(purchaseOrder.poNumber || '').toLowerCase();
  const supplier = String(purchaseOrder.supplierName || '').toLowerCase();
  return rows.filter((row) => {
    const notes = String(row.notes || '').toLowerCase();
    return notes.includes(poNumber) || (supplier && notes.includes(supplier));
  });
};

const getEligibility = async (invoice, transaction) => {
  const purchaseOrder = invoice.purchaseOrderId ? await PurchaseOrder.findByPk(invoice.purchaseOrderId, { include: [{ model: PurchaseOrderItem, as: 'items' }], transaction }) : null;
  const reasons = [];
  if (!purchaseOrder) reasons.push('A purchase order is required.');
  if (purchaseOrder && !['Approved', 'Completed'].includes(purchaseOrder.status)) reasons.push('Purchase order is not approved.');
  if (invoice.verificationStatus !== 'Verified') reasons.push('Invoice must be financially verified.');
  if (invoice.approvalStatus !== 'Approved') reasons.push('Invoice must be approved.');
  const receiving = purchaseOrder ? await getReceiving(purchaseOrder, transaction) : [];
  if (!receiving.length) reasons.push('No receiving evidence is linked to this purchase order.');
  const existing = await CapitalizationRecord.findOne({ where: { invoiceId: invoice.id, status: 'CAPITALIZED' }, transaction });
  if (existing) reasons.push('This invoice has already been capitalized.');
  return { eligible: reasons.length === 0, reasons, purchaseOrder, receiving, existing };
};

const normalize = (record) => {
  const value = record.toJSON ? record.toJSON() : record;
  return {
    ...value,
    assetId: value.assetId,
    invoiceId: value.invoiceId,
    purchaseOrderId: value.purchaseOrderId,
    capitalizedAmount: number(value.capitalizedAmount),
    asset: value.Asset || null,
    invoice: value.Invoice || null,
    purchaseOrder: value.PurchaseOrder || null,
    createdByName: value.Creator?.fullName || value.Creator?.username || '',
  };
};

const list = async ({ query = {} } = {}) => {
  const where = {};
  const search = String(query.search || '').trim();
  const invoiceWhere = search ? { [Op.or]: [{ invoiceNumber: { [Op.like]: `%${search}%` } }, { supplierName: { [Op.like]: `%${search}%` } }] } : undefined;
  const include = [
    { model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'purchasePrice', 'purchaseDate', 'currentValue'], required: false },
    { model: Invoice, include: [{ model: InvoiceItem, as: 'items' }], where: invoiceWhere, required: Boolean(invoiceWhere) },
    { model: PurchaseOrder, attributes: ['id', 'poNumber', 'supplierName', 'totalAmount', 'status'], required: false },
    { model: User, as: 'Creator', attributes: ['id', 'username', 'fullName'], required: false },
  ];
  const [records, invoices] = await Promise.all([
    CapitalizationRecord.findAll({ where, include, order: [['createdAt', 'DESC']] }),
    Invoice.findAll({ include: [{ model: PurchaseOrder, as: 'PurchaseOrder', required: false }], order: [['createdAt', 'DESC']] }),
  ]);
  const candidates = [];
  for (const invoice of invoices) {
    const eligibility = await getEligibility(invoice);
    if (!eligibility.existing) candidates.push({ invoice: invoice.toJSON(), purchaseOrder: eligibility.purchaseOrder?.toJSON() || null, receiving: eligibility.receiving.map((row) => row.toJSON()), eligible: eligibility.eligible, reasons: eligibility.reasons });
  }
  return { records: records.map(normalize), candidates };
};

const capitalize = async ({ invoiceId, userId, category, name, serialNumber = '', manufacturer = '', model = '', notes = '' }) => {
  const transaction = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(invoiceId, { include: [{ model: InvoiceItem, as: 'items' }], transaction, lock: transaction.LOCK.UPDATE });
    if (!invoice) throw fail('Invoice not found.', 404);
    const eligibility = await getEligibility(invoice, transaction);
    if (!eligibility.eligible) throw fail(`Transaction is not eligible for capitalization: ${eligibility.reasons.join(' ')}`, 409);
    const purchaseOrder = eligibility.purchaseOrder;
    const item = invoice.items?.[0];
    const assetName = String(name || item?.description || '').trim();
    const assetCategory = String(category || '');
    if (!assetName || !assetCategory) throw fail('Asset name and category are required.', 422);
    const amount = number(invoice.totalAmount);
    if (amount <= 0) throw fail('Invoice total must be greater than zero.', 422);
    const assetCode = await buildAssetCodeFromConfig({ category: assetCategory, transaction });
    if (!assetCode) throw fail('Asset code could not be generated from the current asset numbering configuration.', 422);
    const duplicateCode = await Asset.findOne({ where: { assetCode }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicateCode) throw fail('Generated asset code already exists. Retry the operation.', 409);
    const asset = await Asset.create({ name: assetName, assetCode, category: assetCategory, serialNumber: String(serialNumber || ''), manufacturer: String(manufacturer || ''), model: String(model || ''), departmentId: purchaseOrder.departmentId || null, purchaseDate: invoice.invoiceDate, purchasePrice: amount, currentValue: amount, supplier: invoice.supplierName, status: 'available', condition: 'Good', notes: String(notes || ''), createdBy: userId }, { transaction });
    const record = await CapitalizationRecord.create({ assetId: asset.id, invoiceId: invoice.id, purchaseOrderId: purchaseOrder.id, createdBy: userId, capitalizedAmount: amount, acquisitionDate: invoice.invoiceDate, capitalizationDate: new Date(), notes: String(notes || '') }, { transaction });
    await AuditLog.create({ userId, action: 'ASSET_CREATED_FROM_CAPITALIZATION', entity: `asset:${asset.id}`, details: JSON.stringify({ capitalizationId: record.id, invoiceId: invoice.id, purchaseOrderId: purchaseOrder.id, amount }) }, { transaction });
    await transaction.commit();
    return { record, asset };
  } catch (error) { await transaction.rollback(); throw error; }
};

module.exports = { list, capitalize, getEligibility };
