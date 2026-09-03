import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintRepairs = () => {
  const [repairs, setRepairs] = useState([
    { id: 1, repairId: 'REP-001', workOrder: 'WO-001', asset: 'Printer A', technician: 'John Doe', diagnosis: 'Paper feed sensor failure', repairAction: 'Replaced sensor module', partsUsed: ['Sensor Module'], laborHours: 1.5, laborCost: 60, partsCost: 150, totalCost: 210, status: 'Completed', repairDate: '2026-09-01' },
    { id: 2, repairId: 'REP-002', workOrder: 'WO-002', asset: 'Server Room AC', technician: 'Jane Smith', diagnosis: 'Compressor malfunction', repairAction: 'Replaced compressor unit', partsUsed: ['Compressor', 'Filter'], laborHours: 3, laborCost: 120, partsCost: 600, totalCost: 720, status: 'In Progress', repairDate: '2026-08-31' }
  ]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const filteredRepairs = useMemo(() => {
    return repairs.filter(rep => {
      const matchesSearch = search === '' || rep.asset.toLowerCase().includes(search.toLowerCase()) || rep.repairId.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [repairs, search, statusFilter]);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>🛠️ Repairs</h1>
      
      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search repairs..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.map((repair) => (
              <tr key={repair.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{repair.repairId}</td>
                <td style={{ padding: '12px' }}>{repair.workOrder}</td>
                <td style={{ padding: '12px' }}>{repair.asset}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{repair.diagnosis.substring(0, 25)}...</td>
                <td style={{ padding: '12px' }}>{repair.technician}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>${repair.totalCost}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: repair.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: repair.status === 'Completed' ? '#166534' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                    {repair.status}
                  </span>
                </td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                  <button style={{ padding: '6px 10px', backgroundColor: '#06b6d4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        Total Repairs: {filteredRepairs.length} | Total Cost: ${filteredRepairs.reduce((sum, rep) => sum + rep.totalCost, 0)}
      </div>
    </div>
  );
};

export default MaintRepairs;
