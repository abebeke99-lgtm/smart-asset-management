import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintAssigned = () => {
  const [tasks, setTasks] = useState([
    { id: 1, status: 'Assigned', task: 'AC Compressor Replacement', asset: 'Server Room AC', technician: 'Jane Smith', priority: 'Critical', dueDate: '2026-09-03', progress: 0 },
    { id: 2, status: 'In Progress', task: 'Sensor Module Repair', asset: 'Printer A', technician: 'John Doe', priority: 'High', dueDate: '2026-09-01', progress: 75 },
    { id: 3, status: 'On Hold', task: 'Generator Fuel System Check', asset: 'Backup Generator', technician: 'Bob Wilson', priority: 'Medium', dueDate: '2026-09-10', progress: 30 },
    { id: 4, status: 'Completed', task: 'Preventive Maintenance Inspection', asset: 'Printer B', technician: 'Jane Smith', priority: 'Low', dueDate: '2026-08-31', progress: 100 }
  ]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const getPriorityColor = (priority) => {
    const colors = { 'Critical': '#fee2e2', 'High': '#fef3c7', 'Medium': '#dbeafe', 'Low': '#dcfce7' };
    return colors[priority] || '#e5e7eb';
  };

  const getPriorityTextColor = (priority) => {
    const colors = { 'Critical': '#991b1b', 'High': '#92400e', 'Medium': '#075985', 'Low': '#166534' };
    return colors[priority] || '#374151';
  };

  const statusGroups = ['Assigned', 'In Progress', 'On Hold', 'Completed'];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>📌 Assigned Tasks</h1>

      {/* Status Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statusGroups.map(status => (
          <div key={status} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2864E8' }}>{tasks.filter(t => t.status === status).length}</div>
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
                    <span style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{task.dueDate}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Progress: {task.progress}%</div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${task.progress}%`, height: '100%', backgroundColor: '#2864E8' }} />
                    </div>
                  </div>
                  <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>View Details</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MaintAssigned;