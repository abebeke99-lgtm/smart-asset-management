import React from 'react';
import { PackageOpen } from 'lucide-react';
import { useTranslation } from '../../../contexts/UiContext';

const EmptyState = ({ title, message, action }) => {
  const { t } = useTranslation();
  return (
    <div className="ui-empty-state">
      <PackageOpen size={32} aria-hidden="true" />
      <h3>{title || t('common.emptyState.title')}</h3>
      <p>{message || t('common.emptyState.message')}</p>
      {action}
    </div>
  );
};

export default EmptyState;
