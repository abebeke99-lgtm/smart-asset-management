import React, { useState } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintNotifications = () => {
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'New Request', message: 'New maintenance request for Server Room AC from IT Department', date: '2026-09-02 14:30', read: false, icon: '📋' },
    { id: 2, type: 'Assignment', message: 'Work Order WO-002 assigned to Jane Smith', date: '2026-09-02 13:45', read: false, icon: '👤' },
    { id: 3, type: 'Overdue', message: 'Work Order WO-003 is 2 days overdue', date: '2026-09-01 10:15', read: true, icon: '⚠️' },
    { id: 4, type: 'Preventive Due', message: 'Generator maintenance scheduled for today', date: '2026-09-01 09:00', read: true, icon: '🔄' },
    { id: 5, type: 'Low Stock', message: 'AC Compressor quantity below minimum threshold', date: '2026-08-31 16:20', read: true, icon: '📦' }
  ]);
  const [filterType, setFilterType] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const typeColors = {
    'New Request': { bg: '#dbeafe', text: '#075985' },
    'Assignment': { bg: '#dcedc8', text: '#4a5568' },
    'Overdue': { bg: '#fee2e2', text: '#991b1b' },
    'Preventive Due': { bg: '#fef3c7', text: '#92400e' },
    'Low Stock': { bg: '#fed7aa', text: '#b45309' },
    'Approval': { bg: '#dcfce7', text: '#166534' }
  };

  const filteredNotifications = filterType === 'all' ? notifications : notifications.filter(n => n.type === filterType);
  const unreadCount = notifications.filter(n => !n.read).length;
  const typeCount = (type) => notifications.filter(n => n.type === type).length;

  const handleMarkAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleDelete = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const types = [...new Set(notifications.map(n => n.type))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔔 Notifications</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ padding: '8px 12px', backgroundColor: '#fee2e2', borderRadius: '6px', fontWeight: '600', color: '#991b1b' }}>Unread: {unreadCount}</span>
          <button style={{ padding: '8px 16px', backgroundColor: '#06b6d4', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Mark All Read</button>
        </div>
      </div>

      {/* Type Filters with Counters */}
      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('all')} style={{ padding: '8px 12px', backgroundColor: filterType === 'all' ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: filterType === 'all' ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>All ({notifications.length})</button>
          {types.map(type => (
            <button key={type} onClick={() => setFilterType(type)} style={{ padding: '8px 12px', backgroundColor: filterType === type ? '#2864E8' : isDark ? '#334155' : '#e5e7eb', color: filterType === type ? 'white' : 'inherit', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              {type} ({typeCount(type)})
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {filteredNotifications.map((notif) => {
          const typeStyle = typeColors[notif.type] || { bg: '#e5e7eb', text: '#4a5568' };
          return (
            <div key={notif.id} style={{ backgroundColor: notif.read ? isDark ? '#0f172a' : '#f8fafc' : cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.5rem' }}>{notif.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '3px', backgroundColor: typeStyle.bg, color: typeStyle.text, fontSize: '0.8rem', fontWeight: '600' }}>
                    {notif.type}
                  </span>
                  {!notif.read && <div style={{ width: '8px', height: '8px', backgroundColor: '#2864E8', borderRadius: '50%' }} />}
                </div>
                <div style={{ fontSize: '0.95rem', marginBottom: '6px' }}>{notif.message}</div>
                <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#4a5568' }}>{notif.date}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {!notif.read && (
                  <button onClick={() => handleMarkAsRead(notif.id)} style={{ padding: '6px 12px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Read</button>
                )}
                <button onClick={() => handleDelete(notif.id)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MaintNotifications;