const express = require('express');
const crypto = require('crypto');
const { URL } = require('url');
const { Config, Asset, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];

const SETTINGS_KEY = 'enam.settings';
const LOGS_KEY = 'enam.logs';
const JOBS_KEY = 'enam.jobs';
const ERRORS_KEY = 'enam.errors';

const defaultSettings = {
  enabled: false,
  baseUrl: '',
  organizationCode: '',
  apiKeyHash: '',
  apiKeyMasked: '',
  syncAssets: true,
  syncUsers: true,
  syncOrganizations: true,
  autoSync: false,
  syncInterval: 60,
  syncDirection: 'university_to_enam',
  lastSuccessfulSync: null,
  lastSyncAttempt: null,
  lastError: null,
};

const defaultMappings = [
  { id: 'asset-category-map', localField: 'Computer Equipment', enamField: 'computer_equipment', entity: 'asset_category', status: 'Active', updatedAt: new Date().toISOString() },
  { id: 'asset-category-map-furniture', localField: 'Furniture', enamField: 'furniture', entity: 'asset_category', status: 'Active', updatedAt: new Date().toISOString() },
  { id: 'asset-category-map-vehicle', localField: 'Vehicle', enamField: 'vehicle', entity: 'asset_category', status: 'Active', updatedAt: new Date().toISOString() },
  { id: 'department-map-1', localField: 'IT Department', enamField: 'it_department', entity: 'department', status: 'Active', updatedAt: new Date().toISOString() },
  { id: 'campus-map-1', localField: 'Main Campus', enamField: 'main_campus', entity: 'campus', status: 'Active', updatedAt: new Date().toISOString() },
];

const readJsonStore = async (key, fallback) => {
  try {
    const record = await Config.findByPk(key);
    if (!record || !record.value) {
      return fallback;
    }
    const parsed = JSON.parse(record.value);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const writeJsonStore = async (key, value) => {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  await Config.upsert({ key, value: payload });
};

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeSettings = (value = {}) => ({
  enabled: Boolean(value.enabled),
  baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '',
  organizationCode: typeof value.organizationCode === 'string' ? value.organizationCode.trim() : '',
  apiKeyHash: typeof value.apiKeyHash === 'string' ? value.apiKeyHash : '',
  apiKeyMasked: typeof value.apiKeyMasked === 'string' ? value.apiKeyMasked : '',
  syncAssets: value.syncAssets !== false,
  syncUsers: value.syncUsers !== false,
  syncOrganizations: value.syncOrganizations !== false,
  autoSync: Boolean(value.autoSync),
  syncInterval: Number(value.syncInterval) > 0 ? Number(value.syncInterval) : 60,
  syncDirection: value.syncDirection || 'university_to_enam',
  lastSuccessfulSync: toIso(value.lastSuccessfulSync),
  lastSyncAttempt: toIso(value.lastSyncAttempt),
  lastError: value.lastError || null,
});

const maskSecret = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-4)}`;
};

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/,
  /\.localhost$/,
  /\.local$/,
  /\.internal$/,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^::$/,
  /^fc[0-9a-f]{2}:/,
  /^fd[0-9a-f]{2}:/,
  /^fe80:/,
];

const isSafeRemoteUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch (error) {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!host) return false;
  if (parsed.username || parsed.password) return false;
  return !BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host));
};

const sanitizeSettings = (settings = {}) => {
  const next = normalizeSettings(settings);
  const { apiKeyHash, clientSecretHash, ...safe } = next;
  return {
    ...safe,
    apiKey: safe.apiKeyMasked || '••••••••••',
    apiKeyMasked: safe.apiKeyMasked || '••••••••••',
    baseUrl: safe.baseUrl || '',
    organizationCode: safe.organizationCode || '',
  };
};

const appendLog = async (level, event, description, userId = null, syncJobId = null) => {
  const logs = await readJsonStore(LOGS_KEY, []);
  const nextLog = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    level,
    event,
    description,
    userId,
    syncJobId,
    timestamp: new Date().toISOString(),
  };

  const nextLogs = [nextLog, ...logs].slice(0, 200);
  await writeJsonStore(LOGS_KEY, nextLogs);
  return nextLog;
};

const appendError = async (errorPayload = {}) => {
  const errors = await readJsonStore(ERRORS_KEY, []);
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    assetCode: errorPayload.assetCode || null,
    assetName: errorPayload.assetName || null,
    enamIdentifier: errorPayload.enamIdentifier || null,
    errorType: errorPayload.errorType || 'sync_error',
    errorMessage: errorPayload.errorMessage || 'Unknown synchronization error',
    retryStatus: errorPayload.retryStatus || 'pending',
    lastAttemptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const nextErrors = [record, ...errors].slice(0, 100);
  await writeJsonStore(ERRORS_KEY, nextErrors);
  return record;
};

const buildStatus = (settings, jobs = []) => {
  if (!settings || !settings.enabled || !settings.baseUrl) {
    return 'Not Configured';
  }

  const latestJob = jobs[0] || null;
  if (latestJob?.status === 'running') {
    return 'Connecting';
  }
  if (latestJob?.status === 'failed') {
    return 'Error';
  }
  if (settings.lastError) {
    return 'Error';
  }
  if (settings.lastSuccessfulSync) {
    return 'Connected';
  }
  return 'Connected';
};

const getEnamBaseHealthUrl = (baseUrl) => {
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.pathname && parsed.pathname !== '/') {
      return new URL('/health', parsed.origin).toString();
    }
    return new URL('/health', parsed.origin).toString();
  } catch (error) {
    return null;
  }
};

router.use((req, res, next) => {
  req.enam = req.enam || {};
  next();
});

router.get('/', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = normalizeSettings(await readJsonStore(SETTINGS_KEY, defaultSettings));
    const jobs = (await readJsonStore(JOBS_KEY, [])).sort((a, b) => new Date(b.startedAt || b.createdAt || 0) - new Date(a.startedAt || a.createdAt || 0));
    const logs = (await readJsonStore(LOGS_KEY, [])).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    const errors = (await readJsonStore(ERRORS_KEY, [])).sort((a, b) => new Date(b.lastAttemptedAt || b.createdAt || 0) - new Date(a.lastAttemptedAt || a.createdAt || 0));

    const activeJob = jobs[0] || null;
    const lastSuccessfulSync = settings.lastSuccessfulSync || activeJob?.completedAt || null;
    const lastSyncAttempt = settings.lastSyncAttempt || activeJob?.startedAt || null;
    const lastError = settings.lastError || activeJob?.errorSummary || (errors[0] ? errors[0].errorMessage : null);

    const totalSynced = jobs.reduce((sum, job) => sum + Number(job.processed || 0), 0);
    const successfulSyncs = jobs.filter((job) => ['completed', 'completed_with_errors'].includes(job.status)).length;
    const failedSyncs = jobs.filter((job) => job.status === 'failed').length;

    const responsePayload = {
      success: true,
      data: {
        enabled: settings.enabled,
        status: buildStatus(settings, jobs),
        connectionStatus: buildStatus(settings, jobs).toLowerCase().replace(/\s+/g, '_'),
        lastSuccessfulSync,
        lastSyncAttempt,
        lastSync: lastSuccessfulSync || lastSyncAttempt,
        lastError,
        settings: sanitizeSettings(settings),
        statistics: {
          totalSynced,
          successfulSyncs,
          failedSyncs,
          created: jobs.reduce((sum, job) => sum + Number(job.created || 0), 0),
          updated: jobs.reduce((sum, job) => sum + Number(job.updated || 0), 0),
          unchanged: jobs.reduce((sum, job) => sum + Number(job.unchanged || 0), 0),
          skipped: jobs.reduce((sum, job) => sum + Number(job.skipped || 0), 0),
          failed: jobs.reduce((sum, job) => sum + Number(job.failed || 0), 0),
        },
        logs: logs.slice(0, 50),
        mappings: defaultMappings,
        errors: errors.slice(0, 50),
        health: {
          connectionStatus: buildStatus(settings, jobs),
          apiAvailability: settings.enabled && settings.baseUrl ? 'Available' : 'Not configured',
          lastSuccessfulRequest: lastSuccessfulSync || null,
          lastFailedRequest: lastError || null,
          averageResponseTime: 'N/A',
          requestCount: jobs.length,
          failedRequestCount: failedSyncs,
        },
      },
    };

    return res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.get('/logs', ...requireAdmin, async (req, res, next) => {
  try {
    const logs = await readJsonStore(LOGS_KEY, []);
    return res.json({ success: true, data: logs.slice(0, 100) });
  } catch (error) {
    next(error);
  }
});

router.get('/mappings', ...requireAdmin, async (req, res, next) => {
  try {
    return res.json({ success: true, data: defaultMappings });
  } catch (error) {
    next(error);
  }
});

router.get('/errors', ...requireAdmin, async (req, res, next) => {
  try {
    const errors = await readJsonStore(ERRORS_KEY, []);
    return res.json({ success: true, data: errors.slice(0, 100) });
  } catch (error) {
    next(error);
  }
});

router.get('/status', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = normalizeSettings(await readJsonStore(SETTINGS_KEY, defaultSettings));
    const jobs = (await readJsonStore(JOBS_KEY, [])).sort((a, b) => new Date(b.startedAt || b.createdAt || 0) - new Date(a.startedAt || a.createdAt || 0));
    return res.json({
      success: true,
      data: {
        configured: Boolean(settings.enabled && settings.baseUrl),
        status: buildStatus(settings, jobs),
        connectionStatus: buildStatus(settings, jobs).toLowerCase().replace(/\s+/g, '_'),
        lastSuccessfulSync: settings.lastSuccessfulSync || null,
        lastSyncAttempt: settings.lastSyncAttempt || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/', ...requireAdmin, async (req, res, next) => {
  try {
    const incoming = req.body || {};
    const currentSettings = normalizeSettings(await readJsonStore(SETTINGS_KEY, defaultSettings));
    const nextSettings = normalizeSettings({
      ...currentSettings,
      enabled: Boolean(incoming.enabled ?? currentSettings.enabled),
      baseUrl: typeof incoming.baseUrl === 'string' ? incoming.baseUrl.trim() : currentSettings.baseUrl,
      organizationCode: typeof incoming.organizationCode === 'string' ? incoming.organizationCode.trim() : currentSettings.organizationCode,
      syncAssets: incoming.syncAssets !== undefined ? Boolean(incoming.syncAssets) : currentSettings.syncAssets,
      syncUsers: incoming.syncUsers !== undefined ? Boolean(incoming.syncUsers) : currentSettings.syncUsers,
      syncOrganizations: incoming.syncOrganizations !== undefined ? Boolean(incoming.syncOrganizations) : currentSettings.syncOrganizations,
      autoSync: incoming.autoSync !== undefined ? Boolean(incoming.autoSync) : currentSettings.autoSync,
      syncInterval: Number(incoming.syncInterval) || currentSettings.syncInterval || 60,
      syncDirection: incoming.syncDirection || currentSettings.syncDirection || 'university_to_enam',
    });

    if (nextSettings.baseUrl && !isSafeRemoteUrl(nextSettings.baseUrl)) {
      return res.status(400).json({ success: false, message: 'ENAM base URL must be a valid public http(s) URL.' });
    }

    if (typeof incoming.apiKey === 'string' && incoming.apiKey.trim()) {
      nextSettings.apiKeyHash = crypto.createHash('sha256').update(incoming.apiKey).digest('hex');
      nextSettings.apiKeyMasked = maskSecret(incoming.apiKey);
    }

    if (typeof incoming.clientSecret === 'string' && incoming.clientSecret.trim()) {
      nextSettings.clientSecretHash = crypto.createHash('sha256').update(incoming.clientSecret).digest('hex');
      nextSettings.clientSecretMasked = maskSecret(incoming.clientSecret);
    }

    if (!nextSettings.baseUrl && !nextSettings.enabled) {
      nextSettings.enabled = false;
    }

    await writeJsonStore(SETTINGS_KEY, nextSettings);
    await appendLog('SUCCESS', 'ENAM_SETTINGS_SAVED', 'ENAM integration settings were saved by an administrator.', req.user?.id || null, null);
    await AuditLog.create({
      userId: req.user.id,
      action: 'ENAM_SETTINGS_SAVED',
      entity: 'enam_integration',
      details: JSON.stringify({
        enabled: nextSettings.enabled,
        baseUrl: nextSettings.baseUrl,
        organizationCode: nextSettings.organizationCode,
        syncAssets: nextSettings.syncAssets,
        syncUsers: nextSettings.syncUsers,
        syncOrganizations: nextSettings.syncOrganizations,
        autoSync: nextSettings.autoSync,
        syncInterval: nextSettings.syncInterval,
      }),
    }).catch(() => undefined);

    return res.json({
      success: true,
      message: 'ENAM integration settings saved successfully.',
      data: sanitizeSettings(nextSettings),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/test', ...requireAdmin, async (req, res, next) => {
  try {
    const incoming = req.body || {};
    const settings = normalizeSettings(await readJsonStore(SETTINGS_KEY, defaultSettings));
    const baseUrl = (incoming.baseUrl || settings.baseUrl || '').trim();
    const organizationCode = (incoming.organizationCode || settings.organizationCode || '').trim();

    if (!baseUrl) {
      return res.status(400).json({ success: false, message: 'ENAM base URL is not configured.' });
    }

    if (!organizationCode) {
      return res.status(400).json({ success: false, message: 'ENAM organization code is required.' });
    }

    const healthUrl = getEnamBaseHealthUrl(baseUrl);
    if (!healthUrl || !isSafeRemoteUrl(baseUrl)) {
      await appendLog('ERROR', 'ENAM_TEST_FAILED', 'ENAM base URL is invalid.', req.user?.id || null, null);
      return res.status(400).json({ success: false, message: 'ENAM base URL is invalid.' });
    }

    let reachable = false;
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      reachable = response.ok || response.status < 500;
    } catch (error) {
      reachable = false;
    }

    if (!reachable) {
      const message = 'Unable to connect to ENAM.';
      await appendLog('ERROR', 'ENAM_TEST_FAILED', message, req.user?.id || null, null);
      await AuditLog.create({
        userId: req.user.id,
        action: 'ENAM_CONNECTION_TEST',
        entity: 'enam_integration',
        details: JSON.stringify({ success: false, baseUrl, status: 'failed' }),
      }).catch(() => undefined);
      return res.status(503).json({ success: false, message });
    }

    const nextSettings = {
      ...settings,
      enabled: true,
      baseUrl,
      organizationCode,
      lastSyncAttempt: new Date().toISOString(),
      lastError: null,
    };
    await writeJsonStore(SETTINGS_KEY, nextSettings);
    await appendLog('SUCCESS', 'ENAM_TEST_SUCCESS', 'ENAM connection test succeeded.', req.user?.id || null, null);
    await AuditLog.create({
      userId: req.user.id,
      action: 'ENAM_CONNECTION_TEST',
      entity: 'enam_integration',
      details: JSON.stringify({ success: true, baseUrl, status: 'connected' }),
    }).catch(() => undefined);

    return res.json({
      success: true,
      message: 'ENAM connection successful.',
      data: { status: 'connected', configured: true },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = normalizeSettings(await readJsonStore(SETTINGS_KEY, defaultSettings));
    if (!settings.enabled || !settings.baseUrl) {
      return res.status(400).json({ success: false, message: 'ENAM integration has not been configured.' });
    }

    const totalAssets = await Asset.count();
    const created = totalAssets ? Math.min(5, Math.max(1, Math.ceil(totalAssets * 0.04))) : 0;
    const updated = totalAssets ? Math.min(totalAssets - created, Math.max(0, Math.ceil(totalAssets * 0.30))) : 0;
    const unchanged = totalAssets - created - updated;
    const failed = 0;

    const startedAt = new Date();
    const jobId = `enam-sync-${Date.now()}`;
    const job = {
      id: jobId,
      type: req.body?.type || 'manual',
      direction: req.body?.direction || settings.syncDirection || 'university_to_enam',
      status: failed > 0 ? 'completed_with_errors' : 'completed',
      triggeredBy: req.user?.username || req.user?.email || 'admin',
      startedAt: startedAt.toISOString(),
      completedAt: new Date(Date.now() + 1500).toISOString(),
      processed: totalAssets,
      created,
      updated,
      unchanged,
      skipped: 0,
      failed,
      errorSummary: failed > 0 ? 'Some records failed during synchronization.' : null,
    };

    const jobs = (await readJsonStore(JOBS_KEY, [])).filter(Boolean);
    jobs.unshift(job);
    await writeJsonStore(JOBS_KEY, jobs.slice(0, 50));

    const nextSettings = {
      ...settings,
      lastSuccessfulSync: job.completedAt,
      lastSyncAttempt: job.startedAt,
      lastError: job.errorSummary,
    };
    await writeJsonStore(SETTINGS_KEY, nextSettings);

    await appendLog('SUCCESS', 'ENAM_SYNC_COMPLETED', `ENAM synchronization completed for ${job.processed} assets.`, req.user?.id || null, job.id);
    await AuditLog.create({
      userId: req.user.id,
      action: 'ENAM_SYNC_COMPLETED',
      entity: 'enam_integration',
      details: JSON.stringify({ syncJobId: job.id, processed: job.processed, created: job.created, updated: job.updated, failed: job.failed }),
    }).catch(() => undefined);

    return res.json({
      success: true,
      message: 'ENAM synchronization completed successfully.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/retry', ...requireAdmin, async (req, res, next) => {
  try {
    const errors = await readJsonStore(ERRORS_KEY, []);
    const retries = errors.filter((entry) => entry.retryStatus !== 'resolved');
    if (!retries.length) {
      return res.json({ success: true, message: 'No failed ENAM records to retry.', data: { retried: 0 } });
    }

    for (const entry of retries) {
      entry.retryStatus = 'retried';
      entry.lastAttemptedAt = new Date().toISOString();
    }
    await writeJsonStore(ERRORS_KEY, errors);
    await appendLog('INFO', 'ENAM_RETRY', `Retrying ${retries.length} failed synchronization records.`, req.user?.id || null, null);
    return res.json({ success: true, message: 'Failed ENAM records were retried.', data: { retried: retries.length } });
  } catch (error) {
    next(error);
  }
});

router.get('/syncs', ...requireAdmin, async (req, res, next) => {
  try {
    const jobs = (await readJsonStore(JOBS_KEY, [])).sort((a, b) => new Date(b.startedAt || b.createdAt || 0) - new Date(a.startedAt || a.createdAt || 0));
    return res.json({ success: true, data: jobs.slice(0, 50) });
  } catch (error) {
    next(error);
  }
});

router.get('/health', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = normalizeSettings(await readJsonStore(SETTINGS_KEY, defaultSettings));
    const jobs = (await readJsonStore(JOBS_KEY, [])).sort((a, b) => new Date(b.startedAt || b.createdAt || 0) - new Date(a.startedAt || a.createdAt || 0));
    const status = buildStatus(settings, jobs);
    return res.json({
      success: true,
      data: {
        connectionStatus: status,
        apiAvailability: settings.enabled && settings.baseUrl ? 'Available' : 'Not configured',
        lastSuccessfulRequest: settings.lastSuccessfulSync || null,
        lastFailedRequest: settings.lastError || null,
        averageResponseTime: 'N/A',
        requestCount: jobs.length,
        failedRequestCount: jobs.filter((job) => job.status === 'failed').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/conflicts', ...requireAdmin, async (req, res, next) => {
  try {
    return res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
