import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Clock3,
  Eye,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeAssignments.css';

const emptyData = {
  summary: { total: 0 },
  assignments: [],
  filters: { departments: [], statuses: [], users: [], categories: [], locations: [] },
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) => (value === null || value === undefined || value === '' ? 'Not recorded' : value);
const date = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');
const errorMessage = (error, action = 'load assignments') => ({
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not authorized to view college assignments.',
  404: 'The assignment records were not found.',
}[error.response?.status] || `Unable to ${action}.`);

const getAssignmentStatusMeta = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['returned', 'closed', 'completed'].includes(normalized)) return { label: 'Returned', tone: 'returned', icon: BadgeCheck };
  if (['pending', 'waiting', 'approval', 'awaiting-approval', 'pending-return'].includes(normalized)) return { label: 'Pending', tone: 'pending', icon: Clock3 };
  if (['overdue', 'late'].includes(normalized)) return { label: 'Overdue', tone: 'overdue', icon: AlertTriangle };
  if (['cancelled', 'canceled', 'rejected'].includes(normalized)) return { label: 'Cancelled', tone: 'cancelled', icon: CircleX };
  return { label: 'Active', tone: 'active', icon: CheckCircle2 };
};

const CollegeAssignments = () => {
  const [state, setState] = useState({ ...emptyData, loading: true, tableLoading: false, error: '' });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadAssignments = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/assignments', {
        params: { ...query, page, limit: 20, search: query.search || undefined },
      });
      const payload = response.data?.data || response.data || emptyData;
      setState((previous) => ({ ...previous, ...payload, loading: false, tableLoading: false, error: '' }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: errorMessage(error) }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAssignments(page === 1 && !state.assignments.length && state.loading), 250);
    return () => clearTimeout(timer);
  }, [page, query.search, query.departmentId, query.status, query.assignedTo, query.location, query.category]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const summaryCards = useMemo(() => {
    const assignments = Array.isArray(state.assignments) ? state.assignments : [];
    const total = Number(state.summary?.total || assignments.length || 0);
    const active = Number(state.summary?.active || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status).tone === 'active').length || 0);
    const pending = Number(state.summary?.pending || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status).tone === 'pending').length || 0);
    const returned = Number(state.summary?.returned || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status).tone === 'returned').length || 0);

    return [
      { label: 'Total Assignments', value: total, icon: ClipboardList, tone: 'primary' },
      { label: 'Active', value: active, icon: CheckCircle2, tone: 'success' },
      { label: 'Pending', value: pending, icon: Clock3, tone: 'warning' },
      { label: 'Returned', value: returned, icon: BadgeCheck, tone: 'slate' },
    ];
  }, [state.assignments, state.summary]);

  const updateQuery = (field, value) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setQuery({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' });
  };

  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination || emptyData.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) {
    return (
      <div className="college-assignments-page">
        <div className="college-assignments-state" aria-busy="true">
          <RefreshCw className="college-assignments-spin" size={22} />
          <strong>Loading assignments...</strong>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="college-assignments-page">
        <div className="college-assignments-state college-assignments-error" role="alert">
          <ShieldCheck size={22} />
          <strong>{state.error}</strong>
          <button type="button" onClick={() => loadAssignments(true)}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const rows = Array.isArray(state.assignments) ? state.assignments : [];

  return (
    <div className="college-assignments-page">
      <header className="college-assignments-header">
        <div className="college-assignments-title-block">
          <span className="college-assignments-eyebrow">
            <ClipboardList size={14} /> College manager
          </span>
          <h1>Asset Assignments</h1>
          <p>Review active assignments, track assigned assets, and confirm details within the authorized college scope.</p>
        </div>
        <button type="button" className="college-assignments-action-button" onClick={() => loadAssignments()} disabled={state.tableLoading}>
          <RefreshCw size={16} className={state.tableLoading ? 'college-assignments-spin' : ''} />
          Refresh
        </button>
      </header>

      <section className="college-assignments-metrics" aria-label="Assignment summary">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="college-assignments-metric-card">
            <div className={`college-assignments-metric-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{Number(value).toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="college-assignments-toolbar" aria-label="Assignment filters">
        <label className="college-assignments-search-field">
          <Search size={16} />
          <input
            type="search"
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            placeholder="Search asset, tag, assignee, serial..."
            aria-label="Search assignments"
          />
        </label>

        <label className="college-assignments-select-field">
          <Building2 size={14} />
          <select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {(state.filters?.departments || []).map((department) => (
              <option value={department.id} key={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <Filter size={14} />
          <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)} aria-label="Filter by assignment status">
            <option value="">All statuses</option>
            {(state.filters?.statuses || []).map((status) => (
              <option value={status} key={status}>{label(status)}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <UserRound size={14} />
          <select value={query.assignedTo} onChange={(event) => updateQuery('assignedTo', event.target.value)} aria-label="Filter by assignee">
            <option value="">All assignees</option>
            {(state.filters?.users || []).map((user) => (
              <option value={user.id} key={user.id}>{user.fullName || user.username}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <Package size={14} />
          <select value={query.category} onChange={(event) => updateQuery('category', event.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {(state.filters?.categories || []).map((category) => (
              <option value={category} key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <MapPin size={14} />
          <select value={query.location} onChange={(event) => updateQuery('location', event.target.value)} aria-label="Filter by location">
            <option value="">All locations</option>
            {(state.filters?.locations || []).map((location) => (
              <option value={location} key={location}>{location}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button type="button" className="college-assignments-clear-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </section>

      <section className="college-assignments-table-panel">
        <div className="college-assignments-table-meta">
          <strong>
            {pagination.total
              ? `Showing ${first}-${last} of ${pagination.total} assignments`
              : hasFilters
                ? 'No assignments match your filters.'
                : 'No assignment records found.'}
          </strong>
          {state.tableLoading && <RefreshCw size={15} className="college-assignments-spin" />}
        </div>

        {rows.length ? (
          <div className="college-assignments-table-wrap">
            <table>
              <caption className="sr-only">College asset assignments</caption>
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Asset</th>
                  <th>Assigned To</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Assignment Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((assignment) => {
                  const assignmentStatus = getAssignmentStatusMeta(assignment.status);
                  const StatusIcon = assignmentStatus.icon;
                  return (
                    <tr key={assignment.id}>
                      <td>
                        <strong>#{assignment.assetId || assignment.id}</strong>
                      </td>
                      <td>
                        <div className="college-assignments-asset-cell">
                          <strong>{display(assignment.asset?.name)}</strong>
                          <small>{display(assignment.asset?.code || assignment.asset?.serialNumber)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="college-assignments-user-cell">
                          <span>{display(assignment.assignee?.name || assignment.assignee?.username || 'Unassigned').slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{display(assignment.assignee?.name || assignment.assignee?.username || 'Unassigned')}</strong>
                            <small>{display(assignment.assignee?.username || 'No username')}</small>
                          </div>
                        </div>
                      </td>
                      <td>{display(assignment.department?.name || assignment.asset?.department || 'Not specified')}</td>
                      <td>{display(assignment.location || 'Not specified')}</td>
                      <td>
                        <div className="college-assignments-date-cell">
                          <CalendarDays size={14} />
                          <span>{date(assignment.assignedDate)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`college-assignments-badge status-${assignmentStatus.tone}`}>
                          <StatusIcon size={12} />
                          {assignmentStatus.label}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="college-assignments-icon-button"
                          onClick={() => setSelected(assignment)}
                          aria-label={`View assignment ${assignment.id} details`}
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-assignments-empty">
            <ClipboardList size={30} />
            <strong>{hasFilters ? 'No assignments match your current filters.' : 'No asset assignments found.'}</strong>
            {hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}

        <nav className="college-assignments-pagination" aria-label="Assignment pages">
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}
          </span>
          <button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </nav>
      </section>

      {selected && (
        <div className="college-assignments-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="college-assignments-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-details-title">
            <div className="college-assignments-modal-head">
              <div>
                <span className="college-assignments-eyebrow">Assignment details</span>
                <h2 id="assignment-details-title">Assignment #{selected.id}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close assignment details">
                <X size={18} />
              </button>
            </div>

            <div className="college-assignments-details">
              {[
                ['Asset', selected.asset?.name],
                ['Asset Tag', selected.asset?.code],
                ['Serial Number', selected.asset?.serialNumber],
                ['Category', selected.asset?.category],
                ['Assigned To', selected.assignee?.name || selected.assignee?.username],
                ['Department', selected.department?.name || selected.asset?.department],
                ['Location', selected.location],
                ['Assignment Date', date(selected.assignedDate)],
                ['Expected Return', date(selected.expectedReturnDate)],
                ['Status', label(selected.status)],
                ['Created', date(selected.createdAt)],
                ['Updated', date(selected.updatedAt)],
              ].map(([title, value]) => (
                <div key={title} className="college-assignments-detail-item">
                  <span>{title}</span>
                  <strong>{display(value)}</strong>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="college-assignments-notes">
                <span>Notes</span>
                <p>{selected.notes}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default CollegeAssignments;
