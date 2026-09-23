import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Boxes, Eye, Filter, History, MapPin, PackageCheck, PackageMinus, PackagePlus, PackageX, RefreshCw, Search, SlidersHorizontal, Tags, TriangleAlert, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import './ICTInventory.css';

const PAGE_SIZE = 20;
const emptyFilters = { search: '', category: '', status: '', location: '', stockLevel: '' };
const canWrite = (role) => ['admin', 'store_manager', 'ict_officer'].includes(String(role || '').toLowerCase());
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = (value) => value === null || value === undefined || value === '' ? '—' : value;
const date = (value) => value ? new Date(value).toLocaleString() : '—';
const label = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

function statusFor(item) {
  const available = number(item.available_quantity ?? item.availableQuantity);
  const minimum = number(item.min_stock ?? item.minimumQuantity);
  if (available <= 0) return { key: 'out', label: 'Out of Stock' };
  if (available <= minimum) return { key: 'low', label: 'Low Stock' };
  return { key: 'available', label: 'Available' };
}

export default function ICTInventory() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState(emptyFilters);
  const [options, setOptions] = useState({ categories: [], statuses: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [movement, setMovement] = useState(null);
  const [movementForm, setMovementForm] = useState({ quantity: '', reference: '', reason: '', notes: '', adjustment_type: 'increase' });

  const query = useMemo(() => Object.fromEntries(Object.entries({ ...filters, page: pagination.page, pageSize: PAGE_SIZE }).filter(([, value]) => value !== '')), [filters, pagination.page]);
  const loadInventory = async (page = 1, refresh = false, signal) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/api/inventory', { params: { ...query, page }, signal });
      setItems(Array.isArray(data?.data) ? data.data : []);
      setSummary(data?.summary || null);
      setPagination((current) => ({ ...current, ...(data?.pagination || {}), page }));
    } catch (requestError) {
      if (requestError.code === 'ERR_CANCELED') return;
      const message = requestError.response?.status === 403 ? 'You do not have permission to view inventory.' : requestError.response?.data?.message || 'Unable to load inventory.';
      setError(message); setItems([]); setSummary(null); toast.error(message);
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadInventory(1, false, controller.signal), filters.search ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters]);

  useEffect(() => {
    Promise.allSettled([apiClient.get('/api/ict/assets/options'), apiClient.get('/api/locations')]).then(([assetOptions, locations]) => {
      const assetData = assetOptions.status === 'fulfilled' ? assetOptions.value.data : {};
      const locationData = locations.status === 'fulfilled' ? locations.value.data : {};
      setOptions({
        categories: Array.isArray(assetData.categories) ? assetData.categories.map((item) => item.name || item).filter(Boolean) : [],
        statuses: Array.isArray(assetData.statuses) ? assetData.statuses : [],
        locations: (Array.isArray(locationData.data) ? locationData.data : []).map((item) => item.name).filter(Boolean),
      });
    });
  }, []);

  const updateFilter = (name, value) => { setFilters((current) => ({ ...current, [name]: value })); setPagination((current) => ({ ...current, page: 1 })); };
  const clearFilters = () => { setFilters(emptyFilters); setPagination((current) => ({ ...current, page: 1 })); };
  const openHistory = async (item) => {
    setSelected(item); setHistory([]);
    try { const { data } = await apiClient.get('/api/transactions', { params: { asset_id: item.asset_id } }); setHistory(Array.isArray(data?.transactions) ? data.transactions : []); }
    catch (requestError) { toast.error(requestError.response?.data?.message || 'Unable to load stock history.'); }
  };
  const submitMovement = async (event) => {
    event.preventDefault();
    if (!selected) return toast.error('Select an inventory item first.');
    const quantity = Number(movementForm.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return toast.error('Enter a positive whole quantity.');
    const available = number(selected?.available_quantity ?? selected?.availableQuantity);
    if (movement === 'issue' && quantity > available) return toast.error(`Only ${available} units are available.`);
    try {
      await apiClient.post('/api/inventory/transactions', { asset_id: selected.asset_id, type: movement, quantity, ...movementForm });
      toast.success(`${label(movement)} completed successfully.`);
      setMovement(null); setMovementForm({ quantity: '', reference: '', reason: '', notes: '', adjustment_type: 'increase' });
      await loadInventory(pagination.page, true);
    } catch (requestError) { toast.error(requestError.response?.data?.message || `Unable to ${movement} stock.`); }
  };

  if (!user || !['admin', 'ict_officer', 'store_manager'].includes(user.role)) return null;
  const writeAccess = canWrite(user.role);
  const cards = summary ? [[Boxes, summary.totalItems, 'Total Inventory Items', 'blue'], [PackageCheck, summary.availableQuantity, 'Available Stock', 'green'], [TriangleAlert, summary.lowStock, 'Low Stock', 'orange'], [PackageX, summary.outOfStock, 'Out of Stock', 'red']] : [];
  const hasFilters = Object.values(filters).some(Boolean);

  return <main className="ict-inventory-page">
    <header className="inventory-header"><div><p className="eyebrow">ICT / Inventory</p><h1>Inventory Management</h1><p>Monitor ICT consumables, spare parts, stock levels, receipts, issues, adjustments, and inventory history.</p></div><div className="header-actions">{writeAccess && <button className="primary-button" onClick={() => { setSelected(null); setMovement('receive'); }}><PackagePlus size={17} /> Receive Stock</button>}<button className="secondary-button" onClick={() => loadInventory(pagination.page, true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /> Refresh</button></div></header>
    <section className="summary-grid">{loading && !summary ? [1, 2, 3, 4].map((key) => <div className="summary-card skeleton" key={key} />) : cards.map(([Icon, value, title, tone]) => <article className={`summary-card ${tone}`} key={title}><span className="summary-icon"><Icon size={19} /></span><strong>{value}</strong><small>{title}</small></article>)}</section>
    <section className="filter-panel"><div className="search-input"><Search size={17} /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search item, code, SKU, serial, supplier..." aria-label="Search inventory" /></div><div className="filter-label"><Tags size={15} /><select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></div><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{options.statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><div className="filter-label"><MapPin size={15} /><select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">All locations</option>{options.locations.map((item) => <option key={item}>{item}</option>)}</select></div><select value={filters.stockLevel} onChange={(event) => updateFilter('stockLevel', event.target.value)}><option value="">All stock levels</option><option value="available">Available</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>{hasFilters && <button className="clear-button" onClick={clearFilters}><Filter size={15} /> Clear</button>}</section>
    {error && <div className="error-banner"><TriangleAlert size={18} /><span>{error}</span><button onClick={() => loadInventory(pagination.page)}>Retry</button></div>}
    <section className="table-panel"><div className="panel-heading"><div><p className="eyebrow">Inventory register</p><h2>Stock overview</h2></div><span>{pagination.total ? `Showing ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}` : '0 items'}</span></div><div className="table-scroll"><table><thead><tr><th>Item</th><th>Item code</th><th>Category</th><th>Quantity</th><th>Minimum</th><th>Available</th><th><MapPin size={14} /> Location</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{loading && !items.length ? [1, 2, 3, 4, 5].map((key) => <tr className="loading-row" key={key}><td colSpan="10">Loading inventory...</td></tr>) : items.length ? items.map((item) => { const stock = statusFor(item); return <tr key={item.id}><td><strong>{text(item.name)}</strong><small>{text(item.serial_number)}</small></td><td>{text(item.asset_tag || item.item_id)}</td><td>{text(item.category)}</td><td>{number(item.quantity)}</td><td>{number(item.min_stock)}</td><td className="available-number">{number(item.available_quantity)}</td><td>{text(item.location)}</td><td><span className={`status-badge ${stock.key}`}>{stock.label}</span></td><td>{date(item.last_updated)}</td><td><div className="row-actions"><button title="View details" onClick={() => openHistory(item)}><Eye size={16} /></button>{writeAccess && <><button title="Receive stock" onClick={() => { setSelected(item); setMovement('receive'); }}><PackagePlus size={16} /></button><button title="Issue stock" onClick={() => { setSelected(item); setMovement('issue'); }}><PackageMinus size={16} /></button><button title="Adjust stock" onClick={() => { setSelected(item); setMovement('adjustment'); }}><SlidersHorizontal size={16} /></button></>}</div></td></tr>; }) : <tr><td colSpan="10" className="empty-cell"><Boxes size={32} /><strong>No inventory items found</strong><span>{hasFilters ? 'No records match the current filters.' : 'Receive or create inventory items to begin tracking stock.'}</span>{writeAccess && !hasFilters && <button className="primary-button" onClick={() => setMovement('receive')}><PackagePlus size={16} /> Receive Stock</button>}</td></tr>}</tbody></table></div><footer className="pagination"><span>{pagination.total ? `${pagination.total} inventory items` : 'No items'}</span><div><button disabled={pagination.page <= 1 || loading} onClick={() => loadInventory(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages || 1}</span><button disabled={!pagination.totalPages || pagination.page >= pagination.totalPages || loading} onClick={() => loadInventory(pagination.page + 1)}>Next</button></div></footer></section>
    {selected && !movement && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">INVENTORY DETAILS</p><h2>{text(selected.name)}</h2></div><button onClick={() => setSelected(null)} aria-label="Close"><X size={19} /></button></div><div className="detail-grid">{[['Item code', selected.asset_tag || selected.item_id], ['Category', selected.category], ['Unit', 'Quantity'], ['Description', selected.description], ['Current quantity', number(selected.quantity)], ['Minimum level', number(selected.min_stock)], ['Available quantity', number(selected.available_quantity)], ['Reserved quantity', number(selected.reserved_quantity)], ['Location', selected.location], ['Supplier', selected.supplier], ['Last updated', date(selected.last_updated)]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{text(value)}</dd></div>)}</div><h3><History size={17} /> Stock history</h3>{history.length ? history.map((entry) => <div className="history-item" key={entry.id}><strong>{label(entry.type)} · {entry.quantity}</strong><span>{date(entry.createdAt)} · {text(entry.reason || entry.notes)}</span></div>) : <p className="muted">No stock movements recorded.</p>}</section></div>}
    {movement && <div className="modal-backdrop" onClick={() => setMovement(null)}><form className="modal movement-modal" onSubmit={submitMovement} onClick={(event) => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">STOCK MOVEMENT</p><h2>{label(movement)} Stock</h2></div><button type="button" onClick={() => setMovement(null)} aria-label="Close"><X size={19} /></button></div>{selected && <div className="selected-item"><Boxes size={18} /><span><strong>{selected.name}</strong><small>Available: {number(selected.available_quantity)}</small></span></div>}<label>Inventory item{!selected && <select required value={selected?.asset_id || ''} onChange={(event) => setSelected(items.find((item) => String(item.asset_id) === event.target.value))}><option value="">Select an item</option>{items.map((item) => <option key={item.asset_id} value={item.asset_id}>{item.name} ({item.item_id})</option>)}</select>}</label><label>Quantity<input required min="1" step="1" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} /></label>{movement === 'adjustment' && <label>Adjustment type<select value={movementForm.adjustment_type} onChange={(event) => setMovementForm({ ...movementForm, adjustment_type: event.target.value })}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></label>}<label>{movement === 'adjustment' ? 'Reason' : 'Reference'}<input required={movement !== 'issue'} value={movement === 'adjustment' ? movementForm.reason : movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, [movement === 'adjustment' ? 'reason' : 'reference']: event.target.value })} /></label><label>Notes<textarea value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setMovement(null)}>Cancel</button><button className="primary-button" type="submit">{label(movement)} Stock</button></div></form></div>}
  </main>;
}
