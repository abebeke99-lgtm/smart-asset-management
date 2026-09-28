import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintWorkOrders = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMaintenance({ limit: 200 })
      .then((items) => {
        if (!mounted) return;
        const rows = items
          .filter((item) => item && item.id)
          .map((item) => ({
            id: item.id,
            workOrderNumber: `WO-${String(item.id).padStart(3, '0')}`,
            asset: item.asset || 'Unassigned asset',
            title: item.title || item.problem || 'Maintenance work order',
            priority: item.priority || 'Medium',
            technician: item.technician || 'Unassigned',
            status: item.status || 'Pending',
            statusRaw: item.statusRaw || 'pending',
            created: item.created || item.updated || new Date().toISOString(),
          }));
        setWorkOrders(rows);
      })
      .catch((err) => {
        if (mounted) setError(err && err.message ? err.message : 'Failed to load work orders');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const activeCount = workOrders.filter((item) => !['completed', 'rejected', 'cancelled'].includes(String(item.statusRaw).toLowerCase())).length;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading work orders…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>Work Orders</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2864E8' }}>{workOrders.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Work Orders</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{activeCount}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Active</div>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Work Order</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Title</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Priority</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((item) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600', color: '#2864E8' }}>{item.workOrderNumber}</td>
                <td style={{ padding: '12px' }}>{item.asset}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>{item.title}</td>
                <td style={{ padding: '12px' }}>{item.technician}</td>
                <td style={{ padding: '12px' }}>{item.priority}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: item.statusRaw === 'completed' ? '#dcfce7' : item.statusRaw === 'in-progress' || item.statusRaw === 'testing' ? '#fef3c7' : '#dbeafe', color: item.statusRaw === 'completed' ? '#166534' : '#1d4ed8', fontSize: '0.85rem', fontWeight: '600' }}>
                    {item.status}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{new Date(item.created).toLocaleDateString()}</td>
              </tr>
            ))}
            {workOrders.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>No maintenance work orders found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintWorkOrders;