import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenanceHistory } from '../../services/maintenanceApi';

const MaintHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMaintenanceHistory({
      page,
      limit: 20,
      search: search.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      maintenanceType: typeFilter === 'all' ? undefined : typeFilter,
    })
      .then((result) => {
        if (!mounted) return;
        setHistory(result.items || []);
        setPagination(result.pagination || { total: 0, pages: 1 });
      })
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load maintenance history'))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [page, search, statusFilter, typeFilter]);

  const filteredHistory = useMemo(() => history, [history]);

  const formatCurrency = (value) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : '$0.00';
  };

  const statusColor = (status = '') => {
    const normalized = String(status).toLowerCase();
    if (['completed', 'returned to service', 'approved'].includes(normalized)) return { background: '#dcfce7', color: '#166534' };
    if (['failed', 'rejected', 'cancelled'].includes(normalized)) return { background: '#fee2e2', color: '#991b1b' };
    if (['in progress', 'assigned', 'waiting for parts'].includes(normalized)) return { background: '#dbeafe', color: '#1d4ed8' };
    return { background: '#f3f4f6', color: '#374151' };
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading maintenance history…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>Maintenance History</h1>
      <p style={{ margin: '-12px 0 18px', color: isDark ? '#cbd5e1' : '#475569' }}>
        View the complete historical record of maintenance, repairs, preventive work, testing, quality control, costs, and asset service activity.
      </p>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search asset, work order, technician, vendor..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Failed">Failed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Types</option>
            <option value="Corrective">Corrective</option>
            <option value="Preventive">Preventive</option>
            <option value="Repair">Repair</option>
            <option value="Inspection">Inspection</option>
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>History ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Maintenance ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Work Order</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Completion</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Duration</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Test</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>QC</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Parts</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Labor</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((item) => (
              <tr key={`${item.historyId || item.id}-${item.maintenanceId || ''}`} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.historyId || `MAINT-${item.id}`}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.maintenanceId || item.id}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: '600' }}>{item.assetName || 'Unknown asset'}</div>
                  <div style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>{item.serialNumber || ''}</div>
                </td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.department || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.maintenanceType || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.workOrder || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.technician || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.completionDate ? new Date(item.completionDate).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.duration || '0.00 hours'}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', ...statusColor(item.status) }}>
                    {item.status || 'Unknown'}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.testResult || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{item.qcResult || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{formatCurrency(item.partsCost)}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem' }}>{formatCurrency(item.laborCost)}</td>
                <td style={{ padding: '12px', fontSize: '0.88rem', fontWeight: '600' }}>{formatCurrency(item.totalCost)}</td>
              </tr>
            ))}
            {filteredHistory.length === 0 && <tr><td colSpan="15" style={{ padding: '24px', textAlign: 'center' }}>No maintenance history records found.</td></tr>}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span aria-live="polite">Page {page} of {pagination.pages} · {pagination.total} records</span>
        <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}>Next</button>
      </div>}
    </div>
  );
};

export default MaintHistory;