import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CircleHelp, LifeBuoy, Search, ShieldCheck } from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const Help = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState('transfer-asset');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  const isEnglish = language === 'en';

  const content = isEnglish ? {
    heroUniversity: 'Mekdela Amba University',
    heroSystem: 'University Asset Management System',
    heroTitle: 'HELP & SUPPORT',
    heroDescription: 'Guidance for the asset records and workflows available in your role.',
    searchTitle: 'Search Help',
    searchPlaceholder: 'Search help topics or questions...',
    searchLabel: 'Search help topics or questions',
    clear: 'Clear',
    categoryTitle: 'What do you need help with?',
    faqTitle: 'Frequently Asked Questions',
    topicTitle: 'Help Topics',
    roleTitle: 'Roles and Access',
    roleIntro: 'The actions and pages available to you depend on your assigned role and permissions.',
    emptyState: 'No matching help topics found.',
    supportTitle: 'Need More Help?',
    supportDetails: 'Official contact details have not been configured.',
    supportUnavailable: 'Public message submission is unavailable.',
    contactButton: 'View Contact Information',
    backHome: 'Back to Home',
    quickLinks: [
      { id: 'help-getting-started', label: 'Getting Started', href: '#help-getting-started' },
      { id: 'help-assets', label: 'Assets & Inventory', href: '#help-assets' },
      { id: 'help-workflows', label: 'Asset Workflows', href: '#help-workflows' },
      { id: 'help-reports', label: 'Reports & Tracking', href: '#help-reports' },
      { id: 'help-roles', label: 'Roles & Access', href: '#help-roles' }
    ],
    roleLabels: ['All Roles', 'Admin', 'Store Manager', 'ICT Officer', 'Department Head', 'College Manager', 'Finance', 'Maintenance'],
    roleDescriptions: {
      Admin: 'Manages system access, asset governance, reports, and audit records.',
      'Store Manager': 'Handles receiving, inventory, issuing, stock control, and verification.',
      'ICT Officer': 'Manages ICT assets, assignments, transfers, RFID tracking, and service activity.',
      'Department Head': 'Coordinates department asset requests, assignments, and reporting.',
      'College Manager': 'Oversees college requests, approvals, transfers, returns, and verification.',
      Finance: 'Maintains purchasing, budget, payment, valuation, and depreciation records.',
      Maintenance: 'Coordinates service requests, inspections, work orders, and repairs.'
    },
    helpTopics: [
      { id: 'help-getting-started', title: 'Getting started', description: 'Learn about login and access to the system.', icon: CircleHelp },
      { id: 'help-assets', title: 'Assets and inventory', description: 'Find assets and understand inventory-related actions.', icon: Search },
      { id: 'help-workflows', title: 'Asset workflows', description: 'Understand transfer, verification, maintenance, and return workflows.', icon: ArrowRight },
      { id: 'help-reports', title: 'Reports and tracking', description: 'Learn about reports and RFID / QR asset lookup.', icon: ShieldCheck },
      { id: 'help-roles', title: 'Roles and access', description: 'Understand role-based pages and available actions.', icon: BookOpen }
    ],
    faqSections: [
      {
        id: 'help-getting-started',
        title: 'Getting started',
        items: [
          { id: 'login-access', question: 'How do I log in or recover account access?', answer: 'Access depends on your signed-in account and assigned permissions. If you cannot access your account, contact your system administrator.' },
          { id: 'page-visibility', question: 'Why can\'t I see a page or action?', answer: 'The pages and actions available to you depend on your assigned role and permissions.' }
        ]
      },
      {
        id: 'help-assets',
        title: 'Assets and inventory',
        items: [
          { id: 'find-asset', question: 'How do I find an asset and view its details?', answer: 'Use the available asset inventory/search functionality to locate an asset and view its details.' },
          { id: 'request-asset', question: 'How do I request an asset?', answer: 'Detailed instructions for this action depend on your assigned role and permissions. Please use the relevant system workflow or contact your system administrator for assistance.' },
          { id: 'receive-asset', question: 'How do I record assets received into inventory?', answer: 'Detailed instructions for this action depend on your assigned role and permissions. Please use the relevant system workflow or contact your system administrator for assistance.' }
        ]
      },
      {
        id: 'help-workflows',
        title: 'Asset workflows',
        items: [
          { id: 'transfer-asset', question: 'How do I transfer an asset?', answer: 'Asset transfers are handled through the asset transfer workflow. Available actions depend on your assigned role and permissions.' },
          { id: 'verify-asset', question: 'How do I verify an asset?', answer: 'Asset verification is supported through inventory verification workflows. Available actions depend on your role.' },
          { id: 'maintenance-issue', question: 'How do I report a maintenance issue?', answer: 'Maintenance issues can be handled through the maintenance workflow. Available actions depend on your role.' },
          { id: 'return-asset', question: 'How do I return an asset?', answer: 'Asset returns are supported through the return workflow, including receipt and inspection.' }
        ]
      },
      {
        id: 'help-reports',
        title: 'Reports and tracking',
        items: [
          { id: 'view-reports', question: 'How do I view reports?', answer: 'Reports can be generated and reviewed according to your assigned permissions.' },
          { id: 'rfid-lookup', question: 'Can I use RFID or QR to look up an asset?', answer: 'The system supports RFID tag linking, RFID scans, and asset lookup using QR identifiers.' }
        ]
      }
    ]
  } : {
    heroUniversity: 'መቅደላ አምባ ዩኒቨርሲቲ',
    heroSystem: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    heroTitle: 'እገዛና ድጋፍ',
    heroDescription: 'ለእርስዎ ሚና በተፈቀዱ የንብረት መዝገቦችና የስራ ሂደቶች መመሪያ።',
    searchTitle: 'እገዛ ፈልግ',
    searchPlaceholder: 'የእገዛ ርዕስ ወይም ጥያቄ ይፈልጉ...',
    searchLabel: 'የእገዛ ርዕስ ወይም ጥያቄ ይፈልጉ',
    clear: 'አጽዳ',
    categoryTitle: 'ምን እገዛ ያስፈልገዎታል?',
    faqTitle: 'ተደጋጋሚ ጥያቄዎች',
    topicTitle: 'የእገዛ ርዕሶች',
    roleTitle: 'ሚናዎችና መዳረሻ',
    roleIntro: 'የሚታዩ ገጾችና ድርጊቶች በተመደበው ሚና እና ፈቃድ ይወሰናሉ።',
    emptyState: 'ተዛማጅ የእገዛ ርዕስ አልተገኘም.',
    supportTitle: 'ተጨማሪ እገዛ ያስፈልገዎታል?',
    supportDetails: 'የተረጋገጠ የግንኙነት መረጃ አልተዋቀረም።',
    supportUnavailable: 'ይፋዊ መልዕክት መላኪያ አይገኝም።',
    contactButton: 'የግንኙነት መረጃን ይመልከቱ',
    backHome: 'ወደ መነሻ ገጽ',
    quickLinks: [
      { id: 'help-getting-started', label: 'መጀመር', href: '#help-getting-started' },
      { id: 'help-assets', label: 'ንብረቶች እና ኢንቬንተሪ', href: '#help-assets' },
      { id: 'help-workflows', label: 'የንብረት ሂደቶች', href: '#help-workflows' },
      { id: 'help-reports', label: 'ሪፖርቶች እና ክትትል', href: '#help-reports' },
      { id: 'help-roles', label: 'ሚናዎች እና መዳረሻ', href: '#help-roles' }
    ],
    roleLabels: ['All Roles', 'Admin', 'Store Manager', 'ICT Officer', 'Department Head', 'College Manager', 'Finance', 'Maintenance'],
    roleDescriptions: {
      Admin: 'የስርዓት መዳረሻን፣ የንብረት አስተዳደርን፣ ሪፖርቶችንና የኦዲት መዝገቦችን ያስተዳድራል።',
      'Store Manager': 'መቀበልን፣ ኢንቬንተሪን፣ ማውጣትን፣ ክምችትንና ማረጋገጫን ያከናውናል።',
      'ICT Officer': 'የICT ንብረቶችን፣ ምደባን፣ ዝውውርን፣ RFID ክትትልንና የአገልግሎት ስራን ያስተዳድራል።',
      'Department Head': 'የመምሪያ ንብረት ጥያቄዎችን፣ ምደባዎችንና ሪፖርቶችን ያስተባብራል።',
      'College Manager': 'የኮሌጅ ጥያቄዎችን፣ ማጽደቆችን፣ ዝውውሮችን፣ መመለሶችንና ማረጋገጫን ይቆጣጠራል።',
      Finance: 'የግዢ፣ በጀት፣ ክፍያ፣ የንብረት ዋጋና የዋጋ ቅነሳ መዝገቦችን ያስተዳድራል።',
      Maintenance: 'የአገልግሎት ጥያቄዎችን፣ ምርመራዎችን፣ የስራ ትዕዛዞችንና ጥገናዎችን ያስተባብራል።'
    },
    helpTopics: [
      { id: 'help-getting-started', title: 'መጀመር', description: 'ስለ መግቢያ እና የስርዓት መዳረሻ ይማራል።', icon: CircleHelp },
      { id: 'help-assets', title: 'ንብረቶችና ኢንቬንተሪ', description: 'ንብረቶችን ያግኙ እና የኢንቬንተሪ እንቅስቃሴዎችን ይረዱ።', icon: Search },
      { id: 'help-workflows', title: 'የንብረት ሂደቶች', description: 'የዝውውር፣ ማረጋገጫ፣ ጥገና እና መመለሻ ሂደቶችን ይረዱ።', icon: ArrowRight },
      { id: 'help-reports', title: 'ሪፖርቶችና ክትትል', description: 'ሪፖርቶችን እና RFID / QR ንብረት ፍለጋን ይረዱ።', icon: ShieldCheck },
      { id: 'help-roles', title: 'ሚናዎችና መዳረሻ', description: 'የሚና አቀራረብ ገጾችን እና የሚገኙ እርምጃዎችን ይረዱ።', icon: BookOpen }
    ],
    faqSections: [
      {
        id: 'help-getting-started',
        title: 'መጀመር',
        items: [
          { id: 'login-access', question: 'እንዴት እገባለሁ ወይም የመለያ መዳረሻን እመልሳለሁ?', answer: 'መዳረሻ በተገቢው መለያ እና በተመደበው ፈቃድ ላይ የተመሠረተ ነው። መለያዎን ካልተደራረቡ የስርዓቱን አስተዳዳሪ ያነጋግሩ።' },
          { id: 'page-visibility', question: 'ገጽ ወይም ድርጊት ለምን አይታየኝም?', answer: 'የሚታዩ ገጾች እና ድርጊቶች በተመደበው ሚና እና ፈቃድ ላይ የተመሠረቱ ናቸው።' }
        ]
      },
      {
        id: 'help-assets',
        title: 'ንብረቶችና ኢንቬንተሪ',
        items: [
          { id: 'find-asset', question: 'ንብረትን እንዴት እፈልጋለሁ እና ዝርዝሩን እመለከታለሁ?', answer: 'የተገኘውን የንብረት ኢንቬንተሪ/ፍለጋ ስራ ተጠቅሞ ንብረትን ፈልግና ዝርዝሩን ይመልከቱ።' },
          { id: 'request-asset', question: 'ንብረት እንዴት እጠይቃለሁ?', answer: 'ይህን እርምጃ የሚመሩበት ዝርዝር መመሪያ በእርስዎ ሚና እና ፈቃድ ላይ የተመሠረተ ነው።' },
          { id: 'receive-asset', question: 'ወደ ኢንቬንተሪ የተቀበሉ ንብረቶችን እንዴት እመዘግባለሁ?', answer: 'ይህን እርምጃ የሚመሩበት ዝርዝር መመሪያ በእርስዎ ሚና እና ፈቃድ ላይ የተመሠረተ ነው።' }
        ]
      },
      {
        id: 'help-workflows',
        title: 'የንብረት ሂደቶች',
        items: [
          { id: 'transfer-asset', question: 'ንብረትን እንዴት አስተላልፋለሁ?', answer: 'የንብረት ዝውውር በንብረት ዝውውር ሂደት ይካሄዳል። የሚገኙ እርምጃዎች በእርስዎ ሚና እና ፈቃድ ላይ ይወሰናሉ።' },
          { id: 'verify-asset', question: 'ንብረትን እንዴት አረጋግጣለሁ?', answer: 'የንብረት ማረጋገጫ በኢንቬንተሪ ማረጋገጫ ሂደት ይደገፋል። የሚገኙ እርምጃዎች በእርስዎ ሚና ላይ ይወሰናሉ።' },
          { id: 'maintenance-issue', question: 'የጥገና ችግርን እንዴት እመዘግባለሁ?', answer: 'የጥገና ችግር በጥገና ሂደት ሊተዳደር ይችላል። የሚገኙ እርምጃዎች በእርስዎ ሚና ላይ ይወሰናሉ።' },
          { id: 'return-asset', question: 'ንብረትን እንዴት እመልሳለሁ?', answer: 'የንብረት መመለሻ በመመለሻ ሂደት ይደገፋል፣ እንዲሁም ተቀባይነት እና ምርመራን ያካትታል።' }
        ]
      },
      {
        id: 'help-reports',
        title: 'ሪፖርቶችና ክትትል',
        items: [
          { id: 'view-reports', question: 'ሪፖርቶችን እንዴት እመለከታለሁ?', answer: 'ሪፖርቶች በተመደበው ፈቃድ መሰረት ሊመረጡ እና ሊገምገሙ ይችላሉ።' },
          { id: 'rfid-lookup', question: 'RFID ወይም QR ተጠቅሜ ንብረት መፈለግ እችላለሁ?', answer: 'ስርዓቱ RFID መለያ ተግባር፣ RFID ስካን እና QR መለያ በመጠቀም የንብረት ፍለጋ ይደግፋል።' }
        ]
      }
    ]
  };

  const filteredTopics = content.helpTopics.filter((topic) => {
    const haystack = `${topic.title} ${topic.description}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  const filteredFaqSections = content.faqSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = `${section.title} ${item.question} ${item.answer}`.toLowerCase();
        return !query.trim() || haystack.includes(query.trim().toLowerCase());
      })
    }))
    .filter((section) => section.items.length > 0);

  const filteredRoles = Object.entries(content.roleDescriptions).filter(([name, description]) => {
    const targetRole = roleFilter === 'All Roles' ? 'All Roles' : roleFilter;
    const matchesRole = targetRole === 'All Roles' || name === targetRole;
    if (!matchesRole) return false;
    const haystack = `${name} ${description}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  const hasNoResults = Boolean(query.trim()) && filteredTopics.length === 0 && filteredFaqSections.length === 0 && filteredRoles.length === 0;

  return (
    <main className={`help-page${theme === 'dark' ? ' help-page-dark' : ''}`}>
      <style>{`
        :root {
          --help-primary: #123B63;
          --help-secondary: #1E5A8A;
          --help-accent: #D9A441;
          --help-bg: #F5F8FC;
          --help-card: #FFFFFF;
          --help-text: #172033;
          --help-muted: #64748B;
          --help-border: #E2E8F0;
          --help-success: #198754;
        }
        .help-page { --help-page-bg: var(--help-bg); --help-surface: var(--help-card); --help-text-main: var(--help-text); --help-text-soft: var(--help-muted); --help-outline: var(--help-border); --help-brand: var(--help-primary); --help-brand-alt: var(--help-secondary); --help-highlight: var(--help-accent); --help-strong: var(--help-success); background: var(--help-page-bg); color: var(--help-text-main); min-height: 100%; scroll-behavior: smooth; }
        .help-page-dark { --help-page-bg: #0f172a; --help-surface: #111c2c; --help-text-main: #e2e8f0; --help-text-soft: #a7b3c7; --help-outline: rgba(148,163,184,0.22); --help-brand: #93c5fd; --help-brand-alt: #cbd5e1; --help-highlight: #f4c86b; --help-strong: #4ade80; }
        .help-page * { box-sizing: border-box; }
        .help-shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
        .help-hero { padding: 64px 0 52px; background: linear-gradient(135deg, rgba(18,59,99,0.08), rgba(30,90,138,0.06)); border-bottom: 1px solid var(--help-outline); }
        .help-hero-inner { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr); gap: 28px; align-items: center; }
        .help-hero-copy { max-width: 700px; }
        .help-hero-tag { margin: 0 0 12px; color: var(--help-brand); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .help-hero h1 { margin: 0; font-size: clamp(2.2rem, 4vw, 4rem); line-height: 1.08; letter-spacing: -0.04em; color: var(--help-text-main); }
        .help-hero h2 { margin: 8px 0 0; color: var(--help-brand-alt); font-size: clamp(1.1rem, 2vw, 1.7rem); font-weight: 700; }
        .help-hero-description { margin: 18px 0 0; max-width: 640px; font-size: 1.05rem; line-height: 1.7; color: var(--help-text-soft); }
        .help-hero-visual { display: flex; justify-content: center; }
        .help-visual-card { display: grid; place-items: center; width: min(100%, 280px); height: 220px; border: 1px solid var(--help-outline); border-radius: 24px; background: linear-gradient(180deg, rgba(18,59,99,0.05), rgba(217,164,65,0.1)); box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
        .help-visual-ring { display: grid; place-items: center; width: 140px; height: 140px; border: 1px solid rgba(18,59,99,0.15); border-radius: 50%; background: rgba(255,255,255,0.42); }
        .help-visual-ring svg { color: var(--help-brand); width: 52px; height: 52px; }
        .help-search-wrap { margin-top: 26px; background: var(--help-surface); border-radius: 16px; border: 1px solid var(--help-outline); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 14px; }
        .help-search-wrap:focus-within { border-color: var(--help-brand); box-shadow: 0 0 0 4px rgba(18,59,99,0.08); }
        .help-search-wrap svg { color: var(--help-brand-alt); flex-shrink: 0; }
        .help-search-wrap input { width: 100%; border: none; background: transparent; color: var(--help-text-main); font-size: 1rem; font-family: inherit; outline: none; }
        .help-search-wrap input::placeholder { color: var(--help-text-soft); }
        .help-search-clear { border: none; background: transparent; color: var(--help-brand-alt); font-weight: 700; cursor: pointer; padding: 8px 8px; border-radius: 8px; }
        .help-search-clear:hover, .help-search-clear:focus-visible { background: rgba(18,59,99,0.08); outline: none; }
        .help-body { padding: 40px 0 72px; }
        .help-section { margin-top: 32px; }
        .help-section:first-child { margin-top: 0; }
        .help-section-title { margin: 0 0 18px; font-size: clamp(1.6rem, 2vw, 2.2rem); line-height: 1.2; }
        .help-quick-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin: 0 0 30px; }
        .help-quick-card { display: block; padding: 18px 16px; border: 1px solid var(--help-outline); border-radius: 14px; background: var(--help-surface); text-decoration: none; color: var(--help-text-main); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04); transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
        .help-quick-card:hover, .help-quick-card:focus-visible { transform: translateY(-2px); border-color: var(--help-highlight); box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08); outline: none; }
        .help-quick-card strong { display: block; margin-bottom: 6px; font-size: 0.96rem; }
        .help-quick-card span { display: inline-flex; align-items: center; gap: 6px; color: var(--help-brand); font-size: 0.78rem; font-weight: 700; }
        .help-topic-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; }
        .help-topic-card { display: flex; flex-direction: column; gap: 12px; min-height: 180px; padding: 20px 18px; border: 1px solid var(--help-outline); border-radius: 18px; background: var(--help-surface); box-shadow: 0 8px 26px rgba(15,23,42,0.04); }
        .help-topic-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 12px; background: rgba(18,59,99,0.08); color: var(--help-brand); }
        .help-topic-card h3 { margin: 0; font-size: 1.1rem; }
        .help-topic-card p { margin: 0; color: var(--help-text-soft); line-height: 1.6; font-size: 0.95rem; }
        .help-faq-wrap { display: grid; gap: 14px; }
        .help-faq-card { border: 1px solid var(--help-outline); border-radius: 16px; background: var(--help-surface); overflow: hidden; }
        .help-faq-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 18px; border: none; background: transparent; color: var(--help-text-main); text-align: left; font-size: 1rem; font-weight: 700; cursor: pointer; }
        .help-faq-button:hover, .help-faq-button:focus-visible { background: rgba(18,59,99,0.03); outline: none; }
        .help-faq-toggle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(217,164,65,0.14); color: var(--help-brand); flex-shrink: 0; font-size: 1.4rem; line-height: 1; }
        .help-faq-answer { max-height: 0; opacity: 0; overflow: hidden; transform: translateY(-4px); transition: max-height 220ms ease, opacity 220ms ease, transform 220ms ease, padding 220ms ease; padding: 0 18px; color: var(--help-text-soft); line-height: 1.7; }
        .help-faq-card.is-open .help-faq-answer { max-height: 300px; opacity: 1; transform: translateY(0); padding: 0 18px 18px; }
        .help-role-note { margin: 0 0 18px; color: var(--help-text-soft); line-height: 1.7; }
        .help-role-filter { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
        .help-role-filter button { border: 1px solid var(--help-outline); background: var(--help-surface); color: var(--help-text-main); border-radius: 999px; padding: 9px 14px; font-weight: 700; cursor: pointer; transition: all 160ms ease; }
        .help-role-filter button.is-active, .help-role-filter button:hover, .help-role-filter button:focus-visible { background: rgba(18,59,99,0.09); border-color: var(--help-brand); color: var(--help-brand); outline: none; }
        .help-role-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .help-role-card { display: flex; gap: 12px; width: 100%; padding: 18px; border: 1px solid var(--help-outline); border-radius: 16px; background: var(--help-surface); }
        .help-role-card svg { color: var(--help-highlight); flex-shrink: 0; margin-top: 2px; }
        .help-role-card strong { display: block; margin-bottom: 6px; }
        .help-role-card p { margin: 0; color: var(--help-text-soft); line-height: 1.6; }
        .help-support-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 36px; padding: 22px 24px; border: 1px solid var(--help-outline); border-left: 4px solid var(--help-highlight); border-radius: 16px; background: var(--help-surface); }
        .help-support-card h3 { margin: 0 0 6px; font-size: 1.3rem; }
        .help-support-card p { margin: 0; color: var(--help-text-soft); line-height: 1.7; }
        .help-support-link { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 10px; border: 1px solid var(--help-brand); background: var(--help-brand); color: #fff; text-decoration: none; font-weight: 700; white-space: nowrap; }
        .help-support-link:hover, .help-support-link:focus-visible { filter: brightness(0.97); outline: none; }
        .help-empty-state { padding: 26px 18px; border: 1px dashed var(--help-outline); border-radius: 16px; background: var(--help-surface); text-align: center; }
        .help-empty-state svg { color: var(--help-highlight); }
        .help-empty-state h3 { margin: 10px 0 8px; font-size: 1.2rem; }
        .help-empty-state p { margin: 0; color: var(--help-text-soft); }
        .help-empty-state button { margin-top: 14px; border: none; background: transparent; color: var(--help-brand); font-size: 1rem; font-weight: 700; cursor: pointer; }
        .help-footer-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 22px; color: var(--help-brand); font-weight: 700; text-decoration: none; }
        @media (max-width: 980px) { .help-quick-grid, .help-topic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .help-hero-inner { grid-template-columns: 1fr; } .help-role-grid { grid-template-columns: 1fr; } .help-support-card { flex-direction: column; align-items: flex-start; } }
        @media (max-width: 640px) { .help-shell { width: min(100% - 24px, 1120px); } .help-hero { padding-top: 38px; } .help-quick-grid, .help-topic-grid { grid-template-columns: 1fr; } .help-search-wrap { min-height: 58px; } .help-support-card { padding: 18px; } }
      `}</style>

      <section className="help-hero" aria-labelledby="help-page-title">
        <div className="help-shell help-hero-inner">
          <div className="help-hero-copy">
            <p className="help-hero-tag">{content.heroUniversity}</p>
            <h2>{content.heroSystem}</h2>
            <h1 id="help-page-title">{content.heroTitle}</h1>
            <p className="help-hero-description">{content.heroDescription}</p>
          </div>
          <div className="help-hero-visual" aria-hidden="true">
            <div className="help-visual-card">
              <div className="help-visual-ring">
                <LifeBuoy size={52} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="help-shell help-body">
        <section className="help-section" aria-labelledby="help-search-title">
          <h2 id="help-search-title" className="help-section-title">{content.searchTitle}</h2>
          <div className="help-search-wrap">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={content.searchPlaceholder}
              aria-label={content.searchLabel}
            />
            {query && (
              <button type="button" className="help-search-clear" onClick={() => setQuery('')} aria-label={content.clear}>
                {content.clear}
              </button>
            )}
          </div>
        </section>

        <section className="help-section" aria-labelledby="help-quick-title">
          <h2 id="help-quick-title" className="help-section-title">{content.categoryTitle}</h2>
          <div className="help-quick-grid">
            {content.quickLinks.map((item) => (
              <a key={item.id} href={item.href} className="help-quick-card">
                <strong>{item.label}</strong>
                <span>{isEnglish ? 'Open section' : 'ክፍል ይክፈቱ'} <ArrowRight size={14} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
        </section>

        {hasNoResults ? (
          <section className="help-section help-empty-state" role="status" aria-live="polite">
            <CircleHelp size={28} aria-hidden="true" />
            <h3>{content.emptyState}</h3>
            <button type="button" onClick={() => setQuery('')}>{content.clear}</button>
          </section>
        ) : (
          <>
            <section className="help-section" aria-labelledby="help-topics-title">
              <h2 id="help-topics-title" className="help-section-title">{content.topicTitle}</h2>
              <div className="help-topic-grid">
                {filteredTopics.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <article key={topic.id} id={topic.id} className="help-topic-card">
                      <div className="help-topic-icon"><Icon size={24} aria-hidden="true" /></div>
                      <h3>{topic.title}</h3>
                      <p>{topic.description}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="help-section" aria-labelledby="help-faq-title">
              <h2 id="help-faq-title" className="help-section-title">{content.faqTitle}</h2>
              <div className="help-faq-wrap">
                {filteredFaqSections.map((section) => (
                  <div key={section.id} id={section.id}>
                    <div className="help-section-label">{section.title}</div>
                    {section.items.map((item) => {
                      const isOpen = openFaqId === item.id;
                      return (
                        <div key={item.id} className={`help-faq-card${isOpen ? ' is-open' : ''}`}>
                          <button
                            type="button"
                            className="help-faq-button"
                            aria-expanded={isOpen}
                            aria-controls={item.id}
                            id={`${item.id}-button`}
                            onClick={() => setOpenFaqId(isOpen ? '' : item.id)}
                          >
                            <span>{item.question}</span>
                            <span className="help-faq-toggle" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                          </button>
                          <div id={item.id} className="help-faq-answer" role="region" aria-labelledby={`${item.id}-button`} hidden={!isOpen}>
                            {item.answer}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>

            <section className="help-section" aria-labelledby="help-role-title">
              <h2 id="help-role-title" className="help-section-title">{content.roleTitle}</h2>
              <p className="help-role-note">{content.roleIntro}</p>

              <div className="help-role-filter" aria-label={isEnglish ? 'Role filter' : 'የሚና ማጣሪያ'}>
                {content.roleLabels.map((roleName) => (
                  <button
                    key={roleName}
                    type="button"
                    className={roleFilter === roleName ? 'is-active' : ''}
                    aria-pressed={roleFilter === roleName}
                    onClick={() => setRoleFilter(roleName)}
                  >
                    {roleName}
                  </button>
                ))}
              </div>

              <div className="help-role-grid">
                {filteredRoles.map(([name, description]) => (
                  <div key={name} className="help-role-card">
                    <ShieldCheck size={20} aria-hidden="true" />
                    <div>
                      <strong>{name}</strong>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="help-support-card" aria-labelledby="help-support-title">
          <div>
            <h3 id="help-support-title">{content.supportTitle}</h3>
            <p>{content.supportDetails}</p>
            <p>{content.supportUnavailable}</p>
          </div>
          <Link to="/contact" className="help-support-link">
            {content.contactButton} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        <Link to="/" className="help-footer-link">
          {content.backHome} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
};

export default Help;