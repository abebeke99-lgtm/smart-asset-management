import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
        .login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(420px, .92fr); background: #f8fafc; color: #0f172a; font-family: Georgia, 'Times New Roman', serif; }
        .login-brand { position: relative; display: flex; align-items: center; overflow: hidden; padding: clamp(32px, 7vw, 96px); background: linear-gradient(145deg, #082f49 0%, #0f4c81 54%, #0ea5e9 100%); color: white; }
        .login-brand:before, .login-brand:after { content: ''; position: absolute; border: 1px solid rgba(255,255,255,.18); border-radius: 50%; pointer-events: none; }
        .login-brand:before { width: 560px; height: 560px; right: -260px; top: -140px; }
        .login-brand:after { width: 330px; height: 330px; left: -200px; bottom: -170px; }
        .login-brand-content { position: relative; z-index: 1; max-width: 580px; animation: login-rise .6s ease-out both; }
        .login-logo { display: block; width: 190px; height: 190px; margin-bottom: 24px; border-radius: 24px; object-fit: contain; background: rgba(255,255,255,.98); box-shadow: 0 15px 35px rgba(2, 24, 44, .25); }
        .login-brand h1 { max-width: 550px; margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2.15rem, 4vw, 4rem); line-height: 1.04; letter-spacing: 0; }
        .login-brand p { max-width: 450px; margin: 24px 0 0; color: #dbeafe; font: 500 1.05rem/1.7 Arial, sans-serif; }
        .login-brand-mark { display: inline-flex; align-items: center; gap: 10px; margin-top: 46px; color: #bae6fd; font: 700 .76rem/1 Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
        .login-panel { display: flex; align-items: center; justify-content: center; padding: 28px; background: #f8fafc; }
        .login-card { width: min(100%, 450px); padding: clamp(28px, 4vw, 48px); border: 1px solid #e2e8f0; border-radius: 20px; background: #fff; box-shadow: 0 24px 70px rgba(15,23,42,.12); animation: login-rise .6s .08s ease-out both; }
        .login-heading { margin-bottom: 30px; }
        .login-heading h2 { margin: 0; font: 800 clamp(1.7rem, 3vw, 2.15rem)/1.1 Arial, sans-serif; letter-spacing: 0; }
        .login-heading p { margin: 10px 0 0; color: #64748b; font: 400 .95rem/1.5 Arial, sans-serif; }
        .login-status { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 25px; color: #475569; font: 700 .78rem/1 Arial, sans-serif; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
        .status-online { background: #10b981; box-shadow: 0 0 0 4px #d1fae5; }
        .status-offline { background: #ef4444; box-shadow: 0 0 0 4px #fee2e2; }
        .login-field { margin-bottom: 18px; }
        .login-field label { display: block; margin-bottom: 8px; color: #334155; font: 700 .8rem/1 Arial, sans-serif; }
        .login-input { position: relative; }
        .login-input svg { position: absolute; left: 15px; top: 15px; color: #64748b; }
        .login-input input { width: 100%; height: 50px; padding: 0 44px; border: 1px solid #cbd5e1; border-radius: 11px; outline: none; color: #0f172a; background: #fff; font: 400 .95rem Arial, sans-serif; transition: border-color .2s, box-shadow .2s; }
        .login-input input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 4px rgba(14,165,233,.13); }
        .password-toggle { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 7px; color: #64748b; background: transparent; cursor: pointer; }
        .password-toggle:hover { background: #f1f5f9; color: #2563eb; }
        .login-error { display: flex; gap: 9px; align-items: flex-start; margin-bottom: 18px; padding: 12px 13px; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; background: #fef2f2; font: 500 .82rem/1.45 Arial, sans-serif; }
        .forgot-link { display: block; margin: 4px 0 24px; color: #2563eb; text-align: right; text-decoration: none; font: 700 .82rem Arial, sans-serif; }
        .forgot-link:hover { text-decoration: underline; }
        .login-submit { width: 100%; min-height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 11px; color: white; background: linear-gradient(100deg, #0ea5e9, #2563eb); cursor: pointer; font: 700 .95rem Arial, sans-serif; transition: transform .2s, box-shadow .2s, opacity .2s; }
        .login-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(37,99,235,.24); }
        .login-submit:disabled { cursor: wait; opacity: .7; }
        .login-signup { margin-top: 25px; color: #64748b; text-align: center; font: 400 .82rem Arial, sans-serif; }
        .login-signup a { color: #2563eb; font-weight: 700; text-decoration: none; }
        @keyframes login-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 800px) { .login-page { display: block; } .login-brand { min-height: 320px; padding: 38px 28px; align-items: flex-end; } .login-logo { width: 132px; height: 132px; margin-bottom: 18px; border-radius: 20px; } .login-brand h1 { font-size: 2rem; } .login-brand p { margin-top: 12px; font-size: .9rem; } .login-brand-mark { margin-top: 22px; } .login-panel { min-height: calc(100vh - 320px); padding: 22px 16px 36px; } }
      `}</style>
      <main className="login-page">
        <section className="login-brand" aria-label="Mekdela Amba University">
          <div className="login-brand-content">
            <img className="login-logo" src="/assets/mekdela-amba-university-logo.png" alt="Mekdela Amba University logo" width="190" height="190" />
            <h1>Mekdela Amba University</h1>
            <p>University Asset Management System</p>
            <p>Securely manage university assets, inventory, assignments and operations.</p>
            <div className="login-brand-mark"><ShieldCheck size={16} aria-hidden="true" /> Trusted institutional access</div>
          </div>
        </section>
        <section className="login-panel">
          <main className="login-card">
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