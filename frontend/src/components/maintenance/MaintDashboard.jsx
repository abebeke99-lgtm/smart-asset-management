import React, { useEffect, useMemo, useState } from "react";
import { getMaintenanceDashboard } from "../../services/maintenanceApi";
import { useTranslation } from "../../contexts/UiContext";

/**
 * Maintenance Coordinator Dashboard
 *
 * Route:
 *   /maintenance
 *
 * Backend:
 *   GET /api/maintenance/dashboard
 *
 * Documentation requirements:
 * - Total Maintenance Requests
 * - New Requests
 * - Scheduled Repairs
 * - In-Progress Repairs
 * - Completed Repairs
 * - Assets Under Maintenance
 * - Overdue Maintenance
 * - Preventive Maintenance Due
 * - Critical Repairs
 * - Available Technicians
 * - Low Spare Parts
 * - Pending Quality Checks
 *
 * All KPI values are loaded from backend APIs.
 */

const KPI_CONFIG = [
  {
    key: "totalRequests",
    title: "Total Maintenance Requests",
    titleKey: "totalRequests",
    icon: "📋",
    type: "number",
  },
  {
    key: "newRequests",
    title: "New Requests",
    titleKey: "newRequests",
    icon: "🆕",
    type: "number",
  },
  {
    key: "scheduledRepairs",
    title: "Scheduled Repairs",
    titleKey: "scheduledRepairs",
    icon: "📅",
    type: "number",
  },
  {
    key: "inProgressRepairs",
    title: "In-Progress Repairs",
    titleKey: "inProgressRepairs",
    icon: "🔧",
    type: "number",
  },
  {
    key: "completedRepairs",
    title: "Completed Repairs",
    titleKey: "completedRepairs",
    icon: "✅",
    type: "number",
  },
  {
    key: "assetsUnderMaintenance",
    title: "Assets Under Maintenance",
    titleKey: "assetsUnderMaintenance",
    icon: "🛠️",
    type: "number",
  },
  {
    key: "overdueMaintenance",
    title: "Overdue Maintenance",
    titleKey: "overdueMaintenance",
    icon: "⚠️",
    type: "number",
    danger: true,
  },
  {
    key: "preventiveMaintenanceDue",
    title: "Preventive Maintenance Due",
    titleKey: "preventiveMaintenanceDue",
    icon: "🔄",
    type: "number",
  },
  {
    key: "criticalRepairs",
    title: "Critical Repairs",
    titleKey: "criticalRepairs",
    icon: "🚨",
    type: "number",
    danger: true,
  },
  {
    key: "availableTechnicians",
    title: "Available Technicians",
    titleKey: "availableTechnicians",
    icon: "👨‍🔧",
    type: "number",
  },
  {
    key: "lowSpareParts",
    title: "Low Spare Parts",
    titleKey: "lowSpareParts",
    icon: "📦",
    type: "number",
    danger: true,
  },
  {
    key: "pendingQualityChecks",
    title: "Pending Quality Checks",
    titleKey: "pendingQualityChecks",
    icon: "🔍",
    type: "number",
  },
];

const DEFAULT_DATA = {
  totalRequests: 0,
  newRequests: 0,
  scheduledRepairs: 0,
  inProgressRepairs: 0,
  completedRepairs: 0,
  assetsUnderMaintenance: 0,
  overdueMaintenance: 0,
  preventiveMaintenanceDue: 0,
  criticalRepairs: 0,
  availableTechnicians: 0,
  lowSpareParts: 0,
  pendingQualityChecks: 0,
};

function normalizeDashboardResponse(response) {
  /**
   * Supports common API response structures:
   *
   * {
   *   data: {...}
   * }
   *
   * or
   *
   * {
   *   dashboard: {...}
   * }
   *
   * or directly:
   *
   * {
   *   totalRequests: 10,
   *   ...
   * }
   */

  const source =
    response?.data?.dashboard ||
    response?.data ||
    response?.dashboard ||
    response ||
    {};
  const summary = source.summary || source;
  const byStatus = source.byStatus || {};

  return {
    totalRequests:
      Number(
        summary.totalRequests ??
          summary.totalMaintenanceRequests ??
          summary.total_requests ??
          0
      ) || 0,

    newRequests:
      Number(
        summary.newRequests ??
          summary.newMaintenanceRequests ??
          summary.new_requests ??
          summary.pendingRequests ??
          0
      ) || 0,

    scheduledRepairs:
      Number(
        summary.scheduledRepairs ??
          summary.scheduled_repairs ??
          byStatus.scheduled ??
          0
      ) || 0,

    inProgressRepairs:
      Number(
        summary.inProgressRepairs ??
          summary.in_progress_repairs ??
          summary.inProgress ??
          byStatus["in-progress"] ??
          0
      ) || 0,

    completedRepairs:
      Number(
        summary.completedRepairs ??
          summary.completed_repairs ??
          0
      ) || 0,

    assetsUnderMaintenance:
      Number(
        summary.assetsUnderMaintenance ??
          summary.assets_under_maintenance ??
          0
      ) || 0,

    overdueMaintenance:
      Number(
        summary.overdueMaintenance ??
          summary.overdue_maintenance ??
          summary.overdueWorkOrders ??
          0
      ) || 0,

    preventiveMaintenanceDue:
      Number(
        summary.preventiveMaintenanceDue ??
          summary.preventive_maintenance_due ??
          0
      ) || 0,

    criticalRepairs:
      Number(
        summary.criticalRepairs ??
          summary.critical_repairs ??
          summary.criticalAlerts ??
          0
      ) || 0,

    availableTechnicians:
      Number(
        summary.availableTechnicians ??
          summary.available_technicians ??
          summary.assignedStaff ??
          0
      ) || 0,

    lowSpareParts:
      Number(
        summary.lowSpareParts ??
          summary.low_spare_parts ??
          0
      ) || 0,

    pendingQualityChecks:
      Number(
        summary.pendingQualityChecks ??
          summary.pending_quality_checks ??
          summary.inTesting ??
          0
      ) || 0,
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function getCardClass(item, value) {
  if (item.danger && Number(value) > 0) {
    return "maintenance-kpi-card maintenance-kpi-card-danger";
  }

  return "maintenance-kpi-card";
}

function Dashboard() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  const hasCriticalItems = useMemo(() => {
    return (
      dashboard.overdueMaintenance > 0 ||
      dashboard.criticalRepairs > 0 ||
      dashboard.lowSpareParts > 0 ||
      dashboard.pendingQualityChecks > 0
    );
  }, [dashboard]);

  async function loadDashboard({ silent = false } = {}) {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await getMaintenanceDashboard();

      const normalized = normalizeDashboardResponse(response);

      setDashboard(normalized);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Maintenance dashboard error:", err);

      setError(err?.message || true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    /**
     * Refresh dashboard periodically so operational KPIs
     * remain reasonably current.
     */
    const interval = setInterval(() => {
      loadDashboard({ silent: true });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  function handleRefresh() {
    loadDashboard({ silent: true });
  }

  function navigateTo(path) {
    window.location.href = path;
  }

  if (loading) {
    return (
      <div className="maintenance-dashboard">
        <div className="maintenance-dashboard-header">
          <div>
            <div className="maintenance-skeleton-title" />
            <div className="maintenance-skeleton-subtitle" />
          </div>
        </div>

        <div className="maintenance-kpi-grid">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="maintenance-kpi-card maintenance-skeleton-card"
            >
              <div className="maintenance-skeleton-icon" />
              <div className="maintenance-skeleton-line" />
              <div className="maintenance-skeleton-value" />
            </div>
          ))}
        </div>

        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="maintenance-dashboard">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="maintenance-dashboard-header">
        <div>
          <div className="maintenance-breadcrumb">
            {t(
              "dashboard.maintenanceHome.breadcrumb",
              "Maintenance / Dashboard"
            )}
          </div>

          <h1>
            {t(
              "dashboard.maintenanceHome.title",
              "Maintenance Dashboard"
            )}
          </h1>

          <p>
            {t(
              "dashboard.maintenanceHome.subtitle",
              "Real-time overview of university maintenance activities and operational status."
            )}
          </p>
        </div>

        <div className="maintenance-header-actions">
          {lastUpdated && (
            <span className="maintenance-last-updated">
              {t("dashboard.maintenanceHome.updated", "Updated")}{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}

          <button
            type="button"
            className="maintenance-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing
              ? t("dashboard.maintenanceHome.refreshing", "Refreshing...")
              : t("dashboard.maintenanceHome.refresh", "Refresh")}
          </button>
        </div>
      </header>

      {/* =====================================================
          ERROR STATE
      ====================================================== */}

      {error && (
        <div
          className="maintenance-alert maintenance-alert-error"
          role="alert"
        >
          <div>
            <strong>
              {t(
                "dashboard.maintenanceHome.unableToLoadDashboard",
                "Unable to load dashboard"
              )}
            </strong>
            <p>
              {typeof error === "string"
                ? error
                : t(
                    "dashboard.maintenanceHome.loadError",
                    "Unable to load maintenance dashboard."
                  )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard()}
          >
            {t("dashboard.maintenanceHome.tryAgain", "Try Again")}
          </button>
        </div>
      )}

      {/* =====================================================
          CRITICAL OPERATIONAL ALERT
      ====================================================== */}

      {!error && hasCriticalItems && (
        <div className="maintenance-alert maintenance-alert-warning">
          <div>
            <strong>
              {t(
                "dashboard.maintenanceHome.maintenanceAttentionRequired",
                "Maintenance attention required"
              )}
            </strong>

            <p>
              {t(
                "dashboard.maintenanceHome.attentionDescription",
                "One or more maintenance items require coordinator attention."
              )}
            </p>
          </div>

          <div className="maintenance-alert-actions">
            {dashboard.overdueMaintenance > 0 && (
              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/maintenance/work-orders?filter=overdue"
                  )
                }
              >
                {t("dashboard.maintenanceHome.overdue", "Overdue")}
              </button>
            )}

            {dashboard.criticalRepairs > 0 && (
              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/maintenance/repairs?priority=critical"
                  )
                }
              >
                {t("dashboard.maintenanceHome.critical", "Critical")}
              </button>
            )}

            {dashboard.lowSpareParts > 0 && (
              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/maintenance/spare-parts?filter=low-stock"
                  )
                }
              >
                {t("dashboard.maintenanceHome.lowStock", "Low Stock")}
              </button>
            )}

            {dashboard.pendingQualityChecks > 0 && (
              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/maintenance/quality-control?status=pending"
                  )
                }
              >
                {t(
                  "dashboard.maintenanceHome.qualityChecks",
                  "Quality Checks"
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          KPI CARDS
      ====================================================== */}

      <section
        className="maintenance-kpi-grid"
        aria-label={t(
          "dashboard.maintenanceHome.kpis",
          "Maintenance KPIs"
        )}
      >
        {KPI_CONFIG.map((item) => {
          const value = dashboard[item.key];

          return (
            <article
              key={item.key}
              className={getCardClass(item, value)}
            >
              <div className="maintenance-kpi-top">
                <div className="maintenance-kpi-icon">
                  {item.icon}
                </div>

                <span className="maintenance-kpi-menu">
                  ⋯
                </span>
              </div>

              <div className="maintenance-kpi-title">
                {t(
                  `dashboard.maintenanceHome.${item.titleKey}`,
                  item.title
                )}
              </div>

              <div className="maintenance-kpi-value">
                {formatNumber(value)}
              </div>

              {item.key === "newRequests" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/requests?status=submitted"
                    )
                  }
                >
                  {t(
                    "dashboard.maintenanceHome.viewRequests",
                    "View requests"
                  )}{" "}
                  →
                </button>
              )}

              {item.key === "scheduledRepairs" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/work-orders?status=scheduled"
                    )
                  }
                >
                  {t(
                    "dashboard.maintenanceHome.viewSchedule",
                    "View schedule"
                  )}{" "}
                  →
                </button>
              )}

              {item.key === "inProgressRepairs" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/work-orders?status=in-progress"
                    )
                  }
                >
                  {t(
                    "dashboard.maintenanceHome.viewWorkOrders",
                    "View work orders"
                  )}{" "}
                  →
                </button>
              )}

              {item.key === "assetsUnderMaintenance" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/assets-under-maintenance"
                    )
                  }
                >
                  {t("dashboard.maintenanceHome.viewAssets", "View assets")}{" "}
                  →
                </button>
              )}

              {item.key === "preventiveMaintenanceDue" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/preventive?filter=due"
                    )
                  }
                >
                  {t(
                    "dashboard.maintenanceHome.viewPreventive",
                    "View preventive"
                  )}{" "}
                  →
                </button>
              )}

              {item.key === "lowSpareParts" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/spare-parts?filter=low-stock"
                    )
                  }
                >
                  {t(
                    "dashboard.maintenanceHome.viewSpareParts",
                    "View spare parts"
                  )}{" "}
                  →
                </button>
              )}

              {item.key === "pendingQualityChecks" && (
                <button
                  type="button"
                  className="maintenance-kpi-link"
                  onClick={() =>
                    navigateTo(
                      "/maintenance/quality-control?status=pending"
                    )
                  }
                >
                  {t(
                    "dashboard.maintenanceHome.reviewQuality",
                    "Review quality"
                  )}{" "}
                  →
                </button>
              )}
            </article>
          );
        })}
      </section>

      {/* =====================================================
          QUICK ACTIONS
      ====================================================== */}

      <section className="maintenance-section">
        <div className="maintenance-section-header">
          <div>
            <h2>
              {t("dashboard.maintenanceHome.quickActions", "Quick Actions")}
            </h2>
            <p>
              {t(
                "dashboard.maintenanceHome.quickActionsDescription",
                "Common maintenance coordinator operations."
              )}
            </p>
          </div>
        </div>

        <div className="maintenance-quick-actions">
          <button
            type="button"
            onClick={() =>
              navigateTo("/maintenance/requests")
            }
          >
            <span>📋</span>
            <strong>
              {t(
                "dashboard.maintenanceHome.maintenanceRequests",
                "Maintenance Requests"
              )}
            </strong>
            <small>
              {t(
                "dashboard.maintenanceHome.reviewManageRequests",
                "Review and manage requests"
              )}
            </small>
          </button>

          <button
            type="button"
            onClick={() =>
              navigateTo("/maintenance/work-orders")
            }
          >
            <span>🔧</span>
            <strong>
              {t("dashboard.maintenanceHome.workOrders", "Work Orders")}
            </strong>
            <small>
              {t(
                "dashboard.maintenanceHome.coordinateMaintenanceWork",
                "Coordinate maintenance work"
              )}
            </small>
          </button>

          <button
            type="button"
            onClick={() =>
              navigateTo("/maintenance/repairs")
            }
          >
            <span>🛠️</span>
            <strong>{t("dashboard.maintenanceHome.repairs", "Repairs")}</strong>
            <small>
              {t(
                "dashboard.maintenanceHome.monitorRepairActivities",
                "Monitor repair activities"
              )}
            </small>
          </button>

          <button
            type="button"
            onClick={() =>
              navigateTo("/maintenance/preventive")
            }
          >
            <span>🔄</span>
            <strong>
              {t(
                "dashboard.maintenanceHome.preventiveMaintenance",
                "Preventive Maintenance"
              )}
            </strong>
            <small>
              {t(
                "dashboard.maintenanceHome.manageMaintenancePlans",
                "Manage maintenance plans"
              )}
            </small>
          </button>

          <button
            type="button"
            onClick={() =>
              navigateTo("/maintenance/quality-control")
            }
          >
            <span>✓</span>
            <strong>
              {t("dashboard.maintenanceHome.qualityControl", "Quality Control")}
            </strong>
            <small>
              {t(
                "dashboard.maintenanceHome.reviewCompletedMaintenance",
                "Review completed maintenance"
              )}
            </small>
          </button>

          <button
            type="button"
            onClick={() =>
              navigateTo("/maintenance/reports")
            }
          >
            <span>📊</span>
            <strong>{t("dashboard.maintenanceHome.reports", "Reports")}</strong>
            <small>
              {t(
                "dashboard.maintenanceHome.viewMaintenanceAnalytics",
                "View maintenance analytics"
              )}
            </small>
          </button>
        </div>
      </section>

      {/* =====================================================
          OPERATIONAL SUMMARY
      ====================================================== */}

      <section className="maintenance-summary-grid">
        <div className="maintenance-summary-card">
          <div className="maintenance-summary-header">
            <div>
              <h2>
                {t(
                  "dashboard.maintenanceHome.maintenanceStatus",
                  "Maintenance Status"
                )}
              </h2>
              <p>
                {t(
                  "dashboard.maintenanceHome.currentIndicators",
                  "Current operational indicators"
                )}
              </p>
            </div>
          </div>

          <div className="maintenance-status-list">
            <div>
              <span>
                {t("dashboard.maintenanceHome.newRequests", "New Requests")}
              </span>
              <strong>
                {formatNumber(dashboard.newRequests)}
              </strong>
            </div>

            <div>
              <span>
                {t(
                  "dashboard.maintenanceHome.scheduledRepairs",
                  "Scheduled Repairs"
                )}
              </span>
              <strong>
                {formatNumber(dashboard.scheduledRepairs)}
              </strong>
            </div>

            <div>
              <span>
                {t("dashboard.maintenanceHome.inProgress", "In Progress")}
              </span>
              <strong>
                {formatNumber(dashboard.inProgressRepairs)}
              </strong>
            </div>

            <div>
              <span>
                {t(
                  "dashboard.maintenanceHome.completedRepairs",
                  "Completed Repairs"
                )}
              </span>
              <strong>
                {formatNumber(dashboard.completedRepairs)}
              </strong>
            </div>
          </div>
        </div>

        <div className="maintenance-summary-card">
          <div className="maintenance-summary-header">
            <div>
              <h2>
                {t(
                  "dashboard.maintenanceHome.attentionRequired",
                  "Attention Required"
                )}
              </h2>
              <p>
                {t(
                  "dashboard.maintenanceHome.itemsRequiringAction",
                  "Items requiring coordinator action"
                )}
              </p>
            </div>
          </div>

          <div className="maintenance-status-list">
            <div>
              <span>
                {t(
                  "dashboard.maintenanceHome.overdueMaintenance",
                  "Overdue Maintenance"
                )}
              </span>
              <strong className="danger-value">
                {formatNumber(
                  dashboard.overdueMaintenance
                )}
              </strong>
            </div>

            <div>
              <span>
                {t(
                  "dashboard.maintenanceHome.criticalRepairs",
                  "Critical Repairs"
                )}
              </span>
              <strong className="danger-value">
                {formatNumber(dashboard.criticalRepairs)}
              </strong>
            </div>

            <div>
              <span>
                {t("dashboard.maintenanceHome.lowSpareParts", "Low Spare Parts")}
              </span>
              <strong className="danger-value">
                {formatNumber(dashboard.lowSpareParts)}
              </strong>
            </div>

            <div>
              <span>
                {t(
                  "dashboard.maintenanceHome.pendingQualityChecks",
                  "Pending Quality Checks"
                )}
              </span>
              <strong className="danger-value">
                {formatNumber(
                  dashboard.pendingQualityChecks
                )}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .maintenance-dashboard {
    min-height: 100%;
    padding: 24px;
    background: var(--color-background);
    color: var(--color-text-primary);
    box-sizing: border-box;
  }

  .maintenance-dashboard *,
  .maintenance-dashboard *::before,
  .maintenance-dashboard *::after {
    box-sizing: border-box;
  }

  .maintenance-dashboard-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  .maintenance-breadcrumb {
    color: var(--color-text-secondary-on-page);
    font-size: 13px;
    margin-bottom: 8px;
  }

  .maintenance-dashboard-header h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .maintenance-dashboard-header p {
    margin: 8px 0 0;
    color: var(--color-text-secondary-on-page);
    font-size: 14px;
  }

  .maintenance-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .maintenance-last-updated {
    color: var(--color-text-secondary-on-page);
    font-size: 12px;
    white-space: nowrap;
  }

  .maintenance-refresh-button {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-primary);
    border-radius: 8px;
    padding: 10px 15px;
    cursor: pointer;
    font-weight: 600;
  }

  .maintenance-refresh-button:hover {
    background: var(--color-surface-muted);
  }

  .maintenance-refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .maintenance-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 18px;
    border-radius: 10px;
    margin-bottom: 20px;
    border: 1px solid transparent;
    border-left-width: 4px;
  }

  .maintenance-alert strong {
    display: block;
    margin-bottom: 4px;
  }

  .maintenance-alert p {
    margin: 0;
    font-size: 13px;
  }

  .maintenance-alert-error {
    background: var(--color-danger-light);
    border-color: var(--color-danger-light);
    border-left-color: var(--color-danger-text);
    color: var(--color-danger-text);
  }

  .maintenance-alert-warning {
    background: var(--color-warning-light);
    border-color: var(--color-warning-light);
    border-left-color: var(--color-warning-text);
    color: var(--color-warning-text);
  }

  .maintenance-alert button {
    border: 0;
    background: var(--color-surface);
    border-radius: 7px;
    padding: 8px 12px;
    cursor: pointer;
    font-weight: 600;
  }

  .maintenance-alert-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .maintenance-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .maintenance-kpi-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 18px;
    min-height: 170px;
    box-shadow: var(--shadow-dashboard-card);
  }

  .maintenance-kpi-card-danger {
    border-color: var(--color-danger-light);
  }

  .maintenance-kpi-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .maintenance-kpi-icon {
    width: 42px;
    height: 42px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-light);
    font-size: 20px;
  }

  .maintenance-kpi-menu {
    color: var(--color-text-secondary-on-page);
    font-size: 20px;
  }

  .maintenance-kpi-title {
    margin-top: 16px;
    color: var(--color-text-secondary-on-page);
    font-size: 13px;
    line-height: 1.4;
  }

  .maintenance-kpi-value {
    margin-top: 7px;
    color: var(--color-text-primary);
    font-size: 29px;
    font-weight: 700;
  }

  .maintenance-kpi-link {
    margin-top: 12px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .maintenance-section {
    margin-top: 28px;
  }

  .maintenance-section-header {
    margin-bottom: 14px;
  }

  .maintenance-section-header h2,
  .maintenance-summary-header h2 {
    margin: 0;
    font-size: 19px;
  }

  .maintenance-section-header p,
  .maintenance-summary-header p {
    margin: 5px 0 0;
    color: var(--color-text-secondary-on-page);
    font-size: 13px;
  }

  .maintenance-quick-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .maintenance-quick-actions button {
    display: grid;
    grid-template-columns: 40px 1fr;
    grid-template-rows: auto auto;
    column-gap: 12px;
    text-align: left;
    padding: 16px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: 10px;
    cursor: pointer;
  }

  .maintenance-quick-actions button:hover {
    border-color: var(--color-primary);
    transform: translateY(-1px);
  }

  .maintenance-quick-actions span {
    grid-row: 1 / 3;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--color-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .maintenance-quick-actions strong {
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .maintenance-quick-actions small {
    color: var(--color-text-secondary-on-page);
    font-size: 12px;
    margin-top: 4px;
  }

  .maintenance-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 28px;
  }

  .maintenance-summary-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 20px;
  }

  .maintenance-status-list {
    margin-top: 18px;
    display: grid;
    gap: 12px;
  }

  .maintenance-status-list > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .maintenance-status-list > div:last-child {
    border-bottom: 0;
  }

  .maintenance-status-list span {
    color: var(--color-text-secondary-on-page);
    font-size: 13px;
  }

  .maintenance-status-list strong {
    color: var(--color-text-primary);
    font-size: 15px;
  }

  .danger-value {
    color: var(--color-danger) !important;
  }

  .maintenance-skeleton-card {
    overflow: hidden;
  }

  .maintenance-skeleton-title,
  .maintenance-skeleton-subtitle,
  .maintenance-skeleton-icon,
  .maintenance-skeleton-line,
  .maintenance-skeleton-value {
    background: var(--color-surface-muted);
    border-radius: 7px;
  }

  .maintenance-skeleton-title {
    width: 280px;
    height: 30px;
  }

  .maintenance-skeleton-subtitle {
    width: 380px;
    max-width: 80%;
    height: 14px;
    margin-top: 10px;
  }

  .maintenance-skeleton-icon {
    width: 42px;
    height: 42px;
  }

  .maintenance-skeleton-line {
    width: 75%;
    height: 13px;
    margin-top: 20px;
  }

  .maintenance-skeleton-value {
    width: 45%;
    height: 28px;
    margin-top: 10px;
  }

  @media (max-width: 1200px) {
    .maintenance-kpi-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .maintenance-quick-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .maintenance-dashboard {
      padding: 18px;
    }

    .maintenance-dashboard-header {
      flex-direction: column;
    }

    .maintenance-kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .maintenance-summary-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .maintenance-dashboard {
      padding: 12px;
    }

    .maintenance-dashboard-header h1 {
      font-size: 23px;
    }

    .maintenance-header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .maintenance-kpi-grid {
      grid-template-columns: 1fr;
    }

    .maintenance-quick-actions {
      grid-template-columns: 1fr;
    }

    .maintenance-alert {
      flex-direction: column;
      align-items: flex-start;
    }

    .maintenance-kpi-card {
      min-height: 150px;
    }
  }
`;

export default Dashboard;