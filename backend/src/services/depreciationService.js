const { Op } = require('sequelize');
const { sequelize, Asset, FinancialRecord, DepreciationRecord, AuditLog, User, Department } = require('../models');

const toCents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => Number((value / 100).toFixed(2));
const normalizeMethod = (value) => String(value || '').trim().toLowerCase().replace(/[_ ]+/g, '-');
const validPeriod = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));

const getConfiguration = async (assetId, transaction) => {
  const record = await FinancialRecord.findOne({ where: { assetId }, order: [['createdAt', 'DESC'], ['id', 'DESC']], transaction });
  return record;
};

const validateConfiguration = (asset, record) => {
  const cost = toCents(record?.purchaseCost ?? asset.purchasePrice);
  const residual = toCents(record?.residualValue);
  const usefulLife = Number(record?.usefulLife);
  const method = normalizeMethod(record?.depreciationMethod);
  const errors = [];
  if (cost <= 0) errors.push('Acquisition value is not configured.');
  if (!Number.isInteger(usefulLife) || usefulLife <= 0) errors.push('Useful life is not configured.');
  if (residual < 0 || residual > cost) errors.push('Residual value must be between zero and acquisition value.');
  if (!['straight-line'].includes(method)) errors.push('Only the configured Straight Line method is currently supported.');
  return { errors, cost, residual, usefulLife, method };
};

const calculateForPeriod = ({ asset, record, previous, period }) => {
  const configuration = validateConfiguration(asset, record);
  if (configuration.errors.length) {
    const error = new Error(configuration.errors.join(' '));
    error.status = 422;
    throw error;
  }
  const { cost, residual, usefulLife, method } = configuration;
  const opening = previous ? toCents(previous.closingBookValue) : toCents(asset.currentValue || cost / 100);
  const accumulated = previous ? toCents(previous.accumulatedDepreciation) : Math.max(0, cost - opening);
  const basis = Math.max(0, cost - residual);
  const remainingBasis = Math.max(0, basis - accumulated);
  const amount = Math.min(remainingBasis, Math.round(basis / usefulLife / 12));
  const closing = Math.max(residual, opening - amount);
  return {
    assetId: asset.id,
    period,
    method,
    openingBookValue: fromCents(opening),
    depreciationAmount: fromCents(amount),
    accumulatedDepreciation: fromCents(accumulated + amount),
    closingBookValue: fromCents(closing),
    residualValue: fromCents(residual),
    usefulLife,
    depreciationStartDate: record?.depreciationStartDate || null,
    status: 'CALCULATED',
    fullyDepreciated: accumulated + amount >= basis,
  };
};

const findPrevious = async (assetId, period, transaction) => DepreciationRecord.findOne({
  where: { assetId, period: { [Op.lt]: period }, status: 'POSTED' },
  order: [['period', 'DESC'], ['id', 'DESC']],
  transaction,
});

const list = async ({ query = {}, transaction } = {}) => {
  const where = {};
  const assetWhere = {};
  const search = String(query.search || '').trim();
  if (search) assetWhere[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { assetCode: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }];
  if (query.category) assetWhere.category = query.category;
  if (query.department) assetWhere.departmentId = Number(query.department);
  if (query.period) where.period = query.period;
  const [assets, records] = await Promise.all([
    Asset.findAll({ where: assetWhere, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['name'], required: false }], order: [['id', 'DESC']], transaction }),
    DepreciationRecord.findAll({ where, include: [{ model: User, attributes: ['username', 'fullName'] }], order: [['period', 'DESC'], ['id', 'DESC']], transaction }),
  ]);
  const latest = new Map();
  records.forEach((item) => { if (!latest.has(item.assetId)) latest.set(item.assetId, item); });
  const rows = await Promise.all(assets.map(async (asset) => {
    const config = await getConfiguration(asset.id, transaction);
    const current = latest.get(asset.id);
    const configured = validateConfiguration(asset, config);
    return { ...asset.toJSON(), asset_id: asset.id, asset_tag: asset.assetCode, department_name: asset.DepartmentRecord?.name || asset.department || '', acquisition_value: fromCents(configured.cost), residual_value: config ? fromCents(configured.residual) : null, useful_life: config?.usefulLife || null, depreciation_method: config?.depreciationMethod || null, depreciation_start_date: config?.depreciationStartDate || null, accumulated_depreciation: current ? Number(current.accumulatedDepreciation) : null, current_book_value: current ? Number(current.closingBookValue) : Number(asset.currentValue || 0), latestRecord: current ? current.toJSON() : null, status: current?.status || (configured.errors.length ? 'NOT_CONFIGURED' : 'CONFIGURED'), configurationErrors: configured.errors };
  }));
  return { rows, records };
};

const post = async ({ assetId, period, userId }) => {
  if (!validPeriod(period)) { const error = new Error('Period must use YYYY-MM format.'); error.status = 400; throw error; }
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { const error = new Error('Asset not found.'); error.status = 404; throw error; }
    const existing = await DepreciationRecord.findOne({ where: { assetId, period }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing) { const error = new Error('Depreciation is already posted for this asset and period.'); error.status = 409; throw error; }
    const config = await getConfiguration(assetId, transaction);
    const previous = await findPrevious(assetId, period, transaction);
    const calculated = calculateForPeriod({ asset, record: config, previous, period });
    const created = await DepreciationRecord.create({ ...calculated, recordedBy: userId, status: 'POSTED' }, { transaction });
    await asset.update({ currentValue: calculated.closingBookValue }, { transaction });
    await AuditLog.create({ userId, action: 'DEPRECIATION_POSTED', entity: `asset:${assetId}`, details: JSON.stringify({ period, recordId: created.id, amount: calculated.depreciationAmount }) }, { transaction });
    await transaction.commit();
    return created;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { list, post, calculateForPeriod, validateConfiguration, validPeriod };
