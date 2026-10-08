import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Building2, ClipboardList, FileText, LifeBuoy, LockKeyhole, Mail, MapPin, Package, Phone, Radio, Scale, ShieldCheck, Wrench } from 'lucide-react';

const publicLinks = [
  { to: '/home', key: 'home' },
  { to: '/about', key: 'about' },
  { to: '/help', key: 'help' },
  { to: '/contact', key: 'contact' }
];

const roleSystemLinks = {
  admin: ['/admin/assets', '/admin/inventory/overview', '/admin/rfid/qr', '/admin/maintenance', '/admin/reports'],
  ict_officer: ['/ict/assets', '/ict/inventory', '/ict/tracking', '/ict/maintenance', '/ict/reports'],
  college: ['/college/assets', '/college/inventory', '/college/rfid', '/college/maintenance', '/college/reports'],
  department_head: ['/department-head/assets', '/department-head/inventory', '/department-head/verification', '/department-head/maintenance', '/department-head/reports'],
  staff: ['/department/assets', '/department/inventory', '/department/verification', '/department/maintenance', '/department/history'],
  store_manager: ['/store/available-assets', '/store/inventory', '/store/tracking', '/store/maintenance', '/store/reports/inventory'],
  maintenance: ['/maintenance/assets-under-maintenance', '/maintenance/spare-parts', '/maintenance', '/maintenance', '/maintenance/reports'],
  infrastructure: ['/infrastructure/assets', '/infrastructure/inventory', '/infrastructure/tracking', '/infrastructure/maintenance', '/infrastructure/reports'],
  finance: ['/finance/valuation', '/services', '/services', '/services', '/finance/financial-reports']
};

const systemItems = [
  { key: 'footerAssetManagement', icon: Package },
  { key: 'inventory', icon: ClipboardList },
  { key: 'footerQrRfid', icon: Radio },
  { key: 'maintenance', icon: Wrench },
  { key: 'reports', icon: BarChart3 }
];

const Footer = ({ t, organization, role, onPublicNavigation }) => {
  const { pathname } = useLocation();
  const systemDestinations = roleSystemLinks[role] || ['/services', '/services', '/services', '/services', '/services'];
  const organizationName = organization?.institutionName || organization?.name || t.university;
  const year = new Date().getFullYear();

  const renderLink = ({ to, label, icon: Icon }, usePublicNavigation = false) => (
    <Link
      className="footer-link"
      to={to}
      key={`${label}-${to}`}
      onClick={usePublicNavigation ? (event) => onPublicNavigation?.(to, event) : undefined}
      aria-current={pathname === to ? 'page' : undefined}
    >
      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      <span>{label}</span>
    </Link>
  );

  return (
    <footer className="public-site-footer" aria-label={t.footerLabel}>
      <div className="footer-grid">
        <section className="footer-brand" aria-labelledby="footer-brand-title">
          <div className="footer-brand-header">
            {organization?.logo ? (
              <img className="footer-brand-logo" src={organization.logo} alt="" />
            ) : (
              <span className="footer-brand-mark"><Building2 size={22} aria-hidden="true" /></span>
            )}
            <div>
              <p className="footer-university-name">{organizationName}</p>
              <h2 id="footer-brand-title">{t.footerBrandTitle}</h2>
            </div>
          </div>
          <p>{t.footerDescription}</p>
          {(organization?.email || organization?.phone || organization?.address) ? (
            <div className="footer-contact" aria-label={t.footerContactDetails}>
              {organization.email ? <a href={`mailto:${organization.email}`}><Mail size={14} aria-hidden="true" />{organization.email}</a> : null}
              {organization.phone ? <a href={`tel:${organization.phone}`}><Phone size={14} aria-hidden="true" />{organization.phone}</a> : null}
              {organization.address ? <p><MapPin size={14} aria-hidden="true" />{organization.address}</p> : null}
            </div>
          ) : null}
        </section>

        <nav className="footer-section" aria-label={t.footerNavigation}>
          <h3>{t.footerNavigation}</h3>
          {publicLinks.map(({ to, key }) => renderLink({ to, label: t[key] }, true))}
        </nav>

        <nav className="footer-section" aria-label={t.footerSystem}>
          <h3>{t.footerSystem}</h3>
          {systemItems.map((item, index) => renderLink({
            to: systemDestinations[index],
            label: t[item.key],
            icon: item.icon
          }, systemDestinations[index].startsWith('/features') || systemDestinations[index].startsWith('/services')))}
        </nav>

        <nav className="footer-section" aria-label={t.footerSupport}>
          <h3>{t.footerSupport}</h3>
          {renderLink({ to: '/help', label: t.footerHelpCenter, icon: LifeBuoy }, true)}
          {renderLink({ to: '/help', label: t.footerFaq, icon: FileText }, true)}
          {renderLink({ to: '/contact', label: t.footerContactSupport, icon: Mail }, true)}
        </nav>

        <section className="footer-section footer-legal" aria-labelledby="footer-legal-title">
          <h3 id="footer-legal-title">{t.footerLegal}</h3>
          <span className="footer-legal-label" aria-label={`${t.privacyPolicy}: ${t.footerLegalUnavailable}`}>
            <ShieldCheck size={15} aria-hidden="true" />{t.privacyPolicy}
          </span>
          <span className="footer-legal-label" aria-label={`${t.footerTermsOfUse}: ${t.footerLegalUnavailable}`}>
            <Scale size={15} aria-hidden="true" />{t.footerTermsOfUse}
          </span>
          <p className="footer-legal-note"><LockKeyhole size={13} aria-hidden="true" />{t.footerLegalUnavailable}</p>
        </section>
      </div>

      <div className="footer-bottom">
        <span>© {year} Mekdela Amba University. {t.footerCopyright} {t.footerDevelopedBy} Bekele (0986481821)</span>
      </div>
    </footer>
  );
};

export default Footer;