import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDot, Flag, Headset, LoaderCircle, MessageSquare, Plus, RefreshCw, Search, SlidersHorizontal, Ticket, UserCog, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './ICTTechnicalSupport.css';

const statuses = ['open', 'assigned', 'in-progress', 'pending-user', 'pending-parts', 'resolved', 'closed', 'cancelled'];
const categories = ['hardware', 'software', 'network', 'printer', 'server', 'account / access', 'security', 'email', 'internet', 'system', 'other'];
const priorities = ['low', 'medium', 'high', 'critical'];
const initialForm = { subject: '', description: '', category: 'hardware', priority: 'medium', assetId: '', dueDate: '' };
const label = (value) => String(value || '').replace(/(^|-|\/)/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleString() : '—';

export default function ICTTechnicalSupport() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', category: '', page: 1 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [form, setForm] = useState(initialForm);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketResponse, statsResponse] = await Promise.all([
        apiClient.get('/api/technical-support/tickets', { params: { ...filters, limit: 15 } }),
        apiClient.get('/api/technical-support/statistics')
      ]);
      setTickets(ticketResponse.data?.data || []);
      setPagination(ticketResponse.data?.pagination || { page: 1, pages: 1, total: 0 });
      setStats(statsResponse.data?.data || {});
    } catch (error) { toast.error(getApiErrorMessage(error, 'Unable to load support tickets.')); } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const openDetails = async (ticket) => {
    try {
      const [detailResponse, commentResponse] = await Promise.all([
        apiClient.get(`/api/technical-support/tickets/${ticket.id}`),
        apiClient.get(`/api/technical-support/tickets/${ticket.id}/comments`)
      ]);
      setSelected(detailResponse.data?.data || ticket);
      setComments(commentResponse.data?.data || []);
    } catch (error) { toast.error(getApiErrorMessage(error, 'Unable to load ticket details.')); }
  };
  const updateStatus = async (status) => {
    if (!selected) return;
    setSaving(true);
    try { const response = await apiClient.patch(`/api/technical-support/tickets/${selected.id}/status`, { status }); setSelected(response.data.data); toast.success('Ticket status updated.'); await load(); } catch (error) { toast.error(getApiErrorMessage(error, 'Unable to update ticket status.')); } finally { setSaving(false); }
  };
  const addComment = async (event) => {
    event.preventDefault();
    if (!comment.trim() || !selected) return;
    setSaving(true);
    try { await apiClient.post(`/api/technical-support/tickets/${selected.id}/comments`, { comment }); setComment(''); await openDetails(selected); toast.success('Comment added.'); } catch (error) { toast.error(getApiErrorMessage(error, 'Unable to add comment.')); } finally { setSaving(false); }
  };
  const createTicket = async (event) => {
    event.preventDefault();
    setSaving(true);
    try { const response = await apiClient.post('/api/technical-support/tickets', form); setShowCreate(false); setForm(initialForm); setFilters((current) => ({ ...current, page: 1 })); toast.success(`Created ${response.data?.data?.ticketNumber || 'support ticket'}.`); await load(); } catch (error) { toast.error(getApiErrorMessage(error, 'Unable to create support ticket.')); } finally { setSaving(false); }
  };

  const statCards = [['total', 'Total Tickets', Ticket], ['open', 'Open', CircleDot], ['inProgress', 'In Progress', LoaderCircle], ['pending', 'Pending', MessageSquare], ['resolved', 'Resolved', CheckCircle2], ['closed', 'Closed', CheckCircle2], ['highPriority', 'High Priority', Flag], ['overdue', 'Overdue', CalendarDays]];
  return <main className="support-page">
    <header className="support-header"><div><p className="eyebrow"><Headset size={16} /> ICT SERVICE DESK</p><h1>Technical Support</h1><p className="muted">Track, assign, and resolve real support requests across the university.</p></div><div className="support-actions"><button className="button secondary" onClick={load}><RefreshCw size={16} /> Refresh</button><button className="button primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create ticket</button></div></header>
    <section className="support-stats">{statCards.map(([key, title, Icon]) => <div className="stat-card" key={key}><Icon size={18} /><span>{title}</span><strong>{stats[key] ?? 0}</strong></div>)}</section>
    <section className="support-toolbar"><div className="search-field"><Search size={17} /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} placeholder="Search ticket, subject, requester, or asset" /></div><SlidersHorizontal size={18} /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value, page: 1 })}><option value="">All priorities</option>{priorities.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value, page: 1 })}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></section>
    <section className="support-table-wrap">{loading ? <div className="loading-state">Loading support tickets...</div> : tickets.length === 0 ? <div className="empty-state"><Ticket size={34} /><h2>No support tickets found</h2><p>{filters.search || filters.status || filters.priority || filters.category ? 'No tickets match your current filters.' : 'Create the first support ticket to begin.'}</p><button className="button primary" onClick={() => filters.search || filters.status || filters.priority || filters.category ? setFilters({ search: '', status: '', priority: '', category: '', page: 1 }) : setShowCreate(true)}>{filters.search || filters.status || filters.priority || filters.category ? 'Clear filters' : 'Create ticket'}</button></div> : <table><thead><tr><th>Ticket</th><th>Subject</th><th>Requester</th><th>Asset</th><th>Priority</th><th>Status</th><th>Due</th><th /></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id} onClick={() => openDetails(ticket)}><td><strong>{ticket.ticketNumber || ticket.requestCode}</strong><small>{date(ticket.createdAt)}</small></td><td><strong>{ticket.subject || ticket.title}</strong><small>{label(ticket.category)}</small></td><td>{ticket.requester || '—'}</td><td>{ticket.asset_tag || ticket.asset_name || '—'}</td><td><span className={`badge priority-${ticket.priority}`}>{label(ticket.priority)}</span></td><td><span className={`badge status-${ticket.status}`}>{label(ticket.status)}</span>{ticket.overdue && <small className="overdue">Overdue</small>}</td><td>{date(ticket.dueDate)}</td><td><button className="icon-button" aria-label="View ticket" onClick={(event) => { event.stopPropagation(); openDetails(ticket); }}>→</button></td></tr>)}</tbody></table>}
      {pagination.pages > 1 && <div className="pagination"><button className="button secondary" disabled={pagination.page <= 1} onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}>Next</button></div>}
    </section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><article className="detail-panel" onClick={(event) => event.stopPropagation()}><button className="close-button" onClick={() => setSelected(null)}><X size={18} /></button><div className="detail-header"><div><p className="eyebrow">{selected.ticketNumber}</p><h2>{selected.subject}</h2></div><span className={`badge status-${selected.status}`}>{label(selected.status)}</span></div><div className="detail-grid"><div><h3>Description</h3><p>{selected.description}</p><h3>Conversation</h3><div className="comments">{comments.length ? comments.map((item) => <div className="comment" key={item.id}><strong>{item.Author?.fullName || item.Author?.username || 'User'}</strong><small>{date(item.createdAt)}</small><p>{item.comment}</p></div>) : <p className="muted">No comments yet.</p>}</div><form onSubmit={addComment} className="comment-form"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a public comment" /><button className="button primary" disabled={saving}><MessageSquare size={16} /> Comment</button></form></div><aside><div className="detail-fact"><Flag size={16} /><span>Priority</span><strong>{label(selected.priority)}</strong></div><div className="detail-fact"><UserCog size={16} /><span>Technician</span><strong>{selected.assigned_technician || 'Unassigned'}</strong></div><div className="detail-fact"><Ticket size={16} /><span>Asset</span><strong>{selected.asset_tag || selected.asset_name || 'Not linked'}</strong></div><div className="detail-fact"><CalendarDays size={16} /><span>Created</span><strong>{date(selected.createdAt)}</strong></div><select className="status-select" value={selected.status} onChange={(event) => updateStatus(event.target.value)} disabled={saving}>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></aside></div></article></div>}
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><form className="create-panel" onSubmit={createTicket} onClick={(event) => event.stopPropagation()}><button type="button" className="close-button" onClick={() => setShowCreate(false)}><X size={18} /></button><h2>Create support ticket</h2><label>Subject *<input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label>Description *<textarea required rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-grid"><label>Category *<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label>Priority *<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{priorities.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label>Due date<input type="datetime-local" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label>Asset ID<input value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} placeholder="Optional" /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Creating...' : 'Create ticket'}</button></div></form></div>}
  </main>;
}
