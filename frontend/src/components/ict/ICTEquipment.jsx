import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Filter,
  MapPin,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

const API_BASE_URL = (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/i, '').replace(/\/+$/, '');
const EQUIPMENT_URL = `${API_BASE_URL}/api/ict/equipment`;
const PAGE_SIZE = 10;
const CATEGORIES = ['Computing', 'Networking', 'Printing', 'Display', 'Power', 'Storage', 'Communication'];
const STATUSES = ['Available', 'Assigned', 'Under Maintenance', 'In Transit', 'Retired', 'Disposed'];
const CONDITIONS = ['Functional', 'Needs Repair', 'Damaged', 'Missing', 'Expired', 'Replaced'];
const EMPTY_FORM = {
  name: '',
  category: '',
  serialNumber: '',
  quantity: '1',
  campusId: '',
  collegeId: '',
  departmentId: '',
  buildingId: '',
  roomId: '',
  status: 'Available',
  condition: 'Functional',
  purchaseDate: '',
  purchasePrice: '',
  warrantyExpiry: '',
  description: '',
};

const getToken = () => (
  localStorage.getItem('token')
  || localStorage.getItem('authToken')
  || sessionStorage.getItem('token')
  || ''
);

async function requestEquipment(path = '', { signal, method = 'GET', data } = {}) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${EQUIPMENT_URL}${path}`, {
    method,
    signal,
    credentials: 'include',
    headers,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session has expired. Please sign in again.');
    if (response.status === 403) throw new Error('You do not have permission to access IT equipment.');
    if (response.status >= 500) throw new Error('The equipment service is unavailable. Please try again.');
    throw new Error(body?.message || `The equipment request failed (${response.status}).`);
  }
  if (!body || typeof body !== 'object') throw new Error('The equipment service returned an invalid response.');
  return body;
}

const formatDate = (value) => {
  if (!value) return '—';
  const dateValue = String(value).slice(0, 10);
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const dateInputValue = (value) => value ? String(value).slice(0, 10) : '';
const assetIdentifier = (asset) => asset.assetCode || asset.digitalId || asset.id || '—';
const categoryName = (asset) => asset.category || asset.subcategory || 'Uncategorized';
const categoryGroup = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (CATEGORIES.includes(value)) return value;
  const terms = {
    Computing: ['computing', 'computer', 'desktop', 'laptop', 'tablet', 'workstation'],
    Networking: ['network', 'router', 'switch', 'firewall', 'wireless', 'gateway', 'modem'],
    Printing: ['printing', 'printer', 'scanner'],
    Display: ['display', 'monitor', 'projector'],
    Power: ['power', 'ups', 'uninterruptible', 'surge'],
    Storage: ['storage', 'hard drive', 'disk', 'drive'],
    Communication: ['communication', 'telephone', 'phone', 'radio', 'voip'],
  };
  return CATEGORIES.find((category) => terms[category].some((term) => normalized.includes(term))) || '';
};
const campusName = (asset) => asset.CampusRecord?.campusName || asset.campus?.campusName || '—';
const collegeName = (asset) => asset.College?.collegeName || asset.CollegeRecord?.collegeName || '—';
const departmentName = (asset) => asset.DepartmentRecord?.name || asset.department || '—';
const buildingName = (asset) => asset.BuildingRecord?.buildingName || '—';
const roomName = (asset) => asset.RoomRecord?.roomName || asset.RoomRecord?.roomCode || asset.location || '—';
const displayStatus = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'active' || normalized === 'ready') return 'Available';
  if (normalized === 'in use') return 'Assigned';
  if (normalized === 'maintenance') return 'Under Maintenance';
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase()) || 'Unknown';
};
const displayCondition = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'good' || normalized === 'excellent') return 'Functional';
  if (normalized === 'fair' || normalized === 'poor') return 'Needs Repair';
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase()) || 'Unknown';
};
const formForAsset = (asset) => ({
  ...EMPTY_FORM,
  id: asset.id,
  name: asset.name || '',
  category: categoryGroup(asset.category),
  serialNumber: asset.serialNumber || '',
  quantity: String(asset.quantity ?? 1),
  campusId: String(asset.campusId || asset.CampusRecord?.id || ''),
  collegeId: String(asset.collegeId || asset.College?.id || ''),
  departmentId: String(asset.departmentId || asset.DepartmentRecord?.id || ''),
  buildingId: String(asset.buildingId || asset.BuildingRecord?.id || ''),
  roomId: String(asset.roomId || asset.RoomRecord?.id || ''),
  status: displayStatus(asset.status),
  condition: displayCondition(asset.condition),
  purchaseDate: dateInputValue(asset.purchaseDate),
  purchasePrice: asset.purchasePrice ?? '',
  warrantyExpiry: dateInputValue(asset.warrantyExpiry),
  description: asset.description || '',
});

const badgeClass = (value, type) => {
  const normalized = String(value || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (type === 'status') {
    if (['available', 'active'].includes(normalized)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (['assigned', 'in use'].includes(normalized)) return 'border-blue-200 bg-blue-50 text-blue-700';
    if (normalized.includes('maintenance') || normalized === 'in transit') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (['retired', 'disposed'].includes(normalized)) return 'border-slate-200 bg-slate-100 text-slate-600';
  } else {
    if (['functional', 'good', 'excellent', 'replaced'].includes(normalized)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (normalized === 'needs repair' || normalized === 'expired') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (['damaged', 'missing', 'poor'].includes(normalized)) return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

function SortButton({ label, field, sort, onSort }) {
  const selected = sort.sortBy === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-blue-700"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {selected ? (sort.sortOrder === 'ASC' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : null}
    </button>
  );
}

function EquipmentDetails({ asset, loading, error, onClose }) {
  if (!asset && !loading && !error) return null;
  const details = asset || {};
  const fields = [
    ['Asset ID', assetIdentifier(details)],
    ['Asset Name', details.name || '—'],
    ['Category', categoryName(details)],
    ['Serial Number', details.serialNumber || '—'],
    ['Quantity', details.quantity ?? '—'],
    ['Campus', campusName(details)],
    ['College', collegeName(details)],
    ['Department', departmentName(details)],
    ['Building', buildingName(details)],
    ['Room', roomName(details)],
    ['Status', displayStatus(details.status)],
    ['Condition', displayCondition(details.condition)],
    ['Purchase Date', formatDate(details.purchaseDate)],
    ['Purchase Cost', details.purchasePrice === null || details.purchasePrice === undefined ? '—' : Number(details.purchasePrice).toLocaleString()],
    ['Warranty Expiry', formatDate(details.warrantyExpiry)],
    ['Description', details.description || '—'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]" aria-label="Close equipment details" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="equipment-details-title" className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Monitor size={20} /></div>
            <div>
              <h2 id="equipment-details-title" className="text-lg font-semibold text-slate-900">Equipment details</h2>
              <p className="text-sm text-slate-500">{asset?.name || (loading ? 'Loading equipment record' : '')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close details"><X size={19} /></button>
        </header>
        <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-5 sm:p-6">
          {loading && <div className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500" role="status"><RefreshCw size={18} className="animate-spin text-blue-600" />Loading equipment details…</div>}
          {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}
          {asset && !loading && !error && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-slate-700">{assetIdentifier(asset)}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass(asset.status, 'status')}`}>{displayStatus(asset.status)}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass(asset.condition, 'condition')}`}>{displayCondition(asset.condition)}</span>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {fields.map(([label, value]) => (
                  <div key={label} className={label === 'Description' ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function FormField({ label, name, value, onChange, required = false, type = 'text', options, wide = false, min, step, maxLength, disabled = false }) {
  const controlClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50';
  return (
    <label className={`block min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</span>
      {options ? (
        <select name={name} value={value} onChange={onChange} required={required} disabled={disabled} className={controlClass}>
          <option value="">{required ? `Select ${label.toLowerCase()}` : 'Not specified'}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea name={name} value={value} onChange={onChange} maxLength={maxLength} rows={3} disabled={disabled} className={`${controlClass} h-auto py-2`} />
      ) : (
        <input name={name} type={type} value={value} onChange={onChange} required={required} min={min} step={step} maxLength={maxLength} disabled={disabled} className={controlClass} />
      )}
    </label>
  );
}

function EquipmentForm({ form, options, saving, error, loadingOptions, onChange, onSubmit, onClose, onRetryOptions }) {
  const buildings = useMemo(
    () => (options.buildings || []).filter((item) => String(item.campusId) === String(form.campusId)),
    [options.buildings, form.campusId],
  );
  const rooms = useMemo(
    () => (options.rooms || []).filter((item) => String(item.buildingId) === String(form.buildingId)),
    [options.rooms, form.buildingId],
  );
  const colleges = useMemo(
    () => (options.colleges || []).filter((item) => !item.campusId || String(item.campusId) === String(form.campusId)),
    [options.colleges, form.campusId],
  );
  const departments = useMemo(
    () => (options.departments || []).filter((item) => !form.collegeId || String(item.collegeId) === String(form.collegeId)),
    [options.departments, form.collegeId],
  );
  const availableOptions = Boolean(options.campuses?.length);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-5" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]" aria-label="Close equipment form" onClick={onClose} disabled={saving} />
      <section role="dialog" aria-modal="true" aria-labelledby="equipment-form-title" className="relative my-auto max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Central asset inventory</p>
            <h2 id="equipment-form-title" className="mt-1 text-lg font-semibold text-slate-900">{form.id ? 'Edit IT equipment' : 'Add IT equipment'}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close form"><X size={19} /></button>
        </header>
        <form onSubmit={onSubmit} className="flex max-h-[calc(94vh-73px)] flex-col">
          <div className="overflow-y-auto p-5 sm:p-6">
            {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
            {loadingOptions && <div className="mb-4 flex items-center gap-2 text-sm text-slate-500" role="status"><RefreshCw size={16} className="animate-spin" />Loading campus and department options…</div>}
            {!loadingOptions && !availableOptions && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                <span>No active campus is linked to this college. Ask an administrator to add or activate a campus and link it to this college in Admin Locations/Colleges, then retry.</span>
                <button type="button" onClick={onRetryOptions} className="shrink-0 font-semibold underline">Retry</button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <FormField label="Asset Name" name="name" value={form.name} onChange={onChange} required maxLength={255} />
              <FormField label="Category" name="category" value={form.category} onChange={onChange} required options={(options.categories?.length ? options.categories : CATEGORIES).map((value) => ({ value, label: value }))} />
              <FormField label="Quantity" name="quantity" value={form.quantity} onChange={onChange} required type="number" min="1" step="1" />
              <FormField label="Serial Number" name="serialNumber" value={form.serialNumber} onChange={onChange} maxLength={255} />
              <FormField label="Campus" name="campusId" value={form.campusId} onChange={onChange} required options={(options.campuses || []).map((item) => ({ value: String(item.id), label: item.campusName }))} />
              <FormField label="College" name="collegeId" value={form.collegeId} onChange={onChange} options={colleges.map((item) => ({ value: String(item.id), label: item.collegeName }))} />
              <FormField label="Department" name="departmentId" value={form.departmentId} onChange={onChange} options={departments.map((item) => ({ value: String(item.id), label: item.name }))} />
              <FormField label="Building" name="buildingId" value={form.buildingId} onChange={onChange} options={buildings.map((item) => ({ value: String(item.id), label: item.buildingName }))} disabled={!form.campusId} />
              <FormField label="Room" name="roomId" value={form.roomId} onChange={onChange} options={rooms.map((item) => ({ value: String(item.id), label: item.roomName || item.roomCode }))} disabled={!form.buildingId} />
              <FormField label="Status" name="status" value={form.status} onChange={onChange} required options={(options.statuses?.length ? options.statuses : STATUSES).map((value) => ({ value, label: value }))} />
              <FormField label="Condition" name="condition" value={form.condition} onChange={onChange} required options={(options.conditions?.length ? options.conditions : CONDITIONS).map((value) => ({ value, label: value }))} />
              <FormField label="Purchase Date" name="purchaseDate" value={form.purchaseDate} onChange={onChange} type="date" />
              <FormField label="Purchase Cost" name="purchasePrice" value={form.purchasePrice} onChange={onChange} type="number" min="0" step="0.01" />
              <FormField label="Warranty Expiry" name="warrantyExpiry" value={form.warrantyExpiry} onChange={onChange} type="date" />
              <FormField label="Description" name="description" value={form.description} onChange={onChange} type="textarea" wide maxLength={10000} />
            </div>
          </div>
          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || loadingOptions || !availableOptions} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving && <RefreshCw size={15} className="animate-spin" />}
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add IT Equipment'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function ICTEquipment() {
  const [equipment, setEquipment] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', category: '', status: '', condition: '' });
  const [sort, setSort] = useState({ sortBy: 'updatedAt', sortOrder: 'DESC' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [options, setOptions] = useState({});
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const loadEquipment = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) query.set(key, value.trim());
    });
    try {
      const result = await requestEquipment(`?${query.toString()}`, { signal });
      const rows = result.equipment || result.data;
      if (!Array.isArray(rows) || !result.pagination) throw new Error('The equipment service returned an incomplete list response.');
      setEquipment(rows);
      const totalPages = Math.max(1, Number(result.pagination.totalPages ?? result.pagination.pages) || 1);
      const currentPage = Number(result.pagination.page) || page;
      setPagination({ page: currentPage, total: Number(result.pagination.total ?? result.total) || 0, totalPages });
      if (currentPage !== page) setPage(currentPage);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || 'Unable to load IT equipment. Please try again.');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, page, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadEquipment(controller.signal), filters.search ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadEquipment, filters.search, refreshCount]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    setFormError('');
    try {
      const result = await requestEquipment('/options');
      if (!Array.isArray(result.campuses) || !Array.isArray(result.colleges)) throw new Error('Equipment form options are incomplete.');
      setOptions(result);
    } catch (requestError) {
      setFormError(requestError.message || 'Unable to load campus and department options.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const updateFilter = (field, value) => {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setPage(1);
  };

  const updateSort = (field) => {
    setSort((previous) => ({
      sortBy: field,
      sortOrder: previous.sortBy === field && previous.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
    setPage(1);
  };

  const openDetails = async (row) => {
    setSelectedAsset(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const result = await requestEquipment(`/${encodeURIComponent(row.id)}`);
      const asset = result.equipment || result.data;
      if (!asset || typeof asset !== 'object') throw new Error('The equipment service returned an invalid detail record.');
      setSelectedAsset(asset);
    } catch (requestError) {
      setDetailError(requestError.message || 'Unable to load equipment details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openForm = async (asset = null) => {
    setForm(asset ? formForAsset(asset) : { ...EMPTY_FORM });
    setFormError('');
    await loadOptions();
    if (asset) {
      setEditLoadingId(asset.id);
      try {
        const result = await requestEquipment(`/${encodeURIComponent(asset.id)}`);
        const current = result.equipment || result.data;
        if (!current || typeof current !== 'object') throw new Error('The equipment service returned an invalid detail record.');
        setForm(formForAsset(current));
      } catch (requestError) {
        setFormError(requestError.message || 'Unable to load equipment for editing.');
      } finally {
        setEditLoadingId(null);
      }
    }
  };

  const closeForm = () => {
    if (saving) return;
    setForm(null);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => {
      const next = { ...previous, [name]: value };
      if (name === 'campusId') {
        next.buildingId = '';
        next.roomId = '';
        next.collegeId = '';
        next.departmentId = '';
      }
      if (name === 'buildingId') next.roomId = '';
      if (name === 'collegeId') next.departmentId = '';
      return next;
    });
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (form.purchaseDate && form.warrantyExpiry && form.warrantyExpiry < form.purchaseDate) {
      setFormError('Warranty expiry cannot precede the purchase date.');
      return;
    }
    const quantity = Number(form.quantity);
    const purchasePrice = form.purchasePrice === '' ? 0 : Number(form.purchasePrice);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setFormError('Quantity must be a positive whole number.');
      return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setFormError('Purchase cost must be a non-negative number.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      serialNumber: form.serialNumber.trim(),
      quantity,
      campusId: Number(form.campusId),
      collegeId: form.collegeId ? Number(form.collegeId) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      buildingId: form.buildingId ? Number(form.buildingId) : null,
      roomId: form.roomId ? Number(form.roomId) : null,
      status: form.status,
      condition: form.condition,
      purchaseDate: form.purchaseDate || null,
      purchasePrice,
      warrantyExpiry: form.warrantyExpiry || null,
      description: form.description.trim(),
    };
    setSaving(true);
    setFormError('');
    try {
      const isEdit = Boolean(form.id);
      await requestEquipment(isEdit ? `/${encodeURIComponent(form.id)}` : '', {
        method: isEdit ? 'PUT' : 'POST',
        data: payload,
      });
      toast.success(isEdit ? 'IT equipment updated successfully.' : 'IT equipment added successfully.');
      setForm(null);
      setRefreshCount((count) => count + 1);
    } catch (requestError) {
      setFormError(requestError.message || 'Unable to save IT equipment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEquipment = async (asset) => {
    if (!window.confirm('Are you sure you want to delete this IT equipment?')) return;
    try {
      await requestEquipment(`/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
      toast.success('IT equipment deleted successfully.');
      setRefreshCount((count) => count + 1);
    } catch (requestError) {
      toast.error(requestError.message || 'Unable to delete IT equipment.');
    }
  };

  const closeDetails = () => {
    setSelectedAsset(null);
    setDetailError('');
    setDetailLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 ict-module-theme ict-theme-equipment">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Building2 size={16} />
              <span>ICT Asset Management</span><span>/</span><span className="text-slate-700">IT Equipment</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">IT Equipment</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Browse and inspect IT assets registered in the central asset inventory.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRefreshCount((count) => count + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh
            </button>
            <button type="button" onClick={() => openForm()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              <Plus size={16} />Add IT Equipment
            </button>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search asset, serial, campus, department..." aria-label="Search IT equipment" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select aria-label="Filter by category" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="h-10 min-w-[150px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-blue-500">
                  <option value="">All categories</option>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option value="">All statuses</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select aria-label="Filter by condition" value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)} className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option value="">All conditions</option>
                {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
              {hasActiveFilters && <button type="button" onClick={() => { setFilters({ search: '', category: '', status: '', condition: '' }); setPage(1); }} className="h-10 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">Clear filters</button>}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm text-slate-500" aria-live="polite">{loading ? 'Loading equipment…' : `${pagination.total.toLocaleString()} ${pagination.total === 1 ? 'asset' : 'assets'} found`}</p>
            {hasActiveFilters && <span className="text-xs text-slate-400">Filtered central inventory</span>}
          </div>

          {error && (
            <div className="mx-4 mb-4 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
              <div className="flex items-start gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Unable to load IT equipment. Please try again.</p><p className="mt-0.5">{error}</p></div></div>
              <button type="button" onClick={() => setRefreshCount((count) => count + 1)} className="shrink-0 rounded-md px-2 py-1 font-semibold hover:bg-rose-100">Retry</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3"><SortButton label="Asset ID" field="assetCode" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><SortButton label="Asset Name" field="name" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><SortButton label="Category" field="category" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><SortButton label="Serial Number" field="serialNumber" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><SortButton label="Quantity" field="quantity" sort={sort} onSort={updateSort} /></th>
                  {['Campus', 'College', 'Department', 'Building', 'Room'].map((label) => <th key={label} className="px-4 py-3"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span></th>)}
                  <th className="px-4 py-3"><SortButton label="Status" field="status" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><SortButton label="Condition" field="condition" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><SortButton label="Warranty Expiry" field="warrantyExpiry" sort={sort} onSort={updateSort} /></th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && Array.from({ length: 5 }, (_, index) => (
                  <tr key={`loading-${index}`} aria-hidden="true">{Array.from({ length: 14 }, (_, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>)}</tr>
                ))}
                {!loading && !error && equipment.map((asset) => (
                  <tr key={asset.id} className="transition hover:bg-blue-50/40">
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold text-blue-700">{assetIdentifier(asset)}</td>
                    <td className="max-w-[230px] px-4 py-4"><div className="truncate text-sm font-semibold text-slate-800" title={asset.name}>{asset.name || 'Unnamed asset'}</div></td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{categoryName(asset)}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">{asset.serialNumber || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{asset.quantity ?? '—'}</td>
                    <td className="max-w-[145px] truncate px-4 py-4 text-sm text-slate-600" title={campusName(asset)}>{campusName(asset)}</td>
                    <td className="max-w-[145px] truncate px-4 py-4 text-sm text-slate-600" title={collegeName(asset)}>{collegeName(asset)}</td>
                    <td className="max-w-[145px] truncate px-4 py-4 text-sm text-slate-600" title={departmentName(asset)}>{departmentName(asset)}</td>
                    <td className="max-w-[145px] truncate px-4 py-4 text-sm text-slate-600" title={buildingName(asset)}>{buildingName(asset)}</td>
                    <td className="max-w-[130px] truncate px-4 py-4 text-sm text-slate-600" title={roomName(asset)}>{roomName(asset)}</td>
                    <td className="whitespace-nowrap px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass(asset.status, 'status')}`}>{displayStatus(asset.status)}</span></td>
                    <td className="whitespace-nowrap px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass(asset.condition, 'condition')}`}>{displayCondition(asset.condition)}</span></td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{formatDate(asset.warrantyExpiry)}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openDetails(asset)} aria-label={`View details for ${asset.name || assetIdentifier(asset)}`} title="View" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={16} /></button>
                        <button type="button" onClick={() => openForm(asset)} disabled={editLoadingId === asset.id} aria-label={`Edit ${asset.name || assetIdentifier(asset)}`} title="Edit" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"><Edit2 size={16} /></button>
                        <button type="button" onClick={() => deleteEquipment(asset)} aria-label={`Delete ${asset.name || assetIdentifier(asset)}`} title="Delete" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !error && equipment.length === 0 && (
                  <tr><td colSpan="14" className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><MapPin size={22} /></div>
                    <h2 className="mt-4 text-sm font-semibold text-slate-800">{hasActiveFilters ? 'No matching equipment' : 'No IT equipment found'}</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{hasActiveFilters ? 'Adjust your search or filters and try again.' : 'No IT equipment records are currently available in the central asset inventory.'}</p>
                    {hasActiveFilters && <button type="button" onClick={() => { setFilters({ search: '', category: '', status: '', condition: '' }); setPage(1); }} className="mt-4 text-sm font-semibold text-blue-700 hover:text-blue-800">Clear filters</button>}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">{pagination.total ? `Showing ${((page - 1) * PAGE_SIZE) + 1}–${Math.min(page * PAGE_SIZE, pagination.total)} of ${pagination.total.toLocaleString()}` : 'No records'}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} />Previous</button>
              <span className="min-w-[94px] text-center text-sm text-slate-500">Page {page} of {pagination.totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || loading} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={16} /></button>
            </div>
          </footer>
        </section>
      </div>

      <EquipmentDetails asset={selectedAsset} loading={detailLoading} error={detailError} onClose={closeDetails} />
      {form && <EquipmentForm form={form} options={options} saving={saving} error={formError} loadingOptions={loadingOptions} onChange={handleFormChange} onSubmit={handleSubmit} onClose={closeForm} onRetryOptions={loadOptions} />}
    </main>
  );
}
