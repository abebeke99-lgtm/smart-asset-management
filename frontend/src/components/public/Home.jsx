import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { ArrowRight, Package, Wrench, Radio, BarChart3, Users, Lock, Landmark } from 'lucide-react';

const OFFICIAL_UNIVERSITY_IMAGE = 'https://mkau.edu.et/wordpress_e/wp-content/uploads/2025/05/photo_2025-05-23_06-54-52.jpg';
const UNIVERSITY_LOGO_FALLBACK = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTD7zNEgsJkgKAYvZNDkb5tckLn_KdLu_kHYaTLgqqwyhbv8cEsI8P5UYSk&s=10';

const Home = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const videoSectionRef = useRef(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [heroImage, setHeroImage] = useState(OFFICIAL_UNIVERSITY_IMAGE);

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
    heroTitle: 'Smart University Asset Management System',
    heroSubtitle: 'Efficiently manage university assets with cutting-edge technology. Track, maintain, and optimize your resources in real-time.',
    getStarted: 'Get Started',
    learnMore: 'Learn More',
    videoTitle: 'See Smart Asset Management in Action',
    videoSubtitle: 'Discover how the Smart University Asset Management System helps universities track, maintain, and manage their assets efficiently.',
    featuresTitle: 'Key Features',
    featuresSubtitle: 'Everything you need to manage your assets efficiently',
    assetManagement: 'Asset Management',
    assetManagementDesc: 'Register, track, and manage all university assets in one centralized platform with complete audit trails',
    maintenance: 'Maintenance Management',
    maintenanceDesc: 'Request, approve, and track maintenance tasks with real-time status updates and history',
    rfid: 'RFID Tracking',
    rfidDesc: 'Real-time asset location tracking using RFID technology with anomaly detection',
    reports: 'Reports & Analytics',
    reportsDesc: 'Generate comprehensive reports and visualize data with interactive dashboards',
    users: 'User Management',
    usersDesc: 'Role-based access control with secure authentication and granular permissions',
    security: 'Security & Compliance',
    securityDesc: 'Enterprise-grade security with encryption, audit logs, and compliance features',
    ctaTitle: 'Ready to Transform Your Asset Management?',
    ctaSubtitle: 'Modernize university asset operations with one centralized management platform.',
    ctaButton: 'Get Started'
  } : {
    heroTitle: 'ስማርት ዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    heroSubtitle: 'የቆርጠ ምግብር ቴክኖሎጂ በመጠቀም የዩኒቨርሲቲ ንብረቶችን በብቃት ያስተዳድሩ። ሃብቶችዎን በእውነት ጊዜ ይከታተሉ ፣ ይጠብቁ እና ያሻሽሉ።',
    getStarted: 'ጀምር',
    learnMore: 'ተጨማሪ ይወቁ',
    videoTitle: 'ስማርት ንብረት አስተዳደርን በተግባር ይመልከቱ',
    videoSubtitle: 'የስማርት ዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት ንብረቶችን እንዴት እንደሚከታተል፣ እንደሚጠግን እና እንደሚያስተዳድር ይመልከቱ።',
    featuresTitle: 'ቁልፍ ባህሪያት',
    featuresSubtitle: 'ንብረቶችዎን በብቃት ለማስተዳደር የሚያስፈልግዎት ሁሉም ነገር',
    assetManagement: 'ንብረት አስተዳደር',
    assetManagementDesc: 'ሁሉንም የዩኒቨርሲቲ ንብረቶች በአንድ ማዕከላዊ መድረክ ይመዝገቡ፣ ይከታተሉ እና ያስተዳድሩ',
    maintenance: 'ጥገና አስተዳደር',
    maintenanceDesc: 'የጥገና ጥያቄዎችን ያቅርቡ፣ ያፅድቁ እና በቅጽበት ሁኔታ ይከታተሉ',
    rfid: 'RFID ክትትል',
    rfidDesc: 'RFID ቴክኖሎጂን በመጠቀም የንብረት ቦታ በቅጽበት ይከታተሉ',
    reports: 'ሪፖርቶች እና ትንታኔዎች',
    reportsDesc: 'አጠቃላይ ሪፖርቶችን ያዘጋጁ እና መረጃን በይነተገናኝ ዳሽቦርዶች ያሳዩ',
    users: 'ተጠቃሚ አስተዳደር',
    usersDesc: 'ደህንነቱ የተጠበቀ ማረጋገጫ እና ዝርዝር ፍቃዶች ያሉት በሚና ላይ የተመሰረተ መዳረሻ ቁጥጥር',
    security: 'ደህንነት እና ተኳምር',
    securityDesc: 'ኢንክሪፕሽን ፣ ኦዲት ሎጆች እና ተኳምር ባህሪያት ያሉት ድርጅት-ደረጃ ደህንነት',
    ctaTitle: 'የንብረት አስተዳደርዎን የመቀየር ዝግጁ ነዎት?',
    ctaSubtitle: 'የዩኒቨርሲቲ ንብረት ስራዎችን በአንድ ማዕከላዊ መድረክ ያዘምኑ።',
    ctaButton: 'ጀምር'
  };

  const features = [
    { 
      icon: Package, 
      title: t.assetManagement, 
      desc: t.assetManagementDesc,
      color: '#3b82f6'
    },
    { 
      icon: Wrench, 
      title: t.maintenance, 
      desc: t.maintenanceDesc,
      color: '#f59e0b'
    },
    { 
      icon: Radio, 
      title: t.rfid, 
      desc: t.rfidDesc,
      color: '#8b5cf6'
    },
    { 
      icon: BarChart3, 
      title: t.reports, 
      desc: t.reportsDesc,
      color: '#10b981'
    },
    { 
      icon: Users, 
      title: t.users, 
      desc: t.usersDesc,
      color: '#ec4899'
    },
    { 
      icon: Lock, 
      title: t.security, 
      desc: t.securityDesc,
      color: '#ef4444'
    }
  ];

  return (
    <div className="bg-sky-50 text-slate-900" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-glow home-hero-glow-one" aria-hidden="true" />
          <div className="home-hero-glow home-hero-glow-two" aria-hidden="true" />
          <div className="home-hero-content">
            <div className="home-hero-copy">
              <p className="home-hero-kicker">Mekdela Amba University</p>
              <h1 id="home-hero-title">Smart University Asset Management System</h1>
              <p className="home-hero-description">Manage university assets efficiently with secure, transparent and centralized asset management.</p>
              <div className="home-hero-actions">
                <Link className="home-hero-primary" to="/login">{t.getStarted}<ArrowRight size={19} aria-hidden="true" /></Link>
                <Link className="home-hero-secondary" to="/about">{t.learnMore}</Link>
              </div>
            </div>

            <div className="home-hero-visual" aria-label="Mekdela Amba University campus presentation">
              <div className="home-hero-orbit home-hero-orbit-one" aria-hidden="true" />
              <div className="home-hero-orbit home-hero-orbit-two" aria-hidden="true" />
              <div className="home-hero-image-frame">
                <img
                  src={heroImage}
                  alt="Mekdela Amba University campus"
                  loading="eager"
                  onError={(event) => {
                    if (event.currentTarget.src !== UNIVERSITY_LOGO_FALLBACK) {
                      setHeroImage(UNIVERSITY_LOGO_FALLBACK);
                    }
                  }}
                />
                <div className="home-hero-image-overlay" aria-hidden="true" />
                <div className="home-hero-image-caption"><Landmark size={17} aria-hidden="true" /><span>MAU campus</span></div>
              </div>
              <span className="home-hero-dot home-hero-dot-one" aria-hidden="true" />
              <span className="home-hero-dot home-hero-dot-two" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Product demonstration */}
        <section ref={videoSectionRef} className={`home-video-section${videoVisible ? ' is-visible' : ''}`} aria-labelledby="home-video-title">
          <div className="home-section-heading">
            <h2 id="home-video-title">{t.videoTitle}</h2>
            <p>{t.videoSubtitle}</p>
          </div>
          {!videoError ? (
            <div className="home-video-frame">
              <iframe
                src="https://www.youtube.com/embed/QYgk-0KMnbg"
                title="Smart Asset Management demonstration"
                loading="lazy"
                onError={() => setVideoError(true)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="home-video-fallback" aria-live="polite">
              <div className="home-video-fallback-icon">▶</div>
              <h3>Demo unavailable right now</h3>
              <p>The embedded video could not load in this environment. You can still open the demo in a browser.</p>
            </div>
          )}
          <a className="home-video-link" href="https://www.youtube.com/watch?v=QYgk-0KMnbg" target="_blank" rel="noopener noreferrer">
            ▶ Watch Demo
          </a>
        </section>

        {/* Features Section */}
        <section style={{
          maxWidth: '1200px',
          margin: '80px auto',
          padding: '0 20px'
        }}>
          <h2 style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: '16px',
            color: isDark ? '#f1f5f9' : '#0f172a'
          }}>
            {t.featuresTitle}
          </h2>
          <p style={{
            textAlign: 'center',
            color: isDark ? '#94a3b8' : '#64748b',
            marginBottom: '48px',
            fontSize: '1.1rem'
          }}>
            {t.featuresSubtitle}
          </p>

          <div className="home-feature-grid grid grid-cols-1 md:grid-cols-3" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '32px'
          }}>
            {features.map((feature, idx) => {
              const IconComponent = feature.icon;
              return (
                <div className="home-feature-card"
                  key={idx}
                  style={{
                    background: isDark ? '#1e293b' : '#ffffff',
                    padding: '32px 24px',
                    borderRadius: '16px',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    transition: 'all 0.3s ease',
                    animation: `slideUp 0.6s ease ${idx * 0.1}s forwards`,
                    animationFillMode: 'both'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = isDark
                      ? '0 20px 40px rgba(0, 0, 0, 0.4)'
                      : '0 20px 40px rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    background: `${feature.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <IconComponent size={32} color={feature.color} />
                  </div>
                  
                  <h3 style={{
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    marginBottom: '12px',
                    color: isDark ? '#f1f5f9' : '#0f172a'
                  }}>
                    {feature.title}
                  </h3>
                  
                  <p style={{
                    color: isDark ? '#cbd5e1' : '#475569',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section style={{
          maxWidth: '900px',
          margin: '80px auto',
          padding: '60px 40px',
          background: isDark
            ? 'linear-gradient(135deg, #1e293b, #0f172a)'
            : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          borderRadius: '20px',
          textAlign: 'center',
          border: `1px solid ${isDark ? '#334155' : '#bae6fd'}`,
          animation: 'slideUp 0.8s ease 0.4s forwards',
          animationFillMode: 'both'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '16px',
            color: isDark ? '#f1f5f9' : '#0f172a'
          }}>
            {t.ctaTitle}
          </h2>
          
          <p style={{
            fontSize: '1.1rem',
            color: isDark ? '#cbd5e1' : '#475569',
            marginBottom: '32px',
            maxWidth: '600px',
            margin: '0 auto 32px'
          }}>
            {t.ctaSubtitle}
          </p>

          <Link
            to="/login"
            style={{
              padding: '16px 48px',
              background: 'linear-gradient(135deg, #2563eb, #1e40af)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '1.1rem',
              transition: 'all 0.3s ease',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-block'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {t.ctaButton}
          </Link>
        </section>
      </main>

      <style>{`
        .home-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: clamp(52px, 8vw, 96px) 20px clamp(64px, 9vw, 112px);
          color: #f8fafc;
          background: linear-gradient(120deg, #0f172a 0%, #123b67 56%, #0ea5e9 150%);
        }
        .home-hero-content {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
          align-items: center;
          gap: clamp(40px, 7vw, 104px);
          width: min(1240px, 100%);
          margin: 0 auto;
        }
        .home-hero-copy {
          max-width: 600px;
          animation: homeHeroCopyIn 0.75s ease both;
        }
        .home-hero-kicker {
          margin: 0 0 18px;
          color: #7dd3fc;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .home-hero-copy h1 {
          max-width: 680px;
          margin: 0;
          font-size: clamp(2.25rem, 5vw, 4.7rem);
          font-weight: 850;
          line-height: 1.03;
          letter-spacing: 0;
        }
        .home-hero-description {
          max-width: 540px;
          margin: 26px 0 0;
          color: #dbeafe;
          font-size: clamp(1rem, 1.8vw, 1.2rem);
          line-height: 1.7;
        }
        .home-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 34px;
        }
        .home-hero-primary,
        .home-hero-secondary {
          display: inline-flex;
          min-height: 48px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 12px 22px;
          border-radius: 8px;
          font-weight: 800;
          text-decoration: none;
          transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .home-hero-primary {
          color: #082f49;
          background: #fbbf24;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
        }
        .home-hero-secondary {
          color: #e0f2fe;
          border: 1px solid rgba(186, 230, 253, 0.58);
          background: rgba(15, 23, 42, 0.22);
        }
        .home-hero-primary:hover,
        .home-hero-secondary:hover {
          transform: translateY(-3px);
        }
        .home-hero-primary:hover { box-shadow: 0 16px 30px rgba(251, 191, 36, 0.28); }
        .home-hero-secondary:hover { background: rgba(255, 255, 255, 0.12); }
        .home-hero-primary:focus-visible,
        .home-hero-secondary:focus-visible {
          outline: 3px solid #bae6fd;
          outline-offset: 3px;
        }
        .home-hero-visual {
          position: relative;
          min-width: 0;
          padding: clamp(10px, 2vw, 30px);
          animation: homeHeroVisualIn 0.9s 0.12s ease both;
        }
        .home-hero-image-frame {
          position: relative;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.38);
          border-radius: 28px;
          background: #1e3a5f;
          box-shadow: 0 30px 70px rgba(2, 8, 23, 0.42);
        }
        .home-hero-image-frame img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          animation: homeHeroKenBurns 14s ease-in-out infinite alternate;
        }
        .home-hero-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 42%, rgba(2, 8, 23, 0.72) 100%);
        }
        .home-hero-image-caption {
          position: absolute;
          right: 20px;
          bottom: 18px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 7px;
          color: #f8fafc;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(8px);
          font-size: 0.82rem;
          font-weight: 700;
        }
        .home-hero-orbit {
          position: absolute;
          z-index: -1;
          border: 1px solid rgba(125, 211, 252, 0.38);
          border-radius: 50%;
          animation: homeHeroFloat 7s ease-in-out infinite;
        }
        .home-hero-orbit-one { inset: 0 4% 4% 0; transform: rotate(13deg); }
        .home-hero-orbit-two { inset: 9% 0 0 5%; border-color: rgba(251, 191, 36, 0.32); transform: rotate(-17deg); animation-delay: -2.5s; }
        .home-hero-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 0 7px rgba(251, 191, 36, 0.14); animation: homeHeroFloat 5s ease-in-out infinite; }
        .home-hero-dot-one { top: 5%; right: 5%; }
        .home-hero-dot-two { bottom: 7%; left: 2%; width: 7px; height: 7px; background: #67e8f9; animation-delay: -1.8s; }
        .home-hero-glow { position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; filter: blur(20px); }
        .home-hero-glow-one { top: -180px; left: -120px; width: 440px; height: 440px; background: rgba(14, 165, 233, 0.2); }
        .home-hero-glow-two { right: -140px; bottom: -240px; width: 520px; height: 520px; background: rgba(37, 99, 235, 0.25); }
        @keyframes homeHeroCopyIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes homeHeroVisualIn { from { opacity: 0; transform: translateX(28px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes homeHeroKenBurns { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes homeHeroFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(2deg); } }
        @media (max-width: 820px) {
          .home-hero-content { grid-template-columns: 1fr; gap: 36px; }
          .home-hero-copy { max-width: 720px; }
          .home-hero-visual { order: -1; width: min(680px, 100%); margin: 0 auto; }
        }
        @media (max-width: 480px) {
          .home-hero { padding-right: 16px; padding-left: 16px; }
          .home-hero-copy h1 { font-size: clamp(2rem, 12vw, 3rem); }
          .home-hero-actions > a { flex: 1 1 150px; }
          .home-hero-image-frame { border-radius: 18px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-hero-copy,
          .home-hero-visual,
          .home-hero-image-frame img,
          .home-hero-orbit,
          .home-hero-dot { animation: none; }
          .home-hero-primary,
          .home-hero-secondary { transition: none; }
        }
        .home-video-section {
          max-width: 1100px;
          margin: 24px auto 80px;
          padding: 0 20px;
          text-align: center;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .home-video-section.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .home-section-heading h2 {
          margin: 0 0 12px;
          color: ${isDark ? '#f1f5f9' : '#0f172a'};
          font-size: 2.2rem;
          font-weight: 800;
        }
        .home-section-heading p {
          max-width: 760px;
          margin: 0 auto 28px;
          color: ${isDark ? '#94a3b8' : '#64748b'};
          font-size: 1.1rem;
          line-height: 1.6;
        }
        .home-video-frame {
          aspect-ratio: 16 / 9;
          width: 100%;
          overflow: hidden;
          border-radius: 16px;
          background: #0f172a;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.22);
        }
        .home-video-frame iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .home-video-fallback {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          aspect-ratio: 16 / 9;
          width: 100%;
          border-radius: 16px;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          color: white;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.22);
          padding: 24px;
          text-align: center;
        }
        .home-video-fallback-icon {
          width: 70px;
          height: 70px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.2);
          font-size: 2rem;
          color: #bfdbfe;
        }
        .home-video-fallback h3 {
          margin: 0;
          font-size: 1.8rem;
        }
        .home-video-fallback p {
          margin: 0;
          max-width: 500px;
          line-height: 1.6;
          color: #cbd5e1;
        }
        .home-video-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 10px 18px;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .home-video-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.28);
        }
        .home-video-link:focus-visible,
        .home-feature-card:focus-within {
          outline: 3px solid rgba(37, 99, 235, 0.35);
          outline-offset: 3px;
        }
        .home-feature-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .home-feature-card:hover {
          transform: translateY(-8px);
          box-shadow: ${isDark ? '0 20px 40px rgba(0, 0, 0, 0.4)' : '0 20px 40px rgba(0, 0, 0, 0.08)'};
        }
        .home-feature-card:hover svg {
          transform: scale(1.08) rotate(-4deg);
        }
        .home-feature-card svg {
          transition: transform 0.25s ease;
        }
        @media (max-width: 900px) {
          .home-feature-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 600px) {
          .home-video-section {
            margin-bottom: 56px;
            padding: 0 16px;
          }
          .home-section-heading h2 {
            font-size: 1.7rem;
          }
          .home-section-heading p {
            font-size: 1rem;
          }
          .home-feature-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-video-section,
          .home-video-link,
          .home-feature-card,
          .home-feature-card svg {
            transition: none;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
