import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import Skeleton from './Skeleton';
import { useTranslation } from '../../../contexts/UiContext';

export default function DataTable({ columns = [], rows = [], rowKey = 'id', loading = false, error, emptyMessage, page = 1, pageSize = 10, total = rows.length, onPageChange, onPageSizeChange, onSort, className = '' }) {
  const { t } = useTranslation();
  const [localSort, setLocalSort] = useState({ key: '', direction: 'asc' });
  const sortState = localSort;
  const visibleRows = useMemo(() => {
    if (onSort || !sortState.key) return rows;
    const column = columns.find((item) => item.key === sortState.key);
    if (!column) return rows;
    return [...rows].sort((left, right) => String(left[column.key] ?? '').localeCompare(String(right[column.key] ?? ''), undefined, { numeric: true }) * (sortState.direction === 'asc' ? 1 : -1));
  }, [columns, onSort, rows, sortState]);
  const sortColumn = (column) => {
    if (!column.sortable) return;
    const direction = sortState.key === column.key && sortState.direction === 'asc' ? 'desc' : 'asc';
    setLocalSort({ key: column.key, direction });
    onSort?.(column.key, direction);
  };

  return (
    <section className={`admin-ui-table-card ${className}`} aria-busy={loading}>
      {error ? <ErrorState message={typeof error === 'string' ? error : t('adminUi.tableLoadError')} /> : (
        <div className="admin-ui-table-scroll" role="region" aria-label={t('adminUi.dataTable')} tabIndex="0">
          <table className="admin-ui-table">
            <thead><tr>{columns.map((column) => {
              const currentSort = sortState.key === column.key ? sortState.direction : 'none';
              return <th key={column.key} scope="col" aria-sort={column.sortable ? (currentSort === 'asc' ? 'ascending' : currentSort === 'desc' ? 'descending' : 'none') : undefined}>
                {column.sortable ? <button type="button" onClick={() => sortColumn(column)} className="admin-ui-sort-button">{column.label}{sortState.key === column.key ? sortState.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : <ArrowUpDown size={14} />}</button> : column.label}
              </th>;
            })}</tr></thead>
            <tbody>
              {loading ? Array.from({ length: Math.min(pageSize, 6) }, (_, rowIndex) => <tr key={`loading-${rowIndex}`}>{columns.map((column) => <td key={column.key}><Skeleton height={16} /></td>)}</tr>) : visibleRows.length ? visibleRows.map((row, index) => <tr key={row[rowKey] ?? index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key] ?? '—'}</td>)}</tr>) : <tr><td colSpan={columns.length}><EmptyState message={emptyMessage || t('adminUi.noRecords')} /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!error && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />}
    </section>
  );
}