import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Edit3, Eye, FileText, LoaderCircle, Plus, RefreshCw, Search, Users, X, XCircle } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { useLanguage } from '../../contexts/UiContext';
import './CollegeDepartments.css';

const emptyForm = { department_name: '', department_code: '', description: '', phone: '', email: '' };
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Not available';
const errorMessage = (error, fallback, language) => {
  const english = !error.response ? 'Network error. Check your connection and try again.'
    : error.response.status === 401 ? 'Your session has expired. Please sign in again.'
      : error.response.status === 403 ? 'You are not authorized to manage departments in this college.'
        : error.response.status === 404 ? 'The department could not be found in your college.'
          : error.response.status === 409 ? 'This department already exists.'
            : error.response.data?.message || fallback;
  if (language !== 'am') return english;
  return ({
    'Network error. Check your connection and try again.': 'የኔትወርክ ችግር አለ። ግንኙነትዎን ይፈትሹና እንደገና ይሞክሩ።',
    'Your session has expired. Please sign in again.': 'የመግቢያ ጊዜዎ አልቋል። እባክዎ እንደገና ይግቡ።',
    'You are not authorized to manage departments in this college.': 'በዚህ ኮሌጅ ዲፓርትመንቶችን ለማስተዳደር ፈቃድ የለዎትም።',
    'The department could not be found in your college.': 'ዲፓርትመንቱ በኮሌጅዎ ውስጥ አልተገኘም።',
    'This department already exists.': 'ይህ ዲፓርትመንት አስቀድሞ አለ።',
    'Unable to load departments.': 'ዲፓርትመንቶችን መጫን አልተቻለም።',
    'Unable to save department.': 'ዲፓርትመንቱን ማስቀመጥ አልተቻለም።',
    'Unable to load department details.': 'የዲፓርትመንቱን ዝርዝር መጫን አልተቻለም።',
    'Unable to update department status.': 'የዲፓርትመንቱን ሁኔታ ማዘመን አልተቻለም።'
  })[english] || 'ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።';
};

const CollegeDepartments = () => {
  const { language } = useLanguage();
  const copy = language === 'am' ? {
    title: 'የኮሌጅ ዲፓርትመንቶች', name: 'የዲፓርትመንት ስም', code: 'ኮድ', head: 'ኃላፊ', staff: 'ሰራተኞች', assets: 'ንብረቶች', status: 'ሁኔታ', created: 'የተፈጠረበት ቀን', updated: 'የተሻሻለበት ቀን', active: 'ንቁ', inactive: 'ዝግ', all: 'ሁሉም', search: 'በስም፣ ኮድ ወይም መግለጫ ይፈልጉ', add: 'ዲፓርትመንት ጨምር', save: 'አስቀምጥ', cancel: 'ሰርዝ', loading: 'ዲፓርትመንቶች በመጫን ላይ...', empty: 'ምንም ዲፓርትመንት አልተገኘም', details: 'ዝርዝር መረጃ', confirm: 'የዲፓርትመንቱን ሁኔታ ለመቀየር እርግጠኛ ነዎት?',
    subtitle: 'በኮሌጅዎ ውስጥ ያሉ ዲፓርትመንቶችን ያስተዳድሩ።', total: 'ጠቅላላ ዲፓርትመንቶች', activeTotal: 'ንቁ ዲፓርትመንቶች', inactiveTotal: 'ዝግ ዲፓርትመንቶች', refresh: 'ዲፓርትመንቶችን አድስ', retry: 'እንደገና ሞክር', adjust: 'ፍለጋዎን ወይም ማጣሪያዎን ለማስተካከል ይሞክሩ።',
    actions: 'እርምጃዎች', noCode: 'ኮድ የለም', unassigned: 'አልተመደበም', view: 'ዝርዝሩን ይመልከቱ', edit: 'ዲፓርትመንቱን ያርትዑ', changeStatus: 'ሁኔታን ይቀይሩ', showing: 'ገጽ', of: 'ከ', departments: 'ዲፓርትመንቶች', editTitle: 'ዲፓርትመንቱን ያርትዑ', scope: 'ዲፓርትመንቱ በተፈቀደው ኮሌጅዎ ላይ በራስ-ሰር ይመደባል።',
    email: 'ኢሜይል', phone: 'ስልክ', description: 'መግለጫ', saving: 'በማስቀመጥ ላይ...', detailsTitle: 'የዲፓርትመንት ዝርዝር መረጃ', close: 'ዝርዝሩን ዝጋ', loadingDetails: 'ዝርዝሩን በመጫን ላይ...', notAvailable: 'አይገኝም', departmentHead: 'የዲፓርትመንት ኃላፊ', staffCount: 'የሰራተኞች ብዛት', assetCount: 'የንብረቶች ብዛት', locationId: 'የቦታ መለያ', createdLabel: 'የተፈጠረበት', updatedLabel: 'የተሻሻለበት', noDescription: 'መግለጫ አልተሰጠም።', departmentUpdated: 'ዲፓርትመንቱ በተሳካ ሁኔታ ተዘምኗል።', departmentCreated: 'ዲፓርትመንቱ በተሳካ ሁኔታ ተፈጥሯል።', activated: 'ዲፓርትመንቱ በተሳካ ሁኔታ ነቅቷል።', deactivated: 'ዲፓርትመንቱ በተሳካ ሁኔታ ተዘግቷል።'
  } : {
    title: 'College Departments', name: 'Department Name', code: 'Code', head: 'Head', staff: 'Staff', assets: 'Assets', status: 'Status', created: 'Created', updated: 'Updated', active: 'Active', inactive: 'Inactive', all: 'All statuses', search: 'Search by name, code, or description', add: 'Add Department', save: 'Save Changes', cancel: 'Cancel', loading: 'Loading departments...', empty: 'No departments found', details: 'Department details', confirm: 'Are you sure you want to change this department status?',
    subtitle: 'Manage departments within your college.', total: 'Total Departments', activeTotal: 'Active Departments', inactiveTotal: 'Inactive Departments', refresh: 'Refresh departments', retry: 'Retry', adjust: 'Try adjusting your search or status filter.', actions: 'Actions', noCode: 'No code', unassigned: 'Not assigned', view: 'View details', edit: 'Edit department', changeStatus: 'Change status', showing: 'Showing page', of: 'of', departments: 'departments', editTitle: 'Edit Department', scope: 'The department is automatically assigned to your authorized college.', email: 'Email', phone: 'Phone', description: 'Description', saving: 'Saving...', detailsTitle: 'Department details', close: 'Close details', loadingDetails: 'Loading details...', notAvailable: 'Not available', departmentHead: 'Department head', staffCount: 'Staff count', assetCount: 'Asset count', locationId: 'Location ID', createdLabel: 'Created', updatedLabel: 'Updated', noDescription: 'No description provided.', departmentUpdated: 'Department updated successfully.', departmentCreated: 'Department created successfully.', activated: 'Department activated successfully.', deactivated: 'Department deactivated successfully.'
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
    } catch (loadError) { setDepartments([]); setError(errorMessage(loadError, 'Unable to load departments.', language)); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);
  const resetForm = () => { setForm(emptyForm); setEditingId(null); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      if (editingId) await apiClient.put(`/api/college/departments/${editingId}`, form);
      else await apiClient.post('/api/college/departments', form);
      setNotice(editingId ? copy.departmentUpdated : copy.departmentCreated); resetForm(); await load();
    } catch (saveError) { setError(errorMessage(saveError, 'Unable to save department.', language)); }
    finally { setSaving(false); }
  };
  const edit = (department) => { setForm({ department_name: department.name || '', department_code: department.code || '', description: department.description || '', phone: department.phone || '', email: department.email || '' }); setEditingId(department.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const viewDetails = async (department) => {
    setSelected({ ...department, loading: true });
    try { const response = await apiClient.get(`/api/college/departments/${department.id}`); setSelected(response.data?.data || department); }
    catch (detailsError) { setSelected(null); setError(errorMessage(detailsError, 'Unable to load department details.', language)); }
  };
  const toggleStatus = async (department) => {
    if (!window.confirm(copy.confirm)) return;
    setActionId(department.id); setError('');
    try { const nextStatus = department.status === 'inactive' ? 'active' : 'inactive'; await apiClient.patch(`/api/college/departments/${department.id}/status`, { status: nextStatus }); setNotice(nextStatus === 'active' ? copy.activated : copy.deactivated); await load(); }
    catch (toggleError) { setError(errorMessage(toggleError, 'Unable to update department status.', language)); }
    finally { setActionId(null); }
  };

  const totalPages = pagination.pages || pagination.totalPages || 0;
  return <main className="college-departments-page">
    <header className="departments-header"><div><span className="departments-eyebrow">{language === 'am' ? 'ኮሌጅ / ድርጅት' : 'College / Organization'}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><button className="departments-primary-button" type="button" onClick={() => { resetForm(); setNotice(''); }}><Plus size={17} /> {copy.add}</button></header>
    <section className="departments-stat-grid"><Stat icon={<Building2 size={19} />} label={copy.total} value={summary.total} tone="blue" /><Stat icon={<CheckCircle2 size={19} />} label={copy.activeTotal} value={summary.active} tone="green" /><Stat icon={<XCircle size={19} />} label={copy.inactiveTotal} value={summary.inactive} tone="amber" /></section>
    <section className="departments-panel">
      <div className="departments-toolbar"><label className="departments-search"><Search size={17} /><span className="sr-only">{copy.search}</span><input value={search} placeholder={copy.search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><select aria-label={copy.status} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{copy.all}</option><option value="active">{copy.active}</option><option value="inactive">{copy.inactive}</option></select><button className="departments-icon-button" type="button" title={copy.refresh} aria-label={copy.refresh} onClick={load}><RefreshCw size={17} /></button></div>
      {error && <div className="departments-alert departments-alert-error" role="alert"><XCircle size={17} /> <span>{error}</span><button type="button" onClick={load}>{copy.retry}</button></div>}
      {notice && <div className="departments-alert departments-alert-success" role="status"><CheckCircle2 size={17} /> {notice}</div>}
      {loading ? <State text={copy.loading} loading /> : departments.length === 0 ? <State text={copy.empty} detail={copy.adjust} /> : <div className="departments-table-wrap"><table className="departments-table"><thead><tr><th>{copy.name}</th><th>{copy.head}</th><th>{copy.staff}</th><th>{copy.assets}</th><th>{copy.status}</th><th>{copy.created}</th><th>{copy.updated}</th><th><span className="sr-only">{copy.actions}</span></th></tr></thead><tbody>{departments.map((department) => <tr key={department.id}><td><strong>{department.name}</strong><small>{department.code || copy.noCode}</small></td><td>{department.departmentHead?.fullName || department.departmentHead?.username || copy.unassigned}</td><td><span className="department-count"><Users size={14} /> {department.staffCount ?? 0}</span></td><td>{department.assetCount ?? 0}</td><td><span className={`department-status department-status-${department.status}`}>{department.status === 'active' ? copy.active : copy.inactive}</span></td><td>{formatDate(department.createdAt)}</td><td>{formatDate(department.updatedAt)}</td><td><div className="department-actions"><button type="button" title={copy.view} aria-label={`${copy.view}: ${department.name}`} onClick={() => viewDetails(department)}><Eye size={16} /></button><button type="button" title={copy.edit} aria-label={`${copy.edit}: ${department.name}`} onClick={() => edit(department)}><Edit3 size={16} /></button><button type="button" title={copy.changeStatus} aria-label={`${copy.changeStatus}: ${department.name}`} disabled={actionId === department.id} onClick={() => toggleStatus(department)}>{actionId === department.id ? <LoaderCircle className="departments-spinner" size={16} /> : department.status === 'active' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</button></div></td></tr>)}</tbody></table></div>}
      {totalPages > 1 && <div className="departments-pagination"><span>{copy.showing} {page} {copy.of} {totalPages} ({pagination.total} {copy.departments})</span><div><button type="button" aria-label={language === 'am' ? 'ቀዳሚ ገጽ' : 'Previous page'} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button className={pageNumber === page ? 'is-current' : ''} type="button" key={pageNumber} aria-label={`${language === 'am' ? 'ገጽ' : 'Page'} ${pageNumber}`} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" aria-label={language === 'am' ? 'ቀጣይ ገጽ' : 'Next page'} disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></div>}
    </section>
    <section className="departments-form-panel"><div><h2>{editingId ? copy.editTitle : copy.add}</h2><p>{copy.scope}</p></div><form onSubmit={submit}><div className="departments-form-grid"><label>{copy.name}<input required minLength={2} value={form.department_name} onChange={(event) => setForm({ ...form, department_name: event.target.value })} /></label><label>{copy.code}<input required value={form.department_code} onChange={(event) => setForm({ ...form, department_code: event.target.value })} /></label><label>{copy.email}<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>{copy.phone}<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="departments-form-wide">{copy.description}<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="departments-form-actions"><button className="departments-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="departments-spinner" size={17} /> : <FileText size={17} />}{saving ? copy.saving : editingId ? copy.save : copy.add}</button>{editingId && <button className="departments-secondary-button" type="button" onClick={resetForm}>{copy.cancel}</button>}</div></form></section>
    {selected && <div className="departments-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="departments-modal" role="dialog" aria-modal="true" aria-labelledby="department-details-title"><div className="departments-modal-header"><div><span className="departments-eyebrow">{copy.detailsTitle}</span><h2 id="department-details-title">{selected.name}</h2></div><button type="button" aria-label={copy.close} onClick={() => setSelected(null)}><X size={19} /></button></div>{selected.loading ? <State text={copy.loadingDetails} loading /> : <><div className="departments-detail-grid"><Detail label={copy.code} value={selected.code || copy.notAvailable} /><Detail label={copy.status} value={selected.status === 'active' ? copy.active : copy.inactive} /><Detail label={copy.departmentHead} value={selected.Head?.fullName || selected.Head?.username || selected.departmentHead?.fullName || copy.unassigned} /><Detail label={copy.staffCount} value={selected.staffCount ?? 0} /><Detail label={copy.assetCount} value={selected.assetCount ?? 0} /><Detail label={copy.locationId} value={selected.locationId || copy.unassigned} /><Detail label={copy.createdLabel} value={formatDate(selected.createdAt)} /><Detail label={copy.updatedLabel} value={formatDate(selected.updatedAt)} /></div><div className="departments-detail-description"><span>{copy.description}</span><p>{selected.description || copy.noDescription}</p></div></>}</section></div>}
  </main>;
};

const State = ({ text, detail, loading }) => <div className="departments-state">{loading ? <LoaderCircle className="departments-spinner" size={26} /> : <Building2 size={30} />}<strong>{text}</strong>{detail && <span>{detail}</span>}</div>;
const Stat = ({ icon, label, value, tone }) => <div className="departments-stat-card"><span className={`departments-stat-icon departments-stat-icon-${tone}`}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>;
const Detail = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;

export default CollegeDepartments;