import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';

const AssetDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language, theme } = useLanguage();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [history, setHistory] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    const fetchAsset = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/assets/${id}`);
        setAsset(response.data.asset);
        const historyResponse = await axios.get(`/api/assets/${id}/history`);
        setHistory(historyResponse.data.history || []);
      } catch (error) {
        toast.error('Failed to load asset details');
        navigate('/assets');
      }
      setLoading(false);
    };
    fetchAsset();
  }, [id, navigate]);

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
    container: { maxWidth: '1000px', margin: '0 auto', padding: '20px' },
    card: { background: isDark ? '#1e2d45' : '#ffffff', padding: '30px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}` },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.75rem', fontWeight: 700 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    infoItem: { padding: '12px 0', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}` },
    label: { color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
    value: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', fontWeight: 500, marginTop: '4px' },
    statusBadge: { display: 'inline-block', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, background: getStatusColor(asset?.status) + '20', color: getStatusColor(asset?.status) },
    actionButton: (bg) => ({ padding: '10px 20px', background: bg, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginRight: '8px', textDecoration: 'none', display: 'inline-block' }),
    qrContainer: { display: 'flex', justifyContent: 'center', padding: '20px', background: 'white', borderRadius: '8px', marginTop: '20px' },
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  if (!asset) {
    return <div style={styles.emptyState}>{t.notFound}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>{asset.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <span style={styles.statusBadge}>{asset.status}</span>
              <span style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.9rem' }}>
                {t.assetTag}: {asset.asset_tag}
              </span>
            </div>
          </div>
          <div>
            <button style={styles.actionButton('#2b6cb0')} onClick={() => setShowQR(!showQR)}>📱 {t.showQR}</button>
            <Link to={`/${user?.role === 'admin' ? 'admin' : 'ict'}/assets/${id}/edit`}><button style={styles.actionButton('#ed8936')}>✏️ {t.edit}</button></Link>
          </div>
        </div>

        {showQR && (
          <div style={styles.qrContainer}>
            <QRCodeCanvas value={asset.qr_code || asset.asset_tag} size={200} />
          </div>
        )}

        <div style={styles.grid}>
          <div>
            <h3 style={{ marginBottom: '12px', color: isDark ? '#c8dcf5' : '#1a365d' }}>{t.basicInfo}</h3>
            <div style={styles.infoItem}><div style={styles.label}>{t.serialNumber}</div><div style={styles.value}>{asset.serial_number || '-'}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.model}</div><div style={styles.value}>{asset.model || '-'}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.manufacturer}</div><div style={styles.value}>{asset.manufacturer || '-'}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.category}</div><div style={styles.value}>{asset.category_name || '-'}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.department}</div><div style={styles.value}>{asset.department_name || '-'}</div></div>
          </div>

          <div>
            <h3 style={{ marginBottom: '12px', color: isDark ? '#c8dcf5' : '#1a365d' }}>{t.financialInfo}</h3>
            <div style={styles.infoItem}><div style={styles.label}>{t.purchaseDate}</div><div style={styles.value}>{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '-'}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.purchaseCost}</div><div style={styles.value}>${(asset.purchase_cost || 0).toLocaleString()}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.currentValue}</div><div style={styles.value}>${(asset.current_value || 0).toLocaleString()}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.warrantyExpiry}</div><div style={styles.value}>{asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : '-'}</div></div>
            <div style={styles.infoItem}><div style={styles.label}>{t.condition}</div><div style={styles.value}>{asset.condition_status || '-'}</div></div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px', color: isDark ? '#c8dcf5' : '#1a365d' }}>{t.locationInfo}</h3>
          <div style={styles.infoItem}><div style={styles.label}>{t.location}</div><div style={styles.value}>{asset.location || '-'}</div></div>
          {asset.is_assigned && (
            <>
              <div style={styles.infoItem}><div style={styles.label}>{t.assignedTo}</div><div style={styles.value}>{asset.assigned_to_name || '-'}</div></div>
              <div style={styles.infoItem}><div style={styles.label}>{t.assignedDate}</div><div style={styles.value}>{asset.assigned_date ? new Date(asset.assigned_date).toLocaleDateString() : '-'}</div></div>
            </>
          )}
          <div style={styles.infoItem}><div style={styles.label}>{t.notes}</div><div style={styles.value}>{asset.notes || '-'}</div></div>
        </div>

        {asset.rfid_tag && (
          <div style={{ marginTop: '20px', padding: '12px', background: isDark ? '#0d1b2a' : '#f7fafc', borderRadius: '8px' }}>
            <span style={{ fontWeight: 600 }}>📡 {t.rfidTag}:</span> {asset.rfid_tag}
          </div>
        )}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px', color: isDark ? '#c8dcf5' : '#1a365d' }}>{t.history}</h3>
          {history.length === 0 ? <p style={styles.emptyState}>{t.noHistory}</p> : history.slice(0, 20).map((item, index) => <div key={`${item.date}-${index}`} style={styles.infoItem}><div style={styles.label}>{item.action}</div><div style={styles.value}>{item.description || '-'} · {item.date ? new Date(item.date).toLocaleString() : '-'}</div></div>)}
        </div>
      </div>
    </div>
  );
};

const englishTranslations = {
  assetTag: 'Asset Tag',
  edit: 'Edit',
  showQR: 'Show QR Code',
  basicInfo: 'Basic Information',
  serialNumber: 'Serial Number',
  model: 'Model',
  manufacturer: 'Manufacturer',
  category: 'Category',
  department: 'Department',
  financialInfo: 'Financial Information',
  purchaseDate: 'Purchase Date',
  purchaseCost: 'Purchase Cost',
  currentValue: 'Current Value',
  warrantyExpiry: 'Warranty Expiry',
  condition: 'Condition',
  locationInfo: 'Location & Assignment',
  location: 'Location',
  assignedTo: 'Assigned To',
  assignedDate: 'Assigned Date',
  notes: 'Notes',
  rfidTag: 'RFID Tag',
  history: 'History',
  noHistory: 'No history available',
  loading: 'Loading...',
  notFound: 'Asset not found'
};

const amharicTranslations = {
  assetTag: 'የንብረት መለያ',
  edit: 'አርትዕ',
  showQR: 'QR ኮድ አሳይ',
  basicInfo: 'መሠረታዊ መረጃ',
  serialNumber: 'ተከታታይ ቁጥር',
  model: 'ሞዴል',
  manufacturer: 'አምራች',
  category: 'ምድብ',
  department: 'ክፍል',
  financialInfo: 'የፋይናንስ መረጃ',
  purchaseDate: 'የግዢ ቀን',
  purchaseCost: 'የግዢ ዋጋ',
  currentValue: 'አሁን ያለው ዋጋ',
  warrantyExpiry: 'የዋስትና ማብቂያ',
  condition: 'ሁኔታ',
  locationInfo: 'ቦታ እና ምደባ',
  location: 'ቦታ',
  assignedTo: 'ተመድቦለት',
  assignedDate: 'የተመደበበት ቀን',
  notes: 'ማስታወሻዎች',
  rfidTag: 'RFID መለያ',
  history: 'ታሪክ',
  noHistory: 'ምንም ታሪክ የለም',
  loading: 'በመጫን ላይ...',
  notFound: 'ንብረቱ አልተገኘም'
};

export default AssetDetails;


