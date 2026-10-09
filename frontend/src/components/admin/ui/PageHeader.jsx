import React from 'react';
import { ChevronRight, House } from 'lucide-react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useTranslation } from '../../../contexts/UiContext';

const SafeLink = React.forwardRef(({ to, children, ...props }, ref) => {
  const inRouter = useInRouterContext();
  if (!inRouter) {
    const href = typeof to === 'string' ? to : to?.pathname || '/';
    return <a ref={ref} href={href} {...props}>{children}</a>;
  }
  return <Link ref={ref} to={to} {...props}>{children}</Link>;
});

export default function PageHeader({ eyebrow, title, subtitle, actions, breadcrumb = [] }) {
  const { t } = useTranslation();
  return (
    <>
      {breadcrumb.length > 0 && (
        <nav className="admin-content-breadcrumb" aria-label={t('adminUi.breadcrumb')}>
          <SafeLink to="/admin" aria-label={t('adminUi.adminHome')}><House size={14} /></SafeLink>
          {breadcrumb.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              <ChevronRight size={13} aria-hidden="true" />
              {item.href && index < breadcrumb.length - 1 ? <SafeLink to={item.href}>{item.label}</SafeLink> : <span aria-current="page">{item.label}</span>}
            </React.Fragment>
          ))}
        </nav>
      )}
      <header className="admin-page-header">
        <div>
          {eyebrow && <div className="admin-eyebrow">{eyebrow}</div>}
          <h1 className="admin-page-title">{title}</h1>
          {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="admin-page-header-actions">{actions}</div>}
      </header>
    </>
  );
}