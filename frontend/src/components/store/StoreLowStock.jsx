import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Download, MapPin, PackageOpen, PackageSearch, RefreshCw, Search, Tag, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import axios from 'axios';
import './StoreLowStock.css';

const english = { title: 'Low Stock Alerts', subtitle: 'Monitor inventory items that require replenishment.', refresh: 'Refresh', export: 'Export', inventory: 'View Inventory', search: 'Search items, tags, serials...', severity: 'Severity', category: 'Category', location: 'Location', all: 'All', clear: 'Clear Filters', lowStock: 'Total Low Stock', critical: 'Critical', outOfStock: 'Out of Stock', shortage: 'Total Shortage', categories: 'Categories Affected', locations: 'Locations Affected', item: 'Item / Asset', code: 'Asset Tag', current: 'Current Stock', available: 'Available', reserved: 'Reserved', assigned: 'Assigned', reorder: 'Reorder Level', severityCol: 'Severity', updated: 'Last Updated', action: 'Action', addStock: 'Add Stock', low: 'LOW', out: 'OUT OF STOCK', loading: 'Loading low-stock alerts...', error: 'Unable to load low-stock alerts.', forbidden: 'You do not have permission to view low-stock alerts.', retry: 'Retry', empty: 'No low-stock items', emptyText: 'All monitored inventory is currently above its reorder threshold.', filtered: 'No matching low-stock items', filteredText: 'Try changing your filters or search.', previous: 'Previous', next: 'Next', of: 'of', notRegistered: 'Not registered' };
const amharic = { ...english, title: 'የዝቅተኛ ክምችት ማስጠንቀቂያዎች', subtitle: 'መሙላት የሚያስፈልጋቸውን እቃዎች ይከታተሉ።', refresh: 'አድስ', export: 'ላክ', inventory: 'እቃዎችን ይመልከቱ', search: 'እቃ፣ መለያ ወይም ተከታታይ ፈልግ...', severity: 'አስቸኳይነት', category: 'ምድብ', location: 'ቦታ', all: 'ሁሉም', clear: 'ማጣሪያ አጽዳ', lowStock: 'ጠቅላላ ዝቅተኛ', critical: 'አስቸኳይ', outOfStock: 'ከክምችት ውጭ', shortage: 'ጠቅላላ እጥረት', loading: 'የዝቅተኛ ክምችት ማስጠንቀቂያዎች በመጫን ላይ...', error: 'ማስጠንቀቂያዎችን መጫን አልተቻለም።', retry: 'እንደገና ሞክር', empty: 'ዝቅተኛ ክምችት የለም', filtered: 'የሚዛመድ ዝቅተኛ ክምችት የለም', addStock: 'እቃ ጨምር' };
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function StoreLowStock() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = language === 'en' ? english : amharic;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ lowStock: 0, critical: 0, outOfStock: 0, totalShortage: 0, categoriesAffected: 0, locationsAffected: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', severity: '', category: '', location: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (page = 1, refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError('');
    try {
      const response = await axios.get('/api/store/low-stock', { params: { ...filters, page, pageSize: 25, sortBy: 'shortage', sortOrder: 'desc' } });
      const payload = response.data?.data || {};
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSummary({ lowStock: 0, critical: 0, outOfStock: 0, totalShortage: 0, categoriesAffected: 0, locationsAffected: 0, ...(payload.summary || {}) });
      setPagination({ page, pageSize: 25, ...(payload.pagination || {}) });
    } catch (requestError) { setItems([]); setError(requestError.response?.status === 403 ? 'forbidden' : 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(1); }, [filters]);
  const options = useMemo(() => ({ categories: [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), locations: [...new Set(items.map((item) => item.location).filter(Boolean))].sort() }), [items]);
  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const clearFilters = () => setFilters({ search: '', severity: '', category: '', location: '' });
  const exportItems = async () => {
    const first = await axios.get('/api/store/low-stock', { params: { ...filters, page: 1, pageSize: 100, sortBy: 'shortage', sortOrder: 'desc' } });
    const firstPayload = first.data?.data || {}; const allItems = [...(firstPayload.items || [])];
    const responses = await Promise.all(Array.from({ length: Math.max(0, (firstPayload.pagination?.totalPages || 1) - 1) }, (_, index) => axios.get('/api/store/low-stock', { params: { ...filters, page: index + 2, pageSize: 100, sortBy: 'shortage', sortOrder: 'desc' } })));
    responses.forEach((response) => allItems.push(...(response.data?.data?.items || [])));
    const rows = allItems.map((item) => ({ Item: item.item, Category: item.category, 'Asset Tag': item.assetCode, 'Current Stock': item.currentStock, Available: item.available, Reserved: item.reserved, Assigned: item.assigned, 'Reorder Level': item.reorderLevel, Shortage: item.shortage, Severity: item.severity, Location: item.location, 'Last Updated': item.lastUpdated }));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Low Stock'); XLSX.writeFile(workbook, `low-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const severityLabel = (severity) => severity === 'OUT_OF_STOCK' ? t.out : severity === 'CRITICAL' ? t.critical : t.low;
  if (loading) return <div className="low-stock-state"><RefreshCw size={20} /> {t.loading}</div>;
  if (error) return <div className="low-stock-state low-stock-error"><AlertTriangle size={22} /><p>{t[error]}</p><button type="button" onClick={() => load(pagination.page)}><RefreshCw size={16} /> {t.retry}</button></div>;
  const filteredEmpty = filters.search || filters.severity || filters.category || filters.location;
  return <main className="low-stock-page"><header className="low-stock-header"><div><p className="low-stock-eyebrow">Store Inventory</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="low-stock-actions"><button type="button" onClick={() => load(pagination.page, true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /> {t.refresh}</button><button type="button" onClick={exportItems}><Download size={17} /> {t.export}</button><button className="low-stock-primary" type="button" onClick={() => navigate('/store/inventory')}><PackageSearch size={17} /> {t.inventory}</button></div></header><section className="low-stock-kpis">{[[PackageOpen, summary.lowStock, t.lowStock], [AlertTriangle, summary.critical, t.critical], [AlertCircle, summary.outOfStock, t.outOfStock], [Tag, summary.totalShortage, t.shortage], [PackageSearch, summary.categoriesAffected, t.categories], [MapPin, summary.locationsAffected, t.locations]].map(([Icon, value, label]) => <div className="low-stock-kpi" key={label}><span><Icon size={18} /></span><strong>{number(value)}</strong><small>{label}</small></div>)}</section><section className="low-stock-panel low-stock-filters"><div className="low-stock-search"><Search size={17} /><input aria-label={t.search} value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder={t.search} /></div><select aria-label={t.severity} value={filters.severity} onChange={(event) => setFilter('severity', event.target.value)}><option value="">{t.all} {t.severity}</option><option value="out_of_stock">{t.out}</option><option value="critical">{t.critical}</option><option value="low">{t.low}</option></select><select aria-label={t.category} value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="">{t.all} {t.category}</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label={t.location} value={filters.location} onChange={(event) => setFilter('location', event.target.value)}><option value="">{t.all} {t.location}</option>{options.locations.map((item) => <option key={item}>{item}</option>)}</select><button className="low-stock-clear" type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button></section><section className="low-stock-panel"><div className="low-stock-table-heading"><div><p className="low-stock-eyebrow">{t.lowStock}</p><h2>{t.title}</h2></div><span>{pagination.total ? `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} ${t.of} ${pagination.total}` : '0'}</span></div>{items.length ? <div className="low-stock-table-wrap"><table><thead><tr><th>{t.item}</th><th>{t.code}</th><th>{t.current}</th><th>{t.available}</th><th>{t.reserved}</th><th>{t.assigned}</th><th>{t.reorder}</th><th>{t.shortage}</th><th>{t.severityCol}</th><th><MapPin size={14} /> {t.location}</th><th>{t.action}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.item}</strong><small>{item.category || '-'}</small></td><td>{item.assetCode || t.notRegistered}</td><td>{number(item.currentStock)}</td><td>{number(item.available)}</td><td>{number(item.reserved)}</td><td>{number(item.assigned)}</td><td>{number(item.reorderLevel)}</td><td className="shortage-value">{number(item.shortage)}</td><td><span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity === 'OUT_OF_STOCK' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />} {severityLabel(item.severity)}</span></td><td>{item.location || '-'}</td><td><button className="low-stock-action" type="button" onClick={() => navigate('/store/receive')}><PackageSearch size={15} /> {t.addStock}</button></td></tr>)}</tbody></table></div> : <div className="low-stock-empty"><PackageOpen size={32} /><h3>{filteredEmpty ? t.filtered : t.empty}</h3><p>{filteredEmpty ? t.filteredText : t.emptyText}</p>{filteredEmpty && <button type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button>}</div>}<footer className="low-stock-pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft size={16} /> {t.previous}</button><span>{pagination.page} / {pagination.totalPages || 1}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>{t.next} <ChevronRight size={16} /></button></footer></section></main>;
}
