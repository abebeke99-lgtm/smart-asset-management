import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatRelativeTime = (value) => {
  if (!value) return 'Just now';
  const diffMs = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diffMs)) return 'Just now';

  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getPriorityStyle = (priority) => {
  const normalized = String(priority || '').toLowerCase();
  if (['critical', 'urgent'].includes(normalized)) return { background: '#fee2e2', color: '#b91c1c' };
  if (['high'].includes(normalized)) return { background: '#ffedd5', color: '#c2410c' };
  if (['normal', 'medium'].includes(normalized)) return { background: '#dbeafe', color: '#1d4ed8' };
  return { background: '#e2e8f0', color: '#334155' };
};

const getReadStatusStyle = (isRead) => ({
  background: isRead ? '#e2e8f0' : '#dcfce7',
  color: isRead ? '#334155' : '#166534',
});

const StoreNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/api/notifications');
      const items = Array.isArray(response?.data?.notifications) ? response.data.notifications : [];
      setNotifications(items);
    } catch (requestError) {
      const message = requestError?.response?.status === 403
        ? 'You do not have permission to view notifications.'
        : requestError?.response?.status === 401
          ? 'Authentication required.'
          : 'Unable to load notifications. Please try again.';
      setError(message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read && !item.isRead).length,
    [notifications]
  );

  const allCount = notifications.length;
  const todayCount = notifications.filter((item) => {
    if (!item.created_at && !item.createdAt) return false;
    const created = new Date(item.created_at || item.createdAt);
    const now = new Date();
    return !Number.isNaN(created.getTime()) && created.toDateString() === now.toDateString();
  }).length;

  const highPriorityCount = notifications.filter((item) => {
    const priority = String(item.priority || '').toLowerCase();
    return ['critical', 'urgent', 'high'].includes(priority) && !item.is_read && !item.isRead;
  }).length;

  const typeOptions = useMemo(
    () => [...new Set(notifications.map((item) => item.type).filter(Boolean))].sort(),
    [notifications]
  );

  const priorityOptions = useMemo(
    () => [...new Set(notifications.map((item) => item.priority).filter(Boolean))].sort(),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const haystack = [item.title, item.message, item.type, item.priority, item.created_at, item.createdAt]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const matchesRead = statusFilter === 'all'
        || (statusFilter === 'unread' && !(item.is_read || item.isRead))
        || (statusFilter === 'read' && (item.is_read || item.isRead));
      const matchesType = typeFilter === 'all' || String(item.type || '') === typeFilter;
      const matchesPriority = priorityFilter === 'all' || String(item.priority || '') === priorityFilter;

      return matchesSearch && matchesRead && matchesType && matchesPriority;
    });
  }, [notifications, priorityFilter, search, statusFilter, typeFilter]);

  const markNotificationRead = async (notificationId) => {
    try {
      await apiClient.put(`/api/notifications/${notificationId}/read`);
      setNotifications((previous) => previous.map((item) => (
        item.id === notificationId ? { ...item, read: true, is_read: true, isRead: true } : item
      )));
      if (selectedNotification && Number(selectedNotification.id) === Number(notificationId)) {
        setSelectedNotification((current) => ({ ...current, read: true, is_read: true, isRead: true }));
      }
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Unable to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.put('/api/notifications/read-all');
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true, is_read: true, isRead: true })));
      setSelectedNotification((current) => (current ? { ...current, read: true, is_read: true, isRead: true } : current));
      toast.success('All notifications marked as read');
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Unable to mark all notifications as read.');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiClient.delete(`/api/notifications/${notificationId}`);
      setNotifications((previous) => previous.filter((item) => Number(item.id) !== Number(notificationId)));
      if (selectedNotification && Number(selectedNotification.id) === Number(notificationId)) {
        setSelectedNotification(null);
      }
      toast.success('Notification deleted');
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Unable to delete notification.');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.eyebrow}>Store Manager</div>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>View and manage important asset, inventory, request, movement, maintenance, and system notifications relevant to the Store Manager.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={loadNotifications}>Refresh</button>
          {unreadCount > 0 && (
            <button type="button" style={styles.primaryButton} onClick={markAllRead}>Mark all as read</button>
          )}
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span>All</span><strong>{allCount}</strong></div>
        <div style={styles.summaryCard}><span>Unread</span><strong>{unreadCount}</strong></div>
        <div style={styles.summaryCard}><span>High Priority</span><strong>{highPriorityCount}</strong></div>
        <div style={styles.summaryCard}><span>Today</span><strong>{todayCount}</strong></div>
      </div>

      <section style={styles.panel}>
        <div style={styles.filterGrid}>
          <input
            aria-label="Search notifications"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, message, or type"
            style={styles.input}
          />

          <select aria-label="Notification status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.input}>
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>

          <select aria-label="Notification type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={styles.input}>
            <option value="all">All types</option>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>

          <select aria-label="Notification priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} style={styles.input}>
            <option value="all">All priorities</option>
            {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </div>
      </section>

      {error ? (
        <section style={styles.emptyStateBox}>
          <div>{error}</div>
          <button type="button" style={styles.secondaryButton} onClick={loadNotifications}>Retry</button>
        </section>
      ) : loading ? (
        <section style={styles.panel}><p style={styles.loadingText}>Loading notifications...</p></section>
      ) : filteredNotifications.length === 0 ? (
        <section style={styles.panel}>
          <div style={styles.emptyStateBox}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📬</div>
            <h3 style={{ margin: '0 0 8px' }}>You’re all caught up.</h3>
            <div>There are no notifications available for your account.</div>
          </div>
        </section>
      ) : (
        <>
          <section style={styles.listPanel}>
            {filteredNotifications.map((notification) => {
              const isRead = Boolean(notification.is_read || notification.isRead);
              const priorityStyle = getPriorityStyle(notification.priority);

              return (
                <article
                  key={notification.id}
                  style={{
                    ...styles.notificationCard,
                    borderLeft: isRead ? '4px solid #cbd5e1' : '4px solid #2563eb',
                  }}
                >
                  <div style={styles.notificationHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.titleRow}>
                        {!isRead && <span style={styles.unreadDot} />}
                        <span style={styles.notificationType}>{notification.type || 'System'}</span>
                        <span style={{ ...styles.priorityBadge, ...priorityStyle }}>{notification.priority || 'Normal'}</span>
                      </div>
                      <h3 style={styles.notificationTitle}>{notification.title || 'Notification'}</h3>
                    </div>
                    <div style={styles.metaActions}>
                      {!isRead && (
                        <button type="button" style={styles.linkButton} onClick={() => markNotificationRead(notification.id)}>Mark as read</button>
                      )}
                      <button type="button" style={styles.deleteButton} onClick={() => deleteNotification(notification.id)}>Delete</button>
                    </div>
                  </div>

                  <p style={styles.message}>{notification.message || 'No message provided.'}</p>

                  <div style={styles.metaRow}>
                    <span style={{ ...styles.statusBadge, ...getReadStatusStyle(isRead) }}>{isRead ? 'Read' : 'Unread'}</span>
                    <span>{formatRelativeTime(notification.created_at || notification.createdAt)}</span>
                    <span>{formatTimestamp(notification.created_at || notification.createdAt)}</span>
                  </div>

                  <div style={styles.actionRow}>
                    <button type="button" style={styles.secondaryButton} onClick={() => setSelectedNotification(notification)}>View details</button>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}

      {selectedNotification && (
        <section style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <div>
              <div style={styles.eyebrow}>Notification details</div>
              <h2 style={styles.detailTitle}>{selectedNotification.title || 'Notification'}</h2>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={() => setSelectedNotification(null)}>Close</button>
          </div>

          <div style={styles.detailGrid}>
            <div style={styles.detailCard}>
              <h3>Overview</h3>
              <p><strong>Type:</strong> {selectedNotification.type || 'System'}</p>
              <p><strong>Priority:</strong> {selectedNotification.priority || 'Normal'}</p>
              <p><strong>Status:</strong> {selectedNotification.is_read || selectedNotification.isRead ? 'Read' : 'Unread'}</p>
              <p><strong>Created:</strong> {formatTimestamp(selectedNotification.created_at || selectedNotification.createdAt)}</p>
            </div>

            <div style={styles.detailCard}>
              <h3>Message</h3>
              <p>{selectedNotification.message || 'No message provided.'}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const styles = {
  page: { padding: '24px 18px 36px', maxWidth: '1280px', margin: '0 auto' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', fontSize: '0.72rem', fontWeight: 700 },
  title: { margin: '8px 0 0', fontSize: '2rem', fontWeight: 800, color: '#0f172a' },
  subtitle: { marginTop: '8px', color: '#475569', maxWidth: '760px' },
  headerActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  primaryButton: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' },
  summaryCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' },
  summaryCardLabel: { color: '#64748b', fontSize: '0.8rem' },
  panel: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)', marginBottom: '18px' },
  listPanel: { display: 'grid', gap: '14px' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  input: { width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 12px', background: '#fff', color: '#0f172a' },
  notificationCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' },
  notificationHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
  unreadDot: { width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' },
  notificationType: { background: '#e0f2fe', color: '#075985', padding: '4px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' },
  priorityBadge: { padding: '4px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 },
  notificationTitle: { margin: '0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' },
  message: { marginTop: '10px', color: '#475569', lineHeight: 1.6 },
  metaRow: { marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', color: '#475569', fontSize: '0.8rem' },
  statusBadge: { borderRadius: '999px', padding: '4px 8px', fontWeight: 700 },
  actionRow: { marginTop: '12px' },
  metaActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  linkButton: { background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700 },
  deleteButton: { background: 'transparent', border: '1px solid #ef4444', color: '#b91c1c', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 },
  emptyStateBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', minHeight: '180px', gap: '12px', color: '#475569' },
  loadingText: { color: '#475569', margin: 0 },
  detailPanel: { marginTop: '20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
  detailTitle: { margin: '8px 0 0', fontSize: '1.6rem', color: '#0f172a' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' },
  detailCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' },
};

export default StoreNotifications;
