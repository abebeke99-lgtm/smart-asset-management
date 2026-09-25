import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CircleAlert, CircleCheck, Eye, Filter, Network, Plus, RefreshCw, Search, User, X } from 'lucide-react';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './ICTNetwork.css';

const emptySummary = { total: 0, available: 0, active: 0, assigned: 0, maintenance: 0, repair: 0 };

const readNetworkValue = (equipment, ...keys) => {
  const specifications = equipment?.specifications && typeof equipment.specifications === 'object' ? equipment.specifications : {};
  for (const key of keys) {
    const value = equipment?.[key] ?? specifications[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
};

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '-';
const statusLabel = (status) => String(status || 'Unknown').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (['available', 'active', 'in use', 'assigned'].includes(normalized)) return 'network-status network-status--success';
  if (normalized.includes('maintenance') || normalized.includes('repair')) return 'network-status network-status--warning';
  if (['inactive', 'missing', 'retired', 'disposed'].includes(normalized)) return 'network-status network-status--danger';
  return 'network-status';
};

const ICTNetwork = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [filters, setFilters] = useState({ search: '', type: '', status: '', condition: '', location: '', department: '', assignmentStatus: '' });
  const [query, setQuery] = useState(filters);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(filters), 350);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const loadEquipment = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/ict/network', { params: { ...query, page, limit: pagination.limit } });
      const data = response.data || {};
      setEquipment(Array.isArray(data.equipment) ? data.equipment : []);
      setSummary({ ...emptySummary, ...(data.summary || {}) });
      setPagination((current) => ({ ...current, ...(data.pagination || {}), page }));
    } catch (requestError) {
      setEquipment([]);
      setSummary(emptySummary);
      setError(getApiErrorMessage(requestError, 'Unable to load network equipment.'));
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, query]);

  useEffect(() => { loadEquipment(1); }, [loadEquipment]);

  const openDetails = async (asset) => {
    setSelected({ ...asset });
    setDetailsLoading(true);
    try {
      const response = await apiClient.get(`/api/ict/network/${asset.id}`);
      setSelected(response.data?.equipment || asset);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load equipment details.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const clearFilters = () => setFilters({ search: '', type: '', status: '', condition: '', location: '', department: '', assignmentStatus: '' });
  const hasFilters = Object.values(filters).some(Boolean);
  const firstRow = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const lastRow = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <main className="network-page">
      <header className="network-page__header">
        <div>
          <div className="network-eyebrow"><Network size={16} aria-hidden="true" /> Technical Operations</div>
          <h1>Network Equipment</h1>
          <p>Manage institutional network infrastructure, devices, status, and deployment information.</p>
        </div>
        <div className="network-page__actions">
          <button type="button" className="network-button network-button--secondary" onClick={() => loadEquipment(pagination.page)} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
          <button type="button" className="network-button network-button--primary" onClick={() => navigate('/ict/assets/create')}><Plus size={16} aria-hidden="true" /> Add Network Equipment</button>
        </div>
      </header>

      <section className="network-summary" aria-label="Network equipment summary">
        <div className="network-summary__card"><span>Total Equipment</span><strong>{summary.total}</strong><Network size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Active</span><strong>{summary.active ?? summary.available ?? 0}</strong><CircleCheck size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Assigned</span><strong>{summary.assigned}</strong><User size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Maintenance</span><strong>{summary.maintenance}</strong><Activity size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Repair / Other</span><strong>{summary.repair ?? 0}</strong><CircleAlert size={18} aria-hidden="true" /></div>
      </section>

      <section className="network-toolbar" aria-label="Network equipment filters">
        <label className="network-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search network equipment</span><input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Search name, asset tag, serial, IP, or MAC" /></label>
        <label><span>Type</span><input value={filters.type} onChange={(event) => setFilter('type', event.target.value)} placeholder="Switch, router..." /></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">All statuses</option><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="repair">Repair</option><option value="inactive">Inactive</option></select></label>
        <label><span>Condition</span><input value={filters.condition} onChange={(event) => setFilter('condition', event.target.value)} placeholder="Good, fair..." /></label>
        <label><span>Assignment</span><select value={filters.assignmentStatus} onChange={(event) => setFilter('assignmentStatus', event.target.value)}><option value="">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></label>
        <label><span>Location</span><input value={filters.location} onChange={(event) => setFilter('location', event.target.value)} placeholder="Location" /></label>
        {hasFilters && <button type="button" className="network-clear" onClick={clearFilters}><Filter size={15} aria-hidden="true" /> Clear filters</button>}
      </section>

      {error && <section className="network-state network-state--error" role="alert"><CircleAlert size={22} aria-hidden="true" /><div><strong>Unable to load network equipment.</strong><p>{error}</p><button type="button" className="network-button network-button--secondary" onClick={() => loadEquipment(pagination.page)}>Retry</button></div></section>}
      {!error && loading && <section className="network-state"><RefreshCw className="network-spin" size={26} aria-hidden="true" /><p>Loading network equipment...</p></section>}
      {!error && !loading && equipment.length === 0 && <section className="network-state"><Network size={32} aria-hidden="true" /><h2>No network equipment found</h2><p>There are no network devices matching your current filters.</p>{hasFilters && <button type="button" className="network-button network-button--secondary" onClick={clearFilters}>Clear filters</button>}</section>}

      {!error && !loading && equipment.length > 0 && <>
        <section className="network-table-wrap"><table className="network-table"><caption className="sr-only">Network equipment records</caption><thead><tr><th>Device</th><th>Asset Tag</th><th>Type</th><th>Manufacturer / Model</th><th>IP Address</th><th>Status</th><th>Condition</th><th>Location</th><th>Assigned To</th><th>Actions</th></tr></thead><tbody>{equipment.map((asset) => <tr key={asset.id}><td><strong>{asset.name || '-'}</strong><small>{asset.serialNumber || asset.serial_number || 'No serial number'}</small></td><td>{asset.assetTag || asset.assetCode || '-'}</td><td>{asset.category || '-'}</td><td>{[asset.manufacturer, asset.model].filter(Boolean).join(' / ') || '-'}</td><td>{readNetworkValue(asset, 'ipAddress', 'ip_address') || '-'}</td><td><span className={statusClass(asset.status)}>{statusLabel(asset.status)}</span></td><td>{asset.condition || '-'}</td><td>{asset.location || '-'}</td><td>{asset.assignedTo || 'Unassigned'}</td><td><button type="button" className="network-icon-button" onClick={() => openDetails(asset)} aria-label={`View ${asset.name || 'equipment'} details`} title="View details"><Eye size={17} aria-hidden="true" /></button></td></tr>)}</tbody></table></section>
        <footer className="network-pagination"><span>Showing {firstRow}-{lastRow} of {pagination.total} devices</span><div><label>Rows <select value={pagination.limit} onChange={(event) => setPagination((current) => ({ ...current, limit: Number(event.target.value) }))}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><button type="button" onClick={() => loadEquipment(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button type="button" onClick={() => loadEquipment(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next</button></div></footer>
      </>}

      {selected && <div className="network-drawer-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="network-drawer" role="dialog" aria-modal="true" aria-labelledby="network-details-title" onClick={(event) => event.stopPropagation()}><header><div><span className="network-eyebrow"><Network size={15} aria-hidden="true" /> Equipment details</span><h2 id="network-details-title">{selected.name || '-'}</h2></div><button type="button" className="network-icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18} aria-hidden="true" /></button></header>{detailsLoading ? <div className="network-state"><RefreshCw className="network-spin" size={22} aria-hidden="true" /><p>Loading details...</p></div> : <dl className="network-details"><div className="network-detail-status"><span className={statusClass(selected.status)}>{statusLabel(selected.status)}</span><span>{selected.condition || 'Condition not recorded'}</span></div>{[['Asset Tag', selected.assetTag || selected.assetCode], ['Type', selected.category], ['Manufacturer', selected.manufacturer], ['Model', selected.model], ['Serial Number', selected.serialNumber || selected.serial_number], ['IP Address', readNetworkValue(selected, 'ipAddress', 'ip_address')], ['MAC Address', readNetworkValue(selected, 'macAddress', 'mac_address')], ['Firmware Version', readNetworkValue(selected, 'firmwareVersion', 'firmware_version')], ['Network Segment', readNetworkValue(selected, 'networkSegment', 'network_segment', 'vlan')], ['Rack Location', readNetworkValue(selected, 'rackLocation', 'rack_location')], ['Location', selected.location], ['Department', selected.department], ['Assigned To', selected.assignedTo], ['Purchase Date', formatDate(selected.purchaseDate || selected.purchase_date)], ['Warranty Expiry', formatDate(selected.warrantyExpiry || selected.warranty_expiry)], ['Last Updated', formatDate(selected.updatedAt || selected.updated_at)]].filter(([, value]) => value).map(([label, value]) => <div className="network-detail" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{selected.description && <div className="network-detail network-detail--wide"><dt>Description</dt><dd>{selected.description}</dd></div>}</dl>}</aside></div>}
    </main>
  );
};

export default ICTNetwork;
