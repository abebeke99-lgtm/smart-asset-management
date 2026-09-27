import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenanceHistory } from '../../services/maintenanceApi';

const MaintHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMaintenanceHistory({ page, limit: 20, search: search.trim() || undefined, action: actionFilter === 'all' ? undefined : actionFilter })
      .then((result) => {
        if (!mounted) return;
        setHistory(result.items);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load history'))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [page, search, actionFilter]);

  const filteredHistory = useMemo(() => history, [history]);

  const getActionColor = (action) => {
    const colors = { 'Create': '#dcfce7', 'Update': '#dbeafe', 'Delete': '#fee2e2' };
    return colors[action] || '#e5e7eb';
  };

  const getActionTextColor = (action) => {
    const colors = { 'Create': '#166534', 'Update': '#075985', 'Delete': '#991b1b' };
    return colors[action] || '#374151';
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading history…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>Maintenance History</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search asset, action, actor, or request..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Actions</option>
            <option value="created">Created</option>
            <option value="status_changed">Status Changed</option>
            <option value="completed">Completed</option>
            <option value="updated">Updated</option>
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>User</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Action</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Reference</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Old Value</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>New Value</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((item) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{String(item.actionDate || item.createdAt || '').slice(0, 10) || '—'}</td>
                <td style={{ padding: '12px' }}>{item.actorName || 'System'}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getActionColor(item.actionType), color: getActionTextColor(item.actionType), fontSize: '0.85rem', fontWeight: '600' }}>
                    {item.actionType}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: '600' }}>{item.maintenanceId ? `MNT-${String(item.maintenanceId).padStart(3, '0')}` : item.id}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{item.previousStatus || 'Not recorded'}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: '600' }}>{item.newStatus || 'Not recorded'}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>{item.description || item.maintenanceTitle || item.assetName || '—'}</td>
              </tr>
            ))}
            {filteredHistory.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>No maintenance history records found.</td></tr>}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span aria-live="polite">Page {page} of {pagination.pages} · {pagination.total} events</span>
        <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}>Next</button>
      </div>}
    </div>
  );
};

export default MaintHistory;