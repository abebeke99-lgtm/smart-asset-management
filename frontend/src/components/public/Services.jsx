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
    home: 'Home',
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
    home: 'መነሻ',
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
        <img
          className="services-hero-image"
          src="/images/hero/4-1.jpg"
          alt="Mekdela Amba University campus"
        />
        <div className="services-hero-overlay" aria-hidden="true" />
        <div className="services-shell services-hero-content">
          <nav className="services-breadcrumb" aria-label="Breadcrumb">
            <Link to="/home">{content.home}</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{content.title}</span>
          </nav>
          <h1 id="services-title">{content.title}</h1>
          <p className="services-introduction">{content.introduction}</p>
        </div>
      </header>

      <section className="services-section services-shell" aria-labelledby="services-section-title">
        <h2 id="services-section-title" className="services-visually-hidden">{content.systemTitle}</h2>
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
          --services-navy: #07182d;
          --services-blue: #0797d5;
          --services-cyan: #16c4f4;
          --services-background: #f7fafc;
          --services-surface: #ffffff;
          --services-text: #17324d;
          --services-muted: #64748b;
          --services-border: #d9e4ec;
          background: var(--services-background);
          color: var(--services-text);
        }

        .services-page-dark {
          --services-navy: #f8fafc;
          --services-blue: #38bdf8;
          --services-cyan: #16c4f4;
          --services-background: #07182d;
          --services-surface: #0b1b33;
          --services-text: #f8fafc;
          --services-muted: #cbd5e1;
          --services-border: #263a52;
        }

        .services-page,
        .services-page * { box-sizing: border-box; }

        .services-shell {
          width: min(1240px, calc(100% - 64px));
          margin-inline: auto;
        }

        .services-hero {
          position: relative;
          display: flex;
          min-height: 240px;
          align-items: center;
          overflow: hidden;
          background: #07182d;
          isolation: isolate;
        }

        .services-hero-image,
        .services-hero-overlay {
          position: absolute;
          z-index: -1;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .services-hero-image {
          object-fit: cover;
          object-position: center 48%;
        }

        .services-hero-overlay {
          background: linear-gradient(90deg, rgba(7, 24, 45, 0.91), rgba(7, 24, 45, 0.72) 56%, rgba(7, 24, 45, 0.52));
        }

        .services-hero-content {
          padding-block: 30px;
          color: #ffffff;
        }

        .services-breadcrumb {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          color: rgba(255, 255, 255, 0.86);
          font-size: 0.9rem;
          font-weight: 600;
        }

        .services-breadcrumb a {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          color: #ffffff;
          text-decoration: none;
        }

        .services-breadcrumb a:hover { color: #8be3ff; }
        .services-breadcrumb a:focus-visible { outline: 2px solid #8be3ff; outline-offset: 3px; }

        .services-visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .services-hero h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2.2rem, 4vw, 3.4rem);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 1.08;
        }

        .services-introduction {
          max-width: 760px;
          margin: 13px 0 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: clamp(0.98rem, 1.5vw, 1.08rem);
          line-height: 1.7;
        }

        .services-section { padding-top: 48px; padding-bottom: 64px; }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }

        .services-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 294px;
          padding: 24px;
          border: 1px solid var(--services-border);
          border-radius: 16px;
          background: var(--services-surface);
          box-shadow: 0 4px 16px rgba(7, 24, 45, 0.045);
          transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
        }

        .services-card:hover {
          transform: translateY(-5px);
          border-color: var(--services-blue);
          box-shadow: 0 14px 30px rgba(7, 151, 213, 0.14);
        }

        .services-card-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          flex: 0 0 auto;
          align-self: flex-start;
          margin-bottom: 20px;
          border: 1px solid rgba(7, 151, 213, 0.16);
          border-radius: 13px;
          background: rgba(7, 151, 213, 0.09);
          color: #0788c1;
        }

        .services-card-secondary-icon {
          position: absolute;
          right: -7px;
          bottom: -5px;
          padding: 2px;
          border-radius: 50%;
          background: var(--services-surface);
          color: var(--services-blue);
        }

        .services-card h3 {
          min-height: 2.7em;
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
          min-height: 44px;
          padding-top: 14px;
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
          outline: 3px solid var(--services-blue);
          outline-offset: 4px;
        }

        @media (max-width: 1050px) {
          .services-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .services-hero { min-height: 200px; }
          .services-card { min-height: 282px; }
        }

        @media (max-width: 640px) {
          .services-shell { width: calc(100% - 36px); }
          .services-hero { min-height: 180px; }
          .services-hero-content { padding-block: 22px; }
          .services-breadcrumb { margin-bottom: 10px; }
          .services-hero h1 { font-size: 2.25rem; }
          .services-introduction { margin-top: 9px; font-size: 0.94rem; line-height: 1.55; }
          .services-section { padding-top: 28px; padding-bottom: 42px; }
          .services-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
          .services-card { min-height: 260px; padding: 22px; }
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