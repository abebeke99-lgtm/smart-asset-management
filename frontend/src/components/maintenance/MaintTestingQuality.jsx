import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintTestingQuality = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getMaintenance({ limit: 200 })
      .then((maintenance) => setTests(maintenance
        .filter((m) => m.statusRaw === 'testing' || m.statusRaw === 'completed')
        .map((m) => ({
          id: m.id,
          asset: m.asset,
          testType: m.statusRaw === 'testing' ? 'Post-Repair Testing' : 'Final Quality Check',
          result: m.statusRaw === 'testing' ? 'Pending' : 'Pass',
          testDate: (m.updated || m.created || '').slice(0, 10),
          technician: m.technician || 'Not assigned',
          notes: m.statusRaw === 'testing' ? 'Maintenance work order is in the testing stage' : 'Maintenance work order completed',
        }))))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load testing records'))
      .finally(() => setLoading(false));
  }, []);

  const passCount = tests.filter(t => t.result === 'Pass').length;
  const pendingCount = tests.filter(t => t.result === 'Pending').length;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading testing records…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>✅ Testing & Quality Control</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2864E8' }}>{tests.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Tests</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{passCount}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Passed</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24' }}>{pendingCount}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>In Testing</div>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Test Type</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Result</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{test.asset}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{test.testType}</td>
                <td style={{ padding: '12px' }}>{test.technician}</td>
                <td style={{ padding: '12px' }}>{test.testDate}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: test.result === 'Pass' ? '#dcfce7' : '#fef3c7', color: test.result === 'Pass' ? '#166534' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                    {test.result}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>{test.notes.length > 30 ? `${test.notes.substring(0, 30)}...` : test.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintTestingQuality;