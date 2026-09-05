import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintTestingQuality = () => {
  const [tests, setTests] = useState([
    { id: 1, asset: 'Server Room AC', testType: 'Functional Test', result: 'Pass', testDate: '2026-09-01', technician: 'Jane Smith', notes: 'All components working normally' },
    { id: 2, asset: 'Backup Generator', testType: 'Safety Test', result: 'Pass', testDate: '2026-08-31', technician: 'John Doe', notes: 'Safety features verified' },
    { id: 3, asset: 'Printer A', testType: 'Quality Test', result: 'Fail', testDate: '2026-09-01', technician: 'Bob Wilson', notes: 'Print quality below standard, needs rework' }
  ]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const passCount = tests.filter(t => t.result === 'Pass').length;
  const failCount = tests.filter(t => t.result === 'Fail').length;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>✅ Testing & Quality Control</h1>

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
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{failCount}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Failed</div>
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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
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
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: test.result === 'Pass' ? '#dcfce7' : '#fee2e2', color: test.result === 'Pass' ? '#166534' : '#991b1b', fontSize: '0.85rem', fontWeight: '600' }}>
                    {test.result}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>{test.notes.substring(0, 30)}...</td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintTestingQuality;