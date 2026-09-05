// Register Infrastructure Asset Component
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { apiClient } from '../../utils/api';

const RegisterInfrastructureAsset = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    assetType: '',
    category: '',
    subcategory: '',
    assetName: '',
    serialNumber: '',
    model: '',
    brand: '',
    manufacturer: '',
    quantity: '1',
    unit: 'Unit',
    purchaseDate: '',
    purchasePrice: '',
    supplier: '',
    warranty: '',
    condition: 'Good',
    status: 'Available',
    location: '',
    building: '',
    block: '',
    floor: '',
    room: '',
    rfidTag: '',
    qrCode: '',
    photos: [],
    documents: [],
    notes: ''
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.assetName.trim() || !formData.category) {
      setError('Asset name and category are required.');
      return;
    }

    try {
      setError('');
      await apiClient.post('/api/infrastructure', {
        name: formData.assetName.trim(),
        type: formData.assetType,
        category: formData.category,
        subcategory: formData.subcategory,
        serialNumber: formData.serialNumber || undefined,
        model: formData.model,
        brand: formData.brand,
        manufacturer: formData.manufacturer,
        purchaseDate: formData.purchaseDate || undefined,
        purchasePrice: formData.purchasePrice || undefined,
        supplier: formData.supplier,
        warrantyExpiry: formData.warranty || undefined,
        condition: formData.condition,
        status: formData.status,
        location: formData.location,
        building: formData.building,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        rfidTag: formData.rfidTag || undefined,
        qrCode: formData.qrCode || undefined,
        notes: formData.notes
      });
      navigate('/infrastructure/assets');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to register asset.');
    }
  };

  const assetTypes = ['Fixed Asset', 'Non-Fixed Asset'];
  const categories = {
    'Fixed Asset': ['Building', 'Electrical Equipment', 'Generator', 'Transformer', 'UPS/Inverter', 'Solar Equipment', 'Water Pump', 'Water Tank', 'Workshop Equipment', 'Facility Equipment', 'Roads & Infrastructure'],
    'Non-Fixed Asset': ['Spare Parts', 'Electrical Materials', 'Plumbing Materials', 'Maintenance Materials', 'Tools', 'Consumables', 'Fuel', 'Batteries', 'Lamps / Lighting Materials']
  };

  const locations = ['Main Campus', 'East Wing', 'West Wing', 'Administrative Building', 'Technical Center', 'Ground Floor', 'Roof Area'];

  return (
    <div style={{ padding: '24px', background: '#f3f4f6', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => navigate('/infrastructure/assets')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#2b6cb0',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <ChevronLeft size={20} /> Back
        </button>
        <div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Infrastructure Asset Registration
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a365d', margin: '8px 0 0' }}>
            Register New Asset
          </h1>
        </div>
      </div>

      {/* Progress Indicator */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(num => (
          <React.Fragment key={num}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: num <= step ? '#2b6cb0' : '#e5e7eb',
              color: num <= step ? '#fff' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700
            }}>
              {num}
            </div>
            {num < 5 && (
              <div style={{
                flex: 1,
                height: '2px',
                background: num < step ? '#2b6cb0' : '#e5e7eb',
                margin: '0 12px'
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Form Steps */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {/* Step 1: Asset Type */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a365d', marginBottom: '20px' }}>Select Asset Type</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {assetTypes.map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', padding: '12px', border: formData.assetType === type ? '2px solid #2b6cb0' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', background: formData.assetType === type ? '#eff6ff' : 'transparent' }}>
                  <input
                    type="radio"
                    name="assetType"
                    value={type}
                    checked={formData.assetType === type}
                    onChange={handleInputChange}
                    style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1a365d' }}>{type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Category & Subcategory */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a365d', marginBottom: '20px' }}>Select Category</h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                >
                  <option value="">Select a category</option>
                  {formData.assetType && categories[formData.assetType]?.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Asset Information */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a365d', marginBottom: '20px' }}>Asset Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Asset Name *</label>
                <input
                  type="text"
                  name="assetName"
                  value={formData.assetName}
                  onChange={handleInputChange}
                  placeholder="Enter asset name"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Serial Number</label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleInputChange}
                  placeholder="Enter serial number"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Model</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  placeholder="Enter model"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Manufacturer</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleInputChange}
                  placeholder="Enter manufacturer"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Purchase Date</label>
                <input
                  type="date"
                  name="purchaseDate"
                  value={formData.purchaseDate}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Purchase Price</label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Location & Identification */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a365d', marginBottom: '20px' }}>Location & Identification</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Location</label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                >
                  <option value="">Select location</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Building</label>
                <input
                  type="text"
                  name="building"
                  value={formData.building}
                  onChange={handleInputChange}
                  placeholder="Building name"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>RFID Tag</label>
                <input
                  type="text"
                  name="rfidTag"
                  value={formData.rfidTag}
                  onChange={handleInputChange}
                  placeholder="RFID tag (will be generated)"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1a365d', marginBottom: '8px' }}>Condition</label>
                <select
                  name="condition"
                  value={formData.condition}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a365d', marginBottom: '20px' }}>Review & Submit</h2>
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Asset Type</div>
                  <div style={{ fontWeight: 600, color: '#1a365d' }}>{formData.assetType || 'Not selected'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Category</div>
                  <div style={{ fontWeight: 600, color: '#1a365d' }}>{formData.category || 'Not selected'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Asset Name</div>
                  <div style={{ fontWeight: 600, color: '#1a365d' }}>{formData.assetName || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Location</div>
                  <div style={{ fontWeight: 600, color: '#1a365d' }}>{formData.location || 'Not assigned'}</div>
                </div>
              </div>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>
              Please review the information above. Click "Submit" to register this asset.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        {error && <div role="alert" style={{ color: '#b91c1c', background: '#fee2e2', padding: '12px 16px', borderRadius: '8px', marginTop: '16px' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: step === 1 ? '#e5e7eb' : '#ffffff',
              cursor: step === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              color: step === 1 ? '#9ca3af' : '#1a365d'
            }}
          >
            Previous
          </button>
          {step < 5 ? (
            <button
              onClick={handleNext}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#2b6cb0',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} /> Submit Asset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterInfrastructureAsset;
