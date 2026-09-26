import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';

const PASSWORD_MIN_LENGTH = 8;

// Errors raised by this screen carry a message that is safe and already localised.
const userFacingError = (message) => Object.assign(new Error(message), { isUserFacing: true });

const resolveErrorMessage = (error, fallback) => {
  if (error?.isUserFacing) return error.message;
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (status === 429) return fallback.rateLimitError;
  if (!status) return fallback.networkError;
  return fallback.error;
};

// Report the first unmet rule so the user knows exactly what to change.
const describePasswordProblem = (value) => {
  if (value.length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (!/[A-Z]/.test(value)) return 'noUppercase';
  if (!/[a-z]/.test(value)) return 'noLowercase';
  if (!/\d/.test(value)) return 'noNumber';
  if (!/[^A-Za-z0-9]/.test(value)) return 'noSpecial';
  return '';
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';

  const initialToken = searchParams.get('token') || routeToken || '';

  const [token] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const t = useMemo(() => (language === 'en' ? translations.en : translations.am), [language]);

  const passwordProblem = (value) => {
    const problem = describePasswordProblem(value);
    return problem ? t.passwordRequirements[problem] : '';
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError(t.invalidToken);
      return;
    }
    const passwordError = passwordProblem(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.mismatch);
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
        setPassword('');
        setConfirmPassword('');
        toast.success(t.success);
      } else {
        throw userFacingError(response.data?.message || t.error);
      }
    } catch (err) {
      const message = resolveErrorMessage(err, t);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const spinner = <LoaderCircle className="spinner" size={17} aria-hidden="true" />;

  if (success) {
    return (
      <div className={`reset-page ${isDark ? 'reset-dark' : 'reset-light'}`}>
        <style>{resetStyles(isDark)}</style>
        <main className="reset-card">
          <img className="reset-logo" src="/assets/mekdela-amba-university-logo.png" alt="" />
          <div className="success-state">
            <CircleCheck className="success-icon" size={46} aria-hidden="true" />
            <h1>{t.successTitle}</h1>
            <p>{t.success}</p>
            <button className="btn-primary" type="button" onClick={() => navigate('/login')}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t.login}</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`reset-page ${isDark ? 'reset-dark' : 'reset-light'}`}>
        <style>{resetStyles(isDark)}</style>
        <main className="reset-card">
          <img className="reset-logo" src="/assets/mekdela-amba-university-logo.png" alt="" />
          <div className="invalid-state">
            <CircleAlert className="invalid-icon" size={44} aria-hidden="true" />
            <h1>{t.invalidLinkTitle}</h1>
            <p>{t.invalidLink}</p>
            <div className="invalid-actions">
              <Link to="/forgot-password" className="btn-primary">{t.requestNewLink}</Link>
              <Link to="/login" className="btn-secondary">{t.login}</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`reset-page ${isDark ? 'reset-dark' : 'reset-light'}`}>
      <style>{resetStyles(isDark)}</style>
      <main className="reset-card">
        <img className="reset-logo" src="/assets/mekdela-amba-university-logo.png" alt="" />
        <div className="reset-heading">
          <LockKeyhole size={32} aria-hidden="true" />
          <h1>{t.title}</h1>
        </div>

        <form onSubmit={submitPasswordReset} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="reset-password">{t.password}</label>
            <div className="field-control">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="reset-password"
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
            <label className="field-label" htmlFor="reset-confirm-password">{t.confirm}</label>
            <div className="field-control">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="reset-confirm-password"
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

          {error && (
            <div className="error-box" role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? <>{spinner} <span>{t.updating}</span></> : <><CircleCheck size={16} aria-hidden="true" /> <span>{t.submit}</span></>}
          </button>
        </form>

        <div className="reset-back">
          <Link to="/login" className="back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{t.backToLogin}</span>
          </Link>
        </div>
      </main>
    </div>
  );
};

const resetStyles = (isDark) => `
  .reset-page, .reset-page *, .reset-page *::before, .reset-page *::after {
    animation: none !important;
    transition: none !important;
  }
  .reset-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    font-family: Arial, sans-serif;
  }
  .reset-page.reset-light { background: #EEF2F5; color: #17212B; }
  .reset-page.reset-dark { background: #2C3C49; color: #F5F7F9; }
  .reset-card {
    width: min(100%, 460px);
    padding: 32px 28px;
    border: 1px solid #D7DEE5;
    border-radius: 18px;
    background: #FFFFFF;
    box-shadow: 0 10px 24px rgba(23, 33, 43, 0.06);
  }
  .reset-page.reset-dark .reset-card { background: #1E2B34; border-color: #3B4C58; }
  .reset-logo {
    display: block;
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 16px;
    object-fit: contain;
    background: #F8FAFC;
    border: 1px solid #D7DEE5;
  }
  .reset-heading { margin-bottom: 22px; text-align: center; color: #536575; }
  .reset-heading h1 { margin: 10px 0 0; font-size: clamp(1.4rem, 4vw, 1.75rem); color: #17212B; }
  .reset-page.reset-dark .reset-heading h1 { color: #F5F7F9; }
  .field { margin-bottom: 16px; }
  .field-label { display: block; margin-bottom: 8px; color: #334155; font-size: 0.8rem; font-weight: 700; }
  .reset-page.reset-dark .field-label { color: #C8D1D9; }
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
  .reset-page.reset-dark .text-input { background: #25333C; border-color: #465866; color: #F5F7F9; }
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
  .field-hint { margin: -4px 0 16px; color: #64748B; font-size: 0.78rem; line-height: 1.5; }
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
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    box-sizing: border-box;
  }
  .btn-primary:hover { background: #435463; }
  .btn-primary:disabled { opacity: 0.7; cursor: wait; }
  .btn-secondary {
    width: 100%;
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    border: 1px solid #D7DEE5;
    border-radius: 10px;
    background: transparent;
    color: #334155;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: inherit;
    text-align: center;
    text-decoration: none;
    box-sizing: border-box;
  }
  .reset-page.reset-dark .btn-secondary { color: #C8D1D9; }
  .spinner { animation: reset-spin 1s linear infinite; }
  @keyframes reset-spin { to { transform: rotate(360deg); } }
  .success-state, .invalid-state { text-align: center; }
  .success-icon, .invalid-icon { margin-bottom: 14px; color: #536575; }
  .invalid-icon { color: #B45309; }
  .success-state h1, .invalid-state h1 { margin: 0; font-size: 1.4rem; color: #17212B; }
  .reset-page.reset-dark .success-state h1,
  .reset-page.reset-dark .invalid-state h1 { color: #F5F7F9; }
  .success-state p, .invalid-state p { margin: 10px 0 20px; color: #64748B; font-size: 0.9rem; line-height: 1.6; }
  .invalid-actions { display: flex; flex-direction: column; gap: 10px; }
  .reset-back { margin-top: 24px; padding-top: 18px; border-top: 1px solid #E2E8F0; text-align: center; }
  .reset-page.reset-dark .reset-back { border-top-color: #3B4C58; }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #536575;
    font-size: 0.86rem;
    font-weight: 700;
    text-decoration: none;
  }
  .back-link:hover { text-decoration: underline; }
  @media (max-width: 640px) {
    .reset-page { padding: 18px 14px; }
    .reset-card { padding: 24px 18px; }
  }
`;

const translations = {
  en: {
    title: 'Create New Password',
    password: 'New password',
    confirm: 'Confirm new password',
    submit: 'Update Password',
    updating: 'Updating...',
    mismatch: 'The passwords do not match.',
    passwordHint: 'Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.',
    passwordRequirements: {
      tooShort: 'Use at least 8 characters for the new password.',
      noUppercase: 'The new password must contain an uppercase letter.',
      noLowercase: 'The new password must contain a lowercase letter.',
      noNumber: 'The new password must contain a number.',
      noSpecial: 'The new password must contain a special character.',
    },
    successTitle: 'Password Reset Successfully',
    success: 'Your password has been reset. You can now sign in with your new password.',
    login: 'Go to Login',
    backToLogin: 'Back to Login',
    error: 'This password reset link is invalid or expired.',
    invalidToken: 'A valid reset token is required.',
    invalidLinkTitle: 'Invalid Reset Link',
    invalidLink: 'This password reset link is missing its secure token. It may have been copied incompletely or already used.',
    requestNewLink: 'Request a New Reset Link',
    networkError: 'Unable to reach the server. Please check your connection and try again.',
    rateLimitError: 'Too many requests. Please wait a moment and try again.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  am: {
    title: 'አዲስ የይለፍ ቃል ይፍጠሩ',
    password: 'አዲስ የይለፍ ቃል',
    confirm: 'የይለፍ ቃልዎን ያረጋግጡ',
    submit: 'የይለፍ ቃል አስተካክል',
    updating: 'በማስተካከል ላይ...',
    mismatch: 'የይለፍ ቃሎቹ አይመሳሰሉም።',
    passwordHint: 'ቢያንስ 8 ቁምፊዎች፣ አቢይ ሆሄ፣ ትንሽ ሆሄ፣ ቁጥር እና ልዩ ምልክት ይጠቀሙ።',
    passwordRequirements: {
      tooShort: 'አዲሱ የይለፍ ቃል ቢያንስ 8 ቁምፊዎች ማለት አለበት።',
      noUppercase: 'አዲሱ የይለፍ ቃል አቢይ ሆሄ ያለ ፊደል ማስገባት አለበት።',
      noLowercase: 'አዲሱ የይለፍ ቃል ትንሽ ሆሄ ያለ ፊደል ማስገባት አለበት።',
      noNumber: 'አዲሱ የይለፍ ቃል ቁጥር ማስገባት አለበት።',
      noSpecial: 'አዲሱ የይለፍ ቃል ልዩ ምልክት ማስገባት አለበት።',
    },
    successTitle: 'የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል',
    success: 'የይለፍ ቃልዎ ተቀይሯል። አሁን በአዲሱ የይለፍ ቃልዎ መግባት ይችላሉ።',
    login: 'ወደ መግቢያ ይሂዱ',
    backToLogin: 'ወደ መግቢያ ተመለስ',
    error: 'ይህ የይለፍ ቃል መቀየሪያ ሊንክ ልክ ያልሆነ ወይም ጊዜው ካለፈበት ነው።',
    invalidToken: 'ትክክለኛ የይለፍ ቃል መቀየሪያ ቶክን ያስፈልጋል።',
    invalidLinkTitle: 'ልክ ያልሆነ ሊንክ',
    invalidLink: 'ይህ የይለፍ ቃል መቀየሪያ ሊንክ ደህንነቱን የሚያስቀምጥ ቶክን የለም። በተሻሻለ የተቀዳየኝ ወይም አስቀድሞ የተጠቀመ ስለሆነ ይሆናል።',
    requestNewLink: 'አዲስ የይለፍ ቃል መቀየሪያ ሊንክ ይጠይቁ',
    networkError: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።',
    rateLimitError: 'በጣም ብዙ ጥያቄዎች ተልከዋል። እባክዎ ቆይተው ይሞክሩ።',
    showPassword: 'የይለፍ ቃል አሳይ',
    hidePassword: 'የይለፍ ቃል ደብቅ',
  },
};

export default ResetPassword;
