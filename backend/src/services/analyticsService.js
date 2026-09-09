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
  College,
  Department,
} = require('../models');

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
  const [auditTotal, auditByAction, auditTrend, loginCount, failedLoginCount, activeUsers, lockedUsers, totalUsers, userRoles, recentActivity, databaseStatus, backups] = await Promise.all([
    AuditLog.count({ where: auditWhere }),
    AuditLog.findAll({ where: auditWhere, attributes: ['action', [fn('COUNT', col('id')), 'count']], group: ['action'], order: [[literal('count'), 'DESC']], limit: 12, raw: true }),
    trend(AuditLog, auditWhere),
    AuditLog.count({ where: { ...auditWhere, action: 'LOGIN' } }),
    AuditLog.count({ where: { ...auditWhere, action: 'LOGIN_FAILED' } }),
    User.count({ where: { active: true } }),
    User.count({ where: { lockoutUntil: { [Op.gt]: new Date() } } }),
    User.count(),
    User.findAll({ attributes: ['role', [fn('COUNT', col('id')), 'count']], group: ['role'], order: [['role', 'ASC']], raw: true }),
    AuditLog.findAll({ where: auditWhere, attributes: ['id', 'userId', 'action', 'entity', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
    sequelize.authenticate().then(() => ({ status: 'connected', checkedAt: new Date().toISOString() })).catch(() => ({ status: 'unavailable', checkedAt: new Date().toISOString() })),
    fs.promises.readdir(backupDirectory, { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile() && backupFilePattern.test(entry.name)).map((entry) => entry.name).sort().reverse()).catch(() => []),
  ]);
  return {
    filters: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
    health: { api: { status: 'request_succeeded', checkedAt: new Date().toISOString() }, database: databaseStatus, backups: backups.length ? { status: 'available', count: backups.length, latest: backups[0] } : { status: 'not_available', count: 0, latest: null } },
    authentication: { successfulLogins: loginCount, failedLogins: failedLoginCount },
    users: { total: totalUsers, active: activeUsers, locked: lockedUsers, roles: userRoles.map((row) => ({ role: row.role, count: numberValue(row.count) })) },
    audit: { total: auditTotal, byAction: auditByAction.map((row) => ({ action: row.action, count: numberValue(row.count) })), trend: auditTrend, recent: recentActivity },
  };
};

module.exports = { getAssetAnalytics, getSystemAnalytics, getDateRange, buildScope };
