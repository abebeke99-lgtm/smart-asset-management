import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Check, Mail, MessageSquare, Plus, RefreshCw, Search, Send, Trash2, X, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

const TYPES = ['system', 'maintenance', 'assignment', 'transfer', 'missing_asset', 'warranty', 'rfid', 'security', 'alert', 'report', 'reminder', 'approval', 'inventory', 'procurement', 'financial', 'verification', 'disposal', 'custom'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const CHANNELS = ['in_app', 'email', 'sms'];
const AUDIENCES = ['users', 'role', 'college', 'department', 'all_active_users', 'all_users'];
const EMPTY_FORM = { title: '', message: '', type: 'system', priority: 'medium', recipientType: 'users', userIds: [], roles: [], collegeId: '', departmentId: '', channels: ['in_app'], scheduledAt: '', expiresAt: '' };
const normalize = (response) => response?.data?.data || response?.data || {};
const channelIcon = { in_app: Bell, email: Mail, sms: MessageSquare };

const AdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState({ total: 0, unread: 0, read: 0, sent: 0, failed: 0 });
  const [filters, setFilters] = useState({ search: '', type: '', priority: '', status: '', channel: '', read: '', page: 1 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchNotifications = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/api/admin/notifications', { params: { ...filters, limit: 20 } });
      const payload = normalize(response);
      setNotifications(Array.isArray(payload) ? payload : []);
      setSummary(response?.data?.summary || { total: 0, unread: 0, read: 0, sent: 0, failed: 0 });
      setPagination(response?.data?.pagination || { page: 1, limit: 20, totalPages: 1 });
    } catch (requestError) {
      setError(requestError?.response?.status === 403 ? 'Access denied.' : requestError?.response?.status === 401 ? 'Authentication required.' : "We couldn't retrieve notification information. Please try again.");
      setNotifications([]);
    } finally { setLoading(false); }
  }, [filters]);

  const fetchAudienceData = useCallback(async () => {
    try {
      const [userResponse, collegeResponse, departmentResponse] = await Promise.all([
        apiClient.get('/api/admin/users', { params: { limit: 250, page: 1, status: 'active' } }),
        apiClient.get('/api/admin/colleges', { params: { limit: 100, page: 1, status: 'active' } }),
        apiClient.get('/api/admin/departments', { params: { limit: 100, page: 1, status: 'active' } }),
      ]);
      const userPayload = normalize(userResponse); const collegePayload = normalize(collegeResponse); const departmentPayload = normalize(departmentResponse);
      setUsers(Array.isArray(userPayload) ? userPayload : userPayload.users || []);
      setColleges(Array.isArray(collegePayload) ? collegePayload : collegePayload.colleges || []);
      setDepartments(Array.isArray(departmentPayload) ? departmentPayload : departmentPayload.departments || []);
    } catch (requestError) { toast.error(requestError?.response?.data?.message || 'Unable to load notification audience data'); }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchAudienceData(); }, [fetchAudienceData]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleChannel = (channel) => updateForm('channels', form.channels.includes(channel) ? form.channels.filter((item) => item !== channel) : [...form.channels, channel]);
  const toggleUser = (id) => updateForm('userIds', form.userIds.includes(id) ? form.userIds.filter((item) => item !== id) : [...form.userIds, id]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return toast.error('Title and message are required');
    if (!form.channels.length) return toast.error('Select at least one delivery channel');
    if (form.recipientType === 'users' && !form.userIds.length) return toast.error('Select at least one user');
    if (form.recipientType === 'role' && !form.roles.length) return toast.error('Select a role');
    if (form.recipientType === 'college' && !form.collegeId) return toast.error('Select a college');
    if (form.recipientType === 'department' && !form.departmentId) return toast.error('Select a department');
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), message: form.message.trim(), userIds: form.userIds.map(Number), roles: form.roles.length ? form.roles : undefined, collegeId: form.collegeId || undefined, departmentId: form.departmentId || undefined, scheduledAt: form.scheduledAt || undefined, expiresAt: form.expiresAt || undefined };
      const response = await apiClient.post('/api/admin/notifications/bulk', payload);
      toast.success(response?.data?.data?.status === 'scheduled' ? 'Notification scheduled' : 'Notification created');
      setForm(EMPTY_FORM); setShowForm(false); await fetchNotifications();
    } catch (requestError) { toast.error(requestError?.response?.data?.message || 'Unable to create notification'); }
    finally { setSaving(false); }
  };

  const archive = async (notification) => {
    if (!window.confirm('Archive this notification? Delivery history will be preserved.')) return;
    try { await apiClient.post(`/api/admin/notifications/${notification.id}/archive`); toast.success('Notification archived'); await fetchNotifications(); }
    catch (requestError) { toast.error(requestError?.response?.data?.message || 'Unable to archive notification'); }
  };

  const retry = async (notification) => {
    try { await apiClient.post(`/api/admin/notifications/${notification.id}/retry`); toast.success('Failed delivery retry started'); await fetchNotifications(); }
    catch (requestError) { toast.error(requestError?.response?.data?.message || 'Unable to retry delivery'); }
  };

  const roles = useMemo(() => [...new Set(users.map((user) => user.role).filter(Boolean))], [users]);
  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 }));

  return <section className="admin-workspace-page" aria-labelledby="notifications-title">
    <div className="admin-page-header"><div><div className="admin-breadcrumb"><Bell size={16} /> System / Notifications</div><h1 id="notifications-title" className="admin-page-title">Notifications</h1><p className="admin-page-subtitle">Manage system alerts, announcements, and communication delivery.</p></div><div style={{ display: 'flex', gap: 8 }}><button className="admin-secondary-button" onClick={fetchNotifications} disabled={loading}><RefreshCw size={16} /> Refresh</button><button className="admin-primary-button" onClick={() => setShowForm(true)}><Plus size={16} /> Create Notification</button></div></div>
    <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}><Stat label="Total" value={summary.total} icon={Bell} /><Stat label="Unread" value={summary.unread} icon={BellRing} tone="#2563EB" /><Stat label="Read" value={summary.read} icon={Check} tone="#16A34A" /><Stat label="Sent" value={summary.sent} icon={Send} tone="#0EA5E9" /><Stat label="Failed" value={summary.failed} icon={XCircle} tone="#DC2626" /></div>
    <div className="admin-card" style={{ marginBottom: 18 }}><div className="admin-form-grid"><label className="admin-form-field"><span><Search size={14} /> Search</span><input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Search title or message" /></label><label className="admin-form-field">Read status<select value={filters.read} onChange={(event) => setFilter('read', event.target.value)}><option value="">All</option><option value="unread">Unread</option><option value="read">Read</option></select></label><label className="admin-form-field">Type<select value={filters.type} onChange={(event) => setFilter('type', event.target.value)}><option value="">All types</option>{TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="admin-form-field">Priority<select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}><option value="">All priorities</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label className="admin-form-field">Delivery status<select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">All statuses</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="archived">Archived</option></select></label></div></div>
    {error && <div className="admin-error-state" role="alert"><span>{error}</span><button className="admin-secondary-button" onClick={fetchNotifications}>Retry</button></div>}
    {loading ? <div className="admin-card admin-empty-state"><RefreshCw size={20} /> Loading notifications...</div> : notifications.length === 0 ? <div className="admin-card admin-empty-state" style={{ flexDirection: 'column' }}><Bell size={36} /><strong>No Notifications Found</strong><span>Notifications and system alerts will appear here.</span><button className="admin-primary-button" onClick={() => setShowForm(true)}><Plus size={16} /> Create Notification</button></div> : <div className="admin-table-card"><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Notification</th><th>Recipient</th><th>Type</th><th>Priority</th><th>Channels</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{notifications.map((notification) => <tr key={notification.id}><td><strong>{notification.title}</strong><div style={{ color: '#64748b', maxWidth: 330, overflow: 'hidden', textOverflow: 'ellipsis' }}>{notification.message}</div></td><td>{notification.Recipient?.fullName || notification.Recipient?.username || notification.recipientId || 'Broadcast'}</td><td>{notification.type}</td><td><span className={`admin-status-badge ${notification.priority === 'urgent' ? 'inactive' : notification.priority === 'high' ? 'pending' : 'active'}`}>{notification.priority}</span></td><td><ChannelList value={notification.channel} /></td><td>{notification.status}</td><td>{notification.created_at ? new Date(notification.created_at).toLocaleString() : 'Not available'}</td><td><div className="admin-row-actions">{notification.status === 'failed' && <button className="icon-button" title="Retry failed delivery" onClick={() => retry(notification)}><RefreshCw size={15} /></button>}<button className="icon-button danger" title="Archive" onClick={() => archive(notification)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div><div className="admin-pagination"><button className="icon-button" disabled={pagination.page <= 1} onClick={() => setFilter('page', pagination.page - 1)}>&lt;</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="icon-button" disabled={pagination.page >= pagination.totalPages} onClick={() => setFilter('page', pagination.page + 1)}>&gt;</button></div></div>}
    {showForm && <NotificationForm form={form} users={users} roles={roles} colleges={colleges} departments={departments} saving={saving} updateForm={updateForm} toggleChannel={toggleChannel} toggleUser={toggleUser} submit={submit} close={() => !saving && setShowForm(false)} />}
  </section>;
};

const Stat = ({ label, value, icon: Icon, tone = '#1A237E' }) => <div className="admin-card" style={{ borderTop: `3px solid ${tone}` }}><Icon size={18} color={tone} /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>{label}</span><strong style={{ display: 'block', color: '#1A237E', fontSize: '1.5rem', marginTop: 5 }}>{Number(value || 0).toLocaleString()}</strong></div>;
const ChannelList = ({ value }) => <span style={{ display: 'inline-flex', gap: 5 }}>{String(value || 'in_app').split(',').map((channel) => { const Icon = channelIcon[channel] || Bell; return <Icon key={channel} size={15} title={channel} />; })}</span>;

const NotificationForm = ({ form, users, roles, colleges, departments, saving, updateForm, toggleChannel, toggleUser, submit, close }) => <div className="admin-modal-backdrop" role="presentation"><div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal-header"><h2>Create Notification</h2><button className="icon-button" onClick={close}><X size={17} /></button></div><form onSubmit={submit}><div className="admin-modal-body"><div className="admin-form-grid"><label className="admin-form-field">Title<input required value={form.title} onChange={(event) => updateForm('title', event.target.value)} /></label><label className="admin-form-field">Type<select value={form.type} onChange={(event) => updateForm('type', event.target.value)}>{TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="admin-form-field">Priority<select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label className="admin-form-field">Send to<select value={form.recipientType} onChange={(event) => updateForm('recipientType', event.target.value)}>{AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.replaceAll('_', ' ')}</option>)}</select></label></div><label className="admin-form-field">Message<textarea required value={form.message} onChange={(event) => updateForm('message', event.target.value)} /></label><div className="admin-form-field"><span>Channels</span><div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>{CHANNELS.map((channel) => <label key={channel}><input type="checkbox" checked={form.channels.includes(channel)} onChange={() => toggleChannel(channel)} /> {channel.replace('_', ' ')}</label>)}</div></div>{form.recipientType === 'users' && <div className="admin-form-field"><span>Users ({form.userIds.length} selected)</span><div className="admin-recipient-list">{users.map((user) => <label key={user.id}><input type="checkbox" checked={form.userIds.includes(user.id)} onChange={() => toggleUser(user.id)} /> {user.fullName || user.username} <small>{user.role}</small></label>)}</div></div>}{form.recipientType === 'role' && <label className="admin-form-field">Role<select value={form.roles[0] || ''} onChange={(event) => updateForm('roles', event.target.value ? [event.target.value] : [])}><option value="">Select role</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>}{form.recipientType === 'college' && <label className="admin-form-field">College<select value={form.collegeId} onChange={(event) => updateForm('collegeId', event.target.value)}><option value="">Select college</option>{colleges.map((college) => <option key={college.id} value={college.id}>{college.collegeName || college.name}</option>)}</select></label>}{form.recipientType === 'department' && <label className="admin-form-field">Department<select value={form.departmentId} onChange={(event) => updateForm('departmentId', event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}<div className="admin-form-grid"><label className="admin-form-field">Schedule for later<input type="datetime-local" value={form.scheduledAt} onChange={(event) => updateForm('scheduledAt', event.target.value)} /></label><label className="admin-form-field">Expires at<input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm('expiresAt', event.target.value)} /></label></div></div><div className="admin-modal-footer"><button type="button" className="admin-secondary-button" onClick={close}>Cancel</button><button className="admin-primary-button" disabled={saving}>{saving ? 'Sending...' : <><Send size={16} /> Send Notification</>}</button></div></form></div></div>;

export default AdminNotifications;
