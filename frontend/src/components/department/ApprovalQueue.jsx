import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient, getApiErrorMessage } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import './ApprovalQueue.css';

const PAGE_SIZE = 20;
const statusTabs = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Changes Requested', label: 'Changes Requested' },
];
const actionDefinitions = [
  { id: 'approve', permission: 'department_head.approvals.approve', label: 'Approve', icon: Check },
  { id: 'reject', permission: 'department_head.approvals.reject', label: 'Reject', icon: XCircle, needsReason: true },
  { id: 'request-changes', permission: 'department_head.approvals.request_changes', label: 'Request Changes', icon: FileText, needsReason: true },
  { id: 'escalate', permission: 'department_head.approvals.escalate', label: 'Escalate to College', icon: AlertTriangle, needsReason: true },
];
const zeroSummary = { total: 0, Draft: 0, Submitted: 0, 'Under Review': 0, Approved: 0, Rejected: 0, 'Changes Requested': 0, Escalated: 0, Completed: 0 };
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const displayStatus = (value) => String(value || 'Unknown');
const statusCount = (summary, status) => status === 'All'
  ? Number(summary.total || 0)
  : status === 'Pending'
    ? Number(summary.Submitted || 0) + Number(summary['Under Review'] || 0)
    : Number(summary[status] || 0);
const historyAction = (status) => ({
  Approved: 'Approved',
  Rejected: 'Rejected',
  'Changes Requested': 'Changes requested',
  Escalated: 'Escalated to college',
  Submitted: 'Submitted',
  'Under Review': 'Moved to review',
  Completed: 'Completed',
}[status] || status || 'Updated');

const errorMessage = (error, action = 'load the approval queue') => {
  const messages = {
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to access or process these approval requests.',
    404: 'The request was not found in your department or is no longer awaiting review.',
    409: 'This request has already changed. Refresh the queue before trying again.',
    422: 'The approval action could not be processed. Check the details and try again.',
  };
  if (error.message && !error.response) return error.message;
  return messages[error.response?.status] || getApiErrorMessage(error, `Unable to ${action}.`);
};

const ApprovalQueue = () => {
  const { hasPermission } = useAuth();
  const canView = typeof hasPermission === 'function' && hasPermission('department_head.approvals.review');
  const allowedActions = actionDefinitions.filter((item) => hasPermission?.(item.permission));
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(zeroSummary);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', requestType: '', dateFrom: '', dateTo: '' });
  const [filterOptions, setFilterOptions] = useState({ priorities: [], requestTypes: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null);
  const page = pagination.page;
  const firstLoad = useRef(true);
  const previousFocus = useRef(null);
  const reviewTarget = useRef(null);
  const actionTrigger = useRef(null);
  const reviewClose = useRef(null);
  const confirmCancel = useRef(null);
  const reviewDialog = useRef(null);
  const confirmDialog = useRef(null);

  const loadQueue = useCallback(async (initial = false) => {
    if (!canView) {
      setError('You do not have permission to access the Approval Queue.');
      setLoading(false);
      return;
    }
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const params = {
        ...filters,
        page,
        limit: PAGE_SIZE,
        search: filters.search.trim() || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        requestType: filters.requestType || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      };
      const response = await apiClient.get('/api/department-head/approvals', { params });
      const data = response.data || {};
      if (!Array.isArray(data.data) || !data.pagination || !data.summary) {
        throw new Error('The approval service returned an incomplete queue response.');
      }
      setRequests(data.data);
      setSummary({ ...zeroSummary, ...(data.summary || {}) });
      setFilterOptions({
        priorities: Array.isArray(data.filters?.priorities) ? data.filters.priorities : [],
        requestTypes: Array.isArray(data.filters?.requestTypes) ? data.filters.requestTypes : [],
      });
      setPagination({
        page: Number(data.pagination?.page) || page,
        limit: Number(data.pagination?.limit) || PAGE_SIZE,
        total: Number(data.pagination?.total ?? data.total) || 0,
        pages: Number(data.pagination?.pages) || 0,
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, filters, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadQueue(firstLoad.current);
      firstLoad.current = false;
    }, filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue, filters.search]);

  const updateFilter = (name, value) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
    setPagination((previous) => ({ ...previous, page: 1 }));
  };

  const closeReview = useCallback(() => {
    setSelected(null);
    setAction(null);
    setDetailError('');
    setActionError('');
    reviewTarget.current = null;
    previousFocus.current?.focus?.();
  }, []);

  const closeAction = useCallback(() => {
    if (processing) return;
    setAction(null);
    setActionError('');
    actionTrigger.current?.focus?.();
  }, [processing]);

  const openReview = async (request, retry = false) => {
    if (!retry) {
      previousFocus.current = document.activeElement;
      reviewTarget.current = request;
    }
    setSelected(null);
    setDetailError('');
    setError('');
    setDetailLoading(true);
    try {
      const response = await apiClient.get(`/api/department-head/approvals/${request.id}`);
      const detail = response.data?.data;
      if (!detail || typeof detail !== 'object') throw new Error('The approval service returned an invalid request detail.');
      setSelected(detail);
    } catch (detailError) {
      setDetailError(errorMessage(detailError, 'review this request'));
    } finally {
      setDetailLoading(false);
    }
  };

  const startAction = (nextAction) => {
    actionTrigger.current = document.activeElement;
    setReason('');
    setActionError('');
    setAction(nextAction);
  };

  const downloadDocument = async (document) => {
    if (!selected?.asset?.id) {
      setDetailError('This document is not linked to an asset that can be securely downloaded.');
      return;
    }
    setDownloadingDocumentId(document.id);
    try {
      const response = await apiClient.get(`/api/assets/${selected.asset.id}/documents/${document.id}/file`, { responseType: 'blob' });
      const objectUrl = window.URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = String(document.name || 'asset-document').split(/[\\/]/).pop();
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    } catch (downloadError) {
      toast.error(errorMessage(downloadError, 'download this supporting document'));
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const submitAction = async () => {
    if (!selected || !action || processing || (action.needsReason && !reason.trim())) return;
    setProcessing(true);
    setActionError('');
    try {
      const response = await apiClient.post(`/api/department-head/approvals/${selected.id}/${action.id}`, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const updated = response.data?.data;
      if (updated && typeof updated === 'object') {
        setSelected(updated);
      } else {
        try {
          const detailResponse = await apiClient.get(`/api/department-head/approvals/${selected.id}`);
          const latest = detailResponse.data?.data;
          if (!latest || typeof latest !== 'object') throw new Error('The approval service returned an invalid request detail.');
          setSelected(latest);
        } catch (refreshError) {
          setSelected(null);
          setDetailError(`The decision was recorded, but updated request history could not be loaded. ${errorMessage(refreshError, 'load updated request history')}`);
        }
      }
      setAction(null);
      toast.success(`Request ${action.label.toLowerCase()} successfully.`);
      await loadQueue();
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure, `${action.label.toLowerCase()} this request`));
      if (actionFailure.response?.status === 409) await loadQueue();
    } finally {
      setProcessing(false);
    }
  };

  const handleDialogKeyDown = (event, dialogRef) => {
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (selected && !action) reviewClose.current?.focus();
    if (action) confirmCancel.current?.focus();
  }, [selected, action]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (action) closeAction();
      else if (selected) closeReview();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [action, closeAction, closeReview, selected]);

  if (!canView) {
    return <main className="approval-queue"><div className="approval-queue-error" role="alert">You do not have permission to access the Approval Queue.</div></main>;
  }

  const filtered = Object.values(filters).some(Boolean);
  const firstRow = pagination.total ? (page - 1) * pagination.limit + 1 : 0;
  const lastRow = Math.min(page * pagination.limit, pagination.total);
  const reviewActions = allowedActions.filter((item) => item.id !== 'escalate' || ['Submitted', 'Under Review'].includes(selected?.status));
  const statusLabel = (status) => status === 'Pending' ? 'Waiting for departmental decision' : ({
    Approved: 'Approved and forwarded',
    Rejected: 'Rejected',
    'Changes Requested': 'Returned to requester',
  }[status] || status);

  return (
    <main className="approval-queue">
      <header className="approval-queue-heading">
        <div>
          <span className="approval-queue-eyebrow"><ClipboardCheck size={16} /> Department / Operations</span>
          <h1>Approval Queue</h1>
          <p>Review departmental requests and monitor previous approval decisions.</p>
        </div>
        <button type="button" className="approval-queue-refresh" onClick={() => loadQueue()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'approval-queue-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="approval-queue-summary" aria-label="Approval request totals">
        <div><span>All requests</span><strong>{Number(summary.total || 0).toLocaleString()}</strong></div>
        <div><span>Pending</span><strong>{statusCount(summary, 'Pending').toLocaleString()}</strong></div>
        <div><span>Approved</span><strong>{statusCount(summary, 'Approved').toLocaleString()}</strong></div>
        <div><span>Rejected</span><strong>{statusCount(summary, 'Rejected').toLocaleString()}</strong></div>
        <div><span>Changes requested</span><strong>{statusCount(summary, 'Changes Requested').toLocaleString()}</strong></div>
      </section>

      <section className="approval-queue-panel">
        <nav className="approval-queue-tabs" aria-label="Filter requests by status">
          {statusTabs.map((tab) => (
            <button key={tab.value || 'all'} type="button" aria-pressed={filters.status === tab.value} onClick={() => updateFilter('status', tab.value)}>
              {tab.label}<span>{statusCount(summary, tab.value || 'All')}</span>
            </button>
          ))}
        </nav>
        <div className="approval-queue-filters" aria-label="Approval request filters">
          <label className="approval-queue-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search request ID, requester, or asset</span>
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search request ID, requester, or asset" />
          </label>
          <label><span className="sr-only">Filter by priority</span><select aria-label="Filter by priority" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}><option value="">All priorities</option>{filterOptions.priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Filter by request type</span><select aria-label="Filter by request type" value={filters.requestType} onChange={(event) => updateFilter('requestType', event.target.value)}><option value="">All request types</option>{filterOptions.requestTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Submitted from</span><input aria-label="Submitted from" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label><span className="sr-only">Submitted to</span><input aria-label="Submitted to" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          {filtered && <button type="button" className="approval-queue-clear" onClick={() => { setFilters({ search: '', status: '', priority: '', requestType: '', dateFrom: '', dateTo: '' }); setPagination((previous) => ({ ...previous, page: 1 })); }}>Clear filters</button>}
        </div>

        {error && <div className="approval-queue-error" role="alert"><span>{error}</span><button type="button" onClick={() => loadQueue(true)} disabled={refreshing}><RefreshCw size={15} /> Retry</button></div>}
        <div className="approval-queue-table-meta" aria-live="polite">
          <span>{loading ? 'Loading requests…' : pagination.total ? `Showing ${firstRow}–${lastRow} of ${pagination.total.toLocaleString()} requests` : filtered ? 'No requests match these filters.' : 'No approval requests found.'}</span>
          {refreshing && <RefreshCw size={15} className="approval-queue-spin" aria-label="Refreshing" />}
        </div>
        {loading ? (
          <div className="approval-queue-state" aria-busy="true"><RefreshCw size={19} className="approval-queue-spin" /> Loading approval requests…</div>
        ) : requests.length ? (
          <>
            <div className="approval-queue-table-wrap">
              <table>
                <caption className="sr-only">Department asset requests and approval decisions</caption>
                <thead><tr><th>Request ID</th><th>Requester</th><th>Department</th><th>Laboratory</th><th>Request type</th><th>Requested item / asset</th><th>Priority</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.requestNumber || request.requestCode || `#${request.id}`}</strong></td>
                    <td>{request.requester?.name || 'Not recorded'}</td>
                    <td>{request.department?.name || 'Not recorded'}</td>
                    <td>{request.laboratory?.name || 'Not recorded'}</td>
                    <td>{request.requestType || request.category || 'Asset Request'}</td>
                    <td>{request.asset?.name || request.requestedItem || 'Not recorded'}</td>
                    <td><span className={`approval-queue-priority priority-${String(request.priority || '').toLowerCase()}`}>{request.priority || 'Not recorded'}</span></td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td><span className={`approval-queue-status status-${String(request.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{displayStatus(request.status)}</span></td>
                    <td><button type="button" className="approval-queue-review" onClick={() => openReview(request)}>Review</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <footer className="approval-queue-pagination">
                <span>Page {page} of {pagination.pages}</span>
                <div>
                  <button type="button" onClick={() => setPagination((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }))} disabled={page <= 1 || refreshing}>Previous</button>
                  <button type="button" onClick={() => setPagination((previous) => ({ ...previous, page: Math.min(pagination.pages, previous.page + 1) }))} disabled={page >= pagination.pages || refreshing}>Next</button>
                </div>
              </footer>
            )}
          </>
        ) : !error && (
          <section className="approval-queue-empty"><ClipboardCheck size={30} aria-hidden="true" /><h2>{filtered ? 'No matching requests' : 'No approval requests'}</h2><p>{filtered ? 'Adjust your filters or search and try again.' : 'No requests are currently waiting for departmental approval.'}</p></section>
        )}
      </section>

      {detailLoading && <div className="approval-queue-backdrop" role="presentation"><div className="approval-queue-modal approval-queue-state" role="status"><RefreshCw size={20} className="approval-queue-spin" /> Loading request details…</div></div>}
      {detailError && !selected && <div className="approval-queue-error" role="alert"><span>{detailError}</span><button type="button" onClick={() => reviewTarget.current && openReview(reviewTarget.current, true)} disabled={detailLoading}><RefreshCw size={15} /> Retry</button></div>}
      {selected && (
        <div className="approval-queue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeReview()}>
          <section className="approval-queue-modal" role="dialog" aria-modal="true" aria-labelledby="approval-review-title" ref={reviewDialog} onKeyDown={(event) => handleDialogKeyDown(event, reviewDialog)}>
            <header className="approval-queue-modal-heading">
              <div><span className="approval-queue-eyebrow">Request review</span><h2 id="approval-review-title">{selected.requestNumber || selected.requestCode || `Request #${selected.id}`}</h2></div>
              <button type="button" ref={reviewClose} onClick={closeReview} aria-label="Close review"><X size={20} /></button>
            </header>
            {detailError && <div className="approval-queue-error" role="alert">{detailError}</div>}
            <dl className="approval-queue-details">
              <div><dt>Requester</dt><dd>{selected.requester?.name || 'Not recorded'}</dd></div>
              <div><dt>Requester ID / role</dt><dd>{selected.requester?.id ?? 'Not recorded'} · {selected.requester?.role || 'Not recorded'}</dd></div>
              <div><dt>Department</dt><dd>{selected.department?.name || 'Not recorded'}</dd></div>
              <div><dt>Laboratory</dt><dd>{selected.laboratory?.name || 'Not recorded'}</dd></div>
              <div><dt>Request type</dt><dd>{selected.requestType || selected.category || 'Asset Request'}</dd></div>
              <div><dt>Quantity</dt><dd>{selected.quantity ?? 'Not recorded'} {selected.unit || ''}</dd></div>
              <div><dt>Priority</dt><dd>{selected.priority || 'Not recorded'}</dd></div>
              <div><dt>Status</dt><dd><span className={`approval-queue-status status-${String(selected.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{displayStatus(selected.status)}</span><small>{statusLabel(selected.status)}</small></dd></div>
              <div><dt>Submitted</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>
            <section className="approval-queue-section"><h3>Request description</h3><p>{selected.description || selected.requestedItem || 'No description was provided.'}</p></section>
            <section className="approval-queue-section"><h3>Justification</h3><p>{selected.justification || selected.reason || 'No justification was provided.'}</p></section>
            <section className="approval-queue-section">
              <h3>Requested / affected asset</h3>
              {selected.asset ? <dl className="approval-queue-asset-details"><div><dt>Asset ID</dt><dd>{selected.asset.assetCode || selected.asset.id}</dd></div><div><dt>Name / category</dt><dd>{selected.asset.name || 'Not recorded'} · {selected.asset.category || 'Not recorded'}</dd></div><div><dt>Location</dt><dd>{selected.asset.location || 'Not recorded'}</dd></div><div><dt>Condition / status</dt><dd>{selected.asset.condition || 'Not recorded'} · {selected.asset.status || 'Not recorded'}</dd></div></dl> : <p>{selected.requestedItem || 'No linked asset is recorded for this request.'}</p>}
            </section>
            <section className="approval-queue-section">
              <h3>Supporting documents</h3>
              {selected.supportingDocuments?.length ? (
                <ul className="approval-queue-documents">{selected.supportingDocuments.map((document) => (
                  <li key={document.id}><FileText size={17} aria-hidden="true" /><span>{document.name}{document.description ? ` — ${document.description}` : ''}</span><button type="button" onClick={() => downloadDocument(document)} disabled={downloadingDocumentId === document.id} aria-label={`Download ${document.name}`}>{downloadingDocumentId === document.id ? <RefreshCw size={16} className="approval-queue-spin" /> : <Download size={16} />}</button></li>
                ))}</ul>
              ) : <p>No supporting documents are attached.</p>}
            </section>
            <section className="approval-queue-section">
              <h3>Approval history</h3>
              {selected.history?.length ? (
                <ol className="approval-queue-history">{selected.history.map((entry) => (
                  <li key={entry.id}><strong>{historyAction(entry.newStatus)} · {entry.previousStatus || 'Created'} → {entry.newStatus}</strong><span>{entry.changedByName || 'User'} · {entry.changedByRole || 'Role not recorded'} · {formatDate(entry.createdAt)}</span>{entry.comment && <p>{entry.comment}</p>}</li>
                ))}</ol>
              ) : <p>No approval history is recorded.</p>}
            </section>
            {['Submitted', 'Under Review'].includes(selected.status) && reviewActions.length > 0 && (
              <footer className="approval-queue-actions">
                {reviewActions.map((item) => <button type="button" key={item.id} className={`approval-queue-action action-${item.id}`} onClick={() => startAction(item)}><item.icon size={16} />{item.label}</button>)}
              </footer>
            )}
          </section>
        </div>
      )}

      {action && selected && (
        <div className="approval-queue-backdrop approval-queue-confirm-backdrop" role="presentation">
          <section className="approval-queue-confirm" role="dialog" aria-modal="true" aria-labelledby="approval-action-title" ref={confirmDialog} onKeyDown={(event) => handleDialogKeyDown(event, confirmDialog)}>
            <h2 id="approval-action-title">{action.label}</h2>
            <p>{action.id === 'approve'
              ? `Approve ${selected.requestNumber || selected.requestCode}? This request will proceed to the next workflow stage.`
              : `${action.label} for ${selected.requestNumber || selected.requestCode}.`}</p>
            <label htmlFor="approval-action-reason">{action.needsReason ? 'Reason (required)' : 'Comment (optional)'}</label>
            <textarea id="approval-action-reason" value={reason} onChange={(event) => { setReason(event.target.value); setActionError(''); }} rows={4} required={action.needsReason} maxLength={1000} aria-describedby={actionError ? 'approval-action-error' : undefined} />
            {actionError && <p className="approval-queue-action-error" id="approval-action-error" role="alert">{actionError}</p>}
            <div className="approval-queue-confirm-actions">
              <button type="button" ref={confirmCancel} onClick={closeAction} disabled={processing}>Cancel</button>
              <button type="button" className={`action-${action.id}`} onClick={submitAction} disabled={processing || (action.needsReason && !reason.trim())}>{processing ? <><RefreshCw size={15} className="approval-queue-spin" /> Processing…</> : action.label}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default ApprovalQueue;
