import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintAssetsUnderMaintenance = () => {
  const [assets, setAssets] = useState([
    { id: 1, asset: 'Server Room AC', problem: 'Compressor malfunction', technician: 'Jane Smith', workOrder: 'WO-002', startDate: '2026-08-28', expectedCompletion: '2026-09-02', downtime: 5, status: 'In Progress' },
    { id: 2, asset: 'Printer A', problem: 'Paper feed sensor failure', technician: 'John Doe', workOrder: 'WO-001', startDate: '2026-09-01', expectedCompletion: '2026-09-01', downtime: 0.5, status: 'Completed' }
  ]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const totalDowntime = assets.reduce((sum, a) => sum + a.downtime, 0);
  const avgDowntime = totalDowntime / assets.length;
  const criticalCount = assets.filter(a => a.downtime > 7).length;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>⚠️ Assets Under Maintenance</h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24' }}>{assets.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Assets</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{totalDowntime.toFixed(1)}h</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Downtime</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2864E8' }}>{avgDowntime.toFixed(1)}h</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Avg Downtime</div>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Problem</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Work Order</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Start Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Downtime (h)</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{asset.asset}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{asset.problem}</td>
                <td style={{ padding: '12px' }}>{asset.technician}</td>
                <td style={{ padding: '12px', fontWeight: '600', color: '#2864E8' }}>{asset.workOrder}</td>
                <td style={{ padding: '12px' }}>{asset.startDate}</td>
                <td style={{ padding: '12px', fontWeight: '600', color: asset.downtime > 7 ? '#ef4444' : '#fbbf24' }}>{asset.downtime}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: asset.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: asset.status === 'Completed' ? '#166534' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                    {asset.status}
                  </span>
                </td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintAssetsUnderMaintenance;