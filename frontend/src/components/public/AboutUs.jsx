import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  Archive,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  Package,
  RotateCcw,
  ShieldCheck,
  UserRoundCog,
  WalletCards,
  Wrench
} from 'lucide-react';

const pageContent = {
  en: {
    eyebrow: 'Mekdela Amba University',
    title: 'Responsible stewardship of university assets',
    introduction: 'University assets support teaching, research, administration, and the daily work of the institution. Managing these resources responsibly calls for accurate records, clear ownership, and careful attention throughout each asset’s service life.',
    systemLabel: 'The platform',
    systemTitle: 'University Asset Management System',
    systemText: 'The system brings university asset information together in one place for authorized staff. It supports inventory and asset tracking, assignment and transfers, returns and maintenance, verification, reporting, and financial oversight. Role-based access helps staff use information and workflows appropriate to their responsibilities.',
    systemPoints: [
      ['Centralized records', 'Maintain asset information and inventory in a shared system.', Database],
      ['Movement and responsibility', 'Record assignments, transfers, and returns for accountable asset handling.', ArrowLeftRight],
      ['Verification and care', 'Support inventory verification, maintenance, and preservation of asset value.', Wrench],
      ['Reporting and oversight', 'Use operational and financial records to support informed decisions.', FileText]
    ],
    visionLabel: 'Our vision',
    visionTitle: 'Vision',
    visionText: 'To enable accountable, transparent, and efficient management of university assets through reliable, technology-supported practices.',
    missionLabel: 'Our mission',
    missionTitle: 'Mission',
    missionText: 'To provide a reliable system for recording, tracking, protecting, maintaining, and reporting university assets throughout their lifecycle.',
    governanceTitle: 'Principles of asset governance',
    governanceIntro: 'Sound governance makes responsibilities clear and helps protect university resources through consistent, documented practice.',
    governance: [
      ['Accountability', 'People and units entrusted with university assets are responsible for their proper use and care.', UserRoundCog],
      ['Accurate records', 'Asset records and inventory should be kept current and reflect verified information.', Database],
      ['Authorized movement', 'Assignments and movements should be performed by authorized staff and recorded with clear responsibility.', ArrowLeftRight],
      ['Controlled transitions', 'Transfers, returns, and disposal should follow the applicable review and approval process.', ClipboardCheck],
      ['Regular verification', 'Periodic checks help confirm asset existence, location, condition, and assigned responsibility.', ClipboardList],
      ['Maintenance and preservation', 'Timely care and maintenance help preserve assets and their value.', Wrench],
      ['Role-based responsibility', 'Access to records and actions should reflect a staff member’s authorized role and organizational scope.', ShieldCheck],
      ['Auditability and transparency', 'Documented activity and clear reporting make asset decisions easier to review.', FileText]
    ],
    challengesTitle: 'Why a centralized system matters',
    challengesIntro: 'Asset teams commonly face coordination challenges as records and responsibilities spread across units. A centralized system is designed to help address issues such as:',
    challenges: [
      'Fragmented or outdated asset records',
      'Difficulty locating and tracking assets',
      'Unclear responsibility for assigned assets',
      'Inconsistent inventory information',
      'Delays in identifying missing, damaged, or maintenance-required assets',
      'Limited visibility into asset movements and history',
      'Time-consuming reporting and verification'
    ],
    lifecycleTitle: 'University asset lifecycle',
    lifecycleIntro: 'These connected record areas describe the system’s asset workflow. They are not a required linear sequence; available actions depend on the asset and the staff member’s role.',
    lifecycle: [
      ['Registration', Package], ['Receiving', ClipboardList], ['Assignment', UserRoundCog],
      ['Transfer', ArrowLeftRight], ['Verification', ClipboardCheck], ['Maintenance', Wrench],
      ['Return', RotateCcw], ['Disposal', Archive], ['Financial Records', WalletCards]
    ],
    lifecycleNote: 'System access and workflow actions are limited to authorized roles.'
  },
  am: {
    eyebrow: 'መቅደላ አምባ ዩኒቨርሲቲ',
    title: 'የዩኒቨርሲቲ ንብረቶችን በኃላፊነት ማስተዳደር',
    introduction: 'የዩኒቨርሲቲ ንብረቶች ትምህርትን፣ ምርምርን፣ አስተዳደርንና የተቋሙን ዕለታዊ ሥራዎች ይደግፋሉ። እነዚህን ሀብቶች በኃላፊነት ለማስተዳደር ትክክለኛ መዝገቦች፣ ግልጽ ኃላፊነትና በንብረቱ የአገልግሎት ዘመን ሁሉ ጥንቃቄ ያስፈልጋል።',
    systemLabel: 'መድረኩ',
    systemTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    systemText: 'ስርዓቱ የዩኒቨርሲቲ ንብረት መረጃን ለተፈቀደላቸው ሠራተኞች በአንድ ቦታ ያቀናጃል። የኢንቬንተሪና የንብረት ክትትልን፣ ምደባና ዝውውርን፣ መመለስና ጥገናን፣ ማረጋገጫን፣ ሪፖርትንና የገንዘብ ክትትልን ይደግፋል። በሚና ላይ የተመሰረተ መዳረሻ ሠራተኞች ከኃላፊነታቸው ጋር የሚስማማ መረጃና የሥራ ሂደት እንዲጠቀሙ ይረዳል።',
    systemPoints: [
      ['የተማከሉ መዝገቦች', 'የንብረት መረጃንና ኢንቬንተሪን በጋራ ስርዓት ያስቀምጡ።', Database],
      ['እንቅስቃሴና ኃላፊነት', 'ለተጠያቂ የንብረት አጠቃቀም ምደባዎችን፣ ዝውውሮችንና መመለሶችን ይመዝግቡ።', ArrowLeftRight],
      ['ማረጋገጫና ጥንቃቄ', 'የኢንቬንተሪ ማረጋገጫን፣ ጥገናንና የንብረት ዋጋን መጠበቅን ይደግፉ።', Wrench],
      ['ሪፖርትና ክትትል', 'በመረጃ ላይ የተመሰረቱ ውሳኔዎችን ለመደገፍ የሥራና የገንዘብ መዝገቦችን ይጠቀሙ።', FileText]
    ],
    visionLabel: 'ራዕያችን', visionTitle: 'ራዕይ',
    visionText: 'ተጠያቂ፣ ግልጽና ውጤታማ የዩኒቨርሲቲ ንብረት አስተዳደርን በአስተማማኝና በቴክኖሎጂ በተደገፉ አሠራሮች ማስቻል።',
    missionLabel: 'ተልዕኮአችን', missionTitle: 'ተልዕኮ',
    missionText: 'የዩኒቨርሲቲ ንብረቶችን በሕይወት ዘመናቸው ሁሉ ለመመዝገብ፣ ለመከታተል፣ ለመጠበቅ፣ ለማስተናገድና ሪፖርት ለማድረግ አስተማማኝ ስርዓት ማቅረብ።',
    governanceTitle: 'የንብረት አስተዳደር መርሆዎች',
    governanceIntro: 'ጥሩ አስተዳደር ኃላፊነቶችን ግልጽ ያደርጋል፤ የተቋሙን ሀብቶችም በተመጣጣኝና በሰነድ በተደገፈ አሠራር ለመጠበቅ ይረዳል።',
    governance: [
      ['ተጠያቂነት', 'የዩኒቨርሲቲ ንብረት በኃላፊነት የተረከቡ ሰዎችና ክፍሎች በትክክል ለመጠቀምና ለመጠበቅ ኃላፊ ናቸው።', UserRoundCog],
      ['ትክክለኛ መዝገቦች', 'የንብረት መዝገቦችና ኢንቬንተሪ ወቅታዊ ሆነው የተረጋገጠ መረጃን ማንጸባረቅ አለባቸው።', Database],
      ['የተፈቀደ እንቅስቃሴ', 'ምደባዎችና የንብረት እንቅስቃሴዎች በተፈቀዱ ሠራተኞች መከናወንና በግልጽ ኃላፊነት መመዝገብ አለባቸው።', ArrowLeftRight],
      ['ቁጥጥር ያላቸው ለውጦች', 'ዝውውር፣ መመለስና ማስወገድ ተገቢውን የግምገማና የማጽደቅ ሂደት መከተል አለባቸው።', ClipboardCheck],
      ['መደበኛ ማረጋገጫ', 'ወቅታዊ ምርመራዎች የንብረት መኖርን፣ ቦታን፣ ሁኔታንና ኃላፊነትን ለማረጋገጥ ይረዳሉ።', ClipboardList],
      ['ጥገናና ጥበቃ', 'በወቅቱ የሚደረግ እንክብካቤና ጥገና ንብረቶችንና ዋጋቸውን ለመጠበቅ ይረዳል።', Wrench],
      ['በሚና ላይ የተመሰረተ ኃላፊነት', 'የመዝገቦችና የድርጊቶች መዳረሻ ከሠራተኛው ፈቃድ ካለው ሚናና የድርጅት ወሰን ጋር መጣጣም አለበት።', ShieldCheck],
      ['ኦዲትና ግልጽነት', 'የተመዘገቡ ድርጊቶችና ግልጽ ሪፖርቶች የንብረት ውሳኔዎችን ለመገምገም ያስችላሉ።', FileText]
    ],
    challengesTitle: 'የተማከለ ስርዓት ለምን ያስፈልጋል?',
    challengesIntro: 'መዝገቦችና ኃላፊነቶች በተለያዩ ክፍሎች ሲሰራጩ የንብረት ቡድኖች የቅንጅት ችግሮች ሊያጋጥሟቸው ይችላሉ። የተማከለ ስርዓት እንደሚከተሉት ያሉ ችግሮችን ለመቅረፍ ታስቦ የተዘጋጀ ነው፦',
    challenges: [
      'የተበታተኑ ወይም ያልዘመኑ የንብረት መዝገቦች',
      'ንብረቶችን የማግኘትና የመከታተል ችግር',
      'ለተመደቡ ንብረቶች ግልጽ ያልሆነ ኃላፊነት',
      'የማይጣጣም የኢንቬንተሪ መረጃ',
      'የጠፉ፣ የተጎዱ ወይም ጥገና የሚያስፈልጋቸውን ንብረቶች ለመለየት መዘግየት',
      'ስለ ንብረት እንቅስቃሴና ታሪክ ያለ ውስን ግልጽነት',
      'ጊዜ የሚወስድ ሪፖርትና ማረጋገጫ'
    ],
    lifecycleTitle: 'የዩኒቨርሲቲ ንብረት የሕይወት ዘመን',
    lifecycleIntro: 'እነዚህ የተያያዙ የመዝገብ ዘርፎች የስርዓቱን የንብረት የሥራ ሂደት ያሳያሉ። የግድ በቋሚ ቅደም ተከተል የሚከናወኑ አይደሉም፤ የሚፈቀዱ ድርጊቶች በንብረቱና በሠራተኛው ሚና ይወሰናሉ።',
    lifecycle: [
      ['ምዝገባ', Package], ['መቀበል', ClipboardList], ['ምደባ', UserRoundCog],
      ['ዝውውር', ArrowLeftRight], ['ማረጋገጫ', ClipboardCheck], ['ጥገና', Wrench],
      ['መመለስ', RotateCcw], ['ማስወገድ', Archive], ['የገንዘብ መዝገቦች', WalletCards]
    ],
    lifecycleNote: 'የስርዓት መዳረሻና የሥራ ሂደት ድርጊቶች ለተፈቀዱ ሚናዎች ብቻ የተገደቡ ናቸው።'
  }
};

const AboutUs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const location = useLocation();
  const text = pageContent[language] || pageContent.en;

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView?.({ block: 'start' });
  }, [location.hash]);

  return (
    <div className={`about-page${theme === 'dark' ? ' about-page-dark' : ''}`}>
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-container about-hero-layout">
          <div className="about-hero-copy">
            <span className="about-eyebrow">{text.eyebrow}</span>
            <h1 id="about-title">Mekdela Amba University</h1>
            <p className="about-hero-statement">{text.title}</p>
            <p className="about-introduction">{text.introduction}</p>
          </div>
          <div className="about-hero-emblem" aria-hidden="true"><Building2 size={60} strokeWidth={1.4} /></div>
        </div>
      </section>

      <section id="services" className="about-section about-system-section" aria-labelledby="about-system-title">
        <div className="about-container">
          <div className="about-section-heading">
            <span className="about-eyebrow">{text.systemLabel}</span>
            <h2 id="about-system-title">{text.systemTitle}</h2>
            <p>{text.systemText}</p>
          </div>
          <ul className="about-system-grid">
            {text.systemPoints.map(([title, description, Icon]) => (
              <li className="about-system-point" key={title}>
                <span className="about-icon-box"><Icon size={21} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="about-direction-section" aria-labelledby="about-vision-title about-mission-title">
        <div className="about-container about-direction-grid">
          <article className="about-direction-item">
            <span className="about-eyebrow">{text.visionLabel}</span>
            <h2 id="about-vision-title">{text.visionTitle}</h2>
            <p>{text.visionText}</p>
          </article>
          <article className="about-direction-item">
            <span className="about-eyebrow">{text.missionLabel}</span>
            <h2 id="about-mission-title">{text.missionTitle}</h2>
            <p>{text.missionText}</p>
          </article>
        </div>
      </section>

      <section className="about-section about-governance-section" aria-labelledby="about-governance-title">
        <div className="about-container">
          <div className="about-section-heading">
            <span className="about-eyebrow">01</span>
            <h2 id="about-governance-title">{text.governanceTitle}</h2>
            <p>{text.governanceIntro}</p>
          </div>
          <ul className="about-governance-list">
            {text.governance.map(([title, description, Icon], index) => (
              <li className="about-governance-item" key={title}>
                <span className="about-governance-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="about-icon-box"><Icon size={20} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="about-section about-challenges-section" aria-labelledby="about-challenges-title">
        <div className="about-container about-challenges-layout">
          <div className="about-section-heading">
            <span className="about-eyebrow">02</span>
            <h2 id="about-challenges-title">{text.challengesTitle}</h2>
            <p>{text.challengesIntro}</p>
          </div>
          <ul className="about-challenge-list">
            {text.challenges.map((challenge) => (
              <li key={challenge}><span aria-hidden="true" />{challenge}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="lifecycle" className="about-section about-lifecycle-section" aria-labelledby="about-lifecycle-title">
        <div className="about-container">
          <div className="about-section-heading">
            <span className="about-eyebrow">03</span>
            <h2 id="about-lifecycle-title">{text.lifecycleTitle}</h2>
            <p>{text.lifecycleIntro}</p>
          </div>
          <ol className="about-lifecycle-list">
            {text.lifecycle.map(([label, Icon], index) => (
              <li className="about-lifecycle-step" key={label}>
                <span className="about-lifecycle-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="about-icon-box"><Icon size={21} aria-hidden="true" /></span>
                <strong>{label}</strong>
                {index < text.lifecycle.length - 1 && <ArrowRight className="about-lifecycle-connector" size={15} aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <p className="about-lifecycle-note"><ShieldCheck size={17} aria-hidden="true" />{text.lifecycleNote}</p>
        </div>
      </section>

      <style>{`
        .about-page {
          --about-navy: #1a237e;
          --about-cyan: #0ea5e9;
          --about-blue: #2563eb;
          --about-ink: #17212b;
          --about-muted: #536273;
          --about-line: #dce4ec;
          --about-soft: #f3f8fc;
          --about-white: #ffffff;
          color: var(--about-ink);
          background: var(--about-white);
        }
        .about-page-dark {
          --about-ink: #e8eff7;
          --about-muted: #c0ccda;
          --about-line: rgba(203, 213, 225, .2);
          --about-soft: #111b2d;
          --about-white: #0d1626;
        }
        .about-container { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
        .about-hero { padding: clamp(64px, 8vw, 104px) 0; color: #fff; background: var(--about-navy); }
        .about-hero-layout { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 56px; align-items: center; }
        .about-hero .about-eyebrow { color: #7dd3fc; }
        .about-eyebrow { display: block; margin: 0 0 13px; color: var(--about-blue); font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .about-hero h1 { max-width: 820px; margin: 0; font-size: clamp(2.5rem, 5.4vw, 4.65rem); line-height: 1.08; }
        .about-hero-statement { max-width: 730px; margin: 22px 0 0; color: #c9edff; font-size: clamp(1.25rem, 2.4vw, 1.75rem); font-weight: 650; line-height: 1.4; }
        .about-introduction { max-width: 720px; margin: 16px 0 0; color: #e2eaf4; font-size: 1.04rem; line-height: 1.8; }
        .about-hero-emblem { display: grid; width: 154px; aspect-ratio: 1; place-items: center; justify-self: end; border: 1px solid rgba(255,255,255,.28); border-radius: 50%; color: #7dd3fc; background: rgba(255,255,255,.06); }
        .about-section { padding: 76px 0; }
        .about-section[id] { scroll-margin-top: calc(var(--public-header-height, 76px) + 18px); }
        .about-section-heading { max-width: 820px; }
        .about-section-heading h2, .about-direction-item h2 { margin: 0 0 15px; color: var(--about-ink); font-size: clamp(1.8rem, 3.5vw, 2.6rem); line-height: 1.18; }
        .about-section-heading > p { margin: 0; color: var(--about-muted); font-size: 1rem; line-height: 1.8; }
        .about-system-section { background: var(--about-soft); }
        .about-system-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 36px; margin: 34px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--about-line); }
        .about-system-point { display: flex; min-width: 0; gap: 15px; padding: 23px 0; border-bottom: 1px solid var(--about-line); }
        .about-icon-box { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; border-radius: 8px; color: var(--about-blue); background: color-mix(in srgb, var(--about-cyan) 13%, transparent); }
        .about-system-point h3, .about-governance-item h3 { margin: 1px 0 6px; color: var(--about-ink); font-size: 1rem; line-height: 1.4; }
        .about-system-point p, .about-governance-item p { margin: 0; color: var(--about-muted); font-size: .92rem; line-height: 1.65; }
        .about-direction-section { padding: 0; background: var(--about-navy); color: #fff; }
        .about-direction-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .about-direction-item { padding: 44px 42px 48px 0; }
        .about-direction-item + .about-direction-item { padding-right: 0; padding-left: 42px; border-left: 1px solid rgba(255,255,255,.24); }
        .about-direction-item .about-eyebrow { color: #7dd3fc; }
        .about-direction-item h2 { margin-bottom: 10px; color: #fff; font-size: 1.65rem; }
        .about-direction-item p { max-width: 490px; margin: 0; color: #e2eaf4; line-height: 1.75; }
        .about-governance-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 44px; margin: 36px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--about-line); }
        .about-governance-item { display: grid; grid-template-columns: 32px 42px minmax(0, 1fr); gap: 13px; align-items: start; padding: 21px 0; border-bottom: 1px solid var(--about-line); }
        .about-governance-number, .about-lifecycle-number { padding-top: 3px; color: var(--about-blue); font-size: .75rem; font-weight: 800; }
        .about-challenges-section { background: var(--about-soft); }
        .about-challenges-layout { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 72px; align-items: start; }
        .about-challenge-list { display: grid; gap: 13px; margin: 2px 0 0; padding: 0; list-style: none; }
        .about-challenge-list li { display: flex; gap: 13px; align-items: baseline; color: var(--about-ink); line-height: 1.6; }
        .about-challenge-list li > span { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: var(--about-cyan); }
        .about-lifecycle-list { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 10px; margin: 36px 0 0; padding: 0; list-style: none; }
        .about-lifecycle-step { position: relative; display: flex; min-width: 0; min-height: 146px; flex-direction: column; align-items: flex-start; gap: 11px; padding: 13px 11px; border: 1px solid var(--about-line); border-radius: 8px; background: var(--about-soft); }
        .about-lifecycle-connector { position: absolute; top: 25px; right: -13px; z-index: 1; color: var(--about-cyan); }
        .about-lifecycle-step .about-icon-box { width: 38px; height: 38px; flex-basis: 38px; }
        .about-lifecycle-step strong { color: var(--about-ink); font-size: .87rem; line-height: 1.4; overflow-wrap: anywhere; }
        .about-lifecycle-note { display: flex; gap: 9px; align-items: center; margin: 18px 0 0; color: var(--about-muted); font-size: .86rem; line-height: 1.6; }
        .about-lifecycle-note svg { flex: 0 0 auto; color: var(--about-blue); }
        @media (max-width: 1050px) {
          .about-lifecycle-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .about-lifecycle-connector { display: none; }
        }
        @media (max-width: 760px) {
          .about-container { width: min(100% - 36px, 1160px); }
          .about-hero-layout { grid-template-columns: minmax(0, 1fr) 104px; gap: 24px; }
          .about-hero-emblem { width: 96px; }
          .about-hero-emblem svg { width: 42px; height: 42px; }
          .about-section { padding: 60px 0; }
          .about-challenges-layout { grid-template-columns: 1fr; gap: 28px; }
        }
        @media (max-width: 560px) {
          .about-container { width: min(100% - 28px, 1160px); }
          .about-hero { padding: 54px 0 58px; }
          .about-hero-layout { grid-template-columns: 1fr; }
          .about-hero-emblem { display: none; }
          .about-system-grid, .about-governance-list, .about-direction-grid { grid-template-columns: 1fr; }
          .about-system-grid { margin-top: 26px; }
          .about-direction-item { padding: 34px 0; }
          .about-direction-item + .about-direction-item { padding: 32px 0 36px; border-top: 1px solid rgba(255,255,255,.24); border-left: 0; }
          .about-governance-list { margin-top: 27px; }
          .about-governance-item { grid-template-columns: 24px 38px minmax(0, 1fr); gap: 10px; }
          .about-lifecycle-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 26px; }
          .about-lifecycle-step { min-height: 126px; }
          .about-lifecycle-step strong { font-size: .9rem; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .about-system-point, .about-governance-item { transition: background-color 150ms ease; }
          .about-system-point:hover, .about-governance-item:hover { background: color-mix(in srgb, var(--about-cyan) 5%, transparent); }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;