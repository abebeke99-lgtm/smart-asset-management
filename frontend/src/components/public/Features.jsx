/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
import React from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Boxes,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Languages,
  MapPin,
  QrCode,
  Radio,
  ShieldCheck,
  Workflow,
  Wrench
} from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const featureCatalog = {
  en: {
    pageTitle: 'Features',
    subtitle: 'Powerful digital capabilities for secure, transparent, and efficient university asset management.',
    sectionTitle: 'Asset Management',
    cards: [
      {
        title: 'Real-time Asset Tracking',
        description: 'Authorized users can monitor current asset locations, assigned custodians, movement history, and current status through the system records used for accountability and operational oversight.',
        capabilities: ['Asset location visibility', 'Assignment tracking', 'Movement history'],
        icon: MapPin,
        category: 'Asset Management'
      },
      {
        title: 'Inventory Control',
        description: 'Stock records and asset availability are used to review inventory status, identify low-stock items, and support controlled management of university assets.',
        capabilities: ['Inventory visibility', 'Available assets', 'Low-stock monitoring'],
        icon: Boxes,
        category: 'Asset Management'
      },
      {
        title: 'RFID / QR',
        description: 'The system supports QR and RFID-based identification workflows for asset lookup, recognition, and recorded movement tracking where those processes are enabled in the current implementation.',
        capabilities: ['QR identification', 'RFID identification', 'Asset lookup'],
        icon: QrCode,
        secondaryIcon: Radio,
        category: 'Technology'
      },
      {
        title: 'Role-Based Access Control',
        description: 'System access is controlled according to the authenticated user role and assigned permissions, with authorized actions determined by the backend authorization rules.',
        capabilities: ['Admin', 'College Manager', 'Store Manager', 'Department Head', 'ICT Officer', 'Finance', 'Maintenance', 'Infrastructure'],
        icon: ShieldCheck,
        category: 'Security & Governance'
      },
      {
        title: 'Asset Lifecycle Management',
        description: 'The recorded lifecycle follows the practical workflow used for university assets: registration, receiving, assignment, transfer, verification, maintenance, return, disposal, and financial recordkeeping.',
        capabilities: ['Registration', 'Receiving', 'Assignment', 'Transfer', 'Verification', 'Maintenance', 'Return', 'Disposal'],
        icon: Workflow,
        category: 'Asset Management'
      },
      {
        title: 'Maintenance Management',
        description: 'Authorized maintenance users can manage maintenance requests, current status, work tracking, and maintenance history according to role permissions and organizational scope.',
        capabilities: ['Maintenance requests', 'Status tracking', 'Work history'],
        icon: Wrench,
        category: 'Operations & Reporting'
      },
      {
        title: 'Transfer Management',
        description: 'Transfer requests, approvals, statuses, and movement history are kept within the organization’s workflow, with access limited by authorization and role scope.',
        capabilities: ['Transfer requests', 'Approval workflow', 'Movement tracking'],
        icon: ArrowLeftRight,
        category: 'Asset Management'
      },
      {
        title: 'Financial Records',
        description: 'Relevant financial information supports asset valuation, depreciation, and financial reporting in the finance module without exposing private records on this public page.',
        capabilities: ['Asset financial records', 'Valuation', 'Depreciation', 'Financial reporting'],
        icon: CircleDollarSign,
        category: 'Operations & Reporting'
      },
      {
        title: 'Reports & Analytics',
        description: 'Asset, inventory, department, and financial reports are available to authorized users in line with their permissions and access scope.',
        capabilities: ['Inventory reports', 'Asset reports', 'Department reports', 'Financial reports'],
        icon: BarChart3,
        category: 'Operations & Reporting'
      },
      {
        title: 'Audit Logs',
        description: 'Important system actions are recorded to support accountability, traceability, and administrative review without exposing actual audit records on the public page.',
        capabilities: ['User action tracking', 'Asset activity', 'Administrative activity'],
        icon: ClipboardCheck,
        category: 'Security & Governance'
      },
      {
        title: 'Notifications',
        description: 'The system sends relevant in-app notifications for supported events such as requests, approvals, alerts, maintenance progress, inventory issues, and other role-based workflows.',
        capabilities: ['Requests', 'Approvals', 'Maintenance updates', 'Inventory alerts'],
        icon: BellRing,
        category: 'Security & Governance'
      },
      {
        title: 'English ↔ አማርኛ',
        description: 'The interface uses the existing language system for bilingual access, allowing users to switch between English and Amharic without creating a separate translation framework.',
        capabilities: ['English', 'አማርኛ', 'Shared language context'],
        icon: Languages,
        category: 'Technology'
      },
      {
        title: 'Secure Authentication',
        description: 'Signed-in access, protected management areas, role-based authorization, and secure session handling follow the existing implementation and keep protected APIs behind the application’s access controls.',
        capabilities: ['User authentication', 'Protected management areas', 'Role-based authorization'],
        icon: ShieldCheck,
        category: 'Security & Governance'
      }
    ],
    lifecycle: ['Registration', 'Receiving', 'Assignment', 'Transfer', 'Verification', 'Maintenance', 'Return', 'Disposal', 'Financial Records'],
    note: 'Role-based access and authenticated workflows are controlled by the system backend and the user\'s permissions.'
  },
  am: {
    pageTitle: 'ባህሪያት',
    subtitle: 'ለደህንነት፣ ግልጽነት እና ውጤታማነት የተዘጋጁ የዩኒቨርሲቲ ንብረት አስተዳደር ዲጂታል ተቋራጮች።',
    sectionTitle: 'የንብረት አስተዳደር',
    cards: [
      {
        title: 'በእውነተኛ ጊዜ የንብረት ክትትል',
        description: 'ፈቃድ ያላቸው ተጠቃሚዎች የንብረት ቦታ፣ የተመደቡ ኃላፊዎች፣ የእንቅስቃሴ ታሪክ እና የአሁኑ ሁኔታን በስርዓቱ መዝገቦች ላይ ማየት ይችላሉ።',
        capabilities: ['የንብረት ቦታ እይታ', 'የምደባ ክትትል', 'የእንቅስቃሴ ታሪክ'],
        icon: MapPin,
        category: 'የንብረት አስተዳደር'
      },
      {
        title: 'የኢንቬንተሪ ቁጥጥር',
        description: 'የክምችት መዝገቦች እና የንብረት መገኘት በማስተዳደር ውስጥ እንዲተገበሩ የሚያግዙ፣ ዝቅተኛ ክምችት እቃዎችን ለመለየት እና የንብረት አስተዳደርን ለመቆጣጠር ያግዛሉ።',
        capabilities: ['የኢንቬንተሪ እይታ', 'ያሉ ንብረቶች', 'ዝቅተኛ ክምችት ክትትል'],
        icon: Boxes,
        category: 'የንብረት አስተዳደር'
      },
      {
        title: 'RFID / QR',
        description: 'ስርዓቱ QR እና RFID የሚሰሩ መለያ ሂደቶችን ይደግፋል፣ ንብረትን ለመፈለግ፣ ለመለየት እና በሚከለችበት እንቅስቃሴ ታሪክ ላይ ይረዳል።',
        capabilities: ['የQR መለያ', 'የRFID መለያ', 'የንብረት ፍለጋ'],
        icon: QrCode,
        secondaryIcon: Radio,
        category: 'ቴክኖሎጂ'
      },
      {
        title: 'በሚና የተመሰረተ መዳረሻ ቁጥጥር',
        description: 'የስርዓት መዳረሻ ከተግባር ያለው ተጠቃሚ ሚና እና ፈቃዶች ጋር በማወዳደር ይቆጣጠራል፣ እና የሚፈቀዱ እርምጃዎች በጀርባ ያለው የባህርይ ፈቃድ ህግ ይወስናሉ።',
        capabilities: ['አስተዳዳሪ', 'የኮሌጅ አስተዳዳሪ', 'የመጋዘን አስተዳዳሪ', 'የክፍል ኃላፊ', 'የICT ባለሙያ', 'ፋይናንስ', 'ጥገና', 'መሠረተ አስተዳደር'],
        icon: ShieldCheck,
        category: 'ደህንነት እና አስተዳደር'
      },
      {
        title: 'የንብረት ዑደት አስተዳደር',
        description: 'የምዝገባ፣ መቀበል፣ ምደባ፣ ዝውውር፣ ማረጋገጫ፣ ጥገና፣ መመለስ፣ ማስወገድ እና የገንዘብ መዝገቦችን የሚከተሉ የንብረት ዑደት ተመዝግቧል።',
        capabilities: ['ምዝገባ', 'መቀበል', 'ምደባ', 'ዝውውር', 'ማረጋገጫ', 'ጥገና', 'መመለስ', 'ማስወገድ'],
        icon: Workflow,
        category: 'የንብረት አስተዳደር'
      },
      {
        title: 'የጥገና አስተዳደር',
        description: 'ፈቃድ ያላቸው የጥገና ተጠቃሚዎች የጥገና ጥያቄዎችን፣ ወቅታዊ ሁኔታቸውን፣ የስራ ክትትልን እና የጥገና ታሪክን ያስተዳድራሉ።',
        capabilities: ['የጥገና ጥያቄዎች', 'ሁኔታ ክትትል', 'የስራ ታሪክ'],
        icon: Wrench,
        category: 'ክወና እና ሪፖርት'
      },
      {
        title: 'የዝውውር አስተዳደር',
        description: 'የዝውውር ጥያቄዎች፣ ማጽደቆች፣ ሁኔታዎች እና የእንቅስቃሴ ታሪክ በድርጅቱ ሂደት ውስጥ ይቀመጣሉ፣ እና መዳረሻው በፈቃድ እና በሚና ክልል ይገደባል።',
        capabilities: ['የዝውውር ጥያቄዎች', 'የማጽደቅ ሂደት', 'የእንቅስቃሴ ክትትል'],
        icon: ArrowLeftRight,
        category: 'የንብረት አስተዳደር'
      },
      {
        title: 'የገንዘብ መዝገቦች',
        description: 'ተገቢ የገንዘብ መረጃ የንብረት እሴት፣ የመቀነስ ታሪክ እና የፋይናንስ ሪፖርት ለመደገፍ ይጠቅማል፣ ይህንን በፖሊሲ ያለ ግልጽነት አይከፍትም።',
        capabilities: ['የንብረት የገንዘብ መዝገቦች', 'ዋጋ ማስተካከያ', 'የመቀነስ ታሪክ', 'የፋይናንስ ሪፖርት'],
        icon: CircleDollarSign,
        category: 'ክወና እና ሪፖርት'
      },
      {
        title: 'ሪፖርቶች እና ትንታኔ',
        description: 'የንብረት፣ ኢንቬንተሪ፣ ክፍል እና የገንዘብ ሪፖርቶች በፈቃድ ያላቸው ተጠቃሚዎች በመዳረሻና ፈቃድ እንደሚያስፈልጋቸው ይገኛሉ።',
        capabilities: ['የኢንቬንተሪ ሪፖርቶች', 'የንብረት ሪፖርቶች', 'የክፍል ሪፖርቶች', 'የገንዘብ ሪፖርቶች'],
        icon: BarChart3,
        category: 'ክወና እና ሪፖርት'
      },
      {
        title: 'የኦዲት መዝገቦች',
        description: 'አስፈላጊ የስርዓት ድርጊቶች ለተጠያቂነት፣ መከታተያ እና አስተዳደራዊ ግምገማ ይመዘገባሉ፣ ነገር ግን እውነተኛ የኦዲት መዝገቦች በህዝባዊ ገጽ ላይ አይታይም።',
        capabilities: ['የተጠቃሚ እርምጃ ክትትል', 'የንብረት እንቅስቃሴ', 'አስተዳደራዊ እንቅስቃሴ'],
        icon: ClipboardCheck,
        category: 'ደህንነት እና አስተዳደር'
      },
      {
        title: 'ማሳወቂያዎች',
        description: 'ስርዓቱ ለድጋፍ የሚደረጉ ክስተቶች ማሳወቂያዎችን ይልካል፣ እንደ ጥያቄዎች፣ ማጽደቅ፣ ማንቂያዎች፣ የጥገና ሁኔታዎች እና የኢንቬንተሪ ችግሮች።',
        capabilities: ['ጥያቄዎች', 'ማጽደቅ', 'የጥገና ማሳወቂያ', 'የኢንቬንተሪ ችግር'],
        icon: BellRing,
        category: 'ደህንነት እና አስተዳደር'
      },
      {
        title: 'English ↔ አማርኛ',
        description: 'በአሁኑ የቋንቋ ስርዓት ውስጥ ተጠቃሚዎች በእንግሊዝኛ እና በአማርኛ መካከል መቀያየር ይችላሉ፣ በስርዓት ውስጥ ሌላ የቋንቋ ማሽን አይፈጥርም።',
        capabilities: ['English', 'አማርኛ', 'የቋንቋ ስርዓት'],
        icon: Languages,
        category: 'ቴክኖሎጂ'
      },
      {
        title: 'ደህንነታማ ማረጋገጫ',
        description: 'የተገቢ መግቢያ፣ የተጠበቁ አስተዳደራዊ ክልሎች፣ በሚና ላይ የተመሰረተ ፈቃድ እና የደህንነት ክፍል በነባሩ አፈጻጸም ላይ ይመሰረታሉ።',
        capabilities: ['የተጠቃሚ ማረጋገጫ', 'የተጠበቁ አስተዳደራዊ ክልሎች', 'በሚና ላይ የተመሰረተ ፈቃድ'],
        icon: ShieldCheck,
        category: 'ደህንነት እና አስተዳደር'
      }
    ],
    lifecycle: ['ምዝገባ', 'መቀበል', 'ምደባ', 'ዝውውር', 'ማረጋገጫ', 'ጥገና', 'መመለስ', 'ማስወገድ', 'የገንዘብ መዝገቦች'],
    note: 'የሚና ላይ የተመሰረተ መዳረሻ እና የተገቢ የሥራ ሂደቶች በስርዓቱ ባህርይ እና በተጠቃሚ ፈቃድ ይቆጣጠራሉ።'
  }
};

const featureGroups = {
  en: [
    {
      heading: 'Asset Management',
      description: 'Core workflows for tracking and governing physical university assets.'
    },
    {
      heading: 'Security & Governance',
      description: 'Access, accountability, and traceability for protected system workflows.'
    },
    {
      heading: 'Technology',
      description: 'Identification and interface capabilities built into the platform.'
    },
    {
      heading: 'Operations & Reporting',
      description: 'Maintenance, financial, and analytics workflows for authorized users.'
    }
  ],
  am: [
    {
      heading: 'የንብረት አስተዳደር',
      description: 'የአካላዊ ዩኒቨርሲቲ ንብረቶችን ለመከታተል እና ለመቆጣጠር የሚያገለግሉ ዋና ሂደቶች።'
    },
    {
      heading: 'ደህንነት እና አስተዳደር',
      description: 'ለየተጠበቁ የስርዓት ሂደቶች መዳረሻ፣ ተጠያቂነት እና መከታተያ።'
    },
    {
      heading: 'ቴክኖሎጂ',
      description: 'በመርከቧ ውስጥ የተካተቱ የመለያና የበይነገጽ ባህሪያት።'
    },
    {
      heading: 'ክወና እና ሪፖርት',
      description: 'ለፈቃድ ያላቸው ተጠቃሚዎች የጥገና፣ የገንዘብ እና የትንታኔ ሂደቶች።'
    }
  ]
};

const FeatureCard = ({ title, description, icon: Icon, capabilities = [], secondaryIcon: SecondaryIcon }) => (
  <article className="feature-card" aria-label={`${title} feature`}>
    <div className="feature-card-top">
      <span className="feature-card-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>
      {SecondaryIcon && <span className="feature-card-secondary-icon" aria-hidden="true"><SecondaryIcon size={15} strokeWidth={2} /></span>}
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    <ul className="feature-capability-list">
      {capabilities.map((item) => <li key={item}>{item}</li>)}
    </ul>
  </article>
);

const LifecycleCard = ({ steps, note }) => (
  <div className="lifecycle-card" aria-label="Asset lifecycle flow">
    <div className="lifecycle-flow">
      {steps.map((step, index) => (
        <div className="lifecycle-node" key={step}>
          <span className="lifecycle-index">{index + 1}</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
    <p className="lifecycle-note">{note}</p>
  </div>
);

const Features = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const copy = featureCatalog[language] || featureCatalog.en;
  const isDark = theme === 'dark';
  const categoryGroups = featureGroups[language] || featureGroups.en;

  return (
    <main className={`features-page${isDark ? ' features-page-dark' : ''}`}>
      <section className="features-hero" aria-labelledby="features-page-title">
        <div className="features-shell features-hero-grid">
          <div className="features-hero-copy">
            <span className="features-eyebrow">{language === 'am' ? 'ባህሪያት' : 'Features'}</span>
            <h1 id="features-page-title">{copy.pageTitle}</h1>
            <p className="features-hero-subtitle">{copy.subtitle}</p>
          </div>

          <div className="features-hero-panel" aria-label="System feature summary">
            <div className="feature-summary-box primary">
              <span className="feature-summary-label">{language === 'am' ? 'የስርዓት ጉዳዮች' : 'System scope'}</span>
              <strong>{language === 'am' ? 'አካላዊ / ተማሪ / ማስተዳደር' : 'Asset records & governance'}</strong>
            </div>
            <div className="feature-summary-grid">
              <div className="feature-summary-box"><MapPin size={18} /><span>{language === 'am' ? 'ክትትል' : 'Tracking'}</span></div>
              <div className="feature-summary-box"><ShieldCheck size={18} /><span>{language === 'am' ? 'መዳረሻ' : 'Access'}</span></div>
              <div className="feature-summary-box"><BarChart3 size={18} /><span>{language === 'am' ? 'ሪፖርት' : 'Reports'}</span></div>
              <div className="feature-summary-box"><Wrench size={18} /><span>{language === 'am' ? 'ጥገና' : 'Maintenance'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" aria-labelledby="feature-categories-title">
        <div className="features-shell">
          <div className="section-heading">
            <span className="section-index">01</span>
            <h2 id="feature-categories-title">{language === 'am' ? 'የንብረት ተግባራት' : 'System capabilities'}</h2>
          </div>

          <div className="category-stack">
            {categoryGroups.map((group) => {
              const featureItems = copy.cards.filter((card) => card.category === group.heading ||
                (language === 'am' && (card.category === 'Asset Management' || card.category === 'Security & Governance' || card.category === 'Technology' || card.category === 'Operations & Reporting')) ||
                (language === 'en' && (group.heading === 'Asset Management' || group.heading === 'Security & Governance' || group.heading === 'Technology' || group.heading === 'Operations & Reporting')));

              return (
                <div className="category-block" key={group.heading}>
                  <div className="category-header">
                    <h3>{group.heading}</h3>
                    <p>{group.description}</p>
                  </div>
                  <div className="card-grid">
                    {copy.cards.filter((card) => {
                      if (language === 'am') {
                        const amCategories = {
                          'የንብረት አስተዳደር': 'የንብረት አስተዳደር',
                          'ደህንነት እና አስተዳደር': 'ደህንነት እና አስተዳደር',
                          'ቴክኖሎጂ': 'ቴክኖሎጂ',
                          'ክወና እና ሪፖርት': 'ክወና እና ሪፖርት'
                        };
                        return card.category === amCategories[group.heading];
                      }
                      return card.category === group.heading;
                    }).map((card) => (
                      <FeatureCard
                        key={card.title}
                        title={card.title}
                        description={card.description}
                        icon={card.icon}
                        capabilities={card.capabilities}
                        secondaryIcon={card.secondaryIcon}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="features-section alt-section" aria-labelledby="feature-lifecycle-title">
        <div className="features-shell lifecycle-shell">
          <div className="section-heading compact-heading">
            <span className="section-index">02</span>
            <h2 id="feature-lifecycle-title">{language === 'am' ? 'የንብረት ዑደት አስተዳደር' : 'Asset Lifecycle Management'}</h2>
          </div>
          <LifecycleCard steps={copy.lifecycle} note={copy.note} />
        </div>
      </section>

      <section className="features-section" aria-labelledby="feature-language-title">
        <div className="features-shell">
          <div className="language-banner">
            <div className="language-banner__icon"><Languages size={28} strokeWidth={1.9} /></div>
            <div>
              <p className="language-banner__label">{language === 'am' ? 'ቋንቋ' : 'Language'}</p>
              <h2 id="feature-language-title">{language === 'am' ? 'English ↔ አማርኛ' : 'English ↔ አማርኛ'}</h2>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .features-page {
          --features-bg: #f5f7fb;
          --features-surface: #ffffff;
          --features-surface-soft: #edf5ff;
          --features-border: #dfeaf3;
          --features-text: #10253f;
          --features-muted: #5c6d7d;
          --features-navy: #123b63;
          --features-blue: #3074B3;
          --features-cyan: #0ea5e9;
          --features-gold: #d8a84a;
          --features-success: #15803d;
          background: var(--features-bg);
          color: var(--features-text);
          overflow-x: hidden;
        }

        .features-page-dark {
          --features-bg: #0f172a;
          --features-surface: #111827;
          --features-surface-soft: #18263d;
          --features-border: rgba(148, 163, 184, 0.26);
          --features-text: #edfbff;
          --features-muted: #c8d3e0;
          --features-navy: #9bc7ea;
          --features-blue: #7cc7ff;
          --features-cyan: #67e8f9;
          --features-gold: #f7c86b;
          --features-success: #4ade80;
        }

        .features-shell {
          width: min(1180px, calc(100% - 28px));
          margin: 0 auto;
        }

        .features-hero {
          padding: clamp(54px, 6vw, 92px) 0 24px;
          background: linear-gradient(180deg, rgba(18, 59, 99, 0.04), rgba(18, 59, 99, 0));
        }

        .features-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
          gap: 30px;
          align-items: center;
        }

        .features-eyebrow {
          display: inline-flex;
          margin-bottom: 16px;
          color: var(--features-blue);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .features-hero-copy h1 {
          margin: 0;
          font-size: clamp(2.2rem, 4vw, 4.1rem);
          line-height: 1.08;
          letter-spacing: -0.06em;
          color: var(--features-navy);
        }

        .features-hero-subtitle {
          margin: 18px 0 0;
          max-width: 720px;
          font-size: clamp(1.08rem, 2vw, 1.5rem);
          line-height: 1.6;
          color: var(--features-muted);
        }

        .features-hero-panel {
          display: grid;
          gap: 16px;
          padding: 22px;
          border: 1px solid var(--features-border);
          border-radius: 24px;
          background: var(--features-surface);
          box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
        }

        .feature-summary-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--features-border);
          background: var(--features-surface-soft);
          color: var(--features-text);
          font-weight: 600;
        }

        .feature-summary-box.primary {
          display: grid;
          gap: 6px;
          background: linear-gradient(135deg, rgba(48, 116, 179, 0.08), rgba(14, 165, 233, 0.04));
        }

        .feature-summary-label {
          color: var(--features-muted);
          font-size: 0.76rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .feature-summary-box strong {
          display: block;
          font-size: 1rem;
        }

        .feature-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .features-section {
          padding: 56px 0;
        }

        .alt-section {
          background: rgba(18, 59, 99, 0.02);
          border-top: 1px solid var(--features-border);
          border-bottom: 1px solid var(--features-border);
        }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }

        .section-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(48, 116, 179, 0.08);
          color: var(--features-blue);
          font-size: 0.8rem;
          font-weight: 800;
        }

        .section-heading h2 {
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 2.6rem);
          line-height: 1.2;
          letter-spacing: -0.05em;
        }

        .category-stack {
          display: grid;
          gap: 28px;
        }

        .category-block {
          padding: 20px 0 0;
        }

        .category-header {
          margin-bottom: 18px;
        }

        .category-header h3 {
          margin: 0 0 8px;
          color: var(--features-navy);
          font-size: 1.08rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .category-header p {
          margin: 0;
          color: var(--features-muted);
          line-height: 1.6;
        }

        .card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .feature-card {
          display: flex;
          flex-direction: column;
          min-height: 100%;
          padding: 20px 18px 18px;
          border: 1px solid var(--features-border);
          border-radius: 20px;
          background: var(--features-surface);
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .feature-card:hover {
          transform: translateY(-2px);
          border-color: rgba(48, 116, 179, 0.3);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
        }

        .feature-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .feature-card-icon {
          display: inline-flex;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(48, 116, 179, 0.08);
          color: var(--features-blue);
        }

        .feature-card-secondary-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.12);
          color: var(--features-cyan);
        }

        .feature-card h3 {
          margin: 0 0 10px;
          font-size: 1.12rem;
          line-height: 1.4;
          color: var(--features-text);
        }

        .feature-card p {
          margin: 0;
          color: var(--features-muted);
          line-height: 1.72;
        }

        .feature-capability-list {
          margin: 16px 0 0;
          padding-left: 1.1rem;
          display: grid;
          gap: 8px;
          color: var(--features-text);
          font-weight: 600;
          line-height: 1.5;
        }

        .lifecycle-shell {
          max-width: 1180px;
        }

        .compact-heading {
          margin-bottom: 18px;
        }

        .lifecycle-card {
          padding: 20px;
          border: 1px solid var(--features-border);
          border-radius: 24px;
          background: var(--features-surface);
        }

        .lifecycle-flow {
          display: grid;
          grid-template-columns: repeat(9, minmax(90px, 1fr));
          gap: 10px;
        }

        .lifecycle-node {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          gap: 8px;
          min-height: 108px;
          padding: 12px 10px 10px;
          border: 1px solid var(--features-border);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(48, 116, 179, 0.04), rgba(14, 165, 233, 0.01));
          color: var(--features-text);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .lifecycle-node::after {
          content: '';
          position: absolute;
          right: -10px;
          top: 50%;
          width: 10px;
          height: 2px;
          background: var(--features-border);
          transform: translateY(-50%);
        }

        .lifecycle-node:last-child::after {
          display: none;
        }

        .lifecycle-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: var(--features-navy);
          color: white;
          font-size: 0.7rem;
        }

        .lifecycle-note {
          margin: 18px 0 0;
          color: var(--features-muted);
          line-height: 1.7;
        }

        .language-banner {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 22px 26px;
          border: 1px solid var(--features-border);
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(48, 116, 179, 0.08), rgba(14, 165, 233, 0.05));
        }

        .language-banner__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: rgba(18, 59, 99, 0.08);
          color: var(--features-navy);
        }

        .language-banner__label {
          margin: 0 0 4px;
          color: var(--features-muted);
          font-size: 0.76rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .language-banner h2 {
          margin: 0;
          font-size: clamp(1.35rem, 2vw, 2rem);
          letter-spacing: -0.05em;
        }

        @media (max-width: 1100px) {
          .card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .lifecycle-flow {
            grid-template-columns: repeat(3, minmax(120px, 1fr));
          }
          .lifecycle-node::after {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .features-hero-grid,
          .card-grid,
          .feature-summary-grid {
            grid-template-columns: 1fr;
          }

          .lifecycle-flow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .feature-capability-list {
            font-size: 0.94rem;
          }
        }

        @media (max-width: 480px) {
          .features-shell {
            width: min(100% - 18px, 1180px);
          }
          .lifecycle-flow {
            grid-template-columns: 1fr;
          }
          .category-header h3 {
            letter-spacing: 0.03em;
          }
        }
      `}</style>
    </main>
  );
};

export default Features;
