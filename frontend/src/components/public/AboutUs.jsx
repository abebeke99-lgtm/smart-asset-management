import React from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const pageContent = {
  en: {
    title: 'Mekdela Amba University',
    introduction: 'Mekdela Amba University is a higher education institution dedicated to quality education, research, innovation, and community development.',
    aboutTitle: 'About Us',
    aboutText: 'Mekdela Amba University is committed to creating a strong academic environment where students, academic staff, researchers, and the wider community can learn, collaborate, and contribute to sustainable development.',
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
    <div className={`about-page${theme === 'dark' ? ' about-page-dark' : ''}`}>
      <div className="about-content">
        <header className="about-intro">
          <h1>{text.title}</h1>
          <p>{text.introduction}</p>
        </header>

        <section className="about-section" aria-labelledby="about-us-title">
          <h2 id="about-us-title">{text.aboutTitle}</h2>
          <p>{text.aboutText}</p>
        </section>

        <div className="about-direction">
          <section className="about-section" aria-labelledby="about-vision-title">
            <h2 id="about-vision-title">{text.visionTitle}</h2>
            <p>{text.visionText}</p>
          </section>
          <section className="about-section" aria-labelledby="about-mission-title">
            <h2 id="about-mission-title">{text.missionTitle}</h2>
            <p>{text.missionLead}</p>
            <ul>{text.mission.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>

        <section className="about-section" aria-labelledby="about-values-title">
          <h2 id="about-values-title">{text.valuesTitle}</h2>
          <ul className="about-values-list">
            {text.values.map((value) => <li key={value}>{value}</li>)}
          </ul>
        </section>

        <section className="about-section about-commitment" aria-labelledby="about-commitment-title">
          <h2 id="about-commitment-title">{text.commitmentTitle}</h2>
          <p>{text.commitmentText}</p>
        </section>
      </div>

      <style>{`
        .about-page {
          --about-ink: #1c2935;
          --about-muted: #52616d;
          --about-line: #dce3e8;
          --about-accent: #245c50;
          --about-soft: #f4f7f5;
          color: var(--about-ink);
          background: #fff;
        }
        .about-page-dark {
          --about-ink: #e6ece9;
          --about-muted: #bdc9c3;
          --about-line: rgba(203, 213, 225, .2);
          --about-accent: #91c9b3;
          --about-soft: #18231f;
          background: #111916;
        }
        .about-content { width: min(100% - 56px, 1040px); margin: 0 auto; padding: 64px 0 76px; }
        .about-intro { max-width: 850px; padding: 0 0 34px; border-bottom: 1px solid var(--about-line); }
        .about-intro h1 { margin: 0; color: var(--about-ink); font-size: 2.5rem; line-height: 1.2; overflow-wrap: anywhere; }
        .about-intro p, .about-section p { margin: 15px 0 0; color: var(--about-muted); font-size: 1rem; line-height: 1.8; }
        .about-direction { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 64px; }
        .about-section { padding: 31px 0; border-bottom: 1px solid var(--about-line); }
        .about-section h2 { margin: 0; color: var(--about-accent); font-size: 1.3rem; line-height: 1.4; }
        .about-section ul { display: grid; gap: 10px; margin: 14px 0 0; padding-left: 21px; color: var(--about-muted); line-height: 1.7; }
        .about-values-list { grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 32px; }
        .about-commitment { padding-bottom: 0; border-bottom: 0; }
        @media (max-width: 700px) {
          .about-content { width: min(100% - 40px, 1040px); padding: 46px 0 56px; }
          .about-intro h1 { font-size: 2rem; }
          .about-direction { grid-template-columns: 1fr; gap: 0; }
          .about-values-list { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 24px; }
        }
        @media (max-width: 420px) {
          .about-content { width: min(100% - 32px, 1040px); padding-top: 36px; }
          .about-intro h1 { font-size: 1.75rem; }
          .about-values-list { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;