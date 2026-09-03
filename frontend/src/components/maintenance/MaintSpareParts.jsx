import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintSpareParts = () => {
  const [parts, setParts] = useState([
    { id: 1, partNumber: 'PN-001', name: 'AC Compressor', category: 'HVAC', unit: 'pcs', quantity: 5, reserved: 2, minStock: 3, supplier: 'Supplier A', unitCost: 450, location: 'Shelf A1' },
    { id: 2, partNumber: 'PN-002', name: 'Printer Toner', category: 'Office', unit: 'box', quantity: 2, reserved: 1, minStock: 5, supplier: 'Supplier B', unitCost: 120, location: 'Shelf B2' },
    { id: 3, partNumber: 'PN-003', name: 'Fuel Filter', category: 'Generator', unit: 'pcs', quantity: 0, reserved: 0, minStock: 2, supplier: 'Supplier C', unitCost: 85, location: 'Shelf C3' }
  ]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [parts, search, categoryFilter]);

  const getStockStatus = (quantity, minStock) => {
    if (quantity === 0) return { status: 'Out of Stock', color: '#fee2e2', textColor: '#991b1b' };
    if (quantity < minStock) return { status: 'Low Stock', color: '#fed7aa', textColor: '#b45309' };
    return { status: 'Normal', color: '#dcfce7', textColor: '#166534' };
  };

  const categories = [...new Set(parts.map(p => p.category))];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 'bold' }}>🔧 Spare Parts Inventory</h1>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input type="text" placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Add Part</button>
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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Unit Cost</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.map((part) => {
              const stockStatus = getStockStatus(part.quantity, part.minStock);
              const available = part.quantity - part.reserved;
              return (
                <tr key={part.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <td style={{ padding: '12px', fontWeight: '600', fontSize: '0.9rem' }}>{part.partNumber}</td>
                  <td style={{ padding: '12px' }}>{part.name}</td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>{part.category}</td>
                  <td style={{ padding: '12px', fontWeight: '600' }}>{part.quantity}</td>
                  <td style={{ padding: '12px', fontWeight: '600', color: available <= 0 ? '#ef4444' : '#10b981' }}>{available}</td>
                  <td style={{ padding: '12px' }}>{part.minStock}</td>
                  <td style={{ padding: '12px', fontWeight: '600' }}>${part.unitCost}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: stockStatus.color, color: stockStatus.textColor, fontSize: '0.85rem', fontWeight: '600' }}>
                      {stockStatus.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                    <button style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
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