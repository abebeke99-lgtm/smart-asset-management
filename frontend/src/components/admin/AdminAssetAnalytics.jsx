import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { BarChart3, Building2, CircleDollarSign, Download, Filter, Package, RefreshCw, Wrench } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { apiClient, getApiErrorMessage } from '../../utils/api';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const initialFilters = { dateFrom: '', dateTo: '', campusId: '', collegeId: '', departmentId: '', categoryId: '', status: '', condition: '', locationId: '', acquisitionSource: '', maintenanceStatus: '' };
const colors = ['#3074B3', '#16A34A', '#D97706', '#DC2626', '#0891B2', '#7C3AED', '#64748B', '#DB2777'];
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
const formatNumber = (value) => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const formatMoney = (value) => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString(undefined, { style: 'currency', currency: 'ETB', maximumFractionDigits: 2 });

const Metric = ({ label, value, icon: Icon, tone }) => (
  <div className="admin-card" style={{ minHeight: 112, borderTop: `3px solid ${tone}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--admin-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
      {label}<Icon size={18} color={tone} aria-hidden="true" />
    </div>
    <strong style={{ display: 'block', marginTop: 12, color: 'var(--admin-text)', fontSize: '1.45rem' }}>{value}</strong>
  </div>
);

const ChartPanel = ({ title, rows, children }) => (
  <div className="admin-card" style={{ minHeight: 310 }}>
    <h2 style={{ margin: 0, color: 'var(--admin-text)', fontSize: '1rem' }}>{title}</h2>
    {rows?.length ? <div style={{ height: 250, marginTop: 12 }}>{children}</div> : <div className="admin-empty-state">No asset data available for this view.</div>}
  </div>
);

const AdminAssetAnalytics = () => {
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [maintenanceAscending, setMaintenanceAscending] = useState(false);
  const query = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), [filters]);

  const loadAnalytics = useCallback(async (params = query) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/admin/analytics', { params });
      setData(response.data?.data || null);
      setLastUpdated(response.data?.data?.generatedAt || null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load asset analytics.'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const changeFilter = (key, value) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const applyFilters = (event) => { event.preventDefault(); setFilters(draftFilters); };
  const resetFilters = () => { setDraftFilters(initialFilters); setFilters(initialFilters); };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await apiClient.get('/api/admin/analytics/export', { params: query, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'asset-analytics.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to export asset analytics.'));
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = () => {
    if (!data) return;
    const workbook = XLSX.utils.book_new();
    const addSheet = (name, rows) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    addSheet('Filters', [['Filter', 'Selected value'], ...Object.entries(query)]);
    addSheet('Summary', [['Metric', 'Value'], ...Object.entries(kpis)]);
    addSheet('Categories', [['Category', 'Asset count', 'Value'], ...categories.map((row) => [row.category, row.count, row.value])]);
    addSheet('Status', [['Status', 'Asset count'], ...statuses.map((row) => [row.status, row.count])]);
    addSheet('Colleges', [['College', 'Asset count', 'Value'], ...colleges.map((row) => [row.name, row.count, row.value])]);
    addSheet('Departments', [['Department', 'Asset count', 'Value'], ...departments.map((row) => [row.name, row.count, row.value])]);
    addSheet('Campuses', [['Campus', 'Asset count', 'Value'], ...campuses.map((row) => [row.name, row.count, row.value])]);
    addSheet('Conditions', [['Condition', 'Asset count'], ...conditionRows.map((row) => [row.condition, row.count])]);
    addSheet('Age', [['Age group', 'Asset count'], ...ageRows.map((row) => [row.bucket, row.count])]);
    addSheet('Acquisitions', [['Period', 'Assets acquired'], ...acquisitionRows.map((row) => [row.period, row.count])]);
    addSheet('Maintenance', [['Asset', 'Code', 'Category', 'Maintenance count', 'Status'], ...(data.maintenance?.frequentlyMaintained || []).map((row) => [row.name, row.assetCode, row.category, row.maintenanceCount, row.status])]);
    addSheet('Grant sources', [['Source', 'Assets', 'Asset value'], ...(grantAssets.bySource || []).map((row) => [row.source, row.count, row.value])]);
    XLSX.writeFile(workbook, 'asset-analytics.xlsx');
  };

  const exportPdf = () => {
    if (!data) return;
    const document = new jsPDF();
    document.text('Asset Analytics', 14, 16);
    document.text(`Generated: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Not available'}`, 14, 23);
    document.autoTable({ startY: 29, head: [['Selected filter', 'Value']], body: Object.entries(query).length ? Object.entries(query) : [['Filters', 'None']] });
    document.autoTable({ head: [['Metric', 'Value']], body: Object.entries(kpis), startY: document.lastAutoTable.finalY + 8 });
    document.autoTable({ head: [['Category', 'Asset count', 'Value']], body: categories.map((row) => [row.category, row.count, row.value]), startY: document.lastAutoTable.finalY + 8 });
    document.autoTable({ head: [['College', 'Asset count', 'Value']], body: colleges.map((row) => [row.name, row.count, row.value]), startY: document.lastAutoTable.finalY + 8 });
    document.autoTable({ head: [['Department', 'Asset count', 'Value']], body: departments.map((row) => [row.name, row.count, row.value]), startY: document.lastAutoTable.finalY + 8 });
    document.autoTable({ head: [['Campus', 'Asset count', 'Value']], body: campuses.map((row) => [row.name, row.count, row.value]), startY: document.lastAutoTable.finalY + 8 });
    document.autoTable({ head: [['Age group', 'Asset count']], body: ageRows.map((row) => [row.bucket, row.count]), startY: document.lastAutoTable.finalY + 8 });
    document.autoTable({ head: [['Maintenance asset', 'Count', 'Last maintenance']], body: (data.maintenance?.frequentlyMaintained || []).map((row) => [row.name, row.maintenanceCount, row.lastMaintenance || 'Not available']), startY: document.lastAutoTable.finalY + 8 });
    document.save('asset-analytics.pdf');
  };

  const kpis = data?.kpis || {};
  const categories = data?.categories || [];
  const statuses = data?.status || [];
  const colleges = data?.organizations?.collegePerformance || [];
  const departments = data?.organizations?.departmentPerformance || [];
  const campuses = data?.organizations?.campusPerformance || [];
  const maintenance = data?.trends?.maintenance || [];
  const conditionRows = data?.distributions?.byCondition || [];
  const ageRows = data?.distributions?.byAge || [];
  const acquisitionRows = data?.trends?.acquisitions || [];
  const maintenanceStatuses = data?.maintenance?.statuses || [];
  const grantAssets = data?.acquisition?.researchGrant || {};
  const categoryChart = { labels: categories.map((row) => row.category), datasets: [{ label: 'Assets', data: categories.map((row) => row.count), backgroundColor: colors, borderRadius: 4 }] };
  const statusChart = { labels: statuses.map((row) => row.status), datasets: [{ data: statuses.map((row) => row.count), backgroundColor: colors, borderWidth: 0 }] };
  const collegeChart = { labels: colleges.map((row) => row.name), datasets: [{ label: 'Assets', data: colleges.map((row) => row.count), backgroundColor: colors, borderRadius: 4 }] };
  const departmentChart = { labels: departments.map((row) => row.name), datasets: [{ label: 'Assets', data: departments.map((row) => row.count), backgroundColor: colors, borderRadius: 4 }] };
  const campusChart = { labels: campuses.map((row) => row.name), datasets: [{ label: 'Assets', data: campuses.map((row) => row.count), backgroundColor: colors, borderRadius: 4 }] };
  const conditionChart = { labels: conditionRows.map((row) => row.condition), datasets: [{ label: 'Assets', data: conditionRows.map((row) => row.count), backgroundColor: colors, borderWidth: 0 }] };
  const ageChart = { labels: ageRows.map((row) => row.bucket), datasets: [{ label: 'Assets', data: ageRows.map((row) => row.count), backgroundColor: colors, borderRadius: 4 }] };
  const acquisitionChart = { labels: acquisitionRows.map((row) => row.period), datasets: [{ label: 'Assets acquired', data: acquisitionRows.map((row) => row.count), borderColor: '#3074B3', backgroundColor: 'rgba(48, 116, 179,0.12)', fill: true, tension: 0.25 }] };
  const maintenanceChart = { labels: maintenance.map((row) => row.period), datasets: [{ label: 'Maintenance requests', data: maintenance.map((row) => row.count), borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.12)', fill: true, tension: 0.25 }] };
  const organizations = data?.organizations || {};
  const frequentMaintenance = [...(data?.maintenance?.frequentlyMaintained || [])].sort((first, second) => maintenanceAscending ? first.maintenanceCount - second.maintenanceCount : second.maintenanceCount - first.maintenanceCount);
  const collegeChartOptions = { ...chartOptions, onClick: (_event, elements) => {
    const college = elements.length ? colleges[elements[0].index] : null;
    if (college?.id) {
      const nextFilters = { ...filters, collegeId: String(college.id) };
      setDraftFilters(nextFilters);
      setFilters(nextFilters);
    }
  } };

  return (
    <section className="admin-workspace-page" aria-labelledby="admin-asset-analytics-title">
      <div className="admin-page-header">
        <div>
          <div className="admin-breadcrumb"><BarChart3 size={16} /> Admin / Asset Analytics</div>
          <h1 id="admin-asset-analytics-title" className="admin-page-title">Asset Analytics</h1>
          <p className="admin-page-subtitle">Analyze asset distribution, status, value, and maintenance using live database data.</p>
          <small style={{ color: 'var(--admin-muted)' }}>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Not available'}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="admin-secondary-button" onClick={() => loadAnalytics()} disabled={loading}><RefreshCw size={16} /> Refresh Data</button>
          <button type="button" className="admin-secondary-button" onClick={exportCsv} disabled={exporting || loading}><Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}</button>
          <button type="button" className="admin-secondary-button" onClick={exportExcel} disabled={!data || loading}><Download size={16} /> Export Excel</button>
          <button type="button" className="admin-secondary-button" onClick={exportPdf} disabled={!data || loading}><Download size={16} /> Export PDF</button>
          <button type="button" className="admin-secondary-button" onClick={() => window.print()} disabled={!data || loading}>Print Report</button>
        </div>
      </div>

      <form className="admin-card" onSubmit={applyFilters} style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--admin-text)', fontWeight: 800 }}><Filter size={17} /> Filters</div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <label className="admin-form-field">Date from<input type="date" value={draftFilters.dateFrom} onChange={(event) => changeFilter('dateFrom', event.target.value)} /></label>
          <label className="admin-form-field">Date to<input type="date" value={draftFilters.dateTo} onChange={(event) => changeFilter('dateTo', event.target.value)} /></label>
          <label className="admin-form-field">Campus<select value={draftFilters.campusId} onChange={(event) => changeFilter('campusId', event.target.value)}><option value="">All campuses</option>{(organizations.campuses || []).map((item) => <option key={item.id} value={item.id}>{item.campusName}</option>)}</select></label>
          <label className="admin-form-field">College<select value={draftFilters.collegeId} onChange={(event) => changeFilter('collegeId', event.target.value)}><option value="">All colleges</option>{(organizations.colleges || []).map((item) => <option key={item.id} value={item.id}>{item.collegeName}</option>)}</select></label>
          <label className="admin-form-field">Department<select value={draftFilters.departmentId} onChange={(event) => changeFilter('departmentId', event.target.value)}><option value="">All departments</option>{(organizations.departments || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="admin-form-field">Category<select value={draftFilters.categoryId} onChange={(event) => changeFilter('categoryId', event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.category} value={item.category}>{item.category}</option>)}</select></label>
          <label className="admin-form-field">Status<select value={draftFilters.status} onChange={(event) => changeFilter('status', event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item.status} value={item.status}>{item.status}</option>)}</select></label>
          <label className="admin-form-field">Condition<select value={draftFilters.condition} onChange={(event) => changeFilter('condition', event.target.value)}><option value="">All conditions</option>{conditionRows.map((item) => <option key={item.condition} value={item.condition}>{item.condition}</option>)}</select></label>
          <label className="admin-form-field">Location<input type="search" value={draftFilters.locationId} onChange={(event) => changeFilter('locationId', event.target.value)} placeholder="Filter location" /></label>
          <label className="admin-form-field">Acquisition source<select value={draftFilters.acquisitionSource} onChange={(event) => changeFilter('acquisitionSource', event.target.value)}><option value="">All sources</option>{(data?.acquisition?.bySource || []).map((item) => <option key={item.source} value={item.source}>{item.source}</option>)}</select></label>
          <label className="admin-form-field">Maintenance status<select value={draftFilters.maintenanceStatus} onChange={(event) => changeFilter('maintenanceStatus', event.target.value)}><option value="">All maintenance</option>{maintenanceStatuses.map((item) => <option key={item.status} value={item.status}>{item.status}</option>)}</select></label>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}><button type="submit" className="admin-primary-button">Apply Filters</button><button type="button" className="admin-secondary-button" onClick={resetFilters}>Reset</button></div>
        </div>
      </form>

      {error && <div className="admin-error-state" role="alert" style={{ marginBottom: 18 }}><span><strong>Unable to load asset analytics.</strong> {error}</span><button type="button" className="admin-secondary-button" onClick={() => loadAnalytics()}><RefreshCw size={15} /> Retry</button></div>}
      {loading ? <div className="admin-card admin-empty-state" aria-busy="true">Loading asset analytics...</div> : !error && data && (
        <>
          <div className="admin-kpi-grid" style={{ marginBottom: 18 }}>
            <Metric label="Total assets" value={formatNumber(kpis.totalAssets)} icon={Package} tone="#3074B3" />
            <Metric label="Active assets" value={formatNumber(kpis.activeAssets)} icon={Package} tone="#16A34A" />
            <Metric label="Assigned assets" value={formatNumber(kpis.assignedAssets)} icon={Building2} tone="#0891B2" />
            <Metric label="Available assets" value={formatNumber(kpis.availableAssets)} icon={Package} tone="#16A34A" />
            <Metric label="Under maintenance" value={formatNumber(kpis.underMaintenance)} icon={Wrench} tone="#D97706" />
            <Metric label="Damaged assets" value={formatNumber(kpis.damagedAssets)} icon={Package} tone="#DC2626" />
            <Metric label="Lost assets" value={formatNumber(kpis.missingAssets)} icon={Package} tone="#64748B" />
            <Metric label="Disposed assets" value={formatNumber(kpis.disposedAssets)} icon={Package} tone="#64748B" />
            <Metric label="Total asset value" value={formatMoney(kpis.totalAssetValue)} icon={CircleDollarSign} tone="#7C3AED" />
            <Metric label="Average asset age" value={kpis.averageAssetAge === null ? 'Not available' : `${formatNumber(kpis.averageAssetAge)} years`} icon={Package} tone="#0891B2" />
          </div>
          <div className="admin-analytics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <ChartPanel title="Assets by category" rows={categories}><Bar data={categoryChart} options={chartOptions} /></ChartPanel>
            <ChartPanel title="Assets by status" rows={statuses}><Doughnut data={statusChart} options={{ ...chartOptions, scales: undefined }} /></ChartPanel>
            <ChartPanel title="Assets by condition" rows={conditionRows}><Doughnut data={conditionChart} options={{ ...chartOptions, scales: undefined }} /></ChartPanel>
            <ChartPanel title="Assets by college" rows={colleges}><Bar data={collegeChart} options={collegeChartOptions} /></ChartPanel>
            <ChartPanel title="Assets by department" rows={departments}><Bar data={departmentChart} options={chartOptions} /></ChartPanel>
            <ChartPanel title="Assets by campus" rows={campuses}><Bar data={campusChart} options={chartOptions} /></ChartPanel>
            <ChartPanel title="Asset age" rows={ageRows}><Bar data={ageChart} options={chartOptions} /></ChartPanel>
            <ChartPanel title="Acquisition trends" rows={acquisitionRows}><Line data={acquisitionChart} options={chartOptions} /></ChartPanel>
            <ChartPanel title="Maintenance requests over time" rows={maintenance}><Line data={maintenanceChart} options={chartOptions} /></ChartPanel>
          </div>
          <div className="admin-kpi-grid" style={{ marginTop: 18 }}>
            <Metric label="Maintenance requests" value={formatNumber(data.maintenance?.totalRequests)} icon={Wrench} tone="#D97706" />
            <Metric label="Assets maintained" value={formatNumber(data.maintenance?.assetsMaintained)} icon={Wrench} tone="#0891B2" />
            <Metric label="Open maintenance" value={formatNumber(data.maintenance?.openRequests)} icon={Wrench} tone="#DC2626" />
            <Metric label="Completed maintenance" value={formatNumber(data.maintenance?.completedRequests)} icon={Wrench} tone="#16A34A" />
            <Metric label="Average maintenance frequency" value={data.maintenance?.averageFrequency === null ? 'Not available' : `${formatNumber(data.maintenance?.averageFrequency)} per maintained asset`} icon={Wrench} tone="#7C3AED" />
            <Metric label="Average repair time" value="Not available" icon={Wrench} tone="#64748B" />
          </div>
            <div className="admin-card" style={{ marginTop: 18 }}>
            <h2 style={{ margin: '0 0 12px', color: 'var(--admin-text)', fontSize: '1rem' }}>Research-grant assets</h2>
            <div className="admin-kpi-grid" style={{ marginBottom: 12 }}>
              <Metric label="Grant assets" value={formatNumber(grantAssets.totalAssets)} icon={Package} tone="#3074B3" />
              <Metric label="Grant asset value" value={formatMoney(grantAssets.totalValue)} icon={CircleDollarSign} tone="#7C3AED" />
            </div>
            {(grantAssets.bySource || []).length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Grant / recorded source</th><th>Assets</th><th>Value</th></tr></thead><tbody>{grantAssets.bySource.map((item) => <tr key={item.source}><td>{item.source}</td><td>{formatNumber(item.count)}</td><td>{formatMoney(item.value)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No research-grant assets are recorded in the selected data.</div>}
          </div>
          <div className="admin-card" style={{ marginTop: 18 }}>
            <h2 style={{ margin: '0 0 12px', color: 'var(--admin-text)', fontSize: '1rem' }}>Frequently maintained assets</h2>
            {frequentMaintenance.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Asset</th><th>Asset code</th><th>Category</th><th>Department</th><th><button type="button" className="admin-secondary-button" onClick={() => setMaintenanceAscending((current) => !current)}>Maintenance count {maintenanceAscending ? '↑' : '↓'}</button></th><th>Last maintenance</th><th>Status</th></tr></thead><tbody>{frequentMaintenance.map((item) => <tr key={item.id}><td>{item.name || 'Not available'}</td><td>{item.assetCode || 'Not available'}</td><td>{item.category || 'Not available'}</td><td>{item.department || 'Not available'}</td><td>{formatNumber(item.maintenanceCount)}</td><td>{item.lastMaintenance ? new Date(item.lastMaintenance).toLocaleDateString() : 'Not available'}</td><td>{item.status || 'Not available'}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No maintenance activity recorded for the selected period.</div>}
          </div>
          <div className="admin-card" style={{ marginTop: 18 }}>
            <h2 style={{ margin: '0 0 12px', color: 'var(--admin-text)', fontSize: '1rem' }}>Assets by category</h2>
            {categories.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Category</th><th>Asset count</th><th>Share</th><th>Total value</th></tr></thead><tbody>{categories.map((item) => <tr key={item.category}><td>{item.category}</td><td>{formatNumber(item.count)}</td><td>{kpis.totalAssets ? `${((item.count / kpis.totalAssets) * 100).toFixed(1)}%` : 'Not available'}</td><td>{formatMoney(item.value)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No asset data available for this view.</div>}
          </div>
          <p className="admin-page-subtitle" style={{ marginTop: 18 }}>Maintenance department/category breakdowns, grant/project names, and repair completion durations are unavailable because those details are not consistently recorded by the current data model.</p>
        </>
      )}
    </section>
  );
};

export default AdminAssetAnalytics;