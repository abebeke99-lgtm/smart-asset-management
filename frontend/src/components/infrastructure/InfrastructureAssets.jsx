// ==============================================
// Infrastructure Assets Component
// ==============================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Eye, Search } from 'lucide-react';
import { apiClient } from '../../utils/api';

const InfrastructureAssets = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAssets = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get('/api/infrastructure');
        setAssets(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load infrastructure assets.');
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = search === '' || 
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.type.toLowerCase().includes(search.toLowerCase()) ||
      asset.location.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = filterType === 'all' || asset.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const assetTypes = ['Building', 'Electrical', 'Generator', 'Transformer', 'UPS', 'Solar', 'Water System', 'Road', 'Drainage'];

  return (
    <div style={{ padding: '24px', background: '#f3f4f6', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Infrastructure
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1a365d', margin: 0 }}>
            Infrastructure Assets
          </h1>
        </div>
        <button
          onClick={() => navigate('/infrastructure/assets/register')}
          style={{
            background: '#2b6cb0',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={18} /> Register Asset
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={18} color="#6b7280" />
          <input
            type="text"
            placeholder="Search by name, type, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '0.95rem',
              padding: '8px'
            }}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Types</option>
          {assetTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Assets Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading assets...</div>
        ) : error ? (
          <div role="alert" style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>{error}</div>
        ) : filteredAssets.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            No data available
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1a365d', fontSize: '0.85rem' }}>Asset Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1a365d', fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1a365d', fontSize: '0.85rem' }}>Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1a365d', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1a365d', fontSize: '0.85rem' }}>Condition</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#1a365d', fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(asset => (
                <tr key={asset.id} style={{ borderBottom: '1px solid #e5e7eb', ':hover': { background: '#f9fafb' } }}>
                  <td style={{ padding: '12px 16px', color: '#1a365d', fontWeight: 600 }}>{asset.name}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{asset.type}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{asset.location}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: asset.status === 'operational' ? '#d1fae5' : '#fee2e2',
                      color: asset.status === 'operational' ? '#065f46' : '#991b1b',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}>
                      {asset.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{asset.condition}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2b6cb0', padding: '4px' }} title="View">
                      <Eye size={18} />
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', padding: '4px' }} title="Edit">
                      <Edit2 size={18} />
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px' }} title="Delete">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InfrastructureAssets;
