const { Op, fn, col } = require('sequelize');
const {
  Asset,
  Approval,
  AuditLog,
  Category,
  Chemical,
  College,
  Config,
  Department,
  Inventory,
  Maintenance,
  ServiceRequest,
  Transfer,
  User,
} = require('../models');

const defaultThresholds = {
  lowStockPercent: 10,
  expirationNoticeDays: 30,
  escalationHours: 72,
};

const openRequestStatuses = ['submitted', 'pending', 'open', 'scheduled', 'assigned', 'in_progress', 'in progress'];
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
const numberValue = (value) => Number(value || 0);

const readThresholds = async () => {
  const record = await Config.findByPk('settings:dashboard');
  if (!record) return { ...defaultThresholds };

  let configured;
  try {
    configured = JSON.parse(record.value || '{}');
  } catch (error) {
    throw new Error('Dashboard threshold settings contain invalid JSON.');
  }

  const thresholds = { ...defaultThresholds };
  for (const key of Object.keys(defaultThresholds)) {
    if (configured[key] !== undefined) {
      const value = Number(configured[key]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Dashboard threshold "${key}" must be a positive number.`);
      }
      thresholds[key] = value;
    }
  }
  return thresholds;
};

const countGroupedValues = (rows, values) => rows.reduce((total, row) => (
  values.includes(normalize(row.key)) ? total + numberValue(row.count) : total
), 0);

const countWhereAny = (field, values) => ({ [field]: { [Op.in]: values } });

const getDashboardAnalytics = async () => {
  const thresholds = await readThresholds();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const expirationCutoff = new Date(today);
  expirationCutoff.setDate(expirationCutoff.getDate() + thresholds.expirationNoticeDays);
  const escalationCutoff = new Date(now.getTime() - thresholds.escalationHours * 60 * 60 * 1000);

  const [
    totalAssets,
    activeAssets,
    damagedAssets,
    replacedAssets,
    expiredAssets,
    functionalAssets,
    totalUsers,
    totalColleges,
    totalDepartments,
    openServiceRequests,
    pendingApprovalCounts,
    assetsUnderMaintenance,
    maintenanceStatusRows,
    overdueMaintenance,
    escalatedRequests,
    inventoryRows,
    chemicalRows,
    categoryRows,
    assetCategoryRows,
    recentActivity,
  ] = await Promise.all([
    Asset.count(),
    Asset.count({ where: { status: { [Op.in]: ['active', 'available', 'assigned', 'in_use', 'functional'] } } }),
    Asset.count({ where: { [Op.or]: [countWhereAny('condition', ['damaged']), countWhereAny('status', ['damaged'])] } }),
    Asset.count({ where: { [Op.or]: [countWhereAny('condition', ['replaced']), countWhereAny('status', ['replaced'])] } }),
    Asset.count({ where: { [Op.or]: [countWhereAny('condition', ['expired']), countWhereAny('status', ['expired']), { expiryDate: { [Op.lt]: today } }] } }),
    Asset.count({
      where: {
        condition: { [Op.in]: ['functional', 'Functional', 'good', 'Good', 'fair', 'Fair', 'poor', 'Poor'] },
        status: { [Op.notIn]: ['damaged', 'replaced', 'expired', 'missing', 'lost', 'retired', 'disposed'] },
        [Op.or]: [{ expiryDate: { [Op.is]: null } }, { expiryDate: { [Op.gte]: today } }],
      },
    }),
    User.count(),
    College.count(),
    Department.count(),
    ServiceRequest.count({ where: { status: { [Op.in]: openRequestStatuses } } }),
    Promise.all([
      Approval.count({ where: { status: 'pending' } }),
      Transfer.count({ where: { status: { [Op.in]: ['Requested', 'Pending'] } } }),
    ]),
    Asset.count({ where: { status: { [Op.in]: ['maintenance', 'under maintenance', 'in_maintenance', 'under-maintenance'] } } }),
    Maintenance.findAll({
      attributes: [[fn('LOWER', col('status')), 'key'], [fn('COUNT', col('id')), 'count']],
      group: [fn('LOWER', col('status'))],
      raw: true,
    }),
    ServiceRequest.count({
      where: {
        requestType: 'maintenance',
        status: { [Op.in]: openRequestStatuses },
        [Op.or]: [{ dueDate: { [Op.lt]: now, [Op.ne]: null } }, { createdAt: { [Op.lt]: escalationCutoff } }],
      },
    }),
    ServiceRequest.count({ where: { requestType: 'maintenance', escalated: true } }),
    Inventory.findAll({ attributes: ['quantity', 'availableQuantity'], raw: true }),
    Chemical.findAll({
      attributes: ['quantity', 'capacity', 'expirationDate', 'quarantine', 'status'],
      raw: true,
    }),
    Category.findAll({ attributes: ['name', 'status'], order: [['name', 'ASC']], raw: true }),
    Asset.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      group: ['category'],
      raw: true,
    }),
    AuditLog.findAll({
      attributes: ['id', 'action', 'entity', 'details', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 12,
      raw: true,
    }),
  ]);

  const lowStockInventory = inventoryRows.filter((item) => {
    const quantity = numberValue(item.quantity);
    const available = numberValue(item.availableQuantity);
    return quantity > 0 && available > 0 && (available / quantity) * 100 <= thresholds.lowStockPercent;
  });
  const outOfStockInventory = inventoryRows.filter((item) => numberValue(item.availableQuantity) <= 0);
  const lowStockChemicals = chemicalRows.filter((item) => {
    const quantity = numberValue(item.quantity);
    const capacity = numberValue(item.capacity);
    return !item.quarantine
      && normalize(item.status) !== 'quarantined'
      && quantity > 0
      && capacity > 0
      && (quantity / capacity) * 100 <= thresholds.lowStockPercent;
  });
  const outOfStockChemicals = chemicalRows.filter((item) => (
    !item.quarantine
    && normalize(item.status) !== 'quarantined'
    && numberValue(item.quantity) <= 0
  ));
  const lowStockCount = lowStockInventory.length + lowStockChemicals.length;
  const outOfStockCount = outOfStockInventory.length + outOfStockChemicals.length;
  const expiringChemicals = chemicalRows.filter((item) => {
    if (!item.expirationDate || item.quarantine || normalize(item.status) === 'quarantined') return false;
    const expiration = new Date(`${item.expirationDate}T00:00:00`);
    return expiration >= today && expiration <= expirationCutoff;
  });
  const expiredChemicals = chemicalRows.filter((item) => {
    if (!item.expirationDate) return false;
    return new Date(`${item.expirationDate}T00:00:00`) < today;
  });
  const quarantinedChemicals = chemicalRows.filter((item) => item.quarantine || normalize(item.status) === 'quarantined');

  const categoryCounts = new Map(assetCategoryRows.map((row) => [normalize(row.category), numberValue(row.count)]));
  const assetByCategory = categoryRows.map((category) => ({
    label: `${category.name}${normalize(category.status) === 'inactive' ? ' (Inactive)' : ''}`,
    value: categoryCounts.get(normalize(category.name)) || 0,
  }));
  const knownCategoryNames = new Set(categoryRows.map((category) => normalize(category.name)));
  for (const [categoryName, value] of categoryCounts) {
    if (categoryName && !knownCategoryNames.has(categoryName)) {
      const original = assetCategoryRows.find((row) => normalize(row.category) === categoryName)?.category;
      assetByCategory.push({ label: original || 'Uncategorized', value });
    }
  }
  const uncategorizedAssets = assetCategoryRows.find((row) => !normalize(row.category));
  if (uncategorizedAssets) assetByCategory.push({ label: 'Uncategorized', value: numberValue(uncategorizedAssets.count) });

  const maintenanceCount = (keys) => countGroupedValues(maintenanceStatusRows, keys);
  const pendingApprovals = pendingApprovalCounts.reduce((total, count) => total + numberValue(count), 0);
  const activityLabel = (action) => {
    const normalizedAction = normalize(action).toUpperCase();
    if (normalizedAction.includes('REGISTER') || (normalizedAction.includes('ASSET') && normalizedAction.includes('CREATE'))) return 'Registration';
    if (normalizedAction.includes('ASSIGN')) return 'Asset assignment';
    if (normalizedAction.includes('TRANSFER')) return 'Asset transfer';
    if (normalizedAction.includes('MAINTENANCE')) return 'Maintenance activity';
    if (normalizedAction.includes('SERVICE') || normalizedAction.includes('REQUEST')) return 'Service request';
    if (normalizedAction.includes('USER') || normalizedAction.includes('ROLE')) return 'User change';
    if (normalizedAction.includes('APPROV')) return 'Approval';
    return 'System event';
  };

  return {
    thresholds,
    statistics: {
      assets: {
        total: totalAssets,
        active: activeAssets,
        damaged: damagedAssets,
        replaced: replacedAssets,
        expired: expiredAssets,
        underMaintenance: assetsUnderMaintenance,
      },
      organization: { users: totalUsers, colleges: totalColleges, departments: totalDepartments },
      workflow: { openServiceRequests, pendingApprovals },
      inventory: { lowStockItems: lowStockCount, expiringChemicals: expiringChemicals.length },
      maintenance: { overdue: overdueMaintenance },
    },
    assetByCondition: [
      { label: 'Functional', value: functionalAssets },
      { label: 'Damaged', value: damagedAssets },
      { label: 'Replaced', value: replacedAssets },
      { label: 'Expired', value: expiredAssets },
    ],
    assetByCategory,
    maintenanceOverview: [
      { label: 'Submitted', value: maintenanceCount(['submitted', 'pending']) },
      { label: 'Scheduled', value: maintenanceCount(['scheduled']) },
      { label: 'In-Progress', value: maintenanceCount(['in progress', 'inprogress']) },
      { label: 'Completed', value: maintenanceCount(['completed', 'complete', 'closed']) },
      { label: 'Escalated', value: escalatedRequests },
    ],
    inventoryAlerts: [
      { label: 'Low stock', value: lowStockCount },
      { label: 'Out of stock', value: outOfStockCount },
      { label: 'Expiring chemicals', value: expiringChemicals.length },
      { label: 'Expired chemicals', value: expiredChemicals.length },
      { label: 'Quarantined chemicals', value: quarantinedChemicals.length },
    ],
    recentActivity: recentActivity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      label: activityLabel(entry.action),
      entity: entry.entity,
      details: entry.details,
      createdAt: entry.createdAt,
    })),
  };
};

module.exports = { getDashboardAnalytics, defaultThresholds };
