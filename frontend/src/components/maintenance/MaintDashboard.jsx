import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { getMaintenance, getMaintenanceDashboard, getAssets } from '../../services/maintenanceApi';
import './MaintDashboard.css';

const MaintDashboard = () => {
  const [period, setPeriod] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    total: 0,
    pending: 0,
    active: 0,
    completed: 0,
    byStatus: {},
  });
  const [assetsUnderMaintenance, setAssetsUnderMaintenance] = useState([]);
  const [totalAssets, setTotalAssets] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dash, list, under] = await Promise.all([
          getMaintenanceDashboard(),
          getMaintenance({ limit: 100 }),
          getAssets({ status: 'under-maintenance', limit: 1000 }),
        ]);
        const all = await getAssets({ limit: 1000 }).catch(() => []);
        if (!mounted) return;
        setDashboardData({ total: dash.total || 0, pending: dash.pending || 0, active: dash.active || 0, completed: dash.completed || 0, byStatus: dash.byStatus || {} });
        setItems(list);
        setAssetsUnderMaintenance(under);
        setTotalAssets(all.length);
      } catch (err) {
        if (mounted) setError(err && err.message ? err.message : 'Failed to load dashboard data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const overdueCount = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return items.filter((it) => {
      const stale = new Date(it.created || it.updated).getTime() < cutoff;
      return stale && !['completed', 'rejected', 'cancelled'].includes(it.statusRaw);
    }).length;
  }, [items]);

  const criticalAlerts = useMemo(() => items.filter((it) => it.priority === 'Critical' && !['completed', 'rejected', 'cancelled'].includes(it.statusRaw)).length, [items]);

  const efficiency = useMemo(() => {
    if (!dashboardData.total) return 0;
    return Math.round((dashboardData.completed / dashboardData.total) * 100);
  }, [dashboardData]);

  const nextPreventive = useMemo(() => {
    const upcoming = items.find((it) => it.statusRaw === 'pending' || it.statusRaw === 'approved');
    return upcoming && upcoming.created ? String(upcoming.created).slice(0, 10) : '—';
  }, [items]);

  const recentRequests = useMemo(() => items.slice(0, 4).map((r) => ({
    id: r.refId,
    asset: r.asset,
    status: r.status,
    priority: r.priority,
    dueDate: r.updated ? String(r.updated).slice(0, 10) : '—',
  })), [items]);

  const recentWorkOrders = useMemo(() => items
    .filter((r) => r.technician && ['assigned', 'in-progress', 'testing', 'waiting-for-parts', 'completed'].includes(r.statusRaw))
    .slice(0, 3)
    .map((r) => ({
      id: r.woId,
      asset: r.asset,
      technician: r.technician,
      status: r.status,
      assignedDate: r.created ? String(r.created).slice(0, 10) : '—',
    })), [items]);

  const kpiCards = [
    {
      title: 'Total Maintenance Requests',
      value: dashboardData.total,
      icon: AlertCircle,
      color: 'blue',
      trend: `${items.length} loaded`,
    },
    {
      title: 'Pending Requests',
      value: dashboardData.pending,
      icon: Clock,
      color: 'orange',
      trend: dashboardData.total ? `${Math.round((dashboardData.pending / (dashboardData.total || 1)) * 100)}% of total` : '0%',
    },
    {
      title: 'In Progress',
      value: dashboardData.active,
      icon: BarChart3,
      color: 'cyan',
      trend: dashboardData.total ? `${Math.round((dashboardData.active / (dashboardData.total || 1)) * 100)}% of total` : '0%',
    },
    {
      title: 'Completed Repairs',
      value: dashboardData.completed,
      icon: CheckCircle,
      color: 'green',
      trend: dashboardData.total ? `${Math.round((dashboardData.completed / (dashboardData.total || 1)) * 100)}% of total` : '0%',
    },
    {
      title: 'Overdue Work Orders',
      value: overdueCount,
      icon: AlertCircle,
      color: 'red',
      trend: '14+ days open',
    },
    {
      title: 'Assets Under Maintenance',
      value: assetsUnderMaintenance.length,
      icon: TrendingUp,
      color: 'purple',
      trend: totalAssets ? `${Math.round((assetsUnderMaintenance.length / (totalAssets || 1)) * 100)}% of assets` : '0%',
    },
    {
      title: 'Monthly Maintenance Cost',
      value: '$0',
      icon: BarChart3,
      color: 'indigo',
      trend: 'no cost data tracked',
    },
    {
      title: 'Average Downtime',
      value: `${'0'}h`,
      icon: Clock,
      color: 'pink',
      trend: 'no downtime data tracked',
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

  const statusBreakdown = useMemo(() => {
    const total = dashboardData.total || 1;
    const rows = [
      { label: `Pending (${Math.round((dashboardData.pending / total) * 100)}%)`, value: dashboardData.pending, color: '#f59e0b' },
      { label: `In Progress (${Math.round((dashboardData.active / total) * 100)}%)`, value: dashboardData.active, color: '#3b82f6' },
      { label: `Completed (${Math.round((dashboardData.completed / total) * 100)}%)`, value: dashboardData.completed, color: '#10b981' },
      { label: `Overdue (${Math.round((overdueCount / total) * 100)}%)`, value: overdueCount, color: '#ef4444' },
    ];
    return rows.filter((r) => r.value > 0).length ? rows.filter((r) => r.value > 0) : [{ label: 'No maintenance records', value: 0, color: '#cbd5e1' }];
  }, [dashboardData, overdueCount]);

  const statusPercent = (value) => `${Math.max(4, Math.round((value / (dashboardData.total || 1)) * 100))}%`;

  const monthlyTrend = useMemo(() => {
    const buckets = {};
    items.forEach((it) => {
      const month = it.created ? String(it.created).slice(0, 7) : null;
      if (!month) return;
      buckets[month] = (buckets[month] || 0) + 1;
    });
    const sorted = Object.keys(buckets).sort();
    const max = Math.max(1, ...sorted.map((m) => buckets[m]));
    return sorted.slice(-7).map((m) => ({ label: m.slice(5), value: buckets[m], height: Math.max(10, Math.round((buckets[m] / max) * 80)) }));
  }, [items]);

  const phaseStats = useMemo(() => {
    const count = (status) => items.filter((it) => it.statusRaw === status).length;
    const completed = dashboardData.completed;
    const waiting = count('waiting-for-parts');
    const testing = count('testing');
    const max = Math.max(1, completed, waiting, testing);
    return [
      { label: 'Completed Jobs', value: completed, percent: Math.round((completed / max) * 100) },
      { label: 'Waiting for Parts', value: waiting, percent: Math.round((waiting / max) * 100) },
      { label: 'Testing', value: testing, percent: Math.round((testing / max) * 100) },
    ];
  }, [items, dashboardData]);

  const technicianWorkload = useMemo(() => {
    const counts = {};
    items.forEach((it) => {
      if (!it.technician) return;
      counts[it.technician] = (counts[it.technician] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return Object.keys(counts).map((name) => ({ name, workload: Math.round((counts[name] / max) * 100) }));
  }, [items]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading dashboard…</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: '#991b1b' }}>Failed to load dashboard: {error}</div>;

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">🏢 Maintenance Management Dashboard</h1>
          <p className="dashboard-subtitle">
            University Asset Management System - Real-time Maintenance Operations
          </p>
        </div>

        <div className="header-controls">
          <div className="period-selector">
            {['Today', '7 Days', '30 Days', '90 Days'].map((label, idx) => (
              <button
                key={label}
                className={`period-btn ${period === ['today', '7days', '30days', '90days'][idx] ? 'active' : ''}`}
                onClick={() => setPeriod(['today', '7days', '30days', '90days'][idx])}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

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
              <div className="status-bar">
                {statusBreakdown.map((seg) => (
                  <div className="status-segment" style={{ width: statusPercent(seg.value), backgroundColor: seg.color }} key={seg.label}>
                    <span>{seg.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Monthly Maintenance Trend</h3>
            <div className="chart-placeholder trend-chart">
              <div className="trend-bars">
                {monthlyTrend.map((bucket) => (
                  <div key={bucket.label} className="trend-bar-item">
                    <div className="bar" style={{ height: `${bucket.height}%` }}></div>
                    <span className="bar-label">{bucket.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cost Analysis */}
          <div className="chart-card">
            <h3 className="chart-title">Repair Work Phase Breakdown</h3>
            <div className="cost-breakdown">
              {phaseStats.map((p) => (
                <div className="cost-item" key={p.label}>
                  <div className="cost-label">{p.label}</div>
                  <div className="cost-bar">
                    <div className="cost-fill" style={{ width: `${p.percent}%` }}></div>
                  </div>
                  <div className="cost-value">{p.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Technician Workload */}
          <div className="chart-card">
            <h3 className="chart-title">Technician Workload</h3>
            <div className="workload-list">
              {technicianWorkload.length === 0 && <div className="workload-item"><div className="tech-name">No assignments yet</div></div>}
              {technicianWorkload.map((tech, idx) => (
                <div key={idx} className="workload-item">
                  <div className="tech-name">{tech.name}</div>
                  <div className="workload-bar">
                    <div className="workload-fill" style={{ width: `${tech.workload}%` }}></div>
                  </div>
                  <div className="workload-percent">{tech.workload}%</div>
                </div>
              ))}
            </div>
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
              <a href="/maintenance/requests" className="view-all-link">
                View All →
              </a>
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
                      <td className="id-cell">{req.id}</td>
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
                      <td className="date-cell">{req.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Work Orders */}
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">Recent Work Orders</h3>
              <a href="/maintenance/work-orders" className="view-all-link">
                View All →
              </a>
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
                      <td className="id-cell">{wo.id}</td>
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
                      <td className="date-cell">{wo.assignedDate}</td>
                    </tr>
                  ))}
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
            <div className="stat-value">{criticalAlerts} Active</div>
          </div>
        </div>
        <div className="stat-box">
          <CheckCircle size={20} />
          <div>
            <div className="stat-label">Technician Efficiency</div>
            <div className="stat-value">{efficiency}%</div>
          </div>
        </div>
        <div className="stat-box">
          <TrendingUp size={20} />
          <div>
            <div className="stat-label">Assigned Staff</div>
            <div className="stat-value">{technicianWorkload.length}</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MaintDashboard;