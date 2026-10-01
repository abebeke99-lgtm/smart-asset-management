import React from 'react';
import { ChevronRight, House } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PageHeader({ eyebrow, title, subtitle, actions, breadcrumb = [] }) {
  return (
    <>
      {breadcrumb.length > 0 && (
        <nav className="admin-content-breadcrumb" aria-label="Breadcrumb">
          <Link to="/admin" aria-label="Admin home"><House size={14} /></Link>
          {breadcrumb.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              <ChevronRight size={13} aria-hidden="true" />
              {item.href && index < breadcrumb.length - 1 ? <Link to={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
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