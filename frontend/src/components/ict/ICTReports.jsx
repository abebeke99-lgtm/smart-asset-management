import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { exportIctReport, getIctReports } from '../../services/ictReportsService';
import './ICTReports.css';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 100;

const REPORT_TYPES = [
  { value: 'inventory', label: 'Asset Inventory' },
  { value: 'assignments', label: 'Assignment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'damaged', label: 'Damaged Assets' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'transfers', label: 'Transfer' },
  { value: 'support', label: 'Service Tickets' },
  { value: 'incidents', label: 'Incidents' },
  { value: 'software-licenses', label: 'Software Licenses' },
];

const REPORT_COLUMNS = {
  inventory: [
    ['assetTag', 'Asset ID'], ['name', 'Asset'], ['category', 'Category'], ['serialNumber', 'Serial Number'],
    ['status', 'Status'], ['condition', 'Condition'], ['department', 'Department'], ['location', 'Location'],
    ['assignedTo', 'Assigned To'], ['purchaseDate', 'Purchase Date'],
  ],
  assignments: [
    ['assetTag', 'Asset ID'], ['asset', 'Asset'], ['assignedTo', 'Assigned To'], ['assignedBy', 'Assigned By'],
    ['department', 'Department'], ['assignedDate', 'Assigned Date'], ['status', 'Status'], ['location', 'Location'],
  ],
  maintenance: [
    ['assetTag', 'Asset ID'], ['asset', 'Asset'], ['title', 'Request'], ['type', 'Type'], ['priority', 'Priority'],
    ['status', 'Status'], ['technician', 'Technician'], ['reportedDate', 'Reported'], ['completedDate', 'Completed'], ['location', 'Location'],
  ],
  damaged: [
    ['assetTag', 'Asset ID'], ['name', 'Asset'], ['category', 'Category'], ['serialNumber', 'Serial Number'],
    ['status', 'Status'], ['condition', 'Condition'], ['department', 'Department'], ['location', 'Location'], ['lastUpdated', 'Last Updated'],
  ],
  warranty: [
    ['assetTag', 'Asset ID'], ['name', 'Asset'], ['category', 'Category'], ['serialNumber', 'Serial Number'],
    ['warrantyStatus', 'Warranty Status'], ['warrantyExpiry', 'Warranty Expiry'], ['department', 'Department'], ['location', 'Location'],
  ],
  transfers: [
    ['transferNumber', 'Transfer ID'], ['assetTag', 'Asset ID'], ['asset', 'Asset'], ['fromDepartment', 'From Department'],
    ['toDepartment', 'To Department'], ['fromLocation', 'From Location'], ['toLocation', 'To Location'],
    ['transferDate', 'Transfer Date'], ['status', 'Status'], ['reason', 'Reason'],
  ],
  support: [
    ['ticketNumber', 'Ticket'], ['title', 'Title'], ['category', 'Category'], ['priority', 'Priority'], ['status', 'Status'],
    ['requester', 'Requester'], ['assignedTo', 'Assigned To'], ['asset', 'Asset'], ['department', 'Department'],
    ['createdAt', 'Created'], ['completedAt', 'Completed'], ['resolution', 'Resolution'],
  ],
  incidents: [
    ['incidentNumber', 'Incident'], ['title', 'Title'], ['category', 'Category'], ['priority', 'Priority'], ['status', 'Status'],
    ['reporter', 'Reporter'], ['assignedTo', 'Assigned To'], ['asset', 'Asset'], ['department', 'Department'],
    ['reportedAt', 'Reported'], ['resolvedAt', 'Resolved'], ['resolution', 'Resolution'],
  ],
  'software-licenses': [
    ['softwareName', 'Software'], ['vendor', 'Vendor'], ['version', 'Version'], ['licenseType', 'License Type'],
    ['status', 'Status'], ['expiryDate', 'Expiry Date'], ['quantity', 'Quantity'], ['usedQuantity', 'Used'],
    ['assignedDevices', 'Assigned Devices'], ['assignedUsers', 'Assigned Users'],
  ],
};

const SUMMARY_CARDS = {
  inventory: [['totalAssets', 'Total Assets'], ['available', 'Available'], ['assigned', 'Assigned'], ['underMaintenance', 'Under Maintenance']],
  assignments: [['totalAssignments', 'Total Assignments'], ['active', 'Active'], ['returned', 'Returned']],
  maintenance: [['totalMaintenance', 'Maintenance Requests'], ['open', 'Open'], ['completed', 'Completed']],
  damaged: [['totalDamaged', 'Damaged Assets']],
  warranty: [['totalWarranties', 'Covered Assets'], ['active', 'Active'], ['expiringSoon', 'Expiring Soon'], ['expired', 'Expired'], ['noWarranty', 'No Warranty']],
  transfers: [['totalTransfers', 'Total Transfers'], ['pending', 'Pending'], ['completed', 'Completed']],
  support: [['totalRequests', 'Total Tickets'], ['active', 'Active'], ['resolved', 'Resolved'], ['closed', 'Closed']],
  incidents: [['totalIncidents', 'Total Incidents'], ['open', 'Open'], ['resolved', 'Resolved'], ['critical', 'Critical']],
  'software-licenses': [['totalLicenses', 'Total Licenses'], ['active', 'Active'], ['expiringSoon', 'Expiring Soon'], ['expired', 'Expired']],
};

const emptyFilters = () => ({
  search: '',
  status: '',
  category: '',
  condition: '',
  priority: '',
  departmentId: '',
  location: '',
  dateFrom: '',
  dateTo: '',
});

const flattenValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const downloadBlob = (blob, filename) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export default function ICTReports() {
  const auth = useAuth();
  const canExport = typeof auth?.hasPermission !== 'function' || auth.hasPermission('ict.reports.export');
  const [reportType, setReportType] = useState('inventory');
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState({ data: [], summary: {}, filters: {}, pagination: { total: 0, totalPages: 0 }, scope: {} });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const query = useMemo(() => {
    const params = { type: reportType, page, limit: PAGE_SIZE, sortBy: 'updatedAt', sortOrder: 'DESC' };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    return params;
  }, [filters, page, reportType]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getIctReports(query, { signal: controller.signal });
        setReport({
          data: Array.isArray(response.data.data) ? response.data.data : [],
          summary: response.data.summary || {},
          filters: response.data.filters || {},
          pagination: response.data.pagination || { total: 0, totalPages: 0 },
          scope: response.data.scope || {},
        });
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load this report.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, refreshKey]);

  const currentReport = REPORT_TYPES.find((item) => item.value === reportType);
  const columns = REPORT_COLUMNS[reportType] || [];
  const summaryCards = SUMMARY_CARDS[reportType] || [];

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  const changeReport = (event) => {
    setReportType(event.target.value);
    setFilters(emptyFilters());
    setPage(1);
  };

  const fetchAllRows = async (params) => {
    const first = await getIctReports({ ...params, page: 1, limit: EXPORT_PAGE_SIZE });
    const firstBody = first.data;
    const allRows = [...(firstBody.data || [])];
    const pages = Number(firstBody.pagination?.totalPages || 1);
    for (let currentPage = 2; currentPage <= pages; currentPage += 1) {
      const response = await getIctReports({ ...params, page: currentPage, limit: EXPORT_PAGE_SIZE });
      allRows.push(...(response.data.data || []));
    }
    return allRows;
  };

  const exportReport = async (format) => {
    setExporting(true);
    setError('');
    const { page: ignoredPage, limit: ignoredLimit, ...exportFilters } = query;
    const filename = `ict-${reportType}-report-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (format === 'csv') {
        const response = await exportIctReport(exportFilters);
        downloadBlob(response.data, `${filename}.csv`);
        return;
      }
      const rows = await fetchAllRows(exportFilters);
      if (format === 'excel') {
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, currentReport.label);
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else {
        const pdf = new jsPDF({ orientation: 'landscape' });
        pdf.setFontSize(15);
        pdf.text(`${currentReport.label} Report`, 14, 15);
        pdf.setFontSize(9);
        pdf.text(`Scope: ${report.scope.collegeName || 'Authorized college'} | Rows: ${rows.length}`, 14, 21);
        pdf.autoTable({
          startY: 26,
          head: [columns.map(([, label]) => label)],
          body: rows.map((row) => columns.map(([key]) => flattenValue(row[key]))),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [29, 78, 121] },
        });
        pdf.save(`${filename}.pdf`);
      }
    } catch (exportError) {
      setError(exportError.response?.data?.message || exportError.message || `Unable to export ${format.toUpperCase()}.`);
    } finally {
      setExporting(false);
    }
  };

  const departmentOptions = report.filters.departments || [];
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const pageCount = Math.max(1, Number(report.pagination.totalPages || 1));

  return (
    <main className="ict-reports-page">
      <header className="ict-reports-header">
        <div>
          <p className="ict-reports-eyebrow">ICT ASSET MANAGEMENT</p>
          <h1>ICT Reports</h1>
          <p>Live reports from the authorized ICT inventory and service records.</p>
        </div>
        <div className="ict-reports-actions">
          {canExport && (
            <>
              <button type="button" onClick={() => window.print()} disabled={loading}>
                <Printer size={16} /> Print
              </button>
              <button type="button" onClick={() => exportReport('csv')} disabled={exporting || !report.pagination.total}>
                <Download size={16} /> CSV
              </button>
              <button type="button" onClick={() => exportReport('excel')} disabled={exporting || !report.pagination.total}>
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button type="button" onClick={() => exportReport('pdf')} disabled={exporting || !report.pagination.total}>
                <Download size={16} /> PDF
              </button>
            </>
          )}
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'ict-reports-spinning' : ''} /> Refresh
          </button>
        </div>
      </header>

      <section className="ict-reports-toolbar" aria-label="Report selection">
        <label>
          <span>Report</span>
          <select aria-label="Select report" value={reportType} onChange={changeReport}>
            {REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <span className="ict-reports-scope">Data scope: {report.scope.collegeName || 'Loading authorized scope…'}</span>
      </section>

      {error && <div role="alert" className="ict-reports-error"><AlertCircle size={18} />{error}</div>}

      <section className="ict-reports-summary" aria-label={`${currentReport.label} totals`}>
        {summaryCards.map(([key, label]) => (
          <article key={key}>
            <span>{label}</span>
            <strong>{loading ? '—' : Number(report.summary[key] || 0).toLocaleString()}</strong>
          </article>
        ))}
      </section>

      <section className="ict-reports-filters" aria-label="Report filters">
        <label className="ict-reports-search">
          <Search size={17} />
          <input
            aria-label="Search report"
            name="search"
            placeholder="Search this report…"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {(report.filters.statuses || []).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {report.filters.categories?.length > 0 && (
          <label>
            <span>Category</span>
            <select aria-label="Filter by category" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
              <option value="">All categories</option>
              {report.filters.categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        {report.filters.conditions?.length > 0 && (
          <label>
            <span>Condition</span>
            <select aria-label="Filter by condition" value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)}>
              <option value="">All conditions</option>
              {report.filters.conditions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        {report.filters.priorities?.length > 0 && (
          <label>
            <span>Priority</span>
            <select aria-label="Filter by priority" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
              <option value="">All priorities</option>
              {report.filters.priorities.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        {departmentOptions.length > 0 && (
          <label>
            <span>Department</span>
            <select aria-label="Filter by department" value={filters.departmentId} onChange={(event) => updateFilter('departmentId', event.target.value)}>
              <option value="">All departments</option>
              {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
        )}
        {report.filters.locations?.length > 0 && (
          <label>
            <span>Location</span>
            <select aria-label="Filter by location" value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}>
              <option value="">All locations</option>
              {report.filters.locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
        )}
        <label className="ict-reports-date-filter">
          <CalendarDays size={15} />
          <span>From</span>
          <input aria-label="Date from" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
        </label>
        <label className="ict-reports-date-filter">
          <CalendarDays size={15} />
          <span>To</span>
          <input aria-label="Date to" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
        </label>
        {hasActiveFilters && (
          <button className="ict-reports-clear" type="button" onClick={() => { setFilters(emptyFilters()); setPage(1); }}>
            Clear filters
          </button>
        )}
      </section>

      <section className="ict-reports-table-card">
        <div className="ict-reports-table-heading">
          <div>
            <h2>{currentReport.label}</h2>
            <p>{Number(report.pagination.total || 0).toLocaleString()} matching records</p>
          </div>
          <span>MySQL · generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}</span>
        </div>
        <div className="ict-reports-table-scroll">
          <table>
            <thead>
              <tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length} className="ict-reports-empty">Loading report records…</td></tr>
              ) : report.data.length ? report.data.map((row, index) => (
                <tr key={row.id || `${reportType}-${index}`}>
                  {columns.map(([key]) => <td key={key}>{flattenValue(row[key])}</td>)}
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="ict-reports-empty">
                  {error ? 'The report could not be loaded.' : 'No matching records found.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="ict-reports-pagination">
          <span>Page {report.pagination.page || page} of {pageCount}</span>
          <div>
            <button type="button" aria-label="Previous report page" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>
              <ChevronLeft size={16} /> Previous
            </button>
            <button type="button" aria-label="Next report page" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page >= pageCount || loading}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
