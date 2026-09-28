import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  BarChart3,
  Calendar,
  Package,
  FlaskConical,
  RefreshCw,
} from 'lucide-react';
import { getMaintenanceDashboard } from '../../services/maintenanceApi';
import './MaintDashboard.css';

const MaintDashboard = () => {
  const [period, setPeriod] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const dash = await getMaintenanceDashboard(period);
        if (!mounted) return;
        setDashboardData(dash);
      } catch (err) {
        if (mounted) setError('Unable to load maintenance dashboard data. Please check the server connection.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [period, reloadKey]);

  const summary = dashboardData?.summary || {};
  const recentRequests = dashboardData?.recentRequests || [];
  const recentWorkOrders = dashboardData?.recentWorkOrders || [];
  const technicianWorkload = dashboardData?.technicianWorkload || [];
  const statusBreakdown = dashboardData?.statusDistribution || [];
  const monthlyTrend = dashboardData?.monthlyTrend || [];
  const phaseStats = dashboardData?.workPhases || { completedJobs: 0, waitingForParts: 0, testing: 0 };
  const nextScheduled = dashboardData?.nextScheduledMaintenance;
  const nextPreventive = nextScheduled
    ? `${nextScheduled.asset} · ${nextScheduled.maintenanceType} · ${String(nextScheduled.scheduledDate).slice(0, 10)}`
    : 'No upcoming maintenance';
  const formatDate = (value) => value ? String(value).slice(0, 10) : '—';
  const statusColors = {
    pending: '#f59e0b', approved: '#0ea5e9', assigned: '#6366f1',
    'in-progress': '#3b82f6', 'waiting-for-parts': '#f97316', testing: '#a855f7',
    completed: '#10b981', rejected: '#ef4444', cancelled: '#64748b',
  };
  const statusTotal = statusBreakdown.reduce((total, row) => total + row.count, 0);
  const trendMax = Math.max(1, ...monthlyTrend.flatMap((row) => [row.requests, row.completed]));
  const phases = [
    { label: 'Completed Jobs', value: phaseStats.completedJobs },
    { label: 'Waiting for Parts', value: phaseStats.waitingForParts },
    { label: 'Testing', value: phaseStats.testing },
  ];
  const phaseMax = Math.max(1, ...phases.map((phase) => phase.value));

  const kpiCards = [
    {
      title: 'Total Maintenance Requests',
      value: summary.totalRequests,
      icon: AlertCircle,
      color: 'blue',
      trend: 'Selected period',
    },
    {
      title: 'Pending Requests',
      value: summary.pendingRequests,
      icon: Clock,
      color: 'orange',
      trend: summary.totalRequests ? `${Math.round((summary.pendingRequests / summary.totalRequests) * 100)}% of total` : 'No requests',
    },
    {
      title: 'In Progress',
      value: summary.inProgress,
      icon: BarChart3,
      color: 'cyan',
      trend: summary.totalRequests ? `${Math.round((summary.inProgress / summary.totalRequests) * 100)}% of total` : 'No requests',
    },
    {
      title: 'Completed Repairs',
      value: summary.completedRepairs,
      icon: CheckCircle,
      color: 'green',
      trend: summary.totalRequests ? `${Math.round((summary.completedRepairs / summary.totalRequests) * 100)}% of total` : 'No requests',
    },
    {
      title: 'Overdue Work Orders',
      value: summary.overdueWorkOrders,
      icon: AlertCircle,
      color: 'red',
      trend: 'Past due',
    },
    {
      title: 'Assets Under Maintenance',
      value: summary.assetsUnderMaintenance,
      icon: TrendingUp,
      color: 'purple',
      trend: 'Current asset status',
    },
    {
      title: 'Waiting on Parts',
      value: summary.waitingForParts,
      icon: Package,
      color: 'indigo',
      trend: 'requests awaiting spare parts',
    },
    {
      title: 'In Testing',
      value: summary.inTesting,
      icon: FlaskConical,
      color: 'pink',
      trend: 'requests in testing/verification',
    },
  ];

  const getPriorityColor = (priority) => {
    const colors = {
      Critical: '#ef4444',
      High: '#f97316',
      Medium: '#eab308',
      Low: '#10b981',
    };
    return colors[priority] || '#06b6d4';
  };

  const getStatusColor = (status) => {
    const colors = {
      Pending: '#f59e0b',
      'In Progress': '#3b82f6',
      Completed: '#10b981',
      Overdue: '#ef4444',
    };
    return colors[status] || '#06b6d4';
  };

  const getColorClass = (color) => {
    const classMap = {
      blue: 'kpi-card-blue',
      orange: 'kpi-card-orange',
      cyan: 'kpi-card-cyan',
      green: 'kpi-card-green',
      red: 'kpi-card-red',
      purple: 'kpi-card-purple',
      indigo: 'kpi-card-indigo',
      pink: 'kpi-card-pink',
    };
    return classMap[color] || '';
  };

  if (loading) return <div className="dashboard-state" role="status">Loading maintenance dashboard…</div>;
  if (error) return <div className="dashboard-state dashboard-error" role="alert">{error}<button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></div>;

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <div className="maintenance-dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Maintenance Management Dashboard</h1>
          <p className="dashboard-subtitle">
            University Asset Management System - Real-time Maintenance Operations
          </p>
        </div>

        <div className="header-controls">
          <div className="period-selector">
            {[
              ['Today', 'today'],
              ['7 Days', '7days'],
              ['30 Days', '30days'],
              ['90 Days', '90days'],
            ].map(([label, value]) => (
              <button
                key={value}
                className={`period-btn ${period === value ? 'active' : ''}`}
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="dashboard-refresh" type="button" onClick={() => setReloadKey((value) => value + 1)} aria-label="Refresh dashboard" title="Refresh dashboard">
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {!summary.hasRecords && <div className="dashboard-empty">No maintenance records</div>}

      {/* KPI Cards Grid */}
      <section className="kpi-section">
        <h2 className="section-title">Key Performance Indicators</h2>
        <div className="kpi-grid">
          {kpiCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className={`kpi-card ${getColorClass(card.color)}`}>
                <div className="kpi-header">
                  <div className="kpi-icon">
                    <Icon size={24} />
                  </div>
                  <div className={`kpi-trend ${card.trend.includes('-') ? 'negative' : 'positive'}`}>
                    {card.trend}
                  </div>
                </div>
                <div className="kpi-content">
                  <div className="kpi-value">{card.value}</div>
                  <div className="kpi-label">{card.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Charts Section */}
      <section className="charts-section">
        <div className="charts-grid">
          {/* Status Distribution Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Maintenance Status Distribution</h3>
            <div className="chart-placeholder">
              {statusBreakdown.length === 0 ? <div className="chart-empty">No maintenance records</div> : (
                <div className="status-bar">
                  {statusBreakdown.map((segment) => (
                    <div
                      className="status-segment"
                      style={{ width: `${Math.round((segment.count / statusTotal) * 100)}%`, backgroundColor: statusColors[segment.status] || '#06b6d4' }}
                      key={segment.status}
                    >
                      <span>{segment.label} ({segment.count})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Monthly Maintenance Trend</h3>
            <div className="chart-placeholder trend-chart">
              {monthlyTrend.length === 0 ? <div className="chart-empty">No maintenance records</div> : (
                <>
                  <div className="trend-legend"><span>Requests</span><span>Completed</span></div>
                  <div className="trend-bars">
                    {monthlyTrend.map((bucket) => (
                      <div key={bucket.period} className="trend-bar-item">
                        <div className="trend-bar-pair">
                          <div className="bar" title={`${bucket.requests} requests`} style={{ height: `${(bucket.requests / trendMax) * 100}%` }}></div>
                          <div className="bar completed-bar" title={`${bucket.completed} completed`} style={{ height: `${(bucket.completed / trendMax) * 100}%` }}></div>
                        </div>
                        <span className="bar-label">{bucket.period.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Repair Work Phase Breakdown */}
          <div className="chart-card">
            <h3 className="chart-title">Repair Work Phase Breakdown</h3>
            <div className="cost-breakdown">
              {phases.map((phase) => (
                <div className="cost-item" key={phase.label}>
                  <div className="cost-label">{phase.label}</div>
                  <div className="cost-bar">
                    <div className="cost-fill" style={{ width: `${(phase.value / phaseMax) * 100}%` }}></div>
                  </div>
                  <div className="cost-value">{phase.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Technician Workload */}
          <div className="chart-card">
            <h3 className="chart-title">Technician Workload</h3>
            {technicianWorkload.length === 0 ? <div className="chart-empty">No assignments yet</div> : (
              <div className="table-container">
                <table className="activity-table workload-table">
                  <thead><tr><th>Technician</th><th>Assigned</th><th>In Progress</th><th>Completed</th></tr></thead>
                  <tbody>{technicianWorkload.map((technician) => (
                    <tr key={technician.technicianId} className="table-row">
                      <td className="tech-cell">{technician.name}</td>
                      <td>{technician.assigned}</td>
                      <td>{technician.inProgress}</td>
                      <td>{technician.completed}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="activity-section">
        <div className="activity-grid">
          {/* Recent Maintenance Requests */}
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">Recent Maintenance Requests</h3>
              <Link to="/maintenance/requests" className="view-all-link">
                View All →
              </Link>
            </div>
            <div className="table-container">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Asset</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((req) => (
                    <tr key={req.id} className="table-row">
                      <td className="id-cell">{req.requestId}</td>
                      <td className="asset-cell">{req.asset}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ borderColor: getStatusColor(req.status) }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td>
                        <span className="priority-badge" style={{ borderColor: getPriorityColor(req.priority) }}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="date-cell">{formatDate(req.dueDate)}</td>
                    </tr>
                  ))}
                  {recentRequests.length === 0 && <tr><td colSpan="5" className="table-empty">No maintenance records</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Work Orders */}
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">Recent Work Orders</h3>
              <Link to="/maintenance/work-orders" className="view-all-link">
                View All →
              </Link>
            </div>
            <div className="table-container">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Work Order</th>
                    <th>Asset</th>
                    <th>Technician</th>
                    <th>Status</th>
                    <th>Assigned Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWorkOrders.map((wo) => (
                    <tr key={wo.id} className="table-row">
                      <td className="id-cell">{wo.workOrderNumber}</td>
                      <td className="asset-cell">{wo.asset}</td>
                      <td className="tech-cell">{wo.technician}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ borderColor: getStatusColor(wo.status) }}
                        >
                          {wo.status}
                        </span>
                      </td>
                      <td className="date-cell">{formatDate(wo.assignedDate)}</td>
                    </tr>
                  ))}
                  {recentWorkOrders.length === 0 && <tr><td colSpan="5" className="table-empty">No work orders found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats Footer */}
      <section className="quick-stats">
        <div className="stat-box">
          <Calendar size={20} />
          <div>
            <div className="stat-label">Next Scheduled Maintenance</div>
            <div className="stat-value">{nextPreventive}</div>
          </div>
        </div>
        <div className="stat-box">
          <AlertCircle size={20} />
          <div>
            <div className="stat-label">Critical Alerts</div>
            <div className="stat-value">{summary.criticalAlerts} Active</div>
          </div>
        </div>
        <div className="stat-box">
          <CheckCircle size={20} />
          <div>
            <div className="stat-label">Technician Efficiency</div>
            <div className="stat-value">{summary.technicianEfficiency === null ? 'Insufficient data' : `${summary.technicianEfficiency}%`}</div>
          </div>
        </div>
        <div className="stat-box">
          <TrendingUp size={20} />
          <div>
            <div className="stat-label">Assigned Staff</div>
            <div className="stat-value">{summary.assignedStaff}</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MaintDashboard;