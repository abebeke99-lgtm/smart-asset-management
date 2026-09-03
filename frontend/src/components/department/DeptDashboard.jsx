import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Pie } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

const DeptDashboard = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState({
    totalAssets: 0,
    inUse: 0,
    available: 0,
    underMaintenance: 0,
    pendingApprovals: 0,
    staffCount: 0,
    totalValue: 0,
    utilizationRate: 0,
    assetByStatus: [],
    assetByCategory: [],
    recentActivities: [],
    pendingRequests: [],
    maintenanceAlerts: [],
    recentAssignments: [],
    staffSummary: {}
  });
  const [showAlerts, setShowAlerts] = useState(true);
  const [timeRange, setTimeRange] = useState('week');

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      // Get department assets
      const assetsRes = await axios.get('/api/assets', { 
        params: { department: user?.department, limit: 500 }
      });
      const assets = assetsRes.data?.assets || [];

      // Get maintenance requests for department
      const maintRes = await axios.get('/api/maintenance', { 
        params: { department: user?.department, limit: 500 }
      });
      const maintenance = maintRes.data?.requests || [];

      // Get department staff
      const staffRes = await axios.get('/api/users', {
        params: { department: user?.department }
      });
      const staff = staffRes.data?.users || [];

      // Get pending approvals (maintenance requests pending approval)
      const pendingApprovals = maintenance.filter(m => 
        m.status === 'Pending Approval'
      );

      // Calculate stats
      const byStatus = assets.reduce((acc, a) => {
        const status = a.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const byCategory = assets.reduce((acc, a) => {
        const category = a.category_name || 'Other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const inUse = assets.filter(a => a.status === 'In-Use' || a.status === 'Assigned').length;
      const available = assets.filter(a => a.status === 'Available').length;
      const underMaintenance = assets.filter(a => a.status === 'Under-Maintenance' || a.status === 'In-Repair').length;
      
      const totalValue = assets.reduce((sum, a) => sum + (a.current_value || 0), 0);
      const utilizationRate = assets.length > 0 ? (inUse / assets.length) * 100 : 0;

      // Maintenance alerts (urgent or critical)
      const maintenanceAlerts = maintenance.filter(m => 
        (m.priority === 'Critical' || m.priority === 'High') && 
        (m.status === 'Pending' || m.status === 'In-Progress')
      );

      // Recent activities (last 10)
      const activities = [
        ...assets.slice(0, 5).map(a => ({
          type: 'asset',
          title: `${a.name}`,
          action: a.status === 'In-Use' ? 'assigned' : a.status === 'Available' ? 'returned' : 'updated',
          time: a.updated_at || a.created_at,
          icon: '📦',
          status: a.status
        })),
        ...maintenance.slice(0, 5).map(m => ({
          type: 'maintenance',
          title: m.title,
          action: m.status,
          time: m.updated_at || m.created_at,
          icon: '🔧',
          status: m.status
        }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

      // Staff summary by role
      const staffSummary = staff.reduce((acc, s) => {
        const role = s.role || 'Staff';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalAssets: assets.length,
        inUse,
        available,
        underMaintenance,
        pendingApprovals: pendingApprovals.length,
        staffCount: staff.length,
        totalValue,
        utilizationRate,
        assetByStatus: Object.entries(byStatus).map(([key, value]) => ({ label: key, value })),
        assetByCategory: Object.entries(byCategory).map(([key, value]) => ({ label: key, value })),
        recentActivities: activities,
        pendingRequests: maintenance.filter(m => m.status === 'Pending'),
        maintenanceAlerts,
        recentAssignments: assets.filter(a => a.status === 'In-Use').slice(0, 5),
        staffSummary
      });
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load dashboard data');
      setLoadError(t.fetchError || 'Failed to load dashboard data');
    }
    setLoading(false);
  };

  const generateFallbackStats = () => {
    const statuses = ['In-Use', 'Available', 'Under-Maintenance', 'In-Repair', 'Disposed'];
    const categories = ['Hardware', 'Software', 'Vehicles', 'Furniture', 'Machinery'];
    const roles = ['Manager', 'Supervisor', 'Staff', 'Intern', 'Contractor'];
    
    const byStatus = statuses.reduce((acc, s) => {
      acc[s] = Math.floor(Math.random() * 20) + 5;
      return acc;
    }, {});
    
    const byCategory = categories.reduce((acc, c) => {
      acc[c] = Math.floor(Math.random() * 30) + 10;
      return acc;
    }, {});

    const inUse = byStatus['In-Use'] || 0;
    const totalAssets = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const available = byStatus['Available'] || 0;
    const underMaintenance = (byStatus['Under-Maintenance'] || 0) + (byStatus['In-Repair'] || 0);

    return {
      totalAssets,
      inUse,
      available,
      underMaintenance,
      pendingApprovals: Math.floor(Math.random() * 8) + 1,
      staffCount: Math.floor(Math.random() * 50) + 20,
      totalValue: 500000 + Math.random() * 2000000,
      utilizationRate: (inUse / totalAssets) * 100,
      assetByStatus: Object.entries(byStatus).map(([key, value]) => ({ label: key, value })),
      assetByCategory: Object.entries(byCategory).map(([key, value]) => ({ label: key, value })),
      recentActivities: Array.from({ length: 8 }, (_, i) => ({
        type: i % 2 === 0 ? 'asset' : 'maintenance',
        title: `${i % 2 === 0 ? 'Laptop' : 'Printer'} ${i + 1}`,
        action: ['assigned', 'returned', 'updated', 'created', 'maintenance'][i % 5],
        time: new Date(Date.now() - i * 3600000).toISOString(),
        icon: i % 2 === 0 ? '📦' : '🔧',
        status: ['In-Use', 'Available', 'Under-Maintenance', 'Pending'][i % 4]
      })),
      pendingRequests: Array.from({ length: 4 }, (_, i) => ({
        id: `req_${i}`,
        title: `Request ${i + 1}`,
        status: 'Pending',
        priority: ['High', 'Medium', 'Low'][i % 3]
      })),
      maintenanceAlerts: Array.from({ length: 3 }, (_, i) => ({
        id: `alert_${i}`,
        title: `Critical Alert ${i + 1}`,
        priority: 'Critical',
        status: 'In-Progress',
        message: 'Urgent maintenance required'
      })),
      recentAssignments: Array.from({ length: 5 }, (_, i) => ({
        id: `ass_${i}`,
        name: `Asset ${i + 1}`,
        assigned_to: `User ${i + 1}`,
        date: new Date(Date.now() - i * 86400000).toISOString()
      })),
      staffSummary: roles.reduce((acc, r) => {
        acc[r] = Math.floor(Math.random() * 10) + 1;
        return acc;
      }, {})
    };
  };

  const handleStatClick = (type, filter = {}) => {
    const baseUrl = '/college';
    const routes = {
      'maintenance': `${baseUrl}/assets?status=Under-Maintenance,In-Repair`,
      'pendingApprovals': `${baseUrl}/maintenance?status=pending`,
      'inUse': `${baseUrl}/assets?status=In-Use,Assigned`,
      'available': `${baseUrl}/assets?status=Available`,
      'assets': `${baseUrl}/assets`,
      'staff': `${baseUrl}/staff`
    };
    
    const route = routes[type];
    if (route) {
      navigate(route);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'In-Use': '#48bb78',
      'Available': '#4299e1',
      'Under-Maintenance': '#ed8936',
      'In-Repair': '#fc8181',
      'Disposed': '#a0aec0',
      'Pending': '#f6ad55',
      'Pending Approval': '#ed8936',
      'Approved': '#48bb78',
      'Rejected': '#fc8181',
      'Completed': '#38a169'
    };
    return colors[status] || '#a0aec0';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Critical': '#fc8181',
      'High': '#ed8936',
      'Medium': '#f6ad55',
      'Low': '#48bb78'
    };
    return colors[priority] || '#a0aec0';
  };

  const chartColors = {
    primary: isDark ? '#63b3ed' : '#2b6cb0',
    success: isDark ? '#68d391' : '#48bb78',
    warning: isDark ? '#f6ad55' : '#ed8936',
    danger: isDark ? '#fc8181' : '#e53e3e',
    purple: isDark ? '#b794f4' : '#805ad5',
    pink: isDark ? '#f687b3' : '#d53f8c',
    teal: isDark ? '#81e6d9' : '#319795'
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#c8dcf5' : '#1a365d',
          boxWidth: 12,
          padding: 15
        }
      }
    },
    scales: {
      y: {
        ticks: { 
          color: isDark ? '#8896b0' : '#4a5568'
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { color: isDark ? '#8896b0' : '#4a5568' },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      }
    }
  };

  const statusChartData = {
    labels: stats.assetByStatus.map(item => item.label),
    datasets: [{
      label: 'Assets by Status',
      data: stats.assetByStatus.map(item => item.value),
      backgroundColor: ['#48bb78', '#4299e1', '#ed8936', '#fc8181', '#805ad5', '#a0aec0'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const categoryChartData = {
    labels: stats.assetByCategory.map(item => item.label),
    datasets: [{
      label: 'Assets by Category',
      data: stats.assetByCategory.map(item => item.value),
      backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#81e6d9'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1600px',
      margin: '0 auto',
      background: isDark ? '#0d1a2e' : '#f0f4f8',
      minHeight: '100vh'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      marginBottom: '24px'
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.75rem',
      fontWeight: 700,
      marginBottom: '4px'
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.95rem'
    },
    headerActions: {
      display: 'flex',
      gap: '10px',
      marginTop: '8px'
    },
    timeRangeButton: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      cursor: 'pointer',
      fontSize: '0.85rem'
    },
    activeTimeRange: {
      background: isDark ? '#2d4a6f' : '#2b6cb0',
      color: 'white',
      border: 'none'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,100,0.08)'
      }
    },
    statIcon: {
      fontSize: '1.8rem',
      marginBottom: '6px'
    },
    statNumber: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    statLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.8rem',
      marginTop: '2px'
    },
    statTrend: {
      fontSize: '0.75rem',
      color: isDark ? '#68d391' : '#38a169',
      marginTop: '4px'
    },
    chartsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    chartCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    chartTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      fontWeight: 600,
      marginBottom: '16px'
    },
    activityCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      marginBottom: '20px'
    },
    activityItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    activityIcon: {
      fontSize: '1.2rem',
      marginRight: '12px'
    },
    activityText: {
      flex: 1
    },
    activityTime: {
      fontSize: '0.75rem',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    statusBadge: {
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.7rem',
      fontWeight: 600,
      display: 'inline-block'
    },
    alertCard: {
      background: isDark ? 'rgba(252, 129, 129, 0.1)' : 'rgba(252, 129, 129, 0.05)',
      padding: '12px 16px',
      borderRadius: '8px',
      borderLeft: `4px solid ${chartColors.danger}`,
      marginBottom: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    staffBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '12px',
      fontSize: '0.8rem',
      color: isDark ? '#c8dcf5' : '#1a365d',
      marginRight: '4px'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <div>{t.loading}</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
          <div role="alert">{loadError}</div>
          <button type="button" onClick={fetchDashboardData} style={{ marginTop: '16px', padding: '10px 18px', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 {t.dashboard}</h1>
          <p style={styles.subtitle}>
            {t.welcome}, {user?.fullName || user?.username || 'User'} 👋
            <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568' }}>
              {user?.department || ''}
            </span>
          </p>
        </div>
        <div style={styles.headerActions}>
          <button 
            style={{
              ...styles.timeRangeButton,
              ...(timeRange === 'week' ? styles.activeTimeRange : {})
            }}
            onClick={() => setTimeRange('week')}
          >
            {t.thisWeek}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              ...(timeRange === 'month' ? styles.activeTimeRange : {})
            }}
            onClick={() => setTimeRange('month')}
          >
            {t.thisMonth}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              ...(timeRange === 'year' ? styles.activeTimeRange : {})
            }}
            onClick={() => setTimeRange('year')}
          >
            {t.thisYear}
          </button>
        </div>
      </div>

      {/* Stats Grid - Clickable */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard} onClick={() => handleStatClick('assets')}>
          <div style={styles.statIcon}>📦</div>
          <div style={styles.statNumber}>{stats.totalAssets}</div>
          <div style={styles.statLabel}>{t.totalAssets}</div>
        </div>

        <div style={styles.statCard} onClick={() => handleStatClick('inUse')}>
          <div style={styles.statIcon}>✅</div>
          <div style={{ ...styles.statNumber, color: chartColors.success }}>{stats.inUse}</div>
          <div style={styles.statLabel}>{t.inUse}</div>
          <div style={styles.statTrend}>{stats.utilizationRate.toFixed(1)}% {t.utilization}</div>
        </div>

        <div style={styles.statCard} onClick={() => handleStatClick('available')}>
          <div style={styles.statIcon}>📋</div>
          <div style={{ ...styles.statNumber, color: chartColors.primary }}>{stats.available}</div>
          <div style={styles.statLabel}>{t.available}</div>
        </div>

        <div style={styles.statCard} onClick={() => handleStatClick('maintenance')}>
          <div style={styles.statIcon}>🔧</div>
          <div style={{ ...styles.statNumber, color: chartColors.warning }}>{stats.underMaintenance}</div>
          <div style={styles.statLabel}>{t.underMaintenance}</div>
          {stats.maintenanceAlerts.length > 0 && (
            <div style={{ ...styles.statTrend, color: chartColors.danger }}>
              ⚠️ {stats.maintenanceAlerts.length} {t.criticalAlerts}
            </div>
          )}
        </div>

        <div style={styles.statCard} onClick={() => handleStatClick('pendingApprovals')}>
          <div style={styles.statIcon}>⚠️</div>
          <div style={{ ...styles.statNumber, color: chartColors.warning }}>{stats.pendingApprovals}</div>
          <div style={styles.statLabel}>{t.pendingApprovals}</div>
        </div>

        <div style={styles.statCard} onClick={() => handleStatClick('staff')}>
          <div style={styles.statIcon}>👥</div>
          <div style={styles.statNumber}>{stats.staffCount}</div>
          <div style={styles.statLabel}>{t.staffCount}</div>
          <div style={{ marginTop: '4px' }}>
            {Object.entries(stats.staffSummary || {}).slice(0, 3).map(([role, count]) => (
              <span key={role} style={styles.staffBadge}>{role}: {count}</span>
            ))}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>💰</div>
          <div style={styles.statNumber}>${stats.totalValue.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.totalValue}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={styles.chartsRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByStatus}</h3>
          <div style={{ height: '250px' }}>
            <Doughnut data={statusChartData} options={chartOptions} />
          </div>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByCategory}</h3>
          <div style={{ height: '250px' }}>
            <Pie data={categoryChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Maintenance Alerts */}
      {stats.maintenanceAlerts.length > 0 && showAlerts && (
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>🚨 {t.maintenanceAlerts}</h3>
          {stats.maintenanceAlerts.map((alert, index) => (
            <div key={index} style={styles.alertCard}>
              <div>
                <strong>{alert.title}</strong>
                <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {alert.message || ''}
                </span>
              </div>
              <div>
                <span style={{
                  ...styles.statusBadge,
                  background: `${getPriorityColor(alert.priority)}22`,
                  color: getPriorityColor(alert.priority)
                }}>
                  {alert.priority}
                </span>
                <span style={{
                  ...styles.statusBadge,
                  background: `${getStatusColor(alert.status)}22`,
                  color: getStatusColor(alert.status),
                  marginLeft: '8px'
                }}>
                  {alert.status}
                </span>
              </div>
            </div>
          ))}
          <button 
            style={{ 
              ...styles.timeRangeButton, 
              marginTop: '8px',
              color: isDark ? '#8896b0' : '#4a5568'
            }}
            onClick={() => setShowAlerts(false)}
          >
            {t.dismissAlerts}
          </button>
        </div>
      )}

      {/* Recent Activities */}
      <div style={styles.activityCard}>
        <h3 style={styles.chartTitle}>{t.recentActivities}</h3>
        {stats.recentActivities.length === 0 ? (
          <p style={styles.emptyState}>{t.noRecentActivities}</p>
        ) : (
          stats.recentActivities.map((activity, index) => (
            <div key={index} style={styles.activityItem}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={styles.activityIcon}>{activity.icon}</span>
                <div style={styles.activityText}>
                  <div>{activity.title}</div>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                    {activity.action}
                    {activity.status && (
                      <span style={{
                        ...styles.statusBadge,
                        background: `${getStatusColor(activity.status)}22`,
                        color: getStatusColor(activity.status),
                        marginLeft: '8px'
                      }}>
                        {activity.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={styles.activityTime}>
                {new Date(activity.time).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Assignments & Pending Requests */}
      <div style={styles.chartsRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.recentAssignments}</h3>
          {stats.recentAssignments.length === 0 ? (
            <p style={styles.emptyState}>{t.noRecentAssignments}</p>
          ) : (
            stats.recentAssignments.map((assignment, index) => (
              <div key={index} style={styles.activityItem}>
                <div>
                  <div style={{ fontWeight: 500 }}>{assignment.name}</div>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                    {t.assignedTo}: {assignment.assigned_to}
                  </div>
                </div>
                <div style={styles.activityTime}>
                  {new Date(assignment.date).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.pendingRequests}</h3>
          {stats.pendingRequests.length === 0 ? (
            <p style={styles.emptyState}>{t.noPendingRequests}</p>
          ) : (
            stats.pendingRequests.map((request, index) => (
              <div key={index} style={styles.activityItem}>
                <div>
                  <div style={{ fontWeight: 500 }}>{request.title}</div>
                  <div style={{ fontSize: '0.8rem' }}>
                    <span style={{
                      ...styles.statusBadge,
                      background: `${getPriorityColor(request.priority)}22`,
                      color: getPriorityColor(request.priority)
                    }}>
                      {request.priority}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.pending}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={styles.activityCard}>
        <h3 style={styles.chartTitle}>⚡ {t.quickActions}</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: isDark ? '#2d4a6f' : '#2b6cb0',
              color: 'white',
              border: 'none'
            }}
            onClick={() => navigate('/college/assets')}
          >
            {t.viewAllAssets}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: isDark ? '#2d4a6f' : '#38a169',
              color: 'white',
              border: 'none'
            }}
            onClick={() => navigate('/college/maintenance')}
          >
            {t.newRequest}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: isDark ? '#2d4a6f' : '#805ad5',
              color: 'white',
              border: 'none'
            }}
            onClick={() => navigate('/college/staff')}
          >
            {t.manageStaff}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: isDark ? '#2d4a6f' : '#ed8936',
              color: 'white',
              border: 'none'
            }}
            onClick={() => navigate('/college/reports')}
          >
            {t.viewReports}
          </button>
        </div>
      </div>
    </div>
  );
};

// Translations
const englishTranslations = {
  dashboard: 'College Dashboard',
  welcome: 'Welcome',
  totalAssets: 'Total Assets',
  inUse: 'In Use',
  available: 'Available',
  underMaintenance: 'Under Maintenance',
  pendingApprovals: 'Pending Approvals',
  staffCount: 'Staff',
  totalValue: 'Total Value',
  assetsByStatus: 'Assets by Status',
  assetsByCategory: 'Assets by Category',
  recentActivities: 'Recent Activities',
  noRecentActivities: 'No recent activities',
  loading: 'Loading...',
  utilization: 'Utilization',
  criticalAlerts: 'Critical Alerts',
  maintenanceAlerts: 'Maintenance Alerts',
  dismissAlerts: 'Dismiss Alerts',
  recentAssignments: 'Recent Assignments',
  noRecentAssignments: 'No recent assignments',
  pendingRequests: 'Pending Requests',
  noPendingRequests: 'No pending requests',
  assignedTo: 'Assigned To',
  pending: 'Pending',
  quickActions: 'Quick Actions',
  viewAllAssets: 'View All Assets',
  newRequest: 'New Request',
  manageStaff: 'Manage Staff',
  viewReports: 'View Reports',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  thisYear: 'This Year',
  fetchError: 'Failed to load dashboard data'
};

const amharicTranslations = {
  dashboard: 'የክፍል ዳሽቦርድ',
  welcome: 'እንኳን ደህና መጡ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  inUse: 'በመጠቀም ላይ',
  available: 'ይገኛል',
  underMaintenance: 'በጥገና ላይ',
  pendingApprovals: 'በመጠባበቅ ላይ',
  staffCount: 'ሰራተኞች',
  totalValue: 'ጠቅላላ ዋጋ',
  assetsByStatus: 'በሁኔታ የተከፋፈሉ ንብረቶች',
  assetsByCategory: 'በምድብ የተከፋፈሉ ንብረቶች',
  recentActivities: 'የቅርብ ጊዜ እንቅስቃሴዎች',
  noRecentActivities: 'ምንም የቅርብ ጊዜ እንቅስቃሴዎች የሉም',
  loading: 'በመጫን ላይ...',
  utilization: 'አጠቃቀም',
  criticalAlerts: 'አስቸኳይ ማስጠንቀቂያዎች',
  maintenanceAlerts: 'የጥገና ማስጠንቀቂያዎች',
  dismissAlerts: 'ማስጠንቀቂያዎችን ዝጋ',
  recentAssignments: 'የቅርብ ጊዜ ምደባዎች',
  noRecentAssignments: 'ምንም የቅርብ ጊዜ ምደባዎች የሉም',
  pendingRequests: 'በመጠባበቅ ላይ ያሉ ጥያቄዎች',
  noPendingRequests: 'ምንም በመጠባበቅ ላይ ያሉ ጥያቄዎች የሉም',
  assignedTo: 'ተመድቧል',
  pending: 'በመጠባበቅ ላይ',
  quickActions: 'ፈጣን ተግባራት',
  viewAllAssets: 'ሁሉንም ንብረቶች ይመልከቱ',
  newRequest: 'አዲስ ጥያቄ',
  manageStaff: 'ሰራተኞችን ያስተዳድሩ',
  viewReports: 'ሪፖርቶችን ይመልከቱ',
  thisWeek: 'የዚህ ሳምንት',
  thisMonth: 'የዚህ ወር',
  thisYear: 'የዚህ ዓመት',
  fetchError: 'የዳሽቦርድ ውሂብ ማግኘት አልተቻለም'
};

export default DeptDashboard;