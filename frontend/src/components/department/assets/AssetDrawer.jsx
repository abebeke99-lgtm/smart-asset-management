import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const editableFields = ['location', 'condition', 'assignedUserId', 'note'];
const AssetDrawer = ({ asset, staff, labels, onClose, onSave, saving }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    setEditing(false);
    setForm({
      location: asset?.location || '',
      condition: asset?.condition || '',
      assignedUserId: asset?.assignedUserId ?? asset?.assigned_user_id ?? asset?.assignedUser?.id ?? '',
      note: '',
    });
  }, [asset]);

  if (!asset) return null;
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const data = [
    ['assetId', asset.assetCode || asset.asset_code || asset.asset_tag || asset.id],
    ['digitalId', asset.digitalId || asset.digital_id],
    ['assetName', asset.name],
    ['category', asset.category || asset.category_name],
    ['serialNumber', asset.serialNumber || asset.serial_number],
    ['quantity', asset.quantity],
    ['status', asset.status],
    ['condition', asset.condition],
    ['location', asset.location],
    ['assignedUser', asset.assignedUser?.fullName || asset.assignedUser?.name || asset.assigned_to_name || asset.assignedUserName],
    ['purchaseDate', asset.purchaseDate || asset.purchase_date],
    ['warranty', asset.warrantyExpiry || asset.warranty_expiry],
    ['qrCode', asset.qrCode || asset.qr_code],
    ['rfid', asset.rfidTag || asset.rfid_tag],
    ['maintenanceStatus', asset.maintenanceStatus || asset.maintenance_status],
  ];
  const formatted = (key, value) => {
    if (value === null || value === undefined || value === '') return labels.notProvided;
    if (key === 'purchaseDate' || key === 'warranty') return new Date(value).toLocaleDateString();
    return String(value);
  };

  const submit = async (event) => {
    event.preventDefault();
    const validStaff = !form.assignedUserId || staff.some((user) => String(user.id) === String(form.assignedUserId));
    if (!validStaff) {
      setStaffError(labels.loadUsersError);
      return;
    }
    const saved = await onSave(Object.fromEntries(editableFields.map((key) => [key, form[key]])));
    if (saved) setEditing(false);
  };

  return (
    <div className="dha-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="dha-drawer" role="dialog" aria-modal="true" aria-labelledby="dha-drawer-title">
        <header className="dha-drawer-header">
          <h2 id="dha-drawer-title">{labels.details}</h2>
          <button type="button" aria-label={labels.close} onClick={onClose}>×</button>
        </header>
        <div className="dha-drawer-content">
          <dl className="dha-detail-grid">
            {data.map(([key, value]) => (
              <div key={key}><dt>{labels[key]}</dt><dd>{formatted(key, value)}</dd></div>
            ))}
          </dl>
          {(asset.qrCode || asset.qr_code || asset.digitalId || asset.digital_id) && (
            <div className="dha-qr">
              <QRCodeSVG value={String(asset.qrCode || asset.qr_code || asset.digitalId || asset.digital_id)} size={144} includeMargin />
            </div>
          )}
          <nav className="dha-detail-links">
            <Link to={`/department-head/history?asset=${encodeURIComponent(asset.id)}`}>{labels.history}</Link>
            <Link to={`/department-head/tracking?asset=${encodeURIComponent(asset.id)}`}>{labels.tracking}</Link>
          </nav>
          <section className="dha-edit-section">
            <h3>{labels.edit}</h3>
            {editing ? (
              <form onSubmit={submit} className="dha-edit-form">
                <label>{labels.location}<input value={form.location} onChange={(event) => setValue('location', event.target.value)} maxLength={255} /></label>
                <label>{labels.condition}<input value={form.condition} onChange={(event) => setValue('condition', event.target.value)} maxLength={100} /></label>
                <label>{labels.assignedUser}
                  <select value={form.assignedUserId} onChange={(event) => setValue('assignedUserId', event.target.value)}>
                    <option value="">{labels.unassigned}</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{member.fullName || member.full_name || member.name}</option>)}
                  </select>
                </label>
                <label>{labels.note}<textarea required value={form.note} onChange={(event) => setValue('note', event.target.value)} placeholder={labels.notePlaceholder} maxLength={1000} /></label>
                {staffError && <p role="alert">{staffError}</p>}
                <div className="dha-form-actions">
                  <button type="button" onClick={() => setEditing(false)}>{labels.cancel}</button>
                  <button type="submit" disabled={saving}>{saving ? labels.saving : labels.save}</button>
                </div>
              </form>
            ) : <button type="button" onClick={() => {
              setStaffError('');
              setEditing(true);
            }}>{labels.edit}</button>}
          </section>
        </div>
      </aside>
    </div>
  );
};

export default AssetDrawer;
