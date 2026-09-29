import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  ArrowRightLeft,
  ArrowRight,
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
    title: 'Services',
    systemTitle: 'University Asset Management System',
    introduction: 'Digital services for registering, tracking, assigning, maintaining, verifying, and reporting university assets.',
    learnMore: 'Learn More',
    services: [
      {
        title: 'Asset Registration',
        description: 'Register university assets, record identification details, and maintain asset records.',
        to: '/admin/assets/create',
        icon: FilePlus2
      },
      {
        title: 'Inventory Management',
        description: 'Track inventory, monitor stock levels, and identify available and low-stock assets.',
        to: '/admin/inventory/overview',
        icon: Boxes
      },
      {
        title: 'Asset Assignment',
        description: 'Assign assets to authorized users, track departments, and review responsibility history.',
        to: '/admin/assets/assign',
        icon: UserCheck
      },
      {
        title: 'Asset Transfer',
        description: 'Request, review, and track asset transfers and their history.',
        to: '/admin/assets/transfer',
        icon: ArrowRightLeft
      },
      {
        title: 'Maintenance',
        description: 'Submit maintenance requests, track status, and review recorded activities.',
        to: '/admin/maintenance',
        icon: Wrench
      },
      {
        title: 'QR & RFID Tracking',
        description: 'Identify assets with QR codes or RFID workflows and record movement activity.',
        to: '/admin/rfid/qr',
        icon: QrCode,
        secondaryIcon: Radio
      },
      {
        title: 'Asset Verification',
        description: 'Verify physical assets and record missing, misplaced, damaged, or discrepant items.',
        to: '/college/verification',
        icon: ClipboardCheck
      },
      {
        title: 'Reports & Analytics',
        description: 'Generate asset, inventory, financial, and department reports for management oversight.',
        to: '/admin/reports',
        icon: BarChart3
      }
    ]
  },
  am: {
    title: 'አገልግሎቶች',
    systemTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    introduction: 'ለዩኒቨርሲቲ ንብረቶች ምዝገባ፣ ክትትል፣ ምደባ፣ ጥገና፣ ማረጋገጫና ሪፖርት የዲጂታል አገልግሎቶች።',
    learnMore: 'ተጨማሪ ይመልከቱ',
    services: [
      {
        title: 'የንብረት ምዝገባ',
        description: 'የዩኒቨርሲቲ ንብረቶችን ይመዝግቡ፣ መለያ ዝርዝሮችን ያስገቡና መዝገቦችን ያቆዩ።',
        to: '/admin/assets/create',
        icon: FilePlus2
      },
      {
        title: 'የኢንቬንተሪ አስተዳደር',
        description: 'ኢንቬንተሪንና የክምችት መጠንን ይከታተሉ፤ ያሉና አነስተኛ ክምችት ያላቸውን ይለዩ።',
        to: '/admin/inventory/overview',
        icon: Boxes
      },
      {
        title: 'የንብረት ምደባ',
        description: 'ንብረቶችን ለተፈቀዱ ተጠቃሚዎች ይመድቡ፣ ክፍሎችንና ኃላፊነትን ይከታተሉ።',
        to: '/admin/assets/assign',
        icon: UserCheck
      },
      {
        title: 'የንብረት ዝውውር',
        description: 'የዝውውር ጥያቄዎችን ይፍጠሩ፣ ይገምግሙና የእንቅስቃሴ ታሪክን ይከታተሉ።',
        to: '/admin/assets/transfer',
        icon: ArrowRightLeft
      },
      {
        title: 'ጥገና',
        description: 'የጥገና ጥያቄዎችን ያቅርቡ፣ ሁኔታን ይከታተሉና ታሪክን ይመልከቱ።',
        to: '/admin/maintenance',
        icon: Wrench
      },
      {
        title: 'የQR እና RFID ክትትል',
        description: 'ንብረቶችን በQR ኮድ ወይም RFID ሂደቶች ይለዩና እንቅስቃሴን ይመዝግቡ።',
        to: '/admin/rfid/qr',
        icon: QrCode,
        secondaryIcon: Radio
      },
      {
        title: 'የንብረት ማረጋገጫ',
        description: 'አካላዊ ንብረቶችን ያረጋግጡና የጠፉ፣ የተሳሳቱ ወይም የተጎዱ ንብረቶችን ይመዝግቡ።',
        to: '/college/verification',
        icon: ClipboardCheck
      },
      {
        title: 'ሪፖርቶችና ትንታኔ',
        description: 'የንብረት፣ ኢንቬንተሪ፣ ፋይናንስና የክፍል ሪፖርቶችን ለአስተዳደር ያዘጋጁ።',
        to: '/admin/reports',
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
          <h1 id="services-title">{content.title}</h1>
          <h2 id="services-section-title" className="services-system-title">{content.systemTitle}</h2>
          <p className="services-introduction">{content.introduction}</p>
        </div>
      </header>

      <section className="services-section services-shell" aria-labelledby="services-section-title">
        <div className="services-grid">
          {content.services.map(({ title, description, to, icon: Icon, secondaryIcon: SecondaryIcon }) => (
            <article className="services-card" key={title}>
              <span className="services-card-icon" aria-hidden="true">
                <Icon size={26} strokeWidth={1.8} />
                {SecondaryIcon && <SecondaryIcon className="services-card-secondary-icon" size={15} strokeWidth={2} />}
              </span>
              <h3>{title}</h3>
              <p className="services-card-description">{description}</p>
              <Link className="services-card-action" to={to} aria-label={`${content.learnMore} ${title}`}>
                {content.learnMore}
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </Link>
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
          background: linear-gradient(180deg, rgba(23, 107, 135, 0.055), transparent 420px), var(--services-background);
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
          padding: 58px 0 50px;
          border-bottom: 1px solid var(--services-border);
          background: linear-gradient(110deg, rgba(23, 107, 135, 0.07), rgba(42, 157, 159, 0.02) 58%, transparent);
          text-align: center;
        }

        .services-hero h1 {
          margin: 0;
          color: var(--services-navy);
          font-size: 2.55rem;
          line-height: 1.12;
        }

        .services-system-title {
          margin: 16px 0 0;
          color: var(--services-navy);
          font-size: 1.45rem;
          line-height: 1.3;
        }

        .services-system-title::after {
          display: block;
          width: 48px;
          height: 3px;
          margin: 14px auto 0;
          border-radius: 2px;
          background: var(--services-cyan);
          content: '';
        }

        .services-introduction {
          max-width: 700px;
          margin: 14px auto 0;
          color: var(--services-muted);
          font-size: 1.02rem;
          line-height: 1.7;
        }

        .services-section { padding-top: 42px; padding-bottom: 68px; }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 24px;
        }

        .services-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 316px;
          padding: 26px;
          border: 1px solid var(--services-border);
          border-radius: 18px;
          background: var(--services-surface);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
          transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
        }

        .services-card:hover {
          transform: translateY(-4px);
          border-color: var(--services-cyan);
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.1);
        }

        .services-card-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          flex: 0 0 auto;
          align-self: center;
          margin-bottom: 22px;
          border: 1px solid rgba(42, 157, 159, 0.2);
          border-radius: 14px;
          background: rgba(42, 157, 159, 0.09);
          color: var(--services-blue);
        }

        .services-card-secondary-icon {
          position: absolute;
          right: -7px;
          bottom: -5px;
          padding: 2px;
          border-radius: 50%;
          background: var(--services-surface);
          color: var(--services-cyan);
        }

        .services-card h3 {
          min-height: 2.8em;
          margin: 0 0 10px;
          color: var(--services-navy);
          font-size: 1.15rem;
          font-weight: 700;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .services-card-description {
          margin: 0;
          color: var(--services-muted);
          font-size: 0.92rem;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .services-card-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          margin-top: auto;
          padding-top: 20px;
          color: var(--services-blue);
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
        }

        .services-card-action:hover {
          color: var(--services-cyan);
        }

        .services-card-action:focus-visible {
          border-radius: 2px;
          outline: 3px solid var(--services-cyan);
          outline-offset: 4px;
        }

        @media (max-width: 1050px) {
          .services-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .services-card { min-height: 316px; }
        }

        @media (max-width: 640px) {
          .services-shell { width: calc(100% - 32px); }
          .services-shell { width: calc(100% - 32px); }
          .services-hero { padding: 42px 0 36px; }
          .services-hero h1 { font-size: 2.2rem; }
          .services-system-title { font-size: 1.25rem; }
          .services-introduction { font-size: 0.98rem; }
          .services-section { padding-top: 30px; padding-bottom: 44px; }
          .services-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
          .services-card { min-height: 300px; padding: 22px; }
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