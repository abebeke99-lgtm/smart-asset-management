import React from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FilePlus2,
  QrCode,
  Radio,
  UserCheck,
  Wrench
} from 'lucide-react';

const servicesByLanguage = {
  en: {
    eyebrow: 'University Asset Management System',
    title: 'Services',
    introduction: 'Digital services for efficient, accountable, and transparent university asset management.',
    sectionTitle: 'Asset services',
    services: [
      {
        title: 'Asset Registration',
        description: 'Maintain structured asset records with identification and category details to support assets throughout their lifecycle.',
        features: ['Asset registration', 'Asset identification', 'Category assignment'],
        icon: FilePlus2
      },
      {
        title: 'Inventory Management',
        description: 'Review inventory records and availability, including stock levels and items that need attention.',
        features: ['Inventory tracking', 'Stock monitoring', 'Available assets', 'Low-stock monitoring'],
        icon: Boxes
      },
      {
        title: 'Asset Assignment',
        description: 'Authorized users can record responsibility for assets and review assignment history for traceability.',
        features: ['Assign assets', 'Track responsible users and departments', 'Assignment history'],
        icon: UserCheck
      },
      {
        title: 'Asset Transfer',
        description: 'Requests to move assets between authorized locations or organizational units can be reviewed and tracked through the existing workflow.',
        features: ['Transfer requests', 'Approval workflow', 'Transfer tracking'],
        icon: ArrowRightLeft
      },
      {
        title: 'Maintenance',
        description: 'Follow maintenance requests, their current status, and recorded service history for university assets.',
        features: ['Maintenance requests', 'Maintenance status', 'Maintenance history'],
        icon: Wrench
      },
      {
        title: 'RFID / QR Tracking',
        description: 'Supported QR and RFID workflows help identify assets, look up records, and review recorded scan or movement activity. RFID features do not imply that physical reader hardware is supplied.',
        features: ['QR identification', 'RFID identification', 'Asset lookup', 'Movement tracking (recorded activity)'],
        icon: QrCode,
        secondaryIcon: Radio
      },
      {
        title: 'Asset Verification',
        description: 'Verification sessions compare physical findings with system records and allow staff to record missing, misplaced, damaged, or review-needed assets.',
        features: ['Physical verification', 'Verification sessions', 'Discrepancy recording'],
        icon: ClipboardCheck
      },
      {
        title: 'Reports & Analytics',
        description: 'Authorized users can access relevant inventory, asset, financial, and department reports according to their role and permissions.',
        features: ['Inventory reports', 'Asset reports', 'Financial reports', 'Department reports'],
        icon: BarChart3
      }
    ]
  },
  am: {
    eyebrow: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    title: 'አገልግሎቶች',
    introduction: 'ውጤታማ፣ ተጠያቂና ግልጽ የዩኒቨርሲቲ ንብረት አስተዳደር የዲጂታል አገልግሎቶች።',
    sectionTitle: 'የንብረት አገልግሎቶች',
    services: [
      {
        title: 'የንብረት ምዝገባ',
        description: 'ንብረቶችን በአገልግሎት ዘመናቸው ለመከታተል መለያና የምድብ ዝርዝሮችን የያዙ የተደራጁ መዝገቦችን ያስቀምጡ።',
        features: ['የንብረት ምዝገባ', 'የንብረት መለያ', 'የምድብ ምደባ'],
        icon: FilePlus2
      },
      {
        title: 'የኢንቬንተሪ አስተዳደር',
        description: 'የኢንቬንተሪ መዝገቦችንና የንብረት መገኘትን፣ የክምችት መጠንን እና ትኩረት የሚሹ እቃዎችን ይመልከቱ።',
        features: ['የኢንቬንተሪ ክትትል', 'የክምችት ክትትል', 'ያሉ ንብረቶች', 'ዝቅተኛ ክምችት ክትትል'],
        icon: Boxes
      },
      {
        title: 'የንብረት ምደባ',
        description: 'ፈቃድ ያላቸው ተጠቃሚዎች የንብረት ኃላፊነትን መመዝገብና ለክትትል የምደባ ታሪክን መመልከት ይችላሉ።',
        features: ['ንብረት መመደብ', 'ኃላፊ ተጠቃሚዎችንና ክፍሎችን መከታተል', 'የምደባ ታሪክ'],
        icon: UserCheck
      },
      {
        title: 'የንብረት ዝውውር',
        description: 'በተፈቀዱ ቦታዎች ወይም የድርጅት ክፍሎች መካከል ንብረቶችን ለማንቀሳቀስ የሚቀርቡ ጥያቄዎች በነባሩ ሂደት ሊገመገሙና ሊከታተሉ ይችላሉ።',
        features: ['የዝውውር ጥያቄዎች', 'የማጽደቅ ሂደት', 'የዝውውር ክትትል'],
        icon: ArrowRightLeft
      },
      {
        title: 'ጥገና',
        description: 'የጥገና ጥያቄዎችን፣ ወቅታዊ ሁኔታቸውንና የተመዘገበ የአገልግሎት ታሪክን ይከታተሉ።',
        features: ['የጥገና ጥያቄዎች', 'የጥገና ሁኔታ', 'የጥገና ታሪክ'],
        icon: Wrench
      },
      {
        title: 'RFID / QR ክትትል',
        description: 'የሚደገፉ የQRና RFID ሂደቶች ንብረቶችን ለመለየት፣ መዝገቦችን ለመፈለግና የተመዘገበ የስካን ወይም የእንቅስቃሴ መረጃን ለመመልከት ይረዳሉ። ይህ አካላዊ የRFID አንባቢ መሳሪያ እንዳለ አያመለክትም።',
        features: ['የQR መለያ', 'የRFID መለያ', 'የንብረት ፍለጋ', 'የተመዘገበ የእንቅስቃሴ ክትትል'],
        icon: QrCode,
        secondaryIcon: Radio
      },
      {
        title: 'የንብረት ማረጋገጫ',
        description: 'የማረጋገጫ ክፍለ ጊዜዎች አካላዊ ግኝቶችን ከስርዓት መዝገቦች ጋር ያነጻጽራሉ፤ የጠፉ፣ ቦታቸው የተሳሳተ፣ የተጎዱ ወይም ግምገማ የሚያስፈልጋቸው ንብረቶችንም ለመመዝገብ ያስችላሉ።',
        features: ['አካላዊ ማረጋገጫ', 'የማረጋገጫ ክፍለ ጊዜዎች', 'ልዩነቶችን መመዝገብ'],
        icon: ClipboardCheck
      },
      {
        title: 'ሪፖርቶችና ትንታኔ',
        description: 'ፈቃድ ያላቸው ተጠቃሚዎች እንደ ሚናቸውና ፈቃዳቸው ተገቢ የኢንቬንተሪ፣ የንብረት፣ የገንዘብና የክፍል ሪፖርቶችን ማግኘት ይችላሉ።',
        features: ['የኢንቬንተሪ ሪፖርቶች', 'የንብረት ሪፖርቶች', 'የገንዘብ ሪፖርቶች', 'የክፍል ሪፖርቶች'],
        icon: BarChart3
      }
    ]
  }
};

const Services = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const content = servicesByLanguage[language] || servicesByLanguage.en;

  return (
    <div className={`services-page${theme === 'dark' ? ' services-page-dark' : ''}`}>
      <header className="services-hero">
        <div className="services-shell">
          <p className="services-eyebrow">{content.eyebrow}</p>
          <h1 id="services-title">{content.title}</h1>
          <p className="services-introduction">{content.introduction}</p>
        </div>
      </header>

      <section className="services-section services-shell" aria-labelledby="services-section-title">
        <div className="services-section-heading">
          <span className="services-section-rule" aria-hidden="true" />
          <h2 id="services-section-title">{content.sectionTitle}</h2>
        </div>
        <div className="services-grid">
          {content.services.map(({ title, description, features, icon: Icon, secondaryIcon: SecondaryIcon }, index) => (
            <article className="services-card" key={title} tabIndex={0}>
              <div className="services-card-heading">
                <span className="services-card-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="services-card-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.8} />
                  {SecondaryIcon && <SecondaryIcon className="services-card-secondary-icon" size={13} strokeWidth={2} />}
                </span>
              </div>
              <h3>{title}</h3>
              <p className="services-card-description">{description}</p>
              <ul className="services-feature-list">
                {features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <style>{`
        .services-page {
          --services-navy: #12324a;
          --services-blue: #176b87;
          --services-cyan: #2a9d9f;
          --services-background: #f4f7f8;
          --services-surface: #ffffff;
          --services-text: #182d3a;
          --services-muted: #536875;
          --services-border: #d9e3e7;
          background: var(--services-background);
          color: var(--services-text);
        }

        .services-page-dark {
          --services-navy: #c3e4ed;
          --services-blue: #8ed0df;
          --services-cyan: #72d0c4;
          --services-background: #10232c;
          --services-surface: #18323d;
          --services-text: #edf6f8;
          --services-muted: #c2d4da;
          --services-border: #31505c;
        }

        .services-page,
        .services-page * { box-sizing: border-box; }

        .services-shell {
          width: min(1160px, calc(100% - 48px));
          margin-inline: auto;
        }

        .services-hero {
          padding: 64px 0 58px;
          border-bottom: 1px solid var(--services-border);
          background: linear-gradient(110deg, rgba(23, 107, 135, 0.09), rgba(42, 157, 159, 0.025) 58%, transparent);
        }

        .services-eyebrow {
          margin: 0 0 16px;
          color: var(--services-blue);
          font-size: 0.8rem;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .services-hero h1 {
          margin: 0;
          color: var(--services-navy);
          font-size: 2.75rem;
          line-height: 1.12;
        }

        .services-introduction {
          max-width: 700px;
          margin: 16px 0 0;
          color: var(--services-muted);
          font-size: 1.12rem;
          line-height: 1.7;
        }

        .services-section { padding-top: 46px; padding-bottom: 72px; }

        .services-section-heading {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
        }

        .services-section-rule {
          width: 4px;
          height: 26px;
          flex: 0 0 auto;
          border-radius: 2px;
          background: var(--services-cyan);
        }

        .services-section-heading h2 {
          margin: 0;
          color: var(--services-navy);
          font-size: 1.5rem;
          line-height: 1.3;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .services-card {
          min-width: 0;
          min-height: 300px;
          padding: 20px;
          border: 1px solid var(--services-border);
          border-radius: 6px;
          background: var(--services-surface);
          box-shadow: 0 5px 16px rgba(18, 50, 74, 0.045);
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        }

        .services-card:hover {
          transform: translateY(-3px);
          border-color: var(--services-cyan);
          box-shadow: 0 10px 22px rgba(18, 50, 74, 0.1);
        }

        .services-card:focus-visible {
          outline: 3px solid var(--services-cyan);
          outline-offset: 3px;
        }

        .services-card-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .services-card-number {
          color: var(--services-blue);
          font-size: 0.78rem;
          font-weight: 750;
          font-variant-numeric: tabular-nums;
        }

        .services-card-icon {
          position: relative;
          display: grid;
          width: 44px;
          height: 44px;
          place-items: center;
          border: 1px solid rgba(42, 157, 159, 0.24);
          border-radius: 6px;
          background: rgba(42, 157, 159, 0.09);
          color: var(--services-blue);
        }

        .services-card-secondary-icon {
          position: absolute;
          right: -5px;
          bottom: -3px;
          padding: 2px;
          border-radius: 50%;
          background: var(--services-surface);
          color: var(--services-cyan);
        }

        .services-card h3 {
          margin: 0 0 9px;
          color: var(--services-navy);
          font-size: 1.08rem;
          line-height: 1.4;
        }

        .services-card-description {
          margin: 0;
          color: var(--services-muted);
          font-size: 0.9rem;
          line-height: 1.65;
        }

        .services-feature-list {
          display: grid;
          gap: 8px;
          margin: 16px 0 0;
          padding: 14px 0 0;
          border-top: 1px solid var(--services-border);
          list-style: none;
        }

        .services-feature-list li {
          position: relative;
          min-width: 0;
          padding-left: 15px;
          color: var(--services-text);
          font-size: 0.82rem;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .services-feature-list li::before {
          position: absolute;
          top: 0.55em;
          left: 0;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--services-cyan);
          content: '';
        }

        @media (max-width: 1050px) {
          .services-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .services-card { min-height: 280px; }
        }

        @media (max-width: 640px) {
          .services-shell { width: calc(100% - 32px); }
          .services-hero { padding: 44px 0 38px; }
          .services-hero h1 { font-size: 2.2rem; }
          .services-introduction { font-size: 1rem; }
          .services-section { padding-top: 34px; padding-bottom: 48px; }
          .services-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
          .services-card { min-height: 0; padding: 18px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .services-card { transition: none; }
          .services-card:hover { transform: none; }
        }
      `}</style>
    </div>
  );
};

export default Services;