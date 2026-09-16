import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
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
    transferDate: item.transferDate || item.transfer_date || item.date || item.createdAt || item.created_at || '',
    status: item.status || item.transferStatus || item.transfer_status || '',
  };
};

const getTransferListEndpoint = (scope, userRole) => {
  if (scope === 'college') return '/api/college/transfers';
  if (scope === 'department') return '/api/department/transfers';
  if (userRole === 'department_head') return '/api/department/transfers';
  return '/api/transfers';
};

const getAssetEndpoint = (scope) => {
  if (scope === 'college') return '/api/college/assets';
  if (scope === 'department') return '/api/department/assets';
  return '/api/assets';
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
          apiClient.get(getAssetEndpoint(scope), { params: { limit: 500 } }),
          apiClient.get('/api/departments', { params: { limit: 500 } }),
        ]);

        setRows(parseListData(transferResponse.data).map(normalizeTransfer));
        setAssets(parseListData(assetResponse.data));
        setDepartments(parseListData(departmentResponse.data));
      } else {
        const [workflowResponse, assetsResponse] = await Promise.all([
          apiClient.get(base, { params: { status: status || undefined } }),
          apiClient.get(getAssetEndpoint(scope), { params: { limit: 100 } }),
        ]);
        setRows(parseListData(workflowResponse.data));
        setAssets(parseListData(assetsResponse.data));
      }
    } catch (loadError) {
      setError(loadError.response?.data?.message || `Unable to load ${config.title.toLowerCase()}.`);
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
      await apiClient.post('/api/department/transfers', {
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

    const label = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : action === 'cancel' ? 'Cancel' : 'Complete';
    const confirmed = window.confirm(`${label} transfer for ${transfer.assetName || 'the selected asset'}?`);
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

      setSuccessMessage(`${label} action completed successfully.`);
      setSelectedTransfer(null);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || `Unable to ${action} transfer.`);
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
      setError(detailError.response?.data?.message || 'Unable to load transfer details.');
    }
  };

  const exportTransfers = () => {
    if (!rows.length) return;
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      ID: row.id,
      Asset: row.assetName,
      'Asset Code': row.assetCode,
      'Serial Number': row.serialNumber,
      'From Department': row.fromDepartment,
      'From Location': row.fromLocation,
      'To Department': row.toDepartment,
      'To Location': row.toLocation,
      'Requested By': row.requestedBy,
      'Approved By': row.approvedBy,
      'Transfer Date': row.transferDate,
      Reason: row.transferReason,
      Status: row.status,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transfers');
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
          <div className="college-breadcrumb">{scope === 'college' ? 'College' : 'Department'} / Transfers</div>
          <h1>Asset Transfers</h1>
        </div>
        <button type="button" onClick={exportTransfers} disabled={!rows.length || loading}>Export Excel</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '16px 0' }}>
        <div className="college-stat-card"><strong>{statusSummary.total}</strong><span>Total</span></div>
        <div className="college-stat-card"><strong>{statusSummary.pending}</strong><span>Pending</span></div>
        <div className="college-stat-card"><strong>{statusSummary.approved}</strong><span>Approved</span></div>
        <div className="college-stat-card"><strong>{statusSummary.received}</strong><span>Received</span></div>
        <div className="college-stat-card"><strong>{statusSummary.rejected}</strong><span>Rejected / Cancelled</span></div>
      </div>

      <div className="college-toolbar" style={{ marginBottom: 18 }}>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="Requested">Requested</option>
          <option value="Approved">Approved</option>
          <option value="Ready">Ready</option>
          <option value="In Transit">In Transit</option>
          <option value="Received">Received</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button type="button" onClick={load}>Refresh</button>
      </div>

      {scope === 'department' && <form className="college-form" onSubmit={createTransfer} style={{ marginBottom: 24 }}>
        <select required value={form.assetId} onChange={(event) => setForm((previous) => ({ ...previous, assetId: event.target.value }))}>
          <option value="">Select real asset</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.id})</option>
          ))}
        </select>

        {selectedAsset && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 10 }}>
            <div><strong>Current Department</strong><div>{selectedAsset.department || '—'}</div></div>
            <div><strong>Current Location</strong><div>{selectedAsset.location || '—'}</div></div>
            <div><strong>Asset Status</strong><div>{selectedAsset.status || '—'}</div></div>
          </div>
        )}

        <select required value={form.destinationDepartmentId} onChange={(event) => setForm((previous) => ({ ...previous, destinationDepartmentId: event.target.value }))}>
          <option value="">Select destination department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name || department.departmentName}</option>
          ))}
        </select>

        <input required placeholder="Destination location" value={form.newLocation} onChange={(event) => setForm((previous) => ({ ...previous, newLocation: event.target.value }))} />
        <input type="date" value={form.transferDate} onChange={(event) => setForm((previous) => ({ ...previous, transferDate: event.target.value }))} />
        <textarea required rows="3" placeholder="Transfer reason / notes" value={form.transferReason} onChange={(event) => setForm((previous) => ({ ...previous, transferReason: event.target.value }))} />
        <textarea rows="2" placeholder="Additional notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} />

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Create Transfer'}</button>
          <button type="button" className="secondary" onClick={() => setForm({ assetId: '', destinationDepartmentId: '', newLocation: '', transferReason: '', transferDate: new Date().toISOString().slice(0, 10), notes: '' })}>Clear</button>
        </div>
      </form>}

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
      {successMessage && <div className="success-banner" style={{ marginBottom: 12 }}>{successMessage}</div>}

      {loading ? (
        <div>Loading transfer records...</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No transfer records found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="college-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Status</th>
                <th>Current → Destination</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.assetName || 'Unknown'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: row.status === 'Approved' ? '#10b981' : row.status === 'Rejected' ? '#ef4444' : row.status === 'Cancelled' ? '#94a3b8' : row.status === 'Completed' ? '#22c55e' : '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      {row.status || 'Pending'}
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
                      <button type="button" onClick={() => openTransferDetails(row)} disabled={processingId === row.id}>View</button>
                      {scope === 'college' && row.status === 'Requested' && (
                        <button type="button" onClick={() => handleAction(row, 'approve')} disabled={processingId === row.id}>Approve</button>
                      )}
                      {scope === 'college' && row.status === 'Requested' && (
                        <button type="button" onClick={() => handleAction(row, 'reject')} disabled={processingId === row.id}>Reject</button>
                      )}
                      {scope === 'department' && role === 'department_head' && ['Requested', 'Approved'].includes(row.status) && (
                        <button type="button" onClick={() => handleAction(row, 'cancel')} disabled={processingId === row.id}>Cancel</button>
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
          <div style={{ width: 'min(760px, 92vw)', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 14px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Transfer Details</h3>
              <button type="button" onClick={() => setSelectedTransfer(null)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div><strong>Transfer ID</strong><div>{selectedTransfer.id}</div></div>
              <div><strong>Asset</strong><div>{selectedTransfer.assetName || '—'}</div></div>
              <div><strong>Asset Code</strong><div>{selectedTransfer.assetCode || '—'}</div></div>
              <div><strong>Serial Number</strong><div>{selectedTransfer.serialNumber || '—'}</div></div>
              <div><strong>From Department</strong><div>{selectedTransfer.fromDepartment || '—'}</div></div>
              <div><strong>From Location</strong><div>{selectedTransfer.fromLocation || '—'}</div></div>
              <div><strong>To Department</strong><div>{selectedTransfer.toDepartment || '—'}</div></div>
              <div><strong>To Location</strong><div>{selectedTransfer.toLocation || '—'}</div></div>
              <div><strong>Requested By</strong><div>{selectedTransfer.requestedBy || '—'}</div></div>
              <div><strong>Approved By</strong><div>{selectedTransfer.approvedBy || '—'}</div></div>
              <div><strong>Transfer Date</strong><div>{selectedTransfer.transferDate ? new Date(selectedTransfer.transferDate).toLocaleDateString() : '—'}</div></div>
              <div><strong>Status</strong><div>{selectedTransfer.status || '—'}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Reason</strong><div>{selectedTransfer.transferReason || '—'}</div></div>
              <div><strong>Requested At</strong><div>{selectedTransfer.requestedAt ? new Date(selectedTransfer.requestedAt).toLocaleString() : '—'}</div></div>
              <div><strong>Approved At</strong><div>{selectedTransfer.approvalDate ? new Date(selectedTransfer.approvalDate).toLocaleString() : '—'}</div></div>
              <div><strong>Ready At</strong><div>{selectedTransfer.readyAt ? new Date(selectedTransfer.readyAt).toLocaleString() : '—'}</div></div>
              <div><strong>Dispatched At</strong><div>{selectedTransfer.dispatchedAt ? new Date(selectedTransfer.dispatchedAt).toLocaleString() : '—'}</div></div>
              <div><strong>Received At</strong><div>{selectedTransfer.receivedAt ? new Date(selectedTransfer.receivedAt).toLocaleString() : '—'}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Transfer history</strong><div>{(selectedTransfer.history || []).map((historyItem) => <div key={historyItem.id}>{historyItem.transfer_number || historyItem.id}: {historyItem.status} ({historyItem.sourceDepartment || historyItem.source_department || '—'} to {historyItem.destinationDepartment || historyItem.destination_department || '—'})</div>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ScopedWorkflowPage;
