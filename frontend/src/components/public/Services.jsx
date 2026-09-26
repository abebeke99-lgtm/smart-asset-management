import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FilePlus2,
  PackageCheck,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  WalletCards,
  Wrench
} from 'lucide-react';

const Services = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const content = language === 'en' ? {
    eyebrow: 'Services',
    university: 'Mekdela Amba University',
    subtitle: 'University Asset Management System',
    heading: 'SERVICES',
    introduction: 'Asset management services and workflows for university operations',
    description: 'The University Asset Management System brings asset records and operational workflows into one place, supporting asset management, financial management, tracking, reporting, and security.',
    overviewTitle: 'Our Services',
    overviewText: 'The system provides services across four documented areas:',
    categories: [
      { title: 'Asset Management Services', description: 'Register, receive, track, assign, verify, maintain, return, and retire university assets.', icon: BriefcaseBusiness },
      { title: 'Financial Services', description: 'Maintain financial records and review asset values in support of accountable operations.', icon: WalletCards },
      { title: 'Tracking & Reporting', description: 'Use RFID, QR, notifications, and operational reporting to review asset activity.', icon: BarChart3 },
      { title: 'Security Services', description: 'Protect workflows with signed-in access, role checks, and organization-scoped controls.', icon: ShieldCheck }
    ],
    assetSectionTitle: 'Asset Management Services',
    financialSectionTitle: 'Financial Services',
    trackingSectionTitle: 'Tracking & Reporting',
    securitySectionTitle: 'Security Services',
    workflowTitle: 'From Asset to Accountability',
    workflowNote: 'Available actions depend on the asset and the user\'s role.',
    assetServices: [
      { title: 'Asset Registration', description: 'Create and update university asset records.', href: '/ict/assets', icon: FilePlus2 },
      { title: 'Asset Receiving', description: 'Record assets received into store inventory.', href: '/store/receive', icon: PackageCheck },
      { title: 'Asset Inventory', description: 'Search and review current asset records.', href: '/store/inventory', icon: Boxes },
      { title: 'Asset Assignment', description: 'Assign an asset to an active user and record responsibility.', href: '/ict/assignments', icon: UserCheck },
      { title: 'Asset Transfer', description: 'Request, review, and track asset movement.', href: '/store/transfers', icon: ArrowRightLeft },
      { title: 'Asset Verification', description: 'Run inventory verification sessions and record findings.', href: '/college/verification', icon: ClipboardCheck },
      { title: 'Maintenance', description: 'Create maintenance requests and follow work status.', href: '/maintenance/requests', icon: Wrench },
      { title: 'Asset Returns', description: 'Track return requests through receipt and inspection.', href: '/store/returns', icon: RotateCcw },
      { title: 'Disposal', description: 'Process an asset disposal request through its workflow.', href: '/admin/assets/disposal', icon: Trash2 }
    ],
    financialTitle: 'Financial Management',
    financialDescription: 'Maintain financial records and review asset values.',
    trackingServices: [
      { title: 'RFID / QR', description: 'Link RFID tags, record scans, and look up assets by QR identifier.', href: '/ict/tracking', icon: QrCode },
      { title: 'Reports', description: 'Generate and review operational and financial reports.', href: '/admin/reports', icon: BarChart3 },
      { title: 'Notifications', description: 'View role-scoped notifications and read status.', href: '/ict/notifications', icon: Bell },
      { title: 'Audit Logs', description: 'Review recorded administrative and financial activity.', href: '/admin/settings', icon: FileClock }
    ],
    securityTitle: 'Authentication & RBAC',
    securityDescription: 'Protect workflows with signed-in access and role checks. Backend routes enforce authentication and role and organization-scope restrictions.',
    securityList: ['Authentication', 'Role-Based Access', 'Organization Scope'],
    workflowSteps: [
      { title: 'Receiving', description: 'Record received assets into stock and operational records.', icon: PackageCheck },
      { title: 'Registration', description: 'Create and maintain the asset record.', icon: FilePlus2 },
      { title: 'Inventory', description: 'Search and review current records and availability.', icon: Boxes },
      { title: 'Assignment', description: 'Assign the asset to a responsible user or unit.', icon: UserCheck },
      { title: 'Transfer', description: 'Track movement between locations or units.', icon: ArrowRightLeft },
      { title: 'Verification', description: 'Validate condition and inventory status.', icon: ClipboardCheck },
      { title: 'Maintenance', description: 'Follow service requests and work orders.', icon: Wrench },
      { title: 'Return', description: 'Process returns through review and receipt.', icon: RotateCcw },
      { title: 'Disposal', description: 'Retire and process disposal requests.', icon: Archive }
    ]
  } : {
    eyebrow: 'አገልግሎቶች',
    university: 'መቅደላ አምባ ዩኒቨርሲቲ',
    subtitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    heading: 'አገልግሎቶች',
    introduction: 'ለዩኒቨርሲቲ ስራዎች የንብረት አስተዳደር አገልግሎቶችና ሂደቶች',
    description: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት የንብረት መዝገቦችንና የስራ ሂደቶችን በአንድ ቦታ ያቀናጃል፣ የንብረት አስተዳደርን፣ የገንዘብ አስተዳደርን፣ ክትትልን፣ ሪፖርት እና ደህንነትን ይደግፋል።',
    overviewTitle: 'አገልግሎቶችን ይመልከቱ',
    overviewText: 'ስርዓቱ በአራት የተመሰከረ ዘርፎች አገልግሎቶችን ይሰጣል፡',
    categories: [
      { title: 'የንብረት አስተዳደር አገልግሎቶች', description: 'የዩኒቨርሲቲ ንብረቶችን እንደገና መመዝገብ፣ መቀበል፣ ክትትል፣ ምደባ፣ ማረጋገጫ፣ ጥገና፣ መመለስ እና ማስወገድ።', icon: BriefcaseBusiness },
      { title: 'የገንዘብ አገልግሎቶች', description: 'የገንዘብ መዝገቦችን እና የንብረት ዋጋን በተጠቃሚነት ያስተዳድሩ።', icon: WalletCards },
      { title: 'ክትትል እና ሪፖርት', description: 'RFID፣ QR፣ ማሳወቂያዎችና የስራ ሪፖርቶችን በመጠቀም እንቅስቃሴን ይመልከቱ።', icon: BarChart3 },
      { title: 'የደህንነት አገልግሎቶች', description: 'በተጠቃሚ እና በሚና የተመሰረተ መዳረሻን ያረጋግጡ።', icon: ShieldCheck }
    ],
    assetSectionTitle: 'የንብረት አስተዳደር አገልግሎቶች',
    financialSectionTitle: 'የገንዘብ አገልግሎቶች',
    trackingSectionTitle: 'ክትትል እና ሪፖርት',
    securitySectionTitle: 'የደህንነት አገልግሎቶች',
    workflowTitle: 'ከንብረት እስከ ተጠያቂነት',
    workflowNote: 'የሚገኙት እርምጃዎች በንብረቱ እና በተጠቃሚ ሚና ላይ ይወሰናሉ።',
    assetServices: [
      { title: 'የንብረት ምዝገባ', description: 'የዩኒቨርሲቲ ንብረት መዝገቦችን ይፍጠሩና ያዘምኑ።', href: '/ict/assets', icon: FilePlus2 },
      { title: 'የንብረት መቀበል', description: 'ወደ መጋዘን ኢንቬንተሪ የገቡ ንብረቶችን ይመዝግቡ።', href: '/store/receive', icon: PackageCheck },
      { title: 'የንብረት ኢንቬንተሪ', description: 'ወቅታዊ ንብረት መዝገቦችን ይፈልጉና ይመልከቱ።', href: '/store/inventory', icon: Boxes },
      { title: 'የንብረት ምደባ', description: 'ንብረትን ለንቁ ተጠቃሚ ይመድቡ።', href: '/ict/assignments', icon: UserCheck },
      { title: 'የንብረት ማስተላለፍ', description: 'የንብረት እንቅስቃሴን ይጠይቁና ይከታተሉ።', href: '/store/transfers', icon: ArrowRightLeft },
      { title: 'የንብረት ማረጋገጫ', description: 'የኢንቬንተሪ ማረጋገጫ ክፍል ይፍጠሩና ግኝቶችን ይመዝግቡ።', href: '/college/verification', icon: ClipboardCheck },
      { title: 'ጥገና', description: 'የጥገና ጥያቄዎችንና የስራ ሁኔታን ይከታተሉ።', href: '/maintenance/requests', icon: Wrench },
      { title: 'የንብረት መመለስ', description: 'የመመለስ ጥያቄዎችን ይከታተሉ።', href: '/store/returns', icon: RotateCcw },
      { title: 'ማስወገድ', description: 'የንብረት ማስወገድ ጥያቄን ያስኬዱ።', href: '/admin/assets/disposal', icon: Trash2 }
    ],
    financialTitle: 'የገንዘብ አስተዳደር',
    financialDescription: 'የገንዘብ መዝገቦችን አቆዩና የንብረት ዋጋን ይመልከቱ።',
    trackingServices: [
      { title: 'RFID / QR', description: 'RFID መለያዎችን ያገናኙና በQR ይፈልጉ።', href: '/ict/tracking', icon: QrCode },
      { title: 'ሪፖርቶች', description: 'የስራና የገንዘብ ሪፖርቶችን ያዘጋጁና ይመልከቱ።', href: '/admin/reports', icon: BarChart3 },
      { title: 'ማሳወቂያዎች', description: 'በሚና የተወሰኑ ማሳወቂያዎችን ይመልከቱ።', href: '/ict/notifications', icon: Bell },
      { title: 'የኦዲት መዝገቦች', description: 'የአስተዳደርና የገንዘብ እንቅስቃሴዎችን ይመልከቱ።', href: '/admin/settings', icon: FileClock }
    ],
    securityTitle: 'መግቢያ እና የሚና መዳረሻ',
    securityDescription: 'የስራ ሂደቶችን በተጠቃሚ መግቢያና በሚና ፈቃድ ያረጋግጡ። የbackend routes በማረጋገጫ፣ ሚና እና የድርጅት ውስጣዊ ገደቦች ላይ ይመርኮዛል።',
    securityList: ['መግቢያ', 'የሚና መዳረሻ', 'የድርጅት ወሰን'],
    workflowSteps: [
      { title: 'መቀበል', description: 'የተቀባሚ ንብረቶችን ወደ ኢንቬንተሪ ይመዝግቡ።', icon: PackageCheck },
      { title: 'ምዝገባ', description: 'የንብረት መዝገብ ይፍጠሩ።', icon: FilePlus2 },
      { title: 'ኢንቬንተሪ', description: 'አሁኑን መዝገቦችን ይፈልጉና ይመልከቱ።', icon: Boxes },
      { title: 'ምደባ', description: 'ንብረትን ለኃላፊ ሰው ወይም ክፍል ይመድቡ።', icon: UserCheck },
      { title: 'ማስተላለፍ', description: 'በክፍል ወይም ቦታ መካከል ያለውን እንቅስቃሴ ይከታተሉ።', icon: ArrowRightLeft },
      { title: 'ማረጋገጫ', description: 'ሁኔታንና ኢንቬንተሪ የሚያረጋግጡ እርምጃዎችን ይያዙ።', icon: ClipboardCheck },
      { title: 'ጥገና', description: 'የጥገና ጥያቄዎችን ይከታተሉ።', icon: Wrench },
      { title: 'መመለስ', description: 'የተመለሱ ንብረቶችን ያስተካክሉ።', icon: RotateCcw },
      { title: 'ማስወገድ', description: 'የንብረት ማስወገድ ሂደትን ይሰርዙ።', icon: Archive }
    ]
  };

  return (
    <main className={`services-page${isDark ? ' services-page-dark' : ''}`}>
      <section className="services-hero" aria-labelledby="services-page-title">
        <div className="services-shell services-hero-grid">
          <div className="services-hero-copy">
            <span className="services-eyebrow">{content.eyebrow}</span>
            <h1 id="services-page-title">{content.university}</h1>
            <p className="services-system-title">{content.subtitle}</p>
            <h2 className="services-main-heading">{content.heading}</h2>
            <p className="services-hero-lead">{content.introduction}</p>
            <p className="services-hero-description">{content.description}</p>
          </div>

          <div className="services-hero-visual" aria-label="Asset management workflow overview">
            <div className="services-visual-panel">
              <div className="services-visual-header">
                <div className="services-visual-badge"><BriefcaseBusiness size={18} aria-hidden="true" /></div>
                <span>Asset workflow</span>
              </div>
              <div className="services-visual-steps">
                {['Receiving', 'Registration', 'Inventory', 'Assignment', 'Verification'].map((item) => (
                  <span key={item} className="services-visual-pill">{item}</span>
                ))}
              </div>
              <div className="services-visual-flow" aria-hidden="true">
                <ArrowRight size={16} />
                <ArrowRight size={16} />
                <ArrowRight size={16} />
              </div>
              <div className="services-visual-footer">
                <div>
                  <strong>Operations</strong>
                  <span>Records, transfers, maintenance, returns, and disposal</span>
                </div>
                <CheckCircle2 size={26} aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="services-section services-overview" aria-labelledby="services-overview-title">
        <div className="services-shell">
          <div className="services-section-header">
            <span className="services-kicker">01</span>
            <h2 id="services-overview-title">{content.overviewTitle}</h2>
          </div>
          <p className="services-section-intro">{content.overviewText}</p>
          <div className="services-category-grid">
            {content.categories.map(({ title, description, icon: Icon }) => (
              <article key={title} className="services-category-card">
                <div className="services-card-icon"><Icon size={24} aria-hidden="true" /></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="services-card-action" aria-label={`Explore ${title}`}>
                  <span>Explore Services</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="services-section" aria-labelledby="services-asset-title">
        <div className="services-shell">
          <div className="services-section-header">
            <span className="services-kicker">02</span>
            <h2 id="services-asset-title">{content.assetSectionTitle}</h2>
          </div>

          <div className="services-grid services-grid-asset">
            {content.assetServices.map(({ title, description, href, icon: Icon }) => {
              const CardContent = (
                <>
                  <div className="services-card-icon"><Icon size={24} aria-hidden="true" /></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </>
              );

              return href ? (
                <Link key={title} to={href} className="services-card service-card-link">
                  {CardContent}
                </Link>
              ) : (
                <article key={title} className="services-card">
                  {CardContent}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="services-section services-highlight" aria-labelledby="services-financial-title">
        <div className="services-shell">
          <div className="services-section-header">
            <span className="services-kicker">03</span>
            <h2 id="services-financial-title">{content.financialSectionTitle}</h2>
          </div>

          <div className="services-feature-card">
            <div className="services-feature-icon"><WalletCards size={28} aria-hidden="true" /></div>
            <div className="services-feature-copy">
              <h3>{content.financialTitle}</h3>
              <p>{content.financialDescription}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="services-section" aria-labelledby="services-tracking-title">
        <div className="services-shell">
          <div className="services-section-header">
            <span className="services-kicker">04</span>
            <h2 id="services-tracking-title">{content.trackingSectionTitle}</h2>
          </div>

          <div className="services-grid services-grid-tracking">
            {content.trackingServices.map(({ title, description, href, icon: Icon }) => {
              const CardContent = (
                <>
                  <div className="services-card-icon"><Icon size={24} aria-hidden="true" /></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </>
              );

              return href ? (
                <Link key={title} to={href} className="services-card service-card-link">
                  {CardContent}
                </Link>
              ) : (
                <article key={title} className="services-card">
                  {CardContent}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="services-section" aria-labelledby="services-security-title">
        <div className="services-shell">
          <div className="services-section-header">
            <span className="services-kicker">05</span>
            <h2 id="services-security-title">{content.securitySectionTitle}</h2>
          </div>

          <div className="services-security-card">
            <div className="services-security-icon" aria-hidden="true">🔐</div>
            <div className="services-security-copy">
              <h3>{content.securityTitle}</h3>
              <p>{content.securityDescription}</p>
              <ul>
                {content.securityList.map((item) => (
                  <li key={item}><span aria-hidden="true">+</span> {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="services-section services-workflow-section" aria-labelledby="services-workflow-title">
        <div className="services-shell">
          <div className="services-section-header">
            <span className="services-kicker">06</span>
            <h2 id="services-workflow-title">{content.workflowTitle}</h2>
          </div>

          <div className="services-workflow" aria-label="Asset workflow timeline">
            {content.workflowSteps.map(({ title, description, icon: Icon }, index) => (
              <React.Fragment key={title}>
                <div className="services-workflow-step">
                  <div className="services-workflow-icon"><Icon size={18} aria-hidden="true" /></div>
                  <div className="services-workflow-copy">
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                </div>
                {index < content.workflowSteps.length - 1 && <div className="services-workflow-arrow" aria-hidden="true"><ArrowRight /></div>}
              </React.Fragment>
            ))}
          </div>

          <p className="services-workflow-note">{content.workflowNote}</p>
        </div>
      </section>

      <style>{`
        .services-page {
          --services-primary: #123B63;
          --services-secondary: #1E5A8A;
          --services-accent: #D9A441;
          --services-bg: #F5F8FC;
          --services-card: #FFFFFF;
          --services-text: #172033;
          --services-muted: #64748B;
          --services-border: #E2E8F0;
          --services-surface: rgba(18, 59, 99, 0.04);
          background: var(--services-bg);
          color: var(--services-text);
        }

        .services-page-dark {
          --services-primary: #93c5fd;
          --services-secondary: #bfdbfe;
          --services-accent: #facc15;
          --services-bg: #0f172a;
          --services-card: #111827;
          --services-text: #e2e8f0;
          --services-muted: #cbd5e1;
          --services-border: rgba(148, 163, 184, 0.25);
          --services-surface: rgba(147, 197, 253, 0.08);
        }

        .services-page * { box-sizing: border-box; }

        .services-shell {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
        }

        .services-hero {
          padding: clamp(52px, 8vw, 96px) 0 48px;
          background: linear-gradient(135deg, rgba(18, 59, 99, 0.06), rgba(30, 90, 138, 0.02));
          border-bottom: 1px solid var(--services-border);
        }

        .services-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          gap: clamp(24px, 4vw, 52px);
          align-items: center;
        }

        .services-eyebrow,
        .services-kicker {
          display: inline-block;
          margin-bottom: 16px;
          color: var(--services-primary);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .services-hero h1,
        .services-main-heading,
        .services-section-header h2,
        .services-feature-copy h3,
        .services-security-copy h3,
        .services-card h3 {
          margin: 0;
          color: var(--services-text);
        }

        .services-hero h1 {
          font-size: clamp(2.05rem, 4vw, 3.3rem);
          line-height: 1.1;
          letter-spacing: -0.04em;
        }

        .services-system-title {
          margin: 8px 0 0;
          color: var(--services-secondary);
          font-size: clamp(1.15rem, 2vw, 1.6rem);
          font-weight: 700;
        }

        .services-main-heading {
          margin-top: 14px;
          font-size: clamp(1.14rem, 2vw, 1.5rem);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--services-primary);
        }

        .services-hero-lead {
          margin: 18px 0 0;
          max-width: 650px;
          font-size: clamp(1.08rem, 1.7vw, 1.38rem);
          line-height: 1.5;
          color: var(--services-text);
          font-weight: 600;
        }

        .services-hero-description {
          margin: 16px 0 0;
          max-width: 610px;
          color: var(--services-muted);
          font-size: 1rem;
          line-height: 1.7;
        }

        .services-hero-visual {
          display: flex;
          justify-content: center;
        }

        .services-visual-panel {
          width: min(100%, 470px);
          padding: 24px;
          border: 1px solid var(--services-border);
          border-radius: 22px;
          background: var(--services-card);
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
        }

        .services-visual-header {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--services-primary);
          font-weight: 700;
        }

        .services-visual-badge {
          display: inline-grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(18, 59, 99, 0.09);
        }

        .services-visual-steps {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 22px;
        }

        .services-visual-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid rgba(18, 59, 99, 0.18);
          border-radius: 999px;
          background: var(--services-surface);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--services-secondary);
        }

        .services-visual-flow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 18px;
          color: var(--services-accent);
        }

        .services-visual-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid var(--services-border);
        }

        .services-visual-footer strong,
        .services-visual-footer span {
          display: block;
        }

        .services-visual-footer strong {
          margin-bottom: 4px;
          font-size: 0.96rem;
        }

        .services-visual-footer span {
          font-size: 0.82rem;
          color: var(--services-muted);
          line-height: 1.5;
        }

        .services-visual-footer svg {
          color: var(--services-primary);
          flex-shrink: 0;
        }

        .services-section {
          padding: clamp(52px, 7vw, 88px) 0;
        }

        .services-section-header {
          margin-bottom: 18px;
        }

        .services-section-header h2 {
          font-size: clamp(1.9rem, 3vw, 2.8rem);
          line-height: 1.16;
          letter-spacing: -0.03em;
        }

        .services-section-intro {
          margin: 0 0 24px;
          max-width: 760px;
          color: var(--services-muted);
          font-size: 1.03rem;
          line-height: 1.7;
        }

        .services-category-grid,
        .services-grid {
          display: grid;
          gap: 18px;
        }

        .services-category-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .services-category-card,
        .services-card,
        .services-feature-card,
        .services-security-card {
          border: 1px solid var(--services-border);
          border-radius: 18px;
          background: var(--services-card);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
          transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
        }

        .services-category-card:hover,
        .services-card:hover,
        .services-feature-card:hover,
        .services-security-card:hover {
          transform: translateY(-4px);
          border-color: rgba(18, 59, 99, 0.35);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
        }

        .services-category-card {
          display: flex;
          min-height: 240px;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 22px 20px;
        }

        .services-card-icon {
          display: inline-grid;
          place-items: center;
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: rgba(18, 59, 99, 0.08);
          color: var(--services-primary);
          margin-bottom: 18px;
        }

        .services-category-card h3,
        .services-card h3,
        .services-feature-copy h3,
        .services-security-copy h3 {
          font-size: 1.18rem;
          line-height: 1.35;
          margin-bottom: 8px;
        }

        .services-category-card p,
        .services-card p,
        .services-feature-copy p,
        .services-security-copy p,
        .services-workflow-copy span {
          margin: 0;
          color: var(--services-muted);
          font-size: 0.95rem;
          line-height: 1.65;
        }

        .services-card-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 18px;
          color: var(--services-primary);
          font-weight: 700;
          font-size: 0.82rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .services-grid-asset,
        .services-grid-tracking {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .services-card {
          display: flex;
          min-height: 220px;
          flex-direction: column;
          justify-content: flex-start;
          padding: 22px 20px 18px;
          text-decoration: none;
          color: inherit;
        }

        .services-card-link:focus-visible,
        .services-card-action:focus-visible,
        .services-security-card:focus-visible,
        .services-feature-card:focus-visible {
          outline: 3px solid rgba(18, 59, 99, 0.25);
          outline-offset: 4px;
        }

        .services-highlight {
          background: rgba(18, 59, 99, 0.03);
          border-top: 1px solid var(--services-border);
          border-bottom: 1px solid var(--services-border);
        }

        .services-feature-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 28px;
        }

        .services-feature-icon,
        .services-security-icon {
          display: grid;
          place-items: center;
          color: var(--services-primary);
          background: rgba(18, 59, 99, 0.08);
          border-radius: 18px;
        }

        .services-feature-icon {
          width: 64px;
          height: 64px;
          flex-shrink: 0;
        }

        .services-security-card {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          padding: 28px;
        }

        .services-security-icon {
          width: 82px;
          height: 82px;
          font-size: 2.2rem;
          flex-shrink: 0;
        }

        .services-security-copy ul {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px 16px;
          padding: 0;
          margin: 18px 0 0;
          list-style: none;
        }

        .services-security-copy li {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--services-text);
          font-weight: 700;
        }

        .services-security-copy li span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(18, 59, 99, 0.08);
          color: var(--services-primary);
        }

        .services-workflow-section {
          padding-bottom: 88px;
        }

        .services-workflow {
          display: grid;
          grid-template-columns: repeat(9, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .services-workflow-step {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px 16px;
          border: 1px solid var(--services-border);
          border-radius: 16px;
          background: var(--services-card);
          min-height: 160px;
        }

        .services-workflow-icon {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(18, 59, 99, 0.08);
          color: var(--services-primary);
        }

        .services-workflow-copy {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .services-workflow-copy strong {
          font-size: 0.96rem;
        }

        .services-workflow-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--services-accent);
        }

        .services-workflow-note {
          margin: 20px 0 0;
          color: var(--services-muted);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        @media (max-width: 1024px) {
          .services-category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .services-grid-asset,
          .services-grid-tracking {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .services-workflow {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .services-workflow-arrow {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .services-hero-grid {
            grid-template-columns: 1fr;
          }

          .services-grid-asset,
          .services-grid-tracking,
          .services-security-copy ul {
            grid-template-columns: 1fr;
          }

          .services-category-grid {
            grid-template-columns: 1fr;
          }

          .services-feature-card,
          .services-security-card {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 480px) {
          .services-shell {
            width: min(100% - 24px, 1180px);
          }

          .services-hero {
            padding-top: 38px;
          }

          .services-workflow {
            grid-template-columns: 1fr;
          }

          .services-visual-panel,
          .services-feature-card,
          .services-security-card,
          .services-card,
          .services-category-card {
            border-radius: 14px;
          }
        }
      `}</style>
    </main>
  );
};

export default Services;
