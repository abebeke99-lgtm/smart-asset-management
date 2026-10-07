import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import english from '../../i18n/departmentHeadAssets/en.json';
import amharic from '../../i18n/departmentHeadAssets/am.json';
import AssetFilters from './assets/AssetFilters';
import AssetTable from './assets/AssetTable';
import AssetDrawer from './assets/AssetDrawer';
import RegistrationForm from './assets/RegistrationForm';
import ExportMenu from './assets/ExportMenu';
import './DepartmentHeadAssets.css';

const PAGE_SIZE = 25;
const emptyFilters = {
  search: '',
  category: '',
  status: '',
  condition: '',
  location: '',
  assignedUserId: '',
  maintenanceStatus: '',
  warranty: '',
};

const unwrapRows = (payload, key) => {
  let body = payload;
  for (let depth = 0; depth < 3 && body && !Array.isArray(body) && body.data; depth += 1) {
    body = body.data;
  }
  if (Array.isArray(body)) return body;
  const rows = body?.[key] ?? body?.rows ?? body?.items;
  return Array.isArray(rows) ? rows : null;
};

const DepartmentHeadAssets = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const labels = language === 'en' ? english : amharic;
  const [assets, setAssets] = useState([]);
  const [serverFilterOptions, setServerFilterOptions] = useState({});
  const [filters, setFilters] = useState(emptyFilters);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [sortBy, setSortBy] = useState('assetCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [staff, setStaff] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [submittingRegistration, setSubmittingRegistration] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);

  const isDepartmentHead = ['department_head', 'department-head'].includes(String(user?.role || '').toLowerCase());
  const queryParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    search: filters.search || undefined,
    category: filters.category || undefined,
    status: filters.status || undefined,
    condition: filters.condition || undefined,
    location: filters.location || undefined,
    assignedUser: filters.assignedUserId || undefined,
    maintenanceStatus: filters.maintenanceStatus || undefined,
    warranty: filters.warranty || undefined,
    sortBy,
    sortOrder,
  }), [filters, page, sortBy, sortOrder]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await axios.get('/api/department-head/assets', { params: queryParams });
      const body = response.data;
      const rows = unwrapRows(body, 'assets');
      if (!rows) {
        const shape = Array.isArray(body) ? 'array' : Object.keys(body || {}).join(', ') || typeof body;
        throw new Error(`The department assets API returned an unsupported response shape (${shape}).`);
      }
      let metadata = body;
      while (metadata && !Array.isArray(metadata) && metadata.data && !metadata.assets && !metadata.pagination) {
        metadata = metadata.data;
      }
      setAssets(rows);
      if (metadata.filterOptions || metadata.filters) setServerFilterOptions(metadata.filterOptions || metadata.filters);
      setPagination({
        total: Number(metadata.pagination?.total ?? metadata.total ?? rows.length),
        pages: Math.max(1, Number(metadata.pagination?.pages ?? metadata.pages) || 1),
      });
    } catch (error) {
      console.error('Department Head assets load failed:', error);
      setLoadError(true);
      toast.error(labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error, queryParams]);

  useEffect(() => {
    if (!isDepartmentHead) return undefined;
    if (searchInput === filters.search) return undefined;
    const timer = window.setTimeout(() => setFilters((current) => ({ ...current, search: searchInput })), 250);
    return () => window.clearTimeout(timer);
  }, [filters.search, isDepartmentHead, searchInput]);

  useEffect(() => {
    if (isDepartmentHead) loadAssets();
  }, [isDepartmentHead, loadAssets]);

  const filterOptions = useMemo(() => {
    const distinct = (key) => [...new Set(assets.map((asset) => asset[key]).filter(Boolean).map(String))].sort();
    return {
      categories: serverFilterOptions.categories || [...new Set(assets.map((asset) => asset.category || asset.category_name).filter(Boolean).map(String))].sort(),
      statuses: serverFilterOptions.statuses || distinct('status'),
      conditions: serverFilterOptions.conditions || distinct('condition'),
      locations: serverFilterOptions.locations || distinct('location'),
      users: serverFilterOptions.users || [...new Map(assets
        .map((asset) => ({
          id: asset.assignedUser?.id || asset.assignedUserId || asset.assigned_user_id,
          name: asset.assignedUser?.fullName || asset.assignedUser?.name || asset.assigned_to_name || asset.assignedUserName,
        }))
        .filter((member) => member?.id && member.name)
        .map((member) => [String(member.id), member])).values()],
      maintenanceStatuses: serverFilterOptions.maintenanceStatuses || [...new Set(assets.map((asset) => asset.maintenanceStatus || asset.maintenance_status).filter(Boolean).map(String))].sort(),
    };
  }, [assets, serverFilterOptions]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openAsset = async (asset) => {
    setSelectedAsset(asset);
    try {
      const detailResponse = await axios.get(`/api/department-head/assets/${encodeURIComponent(asset.id)}`);
      const details = detailResponse.data?.asset || detailResponse.data?.data?.asset || detailResponse.data?.data;
      if (!details || Array.isArray(details)) throw new Error('The department asset details API returned an invalid response.');
      setSelectedAsset(details);
    } catch (error) {
      console.error('Department Head asset detail load failed:', error);
      toast.error(error.response?.data?.message || labels.error);
    }
    if (!staffOptions.length) {
      try {
        const staffResponse = await axios.get('/api/department-head/staff');
        const rows = unwrapRows(staffResponse.data, 'staff');
        setStaff(rows);
        setStaffOptions(rows);
      } catch (error) {
        console.error('Department Head staff options load failed:', error);
        toast.error(error.response?.data?.message || labels.loadUsersError);
      }
    } else {
      setStaff(staffOptions);
    }
  };

  const submitRegistration = async (form) => {
    setSubmittingRegistration(true);
    try {
      await axios.post('/api/department-head/assets/registration-requests', form);
      toast.success(labels.requestSubmitted);
      setShowRegistration(false);
      await loadAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || labels.registrationError);
    } finally {
      setSubmittingRegistration(false);
    }
  };

  const saveAsset = async (updates) => {
    if (!selectedAsset) return;
    setSavingAsset(true);
    try {
      const payload = {
        location: updates.location,
        condition: updates.condition,
        assignedUserId: updates.assignedUserId || null,
        note: updates.note,
      };
      const response = await axios.put(`/api/department-head/assets/${encodeURIComponent(selectedAsset.id)}`, payload);
      const updated = response.data?.asset || response.data?.data?.asset || response.data?.data;
      if (updated && !Array.isArray(updated)) setSelectedAsset((current) => ({ ...current, ...updated }));
      else setSelectedAsset((current) => ({ ...current, ...payload }));
      toast.success(labels.updated);
      await loadAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || labels.updateError);
      return false;
    } finally {
      setSavingAsset(false);
    }
    return true;
  };

  const exportAssets = async (format) => {
    try {
      const exportParams = { ...queryParams };
      delete exportParams.page;
      delete exportParams.limit;
      const response = await axios.get('/api/department-head/assets/export', {
        params: { ...exportParams, format },
        responseType: 'blob',
      });
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      const disposition = response.headers?.['content-disposition'] || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `assets_department_${new Date().toISOString().slice(0, 10)}.${format}`;
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      let message = error.response?.data?.message;
      if (!message && error.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await error.response.data.text()).message;
        } catch {
          message = undefined;
        }
      }
      toast.error(message || labels.exportError);
    }
  };

  const handleSort = (field) => {
    const sortFields = {
      assetId: 'assetCode',
      digitalId: 'digitalId',
      name: 'name',
      category: 'category',
      serialNumber: 'serialNumber',
      quantity: 'quantity',
      status: 'status',
      condition: 'condition',
      location: 'location',
      assignedUser: 'assignedUser',
      purchaseDate: 'purchaseDate',
      warranty: 'warrantyExpiry',
      qrCode: 'qrCode',
      rfid: 'rfidTag',
      maintenanceStatus: 'maintenanceStatus',
    };
    const value = sortFields[field] || field;
    setSortOrder((current) => (value === sortBy ? (current === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortBy(value);
    setPage(1);
  };

  if (!isDepartmentHead) {
    return <main className="dha-page"><p className="dha-error" role="alert">{labels.unauthorized}</p></main>;
  }

  return (
    <main className={`dha-page${theme === 'dark' ? ' dha-page-dark' : ''}`}>
      <div className="dha-content">
        <header className="dha-header">
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.subtitle} {user?.department || user?.departmentName || ''}</p>
          </div>
          <div className="dha-header-actions">
            <button type="button" className="primary" onClick={() => setShowRegistration(true)}>{labels.registerRequest}</button>
            <ExportMenu labels={labels} onExport={exportAssets} disabled={loading || assets.length === 0} />
            <button type="button" onClick={loadAssets} disabled={loading}>{labels.refresh}</button>
          </div>
        </header>

        <AssetFilters filters={{ ...filters, search: searchInput }} options={filterOptions} labels={labels} onChange={setFilter} onSearch={setSearchInput} />

        {loading ? <p role="status" aria-live="polite">{labels.loading}</p> : loadError ? (
          <div className="dha-error" role="alert"><p>{labels.error}</p><button type="button" onClick={loadAssets}>{labels.retry}</button></div>
        ) : assets.length === 0 ? <p className="dha-empty" role="status">{labels.empty}</p> : (
          <>
            <AssetTable assets={assets} labels={labels} onSelect={openAsset} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <nav className="dha-pagination" aria-label="Asset pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{labels.previous}</button>
              <span>{labels.page} {page} {labels.of} {pagination.pages} · {pagination.total}</span>
              <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}>{labels.next}</button>
            </nav>
          </>
        )}
      </div>

      {selectedAsset && <AssetDrawer asset={selectedAsset} staff={staff} labels={labels} saving={savingAsset} onClose={() => setSelectedAsset(null)} onSave={saveAsset} />}
      {showRegistration && (
        <RegistrationForm
          labels={labels}
          categories={filterOptions.categories}
          conditions={['New', 'Good', 'Fair', 'Poor', 'Damaged']}
          submitting={submittingRegistration}
          onClose={() => setShowRegistration(false)}
          onSubmit={submitRegistration}
        />
      )}
    </main>
  );
};

export default DepartmentHeadAssets;
