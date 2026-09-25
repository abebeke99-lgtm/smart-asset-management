import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, ClipboardList, Edit3, FileText, Mail, MapPin, Package, Phone, RefreshCw, Save, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';

const DeptProfile = () => {
  const { user } = useAuth();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const loadProfile = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (user?.role === 'department_head' && !user?.departmentId) {
      setError('Department scope is not configured for this account.');
      setLoading(false);
      return () => { active = false; };
    }
    const departmentId = user?.departmentId;
    apiClient.get(`/api/departments/${departmentId}`)
      .then((response) => {
        if (active) {
          setDepartment(response.data?.data || null);
          setSaveMessage('');
        }
      })
      .catch(() => {
        if (active) setError('Unable to load department profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user?.departmentId, user?.role]);

  useEffect(() => loadProfile(), [loadProfile]);

  const canEdit = user?.role === 'admin';
  const headName = department?.head?.fullName || department?.head?.username || 'Not assigned';
  const collegeName = department?.college?.collegeName || 'Not assigned';
  const locationName = department?.locationRecord?.name || 'Not assigned';

  return (
    <section className="department-profile-page">
      <header className="department-profile-header">
        <div className="department-profile-title">
          <span className="department-profile-icon" aria-hidden="true"><Building2 size={24} strokeWidth={1.8} /></span>
          <div>
            <div className="department-profile-breadcrumb">Department / Management</div>
            <h1>Department Profile</h1>
            <p>Profile and operational information for your authorized department.</p>
          </div>
        </div>
        {canEdit && department && !isEditing && (
          <button type="button" className="department-profile-button department-profile-button--primary" onClick={() => setIsEditing(true)}>
            <Edit3 size={16} aria-hidden="true" /> Edit profile
          </button>
        )}
      </header>
      {loading && <ProfileLoadingState />}
      {!loading && error && <ProfileErrorState onRetry={loadProfile} />}
      {!loading && !error && !department && <div className="department-profile-state">Department profile information is not available.</div>}
      {!loading && !error && department && (
        <>
          {saveMessage && <div className="department-profile-notice department-profile-notice--success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{saveMessage}</div>}
          <div className="department-profile-layout">
            <article className="department-profile-card department-profile-card--identity">
              <div className="department-profile-card-heading">
                <div><span className="department-profile-eyebrow">Department information</span><h2>{department.name}</h2></div>
                <span className={`department-profile-status department-profile-status--${department.status === 'inactive' ? 'inactive' : 'active'}`}><CheckCircle2 size={14} aria-hidden="true" />{department.status || 'active'}</span>
              </div>
              <p className="department-profile-description">{department.description || 'No department description available.'}</p>
              {isEditing ? <ProfileForm department={department} saving={saving} onCancel={() => setIsEditing(false)} onSave={async (values) => {
                setSaving(true);
                setSaveMessage('');
                try {
                  const response = await apiClient.put(`/api/departments/${department.id}`, values);
                  setDepartment({ ...department, ...(response.data?.data || values) });
                  setIsEditing(false);
                  setSaveMessage('Department profile updated successfully.');
                } catch (saveError) {
                  setSaveMessage(saveError.response?.data?.message || 'Unable to save department profile.');
                } finally { setSaving(false); }
              }} /> : <DetailGrid department={department} collegeName={collegeName} headName={headName} locationName={locationName} />}
            </article>
            <aside className="department-profile-card">
              <div className="department-profile-section-heading"><ClipboardList size={18} aria-hidden="true" /><h2>Department summary</h2></div>
              <div className="department-profile-summary-grid">
                <SummaryItem icon={Users} label="Total staff" value={department.userCount} />
                <SummaryItem icon={Package} label="Total assets" value={department.assetCount} />
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
};

const DetailGrid = ({ department, collegeName, headName, locationName }) => <div className="department-profile-details">
  <DetailItem icon={FileText} label="Department code" value={department.code || 'Not provided'} />
  <DetailItem icon={Building2} label="College" value={collegeName} />
  <DetailItem icon={UserRound} label="Head / manager" value={headName} />
  <DetailItem icon={MapPin} label="Location" value={locationName} />
  <DetailItem icon={Phone} label="Phone" value={department.phone || 'Not provided'} />
  <DetailItem icon={Mail} label="Email" value={department.email || 'Not provided'} />
</div>;

const DetailItem = ({ icon: Icon, label, value }) => <div className="department-profile-detail"><Icon size={17} aria-hidden="true" /><div><dt>{label}</dt><dd>{value}</dd></div></div>;
const SummaryItem = ({ icon: Icon, label, value }) => <div className="department-profile-summary-item"><Icon size={18} aria-hidden="true" /><strong>{Number(value || 0)}</strong><span>{label}</span></div>;
const ProfileLoadingState = () => <div className="department-profile-loading" aria-live="polite"><span className="department-profile-spinner"><RefreshCw size={20} aria-hidden="true" /></span>Loading department profile...</div>;
const ProfileErrorState = ({ onRetry }) => <div className="department-profile-state department-profile-state--error" role="alert"><p>Unable to load department profile.</p><button type="button" className="department-profile-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Retry</button></div>;

const ProfileForm = ({ department, saving, onCancel, onSave }) => {
  const [values, setValues] = useState({ name: department.name || '', code: department.code || '', description: department.description || '', phone: department.phone || '', email: department.email || '' });
  const [validationError, setValidationError] = useState('');
  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    if (!values.name.trim()) { setValidationError('Department name is required.'); return; }
    setValidationError('');
    onSave({ ...values, name: values.name.trim(), code: values.code.trim(), description: values.description.trim(), phone: values.phone.trim(), email: values.email.trim() });
  };
  return <form className="department-profile-form" onSubmit={submit}>
    {validationError && <p className="department-profile-form-error" role="alert">{validationError}</p>}
    {['name', 'code', 'phone', 'email'].map((field) => <label key={field}>{field === 'name' ? 'Department name' : field[0].toUpperCase() + field.slice(1)}<input name={field} value={values[field]} onChange={update} required={field === 'name'} /></label>)}
    <label>Description<textarea name="description" value={values.description} onChange={update} rows="4" /></label>
    <div className="department-profile-form-actions"><button type="button" className="department-profile-button" onClick={onCancel} disabled={saving}><X size={16} aria-hidden="true" /> Cancel</button><button type="submit" className="department-profile-button department-profile-button--primary" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? 'Saving...' : 'Save changes'}</button></div>
  </form>;
};

export default DeptProfile;
