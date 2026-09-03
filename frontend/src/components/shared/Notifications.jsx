import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const Notifications = () => {
  const { language, theme } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount ?? (response.data.notifications || []).filter(n => !n.is_read).length);
    } catch (error) {
      toast.error('Failed to load notifications');
    }
    setLoading(false);
  };

  const handleMarkRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put('/api/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try {
      await axios.delete(`/api/notifications/${id}`);
      setNotifications(prev => prev.filter(notification => notification.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = { 'Low': '#48bb78', 'Medium': '#4299e1', 'High': '#ed8936', 'Urgent': '#fc8181' };
    return colors[priority] || '#a0aec0';
  };

  const getTypeEmoji = (type) => {
    const emojis = { 'Maintenance': '🔧', 'Assignment': '📋', 'Alert': '🚨', 'Report': '📊', 'System': '⚙️', 'Reminder': '⏰', 'Approval': '✅' };
    return emojis[type] || '📬';
  };

  const styles = {
    container: { padding: '20px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700 },
    markAllButton: { padding: '8px 16px', background: isDark ? '#2b6cb0' : '#2b6cb0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
    card: (isRead) => ({
      background: isRead ? (isDark ? '#141e2d' : '#f7fafc') : (isDark ? '#1e2d45' : '#ffffff'),
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '12px',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
      opacity: isRead ? 0.8 : 1
    }),
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
    cardTitle: { fontWeight: 600, color: isDark ? '#c8dcf5' : '#1a365d' },
    cardMessage: { color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.9rem', marginTop: '4px' },
    cardMeta: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' },
    unreadDot: { width: '10px', height: '10px', borderRadius: '50%', background: '#4299e1', display: 'inline-block', marginRight: '8px' },
    emptyState: { textAlign: 'center', padding: '60px 20px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🔔 {t.notifications}{unreadCount > 0 && <span style={{ fontSize: '0.8rem', background: '#fc8181', color: 'white', padding: '2px 10px', borderRadius: '20px', marginLeft: '12px' }}>{unreadCount} {t.unread}</span>}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter notifications">
            <option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option>
          </select>
          {unreadCount > 0 && <button style={styles.markAllButton} onClick={handleMarkAllRead}>{t.markAllRead}</button>}
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>⏳ {t.loading}</div> :
        notifications.length === 0 ? (
          <div style={styles.emptyState}><div style={{ fontSize: '3rem', marginBottom: '16px' }}>📬</div><h3>{t.noNotifications}</h3><p>{t.noNotificationsDesc}</p></div>
        ) : (
            notifications.filter(notification => filter === 'all' || (filter === 'unread' ? !notification.is_read : notification.is_read)).map(notification => (
            <div key={notification.id} style={styles.card(notification.is_read)} onClick={() => !notification.is_read && handleMarkRead(notification.id)}>
              <div style={styles.cardHeader}>
                <div style={{ flex: 1 }}>
                  <div style={styles.cardTitle}>
                    {!notification.is_read && <span style={styles.unreadDot} />}
                    <span>{getTypeEmoji(notification.type)}</span> {notification.title}
                    <span style={{ marginLeft: '8px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.7rem', background: getPriorityColor(notification.priority) + '20', color: getPriorityColor(notification.priority) }}>{notification.priority}</span>
                  </div>
                  <div style={styles.cardMessage}>{notification.message}</div>
                  <div style={styles.cardMeta}>
                    <span>{notification.type}</span>
                    <span>{new Date(notification.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {!notification.is_read && <button style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: '#4299e1', color: 'white', cursor: 'pointer', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); handleMarkRead(notification.id); }}>{t.markRead}</button>}
                  <button style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #fc8181', background: 'transparent', color: '#c53030', cursor: 'pointer', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}>Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
    </div>
  );
};

const englishTranslations = {
  notifications: 'Notifications',
  unread: 'unread',
  markAllRead: 'Mark All Read',
  markRead: 'Mark Read',
  loading: 'Loading...',
  noNotifications: 'No Notifications',
  noNotificationsDesc: 'You have no notifications at the moment.'
};

const amharicTranslations = {
  notifications: 'ማስታወቂያዎች',
  unread: 'ያልተነበቡ',
  markAllRead: 'ሁሉንም እንደተነበበ ምልክት አድርግ',
  markRead: 'እንደተነበበ ምልክት አድርግ',
  loading: 'በመጫን ላይ...',
  noNotifications: 'ምንም ማስታወቂያዎች የሉም',
  noNotificationsDesc: 'በአሁኑ ሰዓት ምንም ማስታወቂያዎች የሉዎትም።'
};

export default Notifications;


