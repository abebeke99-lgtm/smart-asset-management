import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StoreNotifications = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [inventoryRes, transactionsRes] = await Promise.all([
          axios.get('/api/inventory'),
          axios.get('/api/inventory/transactions')
        ]);
        const inventory = inventoryRes.data?.inventory || [];
        const lowStock = inventory.filter((item) => (item.available_quantity ?? item.availableQuantity ?? 0) <= (item.min_stock ?? 5));
        const recent = (transactionsRes.data?.transactions || []).slice(0, 6);
        setItems([
          ...lowStock.map((item) => ({ id: `low-${item.id}`, type: 'Low stock', text: `${item.name || 'Asset'} is below minimum stock.` })),
          ...recent.map((item) => ({ id: `txn-${item.id}`, type: item.type || 'Transaction', text: `${item.type || 'Movement'} recorded for ${item.assetId || item.asset_id || 'asset'}.` }))
        ]);
      } catch (error) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px' }}>🔔 Store Notifications</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <p>Loading notifications...</p>
        ) : items.length === 0 ? (
          <p>No notifications at the moment.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.type}</div>
                <div style={{ color: '#475569' }}>{item.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreNotifications;
