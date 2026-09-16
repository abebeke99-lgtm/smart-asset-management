import React, { useEffect, useState } from 'react';
import { ClipboardList, Eye, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeAssignments.css';

const emptyData = {
  summary: { total: 0 },
  assignments: [],
  filters: { departments: [], statuses: [], users: [], categories: [], locations: [] },
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : value;
const date = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const errorMessage = (error, action = 'load assignments') => ({
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not authorized to view college assignments.',
  404: 'The assignment records were not found.',
}[error.response?.status] || `Unable to ${action}.`);

const CollegeAssignments = () => {
  const [state, setState] = useState({ ...emptyData, loading: true, tableLoading: false, error: '' });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadAssignments = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/assignments', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const payload = response.data?.data || emptyData;
      setState((previous) => ({ ...previous, ...payload, loading: false, tableLoading: false, error: '' }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: errorMessage(error) }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAssignments(page === 1 && !state.assignments.length && state.loading), 300);
    return () => clearTimeout(timer);
  }, [page, query.search, query.departmentId, query.status, query.assignedTo, query.location, query.category]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const updateQuery = (field, value) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: value })); };
  const clearFilters = () => { setPage(1); setQuery({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' }); };
  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination || emptyData.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);
  const summaryKeys = Object.keys(state.summary || {}).filter((key) => key !== 'total');

  if (state.loading) return <div className="college-assignments-state" aria-busy="true"><RefreshCw className="college-assignments-spin" /> Loading assignments...</div>;
  if (state.error) return <div className="college-assignments-state college-assignments-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => loadAssignments(true)}><RefreshCw size={16} /> Retry</button></div>;

  return <div className="college-assignments-page">
    <header className="college-assignments-heading"><div><span className="college-assignments-eyebrow"><ClipboardList size={15} /> College Manager</span><h1>Asset Assignments</h1><p>Manage asset assignments within your college.</p></div><button className="college-assignments-refresh" type="button" onClick={() => loadAssignments()} disabled={state.tableLoading}><RefreshCw size={16} className={state.tableLoading ? 'college-assignments-spin' : ''} /> Refresh</button></header>
    <section className="college-assignments-summary" aria-label="Assignment summary"><div className="college-assignments-stat"><span>Total Assignments</span><strong>{Number(state.summary?.total || 0).toLocaleString()}</strong></div>{summaryKeys.map((key) => <div className="college-assignments-stat" key={key}><span>{label(key)}</span><strong>{Number(state.summary[key] || 0).toLocaleString()}</strong></div>)}</section>
    <section className="college-assignments-toolbar" aria-label="Assignment filters"><label className="college-assignments-search"><Search size={17} /><span className="sr-only">Search assignments</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder="Search assignment, asset, serial, person..." /></label><label><span className="sr-only">Department</span><select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}><option value="">All departments</option>{(state.filters?.departments || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Status</span><select value={query.status} onChange={(event) => updateQuery('status', event.target.value)}><option value="">All statuses</option>{(state.filters?.statuses || []).map((item) => <option value={item} key={item}>{label(item)}</option>)}</select></label><label><span className="sr-only">Assigned user</span><select value={query.assignedTo} onChange={(event) => updateQuery('assignedTo', event.target.value)}><option value="">All assigned users</option>{(state.filters?.users || []).map((item) => <option value={item.id} key={item.id}>{item.fullName || item.username}</option>)}</select></label><label><span className="sr-only">Category</span><select value={query.category} onChange={(event) => updateQuery('category', event.target.value)}><option value="">All categories</option>{(state.filters?.categories || []).map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span className="sr-only">Location</span><select value={query.location} onChange={(event) => updateQuery('location', event.target.value)}><option value="">All locations</option>{(state.filters?.locations || []).map((item) => <option value={item} key={item}>{item}</option>)}</select></label>{hasFilters && <button className="college-assignments-clear" type="button" onClick={clearFilters}><X size={15} /> Clear Filters</button>}</section>
    <section className="college-assignments-table-panel"><div className="college-assignments-table-meta"><strong>{pagination.total ? `Showing ${first}-${last} of ${pagination.total} assignments` : hasFilters ? 'No assignments match your filters' : 'No assignment records found'}</strong>{state.tableLoading && <RefreshCw size={15} className="college-assignments-spin" />}</div>{state.assignments.length ? <div className="college-assignments-table-wrap"><table><caption className="sr-only">College asset assignments</caption><thead><tr><th>Assignment ID</th><th>Asset</th><th>Assigned To</th><th>Department</th><th>Location</th><th>Assignment Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.assignments.map((assignment) => <tr key={assignment.id}><td><strong>#{assignment.id}</strong></td><td>{display(assignment.asset?.name)}<small>{display(assignment.asset?.code)}</small></td><td>{display(assignment.assignee?.name)}<small>{display(assignment.assignee?.username)}</small></td><td>{display(assignment.department?.name)}</td><td>{display(assignment.location)}</td><td>{date(assignment.assignedDate)}</td><td><span className={`college-assignments-badge status-${String(assignment.status || '').toLowerCase()}`}>{label(assignment.status)}</span></td><td><button className="college-assignments-icon-button" type="button" onClick={() => setSelected(assignment)} aria-label={`View assignment ${assignment.id} details`} title="View details"><Eye size={17} /></button></td></tr>)}</tbody></table></div> : <div className="college-assignments-empty"><ClipboardList size={30} /><strong>{hasFilters ? 'No assignments match your current filters.' : 'No assignment records found.'}</strong>{hasFilters && <button type="button" onClick={clearFilters}>Clear Filters</button>}</div>}<nav className="college-assignments-pagination" aria-label="Assignment pages"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}</span><button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></section>
    {selected && <div className="college-assignments-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="college-assignments-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-details-title"><div className="college-assignments-modal-head"><div><span className="college-assignments-eyebrow">Assignment details</span><h2 id="assignment-details-title">Assignment #{selected.id}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close assignment details"><X /></button></div><div className="college-assignments-details">{[['Asset', selected.asset?.name], ['Asset Code', selected.asset?.code], ['Serial Number', selected.asset?.serialNumber], ['Category', selected.asset?.category], ['Assignment ID', selected.id], ['Assignment Date', date(selected.assignedDate)], ['Expected Return', date(selected.expectedReturnDate)], ['Status', label(selected.status)], ['Assignee', selected.assignee?.name], ['Username', selected.assignee?.username], ['Department', selected.department?.name], ['Location', selected.location], ['Created', date(selected.createdAt)], ['Updated', date(selected.updatedAt)]].map(([title, value]) => <div key={title}><span>{title}</span><strong>{display(value)}</strong></div>)}</div>{selected.notes && <div className="college-assignments-notes"><span>Notes</span><p>{selected.notes}</p></div>}</section></div>}
  </div>;
};

export default CollegeAssignments;
