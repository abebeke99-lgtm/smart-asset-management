import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getQualityControlReviews } from '../../services/maintenanceApi';

const statusColors = {
  pending: { bg: '#dbeafe', color: '#1d4ed8' },
  'in-review': { bg: '#fef3c7', color: '#a16207' },
  approved: { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#fee2e2', color: '#b91c1c' },
  'conditional-approval': { bg: '#ede9fe', color: '#6d28d9' },
  'retest-required': { bg: '#ffe4e6', color: '#be185d' },
};

const titleCase = (value) => String(value || '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const MaintTestingQuality = () => {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    pending: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
    conditionalApproval: 0,
    retestRequired: 0,
    readyForReturn: 0,
    overdueReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;

    const fetchReviews = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getQualityControlReviews({ search: search || undefined, limit: 50 });
        if (!mounted) return;
        setReviews(response.items || []);
        setSummary(response.summary || { pending: 0, inReview: 0, approved: 0, rejected: 0, conditionalApproval: 0, retestRequired: 0, readyForReturn: 0, overdueReviews: 0 });
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.response?.data?.message || 'Failed to load quality control reviews');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReviews();
    return () => { mounted = false; };
  }, [search]);

  const cards = useMemo(() => [
    { label: 'Pending QC', value: summary.pending || 0, tone: '#2563eb' },
    { label: 'In Review', value: summary.inReview || 0, tone: '#f59e0b' },
    { label: 'Approved', value: summary.approved || 0, tone: '#16a34a' },
    { label: 'Rejected', value: summary.rejected || 0, tone: '#dc2626' },
    { label: 'Conditional Approval', value: summary.conditionalApproval || 0, tone: '#7c3aed' },
    { label: 'Retest Required', value: summary.retestRequired || 0, tone: '#db2777' },
    { label: 'Ready for Return', value: summary.readyForReturn || 0, tone: '#0ea5e9' },
    { label: 'Overdue Reviews', value: summary.overdueReviews || 0, tone: '#ef4444' },
  ], [summary]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading quality control reviews…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Maintenance</div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>Quality Control</h1>
          <p style={{ margin: '8px 0 0', color: isDark ? '#cbd5e1' : '#475569' }}>Review completed maintenance work and confirm assets are safe to return to service.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>Error: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {cards.map((card) => (
          <div key={card.label} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: card.tone }}>{card.value}</div>
            <div style={{ fontSize: '0.85rem', marginTop: '6px', color: isDark ? '#94a3b8' : '#4b5563' }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by asset, serial, maintenance, reviewer..."
            style={{ flex: '1 1 260px', minHeight: '42px', borderRadius: '8px', border: `1px solid ${cardBorder}`, padding: '0 12px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }}
          />
        </div>

        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: isDark ? '#cbd5e1' : '#475569' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>No Quality Reviews Found</div>
            <div>There are no maintenance quality-control records matching the current criteria.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
              <thead>
                <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>QC ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Asset</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Maintenance</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Technician</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Reviewer</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Decision</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Due Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Review Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => {
                  const asset = review.Asset || {};
                  const maintenance = review.Maintenance || {};
                  const technician = review.Technician || {};
                  const reviewer = review.Reviewer || {};
                  const decision = (review.decision || 'pending').toLowerCase();
                  const tone = statusColors[decision] || { bg: '#e2e8f0', color: '#334155' };

                  return (
                    <tr key={review.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                      <td style={{ padding: '12px', fontWeight: 700 }}>QC-{String(review.id).padStart(4, '0')}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700 }}>{asset.name || 'Unknown asset'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{asset.assetCode || asset.serialNumber || 'No asset code'}</div>
                      </td>
                      <td style={{ padding: '12px' }}>{maintenance.title || `Maintenance #${review.maintenanceId || review.maintenance_id || review.id}`}</td>
                      <td style={{ padding: '12px' }}>{technician.fullName || technician.username || 'Unassigned'}</td>
                      <td style={{ padding: '12px' }}>{reviewer.fullName || reviewer.username || 'Unassigned'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ display: 'inline-block', borderRadius: '999px', padding: '4px 8px', backgroundColor: tone.bg, color: tone.color, fontSize: '0.75rem', fontWeight: 700 }}>
                          {titleCase(review.decision || 'Pending')}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ display: 'inline-block', borderRadius: '999px', padding: '4px 8px', backgroundColor: statusColors[review.status] ? statusColors[review.status].bg : '#dbeafe', color: statusColors[review.status] ? statusColors[review.status].color : '#1d4ed8', fontSize: '0.75rem', fontWeight: 700 }}>
                          {titleCase(review.status || 'Pending')}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>{formatDate(review.dueDate)}</td>
                      <td style={{ padding: '12px' }}>{formatDate(review.reviewDate)}</td>
                      <td style={{ padding: '12px' }}>
                        <button type="button" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}>
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintTestingQuality;