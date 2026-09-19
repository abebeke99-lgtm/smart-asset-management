import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance } from '../../services/maintenanceApi';

const MaintAssigned = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getMaintenance({ limit: 200 })
      .then((maintenance) => setTasks(maintenance.map((m) => {
        const statusMap = {
          'pending': 'Assigned', 'approved': 'Assigned', 'assigned': 'Assigned',
          'in-progress': 'In Progress', 'waiting-for-parts': 'On Hold',
          'testing': 'Testing', 'completed': 'Completed',
        };
        const progressMap = {
          'pending': 0, 'approved': 10, 'assigned': 0,
          'in-progress': 50, 'waiting-for-parts': 40, 'testing': 90, 'completed': 100,
        };
        const group = statusMap[m.statusRaw] || 'Assigned';
        const progress = progressMap[m.statusRaw] ?? 0;
        return {
          id: m.id,
          status: group,
          statusRaw: m.statusRaw,
          task: m.title,
          asset: m.asset,
          technician: m.technician || 'Not assigned',
          priority: m.priority,
          dueDate: m.updated ? String(m.updated).slice(0, 10) : 'Not tracked',
          progress,
        };
      })))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load assigned tasks'))
      .finally(() => setLoading(false));
  }, []);

  const getPriorityColor = (priority) => {
    const colors = { 'Critical': '#fee2e2', 'High': '#fef3c7', 'Medium': '#dbeafe', 'Low': '#dcfce7' };
    return colors[priority] || '#e5e7eb';
  };

  const getPriorityTextColor = (priority) => {
    const colors = { 'Critical': '#991b1b', 'High': '#92400e', 'Medium': '#075985', 'Low': '#166534' };
    return colors[priority] || '#374151';
  };

  const statusGroups = useMemo(() => ['Assigned', 'In Progress', 'On Hold', 'Testing', 'Completed'], []);
  const countByStatus = useMemo(() => {
    const counts = {};
    statusGroups.forEach(s => counts[s] = tasks.filter(t => t.status === s).length);
    return counts;
  }, [tasks, statusGroups]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading assigned tasks…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>📌 Assigned Tasks</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      {/* Status Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statusGroups.map(status => (
          <div key={status} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2864E8' }}>{countByStatus[status] || 0}</div>
            <div style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{status}</div>
          </div>
        ))}
      </div>

      {/* Kanban-style view by status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {statusGroups.map(status => (
          <div key={status} style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: '600' }}>{status}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {tasks.filter(t => t.status === status).map(task => (
                <div key={task.id} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px' }}>{task.task}</div>
                  <div style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#4a5568', marginBottom: '6px' }}>
                    <div>Asset: {task.asset}</div>
                    <div>Technician: {task.technician}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'space-between' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: getPriorityColor(task.priority), color: getPriorityTextColor(task.priority), fontSize: '0.8rem', fontWeight: '600' }}>{task.priority}</span>
                    <span style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#4a5568' }}>Updated: {task.dueDate}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Progress: {task.progress}%</div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${task.progress}%`, height: '100%', backgroundColor: task.status === 'Completed' ? '#10b981' : '#2864E8' }} />
                    </div>
                  </div>
                </div>
              ))}
              {countByStatus[status] === 0 && (
                <div style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#4a5568', textAlign: 'center', padding: '16px' }}>No tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MaintAssigned;