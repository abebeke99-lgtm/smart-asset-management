import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, Pencil, Plus, Printer, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createInspection, deleteInspection, getInspection, getInspectionOptions, getInspectionsPage, updateInspection,
} from '../../services/maintenanceApi';
import './MaintAssetInspection.css';

const types = ['Routine Inspection', 'Preventive Inspection', 'Corrective Inspection', 'Safety Inspection', 'Post-Repair Inspection', 'Pre-Use Inspection', 'Other'];
const conditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const statuses = ['Scheduled', 'In Progress', 'Completed', 'Failed', 'Follow-up Required', 'Cancelled'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const blankForm = () => ({ assetId: '', maintenanceId: '', workOrderId: '', inspectionType: '', inspectionDate: new Date().toISOString().slice(0, 10), inspectorId: '', condition: '', safetyStatus: 'Safe', findings: '', defects: '', recommendedAction: '', priority: 'Medium', followUpRequired: false, nextInspectionDate: '', status: 'Scheduled', notes: '' });
const dateValue = (value) => (value ? String(value).slice(0, 10) : '');
const titleCase = (value) => String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const errorMessage = (error) => error?.response?.data?.message || error?.message || 'The request could not be completed. Please try again.';
const inspectionForm = (row) => ({ assetId: String(row.assetId || ''), maintenanceId: String(row.maintenanceId || ''), workOrderId: String(row.workOrderId || ''), inspectionType: row.inspectionType || '', inspectionDate: dateValue(row.inspectionDate), inspectorId: String(row.inspectorId || ''), condition: row.currentCondition || '', safetyStatus: row.safetyCondition || 'Safe', findings: row.observedProblem || '', defects: row.physicalDamage || '', recommendedAction: row.recommendation || '', priority: titleCase(row.priority || 'Medium'), followUpRequired: Boolean(row.followUpRequired), nextInspectionDate: dateValue(row.nextInspection), status: statuses.find((value) => value.toLowerCase().replace(/\s+/g, '-') === String(row.status || '').toLowerCase().replace(/\s+/g, '-')) || 'Scheduled', notes: row.inspectionNotes || '' });
const payloadOf = (form) => ({ ...form, assetId: Number(form.assetId), inspectorId: Number(form.inspectorId), maintenanceId: form.maintenanceId ? Number(form.maintenanceId) : null, workOrderId: form.workOrderId ? Number(form.workOrderId) : null, priority: form.priority.toLowerCase(), status: form.status.toLowerCase().replace(/\s+/g, '-') });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '—';

const MaintenanceInspectionPage = () => {
  const { user } = useAuth();
  const canDelete = String(user?.role || '').toLowerCase() === 'admin';
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', condition: '', priority: '', inspectionType: '', inspectorId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [options, setOptions] = useState({ assets: [], inspectors: [], maintenance: [], workOrders: [] });

  const loadRows = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getInspectionsPage({ page, limit: 10, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
      setRows(result.items); setSummary(result.summary); setPagination(result.pagination);
    } catch (loadError) { setError(errorMessage(loadError)); }
    finally { setLoading(false); }
  }, [filters, page]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => {
    getInspectionOptions().then((data) => setInspectors(data.inspectors || [])).catch((loadError) => setError(errorMessage(loadError)));
  }, []);
  useEffect(() => {
    if (dialog !== 'form') return undefined;
    const timer = setTimeout(() => {
      getInspectionOptions({ search: assetSearch, ...(form.assetId ? { assetId: form.assetId } : {}) })
        .then((data) => { setOptions(data); setInspectors(data.inspectors || []); })
        .catch((loadError) => setFormError(errorMessage(loadError)));
    }, 180);
    return () => clearTimeout(timer);
  }, [assetSearch, dialog, form.assetId]);

  const selectedAsset = useMemo(() => options.assets.find((asset) => Number(asset.id) === Number(form.assetId)), [options.assets, form.assetId]);
  const availableMaintenance = useMemo(() => options.maintenance.filter((item) => !form.assetId || Number(item.assetId) === Number(form.assetId)), [options.maintenance, form.assetId]);
  const availableWorkOrders = useMemo(() => options.workOrders.filter((item) => !form.assetId || Number(item.assetId) === Number(form.assetId)), [options.workOrders, form.assetId]);
  const beginCreate = () => { setForm(blankForm()); setDetail(null); setAssetSearch(''); setFormError(''); setDialog('form'); };
  const beginEdit = async (row) => {
    try {
      setFormError('');
      const result = await getInspection(row.id);
      setForm(inspectionForm(result.inspection)); setDetail(result.inspection); setAssetSearch(''); setDialog('form');
    } catch (loadError) { setError(errorMessage(loadError)); }
  };
  const showDetails = async (row) => {
    setDetail({ loading: true }); setDialog('detail');
    try { const result = await getInspection(row.id); setDetail(result.inspection); setHistory(result.history); }
    catch (loadError) { setDetail({ error: errorMessage(loadError) }); }
  };
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const submitForm = async (event) => {
    event.preventDefault(); setFormError('');
    if (!form.assetId || !form.inspectionDate || !form.inspectionType || !form.inspectorId || !form.condition || !form.status) { setFormError('Asset, date, inspection type, inspector, condition, and status are required.'); return; }
    if (Number.isNaN(Date.parse(`${form.inspectionDate}T00:00:00`)) || (form.nextInspectionDate && Number.isNaN(Date.parse(`${form.nextInspectionDate}T00:00:00`)))) { setFormError('Enter valid inspection dates.'); return; }
    if (form.nextInspectionDate && form.nextInspectionDate < form.inspectionDate) { setFormError('Next inspection date cannot be before the inspection date.'); return; }
    setSaving(true);
    try {
      const payload = payloadOf(form);
      if (detail?.id) await updateInspection(detail.id, payload); else await createInspection(payload);
      setDialog(null); setNotice(detail?.id ? 'Inspection updated.' : 'Inspection recorded.'); await loadRows();
    } catch (saveError) { setFormError(errorMessage(saveError)); }
    finally { setSaving(false); }
  };
  const archiveInspection = async (row) => {
    if (!window.confirm(`Archive inspection ${row.inspectionNumber || `#${row.id}`}? It will be retained in the audit history.`)) return;
    try { await deleteInspection(row.id); setNotice('Inspection archived.'); await loadRows(); }
    catch (deleteError) { setError(errorMessage(deleteError)); }
  };
  const exportRows = () => {
    const columns = ['Inspection No.', 'Asset', 'Asset ID', 'Inspection Type', 'Inspector', 'Inspection Date', 'Condition', 'Priority', 'Status', 'Recommended Action'];
    const data = rows.map((row) => [row.inspectionNumber, row.Asset?.name, row.Asset?.assetCode, row.inspectionType, row.Inspector?.fullName || row.Inspector?.username, dateValue(row.inspectionDate), row.currentCondition, row.priority, titleCase(row.status), row.recommendation]);
    const csv = [columns, ...data].map((line) => line.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'maintenance-inspections.csv'; link.click(); URL.revokeObjectURL(link.href);
  };
  const updateFilter = (name, value) => { setPage(1); setFilters((current) => ({ ...current, [name]: value })); };

  return (
    <main className="inspection-page">
      <header className="inspection-header"><div><p className="inspection-eyebrow">MAINTENANCE OPERATIONS</p><h1>Maintenance Inspection</h1><p>Inspect assets, record findings, and identify maintenance requirements.</p></div><div className="inspection-header-actions">
        <button className="inspection-button inspection-button-secondary" type="button" onClick={exportRows}><Download size={16} />Export</button><button className="inspection-button inspection-button-secondary" type="button" onClick={loadRows}><RefreshCw size={16} />Refresh</button><button className="inspection-button inspection-button-primary" type="button" onClick={beginCreate}><Plus size={17} />New Inspection</button>
      </div></header>
      {notice && <div className="inspection-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
      {error && <div className="inspection-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
      <section className="inspection-summary" aria-label="Inspection summary">{[
        ['Total inspections', summary.total, 'All recorded inspections', 'total'], ['Scheduled', summary.scheduled, 'Awaiting inspection', 'scheduled'], ['Completed', summary.completed, 'Inspection completed', 'completed'], ['Follow-up required', summary.followUp, 'Needs another review', 'followup'], ['Failed / critical', summary.failedCritical, 'Requires attention', 'critical'],
      ].map(([label, value, caption, accent]) => <article className={`inspection-stat inspection-stat-${accent}`} key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong><small>{caption}</small></article>)}</section>
      <section className="inspection-toolbar" aria-label="Search and filters">
        <label className="inspection-search"><Search size={17} /><input aria-label="Search inspections" placeholder="Inspection, asset, serial, inspector, findings" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></label>
        <select aria-label="Filter status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value.toLowerCase().replace(/\s+/g, '-')}>{value}</option>)}</select>
        <select aria-label="Filter condition" value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)}><option value="">All conditions</option>{conditions.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter priority" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}><option value="">All priorities</option>{priorities.map((value) => <option key={value} value={value.toLowerCase()}>{value}</option>)}</select>
        <select aria-label="Filter type" value={filters.inspectionType} onChange={(event) => updateFilter('inspectionType', event.target.value)}><option value="">All types</option>{types.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter inspector" value={filters.inspectorId} onChange={(event) => updateFilter('inspectorId', event.target.value)}><option value="">All inspectors</option>{inspectors.map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.fullName || inspector.username}</option>)}</select>
        <label className="inspection-date-filter"><span>From</span><input aria-label="Filter from date" type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} /></label><label className="inspection-date-filter"><span>To</span><input aria-label="Filter to date" type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} /></label>
      </section>
      <section className="inspection-table-wrap" aria-label="Inspection records"><div className="inspection-table-scroll"><table className="inspection-table"><thead><tr><th>Inspection No.</th><th>Asset</th><th>Asset ID</th><th>Inspection Type</th><th>Inspector</th><th>Inspection Date</th><th>Condition</th><th>Priority</th><th>Status</th><th>Recommended Action</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td className="inspection-empty" colSpan="11">Loading inspections…</td></tr> : rows.length === 0 ? <tr><td className="inspection-empty" colSpan="11">No inspections match the current search and filters.</td></tr> : rows.map((row) => <tr key={row.id}>
          <td className="inspection-number">{row.inspectionNumber || `INS-${String(row.id).padStart(6, '0')}`}</td><td><strong>{row.Asset?.name || 'Unknown asset'}</strong><span className="inspection-cell-sub">{row.Asset?.serialNumber || 'Serial not recorded'}</span></td><td>{row.Asset?.assetCode || '—'}</td><td>{row.inspectionType || '—'}</td><td>{row.Inspector?.fullName || row.Inspector?.username || '—'}</td><td>{dateLabel(row.inspectionDate)}</td><td><span className={`inspection-condition condition-${String(row.currentCondition || '').toLowerCase()}`}>{row.currentCondition || '—'}</span></td><td>{titleCase(row.priority)}</td><td><span className={`inspection-status status-${String(row.status || '').toLowerCase()}`}>{titleCase(row.status)}</span></td><td className="inspection-action-text">{row.recommendation || '—'}</td>
          <td><div className="inspection-row-actions"><button type="button" title="View inspection" aria-label="View inspection" onClick={() => showDetails(row)}><Eye size={16} /></button><button type="button" title="Edit inspection" aria-label="Edit inspection" onClick={() => beginEdit(row)}><Pencil size={15} /></button>{canDelete && <button className="inspection-delete-action" type="button" title="Archive inspection" aria-label="Archive inspection" onClick={() => archiveInspection(row)}><Trash2 size={15} /></button>}</div></td>
        </tr>)}
      </tbody></table></div><footer className="inspection-pagination"><span>{pagination.total || 0} inspections</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page} of {Math.max(1, pagination.pages || 1)}</span><button type="button" disabled={page >= (pagination.pages || 1) || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer></section>

      {dialog === 'form' && <div className="inspection-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="inspection-modal inspection-form-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-form-title">
        <header><div><p className="inspection-eyebrow">RECORD MANAGEMENT</p><h2 id="inspection-form-title">{detail?.id ? 'Edit inspection' : 'New inspection'}</h2></div><button type="button" className="inspection-icon-button" aria-label="Close form" onClick={() => setDialog(null)}><X size={19} /></button></header>
        <form onSubmit={submitForm}>{formError && <div className="inspection-error" role="alert">{formError}</div>}
          <section className="inspection-form-section"><h3>Asset</h3><label className="inspection-field inspection-field-wide"><span>Search assets</span><input type="search" placeholder="Name, asset code, serial number, or location" value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} /></label><label className="inspection-field inspection-field-wide"><span>Asset <b>*</b></span><select required value={form.assetId} onChange={(event) => { setField('assetId', event.target.value); setField('maintenanceId', ''); setField('workOrderId', ''); }}><option value="">Select an asset</option>{options.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.assetCode || `ID ${asset.id}`}{asset.serialNumber ? ` · ${asset.serialNumber}` : ''}</option>)}</select></label>
            {selectedAsset && <div className="inspection-asset-summary"><div><span>Asset code</span><strong>{selectedAsset.assetCode || '—'}</strong></div><div><span>Serial number</span><strong>{selectedAsset.serialNumber || '—'}</strong></div><div><span>Location</span><strong>{selectedAsset.location || '—'}</strong></div><div><span>Current status</span><strong>{titleCase(selectedAsset.status) || '—'}</strong></div></div>}
          </section>
          <section className="inspection-form-section"><h3>Inspection information</h3><div className="inspection-form-grid">
            <label className="inspection-field"><span>Inspection type <b>*</b></span><select required value={form.inspectionType} onChange={(event) => setField('inspectionType', event.target.value)}><option value="">Select type</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label><label className="inspection-field"><span>Inspection date <b>*</b></span><input required type="date" value={form.inspectionDate} onChange={(event) => setField('inspectionDate', event.target.value)} /></label>
            <label className="inspection-field"><span>Inspector <b>*</b></span><select required value={form.inspectorId} onChange={(event) => setField('inspectorId', event.target.value)}><option value="">Select inspector</option>{inspectors.map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.fullName || inspector.username}</option>)}</select></label><label className="inspection-field"><span>Priority</span><select value={form.priority} onChange={(event) => setField('priority', event.target.value)}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="inspection-field"><span>Status <b>*</b></span><select required value={form.status} onChange={(event) => setField('status', event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label className="inspection-field"><span>Maintenance request</span><select value={form.maintenanceId} onChange={(event) => setField('maintenanceId', event.target.value)}><option value="">Not linked</option>{availableMaintenance.map((item) => <option key={item.id} value={item.id}>REQ-{String(item.id).padStart(4, '0')} · {item.title} ({titleCase(item.status)})</option>)}</select></label>
            <label className="inspection-field"><span>Work order</span><select value={form.workOrderId} onChange={(event) => setField('workOrderId', event.target.value)}><option value="">Not linked</option>{availableWorkOrders.map((item) => <option key={item.id} value={item.id}>{item.workOrderNumber} · {titleCase(item.status)}</option>)}</select></label>
          </div></section>
          <section className="inspection-form-section"><h3>Condition and findings</h3><div className="inspection-form-grid">
            <label className="inspection-field"><span>Overall condition <b>*</b></span><select required value={form.condition} onChange={(event) => setField('condition', event.target.value)}><option value="">Select condition</option>{conditions.map((value) => <option key={value}>{value}</option>)}</select></label><label className="inspection-field"><span>Safety status</span><select value={form.safetyStatus} onChange={(event) => setField('safetyStatus', event.target.value)}>{['Safe', 'Unsafe', 'Hazardous'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="inspection-field inspection-field-wide"><span>Inspection findings</span><textarea rows="3" value={form.findings} onChange={(event) => setField('findings', event.target.value)} /></label><label className="inspection-field inspection-field-wide"><span>Defects identified</span><textarea rows="3" value={form.defects} onChange={(event) => setField('defects', event.target.value)} /></label><label className="inspection-field inspection-field-wide"><span>Recommended maintenance action</span><textarea rows="3" value={form.recommendedAction} onChange={(event) => setField('recommendedAction', event.target.value)} /></label>
          </div></section>
          <section className="inspection-form-section"><h3>Follow-up and notes</h3><div className="inspection-form-grid"><label className="inspection-check"><input type="checkbox" checked={form.followUpRequired} onChange={(event) => setField('followUpRequired', event.target.checked)} /><span>Follow-up required</span></label><label className="inspection-field"><span>Next inspection date</span><input type="date" min={form.inspectionDate} value={form.nextInspectionDate} onChange={(event) => setField('nextInspectionDate', event.target.value)} /></label><label className="inspection-field inspection-field-wide"><span>Additional notes</span><textarea rows="3" value={form.notes} onChange={(event) => setField('notes', event.target.value)} /></label></div></section>
          <footer className="inspection-modal-actions"><button type="button" className="inspection-button inspection-button-secondary" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="inspection-button inspection-button-primary" disabled={saving}>{saving ? 'Saving…' : detail?.id ? 'Save changes' : 'Record inspection'}</button></footer>
        </form>
      </section></div>}

      {dialog === 'detail' && <div className="inspection-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="inspection-modal inspection-detail-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-detail-title">
        <header><div><p className="inspection-eyebrow">INSPECTION RECORD</p><h2 id="inspection-detail-title">{detail?.inspectionNumber || 'Inspection details'}</h2></div><button type="button" className="inspection-icon-button" aria-label="Close details" onClick={() => setDialog(null)}><X size={19} /></button></header>
        {detail?.loading ? <p className="inspection-detail-loading">Loading inspection…</p> : detail?.error ? <div className="inspection-error">{detail.error}</div> : detail && <>
          <div className="inspection-detail-overview"><div><span>Asset</span><strong>{detail.Asset?.name || '—'}</strong><small>{detail.Asset?.assetCode || 'No asset code'} · {detail.Asset?.serialNumber || 'No serial number'}</small></div><div><span>Status</span><strong>{titleCase(detail.status)}</strong></div></div>
          <div className="inspection-detail-grid">{[['Type', detail.inspectionType], ['Inspector', detail.Inspector?.fullName || detail.Inspector?.username], ['Inspection date', dateLabel(detail.inspectionDate)], ['Next inspection', dateLabel(detail.nextInspection)], ['Condition', detail.currentCondition], ['Safety', detail.safetyCondition], ['Priority', titleCase(detail.priority)], ['Location', detail.Asset?.location], ['Maintenance request', detail.Maintenance?.title], ['Work order', detail.WorkOrder?.workOrderNumber]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}</div>
          <div className="inspection-detail-copy"><h3>Inspection findings</h3><p>{detail.observedProblem || 'No findings recorded.'}</p><h3>Defects identified</h3><p>{detail.defects || detail.physicalDamage || 'No defects recorded.'}</p><h3>Recommended maintenance action</h3><p>{detail.recommendation || 'No action recommended.'}</p><h3>Additional notes</h3><p>{detail.inspectionNotes || 'No additional notes.'}</p></div>
          <section className="inspection-history"><h3>Record history</h3>{history.length ? history.map((item) => <div key={item.id}><span>{titleCase(item.action.replace('MAINTENANCE_INSPECTION_', ''))}</span><time>{new Date(item.date).toLocaleString()}</time></div>) : <p>No previous changes recorded.</p>}</section>
          <footer className="inspection-modal-actions"><button type="button" className="inspection-button inspection-button-secondary" onClick={() => window.print()}><Printer size={16} />Print</button><button type="button" className="inspection-button inspection-button-secondary" onClick={() => beginEdit(detail)}>Edit inspection</button><button type="button" className="inspection-button inspection-button-primary" onClick={() => setDialog(null)}>Close</button></footer>
        </>}
      </section></div>}
    </main>
  );
};

export default MaintenanceInspectionPage;