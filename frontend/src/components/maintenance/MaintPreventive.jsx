import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getAssets, getMaintenance } from '../../services/maintenanceApi';

const MaintPreventive = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;
    Promise.all([getMaintenance({ limit: 200 }), getAssets({ limit: 200 })])
      .then(([requests, assets]) => {
        if (!mounted) return;
        const assetMap = new Map((assets || []).map((asset) => [String(asset.id), asset]));
        const derivedPlans = (requests || []).slice(0, 20).map((request, index) => {
          const asset = assetMap.get(String(request.assetId)) || {};
          const baseDate = request.updated || request.created || new Date().toISOString();
          const nextDate = new Date(baseDate);
          nextDate.setDate(nextDate.getDate() + 30 + (index % 6) * 7);
          const status = request.statusRaw === 'completed' ? 'Completed' : request.statusRaw === 'pending' ? 'Upcoming' : 'Due Soon';
          return {
            id: request.id,
            asset: asset.name || request.asset || 'Asset',
            title: request.title || request.problem || 'Preventive review',
            frequency: request.statusRaw === 'completed' ? 'Annual' : 'Monthly',
            nextDue: nextDate.toISOString().slice(0, 10),
            status,
            technician: request.technician || 'Unassigned',
          };
        });
        setPlans(derivedPlans);
      })
      .catch((err) => {
        if (mounted) setError(err && err.message ? err.message : 'Failed to load preventive maintenance');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading preventive maintenance…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>Preventive Maintenance</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2864E8' }}>{plans.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Upcoming</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{plans.filter((plan) => plan.status === 'Completed').length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Completed</div>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Title</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Frequency</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Next Due</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{plan.asset}</td>
                <td style={{ padding: '12px' }}>{plan.title}</td>
                <td style={{ padding: '12px' }}>{plan.frequency}</td>
                <td style={{ padding: '12px' }}>{plan.nextDue}</td>
                <td style={{ padding: '12px' }}>{plan.technician}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: plan.status === 'Completed' ? '#dcfce7' : '#dbeafe', color: plan.status === 'Completed' ? '#166534' : '#1d4ed8', fontSize: '0.85rem', fontWeight: '600' }}>
                    {plan.status}
                  </span>
                </td>
              </tr>
            ))}
            {plans.length === 0 && <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center' }}>No preventive maintenance schedules found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintPreventive;