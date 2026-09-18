import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { AlertCircle, CheckCircle2, Eye, Plus, RefreshCw, Search, X } from "lucide-react";

const PAGE_SIZE = 10;
const STATUSES = ["pending", "assigned", "in-progress", "on-hold", "completed", "cancelled"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const EMPTY_FORM = { workOrderNumber: "", maintenanceId: "", assetId: "", technicianId: "", priority: "medium", problemDescription: "", requiredWork: "", expectedCompletionDate: "", estimatedCost: "", notes: "" };

const label = (value) => String(value || "").replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleDateString() : "-";
const money = (value) => value === null || value === undefined || value === "" ? "-" : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InfrastructureWorkOrders() {
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({ assets: [], maintenances: [], technicians: [] });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", status: "", priority: "" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [workOrders, optionResponse] = await Promise.all([
        api.get("/infrastructure/work-orders", { params: { ...filters, page, limit: PAGE_SIZE } }),
        api.get("/infrastructure/work-orders/options"),
      ]);
      setRows(workOrders.data.data || []);
      setPagination(workOrders.data.pagination || { page, pages: 1, total: 0 });
      setOptions(optionResponse.data.data || { assets: [], maintenances: [], technicians: [] });
    } catch (err) { setRows([]); setError(err?.response?.data?.message || "Unable to load infrastructure work orders."); }
    finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const updateFilter = (name, value) => { setFilters((current) => ({ ...current, [name]: value })); setPage(1); };
  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(""); setSelected(null); setShowForm(true); };
  const openEdit = (row) => { setEditing(row); setSelected(null); setForm({ workOrderNumber: row.workOrderNumber || "", maintenanceId: row.maintenanceId || "", assetId: row.assetId || "", technicianId: row.technicianId || "", priority: row.priority || "medium", problemDescription: row.problemDescription || "", requiredWork: row.requiredWork || "", expectedCompletionDate: row.expectedCompletionDate ? String(row.expectedCompletionDate).slice(0, 10) : "", estimatedCost: row.estimatedCost ?? "", notes: row.notes || "" }); setShowForm(true); };
  const closeForm = () => { if (!saving) { setShowForm(false); setEditing(null); } };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, maintenanceId: Number(form.maintenanceId), assetId: Number(form.assetId), technicianId: form.technicianId ? Number(form.technicianId) : null, estimatedCost: form.estimatedCost === "" ? 0 : Number(form.estimatedCost) };
      if (editing) await api.put(`/infrastructure/work-orders/${editing.id}`, payload); else await api.post("/infrastructure/work-orders", payload);
      setSuccess(editing ? "Work order updated." : "Work order created."); closeForm(); await load();
    } catch (err) { setError(err?.response?.data?.message || "Unable to save the work order."); } finally { setSaving(false); }
  };
  const transition = async (row, status) => {
    setError("");
    try { await api.patch(`/infrastructure/work-orders/${row.id}/status`, { status }); setSuccess(`Work order marked ${label(status)}.`); await load(); if (selected?.id === row.id) setSelected(null); }
    catch (err) { setError(err?.response?.data?.message || "Unable to update work-order status."); }
  };
  const setField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const nextActions = (status) => ({ pending: ["assigned", "cancelled"], assigned: ["in-progress", "cancelled"], "in-progress": ["on-hold", "completed", "cancelled"], "on-hold": ["in-progress", "cancelled"] }[status] || []);

  return <main className="infra-work-orders">
    <style>{`.infra-work-orders{padding:24px;min-height:100%;background:#f8fafc;color:#0f172a}.wo-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:22px}.wo-head h1{margin:0;font-size:28px}.wo-head p{color:#64748b;margin:6px 0}.wo-btn{border:1px solid #dbe3ee;background:#fff;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer}.wo-btn.primary{background:#0ea5e9;color:#fff;border-color:#0ea5e9}.wo-btn:disabled{opacity:.55;cursor:not-allowed}.wo-filters,.wo-table,.wo-kpis{background:#fff;border:1px solid #e2e8f0;border-radius:10px}.wo-filters{display:flex;gap:10px;padding:14px;margin-bottom:16px}.wo-input,.wo-select{height:40px;border:1px solid #dbe3ee;border-radius:7px;padding:0 10px;min-width:150px}.wo-search{flex:1;min-width:220px}.wo-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-bottom:16px;overflow:hidden}.wo-kpi{padding:16px;background:#fff}.wo-kpi small{display:block;color:#64748b;text-transform:uppercase;font-size:10px;font-weight:800}.wo-kpi strong{font-size:24px}.wo-scroll{overflow:auto}.wo-table{overflow:hidden}.wo-table table{width:100%;min-width:850px;border-collapse:collapse}.wo-table th,.wo-table td{padding:13px 14px;text-align:left;border-bottom:1px solid #eef2f7;font-size:13px}.wo-table th{background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase}.wo-badge{display:inline-block;border-radius:999px;padding:4px 8px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:800}.wo-badge.completed{background:#ecfdf5;color:#15803d}.wo-badge.cancelled{background:#fef2f2;color:#b91c1c}.wo-badge.high,.wo-badge.critical{background:#fff7ed;color:#c2410c}.wo-actions{display:flex;gap:6px;flex-wrap:wrap}.wo-icon{width:32px;height:32px;display:grid;place-items:center;border:1px solid #dbe3ee;background:#fff;border-radius:7px;cursor:pointer}.wo-empty,.wo-loading{text-align:center;padding:70px 20px;color:#64748b}.wo-pager{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;color:#64748b;font-size:12px}.wo-modal-bg{position:fixed;inset:0;background:#0f172a99;display:grid;place-items:center;padding:18px;z-index:20}.wo-modal{background:#fff;border-radius:10px;width:min(760px,100%);max-height:92vh;overflow:auto}.wo-modal-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e2e8f0}.wo-modal-head h2{margin:0;font-size:18px}.wo-modal-body{padding:20px}.wo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.wo-field{display:grid;gap:5px}.wo-field.full{grid-column:1/-1}.wo-field label{font-size:12px;font-weight:800}.wo-field input,.wo-field select,.wo-field textarea{width:100%;border:1px solid #dbe3ee;border-radius:7px;padding:9px}.wo-field textarea{min-height:80px}.wo-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #e2e8f0}@media(max-width:700px){.infra-work-orders{padding:14px}.wo-head{flex-direction:column}.wo-filters,.wo-kpis{display:grid;grid-template-columns:1fr}.wo-grid{grid-template-columns:1fr}.wo-field.full{grid-column:auto}}`}</style>
    <header className="wo-head"><div><h1>Infrastructure Work Orders</h1><p>Manage real maintenance work orders for infrastructure assets.</p></div><div><button className="wo-btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button> <button className="wo-btn primary" onClick={openCreate}><Plus size={15} /> New Work Order</button></div></header>
    {error && <div role="alert" style={{ color: "#991b1b", background: "#fef2f2", padding: 12, marginBottom: 14, borderRadius: 8 }}><AlertCircle size={16} /> {error}</div>}
    {success && <div role="status" style={{ color: "#166534", background: "#f0fdf4", padding: 12, marginBottom: 14, borderRadius: 8 }}><CheckCircle2 size={16} /> {success}</div>}
    <section className="wo-kpis"><div className="wo-kpi"><small>Total Work Orders</small><strong>{pagination.total}</strong></div><div className="wo-kpi"><small>Current Page</small><strong>{rows.length}</strong></div><div className="wo-kpi"><small>Page</small><strong>{pagination.page} / {pagination.pages}</strong></div></section>
    <section className="wo-filters"><Search size={18} style={{ marginTop: 10, color: "#64748b" }} /><input className="wo-input wo-search" placeholder="Search number, asset, description" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /><select className="wo-select" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select><select className="wo-select" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}><option value="">All priorities</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></section>
    <section className="wo-table">{loading ? <div className="wo-loading"><RefreshCw /> Loading work orders...</div> : rows.length === 0 ? <div className="wo-empty"><h2>No work orders found</h2><p>There are no matching infrastructure work orders in the database.</p></div> : <><div className="wo-scroll"><table><thead><tr><th>Work order</th><th>Asset</th><th>Priority</th><th>Status</th><th>Technician</th><th>Due</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.workOrderNumber}</strong><br /><span style={{ color: "#64748b" }}>{row.title || "Untitled"}</span></td><td>{row.assetName || "-"}<br /><span style={{ color: "#64748b" }}>{row.assetNumber || "-"}</span></td><td><span className={`wo-badge ${row.priority}`}>{label(row.priority)}</span></td><td><span className={`wo-badge ${row.status}`}>{label(row.status)}</span></td><td>{row.technicianName || "-"}</td><td>{date(row.expectedCompletionDate)}</td><td><div className="wo-actions"><button className="wo-icon" aria-label="View work order" title="View" onClick={() => setSelected(row)}><Eye size={15} /></button>{nextActions(row.status).map((status) => <button key={status} className="wo-btn" onClick={() => transition(row, status)}>{label(status)}</button>)}</div></td></tr>)}</tbody></table></div><div className="wo-pager"><span>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span><span><button className="wo-btn" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button> <button className="wo-btn" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></span></div></>}</section>
    {selected && <div className="wo-modal-bg" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><div className="wo-modal"><div className="wo-modal-head"><h2>Work Order Details</h2><button className="wo-icon" aria-label="Close details" onClick={() => setSelected(null)}><X size={16} /></button></div><div className="wo-modal-body"><p><strong>{selected.workOrderNumber}</strong> · {selected.title || "Untitled"}</p><p>{selected.description || "No description recorded."}</p><p>Asset: {selected.assetName || "-"} ({selected.assetNumber || "-"})<br />Location: {selected.location || "-"}<br />Technician: {selected.technicianName || "-"}<br />Status: {label(selected.status)}<br />Priority: {label(selected.priority)}<br />Estimated cost: {money(selected.estimatedCost)}<br />Actual completion: {date(selected.actualCompletionDate)}</p><button className="wo-btn" onClick={() => openEdit(selected)}>Edit details</button></div></div></div>}
    {showForm && <div className="wo-modal-bg"><form className="wo-modal" onSubmit={save}><div className="wo-modal-head"><h2>{editing ? "Edit Work Order" : "Create Work Order"}</h2><button type="button" className="wo-icon" aria-label="Close form" onClick={closeForm}><X size={16} /></button></div><div className="wo-modal-body"><div className="wo-grid"><div className="wo-field"><label>Work order number *</label><input name="workOrderNumber" value={form.workOrderNumber} onChange={setField} required /></div><div className="wo-field"><label>Maintenance record *</label><select name="maintenanceId" value={form.maintenanceId} onChange={setField} required><option value="">Select maintenance</option>{options.maintenances.map((item) => <option key={item.id} value={item.id}>#{item.id} {item.title}</option>)}</select></div><div className="wo-field"><label>Infrastructure asset *</label><select name="assetId" value={form.assetId} onChange={setField} required><option value="">Select asset</option>{options.assets.map((item) => <option key={item.id} value={item.id}>{item.name} {item.assetCode ? `(${item.assetCode})` : ""}</option>)}</select></div><div className="wo-field"><label>Technician</label><select name="technicianId" value={form.technicianId} onChange={setField}><option value="">Unassigned</option>{options.technicians.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.username}</option>)}</select></div><div className="wo-field"><label>Priority</label><select name="priority" value={form.priority} onChange={setField}>{PRIORITIES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div><div className="wo-field"><label>Expected completion</label><input type="date" name="expectedCompletionDate" value={form.expectedCompletionDate} onChange={setField} /></div><div className="wo-field"><label>Estimated cost</label><input type="number" min="0" step="0.01" name="estimatedCost" value={form.estimatedCost} onChange={setField} /></div><div className="wo-field full"><label>Problem description</label><textarea name="problemDescription" value={form.problemDescription} onChange={setField} /></div><div className="wo-field full"><label>Required work</label><textarea name="requiredWork" value={form.requiredWork} onChange={setField} /></div><div className="wo-field full"><label>Notes</label><textarea name="notes" value={form.notes} onChange={setField} /></div></div></div><div className="wo-footer"><button type="button" className="wo-btn" onClick={closeForm} disabled={saving}>Cancel</button><button className="wo-btn primary" disabled={saving}>{saving ? "Saving..." : "Save work order"}</button></div></form></div>}
  </main>;
}
