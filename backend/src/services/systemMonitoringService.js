const os = require('os');
const fs = require('fs');
const path = require('path');
const { Op, fn, col } = require('sequelize');
const { sequelize, User, AuditLog, Notification, RFIDLog, SystemAlert } = require('../models');
const { getRequestMetrics } = require('../middleware/requestMetrics');

const backupDirectory = path.join(__dirname, '../../backups');
const safeDate = (value) => value ? new Date(value) : null;

const checkDatabase = async () => {
  const started = Date.now();
  try { await sequelize.authenticate(); return { status: 'operational', responseTime: Date.now() - started, checkedAt: new Date().toISOString() }; }
  catch { return { status: 'offline', responseTime: null, checkedAt: new Date().toISOString() }; }
};

const getResources = () => {
  const memory = process.memoryUsage();
  const totalMemory = os.totalmem();
  return {
    cpu: { available: false, usage: null, reason: 'CPU telemetry is not exposed reliably by this hosting environment', cores: os.cpus().length },
    memory: { available: true, used: memory.rss, heapUsed: memory.heapUsed, total: totalMemory, percentage: Number(((memory.rss / totalMemory) * 100).toFixed(2)) },
    disk: { available: false, usage: null, reason: 'Disk telemetry is not configured for this deployment' },
    uptime: { available: true, seconds: Math.floor(process.uptime()) },
  };
};

const getServices = async () => {
  const database = await checkDatabase();
  const [backupEntries, notificationCount, rfidCount] = await Promise.all([
    fs.promises.readdir(backupDirectory, { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile()).length).catch(() => 0),
    Notification.count().catch(() => null),
    RFIDLog.count().catch(() => null),
  ]);
  return [
    { service: 'Authentication Service', status: 'operational', responseTime: 0, reason: 'JWT authentication route is registered' },
    { service: 'Database Service', status: database.status, responseTime: database.responseTime },
    { service: 'Asset Management Service', status: database.status === 'operational' ? 'operational' : 'unknown', responseTime: database.responseTime },
    { service: 'Notification Service', status: notificationCount === null ? 'unknown' : 'operational', responseTime: null },
    { service: 'RFID Tracking Service', status: rfidCount === null ? 'unknown' : 'not_configured', responseTime: null, reason: 'Physical RFID reader telemetry is not configured' },
    { service: 'Backup Service', status: backupEntries > 0 ? 'operational' : 'not_configured', responseTime: null, reason: backupEntries > 0 ? undefined : 'No backup execution telemetry is configured' },
  ];
};

const getSecurity = async () => {
  const [failedLogins, lockedAccounts, securityAlerts, activeUsers] = await Promise.all([
    AuditLog.count({ where: { action: 'LOGIN_FAILED' } }),
    User.count({ where: { lockoutUntil: { [Op.gt]: new Date() } } }),
    AuditLog.count({ where: { action: { [Op.in]: ['LOGIN_FAILED', 'USER_LOCKED', 'PASSWORD_RESET'] } } }),
    User.count({ where: { active: true } }),
  ]);
  return { failedLogins, lockedAccounts, securityAlerts, activeUsers };
};

const getHistory = ({ from, to } = {}) => {
  const metrics = getRequestMetrics({ from: safeDate(from), to: safeDate(to) });
  const grouped = metrics.requests.reduce((result, item) => {
    const period = item.timestamp.toISOString().slice(0, 13);
    if (!result[period]) result[period] = { period, requests: 0, errors: 0, responseTime: 0 };
    result[period].requests += 1;
    if (item.status >= 400) result[period].errors += 1;
    result[period].responseTime += item.duration;
    return result;
  }, {});
  return Object.values(grouped).map((row) => ({ ...row, responseTime: Number((row.responseTime / row.requests).toFixed(2)) }));
};

const getOverview = async (query = {}) => {
  const [database, resources, services, security] = await Promise.all([checkDatabase(), Promise.resolve(getResources()), getServices(), getSecurity()]);
  const performance = getRequestMetrics({ from: new Date(Date.now() - 24 * 60 * 60 * 1000), to: new Date() });
  const criticalServicesDown = services.some((service) => ['offline', 'critical'].includes(service.status));
  const warningServices = services.some((service) => ['degraded', 'unknown'].includes(service.status));
  return { checkedAt: new Date().toISOString(), overall: { status: criticalServicesDown ? 'critical' : warningServices ? 'warning' : 'healthy', message: criticalServicesDown ? 'One or more critical services are offline.' : warningServices ? 'Some monitoring services are unavailable or not configured.' : 'All measured core services are operational.' }, health: { api: { status: 'operational', responseTime: performance.averageResponseTime, checkedAt: new Date().toISOString() }, database, server: { status: 'online', uptimeSeconds: process.uptime() }, responseTime: { value: performance.averageResponseTime, available: performance.collectedSamples > 0, sampleCount: performance.collectedSamples } }, resources, services, performance, security, history: getHistory(query) };
};

const getAlerts = async (where = {}) => SystemAlert.findAll({ where, order: [['createdAt', 'DESC']], limit: 100, raw: true });
const getActivity = async () => AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 50, attributes: ['id', 'userId', 'action', 'entity', 'createdAt'], raw: true });

module.exports = { checkDatabase, getResources, getServices, getSecurity, getHistory, getOverview, getAlerts, getActivity };
