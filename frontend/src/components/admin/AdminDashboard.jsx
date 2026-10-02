import React, { useCallback, useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Activity, Archive, ArrowLeftRight, Bell, Boxes, ClipboardList, Package, Plus, RefreshCw, Users, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import PageHeader from "./ui/PageHeader";
import "./AdminDashboard.css";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const DASHBOARD_REQUEST_TIMEOUT_MS = 15000;
const chartColorTokens = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];
const readAdminToken = (name) => {
  const adminRoot = document.querySelector(".admin-layout");
  return adminRoot ? getComputedStyle(adminRoot).getPropertyValue(name).trim() : "";
};
const chartColors = () => chartColorTokens.map(readAdminToken).filter(Boolean);
const buildDoughnutData = (rows) => ({
  labels: rows.map((row) => row.label),
  datasets: [{ data: rows.map((row) => row.value), backgroundColor: chartColors(), borderWidth: 2, borderColor: readAdminToken("--color-surface") }],
});
const buildBarData = (rows) => ({
  labels: rows.map((row) => row.label),
  datasets: [{ label: "Assets", data: rows.map((row) => row.value), backgroundColor: readAdminToken("--chart-1"), borderRadius: 4 }],
});
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };
const barOptions = { ...chartOptions, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
const quickActionIcons = {
  "/admin/assets/create": Package,
  "/admin/assets/assign": ClipboardList,
  "/admin/assets/transfer": ArrowLeftRight,
  "/admin/maintenance": Wrench,
  "/admin/users": Users,
  "/admin/reports": Activity,
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState({
    assets: {
      total: 0,
      active: 0,
      damaged: 0,
      assigned: 0,
      available: 0,
      maintenance: 0,
      expired: 0,
    },
    users: 0,
    colleges: 0,
    departments: 0,
    maintenance: {
      submitted: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    },
    recentActivity: [],
    recentAssets: [],
    assetByStatus: [],
    assetByCategory: [],
    alerts: [],
    quickActions: [],
  });

  const normalizeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const normalizeDashboard = useCallback((data) => {
    const source = data?.data || data || {};

    const assets = source.assets || source.assetSummary || {};
    const maintenance =
      source.maintenance || source.maintenanceSummary || {};
    return {
      assets: {
        total: normalizeNumber(
          assets.total ??
            assets.totalAssets ??
            source.totalAssets
        ),
        active: normalizeNumber(
          assets.active ??
            assets.activeAssets ??
            source.activeAssets
        ),
        damaged: normalizeNumber(
          assets.damaged ??
            assets.damagedAssets ??
            source.damagedAssets
        ),
        assigned: normalizeNumber(assets.assigned ?? source.assignedAssets),
        available: normalizeNumber(assets.available ?? source.availableAssets),
        maintenance: normalizeNumber(assets.maintenance ?? source.maintenanceAssets ?? source.underMaintenance),
        expired: normalizeNumber(
          assets.expired ??
            assets.expiredAssets ??
            source.expiredAssets
        ),
      },

      users: normalizeNumber(
        source.users ??
          source.totalUsers ??
          source.userCount
      ),

      colleges: normalizeNumber(
        source.colleges ??
          source.totalColleges ??
          source.collegeCount
      ),

      departments: normalizeNumber(
        source.departments ??
          source.totalDepartments ??
          source.departmentCount
      ),

      maintenance: {
        submitted: normalizeNumber(
          maintenance.submitted ??
            maintenance.submittedRequests ??
            maintenance.open ??
            source.submittedMaintenance
        ),
        scheduled: normalizeNumber(
          maintenance.scheduled ??
            maintenance.scheduledRequests ??
            source.scheduledMaintenance
        ),
        inProgress: normalizeNumber(
          maintenance.inProgress ??
            maintenance.in_progress ??
            maintenance.inProgressRequests ??
            source.inProgressMaintenance
        ),
        completed: normalizeNumber(
          maintenance.completed ??
            maintenance.completedRequests ??
            source.completedMaintenance
        ),
        overdue: normalizeNumber(maintenance.overdue ?? source.overdueMaintenance),
      },


      recentActivity: Array.isArray(source.recentActivity)
        ? source.recentActivity
        : Array.isArray(source.recentActivities)
        ? source.recentActivities
        : Array.isArray(source.activities)
          ? source.activities
        : [],
      recentAssets: Array.isArray(source.recentAssets) ? source.recentAssets : [],
      assetByStatus: Array.isArray(source.assetByStatus) ? source.assetByStatus : [],
      assetByCategory: Array.isArray(source.assetByCategory) ? source.assetByCategory : [],
      alerts: Array.isArray(source.alerts) ? source.alerts : [],
      quickActions: Array.isArray(source.quickActions) ? source.quickActions : [],
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    let timeoutId;

    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const timeoutError = new Error("Dashboard request timed out.");
          timeoutError.code = "DASHBOARD_TIMEOUT";
          reject(timeoutError);
          controller.abort();
        }, DASHBOARD_REQUEST_TIMEOUT_MS);
      });
      const response = await Promise.race([
        apiClient.get("/api/admin/dashboard", {
          timeout: DASHBOARD_REQUEST_TIMEOUT_MS,
          signal: controller.signal,
        }),
        timeout,
      ]);
      setDashboard(normalizeDashboard(response.data));
    } catch (requestError) {
      console.error("Dashboard loading error:", requestError);
      setError(requestError?.code === "DASHBOARD_TIMEOUT"
        ? "Dashboard data took too long to load. Please try again."
        : getApiErrorMessage(requestError, "Unable to load administrator dashboard."));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [normalizeDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statCards = [
    { title: "Total Assets", value: dashboard.assets.total, icon: Package },
    { title: "Active Assets", value: dashboard.assets.active, icon: Activity },
    { title: "Damaged Assets", value: dashboard.assets.damaged, icon: Archive },
    { title: "Maintenance", value: dashboard.assets.maintenance, icon: Wrench },
    { title: "Assigned Assets", value: dashboard.assets.assigned, icon: ClipboardList },
    { title: "Available Assets", value: dashboard.assets.available, icon: Boxes },
    { title: "Expired Assets", value: dashboard.assets.expired, icon: Bell },
    { title: "Total Users", value: dashboard.users, icon: Users },
  ];

  const maintenanceCards = [
    {
      title: "Open",
      value: dashboard.maintenance.submitted,
    },
    {
      title: "Scheduled",
      value: dashboard.maintenance.scheduled,
    },
    {
      title: "In Progress",
      value: dashboard.maintenance.inProgress,
    },
    {
      title: "Completed",
      value: dashboard.maintenance.completed,
    },
  ];

  if (loading) {
    return (
      <div className="admin-dashboard-shell admin-dashboard-shell--loading" aria-busy="true" aria-label="Loading administrator dashboard">
        <PageHeader eyebrow="Administrator" title="Admin Dashboard" subtitle="Overview of assets, maintenance, and system activity." />
        <div className="admin-dashboard-skeleton admin-dashboard-skeleton--header" />
        <div className="admin-dashboard-skeleton-grid">
          {Array.from({ length: 8 }, (_, index) => <div className="admin-dashboard-skeleton admin-dashboard-skeleton--stat" key={index} />)}
        </div>
        <div className="admin-dashboard-skeleton-grid admin-dashboard-skeleton-grid--charts">
          <div className="admin-dashboard-skeleton admin-dashboard-skeleton--chart" />
          <div className="admin-dashboard-skeleton admin-dashboard-skeleton--chart" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard-page" style={styles.page}>
        <PageHeader eyebrow="Administrator" title="Admin Dashboard" subtitle="Overview of assets, maintenance, and system activity." />
        <div style={styles.errorBox} role="alert">
          <div><strong>Unable to load dashboard</strong><div style={styles.errorText}>{error}</div></div>
          <button type="button" onClick={loadDashboard} style={styles.retryButton}><RefreshCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page" style={styles.page}>
      <PageHeader eyebrow="Administrator" title="Admin Dashboard" subtitle="Overview of assets, maintenance, and system activity." />
      <section>
        <h2 style={styles.sectionTitle}>Asset Overview</h2>

        <div style={styles.grid}>
          {statCards.map(({ title, value, icon: Icon }) => (
            <div key={title} style={styles.card}>
              <div style={styles.cardIcon}><Icon size={19} aria-hidden="true" /></div>

              <div>
                <div style={styles.cardLabel}>{title}</div>
                <div style={styles.cardValue}>{value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Asset Distribution</h2>
        <div className="admin-dashboard-chart-grid">
          <section className="admin-dashboard-panel" aria-labelledby="asset-status-heading">
            <h3 id="asset-status-heading">Assets by status</h3>
            {dashboard.assetByStatus.length ? (
              <div className="admin-dashboard-chart" role="img" aria-label="Assets grouped by status"><Doughnut data={buildDoughnutData(dashboard.assetByStatus)} options={chartOptions} /><p className="admin-sr-only">{dashboard.assetByStatus.map((row) => `${row.label}: ${row.value}`).join(', ')}</p></div>
            ) : <div className="admin-dashboard-empty">No asset status data available.</div>}
          </section>
          <section className="admin-dashboard-panel" aria-labelledby="asset-category-heading">
            <h3 id="asset-category-heading">Assets by category</h3>
            {dashboard.assetByCategory.length ? (
              <div className="admin-dashboard-chart" role="img" aria-label="Assets grouped by category"><Bar data={buildBarData(dashboard.assetByCategory)} options={barOptions} /><p className="admin-sr-only">{dashboard.assetByCategory.map((row) => `${row.label}: ${row.value}`).join(', ')}</p></div>
            ) : <div className="admin-dashboard-empty">No asset category data available.</div>}
          </section>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Maintenance Overview</h2>

        <div style={styles.grid}>
          {maintenanceCards.map((card) => (
            <div key={card.title} style={styles.card}>
              <div style={styles.cardLabel}>{card.title}</div>
              <div style={styles.cardValue}>{card.value}</div>
            </div>
          ))}
          <div style={styles.card}>
            <div><div style={styles.cardLabel}>Overdue</div><div style={styles.cardValue}>{dashboard.maintenance.overdue.toLocaleString()}</div></div>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Recent Assets</h2>
        <div className="admin-dashboard-table-wrap">
          {dashboard.recentAssets.length ? (
            <table className="admin-dashboard-table">
              <thead><tr><th scope="col">Asset</th><th scope="col">Category</th><th scope="col">Department</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead>
              <tbody>{dashboard.recentAssets.map((asset) => (
                <tr key={asset.id}>
                  <td><Link to={`/admin/assets/${asset.id}`}>{asset.name || `Asset ${asset.id}`}</Link></td>
                  <td>{asset.category || "Uncategorized"}</td>
                  <td>{asset.department || "Unassigned"}</td>
                  <td><span className="admin-dashboard-status">{asset.status || "Unknown"}</span></td>
                  <td>{asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <div className="admin-dashboard-empty">No recent assets found.</div>}
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}><h2 style={styles.sectionTitle}>Alerts</h2></div>
        <div className="admin-dashboard-alerts">
          {dashboard.alerts.length ? dashboard.alerts.map((alert, index) => (
            <div className={`admin-dashboard-alert admin-dashboard-alert--${alert.type || "info"}`} key={`${alert.category || "alert"}-${index}`}>
              <Bell size={17} aria-hidden="true" /><div><strong>{alert.message}</strong><span>{Number(alert.count || 0).toLocaleString()} item{Number(alert.count) === 1 ? "" : "s"}</span></div>
            </div>
          )) : <div className="admin-dashboard-empty">No active alerts.</div>}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div className="admin-dashboard-actions">
          {dashboard.quickActions.length ? dashboard.quickActions.map((action) => {
            const ActionIcon = quickActionIcons[action.path] || Plus;
            return (
              <Link className="admin-dashboard-action" to={action.path} key={action.path}>
                <ActionIcon size={17} aria-hidden="true" /><span>{action.label}</span>
              </Link>
            );
          }) : <div className="admin-dashboard-empty">No quick actions are available.</div>}
        </div>
      </section>

    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "0",
    background: "transparent",
    boxSizing: "border-box",
  },

  errorBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "14px 16px",
    marginBottom: "24px",
    borderRadius: "10px",
    border: "1px solid var(--color-danger-bg)",
    background: "var(--color-danger-bg)",
    color: "var(--color-danger-text)",
  },

  errorText: {
    marginTop: "4px",
    fontSize: "13px",
  },

  retryButton: {
    border: "1px solid var(--color-danger-text)",
    borderRadius: "7px",
    padding: "8px 14px",
    background: "var(--color-surface)",
    color: "var(--color-danger-text)",
    cursor: "pointer",
    fontWeight: 600,
  },

  loadingCard: {
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-surface)",
    borderRadius: "12px",
  },

  spinner: {
    width: "34px",
    height: "34px",
    border: "4px solid var(--color-border)",
    borderTop: "4px solid var(--color-primary)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  loadingText: {
    marginTop: "14px",
    color: "var(--color-muted)",
  },

  section: {
    marginTop: "30px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: "0 0 14px",
    color: "var(--color-text)",
    fontSize: "18px",
    fontWeight: 700,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minHeight: "100px",
    padding: "18px",
    background: "var(--color-surface)",
    borderRadius: "12px",
    border: "1px solid var(--color-border)",
    boxSizing: "border-box",
  },

  cardIcon: {
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    background: "var(--color-info-bg)",
    fontSize: "20px",
  },

  cardLabel: {
    color: "var(--color-muted)",
    fontSize: "13px",
    fontWeight: 500,
  },

  cardValue: {
    marginTop: "5px",
    color: "var(--color-text)",
    fontSize: "25px",
    fontWeight: 700,
  },

  activityCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    overflow: "hidden",
  },

  activityRow: {
    display: "flex",
    gap: "14px",
    padding: "16px 18px",
    borderBottom: "1px solid var(--color-border)",
  },

  activityDot: {
    width: "9px",
    height: "9px",
    marginTop: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    flexShrink: 0,
  },

  activityContent: {
    minWidth: 0,
    flex: 1,
  },

  activityTitle: {
    color: "var(--color-text)",
    fontSize: "14px",
    fontWeight: 600,
  },

  activityDescription: {
    marginTop: "4px",
    color: "var(--color-muted)",
    fontSize: "13px",
  },

  activityDate: {
    marginTop: "6px",
    color: "var(--color-muted)",
    fontSize: "12px",
  },

  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "var(--color-muted)",
    fontSize: "14px",
  },
};

export default Dashboard;