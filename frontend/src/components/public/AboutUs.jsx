import React from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const pageContent = {
  en: {
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
  const text = pageContent[language] || pageContent.en;

  return (
    <div className={`about-page-shell${theme === 'dark' ? ' about-page-dark' : ''}`}>
      <main className="about-main" aria-label={text.visionTitle}>
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
          --about-shadow: 0 8px 22px rgba(2, 6, 23, 0.2);
        }

        .about-container {
          width: min(100% - 32px, 1200px);
          margin: 0 auto;
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
          .about-card-vision,
          .about-card-mission,
          .about-card-values { padding-left: 18px; padding-right: 18px; }
          .about-values-list { grid-template-columns: 1fr; }
        }

        @media (max-width: 420px) {
          .about-container { width: min(100% - 24px, 1200px); }
          .about-card-head h2 { font-size: 1.45rem; }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;