import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, labelledBy, className = '' }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const initialFocus = dialogRef.current?.querySelector('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    (initialFocus || dialogRef.current)?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose, open]);
  if (!open) return null;
  const adminRoot = document.querySelector('.admin-layout');
  const theme = adminRoot?.getAttribute('data-admin-theme') || 'system';
  const dark = adminRoot?.classList.contains('dark');
  return createPortal(
    <div className={`admin-layout admin-ui-modal-portal${dark ? ' dark' : ''}`} data-admin-theme={theme}>
      <div className="admin-ui-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
        <section ref={dialogRef} className={`admin-ui-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || 'admin-modal-title'} tabIndex="-1">
          <header className="admin-ui-modal-header"><h2 id={labelledBy || 'admin-modal-title'}>{title}</h2><button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header>
          <div className="admin-ui-modal-body">{children}</div>
          {footer && <footer className="admin-ui-modal-footer">{footer}</footer>}
        </section>
      </div>
    </div>, document.body,
  );
}