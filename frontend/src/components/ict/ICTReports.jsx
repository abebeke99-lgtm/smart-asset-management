import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, FileBarChart, Filter, RefreshCw, RotateCcw, Search, SlidersHorizontal, Wrench, UserCheck, Radio, Package } from 'lucide-react';
import { getApiErrorMessage } from '../../services/apiClient';
import { exportIctReport, getIctReports } from '../../services/ictReportsService';

const REPORT_TYPES = {
  inventory: { label: 'Asset Inventory Report', icon: Package },
  status: { label: 'Asset Status Report', icon: FileBarChart },
  assignments: { label: 'Asset Assignment Report', icon: UserCheck },
  maintenance: { label: 'Maintenance Report', icon: Wrench },
  rfid: { label: 'RFID Tracking Report', icon: Radio },
};
const initialFilters = { search: '', category: '', status: '', condition: '', location: '', departmentId: '', dateFrom: '', dateTo: '', sortBy: 'updatedAt', sortOrder: 'DESC' };
const columnsFor = (type) => ({
  inventory: [['assetTag', 'Asset Tag'], ['name', 'Asset Name'], ['category', 'Category'], ['serialNumber', 'Serial Number'], ['status', 'Status'], ['condition', 'Condition'], ['department', 'Department'], ['location', 'Location'], ['assignedTo', 'Assigned To'], ['purchaseDate', 'Purchase Date']],
  status: [['status', 'Status'], ['count', 'Records']],
  assignments: [['assetTag', 'Asset Tag'], ['asset', 'Asset'], ['assignedTo', 'Assigned To'], ['department', 'Department'], ['assignedDate', 'Assigned Date'], ['status', 'Status'], ['location', 'Location']],
  maintenance: [['assetTag', 'Asset Tag'], ['asset', 'Asset'], ['title', 'Title'], ['status', 'Status'], ['priority', 'Priority'], ['reportedDate', 'Reported Date'], ['completedDate', 'Updated Date'], ['technician', 'Technician']],
  rfid: [['assetTag', 'Asset Tag'], ['asset', 'Asset'], ['tag', 'RFID Tag'], ['action', 'Action'], ['location', 'Location'], ['readerId', 'Reader'], ['detectedAt', 'Detected At']],
}[type] || []);
const displayValue = (value) => value === null || value === undefined || value === '' ? '—' : value;
const formatCell = (key, value) => key.toLowerCase().includes('date') || key.toLowerCase().includes('at') ? (value ? new Date(value).toLocaleDateString() : '—') : displayValue(value);

const ICTReports = () => {
  const [reportType, setReportType] = useState('inventory');
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState({ data: [], summary: {}, filters: {}, pagination: { page: 1, limit: 25, total: 0, totalPages: 0 }, generatedAt: null, scope: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const requestParams = useMemo(() => ({ type: reportType, page, limit: report.pagination.limit || 25, ...filters }), [filters, page, report.pagination.limit, reportType]);
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try { const response = await getIctReports(requestParams); setReport(response.data); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to generate the report. Please check your filters and try again.')); }
    finally { setLoading(false); }
  }, [requestParams]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const changeFilter = (name, value) => { setPage(1); setFilters((current) => ({ ...current, [name]: value })); };
  const resetFilters = () => { setPage(1); setFilters(initialFilters); };
  const changeReport = (value) => { setPage(1); setReportType(value); setFilters(initialFilters); };
  const exportCsv = async () => {
    if (!report.pagination.total || exporting) return;
    setExporting(true);
    try {
      const response = await exportIctReport({ type: reportType, ...filters });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${reportType}-report.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to export the report.')); }
    finally { setExporting(false); }
  };

  const metadata = report.filters || {};
  const columns = columnsFor(reportType);
  const Icon = REPORT_TYPES[reportType].icon;
  const summaryEntries = reportType === 'inventory' ? [['totalAssets', 'Total Assets'], ['assigned', 'Assigned'], ['available', 'Available'], ['underMaintenance', 'Under Maintenance']] : reportType === 'assignments' ? [['totalAssignments', 'Total Assignments'], ['active', 'Active'], ['returned', 'Returned']] : reportType === 'maintenance' ? [['totalMaintenance', 'Total Maintenance'], ['open', 'Open'], ['completed', 'Completed']] : reportType === 'rfid' ? [['totalScans', 'Total Scans'], ['uniqueAssets', 'Unique Assets']] : [['totalAssets', 'Total Assets']];

  return <main style={{ maxWidth: 1500, margin: '0 auto', padding: '28px 24px', color: '#18324b' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}><span style={{ background: '#e6f4f1', color: '#087f75', padding: 12, borderRadius: 10 }}><FileBarChart size={24} aria-hidden="true" /></span><div><h1 style={{ margin: 0, fontSize: 28 }}>ICT Reports</h1><p style={{ margin: '6px 0 0', color: '#60758a' }}>Generate, review, and export operational reports from real ICT asset data.</p></div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><button type="button" onClick={loadReport} disabled={loading} aria-label="Refresh report" style={buttonStyle('secondary')}><RefreshCw size={16} /> Refresh</button><button type="button" onClick={exportCsv} disabled={exporting || loading || !report.pagination.total} style={buttonStyle('primary')}><Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}</button></div>
    </header>

    <section style={panelStyle} aria-label="Report controls"><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><SlidersHorizontal size={18} /><strong>Report Controls</strong></div><div style={gridStyle}>
      <label style={labelStyle}>Report Type<select value={reportType} onChange={(event) => changeReport(event.target.value)} style={inputStyle}>{Object.entries(REPORT_TYPES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
      <label style={labelStyle}>Search<div style={{ position: 'relative' }}><Search size={16} style={iconInputStyle} /><input value={filters.search} onChange={(event) => changeFilter('search', event.target.value)} placeholder="Asset, serial, or location" style={{ ...inputStyle, paddingLeft: 34 }} /></div></label>
      <label style={labelStyle}>From Date<div style={{ position: 'relative' }}><CalendarDays size={16} style={iconInputStyle} /><input type="date" value={filters.dateFrom} onChange={(event) => changeFilter('dateFrom', event.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} /></div></label>
      <label style={labelStyle}>To Date<div style={{ position: 'relative' }}><CalendarDays size={16} style={iconInputStyle} /><input type="date" value={filters.dateTo} onChange={(event) => changeFilter('dateTo', event.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} /></div></label>
      <Option label="Category" value={filters.category} onChange={(value) => changeFilter('category', value)} options={metadata.categories} /><Option label="Status" value={filters.status} onChange={(value) => changeFilter('status', value)} options={metadata.statuses} /><Option label="Condition" value={filters.condition} onChange={(value) => changeFilter('condition', value)} options={metadata.conditions} /><Option label="Department" value={filters.departmentId} onChange={(value) => changeFilter('departmentId', value)} options={metadata.departments} objectOptions /><Option label="Location" value={filters.location} onChange={(value) => changeFilter('location', value)} options={metadata.locations} />
      <label style={labelStyle}>Rows<select value={report.pagination.limit || 25} onChange={(event) => { setPage(1); setReport((current) => ({ ...current, pagination: { ...current.pagination, limit: Number(event.target.value) } })); }} style={inputStyle}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
    </div><button type="button" onClick={resetFilters} style={{ ...buttonStyle('link'), marginTop: 14 }}><RotateCcw size={15} /> Reset Filters</button></section>

    {error ? <section style={{ ...panelStyle, borderColor: '#e7a1a1', background: '#fff7f7' }} role="alert"><strong>Unable to generate the report.</strong><p>{error}</p><button type="button" onClick={loadReport} style={buttonStyle('primary')}>Retry</button></section> : <>
      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '22px 0' }} aria-label="Report summary">{summaryEntries.map(([key, label]) => <div key={key} style={summaryStyle}><span style={{ color: '#60758a', fontSize: 13 }}>{label}</span><strong style={{ display: 'block', fontSize: 24, marginTop: 6 }}>{displayValue(report.summary?.[key] ?? 0)}</strong></div>)}</section>
      <section style={panelStyle}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}><div><h2 style={{ margin: 0, fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><Icon size={20} /> {REPORT_TYPES[reportType].label}</h2><p style={{ margin: '6px 0 0', color: '#60758a', fontSize: 13 }}>Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'} · {report.scope?.collegeName || 'Authorized college'} · {report.pagination.total || 0} records</p></div><span style={{ color: '#60758a', fontSize: 13 }}><Filter size={14} style={{ verticalAlign: 'middle' }} /> Filters are applied on the server</span></div>
        {loading ? <div style={{ padding: 50, textAlign: 'center', color: '#60758a' }}>Generating report...</div> : report.data?.length ? <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr>{columns.map(([, label]) => <th key={label} scope="col" style={thStyle}>{label}</th>)}</tr></thead><tbody>{report.data.map((row) => <tr key={row.id}>{columns.map(([key]) => <td key={key} style={tdStyle}>{formatCell(key, row[key])}</td>)}</tr>)}</tbody></table></div> : <div style={{ padding: 50, textAlign: 'center', color: '#60758a' }}><strong>No data found</strong><p>No records match the selected report filters.</p></div>}
        {!loading && report.pagination.totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 12 }}><span style={{ color: '#60758a', fontSize: 13 }}>Page {report.pagination.page} of {report.pagination.totalPages}</span><div style={{ display: 'flex', gap: 8 }}><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} style={buttonStyle('secondary')}>Previous</button><button type="button" disabled={page >= report.pagination.totalPages} onClick={() => setPage((current) => current + 1)} style={buttonStyle('secondary')}>Next</button></div></div>}
      </section>
    </>}
  </main>;
};

const Option = ({ label, value, onChange, options = [], objectOptions = false }) => <label style={labelStyle}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}><option value="">All {label}s</option>{options.map((option) => <option key={objectOptions ? option.id : option} value={objectOptions ? option.id : option}>{objectOptions ? option.name : option}</option>)}</select></label>;
const panelStyle = { background: '#fff', border: '1px solid #dfe8ee', borderRadius: 8, padding: 20, boxShadow: '0 5px 18px rgba(22, 53, 76, 0.05)', marginBottom: 20 };
const summaryStyle = { background: '#fff', border: '1px solid #dfe8ee', borderTop: '3px solid #0b8f83', borderRadius: 8, padding: '14px 18px', minWidth: 170, flex: '1 1 170px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#36526a' };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #c9d7e0', borderRadius: 6, padding: '9px 10px', background: '#fff', color: '#18324b', font: 'inherit', fontWeight: 400 };
const iconInputStyle = { position: 'absolute', left: 10, top: 11, color: '#7890a2' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: 900 };
const thStyle = { textAlign: 'left', padding: '12px 10px', background: '#f3f7f8', color: '#36526a', borderBottom: '1px solid #dfe8ee', fontSize: 12, textTransform: 'uppercase' };
const tdStyle = { padding: '12px 10px', borderBottom: '1px solid #edf1f3', color: '#29465c', fontSize: 13, whiteSpace: 'nowrap' };
const buttonStyle = (variant) => ({ display: 'inline-flex', alignItems: 'center', gap: 7, border: variant === 'link' ? 0 : '1px solid #c9d7e0', borderRadius: 6, padding: '9px 12px', cursor: 'pointer', background: variant === 'primary' ? '#087f75' : variant === 'link' ? 'transparent' : '#fff', color: variant === 'primary' ? '#fff' : '#36526a', fontWeight: 600 });

export default ICTReports;