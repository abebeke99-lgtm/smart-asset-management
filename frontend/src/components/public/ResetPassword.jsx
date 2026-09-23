import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle2, LockKeyhole, Save, ShieldCheck } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const initialMethod = searchParams.get('method') || 'email';
  const initialPhone = searchParams.get('phone') || '';
  const initialEmail = searchParams.get('email') || '';
  const initialToken = searchParams.get('token') || '';

  const [method] = useState(initialMethod === 'phone' ? 'phone' : 'email');
  const [phone] = useState(initialPhone);
  const [email] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [otpVerified, setOtpVerified] = useState(Boolean(initialToken));

  const t = language === 'en' ? translations.en : translations.am;

  const validatePassword = (value) => {
    if (value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
      return t.requirements;
    }
    return '';
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    setError('');

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }
    if (!token) {
      setError(t.invalidToken);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });

      if (response.data?.success) {
        setSuccess(true);
        toast.success(t.success);
      } else {
        throw new Error(response.data?.message || t.error);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t.error;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitOtpVerification = async (event) => {
    event.preventDefault();
    setError('');

    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setError(t.invalidOtp);
      return;
    }

    setLoading(true);
    try {
      const payload = method === 'phone'
        ? { method: 'phone', phone: normalizePhoneNumber(phone), otp: code }
        : { method: 'email', email, otp: code };

      const response = await apiClient.post('/api/auth/verify-reset-otp', payload);
      if (response.data?.success) {
        setToken(response.data.token || '');
        setOtpVerified(true);
        setError('');
        toast.success(t.otpSuccess);
      } else {
        throw new Error(response.data?.message || t.otpError);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t.otpError;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`reset-root ${isDark ? 'reset-dark' : 'reset-light'}`}>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <main className="reset-card">
          <div className="success-state">
            <CheckCircle2 className="success-icon" size={60} aria-hidden="true" />
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.successTitle}</h1>
            <p style={{ color: '#64748b', margin: '15px 0 30px', lineHeight: '1.6' }}>{t.success}</p>
            <button className="btn-submit" onClick={() => navigate('/login')}>{t.login}</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .reset-root { min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; overflow: hidden; font-family: Inter, system-ui, sans-serif; }
        .reset-light { background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%); }
        .reset-dark { background: linear-gradient(135deg, #020617 0%, #111827 100%); }
        .reset-card { width: 100%; max-width: 460px; background: ${isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'}; border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}; border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); z-index: 1; }
        .input-group { margin-bottom: 20px; }
        .input-label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; margin-left: 4px; text-transform: uppercase; }
        .input-field { width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid transparent; background: ${isDark ? '#0f172a' : '#f1f5f9'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; outline: none; box-sizing: border-box; }
        .input-field:focus { border-color: #0EA5E9; background: ${isDark ? '#020617' : '#fff'}; }
        .btn-submit { background: linear-gradient(135deg, #0EA5E9, #2563EB); width: 100%; padding: 15px; border-radius: 12px; border: none; color: white; font-weight: 700; cursor: pointer; margin-top: 10px; font-size: 15px; }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .error-box { background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 12px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; border: 1px solid #ef4444; text-align: center; }
        .success-state { text-align: center; }
        .success-icon { font-size: 60px; color: #10b981; margin-bottom: 20px; display: block; }
      `}</style>

      <div className={`reset-root ${isDark ? 'reset-dark' : 'reset-light'}`}>

        <main className="reset-card">
          {!otpVerified && !token ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <ShieldCheck size={40} color="#0EA5E9" aria-hidden="true" />
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.verifyTitle}</h1>
              </div>

              <form onSubmit={submitOtpVerification}>
                <div className="input-group">
                  <label className="input-label">{t.otpLabel}</label>
                  <input
                    className="input-field"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    disabled={loading}
                    autoComplete="one-time-code"
                    aria-label={t.otpLabel}
                  />
                </div>

                {error && <div className="error-box">{error}</div>}

                <button className="btn-submit" type="submit" disabled={loading}>
                  {loading ? '...' : <><ShieldCheck size={16} aria-hidden="true" /> {t.verifyCode}</>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '35px' }}>
                <LockKeyhole size={40} color="#0EA5E9" aria-hidden="true" />
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.title}</h1>
              </div>

              <form onSubmit={submitPasswordReset}>
                <div className="input-group">
                  <label className="input-label">{t.password}</label>
                  <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={loading} autoComplete="new-password" aria-label={t.password} />
                </div>

                <div className="input-group">
                  <label className="input-label">{t.confirm}</label>
                  <input className="input-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" disabled={loading} autoComplete="new-password" aria-label={t.confirm} />
                </div>

                {error && <div className="error-box">{error}</div>}

                <button className="btn-submit" type="submit" disabled={loading}>
                  {loading ? '...' : <><Save size={16} aria-hidden="true" /> {t.submit}</>}
                </button>
              </form>
            </>
          )}

          <div style={{ marginTop: '25px', textAlign: 'center' }}>
            <Link to="/login" style={{ color: '#0284C7', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} aria-hidden="true" /> {t.login}
            </Link>
          </div>
        </main>
      </div>
    </>
  );
};

const normalizePhoneNumber = (value) => {
  const raw = String(value || '').replace(/[\s() -]/g, '');
  if (/^09\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^\+2519\d{8}$/.test(raw)) return raw;
  return null;
};

const translations = {
  en: {
    title: 'Create New Password',
    password: 'New Password',
    confirm: 'Confirm New Password',
    submit: 'Update Password',
    mismatch: 'Passwords do not match.',
    requirements: 'Use at least 8 characters with uppercase, lowercase, number, and special character.',
    successTitle: 'Password Updated!',
    success: 'Your password has been reset successfully. You can now log in with your new credentials.',
    login: 'Go to Login',
    error: 'This password reset link is invalid or expired.',
    invalidToken: 'A valid reset token is required.',
    verifyTitle: 'Verify Recovery Code',
    otpLabel: 'Verification Code',
    verifyCode: 'Verify Code',
    otpSuccess: 'Your verification code is valid. Please create a new password.',
    otpError: 'Unable to verify the recovery code.',
    invalidOtp: 'Please enter a valid 6-digit verification code.'
  },
  am: {
    title: 'አዲስ የይለፍ ቃል ይፍጠሩ',
    password: 'አዲስ የይለፍ ቃል',
    confirm: 'የይለፍ ቃልዎን ያረጋግጡ',
    submit: 'የይለፍ ቃል ቀይር',
    mismatch: 'የይለፍ ቃሎቹ መመሳሰል አለባቸው።',
    requirements: 'ቢያንስ 8 ቁምፊዎች፣ አቢይ ሆሄ፣ ትንሽ ሆሄ፣ ቁጥር እና ልዩ ምልክት ይጠቀሙ።',
    successTitle: 'ተቀይሯል!',
    success: 'የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል። አሁን በአዲሱ የይለፍ ቃልዎ መግባት ይችላሉ።',
    login: 'ወደ መግቢያ ይሂዱ',
    error: 'ይህ ሊንክ ልክ ያልሆነ ወይም ጊዜው ያለፈበት ነው።',
    invalidToken: 'ትክክለኛ የይለፍ ቃል መቀየሪያ ቶክን ያስፈልጋል።',
    verifyTitle: 'የማረጋገጫ ኮድ ያረጋግጡ',
    otpLabel: 'የማረጋገጫ ኮድ',
    verifyCode: 'ኮድ ያረጋግጡ',
    otpSuccess: 'የኮድ ማረጋገጫ ተሳካ። አሁን አዲስ የይለፍ ቃል ይፍጠሩ።',
    otpError: 'የማረጋገጫ ኮድ ማረጋገጫ አልተሳካም።',
    invalidOtp: 'እባክዎ ትክክለኛ 6 አሃዝ የሆነ ማረጋገጫ ኮድ ያስገቡ።'
  }
};

export default ResetPassword;