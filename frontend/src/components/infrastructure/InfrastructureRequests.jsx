import React, { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardList, Eye, Loader2, Plus, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const EMPTY = { data: [], summary: {}, filters: { types: [], priorities: [], statuses: [] }, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
const title = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const display = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : value;

const InfrastructureRequests = () => {
  const [state, setState] = useState({ ...EMPTY, loading: true, error: '', tableLoading: false });
  const [query, setQuery] = useState({ search: '', status: '', type: '', priority: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({ type: '', item: '', asset_id: '', quantity: 1, priority: 'medium', reason: '' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await api.get('/infrastructure/requests', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const payload = response.data || EMPTY;
      setState({ ...EMPTY, ...payload, loading: false, tableLoading: false, error: '' });
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: error.response?.data?.message || 'Unable to load infrastructure requests.' }));
    }
  }, [page, query]);

  useEffect(() => { const timer = setTimeout(() => load(page === 1), 250); return () => clearTimeout(timer); }, [load, page]);
  useEffect(() => { if (state.filters.types.length && !form.type) setForm((previous) => ({ ...previous, type: state.filters.types[0] })); }, [form.type, state.filters.types]);

  const updateQuery = (field, value) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: value })); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await api.post('/infrastructure/requests', { ...form, quantity: Number(form.quantity) }); toast.success('Request submitted.'); setShowForm(false); setForm({ type: state.filters.types[0] || '', item: '', asset_id: '', quantity: 1, priority: 'medium', reason: '' }); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to submit request.'); }
    finally { setSaving(false); }
  };
  const submitDecision = async () => {
    if (!decision || (decision.value === 'rejected' && !reason.trim())) return;
    setSaving(true);
    try { await api.patch(`/infrastructure/requests/${decision.request.id}/decision`, { decision: decision.value, comment: reason.trim() }); toast.success(`Request ${decision.value}.`); setDecision(null); setReason(''); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to process request.'); }
    finally { setSaving(false); }
  };

  if (state.loading) return <div className="page-loading"><Loader2 className="loading-icon" /> Loading infrastructure requests...</div>;
  if (state.error) return <div className="page-error"><strong>{state.error}</strong><button type="button" onClick={() => load(true)}><RefreshCw size={16} /> Retry</button></div>;

  const pagination = state.pagination || EMPTY.pagination;
  const requests = state.data || [];
  const summary = state.summary || {};
  return <div className="infrastructure-requests-page" style={{ padding: 24 }}>
    <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
      <div><div className="eyebrow"><ClipboardList size={15} /> Infrastructure Directorate</div><h1>Requests</h1><p>Requests and approval decisions from the shared approval workflow.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={() => load()} disabled={state.tableLoading}><RefreshCw size={16} /> Refresh</button><button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New Request</button></div>
    </header>
    <section className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, margin: '20px 0' }}>{[['total', 'Total'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([key, label]) => <div className="stat-card" key={key}><span>{label}</span><strong>{Number(summary[key] || 0).toLocaleString()}</strong></div>)}</section>
    <section className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}><label className="search-field"><Search size={16} /><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder="Search item, requester, department, asset..." /></label>{[['status', 'All statuses', state.filters.statuses], ['type', 'All types', state.filters.types], ['priority', 'All priorities', state.filters.priorities]].map(([field, label, options]) => <select key={field} value={query[field]} onChange={(event) => updateQuery(field, event.target.value)}><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{title(option)}</option>)}</select>)}</section>
    <section className="table-panel"><div className="table-meta">{pagination.total ? `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} requests` : 'No request records found'} {state.tableLoading && <RefreshCw size={15} className="loading-icon" />}</div><div className="table-wrapper"><table><thead><tr><th>Request</th><th>Requester</th><th>Department</th><th>Type</th><th>Item</th><th>Qty</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.requestNumber}</strong><small>{date(request.createdAt)}</small></td><td>{display(request.requester?.name)}</td><td>{display(request.department?.name)}</td><td>{title(request.type)}</td><td>{display(request.item || request.asset?.name)}{request.asset?.assetCode && <small>{request.asset.assetCode}</small>}</td><td>{request.quantity}</td><td><span className={`badge priority-${request.priority}`}>{title(request.priority)}</span></td><td><span className={`badge status-${request.status}`}>{title(request.status)}</span></td><td className="actions"><button type="button" title="View details" onClick={() => setSelected(request)}><Eye size={16} /></button>{request.status === 'pending' && <><button type="button" title="Approve" onClick={() => setDecision({ request, value: 'approved' })}><Check size={16} /></button><button type="button" title="Reject" onClick={() => setDecision({ request, value: 'rejected' })}><XCircle size={16} /></button></>}</td></tr>)}</tbody></table></div><div className="pagination"><button type="button" disabled={page <= 1 || state.tableLoading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages || 1}</span><button type="button" disabled={page >= (pagination.totalPages || 1) || state.tableLoading} onClick={() => setPage((value) => value + 1)}>Next</button></div></section>

    {showForm && <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><div className="modal-heading"><h2>New Infrastructure Request</h2><button type="button" onClick={() => setShowForm(false)}><X /></button></div><label>Request type<select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{state.filters.types.map((type) => <option key={type} value={type}>{title(type)}</option>)}</select></label><label>Requested item<input required value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} /></label><label>Quantity<input required min="1" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{state.filters.priorities.map((priority) => <option key={priority} value={priority}>{title(priority)}</option>)}</select></label><label>Reason<textarea required rows="4" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Submitting...' : 'Submit request'}</button></form></div>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="modal-card"><div className="modal-heading"><h2>{selected.requestNumber}</h2><button type="button" onClick={() => setSelected(null)}><X /></button></div>{[['Request date', date(selected.createdAt)], ['Requester', display(selected.requester?.name)], ['Department', display(selected.department?.name)], ['Type', title(selected.type)], ['Item', display(selected.item || selected.asset?.name)], ['Quantity', selected.quantity], ['Priority', title(selected.priority)], ['Status', title(selected.status)], ['Reviewed by', display(selected.reviewer?.name)], ['Updated', date(selected.updatedAt)]].map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}<div><span>Reason</span><p>{display(selected.reason)}</p></div></section></div>}
    {decision && <div className="modal-backdrop"><section className="modal-card"><div className="modal-heading"><h2>{decision.value === 'approved' ? 'Approve request?' : 'Reject request?'}</h2><button type="button" onClick={() => setDecision(null)}><X /></button></div><p>{decision.request.requestNumber}: {display(decision.request.item || decision.request.asset?.name)}</p>{decision.value === 'rejected' && <label>Reason<textarea required rows="4" value={reason} onChange={(event) => setReason(event.target.value)} /></label>}<div className="modal-actions"><button type="button" onClick={() => setDecision(null)} disabled={saving}>Cancel</button><button type="button" className="btn btn-primary" onClick={submitDecision} disabled={saving || (decision.value === 'rejected' && !reason.trim())}>{saving ? 'Processing...' : `Confirm ${decision.value}`}</button></div></section></div>}
  </div>;
};

export default InfrastructureRequests;
