import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './ICTNetwork.css';

const API_URL = '/api/ict/equipment/network';
const EMPTY_SUMMARY = { total: 0, active: 0, assigned: 0, maintenance: 0, repair: 0 };
const EMPTY_EQUIPMENT = {
  name: '',
  assetTag: '',
  serialNumber: '',
  type: '',
  ipAddress: '',
  macAddress: '',
  status: 'available',
  condition: 'good',
  assignedToId: '',
  campus: '',
  building: '',
  room: '',
  location: '',
  purchaseDate: '',
  warrantyExpiry: '',
  description: '',
};

const LABELS = {
  active: 'Active',
  available: 'Available',
  assigned: 'Assigned',
  maintenance: 'Maintenance',
  repair: 'Repair',
  inactive: 'Inactive',
  retired: 'Retired',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
};

const displayValue = (value) => value === null || value === undefined || value === '' ? '—' : value;
const displayDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const toDateInput = (value) => value ? String(value).slice(0, 10) : '';
const titleCase = (value) => String(value || 'Unknown').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const labelFor = (value) => LABELS[String(value || '').toLowerCase()] || titleCase(value);
const statusClass = (value) => {
  const status = String(value || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (['active', 'available'].includes(status)) return 'network-status network-status--success';
  if (['assigned', 'in use'].includes(status)) return 'network-status network-status--info';
  if (status.includes('maintenance') || status.includes('repair')) return 'network-status network-status--warning';
  if (['inactive', 'missing', 'retired', 'disposed', 'damaged'].includes(status)) return 'network-status network-status--danger';
  return 'network-status';
};

function Field({ label, name, value, onChange, required = false, type = 'text', options, placeholder, wide = false, maxLength }) {
  const control = options ? (
    <select name={name} value={value} onChange={onChange} required={required}>
      {!required && <option value="">Select {label.toLowerCase()}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ) : type === 'textarea' ? (
    <textarea name={name} value={value} onChange={onChange} required={required} maxLength={maxLength} rows={3} placeholder={placeholder} />
  ) : (
    <input name={name} type={type} value={value} onChange={onChange} required={required} maxLength={maxLength} placeholder={placeholder} />
  );
  return (
    <label className={`network-form-field${wide ? ' network-form-field--wide' : ''}`}>
      <span>{label}{required ? ' *' : ''}</span>
      {control}
    </label>
  );
}

function EquipmentForm({ equipment, options, saving, error, onChange, onSubmit, onClose }) {
  return (
    <div className="network-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="network-modal" role="dialog" aria-modal="true" aria-labelledby="network-form-title">
        <header>
          <div>
            <span className="network-eyebrow"><Network size={15} aria-hidden="true" /> Network inventory</span>
            <h2 id="network-form-title">{equipment.id ? 'Edit network equipment' : 'Add network equipment'}</h2>
          </div>
          <button type="button" className="network-icon-button" onClick={onClose} disabled={saving} aria-label="Close form"><X size={18} /></button>
        </header>
        <form onSubmit={onSubmit}>
          {error && <div className="network-form-error" role="alert"><AlertCircle size={17} />{error}</div>}
          <div className="network-form-grid">
            <Field label="Equipment Name" name="name" value={equipment.name} onChange={onChange} required maxLength={255} />
            <Field label="Type" name="type" value={equipment.type} onChange={onChange} required options={options.types.map((value) => ({ value, label: value }))} />
            <Field label="Asset Tag" name="assetTag" value={equipment.assetTag} onChange={onChange} maxLength={255} />
            <Field label="Serial Number" name="serialNumber" value={equipment.serialNumber} onChange={onChange} maxLength={255} />
            <Field label="IP Address" name="ipAddress" value={equipment.ipAddress} onChange={onChange} placeholder="IPv4 or IPv6" />
            <Field label="MAC Address" name="macAddress" value={equipment.macAddress} onChange={onChange} placeholder="00:1A:2B:3C:4D:5E" />
            <Field label="Status" name="status" value={equipment.status} onChange={onChange} required options={options.statuses.map((value) => ({ value, label: labelFor(value) }))} />
            <Field label="Condition" name="condition" value={equipment.condition} onChange={onChange} required options={options.conditions.map((value) => ({ value, label: labelFor(value) }))} />
            <Field label="Assignment" name="assignedToId" value={equipment.assignedToId} onChange={onChange} options={options.users.map((user) => ({ value: String(user.id), label: user.label }))} />
            <Field label="Campus" name="campus" value={equipment.campus} onChange={onChange} maxLength={255} />
            <Field label="Building" name="building" value={equipment.building} onChange={onChange} maxLength={255} />
            <Field label="Room" name="room" value={equipment.room} onChange={onChange} maxLength={255} />
            <Field label="Location" name="location" value={equipment.location} onChange={onChange} maxLength={255} />
            <Field label="Purchase Date" name="purchaseDate" value={equipment.purchaseDate} onChange={onChange} type="date" />
            <Field label="Warranty Expiry" name="warrantyExpiry" value={equipment.warrantyExpiry} onChange={onChange} type="date" />
            <Field label="Description" name="description" value={equipment.description} onChange={onChange} type="textarea" wide maxLength={10000} />
          </div>
          <footer>
            <button type="button" className="network-button network-button--secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="network-button network-button--primary" disabled={saving}>
              {saving && <RefreshCw size={15} className="network-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : equipment.id ? 'Save Changes' : 'Add Equipment'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function EquipmentDetails({ equipment, onClose }) {
  const values = [
    ['Equipment Name', equipment.name],
    ['Asset Tag', equipment.assetTag || equipment.assetCode],
    ['Serial Number', equipment.serialNumber],
    ['Type', equipment.type || equipment.category],
    ['IP Address', equipment.ipAddress],
    ['MAC Address', equipment.macAddress],
    ['Status', labelFor(equipment.status)],
    ['Condition', labelFor(equipment.condition)],
    ['Assignment', equipment.assignment || equipment.assignedTo || 'Unassigned'],
    ['Campus', equipment.campus],
    ['Building', equipment.building],
    ['Room', equipment.room],
    ['Location', equipment.location],
    ['Purchase Date', displayDate(equipment.purchaseDate)],
    ['Warranty Expiry', displayDate(equipment.warrantyExpiry)],
    ['Description', equipment.description],
  ];
  return (
    <div className="network-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="network-modal network-modal--details" role="dialog" aria-modal="true" aria-labelledby="network-details-title">
        <header>
          <div>
            <span className="network-eyebrow"><Network size={15} aria-hidden="true" /> Equipment details</span>
            <h2 id="network-details-title">{equipment.name}</h2>
          </div>
          <button type="button" className="network-icon-button" onClick={onClose} aria-label="Close details"><X size={18} /></button>
        </header>
        <dl className="network-detail-grid">
          {values.map(([label, value]) => (
            <div key={label} className={label === 'Description' ? 'network-detail--wide' : ''}>
              <dt>{label}</dt>
              <dd>{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default function ICTNetworkEquipment() {
  const [equipment, setEquipment] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [options, setOptions] = useState({ types: [], statuses: [], conditions: [], users: [] });
  const [filters, setFilters] = useState({ search: '', type: '', status: '', condition: '', assignmentStatus: '', location: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [details, setDetails] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (
      current.search === search ? current : { ...current, search }
    )), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadEquipment = useCallback(async (signal) => {
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.get(API_URL, {
        signal,
        params: { ...filters, page, limit, sortBy: 'updatedAt', sortOrder: 'DESC' },
      });
      const result = response.data || {};
      setEquipment(Array.isArray(result.data) ? result.data : []);
      setSummary({ ...EMPTY_SUMMARY, ...(result.summary || {}) });
      setOptions({
        types: result.options?.types || [],
        statuses: result.options?.statuses || [],
        conditions: result.options?.conditions || [],
        users: result.options?.users || [],
      });
      setPagination({ total: result.pagination?.total || 0, totalPages: result.pagination?.totalPages || 1 });
    } catch (requestError) {
      if (!signal.aborted) setError(getApiErrorMessage(requestError, 'Unable to load network equipment.'));
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters, limit, page]);

  useEffect(() => {
    const controller = new AbortController();
    loadEquipment(controller.signal);
    return () => controller.abort();
  }, [loadEquipment, reload]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setFilters({ search: '', type: '', status: '', condition: '', assignmentStatus: '', location: '' });
    setPage(1);
  };

  const refresh = () => {
    setRefreshing(true);
    setReload((current) => current + 1);
  };

  const openForm = (asset) => {
    setForm(asset ? {
      ...EMPTY_EQUIPMENT,
      ...asset,
      type: asset.type || asset.category || '',
      assetTag: asset.assetTag || asset.assetCode || '',
      purchaseDate: toDateInput(asset.purchaseDate),
      warrantyExpiry: toDateInput(asset.warrantyExpiry),
      assignedToId: asset.assignedToId ? String(asset.assignedToId) : '',
    } : { ...EMPTY_EQUIPMENT });
    setFormError('');
  };

  const changeForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const url = form.id ? `${API_URL}/${form.id}` : API_URL;
      const method = form.id ? 'put' : 'post';
      await apiClient[method](url, form);
      setForm(null);
      if (form.id) {
        setEquipment((current) => current.map((asset) => (
          asset.id === form.id ? { ...asset, ...form, name: asset.name } : asset
        )));
      } else {
        setPage(1);
        setReload((current) => current + 1);
      }
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, 'Unable to save network equipment.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEquipment = async (asset) => {
    if (!window.confirm(`Delete ${asset.name}? This removes the equipment from the active asset register.`)) return;
    setDeletingId(asset.id);
    setError('');
    try {
      await apiClient.delete(`${API_URL}/${asset.id}`);
      if (equipment.length === 1 && page > 1) setPage((current) => current - 1);
      else setReload((current) => current + 1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to delete network equipment.'));
    } finally {
      setDeletingId(null);
    }
  };

  const openDetails = async (asset) => {
    setDetails({ ...asset, detailsLoading: true });
    try {
      const response = await apiClient.get(`${API_URL}/${asset.id}`);
      setDetails(response.data?.data || asset);
    } catch (requestError) {
      setDetails({ ...asset, detailsError: getApiErrorMessage(requestError, 'Unable to load equipment details.') });
    }
  };

  const hasFilters = Boolean(filters.search || filters.type || filters.status || filters.condition || filters.assignmentStatus || filters.location);
  const firstRow = pagination.total ? ((page - 1) * limit) + 1 : 0;
  const lastRow = Math.min(page * limit, pagination.total);

  return (
    <main className="network-page">
      <header className="network-page__header">
        <div>
          <div className="network-eyebrow"><Network size={16} aria-hidden="true" /> Technical Operations</div>
          <h1>Network Equipment</h1>
          <p>Manage institutional network infrastructure, devices, status, and deployment information.</p>
        </div>
        <div className="network-page__actions">
          <button type="button" className="network-button network-button--secondary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'network-spin' : ''} aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="network-button network-button--primary" onClick={() => openForm(null)}>
            <Plus size={16} aria-hidden="true" /> Add Network Equipment
          </button>
        </div>
      </header>

      <section className="network-summary" aria-label="Network equipment summary">
        <div className="network-summary__card"><span>Total Equipment</span><strong>{summary.total}</strong><Network size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Active</span><strong>{summary.active}</strong><CheckCircle2 size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Assigned</span><strong>{summary.assigned}</strong><UserRound size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Maintenance</span><strong>{summary.maintenance}</strong><Activity size={18} aria-hidden="true" /></div>
        <div className="network-summary__card"><span>Repair / Other</span><strong>{summary.repair}</strong><AlertCircle size={18} aria-hidden="true" /></div>
      </section>

      <section className="network-toolbar network-equipment-toolbar" aria-label="Network equipment filters">
        <label className="network-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search network equipment</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, asset tag, serial, IP, or MAC" /></label>
        <label><span>Filter type</span><select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}><option value="">All types</option>{options.types.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Filter status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{options.statuses.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>
        <label><span>Filter condition</span><select value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)}><option value="">All conditions</option>{options.conditions.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>
        <label><span>Filter assignment</span><select value={filters.assignmentStatus} onChange={(event) => updateFilter('assignmentStatus', event.target.value)}><option value="">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></label>
        <label><span>Filter location</span><input value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} placeholder="Campus, building, room" /></label>
        {hasFilters && <button type="button" className="network-clear" onClick={clearFilters}>Clear filters</button>}
      </section>

      {error && <section className="network-state network-state--error" role="alert"><AlertCircle size={21} /><div><strong>Network equipment request failed</strong><p>{error}</p><button type="button" className="network-button network-button--secondary" onClick={refresh}>Retry</button></div></section>}
      {!error && loading && <section className="network-state" role="status"><RefreshCw className="network-spin" size={26} /><p>Loading network equipment…</p></section>}
      {!error && !loading && equipment.length === 0 && (
        <section className="network-state">
          <Network size={32} aria-hidden="true" />
          <h2>{hasFilters ? 'No matching network equipment' : 'No network equipment yet'}</h2>
          <p>{hasFilters ? 'Try adjusting your search or filters.' : 'Add a network device to start managing your infrastructure.'}</p>
          {hasFilters ? <button type="button" className="network-button network-button--secondary" onClick={clearFilters}>Clear filters</button> : <button type="button" className="network-button network-button--primary" onClick={() => openForm(null)}><Plus size={15} /> Add Network Equipment</button>}
        </section>
      )}

      {!error && !loading && equipment.length > 0 && (
        <>
          <section className="network-table-wrap">
            <table className="network-table network-equipment-table">
              <caption className="sr-only">Network equipment records</caption>
              <thead><tr><th>Equipment</th><th>Asset Tag</th><th>Type</th><th>Serial Number</th><th>IP / MAC Address</th><th>Status</th><th>Condition</th><th>Assignment</th><th>Campus / Building / Room</th><th>Location</th><th>Purchase / Warranty</th><th>Actions</th></tr></thead>
              <tbody>{equipment.map((asset) => (
                <tr key={asset.id}>
                  <td><strong>{asset.name}</strong><small>{asset.description || 'No description'}</small></td>
                  <td>{displayValue(asset.assetTag)}</td>
                  <td>{displayValue(asset.type || asset.category)}</td>
                  <td>{displayValue(asset.serialNumber)}</td>
                  <td><span>{displayValue(asset.ipAddress)}</span><small>{displayValue(asset.macAddress)}</small></td>
                  <td><span className={statusClass(asset.status)}>{labelFor(asset.status)}</span></td>
                  <td>{labelFor(asset.condition)}</td>
                  <td>{asset.assignment || asset.assignedTo || 'Unassigned'}</td>
                  <td><span>{asset.campus || '—'}</span><small>{[asset.building, asset.room].filter(Boolean).join(' · ') || '—'}</small></td>
                  <td>{displayValue(asset.location)}</td>
                  <td><span>{displayDate(asset.purchaseDate)}</span><small>{displayDate(asset.warrantyExpiry)}</small></td>
                  <td><div className="network-row-actions">
                    <button type="button" className="network-icon-button" onClick={() => openDetails(asset)} aria-label={`View ${asset.name} details`} title="View details"><Building2 size={16} /></button>
                    <button type="button" className="network-icon-button" onClick={() => openForm(asset)} aria-label={`Edit ${asset.name}`} title="Edit"><Edit2 size={16} /></button>
                    <button type="button" className="network-icon-button network-icon-button--danger" onClick={() => deleteEquipment(asset)} disabled={deletingId === asset.id} aria-label={`Delete ${asset.name}`} title="Delete"><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </section>
          <footer className="network-pagination">
            <span>Showing {firstRow}–{lastRow} of {pagination.total} equipment items</span>
            <div>
              <label>Rows <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
              <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}><ChevronLeft size={15} /> Previous</button>
              <span>Page {page} of {pagination.totalPages}</span>
              <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= pagination.totalPages}>Next <ChevronRight size={15} /></button>
            </div>
          </footer>
        </>
      )}

      {form && <EquipmentForm equipment={form} options={options} saving={saving} error={formError} onChange={changeForm} onSubmit={submitForm} onClose={() => !saving && setForm(null)} />}
      {details && (details.detailsLoading
        ? <div className="network-modal-backdrop"><section className="network-modal network-detail-loading" role="status"><RefreshCw size={22} className="network-spin" /> Loading equipment details…</section></div>
        : details.detailsError
          ? <div className="network-modal-backdrop"><section className="network-modal network-form-error" role="alert"><AlertCircle size={18} />{details.detailsError}<button type="button" className="network-icon-button" onClick={() => setDetails(null)} aria-label="Close"><X size={17} /></button></section></div>
          : <EquipmentDetails equipment={details} onClose={() => setDetails(null)} />)}
    </main>
  );
}
