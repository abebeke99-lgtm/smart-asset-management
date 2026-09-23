import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { apiBase } from '../../utils/api';
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

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
  const requestedPath = redirectParam || '/';

  const t = language === 'en' ? englishTranslations : amharicTranslations;

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
        department_head: '/department',
        department: '/department',
        finance: '/finance',
        store_manager: '/store',
        maintenance: '/maintenance',
        infrastructure: '/infrastructure',
        staff: '/department',
      };
      const fallbackDestination = roleRoutes[result?.user?.role] || '/dashboard';
      const destination = '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to connect to server.');
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
          padding: 32px 20px;
          background: #EEF2F5;
          color: #17212B;
          font-family: Arial, sans-serif;
        }
        .login-panel {
          width: min(100%, 440px);
          display: flex;
          justify-content: center;
        }
        .login-card {
          width: min(100%, 440px);
          padding: 32px 28px;
          border: 1px solid #D7DEE5;
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 10px 24px rgba(23, 33, 43, 0.06);
        }
        .login-back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #536575;
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid #C8D1D9;
          border-radius: 999px;
          background: #FFFFFF;
          padding: 8px 12px;
        }
        .login-back-link:hover {
          color: #435463;
          background: #F3F6F8;
        }
        .login-back-link:focus-visible {
          outline: 2px solid #536575;
          outline-offset: 2px;
        }
        .login-logo {
          display: block;
          width: 70px;
          height: 70px;
          margin: 0 auto 18px;
          border-radius: 16px;
          object-fit: contain;
          background: #F8FAFC;
          border: 1px solid #D7DEE5;
        }
        .login-heading { margin-bottom: 24px; text-align: center; }
        .login-heading h2 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.2rem); line-height: 1.2; color: #17212B; }
        .login-heading p { margin: 8px 0 0; color: #52606D; font-size: 0.95rem; }
        .login-status { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; color: #334155; font-size: 0.78rem; font-weight: 700; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; }
        .status-online { background: #10B981; box-shadow: 0 0 0 4px rgba(16,185,129,0.12); }
        .status-offline { background: #EF4444; box-shadow: 0 0 0 4px rgba(239,68,68,0.12); }
        .login-field { margin-bottom: 18px; }
        .login-field label { display: block; margin-bottom: 8px; color: #334155; font-size: 0.8rem; font-weight: 700; }
        .login-input { position: relative; }
        .login-input svg { position: absolute; left: 14px; top: 14px; color: #718096; }
        .login-input input {
          width: 100%;
          height: 48px;
          padding: 0 42px 0 42px;
          border: 1px solid #C8D1D9;
          border-radius: 10px;
          outline: none;
          color: #17212B;
          background: #FFFFFF;
          font-size: 0.95rem;
        }
        .login-input input::placeholder { color: #718096; }
        .login-input input:focus { border-color: #536575; }
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
          color: #718096;
          background: transparent;
          cursor: pointer;
        }
        .password-toggle:hover { background: #F3F6F8; color: #536575; }
        .login-error {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          margin-bottom: 18px;
          padding: 12px 13px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          color: #b91c1c;
          background: #fef2f2;
          font-size: 0.82rem;
        }
        .forgot-link {
          display: block;
          margin: 4px 0 22px;
          color: #536575;
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
          background: #536575;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 700;
        }
        .login-submit:hover { background: #435463; }
        .login-submit:active { background: #384754; }
        .login-submit:disabled { cursor: wait; opacity: 0.7; }
        .login-signup { margin-top: 22px; color: #52606D; text-align: center; font-size: 0.82rem; }
        .login-signup a { color: #536575; font-weight: 700; text-decoration: none; }
        @media (max-width: 640px) {
          .login-page { padding: 18px 14px; }
          .login-card { padding: 24px 18px; }
        }
      `}</style>
      <main className="login-page">
        <section className="login-panel">
          <main className="login-card">
            <Link to="/home" className="login-back-link" aria-label={t.backToHomepage}>{t.backToHomepage}</Link>
            <img className="login-logo" src="/assets/mekdela-amba-university-logo.png" alt="Mekdela Amba University logo" />
            <div className="login-heading"><h2>{t.title}</h2><p>Sign in to access the system</p></div>
            <div className="login-status"><span className={`status-dot ${backendStatus === 'online' ? 'status-online' : backendStatus === 'offline' ? 'status-offline' : ''}`} /><Activity size={15} aria-hidden="true" /> System {backendStatus}</div>
            {error && <div className="login-error" role="alert"><ShieldCheck size={17} aria-hidden="true" /> <span>{error}</span></div>}
            <form onSubmit={handleLogin}>
              <div className="login-field"><label htmlFor="login-username">Username or Email</label><div className="login-input"><Mail size={18} aria-hidden="true" /><input id="login-username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.usernamePlaceholder} disabled={loading} /></div></div>
              <div className="login-field"><label htmlFor="login-password">Password</label><div className="login-input"><LockKeyhole size={18} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} disabled={loading} /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></div></div>
              <Link to="/forgot-password" className="forgot-link">{t.forgotPassword}</Link>
              <button type="submit" className="login-submit" disabled={loading}>{loading ? 'Signing in...' : <><span>{t.signIn}</span><ArrowRight size={17} aria-hidden="true" /></>}</button>
            </form>
            <div className="login-signup"><span>{t.noAccount}</span> <Link to="/register">{t.signUp}</Link></div>
          </main>
        </section>
      </main>
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
  backToHomepage: '← Back to Homepage',
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
  backToHomepage: '← ወደ መነሻ ገጽ ተመለስ',
};

export default Login;