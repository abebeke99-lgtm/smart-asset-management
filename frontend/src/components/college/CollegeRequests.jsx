import React, { useEffect, useState } from 'react';
import { Eye, FileText, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeRequests.css';

const statuses = ['pending', 'approved', 'rejected', 'cancelled'];
const emptySummary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
const emptyPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : value;
const date = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';

const CollegeRequests = () => {
  const [state, setState] = useState({ loading: true, tableLoading: false, error: '', requests: [], summary: emptySummary, filters: { departments: [], statuses }, pagination: emptyPagination });
  const [query, setQuery] = useState({ search: '', status: '', departmentId: '', priority: '', requestType: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadRequests = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/requests', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const payload = response.data?.data || {};
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, requests: payload.requests || [], summary: payload.summary || emptySummary, filters: payload.filters || previous.filters, pagination: payload.pagination || emptyPagination }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: error.response?.status === 403 ? 'You are not authorized to view college requests.' : 'Unable to load college requests.' }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadRequests(!state.requests.length && state.loading), 300);
    return () => clearTimeout(timer);
  }, [page, query.search, query.status, query.departmentId, query.priority, query.requestType]);

  const updateQuery = (field, value) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: value })); };
  const clearFilters = () => { setPage(1); setQuery({ search: '', status: '', departmentId: '', priority: '', requestType: '' }); };
  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) return <div className="college-requests-state" aria-busy="true"><RefreshCw className="college-requests-spin" /> Loading asset requests...</div>;
  if (state.error) return <div className="college-requests-state college-requests-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => loadRequests(true)}><RefreshCw size={16} /> Retry</button></div>;

  return <div className="college-requests-page">
    <header className="college-requests-heading"><div><span className="college-requests-eyebrow"><FileText size={15} /> College Manager</span><h1>Asset Requests</h1><p>Manage asset requests within your college.</p></div><button className="college-requests-refresh" type="button" onClick={() => loadRequests()} disabled={state.tableLoading}><RefreshCw size={16} className={state.tableLoading ? 'college-requests-spin' : ''} /> Refresh</button></header>
    <section className="college-requests-summary" aria-label="Request summary">{[['total', 'Total Requests'], ...statuses.map((value) => [value, label(value)])].map(([key, title]) => <div className="college-requests-stat" key={key}><span>{title}</span><strong>{Number(state.summary[key] || 0).toLocaleString()}</strong></div>)}</section>
    <section className="college-requests-toolbar" aria-label="Request filters"><label className="college-requests-search"><Search size={17} /><span className="sr-only">Search requests</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder="Search ID, requester, item, department..." /></label><label><span className="sr-only">Status</span><select value={query.status} onChange={(event) => updateQuery('status', event.target.value)}><option value="">All statuses</option>{(state.filters.statuses || statuses).map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label><label><span className="sr-only">Department</span><select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}><option value="">All departments</option>{(state.filters.departments || []).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label><label><span className="sr-only">Priority</span><select value={query.priority} onChange={(event) => updateQuery('priority', event.target.value)}><option value="">All priorities</option>{['low', 'medium', 'high', 'critical'].map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>{hasFilters && <button className="college-requests-clear" type="button" onClick={clearFilters}><X size={15} /> Clear Filters</button>}</section>
    <section className="college-requests-table-panel"><div className="college-requests-table-meta"><strong>{pagination.total ? `Showing ${first}-${last} of ${pagination.total} requests` : hasFilters ? 'No requests match your filters' : 'No requests found'}</strong>{state.tableLoading && <RefreshCw size={15} className="college-requests-spin" />}</div>{state.requests.length ? <div className="college-requests-table-wrap"><table><caption className="sr-only">College asset requests</caption><thead><tr><th>Request ID</th><th>Date</th><th>Requester</th><th>Department</th><th>Requested Item</th><th>Quantity</th><th>Priority</th><th>Status</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>{state.requests.map((request) => <tr key={request.id}><td><strong>{request.requestNumber}</strong></td><td>{date(request.createdAt)}</td><td>{display(request.requester?.name)}</td><td>{display(request.department?.name)}</td><td>{display(request.item || request.asset?.name)}{request.asset?.assetCode && <small>{request.asset.assetCode}</small>}</td><td>{display(request.quantity)}</td><td><span className={`college-requests-badge priority-${request.priority}`}>{label(request.priority)}</span></td><td><span className={`college-requests-badge status-${request.status}`}>{label(request.status)}</span></td><td>{date(request.updatedAt)}</td><td><button className="college-requests-icon-button" type="button" onClick={() => setSelected(request)} aria-label={`View ${request.requestNumber} details`} title="View details"><Eye size={17} /></button></td></tr>)}</tbody></table></div> : <div className="college-requests-empty"><FileText size={30} /><strong>{hasFilters ? 'No requests match your current filters.' : 'No asset requests found.'}</strong>{hasFilters && <button type="button" onClick={clearFilters}>Clear Filters</button>}</div>}<nav className="college-requests-pagination" aria-label="Request pages"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}</span><button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></section>
    {selected && <div className="college-requests-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="college-requests-modal" role="dialog" aria-modal="true" aria-labelledby="college-request-details-title"><div className="college-requests-modal-head"><div><span className="college-requests-eyebrow">Request details</span><h2 id="college-request-details-title">{selected.requestNumber}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close request details"><X /></button></div><div className="college-requests-details">{[['Request Date', date(selected.createdAt)], ['Type', label(selected.type)], ['Status', label(selected.status)], ['Priority', label(selected.priority)], ['Requester', display(selected.requester?.name)], ['Username', display(selected.requester?.username)], ['Department', display(selected.department?.name)], ['Requested Item', display(selected.item || selected.asset?.name)], ['Category', display(selected.asset?.category)], ['Quantity', display(selected.quantity)], ['Last Updated', date(selected.updatedAt)], ['Reviewed By', display(selected.reviewer?.name)]].map(([title, value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</div><div className="college-requests-description"><span>Reason</span><p>{display(selected.reason)}</p></div></section></div>}
  </div>;
};

export default CollegeRequests;