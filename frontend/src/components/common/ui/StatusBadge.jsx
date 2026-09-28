import React from 'react';
import { useTranslation } from '../../../contexts/UiContext';

const normalizeStatus = (status) => String(status || 'inactive').trim().toLowerCase().replace(/[\s_]+/g, '-');
const statusKey = (status) => ({
  'in-progress': 'inProgress',
  'in-use': 'inUse',
  'under-maintenance': 'underMaintenance',
  'waiting-for-parts': 'waitingForParts',
  'out-of-service': 'outOfService'
}[normalizeStatus(status)] || normalizeStatus(status).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));

const StatusBadge = ({ status, children }) => {
  const { t } = useTranslation();
  const displayStatus = status || children;
  const value = normalizeStatus(displayStatus);
  const label = typeof children === 'string' && normalizeStatus(children) === value
    ? t(`common.status.${statusKey(displayStatus)}`, children)
    : children || t(`common.status.${statusKey(displayStatus)}`, status || 'Inactive');
  return (
    <span className={`ui-status-badge ui-status-${value}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
