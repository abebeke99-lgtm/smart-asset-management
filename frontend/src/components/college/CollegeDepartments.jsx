import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Edit3, Eye, FileText, LoaderCircle, Plus, RefreshCw, Search, Users, X, XCircle } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { useLanguage } from '../../contexts/UiContext';
import './CollegeDepartments.css';

const emptyForm = { department_name: '', department_code: '', description: '', phone: '', email: '' };
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Not available';
const errorMessage = (error, fallback) => {
  if (!error.response) return 'Network error. Check your connection and try again.';
  if (error.response.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.response.status === 403) return 'You are not authorized to manage departments in this college.';
  if (error.response.status === 404) return 'The department could not be found in your college.';
  if (error.response.status === 409) return 'This department already exists.';
  return error.response.data?.message || fallback;
};

const CollegeDepartments = () => {
  const { language } = useLanguage();
  const copy = language === 'am' ? {
    title: 'የኮሌጅ ዲፓርትመንቶች', name: 'የዲፓርትመንት ስም', code: 'ኮድ', head: 'ኃላፊ', staff: 'ሰራተኞች', assets: 'ንብረቶች', status: 'ሁኔታ', created: 'የተፈጠረበት ቀን', updated: 'የተሻሻለበት ቀን', active: 'ንቁ', inactive: 'ዝግ', all: 'ሁሉም', search: 'በስም፣ ኮድ ወይም መግለጫ ይፈልጉ', add: 'ዲፓርትመንት ጨምር', save: 'አስቀምጥ', cancel: 'ሰርዝ', loading: 'ዲፓርትመንቶች በመጫን ላይ...', empty: 'ምንም ዲፓርትመንት አልተገኘም', details: 'ዝርዝር መረጃ', confirm: 'የዲፓርትመንቱን ሁኔታ ለመቀየር እርግጠኛ ነዎት?'
  } : {
    title: 'College Departments', name: 'Department Name', code: 'Code', head: 'Head', staff: 'Staff', assets: 'Assets', status: 'Status', created: 'Created', updated: 'Updated', active: 'Active', inactive: 'Inactive', all: 'All statuses', search: 'Search by name, code, or description', add: 'Add Department', save: 'Save Changes', cancel: 'Cancel', loading: 'Loading departments...', empty: 'No departments found', details: 'Department details', confirm: 'Are you sure you want to change this department status?'
  };
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/api/college/departments', { params: { search: search || undefined, status: status || undefined, page, limit: 10 } });
      setDepartments(response.data?.data || []); setSummary(response.data?.summary || { total: 0, active: 0, inactive: 0 }); setPagination(response.data?.pagination || { page, pages: 0, total: 0 });
    } catch (loadError) { setDepartments([]); setError(errorMessage(loadError, 'Unable to load departments.')); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);
  const resetForm = () => { setForm(emptyForm); setEditingId(null); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      if (editingId) await apiClient.put(`/api/college/departments/${editingId}`, form);
      else await apiClient.post('/api/college/departments', form);
      setNotice(editingId ? 'Department updated successfully.' : 'Department created successfully.'); resetForm(); await load();
    } catch (saveError) { setError(errorMessage(saveError, 'Unable to save department.')); }
    finally { setSaving(false); }
  };
  const edit = (department) => { setForm({ department_name: department.name || '', department_code: department.code || '', description: department.description || '', phone: department.phone || '', email: department.email || '' }); setEditingId(department.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const viewDetails = async (department) => {
    setSelected({ ...department, loading: true });
    try { const response = await apiClient.get(`/api/college/departments/${department.id}`); setSelected(response.data?.data || department); }
    catch (detailsError) { setSelected(null); setError(errorMessage(detailsError, 'Unable to load department details.')); }
  };
  const toggleStatus = async (department) => {
    if (!window.confirm(copy.confirm)) return;
    setActionId(department.id); setError('');
    try { const nextStatus = department.status === 'inactive' ? 'active' : 'inactive'; await apiClient.patch(`/api/college/departments/${department.id}/status`, { status: nextStatus }); setNotice(`Department ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully.`); await load(); }
    catch (toggleError) { setError(errorMessage(toggleError, 'Unable to update department status.')); }
    finally { setActionId(null); }
  };

  const totalPages = pagination.pages || pagination.totalPages || 0;
  return <main className="college-departments-page">
    <header className="departments-header"><div><span className="departments-eyebrow">College / Organization</span><h1>{copy.title}</h1><p>Manage departments within your college.</p></div><button className="departments-primary-button" type="button" onClick={() => { resetForm(); setNotice(''); }}><Plus size={17} /> {copy.add}</button></header>
    <section className="departments-stat-grid"><Stat icon={<Building2 size={19} />} label="Total Departments" value={summary.total} tone="blue" /><Stat icon={<CheckCircle2 size={19} />} label="Active Departments" value={summary.active} tone="green" /><Stat icon={<XCircle size={19} />} label="Inactive Departments" value={summary.inactive} tone="amber" /></section>
    <section className="departments-panel">
      <div className="departments-toolbar"><label className="departments-search"><Search size={17} /><span className="sr-only">Search departments</span><input value={search} placeholder={copy.search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><select aria-label={copy.status} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{copy.all}</option><option value="active">{copy.active}</option><option value="inactive">{copy.inactive}</option></select><button className="departments-icon-button" type="button" title="Refresh departments" aria-label="Refresh departments" onClick={load}><RefreshCw size={17} /></button></div>
      {error && <div className="departments-alert departments-alert-error" role="alert"><XCircle size={17} /> <span>{error}</span><button type="button" onClick={load}>Retry</button></div>}
      {notice && <div className="departments-alert departments-alert-success" role="status"><CheckCircle2 size={17} /> {notice}</div>}
      {loading ? <State text={copy.loading} loading /> : departments.length === 0 ? <State text={copy.empty} detail="Try adjusting your search or status filter." /> : <div className="departments-table-wrap"><table className="departments-table"><thead><tr><th>{copy.name}</th><th>{copy.head}</th><th>{copy.staff}</th><th>{copy.assets}</th><th>{copy.status}</th><th>{copy.created}</th><th>{copy.updated}</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{departments.map((department) => <tr key={department.id}><td><strong>{department.name}</strong><small>{department.code || 'No code'}</small></td><td>{department.departmentHead?.fullName || department.departmentHead?.username || 'Not assigned'}</td><td><span className="department-count"><Users size={14} /> {department.staffCount ?? 0}</span></td><td>{department.assetCount ?? 0}</td><td><span className={`department-status department-status-${department.status}`}>{department.status === 'active' ? copy.active : copy.inactive}</span></td><td>{formatDate(department.createdAt)}</td><td>{formatDate(department.updatedAt)}</td><td><div className="department-actions"><button type="button" title="View details" aria-label={`View ${department.name} details`} onClick={() => viewDetails(department)}><Eye size={16} /></button><button type="button" title="Edit department" aria-label={`Edit ${department.name}`} onClick={() => edit(department)}><Edit3 size={16} /></button><button type="button" title="Change status" aria-label={`Change ${department.name} status`} disabled={actionId === department.id} onClick={() => toggleStatus(department)}>{actionId === department.id ? <LoaderCircle className="departments-spinner" size={16} /> : department.status === 'active' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</button></div></td></tr>)}</tbody></table></div>}
      {totalPages > 1 && <div className="departments-pagination"><span>Showing page {page} of {totalPages} ({pagination.total} departments)</span><div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button className={pageNumber === page ? 'is-current' : ''} type="button" key={pageNumber} aria-label={`Page ${pageNumber}`} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></div>}
    </section>
    <section className="departments-form-panel"><div><h2>{editingId ? 'Edit Department' : copy.add}</h2><p>The department is automatically assigned to your authorized college.</p></div><form onSubmit={submit}><div className="departments-form-grid"><label>{copy.name}<input required minLength={2} value={form.department_name} onChange={(event) => setForm({ ...form, department_name: event.target.value })} /></label><label>{copy.code}<input required value={form.department_code} onChange={(event) => setForm({ ...form, department_code: event.target.value })} /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="departments-form-wide">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="departments-form-actions"><button className="departments-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="departments-spinner" size={17} /> : <FileText size={17} />}{editingId ? copy.save : copy.add}</button>{editingId && <button className="departments-secondary-button" type="button" onClick={resetForm}>{copy.cancel}</button>}</div></form></section>
    {selected && <div className="departments-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="departments-modal" role="dialog" aria-modal="true" aria-labelledby="department-details-title"><div className="departments-modal-header"><div><span className="departments-eyebrow">Department details</span><h2 id="department-details-title">{selected.name}</h2></div><button type="button" aria-label="Close details" onClick={() => setSelected(null)}><X size={19} /></button></div>{selected.loading ? <State text="Loading details..." loading /> : <><div className="departments-detail-grid"><Detail label="Code" value={selected.code || 'Not available'} /><Detail label="Status" value={selected.status === 'active' ? 'Active' : 'Inactive'} /><Detail label="Department head" value={selected.Head?.fullName || selected.Head?.username || selected.departmentHead?.fullName || 'Not assigned'} /><Detail label="Staff count" value={selected.staffCount ?? 0} /><Detail label="Asset count" value={selected.assetCount ?? 0} /><Detail label="Location ID" value={selected.locationId || 'Not assigned'} /><Detail label="Created" value={formatDate(selected.createdAt)} /><Detail label="Updated" value={formatDate(selected.updatedAt)} /></div><div className="departments-detail-description"><span>Description</span><p>{selected.description || 'No description provided.'}</p></div></>}</section></div>}
  </main>;
};

const State = ({ text, detail, loading }) => <div className="departments-state">{loading ? <LoaderCircle className="departments-spinner" size={26} /> : <Building2 size={30} />}<strong>{text}</strong>{detail && <span>{detail}</span>}</div>;
const Stat = ({ icon, label, value, tone }) => <div className="departments-stat-card"><span className={`departments-stat-icon departments-stat-icon-${tone}`}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>;
const Detail = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;

export default CollegeDepartments;