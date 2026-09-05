import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';

const AssetCreate = () => {
  const navigate = useNavigate();
  const { language, theme } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [generatedQR, setGeneratedQR] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    department_id: '',
    serial_number: '',
    model: '',
    manufacturer: '',
    purchase_date: '',
    purchase_cost: '',
    warranty_expiry: '',
    location: '',
    condition_status: 'Good',
    notes: ''
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [deptsRes, catsRes] = await Promise.all([
          axios.get('/api/departments'),
          axios.get('/api/categories')
        ]);
        setDepartments(deptsRes.data.departments || []);
        setCategories(catsRes.data.categories || []);
      } catch (error) {
        toast.error('Failed to load options');
      }
    };
    fetchOptions();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('/api/assets', formData);
      toast.success('Asset created successfully!');
      setGeneratedQR(response.data.asset_tag);
      setTimeout(() => navigate('/assets'), 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create asset');
    }
    setLoading(false);
  };

  const styles = {
    container: { maxWidth: '900px', margin: '0 auto', padding: '20px' },
    card: { background: isDark ? '#1e2d45' : '#ffffff', padding: '30px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' },
    subtitle: { color: isDark ? '#8896b0' : '#4a5568', marginBottom: '24px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    fullWidth: { gridColumn: '1 / -1' },
    label: { display: 'block', marginBottom: '6px', color: isDark ? '#c8dcf5' : '#2d3748', fontWeight: 600, fontSize: '0.9rem' },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', marginBottom: '4px' },
    select: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', marginBottom: '4px', cursor: 'pointer' },
    textarea: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', minHeight: '80px', resize: 'vertical', marginBottom: '4px' },
    button: { padding: '14px 32px', background: 'linear-gradient(135deg, #1a365d, #2b6cb0)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'transform 0.15s ease', marginTop: '16px', width: '100%' },
    qrContainer: { display: 'flex', justifyContent: 'center', padding: '20px', background: 'white', borderRadius: '8px', marginTop: '16px' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>➕ {t.createAsset}</h1>
        <p style={styles.subtitle}>{t.createAssetDesc}</p>
        <form onSubmit={handleSubmit}>
          <div style={styles.grid}>
            <div><label style={styles.label}>{t.name} *</label><input type="text" name="name" style={styles.input} value={formData.name} onChange={handleChange} required /></div>
            <div><label style={styles.label}>{t.serialNumber}</label><input type="text" name="serial_number" style={styles.input} value={formData.serial_number} onChange={handleChange} /></div>
            <div><label style={styles.label}>{t.category} *</label><select name="category_id" style={styles.select} value={formData.category_id} onChange={handleChange} required><option value="">{t.selectCategory}</option>{categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}</select></div>
            <div><label style={styles.label}>{t.department} *</label><select name="department_id" style={styles.select} value={formData.department_id} onChange={handleChange} required><option value="">{t.selectDepartment}</option>{departments.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select></div>
            <div><label style={styles.label}>{t.model}</label><input type="text" name="model" style={styles.input} value={formData.model} onChange={handleChange} /></div>
            <div><label style={styles.label}>{t.manufacturer}</label><input type="text" name="manufacturer" style={styles.input} value={formData.manufacturer} onChange={handleChange} /></div>
            <div><label style={styles.label}>{t.purchaseDate} *</label><input type="date" name="purchase_date" style={styles.input} value={formData.purchase_date} onChange={handleChange} required /></div>
            <div><label style={styles.label}>{t.purchaseCost} *</label><input type="number" name="purchase_cost" style={styles.input} value={formData.purchase_cost} onChange={handleChange} required min="0" step="0.01" /></div>
            <div><label style={styles.label}>{t.warrantyExpiry}</label><input type="date" name="warranty_expiry" style={styles.input} value={formData.warranty_expiry} onChange={handleChange} /></div>
            <div><label style={styles.label}>{t.location}</label><input type="text" name="location" style={styles.input} value={formData.location} onChange={handleChange} /></div>
            <div><label style={styles.label}>{t.condition}</label><select name="condition_status" style={styles.select} value={formData.condition_status} onChange={handleChange}><option value="Excellent">{t.excellent}</option><option value="Good">{t.good}</option><option value="Fair">{t.fair}</option><option value="Poor">{t.poor}</option><option value="Damaged">{t.damaged}</option></select></div>
            <div style={styles.fullWidth}><label style={styles.label}>{t.description}</label><textarea name="description" style={styles.textarea} value={formData.description} onChange={handleChange} /></div>
            <div style={styles.fullWidth}><label style={styles.label}>{t.notes}</label><textarea name="notes" style={styles.textarea} value={formData.notes} onChange={handleChange} /></div>
          </div>
          <button type="submit" style={styles.button} disabled={loading}>{loading ? '⏳ Creating...' : t.createAsset}</button>
        </form>
        {generatedQR && (
          <div style={styles.qrContainer}>
            <div style={{ textAlign: 'center' }}>
              <QRCodeCanvas value={generatedQR} size={150} />
              <p style={{ marginTop: '8px', color: isDark ? '#c8dcf5' : '#1a365d' }}>{t.qrGenerated} {generatedQR}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const englishTranslations = {
  createAsset: 'Create Asset',
  createAssetDesc: 'Register a new asset in the system',
  name: 'Asset Name',
  serialNumber: 'Serial Number',
  category: 'Category',
  selectCategory: 'Select Category',
  department: 'Department',
  selectDepartment: 'Select Department',
  model: 'Model',
  manufacturer: 'Manufacturer',
  purchaseDate: 'Purchase Date',
  purchaseCost: 'Purchase Cost',
  warrantyExpiry: 'Warranty Expiry',
  location: 'Location',
  condition: 'Condition',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  description: 'Description',
  notes: 'Notes',
  qrGenerated: 'QR Code Generated for:'
};

const amharicTranslations = {
  createAsset: 'አዲስ ንብረት ፍጠር',
  createAssetDesc: 'አዲስ ንብረት በስርዓቱ ውስጥ ይመዝገቡ',
  name: 'የንብረት ስም',
  serialNumber: 'ተከታታይ ቁጥር',
  category: 'ምድብ',
  selectCategory: 'ምድብ ይምረጡ',
  department: 'ክፍል',
  selectDepartment: 'ክፍል ይምረጡ',
  model: 'ሞዴል',
  manufacturer: 'አምራች',
  purchaseDate: 'የግዢ ቀን',
  purchaseCost: 'የግዢ ዋጋ',
  warrantyExpiry: 'የዋስትና ማብቂያ',
  location: 'ቦታ',
  condition: 'ሁኔታ',
  excellent: 'እጅግ ጥሩ',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  damaged: 'የተበላሸ',
  description: 'መግለጫ',
  notes: 'ማስታወሻዎች',
  qrGenerated: 'QR ኮድ ተፈጥሯል ለ:'
};

export default AssetCreate;


