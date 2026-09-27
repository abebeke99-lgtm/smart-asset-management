import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Bell, CheckCircle2, ClipboardList, Database, Headphones, History, Package, RefreshCw, ShieldCheck, UserCheck, Wrench, Activity } from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import apiClient from "../../services/apiClient";
import "./ICTDashboard.css";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString() : "—";
};

const iconForActivity = { package: Package, "user-check": UserCheck, wrench: Wrench, history: History, activity: Activity };
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
      const payload = response.data?.dashboard;
      const requiredCounts = ["totalAssets", "assignedAssets", "availableAssets", "maintenanceAssets", "repairAssets", "pendingRequests", "openIncidents", "supportTickets", "expiringLicenses"];
      const requiredArrays = ["assetStatus", "assetCategories", "recentActivity", "notifications", "requests"];
      if (response.data?.success !== true || !payload) throw new Error(response.data?.message || "The dashboard response is incomplete.");
      if (requiredCounts.some((key) => !Number.isFinite(Number(payload[key]))) || requiredArrays.some((key) => !Array.isArray(payload[key])) || !payload.operationalOverview || !payload.databaseStatus?.status) {
        throw new Error("The dashboard response is incomplete. Please retry or contact support.");
      }
      setDashboard(payload);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || "Unable to load dashboard data. Please try again.");
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
    return [
      { label: "Total ICT Assets", value: dashboard.totalAssets, tone: "blue", icon: Package },
      { label: "Assigned Assets", value: dashboard.assignedAssets, tone: "green", icon: UserCheck },
      { label: "Available Assets", value: dashboard.availableAssets, tone: "cyan", icon: CheckCircle2 },
      { label: "Maintenance", value: dashboard.maintenanceAssets, tone: "amber", icon: Wrench },
      { label: "Repair Assets", value: dashboard.repairAssets, tone: "red", icon: AlertCircle },
      { label: "Pending Requests", value: dashboard.pendingRequests, tone: "blue", icon: Activity },
      { label: "Open Incidents", value: dashboard.openIncidents, tone: "red", icon: AlertCircle },
      { label: "Support Tickets", value: dashboard.supportTickets, tone: "amber", icon: Headphones },
      { label: "Expiring Licenses", value: dashboard.expiringLicenses, tone: "amber", icon: ShieldCheck },
    ];
  }, [dashboard]);

  const statusChart = useMemo(() => ({ labels: dashboard?.assetStatus.map((entry) => displayLabel(entry.label)) || [], datasets: [{ data: dashboard?.assetStatus.map((entry) => entry.count) || [], backgroundColor: ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#64748b"], borderWidth: 0 }] }), [dashboard]);
  const categoryChart = useMemo(() => ({ labels: dashboard?.assetCategories.map((entry) => displayLabel(entry.label)) || [], datasets: [{ label: "Assets", data: dashboard?.assetCategories.map((entry) => entry.count) || [], backgroundColor: "#2563eb", borderRadius: 4 }] }), [dashboard]);
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };
  const hasData = dashboard && (metricCards.some(({ value }) => Number(value) > 0) || dashboard.recentActivity.length > 0 || dashboard.notifications.length > 0 || dashboard.requests.length > 0);

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

      {!hasData && <div className="ict-empty-message" role="status">No data available.</div>}

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
          {dashboard.recentActivity.length ? (
            <ul className="ict-activity-list">
              {dashboard.recentActivity.map((item) => {
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
            <div className="ict-empty-message">No recent activity.</div>
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
          {dashboard.requests.length ? <div className="ict-table-wrap"><table className="ict-table"><thead><tr><th>Request</th><th>Requester</th><th>Department</th><th>Type / Item</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{dashboard.requests.slice(0, 6).map((request) => <tr key={request.id}><td>{request.requestId || "-"}</td><td>{request.requester}</td><td>{request.department}</td><td>{request.item || request.type}</td><td>{formatDateTime(request.createdAt)}</td><td>{displayLabel(request.status)}</td><td><Link to="/ict/asset-requests" aria-label={`Review request ${request.requestId}`}>Review</Link></td></tr>)}</tbody></table></div> : <div className="ict-empty-message">No pending requests.</div>}
        </article>
        <article className="ict-panel">
          <div className="ict-panel-header"><h2>Operational Overview</h2><Database size={18} /></div>
          <div className="ict-health-list">
            <div className="ict-health-row">
              <span>Open incidents</span><strong>{dashboard.operationalOverview.openIncidents}</strong>
            </div>
            <div className="ict-health-row">
              <span>Upcoming maintenance</span><strong>{dashboard.operationalOverview.upcomingMaintenance}</strong>
            </div>
            <div className="ict-health-row">
              <span>Database</span><strong className={dashboard.databaseStatus.status === "connected" ? "healthy" : "warning"}>{displayLabel(dashboard.databaseStatus.status)}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
