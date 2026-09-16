const { sequelize, Asset, FinancialRecord, AuditLog, User, Department } = require('../models');
const { Op } = require('sequelize');

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
  const residualValue = Number(record?.residualValue || 0);
  const usefulLife = Number(record?.usefulLife || 5);
  const accumulatedDepreciation = Number(record?.depreciationAmount || 0);
  return { ...data, asset_id: data.id, asset_tag: data.assetCode, purchase_cost: purchaseCost, current_value: currentValue, residual_value: residualValue, useful_life: usefulLife, depreciation_method: record?.depreciationMethod || 'straight-line', accumulated_depreciation: accumulatedDepreciation, financial: { totalCost: purchaseCost + Number(record?.additionalCosts || 0), bookValue: currentValue, residualValue, usefulLife, accumulatedDepreciation, annualDepreciation: Math.max(0, (purchaseCost - residualValue) / usefulLife) } };
};

const getFinanceDashboardFilters = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const [departments, categories, years] = await Promise.all([
      Department.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ attributes: ['category'], group: ['category'], order: [['category', 'ASC']], raw: true }),
      Asset.findAll({ attributes: ['purchaseDate'], order: [['purchaseDate', 'ASC']], raw: true }),
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

const listValuation = async (req, res, next) => { try { if (!ensureFinance(req, res)) return; const assets = await Asset.findAll({ order: [['id', 'ASC']] }); const records = await FinancialRecord.findAll({ order: [['createdAt', 'DESC']] }); const latestByAsset = new Map(); records.forEach(record => { if (!latestByAsset.has(record.assetId)) latestByAsset.set(record.assetId, record); }); assets.forEach(asset => { asset.latestFinancialRecord = latestByAsset.get(asset.id); }); res.json({ success: true, assets: assets.map(normalizeAsset) }); } catch (e) { next(e); } };
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

module.exports = { listValuation, updateValuation, valuationHistory, listAudit, getFinanceDashboard, getFinanceDashboardFilters };
