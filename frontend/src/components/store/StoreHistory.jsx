import React, { useEffect, useState } from 'react';
import axios from 'axios';

const StoreHistory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await axios.get('/api/inventory/transactions');
        setItems(response.data?.transactions || []);
      } catch (error) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px' }}>📜 Asset History</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <p>Loading history...</p>
        ) : items.length === 0 ? (
          <p>No transaction history found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Asset</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={styles.td}>{item.type || 'Update'}</td>
                  <td style={styles.td}>{item.assetId || item.asset_id || 'Asset'}</td>
                  <td style={styles.td}>{item.quantity || 0}</td>
                  <td style={styles.td}>{item.reason || item.notes || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const styles = {
  th: { padding: '10px 12px', color: '#475569', fontSize: 13 },
  td: { padding: '12px', color: '#1e293b' }
};

export default StoreHistory;
