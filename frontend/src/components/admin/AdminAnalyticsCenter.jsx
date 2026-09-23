import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  HardDrive,
  LogIn,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../utils/api';

ChartJS.register(BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip);

const navy = '#1A237E';
const blue = '#2563EB';
const green = '#16A34A';
const purple = '#7C3AED';
const orange = '#D97706';
const red = '#DC2626';
const gray = '#64748B';
const cyan = '#0EA5E9';

const initialFilters = {
  dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  dateTo: new Date().toISOString().slice(0, 10),
  action: '',
  userId: '',
};

const emptySystemData = {
  health: {},
  users: { roles: [] },
  authentication: {},
  api: {},
  database: {},
  storage: {},
  errors: {},
  security: {},
  audit: { trend: [], recent: [], byAction: [], modules: [] },
  notifications: {},
};

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Not available';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatDate = (value) => {
  if (!value) return 'Not available';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Not available';
  }
};

const toneForStatus = (value) => {
  const status = String(value || '').toLowerCase();
  if (['connected', 'operational', 'healthy', 'ok', 'success', 'available', 'active'].includes(status)) return green;
  if (['warning', 'degraded', 'partial', 'pending', 'unknown'].includes(status)) return orange;
  if (['offline', 'failed', 'critical', 'error', 'unavailable', 'blocked', 'inactive'].includes(status)) return red;
  return gray;
};

const StatusBadge = ({ label, tone = gray }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    color: tone,
    background: `${tone}1A`,
    border: `1px solid ${tone}33`,
  }}>
    {label}
  </span>
);

const KpiCard = ({ label, value, icon: Icon, tone = blue }) => (
  <div className="admin-card" style={{ minHeight: 118, borderTop: `3px solid ${tone}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: gray, fontSize: '0.78rem', fontWeight: 700 }}>{label}</span>
      <Icon size={18} color={tone} aria-hidden="true" />
    </div>
    <strong style={{ display: 'block', marginTop: 12, color: navy, fontSize: '1.6rem', lineHeight: 1.2 }}>{value}</strong>
  </div>
);

const ChartCard = ({ title, subtitle, children, empty }) => (
  <div className="admin-card" style={{ minHeight: 300 }}>
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, color: navy, fontSize: '1rem' }}>{title}</h2>
      {subtitle && <small style={{ color: gray }}>{subtitle}</small>}
    </div>
    {empty ? <div className="admin-empty-state">No system data available for the selected period.</div> : children}
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: `${blue}16`, color: blue }}>
      <Icon size={16} aria-hidden="true" />
    </div>
    <div>
      <h2 style={{ margin: 0, color: navy, fontSize: '1.05rem' }}>{title}</h2>
      {subtitle && <small style={{ color: gray }}>{subtitle}</small>}
    </div>
  </div>
);

const AdminAnalyticsCenter = ({ system = false }) => {
  const [filters, setFilters] = useState(initialFilters);
  const [systemData, setSystemData] = useState(emptySystemData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const query = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), [filters]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/admin/analytics/system', { params: query });
      const payload = response?.data?.data || {};
      setSystemData(payload);
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || 'Unable to load system analytics.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const auditTrend = systemData.audit?.trend || [];
  const roleBreakdown = systemData.users?.roles || [];
  const actionBreakdown = systemData.audit?.byAction || [];
  const recentAudit = systemData.audit?.recent || [];
  const recentSecurity = systemData.security?.events || [];
  const recentErrors = systemData.errors?.recent || [];
  const moduleActivity = systemData.audit?.modules || [];

  const auditChart = {
    labels: auditTrend.map((row) => row.period || 'Unknown'),
    datasets: [{
      label: 'Audit events',
      data: auditTrend.map((row) => Number(row.count || 0)),
      borderColor: blue,
      backgroundColor: 'rgba(37, 99, 235, 0.12)',
      fill: true,
      tension: 0.35,
    }],
  };

  const roleChart = {
    labels: roleBreakdown.map((row) => row.role || 'Unknown'),
    datasets: [{
      label: 'Users',
      data: roleBreakdown.map((row) => Number(row.count || 0)),
      backgroundColor: [blue, green, purple, orange, red, cyan, gray],
      borderRadius: 6,
    }],
  };

  const actionChart = {
    labels: actionBreakdown.map((row) => row.action || 'Unknown'),
    datasets: [{
      label: 'Events',
      data: actionBreakdown.map((row) => Number(row.count || 0)),
      backgroundColor: [blue, green, purple, orange, red, cyan, gray],
      borderRadius: 6,
    }],
  };

  const moduleChart = {
    labels: moduleActivity.map((row) => row.module || 'System'),
    datasets: [{
      label: 'Activity',
      data: moduleActivity.map((row) => Number(row.count || 0)),
      backgroundColor: [blue, green, purple, orange, red, cyan, gray],
      borderRadius: 6,
    }],
  };

  const healthCards = [
    { label: 'API', state: systemData.health?.api?.status || 'Not available', icon: Server, tone: toneForStatus(systemData.health?.api?.status) },
    { label: 'Database', state: systemData.health?.database?.status || 'Not available', icon: Database, tone: toneForStatus(systemData.health?.database?.status) },
    { label: 'Backups', state: systemData.health?.backups?.status || 'Not available', icon: ClipboardList, tone: toneForStatus(systemData.health?.backups?.status) },
    { label: 'Storage', state: systemData.storage?.available === true ? 'Available' : systemData.storage?.available === false ? 'Unavailable' : 'Not available', icon: HardDrive, tone: toneForStatus(systemData.storage?.available === true ? 'available' : systemData.storage?.available === false ? 'unavailable' : 'not available') },
  ];

  return (
    <section className="admin-workspace-page" aria-labelledby="system-analytics-title">
      <div className="admin-page-header" style={{ marginBottom: 18 }}>
        <div>
          <div className="admin-breadcrumb"><BarChart3 size={16} /> Admin / System Analytics</div>
          <h1 id="system-analytics-title" className="admin-page-title">System Analytics</h1>
          <p className="admin-page-subtitle">Monitor system usage, health, security, API status, storage, audit activity, and notifications using live platform data.</p>
          <small style={{ color: gray }}>Last updated: {lastUpdated ? formatDate(lastUpdated) : 'Not available'}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="admin-form-field" style={{ marginBottom: 0, minWidth: 160 }}>
            Date from
            <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
          </label>
          <label className="admin-form-field" style={{ marginBottom: 0, minWidth: 160 }}>
            Date to
            <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
          </label>
          <button className="admin-secondary-button" onClick={fetchData} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {error && (
        <div className="admin-error-state" role="alert" style={{ marginBottom: 18 }}>
          <XCircle size={18} /> {error}
          <button className="admin-secondary-button" onClick={fetchData} style={{ marginLeft: 12 }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="admin-card admin-empty-state"><RefreshCw size={18} /> Loading system analytics...</div>
      ) : (
        <>
          <div className="admin-card" style={{ marginBottom: 18 }}>
            <SectionTitle icon={Activity} title="System health" subtitle="Current platform availability" />
            <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {healthCards.map((item) => (
                <div key={item.label} className="admin-card" style={{ minHeight: 128, borderTop: `3px solid ${item.tone}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: gray, fontSize: '0.78rem', fontWeight: 700 }}>{item.label}</span>
                    <item.icon size={18} color={item.tone} aria-hidden="true" />
                  </div>
                  <div style={{ marginTop: 12 }}><StatusBadge label={item.state} tone={item.tone} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-kpi-grid" style={{ marginBottom: 18 }}>
            <KpiCard label="Total users" value={formatNumber(systemData.users?.total)} icon={Users} tone={navy} />
            <KpiCard label="Active users" value={formatNumber(systemData.users?.active)} icon={CheckCircle2} tone={green} />
            <KpiCard label="Failed logins" value={formatNumber(systemData.authentication?.failedLogins)} icon={ShieldCheck} tone={red} />
            <KpiCard label="Audit events" value={formatNumber(systemData.audit?.total)} icon={ClipboardList} tone={purple} />
          </div>

          <div className="admin-analytics-grid">
            <ChartCard title="System activity over time" subtitle="Audit events for the selected period" empty={!auditTrend.length}>
              <div style={{ height: 220 }}>
                <Line data={auditChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }} />
              </div>
            </ChartCard>
            <ChartCard title="Users by role" subtitle="Current user distribution" empty={!roleBreakdown.length}>
              <div style={{ height: 220 }}>
                <Bar data={roleChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </ChartCard>
          </div>

          <div className="admin-analytics-grid">
            <div className="admin-card">
              <SectionTitle icon={LogIn} title="Authentication" subtitle="Actual login and access events recorded by the system" />
              <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 12 }}>
                <KpiCard label="Successful logins" value={formatNumber(systemData.authentication?.successfulLogins)} icon={CheckCircle2} tone={green} />
                <KpiCard label="Failed logins" value={formatNumber(systemData.authentication?.failedLogins)} icon={AlertTriangle} tone={red} />
                <KpiCard label="Login attempts" value={formatNumber(systemData.authentication?.loginAttempts)} icon={LogIn} tone={blue} />
                <KpiCard label="Unique active users" value={formatNumber(systemData.authentication?.uniqueActiveUsers)} icon={Users} tone={purple} />
              </div>
            </div>

            <div className="admin-card">
              <SectionTitle icon={Server} title="API performance" subtitle="Request telemetry recorded by the backend" />
              <div style={{ display: 'grid', gap: 10 }}>
                <div><strong>Available:</strong> {systemData.api?.available === true ? 'Yes' : systemData.api?.available === false ? 'No' : 'Not available'}</div>
                <div><strong>Request count:</strong> {formatNumber(systemData.api?.requestCount)}</div>
                <div><strong>Successful requests:</strong> {formatNumber(systemData.api?.successfulRequests)}</div>
                <div><strong>Failed requests:</strong> {formatNumber(systemData.api?.failedRequests)}</div>
                <div><strong>Average response time:</strong> {systemData.api?.averageResponseTime !== null && systemData.api?.averageResponseTime !== undefined ? `${Number(systemData.api.averageResponseTime).toFixed(2)} ms` : 'Not available'}</div>
              </div>
            </div>
          </div>

          <div className="admin-analytics-grid">
            <div className="admin-card">
              <SectionTitle icon={HardDrive} title="Storage" subtitle="Uploaded file storage usage from the backend" />
              <div style={{ display: 'grid', gap: 10 }}>
                <div><strong>Available:</strong> {systemData.storage?.available === true ? 'Yes' : systemData.storage?.available === false ? 'No' : 'Not available'}</div>
                <div><strong>Uploaded files:</strong> {formatNumber(systemData.storage?.uploadedFiles)}</div>
                <div><strong>Used storage:</strong> {systemData.storage?.usedBytes !== null && systemData.storage?.usedBytes !== undefined ? `${formatNumber(systemData.storage.usedBytes)} bytes` : 'Not available'}</div>
                <div><strong>Notes:</strong> {systemData.storage?.reason || 'Storage reporting is available when the backend can read the application uploads directory.'}</div>
              </div>
            </div>

            <div className="admin-card">
              <SectionTitle icon={AlertTriangle} title="System errors" subtitle="Recent request failures captured in request metrics" />
              <div style={{ display: 'grid', gap: 10 }}>
                <div><strong>Total failed requests:</strong> {formatNumber(systemData.errors?.total)}</div>
                {recentErrors.length ? (
                  <div style={{ maxHeight: 220, overflow: 'auto' }}>
                    {recentErrors.slice(0, 6).map((entry, index) => (
                      <div key={`${entry.method}-${entry.path}-${index}`} style={{ padding: '8px 0', borderBottom: '1px solid #E2E8F0' }}>
                        {entry.method} {entry.path} → {entry.status} ({entry.responseTime ?? 'N/A'} ms)
                      </div>
                    ))}
                  </div>
                ) : <div className="admin-empty-state">No system errors recorded for the selected period.</div>}
              </div>
            </div>
          </div>

          <div className="admin-analytics-grid">
            <div className="admin-card">
              <SectionTitle icon={ShieldCheck} title="Security events" subtitle="Authentication and access events from audit logs" />
              <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 12 }}>
                <KpiCard label="Failed attempts" value={formatNumber(systemData.security?.failedLoginAttempts)} icon={AlertTriangle} tone={red} />
                <KpiCard label="Unauthorized requests" value={formatNumber(systemData.security?.unauthorizedRequests)} icon={ShieldCheck} tone={orange} />
                <KpiCard label="Permission changes" value={formatNumber(systemData.security?.permissionChanges)} icon={ShieldCheck} tone={purple} />
              </div>
              {recentSecurity.length ? (
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  {recentSecurity.slice(0, 8).map((event) => (
                    <div key={`${event.id}-${event.action}`} style={{ padding: '8px 0', borderBottom: '1px solid #E2E8F0' }}>
                      <strong>{event.action}</strong> · {event.entity || 'System'} · {formatDate(event.createdAt)}
                    </div>
                  ))}
                </div>
              ) : <div className="admin-empty-state">No security events recorded for the selected period.</div>}
            </div>

            <div className="admin-card">
              <SectionTitle icon={ClipboardList} title="Recent audit activity" subtitle="Latest platform actions" />
              {recentAudit.length ? (
                <div style={{ maxHeight: 260, overflow: 'auto' }}>
                  {recentAudit.slice(0, 8).map((event) => (
                    <div key={`${event.id}-${event.action}`} style={{ padding: '8px 0', borderBottom: '1px solid #E2E8F0' }}>
                      <strong>{event.action}</strong> · {event.entity || 'System'} · {event.userId || 'System'} · {formatDate(event.createdAt)}
                    </div>
                  ))}
                </div>
              ) : <div className="admin-empty-state">No recent audit activity for this range.</div>}
            </div>
          </div>

          <div className="admin-analytics-grid">
            <ChartCard title="Audit by action" subtitle="Most frequent platform actions" empty={!actionBreakdown.length}>
              <div style={{ height: 220 }}>
                <Bar data={actionChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </ChartCard>
            <ChartCard title="Activity by module" subtitle="Usage grouped by module or entity" empty={!moduleActivity.length}>
              <div style={{ height: 220 }}>
                <Bar data={moduleChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </ChartCard>
          </div>

          <div className="admin-card" style={{ marginTop: 18 }}>
            <SectionTitle icon={ClipboardList} title="Notifications" subtitle="Real notification generation and delivery data" />
            <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <KpiCard label="Generated" value={formatNumber(systemData.notifications?.generated)} icon={Activity} tone={blue} />
              <KpiCard label="Unread" value={formatNumber(systemData.notifications?.unread)} icon={ClipboardList} tone={purple} />
              <KpiCard label="Failed deliveries" value={formatNumber(systemData.notifications?.failedDeliveries)} icon={AlertTriangle} tone={red} />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default AdminAnalyticsCenter;
