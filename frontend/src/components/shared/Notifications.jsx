import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import './Notifications.css';

const PAGE_SIZE = 20;
const isRead = (item) => Boolean(item.is_read ?? item.isRead ?? item.read);
const dateText = (value) => { if (!value) return '-'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(); };
const priority = (value) => ['low', 'medium', 'high', 'urgent'].includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'medium';

const Notifications = () => {
  const { language } = useLanguage();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, unread: 0, read: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', read: '', type: '', priority: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const t = language === 'en' ? en : am;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/api/notifications', { params: { page, limit: PAGE_SIZE, search: filters.search.trim() || undefined, read: filters.read || undefined, type: filters.type || undefined, priority: filters.priority || undefined } });
      const payload = response?.data || {};
      const rows = Array.isArray(payload.notifications) ? payload.notifications : Array.isArray(payload.data) ? payload.data : [];
      setItems(rows);
      setSummary(payload.summary || { total: Number(payload.total || rows.length), unread: Number(payload.unreadCount || rows.filter((item) => !isRead(item)).length), read: rows.filter(isRead).length });
      setPagination(payload.pagination || { page, totalPages: 1 });
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(status === 401 ? t.auth : status === 403 ? t.denied : t.loadError);
      setItems([]);
    } finally { setLoading(false); }
  }, [filters, page, t]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, [load]);
  const types = useMemo(() => [...new Set(items.map((item) => item.type).filter(Boolean))].sort(), [items]);
  const priorities = useMemo(() => [...new Set(items.map((item) => item.priority).filter(Boolean))].sort(), [items]);
  const filter = (name, value) => { setFilters((current) => ({ ...current, [name]: value })); setPage(1); };

  const markRead = async (id) => {
    setBusy(id);
    try {
      const response = await apiClient.patch(`/api/notifications/${id}/read`);
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true, is_read: true, isRead: true } : item));
      setSummary((current) => ({ ...current, unread: response?.data?.unreadCount ?? Math.max(0, current.unread - 1), read: current.read + 1 }));
    } catch (requestError) { toast.error(requestError?.response?.data?.message || t.markError); } finally { setBusy(null); }
  };

  const markAll = async () => {
    setBusy('all');
    try {
      const response = await apiClient.patch('/api/notifications/read-all');
      setItems((current) => current.map((item) => ({ ...item, read: true, is_read: true, isRead: true })));
      setSummary((current) => ({ ...current, unread: response?.data?.unreadCount ?? 0, read: current.read + current.unread }));
      toast.success(t.markAllSuccess);
    } catch (requestError) { toast.error(requestError?.response?.data?.message || t.markAllError); } finally { setBusy(null); }
  };

  const remove = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(id);
    try {
      const removed = items.find((item) => item.id === id);
      await apiClient.delete(`/api/notifications/${id}`);
      setItems((current) => current.filter((item) => item.id !== id));
      setSummary((current) => ({ total: Math.max(0, current.total - 1), unread: Math.max(0, current.unread - (removed && !isRead(removed) ? 1 : 0)), read: Math.max(0, current.read - (removed && isRead(removed) ? 1 : 0)) }));
      toast.success(t.deleted);
    } catch (requestError) { toast.error(requestError?.response?.data?.message || t.deleteError); } finally { setBusy(null); }
  };

  const noFilter = !Object.values(filters).some(Boolean);
  return <main className="notifications-page" aria-labelledby="notifications-title">
    <header className="notifications-page__header"><div><div className="notifications-page__eyebrow"><Bell size={16} aria-hidden="true" /> {t.eyebrow}</div><h1 id="notifications-title">{t.title}</h1><p>{t.subtitle}</p></div><button className="notifications-button notifications-button--secondary" type="button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'notifications-spin' : ''} aria-hidden="true" /> {t.refresh}</button></header>
    <section className="notifications-summary" aria-label={t.summary}><div><span>{t.total}</span><strong>{summary.total}</strong></div><div><span>{t.unread}</span><strong>{summary.unread}</strong></div><div><span>{t.read}</span><strong>{summary.read}</strong></div></section>
    <section className="notifications-toolbar" aria-label={t.filters}><label className="notifications-search"><Search size={16} aria-hidden="true" /><span className="sr-only">{t.search}</span><input type="search" value={filters.search} onChange={(event) => filter('search', event.target.value)} placeholder={t.searchPlaceholder} /></label><label><span className="sr-only">{t.status}</span><select value={filters.read} onChange={(event) => filter('read', event.target.value)}><option value="">{t.all}</option><option value="unread">{t.unread}</option><option value="read">{t.read}</option></select></label><label><span className="sr-only">{t.type}</span><select value={filters.type} onChange={(event) => filter('type', event.target.value)}><option value="">{t.allTypes}</option>{types.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="sr-only">{t.priority}</span><select value={filters.priority} onChange={(event) => filter('priority', event.target.value)}><option value="">{t.allPriorities}</option>{priorities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{summary.unread > 0 && <button className="notifications-button notifications-button--primary" type="button" onClick={markAll} disabled={busy === 'all'}><CheckCheck size={16} aria-hidden="true" /> {t.markAll}</button>}</section>
    {error && <section className="notifications-state notifications-state--error" role="alert"><AlertCircle size={22} aria-hidden="true" /><span>{error}</span><button className="notifications-button notifications-button--secondary" type="button" onClick={load}>{t.retry}</button></section>}
    {loading ? <section className="notifications-state"><Loader2 size={22} className="notifications-spin" aria-hidden="true" /><span>{t.loading}</span></section> : !error && items.length === 0 ? <section className="notifications-state"><Bell size={30} aria-hidden="true" /><strong>{noFilter ? t.empty : t.noMatches}</strong><span>{noFilter ? t.emptyHelp : t.noMatchesHelp}</span></section> : !error && <section className="notifications-list" aria-live="polite">{items.map((item) => { const read = isRead(item); const created = item.created_at || item.createdAt; return <article className={`notification-item${read ? ' notification-item--read' : ''}`} key={item.id}><div className={`notification-item__icon notification-item__icon--${priority(item.priority)}`}><Bell size={18} aria-hidden="true" /></div><div className="notification-item__content"><div className="notification-item__heading"><h2>{item.title || t.notification}</h2>{!read && <span className="notification-unread">{t.unread}</span>}</div><p>{item.message || t.noMessage}</p><div className="notification-item__meta"><span>{item.type || t.notification}</span><time dateTime={created || undefined}>{dateText(created)}</time>{item.priority && <span className={`notification-priority notification-priority--${priority(item.priority)}`}>{item.priority}</span>}</div></div><div className="notification-item__actions">{!read && <button className="notifications-icon-button" type="button" title={t.markRead} aria-label={`${t.markRead}: ${item.title || t.notification}`} onClick={() => markRead(item.id)} disabled={busy === item.id}><CheckCheck size={17} aria-hidden="true" /></button>}<button className="notifications-icon-button notifications-icon-button--danger" type="button" title={t.delete} aria-label={`${t.delete}: ${item.title || t.notification}`} onClick={() => remove(item.id)} disabled={busy === item.id}><Trash2 size={17} aria-hidden="true" /></button></div></article>; })}</section>}
    {!loading && !error && items.length > 0 && <footer className="notifications-pagination"><span>{t.page} {pagination.page || page} {t.of} {pagination.totalPages || 1}</span><div><button className="notifications-icon-button" type="button" title={t.previous} aria-label={t.previous} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={18} aria-hidden="true" /></button><button className="notifications-icon-button" type="button" title={t.next} aria-label={t.next} disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}><ChevronRight size={18} aria-hidden="true" /></button></div></footer>}
  </main>;
};

const en = { eyebrow: 'Department workspace', title: 'Notifications', subtitle: 'Stay informed about activity relevant to your department.', refresh: 'Refresh', summary: 'Notification summary', total: 'Total', unread: 'Unread', read: 'Read', filters: 'Filter notifications', search: 'Search notifications', searchPlaceholder: 'Search title, message, or type', status: 'Read status', all: 'All statuses', type: 'Type', allTypes: 'All types', priority: 'Priority', allPriorities: 'All priorities', markAll: 'Mark all as read', retry: 'Retry', loading: 'Loading notifications', empty: 'You are all caught up', emptyHelp: 'There are no notifications available for your department.', noMatches: 'No matching notifications', noMatchesHelp: 'Try changing or clearing your filters.', notification: 'Notification', noMessage: 'No message available.', markRead: 'Mark as read', delete: 'Delete notification', confirmDelete: 'Delete this notification?', markError: 'Unable to mark notification as read.', markAllSuccess: 'All notifications marked as read.', markAllError: 'Unable to mark all notifications as read.', deleted: 'Notification deleted.', deleteError: 'Unable to delete notification.', auth: 'Authentication is required.', denied: 'You do not have permission to view notifications.', loadError: 'Unable to load notifications. Please try again.', page: 'Page', of: 'of', previous: 'Previous page', next: 'Next page' };
const am = { ...en, eyebrow: 'የዲፓርትመንት የስራ ቦታ', title: 'ማስታወቂያዎች', subtitle: 'ለዲፓርትመንትዎ ጠቃሚ የሆኑ ማስታወቂያዎችን ይከታተሉ።', refresh: 'አድስ', total: 'ጠቅላላ', unread: 'ያልተነበበ', read: 'የተነበበ', markAll: 'ሁሉንም እንደተነበበ አድርግ', retry: 'እንደገና ሞክር', loading: 'ማስታወቂያዎች በመጫን ላይ', empty: 'ሁሉንም ተከታትለዋል', emptyHelp: 'ለዲፓርትመንትዎ ምንም ማስታወቂያ የለም።', page: 'ገጽ', of: 'ከ' };

export default Notifications;
