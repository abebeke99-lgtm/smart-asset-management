const { Op } = require('sequelize');
const {
  sequelize,
  Asset,
  Department,
  DisposalRequest,
  DisposalFinancialRecord,
  FinancialRecord,
  DepreciationRecord,
  AuditLog,
} = require('../models');

const money = (value) => Number(Number(value || 0).toFixed(2));
const validNonNegative = (value) => Number.isFinite(value) && value >= 0;
const fail = (message, status = 422) => Object.assign(new Error(message), { status });

const include = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'purchasePrice', 'currentValue', 'department', 'departmentId'] },
  { model: DisposalRequest, attributes: ['id', 'disposalNumber', 'status', 'completedDate'] },
  { model: Department, attributes: ['id', 'name'], required: false },
];

const listDisposalFinancialRecords = async (req, res, next) => {
  try {
    const rows = await DisposalFinancialRecord.findAll({ include, order: [['disposalDate', 'DESC'], ['id', 'DESC']] });
    res.json({ success: true, records: rows, data: rows });
  } catch (error) { next(error); }
};

const resolveBookValue = async (asset, disposal, transaction) => {
  const depreciation = await DepreciationRecord.findOne({ where: { assetId: asset.id }, order: [['period', 'DESC'], ['id', 'DESC']], transaction });
  const financial = await FinancialRecord.findOne({ where: { assetId: asset.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']], transaction });
  const originalCost = money(financial?.purchaseCost ?? disposal.purchaseValue ?? asset.purchasePrice);
  const accumulatedDepreciation = money(depreciation?.accumulatedDepreciation ?? financial?.depreciationAmount ?? disposal.accumulatedDepreciation);
  const netBookValue = money(depreciation?.closingBookValue ?? financial?.currentValue ?? disposal.netBookValue ?? asset.currentValue);
  if (originalCost < 0 || accumulatedDepreciation < 0 || netBookValue < 0) throw fail('Authoritative asset valuation contains invalid negative values.');
  if (accumulatedDepreciation > originalCost) throw fail('Accumulated depreciation cannot exceed original cost.');
  if (netBookValue > originalCost) throw fail('Book value cannot exceed original cost.');
  return { originalCost, accumulatedDepreciation, netBookValue };
};

const completedDisposalWhere = { status: { [Op.in]: ['Disposed', 'Completed'] } };

const listDisposalCandidates = async (req, res, next) => {
  try {
    const disposals = await DisposalRequest.findAll({
      where: completedDisposalWhere,
      include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'purchasePrice', 'currentValue', 'department', 'departmentId'] }],
      order: [['completedDate', 'DESC'], ['id', 'DESC']],
    });
    const existing = await DisposalFinancialRecord.findAll({ attributes: ['disposalRequestId'] });
    const recorded = new Set(existing.map((row) => row.disposalRequestId));
    const candidates = [];
    for (const disposal of disposals) {
      if (recorded.has(disposal.id) || !disposal.Asset) continue;
      try {
        candidates.push({ ...disposal.toJSON(), financialBasis: await resolveBookValue(disposal.Asset, disposal) });
      } catch (error) {
        candidates.push({ ...disposal.toJSON(), financialBasis: null, financialBasisError: error.message });
      }
    }
    return res.json({ success: true, candidates, data: candidates });
  } catch (error) { next(error); }
};

const createDisposalFinancialRecord = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const assetId = Number(req.body.assetId);
    if (!Number.isInteger(assetId)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid asset is required' }); }
    const disposal = await DisposalRequest.findOne({ where: { assetId, ...completedDisposalWhere }, order: [['completedDate', 'DESC'], ['id', 'DESC']], transaction, lock: transaction.LOCK.UPDATE });
    if (!disposal) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The asset must complete the disposal workflow before financial review' }); }
    const existing = await DisposalFinancialRecord.findOne({ where: { disposalRequestId: disposal.id }, transaction });
    if (existing) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This disposal already has a financial record' }); }
    const asset = await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const values = await resolveBookValue(asset, disposal, transaction);
    const proceeds = money(req.body.disposalProceeds);
    const disposalCost = money(req.body.disposalCost);
    if (!validNonNegative(proceeds) || !validNonNegative(disposalCost)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Proceeds and disposal cost must be non-negative numbers' }); }
    const gainLoss = money(proceeds - values.netBookValue - disposalCost);
    const record = await DisposalFinancialRecord.create({
      disposalRequestId: disposal.id,
      assetId,
      departmentId: disposal.departmentId,
      recordedBy: req.user.id,
      disposalDate: disposal.completedDate || req.body.disposalDate,
      disposalMethod: req.body.disposalMethod || 'sale',
      ...values,
      disposalProceeds: proceeds,
      disposalCost,
      gainLoss,
      referenceNumber: req.body.referenceNumber || null,
      buyer: req.body.buyer || null,
      approvalNumber: req.body.approvalNumber || null,
      status: 'pending',
      accountingStatus: 'not_integrated',
      notes: req.body.notes || null,
    }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'DISPOSAL_FINANCIAL_RECORD_CREATED', entity: `disposal:${disposal.id}`, details: JSON.stringify({ recordId: record.id, disposalNumber: disposal.disposalNumber, gainLoss, accountingStatus: 'not_integrated', financialBasis: values }) }, { transaction });
    await transaction.commit();
    const saved = await DisposalFinancialRecord.findByPk(record.id, { include });
    return res.status(201).json({ success: true, record: saved, data: saved });
  } catch (error) { await transaction.rollback(); next(error); }
};

const updateDisposalFinancialRecord = async (req, res, next) => {
  try {
    const record = await DisposalFinancialRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Disposal financial record not found' });
    if (record.accountingStatus !== 'not_integrated') return res.status(409).json({ success: false, message: 'Accounting-integrated disposal records cannot be edited' });
    const proceeds = req.body.disposalProceeds === undefined ? money(record.disposalProceeds) : money(req.body.disposalProceeds);
    const disposalCost = req.body.disposalCost === undefined ? money(record.disposalCost) : money(req.body.disposalCost);
    if (!validNonNegative(proceeds) || !validNonNegative(disposalCost)) return res.status(400).json({ success: false, message: 'Proceeds and disposal cost must be non-negative numbers' });
    await record.update({ disposalMethod: req.body.disposalMethod || record.disposalMethod, disposalProceeds: proceeds, disposalCost, gainLoss: money(proceeds - money(record.netBookValue) - disposalCost), referenceNumber: req.body.referenceNumber ?? record.referenceNumber, buyer: req.body.buyer ?? record.buyer, approvalNumber: req.body.approvalNumber ?? record.approvalNumber, status: req.body.status || record.status, notes: req.body.notes ?? record.notes });
    await AuditLog.create({ userId: req.user.id, action: 'DISPOSAL_FINANCIAL_RECORD_UPDATED', entity: `disposal:${record.disposalRequestId}`, details: JSON.stringify({ recordId: record.id }) });
    const saved = await DisposalFinancialRecord.findByPk(record.id, { include });
    return res.json({ success: true, record: saved, data: saved });
  } catch (error) { next(error); }
};

module.exports = { listDisposalFinancialRecords, listDisposalCandidates, createDisposalFinancialRecord, updateDisposalFinancialRecord };