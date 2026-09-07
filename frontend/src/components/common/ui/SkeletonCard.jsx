import React from 'react';

const SkeletonCard = () => (
  <div className="ui-skeleton-card" aria-hidden="true">
    <span className="ui-skeleton ui-skeleton-icon" />
    <span className="ui-skeleton ui-skeleton-title" />
    <span className="ui-skeleton ui-skeleton-value" />
  </div>
);

export default SkeletonCard;
