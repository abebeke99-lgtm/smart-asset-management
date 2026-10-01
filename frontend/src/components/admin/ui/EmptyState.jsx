import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Nothing here yet', message = 'No records are available.', action, icon: Icon = Inbox }) {
  return <div className="admin-ui-empty-state"><span className="admin-ui-state-icon"><Icon size={22} aria-hidden="true" /></span><strong>{title}</strong><p>{message}</p>{action}</div>;
}