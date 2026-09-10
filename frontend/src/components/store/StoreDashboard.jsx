import React, { useEffect, useState } from 'react';
import { BarChart3, Boxes, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, History, PackageCheck, PackageOpen, PackagePlus, PackageX, RefreshCw, ScanLine, TriangleAlert, Truck, Wrench } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import './StoreDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const emptyData = { kpis: {}, status: {}, today: {}, inventoryHealth: {}, pendingTransactions: [], recentMovements: [], recentTransactions: [], lowStockAlerts: [], verification: {}, maintenance: {}, health: {} };
const icons = { totalAssets: Boxes, availableAssets: PackageCheck, pendingRequests: ClipboardList, pendingReceipts: PackagePlus, pendingIssues: PackageOpen, pendingReturns: PackageX, pendingTransfers: Truck, lowStock: TriangleAlert };
const routes = { Inventory: '/store/inventory', Available: '/store/available-assets', LowStock: '/store/low-stock', Receive: '/store/receive', Issue: '/store/issue', Return: '/store/returns', Transfer: '/store/transfers', Verification: '/store/verification', Maintenance: '/store/maintenance' };
const english = { title: 'Store Manager', subtitle: 'Physical Asset Movement & Inventory Control', online: 'Online', offline: 'Offline', loading: 'Loading dashboard...', error: 'Unable to load Store dashboard', forbidden: 'You do not have permission to view this dashboard.', retry: 'Retry', noActivity: 'No store activity yet', totalAssets: 'Total Store Assets', availableAssets: 'Available Assets', pendingRequests: 'Pending Requests', pendingReceipts: 'Pending Receipts', pendingIssues: 'Pending Issues', pendingReturns: 'Pending Returns', pendingTransfers: 'Pending Transfers', lowStock: 'Low Stock', operational: 'Operational Status', inMaintenance: 'In Maintenance', awaitingVerification: 'Awaiting Verification', discrepancies: 'Verification Discrepancies', inventoryHealth: 'Inventory Health', pending: 'Pending Transactions', recent: 'Recent Asset Movements', alerts: 'Low Stock Alerts', verification: 'Asset Verification', today: "Today's Store Activity", view: 'View', viewLowStock: 'View Low Stock', receive: 'Assets Received', issue: 'Assets Issued', return: 'Assets Returned', transfer: 'Assets Transferred', adjustment: 'Stock Adjustments', scans: 'Verification Scans', verified: 'Verified', missing: 'Missing', damaged: 'Damaged', unverified: 'Unverified', noSession: 'No verification session yet' };
const amharic = { ...english, title: 'የመጋዘን አስተዳዳሪ', subtitle: 'የንብረት እንቅስቃሴ እና የእቃ ቁጥጥር', online: 'በመስመር ላይ', offline: 'ከመስመር ውጭ', loading: 'ዳሽቦርዱ በመጫን ላይ...', error: 'የመጋዘን ዳሽቦርዱ መጫን አልተቻለም', retry: 'እንደገና ሞክር', noActivity: 'እስካሁን የመጋዘን እንቅስቃሴ የለም', totalAssets: 'የመጋዘን ንብረቶች', availableAssets: 'ዝግጁ ንብረቶች', lowStock: 'ዝቅተኛ ክምችት' };
const date = (value) => value ? new Date(value).toLocaleDateString() : '-';
const normalizeDashboardData = (payload) => {
  const source = payload || {};
  const summary = source.summary || {};
  const legacyKpis = {
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
    health: { ...emptyData.health, ...(source.health || {}) },
  };
};

export default function StoreDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = language === 'en' ? english : amharic;
  const [state, setState] = useState({ loading: true, error: '', data: emptyData });
  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/store/dashboard', { timeout: 10000 });
      setState({ loading: false, error: '', data: normalizeDashboardData(response.data?.data) });
    } catch (error) {
      setState({ loading: false, error: error.response?.status === 403 ? 'forbidden' : 'error', data: emptyData });
    }
  };
  useEffect(() => { load(); }, []);
  if (state.loading) return <div className="store-dashboard-state"><Clock3 size={22} /> {t.loading}</div>;
  if (state.error) return <div className="store-dashboard-state store-dashboard-error"><TriangleAlert size={22} /><p>{t[state.error]}</p><button type="button" onClick={load}><RefreshCw size={16} /> {t.retry}</button></div>;

  const { data } = state;
  const kpis = [['totalAssets', data.kpis.totalAssets], ['availableAssets', data.kpis.availableAssets], ['pendingRequests', data.kpis.pendingRequests], ['pendingReceipts', data.kpis.pendingReceipts], ['pendingIssues', data.kpis.pendingIssues], ['pendingReturns', data.kpis.pendingReturns], ['pendingTransfers', data.kpis.pendingTransfers], ['lowStock', data.kpis.lowStock]];
  const health = data.inventoryHealth || {};
  const chart = { labels: ['Available', 'Assigned', 'Maintenance', 'Missing', 'Damaged'], datasets: [{ label: 'Assets', data: [health.available || 0, health.assigned || 0, health.maintenance || 0, health.missing || 0, health.damaged || 0], backgroundColor: ['#0ea5e9', '#2563eb', '#f59e0b', '#ef4444', '#64748b'], borderRadius: 5 }] };
  const quickActions = [['Receive', PackagePlus], ['Issue', PackageOpen], ['Return', PackageX], ['Transfer', Truck], ['Verification', ScanLine], ['Inventory', Boxes], ['Maintenance', Wrench]];
  return <main className="store-dashboard">
    <header className="store-dashboard-header"><div><p className="eyebrow">{t.title}</p><h1>{t.subtitle}</h1><p className="store-welcome">{user?.fullName || user?.username || t.title}</p></div><div className="store-connection"><span className="status-dot" /> {data.health?.api === 'online' ? t.online : t.offline}</div></header>
    <section className="store-kpis" aria-label="Store metrics">{kpis.map(([key, value]) => { const Icon = icons[key]; return <button className="store-kpi" key={key} type="button" onClick={() => navigate(key === 'lowStock' ? routes.LowStock : key === 'availableAssets' ? routes.Available : routes.Inventory)}><span className="kpi-icon"><Icon size={19} /></span><strong>{value ?? 0}</strong><span>{t[key]}</span></button>; })}</section>
    <section className="store-section"><div className="section-heading"><div><p className="eyebrow">{t.operational}</p><h2>{t.today}</h2></div></div><div className="status-grid">{[['inMaintenance', Wrench], ['awaitingVerification', ScanLine], ['discrepancies', TriangleAlert]].map(([key, Icon]) => <div className="status-tile" key={key}><Icon size={18} /><strong>{data.status?.[key] || 0}</strong><span>{t[key]}</span></div>)}</div></section>
    <div className="store-columns"><section className="store-section"><div className="section-heading"><h2>{t.inventoryHealth}</h2><BarChart3 size={20} /></div><div className="chart-wrap"><Bar data={chart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></section><section className="store-section"><div className="section-heading"><h2>{t.today}</h2><History size={20} /></div><div className="activity-list">{[['receive', t.receive], ['issue', t.issue], ['return', t.return], ['transfer', t.transfer], ['adjustment', t.adjustment], ['verificationScans', t.scans]].map(([key, label]) => <div key={key}><span>{label}</span><strong>{data.today?.[key] || 0}</strong></div>)}</div></section></div>
    <section className="store-section"><div className="section-heading"><h2>{t.pending}</h2><ClipboardList size={20} /></div><div className="pending-grid">{(data.pendingTransactions || []).map((item) => <button type="button" className="pending-item" key={item.type} onClick={() => navigate(item.route)}><span>{item.type}</span><strong>{item.count}</strong><small>{t.view} <span aria-hidden="true">›</span></small></button>)}</div></section>
    <div className="store-columns"><section className="store-section"><div className="section-heading"><h2>{t.alerts}</h2><TriangleAlert size={20} /></div>{data.lowStockAlerts?.length ? <div className="alert-list">{data.lowStockAlerts.map((item) => <div className="alert-row" key={item.id}><div><strong>{item.item}</strong><small>{item.currentQuantity} / {item.reorderLevel}</small></div><span className={`severity severity-${item.severity.toLowerCase()}`}>{item.severity}</span></div>)}<button className="text-link" type="button" onClick={() => navigate(routes.LowStock)}>{t.viewLowStock} <span aria-hidden="true">›</span></button></div> : <p className="empty-copy">{t.noActivity}</p>}</section><section className="store-section"><div className="section-heading"><h2>{t.verification}</h2><ClipboardCheck size={20} /></div>{data.verification?.lastVerification ? <div className="verification-summary"><strong>{date(data.verification.lastVerification)}</strong><div>{[['verified', CheckCircle2], ['missing', TriangleAlert], ['damaged', PackageX], ['unverified', ScanLine]].map(([key, Icon]) => <span key={key}><Icon size={15} /> {t[key]}: {data.verification[key] || 0}</span>)}</div></div> : <p className="empty-copy">{t.noSession}</p>}</section></div>
    <section className="store-section"><div className="section-heading"><h2>{t.recent}</h2><History size={20} /></div>{data.recentMovements?.length ? <div className="movement-table-wrap"><table><thead><tr><th>Asset</th><th>Type</th><th>From</th><th>To</th><th>Date</th><th>Status</th></tr></thead><tbody>{data.recentMovements.map((movement) => <tr key={movement.id}><td>{movement.asset}</td><td>{movement.type}</td><td>{movement.from}</td><td>{movement.to}</td><td>{date(movement.date)}</td><td><span className="table-status">{movement.status}</span></td></tr>)}</tbody></table></div> : <p className="empty-copy">{t.noActivity}</p>}</section>
    <section className="store-section"><div className="section-heading"><h2>Quick Actions</h2><PackageCheck size={20} /></div><div className="quick-actions">{quickActions.map(([label, Icon]) => <button type="button" key={label} onClick={() => navigate(routes[label])}><Icon size={18} />{label}</button>)}</div></section>
  </main>;
}
