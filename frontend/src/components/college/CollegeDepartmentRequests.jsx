import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileText, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeRequests.css';

const emptySummary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
const emptyPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : value;
const date = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');

const CollegeDepartmentRequests = () => {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState({ search: '', status: '', departmentId: '', priority: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pagination, setPagination] = useState(emptyPagination);
  const [filters, setFilters] = useState({ departments: [], statuses: ['pending', 'approved', 'rejected', 'cancelled'], priorities: ['low', 'medium', 'high', 'critical'] });

  const loadRequests = async (initial = false) => {
    setLoading(initial);
    setTableLoading(!initial);
    setError('');

    try {
      const response = await apiClient.get('/api/college/department-requests', {
        params: { ...query, page, limit: 10, search: query.search || undefined },
      });

      const payload = response.data || {};
      setRequests(payload.data || []);
      setSummary(payload.summary || emptySummary);
      setPagination(payload.pagination || emptyPagination);
      setFilters((previous) => ({ ...previous, ...(payload.filters || {}) }));
    } catch (loadError) {
      const status = loadError.response?.status;
      const messages = {
        401: 'Your session has expired. Please sign in again.',
        403: 'You are not authorized to view department requests.',
        404: 'Department request data was not found.',
        409: 'This request list is stale. Please refresh.',
        422: 'The request filter could not be validated.',
      };
      setError(messages[status] || 'Failed to load department requests.');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadRequests(!requests.length && loading), 250);
    return () => clearTimeout(timer);
  }, [page, query.search, query.status, query.departmentId, query.priority]);

  const updateQuery = (field, value) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setQuery({ search: '', status: '', departmentId: '', priority: '' });
  };

  const hasFilters = Object.values(query).some(Boolean);
  const first = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  const summaryCards = useMemo(() => [
    ['total', 'Total Requests'],
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['cancelled', 'Cancelled'],
  ], []);

  if (loading) {
    return (
      <div className="college-requests-state" aria-busy="true">
        <RefreshCw className="college-requests-spin" />
        Loading department requests...
      </div>
    );
  }

  if (error) {
    return (
      <div className="college-requests-state college-requests-error" role="alert">
        <strong>{error}</strong>
        <button type="button" onClick={() => loadRequests(true)}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="college-requests-page">
      <header className="college-requests-heading">
        <div>
          <span className="college-requests-eyebrow"><FileText size={15} /> College Manager</span>
          <h1>Department Requests</h1>
          <p>Track department requests within your college.</p>
        </div>
        <button className="college-requests-refresh" type="button" onClick={() => loadRequests()} disabled={tableLoading}>
          <RefreshCw size={16} className={tableLoading ? 'college-requests-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="college-requests-summary" aria-label="Department request summary">
        {summaryCards.map(([key, title]) => (
          <div className="college-requests-stat" key={key}>
            <span>{title}</span>
            <strong>{Number(summary?.[key] || 0).toLocaleString()}</strong>
          </div>
        ))}
      </section>

      <section className="college-requests-toolbar" aria-label="Department request filters">
        <label className="college-requests-search">
          <Search size={17} />
          <span className="sr-only">Search requests</span>
          <input
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            placeholder="Search request ID, item, requester, department..."
          />
        </label>

        <label>
          <span className="sr-only">Status</span>
          <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)}>
            <option value="">All statuses</option>
            {(filters.statuses || []).map((value) => (
              <option value={value} key={value}>{label(value)}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Department</span>
          <select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}>
            <option value="">All departments</option>
            {(filters.departments || []).map((department) => (
              <option value={department.id} key={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Priority</span>
          <select value={query.priority} onChange={(event) => updateQuery('priority', event.target.value)}>
            <option value="">All priorities</option>
            {(filters.priorities || []).map((value) => (
              <option value={value} key={value}>{label(value)}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button className="college-requests-clear" type="button" onClick={clearFilters}>
            <X size={15} /> Clear Filters
          </button>
        )}
      </section>

      <section className="college-requests-table-panel">
        <div className="college-requests-table-meta">
          <strong>
            {pagination.total
              ? `Showing ${first}-${last} of ${pagination.total} requests`
              : hasFilters
                ? 'No requests match your filters'
                : 'No department requests found'}
          </strong>
          {tableLoading && <RefreshCw size={15} className="college-requests-spin" />}
        </div>

        {requests.length ? (
          <div className="college-requests-table-wrap">
            <table>
              <caption className="sr-only">Department requests table</caption>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Request Date</th>
                  <th>Department</th>
                  <th>Requester</th>
                  <th>Requested Item</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.requestNumber}</strong></td>
                    <td>{date(request.createdAt)}</td>
                    <td>{display(request.department?.name)}</td>
                    <td>{display(request.requester?.name || request.requester?.username)}</td>
                    <td>{display(request.item || request.asset?.name)}{request.asset?.assetCode ? <small>{request.asset.assetCode}</small> : null}</td>
                    <td>{display(request.asset?.category)}</td>
                    <td>{display(request.quantity)}</td>
                    <td><span className={`college-requests-badge priority-${request.priority || 'medium'}`}>{label(request.priority)}</span></td>
                    <td><span className={`college-requests-badge status-${request.status}`}>{label(request.status)}</span></td>
                    <td>{date(request.updatedAt)}</td>
                    <td>
                      <button
                        className="college-requests-icon-button"
                        type="button"
                        onClick={() => setSelected(request)}
                        aria-label={`View ${request.requestNumber} details`}
                        title="View details"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-requests-empty">
            <FileText size={30} />
            <strong>{hasFilters ? 'No requests match your filters.' : 'No department requests found.'}</strong>
            {hasFilters && <button type="button" onClick={clearFilters}>Clear Filters</button>}
          </div>
        )}

        <nav className="college-requests-pagination" aria-label="Department request pagination">
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>
            Page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}
          </span>
          <button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button>
        </nav>
      </section>

      {selected && (
        <div
          className="college-requests-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <section className="college-requests-modal" role="dialog" aria-modal="true" aria-labelledby="college-department-request-details-title">
            <div className="college-requests-modal-head">
              <div>
                <span className="college-requests-eyebrow">Request details</span>
                <h2 id="college-department-request-details-title">{selected.requestNumber}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close request details">
                <X />
              </button>
            </div>

            <div className="college-requests-details">
              {[['Request Date', date(selected.createdAt)], ['Department', display(selected.department?.name)], ['Requester', display(selected.requester?.name || selected.requester?.username)], ['Requested Item', display(selected.item || selected.asset?.name)], ['Category', display(selected.asset?.category)], ['Quantity', display(selected.quantity)], ['Priority', label(selected.priority)], ['Status', label(selected.status)], ['Updated', date(selected.updatedAt)], ['Reason', display(selected.reason)]].map(([title, value]) => (
                <div key={title}><span>{title}</span><strong>{value}</strong></div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CollegeDepartmentRequests;
