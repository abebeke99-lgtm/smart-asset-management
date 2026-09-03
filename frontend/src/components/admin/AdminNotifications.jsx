import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

/*
|--------------------------------------------------------------------------
| ADMIN NOTIFICATIONS
|--------------------------------------------------------------------------
|
| CRUD:
|   CREATE  POST   /api/notifications
|   READ    GET    /api/notifications
|   UPDATE  PUT    /api/notifications/:id
|   READ    PUT    /api/notifications/:id/read
|   UPDATE  PUT    /api/notifications/:id/unread
|   UPDATE  PUT    /api/notifications/read-all
|   DELETE  DELETE /api/notifications/:id
|   DELETE  DELETE /api/notifications
|
| Expected notification object:
|
| {
|   id,
|   title,
|   message,
|   type,
|   category,
|   priority,
|   is_read,
|   sender,
|   recipient,
|   link,
|   created_at,
|   updated_at
| }
|
|--------------------------------------------------------------------------
*/

const NOTIFICATION_CATEGORIES = [
  {
    id: 'all',
    labelEn: 'All',
    labelAm: 'ሁሉም',
    icon: '🔔'
  },
  {
    id: 'unread',
    labelEn: 'Unread',
    labelAm: 'ያልተነበቡ',
    icon: '🔵'
  },
  {
    id: 'maintenance',
    labelEn: 'Maintenance Alerts',
    labelAm: 'የጥገና ማንቂያዎች',
    icon: '🔧'
  },
  {
    id: 'assignment',
    labelEn: 'Assignment Alerts',
    labelAm: 'የምደባ ማንቂያዎች',
    icon: '📋'
  },
  {
    id: 'transfer',
    labelEn: 'Transfer Alerts',
    labelAm: 'የዝውውር ማንቂያዎች',
    icon: '🔄'
  },
  {
    id: 'missing',
    labelEn: 'Missing Asset Alerts',
    labelAm: 'የጠፋ ንብረት ማንቂያዎች',
    icon: '🚨'
  },
  {
    id: 'warranty',
    labelEn: 'Warranty Alerts',
    labelAm: 'የዋስትና ማንቂያዎች',
    icon: '🛡️'
  },
  {
    id: 'rfid',
    labelEn: 'RFID Alerts',
    labelAm: 'የRFID ማንቂያዎች',
    icon: '📡'
  },
  {
    id: 'security',
    labelEn: 'Security Alerts',
    labelAm: 'የደህንነት ማንቂያዎች',
    icon: '🔒'
  }
];

const TYPE_OPTIONS = [
  'Maintenance',
  'Assignment',
  'Transfer',
  'Missing Asset',
  'Warranty',
  'RFID',
  'Security',
  'Alert',
  'Report',
  'System',
  'Reminder',
  'Approval',
  'Inventory'
];

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

const EMPTY_FORM = {
  title: '',
  message: '',
  type: 'System',
  category: 'system',
  priority: 'Medium',
  recipient: '',
  link: ''
};

const englishTranslations = {
  notifications: 'Notifications',
  all: 'All',
  unread: 'Unread',
  read: 'Read',
  maintenanceAlerts: 'Maintenance Alerts',
  assignmentAlerts: 'Assignment Alerts',
  transferAlerts: 'Transfer Alerts',
  missingAssetAlerts: 'Missing Asset Alerts',
  warrantyAlerts: 'Warranty Alerts',
  rfidAlerts: 'RFID Alerts',
  securityAlerts: 'Security Alerts',

  createNotification: 'Create Notification',
  editNotification: 'Edit Notification',
  sendNotification: 'Send Notification',
  updateNotification: 'Update Notification',

  title: 'Title',
  message: 'Message',
  type: 'Type',
  category: 'Category',
  priority: 'Priority',
  recipient: 'Recipient',
  link: 'Related Link',

  titlePlaceholder: 'Enter notification title',
  messagePlaceholder: 'Enter notification message',
  recipientPlaceholder: 'User ID, username, role, or recipient',
  linkPlaceholder: '/admin/assets/123',

  searchPlaceholder: 'Search notifications...',
  allNotifications: 'All Notifications',
  unreadOnly: 'Unread Only',
  readOnly: 'Read Only',
  allTypes: 'All Types',
  allPriorities: 'All Priorities',
  clearFilters: 'Clear Filters',

  total: 'Total',
  new: 'New',
  loading: 'Loading...',
  refresh: 'Refresh',

  markRead: 'Mark Read',
  markUnread: 'Mark Unread',
  markAllRead: 'Mark All Read',

  edit: 'Edit',
  delete: 'Delete',
  deleteAll: 'Delete All',
  viewDetails: 'View Details',

  cancel: 'Cancel',
  save: 'Save',
  update: 'Update',

  noNotifications: 'No Notifications',
  noNotificationsDesc:
    'There are no notifications available at the moment.',
  noResults: 'No Results Found',
  noResultsDesc:
    'No notifications match the current filters.',

  createSuccess: 'Notification created successfully',
  createFailed: 'Failed to create notification',
  updateSuccess: 'Notification updated successfully',
  updateFailed: 'Failed to update notification',
  deleteSuccess: 'Notification deleted successfully',
  deleteFailed: 'Failed to delete notification',
  deleteAllSuccess: 'All notifications deleted successfully',
  deleteAllFailed: 'Failed to delete all notifications',
  markedRead: 'Notification marked as read',
  markedUnread: 'Notification marked as unread',
  markedAllRead: 'All notifications marked as read',
  markFailed: 'Failed to update notification status',
  loadFailed: 'Failed to load notifications',

  confirmDelete:
    'Are you sure you want to delete this notification?',
  confirmDeleteAll:
    'Are you sure you want to delete ALL notifications? This action cannot be undone.',

  from: 'From',
  date: 'Date',
  actions: 'Actions',

  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',

  previous: 'Previous',
  next: 'Next',
  page: 'Page',

  requiredTitle: 'Notification title is required',
  requiredMessage: 'Notification message is required'
};

const amharicTranslations = {
  notifications: 'ማስታወቂያዎች',
  all: 'ሁሉም',
  unread: 'ያልተነበቡ',
  read: 'የተነበቡ',
  maintenanceAlerts: 'የጥገና ማንቂያዎች',
  assignmentAlerts: 'የምደባ ማንቂያዎች',
  transferAlerts: 'የዝውውር ማንቂያዎች',
  missingAssetAlerts: 'የጠፋ ንብረት ማንቂያዎች',
  warrantyAlerts: 'የዋስትና ማንቂያዎች',
  rfidAlerts: 'የRFID ማንቂያዎች',
  securityAlerts: 'የደህንነት ማንቂያዎች',

  createNotification: 'ማስታወቂያ ፍጠር',
  editNotification: 'ማስታወቂያ አርትዕ',
  sendNotification: 'ማስታወቂያ ላክ',
  updateNotification: 'ማስታወቂያ አዘምን',

  title: 'ርዕስ',
  message: 'መልዕክት',
  type: 'ዓይነት',
  category: 'ምድብ',
  priority: 'ቅድሚያ',
  recipient: 'ተቀባይ',
  link: 'የተያያዘ አገናኝ',

  titlePlaceholder: 'የማስታወቂያ ርዕስ ያስገቡ',
  messagePlaceholder: 'የማስታወቂያ መልዕክት ያስገቡ',
  recipientPlaceholder: 'User ID፣ username፣ role ወይም recipient',
  linkPlaceholder: '/admin/assets/123',

  searchPlaceholder: 'ማስታወቂያዎችን ፈልግ...',
  allNotifications: 'ሁሉም ማስታወቂያዎች',
  unreadOnly: 'ያልተነበቡ ብቻ',
  readOnly: 'የተነበቡ ብቻ',
  allTypes: 'ሁሉም ዓይነቶች',
  allPriorities: 'ሁሉም ቅድሚያዎች',
  clearFilters: 'ማጣሪያ አጽዳ',

  total: 'ጠቅላላ',
  new: 'አዲስ',
  loading: 'በመጫን ላይ...',
  refresh: 'አድስ',

  markRead: 'እንደተነበበ ምልክት አድርግ',
  markUnread: 'እንዳልተነበበ ምልክት አድርግ',
  markAllRead: 'ሁሉንም እንደተነበበ አድርግ',

  edit: 'አርትዕ',
  delete: 'ሰርዝ',
  deleteAll: 'ሁሉንም ሰርዝ',
  viewDetails: 'ዝርዝር ተመልከት',

  cancel: 'ሰርዝ',
  save: 'አስቀምጥ',
  update: 'አዘምን',

  noNotifications: 'ምንም ማስታወቂያ የለም',
  noNotificationsDesc:
    'በአሁኑ ጊዜ ምንም ማስታወቂያ የለም።',
  noResults: 'ምንም ውጤት አልተገኘም',
  noResultsDesc:
    'ከአሁኑ ማጣሪያ ጋር የሚዛመድ ማስታወቂያ የለም።',

  createSuccess: 'ማስታወቂያ በተሳካ ሁኔታ ተፈጥሯል',
  createFailed: 'ማስታወቂያ መፍጠር አልተሳካም',
  updateSuccess: 'ማስታወቂያ በተሳካ ሁኔታ ተዘምኗል',
  updateFailed: 'ማስታወቂያ ማዘመን አልተሳካም',
  deleteSuccess: 'ማስታወቂያ ተሰርዟል',
  deleteFailed: 'ማስታወቂያ መሰረዝ አልተሳካም',
  deleteAllSuccess: 'ሁሉም ማስታወቂያዎች ተሰርዘዋል',
  deleteAllFailed: 'ሁሉንም ማስታወቂያዎች መሰረዝ አልተሳካም',
  markedRead: 'ማስታወቂያው እንደተነበበ ተሰይሟል',
  markedUnread: 'ማስታወቂያው እንዳልተነበበ ተሰይሟል',
  markedAllRead: 'ሁሉም ማስታወቂያዎች እንደተነበቡ ተሰይመዋል',
  markFailed: 'የማስታወቂያ ሁኔታን ማዘመን አልተሳካም',
  loadFailed: 'ማስታወቂያዎችን መጫን አልተሳካም',

  confirmDelete:
    'ይህንን ማስታወቂያ መሰረዝ እርግጠኛ ነዎት?',
  confirmDeleteAll:
    'ሁሉንም ማስታወቂያዎች መሰረዝ እርግጠኛ ነዎት? ይህ ሊቀለበስ አይችልም።',

  from: 'ከ',
  date: 'ቀን',
  actions: 'እርምጃዎች',

  low: 'ዝቅተኛ',
  medium: 'መካከለኛ',
  high: 'ከፍተኛ',
  urgent: 'አስቸኳይ',

  previous: 'ቀዳሚ',
  next: 'ቀጣይ',
  page: 'ገጽ',

  requiredTitle: 'የማስታወቂያ ርዕስ ያስፈልጋል',
  requiredMessage: 'የማስታወቂያ መልዕክት ያስፈልጋል'
};

const normalizeNotification = (notification) => ({
  ...notification,
  id: notification.id,
  title: notification.title || '',
  message: notification.message || '',
  type: notification.type || 'System',
  category:
    notification.category ||
    notification.notification_category ||
    getCategoryFromType(notification.type),
  priority: notification.priority || 'Medium',
  is_read:
    notification.is_read === true ||
    notification.is_read === 1 ||
    notification.read === true,
  sender: notification.sender || notification.sender_name || '',
  recipient: notification.recipient || notification.recipient_id || '',
  link: notification.link || notification.url || '',
  created_at:
    notification.created_at ||
    notification.createdAt ||
    new Date().toISOString(),
  updated_at:
    notification.updated_at ||
    notification.updatedAt ||
    notification.created_at ||
    new Date().toISOString()
});

function getCategoryFromType(type) {
  const value = String(type || '').toLowerCase();

  if (value.includes('maintenance')) return 'maintenance';
  if (value.includes('assignment')) return 'assignment';
  if (value.includes('transfer')) return 'transfer';
  if (value.includes('missing')) return 'missing';
  if (value.includes('warranty')) return 'warranty';
  if (value.includes('rfid')) return 'rfid';
  if (value.includes('security')) return 'security';

  return 'system';
}

const getCategoryLabel = (category, language) => {
  const item = NOTIFICATION_CATEGORIES.find(
    (entry) => entry.id === category
  );

  if (!item) return category || 'System';

  return language === 'en' ? item.labelEn : item.labelAm;
};

const getPriorityColor = (priority) => {
  const colors = {
    Low: '#16a34a',
    Medium: '#2563eb',
    High: '#ea580c',
    Urgent: '#dc2626'
  };

  return colors[priority] || '#64748b';
};

const getTypeEmoji = (type) => {
  const emojis = {
    Maintenance: '🔧',
    Assignment: '📋',
    Transfer: '🔄',
    'Missing Asset': '🚨',
    Warranty: '🛡️',
    RFID: '📡',
    Security: '🔒',
    Alert: '🚨',
    Report: '📊',
    System: '⚙️',
    Reminder: '⏰',
    Approval: '✅',
    Backup: '💾',
    Inventory: '📦'
  };

  return emojis[type] || '🔔';
};

const formatDate = (date) => {
  if (!date) return '-';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return String(date);

  return parsed.toLocaleString();
};

const AdminNotifications = () => {
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';
  const t =
    language === 'en'
      ? englishTranslations
      : amharicTranslations;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingNotification, setEditingNotification] =
    useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  /*
  |--------------------------------------------------------------------------
  | READ
  |--------------------------------------------------------------------------
  */

  const fetchNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiClient.get('/api/notifications');

      const rawNotifications =
        response.data?.notifications ||
        response.data?.data ||
        [];

      const normalized = Array.isArray(rawNotifications)
        ? rawNotifications.map(normalizeNotification)
        : [];

      setNotifications(normalized);
    } catch (error) {
      console.error('Failed to load notifications:', error);

      setNotifications([]);

      toast.error(
        error.response?.data?.message || t.loadFailed
      );
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /*
  |--------------------------------------------------------------------------
  | CREATE MODAL
  |--------------------------------------------------------------------------
  */

  const openCreateModal = () => {
    setEditingNotification(null);

    setForm({
      ...EMPTY_FORM
    });

    setShowModal(true);
  };

  /*
  |--------------------------------------------------------------------------
  | UPDATE MODAL
  |--------------------------------------------------------------------------
  */

  const openEditModal = (notification) => {
    setEditingNotification(notification);

    setForm({
      title: notification.title || '',
      message: notification.message || '',
      type: notification.type || 'System',
      category:
        notification.category ||
        getCategoryFromType(notification.type),
      priority: notification.priority || 'Medium',
      recipient: notification.recipient || '',
      link: notification.link || ''
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingNotification(null);
    setForm({
      ...EMPTY_FORM
    });
  };

  /*
  |--------------------------------------------------------------------------
  | FORM
  |--------------------------------------------------------------------------
  */

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  /*
  |--------------------------------------------------------------------------
  | CREATE / UPDATE
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (event) => {
    event.preventDefault();

    const title = form.title.trim();
    const message = form.message.trim();

    if (!title) {
      toast.error(t.requiredTitle);
      return;
    }

    if (!message) {
      toast.error(t.requiredMessage);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title,
        message,
        type: form.type,
        category: form.category,
        priority: form.priority,
        recipient: form.recipient.trim(),
        link: form.link.trim()
      };

      if (editingNotification) {
        const response = await apiClient.put(
          `/api/notifications/${editingNotification.id}`,
          payload
        );

        const updatedFromApi =
          response.data?.notification ||
          response.data?.data ||
          {
            ...editingNotification,
            ...payload,
            updated_at: new Date().toISOString()
          };

        const updatedNotification =
          normalizeNotification(updatedFromApi);

        setNotifications((previous) =>
          previous.map((notification) =>
            notification.id === editingNotification.id
              ? updatedNotification
              : notification
          )
        );

        toast.success(t.updateSuccess);
      } else {
        const response = await apiClient.post(
          '/api/notifications',
          payload
        );

        const createdFromApi =
          response.data?.notification ||
          response.data?.data;

        if (createdFromApi) {
          setNotifications((previous) => [
            normalizeNotification(createdFromApi),
            ...previous
          ]);
        } else {
          await fetchNotifications();
        }

        toast.success(t.createSuccess);
      }

      closeModal();
    } catch (error) {
      console.error('Notification save error:', error);

      toast.error(
        error.response?.data?.message ||
          (editingNotification
            ? t.updateFailed
            : t.createFailed)
      );
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | MARK READ
  |--------------------------------------------------------------------------
  */

  const handleMarkRead = async (id) => {
    setActionId(id);

    try {
      await apiClient.put(`/api/notifications/${id}/read`);

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                is_read: true
              }
            : notification
        )
      );

      toast.success(t.markedRead);
    } catch (error) {
      console.error('Mark read error:', error);

      toast.error(
        error.response?.data?.message || t.markFailed
      );
    } finally {
      setActionId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | MARK UNREAD
  |--------------------------------------------------------------------------
  */

  const handleMarkUnread = async (id) => {
    setActionId(id);

    try {
      await apiClient.put(
        `/api/notifications/${id}/unread`
      );

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                is_read: false
              }
            : notification
        )
      );

      toast.success(t.markedUnread);
    } catch (error) {
      console.error('Mark unread error:', error);

      toast.error(
        error.response?.data?.message || t.markFailed
      );
    } finally {
      setActionId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | MARK ALL READ
  |--------------------------------------------------------------------------
  */

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    setActionId('all-read');

    try {
      await apiClient.put(
        '/api/notifications/read-all'
      );

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true
        }))
      );

      toast.success(t.markedAllRead);
    } catch (error) {
      console.error('Mark all read error:', error);

      toast.error(
        error.response?.data?.message || t.markFailed
      );
    } finally {
      setActionId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  const handleDelete = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;

    setActionId(id);

    try {
      await apiClient.delete(
        `/api/notifications/${id}`
      );

      setNotifications((previous) =>
        previous.filter(
          (notification) => notification.id !== id
        )
      );

      toast.success(t.deleteSuccess);
    } catch (error) {
      console.error('Delete notification error:', error);

      toast.error(
        error.response?.data?.message ||
          t.deleteFailed
      );
    } finally {
      setActionId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE ALL
  |--------------------------------------------------------------------------
  */

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;

    if (!window.confirm(t.confirmDeleteAll)) return;

    setActionId('delete-all');

    try {
      await apiClient.delete('/api/notifications');

      setNotifications([]);

      toast.success(t.deleteAllSuccess);
    } catch (error) {
      console.error(
        'Delete all notifications error:',
        error
      );

      toast.error(
        error.response?.data?.message ||
          t.deleteAllFailed
      );
    } finally {
      setActionId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | COUNTS
  |--------------------------------------------------------------------------
  */

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !notification.is_read
      ).length,
    [notifications]
  );

  const readCount = notifications.length - unreadCount;

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (activeCategory === 'unread') {
      result = result.filter(
        (notification) => !notification.is_read
      );
    } else if (activeCategory !== 'all') {
      result = result.filter((notification) => {
        const category =
          notification.category ||
          getCategoryFromType(notification.type);

        return category === activeCategory;
      });
    }

    if (filterType !== 'all') {
      result = result.filter(
        (notification) =>
          notification.type === filterType
      );
    }

    if (filterPriority !== 'all') {
      result = result.filter(
        (notification) =>
          notification.priority === filterPriority
      );
    }

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((notification) => {
        const searchable = [
          notification.title,
          notification.message,
          notification.type,
          notification.category,
          notification.priority,
          notification.sender,
          notification.recipient
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(query);
      });
    }

    return result;
  }, [
    notifications,
    activeCategory,
    filterType,
    filterPriority,
    searchQuery
  ]);

  /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredNotifications.length / pageSize
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedNotifications = useMemo(() => {
    const start =
      (safeCurrentPage - 1) * pageSize;

    return filteredNotifications.slice(
      start,
      start + pageSize
    );
  }, [
    filteredNotifications,
    safeCurrentPage
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeCategory,
    filterType,
    filterPriority,
    searchQuery
  ]);

  /*
  |--------------------------------------------------------------------------
  | FILTER RESET
  |--------------------------------------------------------------------------
  */

  const clearFilters = () => {
    setActiveCategory('all');
    setFilterType('all');
    setFilterPriority('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasFilters =
    activeCategory !== 'all' ||
    filterType !== 'all' ||
    filterPriority !== 'all' ||
    searchQuery.trim() !== '';

  /*
  |--------------------------------------------------------------------------
  | DYNAMIC TYPES
  |--------------------------------------------------------------------------
  */

  const availableTypes = useMemo(() => {
    const types = new Set(
      notifications
        .map((notification) => notification.type)
        .filter(Boolean)
    );

    TYPE_OPTIONS.forEach((type) => types.add(type));

    return Array.from(types);
  }, [notifications]);

  /*
  |--------------------------------------------------------------------------
  | STYLES
  |--------------------------------------------------------------------------
  */

  const colors = {
    page: isDark ? '#0b1220' : '#f8fafc',
    card: isDark ? '#111c2e' : '#ffffff',
    cardSecondary: isDark ? '#172338' : '#f8fafc',
    border: isDark ? '#293b55' : '#e2e8f0',
    text: isDark ? '#e5edf8' : '#172554',
    muted: isDark ? '#94a3b8' : '#64748b',
    input: isDark ? '#0b1628' : '#ffffff',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    danger: '#dc2626',
    success: '#16a34a'
  };

  const styles = {
    page: {
      minHeight: '100%',
      padding: '24px',
      background: colors.page,
      color: colors.text
    },

    wrapper: {
      maxWidth: '1400px',
      margin: '0 auto'
    },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '20px',
      flexWrap: 'wrap',
      marginBottom: '22px'
    },

    title: {
      margin: 0,
      fontSize: '28px',
      fontWeight: 800,
      color: colors.text
    },

    subtitle: {
      margin: '7px 0 0',
      fontSize: '14px',
      color: colors.muted
    },

    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '26px',
      height: '26px',
      padding: '0 9px',
      marginLeft: '10px',
      borderRadius: '999px',
      background: '#dc2626',
      color: '#ffffff',
      fontSize: '12px',
      fontWeight: 800
    },

    headerActions: {
      display: 'flex',
      gap: '9px',
      flexWrap: 'wrap'
    },

    button: (background, color = '#ffffff') => ({
      border: 'none',
      borderRadius: '8px',
      padding: '10px 15px',
      background,
      color,
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all .2s'
    }),

    categoryBar: {
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      padding: '8px',
      marginBottom: '16px',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px'
    },

    categoryButton: (active) => ({
      flexShrink: 0,
      border: active
        ? `1px solid ${colors.primary}`
        : `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '10px 14px',
      background: active
        ? colors.primary
        : colors.card,
      color: active
        ? '#ffffff'
        : colors.text,
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }),

    stats: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
      marginBottom: '16px'
    },

    statCard: {
      padding: '16px',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px'
    },

    statLabel: {
      color: colors.muted,
      fontSize: '12px',
      fontWeight: 600
    },

    statValue: {
      display: 'block',
      marginTop: '5px',
      color: colors.text,
      fontSize: '24px',
      fontWeight: 800
    },

    filterBar: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: '14px',
      marginBottom: '18px',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px'
    },

    search: {
      flex: '1 1 250px',
      minWidth: '220px',
      padding: '10px 13px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none',
      fontSize: '13px'
    },

    select: {
      minWidth: '145px',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none',
      fontSize: '13px',
      cursor: 'pointer'
    },

    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '11px'
    },

    notificationCard: (read) => ({
      padding: '17px',
      background: read
        ? colors.cardSecondary
        : colors.card,
      border: `1px solid ${colors.border}`,
      borderLeft: read
        ? `4px solid ${colors.border}`
        : `4px solid ${colors.primary}`,
      borderRadius: '11px',
      opacity: read ? 0.82 : 1,
      boxShadow: read
        ? 'none'
        : '0 2px 8px rgba(37,99,235,.08)'
    }),

    cardTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '14px'
    },

    cardMain: {
      flex: 1,
      minWidth: 0
    },

    cardTitle: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '7px',
      margin: 0,
      fontSize: '16px',
      fontWeight: 800,
      color: colors.text
    },

    unreadDot: {
      width: '9px',
      height: '9px',
      flexShrink: 0,
      borderRadius: '50%',
      background: colors.primary
    },

    message: {
      margin: '8px 0 0',
      color: colors.muted,
      fontSize: '14px',
      lineHeight: 1.55,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    },

    meta: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '9px',
      marginTop: '10px',
      color: colors.muted,
      fontSize: '11px'
    },

    pill: (background, color) => ({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 9px',
      borderRadius: '999px',
      background,
      color,
      fontSize: '10px',
      fontWeight: 800
    }),

    actions: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: '6px',
      flexShrink: 0
    },

    action: (background, color = '#ffffff') => ({
      border: 'none',
      borderRadius: '6px',
      padding: '7px 9px',
      background,
      color,
      fontSize: '11px',
      fontWeight: 700,
      cursor: 'pointer'
    }),

    empty: {
      padding: '70px 20px',
      textAlign: 'center',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      color: colors.muted
    },

    emptyIcon: {
      fontSize: '52px',
      marginBottom: '12px'
    },

    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '9px',
      marginTop: '20px'
    },

    modalOverlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'rgba(15,23,42,.68)'
    },

    modal: {
      width: '100%',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflowY: 'auto',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '14px',
      boxShadow: '0 20px 60px rgba(0,0,0,.25)'
    },

    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '18px 20px',
      borderBottom: `1px solid ${colors.border}`
    },

    modalTitle: {
      margin: 0,
      fontSize: '19px',
      fontWeight: 800,
      color: colors.text
    },

    modalBody: {
      padding: '20px'
    },

    formGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(230px, 1fr))',
      gap: '15px'
    },

    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginBottom: '15px'
    },

    label: {
      fontSize: '12px',
      fontWeight: 800,
      color: colors.muted
    },

    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '11px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none',
      fontSize: '13px'
    },

    textarea: {
      width: '100%',
      boxSizing: 'border-box',
      minHeight: '130px',
      resize: 'vertical',
      padding: '11px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none',
      fontSize: '13px',
      fontFamily: 'inherit'
    },

    modalFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '9px',
      padding: '15px 20px',
      borderTop: `1px solid ${colors.border}`
    }
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              🔔 {t.notifications}

              {unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount}
                </span>
              )}
            </h1>

            <p style={styles.subtitle}>
              {t.total}: {notifications.length}
              {' • '}
              {t.unread}: {unreadCount}
              {' • '}
              {t.read}: {readCount}
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.button(colors.primary)}
              onClick={openCreateModal}
            >
              ➕ {t.createNotification}
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                style={styles.button('#16a34a')}
                disabled={actionId === 'all-read'}
                onClick={handleMarkAllRead}
              >
                {actionId === 'all-read'
                  ? '...'
                  : `✅ ${t.markAllRead}`}
              </button>
            )}

            <button
              type="button"
              style={styles.button('#64748b')}
              disabled={loading}
              onClick={fetchNotifications}
            >
              🔄 {t.refresh}
            </button>

            {notifications.length > 0 && (
              <button
                type="button"
                style={styles.button(colors.danger)}
                disabled={actionId === 'delete-all'}
                onClick={handleDeleteAll}
              >
                🗑️ {t.deleteAll}
              </button>
            )}
          </div>
        </div>

        {/* CATEGORY NAVIGATION */}

        <div style={styles.categoryBar}>
          {NOTIFICATION_CATEGORIES.map((category) => {
            const label =
              language === 'en'
                ? category.labelEn
                : category.labelAm;

            return (
              <button
                type="button"
                key={category.id}
                style={styles.categoryButton(
                  activeCategory === category.id
                )}
                onClick={() =>
                  setActiveCategory(category.id)
                }
              >
                {category.icon} {label}
              </button>
            );
          })}
        </div>

        {/* STATISTICS */}

        <div style={styles.stats}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              📬 {t.total}
            </span>
            <span style={styles.statValue}>
              {notifications.length}
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              🔵 {t.unread}
            </span>
            <span
              style={{
                ...styles.statValue,
                color: colors.primary
              }}
            >
              {unreadCount}
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              ✅ {t.read}
            </span>
            <span
              style={{
                ...styles.statValue,
                color: colors.success
              }}
            >
              {readCount}
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              🔎 {t.total}
            </span>
            <span style={styles.statValue}>
              {filteredNotifications.length}
            </span>
          </div>
        </div>

        {/* FILTERS */}

        <div style={styles.filterBar}>
          <input
            type="text"
            style={styles.search}
            value={searchQuery}
            placeholder={t.searchPlaceholder}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
          />

          <select
            style={styles.select}
            value={
              activeCategory === 'unread'
                ? 'unread'
                : activeCategory
            }
            onChange={(event) =>
              setActiveCategory(event.target.value)
            }
          >
            <option value="all">
              {t.allNotifications}
            </option>
            <option value="unread">
              {t.unreadOnly}
            </option>
            <option value="read">
              {t.readOnly}
            </option>
          </select>

          <select
            style={styles.select}
            value={filterType}
            onChange={(event) =>
              setFilterType(event.target.value)
            }
          >
            <option value="all">{t.allTypes}</option>

            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={filterPriority}
            onChange={(event) =>
              setFilterPriority(event.target.value)
            }
          >
            <option value="all">
              {t.allPriorities}
            </option>

            {PRIORITY_OPTIONS.map((priority) => (
              <option
                key={priority}
                value={priority}
              >
                {language === 'en'
                  ? priority
                  : t[
                      priority.toLowerCase()
                    ] || priority}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              style={styles.button('#64748b')}
              onClick={clearFilters}
            >
              ✕ {t.clearFilters}
            </button>
          )}
        </div>

        {/* CONTENT */}

        {loading ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>⏳</div>
            <strong>{t.loading}</strong>
          </div>
        ) : notifications.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📬</div>

            <h3
              style={{
                margin: '0 0 8px',
                color: colors.text
              }}
            >
              {t.noNotifications}
            </h3>

            <p>{t.noNotificationsDesc}</p>

            <button
              type="button"
              style={{
                ...styles.button(colors.primary),
                marginTop: '10px'
              }}
              onClick={openCreateModal}
            >
              ➕ {t.createNotification}
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🔍</div>

            <h3
              style={{
                margin: '0 0 8px',
                color: colors.text
              }}
            >
              {t.noResults}
            </h3>

            <p>{t.noResultsDesc}</p>

            <button
              type="button"
              style={{
                ...styles.button(colors.primary),
                marginTop: '10px'
              }}
              onClick={clearFilters}
            >
              {t.clearFilters}
            </button>
          </div>
        ) : (
          <>
            <div style={styles.list}>
              {paginatedNotifications.map(
                (notification) => {
                  const category =
                    notification.category ||
                    getCategoryFromType(
                      notification.type
                    );

                  const categoryLabel =
                    getCategoryLabel(
                      category,
                      language
                    );

                  const priorityColor =
                    getPriorityColor(
                      notification.priority
                    );

                  const busy =
                    actionId === notification.id;

                  return (
                    <article
                      key={notification.id}
                      style={styles.notificationCard(
                        notification.is_read
                      )}
                    >
                      <div style={styles.cardTop}>
                        <div style={styles.cardMain}>
                          <h3 style={styles.cardTitle}>
                            {!notification.is_read && (
                              <span
                                style={
                                  styles.unreadDot
                                }
                              />
                            )}

                            <span>
                              {getTypeEmoji(
                                notification.type
                              )}
                            </span>

                            <span>
                              {notification.title ||
                                'Notification'}
                            </span>

                            {!notification.is_read && (
                              <span
                                style={styles.pill(
                                  '#dbeafe',
                                  '#1d4ed8'
                                )}
                              >
                                ● {t.new}
                              </span>
                            )}
                          </h3>

                          <p style={styles.message}>
                            {notification.message}
                          </p>

                          <div style={styles.meta}>
                            <span
                              style={styles.pill(
                                '#e0e7ff',
                                '#3730a3'
                              )}
                            >
                              {categoryLabel}
                            </span>

                            <span
                              style={styles.pill(
                                `${priorityColor}20`,
                                priorityColor
                              )}
                            >
                              {language === 'en'
                                ? notification.priority
                                : t[
                                    String(
                                      notification.priority
                                    ).toLowerCase()
                                  ] ||
                                  notification.priority}
                            </span>

                            <span
                              style={styles.pill(
                                isDark
                                  ? '#24344c'
                                  : '#f1f5f9',
                                colors.muted
                              )}
                            >
                              {notification.type}
                            </span>

                            <span>
                              🕐{' '}
                              {formatDate(
                                notification.created_at
                              )}
                            </span>

                            {notification.sender && (
                              <span>
                                👤 {t.from}:{' '}
                                {notification.sender}
                              </span>
                            )}

                            {notification.recipient && (
                              <span>
                                👥 {t.recipient}:{' '}
                                {notification.recipient}
                              </span>
                            )}
                          </div>

                          {notification.link && (
                            <div
                              style={{
                                marginTop: '10px'
                              }}
                            >
                              <a
                                href={
                                  notification.link
                                }
                                style={{
                                  color:
                                    colors.primary,
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  textDecoration:
                                    'none'
                                }}
                              >
                                🔗 {t.viewDetails} →
                              </a>
                            </div>
                          )}
                        </div>

                        <div style={styles.actions}>
                          {notification.is_read ? (
                            <button
                              type="button"
                              style={styles.action(
                                '#64748b'
                              )}
                              disabled={busy}
                              onClick={() =>
                                handleMarkUnread(
                                  notification.id
                                )
                              }
                            >
                              {busy
                                ? '...'
                                : `○ ${t.markUnread}`}
                            </button>
                          ) : (
                            <button
                              type="button"
                              style={styles.action(
                                colors.primary
                              )}
                              disabled={busy}
                              onClick={() =>
                                handleMarkRead(
                                  notification.id
                                )
                              }
                            >
                              {busy
                                ? '...'
                                : `✓ ${t.markRead}`}
                            </button>
                          )}

                          <button
                            type="button"
                            style={styles.action(
                              '#7c3aed'
                            )}
                            disabled={busy}
                            onClick={() =>
                              openEditModal(
                                notification
                              )
                            }
                          >
                            ✏️ {t.edit}
                          </button>

                          <button
                            type="button"
                            style={styles.action(
                              colors.danger
                            )}
                            disabled={busy}
                            onClick={() =>
                              handleDelete(
                                notification.id
                              )
                            }
                          >
                            🗑️ {t.delete}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>

            {/* PAGINATION */}

            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  type="button"
                  style={styles.button('#64748b')}
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.max(1, page - 1)
                    )
                  }
                >
                  ← {t.previous}
                </button>

                <span
                  style={{
                    color: colors.muted,
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                >
                  {t.page} {safeCurrentPage} /{' '}
                  {totalPages}
                </span>

                <button
                  type="button"
                  style={styles.button(
                    colors.primary
                  )}
                  disabled={
                    safeCurrentPage === totalPages
                  }
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(
                        totalPages,
                        page + 1
                      )
                    )
                  }
                >
                  {t.next} →
                </button>
              </div>
            )}
          </>
        )}

        {/* CREATE / UPDATE MODAL */}

        {showModal && (
          <div
            style={styles.modalOverlay}
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget
              ) {
                closeModal();
              }
            }}
          >
            <div
              style={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-modal-title"
            >
              <div style={styles.modalHeader}>
                <h2
                  id="notification-modal-title"
                  style={styles.modalTitle}
                >
                  {editingNotification
                    ? `✏️ ${t.editNotification}`
                    : `➕ ${t.createNotification}`}
                </h2>

                <button
                  type="button"
                  style={styles.action(
                    '#64748b'
                  )}
                  disabled={saving}
                  onClick={closeModal}
                  aria-label={t.cancel}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={styles.modalBody}>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        {t.title} *
                      </label>

                      <input
                        name="title"
                        type="text"
                        value={form.title}
                        onChange={handleFormChange}
                        placeholder={
                          t.titlePlaceholder
                        }
                        style={styles.input}
                        maxLength={255}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        {t.type}
                      </label>

                      <select
                        name="type"
                        value={form.type}
                        onChange={handleFormChange}
                        style={styles.input}
                      >
                        {TYPE_OPTIONS.map(
                          (type) => (
                            <option
                              key={type}
                              value={type}
                            >
                              {getTypeEmoji(
                                type
                              )}{' '}
                              {type}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      {t.message} *
                    </label>

                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleFormChange}
                      placeholder={
                        t.messagePlaceholder
                      }
                      style={styles.textarea}
                      required
                    />
                  </div>

                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        {t.category}
                      </label>

                      <select
                        name="category"
                        value={form.category}
                        onChange={
                          handleFormChange
                        }
                        style={styles.input}
                      >
                        {NOTIFICATION_CATEGORIES
                          .filter(
                            (category) =>
                              ![
                                'all',
                                'unread'
                              ].includes(
                                category.id
                              )
                          )
                          .map((category) => (
                            <option
                              key={category.id}
                              value={category.id}
                            >
                              {category.icon}{' '}
                              {language === 'en'
                                ? category.labelEn
                                : category.labelAm}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        {t.priority}
                      </label>

                      <select
                        name="priority"
                        value={form.priority}
                        onChange={
                          handleFormChange
                        }
                        style={styles.input}
                      >
                        {PRIORITY_OPTIONS.map(
                          (priority) => (
                            <option
                              key={priority}
                              value={priority}
                            >
                              {language === 'en'
                                ? priority
                                : t[
                                    priority.toLowerCase()
                                  ] ||
                                  priority}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        {t.recipient}
                      </label>

                      <input
                        name="recipient"
                        type="text"
                        value={form.recipient}
                        onChange={
                          handleFormChange
                        }
                        placeholder={
                          t.recipientPlaceholder
                        }
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        {t.link}
                      </label>

                      <input
                        name="link"
                        type="text"
                        value={form.link}
                        onChange={
                          handleFormChange
                        }
                        placeholder={
                          t.linkPlaceholder
                        }
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.modalFooter}>
                  <button
                    type="button"
                    style={styles.button(
                      '#64748b'
                    )}
                    disabled={saving}
                    onClick={closeModal}
                  >
                    {t.cancel}
                  </button>

                  <button
                    type="submit"
                    style={styles.button(
                      colors.primary
                    )}
                    disabled={saving}
                  >
                    {saving
                      ? '...'
                      : editingNotification
                      ? `💾 ${t.update}`
                      : `📨 ${t.save}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
