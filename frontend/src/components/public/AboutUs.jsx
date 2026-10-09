import React, { useState } from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const pageContent = {
  en: {
    title: 'Mekdela Amba University',
    introduction: 'Mekdela Amba University is a higher education institution committed to quality teaching, research, innovation, and community development.',
    aboutTitle: 'About Us',
    visionTitle: 'Vision',
    visionText: 'To become a center of excellence in education, research, innovation, and community engagement, contributing meaningfully to national development.',
    missionTitle: 'Mission',
    missionLead: 'Mekdela Amba University is committed to:',
    mission: [
      'Providing quality and accessible higher education.',
      'Promoting research, creativity, and innovation.',
      'Developing knowledgeable, skilled, ethical, and responsible graduates.',
      'Supporting community engagement and sustainable development.',
      'Promoting ethical leadership, professionalism, and academic excellence.'
    ],
    valuesTitle: 'Core Values',
    values: [
      {
        title: 'Academic Excellence',
        description: 'We are committed to maintaining high academic standards in teaching, learning, and research to ensure quality education and continuous improvement.'
      },
      {
        title: 'Integrity',
        description: 'We promote honesty, transparency, fairness, and ethical behavior in all academic, administrative, and professional activities.'
      },
      {
        title: 'Innovation',
        description: 'We encourage creativity, critical thinking, research, and the use of modern technology to develop new ideas and effective solutions to challenges.'
      },
      {
        title: 'Community Engagement',
        description: 'We work closely with local communities and stakeholders to address community needs, share knowledge, and contribute to social and economic development.'
      },
      {
        title: 'Inclusiveness',
        description: 'We promote equal opportunities, respect diversity, and create a welcoming learning and working environment where everyone feels valued and respected.'
      },
      {
        title: 'Responsibility',
        description: 'We encourage accountability, professionalism, environmental awareness, and responsible use of university resources to support sustainable development and serve society.'
      }
    ]
  },
  am: {
    title: 'መቅደላ አምባ ዩኒቨርሲቲ',
    introduction: 'መቅደላ አምባ ዩኒቨርሲቲ ጥራት ያለው ትምህርትን፣ ምርምርን፣ ፈጠራንና የማህበረሰብ ልማትን የሚያበረታታ የከፍተኛ ትምህርት ተቋም ነው።',
    aboutTitle: 'ስለ እኛ',
    visionTitle: 'ራዕይ',
    visionText: 'ለሀገራዊ ልማት ጉልህ አስተዋፅኦ በማድረግ በትምህርት፣ በምርምር፣ በፈጠራና በማህበረሰብ ተሳትፎ የላቀ የልህቀት ማዕከል መሆን።',
    missionTitle: 'ተልዕኮ',
    missionLead: 'መቅደላ አምባ ዩኒቨርሲቲ የሚከተሉትን ለማሳካት ቁርጠኛ ነው፦',
    mission: [
      'ጥራት ያለውና ተደራሽ የከፍተኛ ትምህርት መስጠት።',
      'ምርምርን፣ ፈጠራንና አዲስ ነገር መፍጠርን ማበረታታት።',
      'እውቀት ያላቸውን፣ ችሎታ የተላበሱ፣ ሥነ ምግባራዊና ኃላፊነት የሚሰማቸውን ምሩቃን ማፍራት።',
      'የማህበረሰብ ተሳትፎንና ዘላቂ ልማትን መደገፍ።',
      'ሥነ ምግባራዊ አመራርን፣ ሙያዊነትንና የትምህርት ልቀትን ማበረታታት።'
    ],
    valuesTitle: 'ዋና እሴቶች',
    values: [
      { title: 'የትምህርት ልቀት', description: 'ትምህርት፣ መማርና ምርምር ጥራት ያለው እንዲሆንና ያለማቋረጥ እንዲሻሻል ከፍተኛ የትምህርት ደረጃዎችን ለማስጠበቅ ቁርጠኛ ነን።' },
      { title: 'ታማኝነት', description: 'በሁሉም የትምህርት፣ የአስተዳደርና የሙያ እንቅስቃሴዎች ውስጥ ታማኝነትን፣ ግልጽነትን፣ ፍትሃዊነትንና ሥነ ምግባራዊ ባህሪን እናበረታታለን።' },
      { title: 'ፈጠራ', description: 'አዳዲስ ሐሳቦችንና ለችግሮች ውጤታማ መፍትሄዎችን ለማዳበር ፈጠራን፣ ሂሳዊ አስተሳሰብን፣ ምርምርንና ዘመናዊ ቴክኖሎጂን መጠቀምን እናበረታታለን።' },
      { title: 'የማህበረሰብ ተሳትፎ', description: 'የማህበረሰብ ፍላጎቶችን ለመፍታት፣ እውቀትን ለማካፈልና ለማህበራዊና ኢኮኖሚያዊ ልማት አስተዋፅኦ ለማድረግ ከአካባቢው ማህበረሰብና ባለድርሻዎች ጋር በቅርበት እንሠራለን።' },
      { title: 'አካታችነት', description: 'እኩል ዕድሎችን እናበረታታለን፣ ልዩነትን እናከብራለን፣ እያንዳንዱ ሰው የተከበረና ዋጋ ያለው እንዲሰማው አቀባባይ የትምህርትና የሥራ አካባቢ እንፈጥራለን።' },
      { title: 'ኃላፊነት', description: 'ዘላቂ ልማትን ለመደገፍና ህብረተሰቡን ለማገልገል ተጠያቂነትን፣ ሙያዊነትን፣ የአካባቢ ግንዛቤንና የዩኒቨርሲቲ ሀብቶችን በኃላፊነት መጠቀምን እናበረታታለን።' }
    ]
  }
};

const AboutUs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
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
          <h2 id="about-hero-title" className="about-hero-heading">
            <button
              className="about-toggle"
              type="button"
              aria-expanded={isExpanded}
              aria-controls="about-expandable-content"
              onClick={() => setIsExpanded((expanded) => !expanded)}
            >
              <span>{text.aboutTitle}</span>
              <span className="about-toggle-indicator" aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>
            </button>
          </h2>
        </div>
      </section>

      <div
        id="about-expandable-content"
        className={`about-expandable${isExpanded ? ' is-expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="about-expandable-inner">
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
                    <li key={value.title}>
                      <span className="about-value-badge" aria-hidden="true">✦</span>
                      <h3>{value.title}</h3>
                      <p>{value.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        .about-page-shell {
          --about-bg: #F5F7FA;
          --about-surface: #ffffff;
          --about-surface-alt: #F5F7FA;
          --about-card-border: #d9e4ec;
          --about-text: #17324d;
          --about-text-strong: #0b1b33;
          --about-muted: #64748b;
          --about-primary: #0797d5;
          --about-primary-strong: #0ea5e9;
          --about-hero-overlay: rgba(7, 24, 45, 0.62);
          --about-shadow: 0 8px 22px rgba(7, 24, 45, 0.06);
          background: var(--about-bg);
          color: var(--about-text);
        }

        .about-page-shell.about-page-dark {
          --about-bg: #07182d;
          --about-surface: #0b1b33;
          --about-surface-alt: rgba(14, 165, 233, 0.08);
          --about-card-border: rgba(255, 255, 255, 0.12);
          --about-text: #F5F7FA;
          --about-text-strong: #F5F7FA;
          --about-muted: #cbd5e1;
          --about-primary: #7dd3fc;
          --about-primary-strong: #38bdf8;
          --about-hero-overlay: rgba(7, 24, 45, 0.7);
          --about-shadow: 0 8px 22px rgba(2, 6, 23, 0.2);
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
          background-image: linear-gradient(90deg, rgba(30, 111, 166, 0.88), rgba(65, 159, 217, 0.72)), url('/images/university/mekdela-amba-campus.svg');
          background-size: cover;
          background-position: center;
        }

        .about-hero-overlay {
          position: absolute;
          inset: 0;
          background: rgba(65, 159, 217, 0.12);
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

        .about-hero-heading {
          margin: 20px 0 0;
          font-size: clamp(1.5rem, 2.5vw, 2rem);
        }

        .about-toggle {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 8px 0;
          border: 0;
          color: #ffffff;
          background: transparent;
          font: inherit;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }

        .about-toggle:focus-visible {
          border-radius: 4px;
          outline: 3px solid rgba(255, 255, 255, 0.85);
          outline-offset: 4px;
        }

        .about-toggle-indicator {
          display: inline-grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255, 255, 255, 0.55);
          border-radius: 50%;
          font-size: 1.35rem;
          line-height: 1;
        }

        .about-expandable {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          transition: grid-template-rows 300ms ease, opacity 220ms ease;
        }

        .about-expandable.is-expanded {
          grid-template-rows: 1fr;
          opacity: 1;
        }

        .about-expandable-inner {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
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
          border-radius: 14px;
          box-shadow: var(--about-shadow);
          transition: box-shadow 0.2s ease;
        }

        .about-card:hover {
          box-shadow: 0 10px 24px rgba(7, 24, 45, 0.1);
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

        .about-card-values {
          padding: 26px 24px 24px;
        }

        .about-values-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .about-values-list li {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-width: 0;
          padding: 18px;
          border: 1px solid var(--about-card-border);
          border-radius: 12px;
          background: var(--about-surface);
        }

        .about-value-badge {
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          margin-bottom: 12px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.12);
          color: var(--about-primary);
          font-size: 1rem;
        }

        .about-values-list h3 {
          margin: 0 0 8px;
          color: var(--about-text-strong);
          font-size: 1rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .about-values-list p {
          margin: 0;
          color: var(--about-muted);
          font-size: 0.94rem;
          line-height: 1.65;
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
          .about-card-values { padding-left: 18px; padding-right: 18px; }
          .about-values-list { grid-template-columns: 1fr; }
        }

        @media (max-width: 420px) {
          .about-container { width: min(100% - 24px, 1200px); }
          .about-hero { min-height: 180px; }
          .about-hero h1 { font-size: 2.1rem; }
          .about-card-head h2 { font-size: 1.45rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .about-expandable { transition: none; }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;