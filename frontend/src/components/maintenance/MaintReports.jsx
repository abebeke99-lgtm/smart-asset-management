import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintReports = () => {
  const [reportType, setReportType] = useState('summary');
  const [reports] = useState({
    summary: { title: 'Maintenance Summary', total: 152, completed: 89, pending: 35, overdue: 28, avgCost: 1240 },
    workOrders: { count: 45, completed: 28, inProgress: 12, pending: 5 },
    repairs: { count: 38, cost: 18500, avgTime: 2.3 },
    preventive: { scheduled: 52, completed: 40, upcoming: 12 },
    technicians: { top: 'Jane Smith', tasks: 47, rating: 4.8 },
    spareParts: { issued: 234, reserved: 56, lowStock: 8 },
    downtime: { total: 142, avgPerAsset: 5.2 }
  });

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>📊 Maintenance Reports</h1>
        <button style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>📥 Export CSV</button>
      </div>

      {/* Report Type Selector */}
      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setReportType('summary')} style={{ padding: '8px 12px', backgroundColor: reportType === 'summary' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'summary' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Summary</button>
          <button onClick={() => setReportType('workOrders')} style={{ padding: '8px 12px', backgroundColor: reportType === 'workOrders' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'workOrders' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Work Orders</button>
          <button onClick={() => setReportType('repairs')} style={{ padding: '8px 12px', backgroundColor: reportType === 'repairs' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'repairs' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Repairs</button>
          <button onClick={() => setReportType('preventive')} style={{ padding: '8px 12px', backgroundColor: reportType === 'preventive' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'preventive' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Preventive</button>
          <button onClick={() => setReportType('technicians')} style={{ padding: '8px 12px', backgroundColor: reportType === 'technicians' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'technicians' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Technicians</button>
          <button onClick={() => setReportType('spareParts')} style={{ padding: '8px 12px', backgroundColor: reportType === 'spareParts' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'spareParts' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Spare Parts</button>
          <button onClick={() => setReportType('downtime')} style={{ padding: '8px 12px', backgroundColor: reportType === 'downtime' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: reportType === 'downtime' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Downtime</button>
        </div>
      </div>

      {/* Report Content */}
      {reportType === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2864E8', marginBottom: '8px' }}>{reports.summary.total}</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>Total Maintenance</div>
            <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>All Time</div>
          </div>
          <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>{reports.summary.completed}</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>Completed</div>
            <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{((reports.summary.completed / reports.summary.total) * 100).toFixed(0)}%</div>
          </div>
          <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24', marginBottom: '8px' }}>{reports.summary.pending}</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>Pending</div>
            <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{((reports.summary.pending / reports.summary.total) * 100).toFixed(0)}%</div>
          </div>
          <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>{reports.summary.overdue}</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>Overdue</div>
            <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{((reports.summary.overdue / reports.summary.total) * 100).toFixed(0)}%</div>
          </div>
          <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#06b6d4', marginBottom: '8px' }}>${reports.summary.avgCost}</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>Avg Cost</div>
            <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Per Maintenance</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintReports;