import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { homepageImages } from '../../config/homepageImages';
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  ArrowLeftRight,
  ScanSearch,
  Wrench,
  RotateCcw,
  UserRoundCog,
  Package,
  QrCode,
  Users,
  WalletCards,
  Database,
  ShieldCheck,
  Network,
  ArrowRight,
  CircleHelp,
  Mail,
  Info,
  KeyRound,
  FileClock
} from 'lucide-react';

const pageText = {
  en: {
    systemTitle: 'University Asset Management System',
    heroEyebrow: 'University asset operations',
    lead: 'A central platform to manage university assets, monitor lifecycle activity, coordinate responsibility, and support operational accountability across departments and colleges.',
    featureList: 'Core system features',
    login: 'Login',
    learnMore: 'Learn More',
    overview: 'System overview',
    panelTitle: 'University Asset Operations',
    coreFunction: 'Core function',
    lifecycle: 'Complete asset lifecycle oversight',
    managedBy: 'Managed by',
    teams: 'Administration, departments, finance, ICT, maintenance',
    purpose: 'Purpose',
    purposeText: 'Improve accountability, visibility, and reporting',
    highlights: ['Asset registration', 'Asset tracking', 'Assignment', 'Transfer', 'Verification', 'Maintenance', 'Returns', 'Financial management', 'Reporting']
  },
  am: {
    systemTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    heroEyebrow: 'የዩኒቨርሲቲ ንብረት አስተዳደር',
    lead: 'በዩኒቨርሲቲው ያሉ ንብረቶችን ለማስተዳደር፣ የንብረት የሕይወት ዑደትን ለመከታተል፣ ኃላፊነትን ለማስተባበር እና በኮሌጆችና በክፍሎች ውስጥ ተጠያቂነትን ለማጠናከር የተዘጋጀ ማዕከላዊ መድረክ።',
    featureList: 'የስርዓቱ ዋና ተግባራት',
    login: 'ግባ',
    learnMore: 'ተጨማሪ ይወቁ',
    overview: 'የስርዓቱ አጠቃላይ እይታ',
    panelTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር',
    coreFunction: 'ዋና ተግባር',
    lifecycle: 'የንብረትን ሙሉ የሕይወት ዑደት መከታተል',
    managedBy: 'በኃላፊነት የሚያስተዳድሩት',
    teams: 'አስተዳደር፣ ክፍሎች፣ ፋይናንስ፣ አይሲቲ እና ጥገና',
    purpose: 'ዓላማ',
    purposeText: 'ተጠያቂነትን፣ ግልጽነትን እና ሪፖርት አዘገጃጀትን ማሻሻል',
    highlights: ['ንብረት መመዝገብ', 'ንብረት መከታተል', 'የንብረት ምደባ', 'የንብረት ማስተላለፍ', 'ማረጋገጫ', 'ጥገና', 'መመለስ', 'የፋይናንስ አስተዳደር', 'ሪፖርት አዘገጃጀት']
  }
};

const workflowIcons = [PackagePlus, ClipboardCheck, Users, ArrowLeftRight, ScanSearch, Wrench, RotateCcw];
const roleIcons = [UserRoundCog, Package, QrCode, Users, Building2, WalletCards, Wrench];
const benefitIcons = [Database, ClipboardCheck, Network, FileClock];
const securityIcons = [KeyRound, ShieldCheck, FileClock];

const additionalText = {
  en: {
    benefitsTitle: 'Why Departments Choose This System',
    benefits: ['Centralized asset records', 'Clear responsibility and accountability', 'Coordination across departments', 'Operational and financial reporting'],
    workflowTitle: 'How the System Works',
    workflow: ['Register', 'Receive', 'Assign', 'Transfer', 'Verify', 'Maintain', 'Return / Dispose'],
    viewWorkflow: 'View the full asset lifecycle',
    rolesTitle: 'Built for Every Role',
    roles: ['Admin', 'Store Manager', 'ICT Officer', 'Department Head', 'College Manager', 'Finance', 'Maintenance'],
    viewRoles: 'View role responsibilities',
    securityTitle: 'Secure by Design',
    security: ['Secure sign-in', 'Role-based access', 'Administrative and financial audit logs'],
    trustTitle: 'Trusted by Mekdela Amba University',
    trustText: 'A shared platform for university asset records and the operational workflows that support them.',
    quickLinksTitle: 'Quick Links',
    help: 'Help',
    contact: 'Contact',
    about: 'About Us',
    finalTitle: 'Ready to Get Started?',
    finalText: 'Sign in to continue to your university asset workspace.',
    login: 'Login'
  },
  am: {
    benefitsTitle: 'ክፍሎች ይህን ስርዓት ለምን ይመርጣሉ?',
    benefits: ['ማዕከላዊ የንብረት መዝገቦች', 'ግልጽ ኃላፊነትና ተጠያቂነት', 'በክፍሎች መካከል ቅንጅት', 'የስራና የፋይናንስ ሪፖርት'],
    workflowTitle: 'ስርዓቱ እንዴት ይሰራል?',
    workflow: ['መመዝገብ', 'መቀበል', 'መመደብ', 'ማስተላለፍ', 'ማረጋገጥ', 'ጥገና', 'መመለስ / ማስወገድ'],
    viewWorkflow: 'ሙሉውን የንብረት የሕይወት ዑደት ይመልከቱ',
    rolesTitle: 'ለሁሉም ሚናዎች የተዘጋጀ',
    roles: ['አስተዳዳሪ', 'የመጋዘን ኃላፊ', 'የአይሲቲ ባለሙያ', 'የክፍል ኃላፊ', 'የኮሌጅ አስተዳዳሪ', 'ፋይናንስ', 'ጥገና'],
    viewRoles: 'የሚናዎችን ኃላፊነት ይመልከቱ',
    securityTitle: 'ደህንነት ከመሠረቱ የተካተተ',
    security: ['ደህንነቱ የተጠበቀ መግቢያ', 'በሚና ላይ የተመሰረተ ፈቃድ', 'የአስተዳደርና የፋይናንስ ኦዲት መዝገቦች'],
    trustTitle: 'በመቅደላ አምባ ዩኒቨርሲቲ የተደገፈ',
    trustText: 'የዩኒቨርሲቲ ንብረት መዝገቦችንና ተያያዥ የስራ ሂደቶችን በአንድ ቦታ የሚያቀናጅ መድረክ።',
    quickLinksTitle: 'ፈጣን አገናኞች',
    help: 'እገዛ',
    contact: 'ያግኙን',
    about: 'ስለ እኛ',
    finalTitle: 'ለመጀመር ዝግጁ ነዎት?',
    finalText: 'ወደ የዩኒቨርሲቲው የንብረት መድረክዎ ለመቀጠል ይግቡ።',
    login: 'ግባ'
  }
};

const Home = () => {
  const { language } = useLanguage();
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const text = pageText[language] || pageText.en;
  const additional = additionalText[language] || additionalText.en;
  const heroImages = homepageImages.slides;

  useEffect(() => {
    if (heroImages.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const rotation = window.setInterval(() => {
      setActiveHeroImage((current) => (current + 1) % heroImages.length);
    }, 5000);

    return () => window.clearInterval(rotation);
  }, [heroImages.length]);

  return (
  <main className="uam-home-page">
    <section className="uam-hero" aria-labelledby="home-title">
      <div className="uam-hero-media" aria-hidden="true">
        {heroImages.map((image, index) => (
          <img
            key={image}
            className={`uam-hero-image${index === activeHeroImage ? ' is-active' : ''}`}
            src={image}
            alt=""
          />
        ))}
      </div>
      <div className="uam-hero-shell">
        <div className="uam-hero-copy">
          <span className="uam-eyebrow">{text.heroEyebrow}</span>
          <h1 id="home-title">{text.systemTitle}</h1>
          <p className="uam-lead">
            {text.lead}
          </p>

          <ul className="uam-highlight-list" aria-label={text.featureList}>
            {text.highlights.map((item) => (
              <li key={item}><CheckCircle2 size={18} aria-hidden="true" /> {item}</li>
            ))}
          </ul>

          <div className="uam-cta-row">
            <Link className="uam-primary-button" to="/login">{text.login}</Link>
            <Link className="uam-secondary-button" to="/about">{text.learnMore}</Link>
          </div>
        </div>

        <div className="uam-hero-panel" aria-label={text.overview}>
          <div className="uam-panel-header">
            <Building2 size={18} aria-hidden="true" />
            <span>{text.panelTitle}</span>
          </div>
          <div className="uam-panel-stack">
            <div className="uam-panel-card">
              <span className="uam-panel-label">{text.coreFunction}</span>
              <strong>{text.lifecycle}</strong>
            </div>
            <div className="uam-panel-card">
              <span className="uam-panel-label">{text.managedBy}</span>
              <strong>{text.teams}</strong>
            </div>
            <div className="uam-panel-card">
              <span className="uam-panel-label">{text.purpose}</span>
              <strong>{text.purposeText}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="uam-section uam-benefits-section" aria-labelledby="uam-benefits-title">
      <div className="uam-shell">
        <div className="uam-section-heading"><h2 id="uam-benefits-title">{additional.benefitsTitle}</h2></div>
        <div className="uam-card-grid uam-benefit-grid">
          {additional.benefits.map((benefit, index) => {
            const Icon = benefitIcons[index];
            return <article className="uam-card uam-benefit" key={benefit}><span className="uam-card-icon"><Icon size={21} aria-hidden="true" /></span><h3>{benefit}</h3></article>;
          })}
        </div>
      </div>
    </section>

    <section className="uam-section uam-surface" aria-labelledby="uam-workflow-title">
      <div className="uam-shell">
        <div className="uam-section-heading"><h2 id="uam-workflow-title">{additional.workflowTitle}</h2></div>
        <ol className="uam-workflow-list">
          {additional.workflow.map((step, index) => {
            const Icon = workflowIcons[index];
            return <li className="uam-workflow-step" key={step}><span className="uam-card-icon"><Icon size={20} aria-hidden="true" /></span><strong>{step}</strong></li>;
          })}
        </ol>
        <Link className="uam-section-link" to="/about#lifecycle">{additional.viewWorkflow}<ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>

    <section className="uam-section" aria-labelledby="uam-roles-title">
      <div className="uam-shell">
        <div className="uam-section-heading"><h2 id="uam-roles-title">{additional.rolesTitle}</h2></div>
        <div className="uam-role-list">
          {additional.roles.map((role, index) => {
            const Icon = roleIcons[index];
            return <div className="uam-role-item" key={role}><Icon size={21} aria-hidden="true" /><span>{role}</span></div>;
          })}
        </div>
        <Link className="uam-section-link" to="/about#about-roles-title">{additional.viewRoles}<ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>

    <section className="uam-section uam-security-section" aria-labelledby="uam-security-title">
      <div className="uam-shell">
        <div className="uam-section-heading"><h2 id="uam-security-title">{additional.securityTitle}</h2></div>
        <div className="uam-security-list">
          {additional.security.map((item, index) => {
            const Icon = securityIcons[index];
            return <div className="uam-security-item" key={item}><Icon size={21} aria-hidden="true" /><span>{item}</span></div>;
          })}
        </div>
      </div>
    </section>

    <section className="uam-trust-section" aria-labelledby="uam-trust-title">
      <div className="uam-shell uam-trust-content">
        <Building2 size={30} aria-hidden="true" />
        <div><h2 id="uam-trust-title">{additional.trustTitle}</h2><p>{additional.trustText}</p></div>
      </div>
    </section>

    <section className="uam-section uam-surface" aria-labelledby="uam-links-title">
      <div className="uam-shell">
        <div className="uam-section-heading"><h2 id="uam-links-title">{additional.quickLinksTitle}</h2></div>
        <div className="uam-quick-links">
          <Link to="/help"><CircleHelp size={20} aria-hidden="true" /><span>{additional.help}</span><ArrowRight size={17} aria-hidden="true" /></Link>
          <Link to="/contact"><Mail size={20} aria-hidden="true" /><span>{additional.contact}</span><ArrowRight size={17} aria-hidden="true" /></Link>
          <Link to="/about"><Info size={20} aria-hidden="true" /><span>{additional.about}</span><ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>

    <section className="uam-final-cta" aria-labelledby="uam-final-title">
      <div className="uam-shell uam-final-content">
        <div><h2 id="uam-final-title">{additional.finalTitle}</h2><p>{additional.finalText}</p></div>
        <Link className="uam-primary-button" to="/login">{additional.login}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
    </section>

    <style>{`
      .uam-home-page {
        color: #17212b;
        background: #f5f7f9;
      }

      .uam-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        min-height: 640px;
        background: #0f172a;
        color: #fff;
      }

      .uam-hero::after {
        position: absolute;
        inset: 0;
        z-index: -1;
        background: linear-gradient(90deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.68) 48%, rgba(15,23,42,0.5) 100%);
        content: '';
      }

      .uam-hero-media {
        position: absolute;
        inset: 0;
        z-index: -2;
        background: #0f172a;
      }

      .uam-hero-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transform: scale(1.02);
        transition: opacity 900ms ease, transform 6s ease;
      }

      .uam-hero-image.is-active {
        opacity: 1;
        transform: scale(1);
      }

      @media (prefers-reduced-motion: reduce) {
        .uam-hero-image {
          transition: none;
          transform: none;
        }
      }

      .uam-hero-shell {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100% - 36px));
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr);
        gap: 40px;
        align-items: center;
        padding: clamp(72px, 10vw, 120px) 0;
      }

      .uam-eyebrow {
        display: inline-block;
        margin-bottom: 16px;
        color: #93c5fd;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .uam-hero-copy h1 {
        margin: 0;
        font-size: clamp(2.5rem, 5vw, 5rem);
        line-height: 1.04;
        letter-spacing: -0.05em;
      }

      .uam-lead {
        margin: 22px 0 28px;
        max-width: 700px;
        color: rgba(255,255,255,0.82);
        font-size: 1.13rem;
        line-height: 1.75;
      }

      .uam-highlight-list {
        list-style: none;
        padding: 0;
        margin: 0 0 30px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, max-content));
        gap: 12px 22px;
      }

      .uam-highlight-list li {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: #e5eefb;
        font-weight: 600;
      }

      .uam-cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }

      .uam-primary-button,
      .uam-secondary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 22px;
        border-radius: 12px;
        font-weight: 800;
        text-decoration: none;
        transition: transform 0.18s ease, opacity 0.18s ease;
      }

      .uam-primary-button {
        background: #ffffff;
        color: #17212b;
      }

      .uam-secondary-button {
        border: 1px solid rgba(255,255,255,0.5);
        color: #ffffff;
        background: rgba(255,255,255,0.08);
      }

      .uam-primary-button:hover,
      .uam-secondary-button:hover {
        transform: translateY(-1px);
      }

      .uam-hero-panel {
        background: rgba(15, 23, 42, 0.42);
        border: 1px solid rgba(148, 163, 184, 0.34);
        border-radius: 22px;
        padding: 22px;
        box-shadow: 0 20px 42px rgba(15, 23, 42, 0.18);
      }

      .uam-panel-header {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        color: #dbeafe;
        font-weight: 700;
      }

      .uam-panel-stack {
        display: grid;
        gap: 16px;
      }

      .uam-panel-card {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(148, 163, 184, 0.4);
        border-radius: 16px;
        padding: 18px 18px 16px;
      }

      .uam-panel-label {
        display: block;
        margin-bottom: 8px;
        color: #cbd5e1;
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .uam-panel-card strong {
        font-size: 1rem;
        line-height: 1.6;
      }

      .uam-shell { width: min(1120px, calc(100% - 36px)); margin: 0 auto; }
      .uam-section { padding: clamp(54px, 7vw, 82px) 0; }
      .uam-surface { background: #fff; border-top: 1px solid #d7dee5; border-bottom: 1px solid #d7dee5; }
      .uam-section-heading { margin-bottom: 26px; }
      .uam-section-heading h2 { margin: 0; color: #17212b; font-size: clamp(1.7rem, 3vw, 2.35rem); line-height: 1.2; }
      .uam-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      .uam-card { padding: 20px; border: 1px solid #d7dee5; background: #fff; }
      .uam-card-icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; margin-bottom: 12px; color: #1d4ed8; background: #eaf1ff; }
      .uam-benefits-section { background: #f5f7f9; }
      .uam-benefit-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .uam-benefit { border-radius: 6px; box-shadow: none; }
      .uam-benefit h3 { margin: 0; font-size: 1rem; line-height: 1.5; }
      .uam-card-icon { flex: 0 0 auto; border-radius: 6px; }
      .uam-workflow-list { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; margin: 0 0 26px; padding: 0; list-style: none; }
      .uam-workflow-step { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 12px; border-left: 2px solid #bfdbfe; padding: 4px 0 4px 12px; }
      .uam-workflow-step strong { font-size: 0.94rem; line-height: 1.45; }
      .uam-section-link { display: inline-flex; align-items: center; gap: 8px; color: #1d4ed8; font-weight: 700; text-decoration: none; }
      .uam-section-link:hover { text-decoration: underline; }
      .uam-role-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-bottom: 24px; border: 1px solid #d7dee5; background: #d7dee5; }
      .uam-role-item { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 18px; color: #243b53; background: #fff; font-weight: 650; }
      .uam-role-item svg { flex: 0 0 auto; color: #1d4ed8; }
      .uam-security-section { background: #eaf1ff; }
      .uam-security-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
      .uam-security-item { display: flex; align-items: center; gap: 12px; color: #19324d; font-weight: 650; line-height: 1.5; }
      .uam-security-item svg { flex: 0 0 auto; color: #1d4ed8; }
      .uam-trust-section { padding: 38px 0; color: #fff; background: #17365d; }
      .uam-trust-content { display: flex; align-items: center; gap: 20px; }
      .uam-trust-content > svg { flex: 0 0 auto; color: #93c5fd; }
      .uam-trust-content h2 { margin: 0 0 6px; font-size: 1.35rem; }
      .uam-trust-content p { margin: 0; color: #dbeafe; line-height: 1.6; }
      .uam-quick-links { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .uam-quick-links a { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 18px; border: 1px solid #d7dee5; border-radius: 6px; color: #243b53; background: #fff; font-weight: 700; text-decoration: none; }
      .uam-quick-links a svg:first-child { color: #1d4ed8; }
      .uam-quick-links a svg:last-child { margin-left: auto; }
      .uam-quick-links a:hover { border-color: #1d4ed8; }
      .uam-final-cta { padding: 42px 0; background: #dbeafe; }
      .uam-final-content { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
      .uam-final-content h2 { margin: 0 0 6px; font-size: 1.65rem; }
      .uam-final-content p { margin: 0; color: #40566f; line-height: 1.6; }
      .uam-final-content .uam-primary-button { gap: 10px; border-radius: 6px; color: #fff; background: #1d4ed8; }

      @media (max-width: 960px) {
        .uam-hero-shell { grid-template-columns: 1fr; }
        .uam-benefit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .uam-workflow-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .uam-role-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 640px) {
        .uam-hero-shell { width: min(100% - 24px, 1120px); }
        .uam-highlight-list { grid-template-columns: 1fr; }
        .uam-shell { width: min(100% - 24px, 1120px); }
        .uam-benefit-grid,
        .uam-workflow-list,
        .uam-role-list,
        .uam-security-list,
        .uam-quick-links { grid-template-columns: 1fr; }
        .uam-final-content { align-items: flex-start; flex-direction: column; }
        .uam-trust-content { align-items: flex-start; }
      }
    `}</style>
  </main>
  );
};

export default Home;
