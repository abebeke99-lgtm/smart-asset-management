import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const AssetList = () => {
  const { language, theme } = useLanguage();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchAssets();
  }, [currentPage, filterStatus, search]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        status: filterStatus || undefined,
        search: search || undefined
      };
      const response = await axios.get('/api/assets', { params });
      setAssets(response.data.assets || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to load assets');
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      'In-Use': '#48bb78',
      'Available': '#4299e1',
      'Under-Maintenance': '#ed8936',
      'Disposed': '#fc8181',
      'Lost': '#fc8181',
      'Reserved': '#805ad5'
    };
    return colors[status] || '#a0aec0';
  };

  const styles = {
    container: { padding: '20px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700 },
    controls: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
    input: { padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', minWidth: '200px' },
    select: { padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', cursor: 'pointer' },
    button: (bg) => ({ padding: '10px 20px', background: bg || 'linear-gradient(135deg, #1a365d, #2b6cb0)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }),
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e2d45' : '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)' },
    th: { padding: '12px 16px', textAlign: 'left', color: isDark ? '#c8dcf5' : '#1a365d', fontWeight: 600, borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`, background: isDark ? '#141e2d' : '#f7fafc' },
    td: { padding: '12px 16px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' },
    statusBadge: (status) => ({ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: getStatusColor(status) + '20', color: getStatusColor(status) }),
    pagination: { display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' },
    pageButton: (active) => ({ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: active ? (isDark ? '#2b6cb0' : '#2b6cb0') : (isDark ? '#0d1b2a' : '#ffffff'), color: active ? '#ffffff' : (isDark ? '#c8dcf5' : '#1a365d'), cursor: 'pointer', fontWeight: active ? 700 : 400 }),
    actionButton: (bg) => ({ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', marginRight: '6px', background: bg, color: 'white' }),
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📦 {t.assets}</h1>
        <Link to="/assets/create"><button style={styles.button()}>➕ {t.createAsset}</button></Link>
      </div>

      <div style={styles.controls}>
        <input type="text" style={styles.input} placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">{t.allStatus}</option>
          <option value="In-Use">{t.inUse}</option>
          <option value="Available">{t.available}</option>
          <option value="Under-Maintenance">{t.underMaintenance}</option>
          <option value="Disposed">{t.disposed}</option>
        </select>
        <button style={styles.button('linear-gradient(135deg, #2b6cb0, #4299e1)')} onClick={fetchAssets}>🔍 {t.search}</button>
      </div>

      {loading ? <div style={styles.emptyState}>⏳ {t.loading}</div> : assets.length === 0 ? <div style={styles.emptyState}>{t.noAssets}</div> :
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr>
                <th style={styles.th}>{t.assetTag}</th><th style={styles.th}>{t.name}</th>
                <th style={styles.th}>{t.department}</th><th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.location}</th>
                <th style={styles.th}>{t.value}</th>
                <th style={styles.th}>{t.actions}</th>
              </tr></thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td style={styles.td}><Link to={`/assets/${asset.id}`} style={{ color: '#2b6cb0', textDecoration: 'none' }}>{asset.asset_tag}</Link></td>
                    <td style={styles.td}>{asset.name}</td>
                    <td style={styles.td}>{asset.department_name || '-'}</td>
                    <td style={styles.td}><span style={styles.statusBadge(asset.status)}>{asset.status}</span></td>
                    <td style={styles.td}>{asset.location || '-'}</td>
                    <td style={styles.td}>${(asset.current_value || 0).toLocaleString()}</td>
                    <td style={styles.td}>
                      <Link to={`/assets/${asset.id}`}><button style={styles.actionButton('#4299e1')}>👁️</button></Link>
                      <Link to={`/assets/${asset.id}/edit`}><button style={styles.actionButton('#ed8936')}>✏️</button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button style={styles.pageButton(false)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t.previous}</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (<button key={page} style={styles.pageButton(page === currentPage)} onClick={() => setCurrentPage(page)}>{page}</button>))}
              <button style={styles.pageButton(false)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t.next}</button>
            </div>
          )}
        </>
      }
    </div>
  );
};

const englishTranslations = {
  assets: 'Assets',
  createAsset: 'Create Asset',
  searchPlaceholder: 'Search by name or tag...',
  allStatus: 'All Status',
  inUse: 'In-Use',
  available: 'Available',
  underMaintenance: 'Under Maintenance',
  disposed: 'Disposed',
  search: 'Search',
  assetTag: 'Asset Tag',
  name: 'Name',
  department: 'Department',
  status: 'Status',
  location: 'Location',
  value: 'Value',
  actions: 'Actions',
  loading: 'Loading...',
  noAssets: 'No assets found',
  previous: 'Previous',
  next: 'Next'
};

const amharicTranslations = {
  assets: 'ንብረቶች',
  createAsset: 'አዲስ ንብረት ፍጠር',
  searchPlaceholder: 'በስም ወይም በመለያ ይፈልጉ...',
  allStatus: 'ሁሉም ሁኔታዎች',
  inUse: 'በመጠቀም ላይ',
  available: 'ይገኛል',
  underMaintenance: 'በጥገና ላይ',
  disposed: 'ተወግዷል',
  search: 'ፈልግ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  department: 'ክፍል',
  status: 'ሁኔታ',
  location: 'ቦታ',
  value: 'ዋጋ',
  actions: 'ተግባራት',
  loading: 'በመጫን ላይ...',
  noAssets: 'ምንም ንብረቶች አልተገኙም',
  previous: 'ቀዳሚ',
  next: 'ቀጣይ'
};

export default AssetList;


