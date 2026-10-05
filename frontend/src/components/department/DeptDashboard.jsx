import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Pie } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { Activity, AlertTriangle, ClipboardList, CircleCheck, DollarSign, LayoutDashboard, LoaderCircle, Package, RefreshCw, Users, Wrench, Zap } from 'lucide-react';
import { CHART_PALETTE, CHART_TEXT, NOTIFICATION_TONES } from '../../utils/chartPalette';
import { translateMessage } from '../../i18n/messages';
import './DeptDashboard.css';

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
    pendingRequestCount: 0,
    pendingTransfers: 0,
    pendingReturns: 0,
    pendingActions: 0,
    staffCount: 0,
    staffWithAssignedAssets: 0,
    staffWithoutAssignedAssets: 0,
    totalValue: 0,
    utilizationRate: 0,
    assetByStatus: [],
    assetByCategory: [],
    assetByLocation: [],
    assetByCondition: [],
recentActivities: [],
  pendingRequests: [],
  maintenanceAlerts: [],
  recentAssignments: [],
  staffSummary: {},
  maintenanceSummary: { open: 0, inProgress: 0, completed: 0, overdue: 0 },
  verificationSummary: { verifiedAssets: 0, pendingVerification: 0, verificationIssues: 0 }
});
const [showAlerts, setShowAlerts] = useState(true);

  const isDark = theme === 'dark';
  const t = { ...(language === 'en' ? englishTranslations : amharicTranslations), loading: translateMessage(language, 'departmentLoading.dashboard') };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const dashboardRes = await apiClient.get('/department/dashboard');
      const dashboard = dashboardRes.data?.data || dashboardRes.data || {};

      setStats({
        totalAssets: Number(dashboard.totalAssets) || 0,
        inUse: Number(dashboard.assignedAssets) || 0,
        available: Number(dashboard.availableAssets) || 0,
        underMaintenance: Number(dashboard.underMaintenance) || 0,
        pendingRequestCount: Number(dashboard.pendingRequests) || 0,
        pendingTransfers: Number(dashboard.pendingTransfers) || 0,
        pendingReturns: Number(dashboard.pendingReturns) || 0,
        pendingActions: Number(dashboard.pendingActions) || 0,
        staffCount: Number(dashboard.staffCount) || 0,
        staffWithAssignedAssets: Number(dashboard.staffWithAssignedAssets) || 0,
        staffWithoutAssignedAssets: Number(dashboard.staffWithoutAssignedAssets) || 0,
        totalValue: Number(dashboard.assetValue) || 0,
        utilizationRate: (Number(dashboard.utilizationRate) || 0) * 100,
        assetByStatus: Array.isArray(dashboard.assetByStatus) ? dashboard.assetByStatus : [],
        assetByCategory: Array.isArray(dashboard.assetByCategory) ? dashboard.assetByCategory : [],
        assetByLocation: Array.isArray(dashboard.assetByLocation) ? dashboard.assetByLocation : [],
        assetByCondition: Array.isArray(dashboard.assetByCondition) ? dashboard.assetByCondition : [],
        recentActivities: Array.isArray(dashboard.recentActivities) ? dashboard.recentActivities : [],
        pendingRequests: Array.isArray(dashboard.pendingRequestItems) ? dashboard.pendingRequestItems : [],
        maintenanceAlerts: Array.isArray(dashboard.maintenanceAlerts) ? dashboard.maintenanceAlerts : [],
        recentAssignments: Array.isArray(dashboard.recentAssignments) ? dashboard.recentAssignments : [],
        maintenanceSummary: dashboard.maintenanceSummary || { open: 0, inProgress: 0, completed: 0, overdue: 0 },
        verificationSummary: dashboard.verificationSummary || { verifiedAssets: 0, pendingVerification: 0, verificationIssues: 0 },
      });
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load dashboard data');
      setLoadError(t.fetchError || 'Failed to load dashboard data');
    }
    setLoading(false);
  };

  const handleStatClick = (type, filter = {}) => {
    const baseUrl = '/department';
    const routes = {
      'maintenance': `${baseUrl}/maintenance`,
      'inUse': `${baseUrl}/assets?status=In-Use,Assigned`,
      'available': `${baseUrl}/assets?status=Available`,
      'assets': `${baseUrl}/assets`,
      'staff': `${baseUrl}/staff`,
      'requests': `${baseUrl}/requests`
    };
    
    const route = routes[type];
    if (route) {
      navigate(route);
    }
  };

  const getStatusTone = (status) => {
    if (['In-Use', 'Available', 'Approved', 'Completed'].includes(status)) return NOTIFICATION_TONES.success;
    if (['Under-Maintenance', 'Pending', 'Pending Approval'].includes(status)) return NOTIFICATION_TONES.warning;
    if (['In-Repair', 'Rejected'].includes(status)) return NOTIFICATION_TONES.danger;
    if (status === 'Disposed') return NOTIFICATION_TONES.neutral;
    return NOTIFICATION_TONES.neutral;
  };

  const getPriorityTone = (priority) => {
    if (priority === 'Critical') return NOTIFICATION_TONES.danger;
    if (priority === 'High' || priority === 'Medium') return NOTIFICATION_TONES.warning;
    if (priority === 'Low') return NOTIFICATION_TONES.success;
    return NOTIFICATION_TONES.neutral;
  };

  const getActivityIcon = (type) => {
    const icons = {
      assignment: ClipboardList,
      transfer: RefreshCw,
      return: Package,
      maintenance: Wrench,
      verification: CircleCheck,
    };
    const Icon = icons[type] || Activity;
    return <Icon size={18} strokeWidth={1.8} aria-hidden="true" />;
  };

  const chartColors = {
    primary: CHART_PALETTE[0],
    success: NOTIFICATION_TONES.success.text,
    warning: NOTIFICATION_TONES.warning.text,
    danger: NOTIFICATION_TONES.danger.text,
    purple: CHART_PALETTE[2],
    pink: CHART_PALETTE[5],
    teal: CHART_PALETTE[4]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: CHART_TEXT.primary,
          boxWidth: 12,
          padding: 15
        }
      }
    },
    scales: {
      y: {
        ticks: { 
          color: CHART_TEXT.secondary
        },
        grid: { color: CHART_TEXT.grid }
      },
      x: {
        ticks: { color: CHART_TEXT.secondary },
        grid: { color: CHART_TEXT.grid }
      }
    }
  };

  const statusChartData = {
    labels: stats.assetByStatus.map(item => item.label),
    datasets: [{
      label: 'Assets by Status',
      data: stats.assetByStatus.map(item => item.value),
      backgroundColor: CHART_PALETTE,
      borderColor: CHART_TEXT.surface,
      borderWidth: 2
    }]
  };

  const categoryChartData = {
    labels: stats.assetByCategory.map(item => item.label),
    datasets: [{
      label: 'Assets by Category',
      data: stats.assetByCategory.map(item => item.value),
      backgroundColor: CHART_PALETTE,
      borderColor: CHART_TEXT.surface,
      borderWidth: 2
    }]
  };

  const locationChartData = {
    labels: stats.assetByLocation.map(item => item.label),
    datasets: [{
      label: 'Assets by Location',
      data: stats.assetByLocation.map(item => item.value),
      backgroundColor: CHART_PALETTE,
      borderColor: CHART_TEXT.surface,
      borderWidth: 2
    }]
  };

  const conditionChartData = {
    labels: stats.assetByCondition.map(item => item.label),
    datasets: [{
      label: 'Assets by Condition',
      data: stats.assetByCondition.map(item => item.value),
      backgroundColor: CHART_PALETTE,
      borderColor: CHART_TEXT.surface,
      borderWidth: 2
    }]
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1600px',
      margin: '0 auto',
      background: 'var(--color-background)',
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
      color: 'var(--color-text-primary)',
      fontSize: '1.75rem',
      fontWeight: 700,
      marginBottom: '4px'
    },
    subtitle: {
      color: 'var(--color-text-secondary-on-page)',
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
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      color: 'var(--color-text-primary)',
      cursor: 'pointer',
      fontSize: '0.85rem'
    },
    activeTimeRange: {
      background: 'var(--color-primary)',
      color: 'var(--color-surface)',
      border: 'none'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      background: 'var(--color-surface)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: 'var(--shadow-dashboard-card-hover)'
      }
    },
    statIcon: {
      fontSize: '1.8rem',
      marginBottom: '6px'
    },
    statNumber: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: 'var(--color-text-primary)'
    },
    statLabel: {
      color: 'var(--color-text-secondary-on-page)',
      fontSize: '0.8rem',
      marginTop: '2px'
    },
    statTrend: {
      fontSize: '0.75rem',
      color: 'var(--color-success-text)',
      marginTop: '4px'
    },
    chartsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    chartCard: {
      background: 'var(--color-surface)',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-dashboard-card)'
    },
    chartTitle: {
      color: 'var(--color-text-primary)',
      fontSize: '0.95rem',
      fontWeight: 600,
      marginBottom: '16px'
    },
    activityCard: {
      background: 'var(--color-surface)',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-dashboard-card)',
      marginBottom: '20px'
    },
    activityItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid var(--color-border)',
      color: 'var(--color-text-primary)'
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
      color: 'var(--color-text-secondary-on-page)'
    },
    statusBadge: {
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.7rem',
      fontWeight: 600,
      display: 'inline-block'
    },
    alertCard: {
      background: 'var(--color-danger-light)',
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
      color: 'var(--color-text-secondary-on-page)'
    },
    staffBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      background: 'var(--color-neutral-light)',
      borderRadius: '12px',
      fontSize: '0.8rem',
      color: 'var(--color-neutral-text)',
      marginRight: '4px'
    }
  };

  if (loading) {
    return (
      <div className="dept-dashboard" style={styles.container}>
        <div className="dept-dashboard__empty" style={styles.emptyState}>
          <LoaderCircle size={30} strokeWidth={1.8} aria-hidden="true" />
          <div>{t.loading}</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dept-dashboard" style={styles.container}>
        <div className="dept-dashboard__empty" style={styles.emptyState}>
          <AlertTriangle size={30} strokeWidth={1.8} aria-hidden="true" />
          <div role="alert">{loadError}</div>
          <button type="button" onClick={fetchDashboardData} style={{ marginTop: '16px', padding: '10px 18px', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  const isCollegeManagerRole = ['college', 'college_manager', 'college manager'].includes(String(user?.role || '').toLowerCase());

  return (
    <div className="dept-dashboard" style={styles.container}>
      {/* Header */}
      <div className="dept-dashboard__header" style={styles.header}>
        <div>
          <h1 className="dept-dashboard__title" style={styles.title}><LayoutDashboard size={26} strokeWidth={1.8} aria-hidden="true" /> {t.dashboard}</h1>
          <p className="dept-dashboard__subtitle" style={styles.subtitle}>
            {t.welcome}, {user?.fullName || user?.username || 'User'}
            {!isCollegeManagerRole && (
              <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: 'var(--color-text-secondary-on-page)' }}>
                {user?.department || ''}
              </span>
            )}
          </p>
        </div>

      </div>

      {/* Stats Grid - Clickable */}
      <div className="dept-dashboard__stats" style={styles.statsGrid}>
        <div className="dept-dashboard__stat" style={styles.statCard} onClick={() => handleStatClick('assets')}>
          <div style={styles.statIcon}><Package size={26} strokeWidth={1.8} aria-hidden="true" /></div>
          <div style={styles.statNumber}>{stats.totalAssets}</div>
          <div style={styles.statLabel}>{t.totalAssets}</div>
        </div>

        <div className="dept-dashboard__stat" style={styles.statCard} onClick={() => handleStatClick('inUse')}>
          <div style={styles.statIcon}><CircleCheck size={26} strokeWidth={1.8} aria-hidden="true" /></div>
          <div style={{ ...styles.statNumber, color: chartColors.success }}>{stats.inUse}</div>
          <div style={styles.statLabel}>{t.inUse}</div>
          <div style={styles.statTrend}>{stats.utilizationRate.toFixed(1)}% {t.utilization}</div>
        </div>

        <div className="dept-dashboard__stat" style={styles.statCard} onClick={() => handleStatClick('available')}>
          <div style={styles.statIcon}><ClipboardList size={26} strokeWidth={1.8} aria-hidden="true" /></div>
          <div style={{ ...styles.statNumber, color: chartColors.primary }}>{stats.available}</div>
          <div style={styles.statLabel}>{t.available}</div>
        </div>

        <div className="dept-dashboard__stat" style={styles.statCard} onClick={() => handleStatClick('maintenance')}>
          <div style={styles.statIcon}><Wrench size={26} strokeWidth={1.8} aria-hidden="true" /></div>
          <div style={{ ...styles.statNumber, color: chartColors.warning }}>{stats.underMaintenance}</div>
          <div style={styles.statLabel}>{t.underMaintenance}</div>
          {stats.maintenanceAlerts.length > 0 && (
            <div style={{ ...styles.statTrend, color: chartColors.danger }}>
              <AlertTriangle size={14} strokeWidth={1.8} aria-hidden="true" /> {stats.maintenanceAlerts.length} {t.criticalAlerts}
            </div>
          )}
        </div>

        <div className="dept-dashboard__stat" style={styles.statCard} onClick={() => handleStatClick('staff')}>
          <div style={styles.statIcon}><Users size={26} strokeWidth={1.8} aria-hidden="true" /></div>
          <div style={styles.statNumber}>{stats.staffCount}</div>
          <div style={styles.statLabel}>{t.staffCount}</div>
        </div>

        <div className="dept-dashboard__stat" style={styles.statCard}>
          <div style={styles.statIcon}><DollarSign size={26} strokeWidth={1.8} aria-hidden="true" /></div>
          <div style={styles.statNumber}>${stats.totalValue.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.totalValue}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dept-dashboard__charts" style={styles.chartsRow}>
        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.assetsByStatus}</h3>
          <div style={{ height: '250px' }}>
            <Doughnut data={statusChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.assetsByCategory}</h3>
          <div style={{ height: '250px' }}>
            <Pie data={categoryChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.assetsByLocation}</h3>
          <div style={{ height: '250px' }}>
            <Doughnut data={locationChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.assetsByCondition}</h3>
          <div style={{ height: '250px' }}>
            <Pie data={conditionChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="dept-dashboard__stats dept-dashboard__stats--secondary" style={styles.statsGrid}>
        {[
          { label: t.pendingRequests, value: stats.pendingRequestCount, type: 'requests' },
          { label: t.pendingTransfers, value: stats.pendingTransfers },
          { label: t.pendingReturns, value: stats.pendingReturns },
          { label: t.pendingActions, value: stats.pendingActions },
          { label: t.staffWithAssignedAssets, value: stats.staffWithAssignedAssets },
          { label: t.staffWithoutAssignedAssets, value: stats.staffWithoutAssignedAssets },
          { label: t.openMaintenance, value: stats.maintenanceSummary.open },
          { label: t.inProgressMaintenance, value: stats.maintenanceSummary.inProgress },
          { label: t.completedMaintenance, value: stats.maintenanceSummary.completed },
          { label: t.overdueMaintenance, value: stats.maintenanceSummary.overdue },
          { label: t.verifiedAssets, value: stats.verificationSummary.verifiedAssets },
          { label: t.pendingVerification, value: stats.verificationSummary.pendingVerification },
          { label: t.verificationIssues, value: stats.verificationSummary.verificationIssues }
        ].map((item) => (
          <div className="dept-dashboard__stat" key={item.label} style={styles.statCard} onClick={item.type ? () => handleStatClick(item.type) : undefined}>
            <div style={styles.statNumber}>{item.value}</div>
            <div style={styles.statLabel}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Maintenance Alerts */}
      {stats.maintenanceAlerts.length > 0 && showAlerts && (
        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 style={styles.chartTitle}><AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" /> {t.maintenanceAlerts}</h3>
          {stats.maintenanceAlerts.map((alert, index) => (
            <div key={index} style={styles.alertCard}>
              <div>
                <strong>{alert.title}</strong>
                <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: 'var(--color-text-secondary-on-page)' }}>
                  {alert.message || ''}
                </span>
              </div>
              <div>
                <span style={{
                  ...styles.statusBadge,
                  ...getPriorityTone(alert.priority)
                }}>
                  {alert.priority}
                </span>
                <span style={{
                  ...styles.statusBadge,
                  ...getStatusTone(alert.status),
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
              color: 'var(--color-text-secondary-on-page)'
            }}
            onClick={() => setShowAlerts(false)}
          >
            {t.dismissAlerts}
          </button>
        </div>
      )}

      {/* Recent Activities */}
      <div className="dept-dashboard__card" style={styles.activityCard}>
        <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.recentActivities}</h3>
        {stats.recentActivities.length === 0 ? (
          <p style={styles.emptyState}>{t.noRecentActivities}</p>
        ) : (
          stats.recentActivities.map((activity, index) => (
            <div key={index} style={styles.activityItem}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={styles.activityIcon}>{getActivityIcon(activity.type)}</span>
                <div style={styles.activityText}>
                  <div>{activity.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary-on-page)' }}>
                    {activity.action}
                    {activity.status && (
                      <span style={{
                        ...styles.statusBadge,
                        ...getStatusTone(activity.status),
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
      <div className="dept-dashboard__charts" style={styles.chartsRow}>
        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.recentAssignments}</h3>
          {stats.recentAssignments.length === 0 ? (
            <p style={styles.emptyState}>{t.noRecentAssignments}</p>
          ) : (
            stats.recentAssignments.map((assignment, index) => (
              <div key={index} style={styles.activityItem}>
                <div>
                  <div style={{ fontWeight: 500 }}>{assignment.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary-on-page)' }}>
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

        <div className="dept-dashboard__card" style={styles.chartCard}>
          <h3 className="dept-dashboard__card-title" style={styles.chartTitle}>{t.pendingRequests}</h3>
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
                      ...getPriorityTone(request.priority)
                    }}>
                      {request.priority}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary-on-page)' }}>
                  {t.pending}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dept-dashboard__card dept-dashboard__quick-actions" style={styles.activityCard}>
        <h3 className="dept-dashboard__card-title" style={styles.chartTitle}><Zap size={18} strokeWidth={1.8} aria-hidden="true" /> {t.quickActions}</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)'
            }}
            onClick={() => navigate('/department/assets')}
          >
            {t.viewAllAssets}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)'
            }}
            onClick={() => navigate('/department/maintenance')}
          >
            {t.newRequest}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)'
            }}
            onClick={() => navigate('/department/staff')}
          >
            {t.manageStaff}
          </button>
          <button 
            style={{
              ...styles.timeRangeButton,
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)'
            }}
            onClick={() => navigate('/department/reports')}
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
  dashboard: 'Department Head Dashboard',
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
  assetsByLocation: 'Assets by Location',
  assetsByCondition: 'Assets by Condition',
  recentActivities: 'Recent Activities',
  noRecentActivities: 'No recent activities',
  loading: 'Loading Department Dashboard...',
  utilization: 'Utilization',
  criticalAlerts: 'Critical Alerts',
  maintenanceAlerts: 'Maintenance Alerts',
  dismissAlerts: 'Dismiss Alerts',
  recentAssignments: 'Recent Assignments',
  noRecentAssignments: 'No recent assignments',
  pendingRequests: 'Pending Requests',
  pendingTransfers: 'Pending Transfers',
  pendingReturns: 'Pending Returns',
  pendingActions: 'Pending Actions',
  staffWithAssignedAssets: 'Staff with Assigned Assets',
  staffWithoutAssignedAssets: 'Staff without Assigned Assets',
  openMaintenance: 'Open Maintenance',
  inProgressMaintenance: 'In Progress',
  completedMaintenance: 'Completed Maintenance',
  overdueMaintenance: 'Overdue Maintenance',
  verifiedAssets: 'Verified Assets',
  pendingVerification: 'Pending Verification',
  verificationIssues: 'Verification Issues',
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
  fetchError: 'Unable to load department dashboard. Please try again.'
};

const amharicTranslations = {
  dashboard: 'የዲፓርትመንት ኃላፊ ዳሽቦርድ',
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
  loading: 'የዲፓርትመንት ዳሽቦርድ በመጫን ላይ...',
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
  fetchError: 'የዲፓርትመንት ዳሽቦርድ መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
};

export default DeptDashboard;