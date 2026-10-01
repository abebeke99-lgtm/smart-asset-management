import React from 'react';

const statusGroups = {
  success: ['active', 'available', 'completed', 'approved', 'enabled', 'in service'],
  warning: ['under maintenance', 'maintenance', 'pending', 'scheduled', 'on hold'],
  danger: ['damaged', 'expired', 'escalated', 'rejected', 'overdue', 'failed'],
  neutral: ['retired', 'disposed', 'inactive', 'archived', 'cancelled'],
  info: ['in-progress', 'in progress', 'submitted', 'assigned', 'new'],
};

export const getStatusTone = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return Object.entries(statusGroups).find(([, statuses]) => statuses.includes(normalized))?.[0] || 'info';
};

export default function StatusBadge({ status, children }) {
  const value = status ?? children;
  return <span className={`admin-ui-status is-${getStatusTone(value)}`}><span aria-hidden="true" />{value}</span>;
}