import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function FormField({ id, label, required = false, helper, error, children, className = '' }) {
  return <div className={`admin-ui-form-field ${className}`}><label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{helper && !error && <small>{helper}</small>}{error && <small className="admin-ui-field-error" role="alert"><AlertCircle size={14} />{error}</small>}</div>;
}