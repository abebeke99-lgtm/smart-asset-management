import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, CalendarRange, Download, Filter, Package, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const REPORT_TYPES = [
  { value: 'inventory', label: 'Asset Inventory' },
  { value: 'status', label: 'Asset Status' },
  { value: 'departments', label: 'Department Assets' },
  { value: 'assignments', label: 'Asset Assignments' },
  { value: 'transfers', label: 'Asset Transfers' },
  { value: 'returns', label: 'Asset Returns' },
  { value: 'maintenance', label: 'Maintenance Activity' },
  { value: 'verification', label: 'Verification Activity' },
  { value: 'requests', label: 'Asset Requests' },
  { value: 'movement', label: 'Asset Movement' },
];

const emptySummary = { totalAssets: 0, activeAssets: 0, assignedAssets: 0, availableAssets: 0, underMaintenance: 0, totalAssignments: 0, totalTransfers: 0, totalReturns: 0, totalMaintenance: 0, totalRequests: 0, totalSessions: 0, totalMovements: 0 };

const labelize = (value = '') => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const dateDisplay = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};
const money = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'ETB' });
};

const CollegeReports = () => {
  const [reportType, setReportType] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ departmentId: '', categoryId: '', status: '', dateFrom: '', dateTo: '', search: '' });
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ data: [], summary: emptySummary, filters: { departments: [], categories: [], statuses: [] }, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, charts: [], college: null, reportType: 'inventory' });

  const loadReports = async (nextPage = page) => {
    setTableLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/reports', {
        params: {
          page: nextPage,
          limit: 20,
          reportType,
          departmentId: filters.departmentId || undefined,
          categoryId: filters.categoryId || undefined,
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          search: filters.search || undefined,
        },
      });
      const data = response.data || {};
      setPayload({
        data: data.data || [],
        summary: data.summary || emptySummary,
        filters: data.filters || { departments: [], categories: [], statuses: [] },
        pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 },
        charts: data.charts || [],
        college: data.college || null,
        reportType: data.reportType || reportType,
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadReports(1);
    setPage(1);
  }, [reportType]);

  useEffect(() => {
    if (!loading) {
      loadReports(page);
    }
  }, [filters.departmentId, filters.categoryId, filters.status, filters.dateFrom, filters.dateTo, filters.search]);

  const hasFilters = Object.values(filters).some((value) => Boolean(value));

  const tableHeaders = useMemo(() => {
    if (reportType === 'inventory') return ['Asset Code', 'Asset Name', 'Category', 'Department', 'Location', 'Status', 'Condition', 'Assigned To', 'Purchase Date', 'Asset Value', 'Last Updated'];
    if (reportType === 'status') return ['Status', 'Count', 'Percentage'];
    if (reportType === 'departments') return ['Department', 'Staff Count', 'Total Assets', 'Assigned', 'Available', 'Under Maintenance', 'Damaged', 'Missing'];
    if (reportType === 'assignments') return ['Assignment ID', 'Asset', 'Assigned To', 'Department', 'Assignment Date', 'Status', 'Location'];
    if (reportType === 'transfers') return ['Transfer ID', 'Asset', 'From', 'To', 'Requested By', 'Transfer Date', 'Status', 'Completed Date'];
    if (reportType === 'returns') return ['Return ID', 'Asset', 'Returned By', 'Department', 'Return Date', 'Condition', 'Status'];
    if (reportType === 'maintenance') return ['Maintenance ID', 'Asset', 'Department', 'Location', 'Type', 'Priority', 'Status', 'Reported Date'];
    if (reportType === 'verification') return ['Verification Session', 'Asset', 'Department', 'Location', 'Verification Status', 'Verified By', 'Verification Date'];
    if (reportType === 'requests') return ['Request ID', 'Request Date', 'Department', 'Requester', 'Requested Item', 'Category', 'Quantity', 'Priority', 'Status'];
    if (reportType === 'movement') return ['Date', 'Asset', 'Movement Type', 'From', 'To', 'User', 'Status', 'Reference'];
    return ['Item'];
  }, [reportType]);

  const rows = payload.data || [];

  const kpis = [
    { key: 'totalAssets', title: 'Total Assets', value: payload.summary.totalAssets || 0 },
    { key: 'activeAssets', title: 'Active Assets', value: payload.summary.activeAssets || 0 },
    { key: 'assignedAssets', title: 'Assigned Assets', value: payload.summary.assignedAssets || 0 },
    { key: 'availableAssets', title: 'Available Assets', value: payload.summary.availableAssets || 0 },
    { key: 'underMaintenance', title: 'Under Maintenance', value: payload.summary.underMaintenance || 0 },
    { key: 'totalAssignments', title: 'Total Assignments', value: payload.summary.totalAssignments || 0 },
    { key: 'totalTransfers', title: 'Total Transfers', value: payload.summary.totalTransfers || 0 },
    { key: 'totalReturns', title: 'Total Returns', value: payload.summary.totalReturns || 0 },
    { key: 'totalMaintenance', title: 'Maintenance Records', value: payload.summary.totalMaintenance || 0 },
    { key: 'totalRequests', title: 'Pending Requests', value: payload.summary.totalRequests || 0 },
    { key: 'totalSessions', title: 'Verified Assets', value: payload.summary.totalSessions || 0 },
    { key: 'totalMovements', title: 'Movement Records', value: payload.summary.totalMovements || 0 },
  ].filter((item) => Number(item.value) > 0 || item.key === 'totalAssets');

  const clearFilters = () => setFilters({ departmentId: '', categoryId: '', status: '', dateFrom: '', dateTo: '', search: '' });

  const renderCell = (row, index) => {
    if (reportType === 'inventory') {
      return [
        row.assetCode || '—',
        row.name || '—',
        row.category || '—',
        row.department || '—',
        row.location || '—',
        row.status || '—',
        row.condition || '—',
        row.assignedTo || '—',
        dateDisplay(row.purchaseDate),
        money(row.assetValue),
        dateDisplay(row.lastUpdated),
      ][index];
    }
    if (reportType === 'status') {
      return [row.label, row.count, `${row.percentage || 0}%`][index];
    }
    if (reportType === 'departments') {
      return [row.department, row.staffCount, row.totalAssets, row.assigned, row.available, row.underMaintenance, row.damaged, row.missing][index];
    }
    if (reportType === 'assignments') {
      return [row.id, row.asset, row.assignedTo, row.department, dateDisplay(row.assignmentDate), row.status, row.location][index];
    }
    if (reportType === 'transfers') {
      return [row.id, row.asset, row.fromDepartment, row.toDepartment, row.requestedBy, dateDisplay(row.transferDate), row.status, dateDisplay(row.completedDate)][index];
    }
    if (reportType === 'returns') {
      return [row.id, row.asset, row.returnedBy, row.department, dateDisplay(row.returnDate), row.condition, row.status][index];
    }
    if (reportType === 'maintenance') {
      return [row.id, row.asset, row.department, row.location, row.type, row.priority, row.status, dateDisplay(row.reportedDate)][index];
    }
    if (reportType === 'verification') {
      return [row.verificationSession, row.asset, row.department, row.location, row.verificationStatus, row.verifiedBy, dateDisplay(row.verificationDate)][index];
    }
    if (reportType === 'requests') {
      return [row.id, dateDisplay(row.requestDate), row.department, row.requester, row.requestedItem, row.category, row.quantity, row.priority, row.status][index];
    }
    if (reportType === 'movement') {
      return [dateDisplay(row.date), row.asset, row.movementType, row.from, row.to, row.user, row.status, row.reference][index];
    }
    return row?.label || '—';
  };

  const renderMinimalChart = () => {
    if (!payload.charts || payload.charts.length === 0) return <div className="college-reports-empty">No chart data available for this report.</div>;
    const max = Math.max(...payload.charts.map((entry) => Number(entry.value) || 0), 1);
    return (
      <div className="college-reports-chart-list">
        {payload.charts.map((entry) => (
          <div key={`${entry.label}-${entry.value}`} className="college-reports-chart-row">
            <div className="college-reports-chart-meta"><span>{labelize(entry.label)}</span><strong>{entry.value}</strong></div>
            <div className="college-reports-chart-track"><span style={{ width: `${((Number(entry.value) || 0) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="college-reports-page">
      <div className="college-reports-toolbar">
        <div className="college-reports-selector" aria-label="Report selector">
          {REPORT_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={reportType === option.value ? 'active' : ''}
              onClick={() => { setReportType(option.value); setPage(1); }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="college-reports-actions">
          <button type="button" onClick={() => loadReports(page)}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div className="college-reports-filter-bar">
        <label>
          <Search size={14} />
          <input value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} placeholder="Search report data" aria-label="Search reports" />
        </label>
        <label>
          <Building2 size={14} />
          <select value={filters.departmentId} onChange={(event) => setFilters((previous) => ({ ...previous, departmentId: event.target.value }))}>
            <option value="">All departments</option>
            {payload.filters.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label>
          <Package size={14} />
          <select value={filters.categoryId} onChange={(event) => setFilters((previous) => ({ ...previous, categoryId: event.target.value }))}>
            <option value="">All categories</option>
            {payload.filters.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          <Filter size={14} />
          <select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}>
            <option value="">All statuses</option>
            {payload.filters.statuses.map((status) => (
              <option key={status} value={status}>{labelize(status)}</option>
            ))}
          </select>
        </label>
        <label>
          <CalendarRange size={14} />
          <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((previous) => ({ ...previous, dateFrom: event.target.value }))} />
        </label>
        <label>
          <CalendarRange size={14} />
          <input type="date" value={filters.dateTo} onChange={(event) => setFilters((previous) => ({ ...previous, dateTo: event.target.value }))} />
        </label>
        {hasFilters && <button type="button" onClick={clearFilters} className="clear-filters"><X size={14} /> Clear Filters</button>}
      </div>

      <div className="college-reports-kpis">
        {kpis.slice(0, 6).map((item) => (
          <div key={item.key} className="college-reports-kpi">
            <span>{item.title}</span>
            <strong>{Number(item.value).toLocaleString()}</strong>
          </div>
        ))}
      </div>

      <div className="college-reports-chart-card">
        <div className="college-reports-card-header">
          <div>
            <span className="college-eyebrow">Report chart</span>
            <h3>{REPORT_TYPES.find((option) => option.value === reportType)?.label || 'Report'}</h3>
          </div>
          <BarChart3 size={18} />
        </div>
        {renderMinimalChart()}
      </div>

      <div className="college-reports-table-panel">
        <div className="college-reports-table-head">
          <div>
            <strong>{REPORT_TYPES.find((option) => option.value === reportType)?.label || 'Report'}</strong>
            <small>{payload.pagination.total ? `Showing ${((payload.pagination.page - 1) * payload.pagination.limit) + 1}–${Math.min(payload.pagination.page * payload.pagination.limit, payload.pagination.total)} of ${payload.pagination.total}` : 'No records'}</small>
          </div>
          <button type="button" aria-label="Export report" disabled>
            <Download size={16} /> Export
          </button>
        </div>

        {loading ? (
          <div className="college-reports-state" aria-live="polite" aria-busy="true">Loading report data...</div>
        ) : error ? (
          <div className="college-reports-state college-reports-error" role="alert">{error}<button type="button" onClick={() => loadReports(page)}>Retry</button></div>
        ) : rows.length ? (
          <div className="college-reports-table-wrap">
            <table>
              <thead>
                <tr>
                  {tableHeaders.map((header) => <th key={header}>{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${row.id || rowIndex}-${reportType}`}>
                    {Array.from({ length: tableHeaders.length }).map((_, columnIndex) => (
                      <td key={`${row.id || rowIndex}-${columnIndex}`}>{renderCell(row, columnIndex)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-reports-empty">No report data found for the selected filters.</div>
        )}

        <div className="college-reports-pagination">
          <button type="button" disabled={payload.pagination.page <= 1 || loading} onClick={() => { const nextPage = Math.max(1, page - 1); setPage(nextPage); loadReports(nextPage); }}>Previous</button>
          <span>Page {payload.pagination.page} of {Math.max(1, payload.pagination.totalPages || 1)}</span>
          <button type="button" disabled={payload.pagination.page >= payload.pagination.totalPages || loading} onClick={() => { const nextPage = payload.pagination.page + 1; setPage(nextPage); loadReports(nextPage); }}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default CollegeReports;
