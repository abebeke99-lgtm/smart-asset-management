import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Package,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import { Link, useInRouterContext } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import PageHeader from "./ui/PageHeader";
import "./AdminDashboard.css";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const chartPalette = ["#2563EB", "#0EA5D9", "#F4C542", "#EF4444", "#14B8A6", "#8B5CF6", "#F97316"];
const emptyDashboard = {
  statistics: {},
  assetByCondition: [],
  assetByCategory: [],
  maintenanceOverview: [],
  inventoryAlerts: [],
  recentActivity: [],
  thresholds: {},
};
const emptyStatistics = Object.freeze({});
const defaultThresholds = {
  lowStockPercent: 10,
  expirationNoticeDays: 30,
  escalationHours: 72,
};
const maintenanceLabels = ["Submitted", "Scheduled", "In-Progress", "Completed", "Escalated"];
const inventoryAlertLabels = ["Low stock", "Out of stock", "Expiring chemicals", "Expired chemicals", "Quarantined chemicals"];
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};
const numberFormat = new Intl.NumberFormat();

const SafeLink = React.forwardRef(({ to, ...props }, ref) => {
  const inRouter = useInRouterContext();

  if (!inRouter) {
    const href = typeof to === "string" ? to : to?.pathname || "/";
    return <a ref={ref} href={href} {...props} />;
  }

  return <Link ref={ref} to={to} {...props} />;
});

export const normalizeDashboardThresholds = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultThresholds;
  return Object.fromEntries(
    Object.entries(defaultThresholds).map(([key, fallback]) => {
      const candidate = Number(value[key]);
      return [key, Number.isFinite(candidate) && candidate > 0 ? candidate : fallback];
    }),
  );
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const StatCard = ({ title, value, icon: Icon, to, loading, error }) => (
  <SafeLink className="admin-dashboard-stat-card" to={to} aria-label={`${title}: ${error ? "unavailable" : numberFormat.format(value || 0)}`}>
    <span className="admin-dashboard-stat-icon"><Icon size={19} aria-hidden="true" /></span>
    <span className="admin-dashboard-stat-copy">
      <span className="admin-dashboard-stat-title">{title}</span>
      {loading ? (
        <span className="admin-dashboard-value-skeleton" aria-label="Loading statistic" />
      ) : error ? (
        <span className="admin-dashboard-stat-error">Unavailable</span>
      ) : (
        <strong>{numberFormat.format(value || 0)}</strong>
      )}
    </span>
    <ArrowUpRight className="admin-dashboard-stat-link-icon" size={15} aria-hidden="true" />
  </SafeLink>
);

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState("");
  const [thresholdError, setThresholdError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    let timeoutHandle;

    try {
      const response = await Promise.race([
        apiClient.get("/api/admin/dashboard", { timeout: 15000 }),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error("Dashboard data took too long to load. Please try again.")), 15000);
        }),
      ]);

      const payload = response?.data?.data ?? response?.data ?? response;
      const data = payload && typeof payload === "object" ? payload : null;
      if (!data) {
        throw new Error("The dashboard response was incomplete.");
      }

      setDashboard(data);
      setThresholds(normalizeDashboardThresholds(data.thresholds));
    } catch (requestError) {
      console.error("Dashboard loading error:", requestError);
      const message = requestError?.message === "Dashboard data took too long to load. Please try again."
        ? "Dashboard data took too long to load. Please try again."
        : getApiErrorMessage(requestError, "Unable to load administrator dashboard.");
      setError(message);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const saveThresholds = async (event) => {
    event.preventDefault();
    setSavingThresholds(true);
    setThresholdError("");
    setThresholdMessage("");
    try {
      const response = await apiClient.put("/api/admin/settings/dashboard", { data: thresholds });
      const saved = response?.data?.data;
      if (!saved || typeof saved !== "object") {
        throw new Error("The saved threshold settings could not be confirmed.");
      }
      setThresholds(normalizeDashboardThresholds(saved));
      setDashboard((current) => ({ ...current, thresholds: saved }));
      setThresholdMessage("Dashboard thresholds saved.");
      await loadDashboard();
    } catch (saveError) {
      setThresholdError(getApiErrorMessage(saveError, "Unable to save dashboard thresholds."));
    } finally {
      setSavingThresholds(false);
    }
  };

  const statistics = dashboard.statistics || emptyStatistics;
  const assetStats = statistics.assets || emptyStatistics;
  const organizationStats = statistics.organization || emptyStatistics;
  const workflowStats = statistics.workflow || emptyStatistics;
  const inventoryStats = statistics.inventory || emptyStatistics;
  const maintenanceStats = statistics.maintenance || emptyStatistics;
  const maintenanceOverview = dashboard.maintenanceOverview?.length
    ? dashboard.maintenanceOverview
    : maintenanceLabels.map((label) => ({ label, value: 0 }));
  const inventoryAlerts = dashboard.inventoryAlerts?.length
    ? dashboard.inventoryAlerts
    : inventoryAlertLabels.map((label) => ({ label, value: 0 }));
  const statCards = useMemo(() => [
    { title: "Total Assets", value: assetStats.total, icon: Package, to: "/admin/assets" },
    { title: "Active Assets", value: assetStats.active, icon: Activity, to: "/admin/assets?status=available" },
    { title: "Damaged Assets", value: assetStats.damaged, icon: Archive, to: "/admin/assets?status=damaged" },
    { title: "Replaced Assets", value: assetStats.replaced, icon: RefreshCw, to: "/admin/assets?status=replaced" },
    { title: "Expired Assets", value: assetStats.expired, icon: Clock3, to: "/admin/assets?status=expired" },
    { title: "Total Users", value: organizationStats.users, icon: Users, to: "/admin/users" },
    { title: "Colleges", value: organizationStats.colleges, icon: Building2, to: "/admin/colleges" },
    { title: "Departments", value: organizationStats.departments, icon: Building2, to: "/admin/departments" },
    { title: "Open Service Requests", value: workflowStats.openServiceRequests, icon: Bell, to: "/admin/maintenance/requests" },
    { title: "Pending Approvals", value: workflowStats.pendingApprovals, icon: CheckCircle2, to: "/admin/approvals/pending" },
    { title: "Low Stock Items", value: inventoryStats.lowStockItems, icon: Boxes, to: "/admin/inventory/quarantine" },
    { title: "Expiring Chemicals", value: inventoryStats.expiringChemicals, icon: FlaskConical, to: "/admin/inventory/quarantine" },
    { title: "Assets Under Maintenance", value: assetStats.underMaintenance, icon: Wrench, to: "/admin/maintenance" },
    { title: "Overdue Maintenance", value: maintenanceStats.overdue, icon: CalendarClock, to: "/admin/maintenance" },
  ], [assetStats, organizationStats, workflowStats, inventoryStats, maintenanceStats]);

  const conditionData = useMemo(() => ({
    labels: (dashboard.assetByCondition || []).map((row) => row.label),
    datasets: [{
      data: (dashboard.assetByCondition || []).map((row) => row.value),
      backgroundColor: chartPalette.slice(0, (dashboard.assetByCondition || []).length),
      borderWidth: 2,
      borderColor: "#FFFFFF",
    }],
  }), [dashboard.assetByCondition]);

  const categoryData = useMemo(() => ({
    labels: (dashboard.assetByCategory || []).map((row) => row.label),
    datasets: [{
      label: "Assets",
      data: (dashboard.assetByCategory || []).map((row) => row.value),
      backgroundColor: (dashboard.assetByCategory || []).map((_, index) => chartPalette[index % chartPalette.length]),
      borderRadius: 5,
    }],
  }), [dashboard.assetByCategory]);

  const chartState = (rows, title) => {
    if (loading) return <div className="admin-dashboard-chart-skeleton" aria-label={`Loading ${title}`} />;
    if (error) return <div className="admin-dashboard-inline-error" role="status">Chart data is unavailable.</div>;
    if (!rows.length || rows.every((row) => Number(row.value) === 0)) {
      return <div className="admin-dashboard-empty">No {title.toLowerCase()} data available.</div>;
    }
    return null;
  };

  return (
    <main className="admin-dashboard-page">
      <div className="admin-dashboard-heading">
        <PageHeader
          eyebrow="Administrator"
          title="Admin Dashboard"
          subtitle="A real-time overview of institutional assets, operations, inventory, and activity."
        />
        <button className="admin-dashboard-refresh" type="button" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {loading && (
        <div className="admin-dashboard-loading" aria-label="Loading administrator dashboard" role="status" />
      )}

      {error && (
        <div className="admin-dashboard-error" role="alert">
          <div><strong>Dashboard data could not be loaded.</strong><span>{error}</span></div>
          <button type="button" onClick={loadDashboard}>Try again</button>
        </div>
      )}

      <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-statistics">
        <div className="admin-dashboard-section-heading">
          <div><span className="admin-dashboard-eyebrow">Institution snapshot</span><h2 id="admin-dashboard-statistics">Asset Overview</h2></div>
        </div>
        <div className="admin-dashboard-stat-grid">
          {statCards.map((card) => <StatCard {...card} key={card.title} loading={loading} error={Boolean(error)} />)}
        </div>
      </section>

      <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-asset-distribution">
        <div className="admin-dashboard-section-heading">
          <div><span className="admin-dashboard-eyebrow">Asset portfolio</span><h2 id="admin-dashboard-asset-distribution">Asset distribution</h2></div>
        </div>
        <div className="admin-dashboard-chart-grid">
          <section className="admin-dashboard-panel" aria-labelledby="admin-dashboard-condition">
            <h3 id="admin-dashboard-condition">Asset condition</h3>
            {chartState(dashboard.assetByCondition || [], "Asset condition") || (
              <div className="admin-dashboard-chart" role="img" aria-label="Asset counts by condition">
                <Doughnut data={conditionData} options={chartOptions} />
              </div>
            )}
          </section>
          <section className="admin-dashboard-panel" aria-labelledby="admin-dashboard-category">
            <h3 id="admin-dashboard-category">Asset categories</h3>
            {chartState(dashboard.assetByCategory || [], "Asset category") || (
              <div className="admin-dashboard-chart" role="img" aria-label="Asset counts by category">
                <Bar data={categoryData} options={{ ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }} />
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-maintenance">
        <div className="admin-dashboard-section-heading">
          <div><span className="admin-dashboard-eyebrow">Work management</span><h2 id="admin-dashboard-maintenance">Maintenance overview</h2></div>
          <SafeLink className="admin-dashboard-text-link" to="/admin/maintenance">View maintenance <ArrowUpRight size={15} aria-hidden="true" /></SafeLink>
        </div>
        <div className="admin-dashboard-maintenance-grid">
          {maintenanceOverview.map((row) => (
            <SafeLink className="admin-dashboard-maintenance-card" to="/admin/maintenance" key={row.label}>
              <span>{row.label}</span>
              {loading ? <span className="admin-dashboard-value-skeleton" /> : error ? <strong className="admin-dashboard-stat-error">Unavailable</strong> : <strong>{numberFormat.format(row.value || 0)}</strong>}
            </SafeLink>
          ))}
        </div>
      </section>

      <div className="admin-dashboard-lower-grid">
        <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-inventory-alerts">
          <div className="admin-dashboard-section-heading">
            <div><span className="admin-dashboard-eyebrow">Inventory</span><h2 id="admin-dashboard-inventory-alerts">Inventory alerts</h2></div>
            <SafeLink className="admin-dashboard-text-link" to="/admin/inventory/quarantine">Open inventory <ArrowUpRight size={15} aria-hidden="true" /></SafeLink>
          </div>
          <div className="admin-dashboard-alert-list">
            {inventoryAlerts.map((alert) => (
              <SafeLink className="admin-dashboard-alert-row" to="/admin/inventory/quarantine" key={alert.label}>
                <span className="admin-dashboard-alert-icon"><ShieldAlert size={17} aria-hidden="true" /></span>
                <span>{alert.label}</span>
                {loading ? <span className="admin-dashboard-value-skeleton" /> : error ? <strong className="admin-dashboard-stat-error">Unavailable</strong> : <strong>{numberFormat.format(alert.value || 0)}</strong>}
                <ArrowUpRight size={14} aria-hidden="true" />
              </SafeLink>
            ))}
          </div>
        </section>

        <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-recent-activity">
          <div className="admin-dashboard-section-heading">
            <div><span className="admin-dashboard-eyebrow">Audit trail</span><h2 id="admin-dashboard-recent-activity">Recent activity</h2></div>
            <SafeLink className="admin-dashboard-text-link" to="/admin/audit-logs">View audit log <ArrowUpRight size={15} aria-hidden="true" /></SafeLink>
          </div>
          <div className="admin-dashboard-activity-list" aria-live="polite">
            {loading && <div className="admin-dashboard-empty">Loading recent activity…</div>}
            {error && <div className="admin-dashboard-inline-error" role="status">Activity data is unavailable.</div>}
            {!loading && !error && !(dashboard.recentActivity || []).length && <div className="admin-dashboard-empty">No recent activity recorded.</div>}
            {!loading && !error && (dashboard.recentActivity || []).map((item) => (
              <article className="admin-dashboard-activity-row" key={item.id}>
                <span className="admin-dashboard-activity-icon"><Activity size={16} aria-hidden="true" /></span>
                <div><strong>{item.label || item.action || "System event"}</strong><span>{item.entity || item.action || "System activity"}</span></div>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </article>
            ))}
          </div>
        </section>
      </div>

      <details className="admin-dashboard-thresholds">
        <summary><Settings2 size={17} aria-hidden="true" /> Configurable dashboard thresholds</summary>
        <form onSubmit={saveThresholds}>
          <p>These saved settings control stock alerts, chemical expiration notices, and the maintenance escalation window.</p>
          <div className="admin-dashboard-threshold-fields">
            <label>Low stock threshold (%)
              <input type="number" min="0.1" max="100" step="0.1" value={thresholds.lowStockPercent} onChange={(event) => setThresholds((current) => ({ ...current, lowStockPercent: event.target.value }))} required />
            </label>
            <label>Chemical expiration notice (days)
              <input type="number" min="1" max="3650" step="1" value={thresholds.expirationNoticeDays} onChange={(event) => setThresholds((current) => ({ ...current, expirationNoticeDays: event.target.value }))} required />
            </label>
            <label>Escalation window (hours)
              <input type="number" min="1" max="8760" step="1" value={thresholds.escalationHours} onChange={(event) => setThresholds((current) => ({ ...current, escalationHours: event.target.value }))} required />
            </label>
            <button className="admin-dashboard-save-button" type="submit" disabled={savingThresholds || loading}>
              {savingThresholds ? "Saving…" : "Save thresholds"}
            </button>
          </div>
          {thresholdError && <p className="admin-dashboard-form-error" role="alert">{thresholdError}</p>}
          {thresholdMessage && <p className="admin-dashboard-form-success" role="status">{thresholdMessage}</p>}
        </form>
      </details>
    </main>
  );
}

export default AdminDashboard;
