const { Asset, FinancialRecord, PurchaseOrder, PurchaseOrderItem, Department } = require('../models');

const financeRoles = ['admin', 'finance'];
const money = (value) => Number(value || 0);

const ensureFinance = (req, res) => {
  if (!financeRoles.includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Finance authorization required' });
    return false;
  }
  return true;
};

const parseDate = (value, field) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const error = new Error(`${field} must use YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return String(value);
};

const toTransaction = (row) => ({
  ...row,
  amount: money(row.amount),
  debit: money(row.debit),
  credit: money(row.credit),
  currency: row.currency || 'ETB',
  notes: row.notes || '',
});

const listFinanceTransactions = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 10));
    const search = String(req.query.search || '').trim().toLowerCase();
    const requestedType = String(req.query.transactionType || req.query.type || '').trim().toLowerCase();
    const requestedReference = String(req.query.referenceType || req.query.reference_type || '').trim().toLowerCase();
    const requestedStatus = String(req.query.status || '').trim().toLowerCase();
    const dateFrom = parseDate(req.query.dateFrom || req.query.date_from, 'dateFrom');
    const dateTo = parseDate(req.query.dateTo || req.query.date_to, 'dateTo');
    if (dateFrom && dateTo && dateFrom > dateTo) return res.status(400).json({ success: false, message: 'dateFrom cannot be later than dateTo' });

    const [assets, records, orders] = await Promise.all([
      Asset.findAll({ include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }] }),
      FinancialRecord.findAll({ include: [{ model: Asset, attributes: ['assetCode', 'name', 'supplier', 'department'] }] }),
      PurchaseOrder.findAll({ include: [{ model: PurchaseOrderItem, as: 'items' }, { model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }] }),
    ]);

    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const rows = [
      ...assets.filter((asset) => money(asset.purchasePrice) > 0 && asset.purchaseDate).map((asset) => ({
        id: `asset-${asset.id}`, transactionNumber: `ASSET-${asset.id}`, transactionDate: asset.purchaseDate,
        transactionType: 'Purchase', referenceType: 'Asset', referenceId: asset.id,
        referenceNumber: asset.assetCode || `ASSET-${asset.id}`, accountCode: '1500', accountName: 'Asset acquisition',
        description: `Asset acquisition: ${asset.name}`, supplierName: asset.supplier || '',
        departmentName: asset.DepartmentRecord?.name || asset.department || 'Unassigned', amount: asset.purchasePrice,
        debit: asset.purchasePrice, credit: 0, status: 'Posted', source: 'assets', notes: asset.notes,
        createdAt: asset.createdAt, updatedAt: asset.updatedAt,
      })),
      ...records.map((record) => {
        const asset = assetById.get(record.assetId) || record.Asset;
        const amount = money(record.additionalCosts) || money(record.purchaseCost) || money(record.depreciationAmount);
        const isDepreciation = record.type === 'depreciation';
        return {
          id: `financial-${record.id}`, transactionNumber: `FIN-${record.id}`, transactionDate: record.createdAt,
          transactionType: isDepreciation ? 'Adjustment' : 'Valuation', referenceType: 'Financial record', referenceId: record.id,
          referenceNumber: asset?.assetCode || `ASSET-${record.assetId}`, accountCode: isDepreciation ? '6100' : '1500',
          accountName: isDepreciation ? 'Depreciation expense' : 'Asset valuation',
          description: `${record.type} for ${asset?.name || `asset ${record.assetId}`}`, supplierName: asset?.supplier || '',
          departmentName: asset?.DepartmentRecord?.name || asset?.department || 'Unassigned', amount,
          debit: isDepreciation ? amount : 0, credit: isDepreciation ? 0 : amount, status: 'Posted', source: 'financial_records',
          notes: record.notes, createdAt: record.createdAt, updatedAt: record.updatedAt,
        };
      }),
      ...orders.map((order) => ({
        id: `order-${order.id}`, transactionNumber: order.poNumber, transactionDate: order.orderDate,
        transactionType: 'Purchase order', referenceType: 'Purchase order', referenceId: order.id,
        referenceNumber: order.poNumber, accountCode: '2100', accountName: 'Accounts payable',
        description: `Purchase order ${order.poNumber}`, supplierName: order.supplierName,
        departmentName: order.DepartmentRecord?.name || 'Unassigned', amount: order.totalAmount, debit: 0,
        credit: order.totalAmount, currency: order.currency, status: order.status, source: 'purchase_orders',
        notes: order.notes, createdAt: order.createdAt, updatedAt: order.updatedAt,
      })),
    ];

    const filtered = rows.filter((row) => !requestedType || row.transactionType.toLowerCase() === requestedType)
      .filter((row) => !requestedReference || row.referenceType.toLowerCase() === requestedReference)
      .filter((row) => !requestedStatus || row.status.toLowerCase() === requestedStatus)
      .filter((row) => !dateFrom || String(row.transactionDate).slice(0, 10) >= dateFrom)
      .filter((row) => !dateTo || String(row.transactionDate).slice(0, 10) <= dateTo)
      .filter((row) => !search || [row.transactionNumber, row.referenceNumber, row.description, row.supplierName, row.accountName, row.source].some((value) => String(value || '').toLowerCase().includes(search)))
      .sort((left, right) => new Date(right.transactionDate) - new Date(left.transactionDate) || String(right.id).localeCompare(String(left.id)))
      .map(toTransaction);

    const total = filtered.length;
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    const summary = filtered.reduce((result, row) => ({
      count: result.count + 1, debitTotal: result.debitTotal + row.debit,
      creditTotal: result.creditTotal + row.credit, amountTotal: result.amountTotal + row.amount,
    }), { count: 0, debitTotal: 0, creditTotal: 0, amountTotal: 0 });

    return res.json({ success: true, data, transactions: data, summary, pagination: { page, pageSize, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    return next(error);
  }
};

module.exports = { listFinanceTransactions };