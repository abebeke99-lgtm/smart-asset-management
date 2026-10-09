import React, { useEffect, useMemo, useState } from "react";
import "./ICTDashboard.css";
import { useTranslation } from "../../contexts/UiContext";
import {
  Activity,
  AlertTriangle,
  Bell,
  Box,
  CheckCircle2,
  Clock3,
  Laptop,
  Loader2,
  Network,
  Package,
  RefreshCw,
  Server,
  ShieldAlert,
  Ticket,
  Wrench,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| ICT Officer Dashboard
|--------------------------------------------------------------------------
| Route:
|   /ict/dashboard
|
| API:
|   GET /api/ict/dashboard
|
| Main permission:
|   ict.dashboard.view
|
| Documentation:
|   - Total ICT Assets
|   - Active Assets
|   - Damaged Assets
|   - Under Maintenance
|   - Available Assets
|   - Assigned Assets
|   - Open Support Tickets
|   - Critical Incidents
|   - Asset status chart
|   - Category chart
|   - Maintenance chart
|   - Support ticket chart
|   - Notifications
|   - Critical incidents
|   - Inventory alerts
|   - Recent activity
|--------------------------------------------------------------------------
*/

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const DASHBOARD_ENDPOINT = `${API_BASE_URL}/ict/dashboard`;

const DEFAULT_DASHBOARD = {
  kpis: {
    totalAssets: 0,
    activeAssets: 0,
    damagedAssets: 0,
    underMaintenance: 0,
    availableAssets: 0,
    assignedAssets: 0,
    openSupportTickets: 0,
    criticalIncidents: 0,
  },

  assetStatus: {
    available: 0,
    assigned: 0,
    under_maintenance: 0,
    retired: 0,
  },

  condition: {
    functional: 0,
    damaged: 0,
    missing: 0,
    expired: 0,
    replaced: 0,
  },

  categories: [],

  maintenance: {
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
  },

  supportTickets: {
    submitted: 0,
    assigned: 0,
    scheduled: 0,
    in_progress: 0,
    waiting: 0,
    completed: 0,
    escalated: 0,
  },

  notifications: [],

  criticalIncidents: [],

  inventoryAlerts: [],

  recentActivity: [],
};

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClass(status) {
  const normalized = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "_");

  switch (normalized) {
    case "available":
    case "completed":
    case "functional":
    case "resolved":
      return "status-success";

    case "assigned":
    case "scheduled":
    case "in_progress":
    case "under_maintenance":
      return "status-info";

    case "damaged":
    case "needs_repair":
    case "waiting":
    case "warning":
      return "status-warning";

    case "critical":
    case "escalated":
    case "missing":
      return "status-danger";

    case "retired":
    case "disposed":
    case "expired":
      return "status-neutral";

    default:
      return "status-neutral";
  }
}

function StatusBadge({ status, label }) {
  return (
    <span className={`status-badge ${getStatusClass(status)}`}>
      {label || status}
    </span>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  iconClass = "",
}) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${iconClass}`}>
        <Icon size={22} strokeWidth={2} />
      </div>

      <div className="kpi-content">
        <p className="kpi-title">{title}</p>
        <h3>{formatNumber(value)}</h3>

        {description && (
          <span className="kpi-description">{description}</span>
        )}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total, status }) {
  const percentage =
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="progress-row">
      <div className="progress-header">
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
      </div>

      <div className="progress-track">
        <div
          className={`progress-bar ${getStatusClass(status)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {action}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <Package size={34} />
      <p>{message}</p>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboard = async ({ initial = false } = {}) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken");

      const response = await fetch(DASHBOARD_ENDPOINT, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      });

      if (response.status === 401) {
        const error = new Error("Your session has expired. Please log in again.");
        error.translationKey = "dashboard.ictHome.errors.sessionExpired";
        throw error;
      }

      if (response.status === 403) {
        const error = new Error("You do not have permission to access the ICT dashboard.");
        error.translationKey = "dashboard.ictHome.errors.forbidden";
        throw error;
      }

      if (!response.ok) {
        const error = new Error("Unable to load ICT dashboard.");
        error.translationKey = "dashboard.ictHome.errors.loadFailed";
        throw error;
      }

      const result = await response.json();

      /*
       * Supports either:
       * {
       *   data: {...}
       * }
       *
       * or:
       * {
       *   ...dashboard
       * }
       */
      const data = result?.data || result || {};

      setDashboard({
        ...DEFAULT_DASHBOARD,
        ...data,
        kpis: {
          ...DEFAULT_DASHBOARD.kpis,
          ...(data.kpis || {}),
        },
        assetStatus: {
          ...DEFAULT_DASHBOARD.assetStatus,
          ...(data.assetStatus || {}),
        },
        condition: {
          ...DEFAULT_DASHBOARD.condition,
          ...(data.condition || {}),
        },
        maintenance: {
          ...DEFAULT_DASHBOARD.maintenance,
          ...(data.maintenance || {}),
        },
        supportTickets: {
          ...DEFAULT_DASHBOARD.supportTickets,
          ...(data.supportTickets || {}),
        },
      });
    } catch (err) {
      console.error("ICT dashboard error:", err);

      setError(
        err?.translationKey
          ? { key: err.translationKey, fallback: err.message }
          : err?.message
            ? { message: err.message }
            : {
                key: "dashboard.ictHome.errors.assetsFailed",
                fallback: "Unable to load ICT assets. Please try again.",
              }
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard({ initial: true });
  }, []);

  const totalCategories = useMemo(() => {
    return dashboard.categories.reduce(
      (sum, item) => sum + Number(item.total || item.count || 0),
      0
    );
  }, [dashboard.categories]);

  const totalMaintenance = useMemo(() => {
    return Object.values(dashboard.maintenance).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );
  }, [dashboard.maintenance]);

  const totalTickets = useMemo(() => {
    return Object.values(dashboard.supportTickets).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );
  }, [dashboard.supportTickets]);

  if (loading) {
    return (
      <div className="dashboard-page ict-module-theme ict-theme-dashboard">
        <div className="dashboard-loading">
          <Loader2 className="spin" size={38} />
          <p>{t("dashboard.ictHome.loading", "Loading ICT assets...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page ict-module-theme ict-theme-dashboard">
      {/* ---------------------------------------------------------------- */}
      {/* Page Header                                                      */}
      {/* ---------------------------------------------------------------- */}

      <div className="page-header ict-page-header">
        <div>
          <div className="breadcrumb">
            <span>{t("dashboard.ictHome.breadcrumb.ictOfficer", "ICT Officer")}</span>
            <span>/</span>
            <strong>{t("dashboard.ictHome.breadcrumb.dashboard", "Dashboard")}</strong>
          </div>

          <h1 className="ict-page-title">{t("dashboard.ictHome.pageTitle", "ICT Dashboard")}</h1>

          <p>
            {t(
              "dashboard.ictHome.description",
              "Mekdela Amba University ICT asset management, technical operations, maintenance and support."
            )}
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={() => fetchDashboard()}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "spin" : ""}
          />

          {refreshing
            ? t("dashboard.ictHome.controls.refreshing", "Refreshing...")
            : t("dashboard.ictHome.controls.refresh", "Refresh")}
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Error                                                            */}
      {/* ---------------------------------------------------------------- */}

      {error && (
        <div className="dashboard-error">
          <AlertTriangle size={20} />

          <div>
            <strong>{t("dashboard.ictHome.errors.title", "Dashboard Error")}</strong>
            <p>{error.key ? t(error.key, error.fallback) : error.message}</p>
          </div>

          <button
            type="button"
            onClick={() => fetchDashboard({ initial: true })}
          >
            {t("dashboard.ictHome.controls.tryAgain", "Try Again")}
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* KPI Cards                                                        */}
      {/* ---------------------------------------------------------------- */}

      <section className="kpi-grid">
        <KpiCard
          title={t("dashboard.ictHome.kpis.totalAssets", "Total ICT Assets")}
          value={dashboard.kpis.totalAssets}
          icon={Box}
          description={t("dashboard.ictHome.kpiDescriptions.totalAssets", "All registered ICT assets")}
          iconClass="blue"
        />

        <KpiCard
          title={t("dashboard.ictHome.kpis.activeAssets", "Active Assets")}
          value={dashboard.kpis.activeAssets}
          icon={CheckCircle2}
          description={t("dashboard.ictHome.kpiDescriptions.activeAssets", "Available or assigned")}
          iconClass="green"
        />

        <KpiCard
          title={t("dashboard.ictHome.kpis.damagedAssets", "Damaged Assets")}
          value={dashboard.kpis.damagedAssets}
          icon={ShieldAlert}
          description={t("dashboard.ictHome.kpiDescriptions.damagedAssets", "Assets requiring attention")}
          iconClass="red"
        />

        <KpiCard
          title={t("dashboard.ictHome.status.underMaintenance", "Under Maintenance")}
          value={dashboard.kpis.underMaintenance}
          icon={Wrench}
          description={t("dashboard.ictHome.kpiDescriptions.underMaintenance", "Currently in maintenance")}
          iconClass="orange"
        />

        <KpiCard
          title={t("dashboard.ictHome.kpis.availableAssets", "Available Assets")}
          value={dashboard.kpis.availableAssets}
          icon={Package}
          description={t("dashboard.ictHome.kpiDescriptions.availableAssets", "Ready for assignment")}
          iconClass="cyan"
        />

        <KpiCard
          title={t("dashboard.ictHome.kpis.assignedAssets", "Assigned Assets")}
          value={dashboard.kpis.assignedAssets}
          icon={Laptop}
          description={t("dashboard.ictHome.kpiDescriptions.assignedAssets", "Currently assigned")}
          iconClass="purple"
        />

        <KpiCard
          title={t("dashboard.ictHome.kpis.openSupportTickets", "Open Support Tickets")}
          value={dashboard.kpis.openSupportTickets}
          icon={Ticket}
          description={t("dashboard.ictHome.kpiDescriptions.openSupportTickets", "Uncompleted tickets")}
          iconClass="yellow"
        />

        <KpiCard
          title={t("dashboard.ictHome.kpis.criticalIncidents", "Critical Incidents")}
          value={dashboard.kpis.criticalIncidents}
          icon={AlertTriangle}
          description={t("dashboard.ictHome.kpiDescriptions.criticalIncidents", "Unresolved high priority")}
          iconClass="danger"
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Main Analytics                                                   */}
      {/* ---------------------------------------------------------------- */}

      <div className="dashboard-grid">
        {/* Asset Status */}
        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.assetStatus", "Asset Status")}
            subtitle={t("dashboard.ictHome.subtitles.assetStatus", "Current ICT asset lifecycle status")}
          />

          <div className="chart-content">
            <ProgressRow
              label={t("dashboard.ictHome.status.available", "Available")}
              value={dashboard.assetStatus.available}
              total={dashboard.kpis.totalAssets}
              status="available"
            />

            <ProgressRow
              label={t("dashboard.ictHome.status.assigned", "Assigned")}
              value={dashboard.assetStatus.assigned}
              total={dashboard.kpis.totalAssets}
              status="assigned"
            />

            <ProgressRow
              label={t("dashboard.ictHome.status.underMaintenance", "Under Maintenance")}
              value={dashboard.assetStatus.under_maintenance}
              total={dashboard.kpis.totalAssets}
              status="under_maintenance"
            />

            <ProgressRow
              label={t("dashboard.ictHome.status.retired", "Retired")}
              value={dashboard.assetStatus.retired}
              total={dashboard.kpis.totalAssets}
              status="retired"
            />
          </div>
        </section>

        {/* Condition */}
        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.assetCondition", "Asset Condition")}
            subtitle={t("dashboard.ictHome.subtitles.assetCondition", "Physical condition of ICT assets")}
          />

          <div className="condition-grid">
            {Object.entries(dashboard.condition).map(
              ([key, value]) => (
                <div className="condition-item" key={key}>
                  <div className="condition-value">
                    {formatNumber(value)}
                  </div>

                  <StatusBadge
                    status={key}
                    label={
                      {
                        functional: t("dashboard.ictHome.condition.functional", "Functional"),
                        needs_repair: t("dashboard.ictHome.condition.needsRepair", "Needs Repair"),
                        damaged: t("dashboard.ictHome.condition.damaged", "Damaged"),
                        missing: t("dashboard.ictHome.condition.missing", "Missing"),
                        expired: t("dashboard.ictHome.condition.expired", "Expired"),
                        replaced: t("dashboard.ictHome.condition.replaced", "Replaced"),
                      }[key] || key
                    }
                  />
                </div>
              )
            )}
          </div>

          <div className="ratio-summary">
            <div>
              <span>{t("dashboard.ictHome.condition.functionalRatio", "Functional Ratio")}</span>

              <strong>
                {dashboard.kpis.totalAssets > 0
                  ? `${Math.round(
                      (Number(dashboard.condition.functional || 0) /
                        dashboard.kpis.totalAssets) *
                        100
                    )}%`
                  : "0%"}
              </strong>
            </div>

            <div>
              <span>{t("dashboard.ictHome.condition.damagedRatio", "Damaged Ratio")}</span>

              <strong>
                {dashboard.kpis.totalAssets > 0
                  ? `${Math.round(
                      (Number(dashboard.condition.damaged || 0) /
                        dashboard.kpis.totalAssets) *
                        100
                    )}%`
                  : "0%"}
              </strong>
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Category + Maintenance                                           */}
      {/* ---------------------------------------------------------------- */}

      <div className="dashboard-grid">
        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.assetsByCategory", "ICT Assets by Category")}
            subtitle={t("dashboard.ictHome.subtitles.assetsByCategory", "Distribution of registered ICT equipment")}
          />

          {dashboard.categories.length === 0 ? (
            <EmptyState message={t("dashboard.ictHome.empty.assetCategories", "No ICT asset categories found.")} />
          ) : (
            <div className="category-list">
              {dashboard.categories.map((category, index) => {
                const value = Number(
                  category.total || category.count || 0
                );

                const percentage =
                  totalCategories > 0
                    ? Math.round((value / totalCategories) * 100)
                    : 0;

                return (
                  <div
                    className="category-row"
                    key={
                      category.id ||
                      category.name ||
                      `category-${index}`
                    }
                  >
                    <div className="category-icon">
                      {category.type === "network" ? (
                        <Network size={18} />
                      ) : category.type === "server" ? (
                        <Server size={18} />
                      ) : (
                        <Laptop size={18} />
                      )}
                    </div>

                    <div className="category-info">
                      <div className="category-header">
                        <span>
                          {category.name || t("dashboard.ictHome.fallbacks.unknownCategory", "Unknown Category")}
                        </span>

                        <strong>{formatNumber(value)}</strong>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-bar status-info"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.maintenance", "Maintenance")}
            subtitle={t("dashboard.ictHome.subtitles.maintenance", "Maintenance activity and status")}
          />

          <div className="maintenance-summary">
            <div className="maintenance-total">
              <span>{t("dashboard.ictHome.maintenance.totalRecords", "Total Records")}</span>
              <strong>{formatNumber(totalMaintenance)}</strong>
            </div>

            <ProgressRow
              label={t("dashboard.ictHome.maintenance.scheduled", "Scheduled")}
              value={dashboard.maintenance.scheduled}
              total={totalMaintenance}
              status="scheduled"
            />

            <ProgressRow
              label={t("dashboard.ictHome.maintenance.inProgress", "In Progress")}
              value={dashboard.maintenance.in_progress}
              total={totalMaintenance}
              status="in_progress"
            />

            <ProgressRow
              label={t("dashboard.ictHome.maintenance.completed", "Completed")}
              value={dashboard.maintenance.completed}
              total={totalMaintenance}
              status="completed"
            />

            <ProgressRow
              label={t("dashboard.ictHome.maintenance.overdue", "Overdue")}
              value={dashboard.maintenance.overdue}
              total={totalMaintenance}
              status="critical"
            />
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Support Tickets                                                  */}
      {/* ---------------------------------------------------------------- */}

      <section className="dashboard-card full-width">
        <SectionHeader
          title={t("dashboard.ictHome.sections.supportTickets", "Support Tickets")}
          subtitle={t("dashboard.ictHome.subtitles.supportTickets", "Technical support workflow status")}
        />

        <div className="ticket-grid">
          {Object.entries(dashboard.supportTickets).map(
            ([status, value]) => (
              <div className="ticket-stat" key={status}>
                <div className="ticket-stat-icon">
                  <Ticket size={18} />
                </div>

                <div>
                  <span>
                    {status
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (char) =>
                        char.toUpperCase()
                      )}
                  </span>

                  <strong>{formatNumber(value)}</strong>
                </div>
              </div>
            )
          )}
        </div>

        <div className="ticket-total">
          <Clock3 size={17} />
          <span>{t("dashboard.ictHome.tickets.totalRecords", "Total ticket records:")}</span>
          <strong>{formatNumber(totalTickets)}</strong>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Bottom Panels                                                    */}
      {/* ---------------------------------------------------------------- */}

      <div className="dashboard-grid three-columns">
        {/* Notifications */}
        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.notifications", "Notifications")}
            subtitle={t("dashboard.ictHome.subtitles.notifications", "Latest operational alerts")}
          />

          {dashboard.notifications.length === 0 ? (
            <EmptyState message={t("dashboard.ictHome.empty.notifications", "No notifications found.")} />
          ) : (
            <div className="notification-list">
              {dashboard.notifications
                .slice(0, 6)
                .map((notification, index) => (
                  <div
                    className="notification-item"
                    key={
                      notification.id ||
                      `notification-${index}`
                    }
                  >
                    <div className="notification-icon">
                      <Bell size={17} />
                    </div>

                    <div className="notification-content">
                      <strong>
                        {notification.title ||
                          t("dashboard.ictHome.fallbacks.notification", "Notification")}
                      </strong>

                      <p>
                        {notification.message ||
                          t("dashboard.ictHome.fallbacks.noNotificationMessage", "No notification message.")}
                      </p>

                      <small>
                        {formatDateTime(
                          notification.date ||
                            notification.createdAt
                        )}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Critical Incidents */}
        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.criticalIncidents", "Critical Incidents")}
            subtitle={t("dashboard.ictHome.subtitles.criticalIncidents", "Unresolved high-priority incidents")}
          />

          {dashboard.criticalIncidents.length === 0 ? (
            <EmptyState message={t("dashboard.ictHome.empty.criticalIncidents", "No critical incidents.")} />
          ) : (
            <div className="incident-list">
              {dashboard.criticalIncidents
                .slice(0, 6)
                .map((incident, index) => (
                  <div
                    className="incident-item"
                    key={
                      incident.id ||
                      incident.incidentId ||
                      `incident-${index}`
                    }
                  >
                    <div className="incident-icon">
                      <AlertTriangle size={17} />
                    </div>

                    <div className="incident-content">
                      <div className="incident-top">
                        <strong>
                          {incident.title ||
                            incident.incidentId ||
                            t("dashboard.ictHome.fallbacks.incident", "Incident")}
                        </strong>

                        <StatusBadge
                          status="critical"
                          label={t("dashboard.ictHome.status.critical", "Critical")}
                        />
                      </div>

                      <p>
                        {incident.description ||
                          incident.problem ||
                          t("dashboard.ictHome.fallbacks.noDescription", "No description available.")}
                      </p>

                      <small>
                        {incident.assetName ||
                          incident.assetId ||
                          t("dashboard.ictHome.fallbacks.noAssetLinked", "No asset linked")}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Inventory Alerts */}
        <section className="dashboard-card">
          <SectionHeader
            title={t("dashboard.ictHome.sections.inventoryAlerts", "Inventory Alerts")}
            subtitle={t("dashboard.ictHome.subtitles.inventoryAlerts", "Items requiring attention")}
          />

          {dashboard.inventoryAlerts.length === 0 ? (
            <EmptyState message={t("dashboard.ictHome.empty.inventoryAlerts", "No inventory alerts.")} />
          ) : (
            <div className="inventory-alert-list">
              {dashboard.inventoryAlerts
                .slice(0, 6)
                .map((alert, index) => (
                  <div
                    className="inventory-alert"
                    key={
                      alert.id ||
                      `inventory-alert-${index}`
                    }
                  >
                    <div className="inventory-alert-icon">
                      <Package size={17} />
                    </div>

                    <div>
                      <strong>
                        {alert.title ||
                          alert.name ||
                          t("dashboard.ictHome.fallbacks.inventoryAlert", "Inventory Alert")}
                      </strong>

                      <p>
                        {alert.message ||
                          alert.description ||
                          t("dashboard.ictHome.fallbacks.inventoryItemAttention", "Inventory item requires attention.")}
                      </p>

                      {alert.quantity !== undefined && (
                        <small>
                          {t("dashboard.ictHome.inventory.quantity", "Quantity:")}{" "}
                          {formatNumber(alert.quantity)}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Recent Activity                                                  */}
      {/* ---------------------------------------------------------------- */}

      <section className="dashboard-card full-width">
        <SectionHeader
          title={t("dashboard.ictHome.sections.recentActivity", "Recent Activity")}
          subtitle={t("dashboard.ictHome.subtitles.recentActivity", "Latest ICT asset and technical operations")}
        />

        {dashboard.recentActivity.length === 0 ? (
          <EmptyState message={t("dashboard.ictHome.empty.recentActivity", "No recent activity found.")} />
        ) : (
          <div className="activity-table-wrapper">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>{t("dashboard.ictHome.activity.dateTime", "Date / Time")}</th>
                  <th>{t("dashboard.ictHome.activity.user", "User")}</th>
                  <th>{t("dashboard.ictHome.activity.action", "Action")}</th>
                  <th>{t("dashboard.ictHome.activity.asset", "Asset")}</th>
                  <th>{t("dashboard.ictHome.activity.location", "Location")}</th>
                  <th>{t("dashboard.ictHome.activity.status", "Status")}</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.recentActivity
                  .slice(0, 10)
                  .map((activity, index) => (
                    <tr
                      key={
                        activity.id ||
                        `activity-${index}`
                      }
                    >
                      <td>
                        {formatDateTime(
                          activity.timestamp ||
                            activity.date ||
                            activity.createdAt
                        )}
                      </td>

                      <td>
                        {activity.userName ||
                          activity.user ||
                          "—"}
                      </td>

                      <td>
                        <div className="activity-action">
                          <Activity size={15} />
                          <span>
                            {activity.action || "—"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="asset-reference">
                          <strong>
                            {activity.assetName ||
                              "—"}
                          </strong>

                          {activity.assetId && (
                            <small>
                              {activity.assetId}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        {activity.location || "—"}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            activity.status ||
                            "unknown"
                          }
                          label={
                            activity.status
                              ?.replace(/_/g, " ")
                              .replace(
                                /\b\w/g,
                                (char) =>
                                  char.toUpperCase()
                              ) || t("dashboard.ictHome.fallbacks.unknownStatus", "Unknown")
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Dashboard Styles                                                 */}
      {/* ---------------------------------------------------------------- */}

      <style>{`
        .dashboard-page {
          min-height: 100%;
          padding: 24px;
          background: #F3F6F9;
          color: #111827;
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
          color: #6B7280;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .breadcrumb strong {
          color: #3074B3;
        }

        .page-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
          color: #111827;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #6B7280;
          font-size: 14px;
        }

        .refresh-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #D1D5DB;
          background: #FFFFFF;
          color: #374151;
          border-radius: 8px;
          padding: 10px 15px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .refresh-button:hover {
          border-color: #3074B3;
          color: #3074B3;
        }

        .refresh-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .dashboard-error {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          padding: 14px 16px;
          border: 1px solid #FECACA;
          border-radius: 10px;
          background: #FEF2F2;
          color: #991B1B;
        }

        .dashboard-error > div {
          flex: 1;
        }

        .dashboard-error strong {
          display: block;
          margin-bottom: 3px;
        }

        .dashboard-error p {
          margin: 0;
          font-size: 13px;
        }

        .dashboard-error button {
          border: 0;
          background: #991B1B;
          color: #FFFFFF;
          border-radius: 7px;
          padding: 8px 12px;
          cursor: pointer;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .kpi-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 18px;
          min-height: 108px;
          box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
        }

        .kpi-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }

        .kpi-icon.blue {
          background: #EAF2FA;
          color: #3074B3;
        }

        .kpi-icon.green {
          background: #DCFCE7;
          color: #16A34A;
        }

        .kpi-icon.red,
        .kpi-icon.danger {
          background: #FEE2E2;
          color: #DC2626;
        }

        .kpi-icon.orange {
          background: #FFEDD5;
          color: #EA580C;
        }

        .kpi-icon.cyan {
          background: #CFFAFE;
          color: #0891B2;
        }

        .kpi-icon.purple {
          background: #EDE9FE;
          color: #7C3AED;
        }

        .kpi-icon.yellow {
          background: #FEF3C7;
          color: #D97706;
        }

        .kpi-content {
          min-width: 0;
        }

        .kpi-title {
          margin: 0 0 5px;
          color: #6B7280;
          font-size: 13px;
        }

        .kpi-content h3 {
          margin: 0;
          color: #111827;
          font-size: 24px;
          line-height: 1.1;
        }

        .kpi-description {
          display: block;
          margin-top: 5px;
          color: #9CA3AF;
          font-size: 11px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .dashboard-grid.three-columns {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .dashboard-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 20px;
          min-width: 0;
          box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
        }

        .full-width {
          margin-bottom: 18px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .section-header h2 {
          margin: 0;
          color: #111827;
          font-size: 17px;
          font-weight: 700;
        }

        .section-header p {
          margin: 5px 0 0;
          color: #9CA3AF;
          font-size: 12px;
        }

        .section-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #3074B3;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .section-link:hover {
          text-decoration: underline;
        }

        .chart-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .progress-row {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          color: #4B5563;
        }

        .progress-header strong {
          color: #111827;
        }

        .progress-track {
          height: 8px;
          width: 100%;
          background: #E2E8F0;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          border-radius: 999px;
          min-width: 2px;
        }

        .progress-bar.status-success {
          background: #16A34A;
        }

        .progress-bar.status-info {
          background: #3074B3;
        }

        .progress-bar.status-warning {
          background: #D97706;
        }

        .progress-bar.status-danger {
          background: #DC2626;
        }

        .progress-bar.status-neutral {
          background: #6B7280;
        }

        .condition-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .condition-item {
          border: 1px solid #E2E8F0;
          border-radius: 9px;
          padding: 13px;
          background: #F5F7FA;
        }

        .condition-value {
          font-size: 21px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-success {
          background: #DCFCE7;
          color: #166534;
        }

        .status-info {
          background: #EAF2FA;
          color: #245783;
        }

        .status-warning {
          background: #FEF3C7;
          color: #92400E;
        }

        .status-danger {
          background: #FEE2E2;
          color: #991B1B;
        }

        .status-neutral {
          background: #F3F4F6;
          color: #4B5563;
        }

        .ratio-summary {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #E2E8F0;
        }

        .ratio-summary div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .ratio-summary span {
          color: #6B7280;
          font-size: 12px;
        }

        .ratio-summary strong {
          color: #111827;
          font-size: 17px;
        }

        .category-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .category-row {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .category-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #EAF2FA;
          color: #3074B3;
          border-radius: 8px;
        }

        .category-info {
          flex: 1;
          min-width: 0;
        }

        .category-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 7px;
          color: #4B5563;
          font-size: 13px;
        }

        .category-header strong {
          color: #111827;
        }

        .maintenance-summary {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .maintenance-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px;
          border-radius: 9px;
          background: #F5F7FA;
          border: 1px solid #E2E8F0;
        }

        .maintenance-total span {
          color: #6B7280;
          font-size: 13px;
        }

        .maintenance-total strong {
          color: #111827;
          font-size: 21px;
        }

        .ticket-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
        }

        .ticket-stat {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px;
          border: 1px solid #E2E8F0;
          border-radius: 9px;
          background: #F5F7FA;
        }

        .ticket-stat-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #EAF2FA;
          color: #3074B3;
        }

        .ticket-stat span {
          display: block;
          color: #6B7280;
          font-size: 10px;
          margin-bottom: 3px;
        }

        .ticket-stat strong {
          color: #111827;
          font-size: 17px;
        }

        .ticket-total {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #E2E8F0;
          color: #6B7280;
          font-size: 12px;
        }

        .ticket-total strong {
          color: #111827;
        }

        .notification-list,
        .incident-list,
        .inventory-alert-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .notification-item,
        .incident-item,
        .inventory-alert {
          display: flex;
          gap: 10px;
          padding-bottom: 12px;
          border-bottom: 1px solid #F3F4F6;
        }

        .notification-item:last-child,
        .incident-item:last-child,
        .inventory-alert:last-child {
          padding-bottom: 0;
          border-bottom: 0;
        }

        .notification-icon,
        .incident-icon,
        .inventory-alert-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #EAF2FA;
          color: #3074B3;
        }

        .incident-icon {
          background: #FEF2F2;
          color: #DC2626;
        }

        .inventory-alert-icon {
          background: #FFFBEB;
          color: #D97706;
        }

        .notification-content,
        .incident-content,
        .inventory-alert > div:last-child {
          min-width: 0;
          flex: 1;
        }

        .notification-content strong,
        .incident-content strong,
        .inventory-alert strong {
          display: block;
          color: #111827;
          font-size: 12px;
        }

        .notification-content p,
        .incident-content p,
        .inventory-alert p {
          margin: 4px 0;
          color: #6B7280;
          font-size: 11px;
          line-height: 1.45;
        }

        .notification-content small,
        .incident-content small,
        .inventory-alert small {
          color: #9CA3AF;
          font-size: 10px;
        }

        .incident-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .empty-state {
          min-height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #9CA3AF;
          text-align: center;
        }

        .empty-state p {
          margin: 0;
          font-size: 12px;
        }

        .activity-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .activity-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 800px;
        }

        .activity-table th {
          padding: 11px 12px;
          text-align: left;
          color: #6B7280;
          background: #F5F7FA;
          border-bottom: 1px solid #E2E8F0;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .activity-table td {
          padding: 12px;
          border-bottom: 1px solid #F3F4F6;
          color: #4B5563;
          font-size: 12px;
          vertical-align: middle;
        }

        .activity-table tbody tr:hover {
          background: #F5F7FA;
        }

        .activity-action {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #374151;
        }

        .asset-reference strong {
          display: block;
          color: #111827;
          font-size: 12px;
        }

        .asset-reference small {
          display: block;
          margin-top: 3px;
          color: #9CA3AF;
          font-size: 10px;
        }

        .dashboard-loading {
          min-height: 60vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #6B7280;
        }

        .dashboard-loading p {
          margin: 0;
          font-size: 14px;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1200px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-grid.three-columns {
            grid-template-columns: 1fr;
          }

          .ticket-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .condition-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ticket-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .dashboard-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .page-header h1 {
            font-size: 23px;
          }

          .refresh-button {
            width: 100%;
            justify-content: center;
          }

          .kpi-grid {
            grid-template-columns: 1fr;
          }

          .condition-grid {
            grid-template-columns: 1fr;
          }

          .ratio-summary {
            grid-template-columns: 1fr;
          }

          .ticket-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-card {
            padding: 15px;
          }
        }
      `}</style>
    </div>
  );
}