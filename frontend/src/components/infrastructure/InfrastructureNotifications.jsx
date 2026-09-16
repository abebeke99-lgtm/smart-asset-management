import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 10;

const TYPE_OPTIONS = [
  "",
  "maintenance",
  "work_order",
  "inspection",
  "request",
  "asset",
  "energy",
  "tracking",
  "system",
];

const STATUS_OPTIONS = [
  "",
  "unread",
  "read",
];

const PRIORITY_OPTIONS = [
  "",
  "low",
  "medium",
  "high",
  "critical",
];

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload?.data))
    return payload.data;

  if (Array.isArray(payload?.items))
    return payload.items;

  if (Array.isArray(payload?.records))
    return payload.records;

  if (Array.isArray(payload?.results))
    return payload.results;

  if (Array.isArray(payload?.rows))
    return payload.rows;

  if (Array.isArray(payload?.notifications))
    return payload.notifications;

  return [];
}

function getPayload(response) {
  return response?.data?.data ??
    response?.data ??
    {};
}

function normalizeNotification(item) {
  const readValue = firstValue(
    item.read,
    item.isRead,
    item.is_read
  );

  return {
    id: firstValue(
      item.id,
      item._id,
      item.notificationId,
      item.notification_id
    ),

    title: firstValue(
      item.title,
      item.subject,
      item.name,
      "Infrastructure Notification"
    ),

    message: firstValue(
      item.message,
      item.body,
      item.description,
      item.content,
      ""
    ),

    type: firstValue(
      item.type,
      item.notificationType,
      item.notification_type,
      "system"
    ),

    priority: firstValue(
      item.priority,
      item.severity,
      "medium"
    ),

    status:
      readValue === true ||
      readValue === 1 ||
      String(readValue).toLowerCase() === "true" ||
      String(item.status || "").toLowerCase() === "read"
        ? "read"
        : "unread",

    createdAt: firstValue(
      item.createdAt,
      item.created_at,
      item.date,
      item.timestamp,
      item.sentAt,
      item.sent_at
    ),

    updatedAt: firstValue(
      item.updatedAt,
      item.updated_at
    ),

    source: firstValue(
      item.source,
      item.module,
      item.category,
      "Infrastructure"
    ),

    relatedId: firstValue(
      item.relatedId,
      item.related_id,
      item.referenceId,
      item.reference_id
    ),

    relatedType: firstValue(
      item.relatedType,
      item.related_type,
      item.referenceType,
      item.reference_type
    ),

    actionUrl: firstValue(
      item.actionUrl,
      item.action_url,
      item.url,
      item.link
    ),
  };
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime()))
    return String(value);

  return date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime()))
    return "";

  const diff =
    Date.now() - date.getTime();

  const minutes =
    Math.floor(diff / 60000);

  if (minutes < 1)
    return "Just now";

  if (minutes < 60)
    return `${minutes}m ago`;

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24)
    return `${hours}h ago`;

  const days =
    Math.floor(hours / 24);

  if (days < 7)
    return `${days}d ago`;

  return date.toLocaleDateString();
}

function getTypeIcon(type) {
  const value =
    String(type || "").toLowerCase();

  if (value.includes("maintenance"))
    return <Settings size={18} />;

  if (value.includes("work"))
    return <Clock size={18} />;

  if (value.includes("inspection"))
    return <TriangleAlert size={18} />;

  if (value.includes("request"))
    return <Info size={18} />;

  if (value.includes("asset"))
    return <Bell size={18} />;

  if (value.includes("energy"))
    return <Bell size={18} />;

  if (value.includes("tracking"))
    return <Bell size={18} />;

  return <Bell size={18} />;
}

function priorityClass(priority) {
  const value =
    String(priority || "").toLowerCase();

  if (value === "critical")
    return "critical";

  if (value === "high")
    return "high";

  if (value === "medium")
    return "medium";

  return "low";
}

function typeLabel(type) {
  if (!type) return "System";

  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function extractPagination(payload) {
  const pagination =
    payload?.pagination ||
    payload?.meta ||
    {};

  return {
    page: Number(
      firstValue(
        pagination.page,
        pagination.currentPage,
        pagination.current_page,
        payload?.page,
        1
      )
    ),

    limit: Number(
      firstValue(
        pagination.limit,
        pagination.pageSize,
        pagination.page_size,
        payload?.limit,
        PAGE_SIZE
      )
    ),

    total: Number(
      firstValue(
        pagination.total,
        pagination.totalCount,
        pagination.total_count,
        payload?.total,
        extractRows(payload).length
      )
    ),

    pages: Number(
      firstValue(
        pagination.pages,
        pagination.totalPages,
        pagination.total_pages,
        payload?.pages,
        1
      )
    ),
  };
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}) {
  return (
    <div className="stat-card">
      <div>
        <div className="stat-title">
          {title}
        </div>

        <div className="stat-value">
          {value}
        </div>
      </div>

      <div className={`stat-icon ${tone}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}

export default function InfrastructureNotifications() {
  const [notifications, setNotifications] =
    useState([]);

  const [summary, setSummary] =
    useState({});

  const [page, setPage] = useState(1);
  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      pages: 1,
    });

  const [search, setSearch] =
    useState("");

  const [type, setType] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [priority, setPriority] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [selected, setSelected] =
    useState(null);

  const [showFilters, setShowFilters] =
    useState(false);

  const fetchNotifications =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await api.get(
            "/infrastructure/notifications",
            {
              params: {
                page,
                limit: PAGE_SIZE,
                search:
                  search.trim() ||
                  undefined,
                type:
                  type || undefined,
                status:
                  status || undefined,
                priority:
                  priority || undefined,
              },
            }
          );

        const payload =
          getPayload(response);

        const rows =
          extractRows(payload)
            .map(normalizeNotification);

        setNotifications(rows);

        setSummary(
          payload?.summary ||
            payload?.statistics ||
            payload?.stats ||
            {}
        );

        setPagination(
          extractPagination(payload)
        );
      } catch (err) {
        console.error(
          "Failed to load infrastructure notifications:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Unable to load infrastructure notifications."
        );

        setNotifications([]);
      } finally {
        setLoading(false);
      }
    }, [
      page,
      search,
      type,
      status,
      priority,
    ]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () =>
      clearTimeout(timer);
  }, [success]);

  const calculatedStats =
    useMemo(() => {
      const unread =
        notifications.filter(
          (item) =>
            item.status === "unread"
        ).length;

      const read =
        notifications.filter(
          (item) =>
            item.status === "read"
        ).length;

      const critical =
        notifications.filter(
          (item) =>
            String(
              item.priority
            ).toLowerCase() ===
            "critical"
        ).length;

      const high =
        notifications.filter(
          (item) =>
            String(
              item.priority
            ).toLowerCase() ===
            "high"
        ).length;

      return {
        total: Number(
          firstValue(
            summary.total,
            summary.totalNotifications,
            summary.total_notifications,
            pagination.total,
            0
          )
        ),

        unread: Number(
          firstValue(
            summary.unread,
            summary.unreadCount,
            summary.unread_count,
            unread,
            0
          )
        ),

        read: Number(
          firstValue(
            summary.read,
            summary.readCount,
            summary.read_count,
            read,
            0
          )
        ),

        critical: Number(
          firstValue(
            summary.critical,
            summary.criticalCount,
            summary.critical_count,
            critical,
            0
          )
        ),

        high: Number(
          firstValue(
            summary.high,
            summary.highCount,
            summary.high_count,
            high,
            0
          )
        ),
      };
    }, [
      notifications,
      summary,
      pagination.total,
    ]);

  const markAsRead =
    async (notification) => {
      if (
        !notification?.id ||
        notification.status === "read"
      ) {
        return;
      }

      try {
        setActionLoading(
          `read-${notification.id}`
        );

        await api.patch(
          `/infrastructure/notifications/${notification.id}/read`
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  status: "read",
                }
              : item
          )
        );

        setSuccess(
          "Notification marked as read."
        );
      } catch (err) {
        console.error(
          "Failed to mark notification as read:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Unable to mark notification as read."
        );
      } finally {
        setActionLoading(null);
      }
    };

  const markAsUnread =
    async (notification) => {
      if (
        !notification?.id ||
        notification.status === "unread"
      ) {
        return;
      }

      try {
        setActionLoading(
          `unread-${notification.id}`
        );

        await api.patch(
          `/infrastructure/notifications/${notification.id}/unread`
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  status: "unread",
                }
              : item
          )
        );

        setSuccess(
          "Notification marked as unread."
        );
      } catch (err) {
        console.error(
          "Failed to mark notification as unread:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Unable to mark notification as unread."
        );
      } finally {
        setActionLoading(null);
      }
    };

  const deleteNotification =
    async (notification) => {
      if (!notification?.id)
        return;

      const confirmed =
        window.confirm(
          "Delete this notification?"
        );

      if (!confirmed) return;

      try {
        setActionLoading(
          `delete-${notification.id}`
        );

        await api.delete(
          `/infrastructure/notifications/${notification.id}`
        );

        setNotifications((current) =>
          current.filter(
            (item) =>
              item.id !== notification.id
          )
        );

        setSelected(null);

        setSuccess(
          "Notification deleted successfully."
        );
      } catch (err) {
        console.error(
          "Failed to delete notification:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Unable to delete notification."
        );
      } finally {
        setActionLoading(null);
      }
    };

  const markAllAsRead =
    async () => {
      try {
        setActionLoading(
          "mark-all"
        );

        await api.patch(
          "/infrastructure/notifications/read-all"
        );

        setNotifications((current) =>
          current.map((item) => ({
            ...item,
            status: "read",
          }))
        );

        setSuccess(
          "All notifications marked as read."
        );
      } catch (err) {
        console.error(
          "Failed to mark all notifications as read:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Unable to mark all notifications as read."
        );
      } finally {
        setActionLoading(null);
      }
    };

  const clearFilters = () => {
    setSearch("");
    setType("");
    setStatus("");
    setPriority("");
    setPage(1);
  };

  const changePage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > pagination.pages
    ) {
      return;
    }

    setPage(nextPage);
  };

  return (
    <div className="notifications-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .notifications-page {
          min-height: 100vh;
          padding: 24px;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif,
            system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .notifications-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 20px;
        }

        .header-left {
          display: flex;
          gap: 14px;
        }

        .header-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: white;
          background: linear-gradient(
            135deg,
            #0ea5e9,
            #2563eb
          );
          box-shadow:
            0 10px 25px
            rgba(37, 99, 235, .18);
        }

        .page-header h1 {
          margin: 0 0 5px;
          font-size: 27px;
          font-weight: 850;
          letter-spacing: -.025em;
        }

        .page-header p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 40px;
          padding: 0 13px;
          border-radius: 9px;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          text-decoration: none;
          transition: .2s ease;
          white-space: nowrap;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          background: white;
          border-color: #e2e8f0;
          color: #334155;
        }

        .btn-secondary:hover {
          background: #f8fafc;
        }

        .alert {
          padding: 12px 14px;
          margin-bottom: 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 650;
        }

        .alert-error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .alert-success {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 17px;
        }

        .stat-card {
          min-height: 112px;
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: white;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .stat-title {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .stat-value {
          margin-top: 9px;
          font-size: 25px;
          font-weight: 850;
        }

        .stat-icon {
          width: 39px;
          height: 39px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.blue {
          color: #2563eb;
          background: #eff6ff;
        }

        .stat-icon.cyan {
          color: #0891b2;
          background: #ecfeff;
        }

        .stat-icon.green {
          color: #16a34a;
          background: #f0fdf4;
        }

        .stat-icon.orange {
          color: #ea580c;
          background: #fff7ed;
        }

        .stat-icon.red {
          color: #dc2626;
          background: #fef2f2;
        }

        .toolbar {
          padding: 14px;
          margin-bottom: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: white;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .toolbar-main {
          display: flex;
          gap: 9px;
          align-items: center;
        }

        .search-box {
          flex: 1;
          min-width: 200px;
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-input,
        .select {
          height: 40px;
          width: 100%;
          padding: 0 10px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: white;
          color: #334155;
          font-size: 12px;
          outline: none;
        }

        .search-input {
          padding-left: 36px;
        }

        .search-input:focus,
        .select:focus {
          border-color: #0ea5e9;
          box-shadow:
            0 0 0 3px
            rgba(14,165,233,.1);
        }

        .filter-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(150px, 1fr));
          gap: 9px;
          margin-top: 10px;
        }

        .filter-grid.hidden {
          display: none;
        }

        .list-panel {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: white;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .list-header {
          min-height: 59px;
          padding: 13px 16px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .list-title {
          font-size: 14px;
          font-weight: 850;
        }

        .list-subtitle {
          margin-top: 3px;
          color: #64748b;
          font-size: 10px;
        }

        .notification-list {
          display: flex;
          flex-direction: column;
        }

        .notification {
          padding: 15px 16px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          gap: 12px;
          transition: .18s ease;
        }

        .notification:last-child {
          border-bottom: 0;
        }

        .notification:hover {
          background: #f8fbff;
        }

        .notification.unread {
          background: #f0f9ff;
        }

        .notification-icon {
          width: 41px;
          height: 41px;
          border-radius: 11px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          background: #dbeafe;
        }

        .notification-main {
          min-width: 0;
          flex: 1;
        }

        .notification-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .notification-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
        }

        .notification-message {
          margin-top: 5px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.55;
        }

        .notification-meta {
          margin-top: 9px;
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
          color: #94a3b8;
          font-size: 9px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .badge.unread {
          color: #075985;
          background: #e0f2fe;
        }

        .badge.read {
          color: #475569;
          background: #f1f5f9;
        }

        .badge.low {
          color: #475569;
          background: #f1f5f9;
        }

        .badge.medium {
          color: #92400e;
          background: #fef3c7;
        }

        .badge.high {
          color: #9a3412;
          background: #ffedd5;
        }

        .badge.critical {
          color: #991b1b;
          background: #fee2e2;
        }

        .notification-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .icon-btn {
          width: 32px;
          height: 32px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          color: #2563eb;
          border-color: #bfdbfe;
          background: #eff6ff;
        }

        .icon-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .empty-state {
          padding: 58px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 12px;
          border-radius: 14px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state strong {
          display: block;
          color: #334155;
          font-size: 13px;
        }

        .empty-state span {
          display: block;
          margin-top: 5px;
          font-size: 11px;
        }

        .loading-state {
          padding: 60px 20px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }

        .pagination {
          min-height: 58px;
          padding: 10px 15px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .page-info {
          color: #64748b;
          font-size: 10px;
        }

        .page-buttons {
          display: flex;
          gap: 5px;
        }

        .page-btn {
          width: 33px;
          height: 33px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page-btn:hover:not(:disabled) {
          border-color: #93c5fd;
          color: #2563eb;
        }

        .page-btn:disabled {
          opacity: .4;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 20px;
          background: rgba(15,23,42,.58);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: min(620px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 16px;
          background: white;
          box-shadow:
            0 25px 80px
            rgba(15,23,42,.25);
        }

        .modal-header {
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 850;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 10px;
        }

        .close-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-body {
          padding: 18px;
        }

        .detail-message {
          padding: 14px;
          margin-bottom: 14px;
          border-radius: 10px;
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .detail-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .detail-item {
          padding: 11px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #fff;
        }

        .detail-label {
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .detail-value {
          margin-top: 5px;
          color: #0f172a;
          font-size: 11px;
          font-weight: 700;
          word-break: break-word;
        }

        .modal-actions {
          padding: 13px 18px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .notifications-page {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .toolbar-main {
            flex-wrap: wrap;
          }

          .search-box {
            flex-basis: 100%;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 550px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .notification {
            padding: 12px;
          }

          .notification-top {
            flex-direction: column;
          }

          .notification-actions {
            align-self: flex-end;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .page-buttons {
            justify-content: flex-end;
          }
        }
      `}</style>

      <div className="notifications-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Bell size={25} />
            </div>

            <div>
              <h1>
                Infrastructure Notifications
              </h1>

              <p>
                Monitor infrastructure alerts,
                maintenance events, work orders,
                inspections, requests, and system
                notifications.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn btn-secondary"
            >
              Dashboard
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchNotifications}
              disabled={loading}
            >
              <RefreshCw
                size={14}
                className={
                  loading ? "spin" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={markAllAsRead}
              disabled={
                actionLoading ===
                  "mark-all" ||
                calculatedStats.unread === 0
              }
            >
              {actionLoading ===
              "mark-all" ? (
                <Loader2
                  size={14}
                  className="spin"
                />
              ) : (
                <Check size={14} />
              )}
              Mark All Read
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>

            <button
              type="button"
              className="icon-btn"
              style={{
                marginLeft: "auto",
              }}
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <div className="stats-grid">
          <StatCard
            title="Total Notifications"
            value={calculatedStats.total}
            icon={Bell}
            tone="blue"
          />

          <StatCard
            title="Unread"
            value={calculatedStats.unread}
            icon={Bell}
            tone="cyan"
          />

          <StatCard
            title="Read"
            value={calculatedStats.read}
            icon={CheckCircle2}
            tone="green"
          />

          <StatCard
            title="High Priority"
            value={calculatedStats.high}
            icon={TriangleAlert}
            tone="orange"
          />

          <StatCard
            title="Critical"
            value={calculatedStats.critical}
            icon={AlertCircle}
            tone="red"
          />
        </div>

        <div className="toolbar">
          <div className="toolbar-main">
            <div className="search-box">
              <Search size={15} />

              <input
                className="search-input"
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value
                  );
                  setPage(1);
                }}
                placeholder="Search notifications..."
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setShowFilters(
                  (current) => !current
                )
              }
            >
              <Filter size={14} />
              Filters
            </button>

            {(search ||
              type ||
              status ||
              priority) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          <div
            className={`filter-grid ${
              showFilters
                ? ""
                : "hidden"
            }`}
          >
            <select
              className="select"
              value={type}
              onChange={(event) => {
                setType(
                  event.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All Types
              </option>

              {TYPE_OPTIONS.filter(
                Boolean
              ).map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {typeLabel(item)}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All Statuses
              </option>

              {STATUS_OPTIONS.filter(
                Boolean
              ).map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {typeLabel(item)}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={priority}
              onChange={(event) => {
                setPriority(
                  event.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All Priorities
              </option>

              {PRIORITY_OPTIONS.filter(
                Boolean
              ).map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {typeLabel(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="list-panel">
          <div className="list-header">
            <div>
              <div className="list-title">
                Notification Center
              </div>

              <div className="list-subtitle">
                Real notifications returned from
                the infrastructure API.
              </div>
            </div>

            <Bell size={18} color="#64748b" />
          </div>

          {loading ? (
            <div className="loading-state">
              <Loader2
                size={31}
                className="spin"
              />

              <div style={{ marginTop: 8 }}>
                Loading notifications...
              </div>
            </div>
          ) : notifications.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <BellOff size={23} />
              </div>

              <strong>
                No notifications found
              </strong>

              <span>
                There are no infrastructure
                notifications matching the
                current filters.
              </span>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map(
                (notification) => (
                  <div
                    key={
                      notification.id
                    }
                    className={`notification ${
                      notification.status ===
                      "unread"
                        ? "unread"
                        : ""
                    }`}
                  >
                    <div className="notification-icon">
                      {getTypeIcon(
                        notification.type
                      )}
                    </div>

                    <div className="notification-main">
                      <div className="notification-top">
                        <div>
                          <div className="notification-title">
                            {
                              notification.title
                            }
                          </div>

                          <div className="notification-message">
                            {
                              notification.message
                            }
                          </div>
                        </div>

                        <div className="notification-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="View details"
                            onClick={() =>
                              setSelected(
                                notification
                              )
                            }
                          >
                            <ExternalLink
                              size={14}
                            />
                          </button>

                          {notification.status ===
                          "unread" ? (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Mark as read"
                              disabled={
                                actionLoading ===
                                `read-${notification.id}`
                              }
                              onClick={() =>
                                markAsRead(
                                  notification
                                )
                              }
                            >
                              {actionLoading ===
                              `read-${notification.id}` ? (
                                <Loader2
                                  size={14}
                                  className="spin"
                                />
                              ) : (
                                <CheckCircle2
                                  size={14}
                                />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Mark as unread"
                              disabled={
                                actionLoading ===
                                `unread-${notification.id}`
                              }
                              onClick={() =>
                                markAsUnread(
                                  notification
                                )
                              }
                            >
                              <Bell
                                size={14}
                              />
                            </button>
                          )}

                          <button
                            type="button"
                            className="icon-btn"
                            title="Delete"
                            disabled={
                              actionLoading ===
                              `delete-${notification.id}`
                            }
                            onClick={() =>
                              deleteNotification(
                                notification
                              )
                            }
                          >
                            {actionLoading ===
                            `delete-${notification.id}` ? (
                              <Loader2
                                size={14}
                                className="spin"
                              />
                            ) : (
                              <XCircle
                                size={14}
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="notification-meta">
                        <span
                          className={`badge ${notification.status}`}
                        >
                          {notification.status ===
                          "unread"
                            ? "Unread"
                            : "Read"}
                        </span>

                        <span
                          className={`badge ${priorityClass(
                            notification.priority
                          )}`}
                        >
                          {typeLabel(
                            notification.priority
                          )}
                        </span>

                        <span>
                          {typeLabel(
                            notification.type
                          )}
                        </span>

                        <span>•</span>

                        <span>
                          {notification.source}
                        </span>

                        <span>•</span>

                        <span
                          title={formatDateTime(
                            notification.createdAt
                          )}
                        >
                          {formatRelativeTime(
                            notification.createdAt
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {!loading &&
            notifications.length > 0 && (
              <div className="pagination">
                <div className="page-info">
                  Page {pagination.page} of{" "}
                  {Math.max(
                    pagination.pages,
                    1
                  )}{" "}
                  • {pagination.total} records
                </div>

                <div className="page-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      pagination.page <=
                      1
                    }
                    onClick={() =>
                      changePage(
                        pagination.page - 1
                      )
                    }
                  >
                    <ChevronLeft
                      size={15}
                    />
                  </button>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      pagination.page >=
                      pagination.pages
                    }
                    onClick={() =>
                      changePage(
                        pagination.page + 1
                      )
                    }
                  >
                    <ChevronRight
                      size={15}
                    />
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      {selected && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelected(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  {selected.title}
                </h2>

                <p>
                  Infrastructure notification
                  details
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setSelected(null)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-message">
                {selected.message ||
                  "No message provided."}
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    STATUS
                  </div>

                  <div className="detail-value">
                    {typeLabel(
                      selected.status
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    PRIORITY
                  </div>

                  <div className="detail-value">
                    {typeLabel(
                      selected.priority
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    TYPE
                  </div>

                  <div className="detail-value">
                    {typeLabel(
                      selected.type
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    SOURCE
                  </div>

                  <div className="detail-value">
                    {selected.source ||
                      "Infrastructure"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CREATED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selected.createdAt
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    UPDATED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selected.updatedAt
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    RELATED ID
                  </div>

                  <div className="detail-value">
                    {selected.relatedId ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    RELATED TYPE
                  </div>

                  <div className="detail-value">
                    {selected.relatedType ||
                      "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              {selected.status ===
              "unread" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    markAsRead(selected)
                  }
                >
                  <Check size={14} />
                  Mark as Read
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    markAsUnread(selected)
                  }
                >
                  <Bell size={14} />
                  Mark as Unread
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setSelected(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}