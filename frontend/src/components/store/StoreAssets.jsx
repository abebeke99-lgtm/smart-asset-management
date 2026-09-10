import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, MapPin, PackageCheck, RefreshCw, Search, Tag, TriangleAlert, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import axios from 'axios';
import './StoreAssets.css';

const english = { title: 'Available Assets', subtitle: 'Assets currently available for issue from Store', refresh: 'Refresh', export: 'Export', search: 'Search assets...', category: 'Category', location: 'Location', condition: 'Condition', all: 'All', total: 'Total Available', today: 'Available Today', awaiting: 'Awaiting Issue', low: 'Low Stock', id: 'Asset ID', name: 'Asset Name', tag: 'Asset Tag', serial: 'Serial Number', status: 'Availability', issue: 'Issue', registered: 'Registered', notRegistered: 'Not registered', loading: 'Loading available assets...', error: 'Unable to load available assets.', forbidden: 'You do not have permission to view available assets.', retry: 'Retry', empty: 'No available assets', emptyText: 'There are currently no assets available for issue.', filtered: 'No available assets match your filters.', clear: 'Clear Filters', previous: 'Previous', next: 'Next', of: 'of' };
const amharic = { ...english, title: 'ዝግጁ ንብረቶች', subtitle: 'ከመጋዘን ለመስጠት በአሁኑ ጊዜ ዝግጁ የሆኑ ንብረቶች', refresh: 'አድስ', export: 'ላክ', search: 'ንብረት ፈልግ...', total: 'ጠቅላላ ዝግጁ', issue: 'ስጥ', loading: 'ዝግጁ ንብረቶች በመጫን ላይ...', error: 'ዝግጁ ንብረቶችን መጫን አልተቻለም።', retry: 'እንደገና ሞክር', empty: 'ዝግጁ ንብረት የለም', clear: 'ማጣሪያ አጽዳ' };
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function StoreAssets() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = language === 'en' ? english : amharic;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalAvailable: 0, availableToday: 0, awaitingIssue: 0, lowStock: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', category: '', location: '', condition: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (page = 1, refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError('');
    try {
      const response = await axios.get('/api/store/available-assets', { params: { ...filters, page, pageSize: 20, sortBy: 'name', sortOrder: 'asc' } });
      const payload = response.data?.data || {};
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSummary({ totalAvailable: 0, availableToday: 0, awaitingIssue: 0, lowStock: 0, ...(payload.summary || {}) });
      setPagination({ page, pageSize: 20, ...(payload.pagination || {}) });
    } catch (requestError) { setItems([]); setError(requestError.response?.status === 403 ? 'forbidden' : 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(1); }, [filters]);
  const options = useMemo(() => ({ categories: [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), locations: [...new Set(items.map((item) => item.location).filter(Boolean))].sort(), conditions: [...new Set(items.map((item) => item.condition).filter(Boolean))].sort() }), [items]);
  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const clearFilters = () => setFilters({ search: '', category: '', location: '', condition: '' });
  const exportItems = async () => {
    const first = await axios.get('/api/store/available-assets', { params: { ...filters, page: 1, pageSize: 100 } });
    const payload = first.data?.data || {}; const allItems = payload.items || [];
    const responses = await Promise.all(Array.from({ length: Math.max(0, (payload.pagination?.totalPages || 1) - 1) }, (_, index) => axios.get('/api/store/available-assets', { params: { ...filters, page: index + 2, pageSize: 100 } })));
    responses.forEach((response) => allItems.push(...(response.data?.data?.items || [])));
    const rows = allItems.map((item) => ({ 'Asset ID': item.assetId || item.id, 'Asset Name': item.name || '', Category: item.category || '', 'Asset Tag': item.assetCode || '', 'Serial Number': item.serialNumber || t.notRegistered, Condition: item.condition || '', Location: item.location || '', Availability: item.status || 'Available', RFID: item.rfidTag || t.notRegistered }));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Available Assets'); XLSX.writeFile(workbook, `available-assets-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  if (loading) return <div className="available-state"><RefreshCw size={20} /> {t.loading}</div>;
  if (error) return <div className="available-state available-error"><TriangleAlert size={22} /><p>{t[error]}</p><button type="button" onClick={() => load(pagination.page)}><RefreshCw size={16} /> {t.retry}</button></div>;
  const filteredEmpty = filters.search || filters.category || filters.location || filters.condition;
  return <main className="available-page"><header className="available-header"><div><p className="available-eyebrow">Store Manager</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="available-actions"><button type="button" onClick={() => load(pagination.page, true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /> {t.refresh}</button><button type="button" onClick={exportItems}><Download size={17} /> {t.export}</button></div></header><section className="available-kpis">{[[PackageCheck, summary.totalAvailable, t.total], [CheckCircle2, summary.availableToday, t.today], [Tag, summary.awaitingIssue, t.awaiting], [TriangleAlert, summary.lowStock, t.low]].map(([Icon, amount, label]) => <div className="available-kpi" key={label}><span><Icon size={18} /></span><strong>{amount}</strong><small>{label}</small></div>)}</section><section className="available-panel available-filters"><div className="available-search"><Search size={17} /><input aria-label={t.search} value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder={t.search} /></div><select aria-label={t.category} value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="">{t.all} {t.category}</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label={t.location} value={filters.location} onChange={(event) => setFilter('location', event.target.value)}><option value="">{t.all} {t.location}</option>{options.locations.map((item) => <option key={item}>{item}</option>)}</select><select aria-label={t.condition} value={filters.condition} onChange={(event) => setFilter('condition', event.target.value)}><option value="">{t.all} {t.condition}</option>{options.conditions.map((item) => <option key={item}>{item}</option>)}</select><button className="clear-available" type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button></section><section className="available-panel"><div className="available-table-heading"><div><p className="available-eyebrow">Store Inventory</p><h2>{t.title}</h2></div><span>{pagination.total ? `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} ${t.of} ${pagination.total}` : '0'}</span></div>{items.length ? <div className="available-table-wrap"><table><thead><tr><th>{t.id}</th><th>{t.name}</th><th>{t.category}</th><th>{t.tag}</th><th>{t.serial}</th><th>{t.condition}</th><th><MapPin size={14} /> {t.location}</th><th>{t.status}</th><th>{t.issue}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.assetId || item.id}</td><td><strong>{item.name || '-'}</strong></td><td>{item.category || '-'}</td><td>{item.assetCode || t.notRegistered}</td><td>{item.serialNumber || t.notRegistered}</td><td>{item.condition || '-'}</td><td>{item.location || '-'}</td><td><span className="available-badge"><CheckCircle2 size={14} /> {item.status || 'Available'}</span></td><td><button className="issue-button" type="button" onClick={() => navigate('/store/issue')}><PackageCheck size={15} /> {t.issue}</button></td></tr>)}</tbody></table></div> : <div className="available-empty"><PackageCheck size={32} /><h3>{filteredEmpty ? t.filtered : t.empty}</h3><p>{filteredEmpty ? t.clear : t.emptyText}</p>{filteredEmpty && <button type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button>}</div>}<footer className="available-pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft size={16} /> {t.previous}</button><span>{pagination.page} / {pagination.totalPages || 1}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>{t.next} <ChevronRight size={16} /></button></footer></section></main>;
}
