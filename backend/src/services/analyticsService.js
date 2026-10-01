const fs = require('fs');
const path = require('path');
const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize,
  Asset,
  Assignment,
  Maintenance,
  Transfer,
  Inventory,
  RFIDLog,
  User,
  AuditLog,
  Notification,
  NotificationDelivery,
  College,
  Department,
  Campus,
} = require('../models');
const { getRequestMetrics } = require('../middlewares/requestMetrics');

const backupDirectory = path.join(__dirname, '../../backups');
const backupFilePattern = /^backup_[0-9]{8}T[0-9]{6}_[a-f0-9]{8}\.json$/;

const numberValue = (value) => Number(value || 0);
const normalizeDate = (value, fallback) => {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const getDateRange = (query = {}) => {
  const now = new Date();
  const from = normalizeDate(query.dateFrom, new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)));
  const to = normalizeDate(query.dateTo, now);
  return { from: from <= to ? from : to, to: from <= to ? to : from };
};

const buildScope = (query = {}) => {
  const scope = {};
  if (query.collegeId && Number.isInteger(Number(query.collegeId))) scope.collegeId = Number(query.collegeId);
  if (query.departmentId && Number.isInteger(Number(query.departmentId))) scope.departmentId = Number(query.departmentId);
  if (query.campusId && Number.isInteger(Number(query.campusId))) scope.campusId = Number(query.campusId);
  if (query.locationId) scope.location = String(query.locationId);
  if (query.categoryId) scope.category = String(query.categoryId);
  if (query.status) scope.status = String(query.status);
  if (query.condition) scope.condition = String(query.condition);
  if (query.acquisitionSource) scope.fundingSource = String(query.acquisitionSource);
  return scope;
};

const dateWhere = (from, to, field = 'createdAt') => ({ [field]: { [Op.between]: [from, to] } });
const groupByDate = (Model, field = 'createdAt') => {
  const databaseField = Model.rawAttributes[field]?.field || field;
  const quoteIdentifier = sequelize.getQueryInterface().quoteIdentifier.bind(sequelize.getQueryInterface());
  return literal(`DATE_FORMAT(${quoteIdentifier(Model.name)}.${quoteIdentifier(databaseField)}, '%Y-%m-%d')`);
};

const trend = async (Model, where, field = 'createdAt') => {
  const dateExpression = groupByDate(Model, field);
  const rows = await Model.findAll({
    where,
    attributes: [[dateExpression, 'period'], [fn('COUNT', col('id')), 'count']],
    group: [dateExpression],
    order: [[dateExpression, 'ASC']],
    raw: true,
  });
  return rows.map((row) => ({ period: row.period, count: numberValue(row.count) }));
};

const countByStatus = async (Model, where, statusField = 'status') => {
  const rows = await Model.findAll({
    where,
    attributes: [statusField, [fn('COUNT', col('id')), 'count']],
    group: [statusField],
    order: [[statusField, 'ASC']],
    raw: true,
  });
  return rows.map((row) => ({ status: row[statusField] || 'unknown', count: numberValue(row.count) }));
};

const getStoredFiles = async () => {
  const uploadDirectory = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
  const walk = async (directory) => {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(entryPath);
      const stats = await fs.promises.stat(entryPath);
      return [{ size: stats.size }];
    }));
    return files.flat();
  };
  try {
    const files = await walk(uploadDirectory);
    return { available: true, uploadedFiles: files.length, usedBytes: files.reduce((sum, file) => sum + file.size, 0) };
  } catch {
    return { available: false, uploadedFiles: null, usedBytes: null, reason: 'Upload storage is not available to the application' };
  }
};

const getAssetAnalytics = async (query = {}) => {
  const { from, to } = getDateRange(query);
  const scope = buildScope(query);
  const assetWhere = { ...scope, ...dateWhere(from, to) };
  const maintenanceWhere = dateWhere(from, to);
  if (query.maintenanceStatus) maintenanceWhere.status = String(query.maintenanceStatus);
  const [totalAssets, statusRows, categoryRows, conditionRows, ageRows, averageAge, totalValue, assignedAssets, maintenanceAssets, assignmentTrend, maintenanceTrend, transferTrend, acquisitionTrend, maintenanceStatus, maintenanceTotal, completedMaintenance, openMaintenance, maintainedAssetCount, frequentMaintenanceRows, inventoryStatus, inventoryTotals, rfidTotal, rfidTrend, colleges, departments, campuses, collegeGroups, departmentGroups, campusGroups, fundingGroups] = await Promise.all([
    Asset.count({ where: assetWhere }),
    countByStatus(Asset, assetWhere),
    Asset.findAll({ where: assetWhere, attributes: ['category', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['category'], order: [[literal('count'), 'DESC']], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['condition', [fn('COUNT', col('id')), 'count']], group: ['condition'], order: [[literal('count'), 'DESC']], raw: true }),
    Asset.findAll({ where: { ...scope, purchaseDate: { [Op.ne]: null } }, attributes: [[literal("CASE WHEN purchaseDate >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN 'Less than 1 year' WHEN purchaseDate >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR) THEN '1-3 years' WHEN purchaseDate >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR) THEN '3-5 years' WHEN purchaseDate >= DATE_SUB(CURDATE(), INTERVAL 10 YEAR) THEN '5-10 years' ELSE 'More than 10 years' END"), 'bucket'], [fn('COUNT', col('id')), 'count']], group: [literal('bucket')], raw: true }),
    Asset.findOne({ where: { ...scope, purchaseDate: { [Op.ne]: null } }, attributes: [[fn('AVG', literal('TIMESTAMPDIFF(YEAR, purchaseDate, CURDATE())')), 'averageAge']], raw: true }),
    Asset.sum('purchasePrice', { where: assetWhere }),
    Assignment.count({ where: { status: 'active', ...dateWhere(from, to) }, include: [{ model: Asset, required: true, where: scope, attributes: [] }] }),
    Asset.count({ where: { ...assetWhere, status: { [Op.in]: ['maintenance', 'under maintenance', 'in_maintenance'] } } }),
    trend(Assignment, dateWhere(from, to)),
    trend(Maintenance, maintenanceWhere),
    trend(Transfer, dateWhere(from, to), 'transferDate'),
    trend(Asset, { ...scope, ...dateWhere(from, to, 'purchaseDate') }, 'purchaseDate'),
    countByStatus(Maintenance, maintenanceWhere),
    Maintenance.count({ where: maintenanceWhere, include: [{ model: Asset, required: true, where: scope, attributes: [] }] }),
    Maintenance.count({ where: { ...maintenanceWhere, status: { [Op.in]: ['completed', 'complete', 'closed'] } }, include: [{ model: Asset, required: true, where: scope, attributes: [] }] }),
    Maintenance.count({ where: { ...maintenanceWhere, status: { [Op.in]: ['pending', 'open', 'assigned', 'in_progress', 'in progress'] } }, include: [{ model: Asset, required: true, where: scope, attributes: [] }] }),
    Maintenance.count({ distinct: true, col: 'asset_id', where: maintenanceWhere, include: [{ model: Asset, required: true, where: scope, attributes: [] }] }),
    Maintenance.findAll({ where: maintenanceWhere, attributes: ['assetId', [fn('COUNT', col('Maintenance.id')), 'count'], [fn('MAX', col('Maintenance.createdAt')), 'lastMaintenance']], include: [{ model: Asset, required: true, where: scope, attributes: [] }], group: ['assetId'], order: [[literal('count'), 'DESC']], limit: 10, raw: true }),
    countByStatus(Inventory, dateWhere(from, to)),
    Inventory.findOne({ where: dateWhere(from, to), attributes: [[fn('SUM', col('quantity')), 'quantity'], [fn('SUM', col('availableQuantity')), 'availableQuantity'], [fn('SUM', col('damagedQuantity')), 'damagedQuantity']], raw: true }),
    RFIDLog.count({ where: dateWhere(from, to) }),
    trend(RFIDLog, dateWhere(from, to)),
    College.findAll({ attributes: ['id', 'collegeName', 'collegeCode'], order: [['collegeName', 'ASC']], raw: true }),
    Department.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true }),
    Campus.findAll({ attributes: ['id', 'campusName', 'campusCode'], order: [['campusName', 'ASC']], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['collegeId', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['collegeId'], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['departmentId', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['departmentId'], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['campusId', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['campusId'], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['fundingSource', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['fundingSource'], order: [[literal('count'), 'DESC']], raw: true }),
  ]);
  const statusMap = Object.fromEntries(statusRows.map((row) => [String(row.status).toLowerCase(), row.count]));
  const eligible = totalAssets - (statusMap.disposed || statusMap.retired || 0);
  const collegeNames = Object.fromEntries(colleges.map((college) => [college.id, college.collegeName]));
  const departmentNames = Object.fromEntries(departments.map((department) => [department.id, department.name]));
  const campusNames = Object.fromEntries(campuses.map((campus) => [campus.id, campus.campusName]));
  const organizationRows = (groups, names, label) => groups.map((row) => {
    const count = numberValue(row.count);
    return { id: row[`${label}Id`], name: names[row[`${label}Id`]] || 'Unassigned', count, value: numberValue(row.value), utilizationRate: count ? null : 0 };
  });
  const frequentAssetIds = frequentMaintenanceRows.map((row) => row.assetId).filter(Boolean);
  const frequentAssets = frequentAssetIds.length ? await Asset.findAll({ where: { id: { [Op.in]: frequentAssetIds } }, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'departmentId', 'status', 'updatedAt'], raw: true }) : [];
  const frequentAssetMap = Object.fromEntries(frequentAssets.map((asset) => [asset.id, asset]));
  const fundingRows = fundingGroups.map((row) => ({ source: row.fundingSource || 'Not recorded', count: numberValue(row.count), value: numberValue(row.value) }));
  const researchGrantRows = fundingRows.filter((row) => /grant/i.test(row.source));
  const researchGrantTotal = researchGrantRows.reduce((sum, row) => sum + row.count, 0);
  const researchGrantValue = researchGrantRows.reduce((sum, row) => sum + row.value, 0);
  return {
    generatedAt: new Date().toISOString(),
    filters: { dateFrom: from.toISOString(), dateTo: to.toISOString(), ...scope },
    kpis: {
      totalAssets,
      activeAssets: totalAssets - (statusMap.disposed || statusMap.retired || 0),
      assignedAssets,
      availableAssets: statusMap.available || 0,
      underMaintenance: maintenanceAssets,
      missingAssets: statusMap.missing || 0,
      damagedAssets: statusMap.damaged || 0,
      disposedAssets: statusMap.disposed || statusMap.retired || 0,
      totalAssetValue: numberValue(totalValue),
      averageAssetAge: averageAge?.averageAge === null || averageAge?.averageAge === undefined ? null : Number(Number(averageAge.averageAge).toFixed(1)),
      utilizationRate: eligible > 0 ? Number(((assignedAssets / eligible) * 100).toFixed(2)) : 0,
    },
    status: statusRows,
    categories: categoryRows.map((row) => ({ category: row.category || 'Uncategorised', count: numberValue(row.count), value: numberValue(row.value) })),
    distributions: { byCondition: conditionRows.map((row) => ({ condition: row.condition || 'Not recorded', count: numberValue(row.count) })), byAge: ageRows.map((row) => ({ bucket: row.bucket, count: numberValue(row.count) })) },
    trends: { assignments: assignmentTrend, maintenance: maintenanceTrend, transfers: transferTrend, rfid: rfidTrend, acquisitions: acquisitionTrend },
    acquisition: { bySource: fundingRows, researchGrant: { totalAssets: researchGrantTotal, totalValue: researchGrantValue, bySource: researchGrantRows } },
    maintenance: { statuses: maintenanceStatus, totalRequests: maintenanceTotal, completedRequests: completedMaintenance, openRequests: openMaintenance, assetsMaintained: maintainedAssetCount, averageFrequency: maintainedAssetCount ? Number((maintenanceTotal / maintainedAssetCount).toFixed(2)) : null, frequentlyMaintained: frequentMaintenanceRows.map((row) => ({ ...(frequentAssetMap[row.assetId] || {}), maintenanceCount: numberValue(row.count), lastMaintenance: row.lastMaintenance })) },
    inventory: { statuses: inventoryStatus, totals: { quantity: numberValue(inventoryTotals?.quantity), availableQuantity: numberValue(inventoryTotals?.availableQuantity), damagedQuantity: numberValue(inventoryTotals?.damagedQuantity) } },
    rfid: { scans: rfidTotal },
    organizations: { colleges, departments, campuses, collegePerformance: organizationRows(collegeGroups, collegeNames, 'college'), departmentPerformance: organizationRows(departmentGroups, departmentNames, 'department'), campusPerformance: campusGroups.map((row) => ({ id: row.campusId, name: campusNames[row.campusId] || 'Unassigned', count: numberValue(row.count), value: numberValue(row.value) })) },
  };
};

const getSystemAnalytics = async (query = {}) => {
  const { from, to } = getDateRange(query);
  const auditWhere = { ...dateWhere(from, to) };
  if (query.action) auditWhere.action = String(query.action);
  if (query.userId && Number.isInteger(Number(query.userId))) auditWhere.userId = Number(query.userId);
  const requestMetrics = getRequestMetrics({ from, to });
  const securityActions = ['LOGIN_FAILED', 'USER_LOCKED', 'PASSWORD_RESET', 'PERMISSION_CHANGED', 'ROLE_CHANGED', 'UNAUTHORIZED_ACCESS'];
  const [auditTotal, auditByAction, auditTrend, loginCount, failedLoginCount, uniqueActiveUsers, activeUsers, inactiveUsers, lockedUsers, totalUsers, userRoles, recentActivity, activityByUser, activityByModule, securityEvents, authenticationEvents, createdUsers, activatedUsers, deactivatedUsers, databaseStatus, backups, storage, notificationCount, unreadNotifications, readNotifications, failedDeliveries, deliveryStatuses] = await Promise.all([
    AuditLog.count({ where: auditWhere }),
    AuditLog.findAll({ where: auditWhere, attributes: ['action', [fn('COUNT', col('id')), 'count']], group: ['action'], order: [[literal('count'), 'DESC']], limit: 12, raw: true }),
    trend(AuditLog, auditWhere),
    AuditLog.count({ where: { ...auditWhere, action: 'LOGIN' } }),
    AuditLog.count({ where: { ...auditWhere, action: 'LOGIN_FAILED' } }),
    AuditLog.count({ distinct: true, col: 'userId', where: { ...auditWhere, action: 'LOGIN', userId: { [Op.ne]: null } } }),
    User.count({ where: { active: true } }),
    User.count({ where: { active: false } }),
    User.count({ where: { lockoutUntil: { [Op.gt]: new Date() } } }),
    User.count(),
    User.findAll({ attributes: ['role', [fn('COUNT', col('id')), 'count']], group: ['role'], order: [['role', 'ASC']], raw: true }),
    AuditLog.findAll({ where: auditWhere, attributes: ['id', 'userId', 'action', 'entity', 'details', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
    AuditLog.findAll({ where: { ...auditWhere, userId: { [Op.ne]: null } }, attributes: ['userId', [fn('COUNT', col('id')), 'count']], group: ['userId'], order: [[literal('count'), 'DESC']], limit: 10, raw: true }),
    AuditLog.findAll({ where: auditWhere, attributes: ['entity', [fn('COUNT', col('id')), 'count']], group: ['entity'], order: [[literal('count'), 'DESC']], limit: 20, raw: true }),
    AuditLog.findAll({ where: { ...auditWhere, action: { [Op.in]: securityActions } }, attributes: ['id', 'userId', 'action', 'entity', 'details', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
    AuditLog.findAll({ where: { ...auditWhere, action: { [Op.in]: ['LOGIN', 'LOGIN_FAILED'] } }, attributes: ['action', [groupByDate(AuditLog), 'period'], [fn('COUNT', col('id')), 'count']], group: ['action', groupByDate(AuditLog)], order: [[groupByDate(AuditLog), 'ASC']], raw: true }),
    User.count({ where: dateWhere(from, to) }),
    AuditLog.count({ where: { ...auditWhere, action: 'USER_ACTIVATED' } }),
    AuditLog.count({ where: { ...auditWhere, action: 'USER_DEACTIVATED' } }),
    sequelize.authenticate().then(() => ({ status: 'connected', checkedAt: new Date().toISOString() })).catch(() => ({ status: 'unavailable', checkedAt: new Date().toISOString() })),
    fs.promises.readdir(backupDirectory, { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile() && backupFilePattern.test(entry.name)).map((entry) => entry.name).sort().reverse()).catch(() => []),
    getStoredFiles(),
    Notification.count({ where: dateWhere(from, to) }),
    Notification.count({ where: { ...dateWhere(from, to), read: false } }),
    Notification.count({ where: { ...dateWhere(from, to), read: true } }),
    NotificationDelivery.count({ where: { ...dateWhere(from, to), status: 'failed' } }),
    countByStatus(NotificationDelivery, dateWhere(from, to)),
  ]);
  const activityUserIds = activityByUser.map((row) => row.userId).filter(Boolean);
  const activityUsers = activityUserIds.length ? await User.findAll({ where: { id: { [Op.in]: activityUserIds } }, attributes: ['id', 'username', 'fullName'], raw: true }) : [];
  const recentUserIds = [...new Set([...recentActivity, ...securityEvents].map((row) => row.userId).filter(Boolean))];
  const recentUsers = recentUserIds.length ? await User.findAll({ where: { id: { [Op.in]: recentUserIds } }, attributes: ['id', 'username', 'fullName'], raw: true }) : [];
  const userNames = Object.fromEntries([...activityUsers, ...recentUsers].map((user) => [user.id, user.fullName || user.username]));
  const moduleCounts = activityByModule.reduce((result, row) => {
    const moduleName = String(row.entity || 'system').split(':')[0] || 'system';
    result[moduleName] = (result[moduleName] || 0) + numberValue(row.count);
    return result;
  }, {});
  const errorRows = requestMetrics.requests.filter((item) => item.status >= 400).slice(-50).reverse();
  const requestByDay = new Map();
  const responseTimeByDay = new Map();
  const errorsByStatus = new Map();
  const errorsByEndpoint = new Map();
  for (const request of requestMetrics.requests) {
    const period = new Date(request.timestamp).toISOString().slice(0, 10);
    const day = requestByDay.get(period) || { period, count: 0, successful: 0, failed: 0 };
    day.count += 1;
    if (request.status >= 400) day.failed += 1;
    else day.successful += 1;
    requestByDay.set(period, day);
    const timing = responseTimeByDay.get(period) || { period, total: 0, count: 0 };
    timing.total += request.duration;
    timing.count += 1;
    responseTimeByDay.set(period, timing);
    if (request.status >= 400) {
      errorsByStatus.set(request.status, (errorsByStatus.get(request.status) || 0) + 1);
      const endpoint = `${request.method} ${request.path}`;
      errorsByEndpoint.set(endpoint, (errorsByEndpoint.get(endpoint) || 0) + 1);
    }
  }
  const authenticationTrend = new Map();
  for (const event of authenticationEvents) {
    const entry = authenticationTrend.get(event.period) || { period: event.period, successful: 0, failed: 0 };
    if (event.action === 'LOGIN') entry.successful = numberValue(event.count);
    if (event.action === 'LOGIN_FAILED') entry.failed = numberValue(event.count);
    authenticationTrend.set(event.period, entry);
  }
  const parseDetails = (value) => {
    try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; }
  };
  return {
    generatedAt: new Date().toISOString(),
    filters: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
    health: { api: { status: 'operational', checkedAt: new Date().toISOString() }, database: databaseStatus, storage, authentication: { status: 'operational' }, backups: backups.length ? { status: 'available', count: backups.length, latest: backups[0] } : { status: 'not_available', count: 0, latest: null } },
    users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, locked: lockedUsers, recentlyCreated: createdUsers, recentlyActivated: activatedUsers, recentlyDeactivated: deactivatedUsers, roles: userRoles.map((row) => ({ role: row.role, count: numberValue(row.count) })) },
    authentication: { successfulLogins: loginCount, failedLogins: failedLoginCount, loginAttempts: loginCount + failedLoginCount, uniqueActiveUsers, trend: [...authenticationTrend.values()] },
    api: { available: requestMetrics.collectedSamples > 0, requestCount: requestMetrics.requests.length, successfulRequests: requestMetrics.successfulRequests, failedRequests: requestMetrics.failedRequests, averageResponseTime: requestMetrics.collectedSamples ? requestMetrics.averageResponseTime : null, slowRequests: requestMetrics.slowRequests, trend: [...requestByDay.values()], responseTimeTrend: [...responseTimeByDay.values()].map((row) => ({ period: row.period, averageResponseTime: Number((row.total / row.count).toFixed(2)) })), errorsByStatus: [...errorsByStatus].map(([status, count]) => ({ status, count })), errorsByEndpoint: [...errorsByEndpoint].map(([endpoint, count]) => ({ endpoint, count })).sort((a, b) => b.count - a.count).slice(0, 10), errors: errorRows.map((item) => ({ method: item.method, path: item.path, status: item.status, responseTime: item.duration, timestamp: item.timestamp })) },
    database: { performance: { available: false, reason: 'Database query performance is not collected by the application' } },
    storage,
    errors: { total: requestMetrics.failedRequests, recent: errorRows },
    security: { failedLoginAttempts: failedLoginCount, unauthorizedRequests: requestMetrics.requests.filter((item) => item.status === 401 || item.status === 403).length, permissionChanges: securityEvents.filter((row) => ['PERMISSION_CHANGED', 'ROLE_CHANGED'].includes(row.action)).length, events: securityEvents.map((row) => ({ ...row, user: userNames[row.userId] || 'System', ipAddress: parseDetails(row.details).ipAddress || null })) },
    audit: { total: auditTotal, byAction: auditByAction.map((row) => ({ action: row.action, count: numberValue(row.count) })), trend: auditTrend, recent: recentActivity.map((row) => ({ ...row, user: userNames[row.userId] || 'System', description: parseDetails(row.details).description || parseDetails(row.details).message || '' })), today: auditTrend.find((row) => row.period === new Date().toISOString().slice(0, 10))?.count || 0, mostActiveUsers: activityByUser.map((row) => ({ userId: row.userId, name: userNames[row.userId] || 'System user', count: numberValue(row.count) })), modules: Object.entries(moduleCounts).map(([module, count]) => ({ module, count })) },
    notifications: { generated: notificationCount, unread: unreadNotifications, read: readNotifications, failedDeliveries, deliveryStatuses, trend: await trend(Notification, dateWhere(from, to)) },
  };
};

module.exports = { getAssetAnalytics, getSystemAnalytics, getDateRange, buildScope };
