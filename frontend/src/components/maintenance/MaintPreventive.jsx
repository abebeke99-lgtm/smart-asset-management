import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintPreventive = () => {
  const [schedules, setSchedules] = useState([
    { id: 1, name: 'AC Seasonal Check', asset: 'Server Room AC', frequency: 'Quarterly', nextDue: '2026-09-15', lastCompleted: '2026-06-01', daysRemaining: 15, overdueDays: 0, status: 'Upcoming' },
    { id: 2, name: 'Generator Fuel Test', asset: 'Backup Generator', frequency: 'Monthly', nextDue: '2026-08-28', lastCompleted: '2026-07-28', daysRemaining: -2, overdueDays: 2, status: 'Overdue' },
    { id: 3, name: 'Printer Maintenance', asset: 'Printer A', frequency: 'Monthly', nextDue: '2026-09-10', lastCompleted: '2026-08-10', daysRemaining: 8, overdueDays: 0, status: 'Upcoming' }
  ]);
  const [showForm, setShowForm] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const filteredSchedules = useMemo(() => {
    return frequencyFilter === 'all' ? schedules : schedules.filter(s => s.frequency === frequencyFilter);
  }, [schedules, frequencyFilter]);

  const upcomingCount = schedules.filter(s => s.status === 'Upcoming').length;
  const overdueCount = schedules.filter(s => s.status === 'Overdue').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔄 Preventive Maintenance</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Create Schedule</button>
      </div>

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

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Create Preventive Schedule</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input type="text" placeholder="Schedule Name" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <input type="text" placeholder="Asset" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <select style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Semi-Annual</option>
              <option>Annual</option>
            </select>
            <input type="date" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Create Schedule</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <select value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minWidth: '150px' }}>
          <option value="all">All Frequencies</option>
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
          <option value="Quarterly">Quarterly</option>
          <option value="Semi-Annual">Semi-Annual</option>
          <option value="Annual">Annual</option>
        </select>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Schedule</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Frequency</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Next Due</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Days Remaining</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.map((sch) => (
              <tr key={sch.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{sch.name}</td>
                <td style={{ padding: '12px' }}>{sch.asset}</td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#f0f5ff', fontSize: '0.85rem' }}>{sch.frequency}</span></td>
                <td style={{ padding: '12px' }}>{sch.nextDue}</td>
                <td style={{ padding: '12px', fontWeight: '600', color: sch.status === 'Overdue' ? '#ef4444' : '#10b981' }}>
                  {sch.status === 'Overdue' ? `-${sch.overdueDays}d (Overdue)` : `${sch.daysRemaining}d`}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: sch.status === 'Overdue' ? '#fee2e2' : '#fef3c7', color: sch.status === 'Overdue' ? '#991b1b' : '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>{sch.status}</span>
                </td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                  <button style={{ padding: '6px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Complete</button>
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