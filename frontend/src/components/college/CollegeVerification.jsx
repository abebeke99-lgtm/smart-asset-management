import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Building2, Check, CircleCheck, Clock3, Eye, FileText, History, MapPin, Package, RefreshCw, Search, SlidersHorizontal, TriangleAlert, UserRound, X } from 'lucide-react';
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

const statusIcons = {
  verified: CircleCheck,
  missing: TriangleAlert,
  wrong_location: TriangleAlert,
  damaged: TriangleAlert,
  unidentified: TriangleAlert,
  needs_review: Clock3,
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const safeValue = (value) => value === null || value === undefined || value === '' ? '—' : value;

const CollegeVerification = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState({ totalAssets: 0, verified: 0, pending: 0, notFound: 0, discrepancies: 0, sessions: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, pages: 1 });
  const [filters, setFilters] = useState({ departments: [], statuses: [], locations: [], assetStatuses: [] });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assetStatus: '', location: '' });
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [verificationResult, setVerificationResult] = useState('verified');
  const [verificationNotes, setVerificationNotes] = useState('');

  const loadVerification = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError('');
      const response = await apiClient.get('/api/college/verification', {
        params: {
          page,
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
      setAssets(payload.assets || []);
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
  }, [page]);

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
    setPage(1);
    setQuery((current) => ({ ...current, [field]: nextValue }));
  };

  const clearFilters = () => { setPage(1); setQuery({ search: '', departmentId: '', status: '', assetStatus: '', location: '' }); };

  const refresh = () => {
    setRefreshing(true);
    loadVerification(false);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setRefreshing(true);
    loadVerification(false);
  };

  const openVerification = (asset) => {
    setSelectedAsset(asset);
    setVerificationResult(asset.verificationStatus || 'verified');
    setVerificationNotes(asset.notes || '');
  };

  const closeVerification = () => {
    if (submitting) return;
    setSelectedAsset(null);
    setVerificationNotes('');
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!selectedAsset?.sessionId || !selectedAsset?.id) return;

    try {
      setSubmitting(true);
      await apiClient.post(`/api/college/verification/${selectedAsset.sessionId}/items`, {
        asset_id: selectedAsset.id,
        state: verificationResult,
        notes: verificationNotes.trim(),
      });
      setSelectedAsset(null);
      setVerificationNotes('');
      await loadVerification(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save verification result.');
    } finally {
      setSubmitting(false);
    }
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
          <p className="college-verification-eyebrow"><BadgeCheck size={15} /> Verification Overview</p>
          <h3>Physical verification for the authorized college</h3>
        </div>
        <button type="button" className="college-verification-refresh" onClick={refresh} disabled={refreshing} title="Refresh verification data">
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

        <SlidersHorizontal size={17} className="college-verification-filter-icon" aria-hidden="true" />
        <select value={query.departmentId} onChange={(event) => handleFilterChange('departmentId', event.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {filters.departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>

        <select value={query.status} onChange={(event) => handleFilterChange('status', event.target.value)} aria-label="Filter by verification status">
          <option value="">All statuses</option>
          {filters.statuses.map((status) => (
            <option key={status} value={status}>{stateLabelMap[status] || status}</option>
          ))}
        </select>

        <select value={query.assetStatus} onChange={(event) => handleFilterChange('assetStatus', event.target.value)} aria-label="Filter by asset status">
          <option value="">All asset statuses</option>
          {filters.assetStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select value={query.location} onChange={(event) => handleFilterChange('location', event.target.value)} aria-label="Filter by location">
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
          <h4><Package size={17} /> Assets in verification records</h4>
          <span>{assets.length} shown</span>
        </div>

        {assets.length === 0 ? (
          <div className="college-verification-empty">{hasFilters ? 'No assets match the selected filters.' : 'No assets require verification.'}</div>
        ) : (
          <div className="college-verification-table-wrap">
            <table className="college-verification-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Code / Serial</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Asset status</th>
                  <th>Verification</th>
                  <th>Last verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const StatusIcon = statusIcons[asset.verificationStatus] || Clock3;
                  return <tr key={`${asset.sessionId}-${asset.id}`}>
                    <td><strong>{safeValue(asset.name)}</strong><small>{safeValue(asset.category)}</small></td>
                    <td>{safeValue(asset.assetCode)}<small>{safeValue(asset.serialNumber)}</small></td>
                    <td><Building2 size={14} /> {safeValue(asset.department?.name)}</td>
                    <td><MapPin size={14} /> {safeValue(asset.location)}</td>
                    <td>{safeValue(asset.assetStatus)}<small>{safeValue(asset.condition)}</small></td>
                    <td><span className={`status-pill ${statusBadges[asset.verificationStatus] || 'status-muted'}`}><StatusIcon size={14} /> {stateLabelMap[asset.verificationStatus] || asset.verificationStatus}</span></td>
                    <td>{formatDate(asset.verificationDate)}</td>
                    <td>
                      <button type="button" className="college-verification-action" onClick={() => openVerification(asset)}><Eye size={15} /> Review</button>
                    </td>
                  </tr>;
                })}
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
              <span className={`status-pill ${statusBadges[code] || 'status-muted'}`}><span aria-hidden="true">{React.createElement(statusIcons[code] || Clock3, { size: 14 })}</span>{stateLabelMap[code] || code}</span>
              <strong>{code === 'verified' ? summary.verified : code === 'pending' ? summary.pending : code === 'missing' ? summary.notFound : code === 'wrong_location' ? summary.discrepancies : code === 'damaged' ? summary.discrepancies : summary.discrepancies}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="college-verification-pagination">
        <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>

      {selectedAsset && (
        <div className="college-verification-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeVerification(); }}>
          <form className="college-verification-modal" onSubmit={submitVerification}>
            <div className="college-verification-modal-header">
              <div><p className="college-verification-eyebrow"><BadgeCheck size={15} /> Asset being verified</p><h4>{safeValue(selectedAsset.name)}</h4></div>
              <button type="button" className="college-verification-icon-button" onClick={closeVerification} aria-label="Close verification dialog"><X size={18} /></button>
            </div>
            <div className="college-verification-detail-grid">
              <div><span><Package size={14} /> Asset code</span><strong>{safeValue(selectedAsset.assetCode)}</strong></div>
              <div><span><MapPin size={14} /> Location</span><strong>{safeValue(selectedAsset.location)}</strong></div>
              <div><span><Building2 size={14} /> Department</span><strong>{safeValue(selectedAsset.department?.name)}</strong></div>
              <div><span><UserRound size={14} /> Verified by</span><strong>{safeValue(selectedAsset.verifiedBy?.fullName || selectedAsset.verifiedBy?.username)}</strong></div>
              <div><span><History size={14} /> Previous result</span><strong>{stateLabelMap[selectedAsset.verificationStatus] || safeValue(selectedAsset.verificationStatus)}</strong></div>
              <div><span><FileText size={14} /> Previous notes</span><strong>{safeValue(selectedAsset.notes)}</strong></div>
            </div>
            <label>Verification result<select value={verificationResult} onChange={(event) => setVerificationResult(event.target.value)} disabled={submitting}>
              {['verified', 'needs_review', 'missing', 'wrong_location', 'damaged', 'unidentified'].map((value) => <option key={value} value={value}>{stateLabelMap[value]}</option>)}
            </select></label>
            <label>Notes<textarea value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} rows="3" placeholder="Record observations or required follow-up" disabled={submitting} /></label>
            <div className="college-verification-modal-actions"><button type="button" onClick={closeVerification} disabled={submitting}><X size={15} /> Cancel</button><button type="submit" className="primary" disabled={submitting}><Check size={15} /> {submitting ? 'Saving...' : 'Confirm verification'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CollegeVerification;
