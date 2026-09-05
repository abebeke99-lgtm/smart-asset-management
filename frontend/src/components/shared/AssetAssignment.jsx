import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const AssetAssignment = () => {
  const { language, theme } = useLanguage();
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [returnDate, setReturnDate] = useState('');

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsRes, usersRes] = await Promise.all([
        axios.get('/api/assets', { params: { status: 'Available', limit: 100 } }),
        axios.get('/api/users')
      ]);
      setAssets(assetsRes.data.assets || []);
      setUsers(usersRes.data.users || []);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedAsset || !selectedUser) {
      toast.error('Please select both asset and user');
      return;
    }

    try {
      await axios.post('/api/assignments', {
        asset_id: selectedAsset,
        assigned_to: selectedUser,
        expected_return_date: returnDate || null
      });
      toast.success('Asset assigned successfully');
      setSelectedAsset('');
      setSelectedUser('');
      setReturnDate('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign asset');
    }
  };

  const styles = {
    container: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' },
    subtitle: { color: isDark ? '#8896b0' : '#4a5568', marginBottom: '24px' },
    card: { background: isDark ? '#1e2d45' : '#ffffff', padding: '30px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)' },
    label: { display: 'block', marginBottom: '6px', color: isDark ? '#c8dcf5' : '#2d3748', fontWeight: 600, fontSize: '0.9rem' },
    select: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', marginBottom: '16px', cursor: 'pointer' },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', marginBottom: '16px' },
    button: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1a365d, #2b6cb0)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' },
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📋 {t.assetAssignment}</h1>
      <p style={styles.subtitle}>{t.assignmentDesc}</p>

      <div style={styles.card}>
        <form onSubmit={handleAssign}>
          <div style={{ marginBottom: '16px' }}>
            <label style={styles.label}>{t.selectAsset} *</label>
            <select style={styles.select} value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)} required>
              <option value="">{t.selectAsset}</option>
              {assets.map(a => (<option key={a.id} value={a.id}>{a.asset_tag} - {a.name}</option>))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={styles.label}>{t.selectUser} *</label>
            <select style={styles.select} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} required>
              <option value="">{t.selectUser}</option>
              {users.map(u => (<option key={u.id} value={u.id}>{u.full_name || u.username} ({u.role})</option>))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={styles.label}>{t.returnDate}</label>
            <input type="date" style={styles.input} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>

          <button type="submit" style={styles.button}>{t.assign}</button>
        </form>
      </div>
    </div>
  );
};

const englishTranslations = {
  assetAssignment: 'Asset Assignment',
  assignmentDesc: 'Assign an asset to a staff member',
  selectAsset: 'Select Asset',
  selectUser: 'Select User',
  returnDate: 'Expected Return Date',
  assign: 'Assign',
  loading: 'Loading...'
};

const amharicTranslations = {
  assetAssignment: 'የንብረት ምደባ',
  assignmentDesc: 'ንብረትን ለሰራተኛ ይመድቡ',
  selectAsset: 'ንብረት ይምረጡ',
  selectUser: 'ተጠቃሚ ይምረጡ',
  returnDate: 'የሚጠበቀው የመመለሻ ቀን',
  assign: 'መድብ',
  loading: 'በመጫን ላይ...'
};

export default AssetAssignment;


