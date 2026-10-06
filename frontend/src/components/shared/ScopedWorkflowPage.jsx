import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../utils/api';
import { getAllAssets } from '../../services/assetApi';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import * as XLSX from 'xlsx';

const CONFIG = {
  transfers: { title: 'Asset Transfers', path: 'transfers', createLabel: 'Create Transfer', fields: ['asset_id', 'destination_department_id', 'destination_location', 'reason'] },
  returns: { title: 'Asset Returns', path: 'returns', createLabel: 'Request Return', fields: ['asset_id', 'reason', 'condition', 'notes'] },
  maintenance: { title: 'Maintenance Requests', path: 'maintenance', createLabel: 'Request Maintenance', fields: ['asset_id', 'problem', 'description', 'priority'] },
};

const parseListData = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidate = payload.data || payload.transfers || payload.rows || payload.results || payload.items || [];
  return Array.isArray(candidate) ? candidate : [];
};

const normalizeTransfer = (entry) => {
  const item = entry || {};
  const assetName = item.assetName || item.asset_name || item.Asset?.name || item.asset?.name || 'Unknown asset';
  const assetCode = item.assetCode || item.asset_code || item.Asset?.assetCode || item.asset?.assetCode || '';
  const serialNumber = item.serialNumber || item.serial_number || item.Asset?.serialNumber || item.asset?.serialNumber || '';
  const fromDepartment = item.sourceDepartment || item.source_department || item.fromDepartment || item.from_department || item.Asset?.department || 'Unknown';
  const toDepartment = item.destinationDepartment || item.destination_department || item.toDepartment || item.to_department || 'Unassigned';
  const fromLocation = item.currentLocation || item.current_location || item.fromLocation || item.sourceLocation || '';
  const toLocation = item.newLocation || item.new_location || item.toLocation || item.destinationLocation || '';
  const transferReason = item.transferReason || item.transfer_reason || item.reason || item.notes || item.remarks || '';
  const requestedBy = item.requestedByName || item.requested_by_name || item.requestedBy || item.requested_by || item.Creator?.fullName || item.Creator?.username || 'Unknown';
  const approvedBy = item.approvedByName || item.approved_by_name || item.approvedBy || item.approved_by || item.Approver?.fullName || item.Approver?.username || '';
  const dispatchedBy = item.dispatchedByName || item.dispatched_by_name || item.dispatchedBy || item.dispatched_by || item.Dispatcher?.fullName || item.Dispatcher?.username || '';
  const receivedBy = item.receivedByName || item.received_by_name || item.receivedBy || item.received_by || item.Receiver?.fullName || item.Receiver?.username || '';

  return {
    ...item,
    id: item.id,
    assetId: item.assetId || item.asset_id || item.asset?.id || '',
    assetName,
    assetCode,
    serialNumber,
    fromDepartment,
    toDepartment,
    fromLocation,
    toLocation,
    transferReason,
    requestedBy,
    approvedBy,
    dispatchedBy,
    receivedBy,
    transferDate: item.transferDate || item.transfer_date || item.date || item.createdAt || item.created_at || '',
    status: item.status || item.transferStatus || item.transfer_status || '',
  };
};

const getTransferListEndpoint = (scope, userRole) => {
  if (scope === 'college') return '/api/college/transfers';
  if (scope === 'department' && userRole === 'department_head') return '/api/department-head/transfers';
  if (scope === 'department') return '/api/department/transfers';
  if (userRole === 'department_head') return '/api/department/transfers';
  return '/api/transfers';
};

const getAssetEndpoint = (scope) => {
  if (scope === 'college') return '/api/college/assets';
  if (scope === 'department') return '/api/department/assets';
  return '/api/assets';
};

const COLLEGE_TRANSFER_COPY = {
  College: 'ኮሌጅ', Department: 'ዲፓርትመንት', Operations: 'ስራዎች', Transfers: 'ዝውውሮች', 'Asset Transfers': 'የንብረት ዝውውሮች', 'Export Excel': 'Excel ወደ ውጭ ላክ',
  Total: 'ጠቅላላ', Pending: 'በመጠባበቅ ላይ', pending: 'በመጠባበቅ ላይ', Approved: 'ጸድቋል', approved: 'ጸድቋል', Received: 'ተቀብሏል', received: 'ተቀብሏል', 'Rejected / Cancelled': 'ውድቅ / ተሰርዟል', 'All statuses': 'ሁሉም ሁኔታዎች', Requested: 'ተጠይቋል', requested: 'ተጠይቋል', Ready: 'ዝግጁ', 'In Transit': 'በመጓጓዝ ላይ', Inspected: 'ተመርምሯል', inspected: 'ተመርምሯል', Completed: 'ተጠናቋል', completed: 'ተጠናቋል', Rejected: 'ውድቅ ተደርጓል', rejected: 'ውድቅ ተደርጓል', Cancelled: 'ተሰርዟል', cancelled: 'ተሰርዟል',
  Refresh: 'አድስ', 'Select real asset': 'እውነተኛ ንብረት ይምረጡ', 'Current Department': 'የአሁኑ ዲፓርትመንት', 'Current Location': 'የአሁኑ ቦታ', 'Asset Status': 'የንብረት ሁኔታ', 'Select destination department': 'መድረሻ ዲፓርትመንት ይምረጡ', 'Destination location': 'የመድረሻ ቦታ', 'Transfer reason / notes': 'የዝውውር ምክንያት / ማስታወሻ', 'Additional notes': 'ተጨማሪ ማስታወሻዎች', Submitting: 'በማስገባት ላይ...', 'Create Transfer': 'ዝውውር ፍጠር', Clear: 'አጽዳ',
  Asset: 'ንብረት', Status: 'ሁኔታ', 'Current → Destination': 'አሁን ያለበት → መድረሻ', Reason: 'ምክንያት', Date: 'ቀን', Actions: 'እርምጃዎች', Unknown: 'ያልታወቀ', 'No transfer records found.': 'ምንም የዝውውር መዝገብ አልተገኘም።', 'Loading transfer records...': 'የዝውውር መዝገቦችን በመጫን ላይ...', View: 'ይመልከቱ', Approve: 'አጽድቅ', Reject: 'ውድቅ አድርግ', Cancel: 'ሰርዝ', Complete: 'አጠናቅቅ', 'Transfer Details': 'የዝውውር ዝርዝር መረጃ', Close: 'ዝጋ',
  'Transfer ID': 'የዝውውር መለያ', 'Asset Code': 'የንብረት ኮድ', 'Serial Number': 'ተከታታይ ቁጥር', 'From Department': 'ከዲፓርትመንት', 'From Location': 'ከቦታ', 'To Department': 'ወደ ዲፓርትመንት', 'To Location': 'ወደ ቦታ', 'Requested By': 'የጠየቀው', 'Approved By': 'ያጸደቀው', 'Transfer Date': 'የዝውውር ቀን', 'Requested At': 'የተጠየቀበት', 'Approved At': 'የጸደቀበት', 'Ready At': 'ዝግጁ የሆነበት', 'Dispatched At': 'የተላከበት', 'Received At': 'የተቀበለበት', 'Transfer history': 'የዝውውር ታሪክ', 'to': 'ወደ', 'Transfer created successfully.': 'ዝውውሩ በተሳካ ሁኔታ ተፈጥሯል።', 'Transfer action failed.': 'የዝውውር እርምጃው አልተሳካም።', 'Unable to load transfer details.': 'የዝውውሩን ዝርዝር መጫን አልተቻለም።'
};

const GenericWorkflowPage = ({ config, scope, status, setStatus, load, rows, assets, form, setForm, saving, submit, error }) => (
  <section className="college-workspace-page">
    <header>
      <div>
        <div className="college-breadcrumb">{scope === 'college' ? 'College' : 'Department'} / Operations</div>
        <h1>{config.title}</h1>
        <p>Real records within your authorized {scope} scope.</p>
      </div>
    </header>
    <div className="college-toolbar">
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">All statuses</option>
        <option>Requested</option>
        <option>Approved</option>
        <option>Ready</option>
        <option>In Transit</option>
        <option>Received</option>
        <option>Inspected</option>
        <option>pending</option>
        <option>completed</option>
      </select>
      <button type="button" onClick={load}>Refresh</button>
    </div>
    {scope === 'department' && (
      <form className="college-form" onSubmit={submit}>
        <select required value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })}>
          <option value="">Select asset</option>
          {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.id})</option>)}
        </select>
        {config.path === 'transfers' && (
          <>
            <input required placeholder="Destination department ID" value={form.destination_department_id} onChange={(event) => setForm({ ...form, destination_department_id: event.target.value })} />
            <input placeholder="Destination location" value={form.destination_location} onChange={(event) => setForm({ ...form, destination_location: event.target.value })} />
          </>
        )}
        {config.path === 'maintenance' && (
          <>
            <input required placeholder="Problem" value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} />
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </>
        )}
        {config.path === 'returns' && (
          <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>
            <option>Excellent</option>
            <option>Good</option>
            <option>Fair</option>
            <option>Poor</option>
          </select>
        )}
        <input required placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        <button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit'}</button>
      </form>
    )}
    {error && <div className="error-banner">{error}</div>}
    <table className="college-table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Status</th>
          <th>Reason</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan="4">No data available</td></tr>
        ) : rows.map((row) => (
          <tr key={row.id || `${row.asset_id}-${row.created_at}`}>
            <td>{row.asset_name || row.asset?.name || row.assetId || row.asset_id || '-'}</td>
            <td>{row.status || '-'}</td>
            <td>{row.transfer_reason || row.reason || row.description || row.notes || '-'}</td>
            <td>{row.createdAt || row.created_at || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

const ScopedWorkflowPage = ({ scope = 'department', type = 'transfers' }) => {
  const config = CONFIG[type] || CONFIG.transfers;
  const { user } = useAuth();
  const { language } = useLanguage();
  const translate = (value) => scope === 'college' && language === 'am' ? COLLEGE_TRANSFER_COPY[value] || value : value;
  const role = String(user?.role || '').toLowerCase();
  const isTransferType = type === 'transfers';

  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workflowForm, setWorkflowForm] = useState({
    asset_id: '',
    destination_department_id: '',
    destination_location: '',
    reason: '',
    condition: 'Good',
    notes: '',
    problem: '',
    description: '',
    priority: 'normal',
  });
  const [status, setStatus] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    assetId: '',
    destinationDepartmentId: '',
    newLocation: '',
    transferReason: '',
    transferDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const base = `/api/${scope}/${config.path}`;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (isTransferType) {
        const [transferResponse, assetResponse, departmentResponse] = await Promise.all([
          apiClient.get(getTransferListEndpoint(scope, role), { params: statusFilter ? { status: statusFilter } : {} }),
          getAssetEndpoint(scope) === '/api/assets'
            ? getAllAssets(apiClient)
            : apiClient.get(getAssetEndpoint(scope), { params: { limit: 50 } }),
          apiClient.get('/api/departments', { params: { limit: 500 } }),
        ]);

        setRows(parseListData(transferResponse.data).map(normalizeTransfer));
        setAssets(Array.isArray(assetResponse) ? assetResponse : parseListData(assetResponse.data));
        setDepartments(parseListData(departmentResponse.data));
      } else {
        const [workflowResponse, assetsResponse] = await Promise.all([
          apiClient.get(base, { params: { status: status || undefined } }),
          getAssetEndpoint(scope) === '/api/assets'
            ? getAllAssets(apiClient)
            : apiClient.get(getAssetEndpoint(scope), { params: { limit: 50 } }),
        ]);
        setRows(parseListData(workflowResponse.data));
        setAssets(Array.isArray(assetsResponse) ? assetsResponse : parseListData(assetsResponse.data));
      }
    } catch (loadError) {
      setError(scope === 'college' && isTransferType && language === 'am' ? 'የዝውውር መዝገቦችን መጫን አልተቻለም።' : loadError.response?.data?.message || `Unable to load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [base, config.title, isTransferType, role, scope, status, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiClient.post(base, workflowForm);
      setWorkflowForm({ asset_id: '', destination_department_id: '', destination_location: '', reason: '', condition: 'Good', notes: '', problem: '', description: '', priority: 'normal' });
      await load();
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to submit request.');
    } finally {
      setSaving(false);
    }
  };

  const selectedAsset = useMemo(() => {
    if (!form.assetId) return null;
    return assets.find((asset) => Number(asset.id) === Number(form.assetId)) || null;
  }, [assets, form.assetId]);

  const statusSummary = useMemo(() => {
    const summary = { total: rows.length, pending: 0, approved: 0, rejected: 0, received: 0 };
    rows.forEach((row) => {
      const currentStatus = String(row.status || '').toLowerCase();
      if (currentStatus.includes('pending') || currentStatus.includes('requested')) summary.pending += 1;
      if (currentStatus.includes('approved')) summary.approved += 1;
      if (currentStatus.includes('rejected') || currentStatus.includes('cancelled')) summary.rejected += 1;
      if (currentStatus === 'received') summary.received += 1;
    });
    return summary;
  }, [rows]);

  const createTransfer = async (event) => {
    event.preventDefault();
    if (!form.assetId || !form.destinationDepartmentId || !form.newLocation || !form.transferReason.trim()) {
      setError('Asset, destination department, destination location and reason are required.');
      return;
    }

    const asset = assets.find((item) => Number(item.id) === Number(form.assetId));
    if (!asset) {
      setError('The selected asset could not be validated.');
      return;
    }

    const department = departments.find((item) => Number(item.id) === Number(form.destinationDepartmentId));
    if (!department) {
      setError('Please select a valid destination department.');
      return;
    }

    if (role === 'college' && asset.department && String(asset.department).trim() !== String(user?.department || '').trim()) {
      setError('This asset does not belong to your authorized department scope.');
      return;
    }

    setSaving(true); setError(''); setSuccessMessage('');
    try {
      await apiClient.post(getTransferListEndpoint(scope, role), {
        asset_id: Number(form.assetId),
        destination_department_id: Number(form.destinationDepartmentId),
        destination_location: String(form.newLocation).trim(),
        reason: String(form.transferReason).trim(),
      });
      setSuccessMessage('Transfer created successfully.');
      setForm({
        assetId: '',
        destinationDepartmentId: '',
        newLocation: '',
        transferReason: '',
        transferDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      await load();
    } catch (createError) {
      setError(createError.response?.data?.message || 'Unable to create the transfer.');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (transfer, action) => {
    const id = transfer?.id;
    if (!id) return;

    const actionLabel = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : action === 'cancel' ? 'Cancel' : 'Confirm receipt';
    const label = translate(actionLabel);
    const confirmation = scope === 'college' && language === 'am' ? `${label} የ${transfer.assetName || 'የተመረጠውን ንብረት'} ዝውውር?` : `${label} transfer for ${transfer.assetName || 'the selected asset'}?`;
    const confirmed = window.confirm(confirmation);
    if (!confirmed) return;

    setProcessingId(id); setError(''); setSuccessMessage('');
    try {
      if (action === 'approve') {
        await apiClient.post(`/api/college/transfers/${id}/approve`, { reason: 'Approved by authorized college manager.' });
      }

      if (action === 'reject') {
        await apiClient.post(`/api/college/transfers/${id}/reject`, { reason: 'Rejected by authorized college manager.' });
      }

      if (action === 'cancel') {
        if (role !== 'department_head') throw new Error('Cancellation is only supported for department heads.');
        await apiClient.post(`/api/department/transfers/${id}/cancel`, { reason: 'Cancelled by department head.' });
      }

      if (action === 'receive') {
        await apiClient.post(`/api/department-head/transfers/${id}/receive`, { notes: 'Receipt confirmed by destination department.' });
      }

      setSuccessMessage(scope === 'college' && language === 'am' ? `${label} በተሳካ ሁኔታ ተጠናቋል።` : `${label} action completed successfully.`);
      setSelectedTransfer(null);
      await load();
    } catch (requestError) {
      setError(scope === 'college' && language === 'am' ? translate('Transfer action failed.') : requestError.response?.data?.message || requestError.message || `Unable to ${action} transfer.`);
    } finally {
      setProcessingId(null);
    }
  };

  const openTransferDetails = async (transfer) => {
    setSelectedTransfer(transfer);
    setError('');
    try {
      const response = await apiClient.get(`${getTransferListEndpoint(scope, role)}/${transfer.id}`);
      setSelectedTransfer(normalizeTransfer(response.data?.data || response.data));
    } catch (detailError) {
      setError(scope === 'college' && language === 'am' ? translate('Unable to load transfer details.') : detailError.response?.data?.message || 'Unable to load transfer details.');
    }
  };

  const exportTransfers = () => {
    if (!rows.length) return;
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      [translate('Transfer ID')]: row.id,
      [translate('Asset')]: row.assetName,
      [translate('Asset Code')]: row.assetCode,
      [translate('Serial Number')]: row.serialNumber,
      [translate('From Department')]: row.fromDepartment,
      [translate('From Location')]: row.fromLocation,
      [translate('To Department')]: row.toDepartment,
      [translate('To Location')]: row.toLocation,
      [translate('Requested By')]: row.requestedBy,
      [translate('Approved By')]: row.approvedBy,
      [translate('Transfer Date')]: row.transferDate,
      [translate('Reason')]: row.transferReason,
      [translate('Status')]: translate(row.status),
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, translate('Transfers'));
    XLSX.writeFile(workbook, 'asset-transfers.xlsx');
  };

  if (!isTransferType) {
    return (
      <GenericWorkflowPage
        config={config}
        scope={scope}
        status={status}
        setStatus={setStatus}
        load={load}
        rows={rows}
        assets={assets}
        form={workflowForm}
        setForm={setWorkflowForm}
        saving={saving}
        submit={submit}
        error={error}
      />
    );
  }

  return (
    <section className="college-workspace-page">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="college-breadcrumb">{translate(scope === 'college' ? 'College' : 'Department')} / {translate('Transfers')}</div>
          <h1>{translate('Asset Transfers')}</h1>
        </div>
        <button type="button" onClick={exportTransfers} disabled={!rows.length || loading}>{translate('Export Excel')}</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '16px 0' }}>
        <div className="college-stat-card"><strong>{statusSummary.total}</strong><span>{translate('Total')}</span></div>
        <div className="college-stat-card"><strong>{statusSummary.pending}</strong><span>{translate('Pending')}</span></div>
        <div className="college-stat-card"><strong>{statusSummary.approved}</strong><span>{translate('Approved')}</span></div>
        <div className="college-stat-card"><strong>{statusSummary.received}</strong><span>{translate('Received')}</span></div>
        <div className="college-stat-card"><strong>{statusSummary.rejected}</strong><span>{translate('Rejected / Cancelled')}</span></div>
      </div>

      <div className="college-toolbar" style={{ marginBottom: 18 }}>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">{translate('All statuses')}</option>
          <option value="Requested">{translate('Requested')}</option>
          <option value="Approved">{translate('Approved')}</option>
          <option value="Ready">{translate('Ready')}</option>
          <option value="In Transit">{translate('In Transit')}</option>
          <option value="Received">{translate('Received')}</option>
          <option value="Rejected">{translate('Rejected')}</option>
          <option value="Cancelled">{translate('Cancelled')}</option>
        </select>
        <button type="button" onClick={load}>{translate('Refresh')}</button>
      </div>

      {scope === 'department' && <form className="college-form" onSubmit={createTransfer} style={{ marginBottom: 24 }}>
        <select required value={form.assetId} onChange={(event) => setForm((previous) => ({ ...previous, assetId: event.target.value }))}>
          <option value="">{translate('Select real asset')}</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.id})</option>
          ))}
        </select>

        {selectedAsset && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 10 }}>
            <div><strong>{translate('Current Department')}</strong><div>{selectedAsset.department || '—'}</div></div>
            <div><strong>{translate('Current Location')}</strong><div>{selectedAsset.location || '—'}</div></div>
            <div><strong>{translate('Asset Status')}</strong><div>{translate(selectedAsset.status) || '—'}</div></div>
          </div>
        )}

        <select required value={form.destinationDepartmentId} onChange={(event) => setForm((previous) => ({ ...previous, destinationDepartmentId: event.target.value }))}>
          <option value="">{translate('Select destination department')}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name || department.departmentName}</option>
          ))}
        </select>

        <input required placeholder={translate('Destination location')} value={form.newLocation} onChange={(event) => setForm((previous) => ({ ...previous, newLocation: event.target.value }))} />
        <input type="date" value={form.transferDate} onChange={(event) => setForm((previous) => ({ ...previous, transferDate: event.target.value }))} />
        <textarea required rows="3" placeholder={translate('Transfer reason / notes')} value={form.transferReason} onChange={(event) => setForm((previous) => ({ ...previous, transferReason: event.target.value }))} />
        <textarea rows="2" placeholder={translate('Additional notes')} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} />

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" disabled={saving}>{saving ? translate('Submitting') : translate('Create Transfer')}</button>
          <button type="button" className="secondary" onClick={() => setForm({ assetId: '', destinationDepartmentId: '', newLocation: '', transferReason: '', transferDate: new Date().toISOString().slice(0, 10), notes: '' })}>{translate('Clear')}</button>
        </div>
      </form>}

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
      {successMessage && <div className="success-banner" style={{ marginBottom: 12 }}>{successMessage}</div>}

      {loading ? (
        <div>{translate('Loading transfer records...')}</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">{translate('No transfer records found.')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="college-table">
            <thead>
              <tr>
                <th>{translate('Asset')}</th>
                <th>{translate('Status')}</th>
                <th>{translate('Current → Destination')}</th>
                <th>{translate('Reason')}</th>
                <th>{translate('Date')}</th>
                <th>{translate('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.assetName || translate('Unknown')}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: row.status === 'Approved' ? '#10b981' : row.status === 'Rejected' ? '#ef4444' : row.status === 'Cancelled' ? '#94a3b8' : row.status === 'Completed' ? '#22c55e' : '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      {translate(row.status || 'Pending')}
                    </span>
                  </td>
                  <td>
                    <div>{row.fromDepartment || '—'} → {row.fromLocation || '—'}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>→ {row.toDepartment || '—'} → {row.toLocation || '—'}</div>
                  </td>
                  <td>{row.transferReason || '—'}</td>
                  <td>{row.transferDate ? new Date(row.transferDate).toLocaleDateString() : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button type="button" onClick={() => openTransferDetails(row)} disabled={processingId === row.id}>{translate('View')}</button>
                      {scope === 'college' && row.status === 'Requested' && (
                        <button type="button" onClick={() => handleAction(row, 'approve')} disabled={processingId === row.id}>{translate('Approve')}</button>
                      )}
                      {scope === 'college' && row.status === 'Requested' && (
                        <button type="button" onClick={() => handleAction(row, 'reject')} disabled={processingId === row.id}>{translate('Reject')}</button>
                      )}
                      {scope === 'department' && role === 'department_head' && ['Requested', 'Approved'].includes(row.status) && (
                        <button type="button" onClick={() => handleAction(row, 'cancel')} disabled={processingId === row.id}>Cancel</button>
                      )}
                      {scope === 'department' && role === 'department_head' && row.status === 'In Transit' && Number(row.destinationDepartmentId ?? row.destination_department_id) === Number(user?.departmentId ?? user?.department_id) && (
                        <button type="button" onClick={() => handleAction(row, 'receive')} disabled={processingId === row.id}>Confirm receipt</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTransfer && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(760px, 92vw)', ...(scope === 'college' ? { maxHeight: '90vh', overflowY: 'auto' } : {}), background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 14px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{translate('Transfer Details')}</h3>
              <button type="button" onClick={() => setSelectedTransfer(null)}>{translate('Close')}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div><strong>{translate('Transfer ID')}</strong><div>{selectedTransfer.id}</div></div>
              <div><strong>{translate('Asset')}</strong><div>{selectedTransfer.assetName || '—'}</div></div>
              <div><strong>{translate('Asset Code')}</strong><div>{selectedTransfer.assetCode || '—'}</div></div>
              <div><strong>{translate('Serial Number')}</strong><div>{selectedTransfer.serialNumber || '—'}</div></div>
              <div><strong>{translate('From Department')}</strong><div>{selectedTransfer.fromDepartment || '—'}</div></div>
              <div><strong>{translate('From Location')}</strong><div>{selectedTransfer.fromLocation || '—'}</div></div>
              <div><strong>{translate('To Department')}</strong><div>{selectedTransfer.toDepartment || '—'}</div></div>
              <div><strong>{translate('To Location')}</strong><div>{selectedTransfer.toLocation || '—'}</div></div>
              <div><strong>{translate('Requested By')}</strong><div>{selectedTransfer.requestedBy || '—'}</div></div>
              <div><strong>{translate('Approved By')}</strong><div>{selectedTransfer.approvedBy || '—'}</div></div>
              <div><strong>Dispatched By</strong><div>{selectedTransfer.dispatchedBy || '—'}</div></div>
              <div><strong>Received By</strong><div>{selectedTransfer.receivedBy || '—'}</div></div>
              <div><strong>{translate('Transfer Date')}</strong><div>{selectedTransfer.transferDate ? new Date(selectedTransfer.transferDate).toLocaleDateString(language === 'am' && scope === 'college' ? 'am-ET' : undefined) : '—'}</div></div>
              <div><strong>{translate('Status')}</strong><div>{translate(selectedTransfer.status || '—')}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><strong>{translate('Reason')}</strong><div>{selectedTransfer.transferReason || '—'}</div></div>
              <div><strong>{translate('Requested At')}</strong><div>{selectedTransfer.requestedAt ? new Date(selectedTransfer.requestedAt).toLocaleString() : '—'}</div></div>
              <div><strong>{translate('Approved At')}</strong><div>{selectedTransfer.approvalDate ? new Date(selectedTransfer.approvalDate).toLocaleString() : '—'}</div></div>
              <div><strong>{translate('Ready At')}</strong><div>{selectedTransfer.readyAt ? new Date(selectedTransfer.readyAt).toLocaleString() : '—'}</div></div>
              <div><strong>{translate('Dispatched At')}</strong><div>{selectedTransfer.dispatchedAt ? new Date(selectedTransfer.dispatchedAt).toLocaleString() : '—'}</div></div>
              <div><strong>{translate('Received At')}</strong><div>{selectedTransfer.receivedAt ? new Date(selectedTransfer.receivedAt).toLocaleString() : '—'}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><strong>{translate('Transfer history')}</strong><div>{(selectedTransfer.history || []).map((historyItem) => <div key={historyItem.id}>{historyItem.transfer_number || historyItem.id}: {translate(historyItem.status)} ({historyItem.sourceDepartment || historyItem.source_department || '—'} {translate('to')} {historyItem.destinationDepartment || historyItem.destination_department || '—'})</div>)}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Chain of custody</strong><div>{(selectedTransfer.audit || []).map((event, index) => <div key={`${event.id || event.action}-${index}`}>{event.action || 'Transfer event'} — {event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</div>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ScopedWorkflowPage;
