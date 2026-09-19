import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance, getTechnicians, pad } from '../../services/maintenanceApi';

const MaintTechnicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    (async () => {
      try {
        const [users, maint] = await Promise.all([getTechnicians(), getMaintenance({ limit: 100 })]);
        const rows = users.map((u) => {
          const mine = maint.filter((m) => m.assigned_to_name === (u.fullName || u.username) || String(m.assigned_to) === String(u.id));
          const openTasks = mine.filter((m) => ['pending', 'approved', 'assigned', 'waiting-for-parts'].includes(m.statusRaw)).length;
          const inProgress = mine.filter((m) => ['in-progress', 'testing'].includes(m.statusRaw)).length;
          const completed = mine.filter((m) => m.statusRaw === 'completed').length;
          const total = mine.length;
          const completionRate = total ? Math.round((completed / total) * 100) : 0;
          return {
            id: u.id,
            empId: `EMP-${pad(u.id)}`,
            name: u.fullName || u.username,
            skills: [u.department || 'Maintenance'],
            availability: u.active === false ? 'Unavailable' : 'Available',
            openTasks,
            inProgress,
            completed,
            completionRate,
            avgTime: '—',
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        setTechnicians(rows);
      } catch (err) {
        setError(err && err.message ? err.message : 'Failed to load technicians');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getAvailabilityColor = (availability) => {
    const colors = { 'Available': '#dcfce7', 'Busy': '#fef3c7', 'Unavailable': '#fee2e2', 'On Leave': '#dbeafe' };
    return colors[availability] || '#e5e7eb';
  };

  const getAvailabilityTextColor = (availability) => {
    const colors = { 'Available': '#166534', 'Busy': '#92400e', 'Unavailable': '#991b1b', 'On Leave': '#075985' };
    return colors[availability] || '#374151';
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading technicians…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>👨‍🔧 Technicians</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2864E8' }}>{technicians.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Technicians</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{technicians.filter(t => t.availability === 'Available').length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Available Now</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24' }}>{technicians.reduce((sum, t) => sum + t.openTasks + t.inProgress, 0)}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Active Tasks</div>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Employee ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Skills</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Availability</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Open</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>In Progress</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Completion %</th>
            </tr>
          </thead>
          <tbody>
            {technicians.map((tech) => (
              <tr key={tech.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600', fontSize: '0.9rem' }}>{tech.empId}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>{tech.name}</td>
                <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {tech.skills.map((skill, idx) => (
                      <span key={idx} style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: isDark ? '#334155' : '#e0f2fe', fontSize: '0.8rem' }}>{skill}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getAvailabilityColor(tech.availability), color: getAvailabilityTextColor(tech.availability), fontSize: '0.85rem', fontWeight: '600' }}>
                    {tech.availability}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: '600', color: '#2864E8' }}>{tech.openTasks}</td>
                <td style={{ padding: '12px', fontWeight: '600', color: '#fbbf24' }}>{tech.inProgress}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '50px', height: '6px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${tech.completionRate}%`, height: '100%', backgroundColor: '#10b981' }} />
                    </div>
                    {tech.completionRate}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintTechnicians;