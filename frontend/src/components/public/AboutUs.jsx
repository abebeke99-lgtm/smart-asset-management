import React from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const pageContent = {
  en: {
   
    aboutTitle: 'About Us',
    
    visionTitle: 'Vision',
    visionText: 'To become a center of excellence in education, research, innovation, and community engagement, contributing meaningfully to national development.',
    missionTitle: 'Mission',
    missionLead: 'Mekdela Amba University is committed to:',
    mission: [
      'Providing quality and accessible higher education.',
      'Promoting research and innovation.',
      'Developing knowledgeable, skilled, and responsible graduates.',
      'Supporting community engagement and development.',
      'Promoting ethical leadership, professionalism, and academic excellence.'
    ],
    valuesTitle: 'Core Values',
    values: ['Academic Excellence', 'Integrity', 'Innovation', 'Community Engagement', 'Inclusiveness', 'Responsibility'],
    commitmentTitle: 'Our Commitment',
    commitmentText: 'Mekdela Amba University is committed to building a strong academic community, supporting meaningful research and innovation, and preparing graduates who contribute positively to Ethiopia and beyond.'
  },
  am: {
    title: 'መቅደላ አምባ ዩኒቨርሲቲ',
    introduction: 'መቅደላ አምባ ዩኒቨርሲቲ ጥራት ያለው ትምህርትን፣ ምርምርን፣ ፈጠራንና የማህበረሰብ ልማትን የሚያበረታታ የከፍተኛ ትምህርት ተቋም ነው።',
    aboutTitle: 'ስለ እኛ',
    aboutText: 'መቅደላ አምባ ዩኒቨርሲቲ ተማሪዎች፣ የትምህርት ሠራተኞች፣ ተመራማሪዎችና ሰፊው ማህበረሰብ መማር፣ መተባበርና ለዘላቂ ልማት አስተዋፅኦ ማድረግ የሚችሉበትን ጠንካራ የትምህርት አካባቢ ለመፍጠር ቁርጠኛ ነው።',
    visionTitle: 'ራዕይ',
    visionText: 'ለሀገራዊ ልማት ጉልህ አስተዋፅኦ በማድረግ በትምህርት፣ በምርምር፣ በፈጠራና በማህበረሰብ ተሳትፎ የላቀ የልህቀት ማዕከል መሆን።',
    missionTitle: 'ተልዕኮ',
    missionLead: 'መቅደላ አምባ ዩኒቨርሲቲ የሚከተሉትን ለማሳካት ቁርጠኛ ነው፦',
    mission: [
      'ጥራት ያለውና ተደራሽ የከፍተኛ ትምህርት መስጠት።',
      'ምርምርንና ፈጠራን ማበረታታት።',
      'እውቀት ያላቸውን፣ ችሎታ የተላበሱና ኃላፊነት የሚሰማቸውን ምሩቃን ማፍራት።',
      'የማህበረሰብ ተሳትፎንና ልማትን መደገፍ።',
      'ሥነ ምግባራዊ አመራርን፣ ሙያዊነትንና የትምህርት ልቀትን ማበረታታት።'
    ],
    valuesTitle: 'ዋና እሴቶች',
    values: ['የትምህርት ልቀት', 'ታማኝነት', 'ፈጠራ', 'የማህበረሰብ ተሳትፎ', 'አካታችነት', 'ኃላፊነት'],
    commitmentTitle: 'ቁርጠኝነታችን',
    commitmentText: 'መቅደላ አምባ ዩኒቨርሲቲ ጠንካራ የትምህርት ማህበረሰብ ለመገንባት፣ ትርጉም ያለው ምርምርና ፈጠራን ለመደገፍ፣ ለኢትዮጵያና ከዚያም ባሻገር አዎንታዊ አስተዋፅኦ የሚያደርጉ ምሩቃንን ለማዘጋጀት ቁርጠኛ ነው።'
  }
};

const AboutUs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const text = pageContent[language] || pageContent.en;

  return (
    <div className={`about-page-shell${theme === 'dark' ? ' about-page-dark' : ''}`}>
      <section className="about-hero" aria-labelledby="about-hero-title">
        <div className="about-hero-overlay" aria-hidden="true" />
        <div className="about-container about-hero-inner">
          <nav className="about-breadcrumb" aria-label="Breadcrumb">
            <span className="about-breadcrumb-home" aria-hidden="true">⌂</span>
            <a href="/home">Home</a>
            <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
            <span aria-current="page">About Us</span>
          </nav>
          <h1 className="about-hero-university">{text.title}</h1>
          <h2 id="about-hero-title" className="about-hero-heading">{text.aboutTitle}</h2>
          <p className="about-hero-copy">{text.aboutText}</p>
        </div>
      </section>

      <main className="about-main" aria-label={text.aboutTitle}>
        <div className="about-container">
          <div className="about-two-column">
            <article className="about-card about-card-vision" aria-labelledby="about-vision-title">
              <div className="about-card-head">
                <span className="about-card-icon" aria-hidden="true">◉</span>
                <h2 id="about-vision-title">{text.visionTitle}</h2>
              </div>
              <p>{text.visionText}</p>
            </article>

            <article className="about-card about-card-mission" aria-labelledby="about-mission-title">
              <div className="about-card-head">
                <span className="about-card-icon" aria-hidden="true">◎</span>
                <h2 id="about-mission-title">{text.missionTitle}</h2>
              </div>
              <p className="about-mission-intro">{text.missionLead}</p>
              <ul className="about-mission-list">
                {text.mission.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>

          <section className="about-card about-card-values" aria-labelledby="about-values-title">
            <div className="about-card-head about-card-head-inline">
              <span className="about-card-icon" aria-hidden="true">◆</span>
              <h2 id="about-values-title">{text.valuesTitle}</h2>
            </div>
            <ul className="about-values-list">
              {text.values.map((value) => (
                <li key={value}>
                  <span className="about-value-badge" aria-hidden="true">✦</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="about-card about-card-commitment" aria-labelledby="about-commitment-title">
            <div className="about-card-head about-card-head-inline">
              <span className="about-card-icon" aria-hidden="true">✦</span>
              <h2 id="about-commitment-title">{text.commitmentTitle}</h2>
            </div>
            <p>{text.commitmentText}</p>
          </section>
        </div>
      </main>

      <style>{`
        .about-page-shell {
          --about-bg: #f7fafc;
          --about-surface: #ffffff;
          --about-surface-alt: #f0f9ff;
          --about-card-border: #d9e4ec;
          --about-text: #17324d;
          --about-text-strong: #0b1b33;
          --about-muted: #64748b;
          --about-primary: #0797d5;
          --about-primary-strong: #0ea5e9;
          --about-hero-overlay: rgba(7, 24, 45, 0.62);
          --about-shadow: 0 16px 34px rgba(7, 24, 45, 0.08);
          background: var(--about-bg);
          color: var(--about-text);
        }

        .about-page-shell.about-page-dark {
          --about-bg: #07182d;
          --about-surface: #0b1b33;
          --about-surface-alt: rgba(14, 165, 233, 0.08);
          --about-card-border: rgba(255, 255, 255, 0.12);
          --about-text: #f8fafc;
          --about-text-strong: #f8fafc;
          --about-muted: #cbd5e1;
          --about-primary: #7dd3fc;
          --about-primary-strong: #38bdf8;
          --about-hero-overlay: rgba(7, 24, 45, 0.7);
          --about-shadow: 0 18px 42px rgba(2, 6, 23, 0.38);
        }

        .about-container {
          width: min(100% - 32px, 1200px);
          margin: 0 auto;
        }

        .about-hero {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 260px;
          background-image: linear-gradient(90deg, rgba(7, 24, 45, 0.82), rgba(7, 24, 45, 0.52)), url('/images/university/mekdela-amba-campus.svg');
          background-size: cover;
          background-position: center;
        }

        .about-hero-overlay {
          position: absolute;
          inset: 0;
          background: rgba(7, 24, 45, 0.18);
        }

        .about-hero-inner {
          position: relative;
          z-index: 1;
          width: min(100%, 1200px);
          padding: 54px 0 48px;
          color: #ffffff;
        }

        .about-breadcrumb {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .about-breadcrumb-home {
          display: inline-grid;
          place-items: center;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          font-size: 0.8rem;
        }

        .about-breadcrumb a {
          color: #ffffff;
          text-decoration: none;
        }

        .about-breadcrumb a:hover,
        .about-breadcrumb a:focus-visible {
          text-decoration: underline;
        }

        .about-breadcrumb-separator {
          color: rgba(255, 255, 255, 0.72);
          font-size: 1.2rem;
          line-height: 1;
        }

        .about-hero-kicker {
          margin: 0;
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .about-hero h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2.3rem, 4vw, 4rem);
          line-height: 1.1;
          letter-spacing: -0.04em;
        }

        .about-hero-copy {
          max-width: 780px;
          margin: 14px 0 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: clamp(1rem, 1.6vw, 1.15rem);
          line-height: 1.7;
        }

        .about-main {
          padding: 36px 0 64px;
        }

        .about-two-column {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
          margin-bottom: 28px;
        }

        .about-card {
          position: relative;
          background: var(--about-surface);
          border: 1px solid var(--about-card-border);
          border-radius: 18px;
          box-shadow: var(--about-shadow);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .about-card:hover {
          transform: translateY(-3px);
        }

        .about-card-vision,
        .about-card-mission {
          padding: 28px 24px 24px;
        }

        .about-card-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .about-card-head-inline {
          margin-bottom: 20px;
        }

        .about-card-head h2 {
          margin: 0;
          color: var(--about-text-strong);
          font-size: clamp(1.4rem, 2vw, 1.9rem);
          line-height: 1.2;
        }

        .about-card-icon {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(7, 151, 213, 0.08));
          color: var(--about-primary);
          font-size: 1.4rem;
          font-weight: 800;
          box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.14);
        }

        .about-card p,
        .about-card li {
          color: var(--about-muted);
          font-size: 1rem;
          line-height: 1.8;
        }

        .about-card p {
          margin: 0;
        }

        .about-mission-intro {
          margin-bottom: 14px;
        }

        .about-mission-list {
          display: grid;
          gap: 12px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .about-mission-list li {
          position: relative;
          padding-left: 36px;
        }

        .about-mission-list li::before {
          content: '✓';
          position: absolute;
          left: 0;
          top: 0;
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.12);
          color: var(--about-primary);
          font-size: 0.9rem;
          font-weight: 800;
        }

        .about-card-values,
        .about-card-commitment {
          padding: 26px 24px 24px;
        }

        .about-values-list {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 16px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .about-values-list li {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 118px;
          padding: 14px 10px 12px;
          border: 1px solid var(--about-card-border);
          border-radius: 14px;
          background: linear-gradient(180deg, var(--about-surface), var(--about-surface-alt));
          text-align: center;
          transition: transform 0.2s ease;
        }

        .about-values-list li:hover {
          transform: translateY(-2px);
        }

        .about-value-badge {
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          margin-bottom: 10px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.12);
          color: var(--about-primary);
          font-size: 1rem;
        }

        .about-values-list li span:last-child {
          color: var(--about-text-strong);
          font-size: 0.88rem;
          line-height: 1.5;
          font-weight: 700;
        }

        .about-card-commitment {
          margin-top: 28px;
          background: linear-gradient(180deg, rgba(14, 165, 233, 0.08), rgba(255, 255, 255, 0.02));
          border-color: rgba(14, 165, 233, 0.18);
        }

        @media (max-width: 900px) {
          .about-two-column { grid-template-columns: 1fr; }
          .about-values-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        @media (max-width: 640px) {
          .about-hero { min-height: 200px; }
          .about-hero-inner { padding: 36px 0 28px; }
          .about-breadcrumb { font-size: 0.74rem; }
          .about-card-vision,
          .about-card-mission,
          .about-card-values,
          .about-card-commitment { padding-left: 18px; padding-right: 18px; }
          .about-values-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 420px) {
          .about-container { width: min(100% - 24px, 1200px); }
          .about-hero { min-height: 180px; }
          .about-hero h1 { font-size: 2.1rem; }
          .about-hero-copy { font-size: 0.96rem; }
          .about-values-list { grid-template-columns: 1fr; }
          .about-card-head h2 { font-size: 1.45rem; }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;