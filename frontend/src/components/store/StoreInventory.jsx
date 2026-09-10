import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, ChevronLeft, ChevronRight, Download, Filter, MapPin, PackageCheck, PackagePlus, RefreshCw, Search, X } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import axios from 'axios';
import './StoreInventory.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
const emptySummary = { total: 0, available: 0, reserved: 0, assigned: 0, damaged: 0, missing: 0, lowStock: 0 };
const english = { title: 'Store Inventory', subtitle: 'Complete inventory overview, stock control, movements and history', refresh: 'Refresh', export: 'Export', addStock: 'Add Stock', total: 'Total Items', available: 'Available', reserved: 'Reserved', assigned: 'Assigned', damaged: 'Damaged', missing: 'Missing', lowStock: 'Low Stock', overview: 'Inventory Overview', search: 'Search by ID, name, serial, RFID...', status: 'Status', category: 'Category', location: 'Location', condition: 'Condition', lowOnly: 'Low stock only', all: 'All', clear: 'Clear Filters', itemId: 'Item ID', name: 'Name', quantity: 'Quantity', stock: 'Stock Status', actions: 'Actions', normal: 'Normal', low: 'Low Stock', critical: 'Critical', loading: 'Loading inventory...', error: 'Unable to load inventory', retry: 'Retry', empty: 'No inventory items found', filteredEmpty: 'No inventory items match your filters.', showing: 'Showing', previous: 'Previous', next: 'Next', exportSuccess: 'Inventory exported successfully', details: 'View' };
const amharic = { ...english, title: 'የመጋዘን እቃዎች', subtitle: 'የእቃ አጠቃላይ እይታ፣ ቁጥጥር እና ታሪክ', refresh: 'አድስ', export: 'ላክ', addStock: 'እቃ ጨምር', total: 'ጠቅላላ እቃ', available: 'ዝግጁ', lowStock: 'ዝቅተኛ ክምችት', overview: 'የእቃ አጠቃላይ እይታ', search: 'በመለያ፣ ስም፣ ተከታታይ ወይም RFID ፈልግ', clear: 'ማጣሪያ አጽዳ', loading: 'እቃዎች በመጫን ላይ...', error: 'እቃዎችን መጫን አልተቻለም', retry: 'እንደገና ሞክር', empty: 'የእቃ መዝገብ የለም' };
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function StoreInventory() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = language === 'en' ? english : amharic;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', category: '', location: '', condition: '', lowStockOnly: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const loadInventory = async (page = 1, refresh = false) => {
    setError('');
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await axios.get('/api/store/inventory', { params: { ...filters, page, pageSize: 20 } });
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
      setSummary({ ...emptySummary, ...(response.data?.summary || {}) });
      setPagination({ page, pageSize: 20, ...(response.data?.pagination || {}) });
    } catch (requestError) {
      setError(requestError.response?.status === 403 ? 'forbidden' : 'error');
      setItems([]);
    } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { loadInventory(1); }, [filters]);

  const filterOptions = useMemo(() => ({
    categories: [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    locations: [...new Set(items.map((item) => item.location).filter(Boolean))].sort(),
    conditions: [...new Set(items.map((item) => item.condition).filter(Boolean))].sort(),
  }), [items]);
  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const clearFilters = () => setFilters({ search: '', status: '', category: '', location: '', condition: '', lowStockOnly: false });
  const value = (item, camel, snake) => asNumber(item[camel] ?? item[snake]);
  const status = (item) => String(item.assetStatus || item.status || '').replace(/_/g, ' ');
  const stockStatus = (item) => item.is_low_stock || value(item, 'availableQuantity', 'available_quantity') <= value(item, 'minimumQuantity', 'min_stock') ? value(item, 'availableQuantity', 'available_quantity') <= 0 ? t.critical : t.low : t.normal;
  const chart = { labels: [t.available, t.reserved, t.assigned, t.damaged, t.missing], datasets: [{ label: t.quantity, data: [summary.available, summary.reserved, summary.assigned, summary.damaged, summary.missing], backgroundColor: ['#0ea5e9', '#7c3aed', '#2563eb', '#f59e0b', '#ef4444'], borderRadius: 5 }] };

  const exportInventory = async () => {
    setExporting(true);
    try {
      const first = await axios.get('/api/store/inventory', { params: { ...filters, page: 1, pageSize: 100 } });
      const firstPage = Array.isArray(first.data?.data) ? first.data.data : [];
      const totalPages = first.data?.pagination?.totalPages || 1;
      const remaining = await Promise.all(Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => axios.get('/api/store/inventory', { params: { ...filters, page: index + 2, pageSize: 100 } })));
      const allItems = firstPage.concat(...remaining.map((response) => Array.isArray(response.data?.data) ? response.data.data : []));
      const rows = allItems.map((item) => ({ 'Asset ID': item.asset_tag || item.asset_id || '', Name: item.name || '', Category: item.category || '', Quantity: value(item, 'quantity'), Available: value(item, 'availableQuantity', 'available_quantity'), Reserved: value(item, 'reservedQuantity', 'reserved_quantity'), Assigned: value(item, 'issuedQuantity', 'issued_quantity'), Status: status(item), Location: item.location || '', Condition: item.condition || '', 'Stock Status': stockStatus(item) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Inventory');
      XLSX.writeFile(workbook, `store-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (requestError) {
      setError(requestError.response?.status === 403 ? 'forbidden' : 'error');
    } finally { setExporting(false); }
  };

  if (loading) return <div className="inventory-state"><RefreshCw size={20} /> {t.loading}</div>;
  if (error) return <div className="inventory-state inventory-error"><AlertTriangle size={22} /><p>{error === 'forbidden' ? 'You do not have permission to view inventory.' : t.error}</p><button type="button" onClick={() => loadInventory(pagination.page)}><RefreshCw size={16} /> {t.retry}</button></div>;

  return <main className="store-inventory-page">
    <header className="inventory-header"><div><p className="inventory-eyebrow">Store Manager</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="inventory-actions"><button type="button" onClick={() => loadInventory(pagination.page, true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /> {t.refresh}</button><button type="button" onClick={exportInventory} disabled={exporting}><Download size={17} className={exporting ? 'spin' : ''} /> {exporting ? 'Exporting...' : t.export}</button><button className="primary-action" type="button" onClick={() => navigate('/store/receive')}><PackagePlus size={17} /> {t.addStock}</button></div></header>
    <section className="inventory-kpis">{[[Boxes, summary.total, t.total], [PackageCheck, summary.available, t.available], [PackageCheck, summary.reserved, t.reserved], [Boxes, summary.assigned, t.assigned], [AlertTriangle, summary.damaged, t.damaged], [AlertTriangle, summary.missing, t.missing], [AlertTriangle, summary.lowStock, t.lowStock]].map(([Icon, amount, label]) => <div className="inventory-kpi" key={label}><span><Icon size={18} /></span><strong>{amount}</strong><small>{label}</small></div>)}</section>
    <div className="inventory-layout"><section className="inventory-panel"><div className="panel-heading"><div><p className="inventory-eyebrow">{t.overview}</p><h2>{t.overview}</h2></div><BarChartIcon /></div><div className="inventory-chart"><Bar data={chart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></section><section className="inventory-panel"><div className="panel-heading"><h2>Stock Levels</h2><Boxes size={19} /></div><div className="stock-list"><div><span className="legend normal" />{t.normal}<strong>{Math.max(0, summary.total - summary.lowStock)}</strong></div><div><span className="legend low" />{t.low}<strong>{summary.lowStock}</strong></div><div><span className="legend critical" />{t.critical}<strong>{items.filter((item) => value(item, 'availableQuantity', 'available_quantity') <= 0).length}</strong></div></div></section></div>
    <section className="inventory-panel filters-panel"><div className="search-field"><Search size={17} /><input aria-label={t.search} value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder={t.search} /></div><select aria-label={t.status} value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">{t.all} {t.status}</option>{['available', 'reserved', 'assigned', 'damaged', 'missing', 'under_inspection', 'disposed'].map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}</select><select aria-label={t.category} value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="">{t.all} {t.category}</option>{filterOptions.categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label={t.location} value={filters.location} onChange={(event) => setFilter('location', event.target.value)}><option value="">{t.all} {t.location}</option>{filterOptions.locations.map((item) => <option key={item}>{item}</option>)}</select><select aria-label={t.condition} value={filters.condition} onChange={(event) => setFilter('condition', event.target.value)}><option value="">{t.all} {t.condition}</option>{filterOptions.conditions.map((item) => <option key={item}>{item}</option>)}</select><label className="check-filter"><input type="checkbox" checked={filters.lowStockOnly} onChange={(event) => setFilter('lowStockOnly', event.target.checked)} /> {t.lowOnly}</label><button className="clear-filter" type="button" onClick={clearFilters}><X size={15} /> {t.clear}</button></section>
    <section className="inventory-panel"><div className="table-heading"><h2>{t.title}</h2><span>{t.showing} {pagination.total ? `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} ${t.of || 'of'} ${pagination.total}` : '0'}</span></div>{items.length ? <div className="inventory-table-wrap"><table><thead><tr><th>{t.itemId}</th><th>{t.name}</th><th>{t.category}</th><th>{t.quantity}</th><th>{t.available}</th><th>{t.reserved}</th><th>{t.assigned}</th><th>{t.status}</th><th><MapPin size={14} /> {t.location}</th><th>{t.stock}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.asset_tag || item.asset_id || item.item_id || '-'}</td><td><strong>{item.name || '-'}</strong><small>{item.serial_number || ''}</small></td><td>{item.category || '-'}</td><td>{value(item, 'quantity')}</td><td>{value(item, 'availableQuantity', 'available_quantity')}</td><td>{value(item, 'reservedQuantity', 'reserved_quantity')}</td><td>{value(item, 'issuedQuantity', 'issued_quantity')}</td><td>{status(item) || '-'}</td><td>{item.location || '-'}</td><td><span className={`stock-badge ${stockStatus(item).toLowerCase().replace(' ', '-')}`}>{stockStatus(item)}</span></td></tr>)}</tbody></table></div> : <div className="empty-inventory"><Boxes size={30} /><p>{filters.search || filters.status || filters.category || filters.location || filters.condition || filters.lowStockOnly ? t.filteredEmpty : t.empty}</p><button type="button" onClick={() => navigate('/store/receive')}><PackagePlus size={16} /> {t.addStock}</button></div>}<footer className="pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => loadInventory(pagination.page - 1)}><ChevronLeft size={16} /> {t.previous}</button><span>{pagination.page} / {pagination.totalPages || 1}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => loadInventory(pagination.page + 1)}>{t.next} <ChevronRight size={16} /></button></footer></section>
  </main>;
}
function BarChartIcon() { return <Boxes size={19} />; }
