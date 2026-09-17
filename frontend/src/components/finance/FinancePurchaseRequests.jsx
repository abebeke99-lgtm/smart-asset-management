import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Filter, Package, RefreshCw, Search, X } from 'lucide-react';
import api from '../../services/api';

const emptyPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };
const valueOf = (value, fallback = '-') => (value === undefined || value === null || value === '' ? fallback : value);
const dateText = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString('en-GB');
};
const statusClass = (status) => `request-status status-${String(status || '').toLowerCase()}`;
const readPayload = (response) => response?.data?.data || response?.data || {};

export default function FinancePurchaseRequests() {
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [filters, setFilters] = useState({ departments: [], statuses: [], priorities: [] });
  const [query, setQuery] = useState({ search: '', status: '', priority: '', departmentId: '', dateFrom: '', dateTo: '' });
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/finance/purchase-requests', { params: { page, limit: 20, ...query } });
      const payload = readPayload(response);
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      setSummary(payload.summary || { total: 0 });
      setFilters(payload.filters || { departments: [], statuses: [], priorities: [] });
      setPagination(response.data?.pagination || emptyPagination);
    } catch (requestError) {
      setRequests([]);
      setSummary({ total: 0 });
      setError({ status: requestError.response?.status, message: requestError.response?.data?.message || 'Unable to load purchase requests. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  const changeQuery = (name, value) => { setPage(1); setQuery((current) => ({ ...current, [name]: value })); };
  const showDetails = async (request) => {
    setSelected({ ...request });
    setDetailsLoading(true);
    try {
      const response = await api.get(`/api/finance/purchase-requests/${request.id}`);
      setSelected(readPayload(response));
    } catch (requestError) {
      setSelected({ ...request, detailsError: requestError.response?.data?.message || 'Unable to load request details.' });
    } finally {
      setDetailsLoading(false);
    }
  };
  const clearFilters = () => { setPage(1); setQuery({ search: '', status: '', priority: '', departmentId: '', dateFrom: '', dateTo: '' }); };
  const errorLabel = error?.status === 401 ? 'Authentication is required to view purchase requests.' : error?.status === 403 ? 'You are not authorized to view purchase requests.' : error?.status >= 500 ? 'The server could not load purchase requests. Please try again.' : error?.message;

  return (
    <main className="finance-purchase-page">
      <style>{`
        .finance-purchase-page { min-height: 100%; padding: 24px; background: #f8fafc; color: #0f172a; }
        .purchase-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
        .purchase-heading h1 { margin: 0 0 6px; font-size: 25px; } .purchase-heading p { margin: 0; color: #64748b; }
        .purchase-action { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cbd5e1; background: white; color: #0f172a; border-radius: 6px; padding: 9px 12px; cursor: pointer; }
        .purchase-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .purchase-kpi, .purchase-panel { background: white; border: 1px solid #e2e8f0; border-radius: 8px; } .purchase-kpi { padding: 16px; }
        .purchase-kpi span { display: block; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; } .purchase-kpi strong { display: block; margin-top: 8px; font-size: 24px; }
        .purchase-filters { display: grid; grid-template-columns: minmax(180px, 2fr) repeat(5, minmax(120px, 1fr)) auto; gap: 8px; padding: 14px; margin-bottom: 14px; }
        .purchase-input, .purchase-select { width: 100%; min-width: 0; box-sizing: border-box; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 5px; background: white; color: #0f172a; }
        .purchase-search { position: relative; } .purchase-search svg { position: absolute; left: 9px; top: 10px; color: #64748b; } .purchase-search input { padding-left: 31px; }
        .purchase-table-wrap { overflow-x: auto; } .purchase-table { width: 100%; min-width: 900px; border-collapse: collapse; }
        .purchase-table th, .purchase-table td { text-align: left; padding: 12px 14px; border-top: 1px solid #e2e8f0; white-space: nowrap; font-size: 13px; } .purchase-table th { color: #475569; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        .request-status { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e2e8f0; color: #334155; font-size: 12px; text-transform: capitalize; } .status-approved { background: #dcfce7; color: #166534; } .status-pending { background: #fef3c7; color: #92400e; } .status-rejected, .status-cancelled { background: #fee2e2; color: #991b1b; }
        .purchase-empty, .purchase-error { padding: 44px 20px; text-align: center; color: #64748b; } .purchase-error { color: #b91c1c; } .purchase-pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; color: #64748b; font-size: 13px; }
        .purchase-page-buttons { display: flex; gap: 6px; } .purchase-icon { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid #cbd5e1; border-radius: 5px; background: white; cursor: pointer; } .purchase-icon:disabled { opacity: .45; cursor: default; }
        .purchase-modal-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: rgb(15 23 42 / 45%); } .purchase-modal { width: min(620px, 100%); max-height: 90vh; overflow: auto; background: white; border-radius: 8px; padding: 20px; } .purchase-modal-header { display: flex; justify-content: space-between; align-items: center; } .purchase-modal h2 { margin: 0; font-size: 20px; } .purchase-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; } .purchase-detail label { display: block; color: #64748b; font-size: 12px; margin-bottom: 3px; } .purchase-detail strong { font-weight: 600; overflow-wrap: anywhere; }
        @media (max-width: 900px) { .purchase-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); } .purchase-filters { grid-template-columns: repeat(3, minmax(0, 1fr)); } } @media (max-width: 560px) { .finance-purchase-page { padding: 14px; } .purchase-heading { display: block; } .purchase-heading .purchase-action { margin-top: 12px; } .purchase-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .purchase-filters, .purchase-detail-grid { grid-template-columns: 1fr; } }
      `}</style>
      <header className="purchase-heading"><div><h1>Purchase Requests</h1><p>Review purchase requests recorded in the approval workflow.</p></div><button className="purchase-action" type="button" onClick={loadRequests} disabled={loading}><RefreshCw size={15} /> Refresh</button></header>
      <section className="purchase-summary" aria-label="Purchase request summary"><div className="purchase-kpi"><span>Total Requests</span><strong>{summary.total || 0}</strong></div>{(filters.statuses || []).map((status) => <div className="purchase-kpi" key={status}><span>{status}</span><strong>{summary[status] || 0}</strong></div>)}</section>
      <section className="purchase-panel purchase-filters" aria-label="Purchase request filters"><div className="purchase-search"><Search size={16} /><input className="purchase-input" value={query.search} onChange={(event) => changeQuery('search', event.target.value)} placeholder="Search requests" /></div><select className="purchase-select" value={query.status} onChange={(event) => changeQuery('status', event.target.value)}><option value="">All statuses</option>{filters.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><select className="purchase-select" value={query.priority} onChange={(event) => changeQuery('priority', event.target.value)}><option value="">All priorities</option>{filters.priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><select className="purchase-select" value={query.departmentId} onChange={(event) => changeQuery('departmentId', event.target.value)}><option value="">All departments</option>{filters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><input className="purchase-input" type="date" value={query.dateFrom} onChange={(event) => changeQuery('dateFrom', event.target.value)} aria-label="Date from" /><input className="purchase-input" type="date" value={query.dateTo} onChange={(event) => changeQuery('dateTo', event.target.value)} aria-label="Date to" /><button className="purchase-icon" type="button" title="Clear filters" onClick={clearFilters}><Filter size={15} /></button></section>
      <section className="purchase-panel">{loading ? <div className="purchase-empty"><RefreshCw size={22} /> Loading purchase requests...</div> : error ? <div className="purchase-error"><p>{errorLabel}</p><button className="purchase-action" type="button" onClick={loadRequests}>Retry</button></div> : requests.length === 0 ? <div className="purchase-empty"><Package size={30} /><p>No purchase requests found.</p></div> : <div className="purchase-table-wrap"><table className="purchase-table"><thead><tr><th>Request ID</th><th>Requested date</th><th>Requester</th><th>Department</th><th>Item</th><th>Quantity</th><th>Priority</th><th>Status</th><th>Updated date</th><th>Actions</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>REQ-{String(request.id).padStart(6, '0')}</td><td>{dateText(request.requestedDate)}</td><td>{valueOf(request.requester?.name, request.requestedBy)}</td><td>{valueOf(request.department?.name)}</td><td>{valueOf(request.item)}</td><td>{valueOf(request.quantity)}</td><td>{valueOf(request.priority)}</td><td><span className={statusClass(request.status)}>{valueOf(request.status)}</span></td><td>{dateText(request.updatedDate)}</td><td><button className="purchase-icon" type="button" title="View details" onClick={() => showDetails(request)}><Eye size={15} /></button></td></tr>)}</tbody></table></div>}{!loading && !error && requests.length > 0 && <div className="purchase-pagination"><span>{pagination.total || 0} records</span><div className="purchase-page-buttons"><button className="purchase-icon" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button><span>Page {pagination.page || page} of {pagination.totalPages || 1}</span><button className="purchase-icon" type="button" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button></div></div>}</section>
      {selected && <div className="purchase-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="purchase-modal" role="dialog" aria-modal="true" aria-label="Purchase request details" onClick={(event) => event.stopPropagation()}><div className="purchase-modal-header"><h2>Purchase Request REQ-{String(selected.id).padStart(6, '0')}</h2><button className="purchase-icon" type="button" title="Close" onClick={() => setSelected(null)}><X size={16} /></button></div>{detailsLoading ? <div className="purchase-empty">Loading details...</div> : selected.detailsError ? <div className="purchase-error">{selected.detailsError}</div> : <div className="purchase-detail-grid"><div className="purchase-detail"><label>Requester</label><strong>{valueOf(selected.requester?.name, selected.requestedBy)}</strong></div><div className="purchase-detail"><label>Department</label><strong>{valueOf(selected.department?.name)}</strong></div><div className="purchase-detail"><label>Item</label><strong>{valueOf(selected.item)}</strong></div><div className="purchase-detail"><label>Quantity</label><strong>{valueOf(selected.quantity)}</strong></div><div className="purchase-detail"><label>Priority</label><strong>{valueOf(selected.priority)}</strong></div><div className="purchase-detail"><label>Status</label><strong>{valueOf(selected.status)}</strong></div><div className="purchase-detail"><label>Reason</label><strong>{valueOf(selected.reason)}</strong></div><div className="purchase-detail"><label>Comment</label><strong>{valueOf(selected.comment)}</strong></div><div className="purchase-detail"><label>Requested date</label><strong>{dateText(selected.requestedDate)}</strong></div><div className="purchase-detail"><label>Updated date</label><strong>{dateText(selected.updatedDate)}</strong></div>{selected.reviewer && <div className="purchase-detail"><label>Reviewer</label><strong>{valueOf(selected.reviewer.name)}</strong></div>}</div>}</section></div>}
    </main>
  );
}