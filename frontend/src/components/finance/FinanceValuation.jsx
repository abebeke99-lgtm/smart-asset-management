import React, { useEffect, useState } from 'react';
import { Download, Eye, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { apiClient } from '../../utils/api';

const emptyFilters = { departments: [], categories: [], statuses: [], conditions: [], valuationStatuses: [] };
const money = (value) => value === null || value === undefined ? 'Not available' : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const date = (value) => value ? new Date(value).toLocaleDateString() : 'Not available';

const FinanceValuation = () => {
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [summary, setSummary] = useState({ totalAssets: 0, totalAcquisitionCost: 0, totalCurrentBookValue: 0, totalAccumulatedDepreciation: 0, requiringValuation: 0 });
  const [query, setQuery] = useState({ search: '', department: '', category: '', status: '', condition: '', valuationStatus: '', dateFrom: '', dateTo: '', page: 1, limit: 20, sort: 'assetTag', direction: 'ASC' });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [revalue, setRevalue] = useState({ currentValue: '', reason: '' });

  const load = async (nextQuery = query) => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/finance/valuation', { params: nextQuery });
      const data = response.data || {};
      setAssets(data.assets || []); setFilters(data.filters || emptyFilters); setSummary(data.summary || {}); setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (requestError) {
      setError(requestError.response?.status === 403 ? 'You are not authorized to view asset valuations.' : requestError.response?.status === 401 ? 'Your session has expired. Please sign in again.' : requestError.response?.data?.message || 'Unable to load asset valuations.');
      setAssets([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [query.search, query.department, query.category, query.status, query.condition, query.valuationStatus, query.dateFrom, query.dateTo, query.page, query.limit, query.sort, query.direction]);

  const openDetails = async (asset) => {
    setError('');
    try {
      const [detail, records] = await Promise.all([apiClient.get(`/finance/valuation/${asset.id}`), apiClient.get(`/finance/assets/${asset.id}/valuation-history`)]);
      setSelected(detail.data.asset); setHistory(records.data.history || []); setRevalue({ currentValue: detail.data.asset.current_value ?? '', reason: '' });
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load valuation details.'); }
  };

  const update = (key, value) => setQuery((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }));
  const exportCsv = () => {
    const headers = ['Asset Tag', 'Asset Name', 'Category', 'Department', 'Acquisition Date', 'Acquisition Cost', 'Accumulated Depreciation', 'Current Book Value', 'Condition', 'Valuation Status', 'Valuation Date'];
    const rows = assets.map((asset) => [asset.asset_tag, asset.name, asset.category_name, asset.department_name, date(asset.purchaseDate), asset.purchase_cost, asset.accumulated_depreciation, asset.current_value, asset.condition, asset.valuation_status, date(asset.valuation_date)]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'asset-valuations.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  const saveRevaluation = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiClient.put(`/finance/valuation/${selected.id}`, { current_value: Number(revalue.currentValue), notes: revalue.reason });
      await openDetails(selected); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save revaluation.'); }
    finally { setSaving(false); }
  };

  const isFiltered = Object.entries(query).some(([key, value]) => ['search', 'department', 'category', 'status', 'condition', 'valuationStatus', 'dateFrom', 'dateTo'].includes(key) && value);
  return <main style={{ padding: 24, background: '#f6f8fb', minHeight: '100vh', color: '#172033' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}><div><h1 style={{ margin: 0 }}>Asset Valuation</h1><p style={{ color: '#64748b' }}>Review authoritative acquisition, depreciation, and book values.</p></div><div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Refresh</button><button type="button" onClick={exportCsv} disabled={!assets.length}><Download size={16} /> Export</button></div></header>
    {error && <div role="alert" style={{ background: '#fff1f2', color: '#be123c', padding: 12, marginBottom: 16 }}>{error}</div>}
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>{[['Total assets', summary.totalAssets], ['Acquisition cost', money(summary.totalAcquisitionCost)], ['Current book value', money(summary.totalCurrentBookValue)], ['Accumulated depreciation', money(summary.totalAccumulatedDepreciation)], ['Requires valuation', summary.requiringValuation]].map(([label, value]) => <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16 }}><small>{label}</small><strong style={{ display: 'block', fontSize: 20, marginTop: 8 }}>{value}</strong></div>)}</section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr repeat(5, 1fr)', gap: 8 }}><label><Search size={16} /> <input placeholder="Search tag, name, category, department" value={query.search} onChange={(event) => update('search', event.target.value)} /></label>{[['department', 'Department', filters.departments.map((item) => [item.id, item.name])], ['category', 'Category', filters.categories.map((item) => [item, item])], ['status', 'Asset status', filters.statuses.map((item) => [item, item])], ['condition', 'Condition', filters.conditions.map((item) => [item, item])], ['valuationStatus', 'Valuation status', filters.valuationStatuses.map((item) => [item, item])]].map(([key, label, options]) => <select key={key} value={query[key]} onChange={(event) => update(key, event.target.value)}><option value="">{label}</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>)}</section>
    {loading ? <p style={{ padding: 30, textAlign: 'center' }}><Loader2 /> Loading asset valuations...</p> : assets.length === 0 ? <p style={{ padding: 30, textAlign: 'center' }}>{isFiltered ? 'No assets match the selected filters.' : 'No assets found'}</p> : <section style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Asset tag', 'Asset name', 'Category', 'Department', 'Acquisition date', 'Acquisition cost', 'Depreciation', 'Book value', 'Condition', 'Status', 'Valuation date'].map((label) => <th key={label} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}>{[asset.asset_tag, asset.name, asset.category_name, asset.department_name, date(asset.purchaseDate), money(asset.purchase_cost), money(asset.accumulated_depreciation), money(asset.current_value), asset.condition || 'Not available', asset.valuation_status, date(asset.valuation_date)].map((value, index) => <td key={index} style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{value || 'Not available'}</td>)}<td><button type="button" title="View valuation details" onClick={() => openDetails(asset)}><Eye size={16} /></button></td></tr>)}</tbody></table></section>}
    <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}><span>{pagination.total} records</span><span><button type="button" disabled={pagination.page <= 1} onClick={() => update('page', pagination.page - 1)}>Previous</button> <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => update('page', pagination.page + 1)}>Next</button></span></footer>
    {selected && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', padding: 24, overflow: 'auto' }}><article style={{ background: '#fff', maxWidth: 760, margin: 'auto', padding: 24 }}><button type="button" onClick={() => setSelected(null)} style={{ float: 'right' }}><X /></button><h2>{selected.name}</h2><p>{selected.asset_tag} · {selected.valuation_status}</p><dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{[['Acquisition cost', money(selected.purchase_cost)], ['Accumulated depreciation', money(selected.accumulated_depreciation)], ['Current book value', money(selected.current_value)], ['Residual value', money(selected.residual_value)], ['Department', selected.department_name || 'Not available'], ['Location', selected.location || 'Not available'], ['Acquisition date', date(selected.purchaseDate)], ['Valuation date', date(selected.valuation_date)], ['Condition', selected.condition || 'Not available']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Valuation history</h3>{history.length ? <ul>{history.map((record) => <li key={record.id}>{date(record.createdAt)}: {money(record.currentValue)} by {record.User?.fullName || record.User?.username || 'User'}{record.notes ? `, ${record.notes}` : ''}</li>)}</ul> : <p>No historical valuations available.</p>}<form onSubmit={saveRevaluation} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}><h3>Record revaluation</h3><input required type="number" min="0" step="0.01" value={revalue.currentValue} onChange={(event) => setRevalue({ ...revalue, currentValue: event.target.value })} placeholder="New current book value" /><input required value={revalue.reason} onChange={(event) => setRevalue({ ...revalue, reason: event.target.value })} placeholder="Reason" /><button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record revaluation'}</button></form></article></div>}
  </main>;
};

export default FinanceValuation;
