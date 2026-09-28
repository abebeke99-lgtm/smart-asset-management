import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';

const STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  assigned: 'Assigned',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#dc2626',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? `ETB ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'ETB 0.00';
};

const emptyWorkOrderForm = {
  maintenanceId: '',
  workOrderNumber: '',
  technicianId: '',
  priority: 'medium',
  scheduledDate: '',
  dueDate: '',
  problemDescription: '',
  requiredWork: '',
  estimatedCost: '0',
  notes: '',
};

const MaintWorkOrders = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, inProgress: 0, onHold: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createOptions, setCreateOptions] = useState({ assets: [], technicians: [], maintenanceRequests: [] });
  const [workOrderForm, setWorkOrderForm] = useState(emptyWorkOrderForm);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/maintenance/work-orders', {
        params: {
          page,
          limit: 10,
          search: filterText || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        },
      });
      const payload = response.data || {};
      setRows(payload.data || []);
      setSummary(payload.summary || { total: 0, open: 0, inProgress: 0, onHold: 0, completed: 0, overdue: 0 });
      setPagination(payload.pagination || { page: 1, pages: 1, total: 0, limit: 10 });
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [filterText, page, priorityFilter, statusFilter]);

  useEffect(() => { loadWorkOrders(); }, [loadWorkOrders]);

  const openCreateForm = async () => {
    setCreateOpen(true);
    setCreateLoading(true);
    setCreateError('');
    try {
      const response = await apiClient.get('/maintenance/work-orders/options');
      const options = response.data?.data || {};
      const maintenanceRequests = options.maintenanceRequests || [];
      setCreateOptions({
        assets: options.assets || [],
        technicians: options.technicians || [],
        maintenanceRequests,
      });
      setWorkOrderForm({ ...emptyWorkOrderForm, maintenanceId: maintenanceRequests[0] ? String(maintenanceRequests[0].id) : '' });
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Unable to load work-order options. Please check the server connection.');
    } finally {
      setCreateLoading(false);
    }
  };

  const submitWorkOrder = async (event) => {
    event.preventDefault();
    const maintenanceRequest = createOptions.maintenanceRequests.find((item) => String(item.id) === workOrderForm.maintenanceId);
    if (!maintenanceRequest) {
      setCreateError('Select an open maintenance request before creating a work order.');
      return;
    }

    setSavingCreate(true);
    setCreateError('');
    try {
      await apiClient.post('/maintenance/work-orders', {
        maintenanceId: maintenanceRequest.id,
        assetId: maintenanceRequest.assetId,
        workOrderNumber: workOrderForm.workOrderNumber.trim() || undefined,
        technicianId: workOrderForm.technicianId || null,
        priority: workOrderForm.priority,
        status: 'open',
        problemDescription: workOrderForm.problemDescription.trim(),
        requiredWork: workOrderForm.requiredWork.trim(),
        scheduledDate: workOrderForm.scheduledDate || null,
        dueDate: workOrderForm.dueDate || null,
        estimatedCost: Number(workOrderForm.estimatedCost || 0),
        notes: workOrderForm.notes.trim(),
      });
      setCreateOpen(false);
      setWorkOrderForm(emptyWorkOrderForm);
      await loadWorkOrders();
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Unable to create the work order. Please try again.');
    } finally {
      setSavingCreate(false);
    }
  };

  const updateFormField = (event) => {
    const { name, value } = event.target;
    setWorkOrderForm((current) => ({ ...current, [name]: value }));
  };

  const filteredRows = useMemo(() => rows.filter((item) => {
    const query = filterText.trim().toLowerCase();
    if (!query) return true;
    const rowText = [
      item.workOrderNumber,
      item.assetName,
      item.assetCode,
      item.serialNumber,
      item.technician,
      item.title,
      item.description,
    ].join(' ').toLowerCase();
    return rowText.includes(query);
  }), [filterText, rows]);

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '6px' }}>Operations</div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>Maintenance Work Orders</h1>
          <p style={{ margin: '8px 0 0', color: isDark ? '#cbd5e1' : '#475569' }}>Create, assign, monitor, and complete maintenance work orders.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={loadWorkOrders} style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
          <button type="button" onClick={openCreateForm} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>New Work Order</button>
          <button type="button" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Export</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Work Orders', value: summary.total || pagination.total || 0, color: '#2563eb' },
          { label: 'Open', value: summary.open || 0, color: '#10b981' },
          { label: 'In Progress', value: summary.inProgress || 0, color: '#f59e0b' },
          { label: 'On Hold', value: summary.onHold || 0, color: '#ef4444' },
          { label: 'Completed', value: summary.completed || 0, color: '#22c55e' },
          { label: 'Overdue', value: summary.overdue || 0, color: '#7c3aed' },
        ].map((item) => (
          <div key={item.label} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', minHeight: '110px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <input value={filterText} onChange={(event) => { setFilterText(event.target.value); setPage(1); }} placeholder="Search work orders, asset, technician..." style={{ flex: '1 1 220px', minHeight: '42px', borderRadius: '8px', border: `1px solid ${cardBorder}`, padding: '0 12px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }} />
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} style={{ minWidth: '160px', minHeight: '42px', borderRadius: '8px', border: `1px solid ${cardBorder}`, padding: '0 12px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }}>
            <option value="all">All Status</option>
            {Object.keys(STATUS_LABELS).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
          <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1); }} style={{ minWidth: '150px', minHeight: '42px', borderRadius: '8px', border: `1px solid ${cardBorder}`, padding: '0 12px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }}>
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {error && <div style={{ marginBottom: '12px', background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '8px' }}>Error: {error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ backgroundColor: isDark ? '#334155' : '#f8fafc' }}>
                {['Work Order Number', 'Asset', 'Asset Code', 'Maintenance Type', 'Priority', 'Technician', 'Requested Date', 'Scheduled Date', 'Due Date', 'Status', 'Progress', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '12px 10px', textAlign: 'left', color: isDark ? '#cbd5e1' : '#475569', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ padding: '26px', textAlign: 'center', color: '#64748b' }}>No maintenance work orders found.</td>
                </tr>
              )}
              {filteredRows.map((item) => (
                <tr key={item.id} style={{ borderTop: `1px solid ${cardBorder}` }}>
                  <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563eb' }}>{item.workOrderNumber}</td>
                  <td style={{ padding: '12px 10px' }}>{item.assetName}</td>
                  <td style={{ padding: '12px 10px' }}>{item.assetCode || '—'}</td>
                  <td style={{ padding: '12px 10px' }}>{item.maintenanceType || 'Maintenance'}</td>
                  <td style={{ padding: '12px 10px' }}><span style={{ background: `${PRIORITY_COLORS[item.priority] || '#64748b'}22`, color: PRIORITY_COLORS[item.priority] || '#64748b', borderRadius: '999px', padding: '5px 10px', fontWeight: 700, fontSize: '0.78rem' }}>{item.priorityLabel || 'Medium'}</span></td>
                  <td style={{ padding: '12px 10px' }}>{item.technician}</td>
                  <td style={{ padding: '12px 10px' }}>{formatDate(item.requestedDate)}</td>
                  <td style={{ padding: '12px 10px' }}>{formatDate(item.scheduledDate)}</td>
                  <td style={{ padding: '12px 10px' }}>{formatDate(item.dueDate)}</td>
                  <td style={{ padding: '12px 10px' }}><span style={{ background: item.statusRaw === 'completed' ? '#dcfce7' : item.statusRaw === 'in-progress' ? '#fef3c7' : '#dbeafe', color: item.statusRaw === 'completed' ? '#166534' : item.statusRaw === 'in-progress' ? '#854d0e' : '#1d4ed8', borderRadius: '999px', padding: '5px 10px', fontWeight: 700, fontSize: '0.76rem' }}>{item.status}</span></td>
                  <td style={{ padding: '12px 10px' }}>{Math.min(100, Math.max(0, Number(item.progress || 0)))}%</td>
                  <td style={{ padding: '12px 10px' }}><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}><button type="button" style={{ background: '#e0f2fe', color: '#0f172a', border: 'none', borderRadius: '6px', padding: '6px 8px', fontWeight: 700, cursor: 'pointer' }}>View</button><button type="button" style={{ background: '#eef2ff', color: '#312e81', border: 'none', borderRadius: '6px', padding: '6px 8px', fontWeight: 700, cursor: 'pointer' }}>Edit</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading work orders...</div>}

        {!loading && pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ color: '#64748b' }}>Page {pagination.page} of {pagination.pages}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} style={{ border: 'none', background: '#e2e8f0', color: '#0f172a', borderRadius: '8px', padding: '8px 12px', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.6 : 1 }}>Previous</button>
              <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: page >= pagination.pages ? 'not-allowed' : 'pointer', opacity: page >= pagination.pages ? 0.6 : 1 }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingCreate) setCreateOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.58)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="new-work-order-title" style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: cardBg, color: isDark ? '#f8fafc' : '#0f172a', border: `1px solid ${cardBorder}`, borderRadius: '10px', padding: '22px', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
              <div>
                <h2 id="new-work-order-title" style={{ margin: 0, fontSize: '1.35rem' }}>New Work Order</h2>
                <p style={{ margin: '6px 0 0', color: isDark ? '#cbd5e1' : '#64748b' }}>Link this work order to an open maintenance request.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} disabled={savingCreate} aria-label="Close" style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {createError && <div role="alert" style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b' }}>{createError}</div>}
            {createLoading ? <div role="status" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading work-order options…</div> : (
              createOptions.maintenanceRequests.length === 0 ? (
                <div style={{ padding: '18px', border: `1px solid ${cardBorder}`, borderRadius: '6px', color: isDark ? '#cbd5e1' : '#475569' }}>
                  {createOptions.assets.length === 0 ? 'No assets or maintenance requests are available in the database.' : 'No open maintenance requests are available. A work order must be linked to a maintenance request.'}
                </div>
              ) : (
                <form onSubmit={submitWorkOrder} style={{ display: 'grid', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>
                    Maintenance Request <span style={{ color: '#dc2626' }}>*</span>
                    <select name="maintenanceId" value={workOrderForm.maintenanceId} onChange={updateFormField} required style={{ minHeight: '42px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }}>
                      {createOptions.maintenanceRequests.map((request) => (
                        <option key={request.id} value={request.id}>REQ-{String(request.id).padStart(3, '0')} · {request.title} · {request.asset?.name || request.asset?.assetCode}</option>
                      ))}
                    </select>
                  </label>

                  {(() => {
                    const selectedRequest = createOptions.maintenanceRequests.find((item) => String(item.id) === workOrderForm.maintenanceId);
                    return selectedRequest && <div style={{ padding: '10px 12px', borderRadius: '6px', background: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#cbd5e1' : '#475569' }}><strong>Asset:</strong> {selectedRequest.asset?.name || selectedRequest.asset?.assetCode} {selectedRequest.asset?.assetCode ? `(${selectedRequest.asset.assetCode})` : ''}</div>;
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Work Order Number <span style={{ fontWeight: 400, color: '#64748b' }}>Optional</span><input name="workOrderNumber" value={workOrderForm.workOrderNumber} onChange={updateFormField} maxLength={100} placeholder="Generated automatically" style={{ minHeight: '40px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }} /></label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Technician<select name="technicianId" value={workOrderForm.technicianId} onChange={updateFormField} style={{ minHeight: '40px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }}><option value="">Unassigned</option>{createOptions.technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName || technician.username}</option>)}</select></label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Priority<select name="priority" value={workOrderForm.priority} onChange={updateFormField} style={{ minHeight: '40px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Scheduled Date<input type="date" name="scheduledDate" value={workOrderForm.scheduledDate} onChange={updateFormField} style={{ minHeight: '40px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }} /></label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Due Date<input type="date" name="dueDate" value={workOrderForm.dueDate} onChange={updateFormField} min={workOrderForm.scheduledDate || undefined} style={{ minHeight: '40px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }} /></label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Estimated Cost (ETB)<input type="number" name="estimatedCost" min="0" step="0.01" value={workOrderForm.estimatedCost} onChange={updateFormField} style={{ minHeight: '40px', border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit' }} /></label>
                  </div>

                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Problem Description <textarea name="problemDescription" value={workOrderForm.problemDescription} onChange={updateFormField} rows={2} required style={{ border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '9px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit', resize: 'vertical' }} /></label>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Required Work <textarea name="requiredWork" value={workOrderForm.requiredWork} onChange={updateFormField} rows={2} style={{ border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '9px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit', resize: 'vertical' }} /></label>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600 }}>Notes <textarea name="notes" value={workOrderForm.notes} onChange={updateFormField} rows={2} style={{ border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '9px 10px', background: isDark ? '#0f172a' : '#fff', color: 'inherit', resize: 'vertical' }} /></label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                    <button type="button" onClick={() => setCreateOpen(false)} disabled={savingCreate} style={{ border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '9px 14px', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingCreate} style={{ border: 0, borderRadius: '6px', padding: '9px 16px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: savingCreate ? 'wait' : 'pointer', opacity: savingCreate ? 0.7 : 1 }}>{savingCreate ? 'Creating…' : 'Create Work Order'}</button>
                  </div>
                </form>
              )
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default MaintWorkOrders;