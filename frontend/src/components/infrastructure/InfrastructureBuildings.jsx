// ==============================================
// Infrastructure Buildings Component
// ==============================================
import React, { useEffect, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { apiClient } from '../../utils/api';

const InfrastructureBuildings = () => {
  const [buildings, setBuildings] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadBuildings = async () => {
      try {
        const response = await apiClient.get('/api/infrastructure');
        const assets = Array.isArray(response.data?.data) ? response.data.data : [];
        const buildingAssets = assets.filter((asset) => {
          const type = String(asset.type || '').toLowerCase();
          const category = String(asset.category || '').toLowerCase();
          return type.includes('building') || category.includes('building') || asset.building;
        });
        if (mounted) setBuildings(buildingAssets);
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load buildings.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadBuildings();
    return () => { mounted = false; };
  }, []);

  const filteredBuildings = buildings.filter((building) => {
    const query = search.trim().toLowerCase();
    return !query || [building.name, building.assetCode, building.location, building.building]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });

  return (
    <div style={{ padding: '24px', background: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Infrastructure
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1a365d', margin: 0 }}>
          Buildings &amp; Facilities Management
        </h1>
        <p style={{ color: '#6b7280' }}>Manage buildings, blocks, floors, rooms, and facility assets</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={18} color="#6b7280" />
        <input
          type="search"
          aria-label="Search buildings"
          placeholder="Search buildings..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.95rem', padding: '8px' }}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading buildings...</div>}
        {!loading && error && <div role="alert" style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>{error}</div>}
        {!loading && !error && filteredBuildings.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No data available</div>}
        {!loading && !error && filteredBuildings.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Building</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Asset Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Condition</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuildings.map((building) => (
                <tr key={building.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a365d' }}><Building2 size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />{building.name}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{building.assetCode || 'Not assigned'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{building.location || building.building || 'Not specified'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{building.condition || 'Not specified'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{building.status || 'Not specified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InfrastructureBuildings;
