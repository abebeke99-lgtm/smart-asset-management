/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { canDeleteNotifications } from '../../utils/notificationPermissions';

const PAGE_SIZE = 10;

const AMHARIC_COPY = {
  Notification: 'ማስታወቂያ', system: 'ስርዓት', medium: 'መካከለኛ',
  Total: 'ጠቅላላ', Unread: 'ያልተነበቡ', Read: 'የተነበቡ', Search: 'ፈልግ', 'Search notifications': 'ማስታወቂያዎችን ይፈልጉ', Type: 'አይነት', All: 'ሁሉም', Refresh: 'አድስ', Retry: 'እንደገና ሞክር',
  'Mark all as read': 'ሁሉንም እንደተነበቡ ምልክት አድርግ', 'Authentication required. Please try again.': 'ማረጋገጫ ያስፈልጋል። እባክዎ እንደገና ይሞክሩ።', 'Access denied. Please try again.': 'መዳረሻ ተከልክሏል። እባክዎ እንደገና ይሞክሩ።', 'Notifications endpoint not found. Please try again.': 'የማስታወቂያ መጨረሻ ነጥብ አልተገኘም። እንደገና ይሞክሩ።', 'Failed to load notifications. Please try again.': 'ማስታወቂያዎችን መጫን አልተቻለም። እንደገና ይሞክሩ።',
  'Failed to mark notification as read.': 'ማስታወቂያውን እንደተነበበ ምልክት ማድረግ አልተቻለም።', 'All notifications marked as read.': 'ሁሉም ማስታወቂያዎች እንደተነበቡ ምልክት ተደርጓል።', 'Failed to mark all notifications as read.': 'ሁሉንም ማስታወቂያዎች እንደተነበቡ ምልክት ማድረግ አልተቻለም።', 'Notification deleted.': 'ማስታወቂያው ተሰርዟል።', 'Failed to delete notification.': 'ማስታወቂያውን መሰረዝ አልተቻለም።',
  "You're all caught up.": 'ሁሉንም ማስታወቂያዎች አንብበዋል።', 'No notifications match your filters.': 'ከማጣሪያዎችዎ ጋር የሚዛመድ ማስታወቂያ የለም።', 'There are no notifications for your college right now.': 'በአሁኑ ጊዜ ለኮሌጅዎ ማስታወቂያ የለም።', 'Clear filters': 'ማጣሪያዎችን አጽዳ', 'No message available.': 'መልዕክት የለም።', Created: 'የተፈጠረበት', Status: 'ሁኔታ', Actions: 'እርምጃዎች', Priority: 'ቅድሚያ',
  'Loading notifications...': 'ማስታወቂያዎችን በመጫን ላይ...', 'Mark as read': 'እንደተነበበ ምልክት አድርግ', 'Delete notification': 'ማስታወቂያውን ሰርዝ', low: 'ዝቅተኛ', high: 'ከፍተኛ', critical: 'አስቸኳይ', Page: 'ገጽ', of: 'ከ'
};

const normalizeNotification = (item = {}, language = 'en') => ({
  id: item.id ?? item.notificationId ?? null,
  title: item.title || item.subject || (language === 'am' ? 'ማስታወቂያ' : 'Notification'),
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
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const showDelete = canDeleteNotifications(user);
  const translate = (value) => language === 'am' ? AMHARIC_COPY[value] || AMHARIC_COPY[String(value).toLowerCase()] || value : value;
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
      const nextNotifications = rows.map((item) => normalizeNotification(item, language));
      setNotifications(nextNotifications);
      setPagination(response?.data?.pagination || { page, limit: PAGE_SIZE, total: nextNotifications.length, totalPages: 1 });
      setSummary(response?.data?.summary || { total: nextNotifications.length, unread: nextNotifications.filter((item) => !item.read).length, read: nextNotifications.filter((item) => item.read).length });
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message = status === 401 ? 'Authentication required.' : status === 403 ? 'Access denied.' : status === 404 ? 'Notifications endpoint not found.' : 'Failed to load notifications.';
      setError(language === 'am' ? translate(`${message} Please try again.`) : `${message} Please try again.`);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, readFilter, language]);

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
      toast.error(language === 'am' ? translate('Failed to mark notification as read.') : requestError?.response?.data?.message || 'Failed to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.patch('/api/college/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, read: true, isRead: true, status: 'read' })));
      setSummary((current) => ({ ...current, unread: 0, read: current.total }));
      toast.success(translate('All notifications marked as read.'));
    } catch (requestError) {
      toast.error(language === 'am' ? translate('Failed to mark all notifications as read.') : requestError?.response?.data?.message || 'Failed to mark all notifications as read.');
    }
  };

  const removeNotification = async (notificationId) => {
    try {
      await apiClient.delete(`/api/college/notifications/${notificationId}`);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      setSummary((current) => ({ total: Math.max(0, current.total - 1), unread: Math.max(0, current.unread - 1), read: Math.max(0, current.read) }));
      toast.success(translate('Notification deleted.'));
    } catch (requestError) {
      toast.error(language === 'am' ? translate('Failed to delete notification.') : requestError?.response?.data?.message || 'Failed to delete notification.');
    }
  };

  const emptyStateTitle = translate("You're all caught up.");

  return (
    <div className="college-notifications-page">
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: '18px' }}>
        <div className="admin-card" style={{ borderTop: '3px solid #0EA5E9' }}><Bell size={18} color="#0EA5E9" /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>{translate('Total')}</span><strong style={{ display: 'block', color: '#0F172A', fontSize: '1.5rem', marginTop: 5 }}>{Number(summary.total || pagination.total || 0).toLocaleString(language === 'am' ? 'am-ET' : undefined)}</strong></div>
        <div className="admin-card" style={{ borderTop: '3px solid #3074B3' }}><Bell size={18} color="#3074B3" /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>{translate('Unread')}</span><strong style={{ display: 'block', color: '#0F172A', fontSize: '1.5rem', marginTop: 5 }}>{Number(summary.unread || 0).toLocaleString(language === 'am' ? 'am-ET' : undefined)}</strong></div>
        <div className="admin-card" style={{ borderTop: '3px solid #16A34A' }}><CheckCheck size={18} color="#16A34A" /><span style={{ display: 'block', color: '#64748b', marginTop: 8 }}>{translate('Read')}</span><strong style={{ display: 'block', color: '#0F172A', fontSize: '1.5rem', marginTop: 5 }}>{Number(summary.read || 0).toLocaleString(language === 'am' ? 'am-ET' : undefined)}</strong></div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <label className="admin-form-field">
            <span><Search size={14} /> {translate('Search')}</span>
            <input aria-label={translate('Search')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={translate('Search notifications')} />
          </label>
          <label className="admin-form-field">
            <span>{translate('Read')}</span>
            <select value={readFilter} onChange={(event) => { setReadFilter(event.target.value); setPage(1); }}>
              <option value="all">{translate('All')}</option>
              <option value="unread">{translate('Unread')}</option>
              <option value="read">{translate('Read')}</option>
            </select>
          </label>
          <label className="admin-form-field">
            <span>{translate('Type')}</span>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
              <option value="all">{translate('All')}</option>
              {uniqueTypes.map((type) => <option key={type} value={type}>{translate(type)}</option>)}
            </select>
          </label>
          <div className="admin-form-field" style={{ display: 'flex', alignItems: 'end' }}>
            <button className="admin-secondary-button" type="button" onClick={loadNotifications} disabled={loading} style={{ width: '100%' }}>
              <RefreshCw size={16} style={{ marginRight: 6 }} /> {translate('Refresh')}
            </button>
          </div>
          <div className="admin-form-field" style={{ display: 'flex', alignItems: 'end' }}>
            <button className="admin-primary-button" type="button" onClick={markAllRead} disabled={loading || Number(summary.unread || 0) === 0} style={{ width: '100%' }}>
              <CheckCheck size={16} style={{ marginRight: 6 }} /> {translate('Mark all as read')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-error-state" role="alert">
          <span>{error}</span>
          <button className="admin-secondary-button" onClick={loadNotifications}>{translate('Retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="admin-card admin-empty-state"><Loader2 className="spin" size={18} /> {translate('Loading notifications...')}</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="admin-card admin-empty-state" style={{ flexDirection: 'column' }}>
          <Bell size={32} />
          <strong>{emptyStateTitle}</strong>
          <span>{translate(search || typeFilter !== 'all' || readFilter !== 'all' ? 'No notifications match your filters.' : 'There are no notifications for your college right now.')}</span>
          {(search || typeFilter !== 'all' || readFilter !== 'all') && (
            <button className="admin-secondary-button" type="button" onClick={() => { setSearch(''); setTypeFilter('all'); setReadFilter('all'); setPage(1); }}>
              <X size={16} style={{ marginRight: 6 }} /> {translate('Clear filters')}
            </button>
          )}
        </div>
      ) : (
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{translate('Notification')}</th>
                  <th>{translate('Type')}</th>
                  <th>{translate('Priority')}</th>
                  <th>{translate('Created')}</th>
                  <th>{translate('Status')}</th>
                  <th>{translate('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((notification) => (
                  <tr key={notification.id} style={{ background: notification.read ? 'transparent' : '#F5F7FA' }}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{notification.title}</div>
                      <div style={{ color: '#475569', maxWidth: 420, whiteSpace: 'normal' }}>{notification.message || translate('No message available.')}</div>
                    </td>
                    <td>{translate(notification.type)}</td>
                    <td><span className="admin-status-badge" style={{ textTransform: 'capitalize' }}>{translate(notification.priority)}</span></td>
                    <td>{notification.createdAt ? new Date(notification.createdAt).toLocaleString(language === 'am' ? 'am-ET' : undefined) : '—'}</td>
                    <td><span className="admin-status-badge" style={{ background: notification.read ? '#DCFCE7' : '#EAF2FA', color: notification.read ? '#166534' : '#245783' }}>{translate(notification.read ? 'Read' : 'Unread')}</span></td>
                    <td>
                      <div className="admin-row-actions">
                        {!notification.read && <button className="icon-button" type="button" aria-label={translate('Mark as read')} title={translate('Mark as read')} onClick={() => markRead(notification.id)}><CheckCheck size={15} /></button>}
                        {showDelete && <button className="icon-button danger" type="button" aria-label={translate('Delete notification')} title={translate('Delete notification')} onClick={() => removeNotification(notification.id)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <button className="icon-button" aria-label={translate('Previous')} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button>
            <span>{translate('Page')} {page} {translate('of')} {pagination.totalPages || 1}</span>
            <button className="icon-button" aria-label={translate('Next')} disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeNotifications;
