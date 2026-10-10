import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  ArrowRightLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FilePlus2,
  ImageOff,
  QrCode,
  Radio,
  UserCheck,
  Wrench,
  X
} from 'lucide-react';

const servicesByLanguage = {
  en: {
    systemTitle: 'University Asset Management System',
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
        to: '/ict/inventory',
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
        to: '/admin/rfid',
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
    systemTitle: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት',
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
        to: '/ict/inventory',
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
        to: '/admin/rfid',
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

const serviceMedia = [
  {
    src: '/images/assets/asset-registration.jpg',
    alt: {
      en: 'Asset registration form and image preview',
      am: 'የንብረት ምዝገባ ቅጽና የምስል ቅድመ እይታ'
    }
  },
  {
    src: '/images/hero/imagefs.jpg',
    alt: {
      en: 'Shelves of organized books and materials in a university library',
      am: 'በዩኒቨርሲቲ ቤተ-መጻሕፍት የተደራጁ መደርደሪያዎች'
    }
  },
  {
    src: '/images/workflow/asset-workflow.svg',
    alt: {
      en: 'Illustration of an asset assignment workflow',
      am: 'የንብረት ምደባ የሥራ ሂደት ምሳሌ'
    }
  },
  {
    src: '/images/assets/asset-transfer.svg',
    alt: {
      en: 'Illustration of tagged university equipment moving between buildings',
      am: 'መለያ ያለው የዩኒቨርሲቲ መሳሪያ በሕንፃዎች መካከል ሲዘዋወር የሚያሳይ ምሳሌ'
    }
  },
  {
    src: '/images/maintenance/maintenance-management.svg',
    alt: {
      en: 'Illustration of equipment maintenance and repair records',
      am: 'የመሳሪያ ጥገናና የጥገና መዝገቦች ምሳሌ'
    }
  },
  {
    src: '/images/technology/rfid-tracking.svg',
    alt: {
      en: 'Illustration of QR and RFID asset identification',
      am: 'የQR እና RFID ንብረት መለያ ምሳሌ'
    }
  },
  {
    src: '/images/security/asset-security.svg',
    alt: {
      en: 'Illustration of a verified asset checklist and records',
      am: 'የተረጋገጠ የንብረት ዝርዝርና መዝገቦች ምሳሌ'
    }
  },
  {
    src: '/images/analytics/asset-analytics.svg',
    alt: {
      en: 'Illustration of asset analytics charts and reporting cards',
      am: 'የንብረት ትንታኔ ገበታዎችና ሪፖርት ካርዶች ምሳሌ'
    }
  }
];

const serviceDetails = {
  en: {
    viewDetails: 'View Details',
    close: 'Close service details',
    featuresHeading: 'What you can do',
    openService: 'Open Service',
    features: [
      [
        'Create and manage university asset records.',
        'Record asset identifiers, category, serial number, quantity, purchase details, and condition where provided.',
        'Associate assets with available campus, college, department, building, room, and location records.',
        'Review warranty, supplier, purchase cost, and supporting-document information when recorded.',
        'Use the system-issued asset identifier and available QR-code tools to identify records.'
      ],
      [
        'Review listed inventory items and their recorded quantities.',
        'Identify low-stock or unavailable items where the inventory view provides stock thresholds.',
        'Review recorded stock movements and inventory changes.',
        'Use available category, department, or location filters in the relevant inventory view.',
        'Use the available inventory summaries and reports to support stock control.'
      ],
      [
        'Assign available assets to authorized users through the assignment workflow.',
        'Record the recipient and available department or location details.',
        'Review who is currently responsible for an assigned asset.',
        'Check assignment and return history recorded for the asset.',
        'The application applies its existing availability and permission checks.'
      ],
      [
        'Create transfer requests for assets moving between supported departments or locations.',
        'Record source and destination details in the transfer form.',
        'Review transfer requests and approval status according to existing permissions.',
        'Track request status and recorded movement history.',
        'Keep transfer activity in the application’s existing asset records.'
      ],
      [
        'Submit and review maintenance requests for university assets.',
        'Record reported problems and review inspection or repair notes where available.',
        'Monitor request status and technician assignment when included in the work order.',
        'Use scheduled or preventive maintenance functions where enabled for the role.',
        'Review the maintenance history recorded for an asset.'
      ],
      [
        'Identify assets using QR codes and the application’s supported RFID workflows.',
        'Look up asset records with the available camera scanner or manual identifier entry.',
        'Generate, print, or download QR codes where the asset tools provide those actions.',
        'Record and review scan or movement activity supported by the tracking page.',
        'RFID reader hardware capabilities depend on the configured equipment and workflow.'
      ],
      [
        'Compare physical assets with the records available to the verification workflow.',
        'Confirm asset identifiers, condition, and recorded location during a check.',
        'Record missing, misplaced, damaged, or mismatched items where the workflow allows.',
        'Attach findings or evidence when supported by the verification form.',
        'Review verification results and follow-up records available to your role.'
      ],
      [
        'Review asset totals, conditions, categories, and distribution in available reports.',
        'Analyze inventory and assignment information exposed by the selected report.',
        'Review maintenance activity and asset lifecycle information where reported.',
        'Apply the filters offered by each report, such as date or organization.',
        'Use supported summaries and trends to inform management decisions.'
      ]
    ]
  },
  am: {
    viewDetails: 'ዝርዝር ይመልከቱ',
    close: 'የአገልግሎት ዝርዝር ዝጋ',
    featuresHeading: 'ማከናወን የሚችሉት',
    openService: 'አገልግሎቱን ክፈት',
    features: [
      [
        'የዩኒቨርሲቲ ንብረት መዝገቦችን ይፍጠሩና ያስተዳድሩ።',
        'በቅጹ የሚገኙትን የንብረት መለያ፣ ምድብ፣ ተከታታይ ቁጥር፣ ብዛት፣ የግዢ ዝርዝርና ሁኔታ ይመዝግቡ።',
        'ንብረቶችን ከሚገኙ የካምፓስ፣ ኮሌጅ፣ ዲፓርትመንት፣ ሕንፃ፣ ክፍልና ቦታ መዝገቦች ጋር ያገናኙ።',
        'በመዝገብ ውስጥ ያሉ የዋስትና፣ አቅራቢ፣ የግዢ ወጪና ደጋፊ ሰነድ መረጃዎችን ይመልከቱ።',
        'መዝገቦችን ለመለየት በስርዓቱ የተሰጠውን የንብረት መለያና ያሉ የQR ኮድ መሳሪያዎችን ይጠቀሙ።'
      ],
      [
        'የተመዘገቡ የኢንቬንተሪ ዕቃዎችንና ብዛታቸውን ይመልከቱ።',
        'የክምችት ገደብ በኢንቬንተሪ ገጹ ሲኖር ዝቅተኛ ወይም የሌለ ክምችት ያላቸውን ይለዩ።',
        'የተመዘገቡ የክምችት እንቅስቃሴዎችንና ለውጦችን ይከታተሉ።',
        'በተዛማጅ የኢንቬንተሪ ገጽ ያሉ የምድብ፣ ዲፓርትመንት ወይም ቦታ ማጣሪያዎችን ይጠቀሙ።',
        'ያሉትን የኢንቬንተሪ ማጠቃለያዎችና ሪፖርቶች ለክምችት ቁጥጥር ይጠቀሙ።'
      ],
      [
        'በምደባ ሂደቱ የተፈቀደ ተጠቃሚ ላይ ያለ ንብረት ይመድቡ።',
        'ተቀባዩንና በሂደቱ የሚገኙ የዲፓርትመንት ወይም የቦታ ዝርዝሮችን ይመዝግቡ።',
        'ለተመደበ ንብረት በአሁኑ ጊዜ ኃላፊነት የወሰደውን ሰው ይመልከቱ።',
        'ለንብረቱ የተመዘገቡ የምደባና የመመለስ ታሪኮችን ይከታተሉ።',
        'መተግበሪያው ያሉትን የንብረት ተገኝነትና የፈቃድ ማረጋገጫዎች ይተገብራል።'
      ],
      [
        'ንብረቶች በሚደገፉ ዲፓርትመንቶች ወይም ቦታዎች መካከል እንዲዘዋወሩ ጥያቄ ያቅርቡ።',
        'በዝውውር ቅጹ የመነሻና መድረሻ ዝርዝሮችን ይመዝግቡ።',
        'በነባሩ ፈቃድ መሠረት የዝውውር ጥያቄዎችንና የማጽደቅ ሁኔታን ይመልከቱ።',
        'የጥያቄውን ሁኔታና የተመዘገበውን የእንቅስቃሴ ታሪክ ይከታተሉ።',
        'የዝውውር እንቅስቃሴዎችን በነባር የንብረት መዝገቦች ውስጥ ያስቀምጡ።'
      ],
      [
        'ለዩኒቨርሲቲ ንብረቶች የጥገና ጥያቄዎችን ያቅርቡና ይመልከቱ።',
        'በሚገኝበት ጊዜ የተነገሩ ችግሮችን፣ የምርመራ ወይም የጥገና ማስታወሻዎችን ይመዝግቡ።',
        'በየሥራ ትዕዛዙ የሚካተቱ የጥያቄ ሁኔታና የቴክኒሻን ምደባ ይከታተሉ።',
        'ለእርስዎ ሚና ሲነቃ የታቀደ ወይም መከላከያ ጥገና ተግባራትን ይጠቀሙ።',
        'ለንብረቱ የተመዘገበውን የጥገና ታሪክ ይመልከቱ።'
      ],
      [
        'ንብረቶችን በQR ኮድና በመተግበሪያው የሚደገፉ የRFID ሂደቶች ይለዩ።',
        'በሚገኘው የካሜራ ስካነር ወይም በእጅ ቁጥር በማስገባት የንብረት መዝገብ ይፈልጉ።',
        'የንብረት መሳሪያዎቹ ሲደግፉ የQR ኮዶችን ይፍጠሩ፣ ያትሙ ወይም ያውርዱ።',
        'በክትትል ገጹ የሚደገፉ የስካን ወይም የእንቅስቃሴ መዝገቦችን ይመልከቱ።',
        'የRFID አንባቢ መሳሪያ ችሎታ በተዋቀረው መሳሪያና የሥራ ሂደት ላይ ይመረኮዛል።'
      ],
      [
        'አካላዊ ንብረቶችን ከማረጋገጫ ሂደቱ ከሚገኙ መዝገቦች ጋር ያወዳድሩ።',
        'በማረጋገጫ ጊዜ የንብረት መለያ፣ ሁኔታና የተመዘገበ ቦታ ያረጋግጡ።',
        'ሂደቱ ሲፈቅድ የጠፉ፣ የተሳሳቱ ቦታ ያሉ፣ የተጎዱ ወይም የማይዛመዱ ንብረቶችን ይመዝግቡ።',
        'የማረጋገጫ ቅጹ ሲደግፍ ግኝቶችን ወይም ማስረጃዎችን ያያይዙ።',
        'ለሚናዎ የሚገኙ የማረጋገጫ ውጤቶችንና የክትትል መዝገቦችን ይመልከቱ።'
      ],
      [
        'በሚገኙ ሪፖርቶች ውስጥ የንብረት ድምር፣ ሁኔታ፣ ምድብና ስርጭት ይመልከቱ።',
        'በተመረጠው ሪፖርት የሚታየውን የኢንቬንተሪና የምደባ መረጃ ይተንትኑ።',
        'በሪፖርት ውስጥ የቀረበ የጥገና እንቅስቃሴና የንብረት የሕይወት ዑደት መረጃ ይመልከቱ።',
        'እንደ ቀን ወይም ድርጅታዊ ክፍል ያሉ በእያንዳንዱ ሪፖርት የሚቀርቡ ማጣሪያዎችን ይጠቀሙ።',
        'የአስተዳደር ውሳኔዎችን ለመደገፍ የሚገኙ ማጠቃለያዎችንና አዝማሚያዎችን ይጠቀሙ።'
      ]
    ]
  }
};

const ServiceImage = ({ service, imageAlt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} services-image-fallback`} role="img" aria-label={imageAlt}>
        <ImageOff size={28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      className={className}
      src={service.src}
      alt={imageAlt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

const Services = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const content = servicesByLanguage[language] || servicesByLanguage.en;
  const details = serviceDetails[language] || serviceDetails.en;
  const [selectedService, setSelectedService] = useState(null);
  const closeButtonRef = useRef(null);
  const detailTriggerRef = useRef(null);

  useEffect(() => {
    if (!selectedService) {
      detailTriggerRef.current?.focus();
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedService(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = document.getElementById('services-detail-dialog');
      const focusable = dialog?.querySelectorAll('button:not([disabled]), a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedService]);

  const closeDetails = () => setSelectedService(null);

  return (
    <div className={`services-page${theme === 'dark' ? ' services-page-dark' : ''}`}>
      <section className="services-section services-shell" aria-labelledby="services-section-title">
        <h2 id="services-section-title" className="services-visually-hidden">{content.systemTitle}</h2>
        <div className="services-grid">
          {content.services.map(({ title, description, to, icon: Icon, secondaryIcon: SecondaryIcon }, index) => {
            const service = serviceMedia[index];
            return (
              <article className="services-card" key={title} style={{ '--services-card-index': index }}>
                <div className="services-card-image-frame">
                  {index === 0 ? (
                    <Link to={to} className="services-card-image-link" aria-label={`Open ${title}`}>
                      <ServiceImage service={service} imageAlt={service.alt[language] || service.alt.en} className="services-card-image" />
                    </Link>
                  ) : (
                    <ServiceImage service={service} imageAlt={service.alt[language] || service.alt.en} className="services-card-image" />
                  )}
                </div>
                <span className="services-card-icon" aria-hidden="true">
                  <Icon size={26} strokeWidth={1.8} />
                  {SecondaryIcon && <SecondaryIcon className="services-card-secondary-icon" size={15} strokeWidth={2} />}
                </span>
                <h3>{title}</h3>
                <p className="services-card-description">{description}</p>
                <button
                  className="services-card-action"
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`${details.viewDetails}: ${title}`}
                  onClick={(event) => {
                    detailTriggerRef.current = event.currentTarget;
                    setSelectedService({ index, title, description, to });
                  }}
                >
                  {details.viewDetails}
                  <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {selectedService && (
        <div className="services-modal-backdrop">
          <section
            id="services-detail-dialog"
            className="services-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="services-detail-title"
          >
            <button
              ref={closeButtonRef}
              className="services-detail-close"
              type="button"
              aria-label={details.close}
              onClick={closeDetails}
            >
              <X size={21} aria-hidden="true" />
            </button>
            <div className="services-detail-image-frame">
              <ServiceImage
                service={serviceMedia[selectedService.index]}
                imageAlt={serviceMedia[selectedService.index].alt[language] || serviceMedia[selectedService.index].alt.en}
                className="services-detail-image"
              />
            </div>
            <div className="services-detail-content">
              <h2 id="services-detail-title">{selectedService.title}</h2>
              <p className="services-detail-description">{selectedService.description}</p>
              <h3>{details.featuresHeading}</h3>
              <ul>
                {details.features[selectedService.index].map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <Link className="services-open-button" to={selectedService.to}>
                {details.openService}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .services-page {
          --services-navy: #07182d;
          --services-blue: #0797d5;
          --services-cyan: #16c4f4;
          --services-background: #F5F7FA;
          --services-surface: #ffffff;
          --services-text: #17324d;
          --services-muted: #64748b;
          --services-border: #d9e4ec;
          background: var(--services-background);
          color: var(--services-text);
        }

        .services-page-dark {
          --services-navy: #F5F7FA;
          --services-blue: #38bdf8;
          --services-cyan: #16c4f4;
          --services-background: #07182d;
          --services-surface: #0b1b33;
          --services-text: #F5F7FA;
          --services-muted: #cbd5e1;
          --services-border: #263a52;
        }

        .services-page,
        .services-page * { box-sizing: border-box; }

        .services-shell {
          width: min(1240px, calc(100% - 64px));
          margin-inline: auto;
        }

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
          min-height: 390px;
          padding: 24px;
          border: 1px solid var(--services-border);
          border-radius: 16px;
          background: var(--services-surface);
          box-shadow: 0 4px 16px rgba(7, 24, 45, 0.045);
          animation: services-card-enter 420ms both;
          animation-delay: calc(var(--services-card-index, 0) * 45ms);
          transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
        }

        @keyframes services-card-enter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .services-card-image-frame,
        .services-detail-image-frame {
          overflow: hidden;
          border-radius: 12px;
          background: rgba(7, 151, 213, 0.08);
        }

        .services-card-image-frame {
          width: 100%;
          height: 138px;
          margin-bottom: 20px;
        }

        .services-card-image-link {
          display: block;
          width: 100%;
          height: 100%;
        }

        .services-card-image,
        .services-image-fallback {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          object-fit: cover;
        }

        .services-card-image {
          transition: transform 350ms ease;
        }

        .services-card:hover .services-card-image {
          transform: scale(1.04);
        }

        .services-image-fallback {
          color: var(--services-blue);
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
          padding: 10px 0 0;
          border: 0;
          background: transparent;
          color: var(--services-blue);
          font-size: 0.9rem;
          font-weight: 700;
          font-family: inherit;
          text-decoration: none;
          cursor: pointer;
          transition: color 180ms ease, transform 180ms ease;
        }

        .services-card-action:hover {
          color: var(--services-cyan);
          transform: translateX(2px);
        }

        .services-card-action:focus-visible,
        .services-detail-close:focus-visible,
        .services-open-button:focus-visible {
          border-radius: 2px;
          outline: 3px solid var(--services-blue);
          outline-offset: 4px;
        }

        .services-modal-backdrop {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 24px;
          overflow-y: auto;
          background: rgba(3, 15, 30, 0.72);
          animation: services-modal-fade-in 180ms ease both;
        }

        @keyframes services-modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .services-detail-dialog {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          width: min(920px, 100%);
          max-height: min(820px, calc(100vh - 48px));
          overflow: auto;
          border: 1px solid var(--services-border);
          border-radius: 18px;
          background: var(--services-surface);
          color: var(--services-text);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.3);
          animation: services-dialog-enter 220ms ease both;
        }

        @keyframes services-dialog-enter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .services-detail-image-frame {
          min-height: 320px;
          height: 100%;
          border-radius: 0;
          background: rgba(7, 151, 213, 0.08);
        }

        .services-detail-image {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 320px;
          object-fit: cover;
        }

        .services-detail-content {
          padding: 36px;
        }

        .services-detail-content h2 {
          margin: 0 44px 12px 0;
          color: var(--services-navy);
          font-size: clamp(1.45rem, 3vw, 2rem);
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .services-detail-description {
          margin: 0 0 24px;
          color: var(--services-muted);
          line-height: 1.65;
        }

        .services-detail-content h3 {
          margin: 0 0 12px;
          color: var(--services-navy);
          font-size: 1.05rem;
        }

        .services-detail-content ul {
          display: grid;
          gap: 10px;
          margin: 0 0 24px;
          padding-left: 22px;
          color: var(--services-muted);
          line-height: 1.55;
        }

        .services-detail-content li::marker {
          color: var(--services-blue);
        }

        .services-detail-close {
          position: absolute;
          z-index: 1;
          top: 14px;
          right: 14px;
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 1px solid var(--services-border);
          border-radius: 50%;
          background: var(--services-surface);
          color: var(--services-text);
          cursor: pointer;
          transition: color 180ms ease, background-color 180ms ease;
        }

        .services-detail-close:hover {
          background: var(--services-blue);
          color: #fff;
        }

        .services-open-button {
          display: inline-flex;
          min-height: 46px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 10px 18px;
          border-radius: 8px;
          background: var(--services-blue);
          color: #fff;
          font-weight: 700;
          text-decoration: none;
          transition: background-color 180ms ease, transform 180ms ease;
        }

        .services-open-button:hover {
          background: #0874ae;
          transform: translateY(-1px);
        }

        @media (max-width: 1050px) {
          .services-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .services-card { min-height: 380px; }
        }

        @media (max-width: 640px) {
          .services-shell { width: calc(100% - 36px); }
          .services-section { padding-top: 28px; padding-bottom: 42px; }
          .services-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
          .services-card { min-height: 360px; padding: 22px; }
          .services-card-image-frame { height: 160px; }
          .services-modal-backdrop { padding: 12px; }
          .services-detail-dialog {
            grid-template-columns: minmax(0, 1fr);
            max-height: calc(100vh - 24px);
          }
          .services-detail-image-frame,
          .services-detail-image { min-height: 190px; max-height: 220px; }
          .services-detail-content { padding: 26px 22px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .services-card,
          .services-card-image,
          .services-card-action,
          .services-detail-close,
          .services-open-button,
          .services-modal-backdrop,
          .services-detail-dialog { animation: none; transition: none; }
          .services-card:hover { transform: none; }
          .services-card:hover .services-card-image,
          .services-card-action:hover,
          .services-open-button:hover { transform: none; }
        }
      `}</style>
    </div>
  );
};

export default Services;