import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BarChart3, Boxes, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, History, PackageCheck, PackageOpen, PackagePlus, PackageX, RefreshCw, ScanLine, TriangleAlert, Truck, Wrench } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { CHART_PALETTE } from '../../utils/chartPalette';
import './StoreDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const emptyData = { kpis: {}, status: {}, today: {}, inventoryHealth: {}, inventoryByStatus: {}, categories: {}, stockMovement: {}, monthlyMovements: [], pendingTransactions: [], recentActivities: [], recentMovements: [], recentTransactions: [], lowStockAlerts: [], verification: {}, maintenance: {}, health: {} };
const icons = { totalInventory: Boxes, totalAssets: Boxes, availableAssets: PackageCheck, assignedAssets: ClipboardCheck, damagedItems: PackageX, pendingRequests: ClipboardList, pendingReceipts: PackagePlus, pendingIssues: PackageOpen, pendingReturns: PackageX, pendingTransfers: Truck, lowStock: TriangleAlert };
const routes = { Inventory: '/store/inventory', Available: '/store/available-assets', LowStock: '/store/low-stock', Receive: '/store/receive', Issue: '/store/issue', Return: '/store/returns', Transfer: '/store/transfers', Verification: '/store/verification', Maintenance: '/store/maintenance' };
const english = { title: 'Store Manager', subtitle: 'Physical Asset Movement & Inventory Control', online: 'Online', offline: 'Offline', loading: 'Loading dashboard...', error: 'Unable to load Store dashboard', forbidden: 'You are not authorized to access this page.', retry: 'Retry', noActivity: 'No store activity yet', totalAssets: 'Total Store Assets', availableAssets: 'Available Assets', pendingRequests: 'Pending Requests', pendingReceipts: 'Pending Receipts', pendingIssues: 'Pending Issues', pendingReturns: 'Pending Returns', pendingTransfers: 'Pending Transfers', lowStock: 'Low Stock', operational: 'Operational Status', inMaintenance: 'In Maintenance', awaitingVerification: 'Awaiting Verification', discrepancies: 'Verification Discrepancies', inventoryHealth: 'Inventory Health', pending: 'Pending Transactions', recent: 'Recent Asset Movements', alerts: 'Low Stock Alerts', verification: 'Asset Verification', today: "Today's Store Activity", view: 'View', viewLowStock: 'View Low Stock', receive: 'Assets Received', issue: 'Assets Issued', return: 'Assets Returned', transfer: 'Assets Transferred', adjustment: 'Stock Adjustments', scans: 'Verification Scans', verified: 'Verified', missing: 'Missing', damaged: 'Damaged', unverified: 'Unverified', noSession: 'No verification session yet' };
const amharic = { ...english, title: 'የመጋዘን አስተዳዳሪ', subtitle: 'የንብረት እንቅስቃሴ እና የእቃ ቁጥጥር', online: 'በመስመር ላይ', offline: 'ከመስመር ውጭ', loading: 'ዳሽቦርዱ በመጫን ላይ...', error: 'የመጋዘን ዳሽቦርዱ መጫን አልተቻለም', retry: 'እንደገና ሞክር', noActivity: 'እስካሁን የመጋዘን እንቅስቃሴ የለም', totalAssets: 'የመጋዘን ንብረቶች', availableAssets: 'ዝግጁ ንብረቶች', lowStock: 'ዝቅተኛ ክምችት' };
const amharicDashboardTranslations = { pendingRequests: 'በመጠባበቅ ላይ ያሉ ጥያቄዎች', pendingReceipts: 'በመጠባበቅ ላይ ያሉ ደረሰኞች', pendingIssues: 'በመጠባበቅ ላይ ያሉ ማውጫዎች', pendingReturns: 'በመጠባበቅ ላይ ያሉ መመለሻዎች', pendingTransfers: 'በመጠባበቅ ላይ ያሉ ዝውውሮች', operational: 'የስራ ሁኔታ', inMaintenance: 'በጥገና ላይ', awaitingVerification: 'ማረጋገጫ የሚጠብቁ', discrepancies: 'የማረጋገጫ ልዩነቶች', pending: 'በመጠባበቅ ላይ ያሉ ግብይቶች', alerts: 'ዝቅተኛ ክምችት ማስጠንቀቂያዎች', verification: 'የንብረት ማረጋገጫ', today: 'የዛሬ የመጋዘን እንቅስቃሴ', view: 'ይመልከቱ', viewLowStock: 'ዝቅተኛ ክምችት ይመልከቱ', receive: 'የተቀበሉ', issue: 'የወጡ', return: 'የተመለሱ', transfer: 'የተዘዋወሩ', adjustment: 'የተስተካከሉ', scans: 'የማረጋገጫ ቅኝቶች', verified: 'የተረጋገጡ', missing: 'የጠፉ', damaged: 'የተበላሹ', unverified: 'ያልተረጋገጡ', noSession: 'እስካሁን የማረጋገጫ ክፍለ ጊዜ የለም', consumed: 'የተጠቀሙ' };
const dashboardCopy = {
  en: { refresh: 'Refresh', totalInventory: 'Total Inventory', assignedAssets: 'Assigned Assets', damagedItems: 'Damaged Items', inventoryHealth: 'Inventory by Status', categoryAnalytics: 'Inventory by Category', movementAnalytics: 'Stock Movement', monthlyAnalytics: 'Monthly Movement', recent: 'Recent Activities', noData: 'No inventory data available', noLowStock: 'No low-stock items', date: 'Date', time: 'Time', user: 'User', action: 'Action', assetItem: 'Asset / Item', quantity: 'Quantity', location: 'Location', status: 'Status', quickActions: 'Quick Actions', category: 'Category', assets: 'Assets', reserved: 'Reserved', assigned: 'Assigned', issued: 'Issued', maintenance: 'Under Maintenance', retired: 'Retired', disposed: 'Disposed', consumed: 'Consumed', request: 'Request', receipt: 'Receipt', issueType: 'Issue', returnType: 'Return', transferType: 'Transfer', recorded: 'Recorded', critical: 'Critical', low: 'Low', uncategorized: 'Uncategorized', month: 'Month' },
  am: { refresh: 'አድስ', totalInventory: 'ጠቅላላ ክምችት', assignedAssets: 'የተመደቡ ንብረቶች', damagedItems: 'የተበላሹ እቃዎች', inventoryHealth: 'እቃ በሁኔታ', categoryAnalytics: 'እቃ በምድብ', movementAnalytics: 'የእቃ እንቅስቃሴ', monthlyAnalytics: 'ወርሃዊ እንቅስቃሴ', recent: 'የቅርብ ጊዜ እንቅስቃሴዎች', noData: 'የእቃ መረጃ የለም', noLowStock: 'ዝቅተኛ ክምችት ያላቸው እቃዎች የሉም', date: 'ቀን', time: 'ሰዓት', user: 'ተጠቃሚ', action: 'ተግባር', assetItem: 'ንብረት / እቃ', quantity: 'ብዛት', location: 'ቦታ', status: 'ሁኔታ', quickActions: 'ፈጣን ተግባራት', category: 'ምድብ', assets: 'ንብረቶች', reserved: 'የተያዙ', assigned: 'የተመደቡ', issued: 'የወጡ', maintenance: 'በጥገና ላይ', retired: 'ከአገልግሎት የወጡ', disposed: 'የተወገዱ', consumed: 'የተጠቀሙ', request: 'ጥያቄ', receipt: 'ደረሰኝ', issueType: 'ማውጣት', returnType: 'መመለስ', transferType: 'ዝውውር', recorded: 'ተመዝግቧል', critical: 'ከፍተኛ', low: 'ዝቅተኛ', uncategorized: 'ያልተመደበ', month: 'ወር' },
};
const date = (value, locale) => value ? new Date(value).toLocaleDateString(locale) : '-';
const time = (value, locale) => value ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '-';
const normalizeDashboardData = (payload) => {
  const source = payload || {};
  const summary = source.summary || {};
  const legacyKpis = {
    totalInventory: summary.totalInventory ?? summary.totalAssets,
    totalAssets: summary.totalInventory ?? summary.totalAssets,
    availableAssets: summary.available ?? summary.availableAssets,
    pendingRequests: summary.pendingRequests,
    lowStock: summary.lowStock,
  };
  return {
    ...emptyData,
    ...source,
    kpis: { ...emptyData.kpis, ...legacyKpis, ...(source.kpis || {}) },
    status: { ...emptyData.status, ...(source.status || {}) },
    today: { ...emptyData.today, ...(source.today || {}) },
    inventoryHealth: { ...emptyData.inventoryHealth, ...(source.inventoryHealth || {}) },
    inventoryByStatus: { ...emptyData.inventoryByStatus, ...(source.inventoryByStatus || {}) },
    categories: { ...emptyData.categories, ...(source.categories || {}) },
    stockMovement: { ...emptyData.stockMovement, ...(source.stockMovement || {}) },
    monthlyMovements: Array.isArray(source.monthlyMovements) ? source.monthlyMovements : [],
    recentActivities: Array.isArray(source.recentActivities) ? source.recentActivities : [],
    health: { ...emptyData.health, ...(source.health || {}) },
  };
};

export default function StoreDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = { ...(language === 'en' ? english : { ...amharic, ...amharicDashboardTranslations }), ...dashboardCopy[language] };
  const locale = language === 'en' ? 'en-US' : 'am-ET';
  const mounted = useRef(false);
  const [state, setState] = useState({ loading: true, error: '', data: emptyData, lastUpdated: null });

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent && mounted.current) setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/store/dashboard', { timeout: 10000 });
      if (mounted.current) setState({ loading: false, error: '', data: normalizeDashboardData(response.data?.data), lastUpdated: new Date() });
    } catch (error) {
      if (!mounted.current) return;
      setState((current) => {
        if (silent && current.lastUpdated) return { ...current, loading: false };
        return { loading: false, error: error.response?.status === 403 ? 'forbidden' : 'error', data: emptyData, lastUpdated: null };
      });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const refreshInterval = window.setInterval(() => load({ silent: true }), 60000);
    return () => {
      mounted.current = false;
      window.clearInterval(refreshInterval);
    };
  }, [load]);

  if (state.loading) return <div className="store-dashboard-state"><Clock3 size={22} /> {t.loading}</div>;
  if (state.error) return <div className="store-dashboard-state store-dashboard-error"><TriangleAlert size={22} /><p>{t[state.error]}</p><button type="button" onClick={load}><RefreshCw size={16} /> {t.retry}</button></div>;

  const { data } = state;
  const kpis = [
    ['totalInventory', data.kpis.totalInventory ?? data.kpis.totalAssets],
    ['availableAssets', data.kpis.availableAssets],
    ['assignedAssets', data.kpis.assignedAssets],
    ['pendingReceipts', data.kpis.pendingReceipts],
    ['pendingIssues', data.kpis.pendingIssues],
    ['pendingReturns', data.kpis.pendingReturns],
    ['lowStock', data.kpis.lowStock],
    ['damagedItems', data.kpis.damagedItems],
    ['pendingRequests', data.kpis.pendingRequests],
    ['pendingTransfers', data.kpis.pendingTransfers],
  ];
  const statusRows = [
    ['available', t.availableAssets], ['reserved', t.reserved], ['assigned', t.assigned], ['issued', t.issued],
    ['damaged', t.damaged], ['underMaintenance', t.maintenance], ['missing', t.missing], ['retired', t.retired], ['disposed', t.disposed],
  ];
  const statusData = statusRows.map(([key]) => Number(data.inventoryByStatus[key] || 0));
  const statusChart = { labels: statusRows.map(([, label]) => label), datasets: [{ label: t.assets, data: statusData, backgroundColor: statusRows.map((_, index) => CHART_PALETTE[index % CHART_PALETTE.length]), borderRadius: 4 }] };
  const categoryEntries = Object.entries(data.categories).sort((first, second) => second[1] - first[1]);
  const categoryChart = { labels: categoryEntries.map(([category]) => category === 'Uncategorized' ? t.uncategorized : category), datasets: [{ label: t.assets, data: categoryEntries.map(([, quantity]) => quantity), backgroundColor: categoryEntries.map((_, index) => CHART_PALETTE[index % CHART_PALETTE.length]), borderRadius: 4 }] };
  const movementKeys = [
    ['received', t.receive, '#0EA5D9'], ['issued', t.issue, '#3074B3'], ['returned', t.return, '#16A34A'],
    ['transferred', t.transfer, '#D97706'], ['adjusted', t.adjustment, '#7C3AED'], ['consumed', t.consumed, '#EA580C'], ['disposed', t.disposed, '#64748B'],
  ];
  const stockMovementChart = { labels: movementKeys.map(([, label]) => label), datasets: [{ label: t.quantity, data: movementKeys.map(([key]) => Number(data.stockMovement[key] || 0)), backgroundColor: movementKeys.map(([, , color]) => color), borderRadius: 4 }] };
  const monthlyRows = data.monthlyMovements || [];
  const hasMonthlyMovement = monthlyRows.some((row) => movementKeys.some(([key]) => Number(row[key] || 0) > 0));
  const monthlyChart = {
    labels: monthlyRows.map((row) => {
      const [year, month] = String(row.month).split('-').map(Number);
      return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'short' });
    }),
    datasets: movementKeys.map(([key, label, color]) => ({ label, data: monthlyRows.map((row) => Number(row[key] || 0)), borderColor: color, backgroundColor: color, tension: 0.25, pointRadius: 2 })),
  };
  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
  const monthlyChartOptions = { ...chartOptions, plugins: { legend: { display: true, position: 'bottom' } } };
  const quickActions = [
    ['Receive', PackagePlus, language === 'en' ? 'Receive' : 'ተቀበል'], ['Issue', PackageOpen, language === 'en' ? 'Issue' : 'አውጣ'],
    ['Return', PackageX, language === 'en' ? 'Return' : 'መልስ'], ['Transfer', Truck, language === 'en' ? 'Transfer' : 'አዛውር'],
    ['Verification', ScanLine, language === 'en' ? 'Verification' : 'ማረጋገጫ'], ['Inventory', Boxes, language === 'en' ? 'Inventory' : 'ክምችት'],
    ['Maintenance', Wrench, language === 'en' ? 'Maintenance' : 'ጥገና'],
  ];
  const activityAction = (value) => {
    const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    const labels = { receive: t.receive, received: t.receive, stockadded: t.receive, issue: t.issue, issued: t.issue, return: t.return, returned: t.return, transfer: t.transfer, transferred: t.transfer, adjustment: t.adjustment, stockadjustment: t.adjustment, assign: t.assigned, assigned: t.assigned, maintenance: t.maintenance, consumed: t.consumed, disposed: t.disposed };
    return labels[key] || value;
  };
  const pendingType = (value) => ({ request: t.request, receipt: t.receipt, issue: t.issueType, return: t.returnType, transfer: t.transferType }[String(value || '').toLowerCase()] || value);
  const activityStatus = (value) => String(value || '').toLowerCase() === 'recorded' ? t.recorded : value;
  const severityLabel = (value) => String(value || '').toLowerCase() === 'critical' ? t.critical : t.low;
  const activities = data.recentActivities || [];

  return <main className="store-dashboard">
    <header className="store-dashboard-header">
      <div><p className="eyebrow">{t.title}</p><h1>{t.subtitle}</h1><p className="store-welcome">{user?.fullName || user?.username || t.title}</p></div>
      <div className="store-dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="store-connection"><span className="status-dot" /> {data.health?.api === 'online' ? t.online : t.offline}</div>
        <button type="button" onClick={load} disabled={state.loading} aria-label={t.refresh} title={t.refresh} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-primary)', background: 'var(--color-brand-card)', cursor: 'pointer' }}><RefreshCw size={16} />{t.refresh}</button>
      </div>
    </header>
    <section className="store-kpis" aria-label={language === 'en' ? 'Store metrics' : 'የመጋዘን መለኪያዎች'}>
      {kpis.map(([key, value]) => { const Icon = icons[key]; return <button className="store-kpi" key={key} type="button" onClick={() => navigate(key === 'lowStock' ? routes.LowStock : key === 'availableAssets' ? routes.Available : routes.Inventory)}><span className="kpi-icon"><Icon size={19} /></span><strong>{value ?? 0}</strong><span>{t[key]}</span></button>; })}
    </section>
    <section className="store-section"><div className="section-heading"><div><p className="eyebrow">{t.operational}</p><h2>{t.today}</h2></div></div><div className="status-grid">{[['inMaintenance', Wrench], ['awaitingVerification', ScanLine], ['discrepancies', TriangleAlert]].map(([key, Icon]) => <div className="status-tile" key={key}><Icon size={18} /><strong>{data.status?.[key] || 0}</strong><span>{t[key]}</span></div>)}</div></section>

    <div className="store-columns">
      <section className="store-section"><div className="section-heading"><h2>{t.inventoryHealth}</h2><BarChart3 size={20} /></div>{statusData.some(Boolean) ? <div className="chart-wrap"><Bar data={statusChart} options={chartOptions} /></div> : <p className="empty-copy">{t.noData}</p>}</section>
      <section className="store-section"><div className="section-heading"><h2>{t.categoryAnalytics}</h2><Boxes size={20} /></div>{categoryEntries.length ? <div className="chart-wrap"><Bar data={categoryChart} options={chartOptions} /></div> : <p className="empty-copy">{t.noData}</p>}</section>
    </div>
    <div className="store-columns">
      <section className="store-section"><div className="section-heading"><h2>{t.movementAnalytics}</h2><Activity size={20} /></div>{Object.values(data.stockMovement).some(Number) ? <div className="chart-wrap"><Bar data={stockMovementChart} options={chartOptions} /></div> : <p className="empty-copy">{t.noActivity}</p>}</section>
      <section className="store-section"><div className="section-heading"><h2>{t.monthlyAnalytics}</h2><History size={20} /></div>{hasMonthlyMovement ? <div className="chart-wrap"><Line data={monthlyChart} options={monthlyChartOptions} /></div> : <p className="empty-copy">{t.noActivity}</p>}</section>
    </div>

    <div className="store-columns"><section className="store-section"><div className="section-heading"><h2>{t.today}</h2><History size={20} /></div><div className="activity-list">{[['receipts', t.receive], ['issues', t.issue], ['returns', t.return], ['transfers', t.transfer], ['adjustments', t.adjustment], ['verificationScans', t.scans]].map(([key, label]) => <div key={key}><span>{label}</span><strong>{data.today?.[key] || 0}</strong></div>)}</div></section><section className="store-section"><div className="section-heading"><h2>{t.pending}</h2><ClipboardList size={20} /></div><div className="pending-grid">{(data.pendingTransactions || []).map((item) => <button type="button" className="pending-item" key={item.type} onClick={() => navigate(item.route)}><span>{pendingType(item.type)}</span><strong>{item.count}</strong><small>{t.view} <span aria-hidden="true">›</span></small></button>)}</div></section></div>

    <div className="store-columns"><section className="store-section"><div className="section-heading"><h2>{t.alerts}</h2><TriangleAlert size={20} /></div>{data.lowStockAlerts?.length ? <div className="alert-list">{data.lowStockAlerts.map((item) => <div className="alert-row" key={item.id}><div><strong>{item.item}</strong><small>{item.currentQuantity} / {item.reorderLevel}</small></div><span className={`severity severity-${String(item.severity || 'low').toLowerCase()}`}>{severityLabel(item.severity)}</span></div>)}<button className="text-link" type="button" onClick={() => navigate(routes.LowStock)}>{t.viewLowStock} <span aria-hidden="true">›</span></button></div> : <p className="empty-copy">{t.noLowStock}</p>}</section><section className="store-section"><div className="section-heading"><h2>{t.verification}</h2><ClipboardCheck size={20} /></div>{data.verification?.lastVerification ? <div className="verification-summary"><strong>{date(data.verification.lastVerification, locale)}</strong><div>{[['verified', CheckCircle2], ['missing', TriangleAlert], ['damaged', PackageX], ['unverified', ScanLine]].map(([key, Icon]) => <span key={key}><Icon size={15} /> {t[key]}: {data.verification[key] || 0}</span>)}</div></div> : <p className="empty-copy">{t.noSession}</p>}</section></div>

    <section className="store-section"><div className="section-heading"><h2>{t.recent}</h2><History size={20} /></div>{activities.length ? <div className="movement-table-wrap"><table><thead><tr><th>{t.date}</th><th>{t.time}</th><th>{t.user}</th><th>{t.action}</th><th>{t.assetItem}</th><th>{t.quantity}</th><th>{t.location}</th><th>{t.status}</th></tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}><td>{date(activity.date, locale)}</td><td>{time(activity.date, locale)}</td><td>{activity.user}</td><td>{activityAction(activity.action)}</td><td>{activity.asset}</td><td>{activity.quantity ?? '-'}</td><td>{activity.location}</td><td><span className="table-status">{activityStatus(activity.status)}</span></td></tr>)}</tbody></table></div> : <p className="empty-copy">{t.noActivity}</p>}</section>
    <section className="store-section"><div className="section-heading"><h2>{t.quickActions}</h2><PackageCheck size={20} /></div><div className="quick-actions">{quickActions.map(([route, Icon, label]) => <button type="button" key={route} onClick={() => navigate(routes[route])}><Icon size={18} />{label}</button>)}</div></section>
  </main>;
}
