import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

const DEFAULT_FILTERS = {
  search: '',
  role: '',
  type: '',
  priority: '',
  status: '',
  read: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 20,
};

const EMPTY_FORM = {
  title: '',
  message: '',
  type: 'system',
  priority: 'medium',
  channels: ['in_app'],
  recipientType: 'users',
  userIds: [],
  roles: [],
  scheduledAt: '',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ET', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (['read', 'sent', 'delivered'].includes(value)) return { background: '#dcfce7', color: '#166534' };
  if (['unread', 'pending'].includes(value)) return { background: '#EAF2FA', color: '#245783' };
  if (['failed', 'archived'].includes(value)) return { background: '#fee2e2', color: '#991b1b' };
  return { background: '#fef3c7', color: '#92400e' };
};

const priorityTone = (priority) => {
  const value = String(priority || '').toLowerCase();
  if (value === 'critical' || value === 'urgent') return { background: '#fee2e2', color: '#991b1b' };
  if (value === 'high') return { background: '#fef3c7', color: '#92400e' };
  if (value === 'low') return { background: '#EAF2FA', color: '#0c4a6e' };
  return { background: '#e2e8f0', color: '#334155' };
};

const AdminNotifications = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({ total: 0, unread: 0, read: 0, highPriority: 0, today: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [formMode, setFormMode] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [savingForm, setSavingForm] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [recipientRoles, setRecipientRoles] = useState([]);
  const [recipientLoading, setRecipientLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        ...filters,
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
        role: filters.role || undefined,
        type: filters.type || undefined,
        priority: filters.priority || undefined,
        status: filters.status || undefined,
        read: filters.read || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      };

      const response = await apiClient.get('/api/admin/notifications', { params });
      const payload = response?.data || {};
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setNotifications(rows);
      setSummary(payload.summary || { total: 0, unread: 0, read: 0, highPriority: 0, today: 0 });
      setPagination(payload.pagination || { page: 1, limit: filters.limit, total: rows.length, totalPages: 1 });
    } catch (requestError) {
      const status = requestError?.response?.status;
      if (status === 401) {
        setError('Your session has expired.');
      } else if (status === 403) {
        setError('You are not authorized to manage notifications.');
      } else if (status === 404) {
        setError('Notifications endpoint was not found.');
      } else if (status === 500) {
        setError('Server error occurred.');
      } else if (!navigator.onLine) {
        setError('Unable to connect to the server.');
      } else {
        setError('Unable to load notifications.');
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  const roleOptions = useMemo(
    () => [...new Set(notifications.map((notification) => notification.Recipient?.role || notification.role || notification.module).filter(Boolean))].sort(),
    [notifications]
  );

  const typeOptions = useMemo(
    () => [...new Set(notifications.map((notification) => notification.type).filter(Boolean))].sort(),
    [notifications]
  );

  const priorityOptions = useMemo(
    () => [...new Set(notifications.map((notification) => notification.priority).filter(Boolean))].sort(),
    [notifications]
  );

  const statusOptions = useMemo(
    () => [...new Set(notifications.map((notification) => notification.status).filter(Boolean))].sort(),
    [notifications]
  );

  const openDetails = useCallback(async (notificationId) => {
    setDetailsLoading(true);
    try {
      const response = await apiClient.get(`/api/admin/notifications/${notificationId}`);
      const data = response?.data?.data || null;
      setSelectedNotification(data);
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message = status === 404 ? 'Notification was not found.' : status === 403 ? 'You are not authorized to view this notification.' : 'Unable to load notification details.';
      toast.error(message);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const updateReadState = useCallback(async (notificationId, nextReadState) => {
    try {
      const endpoint = nextReadState ? `/api/admin/notifications/${notificationId}/read` : `/api/admin/notifications/${notificationId}/unread`;
      await apiClient.patch(endpoint);
      setNotifications((current) => current.map((item) => (item.id === notificationId ? { ...item, read: nextReadState, is_read: nextReadState, readAt: new Date().toISOString() } : item)));
      setSummary((current) => ({
        ...current,
        unread: current.unread + (nextReadState ? -1 : 1),
        read: current.read + (nextReadState ? 1 : -1),
      }));
      toast.success(nextReadState ? 'Notification marked as read.' : 'Notification marked as unread.');
    } catch (requestError) {
      const status = requestError?.response?.status;
      toast.error(status === 404 ? 'Notification not found.' : 'Unable to update notification status.');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiClient.patch('/api/admin/notifications/read-all');
      toast.success('All notifications marked as read.');
      await fetchNotifications();
    } catch (requestError) {
      const status = requestError?.response?.status;
      toast.error(status === 403 ? 'You are not authorized to manage notifications.' : 'Unable to mark all notifications as read.');
    }
  }, [fetchNotifications]);

  const archiveNotification = useCallback(async (notificationId) => {
    try {
      await apiClient.post(`/api/admin/notifications/${notificationId}/archive`);
      toast.success('Notification archived.');
      await fetchNotifications();
      setSelectedNotification(null);
    } catch (requestError) {
      const status = requestError?.response?.status;
      toast.error(status === 404 ? 'Notification not found.' : 'Unable to archive notification.');
    }
  }, [fetchNotifications]);

  const loadRecipients = useCallback(async (search) => {
    setRecipientLoading(true);
    try {
      const response = await apiClient.get('/api/admin/notifications/recipients', {
        params: { search: search || undefined, page: 1, limit: 100 },
      });
      setRecipientOptions(Array.isArray(response?.data?.data) ? response.data.data : []);
      setRecipientRoles(Array.isArray(response?.data?.roles) ? response.data.roles : []);
    } catch (requestError) {
      setFormError(requestError?.response?.data?.message || 'Unable to load notification recipients.');
    } finally {
      setRecipientLoading(false);
    }
  }, []);

  useEffect(() => {
    if (formMode !== 'create') return undefined;
    const timer = setTimeout(() => loadRecipients(recipientSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [formMode, loadRecipients, recipientSearch]);

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setRecipientSearch('');
    setFormError('');
    setFormMode('create');
  };

  const openEditForm = (notification) => {
    setForm({
      ...EMPTY_FORM,
      id: notification.id,
      title: notification.title || '',
      message: notification.message || '',
      type: notification.type || 'system',
      priority: notification.priority || 'medium',
      channels: String(notification.channel || 'in_app').split(',').filter(Boolean),
    });
    setFormError('');
    setFormMode('edit');
  };

  const saveNotification = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.message.trim()) {
      setFormError('Title and message are required.');
      return;
    }
    if (formMode === 'create' && form.recipientType === 'users' && !form.userIds.length) {
      setFormError('Select at least one user recipient.');
      return;
    }
    if (formMode === 'create' && form.recipientType === 'role' && !form.roles.length) {
      setFormError('Select at least one role recipient.');
      return;
    }
    if (!form.channels.length) {
      setFormError('Select at least one delivery channel.');
      return;
    }

    setSavingForm(true);
    try {
      if (formMode === 'edit') {
        await apiClient.put(`/api/admin/notifications/${form.id}`, {
          title: form.title,
          message: form.message,
          type: form.type,
          priority: form.priority,
          channels: form.channels,
        });
        toast.success('Notification updated.');
      } else {
        const payload = {
          title: form.title,
          message: form.message,
          type: form.type,
          priority: form.priority,
          channels: form.channels,
          recipientType: form.recipientType,
          ...(form.recipientType === 'users' ? { userIds: form.userIds } : { roles: form.roles }),
          ...(form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
        };
        await apiClient.post('/api/admin/notifications/bulk', payload);
        toast.success(form.scheduledAt ? 'Notification scheduled.' : 'Notification sent.');
      }
      setFormMode('');
      await fetchNotifications();
    } catch (requestError) {
      const message = requestError?.response?.data?.message || 'Unable to save notification.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSavingForm(false);
    }
  };

  const deleteNotification = useCallback(async (notificationId) => {
    if (!window.confirm('Permanently delete this notification and its delivery records?')) return;
    try {
      await apiClient.delete(`/api/admin/notifications/${notificationId}`);
      toast.success('Notification deleted.');
      if (Number(selectedNotification?.id) === Number(notificationId)) setSelectedNotification(null);
      await fetchNotifications();
    } catch (requestError) {
      const message = requestError?.response?.data?.message || 'Unable to delete notification.';
      toast.error(message);
    }
  }, [fetchNotifications, selectedNotification]);

  const applyFilters = () => {
    fetchNotifications();
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setTimeout(() => fetchNotifications(), 0);
  };

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  };

  return (
    <section className="admin-workspace-page" aria-labelledby="admin-notifications-title" style={{ maxWidth: '100%' }}>
      <div className="admin-page-header">
        <div>
          <div className="admin-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} />
            <span>System / Notifications</span>
          </div>
          <h1 id="admin-notifications-title" className="admin-page-title">Notifications</h1>
          <p className="admin-page-subtitle">Manage and monitor system notifications across all authorized university modules.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="admin-primary-button" onClick={openCreateForm} type="button">
            Create Notification
          </button>
          <button className="admin-secondary-button" onClick={() => fetchNotifications()} disabled={loading} type="button">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="admin-primary-button" onClick={markAllRead} type="button">
            <CheckCheck size={16} />
            Mark All as Read
          </button>
        </div>
      </div>

      <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Stat label="Total Notifications" value={summary.total} icon={Bell} tone="#0EA5E9" />
        <Stat label="Unread" value={summary.unread} icon={BellRing} tone="#3074B3" />
        <Stat label="Read" value={summary.read} icon={CheckCheck} tone="#16A34A" />
        <Stat label="High Priority" value={summary.highPriority} icon={AlertTriangle} tone="#D97706" />
        <Stat label="Today" value={summary.today} icon={Filter} tone="#0F172A" />
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <label className="admin-form-field" style={{ minWidth: 170 }}>
            <span>
              <Search size={14} />
              Search
            </span>
            <input
              type="text"
              aria-label="Search notifications"
              placeholder="Search title, message, recipient"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>

          <label className="admin-form-field">
            <span>Role / Module</span>
            <select aria-label="Filter by role" value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
              <option value="">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Type</span>
            <select aria-label="Filter by notification type" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              <option value="">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Priority</span>
            <select aria-label="Filter by priority" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
              <option value="">All priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Status</span>
            <select aria-label="Filter by notification status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Read state</span>
            <select aria-label="Filter by read state" value={filters.read} onChange={(event) => updateFilter('read', event.target.value)}>
              <option value="">All</option>
              <option value="read">Read</option>
              <option value="unread">Unread</option>
            </select>
          </label>

          <label className="admin-form-field">
            <span>Date from</span>
            <input type="date" aria-label="Date from" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>

          <label className="admin-form-field">
            <span>Date to</span>
            <input type="date" aria-label="Date to" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
          <button className="admin-primary-button" onClick={applyFilters} type="button">
            Apply Filters
          </button>
          <button className="admin-secondary-button" onClick={resetFilters} type="button">
            Reset Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error-state" role="alert" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button className="admin-secondary-button" onClick={() => fetchNotifications()} type="button">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-card admin-empty-state">
          <RefreshCw size={18} className="spin" />
          <span>Loading notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="admin-card admin-empty-state" style={{ flexDirection: 'column', gap: 8 }}>
          <Bell size={32} />
          <strong>No notifications found.</strong>
          <span>There are no matching system notifications for the selected scope.</span>
        </div>
      ) : (
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table" aria-label="Notifications table">
              <thead>
                <tr>
                  <th>Notification</th>
                  <th>Recipient</th>
                  <th>Role / Module</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Created Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notification) => {
                  const isRead = Boolean(notification.read ?? notification.is_read);
                  return (
                    <tr key={notification.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{notification.title || 'Notification'}</div>
                        <div style={{ color: '#64748b', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notification.message || 'No message available'}
                        </div>
                      </td>
                      <td>{notification.Recipient?.fullName || notification.Recipient?.username || notification.recipientId || 'System Broadcast'}</td>
                      <td>{notification.Recipient?.role || notification.role || 'System'}</td>
                      <td>{notification.type || 'system'}</td>
                      <td>
                        <span className="admin-status-badge" style={priorityTone(notification.priority)}>
                          {notification.priority || 'normal'}
                        </span>
                      </td>
                      <td>{formatDate(notification.created_at || notification.createdAt)}</td>
                      <td>
                        <span className="admin-status-badge" style={statusTone(notification.status || (isRead ? 'read' : 'unread'))}>
                          {notification.status || (isRead ? 'read' : 'unread')}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="admin-secondary-button" type="button" onClick={() => openDetails(notification.id)}>
                            <Eye size={14} /> View Details
                          </button>
                          {['draft', 'scheduled'].includes(String(notification.status || '').toLowerCase()) && (
                            <button className="admin-secondary-button" type="button" onClick={() => openEditForm(notification)}>
                              Edit
                            </button>
                          )}
                          {isRead ? (
                            <button className="admin-secondary-button" type="button" onClick={() => updateReadState(notification.id, false)}>
                              Mark as Unread
                            </button>
                          ) : (
                            <button className="admin-primary-button" type="button" onClick={() => updateReadState(notification.id, true)}>
                              Mark as Read
                            </button>
                          )}
                          <button className="admin-secondary-button" type="button" onClick={() => archiveNotification(notification.id)}>
                            <Archive size={14} /> Archive
                          </button>
                          <button className="admin-secondary-button" type="button" onClick={() => deleteNotification(notification.id)} style={{ borderColor: '#fecaca', color: '#b91c1c' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="admin-secondary-button"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <button
                type="button"
                className="admin-secondary-button"
                disabled={pagination.page >= (pagination.totalPages || 1)}
                onClick={() => setFilters((current) => ({ ...current, page: Math.min(pagination.totalPages || 1, current.page + 1) }))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Page size</span>
              <select
                aria-label="Page size"
                value={filters.limit}
                onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value), page: 1 }))}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {formMode && (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setFormMode('')}>
          <form className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="notification-form-title" onSubmit={saveNotification} onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="notification-form-title">{formMode === 'create' ? 'Create Notification' : 'Edit Notification'}</h2>
              <button className="icon-button" type="button" onClick={() => setFormMode('')} aria-label="Close notification form">
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <label className="admin-form-field">
                <span>Title</span>
                <input aria-label="Notification title" maxLength={255} required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="admin-form-field">
                <span>Message</span>
                <textarea aria-label="Notification message" required rows={4} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
              </label>
              <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label className="admin-form-field">
                  <span>Type</span>
                  <select aria-label="Notification type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                    {['system', 'maintenance', 'assignment', 'transfer', 'security', 'alert', 'reminder', 'approval', 'inventory', 'financial', 'custom'].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="admin-form-field">
                  <span>Priority</span>
                  <select aria-label="Notification priority" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                    {['low', 'medium', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                {formMode === 'create' && (
                  <>
                    <label className="admin-form-field">
                      <span>Recipient type</span>
                      <select aria-label="Recipient type" value={form.recipientType} onChange={(event) => setForm((current) => ({ ...current, recipientType: event.target.value, userIds: [], roles: [] }))}>
                        <option value="users">Selected users</option>
                        <option value="role">Role(s)</option>
                      </select>
                    </label>
                    <label className="admin-form-field">
                      <span>Schedule (optional)</span>
                      <input aria-label="Schedule notification" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} />
                    </label>
                  </>
                )}
              </div>
              {formMode === 'create' && form.recipientType === 'users' && (
                <div className="admin-form-field">
                  <label htmlFor="notification-recipient-search">Find active users</label>
                  <input id="notification-recipient-search" type="search" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Search name, username, or email" />
                  <label htmlFor="notification-recipients">Recipients {recipientLoading ? '(loading...)' : ''}</label>
                  <select id="notification-recipients" aria-label="Select notification recipients" multiple size={6} value={form.userIds.map(String)} onChange={(event) => setForm((current) => ({ ...current, userIds: Array.from(event.target.selectedOptions, (option) => Number(option.value)) }))}>
                    {recipientOptions.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.fullName || recipient.username} · {recipient.role} · {recipient.email}</option>)}
                  </select>
                </div>
              )}
              {formMode === 'create' && form.recipientType === 'role' && (
                <label className="admin-form-field">
                  <span>Recipient roles</span>
                  <select aria-label="Select notification roles" multiple size={6} value={form.roles} onChange={(event) => setForm((current) => ({ ...current, roles: Array.from(event.target.selectedOptions, (option) => option.value) }))}>
                    {recipientRoles.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
                  </select>
                </label>
              )}
              <fieldset className="admin-form-field">
                <legend>Delivery channels</legend>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {['in_app', 'email', 'sms'].map((channel) => (
                    <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={form.channels.includes(channel)} onChange={(event) => setForm((current) => ({ ...current, channels: event.target.checked ? [...current.channels, channel] : current.channels.filter((value) => value !== channel) }))} />
                      {channel.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </fieldset>
              {formError && <div className="admin-error-state" role="alert">{formError}</div>}
            </div>
            <div className="admin-modal-footer">
              <button className="admin-secondary-button" type="button" onClick={() => setFormMode('')}>Cancel</button>
              <button className="admin-primary-button" type="submit" disabled={savingForm}>
                <Save size={15} /> {savingForm ? 'Saving...' : formMode === 'create' ? 'Publish Notification' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedNotification && (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setSelectedNotification(null)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="notification-details-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2 id="notification-details-title">Notification Details</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedNotification(null)} aria-label="Close notification details">
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {detailsLoading ? (
                <div className="admin-empty-state">
                  <RefreshCw size={16} className="spin" />
                  Loading details...
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div className="admin-card" style={{ padding: 16 }}>
                    <h3 style={{ margin: '0 0 8px' }}>{selectedNotification.title || 'Notification'}</h3>
                    <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{selectedNotification.message || 'No message provided.'}</p>
                  </div>

                  <div className="admin-analytics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <InfoRow label="Notification ID" value={selectedNotification.id} />
                    <InfoRow label="Recipient" value={selectedNotification.Recipient?.fullName || selectedNotification.Recipient?.username || selectedNotification.recipientId || 'System Broadcast'} />
                    <InfoRow label="Role / Module" value={selectedNotification.Recipient?.role || selectedNotification.role || 'System'} />
                    <InfoRow label="Type" value={selectedNotification.type || 'system'} />
                    <InfoRow label="Priority" value={selectedNotification.priority || 'normal'} />
                    <InfoRow label="Status" value={selectedNotification.status || 'unread'} />
                    <InfoRow label="Created Date" value={formatDate(selectedNotification.created_at || selectedNotification.createdAt)} />
                    <InfoRow label="Read Date" value={formatDate(selectedNotification.read_at || selectedNotification.readAt)} />
                    <InfoRow label="Related Entity" value={selectedNotification.assetId ? `Asset #${selectedNotification.assetId}` : selectedNotification.collegeId ? `College #${selectedNotification.collegeId}` : selectedNotification.departmentId ? `Department #${selectedNotification.departmentId}` : '—'} />
                    <InfoRow label="Channel" value={selectedNotification.channel || 'in_app'} />
                  </div>

                  {selectedNotification.NotificationDeliveries?.length ? (
                    <div className="admin-card" style={{ padding: 16 }}>
                      <h3 style={{ margin: '0 0 12px' }}>Delivery status</h3>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedNotification.NotificationDeliveries.map((delivery) => (
                          <div key={delivery.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                            <span>{delivery.channel}</span>
                            <span style={statusTone(delivery.status)}>{delivery.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const Stat = ({ label, value, icon: Icon, tone = '#0EA5E9' }) => (
  <div className="admin-card" style={{ borderTop: `3px solid ${tone}` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <Icon size={18} color={tone} />
    </div>
    <strong style={{ fontSize: '1.6rem', color: '#0f172a' }}>{Number(value || 0).toLocaleString()}</strong>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="admin-card" style={{ padding: 14 }}>
    <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
    <div style={{ marginTop: 6, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>{value || '—'}</div>
  </div>
);

export default AdminNotifications;
