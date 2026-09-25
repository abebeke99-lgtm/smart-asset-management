import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, CheckCircle2, CircleX, Clock3, Eye, FileText, Flag, LoaderCircle, MapPin, Package, Plus, RefreshCw, Search, SlidersHorizontal, UserRound, Wrench, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import './DepartmentMaintenance.css';

const STATUS_OPTIONS = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'rejected', 'cancelled'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const displayStatus = (status) => String(status || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';
const displayPriority = (priority) => String(priority || '').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';
const formatDate = (value, includeTime = false) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};
const getAsset = (record) => record?.Asset || record?.asset || {};
const getAssetName = (record) => getAsset(record).name || '-';
const getAssetCode = (record) => getAsset(record).assetCode || '-';

const DepartmentMaintenance = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
  const [summary, setSummary] = useState({ total: 0, pending: 0, assigned: 0, 'in-progress': 0, completed: 0 });
  const [form, setForm] = useState({ asset_id: '', problem: '', priority: 'medium' });
  const [selected, setSelected] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const [maintenanceResponse, assetsResponse] = await Promise.all([
        apiClient.get('/api/department/maintenance', { params: { limit: 100, search: filters.search.trim() || undefined, status: filters.status || undefined, priority: filters.priority || undefined } }),
        apiClient.get('/api/department/assets', { params: { limit: 500 } }),
      ]);
      setRecords(Array.isArray(maintenanceResponse.data?.data) ? maintenanceResponse.data.data : []);
      setSummary(maintenanceResponse.data?.summary || { total: 0, pending: 0, assigned: 0, 'in-progress': 0, completed: 0 });
      const assetData = assetsResponse.data?.data || assetsResponse.data?.assets || [];
      setAssets(Array.isArray(assetData) ? assetData : []);
    } catch (loadError) {
      setRecords([]);
      setSummary({ total: 0, pending: 0, assigned: 0, 'in-progress': 0, completed: 0 });
      setError(loadError.response?.data?.message || loadError.message || 'Unable to load maintenance requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, [filters.search, filters.status, filters.priority]);

  const visibleRecords = useMemo(() => records, [records]);

  const submitRequest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/api/department/maintenance', { ...form, asset_id: Number(form.asset_id) });
      toast.success('Maintenance request created.');
      setForm({ asset_id: '', problem: '', priority: 'medium' });
      setShowForm(false);
      await loadRecords();
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Unable to create the maintenance request.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (record) => {
    setSelected(record);
    setLoadingDetails(true);
    try {
      const response = await apiClient.get(`/api/department/maintenance/${record.id}`);
      setSelected(response.data?.data || record);
    } catch (detailError) {
      toast.error(detailError.response?.data?.message || 'Unable to load maintenance details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const cancelRequest = async () => {
    if (!confirmCancel) return;
    setProcessingId(confirmCancel.id);
    try {
      await apiClient.post(`/api/department/maintenance/${confirmCancel.id}/cancel`);
      toast.success('Maintenance request cancelled.');
      setConfirmCancel(null);
      setSelected(null);
      await loadRecords();
    } catch (cancelError) {
      toast.error(cancelError.response?.data?.message || 'Unable to cancel the maintenance request.');
    } finally {
      setProcessingId(null);
    }
  };

  const canCreate = ['department_head'].includes(String(user?.role || '').toLowerCase());
  const canCancel = (record) => record?.requestedBy === user?.id && ['pending', 'approved'].includes(record?.status);

  return (
    <section className="department-maintenance-page">
      <header className="maintenance-page-header">
        <div>
          <p className="maintenance-eyebrow"><Wrench size={15} aria-hidden="true" /> Department operations</p>
            <h1>Maintenance Requests</h1>
          <p className="maintenance-subtitle">Track maintenance requests for assets in your authorized department scope.</p>
        </div>
        <div className="maintenance-header-actions">
          <button className="maintenance-button secondary" type="button" onClick={loadRecords} disabled={loading} title="Refresh maintenance records"><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
          {canCreate && <button className="maintenance-button primary" type="button" onClick={() => setShowForm((visible) => !visible)}><Plus size={17} aria-hidden="true" /> Request maintenance</button>}
        </div>
      </header>

      <div className="maintenance-summary" aria-label="Maintenance summary">
        <SummaryCard icon={FileText} label="Total requests" value={summary.total || 0} />
        <SummaryCard icon={Clock3} label="Pending" value={summary.pending || 0} tone="warning" />
        <SummaryCard icon={UserRound} label="Assigned" value={summary.assigned || 0} tone="info" />
        <SummaryCard icon={LoaderCircle} label="In progress" value={summary['in-progress'] || 0} tone="info" />
        <SummaryCard icon={CheckCircle2} label="Completed" value={summary.completed || 0} tone="success" />
      </div>

      {showForm && canCreate && <form className="maintenance-request-form" onSubmit={submitRequest}>
        <div className="form-heading"><div><h2>New maintenance request</h2><p>Submit a request for an asset in your department.</p></div><button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close request form" title="Close"><X size={18} /></button></div>
        <div className="form-grid">
          <label>Asset<select required value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })}><option value="">Select an asset</option>{assets.filter((asset) => !['disposed', 'missing'].includes(String(asset.status || '').toLowerCase())).map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.id})</option>)}</select></label>
          <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{displayPriority(priority)}</option>)}</select></label>
          {form.asset_id && <AssetPreview asset={assets.find((asset) => String(asset.id) === String(form.asset_id))} />}
          <label className="full-width">Problem description<textarea required rows="4" value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} placeholder="Describe the maintenance problem" /></label>
        </div>
        <div className="form-actions"><button className="maintenance-button secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="maintenance-button primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} {submitting ? 'Submitting...' : 'Submit request'}</button></div>
      </form>}

      {error && <div className="maintenance-alert" role="alert"><CircleX size={18} aria-hidden="true" /><span>{error}</span><button type="button" onClick={loadRecords}>Retry</button></div>}

      <div className="maintenance-toolbar">
        <label className="maintenance-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search maintenance records</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search asset, code, request or description" /></label>
        <label><SlidersHorizontal size={16} aria-hidden="true" /><span className="sr-only">Status filter</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
        <label><Flag size={16} aria-hidden="true" /><span className="sr-only">Priority filter</span><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{displayPriority(priority)}</option>)}</select></label>
        <button className="maintenance-button secondary clear-filters" type="button" onClick={() => setFilters({ search: '', status: '', priority: '' })} disabled={!filters.search && !filters.status && !filters.priority}><X size={15} aria-hidden="true" /> Clear filters</button>
      </div>

      <div className="maintenance-table-wrap">
        {loading ? <LoadingState /> : visibleRecords.length === 0 ? <EmptyState canCreate={canCreate} onCreate={() => setShowForm(true)} /> : <table className="maintenance-table"><thead><tr><th>Request</th><th>Asset</th><th>Priority</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td><strong>REQ-{String(record.id).padStart(3, '0')}</strong><span>{record.title || record.description || '-'}</span></td><td><strong>{getAssetName(record)}</strong><span>{getAssetCode(record)}</span></td><td><span className={`priority-badge priority-${record.priority}`}>{displayPriority(record.priority)}</span></td><td><span className={`status-badge status-${record.status}`}><StatusIcon status={record.status} /> {displayStatus(record.status)}</span></td><td>{formatDate(record.createdAt || record.created_at)}</td><td><div className="row-actions"><button className="icon-button" type="button" onClick={() => openDetails(record)} title="View maintenance details" aria-label={`View request ${record.id}`}><Eye size={17} /></button>{canCancel(record) && <button className="icon-button danger" type="button" onClick={() => setConfirmCancel(record)} disabled={processingId === record.id} title="Cancel maintenance request" aria-label={`Cancel request ${record.id}`}><CircleX size={17} /></button>}</div></td></tr>)}</tbody></table>}
      </div>

      {selected && <DetailsDialog record={selected} loading={loadingDetails} canCancel={canCancel(selected)} onCancel={() => setConfirmCancel(selected)} onClose={() => setSelected(null)} />}
      {confirmCancel && <ConfirmDialog record={confirmCancel} processing={processingId === confirmCancel.id} onConfirm={cancelRequest} onClose={() => setConfirmCancel(null)} />}
    </section>
  );
};

const SummaryCard = ({ icon: Icon, label, value, tone = 'default' }) => <div className={`summary-card tone-${tone}`}><span className="summary-icon"><Icon size={19} aria-hidden="true" /></span><div><strong>{value}</strong><span>{label}</span></div></div>;
const StatusIcon = ({ status }) => { const Icon = status === 'completed' ? CheckCircle2 : ['in-progress', 'testing', 'waiting-for-parts'].includes(status) ? LoaderCircle : status === 'rejected' || status === 'cancelled' ? CircleX : Clock3; return <Icon size={14} aria-hidden="true" />; };
const LoadingState = () => <div className="maintenance-loading"><LoaderCircle className="spin" size={25} /><span>Loading maintenance records...</span></div>;
const EmptyState = ({ canCreate, onCreate }) => <div className="maintenance-empty"><Wrench size={30} aria-hidden="true" /><h2>No maintenance records found</h2><p>Requests created for this department will appear here after they are saved.</p>{canCreate && <button className="maintenance-button primary" type="button" onClick={onCreate}><Plus size={16} /> Request maintenance</button>}</div>;

const AssetPreview = ({ asset }) => <div className="asset-preview full-width"><span><Package size={15} aria-hidden="true" /> Selected asset</span><strong>{asset?.name || '-'}</strong><small>{[asset?.assetCode, asset?.category, asset?.condition, asset?.status, asset?.location].filter(Boolean).join(' | ') || 'Asset information unavailable'}</small></div>;
const DetailsDialog = ({ record, loading, canCancel, onCancel, onClose }) => { const asset = getAsset(record); const requester = record.Requester?.fullName || record.Requester?.username || record.requestedBy || record.requested_by; const technician = record.Technician?.fullName || record.Technician?.username || record.assignedTo || record.assigned_to; return <div className="dialog-backdrop" role="presentation"><div className="maintenance-dialog" role="dialog" aria-modal="true" aria-labelledby="maintenance-details-title"><div className="dialog-header"><div><p className="maintenance-eyebrow"><FileText size={15} /> Maintenance request</p><h2 id="maintenance-details-title">REQ-{String(record.id).padStart(3, '0')}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close maintenance details" title="Close"><X size={18} /></button></div>{loading ? <LoadingState /> : <><div className="detail-status-row"><span className={`status-badge status-${record.status}`}><StatusIcon status={record.status} /> {displayStatus(record.status)}</span><span className={`priority-badge priority-${record.priority}`}>{displayPriority(record.priority)} priority</span></div><div className="detail-grid"><Detail label="Asset" value={asset.name} icon={Package} /><Detail label="Asset code" value={asset.assetCode} icon={Package} /><Detail label="Serial number" value={asset.serialNumber} icon={Package} /><Detail label="Category" value={asset.category} icon={Package} /><Detail label="Condition" value={asset.condition} icon={FileText} /><Detail label="Asset status" value={asset.status} icon={CheckCircle2} /><Detail label="Department" value={asset.department || asset.departmentId} icon={Building2} /><Detail label="Location" value={asset.location} icon={MapPin} /><Detail label="Request date" value={formatDate(record.createdAt || record.created_at, true)} icon={CalendarDays} /><Detail label="Last updated" value={formatDate(record.updatedAt || record.updated_at, true)} icon={RefreshCw} /><Detail label="Requested by" value={requester} icon={UserRound} /><Detail label="Technician" value={technician || 'Not assigned'} icon={UserRound} /><div className="detail-field full-width"><span>Problem description</span><p>{record.description || record.title || '-'}</p></div></div>{canCancel && <div className="dialog-actions"><button className="maintenance-button danger-button" type="button" onClick={onCancel}><CircleX size={16} /> Cancel request</button></div>}</>}</div></div>; };
const Detail = ({ label, value, icon: Icon }) => <div className="detail-field"><span><Icon size={14} aria-hidden="true" /> {label}</span><strong>{value || '-'}</strong></div>;
const ConfirmDialog = ({ record, processing, onConfirm, onClose }) => <div className="dialog-backdrop" role="presentation"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-maintenance-title"><CircleX className="confirm-icon" size={28} aria-hidden="true" /><h2 id="cancel-maintenance-title">Cancel maintenance request?</h2><p>This will cancel request REQ-{String(record.id).padStart(3, '0')} for {getAssetName(record)}. The current status is {displayStatus(record.status)}.</p><div className="dialog-actions"><button className="maintenance-button secondary" type="button" onClick={onClose} disabled={processing}>Keep request</button><button className="maintenance-button danger-button" type="button" onClick={onConfirm} disabled={processing}>{processing ? <LoaderCircle className="spin" size={16} /> : <CircleX size={16} />} Confirm cancellation</button></div></div></div>;

export default DepartmentMaintenance;
