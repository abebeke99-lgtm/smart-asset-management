import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';

const stateLabelMap = {
  verified: 'Verified',
  missing: 'Missing',
  wrong_location: 'Wrong location',
  damaged: 'Damaged',
  unidentified: 'Unidentified',
  needs_review: 'Needs review',
  pending: 'Pending',
  draft: 'Draft',
  in_progress: 'In progress',
  submitted: 'Submitted',
  finalized: 'Finalized',
};

const statusBadges = {
  verified: 'status-success',
  missing: 'status-danger',
  wrong_location: 'status-warning',
  damaged: 'status-warning',
  unidentified: 'status-warning',
  needs_review: 'status-warning',
  pending: 'status-muted',
  draft: 'status-muted',
  in_progress: 'status-info',
  submitted: 'status-info',
  finalized: 'status-success',
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const safeValue = (value) => value === null || value === undefined || value === '' ? '—' : value;

const CollegeVerification = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalAssets: 0, verified: 0, pending: 0, notFound: 0, discrepancies: 0, sessions: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, pages: 1 });
  const [filters, setFilters] = useState({ departments: [], statuses: [], locations: [], assetStatuses: [] });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assetStatus: '', location: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadVerification = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError('');
      const response = await apiClient.get('/api/college/verification', {
        params: {
          page: 1,
          limit: pagination.limit,
          ...query,
          search: query.search || undefined,
          departmentId: query.departmentId || undefined,
          status: query.status || undefined,
          assetStatus: query.assetStatus || undefined,
          locationId: query.location || undefined,
        },
      });
      const payload = response.data?.data || {};
      const rows = payload.sessions || [];
      setItems(rows);
      setSummary(payload.summary || summary);
      setFilters(payload.filters || filters);
      setPagination(payload.pagination || pagination);
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Failed to load verification data.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVerification(true);
  }, []);

  const hasFilters = Object.values(query).some(Boolean);

  const stats = useMemo(() => [
    { label: 'Total Assets', value: summary.totalAssets },
    { label: 'Verified', value: summary.verified },
    { label: 'Pending', value: summary.pending },
    { label: 'Not Found', value: summary.notFound },
    { label: 'Discrepancies', value: summary.discrepancies },
    { label: 'Sessions', value: summary.sessions },
  ], [summary]);

  const handleFilterChange = (field, value) => {
    const nextValue = value === 'All' ? '' : value;
    setQuery((current) => ({ ...current, [field]: nextValue }));
  };

  const clearFilters = () => setQuery({ search: '', departmentId: '', status: '', assetStatus: '', location: '' });

  const refresh = () => {
    setRefreshing(true);
    loadVerification(false);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setRefreshing(true);
    loadVerification(false);
  };

  if (loading) {
    return (
      <div className="college-verification-state" aria-busy="true">
        <RefreshCw className="college-verification-spin" />
        <span>Loading verification data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="college-verification-state college-verification-error" role="alert">
        <AlertTriangle size={18} />
        <div>
          <strong>{error}</strong>
          <button type="button" onClick={() => loadVerification(true)}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="college-verification-page">
      <header className="college-verification-header">
        <div>
          <p className="college-verification-eyebrow"><ShieldCheck size={15} /> Verification Overview</p>
          <h3>Physical verification for the authorized college</h3>
        </div>
        <button type="button" className="college-verification-refresh" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      <section className="college-verification-kpis" aria-label="Verification KPI cards">
        {stats.map((stat) => (
          <div key={stat.label} className="college-verification-kpi">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <section className="college-verification-toolbar" aria-label="Verification filters">
        <form onSubmit={handleSearch} className="college-verification-search">
          <Search size={16} />
          <input
            value={query.search}
            onChange={(event) => setQuery((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search asset code, asset tag, name or department"
            aria-label="Search verification assets"
          />
        </form>

        <select value={query.departmentId} onChange={(event) => handleFilterChange('departmentId', event.target.value)}>
          <option value="">All departments</option>
          {filters.departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>

        <select value={query.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
          <option value="">All statuses</option>
          {filters.statuses.map((status) => (
            <option key={status} value={status}>{stateLabelMap[status] || status}</option>
          ))}
        </select>

        <select value={query.assetStatus} onChange={(event) => handleFilterChange('assetStatus', event.target.value)}>
          <option value="">All asset statuses</option>
          {filters.assetStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select value={query.location} onChange={(event) => handleFilterChange('location', event.target.value)}>
          <option value="">All locations</option>
          {filters.locations.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>

        {hasFilters && (
          <button type="button" className="college-verification-clear" onClick={clearFilters}>Clear Filters</button>
        )}
      </section>

      <section className="college-verification-panel">
        <div className="college-verification-panel-header">
          <h4>Verification Sessions</h4>
          <span>{pagination.total} total</span>
        </div>

        {items.length === 0 ? (
          <div className="college-verification-empty">No verification sessions found.</div>
        ) : (
          <div className="college-verification-table-wrap">
            <table className="college-verification-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Date</th>
                  <th>Department</th>
                  <th>Started By</th>
                  <th>Total Items</th>
                  <th>Verified</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((session) => (
                  <tr key={session.id}>
                    <td>#{session.id}</td>
                    <td>{formatDate(session.createdAt)}</td>
                    <td>{safeValue(session.Department?.name || session.department?.name)}</td>
                    <td>{safeValue(session.Starter?.fullName || session.Starter?.username || session.startedBy)}</td>
                    <td>{session.totalItems || 0}</td>
                    <td>{session.verified || 0}</td>
                    <td>{session.pending || 0}</td>
                    <td>
                      <span className={`status-pill ${statusBadges[session.status] || 'status-muted'}`}>
                        {stateLabelMap[session.status] || session.status}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="college-verification-action" disabled={submitting}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="college-verification-panel secondary">
        <div className="college-verification-panel-header">
          <h4>Verification Status</h4>
        </div>
        <div className="college-verification-status-list">
          {['verified', 'pending', 'missing', 'wrong_location', 'damaged', 'needs_review'].map((code) => (
            <div key={code} className="college-verification-status-item">
              <span className={`status-pill ${statusBadges[code] || 'status-muted'}`}>{stateLabelMap[code] || code}</span>
              <strong>{code === 'verified' ? summary.verified : code === 'pending' ? summary.pending : code === 'missing' ? summary.notFound : code === 'wrong_location' ? summary.discrepancies : code === 'damaged' ? summary.discrepancies : summary.discrepancies}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="college-verification-pagination">
        <button type="button" disabled={pagination.page <= 1} onClick={() => {}}>Previous</button>
        <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => {}}>Next</button>
      </div>
    </div>
  );
};

export default CollegeVerification;
