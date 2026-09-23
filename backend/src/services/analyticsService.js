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
  if (query.locationId) scope.location = String(query.locationId);
  if (query.categoryId) scope.category = String(query.categoryId);
  if (query.status) scope.status = String(query.status);
  return scope;
};

const dateWhere = (from, to, field = 'createdAt') => ({ [field]: { [Op.between]: [from, to] } });
const groupByDate = (field = 'createdAt') => fn('DATE_FORMAT', col(field), '%Y-%m-%d');

const trend = async (Model, where, field = 'createdAt') => {
  const rows = await Model.findAll({
    where,
    attributes: [[groupByDate(field), 'period'], [fn('COUNT', col('id')), 'count']],
    group: [literal(`DATE_FORMAT(${field}, '%Y-%m-%d')`)],
    order: [[literal(`DATE_FORMAT(${field}, '%Y-%m-%d')`), 'ASC']],
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
  const [totalAssets, statusRows, categoryRows, totalValue, assignedAssets, maintenanceAssets, assignmentTrend, maintenanceTrend, transferTrend, maintenanceStatus, inventoryStatus, inventoryTotals, rfidTotal, rfidTrend, colleges, departments, collegeGroups, departmentGroups] = await Promise.all([
    Asset.count({ where: assetWhere }),
    countByStatus(Asset, assetWhere),
    Asset.findAll({ where: assetWhere, attributes: ['category', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['category'], order: [[literal('count'), 'DESC']], raw: true }),
    Asset.sum('purchasePrice', { where: assetWhere }),
    Assignment.count({ where: { status: 'active', ...dateWhere(from, to) }, include: [{ model: Asset, required: true, where: scope, attributes: [] }] }),
    Asset.count({ where: { ...assetWhere, status: { [Op.in]: ['maintenance', 'under maintenance', 'in_maintenance'] } } }),
    trend(Assignment, dateWhere(from, to)),
    trend(Maintenance, dateWhere(from, to)),
    trend(Transfer, dateWhere(from, to), 'transferDate'),
    countByStatus(Maintenance, dateWhere(from, to)),
    countByStatus(Inventory, dateWhere(from, to)),
    Inventory.findOne({ where: dateWhere(from, to), attributes: [[fn('SUM', col('quantity')), 'quantity'], [fn('SUM', col('availableQuantity')), 'availableQuantity'], [fn('SUM', col('damagedQuantity')), 'damagedQuantity']], raw: true }),
    RFIDLog.count({ where: dateWhere(from, to) }),
    trend(RFIDLog, dateWhere(from, to)),
    College.findAll({ attributes: ['id', 'collegeName', 'collegeCode'], order: [['collegeName', 'ASC']], raw: true }),
    Department.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['collegeId', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['collegeId'], raw: true }),
    Asset.findAll({ where: assetWhere, attributes: ['departmentId', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('purchasePrice')), 'value']], group: ['departmentId'], raw: true }),
  ]);
  const statusMap = Object.fromEntries(statusRows.map((row) => [String(row.status).toLowerCase(), row.count]));
  const eligible = totalAssets - (statusMap.disposed || statusMap.retired || 0);
  const collegeNames = Object.fromEntries(colleges.map((college) => [college.id, college.collegeName]));
  const departmentNames = Object.fromEntries(departments.map((department) => [department.id, department.name]));
  const organizationRows = (groups, names, label) => groups.map((row) => {
    const count = numberValue(row.count);
    return { id: row[`${label}Id`], name: names[row[`${label}Id`]] || 'Unassigned', count, value: numberValue(row.value), utilizationRate: count ? null : 0 };
  });
  return {
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
      utilizationRate: eligible > 0 ? Number(((assignedAssets / eligible) * 100).toFixed(2)) : 0,
    },
    status: statusRows,
    categories: categoryRows.map((row) => ({ category: row.category || 'Uncategorised', count: numberValue(row.count), value: numberValue(row.value) })),
    trends: { assignments: assignmentTrend, maintenance: maintenanceTrend, transfers: transferTrend, rfid: rfidTrend },
    maintenance: { statuses: maintenanceStatus },
    inventory: { statuses: inventoryStatus, totals: { quantity: numberValue(inventoryTotals?.quantity), availableQuantity: numberValue(inventoryTotals?.availableQuantity), damagedQuantity: numberValue(inventoryTotals?.damagedQuantity) } },
    rfid: { scans: rfidTotal },
    organizations: { colleges, departments, collegePerformance: organizationRows(collegeGroups, collegeNames, 'college'), departmentPerformance: organizationRows(departmentGroups, departmentNames, 'department') },
  };
};

const getSystemAnalytics = async (query = {}) => {
  const { from, to } = getDateRange(query);
  const auditWhere = { ...dateWhere(from, to) };
  if (query.action) auditWhere.action = String(query.action);
  if (query.userId && Number.isInteger(Number(query.userId))) auditWhere.userId = Number(query.userId);
  const requestMetrics = getRequestMetrics({ from, to });
  const securityActions = ['LOGIN_FAILED', 'USER_LOCKED', 'PASSWORD_RESET', 'PERMISSION_CHANGED', 'ROLE_CHANGED', 'UNAUTHORIZED_ACCESS'];
  const [auditTotal, auditByAction, auditTrend, loginCount, failedLoginCount, activeUsers, inactiveUsers, lockedUsers, totalUsers, userRoles, recentActivity, activityByUser, activityByModule, securityEvents, createdUsers, activatedUsers, deactivatedUsers, databaseStatus, backups, storage, notificationCount, unreadNotifications, failedDeliveries] = await Promise.all([
    AuditLog.count({ where: auditWhere }),
    AuditLog.findAll({ where: auditWhere, attributes: ['action', [fn('COUNT', col('id')), 'count']], group: ['action'], order: [[literal('count'), 'DESC']], limit: 12, raw: true }),
    trend(AuditLog, auditWhere),
    AuditLog.count({ where: { ...auditWhere, action: 'LOGIN' } }),
    AuditLog.count({ where: { ...auditWhere, action: 'LOGIN_FAILED' } }),
    User.count({ where: { active: true } }),
    User.count({ where: { active: false } }),
    User.count({ where: { lockoutUntil: { [Op.gt]: new Date() } } }),
    User.count(),
    User.findAll({ attributes: ['role', [fn('COUNT', col('id')), 'count']], group: ['role'], order: [['role', 'ASC']], raw: true }),
    AuditLog.findAll({ where: auditWhere, attributes: ['id', 'userId', 'action', 'entity', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
    AuditLog.findAll({ where: { ...auditWhere, userId: { [Op.ne]: null } }, attributes: ['userId', [fn('COUNT', col('id')), 'count']], group: ['userId'], order: [[literal('count'), 'DESC']], limit: 10, raw: true }),
    AuditLog.findAll({ where: auditWhere, attributes: ['entity', [fn('COUNT', col('id')), 'count']], group: ['entity'], order: [[literal('count'), 'DESC']], limit: 20, raw: true }),
    AuditLog.findAll({ where: { ...auditWhere, action: { [Op.in]: securityActions } }, attributes: ['id', 'userId', 'action', 'entity', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
    User.count({ where: dateWhere(from, to) }),
    AuditLog.count({ where: { ...auditWhere, action: 'USER_ACTIVATED' } }),
    AuditLog.count({ where: { ...auditWhere, action: 'USER_DEACTIVATED' } }),
    sequelize.authenticate().then(() => ({ status: 'connected', checkedAt: new Date().toISOString() })).catch(() => ({ status: 'unavailable', checkedAt: new Date().toISOString() })),
    fs.promises.readdir(backupDirectory, { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile() && backupFilePattern.test(entry.name)).map((entry) => entry.name).sort().reverse()).catch(() => []),
    getStoredFiles(),
    Notification.count({ where: dateWhere(from, to) }),
    Notification.count({ where: { ...dateWhere(from, to), read: false } }),
    NotificationDelivery.count({ where: { ...dateWhere(from, to), status: 'failed' } }),
  ]);
  const activityUserIds = activityByUser.map((row) => row.userId).filter(Boolean);
  const activityUsers = activityUserIds.length ? await User.findAll({ where: { id: { [Op.in]: activityUserIds } }, attributes: ['id', 'username', 'fullName'], raw: true }) : [];
  const userNames = Object.fromEntries(activityUsers.map((user) => [user.id, user.fullName || user.username]));
  const moduleCounts = activityByModule.reduce((result, row) => {
    const moduleName = String(row.entity || 'system').split(':')[0] || 'system';
    result[moduleName] = (result[moduleName] || 0) + numberValue(row.count);
    return result;
  }, {});
  const errorRows = requestMetrics.requests.filter((item) => item.status >= 400).slice(-50).reverse();
  return {
    filters: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
    health: { api: { status: 'operational', checkedAt: new Date().toISOString() }, database: databaseStatus, storage, authentication: { status: 'operational' }, backups: backups.length ? { status: 'available', count: backups.length, latest: backups[0] } : { status: 'not_available', count: 0, latest: null } },
    users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, locked: lockedUsers, recentlyCreated: createdUsers, recentlyActivated: activatedUsers, recentlyDeactivated: deactivatedUsers, roles: userRoles.map((row) => ({ role: row.role, count: numberValue(row.count) })) },
    authentication: { successfulLogins: loginCount, failedLogins: failedLoginCount, loginAttempts: loginCount + failedLoginCount, uniqueActiveUsers: new Set(recentActivity.filter((row) => row.action === 'LOGIN').map((row) => row.userId).filter(Boolean)).size },
    api: { available: requestMetrics.collectedSamples > 0, requestCount: requestMetrics.requests.length, successfulRequests: requestMetrics.successfulRequests, failedRequests: requestMetrics.failedRequests, averageResponseTime: requestMetrics.collectedSamples ? requestMetrics.averageResponseTime : null, slowRequests: requestMetrics.slowRequests, errors: errorRows.map((item) => ({ method: item.method, path: item.path, status: item.status, responseTime: item.duration, timestamp: item.timestamp })) },
    database: { performance: { available: false, reason: 'Database query performance is not collected by the application' } },
    storage,
    errors: { total: requestMetrics.failedRequests, recent: errorRows },
    security: { failedLoginAttempts: failedLoginCount, unauthorizedRequests: requestMetrics.requests.filter((item) => item.status === 401 || item.status === 403).length, permissionChanges: securityEvents.filter((row) => ['PERMISSION_CHANGED', 'ROLE_CHANGED'].includes(row.action)).length, events: securityEvents },
    audit: { total: auditTotal, byAction: auditByAction.map((row) => ({ action: row.action, count: numberValue(row.count) })), trend: auditTrend, recent: recentActivity, today: auditTrend.find((row) => row.period === new Date().toISOString().slice(0, 10))?.count || 0, mostActiveUsers: activityByUser.map((row) => ({ userId: row.userId, name: userNames[row.userId] || 'System user', count: numberValue(row.count) })), modules: Object.entries(moduleCounts).map(([module, count]) => ({ module, count })) },
    notifications: { generated: notificationCount, unread: unreadNotifications, failedDeliveries },
  };
};

module.exports = { getAssetAnalytics, getSystemAnalytics, getDateRange, buildScope };
