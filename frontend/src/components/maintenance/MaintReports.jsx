import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance, getMaintenanceDashboard, getTechnicians, getInventory } from '../../services/maintenanceApi';

const MaintReports = () => {
  const [reportType, setReportType] = useState('summary');
  const [dashboard, setDashboard] = useState({});
  const [maintenance, setMaintenance] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    (async () => {
      try {
        const [dash, list, techList, inv] = await Promise.all([
          getMaintenanceDashboard(),
          getMaintenance({ limit: 300 }),
          getTechnicians(),
          getInventory(),
        ]);
        setDashboard(dash);
        setMaintenance(list);
        setTechnicians(techList);
        setInventory(inv);
      } catch (err) {
        setError(err && err.message ? err.message : 'Failed to load reports data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reports = useMemo(() => {
    const now = Date.now();
    const staleMs = 14 * 24 * 60 * 60 * 1000;
    const overdue = maintenance.filter((m) => m.statusRaw !== 'completed' && m.statusRaw !== 'rejected' && now - (new Date(m.updated || m.created || now)).getTime() > staleMs).length;
    const byStatus = dashboard.byStatus || {};
    const total = dashboard.total ?? maintenance.length;
    const topName = technicians[0] ? (technicians[0].fullName || technicians[0].username) : '';
    return {
      summary: {
        total,
        completed: byStatus.completed ?? maintenance.filter((m) => m.statusRaw === 'completed').length,
        pending: byStatus.pending ?? maintenance.filter((m) => m.statusRaw === 'pending' || m.statusRaw === 'approved').length,
        overdue,
        avgCost: 0,
      },
      workOrders: {
        count: total,
        completed: byStatus.completed ?? 0,
        inProgress: (byStatus['in-progress'] ?? 0) + (byStatus['waiting-for-parts'] ?? 0) + (byStatus.testing ?? 0),
        pending: byStatus.pending ?? 0,
      },
      repairs: { count: maintenance.filter((m) => ['in-progress', 'waiting-for-parts', 'testing', 'completed'].includes(m.statusRaw)).length, cost: 0, avgTime: 0 },
      preventive: { scheduled: maintenance.filter((m) => m.statusRaw === 'approved' || m.statusRaw === 'pending').length, completed: byStatus.completed ?? 0, upcoming: maintenance.filter((m) => m.statusRaw === 'approved').length },
      technicians: { top: topName || 'No technicians', tasks: topName ? maintenance.filter((m) => m.technician === topName).length : 0, rating: 0 },
      spareParts: { issued: inventory.reduce((sum, p) => sum + (Number(p.damaged_quantity) || 0) + (Number(p.issued_quantity) || 0), 0), reserved: inventory.reduce((sum, p) => sum + (Number(p.reserved_quantity) || 0), 0), lowStock: inventory.filter((p) => p.is_low_stock || p.stock_status === 'Low Stock' || p.stock_status === 'Out of Stock').length },
      downtime: { total: 0, avgPerAsset: 0 },
    };
  }, [dashboard, maintenance, technicians, inventory]);

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
          {statCard(`$${reports.summary.avgCost}`, 'Avg Cost', 'No cost data tracked yet', '#06b6d4')}
        </div>
      )}

      {reportType === 'workOrders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.workOrders.count, 'Total Work Orders', 'All Time')}
          {statCard(reports.workOrders.completed, 'Completed', 'Work orders done', '#10b981')}
          {statCard(reports.workOrders.inProgress, 'In Progress', 'Works ongoing', '#2864E8')}
          {statCard(reports.workOrders.pending, 'Pending', 'Awaiting approval/start', '#fbbf24')}
        </div>
      )}

      {reportType === 'repairs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.repairs.count, 'Total Repairs', 'In progress & completed', '#2864E8')}
          {statCard(`$${reports.repairs.cost}`, 'Total Cost', 'No cost data tracked yet', '#06b6d4')}
          {statCard(`${reports.repairs.avgTime}h`, 'Avg Repair Time', 'No time tracking available', '#fbbf24')}
        </div>
      )}

      {reportType === 'preventive' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(reports.preventive.scheduled, 'Scheduled', 'Approved/pending work', '#2864E8')}
          {statCard(reports.preventive.completed, 'Completed', 'All completed work', '#10b981')}
          {statCard(reports.preventive.upcoming, 'Upcoming', 'Approved, not started', '#fbbf24')}
        </div>
      )}

      {reportType === 'technicians' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(technicians.length, 'Active Technicians', 'Users in maintenance role', '#2864E8')}
          {statCard(reports.technicians.top, 'Top Performer', `${reports.technicians.tasks} assigned tasks`, '#10b981')}
          {statCard(`${reports.technicians.rating}`, 'Avg Rating', 'No rating data tracked', '#fbbf24')}
        </div>
      )}

      {reportType === 'spareParts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(inventory.length, 'Tracked Parts', 'From store inventory', '#2864E8')}
          {statCard(reports.spareParts.issued, 'Issued', 'Damaged/issued quantities', '#fbbf24')}
          {statCard(reports.spareParts.reserved, 'Reserved', 'Reserved quantities', '#06b6d4')}
          {statCard(reports.spareParts.lowStock, 'Low/Out of Stock', 'Needs restock', '#ef4444')}
        </div>
      )}

      {reportType === 'downtime' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {statCard(`${reports.downtime.total}h`, 'Total Downtime', 'No downtime tracking available', '#ef4444')}
          {statCard(`${reports.downtime.avgPerAsset}h`, 'Avg Per Asset', 'No downtime tracking available', '#fbbf24')}
        </div>
      )}
    </div>
  );
};

export default MaintReports;