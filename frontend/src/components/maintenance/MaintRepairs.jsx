import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintRepairs = () => {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getMaintenance({ limit: 100 })
      .then((list) => setRepairs(list
        .filter(r => ['in-progress', 'testing', 'waiting-for-parts', 'completed'].includes(r.statusRaw))
        .map(r => ({
          id: r.id,
          repairId: r.repairId,
          workOrder: r.woId,
          asset: r.asset,
          technician: r.technician || '—',
          diagnosis: r.problem,
          repairAction: r.problem,
          partsUsed: [],
          laborHours: 0,
          laborCost: 0,
          partsCost: 0,
          totalCost: 0,
          status: r.status,
          repairDate: r.updated ? String(r.updated).slice(0, 10) : '—',
        }))))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load repairs'))
      .finally(() => setLoading(false));
  }, []);

  const filteredRepairs = useMemo(() => {
    return repairs.filter(rep => {
      const matchesSearch = search === '' || rep.asset.toLowerCase().includes(search.toLowerCase()) || rep.repairId.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [repairs, search, statusFilter]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading repairs…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>🛠️ Repairs</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search repairs..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Waiting for Parts">Waiting for Parts</option>
            <option value="Testing">Testing</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>WO</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Diagnosis</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Total Cost</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.map((repair) => (
              <tr key={repair.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{repair.repairId}</td>
                <td style={{ padding: '12px' }}>{repair.workOrder}</td>
                <td style={{ padding: '12px' }}>{repair.asset}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{(repair.diagnosis || '').substring(0, 25)}...</td>
                <td style={{ padding: '12px' }}>{repair.technician}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>${repair.totalCost}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: repair.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: repair.status === 'Completed' ? '#166534' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                    {repair.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        Total Repairs: {filteredRepairs.length} | Total Cost: ${filteredRepairs.reduce((sum, rep) => sum + rep.totalCost, 0)} (cost data is not tracked in this module)
      </div>
    </div>
  );
};

export default MaintRepairs;