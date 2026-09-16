import React, { useEffect, useState } from 'react';
import { Eye, Package, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeAssets.css';

const emptyFilters = { categories: [], statuses: [], conditions: [], locations: [], assignmentStatuses: [], departments: [] };
const emptySummary = { total: 0, active: 0, assigned: 0, available: 0, maintenance: 0, damagedMissing: 0 };
const display = (value) => value || '—';
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleDateString() : '—';
const money = (value) => value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString(undefined, { style: 'currency', currency: 'ETB' });
const isCurrentAssignment = (assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase());

const CollegeAssets = ({ inventory = false }) => {
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
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: error.response?.data?.message || 'Unable to load college assets.' }));
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
    try { const response = await apiClient.get(`/api/college/assets/${asset.id}`); setSelected(response.data?.data || asset); } catch (error) { setSelected({ ...asset, detailError: error.response?.data?.message || 'Unable to load asset details.' }); } finally { setDetailLoading(false); }
  };
  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) return <div className="college-assets-state" aria-busy="true"><RefreshCw className="college-assets-spin" /> Loading college assets...</div>;
  if (state.error) return <div className="college-assets-state college-assets-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => loadAssets(true)}><RefreshCw size={16} /> Retry</button></div>;

  const selectOptions = [['category', 'Category', state.filters.categories], ['status', 'Status', state.filters.statuses], ['condition', 'Condition', state.filters.conditions], ['location', 'Location', state.filters.locations], ['departmentId', 'Department', state.filters.departments.map((item) => ({ value: item.id, label: item.name }))], ['assignmentStatus', 'Assignment Status', state.filters.assignmentStatuses]];
  return <div className="college-assets-page">
    <header className="college-assets-heading"><div><span className="college-assets-eyebrow"><Package size={15} /> College Manager</span><h1>{inventory ? 'College Inventory' : 'College Assets'}</h1><p>{state.college?.name ? `${state.college.name} · ` : ''}{inventory ? 'Monitor the physical inventory belonging to your college.' : 'Manage and monitor assets belonging to your college.'}</p></div><button className="college-assets-refresh" type="button" onClick={() => loadAssets()}><RefreshCw size={16} /> Refresh</button></header>
    <section className="college-assets-summary" aria-label="Asset summary">{[['total', 'Total Assets'], ['active', 'Active Assets'], ['assigned', 'Assigned Assets'], ['available', 'Available Assets'], ['maintenance', 'Under Maintenance'], ['damagedMissing', 'Damaged / Missing']].map(([key, title]) => <div className="college-assets-stat" key={key}><span>{title}</span><strong>{Number(state.summary[key] || 0).toLocaleString()}</strong></div>)}</section>
    <section className="college-assets-toolbar" aria-label="Asset filters"><label className="college-assets-search"><Search size={17} /><span className="sr-only">Search assets</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder="Search tag, name, serial, maker..." /></label>{selectOptions.map(([field, title, options]) => <label key={field}><span className="sr-only">{title}</span><select value={query[field]} onChange={(event) => updateQuery(field, event.target.value)}><option value="">All {title}s</option>{options.map((option) => <option value={typeof option === 'object' ? option.value : option} key={typeof option === 'object' ? option.value : option}>{typeof option === 'object' ? option.label : label(option)}</option>)}</select></label>)}{hasFilters && <button className="college-assets-clear" type="button" onClick={clearFilters}><X size={15} /> Clear Filters</button>}</section>
    <section className="college-assets-table-panel"><div className="college-assets-table-meta"><strong>{pagination.total ? `Showing ${first}–${last} of ${pagination.total} assets` : 'No assets found'}</strong>{state.tableLoading && <RefreshCw size={15} className="college-assets-spin" />}</div>{state.assets.length ? <div className="college-assets-table-wrap"><table><thead><tr><th>Asset Tag</th><th>Asset Name</th><th>Category</th><th>Department</th><th>Location</th><th>Status</th><th>Condition</th><th>Current Value</th><th>Actions</th></tr></thead><tbody>{state.assets.map((asset) => <tr key={asset.id}><td><strong>{display(asset.assetCode)}</strong></td><td>{display(asset.name)}<small>{display(asset.serialNumber)}</small></td><td>{display(asset.category)}</td><td>{display(asset.departmentName || asset.department)}</td><td>{display(asset.location)}</td><td><span className="college-assets-badge">{label(asset.status)}</span></td><td>{display(asset.condition)}</td><td>{money(asset.currentValue)}</td><td><button className="college-assets-icon-button" type="button" onClick={() => openDetails(asset)} aria-label={`View details for ${asset.name}`} title="View details"><Eye size={17} /></button></td></tr>)}</tbody></table></div> : <div className="college-assets-empty"><Package size={28} /><strong>{hasFilters ? 'No assets match your current filters.' : 'No assets found'}</strong>{hasFilters && <button type="button" onClick={clearFilters}>Clear Filters</button>}</div>}<nav className="college-assets-pagination" aria-label="Asset pages"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.pages)}</span><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</button></nav></section>
    {selected && <div className="college-assets-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="college-assets-modal" role="dialog" aria-modal="true" aria-labelledby="asset-details-title"><div className="college-assets-modal-head"><div><span className="college-assets-eyebrow">Asset details</span><h2 id="asset-details-title">{display(selected.name)}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details"><X /></button></div>{detailLoading ? <div className="college-assets-modal-loading"><RefreshCw className="college-assets-spin" /> Loading details...</div> : selected.detailError ? <p className="college-assets-error">{selected.detailError}</p> : <div className="college-assets-details">{[['Asset Tag', selected.assetCode], ['Category', selected.category], ['Serial Number', selected.serialNumber], ['Manufacturer', selected.manufacturer], ['Model', selected.model], ['Status', label(selected.status)], ['Condition', selected.condition], ['Department', selected.DepartmentRecord?.name || selected.department], ['Location', selected.location], ['Assigned To', selected.Assignments?.find(isCurrentAssignment)?.User?.fullName || selected.Assignments?.find(isCurrentAssignment)?.User?.username], ['Purchase Date', date(selected.purchaseDate)], ['Purchase Cost', money(selected.purchasePrice)], ['Current Value', money(selected.currentValue)], ['Warranty Expiry', date(selected.warrantyExpiry)], ['Created', date(selected.createdAt)], ['Updated', date(selected.updatedAt)]].map(([title, value]) => <div key={title}><span>{title}</span><strong>{display(value)}</strong></div>)}</div>}</section></div>}
  </div>;
};

export default CollegeAssets;
