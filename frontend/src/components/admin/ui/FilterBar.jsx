import React from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from '../../../contexts/UiContext';

export default function FilterBar({ search, onSearchChange, searchPlaceholder, filters = [], activeFilters = [], onRemoveFilter, onReset, children }) {
  const { t } = useTranslation();
  const resolvedSearchPlaceholder = searchPlaceholder || t('adminUi.searchRecords');

  return (
    <section className="admin-ui-filter-bar" aria-label={t('adminUi.filters')}>
      <label className="admin-ui-filter-search">
        <Search size={17} aria-hidden="true" />
        <input
          value={search ?? ''}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={resolvedSearchPlaceholder}
          aria-label={resolvedSearchPlaceholder}
        />
        {search && (
          <button type="button" onClick={() => onSearchChange?.('')} aria-label={t('adminUi.clearSearch')}>
            <X size={16} />
          </button>
        )}
      </label>
      {filters.map((filter) => (
        <label className="admin-ui-filter-select" key={filter.name}>
          <span>{filter.label}</span>
          <select value={filter.value ?? ''} onChange={(event) => filter.onChange?.(event.target.value)}>
            {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      {children}
      {activeFilters.length > 0 && (
        <div className="admin-ui-filter-chips">
          {activeFilters.map((filter) => (
            <button type="button" key={filter.key} onClick={() => onRemoveFilter?.(filter.key)}>
              {filter.label}<X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {onReset && <button type="button" className="admin-ghost-button" onClick={onReset}>{t('adminUi.resetFilters')}</button>}
    </section>
  );
}
