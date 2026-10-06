/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, CalendarRange, Download, Filter, Package, RefreshCw, Search, X } from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
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

const AMHARIC_COPY = {
  'Asset Inventory': 'የንብረት ዝርዝር', 'Asset Status': 'የንብረት ሁኔታ', 'Department Assets': 'የዲፓርትመንት ንብረቶች', 'Asset Assignments': 'የንብረት ምደባዎች', 'Asset Transfers': 'የንብረት ዝውውሮች', 'Asset Returns': 'የንብረት መመለሻዎች', 'Maintenance Activity': 'የጥገና እንቅስቃሴ', 'Verification Activity': 'የማረጋገጫ እንቅስቃሴ', 'Asset Requests': 'የንብረት ጥያቄዎች', 'Asset Movement': 'የንብረት እንቅስቃሴ',
  'Asset Code': 'የንብረት ኮድ', 'Asset Name': 'የንብረት ስም', Category: 'ምድብ', Department: 'ዲፓርትመንት', Location: 'ቦታ', Status: 'ሁኔታ', Condition: 'አቋም', 'Assigned To': 'የተመደበለት', 'Purchase Date': 'የግዢ ቀን', 'Asset Value': 'የንብረት ዋጋ', 'Last Updated': 'የመጨረሻ ማሻሻያ', Count: 'ብዛት', Percentage: 'መቶኛ', 'Staff Count': 'የሰራተኞች ብዛት', 'Total Assets': 'ጠቅላላ ንብረቶች', Assigned: 'የተመደቡ', Available: 'ያሉ', 'Under Maintenance': 'በጥገና ላይ', Damaged: 'የተጎዱ', Missing: 'የጠፉ', 'Assignment ID': 'የምደባ መለያ', Asset: 'ንብረት', 'Assignment Date': 'የምደባ ቀን', 'Transfer ID': 'የዝውውር መለያ', From: 'ከ', To: 'ወደ', 'Requested By': 'የጠየቀው', 'Transfer Date': 'የዝውውር ቀን', 'Completed Date': 'የተጠናቀቀበት ቀን', 'Return ID': 'የመመለሻ መለያ', 'Returned By': 'የመለሰው', 'Return Date': 'የመመለሻ ቀን', 'Maintenance ID': 'የጥገና መለያ', Type: 'አይነት', Priority: 'ቅድሚያ', 'Reported Date': 'የተመዘገበበት ቀን', 'Verification Session': 'የማረጋገጫ ክፍለ ጊዜ', 'Verification Status': 'የማረጋገጫ ሁኔታ', 'Verified By': 'ያረጋገጠው', 'Verification Date': 'የማረጋገጫ ቀን', 'Request ID': 'የጥያቄ መለያ', 'Request Date': 'የጥያቄ ቀን', Requester: 'ጠያቂ', 'Requested Item': 'የተጠየቀው እቃ', Quantity: 'ብዛት', Date: 'ቀን', 'Movement Type': 'የእንቅስቃሴ አይነት', User: 'ተጠቃሚ', Reference: 'ማጣቀሻ', Item: 'እቃ',
  'Failed to load report data.': 'የሪፖርት መረጃን መጫን አልተቻለም።', 'Report selector': 'የሪፖርት መምረጫ', Refresh: 'አድስ', 'Search report data': 'የሪፖርት መረጃ ይፈልጉ', 'Search reports': 'ሪፖርቶችን ይፈልጉ', 'All departments': 'ሁሉም ዲፓርትመንቶች', 'All categories': 'ሁሉም ምድቦች', 'All statuses': 'ሁሉም ሁኔታዎች', 'Clear Filters': 'ማጣሪያዎችን አጽዳ',
  'Active Assets': 'ንቁ ንብረቶች', 'Assigned Assets': 'የተመደቡ ንብረቶች', 'Available Assets': 'ያሉ ንብረቶች', 'Total Assignments': 'ጠቅላላ ምደባዎች', 'Total Transfers': 'ጠቅላላ ዝውውሮች', 'Total Returns': 'ጠቅላላ መመለሻዎች', 'Maintenance Records': 'የጥገና መዝገቦች', 'Pending Requests': 'በመጠባበቅ ላይ ያሉ ጥያቄዎች', 'Verified Assets': 'የተረጋገጡ ንብረቶች', 'Movement Records': 'የእንቅስቃሴ መዝገቦች', 'Report chart': 'የሪፖርት ገበታ', Report: 'ሪፖርት', 'No chart data available for this report.': 'ለዚህ ሪፖርት የገበታ መረጃ የለም።', 'No records': 'መዝገቦች የሉም', Export: 'ወደ ውጭ ላክ', 'Export report': 'ሪፖርቱን ወደ ውጭ ላክ', 'Loading report data...': 'የሪፖርት መረጃን በመጫን ላይ...', Retry: 'እንደገና ሞክር', 'No report data found for the selected filters.': 'ለተመረጡት ማጣሪያዎች የሪፖርት መረጃ አልተገኘም።', Previous: 'ቀዳሚ', Next: 'ቀጣይ', Page: 'ገጽ', of: 'ከ', 'Showing records': 'መዝገቦችን በማሳየት ላይ', 'From date': 'ከቀን', 'To date': 'እስከ ቀን',
  Active: 'ንቁ', Pending: 'በመጠባበቅ ላይ', Approved: 'ጸድቋል', Rejected: 'ውድቅ ተደርጓል', Completed: 'ተጠናቋል', Verified: 'ተረጋግጧል', 'In Maintenance': 'በጥገና ላይ'
};

const CollegeReports = () => {
  const { language } = useLanguage();
  const translate = (value) => language === 'am' ? AMHARIC_COPY[value] || AMHARIC_COPY[String(value).toLowerCase()] || value : value;
  const [reportType, setReportType] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [, setTableLoading] = useState(false);
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
      setError(language === 'am' ? translate('Failed to load report data.') : requestError.response?.data?.message || 'Failed to load report data.');
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
    if (!payload.charts || payload.charts.length === 0) return <div className="college-reports-empty">{translate('No chart data available for this report.')}</div>;
    const max = Math.max(...payload.charts.map((entry) => Number(entry.value) || 0), 1);
    return (
      <div className="college-reports-chart-list">
        {payload.charts.map((entry) => (
            <div key={`${entry.label}-${entry.value}`} className="college-reports-chart-row">
            <div className="college-reports-chart-meta"><span>{translate(labelize(entry.label))}</span><strong>{entry.value}</strong></div>
            <div className="college-reports-chart-track"><span style={{ width: `${((Number(entry.value) || 0) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="college-reports-page">
      <div className="college-reports-toolbar">
        <div className="college-reports-selector" aria-label={translate('Report selector')}>
          {REPORT_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={reportType === option.value ? 'active' : ''}
              onClick={() => { setReportType(option.value); setPage(1); }}
            >
              {translate(option.label)}
            </button>
          ))}
        </div>
        <div className="college-reports-actions">
          <button type="button" onClick={() => loadReports(page)}><RefreshCw size={16} /> {translate('Refresh')}</button>
        </div>
      </div>

      <div className="college-reports-filter-bar">
        <label>
          <Search size={14} />
          <input value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} placeholder={translate('Search report data')} aria-label={translate('Search reports')} />
        </label>
        <label>
          <Building2 size={14} />
          <select value={filters.departmentId} onChange={(event) => setFilters((previous) => ({ ...previous, departmentId: event.target.value }))}>
            <option value="">{translate('All departments')}</option>
            {payload.filters.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label>
          <Package size={14} />
          <select value={filters.categoryId} onChange={(event) => setFilters((previous) => ({ ...previous, categoryId: event.target.value }))}>
            <option value="">{translate('All categories')}</option>
            {payload.filters.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          <Filter size={14} />
          <select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}>
            <option value="">{translate('All statuses')}</option>
            {payload.filters.statuses.map((status) => (
              <option key={status} value={status}>{translate(labelize(status))}</option>
            ))}
          </select>
        </label>
        <label>
          <CalendarRange size={14} />
          <input type="date" aria-label={translate('From date')} value={filters.dateFrom} onChange={(event) => setFilters((previous) => ({ ...previous, dateFrom: event.target.value }))} />
        </label>
        <label>
          <CalendarRange size={14} />
          <input type="date" aria-label={translate('To date')} value={filters.dateTo} onChange={(event) => setFilters((previous) => ({ ...previous, dateTo: event.target.value }))} />
        </label>
        {hasFilters && <button type="button" onClick={clearFilters} className="clear-filters"><X size={14} /> {translate('Clear Filters')}</button>}
      </div>

      <div className="college-reports-kpis">
        {kpis.slice(0, 6).map((item) => (
          <div key={item.key} className="college-reports-kpi">
            <span>{translate(item.title)}</span>
            <strong>{Number(item.value).toLocaleString()}</strong>
          </div>
        ))}
      </div>

      <div className="college-reports-chart-card">
        <div className="college-reports-card-header">
          <div>
            <span className="college-eyebrow">{translate('Report chart')}</span>
            <h3>{translate(REPORT_TYPES.find((option) => option.value === reportType)?.label || 'Report')}</h3>
          </div>
          <BarChart3 size={18} />
        </div>
        {renderMinimalChart()}
      </div>

      <div className="college-reports-table-panel">
        <div className="college-reports-table-head">
          <div>
            <strong>{translate(REPORT_TYPES.find((option) => option.value === reportType)?.label || 'Report')}</strong>
            <small>{payload.pagination.total ? language === 'am' ? `ከ${payload.pagination.total} መዝገቦች ${((payload.pagination.page - 1) * payload.pagination.limit) + 1}–${Math.min(payload.pagination.page * payload.pagination.limit, payload.pagination.total)} በማሳየት ላይ` : `Showing ${((payload.pagination.page - 1) * payload.pagination.limit) + 1}–${Math.min(payload.pagination.page * payload.pagination.limit, payload.pagination.total)} of ${payload.pagination.total}` : translate('No records')}</small>
          </div>
          <button type="button" aria-label={translate('Export report')} disabled>
            <Download size={16} /> {translate('Export')}
          </button>
        </div>

        {loading ? (
          <div className="college-reports-state" aria-live="polite" aria-busy="true">{translate('Loading report data...')}</div>
        ) : error ? (
          <div className="college-reports-state college-reports-error" role="alert">{error}<button type="button" onClick={() => loadReports(page)}>{translate('Retry')}</button></div>
        ) : rows.length ? (
          <div className="college-reports-table-wrap">
            <table>
              <thead>
                <tr>
                  {tableHeaders.map((header) => <th key={header}>{translate(header)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${row.id || rowIndex}-${reportType}`}>
                    {Array.from({ length: tableHeaders.length }).map((_, columnIndex) => (
                      <td key={`${row.id || rowIndex}-${columnIndex}`}>{translate(renderCell(row, columnIndex))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-reports-empty">{translate('No report data found for the selected filters.')}</div>
        )}

        <div className="college-reports-pagination">
          <button type="button" disabled={payload.pagination.page <= 1 || loading} onClick={() => { const nextPage = Math.max(1, page - 1); setPage(nextPage); loadReports(nextPage); }}>{translate('Previous')}</button>
          <span>{translate('Page')} {payload.pagination.page} {translate('of')} {Math.max(1, payload.pagination.totalPages || 1)}</span>
          <button type="button" disabled={payload.pagination.page >= payload.pagination.totalPages || loading} onClick={() => { const nextPage = payload.pagination.page + 1; setPage(nextPage); loadReports(nextPage); }}>{translate('Next')}</button>
        </div>
      </div>
    </div>
  );
};

export default CollegeReports;
