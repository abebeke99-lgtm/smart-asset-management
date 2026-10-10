import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  BookmarkPlus,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  History,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import * as XLSX from 'xlsx';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import './StoreInventory.css';
import './StoreInventoryDetails.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const pageSize = 20;
const emptySummary = {
  total: 0,
  available: 0,
  reserved: 0,
  assigned: 0,
  damaged: 0,
  missing: 0,
  lowStock: 0,
  normalStock: 0,
  criticalStock: 0,
};
const initialFilters = {
  search: '',
  status: '',
  category: '',
  location: '',
  condition: '',
  lowStockOnly: false,
  sortBy: 'itemId',
  sortOrder: 'asc',
};
const english = {
  title: 'Store Inventory',
  subtitle: 'Complete inventory overview, stock control, movements and history',
  refresh: 'Refresh',
  export: 'Excel',
  csv: 'CSV',
  addStock: 'Add Stock',
  addStockTitle: 'Add Stock to Existing Inventory',
  addStockItem: 'Inventory Item',
  addStockQuantity: 'Quantity to Add',
  addStockUnitCost: 'Unit Cost',
  addStockTotalCost: 'Total Cost',
  addStockSupplier: 'Supplier',
  addStockReference: 'Reference Number',
  addStockDate: 'Addition Date',
  addStockReason: 'Reason',
  addStockSubmit: 'Add Stock',
  addStockSaving: 'Adding Stock...',
  addStockSuccess: 'Stock added successfully.',
  addStockError: 'Unable to add stock.',
  addStockRequired: 'Select an item, enter a positive whole-number quantity, reference, date, and reason.',
  close: 'Cancel',
  total: 'Total Items',
  available: 'Available',
  reserved: 'Reserved',
  assigned: 'Assigned',
  damaged: 'Damaged',
  missing: 'Missing',
  lowStock: 'Low Stock',
  overview: 'Inventory Overview',
  search: 'Search by ID, name, serial, RFID...',
  status: 'Status',
  category: 'Category',
  location: 'Location',
  condition: 'Condition',
  lowOnly: 'Low stock only',
  all: 'All',
  clear: 'Clear Filters',
  itemId: 'Item ID',
  name: 'Name',
  quantity: 'Quantity',
  stock: 'Stock Status',
  actions: 'Actions',
  normal: 'Normal',
  low: 'Low Stock',
  critical: 'Critical',
  loading: 'Loading inventory...',
  error: 'Unable to load inventory',
  retry: 'Retry',
  empty: 'No inventory items found',
  filteredEmpty: 'No inventory items match your filters.',
  showing: 'Showing',
  previous: 'Previous',
  next: 'Next',
  details: 'View',
  reserve: 'Reserve',
  receive: 'Receive',
  issue: 'Issue',
  return: 'Return',
  transfer: 'Transfer',
  adjust: 'Adjust',
};
const amharic = {
  ...english,
  title: 'የመጋዘን እቃዎች',
  subtitle: 'የእቃ አጠቃላይ እይታ፣ ቁጥጥር እና ታሪክ',
  refresh: 'አድስ',
  export: 'Excel',
  csv: 'CSV',
  addStock: 'ክምችት ጨምር',
  total: 'ጠቅላላ እቃ',
  available: 'ዝግጁ',
  lowStock: 'ዝቅተኛ ክምችት',
  overview: 'የእቃ አጠቃላይ እይታ',
  search: 'በመለያ፣ ስም፣ ተከታታይ ወይም RFID ፈልግ',
  clear: 'ማጣሪያ አጽዳ',
  loading: 'እቃዎች በመጫን ላይ...',
  error: 'እቃዎችን መጫን አልተቻለም',
  retry: 'እንደገና ሞክር',
  empty: 'የእቃ መዝገብ የለም',
};
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const newSubmissionId = () => `add-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function StoreInventory() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = language === 'en' ? english : amharic;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 0 });
  const [filterOptions, setFilterOptions] = useState({ categories: [], locations: [], conditions: [] });
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [addStockItems, setAddStockItems] = useState([]);
  const [addStockSuppliers, setAddStockSuppliers] = useState([]);
  const [addStockLoading, setAddStockLoading] = useState(false);
  const [addStockSaving, setAddStockSaving] = useState(false);
  const [addStockError, setAddStockError] = useState('');
  const [addStockSuccess, setAddStockSuccess] = useState('');
  const [addStockForm, setAddStockForm] = useState({ assetId: '', quantity: '1', unitPrice: '', supplierId: '', reference: '', date: new Date().toISOString().slice(0, 10), reason: '' });
  const [addStockSupplierError, setAddStockSupplierError] = useState('');
  const addStockLock = useRef(false);
  const addStockSubmissionId = useRef('');

  const loadInventory = useCallback(async (page = 1, refresh = false) => {
    setError('');
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await apiClient.get('/api/store/inventory', {
        params: { ...filters, page, pageSize },
      });
      const payload = response.data;
      if (payload?.success === false) throw new Error('Inventory request failed');

      setItems(Array.isArray(payload?.data) ? payload.data : []);
      setSummary({ ...emptySummary, ...(payload?.summary || {}) });
      setFilterOptions(payload?.filters || { categories: [], locations: [], conditions: [] });
      setPagination({ page, pageSize, ...(payload?.pagination || {}) });
    } catch (requestError) {
      setError(requestError.response?.status === 403 ? 'forbidden' : 'error');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadInventory(1);
  }, [loadInventory]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('addStock') === 'true') openAddStock(params.get('assetId') || '');
  }, [location.search]);

  const openAddStock = async (assetId = '') => {
    addStockSubmissionId.current = newSubmissionId();
    setAddStockForm({ assetId: assetId ? String(assetId) : '', quantity: '1', unitPrice: '', supplierId: '', reference: '', date: new Date().toISOString().slice(0, 10), reason: '' });
    setAddStockItems([]);
    setAddStockSuppliers([]);
    setAddStockError('');
    setAddStockSupplierError('');
    setAddStockSuccess('');
    setShowAddStock(true);
    setAddStockLoading(true);
    const inventoryRequest = (async () => {
      const allItems = [];
      let currentPage = 1;
      let totalPages = 1;
      do {
        const response = await apiClient.get('/api/store/inventory', { params: { page: currentPage, pageSize: 100 } });
        const payload = response.data || {};
        if (payload.success === false || !Array.isArray(payload.data)) throw new Error('Inventory items could not be loaded');
        allItems.push(...payload.data);
        totalPages = Math.max(1, Number(payload.pagination?.totalPages) || 1);
        currentPage += 1;
      } while (currentPage <= totalPages);
      setAddStockItems(allItems);
    })();
    const supplierRequest = apiClient.get('/api/store/receive/suppliers')
      .then((response) => setAddStockSuppliers(Array.isArray(response.data?.data) ? response.data.data : []))
      .catch(() => setAddStockSupplierError('Supplier choices could not be loaded. You can still add stock without selecting a supplier.'));
    try {
      await Promise.all([inventoryRequest, supplierRequest]);
    } catch (requestError) {
      setAddStockError(requestError.response?.data?.message || 'Unable to load inventory items for stock addition.');
    } finally {
      setAddStockLoading(false);
    }
  };

  const submitAddStock = async (event) => {
    event.preventDefault();
    if (addStockLock.current) return;
    const quantity = Number(addStockForm.quantity);
    const unitPrice = addStockForm.unitPrice === '' ? null : Number(addStockForm.unitPrice);
    const date = addStockForm.date;
    const parsedDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
    if (!addStockForm.assetId || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000
      || !addStockForm.reference.trim() || addStockForm.reference.trim().length > 100
      || !addStockForm.reason.trim() || addStockForm.reason.trim().length > 255
      || !date || Number.isNaN(parsedDate?.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      setAddStockError(t.addStockRequired);
      return;
    }
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 9999999999.99 || unitPrice * quantity > 9999999999.99)) {
      setAddStockError('Enter a valid non-negative unit cost and total cost.');
      return;
    }
    addStockLock.current = true;
    setAddStockSaving(true);
    setAddStockError('');
    try {
      await apiClient.post('/api/store/stock-additions', {
        asset_id: Number(addStockForm.assetId),
        quantity,
        unit_price: unitPrice,
        supplier_id: addStockForm.supplierId || null,
        reference: addStockForm.reference.trim(),
        addition_date: date,
        reason: addStockForm.reason.trim(),
        adjustment_type: 'increase',
        submission_id: addStockSubmissionId.current,
      });
      addStockSubmissionId.current = '';
      setShowAddStock(false);
      setAddStockSuccess(t.addStockSuccess);
      await loadInventory(pagination.page, true);
    } catch (requestError) {
      setAddStockError(requestError.response?.data?.message || t.addStockError);
    } finally {
      addStockLock.current = false;
      setAddStockSaving(false);
    }
  };

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = () => setFilters(initialFilters);

  const sortBy = (field) => {
    setFilters((current) => ({
      ...current,
      sortBy: field,
      sortOrder: current.sortBy === field && current.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const openDetails = async (item) => {
    setSelected(item);
    setDetailError('');
    setHistoryError('');
    setHistory([]);
    setHistoryLoading(true);
    const [detailResult, historyResult] = await Promise.allSettled([
      apiClient.get(`/api/store/inventory/${item.id}`),
      apiClient.get('/api/store/history', { params: { assetId: item.asset_id, pageSize: 100 } }),
    ]);

    if (detailResult.status === 'fulfilled') {
      setSelected(detailResult.value.data?.data || item);
    } else {
      setDetailError('Unable to load complete inventory details.');
    }
    if (historyResult.status === 'fulfilled') {
      const movements = historyResult.value.data?.data?.items || [];
      setHistory(movements.map((entry) => ({
        id: entry.id,
        type: entry.movementLabel || entry.movementType,
        quantity: entry.quantity,
        createdAt: entry.createdAt,
      })));
    } else {
      setHistoryError('Unable to load stock history.');
    }
    setHistoryLoading(false);
  };

  const value = (item, camel, snake) => asNumber(item[camel] ?? item[snake]);
  const status = (item) => String(item.assetStatus || item.status || '').replace(/_/g, ' ');
  const stockStatus = (item) => {
    const available = value(item, 'availableQuantity', 'available_quantity');
    const minimum = value(item, 'minimumQuantity', 'min_stock');
    if (available <= 0) return t.critical;
    return item.is_low_stock || available <= minimum ? t.low : t.normal;
  };
  const chart = {
    labels: [t.available, t.reserved, t.assigned, t.damaged, t.missing],
    datasets: [{
      label: t.quantity,
      data: [summary.available, summary.reserved, summary.assigned, summary.damaged, summary.missing],
      backgroundColor: ['#0ea5e9', '#7c3aed', '#3074B3', '#D97706', '#ef4444'],
      borderRadius: 5,
    }],
  };

  const exportInventory = async (format) => {
    setExporting(true);
    setExportError('');
    try {
      const response = await apiClient.get('/api/store/inventory/export', { params: filters });
      const rows = (Array.isArray(response.data?.data) ? response.data.data : []).map((item) => ({
        'Inventory ID': item.item_id || '',
        'Asset ID': item.asset_tag || item.asset_id || '',
        'Item Name': item.name || '',
        Category: item.category || '',
        Subcategory: item.subcategory || '',
        'Serial Number': item.serial_number || '',
        Quantity: value(item, 'quantity'),
        Unit: item.unit || '',
        'Purchase Date': item.purchase_date || '',
        'Purchase Cost': item.purchase_cost || '',
        Supplier: item.supplier || '',
        Status: status(item),
        Condition: item.condition || '',
        'Storage Location': item.location || '',
        Campus: item.campus || '',
        Building: item.building || '',
        Room: item.room || '',
        Warranty: item.warranty_expiry || '',
        'Expiry Date': item.expiry_date || '',
        'QR Code': item.qr_code || '',
        RFID: item.rfid || '',
        'Batch/Lot': item.batch_lot || '',
        'Created Date': item.createdAt || '',
        'Updated Date': item.updatedAt || '',
        Available: value(item, 'availableQuantity', 'available_quantity'),
        Reserved: value(item, 'reservedQuantity', 'reserved_quantity'),
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        const blob = new Blob([`\ufeff${XLSX.utils.sheet_to_csv(sheet)}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `store-inventory-${date}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Inventory');
        XLSX.writeFile(workbook, `store-inventory-${date}.xlsx`);
      }
    } catch (requestError) {
      setExportError(requestError.response?.status === 403
        ? 'You do not have permission to export inventory.'
        : 'Unable to export inventory. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="inventory-state"><RefreshCw size={20} /> {t.loading}</div>;
  }
  if (error) {
    return (
      <div className="inventory-state inventory-error">
        <AlertTriangle size={22} />
        <p>{error === 'forbidden' ? 'You do not have permission to view inventory.' : t.error}</p>
        <button type="button" onClick={() => loadInventory(pagination.page)}>
          <RefreshCw size={16} /> {t.retry}
        </button>
      </div>
    );
  }

  const inventoryActions = [
    { label: t.details, icon: Eye, action: (item) => openDetails(item) },
    { label: t.reserve, icon: BookmarkPlus, route: '/store/requests' },
    { label: t.receive, icon: PackagePlus, route: '/store/receive' },
    { label: t.issue, icon: PackageCheck, route: '/store/issue' },
    { label: t.return, icon: RotateCcw, route: '/store/returns' },
    { label: t.transfer, icon: ArrowLeftRight, route: '/store/transfers' },
    { label: t.adjust, icon: SlidersHorizontal, route: '/store/stock-adjustments' },
  ];
  const sortableColumns = [
    ['itemId', t.itemId],
    ['name', t.name],
    ['category', t.category],
    ['quantity', t.quantity],
    ['status', t.status],
    ['location', t.location],
  ];
  const renderSortHeading = (field, label) => (
    <button
      type="button"
      className="sort-heading"
      onClick={() => sortBy(field)}
      aria-label={`Sort by ${label}`}
      aria-pressed={filters.sortBy === field}
    >
      {label}{filters.sortBy === field ? (filters.sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );

  return (
    <main className="store-inventory-page">
      <header className="inventory-header">
        <div>
          <p className="inventory-eyebrow">Store Manager</p>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="inventory-actions">
          <button type="button" onClick={() => loadInventory(pagination.page, true)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} /> {t.refresh}
          </button>
          <button type="button" onClick={() => exportInventory('xlsx')} disabled={exporting}>
            <Download size={17} className={exporting ? 'spin' : ''} /> {exporting ? 'Exporting...' : t.export}
          </button>
          <button type="button" onClick={() => exportInventory('csv')} disabled={exporting}>
            <Download size={17} /> {t.csv}
          </button>
          <button className="primary-action" type="button" onClick={openAddStock}>
            <PackagePlus size={17} /> {t.addStock}
          </button>
        </div>
      </header>
      {addStockSuccess && <p className="inventory-success-message" role="status">{addStockSuccess}</p>}
      {exportError && <p className="inventory-error-message" role="alert">{exportError}</p>}
      <section className="inventory-kpis">
        {[
          [Boxes, summary.total, t.total],
          [PackageCheck, summary.available, t.available],
          [PackageCheck, summary.reserved, t.reserved],
          [Boxes, summary.assigned, t.assigned],
          [AlertTriangle, summary.damaged, t.damaged],
          [AlertTriangle, summary.missing, t.missing],
          [AlertTriangle, summary.lowStock, t.lowStock],
        ].map(([Icon, amount, label]) => (
          <div className="inventory-kpi" key={label}>
            <span><Icon size={18} /></span>
            <strong>{amount}</strong>
            <small>{label}</small>
          </div>
        ))}
      </section>

      <div className="inventory-layout">
        <section className="inventory-panel">
          <div className="panel-heading">
            <div>
              <p className="inventory-eyebrow">{t.overview}</p>
              <h2>{t.overview}</h2>
            </div>
            <Boxes size={19} />
          </div>
          <div className="inventory-chart">
            <Bar
              data={chart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              }}
            />
          </div>
        </section>
        <section className="inventory-panel">
          <div className="panel-heading"><h2>Stock Levels</h2><Boxes size={19} /></div>
          <div className="stock-list">
            <div><span className="legend normal" />{t.normal}<strong>{summary.normalStock}</strong></div>
            <div><span className="legend low" />{t.low}<strong>{Math.max(0, summary.lowStock - summary.criticalStock)}</strong></div>
            <div><span className="legend critical" />{t.critical}<strong>{summary.criticalStock}</strong></div>
          </div>
        </section>
      </div>

      <section className="inventory-panel filters-panel">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label={t.search}
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder={t.search}
          />
        </div>
        <select aria-label={t.status} value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">{t.all} {t.status}</option>
          {['available', 'reserved', 'assigned', 'issued', 'damaged', 'under_maintenance', 'missing', 'retired', 'disposed'].map((item) => (
            <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select aria-label={t.category} value={filters.category} onChange={(event) => setFilter('category', event.target.value)}>
          <option value="">{t.all} {t.category}</option>
          {filterOptions.categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label={t.location} value={filters.location} onChange={(event) => setFilter('location', event.target.value)}>
          <option value="">{t.all} {t.location}</option>
          {filterOptions.locations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label={t.condition} value={filters.condition} onChange={(event) => setFilter('condition', event.target.value)}>
          <option value="">{t.all} {t.condition}</option>
          {filterOptions.conditions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="check-filter">
          <input
            type="checkbox"
            checked={filters.lowStockOnly}
            onChange={(event) => setFilter('lowStockOnly', event.target.checked)}
          /> {t.lowOnly}
        </label>
        <button className="clear-filter" type="button" onClick={clearFilters}>
          <X size={15} /> {t.clear}
        </button>
      </section>

      <section className="inventory-panel">
        <div className="table-heading">
          <h2>{t.title}</h2>
          <span>
            {t.showing} {pagination.total
              ? `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`
              : '0'}
          </span>
        </div>
        {items.length ? (
          <div className="inventory-table-wrap">
            <table>
              <thead>
                <tr>
                  {sortableColumns.map(([field, label]) => (
                    <th key={field}>{renderSortHeading(field, label)}</th>
                  ))}
                  <th>{t.available}</th>
                  <th>{t.reserved}</th>
                  <th>{t.assigned}</th>
                  <th>{t.stock}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_id || item.asset_tag || item.asset_id || '-'}</td>
                    <td><strong>{item.name || '-'}</strong><small>{item.serial_number || ''}</small></td>
                    <td>{item.category || '-'}</td>
                    <td>{value(item, 'quantity')}</td>
                    <td>{status(item) || '-'}</td>
                    <td>{item.location || '-'}</td>
                    <td>{value(item, 'availableQuantity', 'available_quantity')}</td>
                    <td>{value(item, 'reservedQuantity', 'reserved_quantity')}</td>
                    <td>{value(item, 'issuedQuantity', 'issued_quantity')}</td>
                    <td><span className={`stock-badge ${stockStatus(item).toLowerCase().replace(' ', '-')}`}>{stockStatus(item)}</span></td>
                    <td>
                      <div className="inventory-row-actions">
                        {inventoryActions.map(({ label, icon: Icon, route, action }) => (
                          <button
                            className="detail-button"
                            type="button"
                            key={label}
                            title={label}
                            aria-label={label}
                            onClick={() => action
                              ? action(item)
                              : navigate(route, { state: { assetId: item.asset_id } })}
                          >
                            <Icon size={16} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-inventory">
            <Boxes size={30} />
            <p>
              {filters.search || filters.status || filters.category || filters.location || filters.condition || filters.lowStockOnly
                ? t.filteredEmpty
                : t.empty}
            </p>
            <button type="button" onClick={openAddStock}>
              <PackagePlus size={16} /> {t.addStock}
            </button>
          </div>
        )}
        <footer className="pagination">
          <button type="button" disabled={pagination.page <= 1} onClick={() => loadInventory(pagination.page - 1)}>
            <ChevronLeft size={16} /> {t.previous}
          </button>
          <span>{pagination.page} / {pagination.totalPages || 1}</span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => loadInventory(pagination.page + 1)}
          >
            {t.next} <ChevronRight size={16} />
          </button>
        </footer>
      </section>

      {showAddStock && (
        <div className="inventory-modal-backdrop" role="presentation">
          <section className="inventory-modal add-stock-modal" role="dialog" aria-modal="true" aria-labelledby="add-stock-title">
            <div className="modal-heading">
              <div>
                <p className="inventory-eyebrow">Controlled stock addition</p>
                <h2 id="add-stock-title">{t.addStockTitle}</h2>
              </div>
              <button type="button" aria-label={t.close} onClick={() => setShowAddStock(false)} disabled={addStockSaving}><X size={18} /></button>
            </div>
            {addStockError && <p className="inventory-error-message" role="alert">{addStockError}</p>}
            {addStockSupplierError && <p className="inventory-form-note" role="status">{addStockSupplierError}</p>}
            {addStockLoading ? <p>Loading inventory and supplier choices...</p> : (
              <form className="add-stock-form" onSubmit={submitAddStock}>
                <label>{t.addStockItem}
                  <select required value={addStockForm.assetId} onChange={(event) => setAddStockForm((form) => ({ ...form, assetId: event.target.value }))}>
                    <option value="">Select an existing inventory item</option>
                    {addStockItems.map((item) => (
                      <option key={item.asset_id || item.id} value={item.asset_id || item.id}>
                        {item.asset_tag || item.asset_id || item.id} - {item.name || 'Inventory Item'}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="add-stock-fields">
                  <label>{t.addStockQuantity}
                    <input required type="number" min="1" max="1000000" step="1" value={addStockForm.quantity} onChange={(event) => setAddStockForm((form) => ({ ...form, quantity: event.target.value }))} />
                  </label>
                  <label>{t.addStockUnitCost}
                    <input type="number" min="0" step="0.01" value={addStockForm.unitPrice} onChange={(event) => setAddStockForm((form) => ({ ...form, unitPrice: event.target.value }))} />
                  </label>
                  <label>{t.addStockTotalCost}
                    <input readOnly value={addStockForm.unitPrice !== '' && Number.isFinite(Number(addStockForm.unitPrice)) && Number.isSafeInteger(Number(addStockForm.quantity)) && Number(addStockForm.quantity) > 0 ? (Number(addStockForm.unitPrice) * Number(addStockForm.quantity)).toFixed(2) : ''} />
                  </label>
                  <label>{t.addStockSupplier}
                    <select value={addStockForm.supplierId} onChange={(event) => setAddStockForm((form) => ({ ...form, supplierId: event.target.value }))}>
                      <option value="">No supplier</option>
                      {addStockSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}
                    </select>
                  </label>
                  <label>{t.addStockReference}
                    <input required maxLength="100" value={addStockForm.reference} onChange={(event) => setAddStockForm((form) => ({ ...form, reference: event.target.value }))} />
                  </label>
                  <label>{t.addStockDate}
                    <input required type="date" value={addStockForm.date} onChange={(event) => setAddStockForm((form) => ({ ...form, date: event.target.value }))} />
                  </label>
                </div>
                <label>{t.addStockReason}
                  <textarea required maxLength="255" rows="3" value={addStockForm.reason} onChange={(event) => setAddStockForm((form) => ({ ...form, reason: event.target.value }))} />
                </label>
                <div className="add-stock-actions">
                  <button type="button" onClick={() => setShowAddStock(false)} disabled={addStockSaving}>{t.close}</button>
                  <button className="primary-action" type="submit" disabled={addStockSaving || addStockLoading || addStockItems.length === 0}>
                    {addStockSaving ? t.addStockSaving : t.addStockSubmit}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {selected && (
        <div className="inventory-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <section
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="inventory-eyebrow">Inventory Details</p>
                <h2 id="inventory-details-title">{selected.name || '-'}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            {detailError && <p className="inventory-error-message" role="alert">{detailError}</p>}
            <dl className="inventory-detail-grid">
              {[
                ['Inventory ID', selected.item_id],
                ['Asset ID', selected.asset_tag || selected.asset_id],
                ['Item Name', selected.name],
                ['Category', selected.category],
                ['Subcategory', selected.subcategory],
                ['Serial Number', selected.serial_number],
                ['Quantity', value(selected, 'quantity')],
                ['Unit', selected.unit],
                ['Purchase Date', selected.purchase_date],
                ['Purchase Cost', selected.purchase_cost],
                ['Supplier', selected.supplier],
                ['Status', status(selected)],
                ['Condition', selected.condition],
                ['Storage Location', selected.location],
                ['Campus', selected.campus],
                ['Building', selected.building],
                ['Room', selected.room],
                ['Warranty', selected.warranty_expiry],
                ['Expiry Date', selected.expiry_date],
                ['QR Code', selected.qr_code],
                ['RFID', selected.rfid],
                ['Batch/Lot', selected.batch_lot],
                ['Created Date', selected.createdAt],
                ['Updated Date', selected.updatedAt],
                ['Available', value(selected, 'availableQuantity', 'available_quantity')],
                ['Reserved', value(selected, 'reservedQuantity', 'reserved_quantity')],
                ['Description', selected.description],
                ['Department', selected.department],
              ].map(([label, detail]) => (
                <div key={label}><dt>{label}</dt><dd>{detail || '-'}</dd></div>
              ))}
            </dl>
            <h3><History size={17} /> Stock history</h3>
            {historyLoading ? <p>Loading history...</p> : historyError ? (
              <p className="inventory-error-message" role="alert">{historyError}</p>
            ) : history.length ? history.map((entry) => (
              <div className="inventory-history-item" key={entry.id}>
                <strong><BadgeCheck size={15} /> {String(entry.type || 'Movement').replace(/_/g, ' ')}</strong>
                <span>{entry.quantity ?? '—'} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</span>
              </div>
            )) : <p>No stock movements recorded.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
