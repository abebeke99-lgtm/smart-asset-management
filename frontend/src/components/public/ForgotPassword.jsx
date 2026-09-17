import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle2, LockKeyhole, Send } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = identifier.trim();
    if (method === 'email' && !isValidEmail(trimmed)) {
      setError(t.invalidEmail);
      return;
    }

    if (method === 'phone' && !isValidPhone(trimmed)) {
      setError(t.invalidPhone);
      return;
    }

    setLoading(true);

    try {
      const payload = method === 'email'
        ? { method: 'email', email: trimmed.toLowerCase() }
        : { method: 'phone', phone: normalizePhoneNumber(trimmed) };

      const response = await apiClient.post('/api/auth/forgot-password', payload);

      if (response.data?.success) {
        setSubmitted(true);
        toast.success(method === 'phone' ? t.otpSent : t.successMessage);
      } else {
        throw new Error(response.data?.message || t.errorMessage);
      }
    } catch (err) {
      const message = err.response?.data?.message || t.errorMessage;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const goToRecoveryStep = () => {
    const params = new URLSearchParams();
    params.set('method', method);
    if (method === 'email') {
      params.set('email', identifier.trim().toLowerCase());
    } else {
      params.set('phone', normalizePhoneNumber(identifier) || identifier.trim());
    }
    navigate(`/reset-password?${params.toString()}`);
  };

  return (
    <>
      <style>{`
        .forgot-root { min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; overflow: hidden; font-family: Inter, system-ui, sans-serif; }
        .forgot-light { background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%); }
        .forgot-dark { background: linear-gradient(135deg, #020617 0%, #111827 100%); }
        .orb { position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0; animation: float 15s infinite alternate ease-in-out; }
        .orb-1 { width: 400px; height: 400px; background: rgba(59, 130, 246, 0.15); top: -10%; left: -10%; }
        .orb-2 { width: 500px; height: 500px; background: rgba(139, 92, 246, 0.12); bottom: -10%; right: -10%; }
        @keyframes float { from { transform: translate(0, 0); } to { transform: translate(40px, 40px); } }
        .forgot-card { width: 100%; max-width: 480px; background: ${isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'}; backdrop-filter: blur(16px); border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}; border-radius: 24px; padding: 32px 28px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); z-index: 1; animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .input-field { width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid transparent; background: ${isDark ? '#0f172a' : '#f1f5f9'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; transition: all 0.2s; margin-top: 8px; outline: none; box-sizing: border-box; }
        .input-field:focus { border-color: #0EA5E9; background: ${isDark ? '#020617' : '#fff'}; }
        .method-group { display: flex; gap: 10px; margin: 16px 0 20px; }
        .method-option { flex: 1; border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 12px; background: ${isDark ? '#0f172a' : '#f8fafc'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; padding: 10px 12px; cursor: pointer; font-weight: 600; }
        .method-option.active { border-color: #0EA5E9; background: rgba(14, 165, 233, 0.15); }
        .btn-reset { background: linear-gradient(135deg, #0EA5E9, #2563EB); width: 100%; padding: 14px; border-radius: 12px; border: none; color: white; font-weight: 700; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; margin-top: 20px; }
        .btn-reset:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4); }
        .btn-reset:disabled { opacity: 0.6; cursor: not-allowed; }
        .error-msg { background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 12px; border-radius: 10px; font-size: 13px; margin-top: 15px; border: 1px solid #ef4444; }
        .success-box { text-align: center; }
        .success-icon { font-size: 50px; margin-bottom: 15px; display: block; }
      `}</style>

      <div className={`forgot-root ${isDark ? 'forgot-dark' : 'forgot-light'}`}>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>

        <main className="forgot-card">
          {!submitted ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                <LockKeyhole size={40} color="#0EA5E9" aria-hidden="true" />
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', marginTop: '10px' }}>{t.forgotPassword}</h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>{t.instructions}</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', margin: '0 0 10px 4px' }}>{t.recoveryMethod}</div>
                <div className="method-group">
                  <button type="button" className={`method-option ${method === 'email' ? 'active' : ''}`} onClick={() => setMethod('email')}>{t.email}</button>
                  <button type="button" className={`method-option ${method === 'phone' ? 'active' : ''}`} onClick={() => setMethod('phone')}>{t.phone}</button>
                </div>

                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginLeft: '4px' }}>
                  {method === 'email' ? t.emailLabel.toUpperCase() : t.phoneLabel.toUpperCase()}
                </label>
                <input
                  className="input-field"
                  type={method === 'email' ? 'email' : 'tel'}
                  name={method === 'email' ? 'email' : 'phone'}
                  autoComplete={method === 'email' ? 'email' : 'tel'}
                  aria-label={method === 'email' ? t.emailLabel : t.phoneLabel}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={method === 'email' ? t.emailPlaceholder : t.phonePlaceholder}
                  disabled={loading}
                  required
                />

                {error && <div className="error-msg">{error}</div>}

                <button className="btn-reset" type="submit" disabled={loading}>
                  {loading ? t.sending : <><Send size={16} aria-hidden="true" /> {method === 'email' ? t.resetPassword : t.sendCode}</>}
                </button>
              </form>
            </>
          ) : (
            <div className="success-box">
              <CheckCircle2 className="success-icon" size={50} aria-hidden="true" />
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{method === 'phone' ? t.otpSentTitle : t.emailSent}</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px', lineHeight: '1.6' }}>
                {method === 'phone' ? t.checkPhone : t.checkEmail}
              </p>
              <button type="button" className="btn-reset" style={{ marginTop: '16px' }} onClick={goToRecoveryStep}>
                {method === 'phone' ? t.continueToVerify : t.continueToReset}
              </button>
            </div>
          )}

          <div style={{ marginTop: '25px', textAlign: 'center', borderTop: '1px solid rgba(100,116,139,0.1)', paddingTop: '20px' }}>
            <Link to="/login" style={{ color: '#0284C7', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} aria-hidden="true" /> {t.backToLogin}
            </Link>
          </div>
        </main>
      </div>
    </>
  );
};

const isValidEmail = (value) => {
  if (value.length > 254 || value.includes('..')) return false;
  const [localPart, domain] = value.split('@');
  if (!localPart || !domain || localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.')) return false;
  const domainParts = domain.split('.');
  return domainParts.length >= 2 && domainParts.every((part) => (
    part.length > 0 && part.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)
  ));
};

const normalizePhoneNumber = (value) => {
  const raw = String(value || '').replace(/[\s()\-]/g, '');
  if (/^09\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^\+2519\d{8}$/.test(raw)) return raw;
  return null;
};

const isValidPhone = (value) => Boolean(normalizePhoneNumber(value));

const englishTranslations = {
  forgotPassword: 'Forgot Password?',
  instructions: 'Choose the recovery method and we will send the right reset instructions.',
  recoveryMethod: 'Recovery Method',
  email: 'Email',
  phone: 'Mobile Phone',
  emailLabel: 'Email Address',
  phoneLabel: 'Mobile Phone Number',
  emailPlaceholder: 'name@university.edu',
  phonePlaceholder: '+2519XXXXXXXX',
  resetPassword: 'Send Reset Link',
  sendCode: 'Send Verification Code',
  sending: 'Sending...',
  emailSent: 'Check Your Inbox',
  otpSentTitle: 'Verification Code Sent',
  checkEmail: "We've sent password reset instructions to your email if an eligible account exists.",
  checkPhone: 'We sent a verification code to your mobile phone if an eligible account exists.',
  continueToReset: 'Continue to Reset Password',
  continueToVerify: 'Continue to Verify Code',
  backToLogin: 'Back to Login',
  invalidEmail: 'Please enter a valid email address.',
  invalidPhone: 'Please enter a valid mobile phone number.',
  errorMessage: 'Something went wrong. Please try again later.',
  successMessage: 'Reset link sent successfully.',
  otpSent: 'Verification code sent successfully.'
};

const amharicTranslations = {
  forgotPassword: 'የይለፍ ቃል ረሱ?',
  instructions: 'የመልሶ ማግኛ ዘዴን ይምረጡ እና ተገቢውን መመሪያ እንልክልዎታለን።',
  recoveryMethod: 'የመልሶ ማግኛ ዘዴ',
  email: 'ኢሜይል',
  phone: 'ሞባይል',
  emailLabel: 'የኢሜይል አድራሻ',
  phoneLabel: 'የሞባይል ቁጥር',
  emailPlaceholder: 'name@university.edu',
  phonePlaceholder: '+2519XXXXXXXX',
  resetPassword: 'ሊንክ ላክ',
  sendCode: 'ማረጋገጫ ኮድ ላክ',
  sending: 'በመላክ ላይ...',
  emailSent: 'ኢሜይልዎን ይፈትሹ',
  otpSentTitle: 'ኮድ ተልኳል',
  checkEmail: 'ተገቢ መለያ ካለ የይለፍ ቃል ማስጀመሪያ በኢሜይል ልክ ነው።',
  checkPhone: 'ተገቢ መለያ ካለ የማረጋገጫ ኮድ ወደ ሞባይልዎ ተልኳል።',
  continueToReset: 'ወደ ይለፍ ቃል መቀየሪያ ይቀጥሉ',
  continueToVerify: 'ወደ ኮድ ማረጋገጫ ይቀጥሉ',
  backToLogin: 'ወደ መግቢያ ተመለስ',
  invalidEmail: 'እባክዎ ትክክለኛ ኢሜይል ያስገቡ።',
  invalidPhone: 'እባክዎ ትክክለኛ የሞባይል ቁጥር ያስገቡ።',
  errorMessage: 'ችግር ተፈጥሯል። እባክዎ ቆይተው እንደገና ይሞክሩ።',
  successMessage: 'ሊንኩ በተሳካ ሁኔታ ተልኳል።',
  otpSent: 'የማረጋገጫ ኮድ በተሳካ ሁኔታ ተልኳል።'
};

export default ForgotPassword;