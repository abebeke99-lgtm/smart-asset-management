import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const SharedMaintenanceRequests = () => {
  const { language, theme } = useLanguage();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    asset_id: '',
    type: 'Corrective',
    priority: 'Medium',
    title: '',
    description: '',
    scheduled_date: '',
    estimated_cost: ''
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, assetsRes] = await Promise.all([
        axios.get('/api/maintenance', { params: { limit: 100 } }),
        axios.get('/api/assets', { params: { limit: 100 } })
      ]);
      setRequests(requestsRes.data.requests || []);
      setAssets(assetsRes.data.assets || []);
    } catch (error) {
      toast.error('Failed to load maintenance data');
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/maintenance', formData);
      toast.success('Maintenance request created');
      setShowCreate(false);
      setFormData({ asset_id: '', type: 'Corrective', priority: 'Medium', title: '', description: '', scheduled_date: '', estimated_cost: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create request');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': '#ed8936',
      'Approved': '#4299e1',
      'In-Progress': '#48bb78',
      'Completed': '#38a169',
      'Cancelled': '#fc8181',
      'Rejected': '#fc8181'
    };
    return colors[status] || '#a0aec0';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': '#48bb78',
      'Medium': '#4299e1',
      'High': '#ed8936',
      'Critical': '#fc8181'
    };
    return colors[priority] || '#a0aec0';
  };

  const styles = {
    container: { padding: '20px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700 },
    createButton: { padding: '10px 20px', background: 'linear-gradient(135deg, #1a365d, #2b6cb0)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' },
    card: { background: isDark ? '#1e2d45' : '#ffffff', padding: '20px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, marginBottom: '16px' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' },
    cardTitle: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.1rem', fontWeight: 600 },
    metaInfo: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' },
    metaItem: { color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.85rem' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modalContent: { background: isDark ? '#1e2d45' : '#ffffff', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' },
    modalInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', marginBottom: '12px' },
    modalSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', marginBottom: '12px', cursor: 'pointer' },
    modalTextarea: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', minHeight: '80px', resize: 'vertical', marginBottom: '12px' },
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🔧 {t.maintenance}</h1>
        <button style={styles.createButton} onClick={() => setShowCreate(true)}>+ {t.createRequest}</button>
      </div>

      {loading ? <div style={styles.emptyState}>⏳ {t.loading}</div> : requests.length === 0 ? <div style={styles.emptyState}>{t.noRequests}</div> :
        requests.map(req => (
          <div key={req.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.cardTitle}>{req.title}</div>
                <div style={styles.metaInfo}>
                  <span style={styles.metaItem}>#{req.request_number}</span>
                  <span style={{ ...styles.metaItem, color: getStatusColor(req.status) }}>{req.status}</span>
                  <span style={{ ...styles.metaItem, color: getPriorityColor(req.priority) }}>{req.priority}</span>
                  <span style={styles.metaItem}>{t.asset}: {req.asset_name}</span>
                  <span style={styles.metaItem}>{t.type}: {req.type}</span>
                </div>
                <p style={{ color: isDark ? '#8896b0' : '#4a5568', marginTop: '8px' }}>{req.description}</p>
                <div style={styles.metaInfo}>
                  <span style={styles.metaItem}>{t.reportedBy}: {req.reported_by_name}</span>
                  <span style={styles.metaItem}>{t.created}: {new Date(req.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      }

      {showCreate && (
        <div style={styles.modal} onClick={() => setShowCreate(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '16px' }}>{t.createRequest}</h2>
            <form onSubmit={handleCreate}>
              <select style={styles.modalSelect} value={formData.asset_id} onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })} required>
                <option value="">{t.selectAsset}</option>
                {assets.map(a => (<option key={a.id} value={a.id}>{a.asset_tag} - {a.name}</option>))}
              </select>
              <input type="text" style={styles.modalInput} placeholder={t.title} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
              <textarea style={styles.modalTextarea} placeholder={t.description} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
              <select style={styles.modalSelect} value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                <option value="Corrective">{t.corrective}</option>
                <option value="Preventive">{t.preventive}</option>
                <option value="Emergency">{t.emergency}</option>
                <option value="Scheduled">{t.scheduled}</option>
              </select>
              <select style={styles.modalSelect} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                <option value="Low">{t.low}</option>
                <option value="Medium">{t.medium}</option>
                <option value="High">{t.high}</option>
                <option value="Critical">{t.critical}</option>
              </select>
              <input type="date" style={styles.modalInput} placeholder={t.scheduledDate} value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} />
              <input type="number" style={styles.modalInput} placeholder={t.estimatedCost} value={formData.estimated_cost} onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" style={styles.createButton}>{t.submit}</button>
                <button type="button" style={{ ...styles.createButton, background: '#fc8181' }} onClick={() => setShowCreate(false)}>{t.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const englishTranslations = {
  maintenance: 'Maintenance',
  createRequest: 'Create Request',
  loading: 'Loading...',
  noRequests: 'No maintenance requests found',
  asset: 'Asset',
  type: 'Type',
  reportedBy: 'Reported By',
  created: 'Created',
  selectAsset: 'Select Asset',
  title: 'Title',
  description: 'Description',
  corrective: 'Corrective',
  preventive: 'Preventive',
  emergency: 'Emergency',
  scheduled: 'Scheduled',
  scheduledDate: 'Scheduled Date',
  estimatedCost: 'Estimated Cost',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  submit: 'Submit',
  cancel: 'Cancel'
};

const amharicTranslations = {
  maintenance: 'ጥገና',
  createRequest: 'አዲስ ጥያቄ ፍጠር',
  loading: 'በመጫን ላይ...',
  noRequests: 'ምንም የጥገና ጥያቄዎች አልተገኙም',
  asset: 'ንብረት',
  type: 'አይነት',
  reportedBy: 'አቅራቢ',
  created: 'ተፈጥሯል',
  selectAsset: 'ንብረት ይምረጡ',
  title: 'ርዕስ',
  description: 'መግለጫ',
  corrective: 'ማስተካከያ',
  preventive: 'መከላከያ',
  emergency: 'አደጋ',
  scheduled: 'የታቀደ',
  scheduledDate: 'የታቀደ ቀን',
  estimatedCost: 'የግምት ዋጋ',
  low: 'ዝቅተኛ',
  medium: 'መካከለኛ',
  high: 'ከፍተኛ',
  critical: 'አስቸኳይ',
  submit: 'አስገባ',
  cancel: 'ሰርዝ'
};

export default SharedMaintenanceRequests;