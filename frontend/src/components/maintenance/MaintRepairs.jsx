import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { getRepairHistory, getAssets, getTechnicians, createRepair, updateRepair } from '../../services/maintenanceApi';

const defaultForm = {
  asset_id: '',
  work_order_id: '',
  problem: '',
  diagnosis: '',
  repair_action: '',
  technician_id: '',
  priority: 'medium',
  status: 'open',
  cost: 0,
  notes: '',
};

const repairStatusOptions = ['Open', 'Assigned', 'Diagnosing', 'In Progress', 'Waiting for Parts', 'Testing', 'Completed', 'Failed', 'Rework', 'Cancelled'];

const MaintRepairs = () => {
  const [repairs, setRepairs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ totalRepairs: 0, totalRepairCost: 0, open: 0, inProgress: 0, waitingForParts: 0, completed: 0, failed: 0, rework: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [repairResult, assetList, techList] = await Promise.all([
        getRepairHistory({
          page,
          limit: 20,
          search: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          priority: priorityFilter === 'all' ? undefined : priorityFilter,
        }),
        getAssets({ limit: 200 }),
        getTechnicians(),
      ]);
      setRepairs(repairResult.records || []);
      setPagination({ total: repairResult.total || 0, totalPages: repairResult.totalPages || 1 });
      setStats(repairResult.stats || { totalRepairs: 0, totalRepairCost: 0, open: 0, inProgress: 0, waitingForParts: 0, completed: 0, failed: 0, rework: 0 });
      setAssets(assetList || []);
      setTechnicians(techList || []);
      setError('');
    } catch (err) {
      setError(err && err.message ? err.message : 'Failed to load repairs');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        asset_id: Number(form.asset_id),
        technician_id: form.technician_id ? Number(form.technician_id) : null,
        work_order_id: form.work_order_id ? Number(form.work_order_id) : null,
        cost: Number(form.cost || 0),
      };
      if (editingId) {
        await updateRepair(editingId, payload);
      } else {
        await createRepair(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      await loadData();
    } catch (err) {
      setError(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Unable to save repair record.'));
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEditForm = (repair) => {
    setEditingId(repair.id);
    setForm({
      asset_id: repair.asset?.id || '',
      work_order_id: repair.workOrderId || '',
      problem: repair.problem || repair.description || '',
      diagnosis: repair.diagnosis || '',
      repair_action: repair.repairAction || '',
      technician_id: repair.technicianId || repair.technician?.id || '',
      priority: (repair.priority || 'medium').toLowerCase(),
      status: (repair.statusRaw || 'open').toLowerCase(),
      cost: Number(repair.repairCost || 0),
      notes: repair.notes || '',
    });
    setShowForm(true);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading repairs…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0', fontSize: '2rem', fontWeight: 'bold' }}>Repairs</h1>
          <p style={{ margin: '6px 0 0', color: isDark ? '#94a3b8' : '#4a5568' }}>Manage equipment repairs, repair progress, parts, costs, and completion.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={openCreateForm} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>New Repair</button>
          <button type="button" onClick={() => loadData()} style={{ background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#0f172a', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
          <button type="button" style={{ background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#0f172a', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>Export</button>
        </div>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Repairs', value: stats.totalRepairs || 0, tone: '#2563eb' }, { label: 'Open', value: stats.open || 0, tone: '#3b82f6' }, { label: 'In Progress', value: stats.inProgress || 0, tone: '#f59e0b' }, { label: 'Waiting for Parts', value: stats.waitingForParts || 0, tone: '#f97316' }, { label: 'Completed', value: stats.completed || 0, tone: '#10b981' }, { label: 'Failed / Rework', value: (stats.failed || 0) + (stats.rework || 0), tone: '#ef4444' }].map((item) => (
          <div key={item.label} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b' }}>{item.label}</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: item.tone, marginTop: '8px' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search repair number, asset, technician, problem..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }} />
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }}>
            <option value="all">All statuses</option>
            {repairStatusOptions.map((status) => <option key={status} value={status.toLowerCase().replace(/ /g, '-')}>{status}</option>)}
          </select>
          <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1); }} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' }}>
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Repair Number</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Work Order</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Problem</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Priority</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Progress</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Cost</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {repairs.map((repair) => (
              <tr key={repair.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontWeight: '700' }}>{repair.repairId || `REP-${String(repair.id).padStart(3, '0')}`}</td>
                <td style={{ padding: '12px' }}>{repair.workOrderId ? `WO-${String(repair.workOrderId).padStart(3, '0')}` : '—'}</td>
                <td style={{ padding: '12px' }}>{repair.asset?.name || repair.assetName || '—'}</td>
                <td style={{ padding: '12px', maxWidth: '220px' }}>{repair.problem || repair.description || repair.diagnosis || '—'}</td>
                <td style={{ padding: '12px' }}>{repair.technician || 'Unassigned'}</td>
                <td style={{ padding: '12px' }}>{repair.priority ? repair.priority.charAt(0).toUpperCase() + repair.priority.slice(1) : 'Medium'}</td>
                <td style={{ padding: '12px' }}><span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '999px', background: repair.statusRaw === 'completed' ? '#dcfce7' : repair.statusRaw === 'failed' || repair.statusRaw === 'rework' ? '#fee2e2' : '#e0f2fe', color: repair.statusRaw === 'completed' ? '#166534' : repair.statusRaw === 'failed' || repair.statusRaw === 'rework' ? '#991b1b' : '#075985', fontSize: '0.8rem', fontWeight: 600 }}>{repair.status || 'Open'}</span></td>
                <td style={{ padding: '12px' }}>{Math.min(100, Math.max(0, Number(repair.progress || 0)))}%</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>${Number(repair.repairCost || 0).toFixed(2)}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openEditForm(repair)} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', padding: '4px 8px', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => openEditForm(repair)} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', padding: '4px 8px', cursor: 'pointer' }}>View</button>
                  </div>
                </td>
              </tr>
            ))}
            {repairs.length === 0 && <tr><td colSpan="10" style={{ padding: '24px', textAlign: 'center' }}>No repairs match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px 16px', marginTop: '16px', backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <span>Repairs: {stats.totalRepairs || 0}</span>
        <span>Repair cost: ${Number(stats.totalRepairCost || 0).toFixed(2)}</span>
      </div>

      {pagination.totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', margin: '20px 0', flexWrap: 'wrap' }}>
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#fff' : '#0f172a', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
        <span>Page {page} of {pagination.totalPages}</span>
        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#fff' : '#0f172a', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
      </div>}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}>
          <div style={{ width: 'min(900px, 100%)', background: cardBg, borderRadius: '18px', border: `1px solid ${cardBorder}`, padding: '24px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{editingId ? 'Edit Repair' : 'New Repair'}</h2>
              <button type="button" onClick={() => setShowForm(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span>Asset</span>
                <select value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} required>
                  <option value="">Select asset</option>
                  {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode})</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span>Work Order</span>
                <input value={form.work_order_id} onChange={(event) => setForm({ ...form, work_order_id: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} placeholder="Optional work order ID" />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span>Priority</span>
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span>Status</span>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
                  {repairStatusOptions.map((status) => <option key={status} value={status.toLowerCase().replace(/ /g, '-')}>{status}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span>Technician</span>
                <select value={form.technician_id} onChange={(event) => setForm({ ...form, technician_id: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName || tech.username}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span>Estimated Cost</span>
                <input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
              </label>
              <label style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                <span>Problem Description</span>
                <textarea value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} required style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minHeight: '90px' }} />
              </label>
              <label style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                <span>Initial Diagnosis</span>
                <textarea value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minHeight: '80px' }} />
              </label>
              <label style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                <span>Repair Actions</span>
                <textarea value={form.repair_action} onChange={(event) => setForm({ ...form, repair_action: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minHeight: '80px' }} />
              </label>
              <label style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                <span>Notes</span>
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, minHeight: '80px' }} />
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{editingId ? 'Save Repair' : 'Create Repair'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintRepairs;