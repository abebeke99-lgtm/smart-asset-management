const { sequelize, Asset, FinancialRecord, DepreciationRecord, CapitalizationRecord, AuditLog, User, Department, PurchaseOrder, Invoice, Payment, InventoryTransaction, Budget, FiscalYear, FundSource, College } = require('../models');
const { Op } = require('sequelize');
const { summarizeBudget, cents } = require('../services/budgetService');
const depreciationService = require('../services/depreciationService');

const financeRoles = ['admin', 'finance'];
const ensureFinance = (req, res) => {
  if (!financeRoles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Finance authorization required' }); return false; }
  return true;
};
const money = (value) => Number(value || 0);
const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/[_ ]+/g, '-');
const parseDateFilter = (value, fieldName) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} is not a valid date`);
    error.status = 400;
    throw error;
  }
  return date;
};
const normalizeAsset = (asset) => {
  const data = asset.toJSON();
  const purchaseCost = Number(data.purchasePrice || 0);
  const currentValue = Number(data.currentValue || 0);
  const record = asset.latestFinancialRecord;
  const residualValue = record ? Number(record.residualValue || 0) : null;
  const usefulLife = record ? Number(record.usefulLife || 0) : null;
  const additionalCosts = record ? Number(record.additionalCosts || 0) : 0;
  const accumulatedDepreciation = record ? Number(record.depreciationAmount || 0) : null;
  const departmentName = asset.DepartmentRecord?.name || data.department || '';
  return {
    ...data,
    id: data.id,
    asset_id: data.id,
    asset_tag: data.assetCode,
    department_name: departmentName,
    category_name: data.category || '',
    purchase_cost: purchaseCost,
    current_value: currentValue,
    residual_value: residualValue,
    useful_life: usefulLife,
    depreciation_method: record?.depreciationMethod || null,
    accumulated_depreciation: accumulatedDepreciation,
    valuation_status: record ? 'Current' : 'Not Valued',
    valuation_date: record?.createdAt || null,
    latestFinancialRecord: record ? record.toJSON() : null,
    financial: {
      totalCost: purchaseCost + additionalCosts,
      bookValue: currentValue,
      residualValue,
      usefulLife,
      accumulatedDepreciation,
      annualDepreciation: record && usefulLife > 0 ? Math.max(0, (purchaseCost + additionalCosts - residualValue) / usefulLife) : null,
    },
  };
};

const getValuationSummary = (assets) => {
  const totalAcquisitionCost = assets.reduce((sum, asset) => sum + Number(asset.purchase_cost ?? asset.purchaseCost ?? asset.purchasePrice ?? 0), 0);
  const totalCurrentBookValue = assets.reduce((sum, asset) => sum + Number(asset.current_value ?? asset.currentValue ?? asset.bookValue ?? 0), 0);
  const totalAccumulatedDepreciation = assets.reduce((sum, asset) => sum + Math.max(0, Number(asset.accumulated_depreciation ?? asset.accumulatedDepreciation ?? 0)), 0);
  const requiringValuation = assets.filter((asset) => Number(asset.current_value ?? asset.currentValue ?? 0) <= 0 || Number(asset.purchase_cost ?? asset.purchaseCost ?? asset.purchasePrice ?? 0) <= 0).length;

  return {
    totalAssets: assets.length,
    totalAcquisitionCost,
    totalCurrentBookValue,
    totalAccumulatedDepreciation,
    requiringValuation,
  };
};

const buildValuationFilters = async () => {
  const [departments, categories, statuses, conditions] = await Promise.all([
    Department.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']], raw: true }),
    Asset.findAll({ attributes: ['category'], group: ['category'], order: [['category', 'ASC']], raw: true }),
    Asset.findAll({ attributes: ['status'], group: ['status'], order: [['status', 'ASC']], raw: true }),
    Asset.findAll({ attributes: ['condition'], group: ['condition'], order: [['condition', 'ASC']], raw: true }),
  ]);

  return {
    departments: departments.map((department) => ({ id: department.id, name: department.name })),
    categories: categories.filter((row) => row.category).map((row) => row.category),
    statuses: statuses.filter((row) => row.status).map((row) => row.status),
    conditions: conditions.filter((row) => row.condition).map((row) => row.condition),
    valuationStatuses: ['valued', 'not-valued'],
  };
};

const getFinanceDashboardFilters = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const [departments, categories, statuses, years] = await Promise.all([
      Department.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ attributes: ['category'], group: ['category'], order: [['category', 'ASC']], raw: true }),
      Asset.findAll({ attributes: ['status'], group: ['status'], order: [['status', 'ASC']], raw: true }),
      DepreciationRecord.findAll({ attributes: ['period'], where: { status: 'POSTED' }, group: ['period'], order: [['period', 'ASC']], raw: true }),
    ]);

    const financialYears = [...new Set(years
      .map((row) => row.purchaseDate ? new Date(row.purchaseDate).getFullYear() : null)
      .filter((value) => Number.isInteger(value) && value > 2000))]
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: String(year) }));

    res.json({
      success: true,
      data: {
        departments: departments.map((department) => ({ value: String(department.id), label: department.name })),
        categories: categories.filter((category) => category.category).map((category) => ({ value: String(category.category), label: category.category })),
        statuses: statuses.filter((status) => status.status).map((status) => ({ value: String(status.status), label: status.status })),
        financialYears,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const getFinanceDashboard = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;

    const filters = {
      dateFrom: req.query.dateFrom || req.query.date_from || null,
      dateTo: req.query.dateTo || req.query.date_to || null,
      department: req.query.department || req.query.departmentId || null,
      category: req.query.category || null,
      status: req.query.status || null,
      financialYear: req.query.financialYear || req.query.financial_year || null,
    };

    const where = {};
    if (filters.department) {
      const departmentId = Number(filters.department);
      if (!Number.isInteger(departmentId) || departmentId < 1) {
        return res.status(400).json({ success: false, message: 'Department filter must be a valid department id' });
      }
      where.departmentId = departmentId;
    }
    if (filters.category) where.category = filters.category;
    if (filters.status) {
      const status = normalizeStatus(filters.status);
      where.status = { [Op.in]: [filters.status, status, status.replace(/-/g, ' ')] };
    }
    if (filters.dateFrom || filters.dateTo || filters.financialYear) {
      const purchaseDateWhere = {};
      const dateFrom = parseDateFilter(filters.dateFrom, 'dateFrom');
      const dateTo = parseDateFilter(filters.dateTo, 'dateTo');
      if (dateFrom) purchaseDateWhere[Op.gte] = dateFrom;
      if (filters.dateTo) {
        const endDate = dateTo;
        endDate.setHours(23, 59, 59, 999);
        purchaseDateWhere[Op.lte] = endDate;
      }
      if (Object.keys(purchaseDateWhere).length) where.purchaseDate = purchaseDateWhere;
      if (filters.financialYear) {
        const yearNumber = Number(filters.financialYear);
        if (!/^\d{4}$/.test(String(filters.financialYear)) || !Number.isInteger(yearNumber)) {
          return res.status(400).json({ success: false, message: 'Financial year must be a valid four-digit year' });
        }
        where.purchaseDate = {
          ...where.purchaseDate,
          [Op.gte]: new Date(`${yearNumber}-01-01T00:00:00.000Z`),
          [Op.lt]: new Date(`${yearNumber + 1}-01-01T00:00:00.000Z`),
        };
      }
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return res.status(400).json({ success: false, message: 'dateFrom cannot be later than dateTo' });
      }
    }

    const assets = await Asset.findAll({
      where,
      include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }],
      order: [['purchaseDate', 'DESC'], ['id', 'DESC']],
    });

    const totalAssetCost = assets.reduce((sum, asset) => sum + money(asset.purchasePrice), 0);
    const currentBookValue = assets.reduce((sum, asset) => sum + money(asset.currentValue), 0);
    const accumulatedDepreciation = assets.reduce((sum, asset) => sum + Math.max(0, money(asset.purchasePrice) - money(asset.currentValue)), 0);
    const activeAssets = assets.filter((asset) => !['disposed', 'inactive', 'retired'].includes(normalizeStatus(asset.status))).length;
    const assetsUnderMaintenance = assets.filter((asset) => ['under-maintenance', 'in-maintenance', 'maintenance'].includes(normalizeStatus(asset.status))).length;
    const disposedAssets = assets.filter((asset) => ['disposed', 'retired'].includes(normalizeStatus(asset.status))).length;
    const assetsRequiringValuation = assets.filter((asset) => Number(asset.currentValue || 0) <= 0 || Number(asset.purchasePrice || 0) <= 0).length;

    const departmentCounts = new Map();
    const categoryCounts = new Map();
    const statusCounts = new Map();
    const monthCounts = new Map();

    for (const asset of assets) {
      const departmentKey = asset.DepartmentRecord?.name || asset.department || 'Unassigned';
      const categoryKey = asset.category || 'Uncategorized';
      const statusKey = asset.status || 'Available';
      const monthKey = new Date(asset.purchaseDate || asset.createdAt).toISOString().slice(0, 7) || 'Unknown';
      departmentCounts.set(departmentKey, (departmentCounts.get(departmentKey) || 0) + money(asset.currentValue));
      categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + money(asset.currentValue));
      statusCounts.set(statusKey, (statusCounts.get(statusKey) || 0) + 1);
      monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + money(asset.currentValue));
    }

    const response = {
      success: true,
      data: {
        summary: {
          totalAssetCost,
          currentBookValue,
          accumulatedDepreciation,
          totalAssets: assets.length,
          activeAssets,
          underMaintenance: assetsUnderMaintenance,
          disposed: disposedAssets,
          requiringValuation: assetsRequiringValuation,
        },
        byDepartment: Array.from(departmentCounts.entries()).map(([label, value]) => ({ label, value })),
        byCategory: Array.from(categoryCounts.entries()).map(([label, value]) => ({ label, value })),
        byStatus: Array.from(statusCounts.entries()).map(([label, value]) => ({ label, value })),
        valueTrend: Array.from(monthCounts.entries()).map(([label, value]) => ({ label, value })),
      },
    };

    res.json(response);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const listValuation = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;

    const search = String(req.query.search || '').trim();
    const department = req.query.department || req.query.departmentId || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const valuationStatus = String(req.query.valuationStatus || req.query.valuation_status || '').trim();
    const dateFrom = req.query.dateFrom || req.query.date_from || '';
    const dateTo = req.query.dateTo || req.query.date_to || '';
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const sort = req.query.sort || 'id';
    const direction = String(req.query.direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const where = {};
    if (department) where.departmentId = Number(department);
    if (category) where.category = category;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.purchaseDate = {};
      if (dateFrom) where.purchaseDate[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) {
        const endDate = new Date(`${dateTo}T23:59:59.999Z`);
        where.purchaseDate[Op.lte] = endDate;
      }
    }

    const assets = await Asset.findAll({
      where,
      include: [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false }],
      order: [[sort, direction]],
    });

    const records = await FinancialRecord.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    const latestByAsset = new Map();
    records.forEach((record) => { if (!latestByAsset.has(record.assetId)) latestByAsset.set(record.assetId, record); });
    const enrichedAssets = assets.map((asset) => {
      asset.latestFinancialRecord = latestByAsset.get(asset.id);
      return asset;
    });

    const filteredAssets = enrichedAssets.filter((asset) => {
      const normalized = normalizeAsset(asset);
      const haystack = [
        normalized.asset_tag,
        normalized.name,
        normalized.category_name,
        normalized.department_name,
        normalized.supplier,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesValuationStatus = !valuationStatus || (valuationStatus === 'valued' ? !!normalized.latestFinancialRecord : !normalized.latestFinancialRecord);
      return matchesSearch && matchesValuationStatus;
    });

    const total = filteredAssets.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, pages);
    const startIndex = (currentPage - 1) * limit;
    const paginatedAssets = filteredAssets.slice(startIndex, startIndex + limit).map(normalizeAsset);
    const filters = await buildValuationFilters();
    const summary = getValuationSummary(paginatedAssets);

    res.json({
      success: true,
      assets: paginatedAssets,
      data: { assets: paginatedAssets },
      summary,
      filters,
      pagination: { page: currentPage, pages, total },
    });
  } catch (e) { next(e); }
};

const getAssetValuationDetail = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const asset = await Asset.findByPk(req.params.id, {
      include: [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false }],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const latestRecord = await FinancialRecord.findOne({
      where: { assetId: asset.id },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    asset.latestFinancialRecord = latestRecord;
    const normalized = normalizeAsset(asset);
    const history = await FinancialRecord.findAll({
      where: { assetId: asset.id },
      include: [{ model: User, attributes: ['username', 'fullName'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, asset: normalized, financial: normalized.financial, history });
  } catch (error) {
    next(error);
  }
};

const getAssetDepreciationDetail = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const depreciationRecords = await FinancialRecord.findAll({
      where: { assetId: asset.id, type: 'depreciation' },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });

    res.json({
      success: true,
      assetId: asset.id,
      asset: { id: asset.id, assetCode: asset.assetCode, name: asset.name },
      depreciation: depreciationRecords[0] || null,
      history: depreciationRecords,
    });
  } catch (error) {
    next(error);
  }
};

const updateValuation = async (req, res, next) => {
  if (!ensureFinance(req, res)) return;
  const tx = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!asset) { await tx.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const purchaseCost = Number(req.body.purchase_cost ?? asset.purchasePrice ?? 0);
    const additionalCosts = Number(req.body.additional_costs ?? 0);
    const residualValue = Number(req.body.residual_value ?? 0);
    const usefulLife = Number(req.body.useful_life ?? 5);
    const accumulatedDepreciation = Number(req.body.accumulated_depreciation ?? 0);
    const currentValue = Number(req.body.book_value ?? req.body.current_value ?? asset.currentValue ?? purchaseCost);
    const method = String(req.body.depreciation_method || 'straight-line').toLowerCase();
    if (![purchaseCost, additionalCosts, residualValue, usefulLife, accumulatedDepreciation, currentValue].every(Number.isFinite)) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Financial values must be valid numbers' }); }
    if (purchaseCost < 0 || additionalCosts < 0 || residualValue < 0 || accumulatedDepreciation < 0 || currentValue < 0) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Financial values cannot be negative' }); }
    if (usefulLife <= 0 || !Number.isInteger(usefulLife)) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Useful life must be a positive whole number' }); }
    if (residualValue > purchaseCost + additionalCosts) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Residual value cannot exceed total acquisition cost' }); }
    if (accumulatedDepreciation > purchaseCost + additionalCosts - residualValue) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Accumulated depreciation is too high' }); }
    if (currentValue < residualValue || currentValue > purchaseCost + additionalCosts) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Book value must remain between residual value and total acquisition cost' }); }
    if (!['straight-line', 'declining-balance', 'reducing-balance'].includes(method)) { await tx.rollback(); return res.status(400).json({ success: false, message: 'Invalid depreciation method' }); }
    const previous = { purchaseCost: Number(asset.purchasePrice || 0), currentValue: Number(asset.currentValue || 0) };
    await asset.update({ purchasePrice: purchaseCost, currentValue }, { transaction: tx });
    const record = await FinancialRecord.create({ assetId: asset.id, recordedBy: req.user.id, type: req.body.type || (req.body.accumulated_depreciation !== undefined ? 'depreciation' : 'valuation'), purchaseCost, additionalCosts, residualValue, usefulLife, depreciationMethod: method, depreciationAmount: accumulatedDepreciation, currentValue, notes: req.body.notes || req.body.depreciation_notes || '' }, { transaction: tx });
    await AuditLog.create({ userId: req.user.id, action: req.body.accumulated_depreciation !== undefined ? 'DEPRECIATION_RECALCULATED' : 'VALUATION_CHANGE', entity: `asset:${asset.id}`, details: JSON.stringify({ previous, next: { purchaseCost, currentValue, residualValue, usefulLife, accumulatedDepreciation, method }, recordId: record.id, reason: req.body.reason || req.body.notes || '' }) }, { transaction: tx });
    await tx.commit();
    asset.latestFinancialRecord = record;
    res.json({ success: true, asset: normalizeAsset(asset), record });
  } catch (e) { await tx.rollback(); next(e); }
};
const valuationHistory = async (req, res, next) => { try { if (!ensureFinance(req, res)) return; const records = await FinancialRecord.findAll({ where: { assetId: req.params.id }, include: [{ model: User, attributes: ['username', 'fullName'] }], order: [['createdAt', 'DESC']] }); res.json({ success: true, history: records }); } catch (e) { next(e); } };
const listAudit = async (req, res, next) => { try { if (!ensureFinance(req, res)) return; const logs = await AuditLog.findAll({ include: [{ model: User, attributes: ['username', 'fullName', 'role'] }], order: [['createdAt', 'DESC']] }); res.json({ success: true, logs, total: logs.length }); } catch (e) { next(e); } };

const listSuppliers = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim();
    const where = { supplier: search ? { [Op.like]: `%${search}%` } : { [Op.ne]: '' } };
    const [totalRow, suppliers] = await Promise.all([
      Asset.count({ distinct: true, col: 'supplier', where }),
      Asset.findAll({
        attributes: [['supplier', 'supplierName'], [sequelize.fn('COUNT', sequelize.col('id')), 'assetCount'], [sequelize.fn('MIN', sequelize.col('createdAt')), 'firstRecordedAt'], [sequelize.fn('MAX', sequelize.col('purchaseDate')), 'lastPurchaseDate']],
        where,
        group: ['supplier'],
        order: [[sequelize.literal('supplier'), 'ASC']],
        limit,
        offset: (page - 1) * limit,
        raw: true,
      }),
    ]);
    const total = Number(totalRow || 0);
    res.json({ success: true, data: suppliers.map((supplier) => ({ supplierName: supplier.supplierName, assetCount: Number(supplier.assetCount || 0), firstRecordedAt: supplier.firstRecordedAt, lastPurchaseDate: supplier.lastPurchaseDate })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getFinanceReportFilters = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const [departments, categories, years] = await Promise.all([
      Department.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ attributes: ['category'], group: ['category'], order: [['category', 'ASC']], raw: true }),
      DepreciationRecord.findAll({ attributes: ['period'], where: { status: 'POSTED' }, group: ['period'], order: [['period', 'ASC']], raw: true }),
    ]);

    const financialYears = [...new Set(
      years
        .map((row) => (row.period ? String(row.period).slice(0, 4) : null))
        .filter(Boolean)
    )]
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: String(year) }));

    res.json({
      success: true,
      data: {
        departments: departments.map((department) => ({ value: String(department.id), label: department.name })),
        categories: categories.filter((category) => category.category).map((category) => ({ value: String(category.category), label: category.category })),
        financialYears,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const buildFinanceReportFilters = (query) => {
  const filters = { dateFrom: query.dateFrom || query.date_from || null, dateTo: query.dateTo || query.date_to || null, department: query.department || query.departmentId || null, category: query.category || null, status: query.status || null, financialYear: query.financialYear || query.financial_year || null, reportType: query.reportType || query.report_type || 'comprehensive' };
  const supportedTypes = ['comprehensive', 'asset', 'procurement', 'payments', 'transactions', 'valuation'];
  if (!supportedTypes.includes(filters.reportType)) { const error = new Error(`reportType must be one of: ${supportedTypes.join(', ')}`); error.status = 400; throw error; }
  const dateFrom = parseDateFilter(filters.dateFrom, 'dateFrom');
  const dateTo = parseDateFilter(filters.dateTo, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) { const error = new Error('dateFrom cannot be later than dateTo'); error.status = 400; throw error; }
  if (filters.financialYear && !/^\d{4}$/.test(String(filters.financialYear))) { const error = new Error('financialYear must be a valid four-digit year'); error.status = 400; throw error; }
  if (filters.department && (!Number.isInteger(Number(filters.department)) || Number(filters.department) < 1)) { const error = new Error('department must be a valid department id'); error.status = 400; throw error; }
  return { ...filters, dateFrom, dateTo };
};

const dateWhere = (field, filters) => {
  const where = {};
  if (filters.dateFrom) where[field] = { [Op.gte]: filters.dateFrom };
  if (filters.dateTo) { const end = new Date(filters.dateTo); end.setHours(23, 59, 59, 999); where[field] = { ...(where[field] || {}), [Op.lte]: end }; }
  if (filters.financialYear) where[field] = { ...(where[field] || {}), [Op.gte]: new Date(`${filters.financialYear}-01-01T00:00:00.000Z`), [Op.lt]: new Date(`${Number(filters.financialYear) + 1}-01-01T00:00:00.000Z`) };
  return where;
};

const amount = (value) => Number(value || 0);
const reportYear = (value) => value ? String(new Date(value).getFullYear()) : '';

const buildFinanceReportSummary = ({ assets, purchaseOrders, invoices, payments, transactions }) => ({
  totalAssets: assets.length,
  acquisitionCost: assets.reduce((sum, row) => sum + amount(row.purchasePrice), 0),
  currentBookValue: assets.reduce((sum, row) => sum + amount(row.currentValue), 0),
  accumulatedDepreciation: assets.reduce((sum, row) => sum + Math.max(0, amount(row.purchasePrice) - amount(row.currentValue)), 0),
  capitalAdditions: purchaseOrders.reduce((sum, row) => sum + amount(row.totalAmount), 0),
  purchases: purchaseOrders.reduce((sum, row) => sum + amount(row.totalAmount), 0),
  payments: payments.reduce((sum, row) => sum + amount(row.amount), 0),
  transactions: transactions.reduce((sum, row) => sum + amount(row.quantity), 0),
  procurementRecords: purchaseOrders.length, invoiceRecords: invoices.length, paymentRecords: payments.length, transactionRecords: transactions.length,
});

const listFinanceReports = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const filters = buildFinanceReportFilters(req.query);
    const assetWhere = { ...dateWhere('purchaseDate', filters) };
    if (filters.department) assetWhere.departmentId = Number(filters.department);
    if (filters.category) assetWhere.category = filters.category;
    if (filters.status) assetWhere.status = { [Op.in]: [filters.status, normalizeStatus(filters.status), normalizeStatus(filters.status).replace(/-/g, ' ')] };
    const orderWhere = { ...dateWhere('orderDate', filters) };
    const invoiceWhere = { ...dateWhere('invoiceDate', filters) };
    const paymentWhere = { ...dateWhere('paymentDate', filters) };
    const transactionWhere = { ...dateWhere('createdAt', filters) };
    if (filters.department) { orderWhere.departmentId = Number(filters.department); invoiceWhere.departmentId = Number(filters.department); transactionWhere.departmentId = Number(filters.department); }
    if (filters.status) { orderWhere.status = filters.status; invoiceWhere.status = filters.status; paymentWhere.status = filters.status; }
    const [assets, purchaseOrders, invoices, payments, transactions] = await Promise.all([
      Asset.findAll({ where: assetWhere, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }], order: [['purchaseDate', 'DESC'], ['id', 'DESC']] }),
      PurchaseOrder.findAll({ where: orderWhere, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }], order: [['orderDate', 'DESC'], ['id', 'DESC']] }),
      Invoice.findAll({ where: invoiceWhere, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }], order: [['invoiceDate', 'DESC'], ['id', 'DESC']] }),
      Payment.findAll({ where: paymentWhere, order: [['paymentDate', 'DESC'], ['id', 'DESC']] }),
      InventoryTransaction.findAll({ where: transactionWhere, order: [['createdAt', 'DESC'], ['id', 'DESC']] }),
    ]);
    const assetRows = assets.map((asset) => { const department = asset.DepartmentRecord?.name || asset.department || 'Unassigned'; const purchaseCost = amount(asset.purchasePrice); const currentValue = amount(asset.currentValue); return { id: `asset-${asset.id}`, report_number: `AST-${asset.id}`, report_type: 'asset', report_date: asset.purchaseDate || asset.createdAt, financial_year: reportYear(asset.purchaseDate || asset.createdAt), department, category: asset.category || 'Uncategorized', status: asset.status || 'Active', total_assets: 1, acquisition_cost: purchaseCost, current_book_value: currentValue, accumulated_depreciation: Math.max(0, purchaseCost - currentValue), notes: asset.notes || '' }; });
    const orderRows = purchaseOrders.map((order) => ({ id: `po-${order.id}`, report_number: order.poNumber, report_type: 'procurement', report_date: order.orderDate, financial_year: reportYear(order.orderDate), department: order.DepartmentRecord?.name || 'Unassigned', category: 'Procurement', status: order.status, purchases: amount(order.totalAmount), capital_additions: amount(order.totalAmount), notes: order.supplierName }));
    const invoiceRows = invoices.map((invoice) => ({ id: `invoice-${invoice.id}`, report_number: invoice.invoiceNumber, report_type: 'invoice', report_date: invoice.invoiceDate, financial_year: reportYear(invoice.invoiceDate), department: invoice.DepartmentRecord?.name || 'Unassigned', category: 'Invoice', status: invoice.status, purchases: amount(invoice.totalAmount), payments: amount(invoice.paidAmount), notes: invoice.supplierName }));
    const paymentRows = payments.map((payment) => ({ id: `payment-${payment.id}`, report_number: payment.paymentNumber, report_type: 'payment', report_date: payment.paymentDate, financial_year: reportYear(payment.paymentDate), department: 'Unassigned', category: 'Payment', status: payment.status, payments: amount(payment.amount), notes: payment.referenceNumber }));
    const transactionRows = transactions.map((transaction) => ({ id: `transaction-${transaction.id}`, report_number: `TX-${transaction.id}`, report_type: 'transaction', report_date: transaction.createdAt, financial_year: reportYear(transaction.createdAt), department: 'Unassigned', category: transaction.type, status: transaction.type, transactions: amount(transaction.quantity), notes: transaction.reason || transaction.notes || '' }));
    const allRows = filters.reportType === 'asset' || filters.reportType === 'valuation' ? assetRows : filters.reportType === 'procurement' ? orderRows : filters.reportType === 'payments' ? paymentRows : filters.reportType === 'transactions' ? transactionRows : [...assetRows, ...orderRows, ...invoiceRows, ...paymentRows, ...transactionRows];
    const search = String(req.query.search || '').trim().toLowerCase();
    const searchedRows = search ? allRows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(search))) : allRows;
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const summary = buildFinanceReportSummary({ assets, purchaseOrders, invoices, payments, transactions });
    if (String(req.query.export).toLowerCase() === 'csv') { const columns = ['report_number', 'report_type', 'report_date', 'financial_year', 'department', 'category', 'status', 'acquisition_cost', 'current_book_value', 'purchases', 'payments', 'transactions']; const csv = [columns.join(','), ...searchedRows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? '')).join(','))].join('\n'); res.type('text/csv').set('Content-Disposition', 'attachment; filename="financial-reports.csv"').send(csv); return; }
    res.json({ success: true, data: searchedRows.slice((page - 1) * limit, page * limit), summary, pagination: { page, limit, total: searchedRows.length, pages: Math.ceil(searchedRows.length / limit) }, departments: [...new Set(allRows.map((row) => row.department).filter(Boolean))], categories: [...new Set(allRows.map((row) => row.category).filter(Boolean))], financialYears: [...new Set(allRows.map((row) => row.financial_year).filter(Boolean))] });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const generateFinanceReport = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    buildFinanceReportFilters(req.body || {});
    return res.status(200).json({ success: true, message: 'Financial report generated from current database transactions.', generatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
};

const listBudgetReports = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const where = {};
    if (req.query.fiscalYearId) where.fiscalYearId = Number(req.query.fiscalYearId);
    if (req.query.collegeId) where.collegeId = Number(req.query.collegeId);
    if (req.query.departmentId) where.departmentId = Number(req.query.departmentId);
    if (req.query.fundSourceId) where.fundSourceId = Number(req.query.fundSourceId);
    if (req.query.status) where.status = req.query.status;
    if (req.query.budgetCode) where.budgetCode = { [Op.like]: `%${String(req.query.budgetCode).trim()}%` };
    if (search) where[Op.or] = [{ budgetCode: { [Op.like]: `%${search}%` } }, { budgetName: { [Op.like]: `%${search}%` } }];
    if (req.query.startDate || req.query.endDate) {
      where[Op.and] = [];
      if (req.query.startDate) where[Op.and].push({ [Op.or]: [{ endDate: { [Op.gte]: req.query.startDate } }, { endDate: null }] });
      if (req.query.endDate) where[Op.and].push({ startDate: { [Op.lte]: req.query.endDate } });
    }
    const include = [
      { model: FiscalYear, as: 'FiscalYear', attributes: ['id', 'code', 'name', 'startDate', 'endDate', 'status'] },
      { model: FundSource, as: 'FundSource', attributes: ['id', 'code', 'name', 'status'] },
      { model: College, as: 'CollegeRecord', attributes: ['id', 'name'], required: false },
      { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false },
    ];
    const result = await Budget.findAndCountAll({ where, include, limit, offset: (page - 1) * limit, distinct: true, order: [['budgetCode', 'ASC']] });
    const normalize = (budget) => {
      const value = budget.toJSON();
      return summarizeBudget(budget).then((summary) => ({
        ...summary,
        budgetAmount: summary.allocation,
        actualAmount: summary.spent,
        remainingAmount: summary.available,
        budgetCode: value.budgetCode,
        budgetName: value.budgetName,
        fiscalYear: value.FiscalYear || null,
        financialYear: value.FiscalYear?.code || value.FiscalYear?.name || '',
        fundSource: value.FundSource || null,
        fundingSource: value.FundSource?.name || value.FundSource?.code || '',
        college: value.CollegeRecord || null,
        department: value.DepartmentRecord || null,
        status: value.status,
      }));
    };
    const rows = await Promise.all(result.rows.map(normalize));
    const allBudgets = await Budget.findAll({ where, include, order: [['budgetCode', 'ASC']] });
    const allSummaries = await Promise.all(allBudgets.map(normalize));
    const summaryCents = allSummaries.reduce((total, row) => ({
      totalBudgets: total.totalBudgets + 1,
      totalAllocated: total.totalAllocated + cents(row.allocation),
      totalCommitted: total.totalCommitted + cents(row.committed),
      totalSpent: total.totalSpent + cents(row.spent),
      totalAvailable: total.totalAvailable + cents(row.available),
      overBudget: total.overBudget + (row.overBudget ? 1 : 0),
    }), { totalBudgets: 0, totalAllocated: 0n, totalCommitted: 0n, totalSpent: 0n, totalAvailable: 0n, overBudget: 0 });
    const summary = {
      ...summaryCents,
      totalAllocated: Number(summaryCents.totalAllocated) / 100,
      totalCommitted: Number(summaryCents.totalCommitted) / 100,
      totalSpent: Number(summaryCents.totalSpent) / 100,
      totalAvailable: Number(summaryCents.totalAvailable) / 100,
    };
    if (String(req.query.export || '').toLowerCase() === 'csv') {
      const columns = ['budgetCode', 'budgetName', 'financialYear', 'fundingSource', 'college', 'department', 'allocation', 'committed', 'spent', 'available', 'utilization', 'status'];
      const csvValue = (value) => JSON.stringify(value ?? '');
      const csv = [
        columns.join(','),
        ...allSummaries.map((row) => [
          row.budgetCode,
          row.budgetName,
          row.financialYear,
          row.fundingSource,
          row.college?.name,
          row.department?.name,
          row.allocation,
          row.committed,
          row.spent,
          row.available,
          row.utilization,
          row.status,
        ].map(csvValue).join(',')),
      ].join('\n');
      return res.type('text/csv').set('Content-Disposition', 'attachment; filename="budget-reports.csv"').send(csv);
    }
    summary.utilization = summary.totalAllocated > 0
      ? Number(((Number(cents(summary.totalCommitted)) + Number(cents(summary.totalSpent))) / Number(cents(summary.totalAllocated)) * 100).toFixed(2))
      : null;
    const [fiscalYears, fundSources, colleges, departments] = await Promise.all([
      FiscalYear.findAll({ order: [['startDate', 'DESC']] }),
      FundSource.findAll({ order: [['name', 'ASC']] }),
      College.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Department.findAll({ attributes: ['id', 'name', 'collegeId'], order: [['name', 'ASC']] }),
    ]);
    res.json({ success: true, data: rows, summary, filters: { fiscalYears, fundSources, colleges, departments }, pagination: { page, limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) {
    next(error);
  }
};

const listDepreciation = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const query = { ...req.query, search: req.query.search || '' };
    const { rows, records } = await depreciationService.list({ query });
    const summary = {
      totalAssets: rows.length,
      totalAcquisitionCost: rows.reduce((sum, row) => sum + Number(row.acquisition_value || row.purchase_cost || row.purchasePrice || 0), 0),
      totalCurrentBookValue: rows.reduce((sum, row) => sum + Number(row.current_book_value || row.currentValue || row.book_value || 0), 0),
      totalAccumulatedDepreciation: rows.reduce((sum, row) => sum + Number(row.accumulated_depreciation || row.accumulatedDepreciation || 0), 0),
      fullyDepreciated: rows.filter((row) => Number(row.current_book_value || row.currentValue || 0) <= Number(row.residual_value || row.residualValue || 0)).length,
      pending: rows.filter((row) => String(row.status || '').toUpperCase() === 'NOT_CONFIGURED' || !row.latestRecord).length,
    };
    res.json({ success: true, data: rows, rows, records, summary, pagination: { page: 1, limit: rows.length || 20, total: rows.length, pages: 1 } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const getDepreciationAsset = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const asset = await Asset.findByPk(req.params.id, {
      include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const financialRecord = await FinancialRecord.findOne({ where: { assetId: asset.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    const latestDepreciation = await DepreciationRecord.findOne({ where: { assetId: asset.id }, order: [['period', 'DESC'], ['id', 'DESC']] });
    const history = await DepreciationRecord.findAll({ where: { assetId: asset.id }, include: [{ model: User, attributes: ['username', 'fullName'] }], order: [['period', 'DESC'], ['id', 'DESC']] });
    const calculated = financialRecord ? depreciationService.calculateForPeriod({ asset, record: financialRecord, previous: latestDepreciation, period: latestDepreciation?.period || new Date().toISOString().slice(0, 7) }) : null;
    res.json({ success: true, data: { asset, financialRecord, latestDepreciation, history, calculated } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const calculateDepreciation = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const assetId = Number(req.body.assetId || req.body.asset_id || req.params.id || req.query.assetId || req.query.asset_id);
    const period = req.body.period || new Date().toISOString().slice(0, 7);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return res.status(400).json({ success: false, message: 'Asset id is required for depreciation calculation' });
    }
    const asset = await Asset.findByPk(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const financialRecord = await FinancialRecord.findOne({ where: { assetId: asset.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    const previous = await DepreciationRecord.findOne({ where: { assetId: asset.id, period: { [Op.lt]: period }, status: 'POSTED' }, order: [['period', 'DESC'], ['id', 'DESC']] });
    const result = depreciationService.calculateForPeriod({ asset, record: financialRecord, previous, period });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const postDepreciation = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const assetId = Number(req.body.assetId || req.body.asset_id || req.params.id);
    const period = req.body.period || new Date().toISOString().slice(0, 7);
    const result = await depreciationService.post({ assetId, period, userId: req.user.id });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const listDepreciationReports = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const where = { status: 'POSTED' };
    const assetWhere = {};
    const search = String(req.query.search || '').trim();
    if (search) assetWhere[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { assetCode: { [Op.like]: `%${search}%` } }];
    if (req.query.category) assetWhere.category = req.query.category;
    if (req.query.department) assetWhere.departmentId = Number(req.query.department);
    if (req.query.status) assetWhere.status = req.query.status;
    if (req.query.period) where.period = req.query.period;
    if (req.query.financialYear) {
      if (!/^\d{4}$/.test(String(req.query.financialYear))) { const error = new Error('financialYear must be a valid four-digit year'); error.status = 400; throw error; }
      where.period = { [Op.like]: `${req.query.financialYear}-%` };
    }
    if (req.query.dateFrom || req.query.dateTo) {
      const from = parseDateFilter(req.query.dateFrom, 'dateFrom');
      const to = parseDateFilter(req.query.dateTo, 'dateTo');
      if (from && to && from > to) { const error = new Error('dateFrom must not be after dateTo'); error.status = 400; throw error; }
      where.createdAt = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: new Date(`${req.query.dateTo}T23:59:59.999Z`) } : {}) };
    }
    if (req.query.depreciationMethod) where.method = req.query.depreciationMethod;

    const include = [{ model: Asset, required: true, where: assetWhere, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }] }];
    const result = await DepreciationRecord.findAndCountAll({ where, include, order: [['period', 'DESC'], ['id', 'DESC']] });
    const allRows = result.rows.map((record) => {
      const asset = record.Asset;
      const data = asset.toJSON();
      const department = asset.DepartmentRecord?.name || data.department || 'Unassigned';
      const acquisitionCost = Number(data.purchasePrice || 0);
      return {
        id: record.id, report_number: `DEP-${record.id}`, reportNumber: `DEP-${record.id}`,
        asset_id: asset.id, assetId: asset.id, asset_code: data.assetCode, assetCode: data.assetCode,
        asset_name: data.name, assetName: data.name, category_name: data.category || 'Uncategorized', category: data.category || 'Uncategorized',
        department_name: department, departmentName: department, department, period: record.period, financialYear: record.period.slice(0, 4),
        acquisition_cost: acquisitionCost, acquisitionCost, current_depreciation: Number(record.depreciationAmount), currentDepreciation: Number(record.depreciationAmount),
        accumulated_depreciation: Number(record.accumulatedDepreciation), accumulatedDepreciation: Number(record.accumulatedDepreciation),
        current_book_value: Number(record.closingBookValue), currentBookValue: Number(record.closingBookValue), bookValue: Number(record.closingBookValue),
        residual_value: Number(record.residualValue), residualValue: Number(record.residualValue), useful_life: record.usefulLife, usefulLife: record.usefulLife,
        depreciation_method: record.method, depreciationMethod: record.method, depreciation_start_date: record.depreciationStartDate,
        status: data.status || 'Active', notes: data.notes || '',
      };
    });
    const rows = allRows.slice((page - 1) * limit, page * limit);

    const summary = {
      totalAssets: new Set(allRows.map((row) => row.assetId)).size,
      acquisitionCost: allRows.reduce((sum, row) => sum + row.acquisitionCost, 0),
      currentDepreciation: allRows.reduce((sum, row) => sum + row.currentDepreciation, 0),
      currentBookValue: allRows.reduce((sum, row) => sum + row.currentBookValue, 0),
      accumulatedDepreciation: allRows.reduce((sum, row) => sum + row.accumulatedDepreciation, 0),
    };

    res.json({ success: true, data: rows, summary, departments: [...new Set(allRows.map((row) => row.department))], categories: [...new Set(allRows.map((row) => row.category))], financialYears: [...new Set(allRows.map((row) => row.financialYear))], pagination: { page, limit, total: allRows.length, pages: Math.max(1, Math.ceil(allRows.length / limit)) } });
  } catch (error) {
    next(error);
  }
};

const listLegacyAssetValueReports = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const assets = await Asset.findAll({
      include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }],
      order: [['purchaseDate', 'DESC'], ['id', 'DESC']],
    });

    const rows = assets.map((asset) => {
      const department = asset.DepartmentRecord?.name || asset.department || 'Unassigned';
      const category = asset.category || 'Uncategorized';
      const purchaseCost = Number(asset.purchasePrice || 0);
      const currentValue = Number(asset.currentValue || 0);
      const depreciation = Math.max(0, purchaseCost - currentValue);
      const year = asset.purchaseDate ? new Date(asset.purchaseDate).getFullYear() : new Date().getFullYear();
      return {
        id: asset.id,
        report_number: `AV-${asset.id}`,
        reportNumber: `AV-${asset.id}`,
        asset_id: asset.id,
        assetId: asset.id,
        asset_tag: asset.assetCode || `AST-${asset.id}`,
        assetTag: asset.assetCode || `AST-${asset.id}`,
        asset_code: asset.assetCode || `AST-${asset.id}`,
        assetCode: asset.assetCode || `AST-${asset.id}`,
        asset_name: asset.name,
        assetName: asset.name,
        category_name: category,
        categoryName: category,
        category,
        department_name: department,
        departmentName: department,
        department,
        financial_year: String(year),
        financialYear: String(year),
        valuation_date: asset.purchaseDate || asset.createdAt,
        valuationDate: asset.purchaseDate || asset.createdAt,
        acquisition_cost: purchaseCost,
        acquisitionCost: purchaseCost,
        accumulated_depreciation: depreciation,
        accumulatedDepreciation: depreciation,
        book_value: currentValue,
        bookValue: currentValue,
        fair_value: currentValue,
        fairValue: currentValue,
        replacement_value: Math.max(currentValue, purchaseCost),
        replacementValue: Math.max(currentValue, purchaseCost),
        residual_value: Math.max(0, currentValue * 0.1),
        residualValue: Math.max(0, currentValue * 0.1),
        status: asset.status || 'Active',
        notes: asset.notes || '',
      };
    });

    const summary = {
      assets: rows.length,
      acquisitionCost: rows.reduce((sum, row) => sum + Number(row.acquisitionCost || row.acquisition_cost || 0), 0),
      accumulatedDepreciation: rows.reduce((sum, row) => sum + Number(row.accumulatedDepreciation || row.accumulated_depreciation || 0), 0),
      bookValue: rows.reduce((sum, row) => sum + Number(row.bookValue || row.book_value || 0), 0),
      fairValue: rows.reduce((sum, row) => sum + Number(row.fairValue || row.fair_value || 0), 0),
      replacementValue: rows.reduce((sum, row) => sum + Number(row.replacementValue || row.replacement_value || 0), 0),
    };

    res.json({ success: true, data: rows, summary, departments: rows.map((row) => row.department).filter(Boolean), categories: rows.map((row) => row.category).filter(Boolean), financialYears: [...new Set(rows.map((row) => row.financialYear))].filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

const listAssetValueReports = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const dateFrom = parseDateFilter(req.query.dateFrom || req.query.date_from, 'dateFrom');
    const dateTo = parseDateFilter(req.query.dateTo || req.query.date_to, 'dateTo');
    if (dateFrom && dateTo && dateFrom > dateTo) { const error = new Error('dateFrom cannot be later than dateTo'); error.status = 400; throw error; }
    const where = {};
    if (req.query.department) where.departmentId = Number(req.query.department);
    if (req.query.college) where.collegeId = Number(req.query.college);
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.location) where.location = String(req.query.location);
    if (dateFrom || dateTo) where.purchaseDate = dateWhere('purchaseDate', { dateFrom, dateTo }).purchaseDate;
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = ['assetCode', 'name', 'category', 'department', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    const [assets, capitalizations, depreciationRecords, financialRecords] = await Promise.all([
      Asset.findAll({ where, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }, { model: College, attributes: ['collegeName'], required: false }], order: [['purchaseDate', 'DESC'], ['id', 'DESC']] }),
      CapitalizationRecord.findAll({ where: { status: 'CAPITALIZED' }, order: [['capitalizationDate', 'DESC'], ['id', 'DESC']] }),
      DepreciationRecord.findAll({ order: [['period', 'DESC'], ['id', 'DESC']] }),
      FinancialRecord.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']] }),
    ]);
    const latest = (records) => { const result = new Map(); records.forEach((record) => { if (!result.has(record.assetId)) result.set(record.assetId, record); }); return result; };
    const capitalizationByAsset = latest(capitalizations);
    const depreciationByAsset = latest(depreciationRecords);
    const financialByAsset = latest(financialRecords);
    const cents = (value) => { const text = String(value ?? '').trim(); if (!/^\d+(\.\d{1,2})?$/.test(text)) return null; const [whole, fraction = ''] = text.split('.'); return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2)); };
    const money = (value) => value === null ? null : Number(value) / 100;
    const rows = assets.map((asset) => {
      const capitalization = capitalizationByAsset.get(asset.id);
      const depreciation = depreciationByAsset.get(asset.id);
      const financial = financialByAsset.get(asset.id);
      const acquisition = cents(capitalization?.capitalizedAmount ?? financial?.purchaseCost ?? asset.purchasePrice);
      const accumulated = cents(depreciation?.accumulatedDepreciation ?? financial?.depreciationAmount);
      const book = cents(depreciation?.closingBookValue ?? financial?.currentValue ?? asset.currentValue);
      const residual = cents(depreciation?.residualValue ?? financial?.residualValue);
      const college = asset.College?.collegeName || null;
      const department = asset.DepartmentRecord?.name || asset.department || null;
      return {
        id: asset.id, asset_id: asset.id, assetId: asset.id, asset_code: asset.assetCode || null, assetCode: asset.assetCode || null,
        asset_name: asset.name, assetName: asset.name, category: asset.category || null, category_name: asset.category || null,
        college, college_name: college, department, department_name: department, location: asset.location || null,
        acquisition_date: asset.purchaseDate || null, acquisitionDate: asset.purchaseDate || null,
        capitalization_date: capitalization?.capitalizationDate || null,
        financial_year: asset.purchaseDate ? String(new Date(asset.purchaseDate).getFullYear()) : null,
        acquisition_cost: money(acquisition), acquisitionCost: money(acquisition), capitalized_value: money(acquisition), capitalizedValue: money(acquisition),
        accumulated_depreciation: money(accumulated), accumulatedDepreciation: money(accumulated), book_value: money(book), bookValue: money(book), current_book_value: money(book),
        residual_value: money(residual), residualValue: money(residual), depreciation_method: depreciation?.method || financial?.depreciationMethod || null,
        useful_life: depreciation?.usefulLife || financial?.usefulLife || null, depreciation_start_date: depreciation?.depreciationStartDate || null,
        status: asset.status || null, valuation_status: financial || depreciation ? 'Current' : 'Not Valued',
      };
    });
    const total = (field) => rows.reduce((sum, row) => sum + (cents(row[field]) || 0n), 0n);
    const summary = { assets: rows.length, acquisitionCost: money(total('acquisition_cost')), accumulatedDepreciation: money(total('accumulated_depreciation')), bookValue: money(total('book_value')), residualValue: money(total('residual_value')) };
    const groupBy = (field) => { const groups = new Map(); rows.forEach((row) => { const name = row[field] || 'Not Available'; const group = groups.get(name) || { name, assetCount: 0, acquisitionValue: 0n, accumulatedDepreciation: 0n, bookValue: 0n }; group.assetCount += 1; group.acquisitionValue += cents(row.acquisition_cost) || 0n; group.accumulatedDepreciation += cents(row.accumulated_depreciation) || 0n; group.bookValue += cents(row.book_value) || 0n; groups.set(name, group); }); return [...groups.values()].map((group) => ({ ...group, acquisitionValue: money(group.acquisitionValue), accumulatedDepreciation: money(group.accumulatedDepreciation), bookValue: money(group.bookValue) })); };
    if (String(req.query.export || '').toLowerCase() === 'csv') { const columns = ['asset_code', 'asset_name', 'category', 'college', 'department', 'location', 'acquisition_cost', 'accumulated_depreciation', 'book_value', 'residual_value', 'status']; const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? '')).join(','))].join('\n'); return res.type('text/csv').set('Content-Disposition', 'attachment; filename="asset-value-reports.csv"').send(csv); }
    return res.json({ success: true, data: rows.slice((page - 1) * limit, page * limit), summary, aggregations: { category: groupBy('category'), college: groupBy('college'), department: groupBy('department'), location: groupBy('location') }, filters: { departments: [...new Set(rows.map((row) => row.department).filter(Boolean))], categories: [...new Set(rows.map((row) => row.category).filter(Boolean))], colleges: [...new Set(rows.map((row) => row.college).filter(Boolean))], locations: [...new Set(rows.map((row) => row.location).filter(Boolean))], statuses: [...new Set(rows.map((row) => row.status).filter(Boolean))], financialYears: [...new Set(rows.map((row) => row.financial_year).filter(Boolean))] }, pagination: { page, limit, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / limit)) } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = { listValuation, getAssetValuationDetail, getAssetDepreciationDetail, updateValuation, valuationHistory, listAudit, listSuppliers, getFinanceDashboard, getFinanceDashboardFilters, getFinanceReportFilters, listFinanceReports, generateFinanceReport, listBudgetReports, listDepreciation, getDepreciationAsset, calculateDepreciation, postDepreciation, listDepreciationReports, listAssetValueReports };
