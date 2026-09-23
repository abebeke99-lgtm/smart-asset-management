import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Download, FileText, Printer, RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-toastify';

const REPORTS = [
  { value: 'assets', label: 'Asset Register', filters: ['department', 'location', 'category', 'status', 'condition'] },
  { value: 'departments', label: 'Department Asset Report', filters: [] },
  { value: 'inventory', label: 'Inventory Report', filters: ['department', 'category', 'location', 'status', 'condition'] },
  { value: 'assignments', label: 'Assignment Report', filters: ['department', 'status', 'date'] },
  { value: 'transfers', label: 'Transfer Report', filters: ['department', 'status', 'date'] },
  { value: 'maintenance', label: 'Maintenance Report', filters: ['status', 'date'] },
  { value: 'users', label: 'User Report', filters: ['department'] },
];

const INITIAL_FILTERS = { department: '', category: '', location: '', status: '', condition: '', dateFrom: '', dateTo: '', search: '' };
const FILTER_LABELS = { department: 'Department', category: 'Category', location: 'Location', status: 'Status', condition: 'Condition', dateFrom: 'Date from', dateTo: 'Date to', search: 'Search' };

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const formatCurrency = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayValue = (value, key) => {
  if (value === null || value === undefined || value === '') return '—';
  if (['assignmentDate', 'transferDate', 'completedDate', 'reportedDate', 'purchaseDate', 'lastUpdated'].includes(key)) return formatDate(value);
  if (['assetValue', 'totalValue'].includes(key)) return formatCurrency(value);
  return String(value);
};

const getColumns = (reportType) => ({
  assets: [['assetCode', 'Asset ID'], ['name', 'Asset'], ['category', 'Category'], ['location', 'Location'], ['assignedTo', 'Custodian'], ['assetValue', 'Value'], ['status', 'Status']],
  inventory: [['assetCode', 'Asset ID'], ['name', 'Asset'], ['category', 'Category'], ['location', 'Location'], ['assignedTo', 'Custodian'], ['assetValue', 'Value'], ['status', 'Status']],
  departments: [['department', 'Department'], ['totalAssets', 'Total Assets'], ['assigned', 'Assigned'], ['available', 'Available'], ['underMaintenance', 'Maintenance']],
  assignments: [['asset', 'Asset'], ['assignedTo', 'Assignee'], ['department', 'Department'], ['assignmentDate', 'Assignment Date'], ['status', 'Status']],
  transfers: [['asset', 'Asset'], ['fromDepartment', 'From Department'], ['toDepartment', 'To Department'], ['transferDate', 'Transfer Date'], ['status', 'Status']],
  maintenance: [['asset', 'Asset'], ['title', 'Maintenance Type'], ['priority', 'Priority'], ['status', 'Status'], ['technician', 'Technician'], ['reportedDate', 'Scheduled Date']],
  users: [['fullName', 'User'], ['role', 'Role'], ['department', 'Department'], ['email', 'Email']],
}[reportType] || []);

const extractArray = (value, key) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
};

const AdminReports = () => {
  const [reportType, setReportType] = useState('assets');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [options, setOptions] = useState({ departments: [], categories: [], locations: [] });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selectedReport = useMemo(() => REPORTS.find((item) => item.value === reportType), [reportType]);
  const columns = useMemo(() => getColumns(reportType), [reportType]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([axios.get('/api/departments'), axios.get('/api/categories'), axios.get('/api/locations')]).then(([departments, categories, locations]) => {
      if (!active) return;
      setOptions({
        departments: departments.status === 'fulfilled' ? extractArray(departments.value.data, 'departments') : [],
        categories: categories.status === 'fulfilled' ? extractArray(categories.value.data, 'categories') : [],
        locations: locations.status === 'fulfilled' ? extractArray(locations.value.data, 'locations') : [],
      });
    });
    return () => { active = false; };
  }, []);

  const buildParams = useCallback(() => {
    const params = { reportType, limit: 200 };
    if (filters.department) params.department_id = filters.department;
    if (filters.category) params.category = filters.category;
    if (filters.location) params.location = filters.location;
    if (filters.status) params.status = filters.status;
    if (filters.condition) params.condition = filters.condition;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.search) params.search = filters.search;
    return params;
  }, [filters, reportType]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const response = await axios.get('/api/reports', { params: buildParams(), timeout: 30000 });
      setReport(response.data);
    } catch (requestError) {
      const message = requestError?.response?.data?.message || 'The report could not be generated from the server.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const exportCsv = async () => {
    if (!report) return;
    try {
      const response = await axios.get('/api/reports/export', { params: buildParams(), responseType: 'blob', timeout: 30000 });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_report.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'The report could not be exported.');
    }
  };

  const changeReportType = (event) => {
    setReportType(event.target.value);
    setFilters(INITIAL_FILTERS);
    setReport(null);
    setError('');
  };
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reportRows = Array.isArray(report?.data) ? report.data : [];
  const generatedAt = report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : '';
  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  return (
    <main className="reports-page" aria-labelledby="reports-title">
      <header className="reports-header">
        <div><p className="reports-breadcrumb">Admin / Reports</p><h1 id="reports-title">Reports</h1><p>Generate official university asset-management reports using real system data.</p></div>
        <div className="reports-actions">
          <button type="button" className="report-button report-button-secondary" onClick={generateReport} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
          {report && <button type="button" className="report-button report-button-secondary" onClick={exportCsv}><Download size={16} aria-hidden="true" /> Export CSV</button>}
          {report && reportRows.length > 0 && <button type="button" className="report-button report-button-secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print</button>}
        </div>
      </header>

      <section className="report-panel report-controls" aria-label="Report selection and filters">
        <div className="report-selector-row"><label htmlFor="report-type">Report type</label><select id="report-type" value={reportType} onChange={changeReportType}>{REPORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="report-filter-grid">
          {selectedReport.filters.includes('department') && <FilterSelect label="Department" value={filters.department} options={options.departments} onChange={(value) => setFilter('department', value)} />}
          {selectedReport.filters.includes('category') && <FilterSelect label="Category" value={filters.category} options={options.categories} onChange={(value) => setFilter('category', value)} />}
          {selectedReport.filters.includes('location') && <FilterSelect label="Location" value={filters.location} options={options.locations} onChange={(value) => setFilter('location', value)} />}
          {selectedReport.filters.includes('status') && <input aria-label="Status" placeholder="Status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)} />}
          {selectedReport.filters.includes('condition') && <input aria-label="Condition" placeholder="Condition" value={filters.condition} onChange={(event) => setFilter('condition', event.target.value)} />}
          {selectedReport.filters.includes('date') && <input aria-label="Date from" type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} />}
          {selectedReport.filters.includes('date') && <input aria-label="Date to" type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} />}
          <div className="report-search"><Search size={16} aria-hidden="true" /><input aria-label="Search" placeholder="Search report records" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} /></div>
        </div>
        <button type="button" className="report-button report-button-primary" onClick={generateReport} disabled={loading}><FileText size={16} aria-hidden="true" /> {loading ? 'Generating report...' : 'Generate Report'}</button>
      </section>

      {activeFilters.length > 0 && <p className="report-filter-summary">Filters applied: {activeFilters.map(([key, value]) => `${FILTER_LABELS[key] || key}: ${value}`).join(' | ')}</p>}
      {error && <section className="report-state report-error" role="alert"><AlertTriangle size={22} aria-hidden="true" /><div><h2>Unable to generate report</h2><p>{error}</p><button type="button" className="report-button report-button-secondary" onClick={generateReport}>Retry</button></div></section>}
      {report && <section className="report-preview" aria-live="polite"><div className="report-preview-header"><div><p className="reports-breadcrumb">Mekdela Amba University</p><h2>{selectedReport.label}</h2><p>Generated {generatedAt}</p></div><div className="report-record-count">{report.pagination?.total || 0} records</div></div>{reportRows.length === 0 ? <div className="report-state"><h2>No records found</h2><p>No data matches the selected filters.<br />Try changing the filters and generate the report again.</p></div> : <div className="report-table-wrap"><table><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{reportRows.map((row, index) => <tr key={row.id || index}>{columns.map(([key]) => <td key={key}>{displayValue(row[key], key)}</td>)}</tr>)}</tbody></table></div>}</section>}
      {!report && !error && !loading && <section className="report-state report-panel"><FileText size={28} aria-hidden="true" /><h2>Choose a report to begin</h2><p>Select filters, then generate an official report from the server.</p></section>}
      {loading && <section className="report-state report-panel" aria-live="polite"><RefreshCw className="report-spin" size={28} aria-hidden="true" /><h2>Generating report...</h2></section>}
    </main>
  );
};

const FilterSelect = ({ label, value, options, onChange }) => <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">All {label}s</option>{options.map((option) => { const optionValue = option.id || option.name || option; const optionLabel = option.name || option; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select>;

export default AdminReports;
