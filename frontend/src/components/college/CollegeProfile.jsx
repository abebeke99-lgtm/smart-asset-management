import React, { useEffect, useState } from 'react';
import { Building2, CalendarDays, Check, Edit3, Mail, MapPin, Phone, Save, ShieldCheck, UserCircle, X } from 'lucide-react';
import api from '../../services/apiClient';
import './CollegeProfile.css';

const emptyProfile = null;
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : 'Not available';
const display = (value) => value || 'Not available';

const CollegeProfile = () => {
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ collegeName: '', description: '', location: '', phone: '', email: '' });

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/college/profile');
      const data = response.data?.data;
      if (!data) throw new Error('College profile information is not available.');
      setProfile(data);
      setForm({ collegeName: data.collegeName || '', description: data.description || '', location: data.location || '', phone: data.phone || '', email: data.email || '' });
    } catch (requestError) {
      console.error('College profile API failed', requestError);
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load college profile.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.collegeName.trim()) { setError('College name is required.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await api.put('/api/college/profile', form);
      if (!response.data?.data) throw new Error('The profile update was not confirmed by the server.');
      setProfile((current) => ({ ...current, ...response.data.data }));
      setEditing(false); setNotice('College profile updated successfully.');
    } catch (requestError) {
      console.error('College profile update failed', requestError);
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update college profile.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="college-profile-state" role="status">Loading college profile...</div>;
  if (error && !profile) return <div className="college-profile-state college-profile-error"><strong>Unable to load college profile.</strong><span>{error}</span><button type="button" onClick={loadProfile}>Retry</button></div>;
  if (!profile) return <div className="college-profile-state">College profile information is not available.</div>;

  const manager = profile.manager || {};
  return <div className="college-profile-page">
    <div className="college-profile-heading"><div><span className="college-profile-eyebrow">College management</span><h1>College Profile</h1><p>View and manage your college information.</p></div><button className="college-profile-edit-button" type="button" onClick={() => { setNotice(''); setError(''); setEditing(true); }}><Edit3 size={17} /> Edit Profile</button></div>
    {notice && <div className="college-profile-notice" role="status"><Check size={17} /> {notice}</div>}
    {error && profile && <div className="college-profile-inline-error" role="alert">{error}</div>}
    <section className="college-profile-identity"><div className="college-profile-identity-icon"><Building2 size={30} /></div><div><h2>{display(profile.collegeName)}</h2><p>{display(profile.description)}</p></div><span className={`college-profile-status college-profile-status--${profile.status === 'active' ? 'active' : 'inactive'}`}><ShieldCheck size={15} /> {display(profile.status)}</span></section>
    <div className="college-profile-grid">
      <ProfileSection title="College Identity" icon={Building2}><Info label="College Name" value={profile.collegeName} /><Info label="College Code" value={profile.collegeCode} /><Info label="Status" value={profile.status} /></ProfileSection>
      <ProfileSection title="Contact Information" icon={Phone}><Info label="Phone" value={profile.phone} /><Info label="Email" value={profile.email} /></ProfileSection>
      <ProfileSection title="Location" icon={MapPin}><Info label="Address / Location" value={profile.location} /></ProfileSection>
      <ProfileSection title="Management" icon={UserCircle}><Info label="College Manager" value={manager.name} /><Info label="Manager Email" value={manager.email} /><Info label="Manager Phone" value={manager.phone} /></ProfileSection>
      <ProfileSection title="System Information" icon={CalendarDays}><Info label="College ID" value={profile.id} /><Info label="Created Date" value={formatDate(profile.createdAt)} /><Info label="Updated Date" value={formatDate(profile.updatedAt)} /></ProfileSection>
    </div>
    {editing && <div className="college-profile-modal-backdrop" role="presentation"><div className="college-profile-modal" role="dialog" aria-modal="true" aria-labelledby="edit-college-profile"><div className="college-profile-modal-heading"><div><h2 id="edit-college-profile">Edit College Profile</h2><p>Update the fields managed by your college.</p></div><button className="college-profile-close" type="button" aria-label="Close edit profile" onClick={() => setEditing(false)}><X size={19} /></button></div><form onSubmit={submit}><label>College Name<input name="collegeName" value={form.collegeName} onChange={updateField} required /></label><label>Description<textarea name="description" value={form.description} onChange={updateField} rows="4" /></label><label>Location / Address<input name="location" value={form.location} onChange={updateField} /></label><div className="college-profile-form-row"><label>Phone<input name="phone" value={form.phone} onChange={updateField} /></label><label>Email<input type="email" name="email" value={form.email} onChange={updateField} /></label></div><div className="college-profile-form-actions"><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="college-profile-save" type="submit" disabled={saving}>{saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}</button></div></form></div></div>}
  </div>;
};

const ProfileSection = ({ title, icon: Icon, children }) => <section className="college-profile-card"><h2><Icon size={18} /> {title}</h2><div className="college-profile-fields">{children}</div></section>;
const Info = ({ label, value }) => <div className="college-profile-field"><span>{label}</span><strong>{display(value)}</strong></div>;

export default CollegeProfile;
