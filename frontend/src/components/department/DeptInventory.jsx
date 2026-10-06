/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './DeptInventory.css';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 200;
const EMPTY_SUMMARY = {
  totalItems: 0,
  totalQuantity: 0,
  availableQuantity: 0,
  lowStock: 0,
  outOfStock: 0,
  damaged: 0,
};

const normalizeInventoryItem = (item = {}) => {
  const quantity = Number(item.quantity ?? item.total_quantity ?? item.totalQuantity ?? 0);
  const available = Number(item.available_quantity ?? item.availableQuantity ?? 0);
  const damaged = Number(item.damaged_quantity ?? item.damagedQuantity ?? 0);
  const minimum = Number(item.min_stock ?? item.minimum_quantity ?? item.minimumQuantity ?? 0);
  const condition = String(item.condition || item.asset_condition || item.assetCondition || 'Good').trim() || 'Good';
  const status = String(item.status || item.stock_status || 'Normal').trim() || 'Normal';

  return {
    id: item.id,
    inventoryId: item.inventory_id || item.item_id || item.id,
    name: item.name || item.asset_name || item.assetName || 'Unnamed item',
    category: item.category || item.asset_category || item.assetCategory || 'Uncategorized',
    quantity,
    availableQuantity: available,
    damagedQuantity: damaged,
    minStock: minimum,
    location: item.location || item.asset_location || item.site || 'Not specified',
    condition,
    status,
    assigned: quantity > available,
    isLowStock: available > 0 && available <= minimum,
    isOutOfStock: available <= 0,
    department: item.department || item.department_name || item.Department?.name || '',
    serialNumber: item.serial_number || item.serialNumber || '',
    supplier: item.supplier || item.vendor || '',
    details: item.description || item.asset_description || item.assetDescription || '',
    assetTag: item.asset_tag || item.assetTag || item.asset_code || item.assetCode || '',
  };
};

const DeptInventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [filters, setFilters] = useState({
    search: '',
    stockLevel: 'all',
    category: 'all',
    location: 'all',
    condition: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);

  const permissionList = Array.isArray(user?.permissions) ? user.permissions : [];
  const canExport = permissionList.includes('reports.export') || permissionList.includes('inventory.export') || permissionList.includes('assets.export');

  const categories = useMemo(() => Array.from(new Set(inventory.map((entry) => entry.category))).filter(Boolean).sort(), [inventory]);
  const locations = useMemo(() => Array.from(new Set(inventory.map((entry) => entry.location))).filter(Boolean).sort(), [inventory]);
  const conditions = useMemo(() => Array.from(new Set(inventory.map((entry) => entry.condition))).filter(Boolean).sort(), [inventory]);

  const fetchInventory = useCallback(async (requestedPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: requestedPage,
        limit: PAGE_SIZE,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.stockLevel !== 'all') params.stockLevel = filters.stockLevel;
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.location !== 'all') params.location = filters.location;

      const response = await apiClient.get('/api/inventory', { params });
      const payload = response.data || {};
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setInventory(rows.map(normalizeInventoryItem));
      setSummary({
        ...EMPTY_SUMMARY,
        ...(payload.summary || {}),
      });
      setPagination(payload.pagination || { page: requestedPage, total: 0, totalPages: 1 });
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Unable to load department inventory.');
      setError(message);
      setInventory([]);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchInventory(page);
  }, [fetchInventory, page]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInventory(page);
  };

  const applyFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', stockLevel: 'all', category: 'all', location: 'all', condition: 'all' });
    setPage(1);
  };

  const visibleInventory = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return inventory.filter((entry) => {
      const matchesQuery = !query || [entry.name, entry.category, entry.location, entry.assetTag, entry.serialNumber, entry.condition]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStockLevel = filters.stockLevel === 'all'
        || (filters.stockLevel === 'available' && entry.availableQuantity > 0)
        || (filters.stockLevel === 'low' && entry.isLowStock)
        || (filters.stockLevel === 'out' && entry.isOutOfStock)
        || (filters.stockLevel === 'damaged' && entry.damagedQuantity > 0);
      const matchesCategory = filters.category === 'all' || entry.category === filters.category;
      const matchesLocation = filters.location === 'all' || entry.location === filters.location;
      const matchesCondition = filters.condition === 'all' || entry.condition === filters.condition;
      return matchesQuery && matchesStockLevel && matchesCategory && matchesLocation && matchesCondition;
    });
  }, [filters, inventory]);

  const exportInventory = async () => {
    if (!canExport) return;
    try {
      const params = {
        page: 1,
        limit: EXPORT_PAGE_SIZE,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.stockLevel !== 'all') params.stockLevel = filters.stockLevel;
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.location !== 'all') params.location = filters.location;
      const response = await apiClient.get('/api/inventory', { params });
      const payload = response.data || {};
      const rows = Array.isArray(payload.data) ? payload.data.map(normalizeInventoryItem) : [];
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows.map((entry) => ({
        Item: entry.name,
        Category: entry.category,
        Quantity: entry.quantity,
        Available: entry.availableQuantity,
        Damaged: entry.damagedQuantity,
        Location: entry.location,
        Condition: entry.condition,
        Status: entry.status,
        Assigned: entry.assigned ? 'Assigned' : 'Unassigned',
        LowStock: entry.isLowStock ? 'Yes' : 'No',
        AssetTag: entry.assetTag,
        Serial: entry.serialNumber,
        Supplier: entry.supplier,
      })));
      XLSX.utils.book_append_sheet(workbook, sheet, 'Department Inventory');
      XLSX.writeFile(workbook, 'department-inventory.xlsx');
      toast.success('Inventory export generated.');
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'Unable to export department inventory.'));
    }
  };

  const totalPages = Math.max(Number(pagination.totalPages || 1), 1);

  return (
    <section className="department-inventory-page">
      <header className="department-inventory-header">
        <div>
          <div className="department-inventory-breadcrumb">
            <Package size={15} aria-hidden="true" /> Department Inventory
          </div>
          <h1>Department Inventory</h1>
          <p>Real authorized inventory for the current department scope.</p>
        </div>

        <div className="department-inventory-header-actions">
          {canExport && (
            <button type="button" className="department-inventory-button primary" onClick={exportInventory} disabled={loading}>
              <Download size={17} aria-hidden="true" /> Export
            </button>
          )}
          <button type="button" className="department-inventory-button" onClick={handleRefresh} disabled={loading || refreshing}>
            <RefreshCw size={17} aria-hidden="true" className={refreshing ? 'is-spinning' : ''} /> Refresh
          </button>
        </div>
      </header>

      {!loading && !error && (
        <div className="department-inventory-summary" aria-label="Inventory summary">
          <div className="summary-tile blue">
            <Package size={18} aria-hidden="true" />
            <div>
              <span>Total Items</span>
              <strong>{summary.totalItems || 0}</strong>
            </div>
          </div>
          <div className="summary-tile green">
            <Boxes size={18} aria-hidden="true" />
            <div>
              <span>Stock</span>
              <strong>{summary.totalQuantity || 0}</strong>
            </div>
          </div>
          <div className="summary-tile purple">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <span>Available</span>
              <strong>{summary.availableQuantity || 0}</strong>
            </div>
          </div>
          <div className="summary-tile amber">
            <TrendingDown size={18} aria-hidden="true" />
            <div>
              <span>Low Stock</span>
              <strong>{summary.lowStock || 0}</strong>
            </div>
          </div>
          <div className="summary-tile red">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <span>Damaged</span>
              <strong>{summary.damaged || 0}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="department-inventory-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            placeholder="Search inventory"
            onChange={(event) => applyFilter('search', event.target.value)}
          />
        </label>

        <div className="toolbar-selects">
          <select value={filters.stockLevel} onChange={(event) => applyFilter('stockLevel', event.target.value)}>
            <option value="all">All stock</option>
            <option value="available">Available</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="damaged">Damaged</option>
          </select>

          <select value={filters.category} onChange={(event) => applyFilter('category', event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select value={filters.location} onChange={(event) => applyFilter('location', event.target.value)}>
            <option value="all">All locations</option>
            {locations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>

          <select value={filters.condition} onChange={(event) => applyFilter('condition', event.target.value)}>
            <option value="all">All conditions</option>
            {conditions.map((condition) => (
              <option key={condition} value={condition}>{condition}</option>
            ))}
          </select>

          <button type="button" className="department-inventory-button subtle" onClick={clearFilters}>
            <Filter size={16} aria-hidden="true" /> Clear
          </button>
        </div>
      </div>

      {error && <div className="department-inventory-error" role="alert">{error}</div>}

      {loading ? (
        <div className="department-inventory-empty">Loading department inventory...</div>
      ) : visibleInventory.length === 0 ? (
        <div className="department-inventory-empty">
          <AlertTriangle size={18} aria-hidden="true" /> No inventory items match the current filters.
        </div>
      ) : (
        <>
          <div className="department-inventory-table-wrap">
            <table className="department-inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Stock</th>
                  <th>Availability</th>
                  <th>Location</th>
                  <th>Condition</th>
                  <th>Assignment</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleInventory.map((item) => (
                  <tr key={item.inventoryId ?? item.id}>
                    <td>
                      <div className="item-cell">
                        <div className="item-name">{item.name}</div>
                        <div className="item-meta">
                          {item.category} · {item.assetTag || item.serialNumber || 'No reference'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stock-cell">
                        <strong>{item.quantity}</strong>
                        <span>available {item.availableQuantity}</span>
                        {item.damagedQuantity > 0 && <span className="mini-pill danger">{item.damagedQuantity} damaged</span>}
                        {item.isLowStock && <span className="mini-pill warning">Low stock</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${item.isOutOfStock ? 'out' : item.isLowStock ? 'warning' : 'ok'}`}>
                        {item.isOutOfStock ? 'Out of stock' : item.isLowStock ? 'Low stock' : 'Available'}
                      </span>
                    </td>
                    <td>
                      <div className="location-cell">
                        <MapPin size={14} aria-hidden="true" />
                        <span>{item.location}</span>
                      </div>
                    </td>
                    <td>{item.condition || 'Good'}</td>
                    <td>
                      <span className={`status-badge ${item.assigned ? 'assigned' : 'unassigned'}`}>
                        {item.assigned ? 'Assigned' : 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="detail-button" onClick={() => setSelectedItem(item)}>
                        <Eye size={15} aria-hidden="true" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="department-inventory-pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </>
      )}

      {selectedItem && (
        <div className="department-inventory-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="department-inventory-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="department-inventory-modal-header">
              <div>
                <span className="section-label">Inventory item</span>
                <h2>{selectedItem.name}</h2>
              </div>
              <button type="button" className="modal-close" aria-label="Close details" onClick={() => setSelectedItem(null)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="modal-grid">
              <div><span>Category</span><strong>{selectedItem.category}</strong></div>
              <div><span>Location</span><strong>{selectedItem.location}</strong></div>
              <div><span>Condition</span><strong>{selectedItem.condition}</strong></div>
              <div><span>Availability</span><strong>{selectedItem.isOutOfStock ? 'Out of stock' : selectedItem.isLowStock ? 'Low stock' : 'Available'}</strong></div>
              <div><span>Total quantity</span><strong>{selectedItem.quantity}</strong></div>
              <div><span>Available</span><strong>{selectedItem.availableQuantity}</strong></div>
              <div><span>Damaged</span><strong>{selectedItem.damagedQuantity}</strong></div>
              <div><span>Minimum</span><strong>{selectedItem.minStock}</strong></div>
              <div><span>Assignment status</span><strong>{selectedItem.assigned ? 'Assigned' : 'Unassigned'}</strong></div>
              <div><span>Asset tag</span><strong>{selectedItem.assetTag || '—'}</strong></div>
              <div><span>Serial number</span><strong>{selectedItem.serialNumber || '—'}</strong></div>
              <div><span>Supplier</span><strong>{selectedItem.supplier || '—'}</strong></div>
              {selectedItem.details && (
                <div className="full-span"><span>Description</span><strong>{selectedItem.details}</strong></div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DeptInventory;
