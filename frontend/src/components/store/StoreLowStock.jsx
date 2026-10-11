/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Download, MapPin, PackageOpen, PackagePlus, PackageSearch, RefreshCw, Search, Tag, Truck, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import './StoreLowStock.css';

const english = {
  title: 'Low Stock Alerts', subtitle: 'Monitor inventory items that require replenishment.', refresh: 'Refresh', export: 'Export',
  inventory: 'View Inventory', search: 'Search items, tags, serials...', severity: 'Severity', category: 'Category',
  location: 'Location', sort: 'Sort by', all: 'All', clear: 'Clear Filters', lowStock: 'Total Low Stock',
  critical: 'Critical', outOfStock: 'Out of Stock', shortage: 'Total Shortage', categories: 'Categories Affected',
  locations: 'Locations Affected', item: 'Item / Asset', code: 'Asset Tag', current: 'On-hand', available: 'Available',
  reserved: 'Reserved', assigned: 'Assigned', reorder: 'Reorder Level', severityCol: 'Severity', updated: 'Last Updated',
  action: 'Actions', addStock: 'Add Stock', receive: 'Receive', details: 'History', setReorder: 'Set Reorder Level',
  low: 'LOW', out: 'OUT OF STOCK', loading: 'Loading low-stock alerts...', error: 'Unable to load low-stock alerts.',
  forbidden: 'You do not have permission to view low-stock alerts.', retry: 'Retry', empty: 'No low-stock items',
  emptyText: 'All monitored inventory is currently above its reorder threshold.', filtered: 'No matching low-stock items',
  filteredText: 'Try changing your filters or search.', previous: 'Previous', next: 'Next', of: 'of',
  notRegistered: 'Not registered', thresholdTitle: 'Set Reorder Level', thresholdHint: 'Set to 0 to use the configured system default.',
  save: 'Save', cancel: 'Cancel', saving: 'Saving...', invalidThreshold: 'Enter a whole number from 0 to 1,000,000.',
  thresholdSaved: 'Reorder level updated.', saveFailed: 'Unable to update the reorder level.',
  integrity: 'Negative available stock detected; investigate this inventory balance.',
};
const amharic = { ...english, title: 'የዝቅተኛ ክምችት ማስጠንቀቂያዎች', subtitle: 'መሙላት የሚያስፈልጋቸውን እቃዎች ይከታተሉ።', refresh: 'አድስ', export: 'ላክ', inventory: 'እቃዎችን ይመልከቱ', search: 'እቃ፣ መለያ ወይም ተከታታይ ፈልግ...', severity: 'አስቸኳይነት', category: 'ምድብ', location: 'ቦታ', all: 'ሁሉም', clear: 'ማጣሪያ አጽዳ', lowStock: 'ጠቅላላ ዝቅተኛ', critical: 'አስቸኳይ', outOfStock: 'ከክምችት ውጭ', shortage: 'ጠቅላላ እጥረት', loading: 'የዝቅተኛ ክምችት ማስጠንቀቂያዎች በመጫን ላይ...', error: 'ማስጠንቀቂያዎችን መጫን አልተቻለም።', retry: 'እንደገና ሞክር', empty: 'ዝቅተኛ ክምችት የለም', filtered: 'የሚዛመድ ዝቅተኛ ክምችት የለም', addStock: 'እቃ ጨምር', receive: 'ተቀበል', save: 'አስቀምጥ', cancel: 'ዝጋ' };
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatQuantity = (value, unit) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return '-';
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return '-';
  return unit ? `${parsed} ${unit}` : String(parsed);
};
const initialSummary = { lowStock: 0, critical: 0, outOfStock: 0, totalShortage: 0, categoriesAffected: 0, locationsAffected: 0, dataIntegrityErrors: 0 };

export default function StoreLowStock() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = language === 'en' ? english : amharic;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(initialSummary);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState(() => ({
    search: '',
    severity: ['low', 'critical', 'out_of_stock'].includes(searchParams.get('severity')) ? searchParams.get('severity') : '',
    category: '',
    location: '',
  }));
  const [sortBy, setSortBy] = useState('severity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState(null);
  const [reorderValue, setReorderValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (page = 1, refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/store/low-stock', {
        params: { ...filters, page, pageSize: 25, sortBy, sortOrder },
      });
      const payload = response.data?.data;
      if (!payload || !Array.isArray(payload.items) || !payload.pagination || !payload.summary) {
        throw new Error('The low-stock response did not include the required data.');
      }
      setItems(payload.items);
      setSummary({ ...initialSummary, ...payload.summary });
      setPagination({ page, pageSize: 25, ...payload.pagination });
    } catch (requestError) {
      setItems([]);
      setError(requestError.response?.status === 403 ? 'forbidden' : requestError.response?.data?.message || requestError.message || 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(1); }, [filters, sortBy, sortOrder]);
  const options = useMemo(() => ({
    categories: [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    locations: [...new Set(items.map((item) => item.location).filter(Boolean))].sort(),
  }), [items]);
  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const clearFilters = () => setFilters({ search: '', severity: '', category: '', location: '' });
  const openThreshold = (item) => {
    setActionError('');
    setEditing(item);
    setReorderValue(String(item.thresholdSource === 'system_default' ? 0 : item.reorderLevel));
  };
  const saveThreshold = async (event) => {
    event.preventDefault();
    const parsed = Number(reorderValue);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1000000) {
      setActionError(t.invalidThreshold);
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await apiClient.patch(`/api/store/inventory/${editing.id}/reorder-level`, { reorderLevel: parsed });
      setEditing(null);
      await load(pagination.page, true);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || t.saveFailed);
    } finally {
      setSaving(false);
    }
  };
  const exportItems = async () => {
    setActionError('');
    try {
      const first = await apiClient.get('/api/store/low-stock', {
        params: { ...filters, page: 1, pageSize: 100, sortBy, sortOrder },
      });
      const firstPayload = first.data?.data || {};
      const allItems = [...(firstPayload.items || [])];
      const responses = await Promise.all(Array.from(
        { length: Math.max(0, (firstPayload.pagination?.totalPages || 1) - 1) },
        (_, index) => apiClient.get('/api/store/low-stock', {
          params: { ...filters, page: index + 2, pageSize: 100, sortBy, sortOrder },
        }),
      ));
      responses.forEach((response) => allItems.push(...(response.data?.data?.items || [])));
      const rows = allItems.map((item) => ({
        Item: item.item,
        Category: item.category,
        'Asset Tag': item.assetCode,
        'On-hand Quantity': item.onHand,
        Available: item.available,
        Reserved: item.reserved,
        Assigned: item.assigned,
        'Reorder Level': item.reorderLevel,
        Shortage: item.shortage,
        Severity: item.severity,
        College: item.college,
        Department: item.department,
        Location: item.location,
        'Last Updated': item.lastUpdated,
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Low Stock');
      XLSX.writeFile(workbook, `low-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || requestError.message || t.error);
    }
  };
  const severityLabel = (severity) => severity === 'OUT_OF_STOCK' ? t.out : severity === 'CRITICAL' ? t.critical : t.low;
  const formatTimestamp = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };
  const filteredEmpty = filters.search || filters.severity || filters.category || filters.location;
  if (loading) return <div className="low-stock-state"><RefreshCw size={20} /> {t.loading}</div>;
  if (error) return <div className="low-stock-state low-stock-error"><AlertTriangle size={22} /><p>{error === 'forbidden' ? t.forbidden : error}</p><button type="button" onClick={() => load(pagination.page)}><RefreshCw size={16} /> {t.retry}</button></div>;

  return (
    <main className="low-stock-page">
      <header className="low-stock-header">
        <div><p className="low-stock-eyebrow">Store Inventory</p><h1>{t.title}</h1><p>{t.subtitle}</p></div>
        <div className="low-stock-actions">
          <button type="button" onClick={() => load(pagination.page, true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /> {t.refresh}</button>
          <button type="button" onClick={exportItems}><Download size={17} /> {t.export}</button>
          <button className="low-stock-primary" type="button" onClick={() => navigate('/store/inventory')}><PackageSearch size={17} /> {t.inventory}</button>
        </div>
      </header>
      {actionError && !editing && <p className="low-stock-action-error" role="alert">{actionError}</p>}
      <section className="low-stock-kpis">
        {[[PackageOpen, summary.lowStock, t.lowStock], [AlertTriangle, summary.critical, t.critical], [AlertCircle, summary.outOfStock, t.outOfStock], [Tag, summary.totalShortage, t.shortage], [PackageSearch, summary.categoriesAffected, t.categories], [MapPin, summary.locationsAffected, t.locations]]
          .map(([Icon, value, label]) => <div className="low-stock-kpi" key={label}><span><Icon size={18} /></span><strong>{number(value)}</strong><small>{label}</small></div>)}
      </section>
      {number(summary.dataIntegrityErrors) > 0 && <p className="low-stock-action-error" role="alert">{t.integrity} ({summary.dataIntegrityErrors})</p>}
      <section className="low-stock-panel low-stock-filters">
        <div className="low-stock-search"><Search size={17} /><input aria-label={t.search} value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder={t.search} /></div>
        <select aria-label={t.severity} value={filters.severity} onChange={(event) => setFilter('severity', event.target.value)}><option value="">{t.all} {t.severity}</option><option value="out_of_stock">{t.out}</option><option value="critical">{t.critical}</option><option value="low">{t.low}</option></select>
        <select aria-label={t.category} value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="">{t.all} {t.category}</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label={t.location} value={filters.location} onChange={(event) => setFilter('location', event.target.value)}><option value="">{t.all} {t.location}</option>{options.locations.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label={t.sort} value={`${sortBy}:${sortOrder}`} onChange={(event) => { const [field, order] = event.target.value.split(':'); setSortBy(field); setSortOrder(order); }}>
          <option value="severity:desc">Severity</option><option value="available:asc">Available: low to high</option><option value="available:desc">Available: high to low</option><option value="reorderLevel:desc">Threshold: high to low</option><option value="reorderLevel:asc">Threshold: low to high</option><option value="name:asc">Item name: A-Z</option><option value="name:desc">Item name: Z-A</option>
        </select>
        <button className="low-stock-clear" type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button>
      </section>
      <section className="low-stock-panel">
        <div className="low-stock-table-heading"><div><p className="low-stock-eyebrow">{t.lowStock}</p><h2>{t.title}</h2></div><span>{pagination.total ? `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} ${t.of} ${pagination.total}` : '0'}</span></div>
        {items.length ? (
          <div className="low-stock-table-wrap"><table><thead><tr><th>{t.item}</th><th>{t.code}</th><th>{t.current}</th><th>{t.available}</th><th>{t.reserved}</th><th>{t.assigned}</th><th>{t.reorder}</th><th>{t.shortage}</th><th>{t.severityCol}</th><th>College</th><th>Department</th><th>{t.location}</th><th>{t.updated}</th><th>{t.action}</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}>
              <td><strong>{item.item}</strong><small>{item.category || '-'}</small>{item.dataIntegrityError && <small className="low-stock-integrity">{t.integrity}</small>}</td>
              <td>{item.assetCode || t.notRegistered}</td>
              <td>{formatQuantity(item.onHand, item.unit)}</td><td>{formatQuantity(item.available, item.unit)}</td><td>{formatQuantity(item.reserved, item.unit)}</td><td>{formatQuantity(item.assigned, item.unit)}</td>
              <td>{formatQuantity(item.reorderLevel, item.unit)}{item.thresholdSource === 'system_default' ? ' *' : ''}</td><td className="shortage-value">{formatQuantity(item.shortage, item.unit)}</td>
              <td><span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity === 'OUT_OF_STOCK' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />} {severityLabel(item.severity)}</span></td>
              <td>{item.college || '-'}</td><td>{item.department || '-'}</td><td>{item.location || '-'}</td><td>{formatTimestamp(item.lastUpdated)}</td>
              <td><span className="low-stock-row-actions">
                <button className="low-stock-action" type="button" onClick={() => navigate(`/store/inventory?addStock=true&assetId=${item.assetId}`)}><PackagePlus size={15} /> {t.addStock}</button>
                <button className="low-stock-action" type="button" onClick={() => navigate(`/store/receive?assetId=${item.assetId}`)}><Truck size={15} /> {t.receive}</button>
                <button className="low-stock-action" type="button" onClick={() => navigate(`/store/history?assetId=${item.assetId}`)}><PackageSearch size={15} /> {t.details}</button>
                <button className="low-stock-action" type="button" onClick={() => openThreshold(item)}><Tag size={15} /> {t.setReorder}</button>
              </span></td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="low-stock-empty"><PackageOpen size={32} /><h3>{filteredEmpty ? t.filtered : t.empty}</h3><p>{filteredEmpty ? t.filteredText : t.emptyText}</p>{filteredEmpty && <button type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button>}</div>}
        <footer className="low-stock-pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft size={16} /> {t.previous}</button><span>{pagination.page} / {pagination.totalPages || 1}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>{t.next} <ChevronRight size={16} /></button></footer>
      </section>
      {editing && <div className="low-stock-overlay"><section className="low-stock-modal" role="dialog" aria-modal="true" aria-labelledby="low-stock-threshold-title">
        <div className="low-stock-modal-heading"><h2 id="low-stock-threshold-title">{t.thresholdTitle}: {editing.item}</h2><button type="button" aria-label={t.cancel} onClick={() => setEditing(null)}><X size={18} /></button></div>
        {actionError && <p className="low-stock-action-error" role="alert">{actionError}</p>}
        <form onSubmit={saveThreshold}><label htmlFor="reorder-level">{t.reorder}</label><input id="reorder-level" type="number" min="0" max="1000000" step="1" required value={reorderValue} onChange={(event) => setReorderValue(event.target.value)} /><small>{t.thresholdHint}</small>
          <div className="low-stock-modal-actions"><button type="button" onClick={() => setEditing(null)}>{t.cancel}</button><button className="low-stock-primary" type="submit" disabled={saving}>{saving ? t.saving : t.save}</button></div>
        </form>
      </section></div>}
    </main>
  );
}
