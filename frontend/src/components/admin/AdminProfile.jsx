import React from 'react';
import { ArrowLeft, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../common/UserAvatar';

const display = (value) => {
  if (value && typeof value === 'object') return value.name || value.collegeName || value.departmentName || 'Not provided';
  return String(value || '').trim() || 'Not provided';
};

const formatRole = (value) => String(value || 'User')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

export default function AdminProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const fields = [
    ['Full name', user?.fullName || user?.full_name],
    ['Username', user?.username],
    ['Email', user?.email],
    ['Phone', user?.phone],
    ['Role', formatRole(user?.role)],
    ['College', user?.college],
    ['Department', user?.department],
  ];

  return (
    <section className="admin-workspace-page" aria-labelledby="admin-profile-title">
      <div className="admin-page-header">
        <div>
          <h1 id="admin-profile-title" className="admin-page-title">My Profile</h1>
          <p className="admin-page-subtitle">View your account information.</p>
        </div>
        <button type="button" className="admin-secondary-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
      </div>
      <div className="admin-card" style={{ maxWidth: 760, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {user ? <UserAvatar user={user} size="lg" /> : <UserCircle size={56} aria-hidden="true" />}
          <div>
            <h2 style={{ margin: 0 }}>{display(user?.fullName || user?.full_name || user?.username)}</h2>
            <p className="admin-page-subtitle" style={{ margin: '5px 0 0' }}>{formatRole(user?.role)}</p>
          </div>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, margin: 0 }}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt style={{ color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600 }}>{label}</dt>
              <dd style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{display(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
