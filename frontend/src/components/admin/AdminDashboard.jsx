import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Users,
  Wrench,
} from "lucide-react";
import { Link, useInRouterContext } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../services/apiClient";
import { useLanguage } from "../../contexts/UiContext";
import { translateMessage, translateStatus } from "../../i18n/messages";
import PageHeader from "./ui/PageHeader";
import "./AdminDashboard.css";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const readThemeColor = (property, fallback) => {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(property).trim() || fallback;
};
const chartPalette = [
  readThemeColor("--color-chart-1", "#0057B8"),
  readThemeColor("--color-chart-5", "#0284C7"),
  readThemeColor("--color-chart-2", "#F59E0B"),
  readThemeColor("--color-chart-4", "#16A34A"),
  readThemeColor("--color-chart-6", "#DC2626"),
  readThemeColor("--color-chart-7", "#7C3AED"),
];
const emptyDashboard = {
  statistics: {},
  assetByCondition: [],
  assetByCategory: [],
  recentActivity: [],
  thresholds: {},
};
const emptyStatistics = Object.freeze({});
const defaultThresholds = {
  lowStockPercent: 10,
  expirationNoticeDays: 30,
  escalationHours: 72,
};
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};
const numberFormat = new Intl.NumberFormat();

const SafeLink = React.forwardRef(({ to, children, ...props }, ref) => {
  const inRouter = useInRouterContext();

  if (!inRouter) {
    const href = typeof to === "string" ? to : to?.pathname || "/";
    return <a ref={ref} href={href} {...props}>{children}</a>;
  }

  return <Link ref={ref} to={to} {...props}>{children}</Link>;
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

const StatCard = ({ title, value, icon: Icon, to, loading, error, tr, tone = "primary" }) => (
  <SafeLink className={`admin-dashboard-stat-card admin-dashboard-stat-card--${tone}`} to={to} aria-label={`${title}: ${error ? "unavailable" : numberFormat.format(value || 0)}`}>
    <span className="admin-dashboard-stat-icon"><Icon size={19} aria-hidden="true" /></span>
    <span className="admin-dashboard-stat-copy">
      <span className="admin-dashboard-stat-title">{title}</span>
      {loading ? (
        <span className="admin-dashboard-value-skeleton" aria-label={tr("dashboard.adminHome.loadingStatistic")} />
      ) : error ? (
        <span className="admin-dashboard-stat-error">{tr("dashboard.adminHome.unavailable")}</span>
      ) : (
        <strong>{numberFormat.format(value || 0)}</strong>
      )}
    </span>
    <ArrowUpRight className="admin-dashboard-stat-link-icon" size={15} aria-hidden="true" />
  </SafeLink>
);

function AdminDashboard() {
  const { language } = useLanguage();
  const tr = useCallback((key, fallback) => translateMessage(language, key, fallback), [language]);
  const languageRef = useRef(language);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState("");
  const [thresholdError, setThresholdError] = useState("");

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    let timeoutHandle;

    try {
      const response = await Promise.race([
        apiClient.get("/api/admin/dashboard", { timeout: 15000 }),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error("DASHBOARD_TIMEOUT")), 15000);
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
      const message = requestError?.message === "DASHBOARD_TIMEOUT"
        ? translateMessage(languageRef.current, "dashboard.adminHome.dashboardTimeout")
        : getApiErrorMessage(requestError, translateMessage(languageRef.current, "dashboard.adminHome.dashboardLoadError"));
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
      setThresholdMessage(tr("dashboard.adminHome.thresholdsSaved"));
      await loadDashboard();
    } catch (saveError) {
      setThresholdError(getApiErrorMessage(saveError, tr("dashboard.adminHome.thresholdsSaveError")));
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
  const statCards = useMemo(() => [
    { title: tr("dashboard.adminStats.totalAssets"), value: assetStats.total, icon: Package, to: "/admin/assets", tone: "primary" },
    { title: tr("dashboard.adminStats.activeAssets"), value: assetStats.active, icon: Activity, to: "/admin/assets", tone: "success" },
    { title: tr("dashboard.adminStats.damagedAssets"), value: assetStats.damaged, icon: Archive, to: "/admin/assets?status=damaged", tone: "warning" },
    { title: tr("dashboard.adminStats.replacedAssets"), value: assetStats.replaced, icon: RefreshCw, to: "/admin/assets?status=replaced", tone: "info" },
    { title: tr("dashboard.adminStats.expiredAssets"), value: assetStats.expired, icon: Clock3, to: "/admin/assets?status=expired", tone: "danger" },
    { title: tr("dashboard.adminStats.retiredAssets", "Retired Assets"), value: assetStats.retired, icon: Archive, to: "/admin/assets?status=retired", tone: "neutral" },
    ...(assetStats.otherStatuses || []).map(({ status, count }) => {
      const label = String(status || "Unknown").replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
      return { title: `${label} Assets`, value: count, icon: Archive, to: `/admin/assets?status=${encodeURIComponent(status || "unknown")}`, tone: "neutral" };
    }),
    { title: tr("dashboard.adminStats.totalUsers"), value: organizationStats.users, icon: Users, to: "/admin/users", tone: "info" },
    { title: tr("dashboard.adminStats.colleges"), value: organizationStats.colleges, icon: Building2, to: "/admin/colleges", tone: "primary" },
    { title: tr("dashboard.adminStats.departments"), value: organizationStats.departments, icon: Building2, to: "/admin/departments", tone: "primary" },
    { title: tr("dashboard.adminStats.openServiceRequests"), value: workflowStats.openServiceRequests, icon: Bell, to: "/admin/maintenance/requests", tone: "warning" },
    { title: tr("dashboard.adminStats.pendingApprovals"), value: workflowStats.pendingApprovals, icon: CheckCircle2, to: "/admin/approvals/pending", tone: "warning" },
    { title: tr("dashboard.adminStats.lowStockItems"), value: inventoryStats.lowStockItems, icon: Boxes, to: "/admin/inventory/quarantine", tone: "warning" },
    { title: tr("dashboard.adminStats.expiringChemicals"), value: inventoryStats.expiringChemicals, icon: FlaskConical, to: "/admin/inventory/quarantine", tone: "warning" },
    { title: tr("dashboard.adminStats.assetsUnderMaintenance"), value: assetStats.underMaintenance, icon: Wrench, to: "/admin/maintenance", tone: "warning" },
    { title: tr("dashboard.adminStats.overdueMaintenance"), value: maintenanceStats.overdue, icon: CalendarClock, to: "/admin/maintenance", tone: "danger" },
  ], [assetStats, organizationStats, workflowStats, inventoryStats, maintenanceStats, tr]);

  const conditionData = useMemo(() => ({
    labels: (dashboard.assetByCondition || []).map((row) => translateStatus(language, row.label)),
    datasets: [{
      data: (dashboard.assetByCondition || []).map((row) => row.value),
      backgroundColor: chartPalette.slice(0, (dashboard.assetByCondition || []).length),
      borderWidth: 2,
      borderColor: readThemeColor("--color-surface", "#FFFFFF"),
    }],
  }), [dashboard.assetByCondition, language]);

  const categoryData = useMemo(() => ({
    labels: (dashboard.assetByCategory || []).map((row) => row.label),
    datasets: [{
      label: tr("navigation.assets"),
      data: (dashboard.assetByCategory || []).map((row) => row.value),
      backgroundColor: (dashboard.assetByCategory || []).map((_, index) => chartPalette[index % chartPalette.length]),
      borderRadius: 5,
    }],
  }), [dashboard.assetByCategory, tr]);
  const recentActivity = Array.isArray(dashboard.recentActivity) ? dashboard.recentActivity : [];
  const activityDateFormatter = useMemo(() => new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }), [language]);

  const chartState = (rows, title) => {
    if (loading) return <div className="admin-dashboard-chart-skeleton" aria-label={`Loading ${title}`} />;
    if (error) return <div className="admin-dashboard-inline-error" role="status">{tr("dashboard.adminHome.chartUnavailable")}</div>;
    if (!rows.length || rows.every((row) => Number(row.value) === 0)) {
      const emptyKey = title === "Asset condition" ? "noConditionData" : "noCategoryData";
      return <div className="admin-dashboard-empty">{tr(`dashboard.adminHome.${emptyKey}`)}</div>;
    }
    return null;
  };

  return (
    <main className="admin-dashboard-page">
      <div className="admin-dashboard-heading">
        <PageHeader
          eyebrow={tr("dashboard.adminHome.administrator")}
          title={tr("dashboard.adminHome.title")}
          subtitle={tr("dashboard.adminHome.subtitle")}
        />
        <button className="admin-dashboard-refresh" type="button" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> {tr("dashboard.adminHome.refresh")}
        </button>
      </div>

      {loading && (
        <div className="admin-dashboard-loading" aria-label={tr("dashboard.adminHome.dashboardLoading")} role="status" />
      )}

      {error && (
        <div className="admin-dashboard-error" role="alert">
          <div><strong>{tr("dashboard.adminHome.dashboardLoadTitle")}</strong><span>{error}</span></div>
          <button type="button" onClick={loadDashboard}>{tr("dashboard.adminHome.tryAgain")}</button>
        </div>
      )}

      <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-statistics">
        <div className="admin-dashboard-section-heading">
          <div><span className="admin-dashboard-eyebrow">{tr("dashboard.adminHome.institutionSnapshot")}</span><h2 id="admin-dashboard-statistics">{tr("dashboard.adminHome.assetOverview")}</h2></div>
        </div>
        <div className="admin-dashboard-stat-grid">
          {statCards.map((card) => <StatCard {...card} tr={tr} key={card.title} loading={loading} error={Boolean(error)} />)}
        </div>
      </section>

      <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-asset-distribution">
        <div className="admin-dashboard-section-heading">
          <div><span className="admin-dashboard-eyebrow">{tr("dashboard.adminHome.assetPortfolio")}</span><h2 id="admin-dashboard-asset-distribution">{tr("dashboard.adminHome.assetDistribution")}</h2></div>
        </div>
        <div className="admin-dashboard-chart-grid">
          <section className="admin-dashboard-panel" aria-labelledby="admin-dashboard-condition">
            <h3 id="admin-dashboard-condition">{tr("dashboard.adminHome.assetCondition")}</h3>
            {chartState(dashboard.assetByCondition || [], "Asset condition") || (
              <div className="admin-dashboard-chart" role="img" aria-label={tr("dashboard.adminHome.assetCondition")}>
                <Doughnut data={conditionData} options={chartOptions} />
              </div>
            )}
          </section>
          <section className="admin-dashboard-panel" aria-labelledby="admin-dashboard-category">
            <h3 id="admin-dashboard-category">{tr("dashboard.adminHome.assetCategories")}</h3>
            {chartState(dashboard.assetByCategory || [], "Asset category") || (
              <div className="admin-dashboard-chart" role="img" aria-label={tr("dashboard.adminHome.assetCategories")}>
                <Bar data={categoryData} options={{ ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }} />
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="admin-dashboard-section" aria-labelledby="admin-dashboard-recent-activity">
        <div className="admin-dashboard-section-heading">
          <div>
            <span className="admin-dashboard-eyebrow">{tr("dashboard.adminHome.recentActivityDescription")}</span>
            <h2 id="admin-dashboard-recent-activity">{tr("dashboard.adminHome.recentActivity")}</h2>
          </div>
        </div>
        {recentActivity.length ? (
          <ul className="admin-dashboard-activity-list">
            {recentActivity.map((entry) => {
              const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;
              const validDate = createdAt && !Number.isNaN(createdAt.getTime());
              return (
                <li className="admin-dashboard-activity-item" key={entry.id}>
                  <div>
                    <strong>{entry.label || entry.action || tr("dashboard.adminHome.systemEvent")}</strong>
                    {entry.entity && <span>{entry.entity}</span>}
                  </div>
                  {validDate && <time dateTime={createdAt.toISOString()}>{activityDateFormatter.format(createdAt)}</time>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="admin-dashboard-empty">{tr("dashboard.adminHome.noActivity")}</div>
        )}
      </section>

      <details className="admin-dashboard-thresholds">
        <summary><Settings2 size={17} aria-hidden="true" /> {tr("dashboard.adminHome.thresholds")}</summary>
        <form onSubmit={saveThresholds}>
          <p>{tr("dashboard.adminHome.thresholdsDescription")}</p>
          <div className="admin-dashboard-threshold-fields">
            <label>{tr("dashboard.adminHome.lowStockPercent")}
              <input type="number" min="0.1" max="100" step="0.1" value={thresholds.lowStockPercent} onChange={(event) => setThresholds((current) => ({ ...current, lowStockPercent: event.target.value }))} required />
            </label>
            <label>{tr("dashboard.adminHome.expirationNoticeDays")}
              <input type="number" min="1" max="3650" step="1" value={thresholds.expirationNoticeDays} onChange={(event) => setThresholds((current) => ({ ...current, expirationNoticeDays: event.target.value }))} required />
            </label>
            <label>{tr("dashboard.adminHome.escalationHours")}
              <input type="number" min="1" max="8760" step="1" value={thresholds.escalationHours} onChange={(event) => setThresholds((current) => ({ ...current, escalationHours: event.target.value }))} required />
            </label>
            <button className="admin-dashboard-save-button" type="submit" disabled={savingThresholds || loading}>
              {savingThresholds ? tr("dashboard.adminHome.saving") : tr("dashboard.adminHome.save")}
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
