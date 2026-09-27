import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CircleHelp, KeyRound, LifeBuoy, LogIn, MessageCircle, QrCode, Search, ShieldCheck, Wrench } from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const searchAliases = {
  login: 'መግቢያ',
  password: 'የይለፍ ቃል',
  asset: 'ንብረት',
  inventory: 'ኢንቬንተሪ',
  transfer: 'ዝውውር',
  maintenance: 'ጥገና',
  role: 'ሚና',
  support: 'ድጋፍ',
  return: 'መመለስ',
  disposal: 'ማስወገድ',
  qr: 'QR',
  rfid: 'RFID'
};

const Help = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState('transfer-asset');
  const [roleFilter, setRoleFilter] = useState('all');

  const isEnglish = language === 'en';
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchTerms = [normalizedQuery];
  Object.entries(searchAliases).forEach(([englishTerm, amharicTerm]) => {
    if (normalizedQuery.includes(englishTerm) || normalizedQuery.includes(amharicTerm.toLocaleLowerCase())) {
      searchTerms.push(englishTerm, amharicTerm.toLocaleLowerCase());
    }
  });
  const matchesSearch = (haystack) => !normalizedQuery || searchTerms.some((term) => haystack.toLocaleLowerCase().includes(term));

  const content = isEnglish ? {
    heroUniversity: 'Mekdela Amba University',
    heroSystem: 'University Asset Management System',
    heroTitle: 'HELP & SUPPORT',
    heroDescription: 'Practical guidance for signing in and using the asset workflows available to your role.',
    searchTitle: 'Search Help',
    searchPlaceholder: 'Search help topics or questions...',
    searchLabel: 'Search help topics or questions',
    clear: 'Clear search',
    quickActionsTitle: 'Quick Actions',
    openAction: 'Open',
    passwordTitle: 'Password Reset',
    passwordDescription: 'Email reset instructions are sent only when email delivery is configured and the account is eligible. Phone-code recovery also depends on SMS configuration.',
    passwordSteps: ['Forgot Password', 'Enter registered email', 'Receive reset instructions when email delivery is configured', 'Open the reset link', 'Create a new password', 'Log in again'],
    passwordAction: 'Open password recovery',
    categoryTitle: 'What do you need help with?',
    faqTitle: 'Frequently Asked Questions',
    topicTitle: 'Help Topics',
    roleTitle: 'Roles and Access',
    roleIntro: 'Your dashboard and available actions depend on your assigned role. These are common areas; your account permissions determine what you can open or change.',
    emptyState: 'No matching help topics found.',
    supportTitle: 'Need More Help?',
    supportDetails: 'Official contact details have not been configured.',
    supportUnavailable: 'Public message submission is unavailable.',
    contactButton: 'View Contact Information',
    backHome: 'Back to Home',
    quickLinks: [
      { id: 'login', label: 'Login', href: '/login', icon: LogIn },
      { id: 'forgot-password', label: 'Forgot Password', href: '/forgot-password', icon: KeyRound },
      { id: 'contact', label: 'Contact Support', href: '/contact', icon: MessageCircle }
    ],
    roleLabels: [{ id: 'all', label: 'All Roles' }, { id: 'admin', label: 'Administrator' }, { id: 'store', label: 'Store Manager' }, { id: 'ict', label: 'ICT Officer' }, { id: 'department', label: 'Department Head' }, { id: 'college', label: 'College Manager' }, { id: 'finance', label: 'Finance' }, { id: 'maintenance', label: 'Maintenance' }, { id: 'infrastructure', label: 'Infrastructure' }],
    roleNames: { admin: 'Administrator', store: 'Store Manager', ict: 'ICT Officer', department: 'Department Head', college: 'College Manager', finance: 'Finance', maintenance: 'Maintenance', infrastructure: 'Infrastructure' },
    roleDescriptions: {
      admin: 'System administration and broad asset workflows, subject to assigned permissions.',
      store: 'Store inventory, asset records, receipts, and verification workflows.',
      ict: 'ICT asset records, assignments, transfers, RFID records, and service workflows.',
      department: 'Department assets, requests and approvals, verification, and maintenance requests.',
      college: 'College asset and inventory views, requests, and transfer workflows.',
      finance: 'Financial and purchasing workflows, valuation, and related reports.',
      maintenance: 'Maintenance records, service requests, and repair workflows.',
      infrastructure: 'Infrastructure inventory, assignments, transfers, maintenance, and work orders.'
    },
    helpTopics: [
      { id: 'help-getting-started', title: 'Getting started', description: 'Open Login from the public navigation. After signing in, use your role-based dashboard and its available navigation to reach your work areas.', icon: CircleHelp },
      { id: 'help-login', title: 'Login help', description: 'Use your registered username or email and password. If sign-in fails, check your details and contact your system administrator if the account is disabled or locked.', icon: LogIn },
      { id: 'help-assets', title: 'Assets and inventory', description: 'Search or filter the asset list available to your role, then open a record to review its status, location, assignment, and other saved details.', icon: Search },
      { id: 'help-workflows', title: 'Asset workflows', description: 'Use role-based assignment, transfer, verification, and maintenance workflows.', icon: Wrench },
      { id: 'help-reports', title: 'QR and RFID', description: 'Look up assets by QR identifier and review RFID tag or scan records.', icon: QrCode },
      { id: 'help-roles', title: 'Roles and access', description: 'Understand role-based pages and available actions.', icon: BookOpen }
    ],
    faqSections: [
      {
        id: 'help-getting-started',
        title: 'Getting started',
        items: [
          { id: 'login-access', question: 'How do I log in?', answer: 'Choose Login and enter the username or email registered to your account and its password. After a successful sign-in, the dashboard for your account opens. If sign-in fails, check your details; disabled accounts or repeated failed attempts may block access. Contact your system administrator for help.' },
          { id: 'page-visibility', question: 'Why can\'t I see a page or action?', answer: 'The pages and actions available to you depend on your assigned role and permissions.' }
        ]
      },
      {
        id: 'help-assets',
        title: 'Assets and inventory',
        items: [
          { id: 'register-asset', question: 'How do I register an asset?', answer: 'Open asset registration from your dashboard. Asset creation is restricted to authorized roles, including administrators, ICT officers, and store managers.' },
          { id: 'find-asset', question: 'How do I find an asset?', answer: 'Use the asset list or inventory search available on your dashboard, apply available filters, and open a matching record to review its details.' },
          { id: 'inventory-status', question: 'How do I check inventory status?', answer: 'Search the inventory available to your role, then open an asset record to review its recorded status, location, and assignment details. Inventory views differ by role.' },
          { id: 'assign-asset', question: 'How do I assign an asset?', answer: 'Open the assignment workflow, choose the asset and eligible user, then complete the form. Assignment access depends on your role and the workflow.' }
        ]
      },
      {
        id: 'help-workflows',
        title: 'Asset workflows',
        items: [
          { id: 'transfer-asset', question: 'How do I request a transfer?', answer: 'Open Transfers from your dashboard and submit the asset, destination, and reason through the workflow available to your role. Track its status there; some roles can request while others manage transfers.' },
          { id: 'verify-asset', question: 'How do I verify an asset?', answer: 'Open inventory verification, start or continue a session, record the asset checks, and submit or finalize it as permitted by your role.' },
          { id: 'maintenance-issue', question: 'How do I report a maintenance issue?', answer: 'Use the maintenance request workflow available on your dashboard. Department users can submit requests where enabled; maintenance staff and other authorized roles manage service records.' },
          { id: 'return-asset', question: 'How do I return an asset?', answer: 'Open Returns or the assignment workflow available to your role. Department users can submit returns, college managers can review them, and store managers can receive and inspect returns. Other return actions are role-restricted.' },
          { id: 'dispose-asset', question: 'How do I request asset disposal?', answer: 'Open the disposal workflow available to your role and submit the asset and reason. The system supports review, approval, scheduling, retirement, execution, and cancellation; the actions available depend on your role.' }
        ]
      },
      {
        id: 'help-reports',
        title: 'Reports and tracking',
        items: [
          { id: 'rfid-lookup', question: 'How do I use QR or RFID?', answer: 'Use the authenticated QR lookup with an asset identifier. RFID tag values and scan records are supported in software; physical reader integration is not guaranteed and must be confirmed locally.' },
          { id: 'reset-password', question: 'How do I reset my password?', answer: 'Choose Forgot Password and enter your registered email. If email delivery is configured, follow the reset link to set a new password. Phone-code recovery is also available when SMS delivery is configured.' },
          { id: 'support-contact', question: 'Who should I contact for support?', answer: 'Official email and phone contacts are not configured, and public message submission is unavailable. Visit Contact for the current status, or contact your system administrator or department/college manager through established university channels.' }
        ]
      }
    ]
  } : {
    heroUniversity: 'መቅደላ አምባ ዩኒቨርሲቲ',
    heroSystem: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    heroTitle: 'እገዛና ድጋፍ',
    heroDescription: 'በሚናዎ የተፈቀዱ የንብረት ሂደቶችን ለመጠቀምና ለመግባት ተግባራዊ መመሪያ።',
    searchTitle: 'እገዛ ፈልግ',
    searchPlaceholder: 'የእገዛ ርዕስ ወይም ጥያቄ ይፈልጉ...',
    searchLabel: 'የእገዛ ርዕስ ወይም ጥያቄ ይፈልጉ',
    clear: 'ፍለጋን አጽዳ',
    quickActionsTitle: 'ፈጣን እርምጃዎች',
    openAction: 'ይክፈቱ',
    passwordTitle: 'የይለፍ ቃል መመለስ',
    passwordDescription: 'የኢሜይል መመለሻ መመሪያ የሚላከው የኢሜይል መላኪያ ሲዋቀርና መለያው ብቁ ሲሆን ብቻ ነው። በስልክ ኮድ መመለስም በSMS ውቅር ላይ ይመሰረታል።',
    passwordSteps: ['የይለፍ ቃል ረሳሁ', 'የተመዘገበ ኢሜይል ያስገቡ', 'የኢሜይል መላኪያ ከተዋቀረ መመለሻ መመሪያ ይቀበሉ', 'የመመለሻ አገናኙን ይክፈቱ', 'አዲስ የይለፍ ቃል ያዘጋጁ', 'እንደገና ይግቡ'],
    passwordAction: 'የይለፍ ቃል መመለሻን ይክፈቱ',
    categoryTitle: 'ምን እገዛ ያስፈልገዎታል?',
    faqTitle: 'ተደጋጋሚ ጥያቄዎች',
    topicTitle: 'የእገዛ ርዕሶች',
    roleTitle: 'ሚናዎችና መዳረሻ',
    roleIntro: 'ዳሽቦርድዎና የሚገኙ እርምጃዎች በተመደበው ሚና ላይ ይመሰረታሉ። እነዚህ የተለመዱ ክፍሎች ናቸው፤ መክፈት ወይም ማሻሻል የሚችሉትን የመለያዎ ፈቃድ ይወስናል።',
    emptyState: 'ተዛማጅ የእገዛ ርዕስ አልተገኘም.',
    supportTitle: 'ተጨማሪ እገዛ ያስፈልገዎታል?',
    supportDetails: 'የተረጋገጠ የግንኙነት መረጃ አልተዋቀረም።',
    supportUnavailable: 'ይፋዊ መልዕክት መላኪያ አይገኝም።',
    contactButton: 'የግንኙነት መረጃን ይመልከቱ',
    backHome: 'ወደ መነሻ ገጽ',
    quickLinks: [
      { id: 'login', label: 'ግባ', href: '/login', icon: LogIn },
      { id: 'forgot-password', label: 'የይለፍ ቃል ረሳሁ', href: '/forgot-password', icon: KeyRound },
      { id: 'contact', label: 'ድጋፍን ያግኙ', href: '/contact', icon: MessageCircle }
    ],
    roleLabels: [{ id: 'all', label: 'ሁሉም ሚናዎች' }, { id: 'admin', label: 'አስተዳዳሪ' }, { id: 'store', label: 'የመጋዘን ኃላፊ' }, { id: 'ict', label: 'የICT ባለሙያ' }, { id: 'department', label: 'የመምሪያ ኃላፊ' }, { id: 'college', label: 'የኮሌጅ አስተዳዳሪ' }, { id: 'finance', label: 'ፋይናንስ' }, { id: 'maintenance', label: 'ጥገና' }, { id: 'infrastructure', label: 'መሠረተ ልማት' }],
    roleNames: { admin: 'አስተዳዳሪ', store: 'የመጋዘን ኃላፊ', ict: 'የICT ባለሙያ', department: 'የመምሪያ ኃላፊ', college: 'የኮሌጅ አስተዳዳሪ', finance: 'ፋይናንስ', maintenance: 'ጥገና', infrastructure: 'መሠረተ ልማት' },
    roleDescriptions: {
      admin: 'የስርዓት አስተዳደርና ሰፊ የንብረት ሂደቶች፤ በተመደበው ፈቃድ መሠረት።',
      store: 'የመጋዘን ኢንቬንተሪ፣ የንብረት መዝገቦች፣ ደረሰኞችና የማረጋገጫ ሂደቶች።',
      ict: 'የICT ንብረት መዝገቦች፣ ምደባዎች፣ ዝውውሮች፣ የRFID መዝገቦችና የአገልግሎት ሂደቶች።',
      department: 'የመምሪያ ንብረቶች፣ ጥያቄዎችና ማጽደቆች፣ ማረጋገጫና የጥገና ጥያቄዎች።',
      college: 'የኮሌጅ ንብረትና ኢንቬንተሪ እይታ፣ ጥያቄዎችና የዝውውር ሂደቶች።',
      finance: 'የፋይናንስና ግዢ ሂደቶች፣ የንብረት ዋጋና ተያያዥ ሪፖርቶች።',
      maintenance: 'የጥገና መዝገቦች፣ የአገልግሎት ጥያቄዎችና የጥገና ሂደቶች።',
      infrastructure: 'የመሠረተ ልማት ኢንቬንተሪ፣ ምደባዎች፣ ዝውውሮች፣ ጥገናና የሥራ ትዕዛዞች።'
    },
    helpTopics: [
      { id: 'help-getting-started', title: 'መጀመር', description: 'ከህዝባዊው ማሰሻ ግባ የሚለውን ይክፈቱ። ከገቡ በኋላ በሚናዎ የተወሰነውን ዳሽቦርድና የሚታየውን ማሰሻ ተጠቅመው ወደ ስራ ክፍሎች ይሂዱ።', icon: CircleHelp },
      { id: 'help-login', title: 'የመግቢያ እገዛ', description: 'የተመዘገበውን የተጠቃሚ ስም ወይም ኢሜይልና የይለፍ ቃል ይጠቀሙ። መግባት ካልቻሉ መረጃዎን ያረጋግጡ፤ መለያው ከተዘጋ ወይም ከታገደ አስተዳዳሪን ያነጋግሩ።', icon: LogIn },
      { id: 'help-assets', title: 'ንብረቶችና ኢንቬንተሪ', description: 'በሚናዎ የሚታየውን ዝርዝር ይፈልጉ ወይም ያጣሩ፤ ሁኔታን፣ ቦታን፣ ምደባንና የተመዘገቡ ዝርዝሮችን ለማየት መዝገቡን ይክፈቱ።', icon: Search },
      { id: 'help-workflows', title: 'የንብረት ሂደቶች', description: 'በሚና የተወሰኑ የምደባ፣ ዝውውር፣ ማረጋገጫና ጥገና ሂደቶችን ይጠቀሙ።', icon: Wrench },
      { id: 'help-reports', title: 'QR እና RFID', description: 'በQR መለያ ንብረትን ይፈልጉ፤ የRFID መለያና የስካን መዝገቦችን ይመልከቱ።', icon: QrCode },
      { id: 'help-roles', title: 'ሚናዎችና መዳረሻ', description: 'የሚና አቀራረብ ገጾችን እና የሚገኙ እርምጃዎችን ይረዱ።', icon: BookOpen }
    ],
    faqSections: [
      {
        id: 'help-getting-started',
        title: 'መጀመር',
        items: [
          { id: 'login-access', question: 'እንዴት እገባለሁ?', answer: 'ግባ የሚለውን ይምረጡና በመለያዎ የተመዘገበውን የተጠቃሚ ስም ወይም ኢሜይል እና የይለፍ ቃል ያስገቡ። ከገቡ በኋላ በሚናዎ የተወሰነው ዳሽቦርድ ይከፈታል። መግባት ካልቻሉ መረጃዎን ያረጋግጡ፤ መለያው ከተዘጋ ወይም ተደጋጋሚ የተሳሳተ ሙከራ ካለ አስተዳዳሪውን ያነጋግሩ።' },
          { id: 'page-visibility', question: 'ገጽ ወይም ድርጊት ለምን አይታየኝም?', answer: 'የሚታዩ ገጾች እና ድርጊቶች በተመደበው ሚና እና ፈቃድ ላይ የተመሠረቱ ናቸው።' }
        ]
      },
      {
        id: 'help-assets',
        title: 'ንብረቶችና ኢንቬንተሪ',
        items: [
          { id: 'register-asset', question: 'ንብረት እንዴት እመዘግባለሁ?', answer: 'ከዳሽቦርድዎ የንብረት መመዝገቢያ ሂደትን ይክፈቱ። አስተዳዳሪ፣ የICT ባለሙያና የመጋዘን ኃላፊን ጨምሮ የተፈቀዱ ሚናዎች ብቻ ንብረት መፍጠር ይችላሉ።' },
          { id: 'find-asset', question: 'ንብረትን እንዴት አገኛለሁ?', answer: 'በዳሽቦርድዎ ያለውን የንብረት ዝርዝር ወይም የኢንቬንተሪ ፍለጋ ይጠቀሙ። የሚገኙ ማጣሪያዎችን ተጠቅመው ተዛማጁን መዝገብ ይክፈቱ።' },
          { id: 'inventory-status', question: 'የኢንቬንተሪ ሁኔታን እንዴት አያለሁ?', answer: 'በሚናዎ የሚታየውን ኢንቬንተሪ ይፈልጉ፤ የተመዘገበውን ሁኔታ፣ ቦታና የምደባ ዝርዝር ለማየት የንብረት መዝገቡን ይክፈቱ። የኢንቬንተሪ እይታዎች በሚና ይለያያሉ።' },
          { id: 'assign-asset', question: 'ንብረትን እንዴት እመድባለሁ?', answer: 'የምደባ ሂደቱን ይክፈቱ፣ ንብረቱንና ብቁ ተጠቃሚውን ይምረጡና ቅጹን ይሙሉ። የምደባ መዳረሻ በሚናዎና በሂደቱ ይወሰናል።' }
        ]
      },
      {
        id: 'help-workflows',
        title: 'የንብረት ሂደቶች',
        items: [
          { id: 'transfer-asset', question: 'የዝውውር ጥያቄ እንዴት አቀርባለሁ?', answer: 'ከዳሽቦርድዎ ዝውውሮችን ይክፈቱና በሚናዎ የተፈቀደውን ሂደት ተጠቅመው ንብረቱን፣ መድረሻውንና ምክንያቱን ያስገቡ። ሁኔታውን ከዚያ ይከታተሉ።' },
          { id: 'verify-asset', question: 'ንብረትን እንዴት አረጋግጣለሁ?', answer: 'የኢንቬንተሪ ማረጋገጫ ሂደቱን ይክፈቱ፣ ክፍለ ማረጋገጫ ይጀምሩ ወይም ይቀጥሉ፣ ፍተሻውን ይመዝግቡና በሚናዎ እንደተፈቀደው ያስገቡ ወይም ያጠናቅቁ።' },
          { id: 'maintenance-issue', question: 'የጥገና ችግርን እንዴት እዘግባለሁ?', answer: 'ከዳሽቦርድዎ የሚገኘውን የጥገና ጥያቄ ሂደት ይጠቀሙ። የመምሪያ ተጠቃሚዎች ይህ ሂደት ሲኖር ጥያቄ ማቅረብ ይችላሉ፤ የጥገና ባለሙያዎች የአገልግሎት መዝገቦችን ያስተዳድራሉ።' },
          { id: 'return-asset', question: 'ንብረትን እንዴት እመልሳለሁ?', answer: 'በሚናዎ የሚገኘውን የመመለሻ ወይም የምደባ ሂደት ይክፈቱ። የመምሪያ ተጠቃሚዎች መመለሻ ጥያቄ ማቅረብ፣ የኮሌጅ አስተዳዳሪዎች መገምገም፣ የመጋዘን ኃላፊዎች መቀበልና መመርመር ይችላሉ።' },
          { id: 'dispose-asset', question: 'የንብረት ማስወገድ ጥያቄ እንዴት አቀርባለሁ?', answer: 'በሚናዎ የሚገኘውን የማስወገድ ሂደት ይክፈቱና ንብረቱንና ምክንያቱን ያስገቡ። ስርዓቱ ግምገማ፣ ማጽደቅ፣ መርሐግብር፣ ጡረታ ማውጣት፣ ማጠናቀቅና መሰረዝን ይደግፋል፤ የሚገኙ እርምጃዎች በሚና ይወሰናሉ።' }
        ]
      },
      {
        id: 'help-reports',
        title: 'ሪፖርቶችና ክትትል',
        items: [
          { id: 'rfid-lookup', question: 'QR ወይም RFID እንዴት እጠቀማለሁ?', answer: 'በንብረት መለያ ቁጥር የQR ፍለጋን በስርዓቱ ከገቡ በኋላ ይጠቀሙ። የRFID መለያና የስካን መዝገቦች በሶፍትዌር ይደገፋሉ፤ አካላዊ አንባቢ መቀናጀቱ ግን የተረጋገጠ አይደለም።' },
          { id: 'reset-password', question: 'የይለፍ ቃሌን እንዴት እመልሳለሁ?', answer: 'የይለፍ ቃል ረሳሁ የሚለውን ይምረጡና የተመዘገበውን ኢሜይል ያስገቡ። የኢሜይል መላኪያ ከተዋቀረ የመመለሻ አገናኙን ይከተሉ። በስልክ ኮድ መመለስ የሚሰራው የSMS መላኪያ ሲዋቀር ነው።' },
          { id: 'support-contact', question: 'ለድጋፍ ማንን ላነጋግር?', answer: 'ይፋዊ የኢሜይልና የስልክ ግንኙነት አልተዋቀረም፤ ይፋዊ መልዕክት መላክም አይገኝም። የግንኙነት ገጹን ይመልከቱ ወይም በተለመዱ የዩኒቨርሲቲ መንገዶች የስርዓቱን አስተዳዳሪ ያነጋግሩ።' }
        ]
      }
    ]
  };

  const filteredTopics = content.helpTopics.filter((topic) => {
    const haystack = `${topic.title} ${topic.description}`.toLowerCase();
    return matchesSearch(haystack);
  });

  const filteredFaqSections = content.faqSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = `${section.title} ${item.question} ${item.answer}`.toLowerCase();
        return matchesSearch(haystack);
      })
    }))
    .filter((section) => section.items.length > 0);

  const filteredRoles = Object.entries(content.roleDescriptions).filter(([id, description]) => {
    if (roleFilter !== 'all' && id !== roleFilter) return false;
    return matchesSearch(`${content.roleNames[id]} ${description}`);
  });

  const passwordHaystack = `${content.passwordTitle} ${content.passwordDescription} ${content.passwordSteps.join(' ')}`;
  const showPasswordSteps = matchesSearch(passwordHaystack);
  const hasNoResults = Boolean(normalizedQuery) && filteredTopics.length === 0 && filteredFaqSections.length === 0 && filteredRoles.length === 0 && !showPasswordSteps;

  return (
    <div className={`help-page${theme === 'dark' ? ' help-page-dark' : ''}`}>
      <style>{`
        .help-page {
          --help-primary: #123B63;
          --help-secondary: #1E5A8A;
          --help-accent: #D9A441;
          --help-bg: #F5F8FC;
          --help-card: #FFFFFF;
          --help-text: #172033;
          --help-muted: #64748B;
          --help-border: #E2E8F0;
        }
        .help-page { --help-page-bg: var(--help-bg); --help-surface: var(--help-card); --help-text-main: var(--help-text); --help-text-soft: var(--help-muted); --help-outline: var(--help-border); --help-brand: var(--help-primary); --help-brand-alt: var(--help-secondary); --help-highlight: var(--help-accent); background: var(--help-page-bg); color: var(--help-text-main); min-height: 100%; }
        .help-page-dark { --help-page-bg: #0f172a; --help-surface: #111c2c; --help-text-main: #e2e8f0; --help-text-soft: #a7b3c7; --help-outline: rgba(148,163,184,0.22); --help-brand: #93c5fd; --help-brand-alt: #cbd5e1; --help-highlight: #f4c86b; --help-strong: #4ade80; }
        .help-page * { box-sizing: border-box; }
        .help-shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
        .help-hero { padding: 48px 0 42px; background: linear-gradient(135deg, rgba(18,59,99,0.08), rgba(30,90,138,0.06)); border-bottom: 1px solid var(--help-outline); }
        .help-hero-inner { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr); gap: 28px; align-items: center; }
        .help-hero-copy { max-width: 700px; }
        .help-hero-tag { margin: 0 0 12px; color: var(--help-brand); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .help-hero h1 { margin: 0; font-size: 2.8rem; line-height: 1.12; letter-spacing: 0; color: var(--help-text-main); }
        .help-hero h2 { margin: 8px 0 0; color: var(--help-brand-alt); font-size: 1.35rem; font-weight: 700; }
        .help-hero-description { margin: 18px 0 0; max-width: 640px; font-size: 1.05rem; line-height: 1.7; color: var(--help-text-soft); }
        .help-hero-visual { display: flex; justify-content: center; }
        .help-visual-card { display: grid; place-items: center; width: min(100%, 280px); height: 200px; border: 1px solid var(--help-outline); border-radius: 12px; background: linear-gradient(180deg, rgba(18,59,99,0.05), rgba(217,164,65,0.1)); }
        .help-visual-ring { display: grid; place-items: center; width: 140px; height: 140px; border: 1px solid rgba(18,59,99,0.15); border-radius: 50%; background: rgba(255,255,255,0.42); }
        .help-visual-ring svg { color: var(--help-brand); width: 52px; height: 52px; }
        .help-search-wrap { margin-top: 20px; background: var(--help-surface); border-radius: 8px; border: 1px solid var(--help-outline); display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; }
        .help-search-wrap:focus-within { border-color: var(--help-brand); box-shadow: 0 0 0 4px rgba(18,59,99,0.08); }
        .help-search-wrap svg { color: var(--help-brand-alt); flex-shrink: 0; }
        .help-search-wrap input { width: 100%; border: none; background: transparent; color: var(--help-text-main); font-size: 1rem; font-family: inherit; outline: none; }
        .help-search-wrap input::placeholder { color: var(--help-text-soft); }
        .help-search-clear { border: none; background: transparent; color: var(--help-brand-alt); font-weight: 700; cursor: pointer; padding: 8px 8px; border-radius: 8px; }
        .help-search-clear:hover, .help-search-clear:focus-visible { background: rgba(18,59,99,0.08); outline: none; }
        .help-body { padding: 32px 0 64px; }
        .help-section { margin-top: 32px; }
        .help-section:first-child { margin-top: 0; }
        .help-section-title { margin: 0 0 16px; font-size: 1.55rem; line-height: 1.3; }
        .help-quick-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 0 0 30px; }
        .help-quick-card { display: block; padding: 18px 16px; border: 1px solid var(--help-outline); border-radius: 8px; background: var(--help-surface); text-decoration: none; color: var(--help-text-main); }
        .help-quick-card:hover { border-color: var(--help-brand); }
        .help-quick-card:focus-visible { outline: 3px solid var(--help-highlight); outline-offset: 2px; }
        .help-quick-card > svg { color: var(--help-brand); }
        .help-quick-card strong { display: block; margin: 10px 0 6px; font-size: 0.96rem; }
        .help-quick-card span { display: inline-flex; align-items: center; gap: 6px; color: var(--help-brand); font-size: 0.84rem; font-weight: 700; }
        .help-topic-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
        .help-topic-card { display: flex; flex-direction: column; gap: 12px; min-height: 160px; padding: 18px; border: 1px solid var(--help-outline); border-radius: 8px; background: var(--help-surface); }
        .help-topic-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; background: rgba(18,59,99,0.08); color: var(--help-brand); }
        .help-topic-card h3 { margin: 0; font-size: 1.1rem; }
        .help-topic-card p { margin: 0; color: var(--help-text-soft); line-height: 1.6; font-size: 0.95rem; }
        .help-faq-wrap { display: grid; gap: 10px; }
        .help-faq-card { border: 1px solid var(--help-outline); border-radius: 8px; background: var(--help-surface); overflow: hidden; }
        .help-faq-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 18px; border: none; background: transparent; color: var(--help-text-main); text-align: left; font-size: 1rem; font-weight: 700; cursor: pointer; }
        .help-faq-button:hover, .help-faq-button:focus-visible { background: rgba(18,59,99,0.03); outline: 3px solid var(--help-highlight); outline-offset: -3px; }
        .help-faq-toggle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(217,164,65,0.14); color: var(--help-brand); flex-shrink: 0; font-size: 1.4rem; line-height: 1; }
        .help-faq-answer { padding: 0 18px 18px; color: var(--help-text-soft); line-height: 1.7; }
        .help-role-note { margin: 0 0 18px; color: var(--help-text-soft); line-height: 1.7; }
        .help-role-filter { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
        .help-role-filter button { border: 1px solid var(--help-outline); background: var(--help-surface); color: var(--help-text-main); border-radius: 6px; padding: 9px 14px; font-weight: 700; cursor: pointer; }
        .help-role-filter button.is-active, .help-role-filter button:hover { background: rgba(18,59,99,0.09); border-color: var(--help-brand); color: var(--help-brand); }
        .help-role-filter button:focus-visible { outline: 3px solid var(--help-highlight); outline-offset: 2px; }
        .help-role-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .help-role-card { display: flex; gap: 12px; width: 100%; padding: 16px; border: 1px solid var(--help-outline); border-radius: 8px; background: var(--help-surface); }
        .help-role-card svg { color: var(--help-highlight); flex-shrink: 0; margin-top: 2px; }
        .help-role-card strong { display: block; margin-bottom: 6px; }
        .help-role-card p { margin: 0; color: var(--help-text-soft); line-height: 1.6; }
        .help-support-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 36px; padding: 22px 24px; border: 1px solid var(--help-outline); border-left: 4px solid var(--help-highlight); border-radius: 8px; background: var(--help-surface); }
        .help-support-card h3 { margin: 0 0 6px; font-size: 1.3rem; }
        .help-support-card p { margin: 0; color: var(--help-text-soft); line-height: 1.7; }
        .help-support-link { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 10px; border: 1px solid var(--help-brand); background: var(--help-brand); color: #fff; text-decoration: none; font-weight: 700; }
        .help-support-link:hover, .help-support-link:focus-visible { filter: brightness(0.97); outline: none; }
        .help-empty-state { padding: 26px 18px; border: 1px dashed var(--help-outline); border-radius: 16px; background: var(--help-surface); text-align: center; }
        .help-empty-state svg { color: var(--help-highlight); }
        .help-empty-state h3 { margin: 10px 0 8px; font-size: 1.2rem; }
        .help-empty-state p { margin: 0; color: var(--help-text-soft); }
        .help-empty-state button { margin-top: 14px; border: none; background: transparent; color: var(--help-brand); font-size: 1rem; font-weight: 700; cursor: pointer; }
        .help-footer-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 22px; color: var(--help-brand); font-weight: 700; text-decoration: none; }
        @media (max-width: 980px) { .help-quick-grid, .help-topic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .help-hero-inner { grid-template-columns: 1fr; } .help-role-grid { grid-template-columns: 1fr; } .help-support-card { flex-direction: column; align-items: flex-start; } }
        @media (max-width: 640px) { .help-shell { width: min(100% - 24px, 1120px); } .help-hero { padding: 34px 0 30px; } .help-hero h1 { font-size: 2.2rem; } .help-quick-grid, .help-topic-grid { grid-template-columns: 1fr; } .help-search-wrap { min-height: 58px; } .help-support-card { padding: 18px; } }
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
          <h2 id="help-quick-title" className="help-section-title">{content.quickActionsTitle}</h2>
          <div className="help-quick-grid">
            {content.quickLinks.map((item) => (
              <Link key={item.id} to={item.href} className="help-quick-card">
                <item.icon size={22} aria-hidden="true" />
                <strong>{item.label}</strong>
                <span>{content.openAction} <ArrowRight size={14} aria-hidden="true" /></span>
              </Link>
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
                    <article key={topic.id} className="help-topic-card">
                      <div className="help-topic-icon"><Icon size={24} aria-hidden="true" /></div>
                      <h3>{topic.title}</h3>
                      <p>{topic.description}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            {showPasswordSteps && (
              <section className="help-section" aria-labelledby="help-password-title">
                <h2 id="help-password-title" className="help-section-title">{content.passwordTitle}</h2>
                <p className="help-role-note">{content.passwordDescription}</p>
                <ol className="help-password-steps">
                  {content.passwordSteps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                <Link to="/forgot-password" className="help-footer-link">{content.passwordAction} <ArrowRight size={16} aria-hidden="true" /></Link>
              </section>
            )}

            <section className="help-section" aria-labelledby="help-faq-title">
              <h2 id="help-faq-title" className="help-section-title">{content.faqTitle}</h2>
              <div className="help-faq-wrap">
                {filteredFaqSections.flatMap((section) => section.items).map((item) => {
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
            </section>

            <section className="help-section" aria-labelledby="help-role-title">
              <h2 id="help-role-title" className="help-section-title">{content.roleTitle}</h2>
              <p className="help-role-note">{content.roleIntro}</p>

              <div className="help-role-filter" role="group" aria-label={isEnglish ? 'Role filter' : 'የሚና ማጣሪያ'}>
                {content.roleLabels.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={roleFilter === id ? 'is-active' : ''}
                    aria-pressed={roleFilter === id}
                    onClick={() => setRoleFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="help-role-grid">
                {filteredRoles.map(([id, description]) => (
                  <div key={id} className="help-role-card">
                    <ShieldCheck size={20} aria-hidden="true" />
                    <div>
                      <strong>{content.roleNames[id]}</strong>
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
    </div>
  );
};

export default Help;