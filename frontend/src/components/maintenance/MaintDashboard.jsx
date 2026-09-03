import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  BarChart3,
  Calendar,
} from 'lucide-react';
import './MaintDashboard.css';

const MaintDashboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('30days');
  const [dashboardData, setDashboardData] = useState({
    totalRequests: 42,
    pendingRequests: 15,
    inProgress: 8,
    completed: 19,
    overdueWorkOrders: 3,
    assetsUnderMaintenance: 12,
    monthlyMaintenanceCost: 24500,
    averageDowntime: 240,
  });

  const [recentRequests, setRecentRequests] = useState([
    { id: 'MR-001', asset: 'Server Room AC', status: 'In Progress', priority: 'High', dueDate: '2026-09-05' },
    { id: 'MR-002', asset: 'Parking Lights', status: 'Pending', priority: 'Medium', dueDate: '2026-09-08' },
    { id: 'MR-003', asset: 'Water Pump', status: 'Completed', priority: 'High', dueDate: '2026-09-01' },
    { id: 'MR-004', asset: 'Door Lock System', status: 'Overdue', priority: 'Critical', dueDate: '2026-08-28' },
  ]);

  const [recentWorkOrders, setRecentWorkOrders] = useState([
    { id: 'WO-001', asset: 'Main Generator', technician: 'John Doe', status: 'In Progress', assignedDate: '2026-08-30' },
    { id: 'WO-002', asset: 'HVAC Unit', technician: 'Jane Smith', status: 'Pending', assignedDate: '2026-09-01' },
    { id: 'WO-003', asset: 'Electrical Panel', technician: 'Mike Johnson', status: 'Completed', assignedDate: '2026-08-25' },
  ]);

  const kpiCards = [
    {
      title: 'Total Maintenance Requests',
      value: dashboardData.totalRequests,
      icon: AlertCircle,
      color: 'blue',
      trend: '+12%',
    },
    {
      title: 'Pending Requests',
      value: dashboardData.pendingRequests,
      icon: Clock,
      color: 'orange',
      trend: '+5%',
    },
    {
      title: 'In Progress',
      value: dashboardData.inProgress,
      icon: BarChart3,
      color: 'cyan',
      trend: '-3%',
    },
    {
      title: 'Completed Repairs',
      value: dashboardData.completed,
      icon: CheckCircle,
      color: 'green',
      trend: '+8%',
    },
    {
      title: 'Overdue Work Orders',
      value: dashboardData.overdueWorkOrders,
      icon: AlertCircle,
      color: 'red',
      trend: '+2%',
    },
    {
      title: 'Assets Under Maintenance',
      value: dashboardData.assetsUnderMaintenance,
      icon: TrendingUp,
      color: 'purple',
      trend: '0%',
    },
    {
      title: 'Monthly Maintenance Cost',
      value: `$${dashboardData.monthlyMaintenanceCost.toLocaleString()}`,
      icon: BarChart3,
      color: 'indigo',
      trend: '+15%',
    },
    {
      title: 'Average Downtime',
      value: `${dashboardData.averageDowntime}h`,
      icon: Clock,
      color: 'pink',
      trend: '-12%',
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

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">🏢 Maintenance Management Dashboard</h1>
          <p className="dashboard-subtitle">
            Smart University Asset Management System - Real-time Maintenance Operations
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
                <div className="status-segment" style={{ width: '35%', backgroundColor: '#f59e0b' }}>
                  <span>Pending (35%)</span>
                </div>
                <div className="status-segment" style={{ width: '30%', backgroundColor: '#3b82f6' }}>
                  <span>In Progress (30%)</span>
                </div>
                <div className="status-segment" style={{ width: '25%', backgroundColor: '#10b981' }}>
                  <span>Completed (25%)</span>
                </div>
                <div className="status-segment" style={{ width: '10%', backgroundColor: '#ef4444' }}>
                  <span>Overdue (10%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Monthly Maintenance Trend</h3>
            <div className="chart-placeholder trend-chart">
              <div className="trend-bars">
                {[45, 52, 48, 61, 55, 67, 72].map((val, idx) => (
                  <div key={idx} className="trend-bar-item">
                    <div className="bar" style={{ height: `${val}%` }}></div>
                    <span className="bar-label">{['Aug', 'Sep'][idx % 2]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cost Analysis */}
          <div className="chart-card">
            <h3 className="chart-title">Repair Cost Analysis</h3>
            <div className="cost-breakdown">
              <div className="cost-item">
                <div className="cost-label">Labor</div>
                <div className="cost-bar">
                  <div className="cost-fill" style={{ width: '45%' }}></div>
                </div>
                <div className="cost-value">$11,025</div>
              </div>
              <div className="cost-item">
                <div className="cost-label">Parts</div>
                <div className="cost-bar">
                  <div className="cost-fill" style={{ width: '35%' }}></div>
                </div>
                <div className="cost-value">$8,575</div>
              </div>
              <div className="cost-item">
                <div className="cost-label">Other</div>
                <div className="cost-bar">
                  <div className="cost-fill" style={{ width: '20%' }}></div>
                </div>
                <div className="cost-value">$4,900</div>
              </div>
            </div>
          </div>

          {/* Technician Workload */}
          <div className="chart-card">
            <h3 className="chart-title">Technician Workload</h3>
            <div className="workload-list">
              {[
                { name: 'John Doe', workload: 85 },
                { name: 'Jane Smith', workload: 70 },
                { name: 'Mike Johnson', workload: 92 },
              ].map((tech, idx) => (
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
            <div className="stat-label">Next Preventive Maintenance</div>
            <div className="stat-value">2026-09-05</div>
          </div>
        </div>
        <div className="stat-box">
          <AlertCircle size={20} />
          <div>
            <div className="stat-label">Critical Alerts</div>
            <div className="stat-value">3 Active</div>
          </div>
        </div>
        <div className="stat-box">
          <CheckCircle size={20} />
          <div>
            <div className="stat-label">System Uptime</div>
            <div className="stat-value">98.5%</div>
          </div>
        </div>
        <div className="stat-box">
          <TrendingUp size={20} />
          <div>
            <div className="stat-label">Technician Efficiency</div>
            <div className="stat-value">94.2%</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MaintDashboard;
