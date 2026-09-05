import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    setError('');

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError(t.invalidEmail);
      return;
    }

    setLoading(true);

    try {
      // API call to backend reset password endpoint
      const response = await apiClient.post('/api/auth/forgot-password', { email: normalizedEmail });
      
      if (response.data?.success) {
        setSubmitted(true);
        toast.success(t.successMessage);
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

  return (
    <>
      <style>{`
        .forgot-root {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          font-family: Inter, system-ui, sans-serif;
        }

        .forgot-light { background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%); }
        .forgot-dark { background: linear-gradient(135deg, #020617 0%, #111827 100%); }

        .orb {
          position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0;
          animation: float 15s infinite alternate ease-in-out;
        }
        .orb-1 { width: 400px; height: 400px; background: rgba(59, 130, 246, 0.15); top: -10%; left: -10%; }
        .orb-2 { width: 500px; height: 500px; background: rgba(139, 92, 246, 0.12); bottom: -10%; right: -10%; }
        @keyframes float { from { transform: translate(0, 0); } to { transform: translate(40px, 40px); } }

        .forgot-card {
          width: 100%;
          max-width: 450px;
          background: ${isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'};
          backdrop-filter: blur(16px);
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          z-index: 1;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .input-field {
          width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid transparent;
          background: ${isDark ? '#0f172a' : '#f1f5f9'};
          color: ${isDark ? '#f8fafc' : '#0f172a'};
          transition: all 0.2s; margin-top: 8px; outline: none;
        }
        .input-field:focus { border-color: #3b82f6; background: ${isDark ? '#020617' : '#fff'}; }

        .btn-reset {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          width: 100%; padding: 14px; border-radius: 12px; border: none; color: white;
          font-weight: 700; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
          margin-top: 20px;
        }
        .btn-reset:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4); }
        .btn-reset:disabled { opacity: 0.6; cursor: not-allowed; }

        .error-msg {
          background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 12px;
          border-radius: 10px; font-size: 13px; margin-top: 15px; border: 1px solid #ef4444;
        }

        .success-box { text-align: center; }
        .success-icon { font-size: 50px; margin-bottom: 15px; display: block; }
      `}</style>

      <div className={`forgot-root ${isDark ? 'forgot-dark' : 'forgot-light'}`}>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>

        <main className="forgot-card">
          {!submitted ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <span style={{ fontSize: '40px' }}>🔐</span>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', marginTop: '10px' }}>
                  {t.forgotPassword}
                </h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>
                  {t.instructions}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginLeft: '4px' }}>
                  {t.emailLabel.toUpperCase()}
                </label>
                <input
                  className="input-field"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  disabled={loading}
                  required
                />

                {error && <div className="error-msg">{error}</div>}

                <button className="btn-reset" type="submit" disabled={loading}>
                  {loading ? t.sending : t.resetPassword}
                </button>
              </form>
            </>
          ) : (
            <div className="success-box">
              <span className="success-icon">📧</span>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.emailSent}</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px', lineHeight: '1.6' }}>
                {t.checkEmail}
              </p>
            </div>
          )}

          <div style={{ marginTop: '25px', textAlign: 'center', borderTop: '1px solid rgba(100,116,139,0.1)', paddingTop: '20px' }}>
            <Link to="/login" style={{ color: '#3b82f6', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px' }}>
              ← {t.backToLogin}
            </Link>
          </div>
        </main>
      </div>
    </>
  );
};

const englishTranslations = {
  forgotPassword: 'Forgot Password?',
  instructions: "Enter your email address and we'll send you a link to reset your password.",
  emailLabel: 'Email Address',
  emailPlaceholder: 'name@university.edu',
  resetPassword: 'Send Reset Link',
  sending: 'Sending Link...',
  emailSent: 'Check Your Inbox',
  checkEmail: "We've sent password reset instructions to your email if an account exists.",
  backToLogin: 'Back to Login',
  invalidEmail: 'Please enter a valid email address.',
  errorMessage: 'Something went wrong. Please try again later.',
  successMessage: 'Reset link sent successfully.'
};

const amharicTranslations = {
  forgotPassword: 'የይለፍ ቃል ረሱ?',
  instructions: 'የኢሜል አድራሻዎን ያስገቡ እና የይለፍ ቃልዎን ለመቀየር የሚያስችል ሊንክ እንልክልዎታለን።',
  emailLabel: 'የኢሜል አድራሻ',
  emailPlaceholder: 'ኢሜልዎን እዚህ ያስገቡ',
  resetPassword: 'ሊንኩን ላክ',
  sending: 'በመላክ ላይ...',
  emailSent: 'ኢሜልዎን ይፈትሹ',
  checkEmail: 'መለያ ካለዎት የይለፍ ቃል መቀየሪያ መመሪያ በኢሜልዎ ልከናል።',
  backToLogin: 'ወደ መግቢያ ተመለስ',
  invalidEmail: 'እባክዎ ትክክለኛ የኢሜል አድራሻ ያስገቡ።',
  errorMessage: 'ችግር ተፈጥሯል። እባክዎ ቆይተው እንደገና ይሞክሩ።',
  successMessage: 'ሊንኩ በተሳካ ሁኔታ ተልኳል።'
};

export default ForgotPassword;