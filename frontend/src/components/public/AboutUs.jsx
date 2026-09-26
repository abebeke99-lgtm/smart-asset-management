import React from 'react';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Archive,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  UserRoundCog,
  Users,
  WalletCards,
  Wrench
} from 'lucide-react';

const AboutUs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const location = useLocation();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView?.({ block: 'start' });
  }, [location.hash]);

  const content = language === 'en' ? {
    eyebrow: 'About the system',
    title: 'University Asset Management System',
    intro: 'A shared system for recording university assets, following their lifecycle, and making ownership, location, status, and movement visible to authorized teams.',
    systemTitle: 'About the System',
    systemText: 'The University Asset Management System brings asset records and operational workflows into one place. It supports lifecycle management from registration and receiving through assignment, verification, maintenance, return, and disposal, with role-based access and records that support accountability.',
    purposeTitle: 'Our Purpose',
    purposeText: 'Help university teams accurately register and assign assets, track and transfer them between responsible units, verify inventory, manage maintenance and return or disposal workflows, and use reports to support accountable decisions.',
    benefitsTitle: 'Core Benefits',
    benefitsText: 'Shared records and role-specific workflows help teams coordinate asset responsibilities across the university.',
    benefits: [
      ['Centralized Asset Management', 'Keep asset records, status, and history together.', Database],
      ['Asset Tracking', 'Follow asset identifiers, locations, status, and movement.', MapPin],
      ['Accountability', 'Record assignments, transfers, verification, and activity history.', ShieldCheck],
      ['Department / College Coordination', 'Coordinate requests, approvals, and asset responsibilities across units.', Building2],
      ['Maintenance Management', 'Track service requests, work, status, and maintenance history.', Wrench],
      ['Financial Visibility', 'Review purchases, budgets, asset values, and depreciation records.', WalletCards],
      ['Reporting', 'Generate operational and financial reports from system records.', BarChart3]
    ],
    servicesTitle: 'Services',
    servicesText: 'Sign in to open a service. Pages and actions are limited by your assigned role and permissions.',
    serviceAction: 'View service',
    services: [
      ['Asset Management', 'Register assets and maintain their records, condition, ownership, and lifecycle history.', Package, '/ict/assets'],
      ['Inventory Management', 'Review university inventory, availability, stock, and recorded movements.', Database, '/store/inventory'],
      ['Asset Assignment', 'Assign assets to authorized users and responsible units.', UserRoundCog, '/ict/assignments'],
      ['Asset Transfer', 'Request, review, and record asset movement between units or locations.', ArrowLeftRight, '/store/transfers'],
      ['Asset Verification', 'Run scoped verification sessions and record asset findings.', ClipboardCheck, '/college/verification'],
      ['Maintenance Management', 'Track maintenance requests, inspections, work orders, and repairs.', Wrench, '/maintenance/requests'],
      ['Asset Returns', 'Request, approve, receive, and inspect returned assets.', ArrowRight, '/store/returns'],
      ['Financial Management', 'Manage purchasing, payments, asset valuation, depreciation, and financial reports.', WalletCards, '/finance/payments'],
      ['Reporting', 'Generate operational, asset, and financial reports from system records.', BarChart3, '/admin/reports'],
      ['Notifications', 'Review role-scoped notifications for system and asset activity.', Bell, '/ict/notifications'],
      ['RFID / QR', 'Register and look up assets using RFID tags or QR identifiers.', QrCode, '/ict/tracking']
    ],
    lifecycleTitle: 'Asset Lifecycle',
    lifecycleText: 'These stages are supported workflows, not a mandatory sequence; the available actions depend on the asset and your role.',
    lifecycle: [
      ['Registration', 'Create the asset record.', Package],
      ['Receiving', 'Record assets received into inventory.', ClipboardList],
      ['Assignment', 'Assign assets to a responsible person or unit.', UserRoundCog],
      ['Transfer', 'Record movement between units or locations.', ArrowLeftRight],
      ['Verification', 'Run and finalize inventory verification.', ClipboardCheck],
      ['Maintenance', 'Record service requests and maintenance work.', Wrench],
      ['Return', 'Process asset return workflows.', ArrowRight],
      ['Disposal', 'Review and process asset retirement or disposal.', Archive]
    ],
    rolesTitle: 'Supported Roles',
    rolesText: 'Access and responsibilities depend on each role’s configured permissions.',
    roles: [
      ['Admin', 'System-wide administration of users, roles, permissions, assets, settings, reports, and audit records.', UserRoundCog],
      ['Store Manager', 'Receiving, inventory, stock movements, issuing, returns, transfers, and verification.', Package],
      ['ICT Officer', 'ICT asset records, assignments, transfers, RFID tracking, maintenance, and reports.', QrCode],
      ['Department Head', 'Department-scoped assets, requests, approvals, verification, maintenance, returns, and reports.', Users],
      ['College Manager', 'College-scoped departments and assets, requests, approvals, verification, maintenance, and return reviews.', Building2],
      ['Finance', 'Financial records, invoices, payments, budgets, valuation, depreciation, and financial reports.', WalletCards],
      ['Maintenance', 'Maintenance requests, technician assignment, work-order status, and completion.', Wrench]
    ],
  } : {
    eyebrow: 'Системийн тухай',
    title: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
    intro: 'የዩኒቨርሲቲ ንብረቶችን ለመመዝገብ፣ የህይወት ዘመናቸውን ለመከታተል እና ባለቤትነታቸውን፣ ቦታቸውን፣ ሁኔታቸውንና እንቅስቃሴያቸውን ለተፈቀደላቸው ቡድኖች ግልጽ ለማድረግ የጋራ ስርዓት ነው።',
    systemTitle: 'ስለ ስርዓቱ',
    systemText: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት የንብረት መዝገቦችንና የስራ ሂደቶችን በአንድ ቦታ ያቀናጃል። ከምዝገባና መቀበል ጀምሮ እስከ ምደባ፣ ማረጋገጫ፣ ጥገና፣ መመለስና ማስወገድ ድረስ ያሉ የንብረት ህይወት ዘመን ሂደቶችን ይደግፋል። የሚና መዳረሻና ተጠያቂነትን የሚያግዙ መዝገቦችንም ያቀርባል።',
    purposeTitle: 'ዓላማችን',
    purposeText: 'የዩኒቨርሲቲ ቡድኖች ንብረቶችን በትክክል እንዲመዘግቡና እንዲመድቡ፣ በተጠያቂ ክፍሎች መካከል እንዲከታተሉና እንዲያስተላልፉ፣ ኢንቬንተሪን እንዲያረጋግጡ፣ ጥገናንና የመመለስ ወይም የማስወገድ ሂደቶችን እንዲያስተዳድሩ እና ሪፖርቶችን ለተጠያቂ ውሳኔ እንዲጠቀሙ መደገፍ ነው።',
    benefitsTitle: 'ዋና ጥቅሞች',
    benefitsText: 'የጋራ መዝገቦችና በሚና የተደራጁ የስራ ሂደቶች በዩኒቨርሲቲው ያሉ ቡድኖች ንብረትን በተቀናጀ መንገድ እንዲያስተዳድሩ ይረዳሉ።',
    benefits: [
      ['የተማከለ ንብረት አስተዳደር', 'የንብረት መዝገቦችን፣ ሁኔታንና ታሪክን በአንድ ቦታ ያቆዩ።', Database],
      ['የንብረት ክትትል', 'የንብረት መለያ፣ ቦታ፣ ሁኔታና እንቅስቃሴ ይከታተሉ።', MapPin],
      ['ተጠያቂነት', 'ምደባዎችን፣ ማስተላለፎችን፣ ማረጋገጫንና የእንቅስቃሴ ታሪክን ይመዝግቡ።', ShieldCheck],
      ['የክፍልና ኮሌጅ ቅንጅት', 'በክፍሎች መካከል ጥያቄዎችን፣ ማጽደቆችንና የንብረት ኃላፊነቶችን ያቀናጁ።', Building2],
      ['የጥገና አስተዳደር', 'የአገልግሎት ጥያቄዎችን፣ ስራዎችን፣ ሁኔታንና ታሪክን ይከታተሉ።', Wrench],
      ['የገንዘብ ግልጽነት', 'የግዢ፣ በጀት፣ የንብረት ዋጋና የዋጋ ቅነሳ መዝገቦችን ይመልከቱ።', WalletCards],
      ['ሪፖርቶች', 'ከስርዓቱ መዝገቦች የስራና የገንዘብ ሪፖርቶችን ያዘጋጁ።', BarChart3]
    ],
    servicesTitle: 'አገልግሎቶች',
    servicesText: 'አገልግሎቱን ለመክፈት ይግቡ። የሚታዩ ገጾችና ድርጊቶች በተመደበው ሚናና ፈቃድ ይወሰናሉ።',
    serviceAction: 'አገልግሎቱን ይመልከቱ',
    services: [
      ['የንብረት አስተዳደር', 'ንብረቶችን ይመዝግቡ፤ መረጃቸውን፣ ሁኔታቸውን፣ ኃላፊነታቸውንና ታሪካቸውን ያቆዩ።', Package, '/ict/assets'],
      ['የኢንቬንተሪ አስተዳደር', 'የዩኒቨርሲቲ ኢንቬንተሪን፣ መገኘትን፣ ክምችትንና እንቅስቃሴን ይከታተሉ።', Database, '/store/inventory'],
      ['የንብረት ምደባ', 'ንብረቶችን ለተፈቀዱ ተጠቃሚዎችና ኃላፊ ክፍሎች ይመድቡ።', UserRoundCog, '/ict/assignments'],
      ['የንብረት ዝውውር', 'በክፍሎች ወይም ቦታዎች መካከል የንብረት ዝውውርን ይጠይቁ፣ ይገምግሙና ይመዝግቡ።', ArrowLeftRight, '/store/transfers'],
      ['የንብረት ማረጋገጫ', 'በተፈቀደ ወሰን የማረጋገጫ ክፍል ይፍጠሩና ግኝቶችን ይመዝግቡ።', ClipboardCheck, '/college/verification'],
      ['የጥገና አስተዳደር', 'የጥገና ጥያቄዎችን፣ ምርመራዎችን፣ የስራ ትዕዛዞችንና ጥገናዎችን ይከታተሉ።', Wrench, '/maintenance/requests'],
      ['የንብረት መመለስ', 'የተመለሱ ንብረቶችን ይጠይቁ፣ ያጽድቁ፣ ይቀበሉና ይመርምሩ።', ArrowRight, '/store/returns'],
      ['የገንዘብ አስተዳደር', 'ግዢዎችን፣ ክፍያዎችን፣ የንብረት ዋጋን፣ የዋጋ ቅነሳንና ሪፖርቶችን ያስተዳድሩ።', WalletCards, '/finance/payments'],
      ['ሪፖርቶች', 'ከስርዓቱ መዝገቦች የስራ፣ የንብረትና የገንዘብ ሪፖርቶችን ያዘጋጁ።', BarChart3, '/admin/reports'],
      ['ማሳወቂያዎች', 'በሚናዎ የተወሰኑ የስርዓትና የንብረት እንቅስቃሴ ማሳወቂያዎችን ይመልከቱ።', Bell, '/ict/notifications'],
      ['RFID / QR', 'የRFID መለያዎችን ያገናኙ፤ በRFID ወይም QR መለያ ንብረቶችን ይፈልጉ።', QrCode, '/ict/tracking']
    ],
    lifecycleTitle: 'የንብረት ህይወት ዘመን',
    lifecycleText: 'እነዚህ የሚደገፉ የስራ ሂደቶች ናቸው፤ የግድ ቋሚ ቅደም ተከተል አይደሉም። የሚፈቀዱ ድርጊቶች በንብረቱና በሚናዎ ይወሰናሉ።',
    lifecycle: [
      ['ምዝገባ', 'የንብረት መዝገብ ይፍጠሩ።', Package],
      ['መቀበል', 'ወደ ኢንቬንተሪ የገቡ ንብረቶችን ይመዝግቡ።', ClipboardList],
      ['ምደባ', 'ንብረትን ለተጠያቂ ሰው ወይም ክፍል ይመድቡ።', UserRoundCog],
      ['ማስተላለፍ', 'በክፍሎች ወይም ቦታዎች መካከል ያለውን እንቅስቃሴ ይመዝግቡ።', ArrowLeftRight],
      ['ማረጋገጫ', 'የኢንቬንተሪ ማረጋገጫ ይፍጠሩና ያጠናቅቁ።', ClipboardCheck],
      ['ጥገና', 'የአገልግሎት ጥያቄዎችንና የጥገና ስራዎችን ይመዝግቡ።', Wrench],
      ['መመለስ', 'የንብረት መመለሻ ሂደቶችን ያከናውኑ።', ArrowRight],
      ['ማስወገድ', 'የንብረት ጡረታ ወይም ማስወገድን ይገምግሙና ይመዝግቡ።', Archive]
    ],
    rolesTitle: 'የሚደገፉ ሚናዎች',
    rolesText: 'የመዳረሻና የስራ ኃላፊነቶች በእያንዳንዱ ሚና ፈቃድ መሰረት ይለያያሉ።',
    roles: [
      ['አስተዳዳሪ', 'ተጠቃሚዎችን፣ ሚናዎችን፣ ፈቃዶችን፣ ንብረቶችን፣ ቅንብሮችን፣ ሪፖርቶችንና የኦዲት መዝገቦችን በስርዓት ደረጃ ያስተዳድራል።', UserRoundCog],
      ['የመጋዘን አስተዳዳሪ', 'መቀበልን፣ ኢንቬንተሪን፣ የክምችት እንቅስቃሴን፣ ማውጣትን፣ መመለስን፣ ዝውውርንና ማረጋገጫን ያስተዳድራል።', Package],
      ['የICT ባለሙያ', 'የICT ንብረት መዝገቦችን፣ ምደባን፣ ዝውውርን፣ RFID ክትትልን፣ ጥገናንና ሪፖርቶችን ያስተዳድራል።', QrCode],
      ['የመምሪያ ኃላፊ', 'በመምሪያ ወሰን ያሉ ንብረቶችን፣ ጥያቄዎችን፣ ማጽደቆችን፣ ማረጋገጫን፣ ጥገናንና መመለስን ያስተባብራል።', Users],
      ['የኮሌጅ አስተዳዳሪ', 'በኮሌጅ ወሰን ያሉ ክፍሎችና ንብረቶችን፣ ጥያቄዎችን፣ ማጽደቆችን፣ ማረጋገጫንና የመመለስ ግምገማን ያስተዳድራል።', Building2],
      ['ፋይናንስ', 'የገንዘብ መዝገቦችን፣ ክፍያዎችን፣ በጀቶችን፣ የንብረት ዋጋን፣ የዋጋ ቅነሳንና ሪፖርቶችን ያስተዳድራል።', WalletCards],
      ['ጥገና', 'የጥገና ጥያቄዎችን፣ ቴክኒሻን መመደብን፣ የስራ ትዕዛዝ ሁኔታንና ማጠናቀቅን ያስተዳድራል።', Wrench]
    ],
  };

  const featureCatalog = language === 'en' ? {
    title: 'What the System Supports',
    intro: 'Capabilities currently backed by application routes, data records, and role-scoped workflows.',
    detailLabel: 'Implemented capability',
    items: [
      ['Asset Registration', 'Create and update university asset records.', 'Asset code, serial number, category, location, condition, and status are stored on asset records.', Package],
      ['Asset Receiving', 'Record assets received into store inventory.', 'Store Manager receipt records and stock movements.', ClipboardList],
      ['Asset Inventory', 'Search and review current asset records.', 'Search supports name, asset code, serial number, RFID tag, department, and location.', Database],
      ['Asset Assignment', 'Assign an asset to an active user and record responsibility.', 'Assignment records can include department and location details.', UserRoundCog],
      ['Asset Transfer', 'Request, review, and track asset movement.', 'Transfer records include approval states, source and destination, and completion status.', ArrowLeftRight],
      ['Asset Verification', 'Run inventory verification sessions and record findings.', 'Authorized sessions support item capture, submission, and finalization.', ClipboardCheck],
      ['Maintenance', 'Create maintenance requests and follow work status.', 'Workflows support status changes, technician assignment, approvals, and completion.', Wrench],
      ['Asset Returns', 'Track return requests through receipt and inspection.', 'Department requests, college reviews, and store receiving/inspection workflows.', ArrowRight],
      ['Disposal', 'Process an asset disposal request through its workflow.', 'Review, approve or reject, schedule, retire, and execute disposal actions.', Archive],
      ['Financial Management', 'Maintain financial records and review asset values.', 'Finance routes cover invoices, payments, budgets, valuation, depreciation, and reports.', WalletCards],
      ['RFID / QR', 'Link RFID tags, record scans, and look up assets by QR identifier.', 'Asset tag linking, RFID logs/devices, and QR lookup are implemented.', QrCode],
      ['Reports', 'Generate and review operational and financial reports.', 'Available reports, filters, and exports depend on the signed-in role.', BarChart3],
      ['Notifications', 'View role-scoped notifications and read status.', 'The API provides filtered lists, unread counts, and mark-as-read actions.', Bell],
      ['Audit Logs', 'Review recorded administrative and financial activity.', 'Administrative audit viewing is Admin-only; finance audit views require Finance or Admin.', Activity],
      ['Authentication & RBAC', 'Protect workflows with signed-in access and role checks.', 'Backend routes enforce authentication and role and organization-scope restrictions.', ShieldCheck]
    ]
  } : {
    title: 'ስርዓቱ የሚደገፈው ነገር',
    intro: 'ከታች ያሉት ተግባራት በአሁኑ API route፣ የውሂብ መዝገቦችና በሚና የተገደቡ የስራ ሂደቶች የተደገፉ ናቸው።',
    detailLabel: 'የተተገበረ ተግባር',
    items: [
      ['የንብረት ምዝገባ', 'የዩኒቨርሲቲ ንብረት መዝገቦችን ይፍጠሩና ያዘምኑ።', 'የንብረት ኮድ፣ ተከታታይ ቁጥር፣ ምድብ፣ ቦታ፣ ሁኔታና የአሁኑ ሁኔታ በመዝገቡ ይቀመጣሉ።', Package],
      ['የንብረት መቀበል', 'ወደ መጋዘን ኢንቬንተሪ የገቡ ንብረቶችን ይመዝግቡ።', 'የመጋዘን አስተዳዳሪ ደረሰኞችና የክምችት እንቅስቃሴዎች።', ClipboardList],
      ['የንብረት ኢንቬንተሪ', 'ወቅታዊ የንብረት መዝገቦችን ይፈልጉና ይመልከቱ።', 'በስም፣ ኮድ፣ ተከታታይ ቁጥር፣ RFID መለያ፣ ክፍልና ቦታ መፈለግ ይቻላል።', Database],
      ['የንብረት ምደባ', 'ንብረትን ለንቁ ተጠቃሚ መድበው ኃላፊነቱን ይመዝግቡ።', 'የምደባ መዝገብ የክፍልና የቦታ መረጃን ሊይዝ ይችላል።', UserRoundCog],
      ['የንብረት ማስተላለፍ', 'የንብረት እንቅስቃሴን ይጠይቁ፣ ይገምግሙና ይከታተሉ።', 'የማስተላለፍ መዝገቦች የማጽደቅ ሁኔታ፣ መነሻ፣ መድረሻና የማጠናቀቅ ሁኔታ ይይዛሉ።', ArrowLeftRight],
      ['የንብረት ማረጋገጫ', 'የኢንቬንተሪ ማረጋገጫ ክፍለ ጊዜ ይፍጠሩና ግኝቶችን ይመዝግቡ።', 'በተፈቀደ ወሰን ውስጥ ንጥሎችን ማስገባት፣ ማስገባትና ማጠናቀቅ።', ClipboardCheck],
      ['ጥገና', 'የጥገና ጥያቄዎችንና ስራዎችን ይፍጠሩ፣ ሁኔታቸውንም ይከታተሉ።', 'የሁኔታ ለውጥ፣ ቴክኒሻን መመደብ፣ ማጽደቅና ማጠናቀቅ።', Wrench],
      ['የንብረት መመለስ', 'የመመለስ ጥያቄዎችን ከመቀበልና ከምርመራ ጋር ይከታተሉ።', 'የመምሪያ ጥያቄ፣ የኮሌጅ ግምገማ፣ የመጋዘን መቀበልና ምርመራ።', ArrowRight],
      ['ማስወገድ', 'የንብረት ማስወገድ ጥያቄን በስራ ሂደቱ ያስኬዱ።', 'መገምገም፣ ማጽደቅ/መከልከል፣ ማቀድ፣ ጡረታ ማውጣትና ማስፈጸም።', Archive],
      ['የገንዘብ አስተዳደር', 'የገንዘብ መዝገቦችን ያቆዩና የንብረት ዋጋን ይመልከቱ።', 'የገንዘብ መዝገቦች፣ ደረሰኞች፣ ክፍያዎች፣ በጀቶች፣ ዋጋ፣ የዋጋ ቅነሳና ሪፖርቶች።', WalletCards],
      ['RFID / QR', 'የRFID መለያዎችን ያገናኙ፣ ስካን ይመዝግቡና በQR ንብረት ይፈልጉ።', 'የመለያ ማገናኘት፣ RFID መዝገቦች/መሳሪያዎችና QR ፍለጋ።', QrCode],
      ['ሪፖርቶች', 'የስራና የገንዘብ ሪፖርቶችን ያዘጋጁና ይመልከቱ።', 'የሚታዩ ሪፖርቶች፣ ማጣሪያዎችና ወደ ውጭ ማውጣት በተጠቃሚው ሚና ይወሰናሉ።', BarChart3],
      ['ማሳወቂያዎች', 'በሚና የተገደቡ ማሳወቂያዎችንና የንባብ ሁኔታን ይመልከቱ።', 'የተጣሩ ዝርዝሮች፣ ያልተነበቡ ብዛቶችና እንደተነበበ ማድረግ።', Bell],
      ['የኦዲት መዝገቦች', 'የተመዘገቡ የአስተዳደርና የገንዘብ እንቅስቃሴዎችን ይመልከቱ።', 'የአስተዳደር ኦዲት ለAdmin ብቻ፤ የገንዘብ ኦዲት ለFinance ወይም Admin።', Activity],
      ['መግቢያና የሚና ፈቃድ', 'የተጠበቁ የስራ ሂደቶችን በተፈቀደ መለያ ይጠቀሙ።', 'Backend የተጠበቁ route-ዎች ነባርነትን፣ ሚናንና የድርጅት ወሰንን ያረጋግጣሉ።', ShieldCheck]
    ]
  };

  return (
    <main className={`about-page${isDark ? ' about-page-dark' : ''}`}>
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-container about-hero-grid">
          <div>
            <span className="about-eyebrow">About Us</span>
            <h1 id="about-title">Mekdela Amba University</h1>
            <h2 className="about-subtitle">University Asset Management System</h2>
            <h3 className="about-lead">About Us</h3>
            <p className="about-description">{content.intro}</p>
          </div>
          <div className="about-hero-mark" aria-hidden="true"><Database size={52} strokeWidth={1.5} /></div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-system-title">
        <div className="about-container about-purpose-grid">
          <div className="about-section-heading"><span className="about-eyebrow">01</span><h2 id="about-system-title">{content.systemTitle}</h2></div>
          <p className="about-purpose-text">{content.systemText}</p>
        </div>
      </section>

      <section className="about-section about-purpose-band" aria-labelledby="about-purpose-title">
        <div className="about-container about-purpose-content">
          <div className="about-section-heading"><span className="about-eyebrow">02</span><h2 id="about-purpose-title">{content.purposeTitle}</h2></div>
          <p>{content.purposeText}</p>
        </div>
      </section>

      <section id="services" className="about-section about-capabilities" aria-labelledby="about-benefits-title">
        <div className="about-container">
          <div className="about-section-heading"><span className="about-eyebrow">03</span><h2 id="about-benefits-title">{content.benefitsTitle}</h2><p>{content.benefitsText}</p></div>
          <div className="about-service-grid">
            {content.benefits.map(([title, text, Icon]) => <article className="about-service-card" key={title}><span className="about-card-icon"><Icon size={22} aria-hidden="true" /></span><div className="about-service-copy"><strong>{title}</strong><small>{text}</small></div></article>)}
          </div>
        </div>
      </section>

      <section id="lifecycle" className="about-section" aria-labelledby="about-lifecycle-title">
        <div className="about-container">
          <div className="about-section-heading"><span className="about-eyebrow">04</span><h2 id="about-lifecycle-title">{content.lifecycleTitle}</h2><p>{content.lifecycleText}</p></div>
          <ol className="about-lifecycle-grid">
            {content.lifecycle.map(([title, text, Icon]) => <li className="about-lifecycle-step" key={title}><span className="about-card-icon"><Icon size={20} aria-hidden="true" /></span><strong>{title}</strong><small>{text}</small></li>)}
          </ol>
        </div>
      </section>

      <section className="about-section about-capabilities" aria-labelledby="about-roles-title">
        <div className="about-container">
          <div className="about-section-heading"><span className="about-eyebrow">05</span><h2 id="about-roles-title">{content.rolesTitle}</h2><p>{content.rolesText}</p></div>
          <div className="about-role-grid">
            {content.roles.map(([title, text, Icon]) => <article className="about-role-card" key={title}><Icon size={22} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section id="features" className="about-section" aria-labelledby="about-features-title">
        <div className="about-container">
          <div className="about-section-heading"><span className="about-eyebrow">06</span><h2 id="about-features-title">{featureCatalog.title}</h2><p>{featureCatalog.intro}</p></div>
          <div className="about-service-grid">
            {featureCatalog.items.map(([title, text, detail, Icon]) => <article className="about-service-card about-feature-card" key={title}><span className="about-card-icon"><Icon size={22} aria-hidden="true" /></span><div className="about-service-copy"><strong>{title}</strong><small>{text}</small></div><p className="about-feature-detail"><strong>{featureCatalog.detailLabel}</strong>{detail}</p></article>)}
          </div>
        </div>
      </section>

      <style>{`
        .about-page { --about-bg: #f5f7f9; --about-surface: #ffffff; --about-muted: #52606d; --about-text: #17212b; --about-border: #d7dee5; --about-accent: #536575; background: var(--about-bg); color: var(--about-text); }
        .about-page-dark { --about-bg: #0f172a; --about-surface: #111827; --about-muted: #cbd5e1; --about-text: #e2e8f0; --about-border: rgba(148, 163, 184, .2); --about-accent: #93c5fd; }
        .about-container { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
        .about-hero { padding: clamp(64px, 9vw, 112px) 0; background: var(--about-surface); border-bottom: 1px solid var(--about-border); }
        .about-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 48px; align-items: center; }
        .about-eyebrow { display: inline-block; margin-bottom: 14px; color: var(--about-accent); font-size: .74rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .about-hero h1 { max-width: 760px; margin: 0; font-size: clamp(2.5rem, 6vw, 5rem); line-height: 1.03; letter-spacing: -.045em; }
        .about-lead { max-width: 690px; margin: 24px 0 0; color: var(--about-muted); font-size: 1.15rem; line-height: 1.75; }
        .about-hero-mark { display: grid; place-items: center; width: 180px; height: 180px; justify-self: end; border: 1px solid var(--about-border); border-radius: 24px; color: var(--about-accent); background: var(--about-bg); }
        .about-section { padding: 84px 0; }
        .about-section[id] { scroll-margin-top: calc(var(--public-header-height) + 16px); }
        .about-purpose-grid { display: grid; grid-template-columns: minmax(220px, .7fr) minmax(0, 1.3fr); gap: 60px; align-items: start; }
        .about-section-heading { max-width: 700px; }
        .about-section-heading h2 { margin: 0 0 14px; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.12; letter-spacing: -.035em; }
        .about-section-heading p, .about-purpose-text { margin: 0; color: var(--about-muted); line-height: 1.75; }
        .about-purpose-text { padding-top: 30px; font-size: 1.18rem; }
        .about-capabilities { background: var(--about-surface); border-top: 1px solid var(--about-border); border-bottom: 1px solid var(--about-border); }
        .about-service-grid, .about-role-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 36px; }
        .about-service-card, .about-role-card { display: flex; min-width: 0; min-height: 230px; flex-direction: column; align-items: flex-start; gap: 16px; padding: 22px; border: 1px solid var(--about-border); border-radius: 8px; background: var(--about-bg); color: var(--about-text); }
        .about-role-card { min-height: 172px; flex-direction: row; }
        .about-service-card:hover, .about-role-card:hover { border-color: var(--about-accent); }
        .about-card-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; border-radius: 8px; color: var(--about-accent); background: color-mix(in srgb, var(--about-accent) 14%, transparent); }
        .about-service-copy strong, .about-service-copy small { display: block; }
        .about-service-copy strong { margin-bottom: 8px; font-size: 1rem; }
        .about-service-copy small { color: var(--about-muted); font-size: .88rem; line-height: 1.55; }
        .about-feature-card { min-height: 250px; }
        .about-feature-detail { margin: auto 0 0; padding-top: 14px; border-top: 1px solid var(--about-border); color: var(--about-muted); font-size: .82rem; line-height: 1.55; }
        .about-feature-detail strong { display: block; margin-bottom: 5px; color: var(--about-text); font-size: .76rem; }
        .about-role-card > svg { flex: 0 0 auto; color: var(--about-accent); }
        .about-role-card h3 { margin: 0 0 8px; font-size: 1rem; }
        .about-role-card p { margin: 0; color: var(--about-muted); font-size: .9rem; line-height: 1.55; }
        .about-lifecycle-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 36px 0 0; padding: 0; list-style: none; counter-reset: lifecycle; }
        .about-lifecycle-step { display: flex; min-width: 0; min-height: 170px; flex-direction: column; align-items: flex-start; gap: 12px; padding: 20px; border: 1px solid var(--about-border); border-radius: 8px; background: var(--about-surface); }
        .about-lifecycle-step::before { counter-increment: lifecycle; content: counter(lifecycle, decimal-leading-zero); color: var(--about-accent); font-size: .74rem; font-weight: 800; }
        .about-lifecycle-step strong { font-size: .98rem; }
        .about-lifecycle-step small { color: var(--about-muted); font-size: .86rem; line-height: 1.5; }
        .about-purpose-band { padding: 64px 0; background: #e9eef2; }
        .about-page-dark .about-purpose-band { background: #1e293b; }
        .about-purpose-content { display: grid; grid-template-columns: minmax(220px, .7fr) minmax(0, 1.3fr); gap: 60px; align-items: center; }
        .about-purpose-content p { margin: 0; color: var(--about-muted); font-size: 1.15rem; line-height: 1.75; }
        @media (max-width: 900px) { .about-hero-grid, .about-purpose-grid, .about-purpose-content { grid-template-columns: 1fr; gap: 24px; } .about-hero-mark { justify-self: start; width: 120px; height: 120px; } .about-service-grid, .about-role-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .about-lifecycle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .about-container { width: min(100% - 28px, 1120px); } .about-hero { padding: 56px 0 64px; } .about-section { padding: 60px 0; } .about-service-grid, .about-role-grid, .about-lifecycle-grid { grid-template-columns: 1fr; } .about-service-card, .about-role-card, .about-lifecycle-step { min-height: 0; } }
      `}</style>
    </main>
  );
};

export default AboutUs;
