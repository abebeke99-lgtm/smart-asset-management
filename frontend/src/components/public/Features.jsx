import React from 'react';
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  FileBarChart,
  FileText,
  MapPin,
  Package,
  QrCode,
  Radio,
  ShieldCheck,
  UserCheck,
  Users,
  Wrench
} from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const translations = {
  en: {
    eyebrow: 'FEATURES',
    university: 'Mekdela Amba University',
    system: 'University Asset Management System',
    title: 'Powerful capabilities for managing university assets',
    description: 'The system provides shared records and role-specific workflows that help teams coordinate asset responsibilities across the university.',
    coreBenefits: 'Core Benefits',
    systemCapabilities: 'System Capabilities',
    connectedWorkflow: 'Connected Asset Management',
    workflowNote: 'Available actions and workflows depend on the asset and the user\'s assigned role.',
    roleAccess: 'Role-Based Access',
    roleIntro: 'The actions and pages available to you depend on your assigned role and permissions.',
    accountability: 'Built Around Accountability',
    capabilityCategories: [
      {
        label: 'ASSET MANAGEMENT',
        items: [
          'Asset Registration',
          'Asset Receiving',
          'Asset Inventory',
          'Asset Assignment',
          'Asset Transfer',
          'Asset Verification',
          'Maintenance',
          'Asset Returns',
          'Disposal'
        ]
      },
      {
        label: 'FINANCIAL MANAGEMENT',
        items: ['Financial Management']
      },
      {
        label: 'TRACKING & REPORTING',
        items: ['RFID / QR', 'Reports', 'Notifications', 'Audit Logs']
      },
      {
        label: 'SECURITY',
        items: ['Authentication & RBAC']
      }
    ],
    highlightList: [
      'Shared asset records',
      'Asset status and history',
      'Asset movement tracking',
      'Assignment records',
      'Verification records',
      'Maintenance history',
      'Financial visibility',
      'Operational reporting',
      'Role-based access'
    ],
    workflowSteps: [
      'Receiving',
      'Registration',
      'Inventory',
      'Assignment',
      'Tracking / Transfer',
      'Verification',
      'Maintenance',
      'Return / Disposal'
    ],
    workflowSupport: [
      'RFID / QR',
      'Reports',
      'Notifications',
      'Audit Logs',
      'Financial Management',
      'Authentication & RBAC'
    ],
    roles: [
      {
        name: 'Admin',
        description: 'Manages system access, asset governance, reports, and audit records.'
      },
      {
        name: 'Store Manager',
        description: 'Handles receiving, inventory, issuing, stock control, and verification.'
      },
      {
        name: 'ICT Officer',
        description: 'Manages ICT assets, assignments, transfers, RFID tracking, and service activity.'
      },
      {
        name: 'Department Head',
        description: 'Coordinates department asset requests, assignments, and reporting.'
      },
      {
        name: 'College Manager',
        description: 'Oversees college requests, approvals, transfers, returns, and verification.'
      },
      {
        name: 'Finance',
        description: 'Maintains purchasing, budget, payment, valuation, and depreciation records.'
      },
      {
        name: 'Maintenance',
        description: 'Coordinates service requests, inspections, work orders, and repairs.'
      }
    ]
  },
  am: {
    eyebrow: 'ባህሪያት',
    university: 'መከዳል አምባ ዩኒቨርሲቲ',
    system: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    title: 'ለዩኒቨርሲቲ ንብረት አስተዳደር ኃይለኛ ተቋራጮች',
    description: 'ስርዓቱ የጋራ መዝገቦችን እና በሚና ላይ የተመሰረተ የስራ ሂደቶችን ያቀርባል፣ ይህም ቡድኖች የንብረት ኃላፊነትን በዩኒቨርሲቲ ውስጥ እንዲያስተባብሩ ያግዛል።',
    coreBenefits: 'ዋና ጥቅሞች',
    systemCapabilities: 'የስርዓቱ ተግባራት',
    connectedWorkflow: 'የተገናኘ የንብረት አስተዳደር',
    workflowNote: 'የሚገኙ እርምጃዎችና የስራ ሂደቶች በንብረቱና በተጠቃሚው የተመደበ ሚና ላይ ይወሰናሉ።',
    roleAccess: 'በሚና ላይ የተመሰረተ መዳረሻ',
    roleIntro: 'ለእርስዎ የሚገኙት እርምጃዎችና ገጾች በተመደቡ ሚና እና ፈቃዶች ላይ የተመሰረተ ናቸው።',
    accountability: 'በተጠያቂነት ላይ የተመሰረተ',
    capabilityCategories: [
      {
        label: 'ንብረት አስተዳደር',
        items: [
          'የንብረት ምዝገባ',
          'የንብረት መቀበል',
          'የንብረት ኢንቬንተሪ',
          'የንብረት ምደባ',
          'የንብረት ማስተላለፍ',
          'የንብረት ማረጋገጫ',
          'ጥገና',
          'የንብረት መመለስ',
          'ማስወገድ'
        ]
      },
      {
        label: 'የገንዘብ አስተዳደር',
        items: ['የገንዘብ አስተዳደር']
      },
      {
        label: 'ክትትል እና ሪፖርት',
        items: ['RFID / QR', 'ሪፖርቶች', 'ማሳወቂያዎች', 'የኦዲት መዝገቦች']
      },
      {
        label: 'ደህንነት',
        items: ['መግቢያና የሚና ፈቃድ']
      }
    ],
    highlightList: [
      'የጋራ ንብረት መዝገቦች',
      'የንብረት ሁኔታ እና ታሪክ',
      'የንብረት እንቅስቃሴ ክትትል',
      'የምደባ መዝገቦች',
      'የማረጋገጫ መዝገቦች',
      'የጥገና ታሪክ',
      'የገንዘብ ግልጽነት',
      'የስራ ሪፖርት',
      'በሚና ላይ የተመሰረተ መዳረሻ'
    ],
    workflowSteps: [
      'መቀበል',
      'ምዝገባ',
      'ኢንቬንተሪ',
      'ምደባ',
      'ክትትል / ማስተላለፍ',
      'ማረጋገጫ',
      'ጥገና',
      'መመለስ / ማስወገድ'
    ],
    workflowSupport: [
      'RFID / QR',
      'ሪፖርቶች',
      'ማሳወቂያዎች',
      'የኦዲት መዝገቦች',
      'የገንዘብ አስተዳደር',
      'መግቢያና የሚና ፈቃድ'
    ],
    roles: [
      {
        name: 'አስተዳዳሪ',
        description: 'የስርዓት መዳረሻ፣ የንብረት አስተዳደር፣ ሪፖርቶችና የኦዲት መዝገቦችን ያስተዳድራል።'
      },
      {
        name: 'የመጋዘን አስተዳዳሪ',
        description: 'መቀበል፣ ኢንቬንተሪ፣ ማውጣት፣ ክምችት ቁጥጥርና ማረጋገጫን ያስተዳድራል።'
      },
      {
        name: 'የICT ባለሙያ',
        description: 'የICT ንብረቶችን፣ ምደባዎችን፣ ማስተላለፍ፣ RFID ክትትልና የአገልግሎት እንቅስቃሴን ያስተዳድራል።'
      },
      {
        name: 'የመምሪያ ኃላፊ',
        description: 'የክፍል ንብረት ጥያቄዎች፣ ምደባዎችና ሪፖርትን ያቀናጃል።'
      },
      {
        name: 'የኮሌጅ አስተዳዳሪ',
        description: 'የኮሌጅ ጥያቄዎች፣ ማጽደቆች፣ ማስተላለፍ፣ መመለስና ማረጋገጫን ያስተዳድራል።'
      },
      {
        name: 'ፋይናንስ',
        description: 'ግዢ፣ በጀት፣ ክፍያ፣ ዋጋ እና የዋጋ ቅነሳ መዝገቦችን ያስተዳድራል።'
      },
      {
        name: 'ጥገና',
        description: 'የአገልግሎት ጥያቄዎች፣ እይታዎች፣ የስራ ትዕዛዞችና ጥገናዎችን ያቀናጃል።'
      }
    ]
  }
};

const coreBenefits = [
  { title: 'Centralized Asset Management', description: 'Keep asset records, status, and history together.', icon: Database },
  { title: 'Asset Tracking', description: 'Follow asset identifiers, locations, status, and movement.', icon: MapPin },
  { title: 'Accountability', description: 'Record assignments, transfers, verification, and activity history.', icon: UserCheck },
  { title: 'Department / College Coordination', description: 'Coordinate requests, approvals, and asset responsibilities across units.', icon: Building2 },
  { title: 'Maintenance Management', description: 'Track service requests, work, status, and maintenance history.', icon: Wrench },
  { title: 'Financial Visibility', description: 'Review purchases, budgets, asset values, and depreciation records.', icon: CircleDollarSign },
  { title: 'Reporting', description: 'Generate operational and financial reports from system records.', icon: BarChart3 }
];

const capabilityDescriptions = {
  'Asset Registration': 'Create and update university asset records.',
  'Asset Receiving': 'Record assets received into store inventory.',
  'Asset Inventory': 'Search and review current asset records.',
  'Asset Assignment': 'Assign an asset to an active user and record responsibility.',
  'Asset Transfer': 'Request, review, and track asset movement.',
  'Asset Verification': 'Run inventory verification sessions and record findings.',
  'Maintenance': 'Create maintenance requests and follow work status.',
  'Asset Returns': 'Track return requests through receipt and inspection.',
  'Disposal': 'Process an asset disposal request through its workflow.',
  'Financial Management': 'Maintain financial records and review asset values.',
  'RFID / QR': 'Link RFID tags, record scans, and look up assets by QR identifier.',
  'Reports': 'Generate and review operational and financial reports.',
  'Notifications': 'View role-scoped notifications and read status.',
  'Audit Logs': 'Review recorded administrative and financial activity.',
  'Authentication & RBAC': 'Protect workflows with signed-in access and role checks.'
};

function ArrowRightIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

const capabilityIcons = {
  'Asset Registration': Package,
  'Asset Receiving': ClipboardCheck,
  'Asset Inventory': Database,
  'Asset Assignment': UserCheck,
  'Asset Transfer': ArrowRightIcon,
  'Asset Verification': ClipboardCheck,
  'Maintenance': Wrench,
  'Asset Returns': Archive,
  'Disposal': Archive,
  'Financial Management': CircleDollarSign,
  'RFID / QR': QrCode,
  'Reports': FileBarChart,
  'Notifications': Bell,
  'Audit Logs': Activity,
  'Authentication & RBAC': ShieldCheck
};

const roleIconMap = {
  Admin: ShieldCheck,
  'Store Manager': Package,
  'ICT Officer': Radio,
  'Department Head': Users,
  'College Manager': Building2,
  Finance: CircleDollarSign,
  Maintenance: Wrench
};

const FeatureCard = ({ title, description, icon: Icon, index }) => (
  <article className="feature-card" aria-label={`${title} feature`}>
    <div className="feature-card-top">
      <span className="feature-card-icon" aria-hidden="true"><Icon size={22} /></span>
      <span className="feature-card-index">0{index + 1}</span>
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    <div className="feature-card-indicator" aria-hidden="true" />
  </article>
);

const CapabilityCard = ({ name, description, icon: Icon }) => (
  <article className="capability-card" aria-label={`${name} capability`}>
    <div className="capability-head">
      <span className="capability-icon" aria-hidden="true"><Icon size={20} /></span>
      <span className="capability-badge">Implemented</span>
    </div>
    <h3>{name}</h3>
    <p>{description}</p>
  </article>
);

const RoleCard = ({ name, description, icon: Icon }) => (
  <article className="role-card" aria-label={`${name} role`}>
    <span className="role-icon" aria-hidden="true"><Icon size={24} /></span>
    <div>
      <h3>{name}</h3>
      <p>{description}</p>
    </div>
  </article>
);

const Features = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const copy = translations[language] || translations.en;
  const isDark = theme === 'dark';

  const systemCapabilities = [
    'Asset Registration',
    'Asset Receiving',
    'Asset Inventory',
    'Asset Assignment',
    'Asset Transfer',
    'Asset Verification',
    'Maintenance',
    'Asset Returns',
    'Disposal',
    'Financial Management',
    'RFID / QR',
    'Reports',
    'Notifications',
    'Audit Logs',
    'Authentication & RBAC'
  ];

  return (
    <main className={`features-page${isDark ? ' features-page-dark' : ''}`}>
      <section className="features-hero" aria-labelledby="features-page-title">
        <div className="features-shell features-hero-grid">
          <div className="features-hero-copy">
            <span className="features-eyebrow">{copy.eyebrow}</span>
            <h1 id="features-page-title">{copy.university}</h1>
            <h2>{copy.system}</h2>
            <p className="features-hero-kicker">{copy.title}</p>
            <p className="features-hero-description">{copy.description}</p>
          </div>

          <div className="features-visual" aria-label="Asset management overview">
            <div className="feature-visual-panel primary-panel">
              <div className="feature-visual-header">
                <span className="feature-visual-pill">Asset record</span>
                <span className="feature-visual-status">Live</span>
              </div>
              <div className="feature-visual-row">
                <span>Asset ID</span>
                <strong>MAU-2054</strong>
              </div>
              <div className="feature-visual-row">
                <span>Location</span>
                <strong>College Store</strong>
              </div>
              <div className="feature-visual-row">
                <span>Status</span>
                <strong>Assigned</strong>
              </div>
            </div>

            <div className="feature-mini-grid">
              <div className="feature-mini-card">
                <MapPin size={18} aria-hidden="true" />
                <span>Tracking</span>
              </div>
              <div className="feature-mini-card">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Accountability</span>
              </div>
              <div className="feature-mini-card">
                <BarChart3 size={18} aria-hidden="true" />
                <span>Reporting</span>
              </div>
              <div className="feature-mini-card">
                <Wrench size={18} aria-hidden="true" />
                <span>Maintenance</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" aria-labelledby="features-benefits-title">
        <div className="features-shell">
          <div className="section-heading">
            <span className="features-eyebrow features-eyebrow-surface">01</span>
            <h2 id="features-benefits-title">{copy.coreBenefits}</h2>
          </div>

          <div className="features-grid features-benefits-grid">
            {coreBenefits.map(({ title, description, icon }, index) => (
              <FeatureCard key={title} title={title} description={description} icon={icon} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="features-section features-section-alt" aria-labelledby="features-capabilities-title">
        <div className="features-shell">
          <div className="section-heading">
            <span className="features-eyebrow features-eyebrow-surface">02</span>
            <h2 id="features-capabilities-title">{copy.systemCapabilities}</h2>
          </div>

          <div className="capability-groups">
            {copy.capabilityCategories.map((group) => (
              <div className="capability-group" key={group.label}>
                <h3>{group.label}</h3>
                <div className="capability-grid">
                  {group.items.map((name) => (
                    <CapabilityCard
                      key={name}
                      name={name}
                      description={capabilityDescriptions[name] || 'Documented workflow support.'}
                      icon={capabilityIcons[name] || Database}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="features-section" aria-labelledby="features-workflow-title">
        <div className="features-shell">
          <div className="section-heading">
            <span className="features-eyebrow features-eyebrow-surface">03</span>
            <h2 id="features-workflow-title">{copy.connectedWorkflow}</h2>
          </div>

          <div className="workflow-layout">
            <div className="workflow-steps" aria-label="Asset workflow">
              {copy.workflowSteps.map((step, index) => (
                <div className="workflow-step" key={step}>
                  <div className="workflow-step-number">{index + 1}</div>
                  <div className="workflow-step-label">{step}</div>
                </div>
              ))}
            </div>

            <div className="workflow-side-panel" aria-label="Supporting features">
              {copy.workflowSupport.map((item) => (
                <span key={item} className="workflow-support-pill">{item}</span>
              ))}
            </div>
          </div>

          <p className="workflow-note">{copy.workflowNote}</p>
        </div>
      </section>

      <section className="features-section features-section-alt" aria-labelledby="features-roles-title">
        <div className="features-shell">
          <div className="section-heading">
            <span className="features-eyebrow features-eyebrow-surface">04</span>
            <h2 id="features-roles-title">{copy.roleAccess}</h2>
            <p>{copy.roleIntro}</p>
          </div>

          <div className="features-role-grid">
            {copy.roles.map((role) => (
              <RoleCard
                key={role.name}
                name={role.name}
                description={role.description}
                icon={roleIconMap[role.name] || ShieldCheck}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="features-section" aria-labelledby="features-accountability-title">
        <div className="features-shell">
          <div className="section-heading">
            <span className="features-eyebrow features-eyebrow-surface">05</span>
            <h2 id="features-accountability-title">{copy.accountability}</h2>
          </div>

          <div className="highlight-grid" aria-label="Accountability highlights">
            {copy.highlightList.map((item) => (
              <div className="highlight-item" key={item}>
                <Check size={18} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        :root {
          --features-primary: #123B63;
          --features-secondary: #1E5A8A;
          --features-accent: #D9A441;
          --features-bg: #F5F8FC;
          --features-card: #FFFFFF;
          --features-text: #172033;
          --features-muted: #64748B;
          --features-border: #E2E8F0;
          --features-success: #198754;
        }

        .features-page {
          --features-bg: #F5F8FC;
          --features-card: #FFFFFF;
          --features-text: #172033;
          --features-muted: #64748B;
          --features-border: #E2E8F0;
          --features-surface: #EEF4FB;
          --features-surface-strong: #E6EEF8;
          --features-primary: #123B63;
          --features-secondary: #1E5A8A;
          --features-accent: #D9A441;
          --features-success: #198754;
          background: var(--features-bg);
          color: var(--features-text);
          overflow-x: hidden;
        }

        .features-page-dark {
          --features-bg: #0f172a;
          --features-card: #111827;
          --features-text: #e2e8f0;
          --features-muted: #cbd5e1;
          --features-border: rgba(148, 163, 184, 0.28);
          --features-surface: #172033;
          --features-surface-strong: #1e293b;
          --features-primary: #7bb3df;
          --features-secondary: #9cc5ea;
          --features-accent: #d9a441;
          --features-success: #22c55e;
        }

        .features-shell {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
        }

        .features-hero {
          padding: clamp(64px, 8vw, 110px) 0 36px;
          background: linear-gradient(180deg, rgba(18, 59, 99, 0.04), rgba(18, 59, 99, 0.00));
        }

        .features-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 42px;
          align-items: center;
        }

        .features-eyebrow {
          display: inline-flex;
          align-items: center;
          margin-bottom: 18px;
          color: var(--features-secondary);
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .features-eyebrow-surface {
          color: var(--features-primary);
        }

        .features-hero-copy h1,
        .section-heading h2,
        .features-hero-copy h2 {
          margin: 0;
          letter-spacing: -0.04em;
        }

        .features-hero-copy h1 {
          font-size: clamp(2.3rem, 4vw, 4rem);
          line-height: 1.05;
          color: var(--features-primary);
        }

        .features-hero-copy h2 {
          margin-top: 8px;
          font-size: clamp(1.6rem, 2.2vw, 2.4rem);
          line-height: 1.2;
          color: var(--features-secondary);
        }

        .features-hero-kicker {
          margin-top: 24px;
          font-size: clamp(1.1rem, 2vw, 1.7rem);
          line-height: 1.4;
          font-weight: 700;
          color: var(--features-text);
        }

        .features-hero-description {
          max-width: 620px;
          margin-top: 12px;
          color: var(--features-muted);
          font-size: 1.06rem;
          line-height: 1.8;
        }

        .features-visual {
          position: relative;
          display: grid;
          gap: 16px;
          padding: 24px;
          border: 1px solid var(--features-border);
          border-radius: 24px;
          background: var(--features-card);
          box-shadow: 0 18px 40px rgba(18, 59, 99, 0.08);
        }

        .primary-panel {
          display: grid;
          gap: 12px;
          padding: 18px 18px 16px;
          border: 1px solid var(--features-border);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(18, 59, 99, 0.06), rgba(18, 59, 99, 0.01));
        }

        .feature-visual-header,
        .feature-visual-row,
        .capability-head,
        .feature-card-top,
        .workflow-step,
        .highlight-item {
          display: flex;
          align-items: center;
        }

        .feature-visual-header,
        .feature-visual-row {
          justify-content: space-between;
        }

        .feature-visual-header { margin-bottom: 4px; }
        .feature-visual-pill { font-size: 0.72rem; font-weight: 700; color: var(--features-primary); }
        .feature-visual-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--features-success);
          background: rgba(25, 135, 84, 0.12);
        }

        .feature-visual-row {
          gap: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--features-border);
          color: var(--features-muted);
          font-size: 0.9rem;
        }

        .feature-visual-row strong {
          color: var(--features-text);
          font-size: 0.92rem;
        }

        .feature-mini-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .feature-mini-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          border: 1px solid var(--features-border);
          border-radius: 12px;
          background: var(--features-surface);
          color: var(--features-text);
          font-weight: 600;
        }

        .feature-mini-card svg {
          color: var(--features-secondary);
        }

        .features-section {
          padding: 62px 0;
        }

        .features-section-alt {
          background: var(--features-surface);
          border-top: 1px solid var(--features-border);
          border-bottom: 1px solid var(--features-border);
        }

        .section-heading {
          margin-bottom: 28px;
        }

        .section-heading h2 {
          font-size: clamp(2rem, 3vw, 3rem);
          line-height: 1.12;
          color: var(--features-text);
        }

        .section-heading p {
          max-width: 700px;
          margin-top: 12px;
          color: var(--features-muted);
          line-height: 1.8;
          font-size: 1.02rem;
        }

        .features-grid,
        .capability-grid,
        .features-role-grid,
        .highlight-grid {
          display: grid;
          gap: 18px;
        }

        .features-benefits-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .feature-card,
        .capability-card,
        .role-card,
        .highlight-item {
          border: 1px solid var(--features-border);
          border-radius: 18px;
          background: var(--features-card);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .feature-card:hover,
        .capability-card:hover,
        .role-card:hover {
          transform: translateY(-4px);
          border-color: rgba(18, 59, 99, 0.24);
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.08);
        }

        .feature-card {
          padding: 24px 22px 18px;
        }

        .feature-card-top {
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .feature-card-icon,
        .capability-icon,
        .role-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          color: var(--features-primary);
          background: rgba(18, 59, 99, 0.08);
        }

        .feature-card-icon {
          width: 42px;
          height: 42px;
        }

        .feature-card-index {
          color: var(--features-muted);
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .feature-card h3,
        .capability-card h3,
        .role-card h3 {
          margin: 0 0 10px;
          font-size: 1.1rem;
          line-height: 1.35;
          color: var(--features-text);
        }

        .feature-card p,
        .capability-card p,
        .role-card p {
          margin: 0;
          color: var(--features-muted);
          line-height: 1.7;
        }

        .feature-card-indicator {
          width: 42px;
          height: 4px;
          margin-top: 18px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--features-primary), var(--features-accent));
        }

        .capability-groups {
          display: grid;
          gap: 28px;
        }

        .capability-group {
          padding: 18px 0 0;
        }

        .capability-group h3 {
          margin: 0 0 18px;
          color: var(--features-primary);
          font-size: 1.12rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .capability-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .capability-card {
          padding: 20px 18px 18px;
        }

        .capability-head {
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .capability-icon,
        .role-icon {
          width: 40px;
          height: 40px;
        }

        .capability-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(25, 135, 84, 0.12);
          color: var(--features-success);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .workflow-layout {
          display: flex;
          align-items: stretch;
          gap: 24px;
        }

        .workflow-steps {
          display: grid;
          grid-template-columns: repeat(8, minmax(140px, 1fr));
          gap: 14px;
          flex: 1 1 auto;
          min-width: 0;
        }

        .workflow-step {
          position: relative;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          min-height: 132px;
          padding: 18px 16px 16px;
          border: 1px solid var(--features-border);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(18, 59, 99, 0.04), rgba(0, 0, 0, 0));
        }

        .workflow-step::after {
          content: "";
          position: absolute;
          right: -15px;
          top: 50%;
          width: 16px;
          height: 2px;
          background: var(--features-border);
          transform: translateY(-50%);
        }

        .workflow-step:last-child::after { display: none; }

        .workflow-step-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--features-primary);
          color: white;
          font-size: 0.76rem;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .workflow-step-label {
          font-size: 0.96rem;
          font-weight: 700;
          color: var(--features-text);
        }

        .workflow-side-panel {
          display: flex;
          flex-wrap: wrap;
          align-content: center;
          gap: 10px;
          min-width: 230px;
          padding: 18px;
          border: 1px solid var(--features-border);
          border-radius: 18px;
          background: var(--features-card);
        }

        .workflow-support-pill {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(18, 59, 99, 0.08);
          color: var(--features-primary);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .workflow-note {
          margin-top: 22px;
          color: var(--features-muted);
          font-size: 0.98rem;
          line-height: 1.7;
        }

        .features-role-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .role-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 22px 18px;
        }

        .role-card h3 {
          margin-bottom: 8px;
        }

        .highlight-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .highlight-item {
          gap: 12px;
          padding: 16px 18px;
          color: var(--features-text);
          font-weight: 600;
        }

        .highlight-item svg {
          flex-shrink: 0;
          color: var(--features-success);
        }

        @media (max-width: 1024px) {
          .features-benefits-grid,
          .capability-grid,
          .features-role-grid,
          .highlight-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workflow-layout {
            flex-direction: column;
          }

          .workflow-steps {
            grid-template-columns: repeat(4, minmax(120px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .features-hero-grid,
          .features-benefits-grid,
          .capability-grid,
          .features-role-grid,
          .highlight-grid {
            grid-template-columns: 1fr;
          }

          .features-hero {
            padding-top: 52px;
          }

          .workflow-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workflow-step::after {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .features-shell {
            width: min(100% - 24px, 1180px);
          }

          .features-visual {
            padding: 16px;
          }

          .feature-mini-grid {
            grid-template-columns: 1fr 1fr;
          }

          .workflow-steps {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
};

export default Features;
