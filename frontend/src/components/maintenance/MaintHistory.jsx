import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getMaintenance({ limit: 200 })
      .then((list) => setHistory(list.map((r) => ({
        id: r.id,
        date: (r.updated || r.created || '').slice(0, 10),
        user: r.requester,
        action: r.statusRaw === 'pending' ? 'Create' : 'Update',
        module: 'Maintenance',
        reference: r.mntId,
        oldValue: '-',
        newValue: `${r.status} · ${r.priority}`,
        description: r.problem,
      }))))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const matchesSearch = search === '' || h.reference.toLowerCase().includes(search.toLowerCase()) || h.user.toLowerCase().includes(search.toLowerCase());
      const matchesModule = moduleFilter === 'all' || h.module === moduleFilter;
      return matchesSearch && matchesModule;
    });
  }, [history, search, moduleFilter]);

  const modules = [...new Set(history.map(h => h.module))];

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
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>📝 Audit History</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search by reference or user..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Modules</option>
            {modules.map(mod => <option key={mod} value={mod}>{mod}</option>)}
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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Module</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Reference</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Old Value</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>New Value</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((item) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{item.date}</td>
                <td style={{ padding: '12px' }}>{item.user}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getActionColor(item.action), color: getActionTextColor(item.action), fontSize: '0.85rem', fontWeight: '600' }}>
                    {item.action}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{item.module}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>{item.reference}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{item.oldValue}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: '600' }}>{item.newValue}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>{(item.description || '').substring(0, 30)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintHistory;