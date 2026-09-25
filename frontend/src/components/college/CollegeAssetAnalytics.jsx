import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BarChart3, Building2, CheckCircle2, Download, Filter, LoaderCircle, Package, RefreshCw, Search, ShieldCheck, Users, Wrench, XCircle } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import apiClient from '../../services/apiClient';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip);

const toneColors = ['#2563EB', '#0EA5E9', '#16A34A', '#F59E0B', '#DC2626', '#64748B', '#7C3AED'];

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

const emptySeries = [];

const CollegeAssetAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', departmentId: '', categoryId: '', locationId: '', status: '', condition: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [data, setData] = useState({ summary: {}, distributions: {}, trends: {}, table: { rows: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }, departments: [], college: {} });
  const [departments, setDepartments] = useState([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/analytics/assets', {
        params: { ...filters, page, limit, search: filters.search || undefined },
      });
      const payload = response.data?.data || {};
      setData(payload);
      setDepartments(payload.departments || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load asset analytics.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const summary = data.summary || {};
  const distributions = data.distributions || {};
  const trends = data.trends || {};
  const tableData = data.table?.rows || [];
  const pagination = data.table?.pagination || { page: 1, limit, total: 0, totalPages: 0 };

  const statusChartData = useMemo(() => ({
    labels: (distributions.status || []).map((row) => row.status),
    datasets: [{
      label: 'Assets',
      data: (distributions.status || []).map((row) => Number(row.count || 0)),
      backgroundColor: toneColors,
      borderRadius: 6,
    }],
  }), [distributions.status]);

  const conditionChartData = useMemo(() => ({
    labels: (distributions.conditions || []).map((row) => row.condition),
    datasets: [{
      label: 'Assets',
      data: (distributions.conditions || []).map((row) => Number(row.count || 0)),
      backgroundColor: toneColors,
      borderWidth: 0,
    }],
  }), [distributions.conditions]);

  const trendChartData = useMemo(() => ({
    labels: (trends.assetsAddedOverTime || []).map((row) => row.period),
    datasets: [{
      label: 'Assets added',
      data: (trends.assetsAddedOverTime || []).map((row) => Number(row.count || 0)),
      borderColor: '#0EA5E9',
      backgroundColor: 'rgba(14,165,233,0.15)',
      fill: true,
      tension: 0.25,
    }],
  }), [trends.assetsAddedOverTime]);

  const kpis = [
    { label: 'Total Assets', value: summary.totalAssets, icon: Package, tone: '#2563EB' },
    { label: 'Active Assets', value: summary.activeAssets, icon: CheckCircle2, tone: '#16A34A' },
    { label: 'Assigned Assets', value: summary.assignedAssets, icon: Users, tone: '#0EA5E9' },
    { label: 'Available Assets', value: summary.availableAssets, icon: ShieldCheck, tone: '#22C55E' },
    { label: 'Under Maintenance', value: summary.underMaintenance, icon: Wrench, tone: '#F59E0B' },
    { label: 'Damaged Assets', value: summary.damagedAssets, icon: AlertTriangle, tone: '#DC2626' },
    { label: 'Missing Assets', value: summary.missingAssets, icon: XCircle, tone: '#7C3AED' },
    { label: 'Total Asset Value', value: summary.totalAssetValue, icon: Building2, tone: '#1D4ED8' },
  ];

  const handleFilterChange = (field, value) => {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', departmentId: '', categoryId: '', locationId: '', status: '', condition: '', dateFrom: '', dateTo: '' });
    setPage(1);
  };

  const exportCsv = async () => {
    try {
      const response = await apiClient.get('/api/college/analytics/assets', { params: { ...filters, page: 1, limit: 1000 } });
      const rows = response.data?.data?.table?.rows || [];
      const csv = [
        ['Asset Code', 'Asset Name', 'Category', 'Department', 'Location', 'Status', 'Condition', 'Assignment', 'Purchase Date', 'Asset Value', 'Last Updated'].join(','),
        ...rows.map((row) => [
          row.assetCode || '', row.assetName || '', row.category || '', row.department || '', row.location || '', row.status || '', row.condition || '', row.assignment || '', row.purchaseDate || '', row.assetValue || '', row.lastUpdated || '',
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'college-asset-analytics.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.response?.data?.message || 'Failed to export asset analytics.');
    }
  };

  if (loading) {
    return (
      <div className="college-performance-shell">
        <div className="college-performance-state" aria-busy="true">
          <LoaderCircle className="college-performance-spin" size={20} />
          Loading asset analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="college-performance-shell">
        <div className="college-performance-state error" role="alert">
          <strong>Failed to load asset analytics.</strong>
          <span>{error}</span>
          <button type="button" onClick={fetchAnalytics}><RefreshCw size={15} /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="college-performance-shell" style={{ display: 'grid', gap: 18 }}>
      <div className="college-performance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="college-performance-kicker">College Manager</p>
          <h3>Asset Analytics</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="college-performance-refresh" onClick={fetchAnalytics}><RefreshCw size={16} /> Refresh</button>
          <button type="button" className="admin-primary-button" onClick={exportCsv}><Download size={15} /> Export</button>
        </div>
      </div>

      <div className="college-performance-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Search</span>
          <input type="search" value={filters.search} onChange={(event) => handleFilterChange('search', event.target.value)} placeholder="Asset code, name, tag..." />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Department</span>
          <select value={filters.departmentId} onChange={(event) => handleFilterChange('departmentId', event.target.value)}>
            <option value="">All departments</option>
            {(departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Status</span>
          <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
            <option value="">All statuses</option>
            {(distributions.status || []).map((row) => <option key={row.status} value={row.status}>{row.status}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Condition</span>
          <select value={filters.condition} onChange={(event) => handleFilterChange('condition', event.target.value)}>
            <option value="">All conditions</option>
            {(distributions.conditions || []).map((row) => <option key={row.condition} value={row.condition}>{row.condition}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Location</span>
          <select value={filters.locationId} onChange={(event) => handleFilterChange('locationId', event.target.value)}>
            <option value="">All locations</option>
            {(distributions.locations || []).map((row) => <option key={row.location} value={row.location}>{row.location}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Date from</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => handleFilterChange('dateFrom', event.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Date to</span>
          <input type="date" value={filters.dateTo} onChange={(event) => handleFilterChange('dateTo', event.target.value)} />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type="button" className="admin-secondary-button" onClick={clearFilters}>Clear filters</button>
        </div>
      </div>

      <div className="college-performance-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div className="college-performance-kpi-card" key={label} style={{ borderTop: `3px solid ${tone}`, minHeight: 110 }}>
            <div className="college-performance-kpi-icon" style={{ background: `${tone}1A`, color: tone }}><Icon size={18} /></div>
            <div>
              <strong>{label === 'Total Asset Value' ? `ETB ${formatNumber(value)}` : formatNumber(value)}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Asset Status Distribution</h2></div><BarChart3 size={18} /></div>
          {statusChartData.labels.length ? <Doughnut data={statusChartData} options={{ responsive: true, maintainAspectRatio: false, animation: false }} height={220} /> : <p className="college-empty-state">No asset data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Asset Condition</h2></div><Filter size={18} /></div>
          {conditionChartData.labels.length ? <Bar data={conditionChartData} options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } }} height={220} /> : <p className="college-empty-state">No asset data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16, gridColumn: '1 / -1' }}>
          <div className="college-section-heading"><div><h2>Asset Additions Over Time</h2></div><TrendingUpIcon /></div>
          {trendChartData.labels.length ? <Line data={trendChartData} options={{ responsive: true, maintainAspectRatio: false, animation: false }} height={220} /> : <p className="college-empty-state">No historical data available.</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Assets by Department</h2></div><Building2 size={18} /></div>
          {(distributions.departments || []).length ? (
            <div className="college-table-wrap">
              <table>
                <thead><tr><th>Department</th><th>Total</th><th>Assigned</th></tr></thead>
                <tbody>{(distributions.departments || []).map((row) => <tr key={`${row.department}-${row.totalAssets}`}><td>{row.department}</td><td>{row.totalAssets}</td><td>{row.assigned}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="college-empty-state">No asset distribution data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Assets by Category</h2></div><Package size={18} /></div>
          {(distributions.categories || []).length ? (
            <div className="college-table-wrap">
              <table>
                <thead><tr><th>Category</th><th>Count</th></tr></thead>
                <tbody>{(distributions.categories || []).map((row) => <tr key={row.category}><td>{row.category}</td><td>{row.count}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="college-empty-state">No category data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Location Summary</h2></div><MapPinIcon /></div>
          {(distributions.locations || []).length ? (
            <div className="college-table-wrap">
              <table>
                <thead><tr><th>Location</th><th>Count</th></tr></thead>
                <tbody>{(distributions.locations || []).map((row) => <tr key={row.location}><td>{row.location}</td><td>{row.count}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="college-empty-state">No location data available.</p>}
        </div>
      </div>

      <div className="college-dashboard-card" style={{ padding: 16 }}>
        <div className="college-section-heading"><div><h2>Asset Table</h2></div><Search size={18} /></div>
        {tableData.length ? (
          <div className="college-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Condition</th>
                  <th>Assignment</th>
                  <th>Purchase Date</th>
                  <th>Value</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.assetCode}</td>
                    <td>{row.assetName}</td>
                    <td>{row.category}</td>
                    <td>{row.department}</td>
                    <td>{row.location}</td>
                    <td>{row.status}</td>
                    <td>{row.condition}</td>
                    <td>{row.assignment}</td>
                    <td>{formatDate(row.purchaseDate)}</td>
                    <td>{formatNumber(row.assetValue)}</td>
                    <td>{formatDate(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="college-empty-state">No assets match the selected filters.</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <span>{`Showing ${tableData.length} of ${pagination.total || 0}`}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="admin-secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
            <button type="button" className="admin-secondary-button" onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))} disabled={page >= (pagination.totalPages || 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TrendingUpIcon = () => <BarChart3 size={18} />;
const MapPinIcon = () => <Building2 size={18} />;

export default CollegeAssetAnalytics;
