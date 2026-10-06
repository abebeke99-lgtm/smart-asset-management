import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, ExternalLink, FileText, RefreshCw, X, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, getApiErrorMessage, resolveAssetUrl } from '../../utils/api';
import './ApprovalQueue.css';

const actions = [
  { id: 'approve', label: 'Approve', permission: 'department_head.approvals.approve', icon: Check },
  { id: 'reject', label: 'Reject', permission: 'department_head.approvals.reject', icon: XCircle, needsReason: true },
  { id: 'request-changes', label: 'Request Changes', permission: 'department_head.approvals.request_changes', icon: FileText, needsReason: true },
  { id: 'escalate', label: 'Escalate to College', permission: 'department_head.approvals.escalate', icon: AlertTriangle, needsReason: true },
];
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const displayStatus = (value) => String(value || 'Unknown');

const ApprovalQueue = () => {
  const { hasPermission } = useAuth();
  const canReview = hasPermission('department_head.approvals.review');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadQueue = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await apiClient.get('/api/department-head/approvals');
      setRequests(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load the approval queue.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (canReview) loadQueue(true);
  }, [canReview, loadQueue]);

  const openReview = async (request) => {
    setError('');
    try {
      const response = await apiClient.get(`/api/department-head/approvals/${request.id}`);
      setSelected(response.data?.data || request);
    } catch (detailError) {
      setError(getApiErrorMessage(detailError, 'Unable to review this request.'));
    }
  };

  const startAction = (nextAction) => {
    setReason('');
    setAction(nextAction);
  };

  const submitAction = async () => {
    if (!selected || !action || processing || (action.needsReason && !reason.trim())) return;
    setProcessing(true);
    setError('');
    try {
      await apiClient.post(`/api/department-head/approvals/${selected.id}/${action.id}`, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setAction(null);
      setSelected(null);
      await loadQueue();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, `Unable to ${action.label.toLowerCase()} this request.`));
    } finally {
      setProcessing(false);
    }
  };

  if (!canReview) {
    return <main className="approval-queue-state" role="alert">You do not have permission to review department approvals.</main>;
  }

  return (
    <main className="approval-queue">
      <header className="approval-queue-heading">
        <div>
          <span className="approval-queue-eyebrow"><ClipboardCheck size={16} /> Department workspace</span>
          <h1>Approval Queue</h1>
          <p>Review pending requests submitted to your department.</p>
        </div>
        <button type="button" className="approval-queue-refresh" onClick={() => loadQueue()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'approval-queue-spin' : ''} /> Refresh
        </button>
      </header>

      {error && <div className="approval-queue-error" role="alert">{error}</div>}
      {loading ? (
        <div className="approval-queue-state" aria-busy="true">Loading pending requests...</div>
      ) : requests.length ? (
        <section className="approval-queue-table-wrap" aria-label="Pending approval requests">
          <table>
            <caption className="sr-only">Pending approval requests for your department</caption>
            <thead><tr><th>Request</th><th>Requested item</th><th>Requester</th><th>Priority</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request.id}>
                <td><strong>{request.requestNumber || request.requestCode}</strong></td>
                <td>{request.requestedItem || request.item || request.asset?.name || 'Not recorded'}</td>
                <td>{request.requester?.name || 'Not recorded'}</td>
                <td>{request.priority || 'Not recorded'}</td>
                <td>{formatDate(request.createdAt)}</td>
                <td><span className={`approval-queue-status status-${String(request.status).toLowerCase().replace(/\s+/g, '-')}`}>{displayStatus(request.status)}</span></td>
                <td><button type="button" className="approval-queue-review" onClick={() => openReview(request)}>Review</button></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      ) : (
        <section className="approval-queue-empty"><ClipboardCheck size={30} /><h2>No pending requests</h2><p>New department requests will appear here.</p></section>
      )}

      {selected && (
        <div className="approval-queue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="approval-queue-modal" role="dialog" aria-modal="true" aria-labelledby="approval-review-title">
            <header className="approval-queue-modal-heading">
              <div><span className="approval-queue-eyebrow">Request review</span><h2 id="approval-review-title">{selected.requestNumber || selected.requestCode}</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close review"><X size={20} /></button>
            </header>
            <dl className="approval-queue-details">
              <div><dt>Requested item</dt><dd>{selected.requestedItem || selected.item || selected.asset?.name || 'Not recorded'}</dd></div>
              <div><dt>Requester</dt><dd>{selected.requester?.name || 'Not recorded'}</dd></div>
              <div><dt>Quantity</dt><dd>{selected.quantity ?? 'Not recorded'} {selected.unit || ''}</dd></div>
              <div><dt>Priority</dt><dd>{selected.priority || 'Not recorded'}</dd></div>
              <div><dt>Status</dt><dd>{displayStatus(selected.status)}</dd></div>
              <div><dt>Submitted</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>
            <section className="approval-queue-section"><h3>Justification</h3><p>{selected.justification || selected.reason || 'No justification was provided.'}</p></section>
            {selected.description && <section className="approval-queue-section"><h3>Additional details</h3><p>{selected.description}</p></section>}
            <section className="approval-queue-section">
              <h3>Supporting documents</h3>
              {selected.supportingDocuments?.length ? (
                <ul className="approval-queue-documents">{selected.supportingDocuments.map((document) => (
                  <li key={document.id}>
                    <FileText size={17} />
                    <span>{document.name}{document.description ? ` — ${document.description}` : ''}</span>
                    <a href={resolveAssetUrl(document.filePath)} target="_blank" rel="noreferrer" aria-label={`Open ${document.name}`}><ExternalLink size={16} /></a>
                  </li>
                ))}</ul>
              ) : <p>No supporting documents are attached.</p>}
            </section>
            <section className="approval-queue-section">
              <h3>Approval history</h3>
              {selected.history?.length ? (
                <ol className="approval-queue-history">{selected.history.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.previousStatus || 'Created'} → {entry.newStatus}</strong>
                    <span>{entry.changedByName || 'User'} · {formatDate(entry.createdAt)}</span>
                    {entry.comment && <p>{entry.comment}</p>}
                  </li>
                ))}</ol>
              ) : <p>No approval history is recorded.</p>}
            </section>
            {selected.status === 'Submitted' || selected.status === 'Under Review' ? (
              <footer className="approval-queue-actions">
                {actions.filter((item) => hasPermission(item.permission)).map((item) => (
                  <button type="button" key={item.id} className={`approval-queue-action action-${item.id}`} onClick={() => startAction(item)}>
                    <item.icon size={16} /> {item.label}
                  </button>
                ))}
              </footer>
            ) : null}
          </section>
        </div>
      )}

      {action && selected && (
        <div className="approval-queue-backdrop approval-queue-confirm-backdrop" role="presentation">
          <section className="approval-queue-confirm" role="dialog" aria-modal="true" aria-labelledby="approval-action-title">
            <h2 id="approval-action-title">{action.label}</h2>
            <p>Confirm this action for {selected.requestNumber || selected.requestCode}.</p>
            <label htmlFor="approval-action-reason">{action.needsReason ? 'Reason (required)' : 'Comment (optional)'}</label>
            <textarea id="approval-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
            <div className="approval-queue-confirm-actions">
              <button type="button" onClick={() => setAction(null)} disabled={processing}>Cancel</button>
              <button type="button" onClick={submitAction} disabled={processing || (action.needsReason && !reason.trim())}>{processing ? 'Saving...' : action.label}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default ApprovalQueue;
