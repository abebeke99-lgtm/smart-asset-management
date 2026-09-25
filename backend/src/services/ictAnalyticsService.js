const { Op, fn, col, literal } = require('sequelize');
const {
  Asset,
  Assignment,
  Department,
  Maintenance,
  MaintenanceRepair,
} = require('../models');

const numberValue = (value) => Number(value || 0);
const nonBlank = (field) => ({ [field]: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } });

const parseDate = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} is invalid`);
    error.status = 422;
    throw error;
  }
  return date;
};

const getPeriod = (query = {}) => {
  const from = parseDate(query.dateFrom, 'Date from');
  const to = parseDate(query.dateTo, 'Date to');
  if (from && to && from > to) {
    const error = new Error('Date from must be before date to');
    error.status = 422;
    throw error;
  }
  if (!from && !to) return { from: null, to: null, previousFrom: null, previousTo: null };
  const end = to || new Date();
  const start = from || new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000));
  const duration = end.getTime() - start.getTime() + 1;
  return {
    from: start,
    to: end,
    previousFrom: new Date(start.getTime() - duration),
    previousTo: new Date(start.getTime() - 1),
  };
};

const buildAssetWhere = (collegeId, query = {}, period = {}) => {
  const where = { collegeId };
  if (query.category) where.category = String(query.category).trim();
  if (query.status) where.status = String(query.status).trim();
  if (query.condition) where.condition = String(query.condition).trim();
  if (query.departmentId) where.departmentId = Number(query.departmentId);
  if (query.location) where.location = { [Op.like]: `%${String(query.location).trim()}%` };
  if (period.from || period.to) {
    where.createdAt = {};
    if (period.from) where.createdAt[Op.gte] = period.from;
    if (period.to) where.createdAt[Op.lte] = period.to;
  }
  return where;
};

const groupedCount = async (model, where, field, label = field, include = []) => {
  const rows = await model.findAll({
    where,
    include,
    attributes: [[col(field), label], [fn('COUNT', col('id')), 'count']],
    group: [field],
    order: [[field, 'ASC']],
    raw: true,
  });
  return rows.map((row) => ({ [label]: row[label] || 'Unknown', count: numberValue(row.count) }));
};

const groupedAssetValue = async (where, field, label = field) => {
  const rows = await Asset.findAll({
    where,
    attributes: [[col(field), label], [fn('COUNT', col('id')), 'total'], [fn('SUM', col('purchasePrice')), 'value']],
    group: [field],
    order: [[literal('total'), 'DESC']],
    raw: true,
  });
  return rows.map((row) => ({ [label]: row[label] || 'Unassigned', total: numberValue(row.total), value: numberValue(row.value) }));
};

const trend = async (model, where, field = 'createdAt', include = []) => {
  const expression = `DATE_FORMAT(${field}, '%Y-%m-%d')`;
  const rows = await model.findAll({
    where,
    include,
    attributes: [[literal(expression), 'period'], [fn('COUNT', col('id')), 'count']],
    group: [literal(expression)],
    order: [[literal(expression), 'ASC']],
    raw: true,
  });
  return rows.map((row) => ({ period: row.period, count: numberValue(row.count) }));
};

const getIctAssetAnalytics = async (query = {}, collegeId) => {
  const period = getPeriod(query);
  const assetWhere = buildAssetWhere(collegeId, query, period);
  const maintenanceWhere = period.from || period.to ? { createdAt: { [Op.between]: [period.from, period.to] } } : {};
  const assetScopeInclude = [{ model: Asset, required: true, where: assetWhere, attributes: [] }];
  const [
    totalAssets, status, conditions, categories, departments, locations, categoryStatus,
    totalAssetValue, assignedAssets, maintenanceAssets, repairAssets, maintenanceStatuses,
    repairStatuses, healthAverage, healthStatuses, trackedAssets, trackingRows, ageRows,
    assetTrend, assignmentTrend, maintenanceTrend, repairTrend, optionCategories,
    optionStatuses, optionConditions, optionLocations, optionDepartments,
  ] = await Promise.all([
    Asset.count({ where: assetWhere }),
    groupedCount(Asset, assetWhere, 'status'),
    groupedCount(Asset, assetWhere, 'condition'),
    groupedAssetValue(assetWhere, 'category'),
    groupedAssetValue(assetWhere, 'department'),
    groupedAssetValue(assetWhere, 'location'),
    Asset.findAll({ where: assetWhere, attributes: ['category', 'status', [fn('COUNT', col('id')), 'count']], group: ['category', 'status'], raw: true }),
    Asset.sum('purchasePrice', { where: assetWhere }),
    Assignment.count({ where: { status: 'active' }, include: assetScopeInclude }),
    Asset.count({ where: { ...assetWhere, status: { [Op.in]: ['maintenance', 'under-maintenance', 'under maintenance', 'in_maintenance'] } } }),
    MaintenanceRepair.count({ where: maintenanceWhere, include: assetScopeInclude }),
    groupedCount(Maintenance, maintenanceWhere, 'status', 'status', assetScopeInclude),
    groupedCount(MaintenanceRepair, maintenanceWhere, 'status', 'status', assetScopeInclude),
    Asset.findOne({ where: { ...assetWhere, healthScore: { [Op.not]: null } }, attributes: [[fn('AVG', col('healthScore')), 'average']], raw: true }),
    Asset.findAll({ where: { ...assetWhere, healthScore: { [Op.not]: null } }, attributes: [[literal("CASE WHEN health_score >= 80 THEN 'Healthy' WHEN health_score >= 50 THEN 'Warning' ELSE 'Critical' END"), 'healthStatus'], [fn('COUNT', col('id')), 'count']], group: [literal("CASE WHEN health_score >= 80 THEN 'Healthy' WHEN health_score >= 50 THEN 'Warning' ELSE 'Critical' END")], raw: true }),
    Asset.count({ where: { ...assetWhere, [Op.or]: [{ assetCode: nonBlank('assetCode').assetCode }, { rfidTag: nonBlank('rfidTag').rfidTag }] } }),
    Asset.findAll({ where: assetWhere, attributes: [[literal("CASE WHEN asset_code IS NOT NULL AND asset_code <> '' AND rfid_tag IS NOT NULL AND rfid_tag <> '' THEN 'QR + RFID' WHEN rfid_tag IS NOT NULL AND rfid_tag <> '' THEN 'RFID' WHEN asset_code IS NOT NULL AND asset_code <> '' THEN 'QR' ELSE 'Not tracked' END"), 'trackingType'], [fn('COUNT', col('id')), 'count']], group: [literal("CASE WHEN asset_code IS NOT NULL AND asset_code <> '' AND rfid_tag IS NOT NULL AND rfid_tag <> '' THEN 'QR + RFID' WHEN rfid_tag IS NOT NULL AND rfid_tag <> '' THEN 'RFID' WHEN asset_code IS NOT NULL AND asset_code <> '' THEN 'QR' ELSE 'Not tracked' END")], raw: true }),
    Asset.findAll({ where: { ...assetWhere, purchaseDate: { [Op.not]: null } }, attributes: [[literal("CASE WHEN DATEDIFF(CURDATE(), purchase_date) < 365 THEN '< 1 year' WHEN DATEDIFF(CURDATE(), purchase_date) < 1095 THEN '1-3 years' WHEN DATEDIFF(CURDATE(), purchase_date) < 1825 THEN '3-5 years' WHEN DATEDIFF(CURDATE(), purchase_date) < 2555 THEN '5-7 years' ELSE '> 7 years' END"), 'bucket'], [fn('COUNT', col('id')), 'count']], group: [literal("CASE WHEN DATEDIFF(CURDATE(), purchase_date) < 365 THEN '< 1 year' WHEN DATEDIFF(CURDATE(), purchase_date) < 1095 THEN '1-3 years' WHEN DATEDIFF(CURDATE(), purchase_date) < 1825 THEN '3-5 years' WHEN DATEDIFF(CURDATE(), purchase_date) < 2555 THEN '5-7 years' ELSE '> 7 years' END")], raw: true }),
    trend(Asset, assetWhere),
    trend(Assignment, { status: 'active', ...(period.from || period.to ? { createdAt: { [Op.between]: [period.from, period.to] } } : {}) }, 'createdAt', assetScopeInclude),
    trend(Maintenance, maintenanceWhere, 'createdAt', assetScopeInclude),
    trend(MaintenanceRepair, maintenanceWhere, 'createdAt', assetScopeInclude),
    groupedCount(Asset, { collegeId }, 'category'),
    groupedCount(Asset, { collegeId }, 'status'),
    groupedCount(Asset, { collegeId }, 'condition'),
    groupedCount(Asset, { collegeId }, 'location'),
    Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true }),
  ]);

  const assignedByCategory = await Asset.findAll({ where: assetWhere, include: [{ model: Assignment, required: true, where: { status: 'active' }, attributes: [] }], attributes: ['category', [fn('COUNT', col('id')), 'assigned']], group: ['category'], raw: true });
  const assignedMap = Object.fromEntries(assignedByCategory.map((row) => [row.category || 'Unassigned', numberValue(row.assigned)]));
  const categoryTable = categories.map((row) => {
    const statusRows = categoryStatus.filter((item) => (item.category || 'Unassigned') === (row.category || 'Unassigned'));
    const statusMap = Object.fromEntries(statusRows.map((item) => [String(item.status || '').toLowerCase().replace(/[_ ]/g, '-'), numberValue(item.count)]));
    return { category: row.category || 'Unassigned', total: row.total, assigned: assignedMap[row.category || 'Unassigned'] || 0, available: statusMap.available || 0, maintenance: statusMap.maintenance || statusMap['under-maintenance'] || 0, repair: statusMap.repair || statusMap['under-repair'] || 0, value: row.value };
  });
  const previousTotal = period.previousFrom ? await Asset.count({ where: buildAssetWhere(collegeId, query, { from: period.previousFrom, to: period.previousTo }) }) : null;

  return {
    filters: { dateFrom: period.from?.toISOString() || null, dateTo: period.to?.toISOString() || null, category: query.category || '', status: query.status || '', condition: query.condition || '', departmentId: query.departmentId || '', location: query.location || '' },
    summary: {
      totalAssets,
      assignedAssets,
      availableAssets: status.find((row) => String(row.status).toLowerCase() === 'available')?.count || 0,
      underMaintenance: maintenanceAssets,
      underRepair: repairAssets,
      retiredAssets: status.filter((row) => ['retired', 'disposed'].includes(String(row.status).toLowerCase())).reduce((sum, row) => sum + row.count, 0),
      totalAssetValue: numberValue(totalAssetValue),
      averageHealthScore: healthAverage?.average == null ? null : Number(Number(healthAverage.average).toFixed(2)),
      trackingCoverage: totalAssets ? Number(((trackedAssets / totalAssets) * 100).toFixed(2)) : null,
      comparison: previousTotal === null ? null : { current: totalAssets, previous: previousTotal, percentage: previousTotal ? Number((((totalAssets - previousTotal) / previousTotal) * 100).toFixed(2)) : null },
    },
    distributions: {
      byCategory: categories.map((row) => ({ category: row.category || 'Unassigned', count: row.total, value: row.value })),
      byStatus: status,
      byCondition: conditions,
      byDepartment: departments.map((row) => ({ department: row.department || 'Unassigned', count: row.total, value: row.value })),
      byLocation: locations.map((row) => ({ location: row.location || 'Unassigned', count: row.total, value: row.value })),
      byAge: ageRows.map((row) => ({ bucket: row.bucket, count: numberValue(row.count) })),
    },
    maintenance: { statuses: maintenanceStatuses },
    repairs: { statuses: repairStatuses },
    health: { statuses: healthStatuses.map((row) => ({ status: row.healthStatus, count: numberValue(row.count) })) },
    tracking: { types: trackingRows.map((row) => ({ type: row.trackingType, count: numberValue(row.count) })), trackedAssets },
    trends: { assets: assetTrend, assignments: assignmentTrend, maintenance: maintenanceTrend, repairs: repairTrend },
    table: categoryTable,
    options: { categories: optionCategories.map((row) => row.category), statuses: optionStatuses.map((row) => row.status), conditions: optionConditions.map((row) => row.condition), locations: optionLocations.map((row) => row.location), departments: optionDepartments },
  };
};

module.exports = { getIctAssetAnalytics };