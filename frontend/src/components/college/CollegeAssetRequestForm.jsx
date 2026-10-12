import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = (request) => ({
  requestTitle: request?.requestTitle || '',
  requestedItem: request?.requestedItem || '',
  category: request?.category || '',
  description: request?.description || '',
  justification: request?.justification || '',
  quantity: String(request?.quantity || 1),
  unit: request?.unit || 'unit',
  priority: request?.priority || 'medium',
  departmentId: request?.departmentId ? String(request.departmentId) : '',
  neededBy: request?.neededBy || '',
  preferredLocation: request?.preferredLocation || '',
  estimatedValue: request?.estimatedValue ?? '',
});

const CollegeAssetRequestForm = ({ request, onClose, onSaved, translate }) => {
  const [form, setForm] = useState(() => initialForm(request));
  const [options, setOptions] = useState({ categories: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/college/requests/options');
      const data = response.data?.data;
      if (!Array.isArray(data?.categories) || !Array.isArray(data?.departments)) {
        throw new Error(translate('The server returned invalid request options.'));
      }
      setOptions(data);
    } catch (loadError) {
      setError(translate(loadError.response?.data?.message || loadError.message || 'Unable to load request options.'));
    } finally {
      setLoading(false);
    }
  }, [translate]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const text = (value) => translate(value);
  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        quantity: Number(form.quantity),
        departmentId: Number(form.departmentId),
        estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue),
      };
      const response = request
        ? await apiClient.put(`/api/college/requests/${request.id}`, body)
        : await apiClient.post('/api/college/requests', body);
      const saved = response.data?.data;
      if (response.data?.success === false || !saved?.id) {
        throw new Error(response.data?.message || 'The request could not be saved.');
      }
      await onSaved(saved);
    } catch (saveError) {
      setError(text(saveError.response?.data?.message || saveError.message || 'The request could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, type = 'text', required = false, extra = {}) => (
    <label className="college-requests-form-field" key={name}>
      <span>{text(label)}{required && <span aria-hidden="true"> *</span>}</span>
      <input type={type} value={form[name]} onChange={update(name)} required={required} {...extra} />
    </label>
  );

  return (
    <div className="college-requests-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="college-requests-modal college-requests-form-modal" role="dialog" aria-modal="true" aria-labelledby="college-request-form-title">
        <div className="college-requests-modal-head">
          <div>
            <span className="college-requests-eyebrow">{text('College Manager')}</span>
            <h2 id="college-request-form-title">{text(request ? 'Edit asset request' : 'Create asset request')}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label={text('Close request form')}><X /></button>
        </div>
        {loading ? (
          <div className="college-requests-state" aria-busy="true"><RefreshCw className="college-requests-spin" /> {text('Loading request options...')}</div>
        ) : error && (!options.categories.length || !options.departments.length) ? (
          <div className="college-requests-state college-requests-error" role="alert"><strong>{error}</strong><button type="button" onClick={loadOptions}>{text('Retry')}</button></div>
        ) : !options.categories.length || !options.departments.length ? (
          <div className="college-requests-state college-requests-error" role="status">
            {text('This request has no active categories or departments. Contact your administrator.')}
            <button type="button" onClick={loadOptions}>{text('Retry')}</button>
          </div>
        ) : (
          <form className="college-requests-form" onSubmit={submit}>
            {error && <p className="college-requests-form-error" role="alert">{error}</p>}
            <div className="college-requests-form-grid">
              {field('requestTitle', 'Request title', 'text', true, { maxLength: 255 })}
              {field('requestedItem', 'Asset or item name', 'text', true, { maxLength: 255 })}
              <label className="college-requests-form-field">
                <span>{text('Asset category')} *</span>
                <select value={form.category} onChange={update('category')} required>
                  <option value="">{text('Select category')}</option>
                  {options.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
              </label>
              <label className="college-requests-form-field">
                <span>{text('Requesting department')} *</span>
                <select value={form.departmentId} onChange={update('departmentId')} required>
                  <option value="">{text('Select department')}</option>
                  {options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              {field('quantity', 'Requested quantity', 'number', true, { min: 1, step: 1 })}
              {field('unit', 'Unit of measurement', 'text', true, { maxLength: 50 })}
              <label className="college-requests-form-field">
                <span>{text('Priority')} *</span>
                <select value={form.priority} onChange={update('priority')} required>
                  {['low', 'medium', 'high', 'urgent', 'critical'].map((priority) => <option key={priority} value={priority}>{text(priority[0].toUpperCase() + priority.slice(1))}</option>)}
                </select>
              </label>
              {field('neededBy', 'Requested delivery date', 'date', false, { min: today() })}
              {field('preferredLocation', 'Preferred location', 'text', false, { maxLength: 255 })}
              {field('estimatedValue', 'Estimated cost', 'number', false, { min: 0, step: '0.01' })}
              <label className="college-requests-form-field college-requests-form-wide">
                <span>{text('Description')}</span>
                <textarea value={form.description} onChange={update('description')} rows={3} maxLength={5000} />
              </label>
              <label className="college-requests-form-field college-requests-form-wide">
                <span>{text('Business justification')} *</span>
                <textarea value={form.justification} onChange={update('justification')} required rows={4} maxLength={5000} />
              </label>
            </div>
            <div className="college-requests-form-actions">
              <button type="button" onClick={onClose} disabled={saving}>{text('Cancel')}</button>
              <button type="submit" disabled={saving || !options.categories.length || !options.departments.length}>
                {saving ? <RefreshCw className="college-requests-spin" size={16} /> : <Save size={16} />}
                {saving ? text('Submitting...') : text(request ? 'Save changes' : 'Submit request')}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default CollegeAssetRequestForm;
