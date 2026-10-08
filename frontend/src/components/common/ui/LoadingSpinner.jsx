import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from '../../../contexts/UiContext';

const LoadingSpinner = ({ label, size = 20 }) => {
  const { t } = useTranslation();
  const resolvedLabel = label || t('shell.loading');

  return (
    <span className="ui-loading-spinner" role="status" aria-label={resolvedLabel}>
      <LoaderCircle size={size} aria-hidden="true" />
      <span className="ui-loading-label">{resolvedLabel}</span>
    </span>
  );
};

export default LoadingSpinner;
