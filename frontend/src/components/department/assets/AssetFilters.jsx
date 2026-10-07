import React from 'react';

const AssetFilters = ({ filters, options, labels, onChange, onSearch }) => (
  <section className="dha-filters" aria-label={labels.filters}>
    <input
      type="search"
      aria-label={labels.search}
      placeholder={labels.search}
      value={filters.search}
      onChange={(event) => onSearch(event.target.value)}
    />
    {[
      ['category', labels.allCategories, options.categories],
      ['status', labels.allStatuses, options.statuses],
      ['condition', labels.allConditions, options.conditions],
      ['location', labels.allLocations, options.locations],
      ['assignedUserId', labels.allUsers, options.users],
      ['maintenanceStatus', labels.allMaintenance, options.maintenanceStatuses],
    ].map(([key, placeholder, values]) => (
      <select key={key} aria-label={placeholder} value={filters[key]} onChange={(event) => onChange(key, event.target.value)}>
        <option value="">{placeholder}</option>
        {values.map((option) => {
          const value = typeof option === 'object' ? option.id : option;
          const label = typeof option === 'object' ? (option.name || option.fullName || option.label) : option;
          return <option key={value} value={value}>{label}</option>;
        })}
      </select>
    ))}
    <select aria-label={labels.allWarranty} value={filters.warranty} onChange={(event) => onChange('warranty', event.target.value)}>
      <option value="">{labels.allWarranty}</option>
      <option value="valid">{labels.validWarranty}</option>
      <option value="expired">{labels.expiredWarranty}</option>
    </select>
  </section>
);

export default AssetFilters;
