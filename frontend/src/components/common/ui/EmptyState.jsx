import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = ({ title = 'Nothing to show', message = 'There are no records to display.', action }) => (
  <div className="ui-empty-state">
    <PackageOpen size={32} aria-hidden="true" />
    <h3>{title}</h3>
    <p>{message}</p>
    {action}
  </div>
);

export default EmptyState;
