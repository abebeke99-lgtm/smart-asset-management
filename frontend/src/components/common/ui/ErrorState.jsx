import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../contexts/UiContext';

const ErrorState = ({ title, message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="ui-error-state" role="alert">
      <AlertTriangle size={32} aria-hidden="true" />
      <h3>{title || t('common.errorState.title')}</h3>
      <p>{message || t('common.errorState.message')}</p>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('common.errorState.retry')}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
