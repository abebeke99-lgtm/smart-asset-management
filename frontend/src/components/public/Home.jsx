import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { homepageImages } from '../../config/homepageImages';
import {
  Building2,
  CheckCircle2
} from 'lucide-react';

const pageText = {
  en: {
    systemTitle: 'University Asset Management',
    heroEyebrow: 'UNIVERSITY ASSET OPERATIONS',
    lead: 'Manage, track, assign, maintain, and monitor every university asset from one centralized platform.',
    supportingText: 'From asset registration and assignment to transfer, maintenance, verification, returns, and financial reporting — keep university resources organized, accountable, and visible.',
    featureList: 'Core system features',
    login: 'Login to System',
    learnMore: 'Explore System',
    overview: 'System overview',
    panelTitle: 'UNIVERSITY ASSET OPERATIONS',
    coreFunction: 'CORE FUNCTION',
    lifecycle: 'Complete visibility across the entire asset lifecycle.',
    managedBy: 'MANAGED BY',
    teams: 'Administration · Departments · Finance · ICT · Maintenance',
    purpose: 'SYSTEM GOAL',
    purposeText: 'Improve accountability, efficiency, transparency, and operational control.',
    highlights: ['Asset Registration', 'Asset Tracking', 'Assignment', 'Transfer', 'Verification', 'Maintenance', 'Returns', 'Financial Management', 'Reports & Analytics']
  },
  am: {
    systemTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር',
    heroEyebrow: 'የዩኒቨርሲቲ ንብረት አስተዳደር',
    lead: 'እያንዳንዱን የዩኒቨርሲቲ ንብረት በአንድ ማዕከላዊ መድረክ ያስተዳድሩ፣ ይመዝግቡ፣ ይመድቡ፣ ይጠግኑ እና ይከታተሉ።',
    supportingText: 'ከንብረት ምዝገባና ምደባ እስከ ማስተላለፍ፣ ጥገና፣ ማረጋገጫ፣ መመለስ እና የፋይናንስ ሪፖርት ድረስ፤ የዩኒቨርሲቲ ሀብቶችን የተደራጁ፣ ተጠያቂ እና ግልጽ ያድርጉ።',
    featureList: 'የስርዓቱ ዋና ተግባራት',
    login: 'ወደ ስርዓቱ ይግቡ',
    learnMore: 'ስርዓቱን ይመልከቱ',
    overview: 'የስርዓቱ አጠቃላይ እይታ',
    panelTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር',
    coreFunction: 'ዋና ተግባር',
    lifecycle: 'በንብረት የሕይወት ዑደት ሁሉ ሙሉ ታይነት።',
    managedBy: 'በኃላፊነት የሚያስተዳድሩት',
    teams: 'አስተዳደር · ክፍሎች · ፋይናንስ · አይሲቲ · ጥገና',
    purpose: 'የስርዓቱ ግብ',
    purposeText: 'ተጠያቂነትን፣ ቅልጥፍናን፣ ግልጽነትን እና የሥራ ቁጥጥርን ማሻሻል።',
    highlights: ['ንብረት መመዝገብ', 'ንብረት መከታተል', 'የንብረት ምደባ', 'የንብረት ማስተላለፍ', 'ማረጋገጫ', 'ጥገና', 'መመለስ', 'የፋይናንስ አስተዳደር', 'ሪፖርቶች እና ትንታኔ']
  }
};

const Home = () => {
  const { language } = useLanguage();
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const text = pageText[language] || pageText.en;
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
          <h1 id="home-title">{language === 'en' ? <>University<br />Asset Management</> : text.systemTitle}</h1>
          <p className="uam-lead">
            {text.lead}
          </p>
          <p className="uam-supporting-text">{text.supportingText}</p>

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

        <aside className="uam-hero-panel" aria-label={text.overview}>
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
        </aside>
      </div>
    </section>

    <style>{`
      .uam-home-page {
        color: #fff;
        background: #0b1d34;
      }

      .uam-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        min-height: min(760px, calc(100svh - 82px));
        background: #0b1d34;
        color: #fff;
      }

      .uam-hero::after {
        position: absolute;
        inset: 0;
        z-index: -1;
        background: linear-gradient(90deg, rgba(8, 24, 44, 0.91) 0%, rgba(10, 33, 59, 0.82) 52%, rgba(10, 33, 59, 0.70) 100%);
        content: '';
      }

      .uam-hero-media {
        position: absolute;
        inset: 0;
        z-index: -2;
        background: #0b1d34;
      }

      .uam-hero-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transform: scale(1.015);
        transition: opacity 700ms ease, transform 5s ease;
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
        width: min(1280px, calc(100% - 64px));
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.75fr);
        gap: clamp(44px, 7vw, 100px);
        align-items: center;
        padding: clamp(64px, 8vw, 112px) 0;
      }

      .uam-eyebrow {
        display: inline-block;
        margin-bottom: 18px;
        color: #a8d4ff;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .uam-hero-copy h1 {
        max-width: 720px;
        margin: 0;
        font-size: clamp(3rem, 5vw, 4.5rem);
        line-height: 1.06;
        letter-spacing: 0;
        text-wrap: balance;
        animation: uam-enter 500ms ease both;
      }

      .uam-lead {
        max-width: 650px;
        margin: 22px 0 10px;
        color: #f1f6fc;
        font-size: 1.12rem;
        line-height: 1.65;
        animation: uam-enter 550ms 50ms ease both;
      }

      .uam-supporting-text {
        max-width: 660px;
        margin: 0 0 26px;
        color: #c8d6e5;
        font-size: 0.98rem;
        line-height: 1.65;
        animation: uam-enter 600ms 90ms ease both;
      }

      .uam-highlight-list {
        list-style: none;
        padding: 0;
        margin: 0 0 30px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 13px 20px;
        animation: uam-enter 650ms 130ms ease both;
      }

      .uam-highlight-list li {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        gap: 9px;
        color: #f1f6fc;
        font-size: 0.94rem;
        font-weight: 600;
        line-height: 1.4;
      }

      .uam-highlight-list svg {
        flex: 0 0 auto;
        color: #83c3ff;
      }

      .uam-cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        animation: uam-enter 700ms 170ms ease both;
      }

      .uam-primary-button,
      .uam-secondary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 52px;
        padding: 0 24px;
        border: 1px solid transparent;
        border-radius: 7px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        transition: transform 220ms ease, background-color 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
      }

      .uam-primary-button:focus-visible,
      .uam-secondary-button:focus-visible {
        outline: 3px solid #a8d4ff;
        outline-offset: 4px;
      }

      .uam-primary-button {
        color: #102640;
        background: #fff;
        box-shadow: 0 8px 22px rgba(3, 15, 29, 0.22);
      }

      .uam-secondary-button {
        border-color: rgba(219, 234, 254, 0.62);
        color: #fff;
        background: rgba(255,255,255,0.06);
      }

      .uam-primary-button:hover {
        transform: translateY(-2px);
        background: #e8f3ff;
        box-shadow: 0 12px 28px rgba(3, 15, 29, 0.3);
      }

      .uam-secondary-button:hover {
        transform: translateY(-2px);
        border-color: #fff;
        background: rgba(255,255,255,0.13);
      }

      .uam-hero-panel {
        padding: clamp(24px, 3vw, 34px);
        border: 1px solid rgba(210, 229, 249, 0.24);
        border-radius: 12px;
        background: rgba(11, 29, 52, 0.72);
        box-shadow: 0 24px 58px rgba(2, 12, 24, 0.28);
        backdrop-filter: blur(14px);
        animation: uam-panel-enter 550ms 120ms ease both;
        transition: transform 250ms ease, box-shadow 250ms ease;
      }

      .uam-hero-panel:hover {
        transform: translateY(-3px);
        box-shadow: 0 28px 64px rgba(2, 12, 24, 0.34);
      }

      .uam-panel-header {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 24px;
        color: #dbeafe;
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .uam-panel-stack {
        display: grid;
        gap: 0;
      }

      .uam-panel-card {
        padding: 19px 0;
        border-top: 1px solid rgba(210, 229, 249, 0.19);
      }

      .uam-panel-label {
        display: block;
        margin-bottom: 7px;
        color: #a9c9e8;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .uam-panel-card strong {
        display: block;
        color: #fff;
        font-size: 1.02rem;
        font-weight: 600;
        line-height: 1.55;
      }

      @keyframes uam-enter {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes uam-panel-enter {
        from { opacity: 0; transform: translate(10px, 8px); }
        to { opacity: 1; transform: translate(0, 0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .uam-hero-copy h1,
        .uam-lead,
        .uam-supporting-text,
        .uam-highlight-list,
        .uam-cta-row,
        .uam-hero-panel {
          animation: none;
        }

        .uam-primary-button,
        .uam-secondary-button,
        .uam-hero-panel {
          transition: none;
        }
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
      .uam-benefit p { margin: 10px 0 0; color: #40566f; line-height: 1.6; }
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
        .uam-hero-shell { grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr); gap: 32px; }
        .uam-hero-copy h1 { font-size: clamp(2.75rem, 5vw, 3.65rem); }
        .uam-highlight-list { column-gap: 12px; }
        .uam-benefit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .uam-workflow-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .uam-role-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 640px) {
        .uam-hero { min-height: auto; }
        .uam-hero::after { background: linear-gradient(90deg, rgba(8, 24, 44, 0.94), rgba(10, 33, 59, 0.83)); }
        .uam-hero-shell { width: min(100% - 32px, 560px); grid-template-columns: 1fr; gap: 36px; padding: 58px 0 64px; }
        .uam-hero-copy h1 { font-size: clamp(2.35rem, 10vw, 3rem); }
        .uam-lead { margin-top: 18px; font-size: 1.03rem; }
        .uam-supporting-text { margin-bottom: 23px; font-size: 0.94rem; }
        .uam-highlight-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; margin-bottom: 26px; }
        .uam-highlight-list li { gap: 7px; font-size: 0.85rem; }
        .uam-highlight-list svg { width: 16px; height: 16px; }
        .uam-cta-row { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .uam-primary-button, .uam-secondary-button { width: 100%; min-height: 52px; }
        .uam-hero-panel { padding: 23px; }
        .uam-shell { width: min(100% - 24px, 1120px); }
        .uam-benefit-grid,
        .uam-workflow-list,
        .uam-role-list,
        .uam-security-list,
        .uam-quick-links { grid-template-columns: 1fr; }
        .uam-final-content { align-items: flex-start; flex-direction: column; }
        .uam-trust-content { align-items: flex-start; }
      }

      @media (min-width: 641px) and (max-width: 820px) {
        .uam-hero-shell { width: min(100% - 44px, 760px); grid-template-columns: 1fr; gap: 34px; padding: 64px 0; }
        .uam-hero-panel { max-width: 620px; }
      }
    `}</style>
  </main>
  );
};

export default Home;
