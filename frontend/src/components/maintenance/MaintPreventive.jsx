import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getMaintenance, getMaintenanceCalendar } from '../../services/maintenanceApi';

const statusColors = {
  scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
  due: { bg: '#fef3c7', text: '#92400e' },
  overdue: { bg: '#fee2e2', text: '#991b1b' },
  'in-progress': { bg: '#e0f2fe', text: '#0369a1' },
  'waiting-for-parts': { bg: '#f3e8ff', text: '#7c3aed' },
  'awaiting-testing': { bg: '#d1fae5', text: '#047857' },
  'awaiting-quality-control': { bg: '#fef3c7', text: '#a16207' },
  completed: { bg: '#dcfce7', text: '#166534' },
  failed: { bg: '#fee2e2', text: '#9f1239' },
  cancelled: { bg: '#e5e7eb', text: '#374151' },
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const toStatus = (statusRaw, fallback = 'Scheduled') => {
  const normalized = String(statusRaw || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'pending') return 'Upcoming';
  if (normalized === 'due') return 'Due Soon';
  if (normalized === 'overdue') return 'Overdue';
  if (normalized === 'in-progress') return 'In Progress';
  if (normalized === 'waiting-for-parts') return 'Waiting for Parts';
  if (normalized === 'awaiting-testing') return 'Awaiting Testing';
  if (normalized === 'awaiting-quality-control') return 'Awaiting Quality Control';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'cancelled') return 'Cancelled';
  return fallback;
};

const toPlanFromRecord = (item, index) => {
  const asset = item.asset || item.Asset || {};
  const assetName = item.asset || asset.name || 'Asset';
  const dueDate = item.nextDue || item.nextScheduleDate || item.updated || item.created || new Date().toISOString();
  const statusRaw = String(item.statusRaw || item.status || 'pending');
  const status = toStatus(statusRaw, 'Upcoming');

  return {
    id: item.id || index + 1,
    asset: assetName,
    title: item.title || item.problem || 'Preventive review',
    frequency: item.frequency || (item.priority === 'Critical' ? 'Quarterly' : 'Monthly'),
    nextDue: dueDate,
    technician: item.assigned_to_name || item.technician || 'Unassigned',
    status,
    statusRaw: statusRaw.toLowerCase(),
    priority: item.priority || 'Medium',
  };
};

const MaintPreventive = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setLoading(true);
      try {
        let records = [];
        if (typeof getMaintenanceCalendar === 'function') {
          try {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 3);
            const payload = await getMaintenanceCalendar({
              start: new Date(new Date().setDate(1)).toISOString(),
              end: new Date(nextMonth).toISOString(),
              limit: 200,
            });
            records = Array.isArray(payload?.items) ? payload.items : [];
          } catch (calendarError) {
            records = [];
          }
        }

        if (!records.length) {
          const maintenance = await getMaintenance({ limit: 200 });
          records = Array.isArray(maintenance) ? maintenance : [];
        }

        if (!mounted) return;

        const normalized = records.map((item, index) => {
          if (item && item.assetName && item.title) {
            return {
              id: item.id || index + 1,
              asset: item.assetName,
              title: item.title,
              frequency: item.frequency || 'Monthly',
              nextDue: item.nextDue || item.start || item.created || new Date().toISOString(),
              technician: item.technician || 'Unassigned',
              status: toStatus(item.statusRaw || item.status || 'pending', 'Upcoming'),
              statusRaw: String(item.statusRaw || item.status || 'pending').toLowerCase(),
              priority: item.priority || 'Medium',
            };
          }
          return toPlanFromRecord(item, index);
        });

        setPlans(normalized);
        setError('');
      } catch (err) {
        if (!mounted) return;
        setPlans([]);
        setError(err && err.message ? err.message : 'Failed to load preventive maintenance');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPlans();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => [
    { label: 'Upcoming', value: plans.filter((plan) => plan.status === 'Upcoming').length, tone: '#2563eb' },
    { label: 'Due Soon', value: plans.filter((plan) => plan.status === 'Due Soon').length, tone: '#f59e0b' },
    { label: 'Overdue', value: plans.filter((plan) => plan.status === 'Overdue').length, tone: '#ef4444' },
    { label: 'Completed', value: plans.filter((plan) => plan.status === 'Completed').length, tone: '#22c55e' },
  ], [plans]);

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>Preventive Maintenance</h1>
          <p style={{ margin: '8px 0 0', color: isDark ? '#cbd5e1' : '#475569' }}>Monitor scheduled preventive work and confirm asset maintenance readiness.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: '#2563eb', color: '#fff' }}>Start Maintenance</button>
          <button style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#111827' : '#f8fafc', color: isDark ? '#fff' : '#0f172a' }}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {stats.map((card) => (
          <div key={card.label} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: card.tone }}>{card.value}</div>
            <div style={{ fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', marginTop: '4px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: isDark ? '#1f2937' : '#f8fafc' }}>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${cardBorder}` }}>Asset</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${cardBorder}` }}>Title</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${cardBorder}` }}>Frequency</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${cardBorder}` }}>Next Due</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${cardBorder}` }}>Technician</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${cardBorder}` }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: isDark ? '#cbd5e1' : '#475569' }}>Loading preventive maintenance…</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: isDark ? '#cbd5e1' : '#475569' }}>No Preventive Maintenance Tasks</td></tr>
            ) : plans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '10px', fontWeight: 600 }}>{plan.asset}</td>
                <td style={{ padding: '10px' }}>{plan.title}</td>
                <td style={{ padding: '10px' }}>{plan.frequency}</td>
                <td style={{ padding: '10px' }}>{formatDate(plan.nextDue)}</td>
                <td style={{ padding: '10px' }}>{plan.technician}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: statusColors[plan.statusRaw]?.bg || '#e2e8f0', color: statusColors[plan.statusRaw]?.text || '#475569' }}>{plan.status}</span>
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