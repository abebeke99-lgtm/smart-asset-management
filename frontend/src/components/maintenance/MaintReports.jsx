import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getInventory, getMaintenance, getMaintenanceDashboard, getRepairHistory, getTechnicians } from '../../services/maintenanceApi';

const MaintReports = () => {
  const [reportType, setReportType] = useState('summary');
  const [dashboard, setDashboard] = useState({});
  const [maintenance, setMaintenance] = useState([]);
  const [repairReport, setRepairReport] = useState({ records: [], stats: {} });
  const [technicians, setTechnicians] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    (async () => {
      try {
        const [dash, list, repairs, techList, stock] = await Promise.all([
          getMaintenanceDashboard(period),
          getMaintenance({ limit: 100, period, search: search.trim() || undefined }),
          getRepairHistory({ limit: 100, period, search: search.trim() || undefined }),
          getTechnicians(),
          getInventory(),
        ]);
        setDashboard(dash);
        setMaintenance(list);
        setRepairReport({ records: repairs.records || [], stats: repairs.stats || {} });
        setTechnicians(techList);
        setInventory(stock);
      } catch (err) {
        setError(err && err.message ? err.message : 'Failed to load reports data');
      } finally {
        setLoading(false);
      }
    })();
  }, [period, search]);

  const reports = useMemo(() => {
    const now = Date.now();
    const staleMs = 14 * 24 * 60 * 60 * 1000;
    const overdue = maintenance.filter((m) => m.statusRaw !== 'completed' && m.statusRaw !== 'rejected' && now - (new Date(m.updated || m.created || now)).getTime() > staleMs).length;
    const byStatus = dashboard.byStatus || {};
    const total = dashboard.total ?? maintenance.length;
    const repairStats = repairReport.stats || {};
    const repairCount = Number(repairStats.totalRepairs || repairReport.records.length || 0);
    const totalRepairCost = Number(repairStats.totalRepairCost || 0);
    const completedItems = maintenance.filter((m) => String(m.statusRaw || '').toLowerCase() === 'completed');
    const avgRepairHours = completedItems.length
      ? completedItems.reduce((sum, item) => {
          const created = item.created ? new Date(item.created).getTime() : Date.now();
          const updated = item.updated ? new Date(item.updated).getTime() : created;
          const hours = Math.max(0, (updated - created) / 3600000);
          return sum + hours;
        }, 0) / completedItems.length
      : 0;
    const topTechnician = technicians
      .map((technician) => ({ name: technician.fullName || technician.username, tasks: maintenance.filter((item) => item.technician === (technician.fullName || technician.username)).length }))
      .sort((left, right) => right.tasks - left.tasks)[0];
    return {
      summary: {
        total,
        completed: byStatus.completed ?? maintenance.filter((m) => m.statusRaw === 'completed').length,
        pending: byStatus.pending ?? maintenance.filter((m) => m.statusRaw === 'pending' || m.statusRaw === 'approved').length,
        overdue,
        avgCost: repairCount ? (totalRepairCost / repairCount).toFixed(2) : 'Not available',
        assetCondition: dashboard.assetCondition || {},
        assetStatus: dashboard.assetStatus || {},
      },
      workOrders: {
        count: maintenance.length,
        active: maintenance.filter((m) => !['completed', 'rejected', 'cancelled'].includes(String(m.statusRaw || '').toLowerCase())).length,
      },
      repairs: { count: repairCount, cost: totalRepairCost.toFixed(2), avgHours: avgRepairHours.toFixed(1) },
      preventive: { count: maintenance.filter((m) => ['pending', 'approved', 'assigned', 'in-progress', 'testing'].includes(String(m.statusRaw || '').toLowerCase())).length },
      technicians: { top: topTechnician?.name || 'No assigned technicians', tasks: topTechnician?.tasks || 0, rating: avgRepairHours ? `${avgRepairHours.toFixed(1)}h avg` : 'Not available' },
      spareParts: { count: inventory.length },
      downtime: { count: maintenance.filter((m) => !['completed', 'rejected', 'cancelled'].includes(String(m.statusRaw || '').toLowerCase())).length },
    };
  }, [dashboard, maintenance, repairReport, technicians, inventory]);

  const exportCSV = () => {
    const rows = maintenance.map((m) => ({
      id: m.mntId,
      asset: m.asset,
      title: m.title,
      requester: m.requester,
      technician: m.technician,
      department: m.department,
      priority: m.priority,
      status: m.status,
      created: m.created,
      updated: m.updated,
    }));
    const headers = ['ID', 'Asset', 'Title', 'Requester', 'Technician', 'Department', 'Priority', 'Status', 'Created', 'Updated'];
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => {
        const val = String(r[Object.keys(r)[headers.indexOf(h)]] || '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-report-${reportType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading reports…</div>;

  const statCard = (value, label, sub, color = '#2864E8') => (
    <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color, marginBottom: '8px' }}>{value}</div>
      <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{sub}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>📊 Maintenance Reports</h1>
        <button onClick={exportCSV} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>📥 Export CSV</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search maintenance or repairs..." style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minWidth: '240px' }} />
        <select value={period} onChange={(event) => setPeriod(event.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="90days">Last 90 days</option>
        </select>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      {/* Report Type Selector */}
      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['summary', 'workOrders', 'repairs', 'preventive', 'technicians', 'spareParts', 'downtime'].map((type) => (
            <button key={type} onClick={() => setReportType(type)} style={{ padding: '8px 12px', backgroundColor: reportType === type ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === type ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              {type === 'summary' ? 'Summary' : type === 'workOrders' ? 'Work Orders' : type === 'repairs' ? 'Repairs' : type === 'preventive' ? 'Preventive' : type === 'technicians' ? 'Technicians' : type === 'spareParts' ? 'Spare Parts' : 'Downtime'}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      {reportType === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.summary.total, 'Total Maintenance', 'All Time')}
          {statCard(reports.summary.completed, 'Completed', `${reports.summary.total ? ((reports.summary.completed / reports.summary.total) * 100).toFixed(0) : 0}%`, '#10b981')}
          {statCard(reports.summary.pending, 'Pending', `${reports.summary.total ? ((reports.summary.pending / reports.summary.total) * 100).toFixed(0) : 0}%`, '#fbbf24')}
          {statCard(reports.summary.overdue, 'Overdue', `${reports.summary.total ? ((reports.summary.overdue / reports.summary.total) * 100).toFixed(0) : 0}%`, '#ef4444')}
          {statCard(reports.summary.avgCost === 'Not available' ? reports.summary.avgCost : `$${reports.summary.avgCost}`, 'Avg Repair Cost', reports.summary.avgCost === 'Not available' ? 'No persisted repair costs in this period' : 'From repair records', '#06b6d4')}
          {statCard(Object.keys(reports.summary.assetCondition).length ? Object.entries(reports.summary.assetCondition).map(([condition, count]) => `${condition}: ${count}`).join(', ') : 'No asset records', 'Asset Condition', 'From persisted Asset.condition', '#8b5cf6')}
          {statCard(Object.keys(reports.summary.assetStatus).length ? Object.entries(reports.summary.assetStatus).map(([status, count]) => `${status}: ${count}`).join(', ') : 'No asset records', 'Asset Status', 'From persisted Asset.status', '#0f766e')}
        </div>
      )}

      {reportType === 'workOrders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.workOrders.count, 'Work Orders', `${reports.workOrders.active} active in the current maintenance backlog`, '#2864E8')}
        </div>
      )}

      {reportType === 'repairs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.repairs.count, 'Total Repairs', 'In progress & completed', '#2864E8')}
          {statCard(`$${reports.repairs.cost}`, 'Total Cost', 'From persisted repair records', '#06b6d4')}
          {statCard(`${reports.repairs.avgHours}h`, 'Avg Repair Time', 'Derived from closed maintenance records', '#fbbf24')}
        </div>
      )}

      {reportType === 'preventive' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.preventive.count, 'Preventive Schedules', 'Derived from active maintenance review records', '#10b981')}
        </div>
      )}

      {reportType === 'technicians' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(technicians.length, 'Active Technicians', 'Users in maintenance role', '#2864E8')}
          {statCard(reports.technicians.top, 'Top Performer', `${reports.technicians.tasks} assigned tasks`, '#10b981')}
          {statCard(reports.technicians.rating, 'Avg Rating', 'No persisted rating data', '#fbbf24')}
        </div>
      )}

      {reportType === 'spareParts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.spareParts.count, 'Spare Parts', 'From the live inventory feed', '#8b5cf6')}
        </div>
      )}

      {reportType === 'downtime' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(`${reports.downtime.count} items`, 'Downtime', 'Open maintenance records in the active backlog', '#ef4444')}
        </div>
      )}
    </div>
  );
};

export default MaintReports;