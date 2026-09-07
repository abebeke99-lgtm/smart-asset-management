import React from 'react';

const normalizeStatus = (status) => String(status || 'inactive').trim().toLowerCase().replace(/[\s_]+/g, '-');

const StatusBadge = ({ status, children }) => {
  const value = normalizeStatus(status || children);
  return (
    <span className={`ui-status-badge ui-status-${value}`}>
      {children || status || 'Inactive'}
    </span>
  );
};

export default StatusBadge;
