import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance, getAssets } from '../../services/maintenanceApi';

const MaintAssetsUnderMaintenance = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    (async () => {
      try {
        const [under, testing, maint] = await Promise.all([
          getAssets({ status: 'under-maintenance', limit: 1000 }),
          getAssets({ status: 'testing', limit: 1000 }),
          getMaintenance({ limit: 100 }),
        ]);
        const all = [...under, ...testing].filter((a, idx, arr) => arr.findIndex((x) => x.id === a.id) === idx);
        setAssets(all.map((a) => {
          const rec = maint.find(m => String(m.assetId) === String(a.id));
          const status = String(a.status || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          return {
            id: a.id,
            asset: a.name,
            tag: a.asset_tag || a.assetCode || '',
            problem: rec ? rec.problem : 'No active maintenance record',
            technician: rec ? rec.technician : 'Not assigned',
            workOrder: rec ? rec.woId : 'No work order',
            startDate: rec && rec.created ? String(rec.created).slice(0, 10) : (a.updated_at || a.updatedAt || '').slice(0, 10) || 'Not started',
            expectedCompletion: 'Not tracked',
            downtime: 0,
            status,
          };
        }));
      } catch (err) {
        setError(err && err.message ? err.message : 'Failed to load assets under maintenance');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalDowntime = useMemo(() => assets.reduce((sum, a) => sum + a.downtime, 0), [assets]);
  const avgDowntime = assets.length ? totalDowntime / assets.length : 0;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading assets…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>⚠️ Assets Under Maintenance</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

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
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{asset.asset}{asset.tag ? ` (${asset.tag})` : ''}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintAssetsUnderMaintenance;