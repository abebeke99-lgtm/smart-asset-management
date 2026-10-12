import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = (asset) => ({
  assetCode: asset?.assetCode || '',
  name: asset?.name || '',
  category: asset?.category || '',
  departmentId: asset?.departmentId ? String(asset.departmentId) : '',
  location: asset?.location || '',
  unit: asset?.unit || 'unit',
  quantity: String(asset?.quantity || 1),
  condition: asset?.condition || 'Good',
  purchaseDate: asset?.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : today(),
  purchasePrice: asset?.purchasePrice ?? '0',
  status: asset?.status || 'available',
  serialNumber: asset?.serialNumber || '',
  manufacturer: asset?.manufacturer || '',
  model: asset?.model || '',
  supplier: asset?.supplier || '',
  fundingSource: asset?.fundingSource || '',
  warrantyExpiry: asset?.warrantyExpiry ? String(asset.warrantyExpiry).slice(0, 10) : '',
  purchaseOrderNumber: asset?.specifications?.purchaseOrderNumber || '',
  invoiceNumber: asset?.specifications?.invoiceNumber || '',
  description: asset?.description || '',
  notes: asset?.notes || '',
  custodianId: '',
});

const CollegeAssetForm = ({ asset, onClose, onSaved, t }) => {
  const [form, setForm] = useState(() => initialForm(asset));
  const [options, setOptions] = useState({ categories: [], departments: [], custodians: [], college: null });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/assets/registration-options');
      const data = response.data?.data;
      if (!data || !Array.isArray(data.categories) || !Array.isArray(data.departments) || !Array.isArray(data.custodians)) {
        throw new Error(t('collegeAssets.invalidOptions', 'The server returned invalid registration options.'));
      }
      setOptions(data);
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || t('collegeAssets.optionsError', 'Unable to load registration options.'));
    } finally {
      setLoadingOptions(false);
    }
  }, [t]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const text = (key, fallback) => t(`collegeAssets.${key}`, fallback);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        quantity: Number(form.quantity),
        purchasePrice: Number(form.purchasePrice),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        custodianId: form.custodianId ? Number(form.custodianId) : null,
      };
      const response = asset
        ? await apiClient.put(`/api/college/assets/${asset.id}`, body)
        : await apiClient.post('/api/college/assets', body);
      const savedAsset = response.data?.data || response.data?.asset;
      if (response.data?.success === false || !savedAsset?.id) {
        throw new Error(response.data?.message || text('saveError', 'The asset could not be saved.'));
      }
      await onSaved();
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message || text('saveError', 'The asset could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key, fallback, type = 'text', required = false, extra = {}) => (
    <label className="college-assets-form-field" key={key}>
      <span>{text(key, fallback)}{required && <span aria-hidden="true"> *</span>}</span>
      <input type={type} value={form[key]} onChange={update(key)} required={required} {...extra} />
    </label>
  );

  return (
    <div className="college-assets-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="college-assets-modal college-assets-form-modal" role="dialog" aria-modal="true" aria-labelledby="college-asset-form-title">
        <div className="college-assets-modal-head">
          <div>
            <span className="college-assets-eyebrow">{text('assetRegistration', 'Asset registration')}</span>
            <h2 id="college-asset-form-title">{asset ? text('editAsset', 'Edit asset') : text('registerAsset', 'Register asset')}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label={text('closeForm', 'Close form')}><X /></button>
        </div>
        {loadingOptions ? (
          <div className="college-assets-modal-loading" aria-busy="true"><RefreshCw className="college-assets-spin" /> {text('loadingOptions', 'Loading registration options...')}</div>
        ) : error && !options.categories.length ? (
          <div className="college-assets-state college-assets-error" role="alert"><strong>{error}</strong><button type="button" onClick={loadOptions}><RefreshCw size={16} /> {text('retry', 'Retry')}</button></div>
        ) : !options.categories.length ? (
          <div className="college-assets-state" role="status">{text('noActiveCategories', 'No active asset categories are available. Ask an administrator to configure categories.')}</div>
        ) : (
          <form className="college-assets-form" onSubmit={submit}>
            {error && <p className="college-assets-error" role="alert">{error}</p>}
            <div className="college-assets-form-grid">
              <label className="college-assets-form-field">
                <span>{text('college', 'College')}</span>
                <input value={options.college?.name || ''} readOnly />
              </label>
              {field('assetCode', 'Asset code', 'text', true)}
              {field('name', 'Asset name', 'text', true)}
              <label className="college-assets-form-field">
                <span>{text('category', 'Category')} *</span>
                <select value={form.category} onChange={update('category')} required>
                  <option value="">{text('selectCategory', 'Select category')}</option>
                  {options.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
              </label>
              <label className="college-assets-form-field">
                <span>{text('department', 'Department')}</span>
                <select value={form.departmentId} onChange={update('departmentId')}>
                  <option value="">{text('selectDepartment', 'Select department')}</option>
                  {options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              {field('location', 'Location', 'text', true)}
              {field('unit', 'Unit', 'text', true)}
              {field('quantity', 'Quantity', 'number', true, { min: 1, step: 1 })}
              <label className="college-assets-form-field">
                <span>{text('condition', 'Condition')} *</span>
                <select value={form.condition} onChange={update('condition')} required>
                  {[...new Set(['Good', 'Fair', 'Poor', 'Damaged', form.condition])].map((value) => <option key={value} value={value}>{text(`condition${value}`, value)}</option>)}
                </select>
              </label>
              <label className="college-assets-form-field">
                <span>{text('status', 'Status')} *</span>
                <select value={form.status} onChange={update('status')} required>
                  {[...new Set(['available', 'in-use', 'under-maintenance', 'damaged', form.status])].map((value) => <option key={value} value={value}>{text(`status${value.replace(/-([a-z])/g, (_, character) => character.toUpperCase())}`, value.replace(/-/g, ' '))}</option>)}
                </select>
              </label>
              {field('purchaseDate', 'Purchase date', 'date', true)}
              {field('purchasePrice', 'Purchase cost (ETB)', 'number', true, { min: 0, step: '0.01' })}
              {field('serialNumber', 'Serial number')}
              {field('manufacturer', 'Manufacturer')}
              {field('model', 'Model')}
              {field('supplier', 'Supplier')}
              {field('fundingSource', 'Funding source')}
              {field('warrantyExpiry', 'Warranty expiry', 'date')}
              {field('purchaseOrderNumber', 'Purchase order number')}
              {field('invoiceNumber', 'Invoice number')}
              {!asset && (
                <label className="college-assets-form-field">
                  <span>{text('custodian', 'Responsible person / custodian')}</span>
                  <select value={form.custodianId} onChange={update('custodianId')}>
                    <option value="">{text('noCustodian', 'Not assigned')}</option>
                    {options.custodians.map((custodian) => <option key={custodian.id} value={custodian.id}>{custodian.name}</option>)}
                  </select>
                </label>
              )}
              <label className="college-assets-form-field college-assets-form-wide">
                <span>{text('description', 'Description')}</span>
                <textarea value={form.description} onChange={update('description')} rows={3} />
              </label>
              <label className="college-assets-form-field college-assets-form-wide">
                <span>{text('notes', 'Notes')}</span>
                <textarea value={form.notes} onChange={update('notes')} rows={3} />
              </label>
            </div>
            <div className="college-assets-form-actions">
              <button className="college-assets-clear" type="button" onClick={onClose} disabled={saving}>{text('cancel', 'Cancel')}</button>
              <button className="college-assets-primary" type="submit" disabled={saving || !options.categories.length}>
                {saving ? <RefreshCw className="college-assets-spin" size={16} /> : <Save size={16} />}
                {saving ? text('saving', 'Saving...') : text('saveAsset', 'Save asset')}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default CollegeAssetForm;
