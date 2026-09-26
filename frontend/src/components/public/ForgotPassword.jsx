import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

const PASSWORD_MIN_LENGTH = 8;
const OTP_RESEND_SECONDS = 60;

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

const describePasswordProblem = (value) => {
  if (value.length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (!/[A-Z]/.test(value)) return 'noUppercase';
  if (!/[a-z]/.test(value)) return 'noLowercase';
  if (!/\d/.test(value)) return 'noNumber';
  if (!/[^A-Za-z0-9]/.test(value)) return 'noSpecial';
  return null;
};

const extractServerMessage = (error, fallback) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (status === 429) return fallback.rateLimitError;
  if (!status) return fallback.networkError;
  return fallback.errorMessage;
};

// Errors raised by this screen carry a message that is safe and already localised.
const userFacingError = (message) => Object.assign(new Error(message), { isUserFacing: true });

const resolveErrorMessage = (error, fallback) => (
  error?.isUserFacing ? error.message : extractServerMessage(error, fallback)
);

const ForgotPassword = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [method, setMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [step, setStep] = useState('request');
  const [resetToken, setResetToken] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const t = useMemo(() => (language === 'en' ? englishTranslations : amharicTranslations), [language]);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const timer = setTimeout(() => setResendCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const runRequest = async (action, work) => {
    setLoading(true);
    setPendingAction(action);
    setError('');
    try {
      await work();
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  const handleEmailRequest = () => runRequest('email', async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(t.emailRequired);
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError(t.invalidEmail);
      return;
    }

    const response = await apiClient.post('/api/auth/forgot-password', {
      method: 'email',
      email: trimmed.toLowerCase(),
    });

    if (!response.data?.success) {
      throw userFacingError(response.data?.message || t.errorMessage);
    }

    setSuccessMessage(response.data.message || t.successMessage);
    setStep('email-sent');
    toast.success(response.data.message || t.successMessage);
  }).catch((err) => {
    const message = resolveErrorMessage(err, t);
    setError(message);
    toast.error(message);
  });

  const handlePhoneRequest = () => runRequest('otp', async () => {
    const normalizedPhone = normalizePhoneNumber(identifier);
    if (!normalizedPhone) {
      setError(t.invalidPhone);
      return;
    }

    const response = await apiClient.post('/api/auth/forgot-password/request-otp', {
      phoneNumber: normalizedPhone,
    });

    if (!response.data?.success) {
      throw userFacingError(response.data?.message || t.errorMessage);
    }

    setSuccessMessage(response.data.message || t.otpSent);
    setOtp('');
    setResendCountdown(OTP_RESEND_SECONDS);
    setStep('verify');
    toast.success(response.data.message || t.otpSent);
  }).catch((err) => {
    const message = resolveErrorMessage(err, t);
    setError(message);
    toast.error(message);
  });

  const handleOtpVerification = (event) => {
    event.preventDefault();
    runRequest('verify', async () => {
      const normalizedPhone = normalizePhoneNumber(identifier);
      if (!normalizedPhone) {
        setError(t.invalidPhone);
        return;
      }
      if (!/^\d{6}$/.test(otp.trim())) {
        setError(t.invalidOtp);
        return;
      }

      const response = await apiClient.post('/api/auth/forgot-password/verify-otp', {
        phoneNumber: normalizedPhone,
        otp: otp.trim(),
      });

      if (!response.data?.success || !response.data.resetToken) {
        throw userFacingError(response.data?.message || t.otpExpired);
      }

      setResetToken(response.data.resetToken);
      setSuccessMessage(response.data.message || t.verifyOtpSuccess);
      setStep('reset');
      setError('');
      toast.success(response.data.message || t.verifyOtpSuccess);
    }).catch((err) => {
      const message = resolveErrorMessage(err, t);
      setError(message);
      toast.error(message);
    });
  };

  const handlePasswordReset = (event) => {
    event.preventDefault();
    runRequest('reset', async () => {
      if (!resetToken) {
        setError(t.invalidToken);
        return;
      }
      const passwordProblem = describePasswordProblem(password);
      if (passwordProblem) {
        setError(t.passwordRequirements[passwordProblem]);
        return;
      }
      if (password !== confirmPassword) {
        setError(t.passwordMismatch);
        return;
      }

      const response = await apiClient.post('/api/auth/forgot-password/reset-password', {
        resetToken,
        newPassword: password,
        confirmPassword,
      });

      if (!response.data?.success) {
        throw userFacingError(response.data?.message || t.errorMessage);
      }

      setSuccessMessage(response.data.message || t.passwordResetSuccessfully);
      setStep('complete');
      setError('');
      toast.success(response.data.message || t.passwordResetSuccessfully);
    }).catch((err) => {
      const message = resolveErrorMessage(err, t);
      setError(message);
      toast.error(message);
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (method === 'email') {
      handleEmailRequest();
      return;
    }
    handlePhoneRequest();
  };

  const isEmailMethod = method === 'email';
  const goToLogin = () => navigate('/login');
  const spinner = <LoaderCircle className="spinner" size={17} aria-hidden="true" />;

  const renderError = () => (error ? (
    <div className="error-box" id="forgot-error" role="alert">
      <CircleAlert size={17} aria-hidden="true" />
      <span>{error}</span>
    </div>
  ) : null);

  const renderRequestForm = () => (
    <form onSubmit={handleSubmit} noValidate>
      <div className="method-group" role="group" aria-label={t.recoveryMethod}>
        <button
          type="button"
          className={`method-option ${isEmailMethod ? 'active' : ''}`}
          aria-pressed={isEmailMethod}
          onClick={() => { setMethod('email'); setError(''); }}
        >
          <Mail size={16} aria-hidden="true" />
          <span>{t.email}</span>
        </button>
        <button
          type="button"
          className={`method-option ${!isEmailMethod ? 'active' : ''}`}
          aria-pressed={!isEmailMethod}
          onClick={() => { setMethod('phone'); setError(''); }}
        >
          <Smartphone size={16} aria-hidden="true" />
          <span>{t.mobilePhone}</span>
        </button>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="forgot-identifier">
          {isEmailMethod ? t.emailAddress : t.mobilePhoneNumber}
        </label>
        <div className="field-control">
          {isEmailMethod
            ? <Mail size={17} aria-hidden="true" />
            : <Smartphone size={17} aria-hidden="true" />}
          <input
            id="forgot-identifier"
            className="text-input"
            type={isEmailMethod ? 'email' : 'tel'}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={isEmailMethod ? t.emailPlaceholder : t.phonePlaceholder}
            autoComplete={isEmailMethod ? 'email' : 'tel'}
            inputMode={isEmailMethod ? 'email' : 'tel'}
            disabled={loading}
            aria-describedby={error ? 'forgot-error' : undefined}
          />
        </div>
      </div>

      {renderError()}

      <button className="btn-primary" type="submit" disabled={loading}>
        {pendingAction === 'email' || pendingAction === 'otp' ? (
          <>{spinner} <span>{t.sending}</span></>
        ) : (
          <><Send size={16} aria-hidden="true" /> <span>{isEmailMethod ? t.sendResetLink : t.sendOtp}</span></>
        )}
      </button>
    </form>
  );

  const renderOtpForm = () => (
    <form onSubmit={handleOtpVerification} noValidate>
      <div className="step-heading">
        <ShieldCheck size={34} aria-hidden="true" />
        <h2>{t.verificationCode}</h2>
        <p>{t.enterOtp}</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="forgot-otp">{t.verificationCode}</label>
        <div className="field-control">
          <KeyRound size={17} aria-hidden="true" />
          <input
            id="forgot-otp"
            className="text-input"
            type="text"
            value={otp}
            onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={loading}
            aria-describedby={error ? 'forgot-error' : undefined}
          />
        </div>
      </div>

      {renderError()}

      <button className="btn-primary" type="submit" disabled={loading}>
        {pendingAction === 'verify' ? <>{spinner} <span>{t.verifying}</span></> : <><ShieldCheck size={16} aria-hidden="true" /> <span>{t.verifyOtp}</span></>}
      </button>

      <button
        type="button"
        className="btn-secondary"
        disabled={loading || resendCountdown > 0}
        onClick={() => handlePhoneRequest()}
      >
        {resendCountdown > 0 ? `${t.resendOtp} (${resendCountdown}s)` : t.resendOtp}
      </button>
    </form>
  );

  const renderResetForm = () => (
    <form onSubmit={handlePasswordReset} noValidate>
      <div className="step-heading">
        <LockKeyhole size={34} aria-hidden="true" />
        <h2>{t.newPassword}</h2>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="forgot-new-password">{t.newPasswordLabel}</label>
        <div className="field-control">
          <LockKeyhole size={17} aria-hidden="true" />
          <input
            id="forgot-new-password"
            className="text-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => { setPassword(event.target.value); setError(''); }}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? t.hidePassword : t.showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="forgot-confirm-password">{t.confirmPassword}</label>
        <div className="field-control">
          <LockKeyhole size={17} aria-hidden="true" />
          <input
            id="forgot-confirm-password"
            className="text-input"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
      </div>

      <p className="field-hint">{t.passwordHint}</p>

      {renderError()}

      <button className="btn-primary" type="submit" disabled={loading}>
        {pendingAction === 'reset' ? <>{spinner} <span>{t.updating}</span></> : <><CircleCheck size={16} aria-hidden="true" /> <span>{t.resetPassword}</span></>}
      </button>
    </form>
  );

  const renderTerminalState = ({ title, message, showNewLink }) => (
    <div className="success-state">
      <CircleCheck className="success-icon" size={46} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message || successMessage}</p>
      <button type="button" className="btn-primary" onClick={goToLogin}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{t.backToLogin}</span>
      </button>
      {showNewLink && (
        <button
          type="button"
          className="btn-link"
          onClick={() => { setStep('request'); setSuccessMessage(''); setError(''); }}
        >
          {t.sendAnotherLink}
        </button>
      )}
    </div>
  );

  const isTerminalStep = step === 'email-sent' || step === 'complete';

  return (
    <>
      <style>{`
        .forgot-page, .forgot-page *, .forgot-page *::before, .forgot-page *::after {
          animation: none !important;
          transition: none !important;
        }
        .forgot-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          font-family: Arial, sans-serif;
        }
        .forgot-page.forgot-light { background: #EEF2F5; color: #17212B; }
        .forgot-page.forgot-dark { background: #2C3C49; color: #F5F7F9; }
        .forgot-card {
          width: min(100%, 460px);
          padding: 32px 28px;
          border: 1px solid #D7DEE5;
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 10px 24px rgba(23, 33, 43, 0.06);
        }
        .forgot-page.forgot-dark .forgot-card {
          background: #1E2B34;
          border-color: #3B4C58;
        }
        .forgot-logo {
          display: block;
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 16px;
          object-fit: contain;
          background: #F8FAFC;
          border: 1px solid #D7DEE5;
        }
        .forgot-heading { margin: 0 0 22px; text-align: center; }
        .forgot-heading h1 { margin: 0; font-size: clamp(1.5rem, 4vw, 1.9rem); line-height: 1.2; color: #17212B; }
        .forgot-page.forgot-dark .forgot-heading h1 { color: #F5F7F9; }
        .forgot-heading p { margin: 8px 0 0; color: #64748B; font-size: 0.92rem; line-height: 1.5; }
        .method-group { display: flex; gap: 10px; margin: 0 0 20px; }
        .method-option {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #D7DEE5;
          border-radius: 10px;
          background: #F5F7F9;
          color: #334155;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
        }
        .method-option.active { border-color: #536575; background: #EEF2F5; color: #17212B; }
        .method-option:disabled { opacity: 0.6; cursor: not-allowed; }
        .field { margin-bottom: 16px; }
        .field-label { display: block; margin-bottom: 8px; color: #334155; font-size: 0.8rem; font-weight: 700; }
        .forgot-page.forgot-dark .field-label { color: #C8D1D9; }
        .field-control { position: relative; display: flex; align-items: center; }
        .field-control > svg { position: absolute; left: 14px; color: #718096; pointer-events: none; }
        .text-input {
          width: 100%;
          height: 48px;
          padding: 0 14px 0 42px;
          border: 1px solid #C8D1D9;
          border-radius: 10px;
          outline: none;
          background: #FFFFFF;
          color: #17212B;
          font-size: 0.95rem;
          font-family: inherit;
          box-sizing: border-box;
        }
        .forgot-page.forgot-dark .text-input { background: #25333C; border-color: #465866; color: #F5F7F9; }
        .text-input::placeholder { color: #94A3B8; }
        .text-input:focus { border-color: #536575; box-shadow: 0 0 0 3px rgba(83, 101, 117, 0.15); }
        .text-input:disabled { opacity: 0.7; cursor: not-allowed; }
        .password-toggle {
          position: absolute;
          right: 8px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #718096;
          cursor: pointer;
        }
        .password-toggle:hover { background: #F5F7F9; color: #536575; }
        .field-hint { margin: -6px 0 16px; color: #64748B; font-size: 0.78rem; line-height: 1.5; }
        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-bottom: 16px;
          padding: 12px 13px;
          border: 1px solid #FECACA;
          border-radius: 10px;
          background: #FEF2F2;
          color: #B91C1C;
          font-size: 0.82rem;
        }
        .error-box > svg { flex: 0 0 auto; margin-top: 1px; }
        .btn-primary {
          width: 100%;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border: 0;
          border-radius: 10px;
          background: #536575;
          color: #FFFFFF;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
        }
        .btn-primary:hover { background: #435463; }
        .btn-primary:disabled { opacity: 0.7; cursor: wait; }
        .btn-secondary {
          width: 100%;
          min-height: 44px;
          margin-top: 12px;
          padding: 11px 12px;
          border: 1px solid #D7DEE5;
          border-radius: 10px;
          background: transparent;
          color: #334155;
          font-size: 0.86rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
        }
        .forgot-page.forgot-dark .btn-secondary { color: #C8D1D9; }
        .btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-link {
          display: block;
          margin: 14px auto 0;
          border: 0;
          background: transparent;
          color: #536575;
          font-size: 0.84rem;
          font-weight: 700;
          font-family: inherit;
          text-decoration: underline;
          cursor: pointer;
        }
        .spinner { animation: forgot-spin 1s linear infinite; }
        @keyframes forgot-spin { to { transform: rotate(360deg); } }
        .step-heading { margin-bottom: 20px; text-align: center; color: #536575; }
        .step-heading h2 { margin: 10px 0 0; font-size: 1.35rem; color: #17212B; }
        .forgot-page.forgot-dark .step-heading h2 { color: #F5F7F9; }
        .step-heading p { margin: 8px 0 0; color: #64748B; font-size: 0.88rem; line-height: 1.5; }
        .success-state { text-align: center; }
        .success-icon { margin-bottom: 14px; color: #536575; }
        .success-state h2 { margin: 0; font-size: 1.4rem; color: #17212B; }
        .forgot-page.forgot-dark .success-state h2 { color: #F5F7F9; }
        .success-state p { margin: 10px 0 20px; color: #64748B; font-size: 0.9rem; line-height: 1.6; }
        .forgot-back { margin-top: 24px; padding-top: 18px; border-top: 1px solid #E2E8F0; text-align: center; }
        .forgot-page.forgot-dark .forgot-back { border-top-color: #3B4C58; }
        .forgot-back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #536575;
          font-size: 0.86rem;
          font-weight: 700;
          text-decoration: none;
        }
        .forgot-back-link:hover { text-decoration: underline; }
        @media (max-width: 640px) {
          .forgot-page { padding: 18px 14px; }
          .forgot-card { padding: 24px 18px; }
          .method-group { flex-direction: column; }
        }
      `}</style>

      <main className={`forgot-page ${isDark ? 'forgot-dark' : 'forgot-light'}`}>
        <section className="forgot-card">
          {step === 'request' && (
            <>
              <img className="forgot-logo" src="/assets/mekdela-amba-university-logo.png" alt="" />
              <div className="forgot-heading">
                <h1>{t.forgotPassword}</h1>
                <p>{t.instructions}</p>
              </div>
              {renderRequestForm()}
            </>
          )}

          {step === 'verify' && renderOtpForm()}
          {step === 'reset' && renderResetForm()}
          {step === 'email-sent' && renderTerminalState({ title: t.checkYourEmail, message: '', showNewLink: true })}
          {step === 'complete' && renderTerminalState({ title: t.passwordResetTitle, message: '', showNewLink: false })}

          {!isTerminalStep && (
            <div className="forgot-back">
              <Link to="/login" className="forgot-back-link">
                <ArrowLeft size={16} aria-hidden="true" />
                <span>{t.backToLogin}</span>
              </Link>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

const englishTranslations = {
  forgotPassword: 'Forgot Password?',
  instructions: 'Choose how you want to recover access and we will send the right instructions.',
  recoveryMethod: 'Recovery method',
  email: 'Email',
  mobilePhone: 'Mobile Phone',
  emailAddress: 'Email address',
  mobilePhoneNumber: 'Mobile phone number',
  emailPlaceholder: 'name@university.edu',
  phonePlaceholder: '+251 9XXXXXXXX',
  sendResetLink: 'Send Reset Link',
  sendOtp: 'Send Verification Code',
  sending: 'Sending...',
  verifying: 'Verifying...',
  updating: 'Updating...',
  verificationCode: 'Verification Code',
  enterOtp: 'Enter the 6-digit code we sent to your phone. It expires shortly.',
  verifyOtp: 'Verify Code',
  resendOtp: 'Resend code',
  newPassword: 'Create New Password',
  newPasswordLabel: 'New password',
  confirmPassword: 'Confirm New Password',
  resetPassword: 'Update Password',
  passwordHint: 'Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.',
  passwordResetTitle: 'Password Reset Successfully',
  passwordResetSuccessfully: 'Your password has been reset. You can now sign in with your new password.',
  invalidOtp: 'Please enter a valid 6-digit verification code.',
  otpExpired: 'This verification code has expired or is invalid. Please request a new one.',
  invalidEmail: 'Please enter a valid email address.',
  emailRequired: 'Please enter your email address.',
  invalidPhone: 'Please enter a valid Ethiopian mobile number, for example 0912345678.',
  errorMessage: 'Something went wrong. Please try again later.',
  networkError: 'Unable to reach the server. Please check your connection and try again.',
  rateLimitError: 'Too many requests. Please wait a moment and try again.',
  successMessage: 'Password reset instructions will be sent if the account matches.',
  otpSent: 'If this phone number is registered, a verification code has been sent.',
  checkYourEmail: 'Check Your Email',
  verifyOtpSuccess: 'Verification successful. Please create a new password.',
  passwordMismatch: 'The passwords do not match. Please try again.',
  invalidToken: 'A valid reset token is required.',
  sendAnotherLink: 'Send to a different email address',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  backToLogin: 'Back to Login',
  passwordRequirements: {
    tooShort: 'Use at least 8 characters for the new password.',
    noUppercase: 'The new password must contain an uppercase letter.',
    noLowercase: 'The new password must contain a lowercase letter.',
    noNumber: 'The new password must contain a number.',
    noSpecial: 'The new password must contain a special character.',
  },
};

const amharicTranslations = {
  forgotPassword: 'የይለፍ ቃል ረሱ?',
  instructions: 'መግቢያዎን እንደምትን ማግኘት ያለውን ዘዴ ይምረጡ፤ ትክክለኛውን መመሪያ እንልክልዎታለን።',
  recoveryMethod: 'የመልሶ ማግኛ ዘዴ',
  email: 'ኢሜይል',
  mobilePhone: 'ሞባይል',
  emailAddress: 'የኢሜይል አድራሻ',
  mobilePhoneNumber: 'የሞባይል ቁጥር',
  emailPlaceholder: 'name@university.edu',
  phonePlaceholder: '+251 9XXXXXXXX',
  sendResetLink: 'የይለፍ ቃል መልሶ ማግኛ ሊንክ ላክ',
  sendOtp: 'የማረጋገጫ ኮድ ላክ',
  sending: 'በመላክ ላይ...',
  verifying: 'በማረጋገጫ ላይ...',
  updating: 'በማስተካከል ላይ...',
  verificationCode: 'የማረጋገጫ ኮድ',
  enterOtp: 'ወደ ሞባይልዎ የተላከውን 6-አሃዝ ኮድ ያስገቡ። ኮዱ በቅርብ ጊዜ ያልበል።',
  verifyOtp: 'ኮድ ያረጋግጡ',
  resendOtp: 'ኮድ እንደገና ላክ',
  newPassword: 'አዲስ የይለፍ ቃል ፍጠር',
  newPasswordLabel: 'አዲስ የይለፍ ቃል',
  confirmPassword: 'የይለፍ ቃል ያረጋግጡ',
  resetPassword: 'የይለፍ ቃል አስተካክል',
  passwordHint: 'ቢያንስ 8 ቁምፊዎች፣ አቢይ ሆሄ፣ ትንሽ ሆሄ፣ ቁጥር እና ልዩ ምልክት ይጠቀሙ።',
  passwordResetTitle: 'የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል',
  passwordResetSuccessfully: 'የይለፍ ቃልዎ ተቀይሯል። አሁን በአዲሱ የይለፍ ቃልዎ መግባት ይችላሉ።',
  invalidOtp: 'እባክዎ ትክክለኛ 6-አሃዝ የሆነ ኮድ ያስገቡ።',
  otpExpired: 'ይህ ኮድ ጊዜው አልፎበታል ወይም ልክ አይደለም። አዲስ ኮድ ይጠይቁ።',
  invalidEmail: 'እባክዎ ትክክለኛ ኢሜይል አድራሻ ያስገቡ።',
  emailRequired: 'እባክዎ የኢሜይል አድራሻዎን ያስገቡ።',
  invalidPhone: 'እባክዎ ትክክለኛ የኢትዮጵያ ሞባይል ቁጥር ያስገቡ፤ ለምሳሌ 0912345678።',
  errorMessage: 'ችግር ተከስቷል። እባክዎ ቆይተው እንደገና ይሞክሩ።',
  networkError: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።',
  rateLimitError: 'በጣም ብዙ ጥያቄዎች ተልከዋል። እባክዎ ቆይተው ይሞክሩ።',
  successMessage: 'መለያው ከመለያው ጋር ከሚዛመድ ከሆነ የይለፍ ቃል መልሶ ማግኛ መመሪያዎች ይላካሉ።',
  otpSent: 'ይህ የሞባይል ቁጥር ከተመዘገበ ከሆነ የማረጋገጫ ኮድ ተልኳል።',
  checkYourEmail: 'ኢሜይልዎን ይፈትሹ',
  verifyOtpSuccess: 'ማረጋገጫ ተሳክቷል። አሁን አዲስ የይለፍ ቃል ይፍጠሩ።',
  passwordMismatch: 'የይለፍ ቃሎቹ አይመሳሰሉም። እባክዎ እንደገና ይሞክሩ።',
  invalidToken: 'ትክክለኛ የይለፍ ቃል መቀየሪያ ቶክን ያስፈልጋል።',
  sendAnotherLink: 'ወደ ሌላ ኢሜይል አድራሻ ላክ',
  showPassword: 'የይለፍ ቃል አሳይ',
  hidePassword: 'የይለፍ ቃል ደብቅ',
  backToLogin: 'ወደ መግቢያ ተመለስ',
  passwordRequirements: {
    tooShort: 'አዲሱ የይለፍ ቃል ቢያንስ 8 ቁምፊዎች ማለት አለበት።',
    noUppercase: 'አዲሱ የይለፍ ቃል አቢይ ሆሄ ያለ ፊደል ማስገባት አለበት።',
    noLowercase: 'አዲሱ የይለፍ ቃል ትንሽ ሆሄ ያለ ፊደል ማስገባት አለበት።',
    noNumber: 'አዲሱ የይለፍ ቃል ቁጥር ማስገባት አለበት።',
    noSpecial: 'አዲሱ የይለፍ ቃል ልዩ ምልክት ማስገባት አለበት።',
  },
};

export default ForgotPassword;
