// ==============================================
// Infrastructure Component Stub
// ==============================================
// Generic component for infrastructure feature pages

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiClient } from '../../utils/api';

const InfrastructureComponentStub = ({ title, description = '', icon: Icon = AlertCircle }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadAssets = async () => {
      try {
        const response = await apiClient.get('/api/infrastructure');
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        const titleTerms = title.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
        const relevantAssets = records.filter((asset) => {
          const searchable = [asset.name, asset.type, asset.category, asset.subcategory, asset.location]
            .join(' ').toLowerCase();
          return titleTerms.some((term) => searchable.includes(term));
        });
        if (mounted) setAssets(relevantAssets);
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load infrastructure data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAssets();
    return () => { mounted = false; };
  }, [title]);

  return (
    <div style={{ padding: '24px', background: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Icon size={28} color="#2b6cb0" />
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1a365d', margin: 0 }}>{title}</h1>
        </div>
        {description && <p style={{ color: '#6b7280', margin: 0 }}>{description}</p>}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading data...</div>}
        {!loading && error && <div role="alert" style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>{error}</div>}
        {!loading && !error && assets.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No data available</div>}
        {!loading && !error && assets.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Location</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
            </tr></thead>
            <tbody>{assets.map((asset) => (
              <tr key={asset.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a365d' }}>{asset.name}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{asset.type || asset.category}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{asset.location || 'Not specified'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{asset.status || 'Not specified'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InfrastructureComponentStub;
