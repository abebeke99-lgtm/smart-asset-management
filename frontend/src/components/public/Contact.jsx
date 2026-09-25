import React, { useState } from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { MessageCircle, Send } from 'lucide-react';

const initialForm = { name: '', email: '', subject: '', message: '' };

const Contact = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');

  const t = language === 'en' ? {
    pageTitle: 'Contact the University Asset Management Team', pageSubtitle: 'Have a question about university assets, records, assignments, transfers, maintenance, or the asset management system? Send us a message and the appropriate team can review your request.',
    information: 'Contact Information', informationText: 'Official contact information is not currently configured.',
    formTitle: 'Send a message', submissionUnavailable: 'Public message submission is not currently available. Please try again after the university enables this service.',
    name: 'Name', email: 'Email', subject: 'Subject', message: 'Message',
    nameRequired: 'Enter your name.', emailRequired: 'Enter a valid email address.', subjectRequired: 'Enter a subject.', messageRequired: 'Enter a message.',
    validationSummary: 'Please correct the highlighted fields before sending.',
    send: 'Send message', submitting: 'Submitting...', success: 'Your message was sent successfully.',
    serverError: 'Message delivery is not available right now. Please try again later.', networkError: 'A network error prevented delivery. Please try again.'
  } : {
    pageTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ቡድንን ያግኙ', pageSubtitle: 'ስለ ዩኒቨርሲቲ ንብረቶች፣ መዝገቦች፣ ምደባዎች፣ ዝውውሮች፣ ጥገና ወይም የንብረት አስተዳደር ስርዓቱ ጥያቄ ካለዎት መልዕክት ይላኩ። ተገቢው ቡድን ጥያቄዎን ሊመለከተው ይችላል።',
    information: 'የግንኙነት መረጃ', informationText: 'ይፋዊ የግንኙነት መረጃ በአሁኑ ጊዜ አልተዋቀረም።',
    formTitle: 'መልዕክት ይላኩ', submissionUnavailable: 'የህዝብ መልዕክት መላኪያ በአሁኑ ጊዜ አይገኝም። ዩኒቨርሲቲው ይህን አገልግሎት ካነቃ በኋላ እንደገና ይሞክሩ።',
    name: 'ስም', email: 'ኢሜይል', subject: 'ርዕስ', message: 'መልዕክት',
    nameRequired: 'ስምዎን ያስገቡ።', emailRequired: 'ትክክለኛ የኢሜይል አድራሻ ያስገቡ።', subjectRequired: 'ርዕስ ያስገቡ።', messageRequired: 'መልዕክት ያስገቡ።',
    validationSummary: 'ከመላክዎ በፊት የተጠቆሙትን መስኮች ያስተካክሉ።',
    send: 'መልዕክት ላክ', submitting: 'በመላክ ላይ...', success: 'መልዕክትዎ በተሳካ ሁኔታ ተልኳል።',
    serverError: 'የመልዕክት ማድረስ አሁን አይገኝም። በኋላ እንደገና ይሞክሩ።', networkError: 'የኔትወርክ ስህተት መልዕክቱን እንዳይደርስ አድርጓል። እንደገና ይሞክሩ።'
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = t.nameRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) nextErrors.email = t.emailRequired;
    if (!formData.subject.trim()) nextErrors.subject = t.subjectRequired;
    if (!formData.message.trim()) nextErrors.message = t.messageRequired;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
    if (status !== 'idle') setStatus('idle');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) { setStatus('validation'); return; }
    setStatus('unavailable');
  };

  const field = (name, label, type = 'text') => (
    <div className="contact-field">
      <label htmlFor={`contact-${name}`}>{label}</label>
      <input id={`contact-${name}`} name={name} type={type} value={formData[name]} onChange={handleChange} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `contact-${name}-error` : undefined} required />
      {errors[name] && <span id={`contact-${name}-error`} className="contact-error" role="alert">{errors[name]}</span>}
    </div>
  );

  return (
    <main className={`contact-page${isDark ? ' contact-page-dark' : ''}`}>
      <section className="contact-hero" aria-labelledby="contact-title">
        <div className="contact-shell">
          <span className="contact-eyebrow">Mekdela Amba University</span>
          <h1 id="contact-title">{t.pageTitle}</h1>
          <p>{t.pageSubtitle}</p>
        </div>
      </section>

      <section className="contact-content contact-shell">
        <div className="contact-information">
          <div className="contact-section-heading">
            <span className="contact-eyebrow">{t.information}</span>
            <h2>{t.information}</h2>
            <p>{t.informationText}</p>
          </div>
        </div>

        <section className="contact-form-panel" aria-labelledby="contact-form-title">
          <div className="contact-section-heading">
            <span className="contact-eyebrow"><MessageCircle size={15} aria-hidden="true" /> {t.formTitle}</span>
            <h2 id="contact-form-title">{t.formTitle}</h2>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            {field('name', t.name)}
            {field('email', t.email, 'email')}
            {field('subject', t.subject)}
            <div className="contact-field">
              <label htmlFor="contact-message">{t.message}</label>
              <textarea id="contact-message" name="message" value={formData.message} onChange={handleChange} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} rows="6" required />
              {errors.message && <span id="contact-message-error" className="contact-error" role="alert">{errors.message}</span>}
            </div>
            {status === 'validation' && <p className="contact-status contact-status-error" role="alert">{t.validationSummary}</p>}
            {status === 'success' && <p className="contact-status contact-status-success" role="status">{t.success}</p>}
            {status === 'server-error' && <p className="contact-status contact-status-error" role="alert">{t.serverError}</p>}
            {status === 'network-error' && <p className="contact-status contact-status-error" role="alert">{t.networkError}</p>}
            {status === 'unavailable' && <p className="contact-status contact-status-error" role="alert">{t.submissionUnavailable}</p>}
            <button type="submit" disabled={status === 'submitting'}><Send size={17} aria-hidden="true" />{status === 'submitting' ? t.submitting : t.send}</button>
          </form>
        </section>
      </section>

      <style>{`
        .contact-page { --contact-bg:#f5f7f9; --contact-surface:#fff; --contact-border:#d7dee5; --contact-text:#17212b; --contact-muted:#52606d; --contact-primary:#536575; min-height:100vh; background:var(--contact-bg); color:var(--contact-text); }
        .contact-page-dark { --contact-bg:#0f172a; --contact-surface:#111827; --contact-border:rgba(148,163,184,.24); --contact-text:#e2e8f0; --contact-muted:#cbd5e1; --contact-primary:#93c5fd; }
        .contact-shell { width:min(1120px,calc(100% - 40px)); margin:0 auto; }
        .contact-hero { padding:72px 0 68px; background:#b1bac4; }
        .contact-hero h1 { margin:0 0 12px; color:#17212b; font-size:clamp(2.2rem,5vw,4rem); line-height:1.05; }
        .contact-hero p { max-width:600px; margin:0; color:#334155; font-size:1.08rem; line-height:1.7; }
        .contact-eyebrow { display:inline-flex; align-items:center; gap:7px; margin-bottom:15px; color:var(--contact-primary); font-size:.74rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .contact-hero .contact-eyebrow { color:#334155; }
        .contact-content { display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr); gap:64px; padding-top:72px; padding-bottom:88px; }
        .contact-section-heading h2 { margin:0 0 12px; font-size:clamp(1.65rem,3vw,2.35rem); line-height:1.15; }
        .contact-section-heading p { margin:0; color:var(--contact-muted); line-height:1.7; }
        .contact-information { padding-top:8px; }
        .contact-form-panel { padding:clamp(24px,4vw,40px); }
        .contact-form-panel form { display:grid; gap:18px; margin-top:28px; }
        .contact-field { display:grid; gap:7px; }
        .contact-field label { font-size:.9rem; font-weight:700; }
        .contact-field input,.contact-field textarea { width:100%; box-sizing:border-box; border:1px solid var(--contact-border); border-radius:9px; padding:12px 14px; background:var(--contact-bg); color:var(--contact-text); font:inherit; line-height:1.45; }
        .contact-field textarea { min-height:140px; resize:vertical; }
        .contact-field input:focus,.contact-field textarea:focus { outline:3px solid rgba(83,101,117,.22); border-color:var(--contact-primary); }
        .contact-field input[aria-invalid="true"],.contact-field textarea[aria-invalid="true"] { border-color:#b42318; }
        .contact-error { color:#b42318; font-size:.84rem; }
        .contact-status { margin:0; padding:12px 14px; border-radius:9px; line-height:1.5; }
        .contact-status-error { color:#9b1c1c; background:#fef3f2; }
        .contact-status-success { color:#166534; background:#f0fdf4; }
        .contact-form-panel button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; border:0; border-radius:9px; background:var(--contact-primary); color:#fff; font:inherit; font-weight:750; cursor:pointer; }
        .contact-form-panel button:hover { filter:brightness(.92); }
        .contact-form-panel button:disabled { cursor:wait; opacity:.7; }
        @media (max-width:760px) { .contact-shell { width:min(100% - 28px,1120px); } .contact-hero { padding:52px 0 48px; } .contact-content { grid-template-columns:1fr; gap:42px; padding-top:48px; padding-bottom:60px; } }
      `}</style>
    </main>
  );
};

export default Contact;
