/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { Eye, Package, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../contexts/UiContext';
import './CollegeAssets.css';

const emptyFilters = { categories: [], statuses: [], conditions: [], locations: [], assignmentStatuses: [], departments: [] };
const emptySummary = { total: 0, active: 0, assigned: 0, available: 0, maintenance: 0, damagedMissing: 0 };
const display = (value) => value || '—';
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleDateString() : '—';
const money = (value) => value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString(undefined, { style: 'currency', currency: 'ETB' });
const isCurrentAssignment = (assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase());

const CollegeAssets = ({ inventory = false }) => {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, tableLoading: false, error: '', assets: [], summary: emptySummary, filters: emptyFilters, pagination: { page: 1, limit: 20, total: 0, pages: 1 }, college: null });
  const [query, setQuery] = useState({ search: '', category: '', status: '', condition: '', location: '', departmentId: '', assignmentStatus: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAssets = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get(inventory ? '/api/college/inventory' : '/api/college/assets', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const payload = response.data || {};
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, assets: payload.data || [], summary: payload.summary || emptySummary, filters: payload.filters || emptyFilters, pagination: payload.pagination || previous.pagination, college: payload.college || previous.college }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: error.response?.data?.message || t('collegeAssets.loadError', 'Unable to load college assets.') }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAssets(!state.assets.length && state.loading), 350);
    return () => clearTimeout(timer);
  }, [page, query.search, query.category, query.status, query.condition, query.location, query.departmentId, query.assignmentStatus]);

  const updateQuery = (field, value) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: value === 'All' ? '' : value })); };
  const clearFilters = () => { setPage(1); setQuery({ search: '', category: '', status: '', condition: '', location: '', departmentId: '', assignmentStatus: '' }); };
  const openDetails = async (asset) => {
    setSelected({ ...asset, loading: true });
    setDetailLoading(true);
    try { const response = await apiClient.get(`/api/college/assets/${asset.id}`); setSelected(response.data?.data || asset); } catch (error) { setSelected({ ...asset, detailError: error.response?.data?.message || t('collegeAssets.detailLoadError', 'Unable to load asset details.') }); } finally { setDetailLoading(false); }
  };
  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) return <div className="college-assets-state" aria-busy="true"><RefreshCw className="college-assets-spin" /> {t('collegeAssets.loading', 'Loading college assets...')}</div>;
  if (state.error) return <div className="college-assets-state college-assets-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => loadAssets(true)}><RefreshCw size={16} /> {t('collegeAssets.retry', 'Retry')}</button></div>;

  const selectOptions = [
    ['category', 'category', 'allCategories', state.filters.categories],
    ['status', 'status', 'allStatuses', state.filters.statuses],
    ['condition', 'condition', 'allConditions', state.filters.conditions],
    ['location', 'location', 'allLocations', state.filters.locations],
    ['departmentId', 'department', 'allDepartments', state.filters.departments.map((item) => ({ value: item.id, label: item.name }))],
    ['assignmentStatus', 'assignmentStatus', 'allAssignmentStatuses', state.filters.assignmentStatuses]
  ];
  const summaryItems = [
    ['total', 'totalAssets'], ['active', 'activeAssets'], ['assigned', 'assignedAssets'],
    ['available', 'availableAssets'], ['maintenance', 'underMaintenance'], ['damagedMissing', 'damagedMissing']
  ];
  const detailItems = [
    ['assetTag', selected?.assetCode], ['category', selected?.category],
    ['serialNumber', selected?.serialNumber], ['manufacturer', selected?.manufacturer],
    ['model', selected?.model], ['status', label(selected?.status)],
    ['condition', selected?.condition], ['department', selected?.DepartmentRecord?.name || selected?.department],
    ['location', selected?.location],
    ['assignedTo', selected?.Assignments?.find(isCurrentAssignment)?.User?.fullName || selected?.Assignments?.find(isCurrentAssignment)?.User?.username],
    ['purchaseDate', date(selected?.purchaseDate)], ['purchaseCost', money(selected?.purchasePrice)],
    ['currentValue', money(selected?.currentValue)], ['warrantyExpiry', date(selected?.warrantyExpiry)],
    ['created', date(selected?.createdAt)], ['updated', date(selected?.updatedAt)]
  ];

  return <div className="college-assets-page">
    <header className="college-assets-heading">
      <div>
        <span className="college-assets-eyebrow"><Package size={15} /> {t('collegeAssets.role', 'College Manager')}</span>
        <h1>{t(inventory ? 'collegeAssets.inventoryTitle' : 'collegeAssets.assetsTitle', inventory ? 'College Inventory' : 'College Assets')}</h1>
        <p>{state.college?.name ? `${state.college.name} · ` : ''}{t(inventory ? 'collegeAssets.inventoryDescription' : 'collegeAssets.assetsDescription', inventory ? 'Monitor the physical inventory belonging to your college.' : 'Manage and monitor assets belonging to your college.')}</p>
      </div>
      <button className="college-assets-refresh" type="button" onClick={() => loadAssets()}><RefreshCw size={16} /> {t('collegeAssets.refresh', 'Refresh')}</button>
    </header>
    <section className="college-assets-summary" aria-label={t('collegeAssets.assetSummary', 'Asset summary')}>
      {summaryItems.map(([key, title]) => <div className="college-assets-stat" key={key}><span>{t(`collegeAssets.${title}`, title)}</span><strong>{Number(state.summary[key] || 0).toLocaleString()}</strong></div>)}
    </section>
    <section className="college-assets-toolbar" aria-label={t('collegeAssets.filters', 'Asset filters')}>
      <label className="college-assets-search"><Search size={17} /><span className="sr-only">{t('collegeAssets.searchAssets', 'Search assets')}</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder={t('collegeAssets.searchPlaceholder', 'Search tag, name, serial, maker...')} /></label>
      {selectOptions.map(([field, title, allTitle, options]) => <label key={field}><span className="sr-only">{t(`collegeAssets.${title}`, title)}</span><select value={query[field]} onChange={(event) => updateQuery(field, event.target.value)}><option value="">{t(`collegeAssets.${allTitle}`, allTitle)}</option>{options.map((option) => <option value={typeof option === 'object' ? option.value : option} key={typeof option === 'object' ? option.value : option}>{typeof option === 'object' ? option.label : label(option)}</option>)}</select></label>)}
      {hasFilters && <button className="college-assets-clear" type="button" onClick={clearFilters}><X size={15} /> {t('collegeAssets.clearFilters', 'Clear Filters')}</button>}
    </section>
    <section className="college-assets-table-panel">
      <div className="college-assets-table-meta"><strong>{pagination.total ? t('collegeAssets.showingAssets', 'Showing {start}–{end} of {total} assets', { start: first, end: last, total: pagination.total }) : t('collegeAssets.noAssetsFound', 'No assets found') }</strong>{state.tableLoading && <RefreshCw size={15} className="college-assets-spin" />}</div>
      {state.assets.length ? <div className="college-assets-table-wrap"><table><thead><tr>{['assetTag', 'assetName', 'category', 'department', 'location', 'status', 'condition', 'currentValue', 'actions'].map((key) => <th key={key}>{t(`collegeAssets.${key}`, key)}</th>)}</tr></thead><tbody>{state.assets.map((asset) => <tr key={asset.id}><td><strong>{display(asset.assetCode)}</strong></td><td>{display(asset.name)}<small>{display(asset.serialNumber)}</small></td><td>{display(asset.category)}</td><td>{display(asset.departmentName || asset.department)}</td><td>{display(asset.location)}</td><td><span className="college-assets-badge">{label(asset.status)}</span></td><td>{display(asset.condition)}</td><td>{money(asset.currentValue)}</td><td><button className="college-assets-icon-button" type="button" onClick={() => openDetails(asset)} aria-label={t('collegeAssets.viewDetailsFor', 'View details for {name}', { name: asset.name })} title={t('collegeAssets.viewDetails', 'View details')}><Eye size={17} /></button></td></tr>)}</tbody></table></div> : <div className="college-assets-empty"><Package size={28} /><strong>{hasFilters ? t('collegeAssets.noFilteredAssets', 'No assets match your current filters.') : t('collegeAssets.noAssetsFound', 'No assets found')}</strong>{hasFilters && <button type="button" onClick={clearFilters}>{t('collegeAssets.clearFilters', 'Clear Filters')}</button>}</div>}
      <nav className="college-assets-pagination" aria-label={t('collegeAssets.assetPages', 'Asset pages')}><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>{t('collegeAssets.previous', 'Previous')}</button><span>{t('collegeAssets.pageOf', 'Page {page} of {total}', { page: pagination.page, total: Math.max(1, pagination.pages) })}</span><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>{t('collegeAssets.next', 'Next')}</button></nav>
    </section>
    {selected && <div className="college-assets-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="college-assets-modal" role="dialog" aria-modal="true" aria-labelledby="asset-details-title"><div className="college-assets-modal-head"><div><span className="college-assets-eyebrow">{t('collegeAssets.assetDetails', 'Asset details')}</span><h2 id="asset-details-title">{display(selected.name)}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label={t('collegeAssets.closeDetails', 'Close details')}><X /></button></div>{detailLoading ? <div className="college-assets-modal-loading"><RefreshCw className="college-assets-spin" /> {t('collegeAssets.loadingDetails', 'Loading details...')}</div> : selected.detailError ? <p className="college-assets-error">{selected.detailError}</p> : <div className="college-assets-details">{detailItems.map(([key, value]) => <div key={key}><span>{t(`collegeAssets.${key}`, key)}</span><strong>{display(value)}</strong></div>)}</div>}</section></div>}
  </div>;
};

export default CollegeAssets;
