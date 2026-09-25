import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle2, LockKeyhole, Send, ShieldCheck } from 'lucide-react';

const ForgotPassword = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const [method, setMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [step, setStep] = useState('request');
  const [resetToken, setResetToken] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const timer = setTimeout(() => setResendCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleEmailRequest = async () => {
    const trimmed = identifier.trim();
    if (!isValidEmail(trimmed)) {
      setError(t.invalidEmail);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/forgot-password', {
        method: 'email',
        email: trimmed.toLowerCase(),
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || t.errorMessage);
      }

      setSuccessMessage(response.data.message || t.successMessage);
      setStep('email-success');
      toast.success(response.data.message || t.successMessage);
    } catch (err) {
      const status = err.response?.status || err.status;
      const backendMessage = err.response?.data?.message || err.message || '';
      const message = status === 429
        ? t.rateLimitError
        : backendMessage || (status ? t.errorMessage : t.networkError);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneRequest = async (resend = false) => {
    const normalizedPhone = normalizePhoneNumber(identifier);
    if (!normalizedPhone) {
      setError(t.invalidPhone);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/forgot-password/request-otp', {
        phoneNumber: normalizedPhone,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || t.errorMessage);
      }

      setSuccessMessage(response.data.message || t.otpSent);
      setStep('verify');
      setOtp('');
      setResendCountdown(resend ? 60 : 60);
      toast.success(response.data.message || t.otpSent);
    } catch (err) {
      const status = err.response?.status || err.status;
      const backendMessage = err.response?.data?.message || err.message || '';
      const message = status === 429
        ? t.rateLimitError
        : backendMessage || (status ? t.errorMessage : t.networkError);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerification = async (event) => {
    event.preventDefault();
    const normalizedPhone = normalizePhoneNumber(identifier);
    if (!normalizedPhone) {
      setError(t.invalidPhone);
      return;
    }

    const otpCode = otp.trim();
    if (!/^\d{6}$/.test(otpCode)) {
      setError(t.invalidOtp);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/forgot-password/verify-otp', {
        phoneNumber: normalizedPhone,
        otp: otpCode,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || t.otpExpired);
      }

      setResetToken(response.data.resetToken || '');
      setStep('reset');
      setSuccessMessage(response.data.message || t.verifyOtp);
      toast.success(response.data.message || t.verifyOtp);
    } catch (err) {
      const backendMessage = err.response?.data?.message || err.message || '';
      setError(backendMessage || t.otpExpired);
      toast.error(backendMessage || t.otpExpired);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setError('');

    if (!resetToken) {
      setError(t.invalidToken);
      return;
    }

    if (password.length < 8 || password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/api/auth/forgot-password/reset-password', {
        resetToken,
        newPassword: password,
        confirmPassword,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || t.errorMessage);
      }

      setStep('complete');
      setSuccessMessage(response.data.message || t.passwordResetSuccessfully);
      toast.success(response.data.message || t.passwordResetSuccessfully);
    } catch (err) {
      const backendMessage = err.response?.data?.message || err.message || '';
      setError(backendMessage || t.errorMessage);
      toast.error(backendMessage || t.errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (method === 'email') {
      await handleEmailRequest();
      return;
    }
    await handlePhoneRequest(false);
  };

  const renderRequestForm = () => (
    <form onSubmit={handleSubmit}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', margin: '0 0 10px 4px' }}>{t.recoveryMethod}</div>
      <div className="method-group">
        <button type="button" className={`method-option ${method === 'email' ? 'active' : ''}`} onClick={() => setMethod('email')}>{t.email}</button>
        <button type="button" className={`method-option ${method === 'phone' ? 'active' : ''}`} onClick={() => setMethod('phone')}>{t.mobilePhone}</button>
      </div>

      <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginLeft: '4px', display: 'block' }}>
        {method === 'email' ? t.emailAddress.toUpperCase() : t.mobilePhoneNumber.toUpperCase()}
      </label>
      <input
        className="input-field"
        type={method === 'email' ? 'email' : 'tel'}
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
        placeholder={method === 'email' ? t.emailPlaceholder : t.phonePlaceholder}
        autoComplete={method === 'email' ? 'email' : 'tel'}
        disabled={loading}
      />

      {error && <div className="error-box">{error}</div>}

      <button className="btn-reset" type="submit" disabled={loading}>
        {loading ? t.sending : (
          <>
            <Send size={16} aria-hidden="true" /> {method === 'email' ? t.sendResetLink : t.sendOtp}
          </>
        )}
      </button>
    </form>
  );

  const renderOtpForm = () => (
    <form onSubmit={handleOtpVerification}>
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <ShieldCheck size={40} color="#536575" aria-hidden="true" />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', marginTop: '10px' }}>{t.verificationCode}</h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>{t.enterOtp}</p>
      </div>

      <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginLeft: '4px', display: 'block' }}>{t.verificationCode.toUpperCase()}</label>
      <input
        className="input-field"
        type="text"
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        disabled={loading}
      />

      {error && <div className="error-box">{error}</div>}

      <button className="btn-reset" type="submit" disabled={loading}>
        {loading ? t.sending : <><ShieldCheck size={16} aria-hidden="true" /> {t.verifyOtp}</>}
      </button>

      <div style={{ marginTop: '18px', textAlign: 'center' }}>
        <button type="button" className="secondary-btn" disabled={loading || resendCountdown > 0} onClick={() => handlePhoneRequest(true)}>
          {resendCountdown > 0 ? `${t.resendOtp} in ${resendCountdown}s` : t.resendOtp}
        </button>
      </div>
    </form>
  );

  const renderResetForm = () => (
    <form onSubmit={handlePasswordReset}>
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <LockKeyhole size={40} color="#536575" aria-hidden="true" />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', marginTop: '10px' }}>{t.newPassword}</h2>
      </div>

      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginLeft: '4px' }}>{t.newPassword.toUpperCase()}</label>
      <input className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" disabled={loading} />

      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginLeft: '4px', marginTop: '16px' }}>{t.confirmPassword.toUpperCase()}</label>
      <input className="input-field" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" disabled={loading} />

      {error && <div className="error-box">{error}</div>}

      <button className="btn-reset" type="submit" disabled={loading}>
        {loading ? t.sending : <><CheckCircle2 size={16} aria-hidden="true" /> {t.resetPassword}</>}
      </button>
    </form>
  );

  const renderCompleteState = () => (
    <div className="success-box">
      <CheckCircle2 className="success-icon" size={50} aria-hidden="true" />
      <h2 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.passwordResetSuccessfully}</h2>
      <p style={{ color: '#64748b', marginTop: '10px', lineHeight: '1.6' }}>{successMessage}</p>
      <button type="button" className="btn-reset" style={{ marginTop: '16px' }} onClick={() => window.location.href = '/login'}>
        {t.backToLogin}
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        .forgot-root { min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; overflow: hidden; font-family: Inter, system-ui, sans-serif; }
        .forgot-light { background: #EEF2F5; }
        .forgot-dark { background: #2C3C49; }
        .forgot-card { width: 100%; max-width: 480px; background: ${isDark ? '#1E2B34' : '#FFFFFF'}; border: 1px solid #D7DEE5; border-radius: 24px; padding: 32px 28px; box-shadow: 0 20px 40px rgba(23, 33, 43, 0.08); z-index: 1; }
        .method-group { display: flex; gap: 10px; margin: 16px 0 20px; }
        .method-option { flex: 1; border: 1px solid #D7DEE5; border-radius: 12px; background: #F5F7F9; color: #17212B; padding: 10px 12px; cursor: pointer; font-weight: 600; }
        .method-option.active { border-color: #536575; background: #EEF2F5; }
        .input-field { width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid #D7DEE5; background: #F5F7F9; color: #17212B; margin-top: 8px; outline: none; box-sizing: border-box; }
        .input-field:focus { border-color: #536575; background: #FFFFFF; }
        .btn-reset { background: #536575; width: 100%; padding: 14px; border-radius: 12px; border: none; color: white; font-weight: 700; cursor: pointer; margin-top: 20px; }
        .btn-reset:disabled { opacity: 0.6; cursor: not-allowed; }
        .secondary-btn { background: transparent; border: 1px solid #D7DEE5; color: ${isDark ? '#E2E8F0' : '#334155'}; border-radius: 12px; padding: 10px 12px; width: 100%; font-weight: 600; cursor: pointer; }
        .secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-box { background: rgba(239, 68, 68, 0.08); color: #b91c1c; padding: 12px; border-radius: 10px; font-size: 13px; margin-top: 15px; border: 1px solid rgba(185, 28, 28, 0.2); }
        .success-box { text-align: center; }
        .success-icon { font-size: 50px; margin-bottom: 15px; display: block; }
      `}</style>

      <div className={`forgot-root ${isDark ? 'forgot-dark' : 'forgot-light'}`}>
        <main className="forgot-card">
          {step === 'request' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <LockKeyhole size={40} color="#536575" aria-hidden="true" />
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', marginTop: '10px' }}>{t.forgotPassword}</h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>{t.instructions}</p>
              </div>
              {renderRequestForm()}
            </>
          )}

          {step === 'verify' && renderOtpForm()}
          {step === 'reset' && renderResetForm()}
          {step === 'email-success' && (
            <div className="success-box">
              <CheckCircle2 className="success-icon" size={50} aria-hidden="true" />
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.emailSent}</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px', lineHeight: '1.6' }}>{successMessage}</p>
              <button type="button" className="btn-reset" style={{ marginTop: '18px' }} onClick={() => window.location.href = '/login'}>
                {t.backToLogin}
              </button>
            </div>
          )}
          {step === 'complete' && renderCompleteState()}

          {step !== 'complete' && step !== 'email-success' && (
            <div style={{ marginTop: '25px', textAlign: 'center', borderTop: '1px solid rgba(100,116,139,0.1)', paddingTop: '20px' }}>
              <Link to="/login" style={{ color: '#0284C7', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={16} aria-hidden="true" /> {t.backToLogin}
              </Link>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

const isValidEmail = (value) => {
  if (!value || value.length > 254 || value.includes('..')) return false;
  const [localPart, domain] = value.split('@');
  if (!localPart || !domain || localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.')) return false;
  const domainParts = domain.split('.');
  return domainParts.length >= 2 && domainParts.every((part) => (
    part.length > 0 && part.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)
  ));
};

const normalizePhoneNumber = (value) => {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!raw) return null;
  if (/^\+2519\d{8}$/.test(raw)) return raw;
  if (/^2519\d{8}$/.test(raw)) return `+251${raw.slice(3)}`;
  if (/^09\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^9\d{9}$/.test(raw)) return `+251${raw}`;
  return null;
};

const englishTranslations = {
  forgotPassword: 'Forgot Password?',
  instructions: 'Choose the recovery method and we will send the right reset instructions.',
  recoveryMethod: 'Recovery Method',
  email: 'Email',
  mobilePhone: 'Mobile Phone',
  emailAddress: 'Email Address',
  mobilePhoneNumber: 'Mobile Phone Number',
  emailPlaceholder: 'name@university.edu',
  phonePlaceholder: '+251 9XXXXXXXX',
  sendResetLink: 'Send Reset Link',
  sendOtp: 'Send OTP',
  sending: 'Sending...',
  verificationCode: 'Verification Code',
  enterOtp: 'Enter the 6-digit code sent to your phone.',
  verifyOtp: 'Verify OTP',
  resendOtp: 'Resend OTP',
  newPassword: 'Create New Password',
  confirmPassword: 'Confirm New Password',
  resetPassword: 'Reset Password',
  passwordResetSuccessfully: 'Password reset successfully.',
  invalidOtp: 'Please enter a valid 6-digit verification code.',
  otpExpired: 'This verification code has expired or is invalid.',
  invalidEmail: 'Please enter a valid email address.',
  invalidPhone: 'Please enter a valid mobile phone number.',
  errorMessage: 'Something went wrong. Please try again later.',
  networkError: 'Unable to connect to the server.',
  rateLimitError: 'Too many requests. Please try again later.',
  successMessage: 'Reset link sent successfully.',
  otpSent: 'Verification code sent successfully.',
  emailSent: 'Check Your Inbox',
  verifyOtpSuccess: 'Verification successful. Please create a new password.',
  passwordMismatch: 'Passwords do not match. Please try again.',
  invalidToken: 'A valid reset token is required.',
  backToLogin: 'Back to Login',
};

const amharicTranslations = {
  forgotPassword: 'የይለፍ ቃል ረሱ?',
  instructions: 'የመልሶ ማግኛ ዘዴን ይምረጡ እና ተገቢውን መመሪያ እንልክልዎታለን።',
  recoveryMethod: 'የመልሶ ማግኛ ዘዴ',
  email: 'ኢሜይል',
  mobilePhone: 'ሞባይል',
  emailAddress: 'የኢሜይል አድራሻ',
  mobilePhoneNumber: 'የሞባይል ቁጥር',
  emailPlaceholder: 'name@university.edu',
  phonePlaceholder: '+251 9XXXXXXXX',
  sendResetLink: 'ሊንክ ላክ',
  sendOtp: 'ኦቲፒ ላክ',
  sending: 'በመላክ ላይ...',
  verificationCode: 'የማረጋገጫ ኮድ',
  enterOtp: 'ወደ ሞባይልዎ የተላከውን 6-አሃዝ ኮድ ያስገቡ።',
  verifyOtp: 'ኦቲፒ ያረጋግጡ',
  resendOtp: 'ኦቲፒ እንደገና ላክ',
  newPassword: 'አዲስ የይለፍ ቃል ፍጠር',
  confirmPassword: 'የይለፍ ቃል ያረጋግጡ',
  resetPassword: 'የይለፍ ቃል ቀይር',
  passwordResetSuccessfully: 'የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል።',
  invalidOtp: 'እባክዎ ትክክለኛ 6-አሃዝ የሆነ ኮድ ያስገቡ።',
  otpExpired: 'ይህ ኮድ ጊዜው አልፎበታል ወይም ልክ አይደለም።',
  invalidEmail: 'እባክዎ ትክክለኛ ኢሜይል ያስገቡ።',
  invalidPhone: 'እባክዎ ትክክለኛ የሞባይል ቁጥር ያስገቡ።',
  errorMessage: 'ችግር ተፈጥሯል። እባክዎ ቆይተው እንደገና ይሞክሩ።',
  networkError: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም።',
  rateLimitError: 'በጣም ብዙ ጥያቄዎች ተልከዋል። እባክዎ ቆይተው ይሞክሩ።',
  successMessage: 'ሊንኩ በተሳካ ሁኔታ ተልኳል።',
  otpSent: 'የማረጋገጫ ኮድ በተሳካ ሁኔታ ተልኳል።',
  emailSent: 'ኢሜይልዎን ይፈትሹ',
  verifyOtpSuccess: 'ማረጋገጫ ተሳካ። አሁን አዲስ የይለፍ ቃል ይፍጠሩ።',
  passwordMismatch: 'የይለፍ ቃሎቹ አይመሳሰሉም። እባክዎ እንደገና ይሞክሩ።',
  invalidToken: 'ትክክለኛ የይለፍ ቃል ቶክን ያስፈልጋል።',
  backToLogin: 'ወደ መግቢያ ተመለስ',
};

export default ForgotPassword;