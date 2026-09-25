import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, ClipboardList, Headphones, History, Package, RefreshCw, ShieldCheck, UserCheck, Wrench, Activity } from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import apiClient from "../../services/apiClient";
import "./ICTDashboard.css";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const safeNumber = (value) => Number(value || 0);

const getNestedArray = (payload, keys) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString() : "—";
};

const iconForActivity = { package: Package, "user-check": UserCheck, wrench: Wrench };
const displayLabel = (value) => String(value || "Unspecified").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const LoadingState = () => (
  <main className="ict-dashboard" aria-label="Loading dashboard">
    <div className="ict-loading-header">
      <div className="ict-skeleton-line long" />
      <div className="ict-skeleton-line short" />
    </div>
    <div className="ict-skeleton-grid">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="ict-skeleton-card" />
      ))}
    </div>
  </main>
);

const ErrorState = ({ message, onRetry }) => (
  <main className="ict-dashboard ict-empty-state-panel">
    <div className="ict-empty-panel">
      <AlertCircle size={36} />
      <h1>Unable to load dashboard data.</h1>
      <p>{message}</p>
      <button type="button" className="ict-primary-button" onClick={onRetry}>
        <RefreshCw size={15} /> Retry
      </button>
    </div>
  </main>
);

export default function ICTDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/api/ict/dashboard");
      const payload = response.data?.dashboard || response.data || {};
      const maintenance = getNestedArray(payload.maintenance, ["maintenance", "data"]);
      const requests = getNestedArray(payload.requests, ["requests", "data"]);
      const rfidDevices = getNestedArray(payload.rfidDevices, ["devices", "data"]);
      const assetSummary = payload.summary || payload.stats || {};
      const maintenanceSummary = payload.maintenanceSummary || {};
      const healthData = payload.health || { success: true, database: "connected" };
      const apiStatus = healthData.success === false ? "Unavailable" : "Operational";
      const databaseStatus = healthData.database === "connected" ? "Operational" : healthData.database === "unavailable" ? "Unavailable" : "Checking...";
      const rfidStatus = payload.rfidStatus || (rfidDevices.length > 0 ? "Operational" : "Not configured");

      setDashboard({
        assetSummary,
        totalAssets: safeNumber(assetSummary.total),
        maintenance,
        maintenanceSummary,
        requests,
        assetStatus: getNestedArray(payload.assetStatus, ["assetStatus"]),
        assetCategories: getNestedArray(payload.assetCategories, ["assetCategories"]),
        recentActivities: getNestedArray(payload.recentActivities, ["recentActivities"]),
        notifications: getNestedArray(payload.notifications, ["notifications"]),
        supportTickets: getNestedArray(payload.supportTickets, ["supportTickets"]),
        incidents: getNestedArray(payload.incidents, ["incidents"]),
        health: {
          api: apiStatus,
          database: databaseStatus,
          rfid: rfidStatus,
        },
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load dashboard data. Please try again.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) return;
      await loadDashboard();
    };

    load();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const metricCards = useMemo(() => {
    if (!dashboard) return [];
    const summary = dashboard.assetSummary;
    return [
      { label: "Total ICT Assets", value: dashboard.totalAssets, tone: "blue", icon: Package },
      { label: "Assigned Assets", value: summary.assigned || 0, tone: "green", icon: UserCheck },
      { label: "Available Assets", value: summary.available || 0, tone: "cyan", icon: CheckCircle2 },
      { label: "Maintenance", value: summary.maintenance || 0, tone: "amber", icon: Wrench },
      { label: "Repair Assets", value: summary.repair || 0, tone: "red", icon: AlertCircle },
      { label: "Pending Requests", value: summary.pendingRequests || 0, tone: "blue", icon: Activity },
      { label: "Open Incidents", value: summary.openIncidents || 0, tone: "red", icon: AlertCircle },
      { label: "Support Tickets", value: summary.openSupportTickets || 0, tone: "amber", icon: Headphones },
      { label: "Expiring Licenses", value: summary.expiringLicenses || 0, tone: "amber", icon: ShieldCheck },
    ];
  }, [dashboard]);

  const statusChart = useMemo(() => ({ labels: dashboard?.assetStatus.map((entry) => displayLabel(entry.label)) || [], datasets: [{ data: dashboard?.assetStatus.map((entry) => entry.count) || [], backgroundColor: ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#64748b"], borderWidth: 0 }] }), [dashboard]);
  const categoryChart = useMemo(() => ({ labels: dashboard?.assetCategories.map((entry) => displayLabel(entry.label)) || [], datasets: [{ label: "Assets", data: dashboard?.assetCategories.map((entry) => entry.count) || [], backgroundColor: "#2563eb", borderRadius: 4 }] }), [dashboard]);
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };

  if (loading) return <LoadingState />;
  if (error || !dashboard) return <ErrorState message={error || "Unable to load dashboard data. Please try again."} onRetry={loadDashboard} />;

  return (
    <main className="ict-dashboard">
      <header className="ict-dashboard-header">
        <div>
          <h1>ICT Dashboard</h1>
          <p>Overview of ICT asset operations and maintenance.</p>
        </div>
        <button type="button" className="ict-primary-button" onClick={loadDashboard} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </header>

      <section className="ict-summary-grid" aria-label="ICT dashboard overview">
        {metricCards.map(({ label, value, icon: Icon, tone }) => (
          <article className={`ict-stat-card ict-tone-${tone}`} key={label}>
            <div className="ict-stat-icon"><Icon size={18} /></div>
            <div className="ict-stat-copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="ict-panels-grid">
        <article className="ict-panel">
          <div className="ict-panel-header">
            <h2>Asset Status</h2>
            <Package size={18} />
          </div>
          {dashboard.assetStatus.length ? <div className="ict-chart-canvas doughnut"><Doughnut data={statusChart} options={chartOptions} aria-label="Asset status distribution" /></div> : (
            <div className="ict-empty-message">No asset status data available.</div>
          )}
        </article>

        <article className="ict-panel">
          <div className="ict-panel-header">
            <h2>Asset Categories</h2>
            <ClipboardList size={18} />
          </div>
          {dashboard.assetCategories.length ? <div className="ict-chart-canvas"><Bar data={categoryChart} options={chartOptions} aria-label="Asset category distribution" /></div> : <div className="ict-empty-message">No asset category data available.</div>}
        </article>
      </section>

      <section className="ict-panels-grid lower">
        <article className="ict-panel">
          <div className="ict-panel-header">
            <h2>Recent Activity</h2>
            <History size={18} />
          </div>
          {dashboard.recentActivities.length ? (
            <ul className="ict-activity-list">
              {dashboard.recentActivities.map((item) => {
                const Icon = iconForActivity[item.icon] || Package;
                return (
                  <li key={item.id} className="ict-activity-item">
                    <span className="ict-activity-icon"><Icon size={15} /></span>
                    <div className="ict-activity-copy">
                      <strong>{item.kind}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <time>{formatDateTime(item.time)}</time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="ict-empty-message">No recent activity</div>
          )}
        </article>

        <article className="ict-panel">
          <div className="ict-panel-header"><h2>Notifications</h2><Bell size={18} /></div>
          {dashboard.notifications.length ? <ul className="ict-activity-list">{dashboard.notifications.slice(0, 5).map((notification) => <li key={notification.id} className="ict-activity-item"><span className="ict-activity-icon"><Bell size={15} /></span><div className="ict-activity-copy"><strong>{notification.title || "Notification"}</strong><span>{notification.message}</span></div><time>{formatDateTime(notification.createdAt)}</time></li>)}</ul> : <div className="ict-empty-message">No notifications.</div>}
        </article>
      </section>

      <section className="ict-panels-grid">
        <article className="ict-panel">
          <div className="ict-panel-header"><h2>Requests</h2><ClipboardList size={18} /></div>
          {dashboard.requests.length ? <div className="ict-table-wrap"><table className="ict-table"><thead><tr><th>Request</th><th>Item</th><th>Priority</th><th>Status</th></tr></thead><tbody>{dashboard.requests.slice(0, 6).map((request) => <tr key={request.id}><td>{request.id || "-"}</td><td>{request.item || request.type || "Asset request"}</td><td>{displayLabel(request.priority)}</td><td>{displayLabel(request.status)}</td></tr>)}</tbody></table></div> : <div className="ict-empty-message">No pending requests.</div>}
        </article>
        <article className="ict-panel">
          <div className="ict-panel-header"><h2>Operational Overview</h2><ShieldCheck size={18} /></div>
          <div className="ict-health-list">
            <div className="ict-health-row">
              <span>Open incidents</span><strong>{dashboard.assetSummary.openIncidents || 0}</strong>
            </div>
            <div className="ict-health-row">
              <span>Upcoming maintenance</span><strong>{dashboard.assetSummary.upcomingMaintenance || 0}</strong>
            </div>
            <div className="ict-health-row">
              <span>Database</span><strong className={dashboard.health.database === "Operational" ? "healthy" : "warning"}>{dashboard.health.database}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
