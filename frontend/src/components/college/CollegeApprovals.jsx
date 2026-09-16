import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Eye, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import './CollegeApprovals.css';

const emptyState = { summary: { total: 0, pending: 0, approved: 0, rejected: 0 }, approvals: [], filters: { departments: [], statuses: [], types: [], priorities: [] }, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
const title = (value) => String(value || 'Not recorded').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const valueOr = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : value;
const date = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const errorMessage = (error, action = 'load approvals') => ({ 401: 'Your session has expired. Please sign in again.', 403: 'You are not authorized to access college approvals.', 404: 'The approval request was not found in your college.', 409: 'This request has already changed. The approvals list has been refreshed.', 422: 'The approval decision could not be processed.' }[error.response?.status] || `Unable to ${action}.`);

const CollegeApprovals = () => {
  const [state, setState] = useState({ ...emptyState, loading: true, error: '', tableLoading: false });
  const [query, setQuery] = useState({ search: '', status: '', departmentId: '', requestType: '', priority: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/approvals', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const data = response.data?.data || emptyState;
      setState((previous) => ({ ...previous, ...data, approvals: data.requests || [], loading: false, tableLoading: false, error: '' }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: errorMessage(error) }));
    }
  }, [page, query]);

  useEffect(() => {
    const timer = setTimeout(() => { load(firstLoad.current); firstLoad.current = false; }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') { setSelected(null); setConfirmation(null); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const updateQuery = (field, nextValue) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: nextValue })); };
  const clearFilters = () => { setPage(1); setQuery({ search: '', status: '', departmentId: '', requestType: '', priority: '' }); };
  const hasFilters = Object.values(query).some(Boolean);
  const openDecision = (approval, decision) => { setSelected(null); setReason(''); setConfirmation({ approval, decision }); };
  const submitDecision = async () => {
    if (!confirmation || processing || (confirmation.decision === 'rejected' && !reason.trim())) return;
    setProcessing(true);
    try {
      await apiClient.post(`/api/college/approvals/${confirmation.approval.id}/${confirmation.decision}`, confirmation.decision === 'rejected' ? { reason: reason.trim() } : {});
      toast.success(`Request ${confirmation.decision} successfully.`);
      setConfirmation(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, `process the request`));
      if (error.response?.status === 409) await load();
    } finally { setProcessing(false); }
  };

  if (state.loading) return <div className="college-approvals-state" aria-busy="true"><RefreshCw className="college-approvals-spin" /> Loading approvals...</div>;
  if (state.error) return <div className="college-approvals-state college-approvals-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => load(true)}><RefreshCw size={16} /> Retry</button></div>;

  const pagination = state.pagination || emptyState.pagination;
  const first = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);
  const approvals = state.approvals || [];

  return <div className="college-approvals-page">
    <header className="college-approvals-heading"><div><span className="college-approvals-eyebrow"><ClipboardCheck size={15} /> College Manager</span><h1>Approvals</h1><p>Review and process approval requests within your college.</p></div><button className="college-approvals-refresh" type="button" onClick={() => load()} disabled={state.tableLoading}><RefreshCw size={16} className={state.tableLoading ? 'college-approvals-spin' : ''} /> Refresh</button></header>
    <section className="college-approvals-summary" aria-label="Approval summary">{[['total', 'Total Approval Items'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([key, label]) => <div className="college-approvals-stat" key={key}><span>{label}</span><strong>{Number(state.summary?.[key] || 0).toLocaleString()}</strong></div>)}</section>
    <section className="college-approvals-toolbar" aria-label="Approval filters"><label className="college-approvals-search"><Search size={17} /><span className="sr-only">Search approvals</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder="Search ID, requester, item, department..." /></label><label><span className="sr-only">Status</span><select value={query.status} onChange={(event) => updateQuery('status', event.target.value)}><option value="">All statuses</option>{(state.filters?.statuses || []).map((item) => <option value={item} key={item}>{title(item)}</option>)}</select></label><label><span className="sr-only">Department</span><select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}><option value="">All departments</option>{(state.filters?.departments || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Request type</span><select value={query.requestType} onChange={(event) => updateQuery('requestType', event.target.value)}><option value="">All types</option>{(state.filters?.types || []).map((item) => <option value={item} key={item}>{title(item)}</option>)}</select></label><label><span className="sr-only">Priority</span><select value={query.priority} onChange={(event) => updateQuery('priority', event.target.value)}><option value="">All priorities</option>{(state.filters?.priorities || []).map((item) => <option value={item} key={item}>{title(item)}</option>)}</select></label>{hasFilters && <button className="college-approvals-clear" type="button" onClick={clearFilters}><X size={15} /> Clear Filters</button>}</section>
    <section className="college-approvals-table-panel"><div className="college-approvals-table-meta"><strong>{pagination.total ? `Showing ${first}-${last} of ${pagination.total} approval items` : hasFilters ? 'No approvals match your filters' : 'No approval records found'}</strong>{state.tableLoading && <RefreshCw size={15} className="college-approvals-spin" />}</div>{approvals.length ? <div className="college-approvals-table-wrap"><table><caption className="sr-only">College approval requests</caption><thead><tr><th>Request ID</th><th>Request Date</th><th>Requester</th><th>Department</th><th>Type</th><th>Requested Item</th><th>Qty</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>{approvals.map((approval) => <tr key={approval.id}><td><strong>{approval.requestNumber}</strong></td><td>{date(approval.createdAt)}</td><td>{valueOr(approval.requester?.name)}</td><td>{valueOr(approval.department?.name)}</td><td>{title(approval.type)}</td><td>{valueOr(approval.item || approval.asset?.name)}{approval.asset?.assetCode && <small>{approval.asset.assetCode}</small>}</td><td>{valueOr(approval.quantity)}</td><td><span className={`college-approvals-badge priority-${approval.priority}`}>{title(approval.priority)}</span></td><td><span className={`college-approvals-badge status-${approval.status}`}>{title(approval.status)}</span></td><td className="college-approvals-actions"><button type="button" onClick={() => setSelected(approval)} aria-label={`View ${approval.requestNumber} details`} title="View details"><Eye size={16} /></button>{approval.status === 'pending' && <><button className="approve" type="button" onClick={() => openDecision(approval, 'approve')} aria-label={`Approve ${approval.requestNumber}`} title="Approve"><Check size={16} /></button><button className="reject" type="button" onClick={() => openDecision(approval, 'reject')} aria-label={`Reject ${approval.requestNumber}`} title="Reject"><XCircle size={16} /></button></>}</td></tr>)}</tbody></table></div> : <div className="college-approvals-empty"><ClipboardCheck size={30} /><strong>{hasFilters ? 'No approvals match your current filters.' : 'No approval records found.'}</strong>{hasFilters && <button type="button" onClick={clearFilters}>Clear Filters</button>}</div>}<nav className="college-approvals-pagination" aria-label="Approval pages"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}</span><button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</button></nav></section>
    {selected && <div className="college-approvals-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="college-approvals-modal" role="dialog" aria-modal="true" aria-labelledby="approval-details-title"><div className="college-approvals-modal-head"><div><span className="college-approvals-eyebrow">Approval details</span><h2 id="approval-details-title">{selected.requestNumber}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close approval details"><X /></button></div><div className="college-approvals-details">{[['Request Date', date(selected.createdAt)], ['Type', title(selected.type)], ['Status', title(selected.status)], ['Priority', title(selected.priority)], ['Requester', valueOr(selected.requester?.name)], ['Username', valueOr(selected.requester?.username)], ['Department', valueOr(selected.department?.name)], ['Requested Item', valueOr(selected.item || selected.asset?.name)], ['Category', valueOr(selected.asset?.category)], ['Quantity', valueOr(selected.quantity)], ['Reviewed By', valueOr(selected.reviewer?.name)], ['Last Updated', date(selected.updatedAt)]].map(([label, display]) => <div key={label}><span>{label}</span><strong>{display}</strong></div>)}</div><div className="college-approvals-description"><span>Reason</span><p>{valueOr(selected.reason)}</p></div>{selected.status === 'pending' && <div className="college-approvals-modal-actions"><button type="button" className="approve-button" onClick={() => openDecision(selected, 'approve')}><Check size={16} /> Approve</button><button type="button" className="reject-button" onClick={() => openDecision(selected, 'reject')}><XCircle size={16} /> Reject</button></div>}</section></div>}
    {confirmation && <div className="college-approvals-backdrop" role="presentation"><section className="college-approvals-confirm" role="dialog" aria-modal="true" aria-labelledby="approval-confirm-title"><h2 id="approval-confirm-title">{confirmation.decision === 'approve' ? 'Approve request?' : 'Reject request?'}</h2><p><strong>{confirmation.approval.requestNumber}</strong> for {valueOr(confirmation.approval.item || confirmation.approval.asset?.name)}.</p>{confirmation.decision === 'reject' && <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows="4" required /></label>}<div className="college-approvals-modal-actions"><button type="button" onClick={() => setConfirmation(null)} disabled={processing}>Cancel</button><button type="button" className={confirmation.decision === 'approve' ? 'approve-button' : 'reject-button'} onClick={submitDecision} disabled={processing || (confirmation.decision === 'reject' && !reason.trim())}>{processing && <RefreshCw size={15} className="college-approvals-spin" />}{processing ? 'Processing...' : `Confirm ${confirmation.decision}`}</button></div></section></div>}
  </div>;
};

export default CollegeApprovals;
