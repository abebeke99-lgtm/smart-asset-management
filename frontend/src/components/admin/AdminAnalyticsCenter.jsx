import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { Activity, BarChart3, Building2, CheckCircle2, Database, Download, Filter, RefreshCw, ShieldAlert, Users, Wrench, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { useLanguage } from '../../contexts/UiContext';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip);

const navy = '#1A237E';
const blue = '#2563EB';
const cyan = '#0EA5E9';
const colors = ['#2563EB', '#0EA5E9', '#1A237E', '#16A34A', '#D97706', '#DC2626', '#64748B'];

const emptyAssetData = { kpis: {}, status: [], categories: [], trends: { assignments: [], maintenance: [], transfers: [] }, organizations: { colleges: [], departments: [] } };
const emptySystemData = { health: {}, authentication: {}, users: { roles: [] }, audit: { byAction: [], trend: [], recent: [] } };

const getPeriodLabels = (rows = []) => rows.map((row) => row.period);
const getCounts = (rows = []) => rows.map((row) => Number(row.count || 0));
const formatValue = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const getResponseData = (response) => response?.data?.data || response?.data || {};

const today = new Date();
const initialFilters = {
  dateFrom: new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
  dateTo: today.toISOString().slice(0, 10),
  collegeId: '',
  departmentId: '',
  categoryId: '',
  status: '',
  action: '',
  userId: '',
};

const KpiCard = ({ label, value, icon: Icon, tone = blue }) => (
  <div className="admin-card" style={{ borderTop: `3px solid ${tone}`, minHeight: 112 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ color: '#64748B', fontSize: '0.82rem', fontWeight: 700 }}>{label}</span>
      <Icon size={18} color={tone} aria-hidden="true" />
    </div>
    <strong style={{ display: 'block', marginTop: 12, color: navy, fontSize: '1.65rem' }}>{formatValue(value)}</strong>
  </div>
);

const ChartCard = ({ title, children, empty }) => (
  <div className="admin-card" style={{ minHeight: 310 }}>
    <h2 style={{ color: navy, fontSize: '1rem', margin: '0 0 18px' }}>{title}</h2>
    {empty ? <div className="admin-empty-state">No analytics data available for the selected filters.</div> : children}
  </div>
);

const AdminAnalyticsCenter = ({ system = false }) => {
  const { language } = useLanguage();
  const [filters, setFilters] = useState(initialFilters);
  const [assetData, setAssetData] = useState(emptyAssetData);
  const [systemData, setSystemData] = useState(emptySystemData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const labels = language === 'am' ? {
    title: system ? 'የስርዓት ትንታኔ' : 'ትንታኔ',
    subtitle: system ? 'የስርዓት እንቅስቃሴ፣ ጤና፣ ደህንነት እና አጠቃቀም ክትትል።' : 'ከእውነተኛ የዩኒቨርሲቲ መረጃ የተመረጠ የንብረት እና የስራ ግንዛቤ።',
    refresh: 'አድስ', export: 'ላክ', filters: 'ማጣሪያዎች',
  } : {
    title: system ? 'System Analytics' : 'Analytics',
    subtitle: system ? 'Monitor system activity, health, security and operational usage.' : "Enterprise asset, organizational and operational intelligence from the university's real system data.",
    refresh: 'Refresh', export: 'Export', filters: 'Filters',
  };

  const query = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), [filters]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(system ? '/api/admin/analytics/system' : '/api/admin/analytics/assets', { params: query });
      const data = getResponseData(response);
      if (system) setSystemData(data);
      else setAssetData(data);
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [query, system]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportData = async () => {
    try {
      const response = await apiClient.get(system ? '/api/admin/analytics/system' : '/api/admin/analytics/export', { params: query, responseType: system ? 'json' : 'blob' });
      if (system) {
        const rows = response.data?.data?.audit?.recent || [];
        const csv = ['id,userId,action,entity,createdAt', ...rows.map((row) => [row.id, row.userId, row.action, row.entity, row.createdAt].map((value) => JSON.stringify(value ?? '')).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'system-analytics-audit.csv'; anchor.click(); URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'asset-analytics.csv'; anchor.click(); URL.revokeObjectURL(url);
      }
      toast.success('Analytics export downloaded');
    } catch (exportError) {
      toast.error(exportError?.response?.data?.message || 'Unable to export analytics');
    }
  };

  const assetKpis = assetData.kpis || {};
  const statusRows = assetData.status || [];
  const categoryRows = assetData.categories || [];
  const assetTrend = assetData.trends?.maintenance || [];
  const systemRoles = systemData.users?.roles || [];
  const auditTrend = systemData.audit?.trend || [];

  const statusChart = { labels: statusRows.map((row) => row.status), datasets: [{ label: 'Assets', data: getCounts(statusRows), backgroundColor: colors, borderWidth: 0 }] };
  const categoryChart = { labels: categoryRows.slice(0, 10).map((row) => row.category), datasets: [{ label: 'Assets', data: categoryRows.slice(0, 10).map((row) => row.count), backgroundColor: blue, borderRadius: 4 }] };
  const trendChart = { labels: getPeriodLabels(system ? auditTrend : assetTrend), datasets: [{ label: system ? 'Audit events' : 'Maintenance requests', data: getCounts(system ? auditTrend : assetTrend), borderColor: cyan, backgroundColor: 'rgba(14,165,233,0.16)', fill: true, tension: 0.3 }] };
  const roleChart = { labels: systemRoles.map((row) => row.role), datasets: [{ label: 'Users', data: getCounts(systemRoles), backgroundColor: colors }] };

  return (
    <section className="admin-workspace-page" aria-labelledby="analytics-title">
      <div className="admin-page-header">
        <div>
          <div className="admin-breadcrumb"><BarChart3 size={16} /> Admin / {labels.title}</div>
          <h1 id="analytics-title" className="admin-page-title">{labels.title}</h1>
          <p className="admin-page-subtitle">{labels.subtitle}</p>
          <small style={{ color: '#64748B' }}>Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Not available'}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="admin-secondary-button" onClick={fetchData} disabled={loading}><RefreshCw size={16} /> {labels.refresh}</button>
          <button className="admin-primary-button" onClick={exportData} disabled={loading}><Download size={16} /> {labels.export}</button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, color: navy, fontWeight: 800 }}><Filter size={16} /> {labels.filters}</div>
        <div className="admin-form-grid">
          <label className="admin-form-field">Date from<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
          <label className="admin-form-field">Date to<input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
          {!system && <>
            <label className="admin-form-field">College<select value={filters.collegeId} onChange={(event) => setFilters({ ...filters, collegeId: event.target.value })}><option value="">All colleges</option>{(assetData.organizations?.colleges || []).map((college) => <option key={college.id} value={college.id}>{college.collegeName}</option>)}</select></label>
            <label className="admin-form-field">Department<select value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}><option value="">All departments</option>{(assetData.organizations?.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="admin-form-field">Asset status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statusRows.map((row) => <option key={row.status} value={row.status}>{row.status}</option>)}</select></label>
          </>}
          {system && <>
            <label className="admin-form-field">Audit action<select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}><option value="">All actions</option>{(systemData.audit?.byAction || []).map((row) => <option key={row.action} value={row.action}>{row.action}</option>)}</select></label>
            <label className="admin-form-field">User ID<input inputMode="numeric" value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value.replace(/\D/g, '') })} placeholder="All users" /></label>
          </>}
        </div>
      </div>

      {error && <div className="admin-error-state" role="alert"><XCircle size={18} /> {error}<button className="admin-secondary-button" onClick={fetchData}>Retry</button></div>}
      {loading ? <div className="admin-card admin-empty-state"><RefreshCw size={20} /> Loading analytics...</div> : system ? (
        <>
          <div className="admin-kpi-grid">
            <KpiCard label="Total users" value={systemData.users?.total} icon={Users} />
            <KpiCard label="Active users" value={systemData.users?.active} icon={CheckCircle2} tone="#16A34A" />
            <KpiCard label="Failed logins" value={systemData.authentication?.failedLogins} icon={ShieldAlert} tone="#DC2626" />
            <KpiCard label="Audit events" value={systemData.audit?.total} icon={Activity} tone={navy} />
          </div>
          <div className="admin-analytics-grid">
            <ChartCard title="Audit activity over time" empty={!auditTrend.length}><Line data={trendChart} options={{ responsive: true, maintainAspectRatio: false }} height={220} /></ChartCard>
            <ChartCard title="Users by role" empty={!systemRoles.length}><Bar data={roleChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} height={220} /></ChartCard>
          </div>
          <div className="admin-card"><h2 style={{ color: navy, fontSize: '1rem' }}>System health</h2><div className="admin-health-grid"><div><Database size={18} color="#16A34A" /><strong>Database</strong><span>{systemData.health?.database?.status || 'Not available'}</span></div><div><Activity size={18} color="#16A34A" /><strong>API request</strong><span>{systemData.health?.api?.status || 'Not available'}</span></div><div><ShieldAlert size={18} color="#D97706" /><strong>Backup history</strong><span>{systemData.health?.backups?.count ? `${systemData.health.backups.count} files` : 'Not available'}</span></div></div></div>
          <div className="admin-table-card"><h2 style={{ color: navy, fontSize: '1rem', padding: '18px 18px 0' }}>Recent administrative activity</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Timestamp</th></tr></thead><tbody>{(systemData.audit?.recent || []).map((row) => <tr key={row.id}><td>{row.userId || 'System'}</td><td>{row.action}</td><td>{row.entity}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></div>
        </>
      ) : (
        <>
          <div className="admin-kpi-grid">
            <KpiCard label="Total assets" value={assetKpis.totalAssets} icon={BarChart3} />
            <KpiCard label="Assigned assets" value={assetKpis.assignedAssets} icon={Users} tone={navy} />
            <KpiCard label="Available assets" value={assetKpis.availableAssets} icon={CheckCircle2} tone="#16A34A" />
            <KpiCard label="Under maintenance" value={assetKpis.underMaintenance} icon={Wrench} tone="#D97706" />
            <KpiCard label="Total asset value" value={assetKpis.totalAssetValue} icon={Building2} tone={cyan} />
            <KpiCard label="Utilization rate" value={`${formatValue(assetKpis.utilizationRate)}%`} icon={Activity} tone="#7C3AED" />
          </div>
          <div className="admin-analytics-grid"><ChartCard title="Assets by status" empty={!statusRows.length}><Doughnut data={statusChart} options={{ responsive: true, maintainAspectRatio: false }} height={220} /></ChartCard><ChartCard title="Assets by category" empty={!categoryRows.length}><Bar data={categoryChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} height={220} /></ChartCard><ChartCard title="Maintenance requests over time" empty={!assetTrend.length}><Line data={trendChart} options={{ responsive: true, maintainAspectRatio: false }} height={220} /></ChartCard></div>
          <div className="admin-kpi-grid">
            <KpiCard label="RFID scans" value={assetData.rfid?.scans} icon={Activity} tone={cyan} />
            <KpiCard label="Inventory quantity" value={assetData.inventory?.totals?.quantity} icon={Building2} tone={navy} />
            <KpiCard label="Available inventory" value={assetData.inventory?.totals?.availableQuantity} icon={CheckCircle2} tone="#16A34A" />
            <KpiCard label="Damaged inventory" value={assetData.inventory?.totals?.damagedQuantity} icon={ShieldAlert} tone="#DC2626" />
          </div>
          <div className="admin-analytics-grid">
            <div className="admin-table-card"><h2 style={{ color: navy, fontSize: '1rem', padding: '18px 18px 0' }}>College performance</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>College</th><th>Assets</th><th>Value</th></tr></thead><tbody>{(assetData.organizations?.collegePerformance || []).map((row) => <tr key={row.id || row.name}><td>{row.name}</td><td>{formatValue(row.count)}</td><td>{formatValue(row.value)}</td></tr>)}</tbody></table></div></div>
            <div className="admin-table-card"><h2 style={{ color: navy, fontSize: '1rem', padding: '18px 18px 0' }}>Department performance</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Department</th><th>Assets</th><th>Value</th></tr></thead><tbody>{(assetData.organizations?.departmentPerformance || []).map((row) => <tr key={row.id || row.name}><td>{row.name}</td><td>{formatValue(row.count)}</td><td>{formatValue(row.value)}</td></tr>)}</tbody></table></div></div>
            <div className="admin-table-card"><h2 style={{ color: navy, fontSize: '1rem', padding: '18px 18px 0' }}>Maintenance status</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Status</th><th>Requests</th></tr></thead><tbody>{(assetData.maintenance?.statuses || []).map((row) => <tr key={row.status}><td>{row.status}</td><td>{formatValue(row.count)}</td></tr>)}</tbody></table></div></div>
          </div>
          <div className="admin-table-card"><h2 style={{ color: navy, fontSize: '1rem', padding: '18px 18px 0' }}>Top asset categories</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Category</th><th>Assets</th><th>Value</th></tr></thead><tbody>{categoryRows.map((row) => <tr key={row.category}><td>{row.category}</td><td>{formatValue(row.count)}</td><td>{formatValue(row.value)}</td></tr>)}</tbody></table></div></div>
        </>
      )}
    </section>
  );
};

export default AdminAnalyticsCenter;
