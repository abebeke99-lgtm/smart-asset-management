import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LoaderCircle, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';

const translations = {
  en: {
    title: 'Secure your account',
    subtitle: 'Verify a contact method and replace your temporary password.',
    stepContact: 'Verify contact',
    stepCode: 'Verification code',
    stepPassword: 'New password',
    choose: 'Choose where to receive your verification code',
    send: 'Send Verification Code',
    codeLabel: '6-digit verification code',
    verify: 'Verify code',
    resend: 'Resend code',
    resendIn: 'Resend in',
    continue: 'Continue',
    password: 'New password',
    confirm: 'Confirm new password',
    save: 'Set new password',
    back: 'Back',
    different: 'Your new password must be different from the temporary password.',
    checklist: 'Password requirements',
    min: 'At least 8 characters',
    upper: 'An uppercase letter',
    lower: 'A lowercase letter',
    number: 'A number',
    symbol: 'A symbol',
    missing: 'No verified email or phone is available. Contact your administrator.',
    unexpected: 'Unable to complete first login. Please try again.',
    brand: 'Mekdela Amba University',
    secure: 'Secure account setup',
  },
  am: {
    title: 'መለያዎን ያስጠብቁ',
    subtitle: 'የመገናኛ መንገድዎን ያረጋግጡና ጊዜያዊ የይለፍ ቃልዎን ይቀይሩ።',
    stepContact: 'መገናኛ ያረጋግጡ',
    stepCode: 'የማረጋገጫ ኮድ',
    stepPassword: 'አዲስ የይለፍ ቃል',
    choose: 'የማረጋገጫ ኮዱ የሚላክበትን ይምረጡ',
    send: 'የማረጋገጫ ኮድ ላክ',
    codeLabel: '6 አሃዝ የማረጋገጫ ኮድ',
    verify: 'ኮዱን አረጋግጥ',
    resend: 'ኮዱን እንደገና ላክ',
    resendIn: 'እንደገና ለመላክ',
    continue: 'ቀጥል',
    password: 'አዲስ የይለፍ ቃል',
    confirm: 'አዲሱን የይለፍ ቃል ያረጋግጡ',
    save: 'አዲስ የይለፍ ቃል አስቀምጥ',
    back: 'ተመለስ',
    different: 'አዲሱ የይለፍ ቃል ከጊዜያዊው መለየት አለበት።',
    checklist: 'የይለፍ ቃል መስፈርቶች',
    min: 'ቢያንስ 8 ቁምፊዎች',
    upper: 'ትልቅ ፊደል',
    lower: 'ትንሽ ፊደል',
    number: 'ቁጥር',
    symbol: 'ልዩ ምልክት',
    missing: 'የተረጋገጠ ኢሜይል ወይም ስልክ የለም። አስተዳዳሪዎን ያነጋግሩ።',
    unexpected: 'የመጀመሪያ ግባትን ማጠናቀቅ አልተቻለም። እንደገና ይሞክሩ።',
    brand: 'መቅደላ አምባ ዩኒቨርሲቲ',
    secure: 'የተጠበቀ የመለያ ማዋቀር',
  },
};

const getDashboardPath = (role) => ({
  admin: '/admin',
  ict_officer: '/ict',
  college: '/college',
  college_manager: '/college',
  department_head: '/department-head',
  finance: '/finance',
  store_manager: '/store',
  maintenance: '/maintenance/dashboard',
  maintenance_coordinator: '/maintenance/dashboard',
  infrastructure: '/infrastructure',
  staff: '/department',
  student: '/student',
})[String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')] || '/home';

const FirstLogin = () => {
  const { firstLoginUser, completeFirstLogin } = useAuth();
  const { language, theme } = useLanguage();
  const navigate = useNavigate();
  const t = useMemo(() => translations[language === 'am' ? 'am' : 'en'], [language]);
  const methods = firstLoginUser?.contactMethods || [];
  const [channel, setChannel] = useState(methods[0]?.channel || '');
  const [step, setStep] = useState('contact');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isDark = theme === 'dark';

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => setCountdown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  if (!firstLoginUser) return <Navigate to="/login" replace />;
  if (!methods.length) {
    return (
      <main className="first-login-page" role="alert">
        <section className="first-login-card"><ShieldCheck size={34} /><h1>{t.title}</h1><p>{t.missing}</p></section>
      </main>
    );
  }

  const requestCode = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiClient.post('/api/auth/first-login/send-code', { channel });
      setNotice(response.data?.message || t.send);
      setStep('code');
      setCountdown(60);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t.unexpected);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiClient.post('/api/auth/first-login/verify-code', { channel, code });
      if (!response.data?.success) throw new Error(response.data?.message || t.unexpected);
      setStep('password');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || t.unexpected);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.post('/api/auth/first-login/complete', {
        channel,
        code,
        newPassword: password,
        confirmPassword,
      });
      if (!response.data?.success) throw new Error(response.data?.message || t.unexpected);
      completeFirstLogin(response.data);
      navigate(getDashboardPath(response.data.user?.role || firstLoginUser.role), { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || t.unexpected);
    } finally {
      setBusy(false);
    }
  };

  const requirements = [
    [password.length >= 8, t.min],
    [/[A-Z]/.test(password), t.upper],
    [/[a-z]/.test(password), t.lower],
    [/\d/.test(password), t.number],
    [/[^A-Za-z0-9]/.test(password), t.symbol],
  ];

  return (
    <main className={`first-login-page${isDark ? ' is-dark' : ''}`}>
      <style>{`
        .first-login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 16px;background:#f3f6fa;color:#172033;font-family:Inter,'Segoe UI',sans-serif}
        .first-login-page *{box-sizing:border-box}
        .first-login-card{width:min(100%,480px);padding:clamp(25px,5vw,42px);background:#fff;border:1px solid #dce5ef;border-radius:18px;box-shadow:0 18px 55px rgba(19,52,84,.12)}
        .first-login-brand{display:flex;align-items:center;gap:11px;margin-bottom:28px;color:#245783;font-size:13px;font-weight:700}
        .first-login-brand-mark{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#e8f2fb;color:#3074b3}
        .first-login-card h1{margin:0 0 9px;font-size:clamp(24px,5vw,30px);letter-spacing:-.03em;color:#152a40}
        .first-login-card p{margin:0 0 24px;color:#64748b;line-height:1.55}
        .first-login-steps{display:flex;gap:7px;margin:0 0 25px}
        .first-login-step{flex:1;height:4px;border-radius:8px;background:#e2e8f0}
        .first-login-step.active{background:#3074b3}
        .first-login-label{display:block;margin:0 0 9px;color:#334155;font-size:13px;font-weight:650}
        .first-login-options{display:grid;gap:10px;margin-bottom:18px}
        .first-login-option{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #d5deea;border-radius:11px;background:#fff;color:#27384b;text-align:left;cursor:pointer}
        .first-login-option.selected{border-color:#3074b3;background:#f1f7fc;box-shadow:0 0 0 2px rgba(48,116,179,.12)}
        .first-login-option strong{display:block;font-size:14px}
        .first-login-option small{display:block;margin-top:3px;color:#64748b}
        .first-login-input{width:100%;min-height:46px;padding:11px 13px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-size:15px}
        .first-login-input:focus,.first-login-option:focus-visible,.first-login-button:focus-visible{outline:3px solid rgba(48,116,179,.34);outline-offset:2px;border-color:#3074b3}
        .first-login-code{letter-spacing:.35em;text-align:center;font-size:20px}
        .first-login-button{width:100%;min-height:46px;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:9px;background:#3074b3;color:#fff;font:inherit;font-weight:700;cursor:pointer}
        .first-login-button:hover:not(:disabled){background:#245f96}
        .first-login-button:disabled{opacity:.56;cursor:not-allowed}
        .first-login-secondary{display:block;margin:14px auto 0;border:0;background:none;color:#245f96;font:inherit;font-size:13px;font-weight:650;cursor:pointer}
        .first-login-alert{margin:0 0 14px;padding:11px 12px;border-radius:8px;background:#fff2f0;color:#b42318;font-size:13px;line-height:1.45}
        .first-login-notice{margin:0 0 14px;padding:11px 12px;border-radius:8px;background:#effaf4;color:#176b3a;font-size:13px;line-height:1.45}
        .first-login-password-wrap{position:relative}
        .first-login-password-wrap .first-login-input{padding-right:46px}
        .first-login-eye{position:absolute;right:8px;top:50%;display:grid;place-items:center;width:34px;height:34px;transform:translateY(-50%);border:0;border-radius:6px;background:transparent;color:#64748b;cursor:pointer}
        .first-login-checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin:12px 0 18px;padding:13px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
        .first-login-check{display:flex;align-items:center;gap:6px;color:#64748b;font-size:12px}
        .first-login-check.ok{color:#167647}
        .first-login-back{display:flex;align-items:center;gap:7px;margin:0 0 18px;padding:0;border:0;background:none;color:#526579;font:inherit;font-size:13px;cursor:pointer}
        .first-login-page.is-dark{background:#111827;color:#e5e7eb}
        .is-dark .first-login-card{background:#1f2937;border-color:#374151}
        .is-dark .first-login-card h1,.is-dark .first-login-label{color:#f3f4f6}
        .is-dark .first-login-card p,.is-dark .first-login-option small{color:#9ca3af}
        .is-dark .first-login-option,.is-dark .first-login-input{background:#111827;color:#f3f4f6;border-color:#4b5563}
        .is-dark .first-login-option.selected,.is-dark .first-login-checklist{background:#172b40;border-color:#3074b3}
        .is-dark .first-login-option strong{color:#e5e7eb}
        .is-dark .first-login-check{color:#cbd5e1}
        @media(max-width:420px){.first-login-checklist{grid-template-columns:1fr}.first-login-card{border-radius:14px}}
        @media(prefers-reduced-motion:reduce){.first-login-page *{scroll-behavior:auto!important;transition:none!important}}
      `}</style>
      <section className="first-login-card" aria-labelledby="first-login-title">
        <div className="first-login-brand">
          <span className="first-login-brand-mark"><ShieldCheck size={22} aria-hidden="true" /></span>
          <span>{t.brand}<small style={{ display: 'block', marginTop: 3, color: '#64748b', fontWeight: 500 }}>{t.secure}</small></span>
        </div>
        <h1 id="first-login-title">{t.title}</h1>
        <p>{t.subtitle}</p>
        <div className="first-login-steps" aria-label={`${t.stepContact}, ${t.stepCode}, ${t.stepPassword}`}>
          {['contact', 'code', 'password'].map((name, index) => (
            <span key={name} className={`first-login-step${['contact', 'code', 'password'].indexOf(step) >= index ? ' active' : ''}`} />
          ))}
        </div>
        {error && <div className="first-login-alert" role="alert">{error}</div>}
        {notice && <div className="first-login-notice" role="status">{notice}</div>}

        {step === 'contact' && (
          <>
            <label className="first-login-label">{t.choose}</label>
            <div className="first-login-options">
              {methods.map((method) => (
                <button
                  type="button"
                  key={method.channel}
                  className={`first-login-option${channel === method.channel ? ' selected' : ''}`}
                  aria-pressed={channel === method.channel}
                  onClick={() => { setChannel(method.channel); setError(''); }}
                >
                  {method.channel === 'email' ? <Mail size={20} aria-hidden="true" /> : <Smartphone size={20} aria-hidden="true" />}
                  <span><strong>{method.channel === 'email' ? 'Email' : 'Mobile phone'}</strong><small>{method.masked}</small></span>
                </button>
              ))}
            </div>
            <button type="button" className="first-login-button" disabled={busy || !channel} onClick={requestCode}>
              {busy ? <LoaderCircle size={18} /> : null}{t.send}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <label className="first-login-label" htmlFor="first-login-code">{t.codeLabel}</label>
            <input
              id="first-login-code"
              className="first-login-input first-login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button type="button" className="first-login-button" disabled={busy || code.length !== 6} onClick={verifyCode}>
              {busy ? <LoaderCircle size={18} /> : null}{t.verify}
            </button>
            <button type="button" className="first-login-secondary" disabled={busy || countdown > 0} onClick={requestCode}>
              {countdown > 0 ? `${t.resendIn} ${countdown}s` : t.resend}
            </button>
            <button type="button" className="first-login-back" onClick={() => { setStep('contact'); setError(''); }}><ArrowLeft size={15} />{t.back}</button>
          </>
        )}

        {step === 'password' && (
          <form onSubmit={changePassword}>
            <label className="first-login-label" htmlFor="first-login-password">{t.password}</label>
            <div className="first-login-password-wrap">
              <input id="first-login-password" className="first-login-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="first-login-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <div className="first-login-label" style={{ marginTop: 13 }}>{t.checklist}</div>
            <div className="first-login-checklist" aria-live="polite">
              {requirements.map(([valid, label]) => <span key={label} className={`first-login-check${valid ? ' ok' : ''}`}><CheckCircle2 size={14} />{label}</span>)}
            </div>
            <label className="first-login-label" htmlFor="first-login-confirm">{t.confirm}</label>
            <div className="first-login-password-wrap">
              <input id="first-login-confirm" className="first-login-input" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              <button type="button" className="first-login-eye" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm((visible) => !visible)}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <p style={{ margin: '9px 0 0', fontSize: 12 }}>{t.different}</p>
            <button type="submit" className="first-login-button" disabled={busy || requirements.some(([valid]) => !valid) || !confirmPassword}>
              {busy ? <LoaderCircle size={18} /> : null}{t.save}
            </button>
            <button type="button" className="first-login-back" style={{ marginTop: 15 }} onClick={() => { setStep('code'); setError(''); }}><ArrowLeft size={15} />{t.back}</button>
          </form>
        )}
      </section>
    </main>
  );
};

export default FirstLogin;
