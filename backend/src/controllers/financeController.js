const { sequelize, Asset, FinancialRecord, AuditLog, User } = require('../models');

const financeRoles = ['admin', 'finance'];
const ensureFinance = (req, res) => {
  if (!financeRoles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Finance authorization required' }); return false; }
  return true;
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

module.exports = { listValuation, updateValuation, valuationHistory, listAudit };
