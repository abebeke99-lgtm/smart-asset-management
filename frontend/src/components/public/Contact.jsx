import React, { useState } from 'react';
import { Building2, MessageSquareText, Send } from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';

const ContactHero = ({ title, university, system, supportingText }) => (
  <section className="contact-hero" aria-labelledby="contact-title">
    <div className="contact-shell contact-hero-inner">
      <div className="contact-hero-copy">
        <h1 id="contact-title" className="sr-only">{title}</h1>
        <p className="contact-eyebrow">University</p>
        <h2 className="contact-university">{university}</h2>
        <h3 className="contact-system">{system}</h3>
        <p className="contact-supporting-text">{supportingText}</p>
      </div>
    </div>
  </section>
);

const ContactInfoCard = ({ icon: Icon, label, value }) => (
  <article className="contact-info-card">
    <div className="contact-info-head">
      <div className="contact-info-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <h3>{label}</h3>
    </div>
    <p className="contact-info-value">{value}</p>
  </article>
);

const initialForm = { name: '', email: '', subject: '', message: '' };

const Contact = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDark = theme === 'dark';

  const content = language === 'en' ? {
    title: 'Contact',
    infoHeading: 'Contact Information',
    university: 'Mekdela Amba University',
    system: 'University Asset Management System',
    supportingText: 'Contact the system administration team for questions or technical support related to the university asset management system.',
    institution: 'University',
    institutionValue: 'Mekdela Amba University',
    systemValue: 'University Asset Management System',
    formHeading: 'Send a Message',
    formIntro: 'Send a message to the system administration team.',
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'Enter your email address',
    subjectPlaceholder: 'What is your message about?',
    messagePlaceholder: 'Write your message (20 to 5,000 characters)',
    submit: 'Send Message',
    submitting: 'Sending…',
    requiredName: 'Enter your name (2 to 100 characters).',
    invalidEmail: 'Enter a valid email address.',
    requiredSubject: 'Enter a subject (3 to 150 characters).',
    invalidMessage: 'Your message must be between 20 and 5,000 characters.',
    validationFailed: 'Please review the highlighted fields and try again.',
    success: 'Your message has been submitted successfully.',
    unavailable: 'Message delivery is not configured. Please try again later.',
    timeout: 'Message delivery timed out. Your message was not confirmed; please try again.',
    rateLimited: 'Too many messages were sent. Please try again later.',
    sendFailed: 'Your message could not be delivered. Your entries have been kept.',
    networkError: 'The service could not be reached. Check your connection and try again.'
  } : {
    title: 'ያግኙን',
    university: 'መቅደላ አምባ ዩኒቨርሲቲ',
    system: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    supportingText: 'ከዩኒቨርሲቲው የንብረት አስተዳደር ስርዓት ጋር ለተያያዙ ጥያቄዎች ወይም ቴክኒካዊ ድጋፍ የስርዓቱን አስተዳደር ቡድን ያግኙ።',
    infoHeading: 'የግንኙነት መረጃ',
    institution: 'ዩኒቨርሲቲ',
    institutionValue: 'መቅደላ አምባ ዩኒቨርሲቲ',
    systemValue: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    formHeading: 'መልዕክት ይላኩ',
    formIntro: 'ለስርዓቱ አስተዳደር ቡድን መልዕክት ይላኩ።',
    name: 'ስም',
    email: 'ኢሜይል',
    subject: 'ርዕስ',
    message: 'መልዕክት',
    namePlaceholder: 'ስምዎ',
    emailPlaceholder: 'የኢሜይል አድራሻዎን ያስገቡ',
    subjectPlaceholder: 'መልዕክትዎ ስለ ምንድን ነው?',
    messagePlaceholder: 'መልዕክትዎን ይጻፉ (ከ20 እስከ 5,000 ቁምፊዎች)',
    submit: 'መልዕክት ይላኩ',
    submitting: 'በመላክ ላይ…',
    requiredName: 'ስምዎን ያስገቡ (ከ2 እስከ 100 ቁምፊዎች)።',
    invalidEmail: 'ትክክለኛ የኢሜይል አድራሻ ያስገቡ።',
    requiredSubject: 'ርዕስ ያስገቡ (ከ3 እስከ 150 ቁምፊዎች)።',
    invalidMessage: 'መልዕክትዎ ከ20 እስከ 5,000 ቁምፊዎች መሆን አለበት።',
    validationFailed: 'እባክዎ ምልክት የተደረገባቸውን መስኮች ያስተካክሉና እንደገና ይሞክሩ።',
    success: 'መልዕክትዎ በተሳካ ሁኔታ ተልኳል።',
    unavailable: 'የመልዕክት መላኪያ አልተዋቀረም። ቆይተው እንደገና ይሞክሩ።',
    timeout: 'የመልዕክት መላኪያው ጊዜ አልፎታል። መልዕክትዎ እንደተላከ አልተረጋገጠም፤ እባክዎ እንደገና ይሞክሩ።',
    rateLimited: 'ብዙ መልዕክቶች ተልከዋል። ቆይተው እንደገና ይሞክሩ።',
    sendFailed: 'መልዕክትዎ መላክ አልተቻለም። ያስገቡት መረጃ ተጠብቋል።',
    networkError: 'አገልግሎቱን ማግኘት አልተቻለም። ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።'
  };

  const validateForm = () => {
    const nextErrors = {};
    if (form.name.trim().length < 2 || form.name.trim().length > 100) nextErrors.name = content.requiredName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = content.invalidEmail;
    if (form.subject.trim().length < 3 || form.subject.trim().length > 150) nextErrors.subject = content.requiredSubject;
    if (form.message.trim().length < 20 || form.message.trim().length > 5000) nextErrors.message = content.invalidMessage;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/contact', form);
      if (response.data?.success === true && response.data?.delivery === 'sent') {
        setForm(initialForm);
        setErrors({});
        setNotice({ type: 'success', message: content.success });
      } else {
        setNotice({ type: 'error', message: content.sendFailed });
      }
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        const serverErrors = error.response?.data?.errors || {};
        const localizedErrors = {
          ...(serverErrors.name ? { name: content.requiredName } : {}),
          ...(serverErrors.email ? { email: content.invalidEmail } : {}),
          ...(serverErrors.subject ? { subject: content.requiredSubject } : {}),
          ...(serverErrors.message ? { message: content.invalidMessage } : {}),
        };
        setErrors((current) => ({ ...current, ...localizedErrors }));
      }
      const message = status === 429 ? content.rateLimited
        : status === 503 ? content.unavailable
          : status === 504 || error.code === 'ECONNABORTED' ? content.timeout
            : status === 400 ? content.validationFailed
            : !error.response ? content.networkError : content.sendFailed;
      setNotice({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  };

  return (
    <main className={`contact-page${isDark ? ' contact-page-dark' : ''}`}>
      <ContactHero
        title={content.title}
        university={content.university}
        system={content.system}
        supportingText={content.supportingText}
      />

      <section className="contact-shell contact-section" aria-labelledby="contact-information-title">
        <div className="contact-heading-row">
          <h2 id="contact-information-title">{content.infoHeading}</h2>
        </div>
        <div className="contact-info-grid">
          <ContactInfoCard icon={Building2} label={content.institution} value={content.institutionValue} />
          <ContactInfoCard icon={MessageSquareText} label={content.system} value={content.systemValue} />
        </div>
      </section>

      <section className="contact-shell contact-section contact-form-section" aria-labelledby="contact-form-title">
        <div className="contact-heading-row">
          <h2 id="contact-form-title">{content.formHeading}</h2>
          <p className="contact-intro">{content.formIntro}</p>
        </div>
        <form className="contact-form" aria-labelledby="contact-form-title" noValidate onSubmit={handleSubmit}>
          {notice ? <p className={`contact-form-notice contact-form-notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
          <div className="contact-form-grid">
            <div className="contact-field">
              <label htmlFor="contact-name">{content.name}</label>
              <input id="contact-name" name="name" autoComplete="name" required maxLength={100} value={form.name} onChange={(event) => updateField('name', event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} placeholder={content.namePlaceholder} />
              {errors.name ? <p id="contact-name-error" className="contact-field-error">{errors.name}</p> : null}
            </div>
            <div className="contact-field">
              <label htmlFor="contact-email">{content.email}</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => updateField('email', event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'contact-email-error' : undefined} placeholder={content.emailPlaceholder} />
              {errors.email ? <p id="contact-email-error" className="contact-field-error">{errors.email}</p> : null}
            </div>
            <div className="contact-field contact-field-wide">
              <label htmlFor="contact-subject">{content.subject}</label>
              <input id="contact-subject" name="subject" required maxLength={150} value={form.subject} onChange={(event) => updateField('subject', event.target.value)} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? 'contact-subject-error' : undefined} placeholder={content.subjectPlaceholder} />
              {errors.subject ? <p id="contact-subject-error" className="contact-field-error">{errors.subject}</p> : null}
            </div>
            <div className="contact-field contact-field-wide">
              <label htmlFor="contact-message">{content.message}</label>
              <textarea id="contact-message" name="message" required minLength={20} maxLength={5000} rows={7} value={form.message} onChange={(event) => updateField('message', event.target.value)} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} placeholder={content.messagePlaceholder} />
              {errors.message ? <p id="contact-message-error" className="contact-field-error">{errors.message}</p> : null}
            </div>
          </div>
          <button className="contact-submit" type="submit" disabled={isSubmitting}>
            <Send size={17} aria-hidden="true" />
            {isSubmitting ? content.submitting : content.submit}
          </button>
        </form>
      </section>

      <style>{`
        .contact-page {
          --contact-primary: #1b365d;
          --contact-secondary: #2a4d7a;
          --contact-accent: #d4b46a;
          --contact-bg: #f4f7fb;
          --contact-card: #ffffff;
          --contact-text: #172033;
          --contact-muted: #5f6f86;
          --contact-border: #dfe7f1;
          --contact-info: #1b365d;
          --contact-shadow: 0 16px 30px rgba(27, 54, 93, 0.12);
          min-height: 100%;
          background: var(--contact-bg);
          color: var(--contact-text);
        }

        .contact-page-dark {
          --contact-primary: #dfeafc;
          --contact-secondary: #b8d0f5;
          --contact-accent: #f0d38d;
          --contact-bg: #0f172a;
          --contact-card: #111c2d;
          --contact-text: #ebf3ff;
          --contact-muted: #b8c7d8;
          --contact-border: rgba(148, 163, 184, 0.2);
          --contact-info: #dfeafc;
          --contact-shadow: 0 18px 30px rgba(2, 6, 23, 0.45);
        }

        .contact-page * { box-sizing: border-box; }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .contact-shell {
          width: min(1100px, calc(100% - 32px));
          margin: 0 auto;
        }

        .contact-hero {
          padding: clamp(52px, 6vw, 82px) 0 28px;
          background: linear-gradient(135deg, rgba(27, 54, 93, 0.08), rgba(42, 77, 122, 0.04));
          border-bottom: 1px solid var(--contact-border);
        }

        .contact-page-dark .contact-hero {
          background: linear-gradient(135deg, rgba(11, 25, 42, 0.98), rgba(24, 50, 76, 0.96));
        }

        .contact-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }

        .contact-eyebrow,
        .contact-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 16px;
          color: var(--contact-primary);
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .contact-hero h1 {
          margin: 0;
          color: var(--contact-text);
          font-size: clamp(2.1rem, 4vw, 3.45rem);
          line-height: 1.08;
          letter-spacing: -0.04em;
        }

        .contact-hero-subtitle {
          margin: 18px 0 0;
          color: var(--contact-secondary);
          font-size: 1.02rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .contact-hero-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 22px;
          border: 1px solid var(--contact-border);
          border-radius: 18px;
          background: rgba(255,255,255,0.72);
          box-shadow: var(--contact-shadow);
        }

        .contact-page-dark .contact-hero-card {
          background: rgba(15, 23, 42, 0.75);
        }

        .contact-hero-card-icon {
          display: grid;
          place-items: center;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--contact-primary), var(--contact-secondary));
          color: #ffffff;
        }

        .contact-hero-card-label {
          margin: 0 0 6px;
          color: var(--contact-muted);
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .contact-hero-card strong {
          display: block;
          color: var(--contact-text);
          font-size: 1rem;
          line-height: 1.5;
        }

        .contact-university {
          margin: 0;
          color: var(--contact-primary);
          font-size: clamp(2.1rem, 4vw, 3.2rem);
          line-height: 1.14;
          letter-spacing: -0.03em;
          font-weight: 800;
        }

        .contact-system {
          margin: 10px 0 0;
          color: var(--contact-secondary);
          font-size: clamp(1.08rem, 2.1vw, 1.6rem);
          line-height: 1.4;
          font-weight: 700;
        }

        .contact-supporting-text {
          margin: 18px 0 0;
          max-width: 760px;
          color: var(--contact-muted);
          font-size: 1.05rem;
          line-height: 1.7;
        }

        .contact-section {
          padding-top: 56px;
          padding-bottom: 16px;
        }

        .contact-heading-row {
          margin-bottom: 20px;
        }

        .contact-heading-row h2 {
          margin: 0 0 10px;
          color: var(--contact-text);
          font-size: clamp(1.6rem, 2vw, 2.2rem);
          line-height: 1.2;
        }

        .contact-intro {
          margin: 0;
          max-width: 720px;
          color: var(--contact-muted);
          line-height: 1.7;
        }

        .contact-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .contact-support-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
        }

        .contact-info-card,
        .contact-support-card,
        .contact-status-card,
        .contact-assistance-card {
          border: 1px solid var(--contact-border);
          border-radius: 18px;
          background: var(--contact-card);
          box-shadow: var(--contact-shadow);
        }

        .contact-info-card {
          padding: 20px 20px 18px;
          border: 1px solid var(--contact-border);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,247,251,0.98));
          box-shadow: var(--contact-shadow);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .contact-info-card:hover {
          transform: translateY(-2px);
          border-color: rgba(27, 54, 93, 0.2);
          box-shadow: 0 18px 34px rgba(27, 54, 93, 0.12);
        }

        .contact-info-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .contact-info-icon,
        .contact-support-icon,
        .contact-status-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(37, 99, 235, 0.1);
          color: var(--contact-info);
        }

        .contact-info-head h3,
        .contact-support-card h3,
        .contact-status-card h3,
        .contact-assistance-card h2 {
          margin: 0;
          color: var(--contact-text);
          font-size: 1.05rem;
        }

        .contact-info-value {
          margin: 0;
          color: var(--contact-text);
          font-size: 1.05rem;
          font-weight: 700;
          line-height: 1.6;
        }

        .contact-form-section { padding-bottom: 72px; }

        .contact-form {
          max-width: 780px;
          padding: 24px;
          border: 1px solid var(--contact-border);
          border-radius: 8px;
          background: var(--contact-card);
          box-shadow: var(--contact-shadow);
        }

        .contact-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px 18px;
        }

        .contact-field { min-width: 0; }
        .contact-field-wide { grid-column: 1 / -1; }

        .contact-field label {
          display: block;
          margin-bottom: 7px;
          color: var(--contact-text);
          font-size: 0.94rem;
          font-weight: 700;
        }

        .contact-field input,
        .contact-field textarea {
          display: block;
          width: 100%;
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid var(--contact-border);
          border-radius: 6px;
          background: var(--contact-card);
          color: var(--contact-text);
          font: inherit;
          line-height: 1.5;
        }

        .contact-field textarea { resize: vertical; }
        .contact-field input::placeholder,
        .contact-field textarea::placeholder { color: var(--contact-muted); opacity: 1; }
        .contact-field [aria-invalid="true"] { border-color: #b42318; }

        .contact-field-error {
          margin: 6px 0 0;
          color: #b42318;
          font-size: 0.88rem;
        }

        .contact-form-notice {
          margin: 0 0 20px;
          padding: 12px 14px;
          border: 1px solid var(--contact-border);
          border-radius: 6px;
          line-height: 1.5;
        }

        .contact-form-notice-success { color: #176b3a; background: #edf8f0; }
        .contact-form-notice-error { color: #9b1c1c; background: #fff1f0; }

        .contact-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 46px;
          margin-top: 20px;
          padding: 0 18px;
          border: 0;
          border-radius: 6px;
          background: var(--contact-primary);
          color: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .contact-submit:disabled { cursor: wait; opacity: 0.7; }

        .contact-info-tag {
          display: inline-block;
          margin-top: 12px;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          color: var(--contact-info);
          font-size: 0.75rem;
          font-weight: 700;
        }

        .contact-status-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 22px 24px;
          background: rgba(37, 99, 235, 0.04);
        }

        .contact-page-dark .contact-status-card {
          background: rgba(59, 130, 246, 0.08);
        }

        .contact-status-card h3 {
          margin-bottom: 8px;
        }

        .contact-status-card p {
          margin: 0;
          color: var(--contact-muted);
          line-height: 1.7;
        }

        .contact-support-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 22px 20px;
        }

        .contact-support-card h3 {
          font-size: 1.12rem;
        }

        .contact-support-card p {
          margin: 0;
          color: var(--contact-muted);
          line-height: 1.7;
        }

        .contact-support-link,
        .contact-primary-action,
        .contact-secondary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 46px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .contact-support-link {
          width: fit-content;
          padding: 0 14px;
          background: rgba(18, 59, 99, 0.08);
          color: var(--contact-primary);
        }

        .contact-support-link:hover,
        .contact-primary-action:hover,
        .contact-secondary-action:hover {
          transform: translateY(-1px);
        }

        .contact-primary-action,
        .contact-secondary-action {
          padding: 0 18px;
          border: 1px solid transparent;
        }

        .contact-primary-action {
          background: var(--contact-primary);
          color: #ffffff;
          box-shadow: 0 12px 18px rgba(18, 59, 99, 0.18);
        }

        .contact-secondary-action {
          background: transparent;
          border-color: var(--contact-border);
          color: var(--contact-text);
        }

        .contact-assistance {
          padding-bottom: 72px;
        }

        .contact-assistance-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 24px 26px;
        }

        .contact-assistance-card p {
          max-width: 640px;
          margin: 12px 0 0;
          color: var(--contact-muted);
          line-height: 1.7;
        }

        .contact-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .contact-page a:focus-visible,
        .contact-page button:focus-visible,
        .contact-page input:focus-visible,
        .contact-page textarea:focus-visible,
        .contact-page select:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.28);
          outline-offset: 3px;
        }

        @media (max-width: 860px) {
          .contact-support-grid {
            grid-template-columns: 1fr;
          }

          .contact-info-grid { grid-template-columns: 1fr; }

          .contact-assistance-card {
            display: grid;
            grid-template-columns: 1fr;
            align-items: start;
          }
        }

        @media (max-width: 640px) {
          .contact-shell {
            width: min(100% - 22px, 1100px);
          }

          .contact-hero {
            padding-top: 42px;
          }

          .contact-section {
            padding-top: 44px;
          }

          .contact-form { padding: 18px; }
          .contact-form-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }

          .contact-status-card {
            padding: 18px 18px;
          }

          .contact-assistance-card {
            padding: 18px 18px;
          }

          .contact-actions {
            width: 100%;
          }

          .contact-primary-action,
          .contact-secondary-action,
          .contact-support-link {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
};

export default Contact;
