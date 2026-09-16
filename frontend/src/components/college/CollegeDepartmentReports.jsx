import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpDown, BarChart3, Building2, CheckCircle2, Download, Eye, Filter, LoaderCircle, Package, RefreshCw, Search, ShieldCheck, Users, Wrench, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

const CollegeDepartmentReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', departmentId: '', status: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [payload, setPayload] = useState({ summary: {}, departments: [], statusDistribution: [], assetDistribution: [], staffDistribution: [], requestDistribution: [], transferDistribution: [], returnDistribution: [], maintenanceDistribution: [], verificationDistribution: [], activity: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const loadReports = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/analytics/departments', {
        params: {
          page: nextPage,
          limit: pageSize,
          search: filters.search || undefined,
          departmentId: filters.departmentId || undefined,
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        },
      });
      const data = response.data?.data || {};
      const requestPayload = response.data || {};
      setPayload({
        summary: data.summary || {},
        departments: data.departments || [],
        statusDistribution: data.statusDistribution || [],
        assetDistribution: data.assetDistribution || [],
        staffDistribution: data.staffDistribution || [],
        requestDistribution: data.requestDistribution || [],
        transferDistribution: data.transferDistribution || [],
        returnDistribution: data.returnDistribution || [],
        maintenanceDistribution: data.maintenanceDistribution || [],
        verificationDistribution: data.verificationDistribution || [],
        activity: data.activity || [],
        pagination: data.pagination || { page: nextPage, limit: pageSize, total: 0, totalPages: 1 },
      });
      setDepartmentOptions(Array.isArray(requestPayload.departments) ? requestPayload.departments : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load department reports.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => { loadReports(1); }, [filters.search, filters.departmentId, filters.status, filters.dateFrom, filters.dateTo]);

  useEffect(() => { if (page > 1) loadReports(page); }, [page]);

  const activeDepartment = useMemo(() => payload.departments.find((department) => Number(department.id) === Number(selectedDepartment?.id)) || null, [payload.departments, selectedDepartment]);

  const kpis = [
    { label: 'Total Departments', value: payload.summary.totalDepartments || 0, icon: Building2, tint: 'blue' },
    { label: 'Active Departments', value: payload.summary.activeDepartments || 0, icon: CheckCircle2, tint: 'green' },
    { label: 'Inactive Departments', value: payload.summary.inactiveDepartments || 0, icon: X, tint: 'amber' },
    { label: 'Departments with Assets', value: payload.summary.departmentsWithAssets || 0, icon: Package, tint: 'cyan' },
    { label: 'Total Department Staff', value: payload.summary.totalDepartmentStaff || 0, icon: Users, tint: 'slate' },
    { label: 'Total Department Assets', value: payload.summary.totalDepartmentAssets || 0, icon: ShieldCheck, tint: 'indigo' },
    { label: 'Pending Requests', value: payload.summary.pendingDepartmentRequests || 0, icon: AlertTriangle, tint: 'rose' },
  ];

  const clearFilters = () => {
    setFilters({ search: '', departmentId: '', status: '', dateFrom: '', dateTo: '' });
    setPage(1);
  };

  const exportCsv = async () => {
    try {
      const rows = payload.departments;
      const csv = [
        ['Department', 'Department Code', 'Status', 'Head', 'Staff Count', 'Total Assets', 'Assigned Assets', 'Available Assets', 'Maintenance Assets', 'Pending Requests', 'Transfers', 'Returns', 'Last Activity'].join(','),
        ...rows.map((row) => [row.department, row.departmentCode, row.status, row.head, row.staffCount, row.totalAssets, row.assignedAssets, row.availableAssets, row.maintenanceAssets, row.pendingRequests, row.transfers, row.returns, row.lastActivity].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'college-department-reports.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.response?.data?.message || 'Failed to export department reports.');
    }
  };

  if (loading) {
    return <div className="college-performance-shell"><div className="college-performance-state" aria-busy="true"><LoaderCircle className="college-performance-spin" size={20} /> Loading department reports...</div></div>;
  }

  if (error) {
    return <div className="college-performance-shell"><div className="college-performance-state error" role="alert"><strong>Failed to load department reports.</strong><span>{error}</span><button type="button" onClick={() => loadReports(page)}><RefreshCw size={15} /> Retry</button></div></div>;
  }

  return (
    <div className="college-performance-shell" style={{ display: 'grid', gap: 18 }}>
      <div className="college-performance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="college-performance-kicker">College Manager</p>
          <h3>Department Reports</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="college-performance-refresh" onClick={() => loadReports(page)} aria-label="Refresh department reports"><RefreshCw size={16} /> Refresh</button>
          <button type="button" className="admin-primary-button" onClick={exportCsv} aria-label="Export department reports"><Download size={15} /> Export</button>
        </div>
      </div>

      <div className="college-performance-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {kpis.map(({ label, value, icon: Icon, tint }) => (
          <div className="college-performance-kpi-card" key={label} style={{ borderTop: `3px solid ${tint === 'blue' ? '#2563EB' : tint === 'green' ? '#16A34A' : tint === 'amber' ? '#F59E0B' : tint === 'cyan' ? '#0EA5E9' : tint === 'slate' ? '#475569' : tint === 'indigo' ? '#4F46E5' : '#E11D48'}` }}>
            <div className="college-performance-kpi-icon" style={{ background: `${tint === 'blue' ? '#DBEAFE' : tint === 'green' ? '#DCFCE7' : tint === 'amber' ? '#FEF3C7' : tint === 'cyan' ? '#E0F2FE' : tint === 'slate' ? '#E2E8F0' : tint === 'indigo' ? '#E0E7FF' : '#FFE4E6'}`, color: tint === 'blue' ? '#1D4ED8' : tint === 'green' ? '#15803D' : tint === 'amber' ? '#B45309' : tint === 'cyan' ? '#0369A1' : tint === 'slate' ? '#334155' : tint === 'indigo' ? '#4338CA' : '#BE123C' }}><Icon size={18} /></div>
            <div>
              <strong>{formatNumber(value)}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="college-performance-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Search</span>
          <input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Name, code, head" aria-label="Search departments" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Department</span>
          <select value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))} aria-label="Filter department">
            <option value="">All departments</option>
            {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Status</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filter status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Date from</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} aria-label="Date from" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Date to</span>
          <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} aria-label="Date to" />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type="button" className="admin-secondary-button" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Department Status</h2></div><BarChart3 size={18} /></div>
          {payload.statusDistribution.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {payload.statusDistribution.map((row) => (
                <div key={row.status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>{row.status}</span><strong>{row.count}</strong></div>
                  <div style={{ height: 8, background: '#E2E8F0', borderRadius: 999 }}><div style={{ width: `${Math.min(row.percentage || 0, 100)}%`, height: '100%', background: row.status === 'active' ? '#16A34A' : '#F59E0B', borderRadius: 999 }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="college-empty-state">No department status data available.</p>}
        </div>

        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Asset Distribution</h2></div><Package size={18} /></div>
          {payload.assetDistribution.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {payload.assetDistribution.slice(0, 6).map((row) => (
                <div key={row.department} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{row.department}</span>
                  <strong>{row.totalAssets}</strong>
                </div>
              ))}
            </div>
          ) : <p className="college-empty-state">No asset distribution data available.</p>}
        </div>
      </div>

      <div className="college-dashboard-card" style={{ padding: 16 }}>
        <div className="college-section-heading"><div><h2>Department Summary</h2></div><Building2 size={18} /></div>
        {payload.departments.length ? (
          <div className="college-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Head</th>
                  <th>Staff</th>
                  <th>Total Assets</th>
                  <th>Assigned</th>
                  <th>Available</th>
                  <th>Pending Requests</th>
                  <th>Transfers</th>
                  <th>Returns</th>
                  <th>Last Activity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payload.departments.map((department) => (
                  <tr key={department.id}>
                    <td><strong>{department.department}</strong><br /><small>{department.departmentCode}</small></td>
                    <td><span className={`college-overview-status college-overview-status--${department.status}`}>{department.status}</span></td>
                    <td>{department.head}</td>
                    <td>{department.staffCount}</td>
                    <td>{department.totalAssets}</td>
                    <td>{department.assignedAssets}</td>
                    <td>{department.availableAssets}</td>
                    <td>{department.pendingRequests}</td>
                    <td>{department.transfers}</td>
                    <td>{department.returns}</td>
                    <td>{formatDate(department.lastActivity)}</td>
                    <td><button type="button" className="college-overview-view" onClick={() => setSelectedDepartment({ id: department.id })}><Eye size={15} /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="college-empty-state">No departments match your filters.</p>}
      </div>

      {selectedDepartment && activeDepartment && (
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Department Details</h2></div><X size={18} onClick={() => setSelectedDepartment(null)} style={{ cursor: 'pointer' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div><strong>Department</strong><div>{activeDepartment.department}</div></div>
            <div><strong>Code</strong><div>{activeDepartment.departmentCode}</div></div>
            <div><strong>Status</strong><div>{activeDepartment.status}</div></div>
            <div><strong>Head</strong><div>{activeDepartment.head}</div></div>
            <div><strong>Staff</strong><div>{activeDepartment.staffCount}</div></div>
            <div><strong>Assets</strong><div>{activeDepartment.totalAssets}</div></div>
            <div><strong>Assigned</strong><div>{activeDepartment.assignedAssets}</div></div>
            <div><strong>Requests</strong><div>{activeDepartment.pendingRequests}</div></div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Staff Distribution</h2></div><Users size={18} /></div>
          {payload.staffDistribution.length ? payload.staffDistribution.map((row) => <div key={row.department} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{row.department}</span><strong>{row.totalStaff}</strong></div>) : <p className="college-empty-state">No staff distribution data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Request Distribution</h2></div><Activity size={18} /></div>
          {payload.requestDistribution.length ? payload.requestDistribution.map((row) => <div key={row.department} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{row.department}</span><strong>{row.totalRequests}</strong></div>) : <p className="college-empty-state">No request distribution data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Transfer Distribution</h2></div><ArrowUpDown size={18} /></div>
          {payload.transferDistribution.length ? payload.transferDistribution.map((row) => <div key={row.department} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{row.department}</span><strong>{row.incomingTransfers + row.outgoingTransfers}</strong></div>) : <p className="college-empty-state">No transfer distribution data available.</p>}
        </div>
        <div className="college-dashboard-card" style={{ padding: 16 }}>
          <div className="college-section-heading"><div><h2>Verification Distribution</h2></div><ShieldCheck size={18} /></div>
          {payload.verificationDistribution.length ? payload.verificationDistribution.map((row) => <div key={row.department} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{row.department}</span><strong>{row.totalVerificationItems}</strong></div>) : <p className="college-empty-state">No verification distribution data available.</p>}
        </div>
      </div>

      <div className="college-dashboard-card" style={{ padding: 16 }}>
        <div className="college-section-heading"><div><h2>Recent Department Activity</h2></div><Activity size={18} /></div>
        {payload.activity.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {payload.activity.map((item) => (
              <li key={item.id} style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{item.department}</strong><span>{formatDate(item.date)}</span></div>
                <div>{item.activity}</div>
              </li>
            ))}
          </ul>
        ) : <p className="college-empty-state">No department activity available.</p>}
      </div>

      <div className="college-performance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{payload.pagination.total} departments</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {page} / {payload.pagination.totalPages || 1}</span>
          <button type="button" disabled={page >= (payload.pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default CollegeDepartmentReports;
