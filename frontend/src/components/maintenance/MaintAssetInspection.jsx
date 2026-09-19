import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintAssetInspection = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getMaintenance({ limit: 200 })
      .then((maintenance) => setInspections(maintenance
        .filter((m) => m.statusRaw === 'completed')
        .map((m) => ({
          id: m.id,
          asset: m.asset,
          date: (m.updated || m.created || '').slice(0, 10),
          inspector: m.technician || 'Not assigned',
          condition: 'Good',
          result: 'Pass',
          checklistCompletion: 100,
          recommendations: 'No recommendations available',
        }))))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load inspection records'))
      .finally(() => setLoading(false));
  }, []);

  const getConditionColor = (condition) => {
    const colors = { 'Excellent': '#dcfce7', 'Good': '#e0f2fe', 'Fair': '#fed7aa', 'Poor': '#fee2e2' };
    return colors[condition] || '#e5e7eb';
  };

  const getResultColor = (result) => {
    const colors = { 'Pass': '#dcfce7', 'Pass with Recommendations': '#fef3c7', 'Fail': '#fee2e2', 'Reinspection': '#dbeafe' };
    return colors[result] || '#e5e7eb';
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading inspection records…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔍 Asset Inspection</h1>
        <a href="/maintenance/requests" style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600' }}>+ New Inspection</a>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ padding: '12px', backgroundColor: '#dbeafe', color: '#075985', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
        Inspection records are derived from completed maintenance work orders.
      </div>

      {/* Inspection History */}
      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Inspector</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Condition</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Result</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Completion</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Recommendations</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map(insp => (
              <tr key={insp.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{insp.asset}</td>
                <td style={{ padding: '12px' }}>{insp.inspector}</td>
                <td style={{ padding: '12px' }}>{insp.date}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getConditionColor(insp.condition), fontWeight: '600', fontSize: '0.85rem' }}>
                    {insp.condition}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getResultColor(insp.result), fontWeight: '600', fontSize: '0.85rem' }}>
                    {insp.result}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${insp.checklistCompletion}%`, height: '100%', backgroundColor: '#10b981' }} />
                    </div>
                    {insp.checklistCompletion}%
                  </div>
                </td>
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>{insp.recommendations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintAssetInspection;