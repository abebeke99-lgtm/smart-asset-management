import React from 'react';

const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div className="ui-skeleton-table" aria-hidden="true">
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div className="ui-skeleton-table-row" key={rowIndex}>
        {Array.from({ length: columns }, (_, columnIndex) => (
          <span className="ui-skeleton" key={columnIndex} />
        ))}
      </div>
    ))}
  </div>
);

export default SkeletonTable;
