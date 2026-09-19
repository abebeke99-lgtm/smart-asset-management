import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintPreventive = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getMaintenance({ limit: 100 })
      .then((list) => setSchedules(list
        .map((r, idx) => ({
          id: r.id,
          name: r.title,
          asset: r.asset,
          frequency: 'Scheduled',
          nextDue: '—',
          lastCompleted: r.updated ? String(r.updated).slice(0, 10) : '—',
          daysRemaining: 0,
          overdueDays: 0,
          status: r.statusRaw === 'pending' || r.statusRaw === 'approved' ? 'Upcoming' : r.status,
        }))))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load schedules'))
      .finally(() => setLoading(false));
  }, []);

  const filteredSchedules = useMemo(() => {
    return frequencyFilter === 'all' ? schedules : schedules.filter(s => s.frequency === frequencyFilter);
  }, [schedules, frequencyFilter]);

  const upcomingCount = schedules.filter(s => s.status === 'Upcoming').length;
  const overdueCount = schedules.filter(s => s.status === 'Overdue').length;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading preventive maintenance…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔄 Preventive Maintenance</h1>
        <a href="/maintenance/requests" style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', textDecoration: 'none' }}>+ Create Schedule</a>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{schedules.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Schedules</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>{upcomingCount}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Upcoming Due</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{overdueCount}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Overdue</div>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <select value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minWidth: '160px' }}>
          <option value="all">All Types</option>
          <option value="Scheduled">Scheduled</option>
        </select>
        <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#4a5568', marginTop: '8px' }}>
          Scheduled maintenance requests (pending/approved) are listed here. Frequency and due-date tracking are not part of this module yet.
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Create Preventive Schedule</h2>
          <div style={{ padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
            Preventive maintenance schedules are created as maintenance requests. Create a request with your preventive task details.
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <a href="/maintenance/requests" style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', textDecoration: 'none' }}>Create Request</a>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Schedule</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Frequency</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Last Updated</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.map((sch) => (
              <tr key={sch.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{sch.name}</td>
                <td style={{ padding: '12px' }}>{sch.asset}</td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#f0f5ff', fontSize: '0.85rem' }}>{sch.frequency}</span></td>
                <td style={{ padding: '12px' }}>{sch.lastCompleted}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: sch.status === 'Overdue' ? '#fee2e2' : '#fef3c7', color: sch.status === 'Overdue' ? '#991b1b' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>{sch.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintPreventive;