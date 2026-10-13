/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Package, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './CollegeVerification.css';

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
  const auth = useAuth() || {};
  const navigate = useNavigate();
  const canManage = Boolean(auth.hasPermission?.('college.verification.manage'));
  const canRegisterAssets = Boolean(auth.hasPermission?.('college.assets.create'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalAssets: 0, verified: 0, pending: 0, notFound: 0, discrepancies: 0, sessions: 0, statusCounts: {} });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ departments: [], statuses: [], locations: [], assetStatuses: [] });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', resultState: '', assetStatus: '', location: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionDepartmentId, setSessionDepartmentId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [sessionAssets, setSessionAssets] = useState([]);
  const [assetIndex, setAssetIndex] = useState(0);
  const [assetState, setAssetState] = useState('verified');
  const [assetNotes, setAssetNotes] = useState('');
  const [observedLocation, setObservedLocation] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');

  const loadVerification = async (showLoader = true, requestedPage = currentPage) => {
    try {
      if (showLoader) setLoading(true);
      setError('');
      const response = await apiClient.get('/api/college/verification', {
        params: {
          page: requestedPage,
          limit: pagination.limit,
          ...query,
          search: query.search || undefined,
          departmentId: query.departmentId || undefined,
          status: query.status || undefined,
          resultState: query.resultState || undefined,
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
      if (Number(payload.pagination?.page) > 0 && Number(payload.pagination.page) !== requestedPage) {
        setCurrentPage(Number(payload.pagination.page));
      }
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Failed to load verification data.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadVerification(true), query.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [currentPage, query.search, query.departmentId, query.status, query.resultState, query.assetStatus, query.location]);

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
    setCurrentPage(1);
    setQuery((current) => ({ ...current, [field]: nextValue }));
  };

  const clearFilters = () => {
    setCurrentPage(1);
    setQuery({ search: '', departmentId: '', status: '', resultState: '', assetStatus: '', location: '' });
  };

  const refresh = () => {
    setRefreshing(true);
    loadVerification(false);
  };

  const loadCollegeAssets = async (departmentId) => {
    const firstResponse = await apiClient.get('/api/college/assets', { params: { page: 1, limit: 100 } });
    const firstPayload = firstResponse.data;
    if (!firstPayload || !Array.isArray(firstPayload.data)) throw new Error('The server returned invalid college asset data.');
    const assets = [...firstPayload.data].filter((asset) => !departmentId || Number(asset.departmentId) === Number(departmentId));
    const totalPages = Math.max(1, Number(firstPayload.pagination?.pages || firstPayload.pagination?.totalPages) || 1);
    for (let page = 2; page <= totalPages; page += 1) {
      const response = await apiClient.get('/api/college/assets', { params: { page, limit: 100 } });
      if (!Array.isArray(response.data?.data)) throw new Error('The server returned invalid college asset data.');
      assets.push(...response.data.data.filter((asset) => !departmentId || Number(asset.departmentId) === Number(departmentId)));
    }
    return assets;
  };

  const openSession = async (session) => {
    setSessionLoading(true);
    setSessionError('');
    setSessionNotice('');
    try {
      const sessionResponse = await apiClient.get(`/api/college/verification/${session.id}`);
      const data = sessionResponse.data?.data;
      if (!data) throw new Error('The server returned invalid verification data.');
      const sessionItems = data.VerificationItems || data.verificationItems || [];
      let assets = sessionItems.map((item) => item.Asset || item.asset).filter(Boolean);
      if (!assets.length) assets = await loadCollegeAssets(data.departmentId);
      if (!Array.isArray(assets)) throw new Error('The server returned invalid verification data.');
      setActiveSession({ ...data, VerificationItems: sessionItems });
      setSessionAssets(assets);
      const checkedAssetIds = new Set(sessionItems
        .filter((item) => item.state !== 'pending')
        .map((item) => Number(item.assetId)));
      const nextIndex = assets.findIndex((asset) => !checkedAssetIds.has(Number(asset.id)));
      const selectedIndex = nextIndex >= 0 ? nextIndex : 0;
      const selectedItem = sessionItems.find((item) => Number(item.assetId) === Number(assets[selectedIndex]?.id));
      setAssetIndex(selectedIndex);
      setAssetState(selectedItem?.state && selectedItem.state !== 'pending' ? selectedItem.state : 'verified');
      setAssetNotes(selectedItem?.notes || '');
      setObservedLocation(selectedItem?.observedLocation || selectedItem?.observed_location || '');
    } catch (requestError) {
      setSessionError(requestError.response?.data?.message || requestError.message || 'Unable to load verification session.');
    } finally {
      setSessionLoading(false);
    }
  };

  const startSession = async (event) => {
    event.preventDefault();
    setSessionLoading(true);
    setSessionError('');
    try {
      const response = await apiClient.post('/api/college/verification', {
        name: sessionName.trim(),
        ...(sessionDepartmentId ? { department_id: Number(sessionDepartmentId) } : {}),
      });
      const session = response.data?.data;
      if (!session?.id) throw new Error(response.data?.message || 'Unable to create verification session.');
      setSessionDialogOpen(false);
      setSessionName('');
      if (currentPage === 1) await loadVerification(false, 1);
      else setCurrentPage(1);
      await openSession(session);
    } catch (requestError) {
      setSessionError(requestError.response?.data?.message || requestError.message || 'Unable to start verification session.');
    } finally {
      setSessionLoading(false);
    }
  };

  const recordCurrentAsset = async (event) => {
    event.preventDefault();
    const asset = sessionAssets[assetIndex];
    if (!activeSession || !asset || submitting) return;
    setSubmitting(true);
    setSessionError('');
    setSessionNotice('');
    try {
      const response = await apiClient.post(`/api/college/verification/${activeSession.id}/items`, {
        asset_id: asset.id,
        state: assetState,
        notes: assetNotes.trim(),
        observed_location: observedLocation.trim(),
      });
      const item = response.data?.data;
      if (!item?.id) throw new Error(response.data?.message || 'The verification result was not saved.');
      setActiveSession((current) => {
        const currentItems = current.VerificationItems || [];
        const existingIndex = currentItems.findIndex((record) => Number(record.assetId) === Number(item.assetId));
        const nextItems = existingIndex >= 0
          ? currentItems.map((record, index) => index === existingIndex ? { ...record, ...item, Asset: record.Asset || record.asset } : record)
          : [...currentItems, item];
        return { ...current, VerificationItems: nextItems };
      });
      setSessionNotice(`${asset.name || asset.assetCode} recorded as ${stateLabelMap[assetState] || assetState}.`);
      setAssetNotes('');
      setObservedLocation('');
      setAssetState('verified');
      const recordedIds = new Set([
        ...(activeSession.VerificationItems || [])
          .filter((record) => record.state !== 'pending')
          .map((record) => Number(record.assetId)),
        Number(item.assetId),
      ]);
      const nextIndex = sessionAssets.findIndex((candidate, index) => index > assetIndex && !recordedIds.has(Number(candidate.id)));
      if (nextIndex >= 0) setAssetIndex(nextIndex);
      else if (assetIndex < sessionAssets.length - 1) {
        const firstUnchecked = sessionAssets.findIndex((candidate) => !recordedIds.has(Number(candidate.id)));
        if (firstUnchecked >= 0) setAssetIndex(firstUnchecked);
      }
      await loadVerification(false);
    } catch (requestError) {
      setSessionError(requestError.response?.data?.message || requestError.message || 'Unable to record this asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const finishSession = async () => {
    if (!activeSession || submitting) return;
    setSubmitting(true);
    setSessionError('');
    try {
      await apiClient.post(`/api/college/verification/${activeSession.id}/submit`, {});
      setActiveSession((current) => ({ ...current, status: 'submitted' }));
      await loadVerification(false);
    } catch (requestError) {
      setSessionError(requestError.response?.data?.message || requestError.message || 'Unable to submit verification session.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectAsset = (index) => {
    const asset = sessionAssets[index];
    const recordedItem = (activeSession?.VerificationItems || []).find((item) => Number(item.assetId) === Number(asset?.id));
    setAssetIndex(index);
    setAssetState(recordedItem?.state && recordedItem.state !== 'pending' ? recordedItem.state : 'verified');
    setAssetNotes(recordedItem?.notes || '');
    setObservedLocation(recordedItem?.observedLocation || recordedItem?.observed_location || '');
    setSessionNotice('');
  };

  const selectStatus = (state) => {
    handleFilterChange('resultState', query.resultState === state ? '' : state);
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
        <div className="college-verification-header-actions">
          {canRegisterAssets && <button type="button" className="college-verification-action" onClick={() => navigate('/college/assets')}><Package size={15} /> Register asset</button>}
          {canManage && <button type="button" className="college-verification-start" onClick={() => { setSessionError(''); setSessionDepartmentId(''); setSessionDialogOpen(true); }} disabled={!summary.totalAssets}><Plus size={15} /> Start verification</button>}
          <button type="button" className="college-verification-refresh" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>
      {sessionError && !activeSession && !sessionDialogOpen && (
        <div className="college-verification-inline-error" role="alert">
          <AlertTriangle size={17} />
          <span>{sessionError}</span>
          <button type="button" onClick={() => setSessionError('')}>Dismiss</button>
        </div>
      )}

      <section className="college-verification-kpis" aria-label="Verification KPI cards">
        {stats.map((stat) => (
          <div key={stat.label} className="college-verification-kpi">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <section className="college-verification-toolbar" aria-label="Verification filters">
        <form onSubmit={(event) => event.preventDefault()} className="college-verification-search">
          <Search size={16} />
          <input
            value={query.search}
            onChange={(event) => {
              setCurrentPage(1);
              setQuery((current) => ({ ...current, search: event.target.value }));
            }}
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
          <option value="">All session statuses</option>
          {filters.statuses.map((status) => (
            <option key={status} value={status}>{stateLabelMap[status] || status}</option>
          ))}
        </select>

        <select value={query.resultState} onChange={(event) => handleFilterChange('resultState', event.target.value)} aria-label="Verification result status">
          <option value="">All verification results</option>
          {['verified', 'pending', 'missing', 'wrong_location', 'damaged', 'needs_review'].map((state) => (
            <option key={state} value={state}>{stateLabelMap[state]}</option>
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
                      <button type="button" className="college-verification-action" disabled={sessionLoading} onClick={() => openSession(session)}>View</button>
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
          <div>
            <h4>Verification Status</h4>
            <p className="college-verification-panel-description">Counts reflect the latest active session, or the most recent session when none is active.</p>
          </div>
        </div>
        <div className="college-verification-status-list">
          {['verified', 'pending', 'missing', 'wrong_location', 'damaged', 'needs_review'].map((code) => (
            <button
              type="button"
              key={code}
              className={`college-verification-status-item${query.resultState === code ? ' is-selected' : ''}`}
              aria-pressed={query.resultState === code}
              aria-label={`Filter by ${stateLabelMap[code]} verification result`}
              onClick={() => selectStatus(code)}
            >
              <span className={`status-pill ${statusBadges[code] || 'status-muted'}`}>{stateLabelMap[code] || code}</span>
              <strong>{summary.statusCounts?.[code] ?? (code === 'verified' ? summary.verified : code === 'pending' ? summary.pending : code === 'missing' ? summary.notFound : 0)}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="college-verification-pagination">
        <button type="button" disabled={refreshing || pagination.page <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
        <span aria-live="polite">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={refreshing || pagination.page >= pagination.totalPages} onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}>Next</button>
      </div>

      {summary.totalAssets === 0 && canManage && (
        <div className="college-verification-no-assets" role="status">
          <Package size={20} />
          <span>Register college assets before starting a verification.</span>
          <button type="button" onClick={() => navigate('/college/assets')}>Register assets</button>
        </div>
      )}

      {sessionDialogOpen && (
        <div className="college-verification-modal-backdrop" role="presentation">
          <section className="college-verification-modal" role="dialog" aria-modal="true" aria-labelledby="verification-start-title">
            <div className="college-verification-modal-header">
              <div><span className="college-verification-eyebrow">New verification</span><h3 id="verification-start-title">Start a verification session</h3></div>
              <button type="button" aria-label="Close" onClick={() => setSessionDialogOpen(false)} disabled={sessionLoading}><X size={18} /></button>
            </div>
            {sessionError && <p className="college-verification-modal-error" role="alert">{sessionError}</p>}
            <form onSubmit={startSession}>
              <label htmlFor="verification-session-name">Session name</label>
              <input id="verification-session-name" value={sessionName} onChange={(event) => setSessionName(event.target.value)} required minLength={2} maxLength={255} placeholder="e.g. Laboratory inventory check" />
              {filters.departments.length > 0 && (
                <>
                  <label htmlFor="verification-session-department">Department scope</label>
                  <select id="verification-session-department" value={sessionDepartmentId} onChange={(event) => setSessionDepartmentId(event.target.value)}>
                    <option value="">All college departments</option>
                    {filters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </>
              )}
              <p>Assets are checked and recorded one at a time. The session will use assets registered to your college.</p>
              <button type="submit" disabled={sessionLoading || sessionName.trim().length < 2}>{sessionLoading ? 'Starting...' : 'Start session'}</button>
            </form>
          </section>
        </div>
      )}

      {activeSession && (
        <div className="college-verification-modal-backdrop" role="presentation">
          <section className="college-verification-modal college-verification-workflow" role="dialog" aria-modal="true" aria-labelledby="verification-workflow-title">
            <div className="college-verification-modal-header">
              <div><span className="college-verification-eyebrow">Session #{activeSession.id}</span><h3 id="verification-workflow-title">{activeSession.name}</h3></div>
              <button type="button" aria-label="Close verification session" onClick={() => { setActiveSession(null); setSessionError(''); setSessionNotice(''); }}><X size={18} /></button>
            </div>
            {sessionLoading ? <div className="college-verification-state" aria-busy="true"><RefreshCw /> Loading assets...</div> : sessionAssets.length === 0 ? (
              <div className="college-verification-empty"><Package size={22} /> No college assets are available to verify.</div>
            ) : (
              <>
                <div className="college-verification-progress">
                  <strong>Asset {assetIndex + 1} of {sessionAssets.length}</strong>
                  <span>{(activeSession.VerificationItems || []).filter((item) => item.state !== 'pending').length} recorded</span>
                </div>
                <div className="college-verification-asset-card">
                  <span>{sessionAssets[assetIndex]?.assetCode || 'Asset code unavailable'}</span>
                  <h4>{sessionAssets[assetIndex]?.name || 'Unnamed asset'}</h4>
                  <p>{[sessionAssets[assetIndex]?.category, sessionAssets[assetIndex]?.departmentName || sessionAssets[assetIndex]?.department, sessionAssets[assetIndex]?.location].filter(Boolean).join(' · ') || 'No additional asset details'}</p>
                  {(activeSession.VerificationItems || []).some((item) => Number(item.assetId) === Number(sessionAssets[assetIndex]?.id)) && (
                    (() => {
                      const currentItem = (activeSession.VerificationItems || []).find((item) => Number(item.assetId) === Number(sessionAssets[assetIndex]?.id));
                      return (
                        <span className={`college-verification-recorded ${statusBadges[currentItem?.state] || 'status-muted'}`}>
                          {currentItem?.state === 'pending' ? 'Not yet inspected' : `Recorded: ${stateLabelMap[currentItem?.state] || 'Needs review'}`}
                        </span>
                      );
                    })()
                  )}
                </div>
                {sessionError && <p className="college-verification-modal-error" role="alert">{sessionError}</p>}
                {sessionNotice && <p className="college-verification-modal-success" role="status"><Check size={15} /> {sessionNotice}</p>}
                {['draft', 'in_progress'].includes(activeSession.status) && (
                  <form className="college-verification-record-form" onSubmit={recordCurrentAsset}>
                    <label htmlFor="verification-asset-result">Observed result</label>
                    <select id="verification-asset-result" value={assetState} onChange={(event) => setAssetState(event.target.value)}>
                      {['verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'].map((status) => <option key={status} value={status}>{stateLabelMap[status]}</option>)}
                    </select>
                    <label htmlFor="verification-asset-notes">Notes (optional)</label>
                    <textarea id="verification-asset-notes" value={assetNotes} onChange={(event) => setAssetNotes(event.target.value)} maxLength={2000} rows={3} />
                    <label htmlFor="verification-observed-location">Observed location (optional)</label>
                    <input id="verification-observed-location" value={observedLocation} onChange={(event) => setObservedLocation(event.target.value)} maxLength={255} />
                    <button type="submit" className="college-verification-start" disabled={submitting}>{submitting ? 'Saving...' : 'Save result and continue'}</button>
                  </form>
                )}
                <div className="college-verification-workflow-footer">
                  <button type="button" className="college-verification-action" disabled={assetIndex <= 0} onClick={() => selectAsset(Math.max(0, assetIndex - 1))}> <ChevronLeft size={15} /> Previous asset</button>
                  <button type="button" className="college-verification-action" disabled={assetIndex >= sessionAssets.length - 1} onClick={() => selectAsset(Math.min(sessionAssets.length - 1, assetIndex + 1))}>Next asset <ChevronRight size={15} /></button>
                  {['draft', 'in_progress'].includes(activeSession.status) && <button type="button" className="college-verification-finish" disabled={submitting || !(activeSession.VerificationItems || []).length} onClick={finishSession}>Finish session</button>}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default CollegeVerification;
