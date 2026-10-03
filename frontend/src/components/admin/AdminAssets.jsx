import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Building2, Check, ChevronLeft, ChevronRight, Circle, Download, Eye, FileText, History, Layers3, Package, Pencil, Plus, QrCode, RefreshCw, Search, Shield, Trash2, Undo2, UserCheck, Wrench, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './AdminAssets.css';

const STATUS_FILTER_OPTIONS = [
  { label: 'Active', value: 'available' },
  { label: 'Available', value: 'available' },
  { label: 'In Use', value: 'in-use' },
  { label: 'Under Maintenance', value: 'under-maintenance' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Replaced', value: 'replaced' },
  { label: 'Pending Disposal', value: 'pending-disposal' },
  { label: 'Retired', value: 'retired' },
  { label: 'Disposed', value: 'disposed' },
  { label: 'Expired', value: 'expired' },
];

const normalizeStatusText = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ');
  const aliases = {
    available: 'Active', active: 'Active', assigned: 'Active', 'in use': 'Active',
    'under maintenance': 'Under Maintenance', maintenance: 'Under Maintenance', damaged: 'Damaged',
    replaced: 'Replaced',     expired: 'Expired', retired: 'Retired', disposed: 'Disposed', deleted: 'Deleted',
    testing: 'Under Maintenance', lost: 'Damaged', missing: 'Damaged',
  };
  return aliases[normalized] || raw.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-GB');
};

const getWarrantyExpiry = (purchaseDate, years) => {
  const coverageYears = Number(years);
  if (!purchaseDate || !Number.isInteger(coverageYears) || coverageYears < 1) return null;
  const [year, month, day] = purchaseDate.split('-').map(Number);
  const expiry = new Date(year, month - 1, day);
  expiry.setFullYear(expiry.getFullYear() + coverageYears);
  return [expiry.getFullYear(), String(expiry.getMonth() + 1).padStart(2, '0'), String(expiry.getDate()).padStart(2, '0')].join('-');
};

export const buildLocationHierarchy = (asset = {}) => {
  const values = [
    asset?.CampusRecord?.campusName || asset?.campusName || asset?.campus || asset?.campus_name,
    asset?.CollegeRecord?.collegeName || asset?.CollegeRecord?.name || asset?.College?.collegeName || asset?.College?.name || asset?.collegeName || asset?.college?.name || (typeof asset?.college === 'string' ? asset.college : null) || asset?.college_name,
    asset?.DepartmentRecord?.name || asset?.departmentName || asset?.department?.name || (typeof asset?.department === 'string' ? asset.department : null) || asset?.department_name,
    asset?.LaboratoryRecord?.name || asset?.LaboratoryRecord?.laboratoryName || asset?.laboratoryName || asset?.laboratory?.name || (typeof asset?.laboratory === 'string' ? asset.laboratory : null) || asset?.laboratory_name,
    asset?.BuildingRecord?.buildingName || asset?.buildingName || asset?.building || asset?.building_name,
    asset?.FloorRecord?.floorName || asset?.floorName || asset?.floor || asset?.floor_name,
    asset?.RoomRecord?.roomName || asset?.roomName || asset?.room || asset?.room_name || asset?.location || asset?.locationName,
  ].filter(Boolean);
  if (values.length) return values.join(' → ');
  return asset?.locationHierarchy || asset?.location || asset?.locationName || 'Location not specified';
};

export const normalizeAssetRecord = (asset = {}, index = 0) => {
  const documents = Array.isArray(asset?.documents) ? asset.documents : Array.isArray(asset?.AssetDocuments) ? asset.AssetDocuments : Array.isArray(asset?.AssetDocument) ? asset.AssetDocument : [];
  const manual = documents.find((doc) => doc && doc.documentType === 'manual' && (doc.status === 'active' || doc.isActive !== false)) || null;
  const researchGrant = asset?.researchGrant || asset?.research_grant || asset?.GrantRecord?.name || asset?.grantName || asset?.fundingSource || 'No Grant';
  const warrantyInfo = asset?.WarrantyInfo || asset?.warrantyInfo || asset?.warranty || {};
  const warrantyExpiry = warrantyInfo.endDate || warrantyInfo.expiresAt || asset?.warrantyExpiry || asset?.warranty_expiry || null;
  const warrantyText = [warrantyInfo.provider || warrantyInfo.vendor || warrantyInfo.company, warrantyInfo.status, warrantyExpiry ? `Expires: ${formatDate(warrantyExpiry)}` : ''].filter(Boolean).join(' • ') || 'No Warranty';
  const rawStatus = String(asset?.status || asset?.assetStatus || 'Active');
  const assetId = asset?.assetCode || asset?.asset_code || asset?.digitalId || asset?.digital_id || asset?.assetId || asset?.id || `ASSET-${index + 1}`;
  const qrValue = asset?.rfidTag || asset?.rfid_tag || asset?.digitalId || asset?.digital_id || asset?.assetCode || String(asset?.id || assetId);
  return {
    id: Number(asset?.id ?? asset?.assetId ?? index + 1),
    assetId,
    name: asset?.name || asset?.assetName || 'Unnamed Asset',
    category: asset?.categoryName || asset?.category?.name || asset?.category || asset?.assetCategory || 'Uncategorized',
    serialNumber: asset?.serialNumber || asset?.serial_number || asset?.serial || '—',
    quantity: asset?.quantity ?? 1,
    purchaseDate: asset?.purchaseDate || asset?.purchase_date || asset?.createdAt || null,
    status: normalizeStatusText(rawStatus),
    rawStatus,
    department: asset?.departmentName || asset?.department?.name || (typeof asset?.department === 'string' ? asset.department : null) || asset?.department_name || 'Unassigned',
    campus: asset?.CampusRecord?.campusName || asset?.campusName || asset?.campus_name || '—',
    college: asset?.College?.collegeName || asset?.College?.name || asset?.collegeName || asset?.college_name || '—',
    departmentValue: asset?.DepartmentRecord?.name || asset?.departmentName || (typeof asset?.department === 'string' ? asset.department : null) || asset?.department_name || '—',
    laboratory: asset?.laboratoryName || asset?.LaboratoryRecord?.roomName || asset?.laboratory_name || '—',
    building: asset?.BuildingRecord?.buildingName || asset?.buildingName || asset?.building_name || '—',
    room: asset?.RoomRecord?.roomName || asset?.roomName || asset?.room_name || asset?.location || '—',
    locationHierarchy: buildLocationHierarchy(asset),
    assignedUser: asset?.assignedToName || asset?.assigned_to_name || asset?.AssignmentRecord?.User?.fullName || asset?.AssignmentRecord?.User?.username || 'Unassigned',
    researchGrant: researchGrant || 'No Grant',
    warranty: warrantyText,
    warrantyStatus: warrantyInfo.status || 'No Warranty',
    warrantyExpiry,
    hasManual: Boolean(manual),
    manualLabel: manual ? 'View Manual' : 'No Manual',
    qrValue,
    qrReady: Boolean(qrValue),
    raw: asset,
    document: manual,
  };
};

const getStatusStyle = (status) => {
  const value = String(status || '').toLowerCase();
  if (['active', 'available', 'in use', 'in-use'].includes(value)) return 'success';
  if (['damaged', 'lost', 'missing'].includes(value) || value.includes('expired')) return 'danger';
  if (['under maintenance', 'maintenance', 'testing'].includes(value)) return 'warning';
  if (value === 'pending disposal') return 'warning';
  if (['retired', 'disposed', 'deleted'].includes(value)) return 'neutral';
  return 'info';
};

const getRows = (value, keys) => {
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  if (value?.data && typeof value.data === 'object') return getRows(value.data, keys);
  return [];
};

export const getRegistrationChecks = (form = {}) => [
  { label: 'Asset Name', complete: Boolean(String(form.name || '').trim()) },
  { label: 'Category', complete: Boolean(form.category) },
  { label: 'Serial Number', complete: Boolean(String(form.serialNumber || '').trim()) },
  { label: 'Quantity', complete: Number.isInteger(Number(form.quantity)) && Number(form.quantity) > 0 && (!String(form.serialNumber || '').trim() || Number(form.quantity) === 1) },
  { label: 'Purchase Date', complete: Boolean(form.purchaseDate) },
  { label: 'Campus', complete: Boolean(form.campusId) },
  { label: 'College', complete: Boolean(form.collegeId) },
  { label: 'Department', complete: Boolean(form.departmentId) },
  { label: 'Laboratory', complete: Boolean(form.laboratoryId) },
  { label: 'Building', complete: Boolean(form.buildingId) },
  { label: 'Room', complete: Boolean(form.roomId) },
  { label: 'Status', complete: Boolean(form.status) },
  { label: 'Research Grant', complete: Boolean(String(form.fundingSource || '').trim()) },
  { label: 'Warranty', complete: Boolean(form.warrantyCoverage) },
  { label: 'Equipment Manual', complete: Boolean(form.equipmentManual) },
];

function AllAssets() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialStatus = searchParams.get('status') || 'All';
  const initialCategory = searchParams.get('category') || 'All';
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [filters, setFilters] = useState({ campus: '', college: '', department: '', laboratory: '', purchaseFrom: '', purchaseTo: '', grant: 'any', maintenanceStatus: '' });
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [qrAsset, setQrAsset] = useState(null);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [locations, setLocations] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [recoveryDays, setRecoveryDays] = useState(30);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', category: '', status: '', serialNumber: '', quantity: '', department: '', location: '', purchaseDate: '' });
  const [assignForm, setAssignForm] = useState({ userId: '', departmentId: '', location: '' });
  const [transferForm, setTransferForm] = useState({ departmentId: '', location: '', reason: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ title: '', description: '', priority: 'medium' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [assetSummary, setAssetSummary] = useState({});
  const searchInputRef = useRef(null);
  const modalRef = useRef(null);
  const requestControllerRef = useRef(null);
  const categories = useMemo(() => ['All', ...categoryOptions], [categoryOptions]);
  const categoryFilterOptions = useMemo(
    () => categoryFilter !== 'All' && !categoryOptions.includes(categoryFilter)
      ? ['All', categoryFilter, ...categoryOptions]
      : categories,
    [categories, categoryFilter, categoryOptions],
  );
  const campusOptions = useMemo(() => campuses.filter((item) => item.status === 'active').map((item) => ({ id: item.id, name: item.campusName || item.name })), [campuses]);
  const filteredDepartments = useMemo(() => departments.filter((item) => item.status === 'active' && (!filters.college || String(item.collegeId || item.college_id) === String(filters.college))), [departments, filters.college]);
  const laboratoryOptions = useMemo(() => rooms
    .filter((item) => item.status === 'active' && /lab/i.test(String(item.roomType || item.room_type || '')))
    .map((item) => ({ id: item.id, name: item.roomName || item.room_name || item.name, buildingId: item.buildingId || item.building_id }))
    .filter((item) => item.id && item.name), [rooms]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const fetchAssetRows = useCallback(async (nextPage = page, nextSize = pageSize) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/assets', {
        signal: controller.signal,
        params: {
          page: nextPage,
          limit: nextSize,
          search: debouncedSearch || undefined,
          status: deletedOnly || statusFilter === 'All' ? undefined : statusFilter,
          category: categoryFilter === 'All' ? undefined : categoryFilter,
          campus_id: filters.campus || undefined,
          college_id: filters.college || undefined,
          department_id: filters.department || undefined,
          laboratory_id: filters.laboratory || undefined,
          purchase_from: filters.purchaseFrom || undefined,
          purchase_to: filters.purchaseTo || undefined,
          research_grant: filters.grant === 'any' ? undefined : filters.grant,
          maintenance_status: filters.maintenanceStatus || undefined,
          deleted: deletedOnly ? 'true' : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        },
      });
      const payload = response?.data || {};
      const rows = getRows(payload, ['data', 'assets', 'rows']);
      const nextAssets = rows.map(normalizeAssetRecord);
      setAssets(nextAssets);
      setPagination(payload.pagination || payload.data?.pagination || { page: nextPage, limit: nextSize, total: nextAssets.length, pages: 1 });
      setAssetSummary(payload.summary || payload.data?.summary || {});
    } catch (requestError) {
      if (requestError?.code === 'ERR_CANCELED') return;
      console.error('Asset list loading error:', requestError);
      setAssets([]);
      const statusCode = requestError?.response?.status;
      setError(statusCode === 401
        ? 'Your session has expired. Sign in again to view assets.'
        : statusCode === 403
          ? 'Your account does not have permission to view all assets.'
          : getApiErrorMessage(requestError, 'Unable to load assets.'));
    } finally {
      if (requestControllerRef.current === controller) setLoading(false);
    }
  }, [categoryFilter, debouncedSearch, deletedOnly, filters, page, pageSize, sortBy, sortOrder, statusFilter]);

  const fetchLookups = useCallback(async () => {
    const [usersResult, departmentsResult, categoriesResult, collegesResult, locationsResult, campusesResult, buildingsResult, roomsResult, settingsResult] = await Promise.allSettled([
      apiClient.get('/api/users', { params: { limit: 500 } }),
      apiClient.get('/api/departments', { params: { limit: 500 } }),
      apiClient.get('/api/asset-categories', { params: { limit: 100, status: 'active' } }),
      apiClient.get('/api/colleges', { params: { limit: 500 } }),
      apiClient.get('/api/locations'),
      apiClient.get('/api/locations/campuses'),
      apiClient.get('/api/locations/buildings'),
      apiClient.get('/api/locations/rooms'),
      apiClient.get('/api/admin/settings'),
    ]);
    if (usersResult.status === 'fulfilled') setUsers(getRows(usersResult.value?.data, ['data', 'users']));
    if (departmentsResult.status === 'fulfilled') setDepartments(getRows(departmentsResult.value?.data, ['data', 'departments']));
    if (categoriesResult.status === 'fulfilled') {
      const rows = getRows(categoriesResult.value?.data, ['data', 'categories', 'items']);
      setCategoryOptions([...new Set(rows.map((item) => item.name || item.category).filter(Boolean))]);
    }
    if (collegesResult.status === 'fulfilled') setColleges(getRows(collegesResult.value?.data, ['data', 'colleges', 'items']));
    if (locationsResult.status === 'fulfilled') setLocations(getRows(locationsResult.value?.data, ['data', 'locations', 'items']));
    if (campusesResult.status === 'fulfilled') setCampuses(getRows(campusesResult.value?.data, ['data', 'campuses', 'items']));
    if (buildingsResult.status === 'fulfilled') setBuildings(getRows(buildingsResult.value?.data, ['data', 'buildings', 'items']));
    if (roomsResult.status === 'fulfilled') setRooms(getRows(roomsResult.value?.data, ['data', 'rooms', 'items']));
    if (settingsResult.status === 'fulfilled') {
      const settings = settingsResult.value?.data?.data || settingsResult.value?.data?.settings || {};
      const configuredDays = Number(settings.assets?.recoveryDays ?? settings.assets?.recovery_days);
      if (Number.isInteger(configuredDays) && configuredDays > 0) setRecoveryDays(configuredDays);
    }
    const lookupResults = [
      ['users', usersResult], ['departments', departmentsResult], ['categories', categoriesResult],
      ['colleges', collegesResult], ['locations', locationsResult], ['campuses', campusesResult],
      ['buildings', buildingsResult], ['rooms', roomsResult], ['settings', settingsResult],
    ];
    const failedLookups = lookupResults.filter(([, result]) => result.status === 'rejected');
    failedLookups.forEach(([name, result]) => console.error(`Asset ${name} lookup loading error:`, result.reason));
    setLookupError(failedLookups.length
      ? `Unable to load registration data: ${failedLookups.map(([name]) => name).join(', ')}.`
      : '');
  }, []);

  useEffect(() => { fetchAssetRows(page, pageSize); }, [fetchAssetRows, page, pageSize]);
  useEffect(() => { fetchLookups(); }, [fetchLookups]);
  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!modalType && !confirmation) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = modalRef.current;
    const getFocusable = () => dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [];
    getFocusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setModalType(null);
        setSelectedAsset(null);
        setConfirmation(null);
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = [...getFocusable()];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmation, modalType]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const closeModal = () => { setModalType(null); setSelectedAsset(null); };

  const openRegisterModal = () => {
    setSelectedAsset(null);
    setRegistrationForm({ name: '', category: '', serialNumber: '', quantity: '', purchaseDate: '', campusId: '', collegeId: '', departmentId: '', laboratoryId: '', buildingId: '', roomId: '', status: '', fundingSource: '', warrantyCoverage: '' });
    setManualFile(null);
    setRegistrationResult(null);
    setModalType('register');
  };

  const openAssetDetail = useCallback(async (asset) => {
    setSelectedAsset(asset);
    setModalType('detail');
    try {
      const response = await apiClient.get(`/api/assets/${asset.id}`);
      const detail = response?.data?.data || response?.data?.asset || asset.raw || asset;
      setSelectedAsset(normalizeAssetRecord(detail));
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'Unable to load asset details.'));
    }
  }, []);

  const openAssetHistory = useCallback(async (asset) => {
    setModalType('history');
    setSelectedAsset(asset);
    try {
      const response = await apiClient.get(`/api/assets/${asset.id}/history`);
      setHistoryRows(getRows(response?.data, ['data', 'history']));
    } catch (requestError) {
      setHistoryRows([]);
      toast.error(getApiErrorMessage(requestError, 'Unable to load asset history.'));
    }
  }, []);

  const openQrModal = (asset) => { setModalType('qr'); setSelectedAsset(asset); setQrAsset(asset); };

  const openEditModal = (asset) => {
    const raw = asset.raw || {};
    setSelectedAsset(asset);
    setEditForm({ name: asset.name, category: asset.category, status: raw.status || asset.rawStatus || asset.status, serialNumber: asset.serialNumber === '—' ? '' : asset.serialNumber, quantity: asset.quantity ?? 1, department: asset.department === 'Unassigned' ? '' : asset.department, location: raw.location || asset.locationHierarchy, purchaseDate: raw.purchaseDate || raw.purchase_date || '' });
    setModalType('edit');
  };
  const openAssignModal = (asset) => {
    navigate(`/admin/assets/assign?assetId=${encodeURIComponent(asset.id)}`, { state: { assetId: asset.id } });
  };
  const openTransferModal = (asset) => {
    navigate(`/admin/assets/transfer?assetId=${encodeURIComponent(asset.id)}`, { state: { assetId: asset.id } });
  };
  const openMaintenanceModal = (asset) => { setSelectedAsset(asset); setMaintenanceForm({ title: `${asset.name} maintenance request`, description: '', priority: 'medium' }); setModalType('maintenance'); };

  const openViewManual = async (asset) => {
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const response = await apiClient.get(`/api/assets/${asset.id}/documents`);
      const documents = getRows(response?.data, ['data', 'documents']);
      const manual = documents.find((document) => document.documentType === 'manual' && document.status === 'active');
      if (!manual) { previewWindow?.close(); toast.info('No manual is attached to this asset.'); return; }
      const fileResponse = await apiClient.get(`/api/assets/${asset.id}/documents/${manual.id}/file`, { responseType: 'blob' });
      const fileUrl = URL.createObjectURL(fileResponse.data);
      if (previewWindow) previewWindow.location.replace(fileUrl);
      else {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = manual.originalName || 'equipment-manual';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (requestError) {
      previewWindow?.close();
      toast.error(getApiErrorMessage(requestError, 'Unable to load equipment manual.'));
    }
  };

  const handleAction = async (action, asset) => {
    if (['delete', 'retire', 'dispose', 'completeDisposal'].includes(action)) {
      const copy = {
        delete: ['Delete asset', `Delete ${asset.name}? This will soft-delete the asset and record an audit event.`, 'Delete asset'],
        retire: ['Retire asset', `Retire ${asset.name}? This will keep the asset record and mark it as retired.`, 'Retire asset'],
        dispose: ['Dispose asset', `Dispose ${asset.name}? This will update its status and record the disposal event.`, 'Dispose asset'],
        completeDisposal: ['Complete disposal', `Mark ${asset.name} as disposed? Its disposal record and history will be retained.`, 'Complete disposal'],
      }[action];
      setConfirmation({ action, asset, title: copy[0], message: copy[1], label: copy[2] });
      return;
    }
    if (action === 'restore') {
      try { await apiClient.post(`/api/assets/${asset.id}/restore`); toast.success('Asset restored successfully.'); await fetchAssetRows(page, pageSize); }
      catch (requestError) { toast.error(getApiErrorMessage(requestError, 'Unable to restore asset.')); }
    } else if (action === 'viewManual') await openViewManual(asset);
    else if (action === 'viewHistory') await openAssetHistory(asset);
    else if (action === 'viewQr') openQrModal(asset);
    else if (action === 'view') await openAssetDetail(asset);
    else if (action === 'edit') openEditModal(asset);
    else if (action === 'assign') openAssignModal(asset);
    else if (action === 'transfer') openTransferModal(asset);
    else if (action === 'maintenance') openMaintenanceModal(asset);
  };

  const confirmDestructiveAction = async () => {
    if (!confirmation) return;
    const { action, asset } = confirmation;
    setSaving(true);
    try {
      if (action === 'delete') await apiClient.delete(`/api/assets/${asset.id}`);
      else if (action === 'completeDisposal') {
        const response = await apiClient.get('/api/disposals', { params: { limit: 100, status: 'Requested' } });
        const request = getRows(response?.data, ['data', 'disposals']).find((item) => Number(item.assetId || item.Asset?.id || item.asset?.id) === Number(asset.id) && String(item.status).toLowerCase() === 'requested');
        if (!request) throw new Error('No pending disposal record was found for this asset.');
        await apiClient.post(`/api/disposals/${request.id}/execute`);
      }
      else {
        const response = await apiClient.post('/api/disposals', { assetId: asset.id, type: action === 'retire' ? 'Retirement' : 'Disposal', condition: asset.raw?.condition || 'Poor', reason: `Administrative ${action} request` });
        const disposalId = response?.data?.data?.id || response?.data?.disposal?.id;
        if (action === 'retire' && disposalId) await apiClient.post(`/api/disposals/${disposalId}/retire`);
        if (action === 'dispose') await apiClient.put(`/api/assets/${asset.id}`, { status: 'pending-disposal' });
      }
      toast.success(action === 'delete' ? 'Asset deleted successfully.' : action === 'completeDisposal' ? `${asset.name} marked as disposed.` : `${asset.name} ${action === 'retire' ? 'retired' : 'disposal requested'}.`);
      setConfirmation(null);
      await fetchAssetRows(page, pageSize);
    } catch (requestError) { toast.error(getApiErrorMessage(requestError, `Unable to ${action} asset.`)); }
    finally { setSaving(false); }
  };

  const handleSubmitEdit = async (event) => {
    event.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/assets/${selectedAsset.id}`, { name: editForm.name, category: editForm.category, serialNumber: editForm.serialNumber, status: editForm.status, quantity: Number(editForm.quantity || 1), department: editForm.department, location: editForm.location, purchaseDate: editForm.purchaseDate || null });
      toast.success('Asset updated successfully.'); closeModal(); await fetchAssetRows(page, pageSize);
    } catch (requestError) { toast.error(getApiErrorMessage(requestError, 'Unable to update asset.')); }
    finally { setSaving(false); }
  };

  const handleSubmitRegistration = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const selectedDepartment = departments.find((item) => String(item.id) === String(registrationForm.departmentId));
      const selectedRoom = rooms.find((item) => String(item.id) === String(registrationForm.roomId));
      const warrantyExpiry = getWarrantyExpiry(registrationForm.purchaseDate, registrationForm.warrantyCoverage);
      const encodedManual = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(manualFile);
      });
      const response = await apiClient.post('/api/assets', {
        name: registrationForm.name.trim(),
        category: registrationForm.category,
        serialNumber: registrationForm.serialNumber.trim(),
        quantity: Number(registrationForm.quantity),
        purchaseDate: registrationForm.purchaseDate,
        campusId: registrationForm.campusId || null,
        collegeId: registrationForm.collegeId || null,
        departmentId: registrationForm.departmentId || null,
        department: selectedDepartment?.name || '',
        laboratoryId: registrationForm.laboratoryId || null,
        buildingId: registrationForm.buildingId || null,
        roomId: registrationForm.roomId || null,
        location: selectedRoom?.name || '',
        status: registrationForm.status,
        fundingSource: registrationForm.fundingSource,
        warrantyCoverage: registrationForm.warrantyCoverage,
        warrantyExpiry,
        equipmentManual: { fileName: manualFile.name, mimeType: manualFile.type, data: encodedManual },
      });
      const created = response?.data?.data || response?.data?.asset || {};
      setRegistrationResult(created);
      toast.success('Asset registered successfully.');
      setPage(1);
      await fetchAssetRows(1, pageSize);
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'Unable to register asset. Check the required fields.'));
    } finally { setSaving(false); }
  };

  const handleAssignSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await apiClient.post('/api/assignments', { asset_id: selectedAsset.id, assigned_to: assignForm.userId, department_id: assignForm.departmentId || selectedAsset.raw?.departmentId, location: assignForm.location || selectedAsset.raw?.location || '', condition_at_assignment: assignForm.condition || 'Good', assigned_date: assignForm.date || undefined, notes: JSON.stringify({ notes: assignForm.notes || '', laboratoryId: assignForm.laboratoryId || null }) });
      toast.success('Asset assigned successfully.'); closeModal(); await fetchAssetRows(page, pageSize);
    } catch (requestError) { toast.error(getApiErrorMessage(requestError, 'Unable to assign asset.')); }
    finally { setSaving(false); }
  };

  const handleTransferSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      const campusName = campusOptions.find((item) => String(item.id) === String(transferForm.campusId))?.name;
      const collegeName = colleges.find((item) => String(item.id) === String(transferForm.collegeId))?.name;
      const departmentName = departments.find((item) => String(item.id) === String(transferForm.departmentId))?.name;
      const laboratoryName = laboratoryOptions.find((item) => String(item.id) === String(transferForm.laboratoryId))?.name;
      const destination = [campusName, collegeName, departmentName, laboratoryName, transferForm.location].filter(Boolean).join(' / ');
      await apiClient.post('/api/transfers', { asset_id: selectedAsset.id, destination_department_id: transferForm.departmentId, new_location: destination, reason: transferForm.reason, notes: JSON.stringify({ condition: transferForm.condition || 'Good', campusId: transferForm.campusId || null, laboratoryId: transferForm.laboratoryId || null }) });
      toast.success('Asset transfer recorded successfully.'); closeModal(); await fetchAssetRows(page, pageSize);
    } catch (requestError) { toast.error(getApiErrorMessage(requestError, 'Unable to transfer asset.')); }
    finally { setSaving(false); }
  };

  const handleMaintenanceSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await apiClient.post('/api/maintenance', { asset_id: selectedAsset.id, title: maintenanceForm.title || `${selectedAsset.name} maintenance`, problem: maintenanceForm.title || `${selectedAsset.name} maintenance`, description: maintenanceForm.description || 'Maintenance requested from asset management workflow.', priority: maintenanceForm.priority });
      toast.success('Maintenance request created successfully.'); closeModal(); await fetchAssetRows(page, pageSize);
    } catch (requestError) { toast.error(getApiErrorMessage(requestError, 'Unable to create maintenance request.')); }
    finally { setSaving(false); }
  };

  const [registrationForm, setRegistrationForm] = useState({ name: '', category: '', serialNumber: '', quantity: '', purchaseDate: '', campusId: '', collegeId: '', departmentId: '', laboratoryId: '', buildingId: '', roomId: '', status: '', fundingSource: '', warrantyCoverage: '' });
  const [manualFile, setManualFile] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);

  const pageCount = Math.max(1, Number(pagination.pages || 1));
  const pageButtons = Array.from({ length: pageCount }, (_, index) => index + 1).filter((value) => value === 1 || value === pageCount || Math.abs(value - page) <= 1);
  const firstResult = pagination.total ? ((page - 1) * pageSize) + 1 : 0;
  const lastResult = Math.min(page * pageSize, Number(pagination.total ?? assets.length));
  const resetFilters = () => { setSearch(''); setStatusFilter('All'); setCategoryFilter('All'); setFilters({ campus: '', college: '', department: '', laboratory: '', purchaseFrom: '', purchaseTo: '', grant: 'any', maintenanceStatus: '' }); setDeletedOnly(false); setSortBy('created_at'); setSortOrder('desc'); setPage(1); };
  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value, ...(name === 'college' ? { department: '', laboratory: '' } : {}), ...(name === 'department' ? { laboratory: '' } : {}) }));
    setPage(1);
  };
  const activeFilters = [
    ...(search ? [['Search', search, () => { setSearch(''); setPage(1); }]] : []),
    ...(statusFilter !== 'All' ? [['Status', statusFilter, () => setStatusFilter('All')]] : []),
    ...(categoryFilter !== 'All' ? [['Category', categoryFilter, () => setCategoryFilter('All')]] : []),
    ...[['campus', 'Campus'], ['college', 'College'], ['department', 'Department'], ['laboratory', 'Laboratory'], ['purchaseFrom', 'From'], ['purchaseTo', 'To'], ['maintenanceStatus', 'Maintenance']].filter(([key]) => filters[key]).map(([key, label]) => [label, filters[key], () => updateFilter(key, '')]),
    ...(filters.grant !== 'any' ? [['Research grant', filters.grant === 'has' ? 'Has grant' : 'No grant', () => updateFilter('grant', 'any')]] : []),
    ...(deletedOnly ? [['Deleted assets', 'Only', () => setDeletedOnly(false)]] : []),
  ];

  return (
    <div className="admin-assets">
      <main className="aa-content">
        <header className="aa-page-header"><div><div className="aa-eyebrow">Asset Governance</div><h1 className="aa-page-title">All Assets</h1><p className="aa-subtitle">Manage every university asset, its location, warranty and lifecycle</p></div><div className="aa-header-actions"><button type="button" className="aa-button" onClick={() => fetchAssetRows(page, pageSize)} aria-label="Refresh assets" disabled={loading}><RefreshCw size={16} className={loading ? 'aa-spinning' : ''} />Refresh</button><button type="button" className="aa-button aa-button-primary" onClick={openRegisterModal} aria-label="Register asset"><Plus size={16} />Register Asset</button></div></header>
        {error && <div className="aa-alert" role="alert"><div className="aa-alert-message"><AlertTriangle size={18} /><div><strong>Unable to load assets</strong><div>{error}</div></div></div><button type="button" className="aa-button" onClick={() => fetchAssetRows(page, pageSize)} aria-label="Retry loading assets">Retry</button></div>}
        {lookupError && <div className="aa-alert" role="alert"><div className="aa-alert-message"><AlertTriangle size={18} /><div><strong>Registration data unavailable</strong><div>{lookupError}</div></div></div><button type="button" className="aa-button" onClick={fetchLookups} aria-label="Retry loading registration data">Retry</button></div>}
        <section className="aa-toolbar" aria-label="Asset filters">
          <label className="aa-filter-search"><Search size={16} aria-hidden="true" /><input ref={searchInputRef} aria-label="Filter assets" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search assets, serial numbers, locations..." />{search && <button type="button" className="aa-clear-search" onClick={() => { setPage(1); setSearch(''); }} aria-label="Clear search"><X size={16} /></button>}</label>
          <select aria-label="Filter by status" className="aa-select" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}><option value="All">All Statuses</option>{STATUS_FILTER_OPTIONS.map((status) => <option key={`${status.label}-${status.value}`} value={status.value}>{status.label}</option>)}</select>
          <select aria-label="Filter by category" className="aa-select" value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value); }}>{categoryFilterOptions.map((category) => <option key={category} value={category}>{category === 'All' ? 'All Categories' : category}</option>)}</select>
          <select aria-label="Filter by campus" className="aa-select" value={filters.campus} onChange={(event) => updateFilter('campus', event.target.value)}><option value="">All Campuses</option>{campusOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select aria-label="Filter by college" className="aa-select" value={filters.college} onChange={(event) => updateFilter('college', event.target.value)}><option value="">All Colleges</option>{colleges.map((item) => <option key={item.id} value={item.id}>{item.name || item.collegeName}</option>)}</select>
          <select aria-label="Filter by department" className="aa-select" value={filters.department} onChange={(event) => updateFilter('department', event.target.value)}><option value="">All Departments</option>{filteredDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select aria-label="Filter by laboratory" className="aa-select" value={filters.laboratory} onChange={(event) => updateFilter('laboratory', event.target.value)}><option value="">All Laboratories</option>{laboratoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label className="aa-date-filter">Purchase from<input aria-label="Purchase date from" type="date" value={filters.purchaseFrom} onChange={(event) => updateFilter('purchaseFrom', event.target.value)} /></label>
          <label className="aa-date-filter">Purchase to<input aria-label="Purchase date to" type="date" value={filters.purchaseTo} onChange={(event) => updateFilter('purchaseTo', event.target.value)} /></label>
          <select aria-label="Filter by research grant" className="aa-select" value={filters.grant} onChange={(event) => updateFilter('grant', event.target.value)}><option value="any">Any Grant</option><option value="has">Has Grant</option><option value="none">No Grant</option></select>
          <select aria-label="Filter by maintenance status" className="aa-select" value={filters.maintenanceStatus} onChange={(event) => updateFilter('maintenanceStatus', event.target.value)}><option value="">Any Maintenance</option><option value="open">Open</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
          <label className="aa-deleted-toggle"><input type="checkbox" checked={deletedOnly} onChange={(event) => { setDeletedOnly(event.target.checked); if (event.target.checked) setStatusFilter('All'); setPage(1); }} />Deleted</label>
          <select aria-label="Sort assets by" className="aa-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="created_at">Created date</option><option value="name">Name</option><option value="status">Status</option><option value="purchaseDate">Purchase date</option><option value="assetCode">Asset ID</option></select>
          <select aria-label="Sort order" className="aa-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select><button type="button" className="aa-button aa-button-ghost" onClick={resetFilters} aria-label="Reset filters">Reset filters</button>
        </section>
        {activeFilters.length > 0 && <div className="aa-active-filters" aria-label="Active filters">{activeFilters.map(([label, value, remove]) => <button type="button" className="aa-filter-chip" key={`${label}-${value}`} onClick={remove} aria-label={`Remove ${label} filter ${value}`}>{label}: {value}<X size={13} /></button>)}</div>}
        <section className="aa-summary" aria-label="Asset summary">
          <SummaryCard icon={<Package size={21} />} label="Total assets" value={pagination.total ?? assets.length} />
          <SummaryCard icon={<Layers3 size={21} />} label="Current page" value={`${page} of ${pageCount}`} />
          <SummaryCard icon={<Building2 size={21} />} label="Visible assets" value={assets.length} />
          {assetSummary.maintenance !== undefined && <SummaryCard icon={<Wrench size={21} />} label="Under maintenance" value={assetSummary.maintenance} />}
          {assetSummary.retired !== undefined && <SummaryCard icon={<Shield size={21} />} label="Retired" value={assetSummary.retired} />}
        </section>
        <section className="aa-table-card" aria-label="All university assets"><div className="aa-table-scroll"><table className="aa-table">
          <thead><tr><th scope="col">Asset ID</th><th scope="col">Asset Name</th><th scope="col">Category</th><th scope="col">Serial Number</th><th scope="col">Quantity</th><th scope="col">Purchase Date</th><th scope="col">Status</th><th scope="col">Campus</th><th scope="col">College</th><th scope="col">Department</th><th scope="col">Laboratory</th><th scope="col">Building</th><th scope="col">Room</th><th scope="col">QR Code</th><th scope="col">Research Grant</th><th scope="col">Warranty</th><th scope="col">Equipment Manual</th><th scope="col">Actions</th></tr></thead>
          <tbody>{loading ? Array.from({ length: 7 }, (_, index) => <tr className="aa-skeleton-row" key={`skeleton-${index}`} aria-hidden="true">{Array.from({ length: 18 }, (_, cell) => <td key={cell}><span className="aa-skeleton" /></td>)}</tr>) : assets.length === 0 && !error ? <tr><td colSpan="18"><div className="aa-empty"><span className="aa-empty-icon"><Package size={25} /></span><strong>No assets found</strong><span>Try changing filters or refresh</span><button type="button" className="aa-button aa-button-primary" onClick={() => fetchAssetRows(page, pageSize)} aria-label="Refresh asset list"><RefreshCw size={15} />Refresh</button></div></td></tr> : error ? <tr><td colSpan="18"><div className="aa-empty"><strong>Asset list unavailable</strong><button type="button" className="aa-button aa-button-primary" onClick={() => fetchAssetRows(page, pageSize)} aria-label="Retry loading asset list"><RefreshCw size={15} />Retry</button></div></td></tr> : assets.map((asset) => <AssetTableRow key={asset.id} asset={asset} recoveryDays={recoveryDays} onAction={handleAction} onQr={openQrModal} onManual={openViewManual} />)}</tbody>
        </table></div></section>
        <nav className="aa-pagination" aria-label="Asset pagination"><span>Showing {firstResult}–{lastResult} of {pagination.total ?? assets.length}</span><div className="aa-pagination-controls">
          <button type="button" className="aa-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} />Previous</button>
          <div className="aa-page-numbers">{pageButtons.map((value, index) => <React.Fragment key={value}>{index > 0 && value - pageButtons[index - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" className="aa-page-number" aria-label={`Page ${value}`} aria-current={page === value ? 'page' : undefined} onClick={() => setPage(value)}>{value}</button></React.Fragment>)}</div>
          <span>Page {page} of {pageCount}</span><button type="button" className="aa-button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next<ChevronRight size={16} /></button>
          <select aria-label="Assets per page" className="aa-select" value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option></select>
        </div></nav>
      </main>
      {modalType && (selectedAsset || modalType === 'register') && <AssetModal type={modalType} asset={selectedAsset || {}} qrAsset={qrAsset} historyRows={historyRows} users={users} departments={departments} colleges={colleges} locations={locations} buildings={buildings} rooms={rooms} categories={categoryOptions} campusOptions={campusOptions} laboratoryOptions={laboratoryOptions} saving={saving} modalRef={modalRef} onClose={closeModal} onEdit={handleSubmitEdit} onAssign={handleAssignSubmit} onTransfer={handleTransferSubmit} onMaintenance={handleMaintenanceSubmit} onRegister={handleSubmitRegistration} editForm={editForm} setEditForm={setEditForm} assignForm={assignForm} setAssignForm={setAssignForm} transferForm={transferForm} setTransferForm={setTransferForm} maintenanceForm={maintenanceForm} setMaintenanceForm={setMaintenanceForm} registrationForm={registrationForm} setRegistrationForm={setRegistrationForm} registrationResult={registrationResult} manualFile={manualFile} setManualFile={setManualFile} />}
      {confirmation && <ConfirmationModal confirmation={confirmation} saving={saving} modalRef={modalRef} onCancel={() => setConfirmation(null)} onConfirm={confirmDestructiveAction} />}
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return <div className="aa-summary-card"><span className="aa-summary-icon">{icon}</span><div><div className="aa-summary-label">{label}</div><div className="aa-summary-value">{value}</div></div></div>;
}

function AssetTableRow({ asset, recoveryDays, onAction, onQr, onManual }) {
  const warrantyEnd = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) : null;
  const warrantyExpired = warrantyEnd && warrantyEnd < new Date();
  const warrantyExpiring = warrantyEnd && !warrantyExpired && warrantyEnd.getTime() - Date.now() < 30 * 86400000;
  const warrantyClass = !asset.warrantyExpiry ? 'aa-neutral' : warrantyExpired ? 'aa-danger' : warrantyExpiring ? 'aa-warning' : 'aa-success';
  const warrantyLabel = !asset.warrantyExpiry ? 'No Warranty' : warrantyExpired ? 'Expired' : warrantyExpiring ? 'Expiring' : 'Valid';
  const deletedAt = asset.raw?.deletedAt || asset.raw?.deleted_at;
  const recoveryDaysLeft = deletedAt ? Math.max(0, recoveryDays - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000)) : 0;
  const isRecoverable = Boolean(deletedAt) && recoveryDaysLeft > 0;
  const isTerminal = ['retired', 'disposed', 'pending-disposal'].includes(String(asset.rawStatus || '').toLowerCase());
  return <tr>
    <td><span className="aa-asset-code">{asset.assetId}</span></td>
    <td><div className="aa-primary-text">{asset.name}</div>{deletedAt && <div className="aa-secondary-text">Deleted on {formatDate(deletedAt)} / {isRecoverable ? `${recoveryDaysLeft} days left to restore` : 'Recovery period expired'}</div>}</td>
    <td>{asset.category}</td>
    <td>{asset.serialNumber}</td>
    <td>{asset.quantity}</td>
    <td>{formatDate(asset.purchaseDate)}</td>
    <td><span className={`aa-status aa-${getStatusStyle(asset.status)}`}>{asset.status}</span></td>
    <td>{asset.campus}</td>
    <td>{asset.college}</td>
    <td>{asset.departmentValue}</td>
    <td>{asset.laboratory}</td>
    <td>{asset.building}</td>
    <td>{asset.room}</td>
    <td>{asset.qrReady ? <button type="button" className="aa-button" onClick={() => onQr(asset)} aria-label={`View QR code for ${asset.name}`}><QrCode size={15} />View QR</button> : <span className="aa-secondary-text">No QR</span>}</td>
    <td><span className={`aa-chip ${asset.researchGrant === 'No Grant' ? 'aa-chip-muted' : ''}`}>{asset.researchGrant}</span></td>
    <td><div className="aa-warranty"><span className={`aa-status ${warrantyClass}`}>{warrantyLabel}</span><span className="aa-secondary-text">{asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : '—'}</span></div></td>
    <td>{asset.hasManual ? <button type="button" className="aa-button" onClick={() => onManual(asset)} aria-label={`View equipment manual for ${asset.name}`}><FileText size={15} />View Manual</button> : <span className="aa-secondary-text">No Manual</span>}</td>
    <td><div className="aa-action-group">
      <ActionButton label={`View ${asset.name}`} title="View asset" onClick={() => onAction('view', asset)}><Eye size={16} /></ActionButton>
      {!deletedAt && <ActionButton label={`Edit ${asset.name}`} title="Edit asset" onClick={() => onAction('edit', asset)}><Pencil size={16} /></ActionButton>}
      {!deletedAt && !isTerminal && <ActionButton label={`Assign ${asset.name}`} title="Assign asset" onClick={() => onAction('assign', asset)}><UserCheck size={16} /></ActionButton>}
      {!deletedAt && !isTerminal && <ActionButton label={`Transfer ${asset.name}`} title="Transfer asset" onClick={() => onAction('transfer', asset)}><ArrowLeftRight size={16} /></ActionButton>}
      {!deletedAt && !isTerminal && <ActionButton label={`Send ${asset.name} to maintenance`} title="Send to maintenance" onClick={() => onAction('maintenance', asset)}><Wrench size={16} /></ActionButton>}
      <ActionButton label={`View history for ${asset.name}`} title="View history" onClick={() => onAction('viewHistory', asset)}><History size={16} /></ActionButton>
      <ActionButton label={`View QR code for ${asset.name}`} title="View QR code" onClick={() => onAction('viewQr', asset)}><QrCode size={16} /></ActionButton>
      {!deletedAt && !isTerminal && <ActionButton label={`Retire ${asset.name}`} title="Retire asset" variant="aa-action-warning" onClick={() => onAction('retire', asset)}><Shield size={16} /></ActionButton>}
      {!deletedAt && !isTerminal && <ActionButton label={`Dispose ${asset.name}`} title="Dispose asset" variant="aa-action-danger" onClick={() => onAction('dispose', asset)}><AlertTriangle size={16} /></ActionButton>}
      {deletedAt ? isRecoverable && <ActionButton label={`Restore ${asset.name}`} title="Restore asset" onClick={() => onAction('restore', asset)}><Undo2 size={16} /></ActionButton> : <ActionButton label={`Delete ${asset.name}`} title="Delete asset" variant="aa-action-danger" onClick={() => onAction('delete', asset)}><Trash2 size={16} /></ActionButton>}
      {!deletedAt && String(asset.rawStatus || '').toLowerCase() === 'pending-disposal' && <ActionButton label={`Complete disposal for ${asset.name}`} title="Complete disposal" variant="aa-action-warning" onClick={() => onAction('completeDisposal', asset)}><AlertTriangle size={16} /></ActionButton>}
    </div></td>
  </tr>;
}

function ActionButton({ children, label, title, variant = '', onClick }) {
  return <button type="button" className={`aa-icon-button ${variant}`} title={title} aria-label={label} onClick={onClick}>{children}</button>;
}

function DetailRow({ label, value }) {
  return <div className="aa-detail-tile"><div className="aa-detail-label">{label}</div><div className="aa-detail-value">{value || '—'}</div></div>;
}

function AssetModal({ type, asset, qrAsset, historyRows, users, departments, colleges, locations, buildings, rooms, categories, campusOptions, laboratoryOptions, saving, modalRef, onClose, onEdit, onAssign, onTransfer, onMaintenance, onRegister, editForm, setEditForm, assignForm, setAssignForm, transferForm, setTransferForm, maintenanceForm, setMaintenanceForm, registrationForm, setRegistrationForm, registrationResult, manualFile, setManualFile }) {
  const title = type === 'register' ? registrationResult ? 'Registration complete' : 'Register Asset' : type === 'detail' ? asset.name : type === 'qr' ? 'Asset QR Code' : type === 'history' ? `${asset.name} History` : type === 'edit' ? 'Edit Asset' : type === 'assign' ? 'Assign Asset' : type === 'transfer' ? 'Transfer Asset' : 'Send to Maintenance';
  const registrationChecks = getRegistrationChecks({ ...registrationForm, equipmentManual: manualFile });
  const completedRegistrationFields = registrationChecks.filter((item) => item.complete).length;
  const closeOnBackdrop = (event) => { if (event.target === event.currentTarget) onClose(); };
  return <div className="aa-modal-backdrop" onMouseDown={closeOnBackdrop}><section className="aa-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
    <header className="aa-modal-header"><div><div className="aa-eyebrow">{type === 'detail' ? 'Asset summary' : type === 'qr' ? 'Asset identity' : type === 'history' ? 'Audit trail' : 'Asset workflow'}</div><h2 className="aa-modal-title" id="asset-modal-title">{title}</h2></div><button type="button" className="aa-icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></header>
    {type === 'detail' && <div className="aa-modal-body"><div className="aa-detail-grid"><DetailRow label="Asset ID" value={asset.assetId} /><DetailRow label="Asset Name" value={asset.name} /><DetailRow label="Category" value={asset.category} /><DetailRow label="Serial Number" value={asset.serialNumber} /><DetailRow label="Quantity" value={asset.quantity} /><DetailRow label="Purchase Date" value={formatDate(asset.purchaseDate)} /><DetailRow label="Status" value={<span className={`aa-status aa-${getStatusStyle(asset.status)}`}>{asset.status}</span>} /><DetailRow label="Condition" value={asset.raw?.condition} /><DetailRow label="Location Hierarchy" value={asset.locationHierarchy} /><DetailRow label="Department" value={asset.department} /><DetailRow label="Assigned User" value={asset.assignedUser} /><DetailRow label="Research Grant" value={asset.researchGrant} /><DetailRow label="Warranty" value={asset.warranty} /><DetailRow label="Equipment Manual" value={asset.hasManual ? 'Available' : 'No Manual'} /><DetailRow label="Funding Source" value={asset.raw?.fundingSource || asset.raw?.funding_source} /><DetailRow label="Supplier" value={asset.raw?.supplier} /><DetailRow label="Manufacturer / Model" value={[asset.raw?.manufacturer, asset.raw?.model].filter(Boolean).join(' / ')} /><DetailRow label="Purchase Cost" value={asset.raw?.purchasePrice || asset.raw?.purchase_cost} /><DetailRow label="Notes" value={asset.raw?.notes} /><DetailRow label="Created By" value={asset.raw?.createdBy} /><DetailRow label="Created" value={formatDate(asset.raw?.createdAt)} /><DetailRow label="Updated" value={formatDate(asset.raw?.updatedAt)} /><DetailRow label="Deleted" value={formatDate(asset.raw?.deletedAt || asset.raw?.deleted_at)} /></div></div>}
    {type === 'history' && <div className="aa-modal-body">{historyRows.length ? <div className="aa-timeline">{historyRows.map((item, index) => <article className="aa-timeline-item" key={`${item.id || item.date || index}`}><div className="aa-primary-text">{item.actionType || item.action || item.type || 'History Event'}</div><div className="aa-secondary-text">{item.description || item.details || item.notes || 'No description provided.'}</div><div className="aa-history-date">{formatDate(item.createdAt || item.created_at || item.date)}</div></article>)}</div> : <div className="aa-empty"><History size={24} /><strong>No asset history available</strong></div>}</div>}
    {type === 'qr' && qrAsset && <div className="aa-modal-body"><div className="aa-qr-panel"><div className="aa-qr-card"><QRCodeSVG id="asset-qr-svg" value={String(qrAsset.qrValue || qrAsset.assetId || window.location.href)} size={220} includeMargin /></div><div><div className="aa-primary-text">{qrAsset.name}</div><div className="aa-secondary-text">Asset ID: {qrAsset.assetId}</div><div className="aa-secondary-text">Serial: {qrAsset.serialNumber}</div></div><div className="aa-pagination-controls"><button type="button" className="aa-button aa-button-primary" aria-label="Print QR code" onClick={() => window.print()}><Download size={15} />Print</button><button type="button" className="aa-button" aria-label="Download QR code" onClick={() => { const node = document.getElementById('asset-qr-svg'); if (!node) return; const serialized = new XMLSerializer().serializeToString(node); const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `${qrAsset.assetId}.svg`; link.click(); URL.revokeObjectURL(url); }}><Download size={15} />Download</button></div></div></div>}
    {type === 'register' && registrationResult && <div className="aa-modal-body aa-registration-success">
      <div className="aa-registration-success-heading"><span className="aa-registration-success-icon"><Check size={22} /></span><div><div className="aa-eyebrow">MySQL record saved</div><h3>Asset registered successfully</h3></div></div>
      <div className="aa-registration-result-grid"><DetailRow label="Asset ID" value={registrationResult.assetCode || registrationResult.asset_id || registrationResult.id} /><DetailRow label="Created by" value={registrationResult.createdBy ? `User ${registrationResult.createdBy}` : 'Current administrator'} /><DetailRow label="Created at" value={formatTimestamp(registrationResult.createdAt || new Date())} /><div className="aa-registration-result-qr"><div className="aa-detail-label">QR code</div><QRCodeSVG value={String(registrationResult.digitalId || registrationResult.digital_id || registrationResult.assetCode || registrationResult.id)} size={112} includeMargin /></div></div>
      <ul className="aa-registration-outcomes"><li><Check size={16} />Unique Asset ID generated</li><li><Check size={16} />QR value created</li><li><Check size={16} />MySQL record saved</li><li><Check size={16} />Creating user and timestamp recorded</li><li><Check size={16} />Asset history and audit entry created</li>{manualFile && <li><Check size={16} />Equipment manual uploaded</li>}</ul>
      <footer className="aa-modal-footer"><button type="button" className="aa-button aa-button-primary" onClick={onClose}>Done</button></footer>
    </div>}
    {['register', 'edit', 'assign', 'transfer', 'maintenance'].includes(type) && !(type === 'register' && registrationResult) && <form className={`aa-modal-body ${type === 'register' ? 'aa-registration-form' : 'aa-form-grid'}`} onSubmit={type === 'register' ? onRegister : type === 'edit' ? onEdit : type === 'assign' ? onAssign : type === 'transfer' ? onTransfer : onMaintenance}>
      {type === 'register' && <div className="aa-registration-layout">
        <div className="aa-registration-main"><div className="aa-registration-form-heading"><h3>Registration details</h3><p>Required fields are marked with an asterisk and must be completed before the record can be saved.</p></div><div className="aa-registration-fields">
          <label className="aa-label">Asset Name *<input required maxLength="255" placeholder="Enter asset name" value={registrationForm.name} onChange={(event) => setRegistrationForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="aa-label">Category *<select required value={registrationForm.category} onChange={(event) => setRegistrationForm((current) => ({ ...current, category: event.target.value }))}><option value="">Select category</option>{categories.filter((category) => category !== 'All').map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="aa-label">Serial Number *<input required maxLength="255" placeholder="Enter serial number" value={registrationForm.serialNumber} onChange={(event) => setRegistrationForm((current) => ({ ...current, serialNumber: event.target.value }))} /></label>
          <label className="aa-label">Quantity *<input required type="number" min="1" max={registrationForm.serialNumber ? 1 : undefined} step="1" placeholder="Enter quantity" value={registrationForm.quantity} onChange={(event) => setRegistrationForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
          <label className="aa-label">Purchase Date *<input required type="date" value={registrationForm.purchaseDate} onChange={(event) => setRegistrationForm((current) => ({ ...current, purchaseDate: event.target.value }))} /></label>
          <label className="aa-label">Campus *<select required value={registrationForm.campusId} onChange={(event) => setRegistrationForm((current) => ({ ...current, campusId: event.target.value, buildingId: '', laboratoryId: '', roomId: '' }))}><option value="">Select campus</option>{campusOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="aa-label">College *<select required value={registrationForm.collegeId} onChange={(event) => setRegistrationForm((current) => ({ ...current, collegeId: event.target.value, departmentId: '' }))}><option value="">Select college</option>{colleges.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name || item.collegeName}</option>)}</select></label>
          <label className="aa-label">Department *<select required value={registrationForm.departmentId} onChange={(event) => setRegistrationForm((current) => ({ ...current, departmentId: event.target.value, laboratoryId: '' }))}><option value="">Select department</option>{departments.filter((item) => !registrationForm.collegeId || String(item.collegeId || item.college_id) === String(registrationForm.collegeId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="aa-label">Building *<select required value={registrationForm.buildingId} onChange={(event) => setRegistrationForm((current) => ({ ...current, buildingId: event.target.value, laboratoryId: '', roomId: '' }))}><option value="">Select building</option>{buildings.filter((item) => item.status === 'active' && (!registrationForm.campusId || String(item.campusId || item.campus_id) === String(registrationForm.campusId))).map((item) => <option key={item.id} value={item.id}>{item.buildingName || item.building_name || item.name}</option>)}</select></label>
          <label className="aa-label">Laboratory *<select required disabled={!registrationForm.buildingId} value={registrationForm.laboratoryId} onChange={(event) => setRegistrationForm((current) => ({ ...current, laboratoryId: event.target.value, roomId: '' }))}><option value="">Select laboratory</option>{laboratoryOptions.filter((item) => String(item.buildingId) === String(registrationForm.buildingId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="aa-label">Room *<select required disabled={!registrationForm.laboratoryId} value={registrationForm.roomId} onChange={(event) => setRegistrationForm((current) => ({ ...current, roomId: event.target.value }))}><option value="">Select room</option>{rooms.filter((item) => item.status === 'active' && String(item.buildingId || item.building_id) === String(registrationForm.buildingId) && String(item.id) === String(registrationForm.laboratoryId)).map((item) => <option key={item.id} value={item.id}>{item.roomName || item.room_name || item.name}</option>)}</select></label>
          <label className="aa-label">Status *<select required value={registrationForm.status} onChange={(event) => setRegistrationForm((current) => ({ ...current, status: event.target.value }))}><option value="">Select status</option><option value="available">Active</option><option value="in-use">In Use</option><option value="under-maintenance">Under Maintenance</option><option value="damaged">Damaged</option></select></label>
          <label className="aa-label">Research Grant *<input required placeholder="Enter grant or funding code (or None)" value={registrationForm.fundingSource} onChange={(event) => setRegistrationForm((current) => ({ ...current, fundingSource: event.target.value }))} /></label>
          <label className="aa-label">Warranty *<select required value={registrationForm.warrantyCoverage} onChange={(event) => setRegistrationForm((current) => ({ ...current, warrantyCoverage: event.target.value }))}><option value="">Select warranty coverage</option><option value="none">No warranty</option><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option><option value="5">5 years</option></select></label>
          <label className="aa-label aa-form-wide">Equipment Manual *<input required type="file" accept=".pdf,.doc,.jpg,.jpeg,.png,application/pdf,application/msword,image/jpeg,image/png" onChange={(event) => setManualFile(event.target.files?.[0] || null)} /><span className="aa-secondary-text">{manualFile?.name || 'Upload PDF, DOC, JPG, or PNG (max 10 MB)'}</span></label>
        </div></div>
        <aside className="aa-registration-feedback" aria-label="Registration completion feedback"><div className="aa-registration-progress-heading"><div><div className="aa-eyebrow">Completion feedback</div><strong>{completedRegistrationFields} / {registrationChecks.length} complete</strong></div><div className="aa-registration-progress-track"><span style={{ width: `${(completedRegistrationFields / registrationChecks.length) * 100}%` }} /></div></div><ul className="aa-registration-checklist">{registrationChecks.map((item) => <li key={item.label} className={item.complete ? 'is-complete' : ''}>{item.complete ? <Check size={15} /> : <Circle size={15} />}{item.label}</li>)}</ul><div className="aa-registration-explainer"><h4>What registration does</h4><p>Creates a persistent MySQL asset record with a unique identifier, tracking QR value, creator, timestamp, and history entry.</p></div><ul className="aa-registration-outcomes"><li><Check size={15} />Asset ID</li><li><Check size={15} />QR code</li><li><Check size={15} />MySQL record</li><li><Check size={15} />User + timestamp</li><li><Check size={15} />History entry</li></ul></aside>
      </div>}
      {type === 'edit' && <><label className="aa-label">Asset name *<input required value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="aa-label">Category<input value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))} /></label><label className="aa-label">Serial number<input value={editForm.serialNumber} onChange={(event) => setEditForm((current) => ({ ...current, serialNumber: event.target.value }))} /></label><label className="aa-label">Status<select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}><option value="available">Active</option><option value="in-use">In Use</option><option value="under-maintenance">Under Maintenance</option><option value="damaged">Damaged</option><option value="retired">Retired</option><option value="disposed">Disposed</option><option value="expired">Expired</option></select></label><label className="aa-label">Quantity<input type="number" min="1" value={editForm.quantity} onChange={(event) => setEditForm((current) => ({ ...current, quantity: event.target.value }))} /></label><label className="aa-label">Department<input value={editForm.department} onChange={(event) => setEditForm((current) => ({ ...current, department: event.target.value }))} /></label><label className="aa-label">Location<input value={editForm.location} onChange={(event) => setEditForm((current) => ({ ...current, location: event.target.value }))} /></label><label className="aa-label">Purchase date<input type="date" value={editForm.purchaseDate ? String(editForm.purchaseDate).slice(0, 10) : ''} onChange={(event) => setEditForm((current) => ({ ...current, purchaseDate: event.target.value }))} /></label></>}
      {type === 'assign' && <><label className="aa-label">Assigned user *<select required value={assignForm.userId} onChange={(event) => setAssignForm((current) => ({ ...current, userId: event.target.value }))}><option value="">Select user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username || `User ${user.id}`}</option>)}</select></label><label className="aa-label">Department<select value={assignForm.departmentId} onChange={(event) => setAssignForm((current) => ({ ...current, departmentId: event.target.value }))}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="aa-label">Laboratory<select value={assignForm.laboratoryId || ''} onChange={(event) => setAssignForm((current) => ({ ...current, laboratoryId: event.target.value }))}><option value="">Select laboratory</option>{laboratoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="aa-label">Assignment date<input type="date" value={assignForm.date || ''} onChange={(event) => setAssignForm((current) => ({ ...current, date: event.target.value }))} /></label><label className="aa-label">Condition<select value={assignForm.condition || 'Good'} onChange={(event) => setAssignForm((current) => ({ ...current, condition: event.target.value }))}><option>Good</option><option>Fair</option><option>Poor</option><option>Damaged</option></select></label><label className="aa-label">Location<input value={assignForm.location} onChange={(event) => setAssignForm((current) => ({ ...current, location: event.target.value }))} /></label><label className="aa-label aa-form-wide">Notes<textarea value={assignForm.notes || ''} onChange={(event) => setAssignForm((current) => ({ ...current, notes: event.target.value }))} /></label></>}
      {type === 'transfer' && <><label className="aa-label">Destination campus<select value={transferForm.campusId || ''} onChange={(event) => setTransferForm((current) => ({ ...current, campusId: event.target.value }))}><option value="">Select campus</option>{campusOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="aa-label">Destination college<select value={transferForm.collegeId || ''} onChange={(event) => setTransferForm((current) => ({ ...current, collegeId: event.target.value, departmentId: '' }))}><option value="">Select college</option>{colleges.map((item) => <option key={item.id} value={item.id}>{item.name || item.collegeName}</option>)}</select></label><label className="aa-label">Destination department *<select required value={transferForm.departmentId} onChange={(event) => setTransferForm((current) => ({ ...current, departmentId: event.target.value }))}><option value="">Select department</option>{departments.filter((item) => !transferForm.collegeId || String(item.collegeId || item.college_id) === String(transferForm.collegeId)).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="aa-label">Destination laboratory<select value={transferForm.laboratoryId || ''} onChange={(event) => setTransferForm((current) => ({ ...current, laboratoryId: event.target.value }))}><option value="">Select laboratory</option>{laboratoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="aa-label">Destination location *<input required value={transferForm.location} onChange={(event) => setTransferForm((current) => ({ ...current, location: event.target.value }))} /></label><label className="aa-label">Condition<select value={transferForm.condition || 'Good'} onChange={(event) => setTransferForm((current) => ({ ...current, condition: event.target.value }))}><option>Good</option><option>Fair</option><option>Poor</option><option>Damaged</option></select></label><label className="aa-label aa-form-wide">Reason *<textarea required value={transferForm.reason} onChange={(event) => setTransferForm((current) => ({ ...current, reason: event.target.value }))} /></label></>}
      {type === 'maintenance' && <><label className="aa-label">Maintenance title *<input required value={maintenanceForm.title} onChange={(event) => setMaintenanceForm((current) => ({ ...current, title: event.target.value }))} /></label><label className="aa-label">Priority<select value={maintenanceForm.priority} onChange={(event) => setMaintenanceForm((current) => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="aa-label aa-form-wide">Issue / description *<textarea required value={maintenanceForm.description} onChange={(event) => setMaintenanceForm((current) => ({ ...current, description: event.target.value }))} /></label></>}
      <div className={`aa-modal-footer ${type === 'register' ? 'aa-form-wide' : ''}`}><button type="button" className="aa-button" aria-label="Cancel asset changes" onClick={onClose}>Cancel</button><button type="submit" className="aa-button aa-button-primary" aria-label={type === 'register' ? 'Register asset' : type === 'edit' ? 'Save asset' : type === 'assign' ? 'Assign asset' : type === 'transfer' ? 'Transfer asset' : 'Send to maintenance'} disabled={saving || (type === 'register' && completedRegistrationFields !== 12)}>{saving ? 'Saving...' : type === 'register' ? 'Register Asset' : type === 'edit' ? 'Save asset' : type === 'assign' ? 'Assign asset' : type === 'transfer' ? 'Transfer asset' : 'Send to maintenance'}</button></div>
    </form>}
    {['detail', 'history', 'qr'].includes(type) && <footer className="aa-modal-footer"><button type="button" className="aa-button" aria-label="Close asset dialog" onClick={onClose}>Close</button></footer>}
  </section></div>;
}

function ConfirmationModal({ confirmation, saving, modalRef, onCancel, onConfirm }) {
  return <div className="aa-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="aa-modal aa-confirm" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="aa-modal-body"><span className="aa-confirm-icon"><AlertTriangle size={21} /></span><div className="aa-eyebrow">Destructive action</div><h2 className="aa-modal-title" id="confirm-title">{confirmation.title}</h2><p>{confirmation.message}</p></div><footer className="aa-modal-footer"><button type="button" className="aa-button" aria-label="Cancel destructive action" onClick={onCancel}>Cancel</button><button type="button" className="aa-button aa-button-danger" aria-label={confirmation.label} onClick={onConfirm} disabled={saving}>{saving ? 'Saving...' : confirmation.label}</button></footer></section></div>;
}

export default AllAssets;
