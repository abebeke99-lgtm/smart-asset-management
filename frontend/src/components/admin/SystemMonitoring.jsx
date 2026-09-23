import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Download,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  ShieldAlert,
  Wifi,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

const empty = {
  overall: {},
  application: {},
  database: {},
  api: {},
  server: {},
  storage: {},
  cpu: {},
  memory: {},
  resources: {},
  services: [],
  history: [],
  performance: {},
  security: {},
  alerts: [],
  activity: [],
};

const normalizeStatus = (value) => {
  const status = String(value || 'unknown').toLowerCase();
  if (['healthy', 'operational', 'online', 'ok', 'connected', 'available'].includes(status)) return 'healthy';
  if (['warning', 'degraded', 'slow', 'limited'].includes(status)) return 'warning';
  if (['critical', 'offline', 'disconnected', 'failed', 'error'].includes(status)) {
    return 'critical';
  }
  return 'unknown';
};

const getStatusConfig = (value) => {
  const status = normalizeStatus(value);
  const palette = {
    healthy: { icon: CheckCircle2, color: '#16a34a', label: 'Healthy' },
    warning: { icon: AlertTriangle, color: '#d97706', label: 'Warning' },
    critical: { icon: XCircle, color: '#dc2626', label: 'Critical' },
    unknown: { icon: AlertTriangle, color: '#64748b', label: 'Unknown' },
  };
  return palette[status] || palette.unknown;
};

const formatValue = (value, fallback = 'Not available') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : fallback;
  }
  return value;
};

const formatMetric = (value, unit) => {
  const formatted = formatValue(value);
  return formatted === 'Not available' ? formatted : `${formatted}${unit}`;
};

const formatTimestamp = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(Number(seconds))) return 'Not available';
  const total = Math.max(0, Number(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = Math.floor(total % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remaining}s`;
  return `${remaining}s`;
};

const MetricTile = ({ label, value, icon: Icon, status }) => {
  const config = getStatusConfig(status || value);
  return (
    <div className="admin-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={18} color={config.color} />
          <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{label}</strong>
        </div>
        <span style={{ color: config.color, fontSize: '0.72rem', fontWeight: 700 }}>{config.label}</span>
      </div>
      <div style={{ color: '#1e293b', fontWeight: 700, fontSize: '1.1rem' }}>{formatValue(value, 'Not available')}</div>
    </div>
  );
};

const SystemMonitoring = () => {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [lastChecked, setLastChecked] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, alerts, activity] = await Promise.all([
        apiClient.get('/api/admin/monitoring/overview'),
        apiClient.get('/api/admin/monitoring/alerts'),
        apiClient.get('/api/admin/monitoring/activity'),
      ]);
      setData({
        ...(overview.data?.data || {}),
        alerts: alerts.data?.data || [],
        activity: activity.data?.data || [],
      });
      setLastChecked(new Date());
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(status === 403 ? 'Access denied. Admin monitoring is required.' : status === 401 ? 'Authentication required. Please sign in again.' : 'Unable to retrieve system monitoring data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!refreshInterval) return undefined;
    const timer = setInterval(() => { load(); }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, load]);

  const history = useMemo(() => (Array.isArray(data.history) ? data.history : []), [data.history]);
  const overallStatus = data.overall?.status || 'unknown';
  const overallConfig = getStatusConfig(overallStatus);
  const systemStatus = getStatusConfig(data.application?.status || data.database?.status || overallStatus);

  const exportStatus = async () => {
    try {
      const response = await apiClient.get('/api/admin/monitoring/export', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'system-monitoring.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Unable to export monitoring status');
    }
  };

  if (loading && !lastChecked) {
    return (
      <section className="admin-workspace-page">
        <div className="admin-card admin-empty-state">
          <RefreshCw size={20} className="spin" /> Checking system health...
        </div>
      </section>
    );
  }

  return (
    <section className="admin-workspace-page" aria-labelledby="monitoring-title">
      <div className="admin-page-header">
        <div>
          <div className="admin-breadcrumb"><Activity size={16} /> System / Administration / System Monitoring</div>
          <h1 id="monitoring-title" className="admin-page-title">System Monitoring</h1>
          <p className="admin-page-subtitle">Monitor application availability, database health, API performance, server resources and system errors.</p>
          <small>Last checked: {lastChecked ? lastChecked.toLocaleString() : 'Not available'}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="admin-select" value={refreshInterval} onChange={(event) => setRefreshInterval(Number(event.target.value))}>
            <option value={0}>Manual</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>60 seconds</option>
          </select>
          <button className="admin-secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          <button className="admin-primary-button" onClick={exportStatus}><Download size={16} /> Export</button>
        </div>
      </div>

      {error && (
        <div className="admin-error-state" role="alert">
          <span>{error}</span>
          <button className="admin-secondary-button" onClick={load}>Retry</button>
        </div>
      )}

      <div className="admin-card" style={{ borderLeft: `5px solid ${overallConfig.color}`, marginBottom: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <overallConfig.icon size={20} color={overallConfig.color} />
          <div>
            <div style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '0.72rem' }}>System Health</div>
            <strong style={{ color: overallConfig.color, fontSize: '1.4rem' }}>{overallConfig.label}</strong>
          </div>
        </div>
        <p style={{ color: '#475569', marginTop: 10, marginBottom: 0 }}>
          {data.overall?.message || 'Health status is unavailable.'}
        </p>
        <small style={{ color: '#64748b', display: 'block', marginTop: 8 }}>Last checked: {formatTimestamp(data.checkedAt)}</small>
      </div>

      <div className="admin-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricTile label="Application" value={data.application?.status || 'unknown'} icon={Activity} status={data.application?.status} />
        <MetricTile label="Database" value={data.database?.status || 'unknown'} icon={Database} status={data.database?.status} />
        <MetricTile label="API" value={data.api?.status || 'unknown'} icon={Wifi} status={data.api?.status} />
        <MetricTile label="Server" value={data.server?.status || 'unknown'} icon={Server} status={data.server?.status} />
        <MetricTile label="Storage" value={data.storage?.status || 'unknown'} icon={HardDrive} status={data.storage?.status} />
      </div>

      <div className="admin-card" style={{ padding: 18, marginBottom: 22 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>System component status</h3>
        <div className="admin-health-grid">
          <div><Activity size={18} color={systemStatus.color} /><strong>Application</strong><span>{data.application?.status || 'Unknown'} · {formatTimestamp(data.application?.lastHealthCheck)}</span></div>
          <div><Database size={18} color={getStatusConfig(data.database?.status).color} /><strong>Database</strong><span>{data.database?.status || 'Unknown'} · {formatTimestamp(data.database?.checkedAt)}</span></div>
          <div><Wifi size={18} color={getStatusConfig(data.api?.status).color} /><strong>API</strong><span>{data.api?.status || 'Unknown'} · {formatTimestamp(data.api?.lastCheck)}</span></div>
          <div><Server size={18} color={getStatusConfig(data.server?.status).color} /><strong>Server</strong><span>{data.server?.status || 'Unknown'} · {formatTimestamp(data.server?.checkedAt)}</span></div>
          <div><HardDrive size={18} color={getStatusConfig(data.storage?.status).color} /><strong>Storage</strong><span>{data.storage?.status || 'Unknown'} · {formatTimestamp(data.storage?.checkedAt)}</span></div>
        </div>
      </div>

      <div className="admin-grid-two" style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 22 }}>
        <div className="admin-card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Application status</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><strong>Status:</strong> {data.application?.status || 'Unknown'}</div>
            <div><strong>Version:</strong> {formatValue(data.application?.version, 'Not available')}</div>
            <div><strong>Environment:</strong> {formatValue(data.application?.environment, 'Not available')}</div>
            <div><strong>Uptime:</strong> {data.application?.uptime || 'Not available'}</div>
            <div><strong>Started At:</strong> {formatTimestamp(data.application?.startedAt)}</div>
            <div><strong>Last Health Check:</strong> {formatTimestamp(data.application?.lastHealthCheck)}</div>
          </div>
        </div>

        <div className="admin-card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Database status</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><strong>Connection:</strong> {data.database?.connection || 'Unknown'}</div>
            <div><strong>Database Name:</strong> {data.database?.databaseName || 'Not available'}</div>
            <div><strong>Host:</strong> {data.database?.host || 'Not available'}</div>
            <div><strong>Port:</strong> {data.database?.port || 'Not available'}</div>
            <div><strong>Response Time:</strong> {formatMetric(data.database?.responseTime, ' ms')}</div>
            <div><strong>Last Check:</strong> {formatTimestamp(data.database?.checkedAt)}</div>
          </div>
        </div>

        <div className="admin-card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>API status</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><strong>Availability:</strong> {data.api?.availability || 'Not available'}</div>
            <div><strong>Response Time:</strong> {formatMetric(data.api?.responseTime, ' ms')}</div>
            <div><strong>Requests:</strong> {formatValue(data.api?.requests, 'Not available')}</div>
            <div><strong>Errors:</strong> {formatValue(data.api?.errors, 'Not available')}</div>
            <div><strong>Success Rate:</strong> {data.api?.successRate !== null && data.api?.successRate !== undefined ? `${data.api.successRate}%` : 'Not available'}</div>
            <div><strong>Error Rate:</strong> {data.api?.errorRate !== null && data.api?.errorRate !== undefined ? `${data.api.errorRate}%` : 'Not available'}</div>
          </div>
        </div>

        <div className="admin-card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Server status</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><strong>Hostname:</strong> {data.server?.hostname || 'Not available'}</div>
            <div><strong>Operating System:</strong> {data.server?.operatingSystem || 'Not available'}</div>
            <div><strong>Node.js Version:</strong> {data.server?.nodeVersion || 'Not available'}</div>
            <div><strong>Server Uptime:</strong> {data.server?.uptime || 'Not available'}</div>
            <div><strong>CPU Usage:</strong> {data.cpu?.usage !== undefined && data.cpu?.usage !== null ? `${data.cpu.usage}%` : 'Not available'}</div>
            <div><strong>Memory Usage:</strong> {data.memory?.percentage !== undefined && data.memory?.percentage !== null ? `${data.memory.percentage}%` : 'Not available'}</div>
          </div>
        </div>
      </div>

      <div className="admin-grid-two" style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 22 }}>
        <div className="admin-card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>CPU and memory</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><Cpu size={16} /> CPU</span><strong>{data.cpu?.usage !== undefined && data.cpu?.usage !== null ? `${data.cpu.usage}%` : 'Not available'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><MemoryStick size={16} /> Process memory</span><strong>{data.memory?.processUsage ? `${Math.round((data.memory.processUsage.rss || 0) / 1024 / 1024)} MB` : 'Not available'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><MemoryStick size={16} /> System memory</span><strong>{data.memory?.percentage !== undefined && data.memory?.percentage !== null ? `${data.memory.percentage}%` : 'Not available'}</strong></div>
          </div>
        </div>

        <div className="admin-card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Storage</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><strong>Total:</strong> {data.storage?.total !== null && data.storage?.total !== undefined ? `${(data.storage.total / 1024 / 1024 / 1024).toFixed(2)} GB` : 'Not available'}</div>
            <div><strong>Used:</strong> {data.storage?.used !== null && data.storage?.used !== undefined ? `${(data.storage.used / 1024 / 1024 / 1024).toFixed(2)} GB` : 'Not available'}</div>
            <div><strong>Available:</strong> {data.storage?.available !== null && data.storage?.available !== undefined ? `${(data.storage.available / 1024 / 1024 / 1024).toFixed(2)} GB` : 'Not available'}</div>
            <div><strong>Usage %:</strong> {formatMetric(data.storage?.usagePercent, '%')}</div>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ padding: 18, marginBottom: 22 }}>
        <h3 style={{ marginTop: 0 }}>Recent error activity</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.isArray(data.activity) && data.activity.length > 0 ? data.activity.slice(0, 5).map((item) => (
            <div key={item.id || item.entity} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong>{item.action || 'Activity'}</strong>
                <span style={{ color: '#64748b' }}>{formatTimestamp(item.createdAt)}</span>
              </div>
              <div style={{ color: '#475569', marginTop: 4 }}>{item.entity || 'No entity attached'}</div>
            </div>
          )) : <div style={{ color: '#64748b' }}>No recent activity available.</div>}
        </div>
      </div>

      <div className="admin-card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>System health trend</h3>
        {history.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {history.slice(-6).map((row) => (
              <div key={row.period} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 8, borderBottom: '1px solid #e2e8f0' }}>
                <span>{row.period}</span>
                <span>Requests: {row.requests || 0}</span>
                <span>Errors: {row.errors || 0}</span>
                <span>Avg: {formatMetric(row.responseTime, ' ms')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>Historical monitoring data is not available.</div>
        )}
      </div>
    </section>
  );
};

export default SystemMonitoring;
