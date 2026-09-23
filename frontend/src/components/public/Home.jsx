import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { homepageImages } from '../../config/homepageImages';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  Landmark,
  LockKeyhole,
  Package,
  PlayCircle,
  Radio,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Users,
  UserCog,
  Wrench,
  Workflow
} from 'lucide-react';

const Home = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const videoSectionRef = useRef(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [liveStats, setLiveStats] = useState({ loading: true, error: false, stats: [] });

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

  const loadLiveStats = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    if (!token) {
      setLiveStats({
        loading: false,
        error: false,
        stats: [
          { label: 'Total Assets', value: 0, icon: Package },
          { label: 'Active Assignments', value: 0, icon: ClipboardList },
          { label: 'Maintenance Records', value: 0, icon: Wrench },
          { label: 'Registered Users', value: 0, icon: Users }
        ]
      });
      return;
    }

    setLiveStats({ loading: true, error: false, stats: [] });

    try {
      const [assetsResponse, maintenanceResponse, usersResponse] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 1000 } }).catch(() => ({ data: { assets: [], total: 0 } })),
        axios.get('/api/maintenance', { params: { limit: 1000 } }).catch(() => ({ data: { maintenance: [], total: 0 } })),
        axios.get('/api/users', { params: { limit: 1000 } }).catch(() => ({ data: { users: [], total: 0 } }))
      ]);

      const assets = Array.isArray(assetsResponse?.data?.assets)
        ? assetsResponse.data.assets
        : Array.isArray(assetsResponse?.data?.data)
          ? assetsResponse.data.data
          : [];
      const maintenance = Array.isArray(maintenanceResponse?.data?.maintenance)
        ? maintenanceResponse.data.maintenance
        : Array.isArray(maintenanceResponse?.data?.data)
          ? maintenanceResponse.data.data
          : [];
      const users = Array.isArray(usersResponse?.data?.users)
        ? usersResponse.data.users
        : Array.isArray(usersResponse?.data?.data)
          ? usersResponse.data.data
          : [];

      const stats = [
        { label: 'Total Assets', value: Number(assetsResponse?.data?.count || assetsResponse?.data?.total || assets.length || 0), icon: Package },
        { label: 'Active Assignments', value: Number(assets.filter((asset) => ['assigned', 'in_use', 'active'].includes(String(asset.status || '').trim().toLowerCase())).length || 0), icon: ClipboardList },
        { label: 'Maintenance Records', value: Number(maintenanceResponse?.data?.count || maintenanceResponse?.data?.total || maintenance.length || 0), icon: Wrench },
        { label: 'Registered Users', value: Number(usersResponse?.data?.count || usersResponse?.data?.total || users.length || 0), icon: Users }
      ];

      setLiveStats({ loading: false, error: false, stats });
    } catch (error) {
      setLiveStats({ loading: false, error: true, stats: [] });
    }
  };

  useEffect(() => {
    loadLiveStats();
  }, []);

  const t = useMemo(() => {
    if (language === 'en') {
      return {
        heroTitle: 'University Asset Management System',
        heroDescription: 'Manage university assets efficiently with secure, transparent, and centralized asset management.',
        getStarted: 'Get Started',
        explorePlatform: 'Explore Platform',
        learnMore: 'Learn More',
        heroKicker: 'MEKDELA AMBA UNIVERSITY',
        benefitTracking: 'Centralized Asset Tracking',
        benefitTrackingText: 'Track university assets from registration to disposal.',
        benefitSecurity: 'Secure Workflow Control',
        benefitSecurityText: 'Control access, assignment, transfer and approval workflows.',
        benefitMaintenance: 'Maintenance & Reporting Visibility',
        benefitMaintenanceText: 'Monitor maintenance activities, asset condition and reports.',
        campusTitle: 'Mekdela Amba University',
        campusSubtitle: 'Digital Asset Management for a Modern University',
        campusLabel: 'MAU CAMPUS',
        overview: 'One Platform for University Asset Operations',
        overviewText: 'Centralized asset records, controlled movement, maintenance visibility, secure access, and data-driven reporting.',
        whyMatters: 'Why it matters',
        valuePoints: [
          'Centralized asset records',
          'Controlled asset movement',
          'Maintenance visibility',
          'Role-based access',
          'Audit history',
          'Data-driven reporting'
        ],
        systemWorkflow: 'System workflow',
        workflowTitle: 'From Registration to Reporting',
        workflowSteps: ['Register', 'Assign', 'Track', 'Maintain', 'Verify', 'Report'],
        demoTitle: 'See University Asset Management in Action',
        demoSubtitle: 'Discover how the University Asset Management System helps universities track, maintain, and manage their assets efficiently.',
        watchDemo: 'Watch Demo',
        capabilities: 'Capabilities',
        featureTitle: 'Key Features',
        featureSubtitle: 'Everything needed to manage university assets securely and efficiently.',
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
        ctaButton: 'Get Started',
        liveStatsTitle: 'Live System Overview',
        liveStatsSubtitle: 'Real-time visibility into the university asset ecosystem.',
        unable: 'Unable to load live system data. Please try again.',
        retry: 'Retry',
        platformTitle: 'Explore the Platform',
        platformSubtitle: 'Integrated modules for the complete university asset lifecycle.',
        finalCta: 'Ready to modernize your asset operations?'
      };
    }

    return {
      heroTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
      heroDescription: 'የዩኒቨርሲቲ ንብረቶችን በደህንነት፣ በግልጽነት እና በማዕከላዊ አስተዳደር በብቃት ያስተዳድሩ።',
      getStarted: 'ጀምር',
      explorePlatform: 'መድረክ ይመልከቱ',
      learnMore: 'ተጨማሪ ይወቁ',
      heroKicker: 'መቅደላ አምባ ዩኒቨርሲቲ',
      benefitTracking: 'የተማከለ የንብረት ክትትል',
      benefitTrackingText: 'ንብረቶችን ከመመዝገብ እስከ መልቀቅ ይከታተሉ።',
      benefitSecurity: 'ደህንነቱ የተጠበቀ የሂደት ቁጥጥር',
      benefitSecurityText: 'የመዳረሻ፣ ምደባ፣ ማስተላለፊያ እና ማፅደቆችን ያቆጣጠሩ።',
      benefitMaintenance: 'የጥገና እና ሪፖርት እይታ',
      benefitMaintenanceText: 'የጥገና እንቅስቃሴ፣ የንብረት ሁኔታ እና ሪፖርቶችን ይከታተሉ።',
      campusTitle: 'መቅደላ አምባ ዩኒቨርሲቲ',
      campusSubtitle: 'ለዘመናዊ ዩኒቨርሲቲ የዲጂታል ንብረት አስተዳደር',
      campusLabel: 'MAU ካምፐስ',
      overview: 'ለዩኒቨርሲቲ ንብረት ስራዎች አንድ መድረክ',
      overviewText: 'የተማከለ ንብረት መዝገቦች፣ የቁጥጥር እንቅስቃሴ፣ የጥገና እይታ፣ የተጠባባቂ መዳረሻ እና የመረጃ ሪፖርት መስጫ።',
      whyMatters: 'ለምን አስፈላጊ ነው',
      valuePoints: [
        'የተማከለ የንብረት መዝገቦች',
        'የተቆጣጠረ የንብረት እንቅስቃሴ',
        'የጥገና እይታ',
        'የሚና ላይ የተመሰረተ መዳረሻ',
        'የኦዲት ታሪክ',
        'የመረጃ ላይ የተመሰረተ ሪፖርት'
      ],
      systemWorkflow: 'የስርዓት ሂደት',
      workflowTitle: 'ከመመዝገብ እስከ ሪፖርት ማድረግ',
      workflowSteps: ['መመዝገብ', 'ምደባ', 'ክትትል', 'ጥገና', 'ማረጋገጫ', 'ሪፖርት'],
      demoTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደርን በተግባር ይመልከቱ',
      demoSubtitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት ንብረቶችን እንዴት እንደሚከታተል፣ እንደሚጠግን እና እንደሚያስተዳድር ይመልከቱ።',
      watchDemo: 'ድሮ ይመልከቱ',
      capabilities: 'አቅሞች',
      featureTitle: 'ቁልፍ ባህሪያት',
      featureSubtitle: 'የዩኒቨርሲቲ ንብረቶችን በደህንነት እና በብቃት ለማስተዳደር የሚያስፈልጉ ሁሉ።',
      assetManagement: 'ንብረት አስተዳደር',
      assetManagementDesc: 'ንብረቶችን ከአንድ ማዕከላዊ መድረክ በኩል ይመዝገቡ፣ ይከታተሉ፣ ያስተካክሉ እና ያስተዳድሩ።',
      maintenance: 'ጥገና አስተዳደር',
      maintenanceDesc: 'የጥገና ጥያቄዎችን፣ የስራ ትዕዛዞችን፣ ቅድመ-ጥገናዎችን፣ ጥገናዎችን እና የአገልግሎት ታሪክን ያስተዳድሩ።',
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
      ctaButton: 'ጀምር',
      liveStatsTitle: 'የስርዓት እይታ',
      liveStatsSubtitle: 'በዩኒቨርሲቲ ንብረት ስርዓት ውስጥ የእውነተኛ ጊዜ እይታ።',
      unable: 'የስርዓት መረጃ መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      retry: 'እንደገና ይሞክሩ',
      platformTitle: 'መድረክ ይመልከቱ',
      platformSubtitle: 'ለሙሉ የዩኒቨርሲቲ ንብረት ዑደት የተዋሃዱ ሞጁሎች።',
      finalCta: 'የንብረት ስራዎችን ለመቀየር ዝግጁ ነዎት?'
    };
  }, [language]);

  const benefitCards = [
    { icon: Activity, title: t.benefitTracking, text: t.benefitTrackingText },
    { icon: LockKeyhole, title: t.benefitSecurity, text: t.benefitSecurityText },
    { icon: BarChart3, title: t.benefitMaintenance, text: t.benefitMaintenanceText }
  ];

  const featureItems = [
    { icon: Package, title: t.assetManagement, desc: t.assetManagementDesc, color: '#2563eb', image: homepageImages.assetManagement },
    { icon: Wrench, title: t.maintenance, desc: t.maintenanceDesc, color: '#f59e0b', image: homepageImages.maintenance },
    { icon: Radio, title: t.rfid, desc: t.rfidDesc, color: '#8b5cf6', image: homepageImages.rfid },
    { icon: BarChart3, title: t.reports, desc: t.reportsDesc, color: '#10b981', image: homepageImages.analytics },
    { icon: Users, title: t.users, desc: t.usersDesc, color: '#ec4899' },
    { icon: ShieldCheck, title: t.security, desc: t.securityDesc, color: '#ef4444', image: homepageImages.security }
  ];

  const platformModules = [
    { title: 'Assets', route: '/ict/assets', icon: Package },
    { title: 'Assignments', route: '/ict/assets/assign', icon: ClipboardList },
    { title: 'Departments', route: '/college', icon: Building2 },
    { title: 'RFID', route: '/ict/rfid', icon: ScanLine },
    { title: 'Maintenance', route: '/maintenance', icon: Wrench },
    { title: 'Support', route: '/ict/support', icon: UserCog },
    { title: 'Incidents', route: '/ict/incidents', icon: BellRing },
    { title: 'Reports', route: '/ict/reports', icon: FileSearch },
    { title: 'Analytics', route: '/admin/reports', icon: BarChart3 }
  ];

  const relationshipMap = [
    { label: 'Users', route: '/admin/users', icon: Users, x: 20, y: 6 },
    { label: 'Assets', route: '/ict/assets', icon: Package, x: 12, y: 28 },
    { label: 'Assignments', route: '/ict/assets/assign', icon: ClipboardList, x: 34, y: 28 },
    { label: 'Departments', route: '/college', icon: Building2, x: 52, y: 28 },
    { label: 'RFID', route: '/ict/rfid', icon: ScanLine, x: 12, y: 52 },
    { label: 'Transfers', route: '/admin/assets/transfer', icon: Workflow, x: 34, y: 52 },
    { label: 'Approvals', route: '/college/approvals', icon: CheckCircle2, x: 52, y: 52 },
    { label: 'Maintenance', route: '/maintenance', icon: Wrench, x: 28, y: 74 },
    { label: 'Support', route: '/ict/support', icon: UserCog, x: 48, y: 74 },
    { label: 'Incidents', route: '/ict/incidents', icon: BellRing, x: 64, y: 74 },
    { label: 'Reports', route: '/ict/reports', icon: FileSearch, x: 28, y: 90 },
    { label: 'Analytics', route: '/admin/reports', icon: BarChart3, x: 46, y: 90 }
  ];

  const workflowSteps = t.workflowSteps;

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

              <div className="mau-hero-benefits" aria-label="System highlights">
                {benefitCards.map(({ icon: Icon, title, text }) => (
                  <article key={title} className="mau-benefit-item">
                    <span className="mau-benefit-icon"><Icon size={18} aria-hidden="true" /></span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="mau-hero-visual" aria-label="University asset management dashboard overview">
              <div className="mau-hero-image-frame">
                <img
                  src={homepageImages.hero}
                  alt="University asset management dashboard illustration"
                  loading="eager"
                  className="mau-campus-image"
                />
                <div className="mau-hero-image-overlay" aria-hidden="true" />
                <div className="mau-hero-float-card mau-float-card-a">
                  <Database size={16} aria-hidden="true" />
                  <span>Asset data</span>
                </div>
                <div className="mau-hero-float-card mau-float-card-b">
                  <ScanLine size={16} aria-hidden="true" />
                  <span>RFID</span>
                </div>
                <div className="mau-hero-float-card mau-float-card-c">
                  <BarChart3 size={16} aria-hidden="true" />
                  <span>Reporting</span>
                </div>
                <div className="mau-hero-image-badge">
                  <Landmark size={16} aria-hidden="true" />
                  <span>{t.heroKicker}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mau-stats-section" aria-labelledby="live-stats-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">Live</span>
            <h2 id="live-stats-title">{t.liveStatsTitle}</h2>
            <p>{t.liveStatsSubtitle}</p>
          </div>

          {liveStats.loading ? (
            <div className="mau-stats-grid" aria-live="polite">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="mau-stat-card skeleton" aria-hidden="true">
                  <div className="mau-shimmer" />
                </div>
              ))}
            </div>
          ) : liveStats.error ? (
            <div className="mau-state-panel" role="alert">
              <p>{t.unable}</p>
              <button type="button" className="mau-inline-button" onClick={loadLiveStats}>
                <RefreshCw size={16} aria-hidden="true" />
                {t.retry}
              </button>
            </div>
          ) : (
            <div className="mau-stats-grid">
              {liveStats.stats.map(({ label, value, icon: Icon }) => (
                <article key={label} className="mau-stat-card">
                  <div className="mau-stat-icon"><Icon size={20} aria-hidden="true" /></div>
                  <div className="mau-stat-body">
                    <span className="mau-stat-label">{label}</span>
                    <strong>{Number(value || 0).toLocaleString()}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mau-campus-section" aria-labelledby="campus-title">
          <div className="mau-campus-visual">
            <img className="mau-campus-section-image" src={homepageImages.campus} alt="Mekdela Amba University campus overview" loading="lazy" />
            <div className="mau-campus-overlay" aria-hidden="true" />
            <span className="mau-campus-badge">{t.campusLabel}</span>
          </div>
          <div className="mau-campus-copy">
            <span className="mau-section-kicker">Campus</span>
            <h2 id="campus-title">{t.campusTitle}</h2>
            <p>{t.campusSubtitle}</p>
          </div>
        </section>

        <section className="mau-value-section" aria-labelledby="mau-value-title">
          <div className="mau-section-heading">
            <span className="mau-section-kicker">{t.whyMatters}</span>
            <h2 id="mau-value-title">{t.overview}</h2>
            <p>{t.overviewText}</p>
          </div>

          <div className="mau-value-grid">
            {t.valuePoints.map((point, index) => (
              <div key={point} className="mau-value-item">
                <span className="mau-value-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <span className="mau-value-title">{point}</span>
                  <p>Connected workflows, visibility, and governance across the university asset lifecycle.</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mau-modules-section" aria-labelledby="platform-modules-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">Modules</span>
            <h2 id="platform-modules-title">{t.platformTitle}</h2>
            <p>{t.platformSubtitle}</p>
          </div>

          <div className="mau-relationship-map" aria-label="Asset lifecycle relationship map">
            {relationshipMap.map(({ label, route, icon: Icon, x, y }) => (
              <Link
                key={label}
                to={route}
                className="mau-relation-node"
                style={{ left: `${x}%`, top: `${y}%` }}
                title={label}
              >
                <span className="mau-relation-icon"><Icon size={16} aria-hidden="true" /></span>
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mau-workflow-section" aria-labelledby="workflow-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">{t.systemWorkflow}</span>
            <h2 id="workflow-title">{t.workflowTitle}</h2>
          </div>

          <div className="mau-workflow-flow" aria-label="Asset workflow steps">
            {workflowSteps.map((step, index) => (
              <React.Fragment key={step}>
                <div className="mau-workflow-step" tabIndex={0} role="button" aria-label={`Workflow step ${index + 1}: ${step}`}>
                  <span className="mau-workflow-index">{String(index + 1).padStart(2, '0')}</span>
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
            <h2 id="home-video-title">{t.demoTitle}</h2>
            <p>{t.demoSubtitle}</p>
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
              <div className="mau-video-fallback-icon"><PlayCircle size={38} aria-hidden="true" /></div>
              <h3>Demo unavailable right now</h3>
              <p>The embedded video could not load in this environment. You can still open the demo in a browser.</p>
            </div>
          )}

          <div className="mau-video-actions">
            <a className="mau-primary-link" href="https://www.youtube.com/watch?v=QYgk-0KMnbg" target="_blank" rel="noopener noreferrer">
              <PlayCircle size={18} aria-hidden="true" />
              {t.watchDemo}
            </a>
          </div>
        </section>

        <section className="mau-features-section" aria-labelledby="features-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">{t.capabilities}</span>
            <h2 id="features-title">{t.featureTitle}</h2>
            <p>{t.featureSubtitle}</p>
          </div>

          <div className="mau-feature-grid">
            {featureItems.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <article key={feature.title} className="mau-feature-card" style={{ animationDelay: `${index * 80}ms` }}>
                  <div className="mau-feature-head">
                    <div className="mau-feature-icon" style={{ backgroundColor: `${feature.color}1A`, color: feature.color }}>
                      <IconComponent size={26} aria-hidden="true" />
                    </div>
                    <Link to={feature.title === t.assetManagement ? '/ict/assets' : feature.title === t.maintenance ? '/maintenance' : feature.title === t.rfid ? '/ict/rfid' : feature.title === t.reports ? '/ict/reports' : feature.title === t.users ? '/admin/users' : '/admin'} className="mau-feature-link" aria-label={`Open ${feature.title}`}>
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                  {feature.image ? <img src={feature.image} alt={feature.title} loading="lazy" className="mau-feature-image" /> : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mau-cta-section" aria-labelledby="cta-title">
          <div className="mau-cta-card">
            <span className="mau-cta-kicker">Smart university operations</span>
            <h2 id="cta-title">{t.ctaTitle}</h2>
            <p>{t.ctaSubtitle}</p>
            <div className="mau-cta-actions">
              <Link className="mau-cta-button" to="/login">{t.ctaButton}</Link>
              <Link className="mau-cta-secondary" to="/ict/assets">{t.explorePlatform}</Link>
            </div>
          </div>
        </section>

        <section className="mau-platform-grid" aria-labelledby="explore-platform-title">
          <div className="mau-section-heading centered">
            <span className="mau-section-kicker">Platform</span>
            <h2 id="explore-platform-title">{t.platformTitle}</h2>
          </div>

          <div className="mau-platform-cards">
            {platformModules.map(({ title, route, icon: Icon }) => (
              <Link key={title} to={route} className="mau-platform-card">
                <span className="mau-platform-icon"><Icon size={20} aria-hidden="true" /></span>
                <span>{title}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <style>{`
        .mau-home-page {
          --mau-bg: ${isDark ? '#08111f' : '#f4f7fb'};
          --mau-surface: ${isDark ? '#111827' : '#ffffff'};
          --mau-surface-strong: ${isDark ? '#0f172a' : '#eef4ff'};
          --mau-border: ${isDark ? '#263244' : '#dfe7f3'};
          --mau-text: ${isDark ? '#e5edf8' : '#0f172a'};
          --mau-muted: ${isDark ? '#9db0c7' : '#60708a'};
          --mau-primary: #1d4ed8;
          --mau-primary-soft: #dbeafe;
          --mau-secondary: #0ea5e9;
          --mau-success: #10b981;
          --mau-warning: #f59e0b;
          --mau-danger: #ef4444;
          --mau-shadow: ${isDark ? '0 22px 50px rgba(15, 23, 42, 0.42)' : '0 22px 48px rgba(15, 23, 42, 0.09)'};
          background: var(--mau-bg);
          color: var(--mau-text);
        }

        .mau-home-shell {
          width: min(1200px, calc(100% - 32px));
          margin: 0 auto;
        }

        .mau-home-header {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(16px);
          background: rgba(8, 17, 31, 0.5);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .mau-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 76px;
        }

        .mau-home-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #f8fbff;
          text-decoration: none;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .mau-home-brand img {
          width: 42px;
          height: 42px;
          object-fit: contain;
          border-radius: 12px;
        }

        .mau-home-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .mau-home-nav a,
        .mau-home-footer a {
          color: rgba(255, 255, 255, 0.82);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .mau-home-nav a:hover,
        .mau-home-footer a:hover {
          color: #ffffff;
        }

        .mau-home-login {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          text-decoration: none;
          font-weight: 700;
        }

        .mau-home-main {
          width: min(1200px, calc(100% - 32px));
          margin: 0 auto;
          padding: 30px 0 80px;
        }

        .mau-hero {
          padding: 18px 0 0;
        }

        .mau-hero-content {
          display: grid;
          grid-template-columns: minmax(0, 1.02fr) minmax(300px, 0.98fr);
          gap: clamp(30px, 5vw, 64px);
          align-items: center;
          padding: clamp(24px, 4vw, 52px) clamp(16px, 3vw, 30px);
          border: 1px solid var(--mau-border);
          border-radius: 30px;
          background: linear-gradient(135deg, rgba(29, 78, 216, 0.10), rgba(14, 165, 233, 0.08), rgba(255,255,255,0.04));
          box-shadow: var(--mau-shadow);
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
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--mau-primary);
        }

        .mau-hero-copy h1 {
          margin: 0;
          font-size: clamp(2.5rem, 5vw, 4.4rem);
          line-height: 1.03;
          letter-spacing: -0.05em;
        }

        .mau-hero-description {
          margin: 18px 0 0;
          max-width: 560px;
          font-size: 1.08rem;
          line-height: 1.75;
          color: var(--mau-muted);
        }

        .mau-hero-actions,
        .mau-cta-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 28px;
        }

        .mau-hero-primary,
        .mau-hero-secondary,
        .mau-primary-link,
        .mau-cta-button,
        .mau-cta-secondary,
        .mau-inline-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 12px;
          font-weight: 700;
          text-decoration: none;
          border: 1px solid transparent;
        }

        .mau-hero-primary,
        .mau-primary-link,
        .mau-cta-button {
          background: linear-gradient(135deg, var(--mau-primary), var(--mau-secondary));
          color: #ffffff;
          box-shadow: 0 18px 34px rgba(29, 78, 216, 0.22);
        }

        .mau-hero-secondary,
        .mau-cta-secondary {
          border-color: var(--mau-border);
          background: transparent;
          color: var(--mau-text);
        }

        .mau-hero-button:hover,
        .mau-hero-primary:hover,
        .mau-hero-secondary:hover,
        .mau-primary-link:hover,
        .mau-cta-button:hover,
        .mau-cta-secondary:hover,
        .mau-inline-button:hover {
          transform: none;
        }

        .mau-hero-benefits {
          display: grid;
          gap: 14px;
          margin-top: 30px;
        }

        .mau-benefit-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid var(--mau-border);
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
        }

        .mau-benefit-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          color: var(--mau-primary);
          background: var(--mau-primary-soft);
        }

        .mau-benefit-item h3 {
          margin: 0 0 4px;
          font-size: 1rem;
        }

        .mau-benefit-item p {
          margin: 0;
          color: var(--mau-muted);
          line-height: 1.6;
          font-size: 0.92rem;
        }

        .mau-hero-visual {
          display: flex;
          justify-content: center;
        }

        .mau-hero-image-frame {
          position: relative;
          width: min(100%, 560px);
          aspect-ratio: 4 / 3;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.22);
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
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.04), rgba(15, 23, 42, 0.56));
        }

        .mau-hero-float-card {
          position: absolute;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.56);
          color: white;
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
        }

        .mau-float-card-a { left: 22px; top: 22px; }
        .mau-float-card-b { right: 22px; top: 26%; }
        .mau-float-card-c { left: 18%; bottom: 22px; }

        .mau-hero-image-badge {
          position: absolute;
          right: 18px;
          bottom: 18px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.52);
          border: 1px solid rgba(255,255,255,0.12);
          color: #ffffff;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
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
          color: var(--mau-muted);
          line-height: 1.7;
        }

        .mau-stats-section,
        .mau-campus-section,
        .mau-value-section,
        .mau-modules-section,
        .mau-workflow-section,
        .mau-video-section,
        .mau-features-section,
        .mau-platform-grid,
        .mau-cta-section {
          padding-top: 80px;
        }

        .mau-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .mau-stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          border: 1px solid var(--mau-border);
          border-radius: 22px;
          background: var(--mau-surface);
          box-shadow: var(--mau-shadow);
        }

        .mau-stat-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          color: var(--mau-primary);
          background: var(--mau-primary-soft);
        }

        .mau-stat-label {
          display: block;
          color: var(--mau-muted);
          font-size: 0.8rem;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .mau-stat-body strong {
          display: block;
          font-size: clamp(1.5rem, 2vw, 2.15rem);
          letter-spacing: -0.04em;
        }

        .mau-state-panel {
          padding: 22px;
          border: 1px solid var(--mau-border);
          border-radius: 18px;
          background: var(--mau-surface);
          text-align: center;
          box-shadow: var(--mau-shadow);
        }

        .mau-state-panel p {
          margin: 0 0 18px;
          color: var(--mau-muted);
          line-height: 1.7;
        }

        .mau-inline-button {
          border-color: var(--mau-border);
          background: transparent;
          color: var(--mau-text);
        }

        .mau-campus-section {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          gap: 26px;
          align-items: center;
        }

        .mau-campus-visual {
          position: relative;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid var(--mau-border);
          box-shadow: var(--mau-shadow);
          min-height: 360px;
        }

        .mau-campus-section-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .mau-campus-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.3));
        }

        .mau-campus-badge {
          position: absolute;
          left: 18px;
          top: 18px;
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.8);
          border: 1px solid rgba(148, 163, 184, 0.28);
          color: var(--mau-text);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 800;
        }

        .mau-campus-copy h2 {
          margin: 0 0 14px;
          font-size: clamp(2rem, 3vw, 3rem);
          letter-spacing: -0.04em;
        }

        .mau-campus-copy p {
          margin: 0;
          color: var(--mau-muted);
          line-height: 1.8;
          font-size: 1.05rem;
        }

        .mau-value-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .mau-value-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          padding: 20px 18px;
          border: 1px solid var(--mau-border);
          border-radius: 18px;
          background: var(--mau-surface);
          box-shadow: var(--mau-shadow);
        }

        .mau-value-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--mau-primary-soft);
          color: var(--mau-primary);
          font-weight: 800;
        }

        .mau-value-title {
          display: block;
          margin-bottom: 8px;
          font-size: 1.03rem;
          font-weight: 700;
        }

        .mau-value-item p {
          margin: 0;
          color: var(--mau-muted);
          line-height: 1.6;
          font-size: 0.92rem;
        }

        .mau-relationship-map {
          position: relative;
          min-height: 440px;
          border: 1px solid var(--mau-border);
          border-radius: 28px;
          background: linear-gradient(135deg, rgba(29, 78, 216, 0.04), rgba(14, 165, 233, 0.02));
          overflow: hidden;
          box-shadow: var(--mau-shadow);
        }

        .mau-relationship-map::before,
        .mau-relationship-map::after {
          content: "";
          position: absolute;
          inset: 12% 18% 18% 18%;
          border: 1.5px dashed rgba(96, 165, 250, 0.42);
          border-radius: 28px;
        }

        .mau-relationship-map::after {
          inset: 18% 34% 22% 34%;
          border-style: solid;
          border-color: rgba(96,165,250,0.18);
        }

        .mau-relation-node {
          position: absolute;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid var(--mau-border);
          background: rgba(255,255,255,0.88);
          color: var(--mau-text);
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 700;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
        }

        .mau-relation-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: var(--mau-primary-soft);
          color: var(--mau-primary);
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
          gap: 10px;
          min-width: 132px;
          min-height: 70px;
          padding: 12px 18px;
          border: 1px solid var(--mau-border);
          border-radius: 16px;
          background: var(--mau-surface);
          box-shadow: var(--mau-shadow);
          font-weight: 700;
          cursor: pointer;
        }

        .mau-workflow-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(29, 78, 216, 0.1);
          color: var(--mau-primary);
          font-size: 0.74rem;
        }

        .mau-workflow-arrow {
          color: var(--mau-primary);
          transform: rotate(-90deg);
        }

        .mau-video-section {
          opacity: 0;
          transform: translateY(22px);
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
          border-radius: 22px;
          border: 1px solid var(--mau-border);
          box-shadow: var(--mau-shadow);
          background: #0f172a;
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
          border-radius: 22px;
          border: 1px solid var(--mau-border);
          background: linear-gradient(135deg, #0f172a, #0b1d36);
          color: #ffffff;
          text-align: center;
          box-shadow: var(--mau-shadow);
        }

        .mau-video-fallback-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.18);
        }

        .mau-video-fallback h3 {
          margin: 0;
          font-size: clamp(1.5rem, 3vw, 2.2rem);
        }

        .mau-video-fallback p {
          margin: 0;
          max-width: 540px;
          line-height: 1.6;
          color: rgba(255,255,255,0.8);
        }

        .mau-video-actions {
          display: flex;
          justify-content: center;
          margin-top: 18px;
        }

        .mau-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .mau-feature-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 320px;
          padding: 22px 22px 18px;
          border: 1px solid var(--mau-border);
          border-radius: 22px;
          background: var(--mau-surface);
          box-shadow: var(--mau-shadow);
          animation: mauFadeUp 0.55s ease both;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .mau-feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 26px 44px rgba(15, 23, 42, 0.12);
        }

        .mau-feature-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mau-feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.04);
        }

        .mau-feature-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(29, 78, 216, 0.08);
          color: var(--mau-primary);
          text-decoration: none;
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

        .mau-feature-image {
          display: block;
          width: 100%;
          height: 150px;
          object-fit: cover;
          border-radius: 14px;
          border: 1px solid var(--mau-border);
          background: #f8fafc;
        }

        .mau-cta-card {
          max-width: 1000px;
          margin: 0 auto;
          padding: clamp(32px, 5vw, 56px) clamp(18px, 4vw, 36px);
          border-radius: 28px;
          border: 1px solid var(--mau-border);
          background: linear-gradient(135deg, rgba(29, 78, 216, 0.08), rgba(14, 165, 233, 0.08));
          box-shadow: var(--mau-shadow);
          text-align: center;
        }

        .mau-cta-card h2 {
          margin: 0 0 12px;
          font-size: clamp(2rem, 3vw, 3.1rem);
          line-height: 1.14;
          letter-spacing: -0.04em;
        }

        .mau-cta-card p {
          max-width: 640px;
          margin: 0 auto 24px;
          color: var(--mau-muted);
          line-height: 1.75;
          font-size: 1.04rem;
        }

        .mau-platform-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .mau-platform-card {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 72px;
          padding: 16px 18px;
          border-radius: 16px;
          border: 1px solid var(--mau-border);
          background: var(--mau-surface);
          color: var(--mau-text);
          text-decoration: none;
          box-shadow: var(--mau-shadow);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .mau-platform-card:hover {
          transform: translateY(-3px);
          border-color: rgba(29, 78, 216, 0.28);
        }

        .mau-platform-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: var(--mau-primary-soft);
          color: var(--mau-primary);
        }

        .mau-home-footer {
          margin-top: 40px;
          padding: 34px 0 48px;
          background: rgba(15, 23, 42, 0.96);
          color: rgba(255,255,255,0.82);
        }

        .mau-footer-inner {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 30px;
        }

        .mau-home-footer h3,
        .mau-home-footer h4 {
          margin: 0 0 14px;
          color: #ffffff;
        }

        .mau-home-footer p,
        .mau-home-footer li {
          color: rgba(255,255,255,0.72);
          line-height: 1.7;
        }

        .mau-home-footer ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }

        .mau-shimmer {
          position: relative;
          width: 100%;
          height: 112px;
          border-radius: 16px;
          background: linear-gradient(90deg, rgba(148, 163, 184, 0.12), rgba(148, 163, 184, 0.28), rgba(148, 163, 184, 0.12));
          background-size: 200% 100%;
          animation: mauShimmer 1.4s linear infinite;
        }

        @keyframes mauShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @keyframes mauFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes mauFloatCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes mauFloatImage {
          0% { transform: scale(1.02) translateY(0); }
          100% { transform: scale(1.06) translateY(-8px); }
        }

        @media (max-width: 1000px) {
          .mau-home-nav { display: none; }
          .mau-stats-grid,
          .mau-feature-grid,
          .mau-platform-cards,
          .mau-value-grid,
          .mau-footer-inner {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mau-campus-section,
          .mau-hero-content {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .mau-home-main,
          .mau-home-shell {
            width: min(100% - 20px, 1200px);
          }

          .mau-stats-grid,
          .mau-feature-grid,
          .mau-platform-cards,
          .mau-value-grid,
          .mau-footer-inner {
            grid-template-columns: 1fr;
          }

          .mau-hero-actions,
          .mau-cta-actions {
            flex-direction: column;
          }

          .mau-hero-primary,
          .mau-hero-secondary,
          .mau-primary-link,
          .mau-cta-button,
          .mau-cta-secondary,
          .mau-inline-button {
            width: 100%;
          }

          .mau-workflow-flow {
            flex-direction: column;
          }

          .mau-workflow-arrow {
            transform: rotate(90deg);
          }

          .mau-relationship-map {
            min-height: 520px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mau-campus-image,
          .mau-campus-section-image,
          .mau-hero-float-card,
          .mau-feature-card,
          .mau-video-section,
          .mau-hero-primary,
          .mau-hero-secondary,
          .mau-primary-link,
          .mau-cta-button,
          .mau-cta-secondary,
          .mau-inline-button,
          .mau-platform-card,
          .mau-relation-node,
          .mau-workflow-step {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
