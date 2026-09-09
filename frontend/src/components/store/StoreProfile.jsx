import React from 'react';
import { LogOut, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const fieldLabels = [
  ['fullName', 'Name'],
  ['username', 'Username'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['role', 'Role'],
  ['college', 'College'],
  ['department', 'Department'],
  ['is_active', 'Account Status'],
  ['last_login', 'Last Login'],
];

const formatValue = (key, value) => {
  if (key === 'is_active') return value ? 'Active' : 'Inactive';
  if (key === 'last_login' && value) return new Date(value).toLocaleString();
  if (value && typeof value === 'object') return value.name || value.code || '';
  return value || 'Not provided';
};

export default function StoreProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <UserCircle size={40} aria-hidden="true" />
        <div>
          <h1 style={{ margin: 0 }}>Profile</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Store Manager account details</p>
        </div>
      </header>
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, margin: 0 }}>
          {fieldLabels.map(([key, label]) => (
            <div key={key}>
              <dt style={{ color: '#64748b', fontSize: 13 }}>{label}</dt>
              <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{formatValue(key, user?.[key])}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: 0, borderRadius: 6, background: '#dc2626', color: '#fff' }}>
          <LogOut size={16} aria-hidden="true" />
          Logout
        </button>
        <span style={{ color: '#64748b', fontSize: 14 }}>Password changes require an authorized account security workflow.</span>
      </section>
    </main>
  );
}
