import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getInventory } from '../../services/maintenanceApi';

const MaintSpareParts = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  useEffect(() => {
    getInventory()
      .then((items) => setParts(items.map((p, idx) => ({
        id: p.id || idx + 1,
        partNumber: p.item_id || `INV-${String(p.id).padStart(6, '0')}`,
        name: p.name || 'Unnamed item',
        category: p.category || 'Uncategorized',
        unit: 'pcs',
        quantity: Number(p.quantity || 0),
        reserved: Number(p.reserved_quantity || 0),
        available: Number(p.available_quantity !== undefined ? p.available_quantity : (p.quantity || 0) - (p.reserved_quantity || 0)),
        minStock: Number(p.min_stock || 0),
        supplier: '—',
        unitCost: 0,
        location: p.location || '—',
        status: p.stock_status || (Number(p.quantity || 0) === 0 ? 'Out of Stock' : 'Normal'),
      }))))
      .catch((err) => setError(err && err.message ? err.message : 'Failed to load spare parts'))
      .finally(() => setLoading(false));
  }, []);

  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [parts, search, categoryFilter]);

  const getStockStatus = (status, quantity, minStock) => {
    if (status === 'Out of Stock' || (status === 'Damaged' && quantity === 0)) return { status: 'Out of Stock', color: '#fee2e2', textColor: '#991b1b' };
    if (status === 'Low Stock') return { status: 'Low Stock', color: '#fed7aa', textColor: '#b45309' };
    if (status === 'Damaged') return { status: 'Damaged', color: '#fee2e2', textColor: '#991b1b' };
    if (quantity < minStock && quantity > 0) return { status: 'Low Stock', color: '#fed7aa', textColor: '#b45309' };
    if (quantity === 0) return { status: 'Out of Stock', color: '#fee2e2', textColor: '#991b1b' };
    return { status: 'Normal', color: '#dcfce7', textColor: '#166534' };
  };

  const categories = [...new Set(parts.map(p => p.category))];

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading spare parts…</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>🔧 Spare Parts Inventory</h1>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input type="text" placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#4a5568' }}>
          Spare parts are sourced from the store inventory module (real tracked items).
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Part #</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Category</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Quantity</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Available</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Min Stock</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Location</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.map((part) => {
              const stockStatus = getStockStatus(part.status, part.quantity, part.minStock);
              const available = part.available;
              return (
                <tr key={part.partNumber} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <td style={{ padding: '12px', fontWeight: '600', fontSize: '0.9rem' }}>{part.partNumber}</td>
                  <td style={{ padding: '12px' }}>{part.name}</td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>{part.category}</td>
                  <td style={{ padding: '12px', fontWeight: '600' }}>{part.quantity}</td>
                  <td style={{ padding: '12px', fontWeight: '600', color: available <= 0 ? '#ef4444' : '#10b981' }}>{available}</td>
                  <td style={{ padding: '12px' }}>{part.minStock}</td>
                  <td style={{ padding: '12px' }}>{part.location}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: stockStatus.color, color: stockStatus.textColor, fontSize: '0.85rem', fontWeight: '600' }}>
                      {stockStatus.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaintSpareParts;