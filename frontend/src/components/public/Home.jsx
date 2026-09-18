import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { ArrowRight, BarChart3, CheckCircle2, Landmark, Package, Radio, ShieldCheck, Users, Wrench, Workflow } from 'lucide-react';

const OFFICIAL_UNIVERSITY_IMAGE = 'https://mkau.edu.et/wordpress_e/wp-content/uploads/2025/05/photo_2025-05-23_06-54-52.jpg';

const Home = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const videoSectionRef = useRef(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const section = videoSectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setVideoVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVideoVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const t = language === 'en' ? {
    heroTitle: 'University Asset Management System',
    heroDescription: 'Manage university assets efficiently with secure, transparent and centralized asset management.',
    getStarted: 'Get Started',
    learnMore: 'Learn More',
    heroKicker: 'MEKDELA AMBA UNIVERSITY',
    overview: 'One Platform for University Asset Operations',
    overviewText: 'Centralized asset records, controlled movement, maintenance visibility, secure access, and data-driven reporting.',
    videoTitle: 'See University Asset Management in Action',
    videoSubtitle: 'Discover how the University Asset Management System helps universities track, maintain, and manage their assets efficiently.',
    featuresTitle: 'Key Features',
    featuresSubtitle: 'Everything needed to manage university assets securely and efficiently.',
    assetManagement: 'Asset Management',
    assetManagementDesc: 'Register, track, assign, transfer, verify, and manage university assets from one centralized platform.',
    maintenance: 'Maintenance Management',
    maintenanceDesc: 'Manage maintenance requests, work orders, preventive maintenance, repairs, and service history.',
    rfid: 'RFID Tracking',
    rfidDesc: 'Track physical assets using RFID and QR identification with secure verification and movement history.',
    reports: 'Reports & Analytics',
    reportsDesc: 'Monitor asset inventory, financial information, maintenance activity, movements, and operational performance.',
    users: 'User Management',
    usersDesc: 'Manage users, roles, permissions, authentication, and organization-based access securely.',
    security: 'Security & Compliance',
    securityDesc: 'Protect university asset information with role-based access control, audit logs, secure authentication, and controlled workflows.',
    ctaTitle: 'Ready to Transform Your Asset Management?',
    ctaSubtitle: 'Modernize university asset operations with one centralized management platform.',
    ctaButton: 'Get Started'
  } : {
    heroTitle: 'ስማርት ዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    heroDescription: 'የዩኒቨርሲቲ ንብረቶችን በደህንነት፣ በግልጽነት እና በማዕከላዊ አስተዳደር በብቃት ያስተዳድሩ።',
    getStarted: 'ጀምር',
    learnMore: 'ተጨማሪ ይወቁ',
    heroKicker: 'መቅደላ አምባ ዩኒቨርሲቲ',
    overview: 'ለዩኒቨርሲቲ ንብረት ስራዎች አንድ መድረክ',
    overviewText: 'የተማከለ ንብረት መዝገቦች፣ የቁጥጥር እንቅስቃሴ፣ የጥገና እይታ፣ የተጠባባቂ መዳረሻ እና የመረጃ ሪፖርት መስጫ።',
    videoTitle: 'ስማርት ንብረት አስተዳደርን በተግባር ይመልከቱ',
    videoSubtitle: 'የስማርት ዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት ንብረቶችን እንዴት እንደሚከታተል፣ እንደሚጠግን እና እንደሚያስተዳድር ይመልከቱ።',
    featuresTitle: 'ቁልፍ ባህሪያት',
    featuresSubtitle: 'የዩኒቨርሲቲ ንብረቶችን በደህንነት እና በብቃት ለማስተዳደር የሚያስፈልጉ ሁሉ።',
    assetManagement: 'ንብረት አስተዳደር',
    assetManagementDesc: 'ንብረቶችን ከአንድ ማዕከላዊ መድረክ በኩል ይመዝገቡ፣ ይከታተሉ፣ ያስተካክሉ እና ያስተዳድሩ።',
    maintenance: 'ጥገና አስተዳደር',
    maintenanceDesc: 'የጥገና ጥያቄዎችን፣ የስራ ትእዛዞችን፣ ቅድመ-ጥገናዎችን፣ ጥገናዎችን እና የአገልግሎት ታሪክን ያስተዳድሩ።',
    rfid: 'RFID ክትትል',
    rfidDesc: 'ንብረቶችን በRFID እና QR መለያ በመጠቀም ያከታትሉ እና የእንቅስቃሴ ታሪክን ያሳዩ።',
    reports: 'ሪፖርቶች እና ትንታኔዎች',
    reportsDesc: 'የንብረት እቃ መጠን፣ የፋይናንስ መረጃ፣ የጥገና እንቅስቃሴ እና የስራ አፈጻጸም ትንታኔዎችን ይከታተሉ።',
    users: 'ተጠቃሚ አስተዳደር',
    usersDesc: 'ተጠቃሚዎችን፣ ሚናዎችን፣ ፍቃዶችን፣ ማረጋገጫን እና የድርጅት መዳረሻን በደህንነት ያስተዳድሩ።',
    security: 'ደህንነት እና ተኳሃንነት',
    securityDesc: 'የዩኒቨርሲቲ ንብረት መረጃን በሚና ላይ የተመሰረተ መዳረሻ፣ ኦዲት ሎግስ፣ ደህንነት ያለው ማረጋገጫ እና ቁጥጥር ያለው ሂደት ያጠብቃል።',
    ctaTitle: 'የንብረት አስተዳደርዎን ያሻሽሉ?',
    ctaSubtitle: 'የዩኒቨርሲቲ ንብረት ስራዎችን በአንድ ማዕከላዊ መድረክ ያዘምኑ።',
    ctaButton: 'ጀምር'
  };

  const featureItems = [
    { icon: Package, title: t.assetManagement, desc: t.assetManagementDesc, color: '#2563eb' },
    { icon: Wrench, title: t.maintenance, desc: t.maintenanceDesc, color: '#f59e0b' },
    { icon: Radio, title: t.rfid, desc: t.rfidDesc, color: '#8b5cf6' },
    { icon: BarChart3, title: t.reports, desc: t.reportsDesc, color: '#10b981' },
    { icon: Users, title: t.users, desc: t.usersDesc, color: '#ec4899' },
    { icon: ShieldCheck, title: t.security, desc: t.securityDesc, color: '#ef4444' }
  ];

  const valuePoints = [
    'Centralized asset records',
    'Controlled asset movement',
    'Maintenance visibility',
    'Role-based access',
    'Audit history',
    'Data-driven reporting'
  ];

  const workflowSteps = ['Register', 'Assign', 'Track', 'Maintain', 'Verify', 'Report'];

  return (
    <div className="mau-home-page">
      <main className="mau-home-main">
        <section className="mau-hero" aria-labelledby="home-hero-title">
          <div className="mau-hero-content">
            <div className="mau-hero-copy">
              <span className="mau-hero-kicker">{t.heroKicker}</span>
              <h1 id="home-hero-title">{t.heroTitle}</h1>
              <p className="mau-hero-description">{t.heroDescription}</p>

              <div className="mau-hero-actions">
                <Link className="mau-hero-primary" to="/login">
                  {t.getStarted}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link className="mau-hero-secondary" to="/about">
                  {t.learnMore}
                </Link>
              </div>

              <ul className="mau-hero-highlights" aria-label="System highlights">
                <li><CheckCircle2 size={18} aria-hidden="true" /> Centralized asset tracking</li>
                <li><CheckCircle2 size={18} aria-hidden="true" /> Secure access and workflow control</li>
                <li><CheckCircle2 size={18} aria-hidden="true" /> Maintenance and reporting visibility</li>
              </ul>
            </div>

            <div className="mau-hero-visual" aria-label="Mekdela Amba University campus presentation">
              <div className="mau-hero-image-frame">
                <img
                  src={OFFICIAL_UNIVERSITY_IMAGE}
                  alt="Mekdela Amba University campus"
                  loading="eager"
                  className="mau-campus-image"
                />
                <div className="mau-hero-image-overlay" aria-hidden="true" />
                <div className="mau-hero-image-badge">
                  <Landmark size={16} aria-hidden="true" />
                  <span>MAU campus</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mau-value-section" aria-labelledby="mau-value-title">
          <div className="mau-section-heading">
            <span className="mau-section-kicker">Why it matters</span>
            <h2 id="mau-value-title">{t.overview}</h2>
            <p>{t.overviewText}</p>
          </div>

          <div className="mau-value-grid">
            {valuePoints.map((point) => (
              <div key={point} className="mau-value-item">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mau-workflow-section" aria-labelledby="workflow-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">System workflow</span>
            <h2 id="workflow-title">From registration to reporting</h2>
          </div>

          <div className="mau-workflow-flow" aria-label="Asset workflow steps">
            {workflowSteps.map((step, index) => (
              <React.Fragment key={step}>
                <div className="mau-workflow-step">
                  <span className="mau-workflow-index">0{index + 1}</span>
                  <span>{step}</span>
                </div>
                {index < workflowSteps.length - 1 && <Workflow size={18} aria-hidden="true" className="mau-workflow-arrow" />}
              </React.Fragment>
            ))}
          </div>
        </section>

        <section ref={videoSectionRef} className={`mau-video-section${videoVisible ? ' is-visible' : ''}`} aria-labelledby="home-video-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">Demo</span>
            <h2 id="home-video-title">{t.videoTitle}</h2>
            <p>{t.videoSubtitle}</p>
          </div>

          {!videoError ? (
            <div className="mau-video-frame">
              <iframe
                src="https://www.youtube.com/embed/QYgk-0KMnbg"
                title="University Asset Management demonstration"
                loading="lazy"
                onError={() => setVideoError(true)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="mau-video-fallback" aria-live="polite">
              <div className="mau-video-fallback-icon">▶</div>
              <h3>Demo unavailable right now</h3>
              <p>The embedded video could not load in this environment. You can still open the demo in a browser.</p>
            </div>
          )}

          <div className="mau-video-actions">
            <a className="mau-primary-link" href="https://www.youtube.com/watch?v=QYgk-0KMnbg" target="_blank" rel="noopener noreferrer">
              Watch Demo
            </a>
          </div>
        </section>

        <section className="mau-features-section" aria-labelledby="features-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">Capabilities</span>
            <h2 id="features-title">{t.featuresTitle}</h2>
            <p>{t.featuresSubtitle}</p>
          </div>

          <div className="mau-feature-grid">
            {featureItems.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <article key={feature.title} className="mau-feature-card" style={{ animationDelay: `${index * 80}ms` }}>
                  <div className="mau-feature-icon" style={{ backgroundColor: `${feature.color}1A`, color: feature.color }}>
                    <IconComponent size={26} aria-hidden="true" />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mau-cta-section" aria-labelledby="cta-title">
          <div className="mau-cta-card">
            <p className="mau-cta-kicker">Smart university operations</p>
            <h2 id="cta-title">{t.ctaTitle}</h2>
            <p>{t.ctaSubtitle}</p>
            <Link className="mau-cta-button" to="/login">{t.ctaButton}</Link>
          </div>
        </section>
      </main>

      <style>{`
        .mau-home-page {
          --mau-bg: ${isDark ? '#0f172a' : '#f8fafc'};
          --mau-surface: ${isDark ? '#111827' : '#ffffff'};
          --mau-border: ${isDark ? '#334155' : '#e2e8f0'};
          --mau-text: ${isDark ? '#e2e8f0' : '#0f172a'};
          --mau-muted: ${isDark ? '#94a3b8' : '#64748b'};
          --mau-blue: #0ea5e9;
          --mau-blue-strong: #2563eb;
          --mau-navy: #0f172a;
          --mau-card-shadow: ${isDark ? '0 20px 40px rgba(15, 23, 42, 0.45)' : '0 18px 38px rgba(15, 23, 42, 0.08)'};
          background: var(--mau-bg);
          color: var(--mau-text);
        }

        .mau-home-main {
          width: min(1200px, calc(100% - 32px));
          margin: 0 auto;
          padding: 40px 0 80px;
        }

        .mau-hero {
          padding: 24px 0 16px;
        }

        .mau-hero-content {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
          gap: clamp(32px, 4vw, 64px);
          align-items: center;
          padding: clamp(24px, 5vw, 52px) clamp(14px, 3vw, 28px);
          border: 1px solid var(--mau-border);
          border-radius: 28px;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(37, 99, 235, 0.08));
          box-shadow: var(--mau-card-shadow);
        }

        .mau-hero-copy {
          max-width: 620px;
        }

        .mau-hero-kicker,
        .mau-section-kicker,
        .mau-cta-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 18px;
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--mau-blue-strong);
        }

        .mau-hero-copy h1 {
          margin: 0;
          font-size: clamp(2.5rem, 5vw, 4.3rem);
          line-height: 1.04;
          letter-spacing: -0.04em;
          color: var(--mau-text);
        }

        .mau-hero-description {
          margin: 18px 0 0;
          max-width: 560px;
          font-size: 1.08rem;
          line-height: 1.8;
          color: var(--mau-muted);
        }

        .mau-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 28px;
        }

        .mau-hero-primary,
        .mau-hero-secondary,
        .mau-primary-link,
        .mau-cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .mau-hero-primary,
        .mau-primary-link,
        .mau-cta-button {
          color: #ffffff;
          background: linear-gradient(135deg, var(--mau-blue-strong), var(--mau-blue));
          box-shadow: 0 18px 30px rgba(37, 99, 235, 0.22);
        }

        .mau-hero-secondary {
          color: var(--mau-text);
          border: 1px solid var(--mau-border);
          background: transparent;
        }

        .mau-hero-primary:hover,
        .mau-hero-secondary:hover,
        .mau-primary-link:hover,
        .mau-cta-button:hover {
          transform: translateY(-2px);
        }

        .mau-hero-primary:focus-visible,
        .mau-hero-secondary:focus-visible,
        .mau-primary-link:focus-visible,
        .mau-cta-button:focus-visible {
          outline: 3px solid rgba(14, 165, 233, 0.4);
          outline-offset: 3px;
        }

        .mau-hero-highlights {
          display: grid;
          gap: 12px;
          margin: 28px 0 0;
          padding: 0;
          list-style: none;
          color: var(--mau-text);
        }

        .mau-hero-highlights li {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--mau-muted);
          font-weight: 600;
        }

        .mau-hero-highlights svg {
          color: #16a34a;
        }

        .mau-hero-visual {
          display: flex;
          justify-content: center;
        }

        .mau-hero-image-frame {
          position: relative;
          width: min(100%, 560px);
          aspect-ratio: 4/3;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
          background: #dbeafe;
        }

        .mau-campus-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mau-hero-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.56));
        }

        .mau-hero-image-badge {
          position: absolute;
          right: 18px;
          bottom: 18px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.45);
          color: #f8fafc;
          font-weight: 700;
          backdrop-filter: blur(8px);
        }

        .mau-value-section,
        .mau-workflow-section,
        .mau-video-section,
        .mau-features-section,
        .mau-cta-section {
          padding-top: 80px;
        }

        .mau-section-heading {
          max-width: 760px;
          margin-bottom: 28px;
        }

        .mau-section-heading.centered {
          text-align: center;
          margin-inline: auto;
        }

        .mau-section-heading h2 {
          margin: 0 0 12px;
          font-size: clamp(2rem, 3vw, 2.8rem);
          line-height: 1.12;
          letter-spacing: -0.04em;
        }

        .mau-section-heading p {
          margin: 0;
          font-size: 1.04rem;
          line-height: 1.7;
          color: var(--mau-muted);
        }

        .mau-value-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .mau-value-item {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 84px;
          padding: 18px 20px;
          border: 1px solid var(--mau-border);
          border-radius: 18px;
          background: var(--mau-surface);
          box-shadow: var(--mau-card-shadow);
          color: var(--mau-text);
          font-weight: 600;
        }

        .mau-value-item svg {
          flex-shrink: 0;
          color: #16a34a;
        }

        .mau-workflow-flow {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 18px;
          padding: 18px 12px 0;
        }

        .mau-workflow-step {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 120px;
          min-height: 66px;
          padding: 12px 18px;
          border: 1px solid var(--mau-border);
          border-radius: 16px;
          background: var(--mau-surface);
          box-shadow: var(--mau-card-shadow);
          font-weight: 700;
        }

        .mau-workflow-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.12);
          color: var(--mau-blue-strong);
          font-size: 0.8rem;
        }

        .mau-workflow-arrow {
          color: var(--mau-blue-strong);
          transform: rotate(-90deg);
        }

        .mau-video-section {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }

        .mau-video-section.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .mau-video-frame {
          aspect-ratio: 16 / 9;
          width: min(100%, 1020px);
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid var(--mau-border);
          border-radius: 22px;
          background: var(--mau-navy);
          box-shadow: var(--mau-card-shadow);
        }

        .mau-video-frame iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
        }

        .mau-video-fallback {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: min(100%, 1020px);
          margin: 0 auto;
          aspect-ratio: 16 / 9;
          padding: 24px;
          border: 1px solid var(--mau-border);
          border-radius: 22px;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #ffffff;
          text-align: center;
          box-shadow: var(--mau-card-shadow);
        }

        .mau-video-fallback-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(96, 165, 250, 0.2);
          font-size: 2rem;
          color: #dbeafe;
        }

        .mau-video-fallback h3 {
          margin: 0;
          font-size: clamp(1.5rem, 3vw, 2.2rem);
        }

        .mau-video-fallback p {
          margin: 0;
          max-width: 540px;
          line-height: 1.6;
          color: #cbd5e1;
        }

        .mau-video-actions {
          display: flex;
          justify-content: center;
          margin-top: 18px;
        }

        .mau-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }

        .mau-feature-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 240px;
          padding: 24px 22px;
          border: 1px solid var(--mau-border);
          border-radius: 20px;
          background: var(--mau-surface);
          box-shadow: var(--mau-card-shadow);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: mauFadeUp 0.55s ease both;
        }

        .mau-feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 40px rgba(15, 23, 42, 0.12);
        }

        .mau-feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 14px;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(15, 23, 42, 0.03);
        }

        .mau-feature-card h3 {
          margin: 0;
          font-size: 1.32rem;
          line-height: 1.3;
        }

        .mau-feature-card p {
          margin: 0;
          color: var(--mau-muted);
          line-height: 1.7;
        }

        .mau-cta-card {
          max-width: 980px;
          margin: 0 auto;
          padding: clamp(32px, 5vw, 54px) clamp(18px, 4vw, 36px);
          border: 1px solid var(--mau-border);
          border-radius: 28px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.12));
          text-align: center;
          box-shadow: var(--mau-card-shadow);
        }

        .mau-cta-card h2 {
          margin: 0 0 10px;
          font-size: clamp(2rem, 3vw, 3rem);
          line-height: 1.15;
          letter-spacing: -0.04em;
        }

        .mau-cta-card p {
          max-width: 620px;
          margin: 0 auto 24px;
          color: var(--mau-muted);
          line-height: 1.75;
          font-size: 1.05rem;
        }

        @keyframes mauFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 900px) {
          .mau-value-grid,
          .mau-feature-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mau-hero-content {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .mau-home-main {
            width: min(100% - 20px, 1200px);
            padding-bottom: 64px;
          }

          .mau-value-grid,
          .mau-feature-grid {
            grid-template-columns: 1fr;
          }

          .mau-workflow-flow {
            flex-direction: column;
          }

          .mau-workflow-arrow {
            transform: rotate(90deg);
          }

          .mau-hero-actions {
            flex-direction: column;
          }

          .mau-hero-primary,
          .mau-hero-secondary,
          .mau-primary-link,
          .mau-cta-button {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mau-video-section,
          .mau-feature-card,
          .mau-hero-primary,
          .mau-hero-secondary,
          .mau-primary-link,
          .mau-cta-button {
            transition: none;
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
