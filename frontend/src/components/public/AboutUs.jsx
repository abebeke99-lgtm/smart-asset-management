import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Database,
  MapPin,
  Package,
  QrCode,
  UserRoundCog,
  Users,
  WalletCards,
  Wrench
} from 'lucide-react';

const AboutUs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const content = language === 'en' ? {
    eyebrow: 'About the platform',
    title: 'A clearer way to manage university assets.',
    intro: 'University Asset Management System is a centralized system for managing university assets throughout their lifecycle.',
    doesTitle: 'What the system does',
    doesText: 'The system provides a centralized operational record of what the university owns, where assets are located, who is responsible for them, their current status, movement and history, maintenance information, financial information, and lifecycle status.',
    capabilitiesTitle: 'Core capabilities',
    capabilitiesText: 'University teams can use the system to maintain accurate asset records and coordinate responsibility across the asset lifecycle.',
    technologyTitle: 'Technology and platform highlights',
    technologyText: 'A web application that connects university teams with structured operational data.',
    technology: [
      ['Web application', 'A responsive web interface for university asset operations.', Database],
      ['Connected services', 'REST APIs connect the interface to operational data.', Activity],
      ['Structured data', 'Relational database structures support asset records, relationships, history, and reporting.', Package],
      ['Role-based access', 'Permissions are controlled according to user roles.', UserRoundCog]
    ],
    purposeTitle: 'Purpose of the platform',
    purposeText: 'The University Asset Management System provides university teams with a shared operational record for managing institutional assets, coordinating responsibility, tracking asset movement and condition, maintaining records, and supporting accountable decisions.',
    ctaTitle: 'See the platform in practice',
    ctaText: 'Sign in to access the workspace for your role.',
    cta: 'Go to login',
    capabilities: [
      ['Asset management', 'Register, identify, assign, transfer, verify, maintain, and track assets throughout their lifecycle.', Package],
      ['Inventory', 'Maintain accurate inventory records and monitor asset status and availability.', Database],
      ['Locations', 'Connect assets with colleges, departments, buildings, rooms, and responsible areas where supported.', MapPin],
      ['Users & roles', 'Manage users and role-based permissions for controlled access.', Users],
      ['Maintenance', 'Record maintenance activities, service status, and maintenance history.', Wrench],
      ['Transfers', 'Track asset movement between responsible units and locations.', ArrowLeftRight],
      ['RFID / QR tracking', 'Support asset identification and tracking through the existing RFID and QR functionality.', QrCode],
      ['Financial records', 'Manage asset-related financial information, depreciation, payments, and financial reporting where implemented.', WalletCards],
      ['Reports & analytics', 'Provide operational reports based on actual system data.', BarChart3]
    ]
  } : {
    eyebrow: 'ስለ መድረኩ',
    title: 'የዩኒቨርሲቲ ንብረቶችን በግልጽ ለማስተዳደር።',
    intro: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት የዩኒቨርሲቲ ንብረቶችን በህይወት ዘመናቸው ለማስተዳደር የተማከለ ስርዓት ነው።',
    doesTitle: 'ስርዓቱ ምን ያደርጋል?',
    doesText: 'ስርዓቱ ዩኒቨርሲቲው ያለውን ንብረት፣ ያለበትን ቦታ፣ ተጠያቂውን አካል፣ ወቅታዊ ሁኔታውን፣ እንቅስቃሴና ታሪኩን፣ የጥገና እና የገንዘብ መረጃን እና የህይወት ዘመን ሁኔታን የሚያሳይ የተማከለ የስራ መዝገብ ያቀርባል።',
    capabilitiesTitle: 'ዋና አቅሞች',
    capabilitiesText: 'መድረኩ የንብረት መረጃን ትክክለኛ እና ጠቃሚ የሚያደርጉ ዕለታዊ ስራዎችን ያገናኛል።',
    technologyTitle: 'የቴክኖሎጂ እና መድረክ አጠቃላይ እይታ',
    technologyText: 'የዩኒቨርሲቲ ቡድኖችን ከተዋቀረ የስራ መረጃ ጋር የሚያገናኝ የድር መተግበሪያ።',
    technology: [
      ['የድር መተግበሪያ', 'ለዩኒቨርሲቲ ንብረት ስራዎች የሚያገለግል ምላሽ ሰጪ የድር በይነገጽ።', Database],
      ['የተገናኙ አገልግሎቶች', 'REST API በይነገጹን ከስራ መረጃ ጋር ያገናኛል።', Activity],
      ['የተዋቀሩ መዝገቦች', 'የግንኙነት ዳታ ጎታ የንብረት ታሪክን እና ሪፖርትን ያጠናክራል።', Package],
      ['በሚና ላይ የተመሰረተ መዳረሻ', 'ፈቃዶች በተጠቃሚ ሚና መሰረት ይቆጣጠራሉ።', UserRoundCog]
    ],
    purposeTitle: 'የመድረኩ ዓላማ',
    purposeText: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት ተቋማዊ ንብረቶችን ለማስተዳደር፣ ተጠያቂነትን ለማስተባበር፣ የንብረት እንቅስቃሴንና ሁኔታን ለመከታተል፣ መዝገቦችን ለማቆየት እና ተጠያቂ ውሳኔዎችን ለመደገፍ ለዩኒቨርሲቲ ቡድኖች የጋራ የስራ መዝገብ ይሰጣል።',
    ctaTitle: 'መድረኩን በተግባር ይመልከቱ',
    ctaText: 'ለሚናዎ የተዘጋጀውን የስራ ቦታ ለመጠቀም ይግቡ።',
    cta: 'ወደ መግቢያ',
    capabilities: [
      ['ንብረት አስተዳደር', 'ንብረቶችን ይመዝግቡ፣ ይለዩ፣ ይመድቡ፣ ያስተላልፉ፣ ያረጋግጡ እና በህይወት ዘመናቸው ይከታተሉ።', Package],
      ['ኢንቬንተሪ', 'ትክክለኛ የኢንቬንተሪ መዝገቦችን ያቆዩ እና የንብረት ሁኔታን ይከታተሉ።', Database],
      ['ቦታዎች', 'ንብረቶችን ከኮሌጆች፣ ክፍሎች፣ ህንፃዎች፣ ክፍሎች እና ተጠያቂ አካላት ጋር ያገናኙ።', MapPin],
      ['ተጠቃሚዎች እና ሚናዎች', 'ተጠቃሚዎችን እና በሚና ላይ የተመሰረቱ ፈቃዶችን ያስተዳድሩ።', Users],
      ['ጥገና', 'የጥገና ስራዎችን፣ የአገልግሎት ሁኔታን እና የጥገና ታሪክን ይመዝግቡ።', Wrench],
      ['ማስተላለፍ', 'በተጠያቂ አካላት እና ቦታዎች መካከል የንብረት እንቅስቃሴን ይከታተሉ።', ArrowLeftRight],
      ['RFID / QR ክትትል', 'አሁን ባለው RFID እና QR ተግባር ንብረቶችን ይለዩ እና ይከታተሉ።', QrCode],
      ['የገንዘብ መዝገቦች', 'የንብረት የገንዘብ መረጃን፣ ዋጋ ቅነሳን፣ ክፍያዎችን እና ሪፖርትን በተተገበረበት ቦታ ያስተዳድሩ።', WalletCards],
      ['ሪፖርቶች እና ትንታኔ', 'በትክክለኛ የስርዓት መረጃ ላይ የተመሰረቱ የስራ ሪፖርቶችን ያቅርቡ።', BarChart3]
    ]
  };

  return (
    <main className={`about-page${isDark ? ' about-page-dark' : ''}`}>
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-container about-hero-grid">
          <div>
            <span className="about-eyebrow">{content.eyebrow}</span>
            <h1 id="about-title">{content.title}</h1>
            <p className="about-lead">{content.intro}</p>
          </div>
          <div className="about-hero-mark" aria-hidden="true"><Database size={52} strokeWidth={1.5} /></div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-does-title">
        <div className="about-container about-purpose-grid">
          <div className="about-section-heading"><span className="about-eyebrow">01</span><h2 id="about-does-title">{content.doesTitle}</h2></div>
          <p className="about-purpose-text">{content.doesText}</p>
        </div>
      </section>

      <section className="about-section about-capabilities" aria-labelledby="about-capabilities-title">
        <div className="about-container">
          <div className="about-section-heading"><span className="about-eyebrow">02</span><h2 id="about-capabilities-title">{content.capabilitiesTitle}</h2><p>{content.capabilitiesText}</p></div>
          <div className="about-capability-grid">
            {content.capabilities.map(([title, text, Icon]) => (
              <article className="about-capability-card" key={title}>
                <span className="about-card-icon"><Icon size={22} aria-hidden="true" /></span>
                <span><strong>{title}</strong><small>{text}</small></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-technology-title">
        <div className="about-container">
          <div className="about-section-heading"><span className="about-eyebrow">03</span><h2 id="about-technology-title">{content.technologyTitle}</h2><p>{content.technologyText}</p></div>
          <div className="about-technology-grid">
            {content.technology.map(([title, text, Icon]) => <article className="about-tech-card" key={title}><Icon size={22} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="about-section about-purpose-band" aria-labelledby="about-purpose-title">
        <div className="about-container about-purpose-content">
          <div className="about-section-heading"><span className="about-eyebrow">04</span><h2 id="about-purpose-title">{content.purposeTitle}</h2></div>
          <p>{content.purposeText}</p>
        </div>
      </section>

      <section className="about-cta" aria-labelledby="about-cta-title">
        <div className="about-container about-cta-inner">
          <div><h2 id="about-cta-title">{content.ctaTitle}</h2><p>{content.ctaText}</p></div>
          <Link className="about-cta-link" to="/login">{content.cta}<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      <style>{`
        .about-page { --about-bg: #f5f7f9; --about-surface: #ffffff; --about-muted: #52606d; --about-text: #17212b; --about-border: #d7dee5; --about-accent: #536575; background: var(--about-bg); color: var(--about-text); }
        .about-page-dark { --about-bg: #0f172a; --about-surface: #111827; --about-muted: #cbd5e1; --about-text: #e2e8f0; --about-border: rgba(148, 163, 184, .2); --about-accent: #93c5fd; }
        .about-container { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
        .about-hero { padding: clamp(64px, 9vw, 112px) 0; background: var(--about-surface); border-bottom: 1px solid var(--about-border); }
        .about-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 48px; align-items: center; }
        .about-eyebrow { display: inline-block; margin-bottom: 14px; color: var(--about-accent); font-size: .74rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .about-hero h1 { max-width: 760px; margin: 0; font-size: clamp(2.5rem, 6vw, 5rem); line-height: 1.03; letter-spacing: -.045em; }
        .about-lead { max-width: 690px; margin: 24px 0 0; color: var(--about-muted); font-size: 1.15rem; line-height: 1.75; }
        .about-hero-mark { display: grid; place-items: center; width: 180px; height: 180px; justify-self: end; border: 1px solid var(--about-border); border-radius: 24px; color: var(--about-accent); background: var(--about-bg); }
        .about-section { padding: 84px 0; }
        .about-purpose-grid { display: grid; grid-template-columns: minmax(220px, .7fr) minmax(0, 1.3fr); gap: 60px; align-items: start; }
        .about-section-heading { max-width: 700px; }
        .about-section-heading h2 { margin: 0 0 14px; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.12; letter-spacing: -.035em; }
        .about-section-heading p, .about-purpose-text { margin: 0; color: var(--about-muted); line-height: 1.75; }
        .about-purpose-text { padding-top: 30px; font-size: 1.18rem; }
        .about-capabilities { background: var(--about-surface); border-top: 1px solid var(--about-border); border-bottom: 1px solid var(--about-border); }
        .about-capability-grid, .about-technology-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 36px; }
        .about-capability-card { position: relative; display: flex; min-height: 185px; flex-direction: column; gap: 18px; padding: 22px; border: 1px solid var(--about-border); border-radius: 14px; background: var(--about-bg); color: var(--about-text); text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
        .about-capability-card:hover { border-color: var(--about-accent); transform: translateY(-3px); }
        .about-card-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 11px; color: var(--about-accent); background: color-mix(in srgb, var(--about-accent) 14%, transparent); }
        .about-capability-card strong, .about-capability-card small { display: block; }
        .about-capability-card strong { margin-bottom: 8px; font-size: 1rem; }
        .about-capability-card small { color: var(--about-muted); font-size: .88rem; line-height: 1.55; }
        .about-tech-card { display: flex; gap: 14px; padding: 22px; border-top: 2px solid var(--about-accent); background: var(--about-surface); }
        .about-tech-card > svg { flex: 0 0 auto; color: var(--about-accent); }
        .about-tech-card h3 { margin: 0 0 8px; font-size: 1rem; }
        .about-tech-card p { margin: 0; color: var(--about-muted); font-size: .9rem; line-height: 1.55; }
        .about-purpose-band { padding: 64px 0; background: #e9eef2; }
        .about-page-dark .about-purpose-band { background: #1e293b; }
        .about-purpose-content { display: grid; grid-template-columns: minmax(220px, .7fr) minmax(0, 1.3fr); gap: 60px; align-items: center; }
        .about-purpose-content p { margin: 0; color: var(--about-muted); font-size: 1.15rem; line-height: 1.75; }
        .about-cta { padding: 48px 0 84px; }
        .about-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 32px 36px; border: 1px solid var(--about-border); border-radius: 14px; background: var(--about-surface); }
        .about-cta h2 { margin: 0 0 8px; font-size: 1.55rem; }
        .about-cta p { margin: 0; color: var(--about-muted); }
        .about-cta-link { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 13px 18px; border-radius: 8px; background: var(--about-accent); color: #fff; font-weight: 700; text-decoration: none; }
        @media (max-width: 900px) { .about-hero-grid, .about-purpose-grid, .about-purpose-content { grid-template-columns: 1fr; gap: 24px; } .about-hero-mark { justify-self: start; width: 120px; height: 120px; } .about-capability-grid, .about-technology-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .about-container { width: min(100% - 28px, 1120px); } .about-hero { padding: 56px 0 64px; } .about-section { padding: 60px 0; } .about-capability-grid, .about-technology-grid { grid-template-columns: 1fr; } .about-cta-inner { align-items: stretch; flex-direction: column; padding: 26px 22px; } .about-cta-link { justify-content: center; } }
        @media (prefers-reduced-motion: reduce) { .about-capability-card { transition: none; } }
      `}</style>
    </main>
  );
};

export default AboutUs;
