import React, { useState } from 'react';

const initialForm = {
  name: '',
  category: '',
  serialNumber: '',
  quantity: '1',
  condition: '',
  location: '',
  purchaseDate: '',
  warrantyExpiry: '',
  justification: '',
};

const RegistrationForm = ({ labels, onClose, onSubmit, submitting, categories, conditions }) => {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.name.trim() || !form.category.trim() || !form.condition || !form.location.trim() || !form.justification.trim()) {
      setError(labels.required);
      return;
    }
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) <= 0) {
      setError(labels.quantityInvalid);
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (form.purchaseDate && new Date(`${form.purchaseDate}T00:00:00`) > today) {
      setError(labels.purchaseDateFuture);
      return;
    }
    await onSubmit({
      ...form,
      name: form.name.trim(),
      category: form.category.trim(),
      serialNumber: form.serialNumber.trim(),
      quantity: Number(form.quantity),
      location: form.location.trim(),
      justification: form.justification.trim(),
    });
  };

  return (
    <div className="dha-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dha-form-dialog" role="dialog" aria-modal="true" aria-labelledby="dha-registration-title">
        <header className="dha-drawer-header">
          <h2 id="dha-registration-title">{labels.registrationTitle}</h2>
          <button type="button" aria-label={labels.close} onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit} className="dha-registration-form">
          <label>{labels.assetName}<input name="name" required value={form.name} onChange={update} maxLength={255} /></label>
          <label>{labels.category}<input name="category" required value={form.category} onChange={update} maxLength={255} list="dha-category-options" />
            <datalist id="dha-category-options">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          </label>
          <label>{labels.serialNumber}<input name="serialNumber" value={form.serialNumber} onChange={update} maxLength={255} /></label>
          <label>{labels.quantity}<input name="quantity" type="number" min="1" step="1" required value={form.quantity} onChange={update} /></label>
          <label>{labels.condition}<select name="condition" required value={form.condition} onChange={update}>
            <option value="">{labels.selectCondition}</option>
            {conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select></label>
          <label>{labels.location}<input name="location" required value={form.location} onChange={update} maxLength={255} /></label>
          <label>{labels.purchaseDate}<input name="purchaseDate" type="date" value={form.purchaseDate} onChange={update} max={new Date().toISOString().slice(0, 10)} /></label>
          <label>{labels.warranty}<input name="warrantyExpiry" type="date" value={form.warrantyExpiry} onChange={update} /></label>
          <label className="dha-wide">{labels.justification}<textarea name="justification" required value={form.justification} onChange={update} maxLength={2000} /></label>
          {error && <p className="dha-form-error" role="alert">{error}</p>}
          <div className="dha-form-actions dha-wide">
            <button type="button" onClick={onClose}>{labels.cancel}</button>
            <button type="submit" disabled={submitting}>{submitting ? labels.submitting : labels.submit}</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default RegistrationForm;
