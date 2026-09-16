import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BadgeCheck, BriefcaseBusiness, Building2, Eye, Filter, Package, RefreshCw, Search, TriangleAlert, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeDepartmentAssets.css';

const currency = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'ETB' });
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

const toneClasses = {
  success: 'college-status-pill success',
  warning: 'college-status-pill warning',
  danger: 'college-status-pill danger',
  neutral: 'college-status-pill neutral',
};

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (['active', 'assigned', 'in-use', 'available', 'ready', 'idle'].includes(normalized)) return 'success';
  if (['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(normalized)) return 'warning';
  if (['damaged', 'missing', 'lost', 'stolen', 'poor', 'disposed'].includes(normalized)) return 'danger';
  return 'neutral';
};

const initialFilters = { departmentId: '', status: '', category: '', location: '', search: '' };

const CollegeDepartmentAssets = () => {
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState({ totalAssets: 0, activeAssets: 0, assignedAssets: 0, availableAssets: 0, maintenanceAssets: 0, damagedAssets: 0, missingAssets: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const loadAssets = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: 10,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.location ? { location: filters.location } : {}),
      };

      const response = await apiClient.get('/api/college/department-assets', { params });
      const payload = response.data || {};
      setAssets(payload.data || []);
      setSummary(payload.summary || { totalAssets: 0, activeAssets: 0, assignedAssets: 0, availableAssets: 0, maintenanceAssets: 0, damagedAssets: 0, missingAssets: 0 });
      setPagination(payload.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      setDepartments(payload.filters?.departments || []);
      setCategories(payload.filters?.categories || []);
      setLocations(payload.filters?.locations || []);
      setStatuses(payload.filters?.statuses || []);
    } catch (requestError) {
      setAssets([]);
      setError(requestError.response?.data?.message || 'Failed to load department assets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAssets(), 250);
    return () => clearTimeout(timer);
  }, [page, filters.departmentId, filters.status, filters.category, filters.location, filters.search]);

  const departmentSummary = useMemo(() => {
    const byDepartment = new Map();
    for (const asset of assets) {
      const key = String(asset.departmentId || asset.department || 'unknown');
      if (!byDepartment.has(key)) {
        byDepartment.set(key, { name: asset.department || 'Unassigned', total: 0, active: 0, assigned: 0, maintenance: 0 });
      }
      const bucket = byDepartment.get(key);
      bucket.total += 1;
      const value = String(asset.status || '').toLowerCase();
      if (['active', 'available', 'assigned', 'in-use', 'ready', 'idle'].includes(value)) bucket.active += 1;
      if (['assigned', 'in-use', 'issued', 'allocated'].includes(value)) bucket.assigned += 1;
      if (['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(value)) bucket.maintenance += 1;
    }
    return Array.from(byDepartment.values()).sort((left, right) => right.total - left.total);
  }, [assets]);

  const openDetails = async (asset) => {
    setSelectedAsset({ id: asset.id, name: asset.name, loading: true });
    setLoadingDetails(true);
    try {
      const response = await apiClient.get(`/api/college/assets/${asset.id}`);
      setSelectedAsset(response.data?.data || asset);
    } catch (requestError) {
      setSelectedAsset({ ...asset, detailError: requestError.response?.data?.message || 'Unable to load asset details.' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const resetFilters = () => {
    setPage(1);
    setFilters(initialFilters);
  };

  const kpis = [
    { key: 'totalAssets', label: 'Total Dept. Assets', icon: Package },
    { key: 'activeAssets', label: 'Active', icon: BadgeCheck },
    { key: 'assignedAssets', label: 'Assigned', icon: BriefcaseBusiness },
    { key: 'availableAssets', label: 'Available', icon: Activity },
    { key: 'maintenanceAssets', label: 'Under Maintenance', icon: TriangleAlert },
    { key: 'damagedAssets', label: 'Damaged', icon: AlertTriangle },
    { key: 'missingAssets', label: 'Missing', icon: Building2 },
  ];

  if (loading) {
    return <div className="college-assets-shell"><div className="college-assets-state" aria-busy="true"><RefreshCw className="college-spin" size={18} /> Loading department assets...</div></div>;
  }

  if (error) {
    return <div className="college-assets-shell"><div className="college-assets-state error" role="alert"><strong>Failed to load department assets.</strong><button type="button" onClick={() => loadAssets()}><RefreshCw size={15} /> Retry</button></div></div>;
  }

  return (
    <div className="college-assets-shell">
      <div className="college-assets-header-row">
        <div>
          <p className="college-assets-kicker">College Department Assets</p>
          <h3>Department asset overview</h3>
        </div>
        <button type="button" className="college-assets-action-btn" onClick={() => loadAssets()}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="college-assets-kpi-grid">
        {kpis.map(({ key, label, icon: Icon }) => (
          <div className="college-assets-kpi-card" key={key}>
            <div className="college-assets-kpi-icon"><Icon size={16} /></div>
            <div>
              <span>{label}</span>
              <strong>{Number(summary[key] || 0)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="college-assets-filters">
        <label className="college-assets-search-field">
          <Search size={15} />
          <input value={filters.search} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, search: event.target.value })); }} placeholder="Search asset code, tag, name, serial..." aria-label="Search department assets" />
        </label>

        <label>
          <span className="sr-only">Department</span>
          <select value={filters.departmentId} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, departmentId: event.target.value })); }}>
            <option value="">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>

        <label>
          <span className="sr-only">Status</span>
          <select value={filters.status} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, status: event.target.value })); }}>
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>

        <label>
          <span className="sr-only">Category</span>
          <select value={filters.category} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, category: event.target.value })); }}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>

        <label>
          <span className="sr-only">Location</span>
          <select value={filters.location} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, location: event.target.value })); }}>
            <option value="">All locations</option>
            {locations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </label>

        {hasActiveFilters && (
          <button type="button" className="college-assets-action-btn secondary" onClick={resetFilters}><X size={14} /> Clear Filters</button>
        )}
      </div>

      <div className="college-assets-panel">
        <div className="college-assets-table-header">
          <strong>{assets.length ? `Showing ${assets.length} asset${assets.length === 1 ? '' : 's'}` : 'No department assets found'}</strong>
          <span>Page {pagination.page || page} of {Math.max(1, pagination.totalPages || 1)}</span>
        </div>

        {assets.length ? (
          <div className="college-assets-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset Code</th>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Condition</th>
                  <th>Assigned To</th>
                  <th>Purchase Date</th>
                  <th>Value</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>{asset.assetCode || asset.assetTag || '—'}</td>
                    <td>
                      <div className="college-assets-name-cell">
                        <span>{asset.name || 'Unnamed asset'}</span>
                        {asset.serialNumber ? <small>{asset.serialNumber}</small> : null}
                      </div>
                    </td>
                    <td>{asset.category || '—'}</td>
                    <td>{asset.department || '—'}</td>
                    <td>{asset.location || '—'}</td>
                    <td><span className={toneClasses[statusTone(asset.status)]}>{asset.status || '—'}</span></td>
                    <td>{asset.condition || '—'}</td>
                    <td>{asset.assignedUser?.name || '—'}</td>
                    <td>{formatDate(asset.purchaseDate)}</td>
                    <td>{currency(asset.currentValue || asset.purchasePrice)}</td>
                    <td>{formatDate(asset.updatedAt)}</td>
                    <td>
                      <button type="button" className="college-assets-icon-button" onClick={() => openDetails(asset)} aria-label={`View details for ${asset.name}`}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-assets-empty-state">
            <Package size={26} />
            <strong>{hasActiveFilters ? 'No assets match your filters.' : 'No department assets found.'}</strong>
            {hasActiveFilters && <button type="button" onClick={resetFilters}>Clear Filters</button>}
          </div>
        )}

        <div className="college-assets-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {pagination.page || page} of {Math.max(1, pagination.totalPages || 1)}</span>
          <button type="button" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => Math.min(pagination.totalPages || current + 1, current + 1))}>Next</button>
        </div>
      </div>

      <div className="college-assets-department-summary">
        <div className="college-assets-summary-header">
          <h4>Department Distribution</h4>
        </div>
        {departmentSummary.length ? (
          <div className="college-assets-summary-grid">
            {departmentSummary.map((entry) => (
              <div key={entry.name} className="college-assets-summary-card">
                <strong>{entry.name}</strong>
                <div className="college-assets-summary-row"><span>Total</span><b>{entry.total}</b></div>
                <div className="college-assets-summary-row"><span>Active</span><b>{entry.active}</b></div>
                <div className="college-assets-summary-row"><span>Assigned</span><b>{entry.assigned}</b></div>
                <div className="college-assets-summary-row"><span>Maintenance</span><b>{entry.maintenance}</b></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="college-assets-empty-state small"><Filter size={22} /><span>No department distribution data available.</span></div>
        )}
      </div>

      {selectedAsset && (
        <div className="college-assets-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSelectedAsset(null); }}>
          <div className="college-assets-modal" role="dialog" aria-modal="true" aria-labelledby="asset-details-title">
            <div className="college-assets-modal-header">
              <div>
                <p className="college-assets-kicker">Asset details</p>
                <h3 id="asset-details-title">{selectedAsset.name || 'Asset details'}</h3>
              </div>
              <button type="button" aria-label="Close asset details" onClick={() => setSelectedAsset(null)}><X size={18} /></button>
            </div>

            {loadingDetails ? (
              <div className="college-assets-modal-loading"><RefreshCw className="college-spin" size={16} /> Loading details...</div>
            ) : (
              <div className="college-assets-detail-grid">
                {[
                  ['Asset Code', selectedAsset.assetCode || selectedAsset.assetTag],
                  ['Asset Tag', selectedAsset.rfidTag || selectedAsset.assetTag],
                  ['Asset Name', selectedAsset.name],
                  ['Category', selectedAsset.category],
                  ['Department', selectedAsset.DepartmentRecord?.name || selectedAsset.department],
                  ['College', selectedAsset.collegeName || selectedAsset.college?.name || '—'],
                  ['Location', selectedAsset.location],
                  ['Serial Number', selectedAsset.serialNumber],
                  ['Status', selectedAsset.status],
                  ['Condition', selectedAsset.condition],
                  ['Assigned User', selectedAsset.Assignment?.User?.fullName || selectedAsset.assignedUser?.name || '—'],
                  ['Assignment Date', formatDate(selectedAsset.assignmentDate || selectedAsset.Assignment?.createdAt)],
                  ['Purchase Date', formatDate(selectedAsset.purchaseDate)],
                  ['Purchase Cost', currency(selectedAsset.purchasePrice)],
                  ['Current Value', currency(selectedAsset.currentValue)],
                  ['Manufacturer', selectedAsset.manufacturer],
                  ['Model', selectedAsset.model],
                  ['Warranty', formatDate(selectedAsset.warrantyExpiry)],
                  ['Created', formatDate(selectedAsset.createdAt)],
                  ['Updated', formatDate(selectedAsset.updatedAt)],
                ].map(([labelText, value]) => (
                  <div key={labelText} className="college-assets-detail-card">
                    <span>{labelText}</span>
                    <strong>{value || '—'}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeDepartmentAssets;
