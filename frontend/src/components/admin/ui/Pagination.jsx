import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../contexts/UiContext';

export default function Pagination({ page = 1, pageSize = 10, total = 0, onPageChange, onPageSizeChange }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const range = Array.from({ length: Math.min(5, pages) }, (_, index) => Math.max(1, Math.min(pages - 4, page - 2)) + index);
  return <div className="admin-ui-pagination"><span>{t('common.paginationRange', undefined, { start: first, end: last, total })}</span><label>{t('adminUi.rows')} <select aria-label={t('adminUi.rowsPerPage')} value={pageSize} onChange={(event) => onPageSizeChange?.(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><div className="admin-ui-page-buttons"><button type="button" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1} aria-label={t('adminUi.previousPage')}><ChevronLeft size={16} /></button>{range.map((number) => <button type="button" key={number} onClick={() => onPageChange?.(number)} aria-current={page === number ? 'page' : undefined}>{number}</button>)}<button type="button" onClick={() => onPageChange?.(page + 1)} disabled={page >= pages} aria-label={t('adminUi.nextPage')}><ChevronRight size={16} /></button></div></div>;
}