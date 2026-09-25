import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { Activity, BarChart3, Building2, CheckCircle2, CircleDollarSign, Filter, HeartPulse, MapPin, Package, RefreshCw, UserCheck, Wrench } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../utils/api';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip);

const colors = ['#2563EB', '#0EA5E9', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED', '#64748B', '#0891B2'];
const emptyData = { summary: {}, distributions: {}, trends: {}, maintenance: {}, repairs: {}, health: {}, tracking: {}, table: [], options: {} };
const initialFilters = { dateFrom: '', dateTo: '', category: '', status: '', condition: '', departmentId: '', location: '' };
const formatNumber = (value) => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const formatMoney = (value) => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString(undefined, { style: 'currency', currency: 'ETB', maximumFractionDigits: 2 });

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
const emptyChart = (rows) => !Array.isArray(rows) || rows.length === 0;

const KpiCard = ({ label, value, icon: Icon, tone }) => (
  <div className="admin-card" style={{ borderTop: `3px solid ${tone}`, minHeight: 116 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--admin-muted)', fontSize: '0.8rem', fontWeight: 700 }}>{label}</span>
      <Icon size={18} color={tone} aria-hidden="true" />
    </div>
    <strong style={{ display: 'block', marginTop: 12, color: 'var(--admin-text)', fontSize: '1.55rem' }}>{value}</strong>
  </div>
);

const ChartCard = ({ title, subtitle, rows, children }) => (
  <div className="admin-card" style={{ minHeight: 320 }}>
    <h2 style={{ margin: 0, color: '#1A237E', fontSize: '1rem' }}>{title}</h2>
    {subtitle && <small style={{ color: 'var(--admin-muted)' }}>{subtitle}</small>}
    {emptyChart(rows) ? <div className="admin-empty-state">Not enough data</div> : <div style={{ height: 250, marginTop: 12 }}>{children}</div>}
  </div>
);

const ICTAssetAnalytics = () => {
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value));
      const response = await apiClient.get('/api/ict/analytics', { params });
      setData(response.data?.data || emptyData);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load asset analytics.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadAnalytics(filters); }, [loadAnalytics, filters]);

  const updateFilter = (field, value) => setDraftFilters((previous) => ({ ...previous, [field]: value }));
  const applyFilters = (event) => { event.preventDefault(); setFilters(draftFilters); };
  const resetFilters = () => { setDraftFilters(initialFilters); setFilters(initialFilters); };
  const summary = data.summary || {};
  const distributions = data.distributions || {};
  const options = data.options || {};
  const hasAssets = Number(summary.totalAssets || 0) > 0;
  const series = (rows, labelKey) => ({ labels: rows.map((row) => row[labelKey]), datasets: [{ label: 'Assets', data: rows.map((row) => Number(row.count || 0)), backgroundColor: colors, borderRadius: 5 }] });
  const trendData = useMemo(() => ({ labels: (data.trends?.assets || []).map((row) => row.period), datasets: [{ label: 'Assets added', data: (data.trends?.assets || []).map((row) => row.count), borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.25 }] }), [data.trends?.assets]);
  const statusData = series(distributions.byStatus || [], 'status');
  const categoryData = series(distributions.byCategory || [], 'category');
  const conditionData = { labels: (distributions.byCondition || []).map((row) => row.condition), datasets: [{ label: 'Assets', data: (distributions.byCondition || []).map((row) => row.count), backgroundColor: colors, borderWidth: 0 }] };
  const departmentData = series(distributions.byDepartment || [], 'department');

  const selectOptions = (values) => [...new Set((values || []).filter(Boolean))];
  const kpis = [
    ['Total Assets', formatNumber(summary.totalAssets), Package, '#2563EB'],
    ['Assigned Assets', formatNumber(summary.assignedAssets), UserCheck, '#0EA5E9'],
    ['Available Assets', formatNumber(summary.availableAssets), CheckCircle2, '#16A34A'],
    ['Under Maintenance', formatNumber(summary.underMaintenance), Wrench, '#F59E0B'],
    ['Under Repair', formatNumber(summary.underRepair), Activity, '#DC2626'],
    ['Asset Value', formatMoney(summary.totalAssetValue), CircleDollarSign, '#7C3AED'],
    ['Average Health', summary.averageHealthScore === null ? 'Not available' : `${summary.averageHealthScore}%`, HeartPulse, '#0891B2'],
    ['Tracking Coverage', summary.trackingCoverage === null ? 'Not available' : `${summary.trackingCoverage}%`, MapPin, '#64748B'],
  ];

  if (loading) return <section className="admin-workspace-page"><div className="admin-page-header"><div><div className="admin-breadcrumb"><BarChart3 size={15} /> ICT Officer / Analytics</div><h1 className="admin-page-title">Asset Analytics</h1></div></div><div className="admin-kpi-grid">{kpis.map(([label, , Icon, tone]) => <KpiCard key={label} label={label} value="..." icon={Icon} tone={tone} />)}</div><div className="admin-card admin-empty-state" aria-busy="true">Loading asset analytics...</div></section>;

  if (error) return <section className="admin-workspace-page"><div className="admin-page-header"><div><div className="admin-breadcrumb"><BarChart3 size={15} /> ICT Officer / Analytics</div><h1 className="admin-page-title">Asset Analytics</h1></div></div><div className="admin-error-state" role="alert"><span>{error}</span><button type="button" className="admin-secondary-button" onClick={() => loadAnalytics(filters)}><RefreshCw size={15} /> Retry</button></div></section>;

  return (
    <section className="admin-workspace-page" aria-labelledby="ict-asset-analytics-title">
      <div className="admin-page-header">
        <div><div className="admin-breadcrumb"><BarChart3 size={15} /> ICT Officer / Analytics</div><h1 id="ict-asset-analytics-title" className="admin-page-title">Asset Analytics</h1><p className="admin-page-subtitle">Analyze ICT asset distribution, utilization, condition, maintenance, and lifecycle performance using real system data.</p></div>
        <button type="button" className="admin-secondary-button" onClick={() => loadAnalytics(filters)} aria-label="Refresh asset analytics"><RefreshCw size={16} /> Refresh</button>
      </div>

      <form className="admin-card" onSubmit={applyFilters} style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#1A237E', fontWeight: 800 }}><Filter size={17} /> Filters</div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <label className="admin-form-field">From<input type="date" value={draftFilters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label className="admin-form-field">To<input type="date" value={draftFilters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          <label className="admin-form-field">Category<select value={draftFilters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{selectOptions(options.categories).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="admin-form-field">Status<select value={draftFilters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{selectOptions(options.statuses).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="admin-form-field">Condition<select value={draftFilters.condition} onChange={(event) => updateFilter('condition', event.target.value)}><option value="">All conditions</option>{selectOptions(options.conditions).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="admin-form-field">Department<select value={draftFilters.departmentId} onChange={(event) => updateFilter('departmentId', event.target.value)}><option value="">All departments</option>{(options.departments || []).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label className="admin-form-field">Location<select value={draftFilters.location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">All locations</option>{selectOptions(options.locations).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}><button type="submit" className="admin-primary-button">Apply Filters</button><button type="button" className="admin-secondary-button" onClick={resetFilters}>Reset</button></div>
        </div>
      </form>

      {!hasAssets ? <div className="admin-card admin-empty-state" style={{ marginBottom: 18 }}>No analytics data available. There are no asset records matching the selected filters.</div> : <>
        <div className="admin-kpi-grid">{kpis.map(([label, value, Icon, tone]) => <KpiCard key={label} label={label} value={value} icon={Icon} tone={tone} />)}</div>
        <div className="admin-analytics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <ChartCard title="Assets by category" rows={distributions.byCategory}><Bar data={categoryData} options={chartOptions} /></ChartCard>
          <ChartCard title="Asset status distribution" rows={distributions.byStatus}><Doughnut data={statusData} options={{ ...chartOptions, scales: undefined }} /></ChartCard>
          <ChartCard title="Asset condition" rows={distributions.byCondition}><Doughnut data={conditionData} options={{ ...chartOptions, scales: undefined }} /></ChartCard>
          <ChartCard title="Assets by department" rows={distributions.byDepartment}><Bar data={departmentData} options={chartOptions} /></ChartCard>
          <ChartCard title="Assets added over time" rows={data.trends?.assets}><Line data={trendData} options={chartOptions} /></ChartCard>
          <ChartCard title="Asset age" rows={distributions.byAge}><Bar data={series(distributions.byAge || [], 'bucket')} options={chartOptions} /></ChartCard>
          <ChartCard title="Maintenance status" rows={data.maintenance?.statuses}><Doughnut data={series(data.maintenance?.statuses || [], 'status')} options={{ ...chartOptions, scales: undefined }} /></ChartCard>
          <ChartCard title="Repair status" rows={data.repairs?.statuses}><Doughnut data={series(data.repairs?.statuses || [], 'status')} options={{ ...chartOptions, scales: undefined }} /></ChartCard>
          <ChartCard title="Device health" rows={data.health?.statuses}><Bar data={series(data.health?.statuses || [], 'status')} options={chartOptions} /></ChartCard>
          <ChartCard title="Tracking coverage" rows={data.tracking?.types}><Doughnut data={series(data.tracking?.types || [], 'type')} options={{ ...chartOptions, scales: undefined }} /></ChartCard>
        </div>
        <div className="admin-card" style={{ marginBottom: 18 }}><h2 style={{ margin: '0 0 12px', color: '#1A237E', fontSize: '1rem' }}>Category summary</h2><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Category</th><th>Total</th><th>Assigned</th><th>Available</th><th>Maintenance</th><th>Repair</th><th>Value</th></tr></thead><tbody>{(data.table || []).map((row) => <tr key={row.category}><td>{row.category}</td><td>{formatNumber(row.total)}</td><td>{formatNumber(row.assigned)}</td><td>{formatNumber(row.available)}</td><td>{formatNumber(row.maintenance)}</td><td>{formatNumber(row.repair)}</td><td>{formatMoney(row.value)}</td></tr>)}</tbody></table></div></div>
      </>}
    </section>
  );
};

export default ICTAssetAnalytics;
