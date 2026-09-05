import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';

const ICTCreateAsset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme } = useLanguage();
  
  // State
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [generatedQR, setGeneratedQR] = useState(null);
  const [assetTag, setAssetTag] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [duplicateChecks, setDuplicateChecks] = useState({
    assetId: false,
    serialNumber: false,
    rfid: false
  });

  // Form Data
  const [formData, setFormData] = useState({
    asset_id: '',
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
    notes: '',
    rfid_tag: '',
    supplier: '',
    brand: ''
  });

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [deptsRes, catsRes] = await Promise.all([
          axios.get('/api/departments'),
          axios.get('/api/categories')
        ]);
        setDepartments(deptsRes.data.departments || []);
        setCategories(catsRes.data.categories || []);
        
        // Generate initial asset ID
        generateAssetId();
      } catch (error) {
        toast.error('Failed to load options');
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const source = location.state?.cloneFrom;
    if (!source) return;
    setFormData(prev => ({
      ...prev,
      name: source.name || prev.name,
      description: source.description || '',
      category_id: source.category_id || source.category || '',
      department_id: source.department_id || source.department || '',
      model: source.model || '',
      manufacturer: source.manufacturer || source.brand || '',
      brand: source.brand || '',
      purchase_date: source.purchase_date || '',
      purchase_cost: source.purchase_cost || '',
      warranty_expiry: source.warranty_expiry || '',
      location: source.location || '',
      condition_status: source.condition_status || source.condition || 'Good',
      notes: source.notes || '',
      supplier: source.supplier || '',
      asset_id: '',
      serial_number: '',
      rfid_tag: ''
    }));
  }, [location.state]);

  // Generate unique Asset ID
  const generateAssetId = async () => {
    try {
      const response = await axios.get('/api/assets/next-id');
      const newId = response.data.asset_id || `ICT-${Date.now().toString().slice(-6)}`;
      setFormData(prev => ({ ...prev, asset_id: newId }));
    } catch (error) {
      console.error('Asset ID generation failed', error);
      setValidationErrors(prev => ({ ...prev, asset_id: t.validationUnavailable || 'Unable to generate an asset ID' }));
    }
  };

  // Validate a single field
  const validateField = useCallback(async (field, value) => {
    const errors = { ...validationErrors };
    
    switch(field) {
      case 'asset_id':
        if (!value || value.trim() === '') {
          errors.asset_id = t.required;
        } else {
          try {
            const response = await axios.get(`/api/assets/check-id/${value}`);
            if (response.data.exists) {
              errors.asset_id = t.duplicateId;
              setDuplicateChecks(prev => ({ ...prev, assetId: true }));
            } else {
              delete errors.asset_id;
              setDuplicateChecks(prev => ({ ...prev, assetId: false }));
            }
          } catch (error) {
            console.error('Asset ID validation failed', error);
            errors.asset_id = t.validationUnavailable || 'Unable to validate asset ID';
          }
        }
        break;

      case 'serial_number':
        if (value && value.trim() !== '') {
          try {
            const response = await axios.get(`/api/assets/check-serial/${value}`);
            if (response.data.exists) {
              errors.serial_number = t.duplicateSerial;
              setDuplicateChecks(prev => ({ ...prev, serialNumber: true }));
            } else {
              delete errors.serial_number;
              setDuplicateChecks(prev => ({ ...prev, serialNumber: false }));
            }
          } catch (error) {
            console.error('Serial number validation failed', error);
            errors.serial_number = t.validationUnavailable || 'Unable to validate serial number';
          }
        } else {
          delete errors.serial_number;
          setDuplicateChecks(prev => ({ ...prev, serialNumber: false }));
        }
        break;

      case 'rfid_tag':
        if (value && value.trim() !== '') {
          try {
            const response = await axios.get(`/api/assets/check-rfid/${value}`);
            if (response.data.exists) {
              errors.rfid_tag = t.duplicateRfid;
              setDuplicateChecks(prev => ({ ...prev, rfid: true }));
            } else {
              delete errors.rfid_tag;
              setDuplicateChecks(prev => ({ ...prev, rfid: false }));
            }
          } catch (error) {
            console.error('RFID validation failed', error);
            errors.rfid_tag = t.validationUnavailable || 'Unable to validate RFID tag';
          }
        } else {
          delete errors.rfid_tag;
          setDuplicateChecks(prev => ({ ...prev, rfid: false }));
        }
        break;

      case 'name':
        if (!value || value.trim() === '') {
          errors.name = t.required;
        } else {
          delete errors.name;
        }
        break;

      case 'category_id':
        if (!value) {
          errors.category_id = t.required;
        } else {
          delete errors.category_id;
        }
        break;

      case 'department_id':
        if (!value) {
          errors.department_id = t.required;
        } else {
          delete errors.department_id;
        }
        break;

      case 'purchase_date':
        if (!value) {
          errors.purchase_date = t.required;
        } else if (new Date(value) > new Date()) {
          errors.purchase_date = t.futureDate;
        } else {
          delete errors.purchase_date;
        }
        break;

      case 'purchase_cost':
        if (!value) {
          errors.purchase_cost = t.required;
        } else if (isNaN(value) || parseFloat(value) < 0) {
          errors.purchase_cost = t.invalidCost;
        } else {
          delete errors.purchase_cost;
        }
        break;

      case 'warranty_expiry':
        if (value && new Date(value) < new Date(formData.purchase_date)) {
          errors.warranty_expiry = t.warrantyBeforePurchase;
        } else {
          delete errors.warranty_expiry;
        }
        break;

      default:
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.purchase_date, t, validationErrors]);

  // Handle input change with validation
  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate on change for important fields
    if (['asset_id', 'serial_number', 'rfid_tag', 'name', 'category_id', 
         'department_id', 'purchase_date', 'purchase_cost', 'warranty_expiry'].includes(name)) {
      await validateField(name, value);
    }
  };

  // Validate entire form before submission
  const validateForm = async () => {
    const fields = [
      'asset_id', 'name', 'category_id', 'department_id', 
      'purchase_date', 'purchase_cost'
    ];
    
    let isValid = true;
    for (const field of fields) {
      const valid = await validateField(field, formData[field]);
      if (!valid) isValid = false;
    }
    
    // Check duplicates
    if (duplicateChecks.assetId) {
      toast.error(t.duplicateIdError);
      return false;
    }
    if (duplicateChecks.serialNumber) {
      toast.error(t.duplicateSerialError);
      return false;
    }
    if (duplicateChecks.rfid) {
      toast.error(t.duplicateRfidError);
      return false;
    }
    
    return isValid && Object.keys(validationErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    const isValid = await validateForm();
    if (!isValid) {
      toast.error(t.fixErrors);
      return;
    }

    setLoading(true);
    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        status: 'Available',
        purchase_cost: parseFloat(formData.purchase_cost)
      };

      const response = await axios.post('/api/assets', submitData);
      
      // Success
      toast.success(t.assetCreated);
      setAssetTag(response.data.asset_tag);
      setGeneratedQR(response.data.asset_tag || formData.asset_id);
      
      // Navigate after delay
      setTimeout(() => navigate('/ict/assets'), 3000);
      
    } catch (error) {
      const message = error.response?.data?.message || t.createError;
      toast.error(message);
      
      // Handle specific duplicate errors from backend
      if (message.includes('duplicate') || message.includes('already exists')) {
        toast.info(t.checkDuplicate);
      }
    }
    setLoading(false);
  };

  // Handle step navigation
  const nextStep = async () => {
    // Validate current step fields
    let stepValid = true;
    if (currentStep === 1) {
      const fields = ['asset_id', 'name', 'category_id', 'department_id'];
      for (const field of fields) {
        const valid = await validateField(field, formData[field]);
        if (!valid) stepValid = false;
      }
    }
    if (currentStep === 2) {
      const fields = ['purchase_date', 'purchase_cost'];
      for (const field of fields) {
        const valid = await validateField(field, formData[field]);
        if (!valid) stepValid = false;
      }
    }
    
    if (!stepValid) {
      toast.error(t.fixErrors);
      return;
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Styles
  const styles = {
    container: { 
      maxWidth: '1000px', 
      margin: '0 auto', 
      padding: '20px' 
    },
    card: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '30px',
      borderRadius: '16px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,100,0.08)'
    },
    header: {
      marginBottom: '24px'
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.75rem',
      fontWeight: 700,
      marginBottom: '4px'
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.95rem'
    },
    // Steps
    stepsContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '30px',
      position: 'relative',
      padding: '0 10px'
    },
    step: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      position: 'relative'
    },
    stepNumber: (active, completed) => ({
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '16px',
      background: active ? '#2b6cb0' : completed ? '#48bb78' : isDark ? '#32465f' : '#e8edf5',
      color: active || completed ? 'white' : isDark ? '#8896b0' : '#4a5568',
      transition: 'all 0.3s ease',
      border: active ? '2px solid #63b3ed' : 'none',
      zIndex: 2
    }),
    stepLabel: {
      marginTop: '8px',
      fontSize: '12px',
      fontWeight: 600,
      color: isDark ? '#8896b0' : '#4a5568',
      textAlign: 'center'
    },
    stepLine: {
      position: 'absolute',
      top: '20px',
      left: '50%',
      right: '-50%',
      height: '3px',
      background: isDark ? '#32465f' : '#e8edf5',
      zIndex: 1
    },
    stepLineActive: {
      background: '#2b6cb0'
    },
    // Form
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '18px'
    },
    fullWidth: {
      gridColumn: '1 / -1'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      color: isDark ? '#c8dcf5' : '#2d3748',
      fontWeight: 600,
      fontSize: '0.85rem'
    },
    required: {
      color: '#fc8181',
      marginLeft: '2px'
    },
    input: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      transition: 'all 0.2s ease'
    },
    inputError: {
      borderColor: '#fc8181',
      boxShadow: '0 0 0 2px rgba(252, 129, 129, 0.2)'
    },
    inputSuccess: {
      borderColor: '#48bb78',
      boxShadow: '0 0 0 2px rgba(72, 187, 120, 0.2)'
    },
    select: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      cursor: 'pointer'
    },
    textarea: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      minHeight: '80px',
      resize: 'vertical'
    },
    errorText: {
      color: '#fc8181',
      fontSize: '12px',
      marginTop: '4px',
      display: 'block'
    },
    successText: {
      color: '#48bb78',
      fontSize: '12px',
      marginTop: '4px',
      display: 'block'
    },
    // Buttons
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      marginTop: '24px'
    },
    button: (primary = true) => ({
      padding: '12px 32px',
      background: primary 
        ? 'linear-gradient(135deg, #1a365d, #2b6cb0)' 
        : 'transparent',
      color: primary ? 'white' : isDark ? '#c8dcf5' : '#1a365d',
      border: primary ? 'none' : `2px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      borderRadius: '10px',
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      flex: 1,
      maxWidth: '200px',
      disabled: loading
    }),
    // QR Code
    qrContainer: {
      marginTop: '24px',
      padding: '20px',
      background: 'white',
      borderRadius: '12px',
      textAlign: 'center',
      border: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    qrTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 700,
      marginBottom: '12px'
    },
    // Alert
    alert: (type = 'info') => ({
      padding: '12px 16px',
      borderRadius: '8px',
      marginBottom: '16px',
      background: type === 'success' ? 'rgba(72, 187, 120, 0.1)' : 
                  type === 'error' ? 'rgba(252, 129, 129, 0.1)' : 
                  'rgba(43, 108, 176, 0.1)',
      border: `1px solid ${type === 'success' ? '#48bb78' : 
                          type === 'error' ? '#fc8181' : '#2b6cb0'}`,
      color: isDark ? '#c8dcf5' : '#1a365d'
    }),
    duplicateCheck: (isDuplicate) => ({
      fontSize: '12px',
      marginTop: '4px',
      color: isDuplicate ? '#fc8181' : '#48bb78',
      fontWeight: 600
    })
  };

  // Render step content
  const renderStepContent = () => {
    const getFieldError = (field) => validationErrors[field];
    const isFieldValid = (field) => !validationErrors[field] && formData[field] && formData[field].trim() !== '';
    const isFieldInvalid = (field) => validationErrors[field];

    switch(currentStep) {
      case 1: // Basic Information
        return (
          <div style={styles.grid}>
            <div>
              <label style={styles.label}>
                {t.assetId} <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                name="asset_id"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('asset_id') ? styles.inputError : {}),
                  ...(isFieldValid('asset_id') && !duplicateChecks.assetId ? styles.inputSuccess : {})
                }}
                value={formData.asset_id}
                onChange={handleChange}
                onBlur={() => validateField('asset_id', formData.asset_id)}
                placeholder="ICT-XXXXXX"
                required
                disabled={loading}
              />
              {getFieldError('asset_id') && (
                <span style={styles.errorText}>❌ {getFieldError('asset_id')}</span>
              )}
              {isFieldValid('asset_id') && !duplicateChecks.assetId && (
                <span style={styles.successText}>✅ {t.uniqueId}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>
                {t.name} <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                name="name"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('name') ? styles.inputError : {}),
                  ...(isFieldValid('name') ? styles.inputSuccess : {})
                }}
                value={formData.name}
                onChange={handleChange}
                onBlur={() => validateField('name', formData.name)}
                placeholder={t.namePlaceholder}
                required
                disabled={loading}
              />
              {getFieldError('name') && (
                <span style={styles.errorText}>❌ {getFieldError('name')}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>
                {t.category} <span style={styles.required}>*</span>
              </label>
              <select
                name="category_id"
                style={{
                  ...styles.select,
                  ...(isFieldInvalid('category_id') ? styles.inputError : {}),
                  ...(isFieldValid('category_id') ? styles.inputSuccess : {})
                }}
                value={formData.category_id}
                onChange={handleChange}
                onBlur={() => validateField('category_id', formData.category_id)}
                required
                disabled={loading}
              >
                <option value="">{t.selectCategory}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {getFieldError('category_id') && (
                <span style={styles.errorText}>❌ {getFieldError('category_id')}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>
                {t.department} <span style={styles.required}>*</span>
              </label>
              <select
                name="department_id"
                style={{
                  ...styles.select,
                  ...(isFieldInvalid('department_id') ? styles.inputError : {}),
                  ...(isFieldValid('department_id') ? styles.inputSuccess : {})
                }}
                value={formData.department_id}
                onChange={handleChange}
                onBlur={() => validateField('department_id', formData.department_id)}
                required
                disabled={loading}
              >
                <option value="">{t.selectDepartment}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {getFieldError('department_id') && (
                <span style={styles.errorText}>❌ {getFieldError('department_id')}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>{t.serialNumber}</label>
              <input
                type="text"
                name="serial_number"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('serial_number') ? styles.inputError : {}),
                  ...(formData.serial_number && !duplicateChecks.serialNumber ? styles.inputSuccess : {})
                }}
                value={formData.serial_number}
                onChange={handleChange}
                onBlur={() => validateField('serial_number', formData.serial_number)}
                placeholder={t.serialPlaceholder}
                disabled={loading}
              />
              {getFieldError('serial_number') && (
                <span style={styles.errorText}>❌ {getFieldError('serial_number')}</span>
              )}
              {formData.serial_number && !duplicateChecks.serialNumber && !getFieldError('serial_number') && (
                <span style={styles.successText}>✅ {t.uniqueSerial}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>{t.rfidTag}</label>
              <input
                type="text"
                name="rfid_tag"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('rfid_tag') ? styles.inputError : {}),
                  ...(formData.rfid_tag && !duplicateChecks.rfid ? styles.inputSuccess : {})
                }}
                value={formData.rfid_tag}
                onChange={handleChange}
                onBlur={() => validateField('rfid_tag', formData.rfid_tag)}
                placeholder={t.rfidPlaceholder}
                disabled={loading}
              />
              {getFieldError('rfid_tag') && (
                <span style={styles.errorText}>❌ {getFieldError('rfid_tag')}</span>
              )}
              {formData.rfid_tag && !duplicateChecks.rfid && !getFieldError('rfid_tag') && (
                <span style={styles.successText}>✅ {t.uniqueRfid}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>{t.brand}</label>
              <input
                type="text"
                name="brand"
                style={styles.input}
                value={formData.brand}
                onChange={handleChange}
                placeholder={t.brandPlaceholder}
                disabled={loading}
              />
            </div>

            <div>
              <label style={styles.label}>{t.model}</label>
              <input
                type="text"
                name="model"
                style={styles.input}
                value={formData.model}
                onChange={handleChange}
                placeholder={t.modelPlaceholder}
                disabled={loading}
              />
            </div>

            <div>
              <label style={styles.label}>{t.manufacturer}</label>
              <input
                type="text"
                name="manufacturer"
                style={styles.input}
                value={formData.manufacturer}
                onChange={handleChange}
                placeholder={t.manufacturerPlaceholder}
                disabled={loading}
              />
            </div>

            <div>
              <label style={styles.label}>{t.supplier}</label>
              <input
                type="text"
                name="supplier"
                style={styles.input}
                value={formData.supplier}
                onChange={handleChange}
                placeholder={t.supplierPlaceholder}
                disabled={loading}
              />
            </div>

            <div style={styles.fullWidth}>
              <label style={styles.label}>{t.description}</label>
              <textarea
                name="description"
                style={styles.textarea}
                value={formData.description}
                onChange={handleChange}
                placeholder={t.descriptionPlaceholder}
                disabled={loading}
              />
            </div>
          </div>
        );

      case 2: // Financial & Location
        return (
          <div style={styles.grid}>
            <div>
              <label style={styles.label}>
                {t.purchaseDate} <span style={styles.required}>*</span>
              </label>
              <input
                type="date"
                name="purchase_date"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('purchase_date') ? styles.inputError : {}),
                  ...(isFieldValid('purchase_date') ? styles.inputSuccess : {})
                }}
                value={formData.purchase_date}
                onChange={handleChange}
                onBlur={() => validateField('purchase_date', formData.purchase_date)}
                required
                disabled={loading}
              />
              {getFieldError('purchase_date') && (
                <span style={styles.errorText}>❌ {getFieldError('purchase_date')}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>
                {t.purchaseCost} <span style={styles.required}>*</span>
              </label>
              <input
                type="number"
                name="purchase_cost"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('purchase_cost') ? styles.inputError : {}),
                  ...(isFieldValid('purchase_cost') ? styles.inputSuccess : {})
                }}
                value={formData.purchase_cost}
                onChange={handleChange}
                onBlur={() => validateField('purchase_cost', formData.purchase_cost)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                disabled={loading}
              />
              {getFieldError('purchase_cost') && (
                <span style={styles.errorText}>❌ {getFieldError('purchase_cost')}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>{t.warrantyExpiry}</label>
              <input
                type="date"
                name="warranty_expiry"
                style={{
                  ...styles.input,
                  ...(isFieldInvalid('warranty_expiry') ? styles.inputError : {})
                }}
                value={formData.warranty_expiry}
                onChange={handleChange}
                onBlur={() => validateField('warranty_expiry', formData.warranty_expiry)}
                disabled={loading}
              />
              {getFieldError('warranty_expiry') && (
                <span style={styles.errorText}>❌ {getFieldError('warranty_expiry')}</span>
              )}
            </div>

            <div>
              <label style={styles.label}>{t.location}</label>
              <input
                type="text"
                name="location"
                style={styles.input}
                value={formData.location}
                onChange={handleChange}
                placeholder={t.locationPlaceholder}
                disabled={loading}
              />
            </div>

            <div>
              <label style={styles.label}>{t.condition}</label>
              <select
                name="condition_status"
                style={styles.select}
                value={formData.condition_status}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="Excellent">{t.excellent}</option>
                <option value="Good">{t.good}</option>
                <option value="Fair">{t.fair}</option>
                <option value="Poor">{t.poor}</option>
                <option value="Damaged">{t.damaged}</option>
              </select>
            </div>

            <div style={styles.fullWidth}>
              <label style={styles.label}>{t.notes}</label>
              <textarea
                name="notes"
                style={styles.textarea}
                value={formData.notes}
                onChange={handleChange}
                placeholder={t.notesPlaceholder}
                disabled={loading}
              />
            </div>
          </div>
        );

      case 3: // Review & Confirm
        return (
          <div>
            <div style={styles.alert('info')}>
              <strong>📋 {t.reviewTitle}</strong>
              <p style={{ marginTop: '8px' }}>{t.reviewDesc}</p>
            </div>

            <div style={styles.grid}>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.assetId}</label>
                <div style={styles.detailValue}><code>{formData.asset_id}</code></div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.name}</label>
                <div style={styles.detailValue}>{formData.name}</div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.category}</label>
                <div style={styles.detailValue}>
                  {categories.find(c => c.id === parseInt(formData.category_id))?.name || 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.department}</label>
                <div style={styles.detailValue}>
                  {departments.find(d => d.id === parseInt(formData.department_id))?.name || 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.serialNumber}</label>
                <div style={styles.detailValue}>{formData.serial_number || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.rfidTag}</label>
                <div style={styles.detailValue}>{formData.rfid_tag || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.brand}</label>
                <div style={styles.detailValue}>{formData.brand || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.model}</label>
                <div style={styles.detailValue}>{formData.model || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.purchaseDate}</label>
                <div style={styles.detailValue}>
                  {formData.purchase_date ? new Date(formData.purchase_date).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.purchaseCost}</label>
                <div style={styles.detailValue}>
                  ${formData.purchase_cost ? parseFloat(formData.purchase_cost).toLocaleString() : 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.warrantyExpiry}</label>
                <div style={styles.detailValue}>
                  {formData.warranty_expiry ? new Date(formData.warranty_expiry).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.location}</label>
                <div style={styles.detailValue}>{formData.location || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <label style={styles.label}>{t.condition}</label>
                <div style={styles.detailValue}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: formData.condition_status === 'Excellent' ? 'rgba(72, 187, 120, 0.2)' :
                               formData.condition_status === 'Good' ? 'rgba(43, 108, 176, 0.2)' :
                               formData.condition_status === 'Fair' ? 'rgba(237, 137, 54, 0.2)' :
                               formData.condition_status === 'Poor' ? 'rgba(252, 129, 129, 0.2)' :
                               'rgba(229, 62, 62, 0.2)',
                    color: formData.condition_status === 'Excellent' ? '#48bb78' :
                           formData.condition_status === 'Good' ? '#4299e1' :
                           formData.condition_status === 'Fair' ? '#ed8936' :
                           formData.condition_status === 'Poor' ? '#fc8181' :
                           '#e53e3e'
                  }}>
                    {formData.condition_status}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div style={styles.alert('success')}>
                <strong>✅ {t.readyToCreate}</strong>
                <p style={{ marginTop: '8px' }}>{t.readyDesc}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>➕ {t.createAsset}</h1>
          <p style={styles.subtitle}>{t.createAssetDesc}</p>
        </div>

        {/* Steps */}
        <div style={styles.stepsContainer}>
          {[1, 2, 3].map((step) => (
            <div key={step} style={styles.step}>
              {step < 3 && (
                <div style={{
                  ...styles.stepLine,
                  ...(step < currentStep ? styles.stepLineActive : {})
                }} />
              )}
              <div style={styles.stepNumber(
                step === currentStep,
                step < currentStep
              )}>
                {step < currentStep ? '✓' : step}
              </div>
              <div style={styles.stepLabel}>
                {step === 1 ? t.stepBasic :
                 step === 2 ? t.stepFinancial :
                 t.stepReview}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div style={styles.buttonGroup}>
            {currentStep > 1 && (
              <button
                type="button"
                style={styles.button(false)}
                onClick={prevStep}
                disabled={loading}
              >
                ◀ {t.back}
              </button>
            )}
            
            {currentStep < totalSteps ? (
              <button
                type="button"
                style={styles.button(true)}
                onClick={nextStep}
                disabled={loading}
              >
                {t.next} ▶
              </button>
            ) : (
              <button
                type="submit"
                style={styles.button(true)}
                disabled={loading}
              >
                {loading ? '⏳ ' + t.creating : '✅ ' + t.createAsset}
              </button>
            )}
          </div>
        </form>

        {/* QR Code */}
        {generatedQR && (
          <div style={styles.qrContainer}>
            <h4 style={styles.qrTitle}>📱 {t.qrGenerated}</h4>
            <QRCodeCanvas value={generatedQR} size={160} />
            <p style={{ marginTop: '12px', color: '#1a365d', fontWeight: 600 }}>
              {formData.asset_id}
            </p>
            <p style={{ fontSize: '12px', color: '#4a5568' }}>
              {t.assetCreatedSuccess}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Translations
const englishTranslations = {
  createAsset: 'Create ICT Asset',
  createAssetDesc: 'Register a new ICT asset in the system',
  assetId: 'Asset ID',
  name: 'Asset Name',
  namePlaceholder: 'Enter asset name',
  category: 'Category',
  selectCategory: 'Select Category',
  department: 'Department',
  selectDepartment: 'Select Department',
  serialNumber: 'Serial Number',
  serialPlaceholder: 'Enter serial number',
  rfidTag: 'RFID Tag',
  rfidPlaceholder: 'Enter RFID tag number',
  brand: 'Brand',
  brandPlaceholder: 'Enter brand name',
  model: 'Model',
  modelPlaceholder: 'Enter model number',
  manufacturer: 'Manufacturer',
  manufacturerPlaceholder: 'Enter manufacturer name',
  supplier: 'Supplier',
  supplierPlaceholder: 'Enter supplier name',
  purchaseDate: 'Purchase Date',
  purchaseCost: 'Purchase Cost',
  warrantyExpiry: 'Warranty Expiry',
  location: 'Location',
  locationPlaceholder: 'Enter asset location',
  condition: 'Condition',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  description: 'Description',
  descriptionPlaceholder: 'Enter asset description',
  notes: 'Notes',
  notesPlaceholder: 'Any additional notes',
  required: 'This field is required',
  duplicateId: 'Asset ID already exists',
  duplicateSerial: 'Serial number already exists',
  duplicateRfid: 'RFID tag already exists',
  uniqueId: 'Asset ID is unique',
  uniqueSerial: 'Serial number is unique',
  uniqueRfid: 'RFID tag is unique',
  futureDate: 'Purchase date cannot be in the future',
  invalidCost: 'Please enter a valid cost',
  warrantyBeforePurchase: 'Warranty date must be after purchase date',
  fixErrors: 'Please fix all errors before proceeding',
  assetCreated: 'Asset created successfully!',
  createError: 'Failed to create asset',
  checkDuplicate: 'Please check for duplicate entries',
  stepBasic: 'Basic Info',
  stepFinancial: 'Financial & Location',
  stepReview: 'Review & Confirm',
  back: 'Back',
  next: 'Next',
  creating: 'Creating...',
  reviewTitle: 'Review Asset Information',
  reviewDesc: 'Please review all information before creating the asset',
  readyToCreate: 'Ready to Create',
  readyDesc: 'All information is valid and ready for submission',
  qrGenerated: 'QR Code Generated',
  assetCreatedSuccess: 'Asset has been successfully created',
  duplicateIdError: 'Asset ID is already in use',
  duplicateSerialError: 'Serial number is already in use',
  duplicateRfidError: 'RFID tag is already in use'
};

const amharicTranslations = {
  createAsset: 'አዲስ ICT ንብረት ፍጠር',
  createAssetDesc: 'አዲስ ICT ንብረት በስርዓቱ ውስጥ ይመዝገቡ',
  assetId: 'የንብረት መለያ',
  name: 'የንብረት ስም',
  namePlaceholder: 'የንብረት ስም ያስገቡ',
  category: 'ምድብ',
  selectCategory: 'ምድብ ይምረጡ',
  department: 'ክፍል',
  selectDepartment: 'ክፍል ይምረጡ',
  serialNumber: 'ተከታታይ ቁጥር',
  serialPlaceholder: 'ተከታታይ ቁጥር ያስገቡ',
  rfidTag: 'RFID መለያ',
  rfidPlaceholder: 'RFID መለያ ያስገቡ',
  brand: 'ብራንድ',
  brandPlaceholder: 'ብራንድ ያስገቡ',
  model: 'ሞዴል',
  modelPlaceholder: 'ሞዴል ያስገቡ',
  manufacturer: 'አምራች',
  manufacturerPlaceholder: 'አምራች ያስገቡ',
  supplier: 'አቅራቢ',
  supplierPlaceholder: 'አቅራቢ ያስገቡ',
  purchaseDate: 'የግዢ ቀን',
  purchaseCost: 'የግዢ ዋጋ',
  warrantyExpiry: 'የዋስትና ማብቂያ',
  location: 'ቦታ',
  locationPlaceholder: 'የንብረት ቦታ ያስገቡ',
  condition: 'ሁኔታ',
  excellent: 'እጅግ ጥሩ',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  damaged: 'የተበላሸ',
  description: 'መግለጫ',
  descriptionPlaceholder: 'የንብረት መግለጫ ያስገቡ',
  notes: 'ማስታወሻዎች',
  notesPlaceholder: 'ተጨማሪ ማስታወሻዎች',
  required: 'ይህ መስክ ያስፈልጋል',
  duplicateId: 'የንብረት መለያ ቀድሞ አለ',
  duplicateSerial: 'ተከታታይ ቁጥር ቀድሞ አለ',
  duplicateRfid: 'RFID መለያ ቀድሞ አለ',
  uniqueId: 'የንብረት መለያ ልዩ ነው',
  uniqueSerial: 'ተከታታይ ቁጥር ልዩ ነው',
  uniqueRfid: 'RFID መለያ ልዩ ነው',
  futureDate: 'የግዢ ቀን ከወቅታዊ ቀን በኋላ ሊሆን አይችልም',
  invalidCost: 'እባክዎ ትክክለኛ ዋጋ ያስገቡ',
  warrantyBeforePurchase: 'የዋስትና ቀን ከግዢ ቀን በኋላ መሆን አለበት',
  fixErrors: 'እባክዎ ከመቀጠልዎ በፊት ሁሉንም ስህተቶች ያርሙ',
  assetCreated: 'ንብረት በተሳካ ሁኔታ ተፈጥሯል!',
  createError: 'ንብረት መፍጠር አልተሳካም',
  checkDuplicate: 'እባክዎ ለተደጋጋሚ ግቤቶች ያረጋግጡ',
  stepBasic: 'መሰረታዊ መረጃ',
  stepFinancial: 'ፋይናንስ እና ቦታ',
  stepReview: 'ግምገማ እና ማረጋገጫ',
  back: 'ተመለስ',
  next: 'ቀጥል',
  creating: 'በመፍጠር ላይ...',
  reviewTitle: 'የንብረት መረጃ ይገምግሙ',
  reviewDesc: 'ንብረቱን ከመፍጠርዎ በፊት ሁሉንም መረጃ ይገምግሙ',
  readyToCreate: 'ለመፍጠር ዝግጁ',
  readyDesc: 'ሁሉም መረጃ ትክክል ነው እና ለመፍጠር ዝግጁ ነው',
  qrGenerated: 'QR ኮድ ተፈጥሯል',
  assetCreatedSuccess: 'ንብረት በተሳካ ሁኔታ ተፈጥሯል',
  duplicateIdError: 'የንብረት መለያ ቀድሞ ጥቅም ላይ ውሏል',
  duplicateSerialError: 'ተከታታይ ቁጥር ቀድሞ ጥቅም ላይ ውሏል',
  duplicateRfidError: 'RFID መለያ ቀድሞ ጥቅም ላይ ውሏል'
};

export default ICTCreateAsset;