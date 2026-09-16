import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

const API_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const PAGE_SIZE = 10;

const EMPTY_FILTERS = {
  status: "",
  type: "",
  priority: "",
};

const TYPES = [
  "Purchase Request",
  "Purchase Order",
  "Invoice",
  "Payment",
  "Budget",
  "Asset Valuation",
  "Depreciation",
  "Disposal",
  "System",
];

const PRIORITIES = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function headers(extra = {}) {
  const token = getToken();

  return {
    Accept: "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: headers(options.headers || {}),
  });

  const contentType =
    response.headers.get("content-type") || "";

  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object"
        ? payload.message || payload.error
        : payload;

    throw new Error(
      message ||
        `Request failed with HTTP ${response.status}`
    );
  }

  return payload;
}

function extractArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.data,
    payload.notifications,
    payload.records,
    payload.items,
    payload.rows,
    payload.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function textValue(...values) {
  const value = firstValue(...values);

  return value === undefined || value === null
    ? ""
    : String(value);
}

function normalizeNotification(item) {
  return {
    id: firstValue(
      item.id,
      item.notification_id,
      item.notificationId
    ),

    title: textValue(
      item.title,
      item.subject,
      item.notification_title,
      item.notificationTitle
    ),

    message: textValue(
      item.message,
      item.body,
      item.description,
      item.content
    ),

    type: textValue(
      item.type,
      item.notification_type,
      item.notificationType,
      "System"
    ),

    priority: textValue(
      item.priority,
      "Normal"
    ),

    status: textValue(
      item.status,
      item.read
        ? "Read"
        : "Unread"
    ),

    isRead:
      item.is_read === true ||
      item.isRead === true ||
      item.read === true ||
      String(item.status || "").toLowerCase() ===
        "read",

    createdAt: firstValue(
      item.created_at,
      item.createdAt,
      item.date,
      item.timestamp
    ),

    readAt: firstValue(
      item.read_at,
      item.readAt
    ),

    referenceId: firstValue(
      item.reference_id,
      item.referenceId,
      item.entity_id,
      item.entityId
    ),

    referenceType: textValue(
      item.reference_type,
      item.referenceType,
      item.entity_type,
      item.entityType
    ),

    actionUrl: textValue(
      item.action_url,
      item.actionUrl,
      item.link,
      item.url
    ),
  };
}

function normalizeStats(payload, notifications) {
  const root =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  const summary =
    root.summary &&
    typeof root.summary === "object"
      ? root.summary
      : {};

  const unreadCalculated =
    notifications.filter(
      (item) => !item.isRead
    ).length;

  const readCalculated =
    notifications.filter(
      (item) => item.isRead
    ).length;

  return {
    total:
      Number(
        firstValue(
          summary.total,
          summary.totalNotifications,
          summary.total_notifications
        )
      ) || notifications.length,

    unread:
      Number(
        firstValue(
          summary.unread,
          summary.unreadNotifications,
          summary.unread_notifications
        )
      ) || unreadCalculated,

    read:
      Number(
        firstValue(
          summary.read,
          summary.readNotifications,
          summary.read_notifications
        )
      ) || readCalculated,

    critical:
      Number(
        firstValue(
          summary.critical,
          summary.criticalNotifications,
          summary.critical_notifications
        )
      ) ||
      notifications.filter(
        (item) =>
          item.priority.toLowerCase() ===
          "critical"
      ).length,
  };
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function timeAgo(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const seconds = Math.floor(
    (Date.now() - date.getTime()) / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 30) {
    return `${days}d ago`;
  }

  return formatDate(value);
}

function priorityClass(priority) {
  const value =
    String(priority || "").toLowerCase();

  if (value === "critical") {
    return "priority-critical";
  }

  if (value === "high") {
    return "priority-high";
  }

  if (value === "low") {
    return "priority-low";
  }

  return "priority-normal";
}

function typeIcon(type) {
  const value =
    String(type || "").toLowerCase();

  if (
    value.includes("payment") ||
    value.includes("invoice") ||
    value.includes("budget")
  ) {
    return <DollarSign size={18} />;
  }

  if (
    value.includes("purchase") ||
    value.includes("order")
  ) {
    return <FileText size={18} />;
  }

  if (value.includes("system")) {
    return <Bell size={18} />;
  }

  return <Bell size={18} />;
}

export default function FinanceNotifications() {
  const [notifications, setNotifications] =
    useState([]);

  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    read: 0,
    critical: 0,
  });

  const [filters, setFilters] =
    useState(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [selectedNotification, setSelectedNotification] =
    useState(null);

  const loadNotifications = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams();

        if (filters.status) {
          params.set(
            "status",
            filters.status
          );
        }

        if (filters.type) {
          params.set(
            "type",
            filters.type
          );
        }

        if (filters.priority) {
          params.set(
            "priority",
            filters.priority
          );
        }

        const query =
          params.toString();

        const payload =
          await request(
            `/finance/notifications${
              query ? `?${query}` : ""
            }`
          );

        const rows = extractArray(
          payload
        ).map(
          normalizeNotification
        );

        setNotifications(rows);

        setStats(
          normalizeStats(
            payload,
            rows
          )
        );

        setPage(1);
      } catch (err) {
        setNotifications([]);

        setStats({
          total: 0,
          unread: 0,
          read: 0,
          critical: 0,
        });

        setError(
          err.message ||
            "Unable to load Finance notifications."
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return notifications;
      }

      return notifications.filter(
        (notification) =>
          [
            notification.title,
            notification.message,
            notification.type,
            notification.priority,
            notification.status,
            notification.referenceType,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [notifications, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredNotifications.length /
        PAGE_SIZE
    )
  );

  const paginatedNotifications =
    useMemo(() => {
      const start =
        (page - 1) * PAGE_SIZE;

      return filteredNotifications.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredNotifications,
      page,
    ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleFilterChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));

    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  };

  const markAsRead = async (
    notification
  ) => {
    if (!notification.id) {
      return;
    }

    try {
      await request(
        `/finance/notifications/${notification.id}/read`,
        {
          method: "PATCH",
        }
      );

      setNotifications(
        (current) =>
          current.map((item) =>
            item.id ===
            notification.id
              ? {
                  ...item,
                  isRead: true,
                  status: "Read",
                }
              : item
          )
      );

      setStats((current) => ({
        ...current,
        unread: Math.max(
          0,
          current.unread - 1
        ),
        read: current.read + 1,
      }));
    } catch (err) {
      setError(
        err.message ||
          "Unable to mark notification as read."
      );
    }
  };

  const markAsUnread = async (
    notification
  ) => {
    if (!notification.id) {
      return;
    }

    try {
      await request(
        `/finance/notifications/${notification.id}/unread`,
        {
          method: "PATCH",
        }
      );

      setNotifications(
        (current) =>
          current.map((item) =>
            item.id ===
            notification.id
              ? {
                  ...item,
                  isRead: false,
                  status: "Unread",
                }
              : item
          )
      );

      setStats((current) => ({
        ...current,
        unread: current.unread + 1,
        read: Math.max(
          0,
          current.read - 1
        ),
      }));
    } catch (err) {
      setError(
        err.message ||
          "Unable to mark notification as unread."
      );
    }
  };

  const markAllAsRead = async () => {
    if (!stats.unread) {
      return;
    }

    try {
      await request(
        "/finance/notifications/read-all",
        {
          method: "PATCH",
        }
      );

      setNotifications(
        (current) =>
          current.map((item) => ({
            ...item,
            isRead: true,
            status: "Read",
          }))
      );

      setStats((current) => ({
        ...current,
        read: current.read + current.unread,
        unread: 0,
      }));
    } catch (err) {
      setError(
        err.message ||
          "Unable to mark all notifications as read."
      );
    }
  };

  const deleteNotification = async (
    notification
  ) => {
    if (!notification.id) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this notification?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `/finance/notifications/${notification.id}`,
        {
          method: "DELETE",
        }
      );

      setNotifications(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              notification.id
          )
      );

      setStats((current) => ({
        ...current,
        total: Math.max(
          0,
          current.total - 1
        ),
        unread:
          notification.isRead
            ? current.unread
            : Math.max(
                0,
                current.unread - 1
              ),
        read:
          notification.isRead
            ? Math.max(
                0,
                current.read - 1
              )
            : current.read,
        critical:
          notification.priority.toLowerCase() ===
          "critical"
            ? Math.max(
                0,
                current.critical - 1
              )
            : current.critical,
      }));

      if (
        selectedNotification?.id ===
        notification.id
      ) {
        setSelectedNotification(null);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete notification."
      );
    }
  };

  const openNotification = async (
    notification
  ) => {
    setSelectedNotification(
      notification
    );

    if (!notification.isRead) {
      await markAsRead(
        notification
      );
    }
  };

  return (
    <div className="finance-notifications-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .finance-notifications-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .notifications-container {
          max-width: 1500px;
          margin: 0 auto;
          padding: 28px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .breadcrumb a {
          color: #0284c7;
          text-decoration: none;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .title-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0f2fe;
          color: #0284c7;
        }

        h1 {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 760;
          letter-spacing: -0.02em;
        }

        .subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        button,
        input,
        select {
          font: inherit;
        }

        .btn {
          min-height: 40px;
          padding: 0 13px;
          border: 1px solid #dbe3ee;
          border-radius: 9px;
          background: #fff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          transition: 0.18s ease;
        }

        .btn:hover {
          border-color: #94a3b8;
          transform: translateY(-1px);
        }

        .btn-primary {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0284c7;
          border-color: #0284c7;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 15px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 13px;
        }

        .alert-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .stat-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f0f9ff;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-value {
          margin-top: 11px;
          font-size: 24px;
          font-weight: 780;
        }

        .stat-note {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
        }

        .filter-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 13px;
          font-size: 14px;
          font-weight: 750;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .field select {
          width: 100%;
          height: 40px;
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          padding: 0 11px;
          background: #fff;
          color: #0f172a;
          outline: none;
        }

        .field select:focus,
        .search-box input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
        }

        .filter-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 13px;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 300px;
          max-width: 520px;
        }

        .search-box svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-box input {
          width: 100%;
          height: 40px;
          border: 1px solid #dbe3ee;
          border-radius: 9px;
          padding: 0 38px;
          background: #fff;
          outline: none;
        }

        .notification-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
        }

        .notification-row {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-bottom: 1px solid #eef2f7;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .notification-row:last-child {
          border-bottom: 0;
        }

        .notification-row:hover {
          background: #f8fafc;
        }

        .notification-row.unread {
          background: #f0f9ff;
        }

        .notification-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .notification-content {
          min-width: 0;
        }

        .notification-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .notification-title {
          color: #0f172a;
          font-size: 14px;
          font-weight: 750;
        }

        .notification-message {
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 7px;
          color: #94a3b8;
          font-size: 11px;
        }

        .priority {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 750;
        }

        .priority-critical {
          background: #fee2e2;
          color: #991b1b;
        }

        .priority-high {
          background: #ffedd5;
          color: #9a3412;
        }

        .priority-normal {
          background: #e0f2fe;
          color: #075985;
        }

        .priority-low {
          background: #f1f5f9;
          color: #475569;
        }

        .unread-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #0ea5e9;
          flex-shrink: 0;
        }

        .notification-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          background: #fff;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          color: #0284c7;
          border-color: #7dd3fc;
          background: #f0f9ff;
        }

        .icon-btn.delete:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .loading-state,
        .empty-state {
          padding: 65px 20px;
          text-align: center;
          color: #64748b;
        }

        .state-icon {
          width: 54px;
          height: 54px;
          border-radius: 15px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .loading-state strong,
        .empty-state strong {
          display: block;
          margin-bottom: 5px;
          color: #334155;
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 12px;
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .page-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          background: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(15, 23, 42, 0.5);
        }

        .modal {
          width: min(650px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-title {
          font-size: 17px;
          font-weight: 760;
        }

        .close-btn {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-message {
          padding: 15px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #334155;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .detail {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
        }

        .detail-label {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 750;
          letter-spacing: 0.04em;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 650;
          overflow-wrap: anywhere;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .notifications-container {
            padding: 17px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .search-box {
            min-width: 100%;
            max-width: none;
          }

          .notification-row {
            grid-template-columns: 42px minmax(0, 1fr);
          }

          .notification-actions {
            grid-column: 2;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination-buttons {
            justify-content: flex-end;
          }
        }
      `}</style>

      <main className="notifications-container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to="/finance">
                Finance
              </Link>
              <span>/</span>
              <span>Notifications</span>
            </div>

            <div className="title-row">
              <div className="title-icon">
                <Bell size={25} />
              </div>

              <div>
                <h1>
                  Finance Notifications
                </h1>

                <p className="subtitle">
                  Monitor financial events,
                  approvals, payments, budgets
                  and system alerts.
                </p>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn"
              onClick={loadNotifications}
              disabled={loading}
            >
              <RefreshCw
                size={16}
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
              disabled={!stats.unread}
            >
              <CheckCheck size={16} />
              Mark All Read
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={17} />
            <span>{error}</span>

            <button
              type="button"
              className="close-btn"
              style={{
                marginLeft: "auto",
                background: "transparent",
              }}
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Total Notifications
              </span>

              <span className="stat-icon">
                <Bell size={18} />
              </span>
            </div>

            <div className="stat-value">
              {stats.total}
            </div>

            <div className="stat-note">
              Finance notifications
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Unread
              </span>

              <span className="stat-icon">
                <BellOff size={18} />
              </span>
            </div>

            <div className="stat-value">
              {stats.unread}
            </div>

            <div className="stat-note">
              Require your attention
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Read
              </span>

              <span className="stat-icon">
                <CheckCheck size={18} />
              </span>
            </div>

            <div className="stat-value">
              {stats.read}
            </div>

            <div className="stat-note">
              Already reviewed
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Critical
              </span>

              <span className="stat-icon">
                <AlertCircle size={18} />
              </span>
            </div>

            <div className="stat-value">
              {stats.critical}
            </div>

            <div className="stat-note">
              High-priority financial alerts
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-title">
            <Filter size={17} />
            Notification Filters
          </div>

          <div className="filter-grid">
            <div className="field">
              <label>
                Status
              </label>

              <select
                name="status"
                value={filters.status}
                onChange={
                  handleFilterChange
                }
              >
                <option value="">
                  All Statuses
                </option>

                <option value="Unread">
                  Unread
                </option>

                <option value="Read">
                  Read
                </option>
              </select>
            </div>

            <div className="field">
              <label>
                Type
              </label>

              <select
                name="type"
                value={filters.type}
                onChange={
                  handleFilterChange
                }
              >
                <option value="">
                  All Types
                </option>

                {TYPES.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>
                Priority
              </label>

              <select
                name="priority"
                value={
                  filters.priority
                }
                onChange={
                  handleFilterChange
                }
              >
                <option value="">
                  All Priorities
                </option>

                {PRIORITIES.map(
                  (priority) => (
                    <option
                      key={priority}
                      value={priority}
                    >
                      {priority}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="filter-actions">
            <button
              type="button"
              className="btn"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        </section>

        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search notifications..."
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );
                setPage(1);
              }}
            />
          </div>
        </div>

        <section className="notification-card">
          {loading ? (
            <div className="loading-state">
              <div className="state-icon">
                <Loader2
                  size={25}
                  className="spin"
                />
              </div>

              <strong>
                Loading notifications...
              </strong>

              <span>
                Retrieving Finance notifications
                from the backend.
              </span>
            </div>
          ) : filteredNotifications.length ===
            0 ? (
            <div className="empty-state">
              <div className="state-icon">
                <BellOff size={25} />
              </div>

              <strong>
                No notifications found
              </strong>

              <span>
                There are no notifications matching
                the current search and filters.
              </span>
            </div>
          ) : (
            <>
              {paginatedNotifications.map(
                (notification) => (
                  <div
                    key={notification.id}
                    className={`notification-row ${
                      notification.isRead
                        ? ""
                        : "unread"
                    }`}
                    onClick={() =>
                      openNotification(
                        notification
                      )
                    }
                  >
                    <div className="notification-icon">
                      {typeIcon(
                        notification.type
                      )}
                    </div>

                    <div className="notification-content">
                      <div className="notification-title-row">
                        {!notification.isRead && (
                          <span className="unread-dot" />
                        )}

                        <span className="notification-title">
                          {notification.title ||
                            "Finance Notification"}
                        </span>

                        <span
                          className={`priority ${priorityClass(
                            notification.priority
                          )}`}
                        >
                          {notification.priority ||
                            "Normal"}
                        </span>
                      </div>

                      <div className="notification-message">
                        {notification.message ||
                          "No notification message provided."}
                      </div>

                      <div className="notification-meta">
                        <span>
                          {notification.type ||
                            "System"}
                        </span>

                        <span>•</span>

                        <span>
                          {timeAgo(
                            notification.createdAt
                          )}
                        </span>

                        {notification.referenceType && (
                          <>
                            <span>•</span>
                            <span>
                              {
                                notification.referenceType
                              }
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className="notification-actions"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <button
                        type="button"
                        className="icon-btn"
                        title={
                          notification.isRead
                            ? "Mark unread"
                            : "Mark read"
                        }
                        onClick={() =>
                          notification.isRead
                            ? markAsUnread(
                                notification
                              )
                            : markAsRead(
                                notification
                              )
                        }
                      >
                        {notification.isRead ? (
                          <BellOff
                            size={16}
                          />
                        ) : (
                          <Check
                            size={16}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        className="icon-btn delete"
                        title="Delete notification"
                        onClick={() =>
                          deleteNotification(
                            notification
                          )
                        }
                      >
                        <Trash2
                          size={16}
                        />
                      </button>
                    </div>
                  </div>
                )
              )}

              <div className="pagination">
                <span>
                  Showing{" "}
                  {(page - 1) *
                    PAGE_SIZE +
                    1}{" "}
                  to{" "}
                  {Math.min(
                    page * PAGE_SIZE,
                    filteredNotifications.length
                  )}{" "}
                  of{" "}
                  {filteredNotifications.length}{" "}
                  notifications
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                  >
                    <ChevronLeft
                      size={17}
                    />
                  </button>

                  <span
                    style={{
                      minWidth: 75,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid #dbe3ee",
                      borderRadius: 8,
                      background: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {page} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      page >= totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1
                          )
                      )
                    }
                  >
                    <ChevronRight
                      size={17}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {selectedNotification && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedNotification(
                null
              );
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  {selectedNotification.title ||
                    "Notification Details"}
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontSize: 11,
                    marginTop: 3,
                  }}
                >
                  {formatDate(
                    selectedNotification.createdAt
                  )}
                </div>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setSelectedNotification(
                    null
                  )
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail">
                  <div className="detail-label">
                    Type
                  </div>

                  <div className="detail-value">
                    {selectedNotification.type ||
                      "System"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Priority
                  </div>

                  <div className="detail-value">
                    <span
                      className={`priority ${priorityClass(
                        selectedNotification.priority
                      )}`}
                    >
                      {selectedNotification.priority ||
                        "Normal"}
                    </span>
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    {selectedNotification.isRead
                      ? "Read"
                      : "Unread"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Created
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      selectedNotification.createdAt
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-message">
                {selectedNotification.message ||
                  "No notification message provided."}
              </div>

              {selectedNotification.referenceId && (
                <div
                  className="detail"
                  style={{
                    marginTop: 14,
                  }}
                >
                  <div className="detail-label">
                    Reference
                  </div>

                  <div className="detail-value">
                    {selectedNotification.referenceType
                      ? `${selectedNotification.referenceType} #`
                      : ""}
                    {selectedNotification.referenceId}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSelectedNotification(
                    null
                  )
                }
              >
                Close
              </button>

              {!selectedNotification.isRead && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    markAsRead(
                      selectedNotification
                    )
                  }
                >
                  <Check size={15} />
                  Mark as Read
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}