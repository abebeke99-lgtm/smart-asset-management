import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorState = ({ title = 'Unable to load data', message = 'Something went wrong while loading this section.', onRetry }) => (
  <div className="ui-error-state" role="alert">
    <AlertTriangle size={32} aria-hidden="true" />
    <h3>{title}</h3>
    <p>{message}</p>
    {onRetry && (
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" />
        Retry
      </button>
    )}
  </div>
);

export default ErrorState;
