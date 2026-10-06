import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Doughnut, Pie } from 'react-chartjs-2';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  Package,
  RefreshCw,
  TicketCheck,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import { CHART_PALETTE, CHART_TEXT } from '../../utils/chartPalette';
import './DeptDashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const KPI_FIELDS = [
  'totalAssets',
  'activeAssets',
  'damagedAssets',
  'underMaintenance',
  'availableAssets',
  'assignedAssets',
  'pendingAcquisitionRequests',
  'pendingApprovals',
  'openServiceRequests',
  'overdueTickets',
  'escalatedTickets',
  'laboratories',
];

const CHART_FIELDS = [
  'assetByStatus',
  'assetByCategory',
  'serviceRequestStatus',
  'acquisitionRequestStatus',
];

const translations = {
  en: {
    title: 'Department Head Dashboard',
    welcome: 'Welcome',
    refresh: 'Refresh dashboard',
    totalAssets: 'Total Department Assets',
    activeAssets: 'Active Assets',
    damagedAssets: 'Damaged Assets',
    underMaintenance: 'Assets Under Maintenance',
    availableAssets: 'Available Inventory',
    assignedAssets: 'Assigned Assets',
    pendingAcquisitionRequests: 'Pending Acquisition Requests',
    pendingApprovals: 'Pending Approvals',
    openServiceRequests: 'Open Service Requests',
    overdueTickets: 'Overdue Tickets',
    escalatedTickets: 'Escalated Tickets',
    laboratories: 'Laboratories',
    assetByStatus: 'Asset Status',
    assetByCategory: 'Asset Categories',
    serviceRequestStatus: 'Service Request Status',
    acquisitionRequestStatus: 'Acquisition Request Status',
    recentActivities: 'Recent Activities',
    noChartData: 'No data available for this chart.',
    noActivities: 'No recent department activities.',
    emptyDepartment: 'This department has no assets or recent activities yet.',
    loading: 'Loading department dashboard',
    error401: 'Your session has expired. Sign in again to view this dashboard.',
    error403: 'You are not authorized to view this department dashboard.',
    error404: 'The department dashboard endpoint could not be found.',
    error500: 'The dashboard could not be loaded because of a server error.',
    errorNetwork: 'The dashboard could not be reached. Check your connection and try again.',
    retry: 'Retry',
    signIn: 'Sign in',
    user: 'User',
    action: 'Action',
    entity: 'Entity',
    status: 'Status',
    dateTime: 'Date / Time',
    statuses: {
      Active: 'Active',
      Damaged: 'Damaged',
      'Under Maintenance': 'Under Maintenance',
      Replaced: 'Replaced',
      Expired: 'Expired',
      Disposed: 'Disposed',
      Computing: 'Computing',
      'Laboratory Equipment': 'Laboratory Equipment',
      'Agriculture Equipment': 'Agriculture Equipment',
      Furniture: 'Furniture',
      'ICT Equipment': 'ICT Equipment',
      Electrical: 'Electrical',
      Other: 'Other',
      Submitted: 'Submitted',
      Acknowledged: 'Acknowledged',
      Scheduled: 'Scheduled',
      'In Progress': 'In Progress',
      Completed: 'Completed',
      Escalated: 'Escalated',
      Draft: 'Draft',
      'Under Review': 'Under Review',
      Approved: 'Approved',
      Rejected: 'Rejected',
      'Changes Requested': 'Changes Requested',
    },
    actions: {
      'New asset request': 'New asset request',
      'Approval submission': 'Approval submission',
      'Asset assignment': 'Asset assignment',
      'Asset transfer': 'Asset transfer',
      'Asset return': 'Asset return',
      'Maintenance request': 'Maintenance request',
      'Technician assignment': 'Technician assignment',
      'Ticket escalation': 'Ticket escalation',
      'Asset verification': 'Asset verification',
      'Service completion': 'Service completion',
    },
  },
  am: {
    title: 'የዲፓርትመንት ኃላፊ ዳሽቦርድ',
    welcome: 'እንኳን ደህና መጡ',
    refresh: 'ዳሽቦርዱን ያድሱ',
    totalAssets: 'ጠቅላላ የዲፓርትመንት ንብረቶች',
    activeAssets: 'ንቁ ንብረቶች',
    damagedAssets: 'የተጎዱ ንብረቶች',
    underMaintenance: 'በጥገና ላይ ያሉ ንብረቶች',
    availableAssets: 'ያለ ምደባ የሚገኙ ንብረቶች',
    assignedAssets: 'የተመደቡ ንብረቶች',
    pendingAcquisitionRequests: 'በመጠባበቅ ላይ ያሉ የግዢ ጥያቄዎች',
    pendingApprovals: 'በመጠባበቅ ላይ ያሉ ማጽደቆች',
    openServiceRequests: 'ክፍት የአገልግሎት ጥያቄዎች',
    overdueTickets: 'ጊዜ ያለፈባቸው ትኬቶች',
    escalatedTickets: 'የተላለፉ ትኬቶች',
    laboratories: 'ላቦራቶሪዎች',
    assetByStatus: 'የንብረት ሁኔታ',
    assetByCategory: 'የንብረት ምድቦች',
    serviceRequestStatus: 'የአገልግሎት ጥያቄ ሁኔታ',
    acquisitionRequestStatus: 'የግዢ ጥያቄ ሁኔታ',
    recentActivities: 'የቅርብ ጊዜ እንቅስቃሴዎች',
    noChartData: 'ለዚህ ገበታ የሚታይ መረጃ የለም።',
    noActivities: 'የቅርብ ጊዜ የዲፓርትመንት እንቅስቃሴ የለም።',
    emptyDepartment: 'ይህ ዲፓርትመንት ገና ንብረት ወይም የቅርብ ጊዜ እንቅስቃሴ የለውም።',
    loading: 'የዲፓርትመንት ዳሽቦርድ በመጫን ላይ',
    error401: 'የመግቢያ ጊዜዎ አልቋል። ይህን ዳሽቦርድ ለማየት እንደገና ይግቡ።',
    error403: 'ይህን የዲፓርትመንት ዳሽቦርድ ለማየት ፈቃድ የለዎትም።',
    error404: 'የዲፓርትመንት ዳሽቦርድ አድራሻ አልተገኘም።',
    error500: 'በአገልጋዩ ስህተት ምክንያት ዳሽቦርዱን መጫን አልተቻለም።',
    errorNetwork: 'ዳሽቦርዱን ማግኘት አልተቻለም። የኢንተርኔት ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።',
    retry: 'እንደገና ይሞክሩ',
    signIn: 'ይግቡ',
    user: 'ተጠቃሚ',
    action: 'ተግባር',
    entity: 'ንብረት / አካል',
    status: 'ሁኔታ',
    dateTime: 'ቀን / ሰዓት',
    statuses: {
      Active: 'ንቁ',
      Damaged: 'የተጎዳ',
      'Under Maintenance': 'በጥገና ላይ',
      Replaced: 'የተተካ',
      Expired: 'ጊዜው ያለፈ',
      Disposed: 'የተወገደ',
      Computing: 'የኮምፒውተር መሳሪያዎች',
      'Laboratory Equipment': 'የላቦራቶሪ መሳሪያዎች',
      'Agriculture Equipment': 'የግብርና መሳሪያዎች',
      Furniture: 'የቤት ዕቃዎች',
      'ICT Equipment': 'የአይሲቲ መሳሪያዎች',
      Electrical: 'የኤሌክትሪክ መሳሪያዎች',
      Other: 'ሌሎች',
      Submitted: 'የቀረበ',
      Acknowledged: 'የተረጋገጠ',
      Scheduled: 'መርሐግብር የተያዘለት',
      'In Progress': 'በሂደት ላይ',
      Completed: 'የተጠናቀቀ',
      Escalated: 'የተላለፈ',
      Draft: 'ረቂቅ',
      'Under Review': 'በግምገማ ላይ',
      Approved: 'የጸደቀ',
      Rejected: 'ውድቅ የተደረገ',
      'Changes Requested': 'ማሻሻያ የተጠየቀ',
    },
    actions: {
      'New asset request': 'አዲስ የንብረት ጥያቄ',
      'Approval submission': 'ማጽደቂያ ጥያቄ ማቅረብ',
      'Asset assignment': 'ንብረት መመደብ',
      'Asset transfer': 'ንብረት ማስተላለፍ',
      'Asset return': 'ንብረት መመለስ',
      'Maintenance request': 'የጥገና ጥያቄ',
      'Technician assignment': 'ቴክኒሻን መመደብ',
      'Ticket escalation': 'ትኬት ማስተላለፍ',
      'Asset verification': 'ንብረት ማረጋገጥ',
      'Service completion': 'አገልግሎት ማጠናቀቅ',
    },
  },
};

const iconForKpi = {
  totalAssets: Package,
  activeAssets: CheckCircle2,
  damagedAssets: XCircle,
  underMaintenance: Wrench,
  availableAssets: ClipboardList,
  assignedAssets: UserCheck,
  pendingAcquisitionRequests: ClipboardCheck,
  pendingApprovals: ClipboardCheck,
  openServiceRequests: TicketCheck,
  overdueTickets: AlertTriangle,
  escalatedTickets: Activity,
  laboratories: FlaskConical,
};

const validateDashboard = (dashboard) => {
  if (!dashboard || typeof dashboard !== 'object' || !dashboard.department?.name) {
    throw new Error('The department dashboard response is incomplete.');
  }
  KPI_FIELDS.forEach((field) => {
    if (!Number.isFinite(dashboard[field]) || dashboard[field] < 0) {
      throw new Error(`The department dashboard response is missing ${field}.`);
    }
  });
  CHART_FIELDS.forEach((field) => {
    if (!Array.isArray(dashboard[field]) || dashboard[field].some((item) => (
      !item || typeof item.label !== 'string' || !Number.isFinite(item.value) || item.value < 0
    ))) {
      throw new Error(`The department dashboard response contains an invalid ${field} chart.`);
    }
  });
  if (!Array.isArray(dashboard.recentActivities) || dashboard.recentActivities.some((activity) => (
    !activity
    || typeof activity.user !== 'string'
    || typeof activity.action !== 'string'
    || typeof activity.entity !== 'string'
    || typeof activity.status !== 'string'
    || typeof activity.date !== 'string'
    || Number.isNaN(new Date(activity.date).getTime())
  ))) {
    throw new Error('The department dashboard response contains an invalid activity list.');
  }
  return dashboard;
};

const getErrorKind = (error) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403 || status === 404 || status >= 500) return status;
  return error?.isAxiosError && !error.response ? 'network' : 500;
};

const DeptDashboard = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState(null);
  const requestInFlight = useRef(false);
  const t = translations[language === 'am' ? 'am' : 'en'];

  const fetchDashboard = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setErrorKind(null);
    try {
      const response = await apiClient.get('/department/dashboard');
      const payload = response.data?.data || response.data;
      setDashboard(validateDashboard(payload));
    } catch (error) {
      setErrorKind(getErrorKind(error));
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: CHART_TEXT.primary, boxWidth: 12, padding: 14 },
      },
    },
  };

  const chartData = (series) => ({
    labels: series.map(({ label }) => t.statuses[label] || label),
    datasets: [{
      data: series.map(({ value }) => value),
      backgroundColor: CHART_PALETTE,
      borderColor: CHART_TEXT.surface,
      borderWidth: 2,
    }],
  });

  const errorMessage = errorKind === 'network'
    ? t.errorNetwork
    : t[`error${errorKind}`] || t.error500;
  const canRetry = errorKind !== 401 && errorKind !== 403;

  if (loading && !dashboard && !errorKind) {
    return (
      <main className="dept-dashboard" aria-busy="true" aria-label={t.loading}>
        <div className="dept-dashboard__skeleton-header" />
        <section className="dept-dashboard__stats" aria-hidden="true">
          {KPI_FIELDS.map((field) => <div className="dept-dashboard__skeleton-card" key={field} />)}
        </section>
        <section className="dept-dashboard__charts" aria-hidden="true">
          {CHART_FIELDS.map((field) => <div className="dept-dashboard__skeleton-chart" key={field} />)}
        </section>
        <p className="dept-dashboard__loading-label" role="status">{t.loading}...</p>
      </main>
    );
  }

  if (!dashboard && errorKind) {
    return (
      <main className="dept-dashboard dept-dashboard__error-page">
        <div className="dept-dashboard__empty" role="alert">
          <AlertTriangle size={30} aria-hidden="true" />
          <p>{errorMessage}</p>
          {errorKind === 401 ? (
            <button type="button" onClick={() => { window.location.assign('/login'); }}>{t.signIn}</button>
          ) : canRetry && (
            <button type="button" onClick={fetchDashboard}>{t.retry}</button>
          )}
        </div>
      </main>
    );
  }

  const activityDateLocale = language === 'am' ? 'am-ET' : 'en-US';
  const isEmptyDepartment = dashboard.totalAssets === 0 && dashboard.recentActivities.length === 0;

  return (
    <main className="dept-dashboard">
      <header className="dept-dashboard__header">
        <div>
          <h1 className="dept-dashboard__title">{t.title}</h1>
          <p className="dept-dashboard__subtitle">
            {t.welcome}, {user?.fullName || user?.username || t.user} · {dashboard.department.name}
          </p>
        </div>
        <button
          className="dept-dashboard__refresh"
          type="button"
          onClick={fetchDashboard}
          disabled={loading}
          aria-label={t.refresh}
        >
          <RefreshCw size={17} className={loading ? 'dept-dashboard__refresh-icon--spinning' : ''} aria-hidden="true" />
          {t.refresh}
        </button>
      </header>

      {errorKind && (
        <div className="dept-dashboard__inline-error" role="alert">
          <span>{errorMessage}</span>
          {canRetry && <button type="button" onClick={fetchDashboard} disabled={loading}>{t.retry}</button>}
        </div>
      )}

      {isEmptyDepartment && (
        <p className="dept-dashboard__department-empty" role="status">{t.emptyDepartment}</p>
      )}

      <section className="dept-dashboard__stats" aria-label={t.title}>
        {KPI_FIELDS.map((field) => {
          const Icon = iconForKpi[field];
          return (
            <article className="dept-dashboard__stat" key={field}>
              <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
              <div className="dept-dashboard__stat-value">{dashboard[field].toLocaleString()}</div>
              <div className="dept-dashboard__stat-label">{t[field]}</div>
            </article>
          );
        })}
      </section>

      <section className="dept-dashboard__charts" aria-label={t.assetByStatus}>
        {CHART_FIELDS.map((field, index) => {
          const Chart = index === 1 ? Pie : Doughnut;
          const series = dashboard[field];
          return (
            <article className="dept-dashboard__card" key={field}>
              <h2 className="dept-dashboard__card-title">{t[field]}</h2>
              {series.length ? (
                <div className="dept-dashboard__chart">
                  <Chart data={chartData(series)} options={chartOptions} />
                </div>
              ) : (
                <p className="dept-dashboard__empty dept-dashboard__chart-empty">{t.noChartData}</p>
              )}
            </article>
          );
        })}
      </section>

      <section className="dept-dashboard__card dept-dashboard__activities">
        <h2 className="dept-dashboard__card-title">{t.recentActivities}</h2>
        {dashboard.recentActivities.length ? (
          <div className="dept-dashboard__activity-scroll">
            <table className="dept-dashboard__activity-table">
              <thead>
                <tr>
                  <th scope="col">{t.user}</th>
                  <th scope="col">{t.action}</th>
                  <th scope="col">{t.entity}</th>
                  <th scope="col">{t.status}</th>
                  <th scope="col">{t.dateTime}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td data-label={t.user}>{activity.user}</td>
                    <td data-label={t.action}>{t.actions[activity.action] || activity.action}</td>
                    <td data-label={t.entity}>{activity.entity}</td>
                    <td data-label={t.status}>
                      {t.statuses[activity.status]
                        || t.statuses[Object.keys(t.statuses).find((label) => label.toLowerCase() === activity.status.toLowerCase())]
                        || activity.status}
                    </td>
                    <td data-label={t.dateTime}>
                      <time dateTime={activity.date}>
                        {new Date(activity.date).toLocaleString(activityDateLocale)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dept-dashboard__empty">{t.noActivities}</p>
        )}
      </section>
    </main>
  );
};

export default DeptDashboard;
