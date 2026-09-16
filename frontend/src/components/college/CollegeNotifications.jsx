import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';

const PAGE_SIZE = 10;

const normalizeNotification = (item = {}) => ({
  id: item.id ?? item.notificationId ?? null,
  title: item.title || item.subject || 'Notification',
  message: item.message || item.body || item.description || '',
  type: item.type || item.notificationType || 'system',
  priority: item.priority || 'medium',
  status: item.status || (item.read || item.isRead ? 'read' : 'sent'),
  read: Boolean(item.read ?? item.isRead),
  isRead: Boolean(item.read ?? item.isRead),
  createdAt: item.createdAt || item.created_at || item.timestamp || null,
  referenceId: item.referenceId ?? item.reference_id ?? null,
  referenceType: item.referenceType ?? item.reference_type ?? null,
  actionUrl: item.actionUrl ?? item.action_url ?? null,
});

const CollegeNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, unread: 0, read: 0 });

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/notifications', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          read: readFilter === 'all' ? undefined : readFilter,
        },
      });
      const rows = Array.isArray(response?.data?.notifications) ? response.data.notifications : Array.isArray(response?.data?.data) ? response.data.data : [];
      const nextNotifications = rows.map(normalizeNotification);
      setNotifications(nextNotifications);
      setPagination(response?.data?.pagination || { page, limit: PAGE_SIZE, total: nextNotifications.length, totalPages: 1 });
      setSummary(response?.data?.summary || { total: nextNotifications.length, unread: nextNotifications.filter((item) => !item.read).length, read: nextNotifications.filter((item) => item.read).length });
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message = status === 401 ? 'Authentication required.' : status === 403 ? 'Access denied.' : status === 404 ? 'Notifications endpoint not found.' : 'Failed to load notifications.';
      setError(`${message} Please try again.`);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, readFilter]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const uniqueTypes = useMemo(() => [...new Set(notifications.map((item) => item.type).filter(Boolean))].sort(), [notifications]);

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notifications.filter((item) => {
      if (!term) return true;
      return [item.title, item.message, item.type, item.referenceId, item.referenceType].some((field) => String(field || '').toLowerCase().includes(term));
    });
  }, [notifications, search]);

  const markRead = async (notificationId) => {
    try {
      await apiClient.patch(`/api/college/notifications/${notificationId}/read`);
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read: true, isRead: true, status: 'read' } : item));
      setSummary((current) => ({ ...current, unread: Math.max(0, current.unread - 1), read: current.read + 1 }));
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Failed to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.patch('/api/college/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, read: true, isRead: true, status: 'read' })));
      setSummary((current) => ({ ...current, unread: 0, read: current.total }));
      toast.success('All notifications marked as read.');
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Failed to mark all notifications as read.');
    }
  };

  const removeNotification = async (notificationId) => {
    try {
      await apiClient.delete(`/api/college/notifications/${notificationId}`);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      setSummary((current) => ({ total: Math.max(0, current.total - 1), unread: Math.max(0, current.unread - 1), read: Math.max(0, current.read) }));
      toast.success('Notification deleted.');
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Failed to delete notification.');
    }
  };

  const emptyStateTitle = 'You\'re all caught up.';

  return (
    <div className="college-notifications-page">
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: '18px' }}>
        <div className="admin-card" style={{ borderTop: '3px solid #0EA5E9' }}><Bell size={18} color="#0EA5E9" /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>Total</span><strong style={{ display: 'block', color: '#0F172A', fontSize: '1.5rem', marginTop: 5 }}>{Number(summary.total || pagination.total || 0).toLocaleString()}</strong></div>
        <div className="admin-card" style={{ borderTop: '3px solid #2563EB' }}><Bell size={18} color="#2563EB" /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>Unread</span><strong style={{ display: 'block', color: '#0F172A', fontSize: '1.5rem', marginTop: 5 }}>{Number(summary.unread || 0).toLocaleString()}</strong></div>
        <div className="admin-card" style={{ borderTop: '3px solid #16A34A' }}><CheckCheck size={18} color="#16A34A" /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>Read</span><strong style={{ display: 'block', color: '#0F172A', fontSize: '1.5rem', marginTop: 5 }}>{Number(summary.read || 0).toLocaleString()}</strong></div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <label className="admin-form-field">
            <span><Search size={14} /> Search</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search notifications" />
          </label>
          <label className="admin-form-field">
            <span>Read</span>
            <select value={readFilter} onChange={(event) => { setReadFilter(event.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
          <label className="admin-form-field">
            <span>Type</span>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
              <option value="all">All</option>
              {uniqueTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <div className="admin-form-field" style={{ display: 'flex', alignItems: 'end' }}>
            <button className="admin-secondary-button" type="button" onClick={loadNotifications} disabled={loading} style={{ width: '100%' }}>
              <RefreshCw size={16} style={{ marginRight: 6 }} /> Refresh
            </button>
          </div>
          <div className="admin-form-field" style={{ display: 'flex', alignItems: 'end' }}>
            <button className="admin-primary-button" type="button" onClick={markAllRead} disabled={loading || Number(summary.unread || 0) === 0} style={{ width: '100%' }}>
              <CheckCheck size={16} style={{ marginRight: 6 }} /> Mark all as read
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-error-state" role="alert">
          <span>{error}</span>
          <button className="admin-secondary-button" onClick={loadNotifications}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="admin-card admin-empty-state"><Loader2 className="spin" size={18} /> Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="admin-card admin-empty-state" style={{ flexDirection: 'column' }}>
          <Bell size={32} />
          <strong>{emptyStateTitle}</strong>
          <span>{search || typeFilter !== 'all' || readFilter !== 'all' ? 'No notifications match your filters.' : 'There are no notifications for your college right now.'}</span>
          {(search || typeFilter !== 'all' || readFilter !== 'all') && (
            <button className="admin-secondary-button" type="button" onClick={() => { setSearch(''); setTypeFilter('all'); setReadFilter('all'); setPage(1); }}>
              <X size={16} style={{ marginRight: 6 }} /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Notification</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((notification) => (
                  <tr key={notification.id} style={{ background: notification.read ? 'transparent' : '#F8FAFC' }}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{notification.title}</div>
                      <div style={{ color: '#475569', maxWidth: 420, whiteSpace: 'normal' }}>{notification.message || 'No message available.'}</div>
                    </td>
                    <td>{notification.type}</td>
                    <td><span className="admin-status-badge" style={{ textTransform: 'capitalize' }}>{notification.priority}</span></td>
                    <td>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '—'}</td>
                    <td><span className="admin-status-badge" style={{ background: notification.read ? '#DCFCE7' : '#DBEAFE', color: notification.read ? '#166534' : '#1D4ED8' }}>{notification.read ? 'Read' : 'Unread'}</span></td>
                    <td>
                      <div className="admin-row-actions">
                        {!notification.read && <button className="icon-button" type="button" title="Mark as read" onClick={() => markRead(notification.id)}><CheckCheck size={15} /></button>}
                        <button className="icon-button danger" type="button" title="Delete notification" onClick={() => removeNotification(notification.id)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <button className="icon-button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button>
            <span>Page {page} of {pagination.totalPages || 1}</span>
            <button className="icon-button" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeNotifications;
