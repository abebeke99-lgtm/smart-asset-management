import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function ErrorState({ title = 'Unable to load data', message = 'Please try again.', onRetry }) {
  return <div className="admin-ui-error-state" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>{title}</strong><p>{message}</p></div>{onRetry && <button type="button" className="admin-secondary-button" onClick={onRetry}>Retry</button>}</div>;
}