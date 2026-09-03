import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { language, theme } = useLanguage();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const isDark = theme === 'dark';
  const t = language === 'en' ? translations.en : translations.am;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Validation
    if (password.length < 8) {
      setError(t.min);
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
        confirmPassword 
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

  return (
    <>
      <style>{`
        .reset-root {
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

        .reset-light { background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%); }
        .reset-dark { background: linear-gradient(135deg, #020617 0%, #111827 100%); }

        .orb {
          position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0;
          animation: float 15s infinite alternate ease-in-out;
        }
        .orb-1 { width: 450px; height: 450px; background: rgba(37, 99, 235, 0.15); top: -10%; left: -10%; }
        .orb-2 { width: 550px; height: 550px; background: rgba(139, 92, 246, 0.12); bottom: -10%; right: -10%; }
        @keyframes float { from { transform: translate(0, 0); } to { transform: translate(50px, 50px); } }

        .reset-card {
          width: 100%;
          max-width: 460px;
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

        .input-group { margin-bottom: 20px; }
        .input-label {
          display: block; font-size: 12px; font-weight: 700; color: #64748b;
          margin-bottom: 8px; margin-left: 4px; text-transform: uppercase;
        }
        .input-field {
          width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid transparent;
          background: ${isDark ? '#0f172a' : '#f1f5f9'};
          color: ${isDark ? '#f8fafc' : '#0f172a'};
          transition: all 0.2s; outline: none;
        }
        .input-field:focus { border-color: #3b82f6; background: ${isDark ? '#020617' : '#fff'}; }

        .btn-submit {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          width: 100%; padding: 15px; border-radius: 12px; border: none; color: white;
          font-weight: 700; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
          margin-top: 10px; font-size: 15px;
        }
        .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .error-box {
          background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 12px;
          border-radius: 10px; font-size: 13px; margin-bottom: 20px; border: 1px solid #ef4444;
          text-align: center; animation: shake 0.4s;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .success-state { text-align: center; }
        .success-icon { 
          font-size: 60px; color: #10b981; margin-bottom: 20px; display: block;
          animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
      `}</style>

      <div className={`reset-root ${isDark ? 'reset-dark' : 'reset-light'}`}>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>

        <main className="reset-card">
          {success ? (
            <div className="success-state">
              <span className="success-icon">CheckCircle</span> {/* Replace with Icon or Emoji */}
              <div style={{ fontSize: '50px', marginBottom: '15px' }}>✅</div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>
                {t.successTitle}
              </h1>
              <p style={{ color: '#64748b', margin: '15px 0 30px', lineHeight: '1.6' }}>
                {t.success}
              </p>
              <button className="btn-submit" onClick={() => navigate('/login')}>
                {t.login}
              </button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '35px' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>
                  {t.title}
                </h1>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="input-group">
                  <label className="input-label">{t.password}</label>
                  <input
                    className="input-field"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">{t.confirm}</label>
                  <input
                    className="input-field"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                {error && <div className="error-box">{error}</div>}

                <button className="btn-submit" type="submit" disabled={loading}>
                  {loading ? '...' : t.submit}
                </button>
              </form>
              
              <div style={{ marginTop: '25px', textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#3b82f6', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px' }}>
                  ← {t.login}
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
};

const translations = {
  en: {
    title: 'Create New Password',
    password: 'New Password',
    confirm: 'Confirm New Password',
    submit: 'Update Password',
    mismatch: 'Passwords do not match.',
    min: 'Password must be at least 8 characters.',
    successTitle: 'Password Updated!',
    success: 'Your password has been reset successfully. You can now log in with your new credentials.',
    login: 'Go to Login',
    error: 'This password reset link is invalid or expired.'
  },
  am: {
    title: 'አዲስ የይለፍ ቃል ይፍጠሩ',
    password: 'አዲስ የይለፍ ቃል',
    confirm: 'የይለፍ ቃልዎን ያረጋግጡ',
    submit: 'የይለፍ ቃል ቀይር',
    mismatch: 'የይለፍ ቃሎቹ መመሳሰል አለባቸው።',
    min: 'የይለፍ ቃሉ ቢያንስ 8 ቁምፊዎች መሆን አለበት።',
    successTitle: 'ተቀይሯል!',
    success: 'የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል። አሁን በአዲሱ የይለፍ ቃልዎ መግባት ይችላሉ።',
    login: 'ወደ መግቢያ ይሂዱ',
    error: 'ይህ ሊንክ ልክ ያልሆነ ወይም ጊዜው ያለፈበት ነው።'
  }
};

export default ResetPassword;