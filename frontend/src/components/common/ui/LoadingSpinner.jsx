import React from 'react';
import { LoaderCircle } from 'lucide-react';

const LoadingSpinner = ({ label = 'Loading', size = 20 }) => (
  <span className="ui-loading-spinner" role="status" aria-label={label}>
    <LoaderCircle size={size} aria-hidden="true" />
    <span className="ui-loading-label">{label}</span>
  </span>
);

export default LoadingSpinner;
