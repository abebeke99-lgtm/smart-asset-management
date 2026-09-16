import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Edit2, Eye, Plus, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import './ICTAssets.css';

const emptyFilters = { search: '', category: '', status: '', condition: '', department: '', location: '', assignmentStatus: '' };
const valueOrDash = (value) => value === null || value === undefined || value === '' ? '—' : value;
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';

const ICTAssets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [options, setOptions] = useState({ categories: [], departments: [], statuses: [], conditions: [] });
  const [summary, setSummary] = useState({ total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const requestParams = useMemo(() => Object.fromEntries(Object.entries({ ...filters, page: pagination.page, limit: pagination.limit }).filter(([, value]) => value !== '')), [filters, pagination.page, pagination.limit]);

  const loadAssets = async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/ict/assets', { params: requestParams, signal });
      setAssets(response.data.assets || []);
      setSummary(response.data.summary || { total: 0 });
      setPagination((previous) => ({ ...previous, ...(response.data.pagination || {}), total: response.data.total || 0 }));
    } catch (requestError) {
      if (requestError.code === 'ERR_CANCELED') return;
      const message = requestError.response?.status === 403 ? 'You do not have access to ICT assets in this organization.' : requestError.response?.data?.message || 'Unable to load ICT assets.';
      setError(message);
      toast.error(message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadAssets(controller.signal), filters.search ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestParams]);

  useEffect(() => {
    apiClient.get('/api/ict/assets/options').then(({ data }) => setOptions({ categories: data.categories || [], departments: data.departments || [], statuses: data.statuses || [], conditions: data.conditions || [] })).catch(() => toast.error('Unable to load asset filter options.'));
  }, []);

  const updateFilter = (name, value) => { setFilters((current) => ({ ...current, [name]: value })); setPagination((current) => ({ ...current, page: 1 })); };
  const clearFilters = () => { setFilters(emptyFilters); setPagination((current) => ({ ...current, page: 1 })); };
  const openDetails = async (asset) => {
    try { const { data } = await apiClient.get(`/api/ict/assets/${asset.id}`); setSelected(data); } catch (requestError) { toast.error(requestError.response?.data?.message || 'Unable to load asset details.'); }
  };
  const saveAsset = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await apiClient.patch(`/api/ict/assets/${editing.id}`, editing); toast.success('Asset updated successfully.'); setEditing(null); await loadAssets(); }
    catch (requestError) { toast.error(requestError.response?.data?.message || 'Unable to update asset.'); }
    finally { setSaving(false); }
  };

  const cards = [['total', 'Total ICT Assets'], ['assigned', 'Assigned'], ['available', 'Available'], ['maintenance', 'Under Maintenance'], ['damaged', 'Damaged']];
  if (!user || user.role !== 'ict_officer') return null;

  return <main className="ict-assets-page">
    <header className="ict-assets-header"><div><p className="eyebrow">ICT OPERATIONS</p><h1>ICT Assets</h1><p className="subtitle">Track technology assets, ownership, condition, and lifecycle.</p></div><button className="primary-button" onClick={() => navigate('/ict/assets/create')}><Plus size={17} /> Add ICT Asset</button></header>
    <section className="summary-grid">{cards.map(([key, label]) => <article className="summary-card" key={key}><span>{label}</span><strong>{summary[key] || 0}</strong></article>)}</section>
    <section className="filter-panel"><div className="search-field"><Search size={17} /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search tag, name, serial, model, user..." aria-label="Search ICT assets" /></div><select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{options.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{options.statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)}><option value="">All conditions</option>{options.conditions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={filters.department} onChange={(event) => updateFilter('department', event.target.value)}><option value="">All departments</option>{options.departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select value={filters.assignmentStatus} onChange={(event) => updateFilter('assignmentStatus', event.target.value)}><option value="">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select><input value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} placeholder="Location" aria-label="Filter by location" />{Object.values(filters).some(Boolean) && <button className="quiet-button" onClick={clearFilters}>Clear filters</button>}</section>
    {error && <div className="error-banner"><AlertCircle size={18} /><span>{error}</span><button className="quiet-button" onClick={() => loadAssets()}>Retry</button></div>}
    <section className="table-panel"><div className="table-heading"><div><h2>Asset register</h2><span>{pagination.total} records</span></div>{loading && <RefreshCw className="spin" size={18} aria-label="Loading" />}</div><div className="table-scroll"><table><thead><tr><th>Asset tag</th><th>Asset name</th><th>Category</th><th>Serial number</th><th>Status</th><th>Condition</th><th>Assigned to</th><th>Department</th><th>Location</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{loading && !assets.length ? <tr><td colSpan="11" className="empty-cell">Loading ICT assets...</td></tr> : assets.length ? assets.map((asset) => <tr key={asset.id}><td className="strong">{valueOrDash(asset.assetTag || asset.assetCode)}</td><td>{valueOrDash(asset.name)}</td><td>{valueOrDash(asset.category)}</td><td>{valueOrDash(asset.serialNumber)}</td><td><span className="status-badge">{valueOrDash(asset.status)}</span></td><td>{valueOrDash(asset.condition)}</td><td>{valueOrDash(asset.assignedTo)}</td><td>{valueOrDash(asset.department)}</td><td>{valueOrDash(asset.location)}</td><td>{formatDate(asset.updatedAt)}</td><td className="actions"><button className="icon-button" title="View details" onClick={() => openDetails(asset)}><Eye size={16} /></button><button className="icon-button" title="Edit asset" onClick={() => setEditing({ ...asset })}><Edit2 size={16} /></button></td></tr>) : <tr><td colSpan="11" className="empty-cell"><strong>No ICT assets found</strong><br /><span>{Object.values(filters).some(Boolean) ? 'Try clearing the current filters or search.' : 'No assets are available in your authorized scope.'}</span></td></tr>}</tbody></table></div><footer className="pagination"><span>{pagination.total ? `${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}` : '0 records'}</span><div><button className="icon-button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={17} /></button><span>Page {pagination.page} of {Math.max(pagination.pages, 1)}</span><button className="icon-button" disabled={!pagination.pages || pagination.page >= pagination.pages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}><ChevronRight size={17} /></button></div></footer></section>
    {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">ASSET DETAILS</p><h2>{valueOrDash(selected.asset.name)}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close"><X size={19} /></button></div><div className="detail-grid">{[['Asset tag', selected.asset.assetTag || selected.asset.assetCode], ['Category', selected.asset.category], ['Manufacturer', selected.asset.manufacturer], ['Model', selected.asset.model], ['Serial number', selected.asset.serialNumber], ['Status', selected.asset.status], ['Condition', selected.asset.condition], ['Assigned to', selected.asset.assignedTo], ['Department', selected.asset.department], ['Location', selected.asset.location], ['Purchase date', formatDate(selected.asset.purchaseDate)], ['Warranty expiry', formatDate(selected.asset.warrantyExpiry)], ['Created', formatDate(selected.asset.createdAt)], ['Updated', formatDate(selected.asset.updatedAt)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{valueOrDash(value)}</dd></div>)}</div><h3>Maintenance</h3>{selected.maintenance?.length ? selected.maintenance.map((item) => <p className="history-item" key={item.id}>{valueOrDash(item.title)} <span>{valueOrDash(item.status)} · {formatDate(item.createdAt)}</span></p>) : <p className="muted">No maintenance records.</p>}<h3>History</h3>{selected.history?.length ? selected.history.map((item, index) => <p className="history-item" key={`${item.date}-${index}`}>{valueOrDash(item.action)} <span>{formatDate(item.date)}</span></p>) : <p className="muted">No audit history.</p>}</div></div>}
    {editing && <div className="modal-backdrop" role="presentation" onClick={() => setEditing(null)}><form className="modal edit-modal" onSubmit={saveAsset} onClick={(event) => event.stopPropagation()}><div className="modal-title"><h2>Edit ICT asset</h2><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close"><X size={19} /></button></div><label>Asset name<input required value={editing.name || ''} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Status<select value={editing.status || ''} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>{options.statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Condition<select value={editing.condition || ''} onChange={(event) => setEditing({ ...editing, condition: event.target.value })}>{options.conditions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Location<input value={editing.location || ''} onChange={(event) => setEditing({ ...editing, location: event.target.value })} /></label><label>Description<textarea value={editing.description || ''} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label><div className="modal-actions"><button type="button" className="quiet-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div></form></div>}
  </main>;
};

export default ICTAssets;
