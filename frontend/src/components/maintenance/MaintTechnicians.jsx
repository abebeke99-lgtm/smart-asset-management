import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getTechnicianDirectory } from '../../services/maintenanceApi';

const MaintTechnicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [summary, setSummary] = useState({ totalTechnicians: 0, available: 0, assigned: 0, onLeave: 0, overloaded: 0, activeWorkOrders: 0, overdueTasks: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    (async () => {
      try {
        const response = await getTechnicianDirectory({ limit: 100 });
        setTechnicians(response.items || []);
        setSummary(response.summary || {});
      } catch (err) {
        setError(err && err.message ? err.message : 'Failed to load technicians');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredTechnicians = useMemo(() => {
    const query = search.trim().toLowerCase();
    return technicians.filter((tech) => {
      const matchesQuery = !query || [
        tech.name,
        tech.employeeId,
        tech.username,
        tech.email,
        tech.phone,
        tech.department,
        tech.specialization,
        tech.skills?.join(' '),
      ].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || tech.status === statusFilter;
      const matchesAvailability = availabilityFilter === 'all' || tech.availability === availabilityFilter;
      return matchesQuery && matchesStatus && matchesAvailability;
    });
  }, [technicians, search, statusFilter, availabilityFilter]);

  const getAvailabilityColor = (availability) => {
    const colors = { 'Available': '#dcfce7', 'Assigned': '#dbeafe', 'Busy': '#fef3c7', 'On Leave': '#e0e7ff', 'Unavailable': '#fee2e2', 'Inactive': '#e5e7eb' };
    return colors[availability] || '#e5e7eb';
  };

  const getAvailabilityTextColor = (availability) => {
    const colors = { 'Available': '#166534', 'Assigned': '#1d4ed8', 'Busy': '#92400e', 'On Leave': '#4338ca', 'Unavailable': '#991b1b', 'Inactive': '#374151' };
    return colors[availability] || '#374151';
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading technicians…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: 'bold' }}>Technicians</h1>
      <p style={{ margin: '0 0 20px', color: isDark ? '#cbd5e1' : '#475569' }}>Manage maintenance technicians, assignments, skills, availability, and workload.</p>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2864E8' }}>{summary.totalTechnicians || technicians.length}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Total Technicians</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{summary.available || 0}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Available</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b' }}>{summary.assigned || 0}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Assigned</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{summary.overloaded || 0}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Overloaded</div>
        </div>
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#8b5cf6' }}>{summary.activeWorkOrders || 0}</div>
          <div style={{ fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Active Work Orders</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search technician, email, phone, skill..."
          style={{ minWidth: '220px', flex: '1', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff' }}
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff' }}>
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff' }}>
          <option value="all">All Availability</option>
          <option value="Available">Available</option>
          <option value="Assigned">Assigned</option>
          <option value="Busy">Busy</option>
          <option value="On Leave">On Leave</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Skills</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Contact</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Availability</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Workload</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTechnicians.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: isDark ? '#cbd5e1' : '#475569' }}>No technicians found.</td>
              </tr>
            ) : (
              filteredTechnicians.map((tech) => (
                <tr key={tech.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <td style={{ padding: '12px', fontWeight: '600', fontSize: '0.9rem' }}>{tech.employeeId || tech.technicianId}</td>
                  <td style={{ padding: '12px', fontWeight: '600' }}>{tech.name}</td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>{tech.department}</td>
                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {tech.skills.map((skill, idx) => (
                        <span key={`${tech.id}-${idx}`} style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: isDark ? '#334155' : '#e0f2fe', fontSize: '0.8rem' }}>{skill}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>{tech.contact}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getAvailabilityColor(tech.availability), color: getAvailabilityTextColor(tech.availability), fontSize: '0.85rem', fontWeight: '600' }}>
                      {tech.availability}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: '600' }}>{tech.workloadLevel}</div>
                    <div style={{ color: isDark ? '#cbd5e1' : '#64748b' }}>{tech.activeAssignments} active tasks</div>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: tech.status === 'Active' ? '#dcfce7' : '#e5e7eb', color: tech.status === 'Active' ? '#166534' : '#374151', fontWeight: '600' }}>{tech.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintTechnicians;