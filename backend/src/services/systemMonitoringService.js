const os = require('os');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, User, AuditLog, Notification, RFIDLog, SystemAlert } = require('../models');
const { getRequestMetrics } = require('../middlewares/requestMetrics');

const backupDirectory = path.join(__dirname, '../../backups');
const normalizeStatus = (value) => {
  const status = String(value || 'unknown').toLowerCase();
  if (['healthy', 'operational', 'online', 'ok', 'connected', 'available'].includes(status)) return 'healthy';
  if (['warning', 'degraded', 'slow', 'limited'].includes(status)) return 'warning';
  if (['critical', 'offline', 'disconnected', 'failed', 'error'].includes(status)) return 'critical';
  if (['not_configured', 'not_available', 'unavailable', 'unknown'].includes(status)) return 'unknown';
  return 'unknown';
};

const rankStatus = (status) => {
  const values = { healthy: 0, warning: 1, degraded: 2, critical: 3, unknown: 4 };
  return values[normalizeStatus(status)] ?? 4;
};

const summarizeStatus = (statuses = []) => {
  if (!statuses.length) return 'unknown';
  const normalized = statuses.map((status) => normalizeStatus(status));
  let highest = 'healthy';
  let highestRank = -1;
  for (const status of normalized) {
    const rank = rankStatus(status);
    if (rank > highestRank) {
      highestRank = rank;
      highest = status;
    }
  }
  if (highest === 'unknown' && normalized.some((status) => status === 'critical')) return 'critical';
  if (highest === 'unknown' && normalized.some((status) => status === 'warning')) return 'warning';
  return highest;
};

const safeDate = (value) => (value ? new Date(value) : null);

const formatDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const getStorageSnapshot = () => {
  try {
    const stats = fs.statfsSync(process.cwd());
    const blockSize = stats.bsize || 4096;
    const totalBytes = Number(stats.blocks || 0) * blockSize;
    const availableBytes = Number(stats.bavail || 0) * blockSize;
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const percent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;
    return {
      available: true,
      total: totalBytes,
      used: usedBytes,
      availableBytes,
      usagePercent: percent,
      path: process.cwd(),
      status: percent >= 90 ? 'critical' : percent >= 75 ? 'warning' : 'healthy'
    };
  } catch (error) {
    return {
      available: false,
      total: null,
      used: null,
      availableBytes: null,
      usagePercent: null,
      path: process.cwd(),
      status: 'unknown',
      reason: 'Filesystem telemetry is not available in this environment.'
    };
  }
};

const getApplicationStatus = () => {
  const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));
  const startedAt = new Date(Date.now() - uptimeSeconds * 1000).toISOString();
  return {
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    platform: process.platform,
    uptimeSeconds,
    uptime: formatDuration(uptimeSeconds),
    startedAt,
    lastHealthCheck: new Date().toISOString(),
    processId: process.pid,
    nodeVersion: process.version,
    message: 'Application process is running normally.'
  };
};

const checkDatabase = async () => {
  const started = Date.now();
  const base = {
    status: 'unknown',
    connection: 'disconnected',
    databaseName: sequelize?.getDatabaseName ? sequelize.getDatabaseName() : process.env.DB_NAME || 'smart_asset_db',
    host: sequelize?.config?.host || process.env.DB_HOST || 'localhost',
    port: sequelize?.config?.port || Number(process.env.DB_PORT || 3306),
    responseTime: null,
    checkedAt: new Date().toISOString(),
    message: 'Database health check unavailable.'
  };

  try {
    await sequelize.authenticate();
    const responseTime = Date.now() - started;
    return {
      ...base,
      status: 'healthy',
      connection: 'connected',
      responseTime,
      checkedAt: new Date().toISOString(),
      message: 'Database connection is healthy.'
    };
  } catch (error) {
    return {
      ...base,
      status: 'critical',
      connection: 'disconnected',
      responseTime: null,
      checkedAt: new Date().toISOString(),
      message: error?.message || 'Unable to establish database connection.'
    };
  }
};

const getResources = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryPercentage = totalMemory > 0 ? Number(((usedMemory / totalMemory) * 100).toFixed(2)) : 0;
  const cpuLoad = os.loadavg && os.loadavg().length ? os.loadavg()[0] : 0;
  const cpuCores = os.cpus().length || 1;
  const cpuUsagePercent = cpuCores > 0 ? Number(Math.min(100, (cpuLoad / cpuCores) * 100).toFixed(2)) : 0;
  const storage = getStorageSnapshot();

  return {
    cpu: {
      available: true,
      usage: cpuUsagePercent,
      cores: cpuCores,
      loadAverage: os.loadavg ? os.loadavg() : [0, 0, 0],
      status: cpuUsagePercent >= 85 ? 'critical' : cpuUsagePercent >= 70 ? 'warning' : 'healthy',
    },
    memory: {
      available: true,
      systemUsed: usedMemory,
      systemFree: freeMemory,
      total: totalMemory,
      percentage: memoryPercentage,
      processUsage: process.memoryUsage(),
      status: memoryPercentage >= 85 ? 'critical' : memoryPercentage >= 70 ? 'warning' : 'healthy'
    },
    disk: storage,
    uptime: {
      available: true,
      seconds: Math.floor(process.uptime()),
      uptime: formatDuration(process.uptime()),
      status: 'healthy'
    }
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
    { service: 'Authentication Service', status: 'healthy', responseTime: 0, reason: 'JWT authentication route is registered' },
    { service: 'Database Service', status: database.status, responseTime: database.responseTime, reason: database.message },
    { service: 'Application Service', status: 'healthy', responseTime: 0, reason: 'Application process is running normally.' },
    { service: 'Notification Service', status: notificationCount === null ? 'unknown' : 'healthy', responseTime: null },
    { service: 'RFID Tracking Service', status: rfidCount === null ? 'unknown' : (rfidCount > 0 ? 'healthy' : 'not_configured'), responseTime: null, reason: rfidCount > 0 ? 'RFID telemetry is active.' : 'Physical RFID reader telemetry is not configured.' },
    { service: 'Backup Service', status: backupEntries > 0 ? 'healthy' : 'unknown', responseTime: null, reason: backupEntries > 0 ? 'Backup execution telemetry is available.' : 'No backup execution telemetry is configured.' },
  ];
};

const getSecurity = async () => {
  const [failedLogins, lockedAccounts, securityAlerts, activeUsers] = await Promise.all([
    AuditLog.count({ where: { action: 'LOGIN_FAILED' } }).catch(() => 0),
    User.count({ where: { lockoutUntil: { [Op.gt]: new Date() } } }).catch(() => 0),
    AuditLog.count({ where: { action: { [Op.in]: ['LOGIN_FAILED', 'USER_LOCKED', 'PASSWORD_RESET'] } } }).catch(() => 0),
    User.count({ where: { active: true } }).catch(() => 0),
  ]);
  return { failedLogins, lockedAccounts, securityAlerts, activeUsers };
};

const getHistory = ({ from, to } = {}) => {
  const metrics = getRequestMetrics({ from: safeDate(from), to: safeDate(to) });
  const grouped = metrics.requests.reduce((result, item) => {
    const period = new Date(item.timestamp).toISOString().slice(0, 13);
    if (!result[period]) result[period] = { period, requests: 0, errors: 0, responseTime: 0 };
    result[period].requests += 1;
    if (item.status >= 400) result[period].errors += 1;
    result[period].responseTime += item.duration;
    return result;
  }, {});

  return Object.values(grouped).map((row) => ({
    ...row,
    responseTime: row.requests ? Number((row.responseTime / row.requests).toFixed(2)) : 0,
  }));
};

const getOverview = async (query = {}) => {
  const application = getApplicationStatus();
  const database = await checkDatabase();
  const resources = getResources();
  const apiMetrics = getRequestMetrics({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const totalRequests = apiMetrics.collectedSamples || 0;
  const failedRequests = apiMetrics.failedRequests || 0;
  const errorRate = totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(2)) : null;

  const apiStatus = !apiMetrics.available || totalRequests === 0 ? 'unknown' : (errorRate !== null && errorRate >= 25 ? 'warning' : 'healthy');
  const storage = resources.disk && resources.disk.available ? {
    status: resources.disk.status,
    total: resources.disk.total,
    used: resources.disk.used,
    available: resources.disk.availableBytes,
    usagePercent: resources.disk.usagePercent,
    path: resources.disk.path,
    checkedAt: new Date().toISOString(),
  } : { status: 'unknown', total: null, used: null, available: null, usagePercent: null, path: process.cwd(), checkedAt: new Date().toISOString() };

  const server = {
    status: resources.cpu.status === 'critical' || resources.memory.status === 'critical' ? 'critical' : resources.cpu.status === 'warning' || resources.memory.status === 'warning' ? 'warning' : 'healthy',
    hostname: os.hostname(),
    operatingSystem: `${os.platform()} ${os.release()}`,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    uptime: formatDuration(process.uptime()),
    checkedAt: new Date().toISOString(),
    cpuUsage: resources.cpu.usage,
    memoryUsagePercent: resources.memory.percentage,
    storageUsagePercent: storage.usagePercent,
    message: 'Server runtime metrics are available.'
  };

  const api = {
    status: apiStatus,
    availability: totalRequests > 0 ? 'available' : 'not_available',
    responseTime: apiMetrics.averageResponseTime || null,
    requests: totalRequests,
    errors: failedRequests,
    successRate: totalRequests > 0 ? Number(((apiMetrics.successfulRequests / totalRequests) * 100).toFixed(2)) : null,
    errorRate,
    lastCheck: new Date().toISOString(),
    message: totalRequests > 0 ? 'API request metrics are available.' : 'API request telemetry is not available yet.'
  };

  const services = await getServices();
  const security = await getSecurity();
  const history = getHistory(query);
  const overallStatus = summarizeStatus([
    application.status,
    database.status,
    api.status,
    server.status,
    storage.status,
  ]);

  const overall = {
    status: overallStatus,
    message: overallStatus === 'critical'
      ? 'One or more core system components are unhealthy.'
      : overallStatus === 'warning'
        ? 'Some system components require attention.'
        : overallStatus === 'unknown'
          ? 'Monitoring data is incomplete or unavailable.'
          : 'All measured system components are operating normally.'
  };

  return {
    checkedAt: new Date().toISOString(),
    overall,
    application,
    database,
    api,
    server,
    storage,
    cpu: resources.cpu,
    memory: resources.memory,
    resources,
    services,
    performance: apiMetrics,
    security,
    history,
    health: {
      application,
      database,
      api,
      server,
      storage,
      responseTime: {
        value: apiMetrics.averageResponseTime || null,
        available: totalRequests > 0,
        sampleCount: totalRequests,
        checkedAt: new Date().toISOString(),
      }
    }
  };
};

const getAlerts = async (where = {}) => SystemAlert.findAll({ where, order: [['createdAt', 'DESC']], limit: 100, raw: true });
const getActivity = async () => AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 50, attributes: ['id', 'userId', 'action', 'entity', 'createdAt'], raw: true });

module.exports = { checkDatabase, getResources, getServices, getSecurity, getHistory, getOverview, getAlerts, getActivity };
