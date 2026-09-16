import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BarChart3, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye, Filter, LoaderCircle, Package, RefreshCw, Search, ShieldCheck, TrendingUp, Users, Wrench } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeDepartmentPerformance.css';

const currency = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

const CollegeDepartmentPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', departmentId: '', status: '' });
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState({
    totalDepartments: 0,
    activeDepartments: 0,
    departmentsWithAssets: 0,
    totalAssets: 0,
    assignedAssets: 0,
    availableAssets: 0,
    maintenanceAssets: 0,
    totalRequests: 0,
    pendingRequests: 0,
    verificationRecords: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const loadDepartmentPerformance = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/department-performance', {
        params: {
          page: 1,
          limit: pagination.limit || 10,
          search: filters.search || undefined,
          departmentId: filters.departmentId || undefined,
          status: filters.status || undefined,
        },
      });
      const payload = response.data || {};
      setDepartments(payload.data || []);
      setSummary(payload.summary || {
        totalDepartments: 0,
        activeDepartments: 0,
        departmentsWithAssets: 0,
        totalAssets: 0,
        assignedAssets: 0,
        availableAssets: 0,
        maintenanceAssets: 0,
        totalRequests: 0,
        pendingRequests: 0,
        verificationRecords: 0,
      });
      setPagination(payload.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (requestError) {
      setDepartments([]);
      setError(requestError.response?.data?.message || 'Failed to load department performance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentPerformance();
  }, []);

  useEffect(() => {
    if (!filters.search && !filters.departmentId && !filters.status) {
      loadDepartmentPerformance(false);
    }
  }, [filters]);

  const departmentOptions = useMemo(() => (Array.isArray(departments) ? departments.map((item) => ({ id: item.id, name: item.name, code: item.code })) : []), [departments]);

  const handleFilterApply = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/college/department-performance', {
        params: {
          page: 1,
          limit: pagination.limit || 10,
          search: filters.search || undefined,
          departmentId: filters.departmentId || undefined,
          status: filters.status || undefined,
        },
      });
      const payload = response.data || {};
      setDepartments(payload.data || []);
      setSummary(payload.summary || {});
      setPagination(payload.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load department performance data.');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({ search: '', departmentId: '', status: '' });
    setLoading(true);
    apiClient.get('/api/college/department-performance', { params: { page: 1, limit: 10 } })
      .then((response) => {
        const payload = response.data || {};
        setDepartments(payload.data || []);
        setSummary(payload.summary || {});
        setPagination(payload.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
        setError('');
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Failed to load department performance data.'))
      .finally(() => setLoading(false));
  };

  const openDepartmentDetails = async (department) => {
    setSelectedDepartment({ ...department, loading: true });
    setIsDetailsOpen(true);
    try {
      const response = await apiClient.get('/api/college/department-performance', {
        params: { departmentId: department.id, page: 1, limit: 100 },
      });
      const candidates = response.data?.data || [];
      const details = candidates.find((item) => Number(item.id) === Number(department.id)) || department;
      setSelectedDepartment(details);
    } catch (requestError) {
      setSelectedDepartment({ ...department, detailError: requestError.response?.data?.message || 'Unable to load department detail.' });
    }
  };

  const handlePageChange = async (nextPage) => {
    const safePage = Math.max(1, Number(nextPage) || 1);
    setLoading(true);
    try {
      const response = await apiClient.get('/api/college/department-performance', {
        params: {
          page: safePage,
          limit: pagination.limit || 10,
          search: filters.search || undefined,
          departmentId: filters.departmentId || undefined,
          status: filters.status || undefined,
        },
      });
      const payload = response.data || {};
      setDepartments(payload.data || []);
      setSummary(payload.summary || {});
      setPagination(payload.pagination || { page: safePage, limit: pagination.limit || 10, total: 0, totalPages: 0 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load department performance data.');
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    { label: 'Total Departments', value: summary.totalDepartments, icon: Building2, tint: 'blue' },
    { label: 'Departments With Assets', value: summary.departmentsWithAssets, icon: Package, tint: 'cyan' },
    { label: 'Total Assets', value: summary.totalAssets, icon: Package, tint: 'green' },
    { label: 'Assigned Assets', value: summary.assignedAssets, icon: Users, tint: 'indigo' },
    { label: 'Under Maintenance', value: summary.maintenanceAssets, icon: Wrench, tint: 'amber' },
    { label: 'Open Requests', value: summary.pendingRequests, icon: ClipboardList, tint: 'rose' },
    { label: 'Verification Activity', value: summary.verificationRecords, icon: ShieldCheck, tint: 'slate' },
  ];

  if (loading) {
    return (
      <div className="college-performance-shell">
        <div className="college-performance-state" aria-busy="true">
          <LoaderCircle className="college-performance-spin" size={20} />
          Loading department performance...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="college-performance-shell">
        <div className="college-performance-state error" role="alert">
          <strong>Failed to load department performance data.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => loadDepartmentPerformance()}><RefreshCw size={15} /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="college-performance-shell">
      <div className="college-performance-header">
        <div>
          <p className="college-performance-kicker">College Department Performance</p>
          <h3>Department operational view</h3>
        </div>
        <button type="button" className="college-performance-refresh" onClick={() => loadDepartmentPerformance()} aria-label="Refresh department performance">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="college-performance-kpi-grid">
        {kpis.map(({ label, value, icon: Icon, tint }) => (
          <div className="college-performance-kpi-card" key={label}>
            <div className={`college-performance-kpi-icon ${tint}`}><Icon size={18} /></div>
            <div>
              <strong>{currency(value)}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="college-performance-filters">
        <label className="college-performance-search">
          <Search size={15} />
          <input
            type="text"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search department name or code"
            aria-label="Search departments"
          />
        </label>

        <label className="college-performance-select">
          <Filter size={15} />
          <select value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))} aria-label="Filter by department">
            <option value="">All departments</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label className="college-performance-select">
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filter by department status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <button type="button" className="college-performance-action" onClick={handleFilterApply}>Apply</button>
        <button type="button" className="college-performance-action secondary" onClick={resetFilters}>Clear Filters</button>
      </div>

      <div className="college-performance-card">
        <div className="college-performance-table-header">
          <div>
            <h4>Department performance</h4>
            <span>{pagination.total} departments</span>
          </div>
          <div className="college-performance-status-badges">
            <span className="college-performance-badge active">Active: {summary.activeDepartments}</span>
          </div>
        </div>

        <div className="college-performance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Status</th>
                <th>Staff</th>
                <th>Total Assets</th>
                <th>Assigned</th>
                <th>Available</th>
                <th>Maintenance</th>
                <th>Requests</th>
                <th>Pending</th>
                <th>Transfers</th>
                <th>Returns</th>
                <th>Last Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length ? departments.map((department) => (
                <tr key={department.id}>
                  <td>
                    <div className="college-performance-department-cell">
                      <strong>{department.name}</strong>
                      <small>{department.code || 'No code'}</small>
                    </div>
                  </td>
                  <td><span className={`college-performance-status ${department.status}`}>{department.status}</span></td>
                  <td>{currency(department.staffCount)}</td>
                  <td>{currency(department.totalAssets)}</td>
                  <td>{currency(department.assignedAssets)}</td>
                  <td>{currency(department.availableAssets)}</td>
                  <td>{currency(department.maintenanceAssets)}</td>
                  <td>{currency(department.requests)}</td>
                  <td>{currency(department.pendingRequests)}</td>
                  <td>{currency(department.transfers)}</td>
                  <td>{currency(department.returns)}</td>
                  <td>{formatDate(department.lastActivity)}</td>
                  <td>
                    <button type="button" className="college-performance-detail-button" onClick={() => openDepartmentDetails(department)}>
                      <Eye size={15} /> View
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="13" className="college-performance-empty">No departments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="college-performance-pagination">
            <button type="button" disabled={pagination.page <= 1} onClick={() => handlePageChange(pagination.page - 1)}>
              <ChevronLeft size={15} /> Previous
            </button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePageChange(pagination.page + 1)}>
              Next <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {isDetailsOpen && selectedDepartment && (
        <div className="college-performance-modal-backdrop" role="presentation" onClick={(event) => event.target === event.currentTarget && setIsDetailsOpen(false)}>
          <div className="college-performance-modal" role="dialog" aria-modal="true" aria-label="Department performance detail">
            <div className="college-performance-modal-header">
              <div>
                <p>Department Detail</p>
                <h4>{selectedDepartment.name}</h4>
              </div>
              <button type="button" onClick={() => setIsDetailsOpen(false)} aria-label="Close details">×</button>
            </div>

            <div className="college-performance-modal-grid">
              <div><span>Department Code</span><strong>{selectedDepartment.code || '—'}</strong></div>
              <div><span>Status</span><strong>{selectedDepartment.status || '—'}</strong></div>
              <div><span>Department Head</span><strong>{selectedDepartment.head?.fullName || selectedDepartment.head?.username || '—'}</strong></div>
              <div><span>Staff Count</span><strong>{currency(selectedDepartment.staffCount)}</strong></div>
              <div><span>Total Assets</span><strong>{currency(selectedDepartment.totalAssets)}</strong></div>
              <div><span>Assigned Assets</span><strong>{currency(selectedDepartment.assignedAssets)}</strong></div>
              <div><span>Available Assets</span><strong>{currency(selectedDepartment.availableAssets)}</strong></div>
              <div><span>Assets Under Maintenance</span><strong>{currency(selectedDepartment.maintenanceAssets)}</strong></div>
              <div><span>Damaged</span><strong>{currency(selectedDepartment.damagedAssets)}</strong></div>
              <div><span>Missing</span><strong>{currency(selectedDepartment.missingAssets)}</strong></div>
              <div><span>Open Requests</span><strong>{currency(selectedDepartment.pendingRequests)}</strong></div>
              <div><span>Approved Requests</span><strong>{currency(selectedDepartment.approvedRequests)}</strong></div>
              <div><span>Transfers</span><strong>{currency(selectedDepartment.transfers)}</strong></div>
              <div><span>Returns</span><strong>{currency(selectedDepartment.returns)}</strong></div>
              <div><span>Verification Records</span><strong>{currency(selectedDepartment.verificationRecords)}</strong></div>
              <div><span>Asset Assignment Utilization</span><strong>{selectedDepartment.utilization || 0}%</strong></div>
              <div><span>Last Activity</span><strong>{formatDate(selectedDepartment.lastActivity)}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeDepartmentPerformance;
