import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getSpareParts } from '../../services/maintenanceApi';

const MaintSpareParts = () => {
  const [parts, setParts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const loadParts = async () => {
    setLoading(true);
    try {
      const result = await getSpareParts({
        search: search || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        stockStatus: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setParts(result.items || []);
      setSummary(result.summary || {});
      setError('');
    } catch (err) {
      setError(err && err.message ? err.message : 'Failed to load spare parts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, statusFilter]);

  const filteredParts = useMemo(() => parts.filter((part) => {
    const matchesSearch = !search || [part.name, part.partNumber, part.category, part.location, part.supplier, part.manufacturer].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || part.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  }), [parts, search, categoryFilter, statusFilter]);

  const categories = [...new Set(parts.map((part) => part.category).filter(Boolean))];
  const summaryCards = [
    { label: 'Total Parts', value: summary.totalParts ?? parts.length ?? 0 },
    { label: 'Available Stock', value: summary.availableStock ?? 0 },
    { label: 'Low Stock', value: summary.lowStock ?? 0 },
    { label: 'Out of Stock', value: summary.outOfStock ?? 0 },
    { label: 'Reserved', value: summary.reserved ?? 0 },
    { label: 'Issued', value: summary.issued ?? 0 },
    { label: 'Consumed', value: summary.consumed ?? 0 },
    { label: 'Pending Requests', value: summary.pendingRequests ?? 0 },
  ];

  const getBadgeStyle = (status) => {
    const styles = {
      'In Stock': { background: '#dcfce7', color: '#166534' },
      'Low Stock': { background: '#fed7aa', color: '#b45309' },
      'Out of Stock': { background: '#fee2e2', color: '#991b1b' },
      Reserved: { background: '#e0e7ff', color: '#3730a3' },
      Inactive: { background: '#e2e8f0', color: '#475569' },
    };
    return styles[status] || { background: '#f1f5f9', color: '#334155' };
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading spare parts…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Resources</p>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>Spare Parts</h1>
          <p style={{ margin: '6px 0 0', color: isDark ? '#cbd5e1' : '#475569' }}>Manage maintenance spare parts, stock availability, reservations, issues, returns, and consumption.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Add Part', 'Request Parts', 'Stock Adjustment', 'Refresh', 'Export'].map((label) => (
            <button
              key={label}
              type="button"
              style={{
                border: `1px solid ${cardBorder}`,
                background: label === 'Add Part' ? '#2563eb' : isDark ? '#0f172a' : '#ffffff',
                color: label === 'Add Part' ? '#fff' : isDark ? '#e2e8f0' : '#1f2937',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => label === 'Refresh' && loadParts()}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
            <p style={{ margin: '0 0 8px', color: isDark ? '#cbd5e1' : '#64748b', fontSize: '0.8rem' }}>{card.label}</p>
            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>{card.value}</h3>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input type="text" aria-label="Search spare parts" placeholder="Search parts, category, or location" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#e2e8f0' : '#0f172a' }} />
          <select aria-label="Filter spare parts category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#e2e8f0' : '#0f172a' }}>
            <option value="all">All Categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select aria-label="Filter spare parts by stock status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#e2e8f0' : '#0f172a' }}>
            <option value="all">All Statuses</option>
            {['In Stock', 'Low Stock', 'Out of Stock', 'Reserved', 'Inactive'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', borderBottom: `1px solid ${cardBorder}` }}>
                {['Part ID', 'Part Name', 'Part Number', 'Category', 'Available', 'Reserved', 'Min Stock', 'Location', 'Status', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: isDark ? '#cbd5e1' : '#475569' }}>
                    No matching spare parts found.
                  </td>
                </tr>
              ) : (
                filteredParts.map((part) => (
                  <tr key={part.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{part.partId}</td>
                    <td style={{ padding: '12px' }}>{part.name}</td>
                    <td style={{ padding: '12px' }}>{part.partNumber}</td>
                    <td style={{ padding: '12px' }}>{part.category}</td>
                    <td style={{ padding: '12px', fontWeight: 700 }}>{part.availableQuantity}</td>
                    <td style={{ padding: '12px' }}>{part.reservedQuantity}</td>
                    <td style={{ padding: '12px' }}>{part.minimumStock}</td>
                    <td style={{ padding: '12px' }}>{part.location}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ display: 'inline-block', borderRadius: '999px', padding: '4px 8px', fontWeight: 700, fontSize: '0.75rem', ...getBadgeStyle(part.status) }}>{part.status}</span>
                    </td>
                    <td style={{ padding: '12px' }}><button type="button" style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>Details</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MaintSpareParts;