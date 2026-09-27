import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getAssetsPage } from '../../services/maintenanceApi';

const MaintAssetInspection = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    getAssetsPage({ page, limit: 20, search: search.trim() || undefined, condition: condition || undefined })
      .then((result) => {
        if (!mounted) return;
        setAssets(result.items);
        setPagination(result.pagination);
      })
      .catch((err) => { if (mounted) setError(err && err.message ? err.message : 'Failed to load asset conditions'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [page, search, condition]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading inspection records…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>Asset Condition</h1>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '8px', padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <input aria-label="Search assets" placeholder="Search asset, tag, or department" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '6px', border: `1px solid ${cardBorder}` }} />
        <select aria-label="Filter by condition" value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1); }} style={{ padding: '10px', borderRadius: '6px', border: `1px solid ${cardBorder}` }}>
          <option value="">All conditions</option>
          {['Excellent', 'Good', 'Fair', 'Poor', 'Critical'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Asset Tag</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Category</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Location</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Condition</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Asset Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>{asset.name || '—'}</td>
                <td style={{ padding: '12px' }}>{asset.asset_tag || asset.assetCode || '—'}</td>
                <td style={{ padding: '12px' }}>{asset.category || '—'}</td>
                <td style={{ padding: '12px' }}>{asset.department || '—'}</td>
                <td style={{ padding: '12px' }}>{asset.location || '—'}</td>
                <td style={{ padding: '12px' }}>{asset.condition || asset.condition_status || '—'}</td>
                <td style={{ padding: '12px' }}>{asset.status || '—'}</td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>No assets match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span aria-live="polite">Page {page} of {pagination.pages} · {pagination.total} assets</span>
        <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}>Next</button>
      </div>}
    </div>
  );
};

export default MaintAssetInspection;