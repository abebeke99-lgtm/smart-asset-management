import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getRepairHistory } from '../../services/maintenanceApi';

const MaintRepairs = () => {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ totalRepairs: 0, totalRepairCost: 0 });
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    setLoading(true);
    getRepairHistory({ page, limit: 20, search: search.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter })
      .then((result) => {
        setRepairs(result.records || []);
        setPagination({ total: result.total || 0, totalPages: result.totalPages || 1 });
        setStats(result.stats || { totalRepairs: 0, totalRepairCost: 0 });
        setError('');
      })
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load service records'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const filteredRepairs = useMemo(() => repairs, [repairs]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading repairs…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>Service Records</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search service records..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Diagnosis</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Recorded Repair Cost</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.map((repair) => (
              <tr key={repair.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{repair.repairId}</td>
                <td style={{ padding: '12px' }}>{repair.asset?.name || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{(repair.diagnosis || '').substring(0, 25)}...</td>
                <td style={{ padding: '12px' }}>{repair.technician}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>${Number(repair.repairCost || 0).toFixed(2)}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: repair.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: repair.status === 'Completed' ? '#166534' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                    {repair.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredRepairs.length === 0 && <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center' }}>No service records match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        Service Records: {stats.totalRepairs} | Recorded Repair Cost: ${Number(stats.totalRepairCost || 0).toFixed(2)}
      </div>
      {pagination.totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span aria-live="polite">Page {page} of {pagination.totalPages}</span>
        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}>Next</button>
      </div>}
    </div>
  );
};

export default MaintRepairs;