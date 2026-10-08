import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Clock3, Eye, Filter, LoaderCircle, MapPin, Plus, RefreshCw, Search, ShieldCheck, Truck, X } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import './AdminTransfer.css';

const PAGE_SIZE = 10;
const STATUSES = ['Requested', 'Approved', 'In Transit', 'Received', 'Rejected', 'Cancelled'];
const TRANSFERABLE_BLOCKED = new Set(['retired', 'disposed', 'deleted', 'soft-deleted', 'under-maintenance', 'in-maintenance', 'maintenance', 'testing', 'lost', 'missing', 'in-transfer']);
const getTodayInputDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const isValidDateInput = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const createEmptyForm = () => ({
  assetId: '',
  serialNumber: '',
  transferReference: '',
  sourceCampusId: '',
  sourceCollegeId: '',
  sourceDepartmentId: '',
  destinationCampusId: '',
  destinationCollegeId: '',
  destinationDepartmentId: '',
  destinationBuildingId: '',
  destinationFloor: '',
  destinationRoomId: '',
  condition: 'Good',
  transferDate: getTodayInputDate(),
  expectedReturnDate: '',
  reason: '',
  notes: '',
});

const getRows = (response, keys = []) => {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const getPages = (response) => Number(response?.data?.pagination?.pages || response?.data?.pagination?.totalPages || response?.data?.summary?.pages || 1);

const fetchAll = async (url, params = {}, limit = 100) => {
  const first = await apiClient.get(url, { params: { ...params, page: 1, limit } });
  const rows = getRows(first);
  const pages = Math.max(1, getPages(first));
  const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => apiClient.get(url, { params: { ...params, page: index + 2, limit } })));
  return rows.concat(...remaining.map((response) => getRows(response)));
};

const getStatus = (transfer) => {
  const raw = String(transfer?.status || 'Requested').toLowerCase();
  const mapped = { pending: 'Requested', 'in progress': 'In Transit', completed: 'Received' }[raw];
  return mapped || STATUSES.find((status) => status.toLowerCase() === raw) || String(transfer?.status || 'Requested');
};

const getAssetId = (asset) => asset?.assetCode || asset?.asset_code || asset?.digitalId || asset?.digital_id || asset?.id || '';
const getAssetName = (asset) => asset?.name || asset?.assetName || 'Unnamed asset';
const getCampusName = (campus) => campus?.campusName || campus?.campus_name || campus?.name || '';
const getCollegeName = (college) => college?.collegeName || college?.college_name || college?.name || '';
const getBuildingName = (building) => building?.buildingName || building?.building_name || building?.name || '';
const getRoomName = (room) => room?.roomName || room?.room_name || room?.name || '';
const getDepartmentName = (department) => department?.name || department?.departmentName || department?.department_name || '';
const getRoomFloor = (room) => room?.floor ?? room?.floorNumber ?? room?.floor_number;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const getTransferAssetId = (transfer) => String(transfer?.assetId ?? transfer?.asset_id ?? '');
const getAssetByIdentifier = (assets, value) => {
  const identifier = String(value || '').trim().toLowerCase();
  if (!identifier) return null;
  return assets.find((asset) => [
    asset.id,
    getAssetId(asset),
    asset.digitalId,
    asset.digital_id,
    asset.assetTag,
    asset.asset_tag,
  ].some((candidate) => String(candidate || '').trim().toLowerCase() === identifier)) || null;
};

const AdminTransfer = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canTransfer = isAdmin || permissions.includes('*') || permissions.includes('assets.transfer');
  const canApprove = isAdmin || permissions.includes('*') || permissions.includes('assets.transfer.approve');

  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [activeAssetIds, setActiveAssetIds] = useState(() => new Set());
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(createEmptyForm);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const campusesById = useMemo(() => new Map(campuses.map((item) => [String(item.id), item])), [campuses]);
  const collegesById = useMemo(() => new Map(colleges.map((item) => [String(item.id), item])), [colleges]);
  const departmentsById = useMemo(() => new Map(departments.map((item) => [String(item.id), item])), [departments]);
  const buildingsById = useMemo(() => new Map(buildings.map((item) => [String(item.id), item])), [buildings]);
  const roomsById = useMemo(() => new Map(rooms.map((item) => [String(item.id), item])), [rooms]);
  const openFormForAsset = useCallback((asset) => {
    setForm({
      ...createEmptyForm(),
      assetId: String(getAssetId(asset)),
      serialNumber: String(asset.serialNumber || asset.serial_number || ''),
      sourceCampusId: String(asset.campusId || asset.campus_id || ''),
      sourceCollegeId: String(asset.collegeId || asset.college_id || ''),
      sourceDepartmentId: String(asset.departmentId || asset.department_id || ''),
    });
    setShowForm(true);
  }, []);

  const getLocationLabel = useCallback((values, prefix) => {
    const campus = campusesById.get(String(values?.[`${prefix}CampusId`] ?? values?.[`${prefix}_campus_id`] ?? ''));
    const college = collegesById.get(String(values?.[`${prefix}CollegeId`] ?? values?.[`${prefix}_college_id`] ?? ''));
    const department = departmentsById.get(String(values?.[`${prefix}DepartmentId`] ?? values?.[`${prefix}_department_id`] ?? ''));
    const building = buildingsById.get(String(values?.[`${prefix}BuildingId`] ?? values?.[`${prefix}_building_id`] ?? ''));
    const room = roomsById.get(String(values?.[`${prefix}RoomId`] ?? values?.[`${prefix}_room_id`] ?? ''));
    const floor = values?.[`${prefix}Floor`] ?? values?.[`${prefix}_floor`] ?? getRoomFloor(room);
    return [
      campus && getCampusName(campus),
      college && getCollegeName(college),
      department && getDepartmentName(department),
      building && getBuildingName(building),
      floor !== null && floor !== undefined && floor !== '' ? `Floor ${floor}` : '',
      room && getRoomName(room),
      (!room && (prefix === 'source' ? values?.currentLocation ?? values?.current_location : values?.newLocation ?? values?.new_location)) || '',
    ].filter(Boolean).join(' / ') || 'Location not recorded';
  }, [buildingsById, campusesById, collegesById, departmentsById, roomsById]);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [assetRows, campusRows, collegeRows, departmentRows, buildingRows, roomRows, requestedRows, approvedRows, inTransitRows] = await Promise.all([
        fetchAll('/api/assets', {}, 50),
        fetchAll('/api/locations/campuses', { status: 'active' }),
        fetchAll('/api/admin/colleges', { status: 'active' }),
        fetchAll('/api/departments', { status: 'active' }),
        fetchAll('/api/locations/buildings', { status: 'active' }),
        fetchAll('/api/locations/rooms', { status: 'active' }),
        fetchAll('/api/transfers', { status: 'Requested' }),
        fetchAll('/api/transfers', { status: 'Approved' }),
        fetchAll('/api/transfers', { status: 'In Transit' }),
      ]);
      setAssets(assetRows.filter((asset) => !TRANSFERABLE_BLOCKED.has(String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-'))));
      setCampuses(campusRows.filter((item) => String(item.status || 'active').toLowerCase() === 'active'));
      setColleges(collegeRows.filter((item) => String(item.status || 'active').toLowerCase() === 'active'));
      setDepartments(departmentRows.filter((item) => String(item.status || 'active').toLowerCase() === 'active'));
      setBuildings(buildingRows.filter((item) => String(item.status || 'active').toLowerCase() === 'active'));
      setRooms(roomRows.filter((item) => String(item.status || 'active').toLowerCase() === 'active' && String(item.roomType || item.room_type || '').toLowerCase().includes('lab')));
      setActiveAssetIds(new Set([...requestedRows, ...approvedRows, ...inTransitRows].map(getTransferAssetId)));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Unable to load transfer form data.');
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/transfers', {
        params: {
          page: nextPage,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          campusId: campusFilter || undefined,
          collegeId: collegeFilter || undefined,
          departmentId: departmentFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      const rows = getRows(response, ['transfers']);
      setTransfers(rows);
      setPage(Number(response.data?.pagination?.page) || nextPage);
      setPagination({
        total: Number(response.data?.pagination?.total) || 0,
        pages: Math.max(1, Number(response.data?.pagination?.pages || response.data?.pagination?.totalPages) || 1),
      });
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to load asset transfers.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [campusFilter, collegeFilter, dateFrom, dateTo, departmentFilter, page, search, statusFilter]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadTransfers(page);
  }, [loadTransfers, page]);

  useEffect(() => {
    const assetId = searchParams.get('assetId') || location.state?.assetId;
    if (!assetId || optionsLoading || !assets.length) return;
    const asset = getAssetByIdentifier(assets, assetId);
    if (!asset) {
      toast.error('The requested asset is not available for transfer.');
      return;
    }
    openFormForAsset(asset);
  }, [assets, location.state, openFormForAsset, optionsLoading, searchParams]);

  const selectedAsset = getAssetByIdentifier(assets, form.assetId);
  const filteredColleges = useMemo(() => {
    const linkedToCampus = colleges.filter((college) => String(college.campusId || college.campus_id || '') === String(form.destinationCampusId));
    const unlinked = colleges.filter((college) => !(college.campusId || college.campus_id));
    return linkedToCampus.concat(unlinked);
  }, [colleges, form.destinationCampusId]);
  const filteredDepartments = useMemo(() => departments.filter((department) => (
    !form.destinationCollegeId || String(department.collegeId || department.college_id || '') === String(form.destinationCollegeId)
  )), [departments, form.destinationCollegeId]);
  const filteredBuildings = useMemo(() => buildings.filter((building) => (
    !form.destinationCampusId || String(building.campusId || building.campus_id || '') === String(form.destinationCampusId)
  )), [buildings, form.destinationCampusId]);
  const selectedBuilding = buildingsById.get(String(form.destinationBuildingId));
  const floors = useMemo(() => [...new Set(rooms
    .filter((room) => String(room.buildingId || room.building_id || '') === String(form.destinationBuildingId))
    .map(getRoomFloor)
    .filter((floor) => floor !== null && floor !== undefined && floor !== ''))]
    .sort((first, second) => Number(first) - Number(second)), [form.destinationBuildingId, rooms]);
  const filteredLaboratories = useMemo(() => rooms.filter((room) => (
    (!form.destinationBuildingId || String(room.buildingId || room.building_id || '') === String(form.destinationBuildingId))
    && (form.destinationFloor === '' || String(getRoomFloor(room)) === String(form.destinationFloor))
    && (!(room.departmentId || room.department_id) || String(room.departmentId || room.department_id) === String(form.destinationDepartmentId))
  )), [form.destinationBuildingId, form.destinationDepartmentId, form.destinationFloor, rooms]);

  const handleFormField = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      if (name === 'assetId') {
        const asset = getAssetByIdentifier(assets, value);
        return {
          ...current,
          assetId: value,
          serialNumber: asset ? String(asset.serialNumber || asset.serial_number || '') : '',
          sourceCampusId: asset ? String(asset.campusId || asset.campus_id || '') : '',
          sourceCollegeId: asset ? String(asset.collegeId || asset.college_id || '') : '',
          sourceDepartmentId: asset ? String(asset.departmentId || asset.department_id || '') : '',
        };
      }
      if (name === 'sourceCampusId') return { ...current, sourceCampusId: value, sourceCollegeId: '', sourceDepartmentId: '' };
      if (name === 'sourceCollegeId') return { ...current, sourceCollegeId: value, sourceDepartmentId: '' };
      if (name === 'destinationCampusId') return { ...current, destinationCampusId: value, destinationCollegeId: '', destinationDepartmentId: '', destinationBuildingId: '', destinationFloor: '', destinationRoomId: '' };
      if (name === 'destinationCollegeId') return { ...current, destinationCollegeId: value, destinationDepartmentId: '' };
      if (name === 'destinationBuildingId') return { ...current, destinationBuildingId: value, destinationFloor: '', destinationRoomId: '' };
      if (name === 'destinationFloor') return { ...current, destinationFloor: value, destinationRoomId: '' };
      return { ...current, [name]: value };
    });
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setShowForm(false);
  };

  const submitTransferRequest = async (event) => {
    event.preventDefault();
    if (!canTransfer || saving) return;
    if (!form.assetId.trim()) return toast.error('Asset ID is required.');
    if (!selectedAsset) return toast.error('Asset ID was not found.');
    if (activeAssetIds.has(String(selectedAsset.id))) return toast.error('This asset already has an active transfer.');
    if (form.serialNumber.trim() && form.serialNumber.trim().toLowerCase() !== String(selectedAsset.serialNumber || selectedAsset.serial_number || '').trim().toLowerCase()) {
      return toast.error('Serial Number does not match the selected asset.');
    }
    if (!isValidDateInput(form.transferDate)) return toast.error('Transfer date is required and must be valid.');
    if (form.expectedReturnDate && (!isValidDateInput(form.expectedReturnDate) || form.expectedReturnDate < form.transferDate)) {
      return toast.error('Expected return must be a valid date on or after the transfer date.');
    }
    const sameSource = String(selectedAsset.campusId || selectedAsset.campus_id || '') === form.sourceCampusId
      && String(selectedAsset.collegeId || selectedAsset.college_id || '') === form.sourceCollegeId
      && String(selectedAsset.departmentId || selectedAsset.department_id || '') === form.sourceDepartmentId;
    if (!form.sourceCampusId || !form.sourceCollegeId || !form.sourceDepartmentId || !sameSource) {
      return toast.error('From Campus, College, and Department must match the asset’s current location.');
    }
    if (!form.destinationDepartmentId || !form.destinationCampusId || !form.destinationCollegeId || !form.destinationBuildingId || form.destinationFloor === '' || !form.destinationRoomId) {
      return toast.error('Select a destination campus, college, department, building, floor, and laboratory.');
    }
    const location = [
      getCampusName(campusesById.get(String(form.destinationCampusId))),
      getCollegeName(collegesById.get(String(form.destinationCollegeId))),
      getDepartmentName(departmentsById.get(String(form.destinationDepartmentId))),
      getBuildingName(buildingsById.get(String(form.destinationBuildingId))),
      `Floor ${form.destinationFloor}`,
      getRoomName(roomsById.get(String(form.destinationRoomId))),
    ].filter(Boolean).join(' / ');
    const sameLocation = Number(selectedAsset.departmentId || selectedAsset.department_id) === Number(form.destinationDepartmentId)
      && Number(selectedAsset.campusId || selectedAsset.campus_id) === Number(form.destinationCampusId)
      && Number(selectedAsset.buildingId || selectedAsset.building_id) === Number(form.destinationBuildingId)
      && Number(selectedAsset.roomId || selectedAsset.room_id) === Number(form.destinationRoomId);
    if (sameLocation) return toast.error('Choose a destination different from the asset’s current location.');
    if (!form.reason.trim()) return toast.error('Transfer reason is required.');
    if (form.transferReference.trim().length > 40) return toast.error('Transfer Reference must be 40 characters or fewer.');
    setSaving(true);
    try {
      await apiClient.post('/api/transfers', {
        assetId: Number(selectedAsset.id),
        serialNumber: form.serialNumber.trim() || undefined,
        transferNumber: form.transferReference.trim() || undefined,
        sourceCampusId: Number(form.sourceCampusId),
        sourceCollegeId: Number(form.sourceCollegeId),
        sourceDepartmentId: Number(form.sourceDepartmentId),
        destinationCampusId: Number(form.destinationCampusId),
        destinationCollegeId: Number(form.destinationCollegeId) || null,
        destinationDepartmentId: Number(form.destinationDepartmentId),
        destinationBuildingId: Number(form.destinationBuildingId),
        destinationFloor: Number(form.destinationFloor),
        destinationRoomId: Number(form.destinationRoomId),
        newLocation: location,
        conditionAtTransfer: form.condition,
        reason: form.reason.trim(),
        transferDate: form.transferDate,
        expectedReturnDate: form.expectedReturnDate || null,
        notes: form.notes.trim(),
      });
      toast.success('Transfer request submitted for authorization.');
      resetForm();
      setPage(1);
      await Promise.all([loadTransfers(1), loadOptions()]);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Unable to create the transfer request.');
    } finally {
      setSaving(false);
    }
  };

  const runStatusAction = async (transfer, status) => {
    if (actionId) return;
    const label = status === 'In Transit' ? 'start the transfer' : status === 'Received' ? 'confirm receipt' : status.toLowerCase();
    if (!window.confirm(`Are you sure you want to ${label} for ${transfer.transferNumber || `transfer ${transfer.id}`}?`)) return;
    const reason = status === 'Rejected' || status === 'Cancelled' ? window.prompt(`Optional ${status.toLowerCase()} reason:`) || '' : '';
    setActionId(transfer.id);
    try {
      await apiClient.patch(`/api/transfers/${transfer.id}`, { status, reason });
      toast.success(`Transfer ${status.toLowerCase()}.`);
      await loadTransfers(page);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || `Unable to ${label}.`);
    } finally {
      setActionId(null);
    }
  };

  const openDetails = async (transfer) => {
    setDetailsLoading(true);
    setDetails({ ...transfer, loading: true });
    try {
      const response = await apiClient.get(`/api/transfers/${transfer.id}`);
      setDetails(response.data?.data || transfer);
    } catch (requestError) {
      setDetails(null);
      toast.error(requestError.response?.data?.message || 'Unable to load transfer details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCampusFilter('');
    setCollegeFilter('');
    setDepartmentFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    loadTransfers(1);
  };

  const statusBadgeClass = (status) => `transfer-status transfer-status--${status.toLowerCase().replace(/\s+/g, '-')}`;
  const formatUser = (transfer, type) => transfer[`${type}ByName`] || transfer[`${type}_by_name`] || transfer[`${type}By`] || transfer[`${type}_by`] || '—';

  return (
    <main className="admin-transfer-page">
      <div className="admin-transfer-shell">
        <div className="admin-transfer-heading">
          <div>
            <p className="admin-transfer-eyebrow">ASSET GOVERNANCE</p>
            <h1><ArrowRightLeft aria-hidden="true" /> Asset Transfer</h1>
            <p className="admin-transfer-subtitle">Request, authorize, dispatch, and confirm asset transfers with a complete custody record.</p>
          </div>
          {canTransfer && <button type="button" className="transfer-button transfer-button--primary" onClick={() => { if (showForm) resetForm(); else { setForm(createEmptyForm()); setShowForm(true); } }} disabled={optionsLoading}>
            {showForm ? <X size={18} /> : <Plus size={18} />}{showForm ? 'Close request' : 'New transfer request'}
          </button>}
        </div>

        {showForm && <div className="transfer-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) resetForm(); }}>
          <section className="transfer-detail-modal transfer-request-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-form-title">
            <header>
              <div><p className="admin-transfer-eyebrow">ASSET GOVERNANCE</p><h2 id="transfer-form-title">New Transfer Request</h2></div>
              <button type="button" className="transfer-icon-button" aria-label="Close transfer request" onClick={resetForm} disabled={saving}><X size={20} /></button>
            </header>
            <form onSubmit={submitTransferRequest}>
              <div className="transfer-form-grid">
                <label className="transfer-field">
                  Asset ID *
                  <input name="assetId" type="text" value={form.assetId} onChange={handleFormField} placeholder="Enter Asset ID" autoComplete="off" required />
                  {selectedAsset && <small>{getAssetName(selectedAsset)} · {activeAssetIds.has(String(selectedAsset.id)) ? 'Already has an active transfer' : 'Available for transfer'}</small>}
                </label>
                <label className="transfer-field">
                  Serial Number
                  <input name="serialNumber" type="text" value={form.serialNumber} onChange={handleFormField} placeholder="Enter Serial Number" />
                </label>
                <label className="transfer-field">
                  Transfer Reference
                  <input name="transferReference" type="text" value={form.transferReference} onChange={handleFormField} placeholder="Enter Transfer Reference" maxLength={40} />
                </label>
                <label className="transfer-field">
                  From Campus *
                  <select name="sourceCampusId" value={form.sourceCampusId} onChange={handleFormField} required><option value="">Choose campus</option>{campuses.map((item) => <option key={item.id} value={item.id}>{getCampusName(item)}</option>)}</select>
                </label>
                <label className="transfer-field">
                  From College *
                  <select name="sourceCollegeId" value={form.sourceCollegeId} onChange={handleFormField} required><option value="">Choose college</option>{colleges.map((item) => <option key={item.id} value={item.id}>{getCollegeName(item)}</option>)}</select>
                </label>
                <label className="transfer-field">
                  From Department *
                  <select name="sourceDepartmentId" value={form.sourceDepartmentId} onChange={handleFormField} required><option value="">Choose department</option>{departments.map((item) => <option key={item.id} value={item.id}>{getDepartmentName(item)}</option>)}</select>
                </label>
                <label className="transfer-field">
                  To Campus *
                  <select name="destinationCampusId" value={form.destinationCampusId} onChange={handleFormField} required><option value="">Choose campus</option>{campuses.map((item) => <option key={item.id} value={item.id}>{getCampusName(item)}</option>)}</select>
                </label>
                <label className="transfer-field">
                  To College *
                  <select name="destinationCollegeId" value={form.destinationCollegeId} onChange={handleFormField} required disabled={!form.destinationCampusId}><option value="">Choose college</option>{filteredColleges.map((item) => <option key={item.id} value={item.id}>{getCollegeName(item)}{!(item.campusId || item.campus_id) ? ' (campus not mapped)' : ''}</option>)}</select>
                </label>
                <label className="transfer-field">
                  To Department *
                  <select name="destinationDepartmentId" value={form.destinationDepartmentId} onChange={handleFormField} required disabled={!form.destinationCollegeId}><option value="">Choose department</option>{filteredDepartments.map((item) => <option key={item.id} value={item.id}>{getDepartmentName(item)}</option>)}</select>
                </label>
                <label className="transfer-field">
                  Destination Building *
                  <select name="destinationBuildingId" value={form.destinationBuildingId} onChange={handleFormField} required disabled={!form.destinationCampusId}><option value="">Choose building</option>{filteredBuildings.map((item) => <option key={item.id} value={item.id}>{getBuildingName(item)}</option>)}</select>
                </label>
                <label className="transfer-field">
                  Destination Floor *
                  <select name="destinationFloor" value={form.destinationFloor} onChange={handleFormField} required disabled={!selectedBuilding}><option value="">Choose floor</option>{floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}</select>
                </label>
                <label className="transfer-field">
                  Destination Laboratory / Room *
                  <select name="destinationRoomId" value={form.destinationRoomId} onChange={handleFormField} required disabled={!form.destinationDepartmentId || !form.destinationBuildingId || form.destinationFloor === ''}><option value="">Choose laboratory</option>{filteredLaboratories.map((room) => <option key={room.id} value={room.id}>{getRoomName(room)}{room.roomCode ? ` (${room.roomCode})` : ''}{!(room.departmentId || room.department_id) ? ' (department not mapped)' : ''}</option>)}</select>
                </label>
                <label className="transfer-field">
                  Transfer Date *
                  <input name="transferDate" type="date" value={form.transferDate} onChange={handleFormField} required />
                </label>
                <label className="transfer-field">
                  Condition *
                  <select name="condition" value={form.condition} onChange={handleFormField} required><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option><option>Damaged</option></select>
                </label>
                <label className="transfer-field">
                  Expected Return
                  <input name="expectedReturnDate" type="date" value={form.expectedReturnDate} onChange={handleFormField} min={form.transferDate} />
                </label>
                <label className="transfer-field">
                  Requested By
                  <input value={user?.fullName || user?.full_name || user?.username || 'Current user'} readOnly />
                </label>
                <label className="transfer-field transfer-field--wide">
                  Transfer Reason *
                  <textarea name="reason" value={form.reason} onChange={handleFormField} required maxLength={5000} rows={3} placeholder="Why is this asset being moved?" />
                </label>
                <label className="transfer-field transfer-field--wide">
                  Notes
                  <textarea name="notes" value={form.notes} onChange={handleFormField} rows={3} placeholder="Additional transfer notes" />
                </label>
              </div>
              <div className="transfer-form-actions"><button type="button" className="transfer-button transfer-button--quiet" onClick={resetForm} disabled={saving}>Cancel</button><button type="submit" className="transfer-button transfer-button--primary" disabled={saving || optionsLoading || !canTransfer}>{saving ? <LoaderCircle className="transfer-spin" size={18} /> : <Plus size={18} />}Create Transfer Request</button></div>
            </form>
          </section>
        </div>}

        <section className="transfer-panel">
          <form className="transfer-filters" onSubmit={submitSearch} aria-label="Filter transfers">
            <label className="transfer-search"><Search size={18} aria-hidden="true" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search asset, serial number, or transfer" aria-label="Search transfers" /></label>
            <label className="transfer-filter"><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="transfer-filter"><span>Campus</span><select value={campusFilter} onChange={(event) => { setCampusFilter(event.target.value); setPage(1); }}><option value="">All campuses</option>{campuses.map((item) => <option key={item.id} value={item.id}>{getCampusName(item)}</option>)}</select></label>
            <label className="transfer-filter"><span>College</span><select value={collegeFilter} onChange={(event) => { setCollegeFilter(event.target.value); setPage(1); }}><option value="">All colleges</option>{colleges.map((item) => <option key={item.id} value={item.id}>{getCollegeName(item)}</option>)}</select></label>
            <label className="transfer-filter"><span>Department</span><select value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1); }}><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{getDepartmentName(item)}</option>)}</select></label>
            <label className="transfer-filter"><span>From date</span><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
            <label className="transfer-filter"><span>To date</span><input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
            <button type="submit" className="transfer-button transfer-button--secondary"><Filter size={16} />Apply</button>
            <button type="button" className="transfer-button transfer-button--quiet" onClick={clearFilters}>Clear</button>
          </form>
          <div className="transfer-table-heading"><div><h2>Transfer history</h2><p>{pagination.total} records · server-side pagination</p></div><button type="button" className="transfer-button transfer-button--quiet" onClick={() => loadTransfers(page)} disabled={loading}><RefreshCw size={16} className={loading ? 'transfer-spin' : ''} />Refresh</button></div>
          {error && <div className="transfer-alert" role="alert">{error}<button type="button" onClick={() => loadTransfers(page)}>Retry</button></div>}
          {loading ? <div className="transfer-state" role="status"><LoaderCircle className="transfer-spin" />Loading transfers…</div>
            : transfers.length === 0 ? <div className="transfer-state"><Truck size={28} /><strong>No transfers found</strong><span>Change your filters or create a new transfer request.</span></div>
              : <div className="transfer-table-wrap"><table className="transfer-table"><thead><tr><th>Asset</th><th>From</th><th>To</th><th>Transfer Date</th><th>Requested By</th><th>Approved By</th><th>Received By</th><th>Status</th><th>Actions</th></tr></thead><tbody>{transfers.map((transfer) => {
                const status = getStatus(transfer);
                const isBusy = actionId === transfer.id;
                const isRequester = Number(transfer.requestedBy ?? transfer.requested_by) === Number(user?.id);
                return <tr key={transfer.id}>
                  <td><strong>{transfer.asset_code || transfer.assetCode || transfer.asset_name || `Asset ${getTransferAssetId(transfer)}`}</strong><small>{transfer.asset_name || transfer.assetName || transfer.serial_number || ''}</small></td>
                  <td>{getLocationLabel(transfer, 'source')}</td><td>{getLocationLabel(transfer, 'destination')}</td>
                  <td>{formatDate(transfer.transferDate || transfer.transfer_date)}</td>
                  <td>{formatUser(transfer, 'requested')}</td><td>{formatUser(transfer, 'approved')}</td><td>{formatUser(transfer, 'received')}</td>
                  <td><span className={statusBadgeClass(status)}>{status}</span></td>
                  <td><div className="transfer-row-actions">
                    <button type="button" className="transfer-icon-button" aria-label={`View details for ${transfer.transferNumber || `transfer ${transfer.id}`}`} title="View details and chain of custody" onClick={() => openDetails(transfer)}><Eye size={17} /></button>
                    {status === 'Requested' && canApprove && !isRequester && <button type="button" className="transfer-icon-button transfer-icon-button--approve" aria-label="Approve transfer" title="Approve" disabled={isBusy} onClick={() => runStatusAction(transfer, 'Approved')}><ShieldCheck size={17} /></button>}
                    {status === 'Requested' && canApprove && <button type="button" className="transfer-icon-button transfer-icon-button--reject" aria-label="Reject transfer" title="Reject" disabled={isBusy} onClick={() => runStatusAction(transfer, 'Rejected')}><X size={17} /></button>}
                    {status === 'Approved' && canTransfer && <button type="button" className="transfer-icon-button transfer-icon-button--approve" aria-label="Start transfer" title="Start transfer" disabled={isBusy} onClick={() => runStatusAction(transfer, 'In Transit')}><Truck size={17} /></button>}
                    {status === 'In Transit' && canTransfer && <button type="button" className="transfer-icon-button transfer-icon-button--approve" aria-label="Confirm receipt" title="Confirm receipt" disabled={isBusy} onClick={() => runStatusAction(transfer, 'Received')}><Check size={17} /></button>}
                    {['Requested', 'Approved'].includes(status) && canTransfer && (isRequester || isAdmin) && <button type="button" className="transfer-icon-button transfer-icon-button--reject" aria-label="Cancel transfer" title="Cancel" disabled={isBusy} onClick={() => runStatusAction(transfer, 'Cancelled')}><X size={17} /></button>}
                  </div></td>
                </tr>;
              })}</tbody></table></div>}
          {!loading && transfers.length > 0 && <div className="transfer-pagination"><span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, pagination.total)}–{Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total}</span><div><button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={18} /></button><span>Page {page} of {pagination.pages}</span><button type="button" aria-label="Next page" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}><ChevronRight size={18} /></button></div></div>}
        </section>
      </div>

      {details && <div className="transfer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
        <section className="transfer-detail-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-detail-title">
          <header><div><p className="admin-transfer-eyebrow">CHAIN OF CUSTODY</p><h2 id="transfer-detail-title">{details.transferNumber || `Transfer ${details.id}`}</h2></div><button type="button" className="transfer-icon-button" aria-label="Close transfer details" onClick={() => setDetails(null)}><X size={20} /></button></header>
          {detailsLoading ? <div className="transfer-state"><LoaderCircle className="transfer-spin" />Loading transfer details…</div> : <>
            <div className="transfer-detail-summary"><div><small>Asset</small><strong>{details.asset_name || details.assetName || `Asset ${getTransferAssetId(details)}`}</strong></div><div><small>Status</small><span className={statusBadgeClass(getStatus(details))}>{getStatus(details)}</span></div><div><small>From</small><strong>{getLocationLabel(details, 'source')}</strong></div><div><small>To</small><strong>{getLocationLabel(details, 'destination')}</strong></div><div><small>Reason</small><strong>{details.transferReason || details.transfer_reason || '—'}</strong></div><div><small>Condition</small><strong>{details.conditionAtTransfer || details.condition_at_transfer || '—'}</strong></div></div>
            <h3>Workflow timeline</h3>
            <ol className="transfer-timeline">
              <li className="is-complete"><span><Check size={15} /></span><div><strong>Current Location</strong><small>{getLocationLabel(details, 'source')}</small></div></li>
              <li className="is-complete"><span><Check size={15} /></span><div><strong>Transfer Request</strong><small>{formatUser(details, 'requested')} · {formatDateTime(details.requestedAt || details.requested_at || details.transferDate)}</small></div></li>
              <li className={details.approvedBy || details.approved_by ? 'is-complete' : ''}><span><ShieldCheck size={15} /></span><div><strong>Authorization</strong><small>{formatUser(details, 'approved')} · {formatDateTime(details.approvalDate || details.approval_date)}</small></div></li>
              <li className={['In Transit', 'Received'].includes(getStatus(details)) ? 'is-complete' : ''}><span><Truck size={15} /></span><div><strong>Transfer</strong><small>{details.dispatchedBy ? `Dispatched by ${details.dispatchedBy}` : 'Awaiting dispatch'} · {formatDateTime(details.dispatchedAt || details.dispatched_at)}</small></div></li>
              <li className={getStatus(details) === 'Received' ? 'is-complete' : ''}><span><Check size={15} /></span><div><strong>Receiving Confirmation</strong><small>{formatUser(details, 'received')} · {formatDateTime(details.receivedAt || details.received_at)}</small></div></li>
              <li className={getStatus(details) === 'Received' ? 'is-complete' : ''}><span><MapPin size={15} /></span><div><strong>New Location</strong><small>{getStatus(details) === 'Received' ? getLocationLabel(details, 'destination') : 'Location changes after receipt is confirmed'}</small></div></li>
            </ol>
            <h3>Asset custody history</h3>
            {(details.history || []).length ? <ol className="transfer-history">{details.history.map((item) => <li key={item.id}><span className={statusBadgeClass(getStatus(item))}>{getStatus(item)}</span><strong>{item.transferNumber || `Transfer ${item.id}`}</strong><small>{formatDateTime(item.createdAt || item.created_at)} · {getLocationLabel(item, 'source')} → {getLocationLabel(item, 'destination')}</small></li>)}</ol> : <p className="transfer-muted">No earlier transfers are recorded for this asset.</p>}
            <p className="transfer-muted"><Clock3 size={15} /> Server-recorded transfer date: {formatDateTime(details.transferDate || details.transfer_date)}</p>
          </>}
        </section>
      </div>}
    </main>
  );
};

export default AdminTransfer;
