import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import { Activity, Boxes, Building2, CalendarDays, CircleCheck, Gauge, MapPin, Package, RefreshCw, Search, SlidersHorizontal, UserRoundCheck, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import './DeptUtilization.css';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Title, Tooltip);

const EMPTY_SUMMARY = { totalAssets: 0, inUse: 0, available: 0, underMaintenance: 0, disposed: 0, utilizationRate: 0, byCategory: {}, byLocation: {} };

const normalizeStatus = (value) => String(value || 'Unknown').replace(/[_-]/g, ' ');

const DeptUtilization = () => {
  const { user } = useAuth();
  const { theme } = useLanguage();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [assets, setAssets] = useState([]);
  const [options, setOptions] = useState({ categories: [], locations: [], statuses: [] });
  const [filters, setFilters] = useState({ search: '', category: '', location: '', status: '', dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUtilization = useCallback(async () => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setError('Start date cannot be after end date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/department/reports', { params: { reportType: 'utilization', limit: 100, ...filters } });
      const data = response.data || {};
      const rows = Array.isArray(data.data) ? data.data : [];
      const nextSummary = { ...EMPTY_SUMMARY, ...(data.summary || {}) };
      setAssets(rows);
      setSummary(nextSummary);
      setOptions({
        categories: Object.keys(nextSummary.byCategory || {}),
        locations: Object.keys(nextSummary.byLocation || {}),
        statuses: [...new Set(rows.map((asset) => asset.status).filter(Boolean))].sort()
      });
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Unable to load utilization data.');
      setError(message);
      setAssets([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadUtilization(); }, [loadUtilization]);

  const statusCounts = useMemo(() => assets.reduce((counts, asset) => {
    const status = normalizeStatus(asset.status);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {}), [assets]);

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  const colors = ['#0ea5e9', '#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#64748b', '#8b5cf6'];

  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const clearFilters = () => setFilters({ search: '', category: '', location: '', status: '', dateFrom: '', dateTo: '' });

  return (
    <main className={`utilization-page${theme === 'dark' ? ' is-dark' : ''}`}>
      <header className="utilization-header">
        <div>
          <div className="utilization-eyebrow"><Gauge size={17} aria-hidden="true" /> Department analytics</div>
          <h1>Asset Utilization</h1>
          <p>Current asset status and assignment data for {user?.department || 'your department'}.</p>
        </div>
        <button type="button" className="utilization-refresh" onClick={loadUtilization} disabled={loading} aria-label="Refresh utilization data">
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'spin' : ''} /> Refresh
        </button>
      </header>

      <section className="utilization-filters" aria-label="Utilization filters">
        <div className="utilization-filter search-filter"><Search size={17} aria-hidden="true" /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search assets" aria-label="Search assets" /></div>
        <label><span>Category</span><select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{options.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Location</span><select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">All locations</option>{options.locations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{options.statuses.map((value) => <option key={value} value={value}>{normalizeStatus(value)}</option>)}</select></label>
        <label><span><CalendarDays size={14} aria-hidden="true" /> From</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
        <label><span><CalendarDays size={14} aria-hidden="true" /> To</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
        <button type="button" className="utilization-clear" onClick={clearFilters}><SlidersHorizontal size={16} aria-hidden="true" /> Clear</button>
      </section>

      {error && <section className="utilization-error" role="alert"><Activity size={18} aria-hidden="true" /><span>{error}</span><button type="button" onClick={loadUtilization}>Retry</button></section>}
      {loading ? <section className="utilization-loading" aria-live="polite"><Gauge size={28} aria-hidden="true" /><span>Loading utilization data...</span></section> : <>
        <section className="utilization-metrics" aria-label="Utilization summary">
          <Metric icon={Package} label="Total assets" value={summary.totalAssets} />
          <Metric icon={UserRoundCheck} label="In use" value={summary.inUse} tone="blue" />
          <Metric icon={CircleCheck} label="Available" value={summary.available} tone="green" />
          <Metric icon={Wrench} label="Under maintenance" value={summary.underMaintenance} tone="amber" />
          <Metric icon={Gauge} label="Utilization rate" value={`${Number(summary.utilizationRate || 0).toFixed(2)}%`} tone="navy" />
        </section>
        <section className="utilization-charts">
          <ChartPanel title="Assets by status"><Doughnut data={{ labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: colors, borderWidth: 0 }] }} options={chartOptions} /></ChartPanel>
          <ChartPanel title="Assets by category"><Bar data={{ labels: Object.keys(summary.byCategory || {}), datasets: [{ label: 'Assets', data: Object.values(summary.byCategory || {}), backgroundColor: '#0ea5e9', borderRadius: 4 }] }} options={{ ...chartOptions, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></ChartPanel>
        </section>
        <section className="utilization-table-panel"><div className="utilization-panel-heading"><div><h2>Asset utilization records</h2><p>{assets.length} records returned by the department report</p></div><Boxes size={22} aria-hidden="true" /></div><div className="utilization-table-wrap"><table><thead><tr><th>Asset</th><th>Code</th><th>Category</th><th>Location</th><th>Status</th><th>Value</th></tr></thead><tbody>{assets.length ? assets.map((asset) => <tr key={asset.id}><td><strong>{asset.name || 'Unnamed asset'}</strong></td><td>{asset.asset_tag || '-'}</td><td>{asset.category_name || '-'}</td><td>{asset.location || '-'}</td><td><span className="status-badge">{normalizeStatus(asset.status)}</span></td><td>{Number(asset.current_value || 0).toLocaleString()}</td></tr>) : <tr><td colSpan="6" className="utilization-empty"><MapPin size={24} aria-hidden="true" /><span>No utilization records match the current filters.</span></td></tr>}</tbody></table></div></section>
      </>}
    </main>
  );
};

const Metric = ({ icon: Icon, label, value, tone = '' }) => <article className={`utilization-metric ${tone}`}><Icon size={19} aria-hidden="true" /><strong>{value}</strong><span>{label}</span></article>;
const ChartPanel = ({ title, children }) => <article className="utilization-chart-panel"><h2>{title}</h2><div className="utilization-chart">{children}</div></article>;

export default DeptUtilization;