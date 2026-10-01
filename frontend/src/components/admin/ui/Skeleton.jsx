import React from 'react';

export default function Skeleton({ width = '100%', height = 18, circle = false, className = '' }) {
  return <span className={`admin-ui-skeleton${circle ? ' is-circle' : ''} ${className}`} aria-hidden="true" style={{ width, height }} />;
}