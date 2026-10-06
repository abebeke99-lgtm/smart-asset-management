import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Eye, RefreshCw, Search, X } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../utils/api';
import './DeptTickets.css';

const STATUS_OPTIONS = [
  ['submitted', 'Submitted'],
  ['scheduled', 'Scheduled'],
  ['in-progress', 'In Progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['escalated', 'Escalated'],
];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const EMPTY_PAGINATION = { page: 1, pages: 1, total: 0 };

const formatDate = (value, withTime = false) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};

const DeptTickets = ({ escalatedOnly = false }) => {
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await apiClient.get(escalatedOnly ? '/department-head/escalated-tickets' : '/department-head/tickets', {
        params: {
          search: filters.search.trim() || undefined,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          page,
          limit: 20,
        },
      });
      setTickets(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination(response.data?.pagination || EMPTY_PAGINATION);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load department tickets.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [escalatedOnly, filters, page]);

  useEffect(() => {
    const timer = setTimeout(() => loadTickets(true), 180);
    return () => clearTimeout(timer);
  }, [loadTickets]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const viewDetails = async (ticket) => {
    setSelected(ticket);
    setLoadingDetails(true);
    setError('');
    try {
      const response = await apiClient.get(`/department-head/tickets/${ticket.id}`);
      if (response.data?.data) setSelected(response.data.data);
    } catch (detailError) {
      setError(getApiErrorMessage(detailError, 'Unable to load ticket details.'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const submitFollowUp = async (event) => {
    event.preventDefault();
    if (!selected || !followUpText.trim() || savingFollowUp) return;
    setSavingFollowUp(true);
    setError('');
    try {
      await apiClient.post(`/department-head/tickets/${selected.id}/follow-up`, { comment: followUpText.trim() });
      setFollowUpText('');
      await viewDetails(selected);
      await loadTickets();
    } catch (followUpError) {
      setError(getApiErrorMessage(followUpError, 'Unable to save ticket follow-up.'));
    } finally {
      setSavingFollowUp(false);
    }
  };

  return (
    <main className="dept-tickets">
      <header className="dept-tickets__heading">
        <div>
          <span className="dept-tickets__eyebrow"><ClipboardList size={16} /> Department operations</span>
          <h1>{escalatedOnly ? 'Escalated Tickets' : 'Service Tickets'}</h1>
          <p>{escalatedOnly ? 'Review automatically escalated tickets and record follow-up.' : 'Monitor service requests raised within your department.'}</p>
        </div>
        <button type="button" className="dept-tickets__button dept-tickets__button--secondary" onClick={() => loadTickets()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'dept-tickets__spin' : ''} /> Refresh
        </button>
      </header>

      <section className="dept-tickets__filters" aria-label="Search and filter tickets">
        <label className="dept-tickets__search">
          <Search size={17} />
          <span className="sr-only">Search tickets</span>
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search ticket ID, request, category..." />
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by priority</span>
          <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
          </select>
        </label>
      </section>

      {error && <div className="dept-tickets__alert" role="alert">{error}</div>}

      <section className="dept-tickets__card" aria-label="Department service tickets">
        <div className="dept-tickets__table-wrap">
          <table>
            <thead>
              <tr>
                {escalatedOnly ? (
                  <>
                    <th>Ticket ID</th>
                    <th>Escalation reason</th>
                    <th>Escalation time</th>
                    <th>Current owner</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Follow-up</th>
                    <th>Resolution</th>
                  </>
                ) : (
                  <>
                    <th>Ticket ID</th>
                    <th>Request</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned Technician</th>
                    <th>Created Date</th>
                    <th>Acknowledged Date</th>
                    <th>Due Date</th>
                    <th>Escalation State</th>
                  </>
                )}
                <th><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={escalatedOnly ? 9 : 11} className="dept-tickets__message">Loading tickets...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={escalatedOnly ? 9 : 11} className="dept-tickets__message">{escalatedOnly ? 'No escalated tickets found in this department.' : 'No service tickets found in this department.'}</td></tr>
              ) : tickets.map((ticket) => (
                <tr key={ticket.id}>
                  {escalatedOnly ? (
                    <>
                      <td className="dept-tickets__ticket-id">{ticket.ticketId}</td>
                      <td>{ticket.escalationReason || 'Not recorded'}</td>
                      <td>{formatDate(ticket.escalationTime, true)}</td>
                      <td>{ticket.currentOwner || 'Unassigned'}</td>
                      <td><span className="dept-tickets__status">{ticket.statusLabel || ticket.status}</span></td>
                      <td><span className={`dept-tickets__priority dept-tickets__priority--${ticket.priority}`}>{ticket.priority}</span></td>
                      <td className="dept-tickets__follow-up-cell">
                        <span>{ticket.followUp || 'No follow-up recorded'}</span>
                        <button type="button" onClick={() => viewDetails(ticket)}>Add follow-up</button>
                      </td>
                      <td>{ticket.resolution || 'Not resolved'}</td>
                    </>
                  ) : (
                    <>
                      <td className="dept-tickets__ticket-id">{ticket.ticketId}</td>
                      <td>{ticket.request || 'Service request'}</td>
                      <td>{ticket.category || 'Uncategorized'}</td>
                      <td><span className={`dept-tickets__priority dept-tickets__priority--${ticket.priority}`}>{ticket.priority}</span></td>
                      <td><span className="dept-tickets__status">{ticket.statusLabel || ticket.status}</span></td>
                      <td>{ticket.assignedTechnician || 'Unassigned'}</td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td>{formatDate(ticket.acknowledgedAt)}</td>
                      <td>{formatDate(ticket.dueDate)}</td>
                      <td><span className={ticket.escalationState === 'Escalated' ? 'dept-tickets__escalation is-escalated' : 'dept-tickets__escalation'}>{ticket.escalationState}</span></td>
                    </>
                  )}
                  <td>
                    <button type="button" className="dept-tickets__icon-button" aria-label={`View details for ${ticket.ticketId}`} onClick={() => viewDetails(ticket)}>
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="dept-tickets__pagination">
          <span>{pagination.total} ticket{pagination.total === 1 ? '' : 's'}</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</button>
            <span>Page {pagination.page || page} of {Math.max(1, pagination.pages || 1)}</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= (pagination.pages || 1) || loading}>Next</button>
          </div>
        </footer>
      </section>

      {selected && (
        <div className="dept-tickets__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="dept-tickets__details" role="dialog" aria-modal="true" aria-labelledby="ticket-details-title">
            <header>
              <div>
                <span className="dept-tickets__eyebrow">Ticket details</span>
                <h2 id="ticket-details-title">{selected.ticketId}</h2>
              </div>
              <button type="button" className="dept-tickets__icon-button" aria-label="Close ticket details" onClick={() => setSelected(null)}><X size={18} /></button>
            </header>
            {loadingDetails ? <p>Loading ticket details...</p> : (
              <dl>
                <div><dt>Request</dt><dd>{selected.request}</dd></div>
                <div><dt>Description</dt><dd>{selected.description || 'No description provided.'}</dd></div>
                <div><dt>Category</dt><dd>{selected.category || 'Uncategorized'}</dd></div>
                <div><dt>Priority</dt><dd>{selected.priority}</dd></div>
                <div><dt>Status</dt><dd>{selected.statusLabel || selected.status}</dd></div>
                <div><dt>Assigned technician</dt><dd>{selected.assignedTechnician || 'Unassigned'}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(selected.createdAt, true)}</dd></div>
                <div><dt>Acknowledged</dt><dd>{formatDate(selected.acknowledgedAt, true)}</dd></div>
                <div><dt>Due date</dt><dd>{formatDate(selected.dueDate, true)}</dd></div>
                <div><dt>Escalation</dt><dd>{selected.escalationState}{selected.escalationReason ? `: ${selected.escalationReason}` : ''}</dd></div>
                {selected.escalatedAt && <div><dt>Escalated at</dt><dd>{formatDate(selected.escalatedAt, true)}</dd></div>}
                <div><dt>Resolution</dt><dd>{selected.resolution || 'Not resolved'}</dd></div>
              </dl>
            )}
            {!loadingDetails && escalatedOnly && (
              <section className="dept-tickets__follow-ups" aria-label="Ticket follow-up history">
                <h3>Follow-up history</h3>
                {selected.followUps?.length ? selected.followUps.map((followUp) => (
                  <article key={followUp.id}>
                    <p>{followUp.comment}</p>
                    <small>{followUp.author || 'Department head'} · {formatDate(followUp.createdAt, true)}</small>
                  </article>
                )) : <p>No follow-up has been recorded.</p>}
                <form onSubmit={submitFollowUp}>
                  <label htmlFor="ticket-follow-up">Add follow-up</label>
                  <textarea id="ticket-follow-up" value={followUpText} onChange={(event) => setFollowUpText(event.target.value)} maxLength={1000} required />
                  <button type="submit" className="dept-tickets__button" disabled={savingFollowUp || !followUpText.trim()}>
                    {savingFollowUp ? 'Saving...' : 'Save follow-up'}
                  </button>
                </form>
              </section>
            )}
          </section>
        </div>
      )}
    </main>
  );
};

export default DeptTickets;
