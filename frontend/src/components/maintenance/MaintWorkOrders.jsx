import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance, createMaintenance, setMaintenanceStatus, getAssets } from '../../services/maintenanceApi';

const MaintWorkOrders = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ asset: '', priority: 'Medium', description: '' });
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const loadAll = async () => {
    try {
      const [list, assetList] = await Promise.all([getMaintenance({ limit: 100 }), getAssets({ limit: 1000 })]);
      setWorkOrders(list.filter(r => ['assigned', 'in-progress', 'testing', 'waiting-for-parts', 'completed'].includes(r.statusRaw)).map(r => ({
        id: r.refId,
        woNumber: r.woId,
        mntId: r.id,
        asset: r.asset,
        technician: r.technician || '—',
        status: r.status,
        priority: r.priority,
        dueDate: r.updated ? String(r.updated).slice(0, 10) : '—',
        partsUsed: [],
        laborHours: 0,
        partsCost: 0,
        laborCost: 0,
        totalCost: 0,
      })));
      setAssets(assetList);
      setError('');
    } catch (err) {
      setError(err && err.message ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const totalCost = useMemo(() => workOrders.reduce((sum, wo) => sum + (wo.totalCost || 0), 0), [workOrders]);

  const handleCreate = async () => {
    if (!formData.asset || !formData.description) { setMessage('Asset and description are required'); return; }
    const asset = assets.find(a => String(a.id) === String(formData.asset));
    if (!asset) { setMessage('Please select a valid asset'); return; }
    setMessage('');
    try {
      await createMaintenance({ asset_id: asset.id, title: formData.description, description: formData.description, priority: formData.priority.toLowerCase() });
      setFormData({ asset: '', priority: 'Medium', description: '' });
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setMessage(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Create failed'));
    }
  };

  const handleStatusUpdate = async (mntId, status) => {
    try {
      await setMaintenanceStatus(mntId, status);
      await loadAll();
    } catch (err) {
      setMessage(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Update failed'));
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading work orders…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>📋 Work Orders</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Create Work Order</button>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}
      {message && <div style={{ padding: '12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>{message}</div>}

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Create New Work Order</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <select value={formData.asset} onChange={(e) => setFormData({...formData, asset: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option value="">Select Asset</option>
              {assets.map(a => <option key={a.id} value={String(a.id)}>{a.name} ({a.assetCode || `#${a.id}`})</option>)}
            </select>
            <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option>Select Priority</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
          <textarea placeholder="Diagnosis & Repair Details" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="4" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleCreate} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Create</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>WO #</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Priority</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Cost</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Due Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((wo) => (
              <tr key={wo.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{wo.woNumber}</td>
                <td style={{ padding: '12px' }}>{wo.asset}</td>
                <td style={{ padding: '12px' }}>{wo.technician}</td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: wo.priority === 'Critical' ? '#fee2e2' : '#fef3c7', color: wo.priority === 'Critical' ? '#991b1b' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>{wo.priority}</span></td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: wo.status === 'In Progress' ? '#dcfce7' : '#dbeafe', color: wo.status === 'In Progress' ? '#166534' : '#075985', fontSize: '0.85rem', fontWeight: '600' }}>{wo.status}</span></td>
                <td style={{ padding: '12px', fontWeight: '600' }}>${wo.totalCost}</td>
                <td style={{ padding: '12px' }}>{wo.dueDate}</td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleStatusUpdate(wo.mntId, 'in-progress')} disabled={wo.status !== 'Assigned'} style={{ padding: '6px 10px', backgroundColor: wo.status === 'Assigned' ? '#2864E8' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '4px', cursor: wo.status === 'Assigned' ? 'pointer' : 'default', fontSize: '0.85rem' }}>Start</button>
                  <button onClick={() => handleStatusUpdate(wo.mntId, 'completed')} disabled={!['In Progress', 'Testing', 'Waiting for Parts'].includes(wo.status)} style={{ padding: '6px 10px', backgroundColor: ['In Progress', 'Testing', 'Waiting for Parts'].includes(wo.status) ? '#10b981' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '4px', cursor: ['In Progress', 'Testing', 'Waiting for Parts'].includes(wo.status) ? 'pointer' : 'default', fontSize: '0.85rem' }}>Complete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        Total Work Orders: {workOrders.length} | Total Cost: ${totalCost} (cost data is not tracked in this module)
      </div>
    </div>
  );
};

export default MaintWorkOrders;