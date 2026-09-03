import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

const emptyStats = {
  summary: { totalInventory: 0, available: 0, issued: 0, lowStock: 0, pendingRequests: 0 },
  distribution: { byStatus: {}, byCategory: {}, byLocation: {}, byDepartment: {} },
  activeUsers: 0, departments: 0, rfidTagged: 0, movement: [], recentTransactions: [],
  health: { server: 'Unavailable', database: 'Unavailable', rfid: 'Unavailable', backup: 'Unavailable' }
};

const StoreDashboard = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(emptyStats);

  useEffect(() => { fetchDashboardData(); }, [timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/inventory/dashboard', { params: { range: timeRange }, timeout: 8000 });
      setStats(response.data?.data || emptyStats);
    } catch (error) {
      toast.error(t.fetchError);
      setStats(emptyStats);
    } finally { setLoading(false); }
  };

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return stats.recentTransactions;
    return stats.recentTransactions.filter(item => [item.transaction_id, item.id, item.type, item.item_name, item.asset_name, item.user, item.department, item.status]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [searchQuery, stats.recentTransactions]);

  const exportDashboard = () => {
    const data = { generatedAt: new Date().toISOString(), timeRange, summary: stats.summary, distribution: stats.distribution, recentTransactions: stats.recentTransactions };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `store-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t.exported);
  };

  const colors = { primary: isDark ? '#63b3ed' : '#2b6cb0', success: isDark ? '#68d391' : '#48bb78', warning: isDark ? '#f6ad55' : '#ed8936', danger: isDark ? '#fc8181' : '#e53e3e', purple: isDark ? '#b794f4' : '#805ad5' };
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#c8dcf5' : '#1a365d', boxWidth: 12 } } }, scales: { y: { ticks: { color: isDark ? '#8896b0' : '#4a5568' }, grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' } }, x: { ticks: { color: isDark ? '#8896b0' : '#4a5568' }, grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' } } } };
  const card = { background: isDark ? '#1e2d45' : '#fff', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, borderRadius: 12, padding: 20, marginBottom: 20 };
  const title = { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', margin: '0 0 16px' };
  const text = { color: isDark ? '#c8dcf5' : '#1a365d' };
  const muted = { color: isDark ? '#8896b0' : '#4a5568' };
  const distributionData = (values, label, palette) => ({ labels: Object.keys(values), datasets: [{ label, data: Object.values(values), backgroundColor: palette, borderColor: isDark ? '#1e2d45' : '#fff', borderWidth: 2 }] });
  const statClick = type => navigate({ totalInventory: '/store/inventory', available: '/store/inventory?status=Available', issued: '/store/inventory?status=Issued', lowStock: '/store/inventory?status=low-stock' }[type]);

  if (loading) return <div style={{ ...card, margin: 20, textAlign: 'center', ...muted }}>{t.loading}</div>;
  return <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto', background: isDark ? '#0d1a2e' : '#f0f4f8', minHeight: '100vh' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
      <div><h1 style={{ ...text, margin: 0 }}>🏪 {t.dashboard}</h1><p style={muted}>{t.welcome}, {user?.fullName || user?.username || 'Store Manager'}</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input aria-label={t.search} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder={t.search} style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}` }} />
        {['week', 'month', 'year'].map(range => <button key={range} onClick={() => setTimeRange(range)} style={{ padding: '8px 12px', borderRadius: 6, border: 0, background: timeRange === range ? colors.primary : isDark ? '#141e2d' : '#fff', color: timeRange === range ? '#fff' : text.color }}>{t[range]}</button>)}
        <button onClick={() => window.print()} style={{ padding: '8px 12px' }}>🖨️ {t.print}</button><button onClick={exportDashboard} style={{ padding: '8px 12px' }}>⬇️ {t.export}</button>
      </div>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
      {[['📦', stats.summary.totalInventory, t.totalInventory, 'totalInventory'], ['✅', stats.summary.available, t.available, 'available'], ['📤', stats.summary.issued, t.issued, 'issued'], ['🔴', stats.summary.lowStock, t.lowStock, 'lowStock'], ['👥', stats.activeUsers, t.activeUsers], ['🏢', stats.departments, t.departments]].map(([icon, value, label, route]) => <button key={label} onClick={() => route && statClick(route)} style={{ ...card, margin: 0, textAlign: 'left', cursor: route ? 'pointer' : 'default' }}><div>{icon}</div><strong style={{ ...text, fontSize: '1.5rem' }}>{value}</strong><div style={muted}>{label}</div></button>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
      <section style={card}><h2 style={title}>{t.inventoryStatus}</h2><div style={{ height: 250 }}><Doughnut data={distributionData(stats.distribution.byStatus, t.inventoryStatus, [colors.success, colors.primary, colors.warning, colors.danger, colors.purple])} options={chartOptions} /></div></section>
      <section style={card}><h2 style={title}>{t.inventoryByCategory}</h2><div style={{ height: 250 }}><Pie data={distributionData(stats.distribution.byCategory, t.inventoryByCategory, ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#81e6d9'])} options={chartOptions} /></div></section>
      <section style={card}><h2 style={title}>{t.byLocation}</h2><div style={{ height: 250 }}><Bar data={distributionData(stats.distribution.byLocation, t.byLocation, ['#319795', '#4299e1', '#ed8936', '#805ad5'])} options={chartOptions} /></div></section>
      <section style={card}><h2 style={title}>{t.byDepartment}</h2><div style={{ height: 250 }}><Bar data={distributionData(stats.distribution.byDepartment, t.byDepartment, ['#48bb78', '#f687b3', '#63b3ed', '#f6ad55'])} options={chartOptions} /></div></section>
    </div>
    <section style={card}><h2 style={title}>{t.inventoryMovement} <span style={{ ...muted, fontWeight: 400 }}>({t[timeRange]})</span></h2><div style={{ height: 220 }}><Line data={{ labels: stats.movement.map(item => item.date), datasets: [{ label: t.issued, data: stats.movement.map(item => item.issued), borderColor: colors.primary, backgroundColor: `${colors.primary}33`, fill: true }, { label: t.returned, data: stats.movement.map(item => item.returned), borderColor: colors.success, backgroundColor: `${colors.success}33`, fill: true }] }} options={chartOptions} /></div></section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}><section style={card}><h2 style={title}>{t.systemHealth}</h2>{[['Server', stats.health.server], ['Database', stats.health.database], ['RFID', stats.health.rfid], ['Backup', stats.health.backup]].map(([label, value]) => <p key={label} style={{ ...text, display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, paddingBottom: 8 }}><span>{label}</span><strong style={{ color: value === 'Connected' || value === 'Ready' || value === 'Active' ? colors.success : colors.warning }}>{value}</strong></p>)}</section><section style={card}><h2 style={title}>{t.performance}</h2><p style={text}>{t.utilization}: <strong>{stats.summary.totalInventory ? Math.round((stats.summary.issued / stats.summary.totalInventory) * 100) : 0}%</strong></p><p style={text}>{t.rfidTagged}: <strong>{stats.rfidTagged}</strong></p><p style={text}>{t.pendingRequests}: <strong>{stats.summary.pendingRequests}</strong></p></section></div>
    <section style={card}><h2 style={title}>{t.recentTransactions}</h2>{filteredTransactions.length ? filteredTransactions.slice(0, 8).map(item => <div key={item.id} style={{ ...text, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 0', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}` }}><span>{item.transaction_id || item.id} · {item.type} · {item.item_name || item.asset_name || ''}</span><span style={muted}>{item.status || ''}</span></div>) : <p style={{ ...muted, textAlign: 'center' }}>{searchQuery ? t.noSearchResults : t.noTransactions}</p>}</section>
    <section style={card}><h2 style={title}>⚡ {t.quickActions}</h2><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{[[t.receiveStock, '/store/receive'], [t.issueItem, '/store/issue'], [t.returnItem, '/store/returns'], [t.viewRequests, '/store/notifications'], [t.viewReports, '/store/reports']].map(([label, route]) => <button key={route} onClick={() => navigate(route)} style={{ padding: '9px 14px', border: 0, borderRadius: 6, background: colors.primary, color: '#fff', cursor: 'pointer' }}>{label}</button>)}</div></section>
  </div>;
};

const englishTranslations = { dashboard: 'Store Dashboard', welcome: 'Welcome', totalInventory: 'Total Inventory', available: 'Available', issued: 'Issued', returned: 'Returned', lowStock: 'Low Stock', pendingRequests: 'Pending Requests', inventoryStatus: 'Inventory Status', inventoryByCategory: 'Inventory by Category', byLocation: 'Assets by Location', byDepartment: 'Assets by Department', inventoryMovement: 'Inventory Movement', recentTransactions: 'Recent Transactions', quickActions: 'Quick Actions', systemHealth: 'System Health', performance: 'Performance Metrics', utilization: 'Asset Utilization', activeUsers: 'Active Users', departments: 'Departments', rfidTagged: 'RFID Tagged', receiveStock: 'Receive Stock', issueItem: 'Issue Item', returnItem: 'Return Item', viewRequests: 'View Requests', viewReports: 'View Reports', week: 'This Week', month: 'This Month', year: 'This Year', search: 'Search dashboard', print: 'Print', export: 'Export JSON', exported: 'Dashboard exported', loading: 'Loading...', fetchError: 'Failed to load dashboard data', noTransactions: 'No recent transactions', noSearchResults: 'No matching transactions' };
const amharicTranslations = englishTranslations;

export default StoreDashboard;
