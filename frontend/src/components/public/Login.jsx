import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { apiBase } from '../../utils/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [rfidData, setRfidData] = useState(null);
  const [rfidLoading, setRfidLoading] = useState(false);
  const [rfidError, setRfidError] = useState(null);

  const [backendStatus, setBackendStatus] = useState('checking');
  const [activeRole, setActiveRole] = useState(null);

  const { login } = useAuth();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const isDark = theme === 'dark';

  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const roles = [
    { id: 'admin', label: 'Admin', emoji: '👑', color: '#f59e0b' },
    { id: 'store_manager', label: 'Store Mgr', emoji: '📦', color: '#8b5cf6' },
    { id: 'ict_officer', label: 'ICT Officer', emoji: '💻', color: '#3b82f6' },
    { id: 'college', label: 'College', emoji: '🏫', color: '#10b981' },
    { id: 'finance', label: 'Finance', emoji: '💰', color: '#06b6d4' },
    { id: 'maintenance', label: 'Maintenance', emoji: '🔧', color: '#f97316' },
    { id: 'infrastructure', label: 'Infrastructure', emoji: '🏗️', color: '#059669' },
  ];

  const handleQuickFillRole = (roleId) => {
    setActiveRole(roleId);
    setUsername(roleId);
    setPassword('');
    setError(null);
    setRfidError(null);
  };

  useEffect(() => {
    let mounted = true;
    const checkBackend = async () => {
      try {
        const base = apiBase();
        const backendUrl = base.replace(/\/api\/?$/, '').replace(/\/$/, '');
        await axios.get(`${backendUrl}/api/health`, { timeout: 3000 });
        if (mounted) setBackendStatus('online');
      } catch (err) {
        if (mounted) setBackendStatus('offline');
      }
    };
    checkBackend();
    return () => { mounted = false; };
  }, []);

  const fetchRfidData = async () => {
    try {
      setRfidLoading(true);
      setRfidError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setRfidError('Please login first before scanning RFID.');
        return;
      }
      const response = await axios.get(`${apiBase()}/rfid`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      if (response.data?.success) {
        const logs = Array.isArray(response.data.data) ? response.data.data : [];
        setRfidData(logs[0] || null);
        if (!logs.length) setRfidError('No RFID event detected.');
      } else {
        throw new Error(response.data?.message || 'Failed to load RFID data.');
      }
    } catch (err) {
      setRfidError('RFID Reader is idle or not connected.');
    } finally {
      setRfidLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError('Email or username is required.'); return; }
    if (!password) { setError('Password is required.'); return; }
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (!result?.success) {
        setError(result?.error || 'Authentication failed.');
        return;
      }
      const roleRoutes = {
        admin: '/admin',
        ict_officer: '/ict',
        college: '/college',
        finance: '/finance',
        store_manager: '/store',
        maintenance: '/maintenance',
        infrastructure: '/infrastructure',
        staff: '/department',
      };
      navigate(roleRoutes[result?.user?.role] || '/home', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .login-root {
          min-height: 100vh;
          width: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          overflow-x: hidden;
          font-family: Inter, system-ui, sans-serif;
        }
        .login-light { background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%); }
        .login-dark { background: linear-gradient(135deg, #020617 0%, #111827 100%); }
        .login-background { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .login-orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .7; }
        .login-orb-one { width: 430px; height: 430px; top: -170px; left: -130px; background: rgba(59,130,246,.20); }
        .login-orb-two { width: 430px; height: 430px; right: -140px; bottom: -180px; background: rgba(139,92,246,.20); }
        .login-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 470px;
          padding: 40px 32px 30px;
          border-radius: 26px;
          backdrop-filter: blur(22px);
          animation: loginIn .55s ease-out;
        }
        .login-light .login-card { background: rgba(255,255,255,.90); border: 1px solid rgba(255,255,255,.9); box-shadow: 0 30px 80px rgba(15,23,42,.14); }
        .login-dark .login-card { background: rgba(15,23,42,.90); border: 1px solid rgba(148,163,184,.13); box-shadow: 0 30px 80px rgba(0,0,0,.58); }
        @keyframes loginIn { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .login-heading { text-align: center; margin-bottom: 21px; }
        .login-heading h1 { margin: 0; font-size: 25px; font-weight: 850; }
        .login-light .login-heading h1 { color: #0f172a; }
        .login-dark .login-heading h1 { color: #f8fafc; }
        .login-heading p { margin: 7px auto 0; font-size: 13px; color: #64748b; }
        .login-status-card { min-height: 42px; display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; margin-bottom: 13px; border-radius: 12px; }
        .login-light .login-status-card { background: #f1f5f9; border: 1px solid #e2e8f0; }
        .login-dark .login-status-card { background: rgba(30,41,59,.65); border: 1px solid rgba(148,163,184,.08); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-online { background: #10b981; box-shadow: 0 0 9px rgba(16,185,129,.8); }
        .status-offline { background: #ef4444; }
        .status-checking { background: #f59e0b; animation: statusPulse 1s infinite; }
        @keyframes statusPulse { 50% { opacity: .35; } }
        .rfid-button { background: transparent; border: none; color: #2563eb; font-size: 11px; font-weight: 700; cursor: pointer; }
        .role-selector { margin-bottom: 17px; padding: 12px; border-radius: 14px; }
        .login-light .role-selector { background: #f8fafc; border: 1px solid #e2e8f0; }
        .login-dark .role-selector { background: rgba(30,41,59,.42); border: 1px solid rgba(148,163,184,.08); }
        .role-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }
        .role-button { padding: 8px 5px; border-radius: 9px; border: 1px solid transparent; cursor: pointer; font-size: 10px; font-weight: 700; transition: transform .15s ease; }
        .login-light .role-button { background: #fff; color: #1e293b; border-color: #e2e8f0; }
        .login-dark .role-button { background: rgba(255,255,255,.035); color: #e2e8f0; border-color: rgba(255,255,255,.04); }
        .role-button.role-active { border-color: var(--role-color); box-shadow: 0 0 0 1px var(--role-color); }
        .login-error { padding: 10px 12px; border-left: 4px solid #ef4444; border-radius: 8px; font-size: 12px; color: #ef4444; background: rgba(239,68,68,0.1); margin-bottom: 15px; }
        .login-input-wrapper input { width: 100%; height: 46px; padding: 0 15px 0 40px; border-radius: 11px; outline: none; border: 1px solid #cbd5e1; margin-bottom: 5px; }
        .login-dark .login-input-wrapper input { background: #1e293b; color: #f8fafc; border-color: #334155; }
        .forgot-link { display: block; text-align: right; margin-bottom: 15px; font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 600; }
        .forgot-link:hover { text-decoration: underline; }
        .login-submit { width: 100%; height: 48px; border-radius: 12px; border: none; background: linear-gradient(135deg, #2563eb, #6366f1); color: white; font-weight: 800; cursor: pointer; transition: transform .18s; }
        .login-submit:hover { transform: translateY(-1px); }
        .login-footer { margin-top: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid rgba(100,116,139,0.2); padding-top: 15px; }
      `}</style>

      <div className={`login-root ${isDark ? 'login-dark' : 'login-light'}`}>
        <div className="login-background">
          <div className="login-orb login-orb-one" />
          <div className="login-orb login-orb-two" />
        </div>

        <main className="login-card">
          <div className="login-heading">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>

          <div className="login-status-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
              <span className={`status-dot ${backendStatus === 'online' ? 'status-online' : backendStatus === 'offline' ? 'status-offline' : 'status-checking'}`} />
              <span>System {backendStatus}</span>
            </div>
            <button type="button" className="rfid-button" onClick={fetchRfidData} disabled={rfidLoading}>
              {rfidLoading ? 'Scanning...' : '📡 Scan RFID'}
            </button>
          </div>

          {rfidData && (
            <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '10px', borderRadius: '10px', marginBottom: '15px', fontSize: '11px', textAlign: 'center' }}>
              ✓ RFID detected: {rfidData.tag || rfidData.tag_id}
            </div>
          )}

          <section className="role-selector">
            <div className="role-grid">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`role-button ${activeRole === role.id ? 'role-active' : ''}`}
                  style={activeRole === role.id ? { '--role-color': role.color } : undefined}
                  onClick={() => handleQuickFillRole(role.id)}
                >
                  <span style={{ fontSize: '13px' }}>{role.emoji}</span>
                  <span className="role-label">{role.label}</span>
                </button>
              ))}
            </div>
          </section>

          {(error || rfidError) && <div className="login-error">{error || rfidError}</div>}

          <form onSubmit={handleLogin}>
            <div className="login-input-wrapper" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '13px', top: '15px', opacity: 0.5 }}>👤</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.usernamePlaceholder}
                disabled={loading}
              />
            </div>

            <div className="login-input-wrapper" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '13px', top: '15px', opacity: 0.5 }}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                disabled={loading}
              />
              <button
                type="button"
                style={{ position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <Link to="/forgot-password" size="sm" className="forgot-link">
              {t.forgotPassword}
            </Link>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Logging in...' : t.signIn}
            </button>
          </form>

          <div className="login-footer">
            <span>{t.noAccount}</span> <Link to="/register" style={{ color: '#2563eb', fontWeight: 'bold' }}>{t.signUp}</Link>
          </div>
        </main>
      </div>
    </>
  );
};

const englishTranslations = {
  title: 'Welcome Back',
  subtitle: 'Sign in to access inventory and assets',
  usernamePlaceholder: 'Username or Email',
  passwordPlaceholder: 'Password',
  signIn: 'Sign In',
  forgotPassword: 'Forgot Password?',
  noAccount: "Don't have an account?",
  signUp: 'Sign Up',
};

const amharicTranslations = {
  title: 'እንኳን ደህና መመለሱ',
  subtitle: 'ወደ ስርዓቱ ለመግባት መለያዎን ያስገቡ',
  usernamePlaceholder: 'የተጠቃሚ ስም',
  passwordPlaceholder: 'የይለፍ ቃል',
  signIn: 'ግባ',
  forgotPassword: 'የይለፍ ቃል ረሱ?',
  noAccount: 'መለያ የለዎትም?',
  signUp: 'ይመዝገቡ',
};

export default Login;