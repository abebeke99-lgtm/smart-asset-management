import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintAssetInspection = () => {
  const [inspections, setInspections] = useState([
    { id: 1, asset: 'Server Room AC', date: '2026-09-01', inspector: 'John Doe', condition: 'Good', result: 'Pass', checklistCompletion: 100, recommendations: 'Schedule next maintenance in 3 months' },
    { id: 2, asset: 'Backup Generator', date: '2026-08-31', inspector: 'Jane Smith', condition: 'Fair', result: 'Pass with Recommendations', checklistCompletion: 85, recommendations: 'Replace fuel filter, test load capacity' }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [checklist, setChecklist] = useState([
    { id: 1, item: 'Visual Inspection', status: 'pass' },
    { id: 2, item: 'Operational Test', status: 'pass' },
    { id: 3, item: 'Safety Check', status: 'n/a' },
    { id: 4, item: 'Performance Measurement', status: 'pass' },
    { id: 5, item: 'Documentation Review', status: 'fail' }
  ]);
  const [photos, setPhotos] = useState([
    { id: 1, name: 'Inspection Photo 1', date: '2026-09-01' },
    { id: 2, name: 'Inspection Photo 2', date: '2026-09-01' }
  ]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const checklistCompletion = Math.round((checklist.filter(c => c.status !== 'n/a').length / checklist.filter(c => c.status !== 'n/a').length) * 100);

  const getConditionColor = (condition) => {
    const colors = { 'Excellent': '#dcfce7', 'Good': '#e0f2fe', 'Fair': '#fed7aa', 'Poor': '#fee2e2' };
    return colors[condition] || '#e5e7eb';
  };

  const getResultColor = (result) => {
    const colors = { 'Pass': '#dcfce7', 'Pass with Recommendations': '#fef3c7', 'Fail': '#fee2e2', 'Reinspection': '#dbeafe' };
    return colors[result] || '#e5e7eb';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔍 Asset Inspection</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ New Inspection</button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Create New Inspection</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input type="text" placeholder="Asset Name" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <input type="text" placeholder="Inspector Name" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <input type="date" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <select style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option>Select Condition</option>
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
            <select style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option>Select Result</option>
              <option>Pass</option>
              <option>Pass with Recommendations</option>
              <option>Fail</option>
              <option>Reinspection</option>
            </select>
          </div>
          <h3 style={{ margin: '12px 0 12px', fontSize: '1rem', fontWeight: '600' }}>Inspection Checklist</h3>
          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            {checklist.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: isDark ? '#334155' : '#f9fafb', borderRadius: '6px' }}>
                <input type="checkbox" defaultChecked={item.status === 'pass'} />
                <span style={{ flex: 1 }}>{item.item}</span>
                <select defaultValue={item.status} style={{ padding: '4px 8px', borderRadius: '4px', border: `1px solid ${cardBorder}`, fontSize: '0.85rem' }}>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="n/a">N/A</option>
                </select>
              </div>
            ))}
          </div>
          <textarea placeholder="Findings & Recommendations" rows="4" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, marginBottom: '16px' }} />
          <label style={{ display: 'block', marginBottom: '16px', padding: '12px', border: `1px dashed ${cardBorder}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: '600' }}>
            <input type="file" multiple style={{ display: 'none' }} accept="image/*" />
            📷 Upload Photos/Documents
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Submit Inspection</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
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
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                  <button style={{ padding: '6px 10px', backgroundColor: '#06b6d4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents Section */}
      {photos.length > 0 && (
        <div style={{ marginTop: '24px', backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: '600' }}>📸 Inspection Documents</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ backgroundColor: isDark ? '#334155' : '#f9fafb', border: `1px solid ${cardBorder}`, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📄</div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px' }}>{photo.name}</div>
                <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#4a5568', marginBottom: '8px' }}>{photo.date}</div>
                <button style={{ padding: '6px 12px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>Download</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintAssetInspection;
