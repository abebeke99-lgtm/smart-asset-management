import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintHistory = () => {
  const [history, setHistory] = useState([
    { id: 1, date: '2026-09-02', user: 'Jane Smith', action: 'Update', module: 'Work Orders', reference: 'WO-002', oldValue: 'Pending', newValue: 'In Progress', description: 'Started work on compressor replacement' },
    { id: 2, date: '2026-09-01', user: 'John Doe', action: 'Create', module: 'Repairs', reference: 'REP-001', oldValue: '-', newValue: 'REP-001', description: 'Created repair record for printer sensor' },
    { id: 3, date: '2026-08-31', user: 'Bob Wilson', action: 'Delete', module: 'Maintenance', reference: 'MNT-005', oldValue: 'MNT-005', newValue: '-', description: 'Canceled obsolete maintenance schedule' }
  ]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const matchesSearch = search === '' || h.reference.toLowerCase().includes(search.toLowerCase()) || h.user.toLowerCase().includes(search.toLowerCase());
      const matchesModule = moduleFilter === 'all' || h.module === moduleFilter;
      return matchesSearch && matchesModule;
    });
  }, [history, search, moduleFilter]);

  const modules = [...new Set(history.map(h => h.module))];
  const actions = [...new Set(history.map(h => h.action))];

  const getActionColor = (action) => {
    const colors = { 'Create': '#dcfce7', 'Update': '#dbeafe', 'Delete': '#fee2e2' };
    return colors[action] || '#e5e7eb';
  };

  const getActionTextColor = (action) => {
    const colors = { 'Create': '#166534', 'Update': '#075985', 'Delete': '#991b1b' };
    return colors[action] || '#374151';
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>📝 Audit History</h1>

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
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>{item.description.substring(0, 30)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintHistory;