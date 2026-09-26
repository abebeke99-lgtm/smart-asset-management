import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Info,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserRoundCog,
  Users
} from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const ContactHero = ({ eyebrow, title, subtitle, supportingText }) => (
  <section className="contact-hero" aria-labelledby="contact-title">
    <div className="contact-shell contact-hero-inner">
      <div className="contact-hero-copy">
        <p className="contact-eyebrow">{eyebrow}</p>
        <h1 id="contact-title">{title}</h1>
        <p className="contact-hero-subtitle">{subtitle}</p>
      </div>
      <div className="contact-hero-card" aria-label="Contact and support summary">
        <div className="contact-hero-card-icon" aria-hidden="true">
          <MessageSquareText size={28} />
        </div>
        <div>
          <p className="contact-hero-card-label">Contact &amp; Support</p>
          <strong>University Asset Management System</strong>
        </div>
      </div>
    </div>
    <div className="contact-shell">
      <p className="contact-supporting-text">{supportingText}</p>
    </div>
  </section>
);

const ContactInfoCard = ({ icon: Icon, label, value, tag }) => (
  <article className="contact-info-card">
    <div className="contact-info-head">
      <div className="contact-info-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <h3>{label}</h3>
    </div>
    <p className="contact-info-value">{value}</p>
    {tag ? <span className="contact-info-tag">{tag}</span> : null}
  </article>
);

const ContactStatus = ({ icon: Icon, title, description }) => (
  <aside className="contact-status-card" aria-live="polite">
    <div className="contact-status-icon" aria-hidden="true"><Icon size={22} /></div>
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </aside>
);

const SupportCard = ({ icon: Icon, title, description, actionLabel, to, actionVisible = false }) => (
  <article className="contact-support-card">
    <div className="contact-support-icon" aria-hidden="true"><Icon size={22} /></div>
    <h3>{title}</h3>
    <p>{description}</p>
    {actionVisible ? (
      <Link className="contact-support-link" to={to}>
        {actionLabel}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    ) : null}
  </article>
);

const ContactActions = ({ primaryLabel, primaryTo, secondaryLabel, secondaryTo }) => (
  <div className="contact-actions" aria-label="Contact actions">
    <Link className="contact-primary-action" to={primaryTo}>{primaryLabel}</Link>
    <Link className="contact-secondary-action" to={secondaryTo}>{secondaryLabel}</Link>
  </div>
);

const Contact = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const content = language === 'en' ? {
    eyebrow: 'Mekdela Amba University',
    title: 'Contact & Support',
    subtitle: 'University Asset Management System',
    supportingText: 'Connect with the appropriate support channel for assistance with the University Asset Management System.',
    sectionHeading: 'Contact and Support',
    intro: 'Official contact channels are shown only when configured by the university.',
    infoHeading: 'Contact Information',
    institution: 'Institution',
    institutionValue: 'Mekdela Amba University',
    system: 'System',
    systemValue: 'University Asset Management System',
    details: 'Contact Details',
    detailsValue: 'Not yet configured',
    submission: 'Public Message Submission',
    submissionValue: 'Unavailable',
    statusTitle: 'Contact Status',
    statusOne: 'Official contact details have not been configured.',
    statusTwo: 'Public message submission is unavailable.',
    alternativeTitle: 'Alternative Support',
    alternativeIntro: 'If you need immediate assistance:',
    supportCards: [
      { title: 'System Administrator', description: 'Contact your system administrator for assistance with system access and application-related issues.', icon: ShieldCheck, actionVisible: false },
      { title: 'Department Head / College Manager', description: 'Reach out to your department head or college manager for assistance with department or college asset responsibilities.', icon: Users, actionVisible: false },
      { title: 'Help & Guidance', description: 'Consult the Help section for role-specific guidance.', icon: Info, actionVisible: false }
    ],
    assistanceTitle: 'Need Assistance?',
    assistanceText: 'Use the Help section for role-specific guidance, or contact your system administrator, department head, or college manager.',
    helpButton: 'View Help',
    helpTo: '/help',
    homeButton: 'Back to Home',
    homeTo: '/'
  } : {
    eyebrow: 'መቅደላ አምባ ዩኒቨርሲቲ',
    title: 'ግንኙነትና ድጋፍ',
    subtitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    supportingText: 'ለዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት እገዛ ለማግኘት ተገቢውን የድጋፍ ሰንጠረዥ ያግኙ።',
    sectionHeading: 'ግንኙነትና ድጋፍ',
    intro: 'ይፋዊ የግንኙነት መንገዶች በዩኒቨርሲቲው ሲዋቀሩ ብቻ ይታያሉ።',
    infoHeading: 'የግንኙነት መረጃ',
    institution: 'ተቋም',
    institutionValue: 'መቅደላ አምባ ዩኒቨርሲቲ',
    system: 'ስርዓት',
    systemValue: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    details: 'የግንኙነት ዝርዝሮች',
    detailsValue: 'አልተዋቀረም',
    submission: 'የህዝብ መልእክት ላኪያ',
    submissionValue: 'አይገኝም',
    statusTitle: 'የግንኙነት ሁኔታ',
    statusOne: 'የኦፊሴላዊ የግንኙነት ዝርዝሮች አልተዋቀረም።',
    statusTwo: 'የህዝብ መልእክት ላኪያ አይገኝም።',
    alternativeTitle: 'ተለዋጭ ድጋፍ',
    alternativeIntro: 'ፈጣኑን እገዛ ከፈለጉ:',
    supportCards: [
      { title: 'የስርዓት አስተዳደር', description: 'ስርዓት መግቢያ እና የመተግበሪያ ችግሮችን ለመፍታት የስርዓት አስተዳደሩን ያነጋግሩ።', icon: ShieldCheck, actionVisible: false },
      { title: 'የክፍል ሃላፊ / የኮሌጅ አስተዳደር', description: 'የክፍል ወይም የኮሌጅ የንብረት ኃላፊነቶችን ለመቋቋም ወደ ክፍል ሃላፊዎ ወይም የኮሌጅ አስተዳደሩ ያነጋግሩ።', icon: Users, actionVisible: false },
      { title: 'እገዛና መመሪያ', description: 'ለሚና የተወሰነ መመሪያ እገዛን ይመልከቱ።', icon: Info, actionVisible: false }
    ],
    assistanceTitle: 'እገዛ ያስፈልጋል?',
    assistanceText: 'ለሚና የተወሰነ መመሪያ እገዛን ይጠቀሙ ወይም የስርዓት አስተዳደር፣ የክፍል ሃላፊ ወይም የኮሌጅ አስተዳደር ያነጋግሩ።',
    helpButton: 'ወደ እገዛ',
    helpTo: '/help',
    homeButton: 'ወደ መነሻ ገጽ',
    homeTo: '/'
  };

  return (
    <main className={`contact-page${isDark ? ' contact-page-dark' : ''}`}>
      <ContactHero
        eyebrow={content.eyebrow}
        title={content.title}
        subtitle={content.subtitle}
        supportingText={content.supportingText}
      />

      <section className="contact-shell contact-section" aria-labelledby="contact-support-heading">
        <div className="contact-heading-row">
          <p className="contact-section-kicker"><Info size={16} aria-hidden="true" /> {content.sectionHeading}</p>
          <h2 id="contact-support-heading">{content.infoHeading}</h2>
          <p className="contact-intro">{content.intro}</p>
        </div>
      </section>

      <section className="contact-shell contact-section" aria-labelledby="contact-information-title">
        <div className="contact-heading-row">
          <p className="contact-section-kicker"><Building2 size={16} aria-hidden="true" /> {content.infoHeading}</p>
          <h2 id="contact-information-title">{content.infoHeading}</h2>
        </div>
        <div className="contact-info-grid">
          <ContactInfoCard icon={Building2} label={content.institution} value={content.institutionValue} />
          <ContactInfoCard icon={MessageSquareText} label={content.system} value={content.systemValue} />
          <ContactInfoCard icon={Mail} label={content.details} value={content.detailsValue} />
          <ContactInfoCard icon={AlertCircle} label={content.submission} value={content.submissionValue} />
        </div>
      </section>

      <section className="contact-shell contact-section" aria-labelledby="contact-status-title">
        <div className="contact-heading-row">
          <p className="contact-section-kicker"><Info size={16} aria-hidden="true" /> {content.statusTitle}</p>
          <h2 id="contact-status-title">{content.statusTitle}</h2>
        </div>
        <ContactStatus icon={Info} title={content.statusOne} description={content.statusTwo} />
      </section>

      <section className="contact-shell contact-section" aria-labelledby="contact-support-title">
        <div className="contact-heading-row">
          <p className="contact-section-kicker"><Users size={16} aria-hidden="true" /> {content.alternativeTitle}</p>
          <h2 id="contact-support-title">{content.alternativeTitle}</h2>
          <p className="contact-intro">{content.alternativeIntro}</p>
        </div>
        <div className="contact-support-grid">
          {content.supportCards.map((card) => (
            <SupportCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              description={card.description}
              actionLabel={card.actionLabel}
              to={card.to}
              actionVisible={card.actionVisible}
            />
          ))}
        </div>
      </section>

      <section className="contact-shell contact-section contact-assistance" aria-labelledby="contact-assistance-title">
        <div className="contact-assistance-card">
          <div>
            <p className="contact-section-kicker"><UserRoundCog size={16} aria-hidden="true" /> {content.assistanceTitle}</p>
            <h2 id="contact-assistance-title">{content.assistanceTitle}</h2>
            <p>{content.assistanceText}</p>
          </div>
          <ContactActions
            primaryLabel={content.helpButton}
            primaryTo={content.helpTo}
            secondaryLabel={content.homeButton}
            secondaryTo={content.homeTo}
          />
        </div>
      </section>

      <style>{`
        .contact-page {
          --contact-primary: #123B63;
          --contact-secondary: #1E5A8A;
          --contact-accent: #D9A441;
          --contact-bg: #F5F8FC;
          --contact-card: #FFFFFF;
          --contact-text: #172033;
          --contact-muted: #64748B;
          --contact-border: #E2E8F0;
          --contact-info: #2563EB;
          --contact-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
          min-height: 100%;
          background: var(--contact-bg);
          color: var(--contact-text);
        }

        .contact-page-dark {
          --contact-primary: #9ac2eb;
          --contact-secondary: #7db1df;
          --contact-accent: #f0c971;
          --contact-bg: #0f172a;
          --contact-card: #111c2d;
          --contact-text: #ebf3ff;
          --contact-muted: #b8c7d8;
          --contact-border: rgba(148, 163, 184, 0.2);
          --contact-info: #8ec5ff;
          --contact-shadow: 0 18px 30px rgba(2, 6, 23, 0.45);
        }

        .contact-page * { box-sizing: border-box; }

        .contact-shell {
          width: min(1100px, calc(100% - 32px));
          margin: 0 auto;
        }

        .contact-hero {
          padding: clamp(52px, 6vw, 82px) 0 24px;
          background: linear-gradient(135deg, rgba(18, 59, 99, 0.06), rgba(30, 90, 138, 0.04));
          border-bottom: 1px solid var(--contact-border);
        }

        .contact-page-dark .contact-hero {
          background: linear-gradient(135deg, rgba(11, 25, 42, 0.98), rgba(24, 50, 76, 0.96));
        }

        .contact-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
          align-items: end;
          gap: 28px;
        }

        .contact-eyebrow,
        .contact-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 16px;
          color: var(--contact-primary);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
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

        .contact-supporting-text {
          margin: 18px 0 0;
          max-width: 720px;
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

        .contact-info-grid,
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
          .contact-info-grid,
          .contact-support-grid {
            grid-template-columns: 1fr;
          }

          .contact-hero-inner {
            grid-template-columns: 1fr;
          }

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

          .contact-hero-card {
            padding: 16px 18px;
          }

          .contact-section {
            padding-top: 44px;
          }

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
