import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Eye, Filter, Package, Plus, RefreshCw, Search, Wrench, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { createRepair, getAssets, getRepairDetails, getRepairHistory, updateRepair } from '../../services/maintenanceApi';
import './ICTRepairHistory.css';

const statuses = ['pending', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'cancelled'];
const statusLabel = (value) => String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const emptyForm = { asset_id: '', problem: '', diagnosis: '', repair_action: '', parts_replaced: '', technician_id: '', vendor: '', cost: '', repair_date: '', completion_date: '', status: 'pending', priority: 'medium', notes: '' };

const ICTRepairHistory = () => {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ totalRepairs: 0, activeRepairs: 0, completedRepairs: 0, awaitingParts: 0, totalRepairCost: 0 });
  const [assets, setAssets] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getRepairHistory({ ...filters, page, limit: 20 });
      setRecords(result.records || []); setStats(result.stats || {}); setPagination({ total: result.total || 0, totalPages: result.totalPages || 1 });
    } catch (loadError) { setError(loadError.response?.data?.message || 'Unable to load repair history.'); }
    finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAssets({ limit: 1000 }).then(setAssets).catch(() => {}); }, []);

  const openDetails = async (record) => {
    try { setSelected(await getRepairDetails(record.id)); } catch { toast.error('Unable to load repair details.'); }
  };
  const openCreate = () => { setForm(emptyForm); setFormOpen(true); };
  const openEdit = (record) => { setSelected(null); setForm({ ...emptyForm, id: record.id, asset_id: record.assetId || '', problem: record.description || '', diagnosis: record.diagnosis || '', repair_action: record.repairAction || '', parts_replaced: record.partsReplaced || '', cost: record.repairCost || '', completion_date: record.completionDate?.slice(0, 10) || '', status: String(record.status || '').toLowerCase().replace(/ /g, '-'), priority: record.priority || 'medium', notes: record.notes || '' }); setFormOpen(true); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try { if (form.id) await updateRepair(form.id, form); else await createRepair(form); toast.success(form.id ? 'Repair record updated successfully.' : 'Repair record created successfully.'); setFormOpen(false); setPage(1); load(); }
    catch (saveError) { toast.error(saveError.response?.data?.message || (form.id ? 'Unable to update repair record.' : 'Unable to create repair record.')); }
    finally { setSaving(false); }
  };
  const clearFilters = () => { setFilters({ search: '', status: '', priority: '' }); setPage(1); };
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  return <main className="repair-page">
    <header className="repair-header"><div className="repair-heading"><span className="repair-heading-icon"><Wrench size={23} /></span><div><p className="repair-eyebrow">Maintenance</p><h1>Repair History</h1><p>Track and manage ICT asset repair records</p></div></div><div className="repair-actions"><button className="quiet-button" onClick={load} disabled={loading} title="Refresh"><RefreshCw size={17} className={loading ? 'spin' : ''} /> Refresh</button><button className="primary-button" onClick={openCreate}><Plus size={17} /> Add Repair</button></div></header>
    <section className="repair-kpis"><Kpi icon={<ClipboardList />} label="Total Repairs" value={stats.totalRepairs} /><Kpi icon={<Wrench />} label="Active Repairs" value={stats.activeRepairs} /><Kpi icon={<CheckCircle2 />} label="Completed Repairs" value={stats.completedRepairs} /><Kpi icon={<Package />} label="Awaiting Parts" value={stats.awaitingParts} /><Kpi icon={<span>$</span>} label="Total Repair Cost" value={Number(stats.totalRepairCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} /></section>
    <section className="repair-filter-panel"><div className="repair-search"><Search size={17} /><input value={filters.search} placeholder="Search repair ID, asset, tag, technician..." onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} /></div><select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><select value={filters.priority} onChange={(event) => { setFilters({ ...filters, priority: event.target.value }); setPage(1); }}><option value="">All priorities</option>{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{statusLabel(priority)}</option>)}</select>{(filters.search || filters.status || filters.priority) && <button className="link-button" onClick={clearFilters}><Filter size={15} /> Clear filters</button>}</section>
    {error && <div className="repair-error" role="alert">{error}<button className="link-button" onClick={load}>Retry</button></div>}
    <section className="repair-table-panel"><div className="repair-table-heading"><div><h2>Repair records</h2><span>{pagination.total} records</span></div></div><div className="repair-table-scroll"><table><thead><tr><th>Repair ID</th><th>Asset</th><th>Problem</th><th>Technician</th><th>Repair date</th><th>Status</th><th>Cost</th><th>Actions</th></tr></thead><tbody>{loading ? [1, 2, 3, 4].map((row) => <tr key={row} className="skeleton-row"><td colSpan="8"><span /></td></tr>) : records.length === 0 ? <tr><td colSpan="8" className="empty-cell"><Wrench size={28} /><strong>{filters.search || filters.status || filters.priority ? 'No repairs match your current filters.' : 'No repair history found.'}</strong><span>{filters.search || filters.status || filters.priority ? 'Clear filters and try again.' : 'Repair records will appear here when ICT assets are sent for repair.'}</span>{(filters.search || filters.status || filters.priority) && <button className="quiet-button" onClick={clearFilters}>Clear filters</button>}</td></tr> : records.map((record) => <tr key={record.id}><td><strong>{record.repairId}</strong></td><td><strong>{record.asset?.name || 'Unknown asset'}</strong><small>{record.assetTag || '-'}</small></td><td className="problem-cell">{record.description || record.title}</td><td>{record.technician || 'Unassigned'}</td><td>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '-'}</td><td><span className={`status status-${String(record.status || '').toLowerCase().replace(/ /g, '-')}`}>{statusLabel(record.status)}</span></td><td>{Number(record.repairCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td><button className="icon-button" title="View repair" onClick={() => openDetails(record)}><Eye size={16} /></button><button className="icon-button" title="Edit repair" onClick={() => openEdit(record)}><Wrench size={16} /></button></td></tr>)}</tbody></table></div><div className="repair-pagination"><span>Page {page} of {pagination.totalPages}</span><div><button className="quiet-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="quiet-button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div></section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><article className="repair-modal" onClick={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>{selected.repairId}</h2><span>{selected.asset?.name} · {selected.assetTag || '-'}</span></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18} /></button></div><div className="detail-grid"><Detail label="Problem" value={selected.description || selected.title} /><Detail label="Category" value={selected.asset?.category} /><Detail label="Serial number" value={selected.serialNumber} /><Detail label="Status" value={statusLabel(selected.status)} /><Detail label="Diagnosis" value={selected.diagnosis} /><Detail label="Repair action" value={selected.repairAction} /><Detail label="Parts replaced" value={selected.partsReplaced} /><Detail label="Technician" value={selected.technician} /><Detail label="Repair cost" value={Number(selected.repairCost || 0).toFixed(2)} /><Detail label="Completion date" value={selected.completionDate ? new Date(selected.completionDate).toLocaleDateString() : '-'} /><Detail label="Notes" value={selected.notes} /></div><h3>Repair timeline</h3>{selected.timeline?.length ? selected.timeline.map((event) => <div className="timeline-item" key={event.id}><strong>{statusLabel(event.actionType)}</strong><span>{event.description} · {new Date(event.actionDate).toLocaleString()}</span></div>) : <p className="muted">No timeline events recorded.</p>}<div className="modal-actions"><button className="quiet-button" onClick={() => openEdit(selected)}>Edit repair</button></div></article></div>}
    {formOpen && <div className="modal-backdrop"><form className="repair-modal edit-modal" onSubmit={submit}><div className="modal-title"><h2>{form.id ? 'Edit Repair' : 'Add Repair'}</h2><button type="button" className="icon-button" onClick={() => setFormOpen(false)}><X size={18} /></button></div><label>Asset<select required value={form.asset_id} onChange={(event) => setField('asset_id', event.target.value)}><option value="">Select asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.assetCode}</option>)}</select></label><label>Problem<textarea required value={form.problem} onChange={(event) => setField('problem', event.target.value)} /></label><div className="form-grid"><label>Status<select value={form.status} onChange={(event) => setField('status', event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label>Priority<select value={form.priority} onChange={(event) => setField('priority', event.target.value)}>{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{statusLabel(priority)}</option>)}</select></label><label>Cost<input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setField('cost', event.target.value)} /></label><label>Completion date<input type="date" value={form.completion_date} onChange={(event) => setField('completion_date', event.target.value)} /></label></div><label>Diagnosis<textarea value={form.diagnosis} onChange={(event) => setField('diagnosis', event.target.value)} /></label><label>Repair action<textarea value={form.repair_action} onChange={(event) => setField('repair_action', event.target.value)} /></label><label>Parts replaced<textarea value={form.parts_replaced} onChange={(event) => setField('parts_replaced', event.target.value)} /></label><label>Notes<textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} /></label><div className="modal-actions"><button type="button" className="quiet-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save repair'}</button></div></form></div>}
  </main>;
};

const Kpi = ({ icon, label, value }) => <div className="repair-kpi"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
const Detail = ({ label, value }) => <div><dt>{label}</dt><dd>{value || '-'}</dd></div>;
export default ICTRepairHistory;