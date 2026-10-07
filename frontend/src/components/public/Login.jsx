import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { translateMessage } from '../../i18n/messages';
import { apiBase } from '../../utils/api';
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

const normalizeRoleValue = (role) => {
  if (!role) return '';

  const resolvedRole = Array.isArray(role)
    ? role.find((entry) => entry !== null && entry !== undefined && String(entry).trim())
    : role && typeof role === 'object'
      ? role.role ?? role.name ?? role.value ?? (Array.isArray(role.roles) ? role.roles.find((entry) => entry !== null && entry !== undefined && String(entry).trim()) : '')
      : role;

  const value = String(resolvedRole ?? '').trim().toLowerCase();
  if (!value) return '';

  const normalizedValue = value.replace(/[_-]+/g, ' ');
  const aliases = {
    admin: 'admin',
    administrator: 'admin',
    'ict officer': 'ict_officer',
    'college': 'college_manager',
    'college manager': 'college_manager',
    'department head': 'department_head',
    'department': 'department_head',
    'dept head': 'department_head',
    finance: 'finance',
    'finance officer': 'finance',
    'store manager': 'store_manager',
    maintenance: 'maintenance',
    maint: 'maintenance',
    infrastructure: 'infrastructure',
    'infrastructure director': 'infrastructure',
    'infrastructure directorate': 'infrastructure',
    infra: 'infrastructure',
    staff: 'staff',
    student: 'student',
    user: 'user',
  };

  return aliases[normalizedValue] || normalizedValue.replace(/\s+/g, '_');
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [backendStatus, setBackendStatus] = useState('checking');

  const { login } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect');

  const t = Object.fromEntries(
    Object.entries(loginMessageKeys).map(([key, messageKey]) => [
      key,
      translateMessage(language, `auth.${messageKey}`)
    ])
  );

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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!username.trim()) { setError(t.usernameRequired); return; }
    if (!password) { setError(t.passwordRequired); return; }
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (!result?.success) {
        setError(t.invalidCredentials);
        return;
      }
      const roleRoutes = {
        admin: '/admin',
        ict_officer: '/ict',
        college_manager: '/college',
        department_head: '/department-head',
        finance: '/finance',
        store_manager: '/store',
        maintenance: '/maintenance',
        infrastructure: '/infrastructure',
        staff: '/department',
        student: '/student',
      };
      const role = normalizeRoleValue(result?.user?.role ?? result?.user?.roles ?? result?.user?.roleName ?? result?.user?.userRole);
      const fallbackDestination = roleRoutes[role] || '/home';
      const allowedRedirectPrefixes = {
        admin: '/admin',
        ict_officer: '/ict',
        college_manager: '/college',
        department_head: '/department-head',
        finance: '/finance',
        store_manager: '/store',
        maintenance: '/maintenance',
        infrastructure: '/infrastructure',
        staff: '/department',
        student: '/student',
      };
      const allowedPrefix = allowedRedirectPrefixes[role];
      const isAllowedRedirect = allowedPrefix && redirectParam && (
        redirectParam === allowedPrefix || redirectParam.startsWith(`${allowedPrefix}/`)
      );
      const destination = isAllowedRedirect
        ? redirectParam
        : fallbackDestination;
      navigate(destination, { replace: true });
    } catch (err) {
      setError(t.connectionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page *, .login-page *::before, .login-page *::after {
          animation: none !important;
          animation-duration: 0s !important;
          animation-iteration-count: 1 !important;
          transition: none !important;
          transition-duration: 0.01ms !important;
          transform: none !important;
          scroll-behavior: auto !important;
        }
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 4vw, 42px);
          background: radial-gradient(circle at top left, rgba(0, 87, 184, 0.1), transparent 32%),
            linear-gradient(135deg, rgba(0, 87, 184, 0.04), rgba(248, 250, 252, 0.8) 40%, rgba(221, 234, 247, 0.7));
          color: var(--color-text-primary);
          font-family: Inter, 'Segoe UI', sans-serif;
        }
        .login-panel {
          width: min(100%, 980px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 0;
        }
        .login-card {
          width: min(100%, 440px);
          margin: 0 auto;
          padding: 32px 28px;
          border: 1px solid var(--color-border);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: var(--shadow-lg);
        }
        .login-back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 22px auto 0;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid var(--color-border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          padding: 8px 14px;
        }
        .login-back-link:hover {
          color: var(--color-text-primary);
          background: rgba(0, 87, 184, 0.04);
        }
        .login-back-link:focus-visible {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }
        .login-logo {
          display: block;
          width: 72px;
          height: 72px;
          margin: 0 auto 18px;
          border-radius: 18px;
          object-fit: contain;
          background: linear-gradient(135deg, rgba(0, 87, 184, 0.08), rgba(255, 255, 255, 0.9));
          border: 1px solid var(--color-border);
          box-shadow: 0 10px 24px rgba(7, 31, 61, 0.08);
        }
        .login-heading { margin-bottom: 24px; text-align: center; }
        .login-heading h2 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.2rem); line-height: 1.2; color: var(--color-text-primary); }
        .login-heading p { margin: 8px 0 0; color: var(--color-text-secondary); font-size: 0.95rem; }
        .login-status { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; color: var(--color-text-primary); font-size: 0.78rem; font-weight: 700; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-warning); }
        .status-online { background: var(--color-success); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.12); }
        .status-offline { background: var(--color-danger); box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.12); }
        .login-field { margin-bottom: 18px; }
        .login-field label { display: block; margin-bottom: 8px; color: var(--color-text-primary); font-size: 0.8rem; font-weight: 700; }
        .login-input { position: relative; }
        .login-input svg { position: absolute; left: 14px; top: 14px; color: var(--color-text-secondary); }
        .login-input input {
          width: 100%;
          height: 48px;
          padding: 0 42px 0 42px;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          outline: none;
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.96);
          font-size: 0.95rem;
        }
        .login-input input::placeholder { color: var(--color-text-secondary); }
        .login-input input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(0, 87, 184, 0.12); }
        .password-toggle {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          color: var(--color-text-secondary);
          background: transparent;
          cursor: pointer;
        }
        .password-toggle:hover { background: rgba(0, 87, 184, 0.06); color: var(--color-primary); }
        .login-error {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          margin-bottom: 18px;
          padding: 12px 13px;
          border: 1px solid rgba(220, 38, 38, 0.18);
          border-radius: 10px;
          color: var(--color-danger-text);
          background: rgba(220, 38, 38, 0.05);
          font-size: 0.82rem;
        }
        .forgot-link {
          display: block;
          margin: 4px 0 22px;
          color: var(--color-primary);
          text-align: right;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .forgot-link:hover { text-decoration: underline; }
        .login-submit {
          width: 100%;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 10px;
          color: #FFFFFF;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 700;
          box-shadow: var(--shadow-dashboard-primary);
        }
        .login-submit:hover { filter: brightness(0.98); }
        .login-submit:active { filter: brightness(0.95); }
        .login-submit:disabled { cursor: wait; opacity: 0.7; }
        .login-signup { margin-top: 22px; color: var(--color-text-secondary); text-align: center; font-size: 0.82rem; }
        .login-signup a { color: var(--color-primary); font-weight: 700; text-decoration: none; }
        @media (max-width: 640px) {
          .login-page { padding: 18px 14px; }
          .login-card { padding: 24px 18px; }
        }
      `}</style>
      <main className="login-page">
        <section className="login-panel">
          <main className="login-card">
            <img className="login-logo" src="/assets/mekdela-amba-university-logo.png" alt="Mekdela Amba University logo" />
            <div className="login-heading"><h2>{t.title}</h2><p>{t.subtitle}</p></div>
            <div className="login-status"><span className={`status-dot ${backendStatus === 'online' ? 'status-online' : backendStatus === 'offline' ? 'status-offline' : ''}`} /><Activity size={15} aria-hidden="true" /> {t.systemStatus}: {t[backendStatus]}</div>
            {error && <div className="login-error" role="alert"><ShieldCheck size={17} aria-hidden="true" /> <span>{error}</span></div>}
            <form onSubmit={handleLogin}>
              <div className="login-field"><label htmlFor="login-username">{t.usernameLabel}</label><div className="login-input"><Mail size={18} aria-hidden="true" /><input id="login-username" type="text" name="username" lang="en" dir="ltr" autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.usernamePlaceholder} disabled={loading} /></div></div>
              <div className="login-field"><label htmlFor="login-password">{t.passwordLabel}</label><div className="login-input"><LockKeyhole size={18} aria-hidden="true" /><input id="login-password" name="password" lang="en" dir="ltr" autoCapitalize="none" autoCorrect="off" spellCheck="false" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} disabled={loading} /><button className="password-toggle" type="button" aria-label={showPassword ? t.hidePassword : t.showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></div></div>
              <Link to="/forgot-password" className="forgot-link">{t.forgotPassword}</Link>
              <button type="submit" className="login-submit" disabled={loading}>{loading ? t.signingIn : <><span>{t.signIn}</span><ArrowRight size={17} aria-hidden="true" /></>}</button>
            </form>
            <div className="login-signup"><span>{t.noAccount}</span> <Link to="/register">{t.signUp}</Link></div>
          </main>
          <a href="/home" className="login-back-link" aria-label={t.backToHomepage}>{t.backToHomepage}</a>
        </section>
      </main>
    </>
  );
};

const loginMessageKeys = {
  title: 'welcomeBack',
  subtitle: 'loginSubtitle',
  usernameLabel: 'usernameOrEmail',
  passwordLabel: 'password',
  usernameRequired: 'usernameRequired',
  passwordRequired: 'passwordRequired',
  signingIn: 'signingIn',
  systemStatus: 'system',
  checking: 'checking',
  online: 'online',
  offline: 'offline',
  showPassword: 'showPassword',
  hidePassword: 'hidePassword',
  usernamePlaceholder: 'usernameOrEmail',
  passwordPlaceholder: 'password',
  signIn: 'signIn',
  forgotPassword: 'forgotPassword',
  noAccount: 'noAccount',
  signUp: 'signUp',
  backToHomepage: 'backToHomepage',
  invalidCredentials: 'invalidCredentials',
  connectionError: 'connectionError',
  switchLanguage: 'switchLanguage',
};

export default Login;