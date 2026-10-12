import React, { useCallback, useEffect, useState } from 'react';
import { Clipboard, Edit3, Eye, Plus, RefreshCw, Search, UserCheck, Users, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/apiClient';
import './CollegeStaff.css';

const pageSize = 10;
const emptySummary = { total: 0, active: 0, inactive: 0, activeAssetAssignments: 0, withAssignedAssets: 0 };
const missing = 'Not available';
const emptyForm = { fullName: '', staffId: '', email: '', phone: '', departmentId: '' };
const amharic = {
  'College management': 'የኮሌጅ አስተዳደር',
  'College Staff': 'የኮሌጅ ሰራተኞች',
  'Staff records within the authorized college, with asset assignments and activity summaries.': 'በተፈቀደው ኮሌጅ ያሉ የሰራተኞች መዝገቦች፣ የንብረት ምደባዎች እና የእንቅስቃሴ ማጠቃለያዎች።',
  'Add Staff': 'ሰራተኛ ጨምር',
  Refresh: 'አድስ',
  'Total Staff': 'ጠቅላላ ሰራተኞች',
  'Active Staff': 'ንቁ ሰራተኞች',
  'Inactive Staff': 'ንቁ ያልሆኑ ሰራተኞች',
  'Active Asset Assignments': 'ንቁ የንብረት ምደባዎች',
  'Staff with Assigned Assets': 'ንብረት የተመደበላቸው ሰራተኞች',
  'Search staff': 'ሰራተኞችን ፈልግ',
  'Search name, Staff ID, email or phone': 'ስም፣ የሰራተኛ መለያ፣ ኢሜይል ወይም ስልክ ፈልግ',
  'Filter by department': 'በዲፓርትመንት አጣራ',
  'All departments': 'ሁሉም ዲፓርትመንቶች',
  'Filter by status': 'በሁኔታ አጣራ',
  'All statuses': 'ሁሉም ሁኔታዎች',
  Active: 'ንቁ',
  Inactive: 'ንቁ ያልሆነ',
  'Sort staff': 'ሰራተኞችን ደርድር',
  'Name A to Z': 'ስም ከA እስከ Z',
  'Name Z to A': 'ስም ከZ እስከ A',
  'Department A to Z': 'ዲፓርትመንት ከA እስከ Z',
  'Newest first': 'አዲሶቹን መጀመሪያ',
  'Oldest first': 'አሮጌዎቹን መጀመሪያ',
  'Loading college staff...': 'የኮሌጅ ሰራተኞችን በመጫን ላይ...',
  'Unable to load college staff.': 'የኮሌጅ ሰራተኞችን መጫን አልተቻለም።',
  Retry: 'እንደገና ሞክር',
  'No staff members found for this college.': 'በዚህ ኮሌጅ ሰራተኛ አልተገኘም።',
  'Try adjusting your search or filters.': 'ፍለጋዎን ወይም ማጣሪያዎችዎን ያስተካክሉ።',
  'Staff ID': 'የሰራተኛ መለያ',
  'Full Name': 'ሙሉ ስም',
  Email: 'ኢሜይል',
  Phone: 'ስልክ',
  Department: 'ዲፓርትመንት',
  'Assigned Assets': 'የተመደቡ ንብረቶች',
  'Created Date': 'የተፈጠረበት ቀን',
  Actions: 'እርምጃዎች',
  View: 'ዝርዝር',
  Edit: 'አርትዕ',
  'Showing page': 'ገጽ በማሳየት ላይ',
  of: 'ከ',
  records: 'መዝገቦች',
  Previous: 'ቀዳሚ',
  Next: 'ቀጣይ',
  'Register Staff': 'ሰራተኛ መዝግብ',
  'Staff accounts are restricted to the staff role.': 'የሰራተኛ መለያዎች በሰራተኛ ሚና ብቻ የተገደቡ ናቸው።',
  Close: 'ዝጋ',
  'Close staff details': 'የሰራተኛ ዝርዝሮችን ዝጋ',
  'Temporary password': 'ጊዜያዊ የይለፍ ቃል',
  Deactivate: 'አቦዝን',
  Activate: 'አንቃ',
  'No available assets match this staff member.': 'ለዚህ ሰራተኛ የሚስማማ ያልተመደበ ንብረት የለም።',
  'Unable to load college departments.': 'የኮሌጅ ዲፓርትመንቶችን መጫን አልተቻለም።',
  'Unable to load available assets.': 'ያሉ ንብረቶችን መጫን አልተቻለም።',
  'Unable to load staff details.': 'የሰራተኛ ዝርዝሮችን መጫን አልተቻለም።',
  'Unable to update staff status.': 'የሰራተኛ ሁኔታን ማዘመን አልተቻለም።',
  'Unable to assign asset.': 'ንብረት መመደብ አልተቻለም።',
  'Unable to return asset.': 'ንብረት መመለስ አልተቻለም።',
  'Asset assigned successfully.': 'ንብረቱ በተሳካ ሁኔታ ተመድቧል።',
  'Asset returned successfully.': 'ንብረቱ በተሳካ ሁኔታ ተመልሷል።',
  'Unable to copy the temporary password.': 'ጊዜያዊ የይለፍ ቃሉን መቅዳት አልተቻለም።',
  'Edit Staff': 'ሰራተኛን አርትዕ',
  'Staff ID / Employee Number': 'የሰራተኛ መለያ / ቁጥር',
  'Email address': 'የኢሜይል አድራሻ',
  'Phone number': 'ስልክ ቁጥር',
  'Select department': 'ዲፓርትመንት ይምረጡ',
  'Saving...': 'በማስቀመጥ ላይ...',
  'Save Staff': 'ሰራተኛን አስቀምጥ',
  Cancel: 'ሰርዝ',
  'Staff account created successfully.': 'የሰራተኛ መለያ በተሳካ ሁኔታ ተፈጥሯል።',
  'Staff details updated successfully.': 'የሰራተኛ ዝርዝሮች ተሻሽለዋል።',
  'Staff status updated successfully.': 'የሰራተኛ ሁኔታ ተሻሽሏል።',
  'Failed to save staff details.': 'የሰራተኛ ዝርዝሮችን ማስቀመጥ አልተቻለም።',
  'Staff Details': 'የሰራተኛ ዝርዝሮች',
  Username: 'የተጠቃሚ ስም',
  Role: 'ሚና',
  Status: 'ሁኔታ',
  'Updated Date': 'የተሻሻለበት ቀን',
  'Asset assignment history': 'የንብረት ምደባ ታሪክ',
  'Activity summary': 'የእንቅስቃሴ ማጠቃለያ',
  'No asset assignment history is available.': 'የንብረት ምደባ ታሪክ የለም።',
  'No staff activity is recorded.': 'የሰራተኛ እንቅስቃሴ አልተመዘገበም።',
  'Assign Asset': 'ንብረት መድብ',
  'Return Asset': 'ንብረት መልስ',
  'Assignment Date': 'የምደባ ቀን',
  'Return Date': 'የመመለሻ ቀን',
  Condition: 'ሁኔታ',
  'Assignment status': 'የምደባ ሁኔታ',
  'Returned': 'ተመልሷል',
  'Choose an available asset': 'ያለ ተጠቃሚ የሆነ ንብረት ይምረጡ',
  'Select asset': 'ንብረት ይምረጡ',
  'Confirm Assign': 'ምደባን አረጋግጥ',
  'The temporary password is shown only once. Share it securely with the staff member.': 'ጊዜያዊ የይለፍ ቃሉ አንድ ጊዜ ብቻ ይታያል። ለሰራተኛው በደህና ያጋሩት።',
  'Copy temporary password': 'ጊዜያዊ የይለፍ ቃል ቅዳ',
  'Temporary password copied.': 'ጊዜያዊ የይለፍ ቃል ተቀድቷል።',
  'Deactivate staff account? This will revoke existing sessions.': 'የሰራተኛውን መለያ ማጥፋት? ይህ ነባር ክፍለ ጊዜዎችን ያቋርጣል።',
  'Activate staff account?': 'የሰራተኛውን መለያ ማንቃት?',
  'Return this asset to inventory?': 'ይህን ንብረት ወደ ክምችት መመለስ?',
  'Not available': 'አይገኝም',
  'Temporary password required': 'ጊዜያዊ የይለፍ ቃል ያስፈልጋል',
};

const CollegeStaff = () => {
  const { language } = useLanguage();
  const auth = useAuth() || {};
  const role = String(auth.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const canManage = role === 'college_manager' && Boolean(auth.hasPermission?.('college.staff.manage'));
  const canAssign = role === 'college_manager' && Boolean(auth.hasPermission?.('college.assignments.manage'));
  const translate = useCallback((text) => language === 'am' ? amharic[text] || text : text, [language]);
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', departmentId: '', status: '', sortBy: 'fullName', sortOrder: 'ASC' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [assignmentOptions, setAssignmentOptions] = useState([]);
  const [assignmentOptionsLoaded, setAssignmentOptionsLoaded] = useState(false);
  const [assignmentAssetId, setAssignmentAssetId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadStaff = useCallback(async (requestedPage = page, requestedQuery = query) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/college/staff', { params: { ...requestedQuery, page: requestedPage, limit: pageSize } });
      const data = response.data?.data;
      if (!Array.isArray(data) || !response.data?.summary || !response.data?.pagination || !response.data?.filters) {
        throw new Error('The server returned invalid staff data.');
      }
      setRows(data);
      setSummary({ ...emptySummary, ...response.data.summary });
      setPagination(response.data.pagination);
      setDepartments(response.data.filters.departments || []);
    } catch (requestError) {
      setError(translate(requestError.response?.data?.message || requestError.message || 'Unable to load college staff.'));
    } finally {
      setLoading(false);
    }
  }, [page, query, translate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(filters);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => { loadStaff(page, query); }, [page, query, loadStaff]);

  const openCreate = async () => {
    setEditing(null);
    setForm(emptyForm);
    setTemporaryPassword('');
    setFormOpen(true);
    try {
      const response = await api.get('/api/college/staff/options');
      if (!Array.isArray(response.data?.data?.departments)) throw new Error('The server returned invalid staff options.');
      setDepartments(response.data.data.departments);
    } catch (requestError) {
      toast.error(translate(requestError.response?.data?.message || requestError.message || 'Unable to load college departments.'));
    }
  };

  const openEdit = (staff) => {
    setEditing(staff);
    setForm({
      fullName: staff.fullName || '',
      staffId: staff.staffId || staff.username || '',
      email: staff.email || '',
      phone: staff.phone || '',
      departmentId: staff.departmentId ? String(staff.departmentId) : '',
    });
    setTemporaryPassword('');
    setFormOpen(true);
  };

  const saveStaff = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const body = { ...form, departmentId: form.departmentId || null };
      const response = editing
        ? await api.put(`/api/college/staff/${editing.id}`, body)
        : await api.post('/api/college/staff', body);
      if (response.data?.success === false || !response.data?.data?.id) throw new Error(response.data?.message || 'Failed to save staff details.');
      const password = response.data.temporaryPassword || '';
      setFormOpen(false);
      setTemporaryPassword(password);
      toast.success(translate(editing ? 'Staff details updated successfully.' : 'Staff account created successfully.'));
      await loadStaff(page, query);
      if (!editing) {
        setSelected({
          ...response.data.data,
          assignedAssets: [],
          activity: [],
        });
      } else if (selected?.id === editing.id) {
        await openDetails({ id: editing.id });
      }
    } catch (saveError) {
      toast.error(translate(saveError.response?.data?.message || saveError.message || 'Failed to save staff details.'));
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (staff) => {
    setSelected({ ...staff, loadingDetails: true });
    try {
      const response = await api.get(`/api/college/staff/${staff.id}`);
      if (!response.data?.data?.id) throw new Error('The server returned invalid staff details.');
      setSelected(response.data.data);
    } catch (detailError) {
      setSelected(null);
      toast.error(translate(detailError.response?.data?.message || detailError.message || 'Unable to load staff details.'));
    }
  };

  const updateStatus = async (staff) => {
    const activate = !staff.active;
    if (!window.confirm(translate(activate ? 'Activate staff account?' : 'Deactivate staff account? This will revoke existing sessions.'))) return;
    try {
      const response = await api.patch(`/api/college/staff/${staff.id}/status`, { status: activate ? 'active' : 'inactive' });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to update staff status.');
      toast.success(translate('Staff status updated successfully.'));
      await loadStaff(page, query);
      if (selected?.id === staff.id) await openDetails({ id: staff.id });
    } catch (statusError) {
      toast.error(translate(statusError.response?.data?.message || statusError.message || 'Unable to update staff status.'));
    }
  };

  const loadAssignmentOptions = async (staff) => {
    setAssignmentOptions([]);
    setAssignmentOptionsLoaded(false);
    try {
      const response = await api.get(`/api/college/staff/${staff.id}/assignment-options`);
      if (!Array.isArray(response.data?.data)) throw new Error('The server returned invalid asset options.');
      setAssignmentOptions(response.data.data);
      setAssignmentOptionsLoaded(true);
      setAssignmentAssetId('');
    } catch (optionsError) {
      toast.error(translate(optionsError.response?.data?.message || optionsError.message || 'Unable to load available assets.'));
    }
  };

  const assignAsset = async () => {
    if (!selected || !assignmentAssetId || assigning) return;
    setAssigning(true);
    try {
      const response = await api.post(`/api/college/assets/${assignmentAssetId}/custody`, { custodianId: selected.id });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to assign asset.');
      toast.success(translate('Asset assigned successfully.'));
      setAssignmentOptions([]);
      await openDetails({ id: selected.id });
      await loadStaff(page, query);
    } catch (assignmentError) {
      toast.error(translate(assignmentError.response?.data?.message || assignmentError.message || 'Unable to assign asset.'));
    } finally {
      setAssigning(false);
    }
  };

  const returnAsset = async (assignment) => {
    if (!selected || !window.confirm(translate('Return this asset to inventory?'))) return;
    try {
      const response = await api.post(`/api/college/assets/${assignment.asset.id}/custody/${assignment.id}/end`, {});
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to return asset.');
      toast.success(translate('Asset returned successfully.'));
      await openDetails({ id: selected.id });
      await loadStaff(page, query);
    } catch (returnError) {
      toast.error(translate(returnError.response?.data?.message || returnError.message || 'Unable to return asset.'));
    }
  };

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast.success(translate('Temporary password copied.'));
    } catch (copyError) {
      toast.error(translate('Unable to copy the temporary password.'));
    }
  };

  const summaryCards = [
    ['Total Staff', summary.total, Users],
    ['Active Staff', summary.active, UserCheck],
    ['Inactive Staff', summary.inactive, Users],
    ['Active Asset Assignments', summary.activeAssetAssignments, Users],
    ['Staff with Assigned Assets', summary.withAssignedAssets, Users],
  ];

  return (
    <div className="college-staff-page">
      <div className="college-staff-heading">
        <div><span className="college-staff-eyebrow">{translate('College management')}</span><h1>{translate('College Staff')}</h1><p>{translate('Staff records within the authorized college, with asset assignments and activity summaries.')}</p></div>
        <div className="college-staff-heading-actions">
          {canManage && <button type="button" className="college-staff-primary" onClick={openCreate}><Plus size={16} /> {translate('Add Staff')}</button>}
          <button type="button" className="college-staff-refresh" onClick={() => loadStaff(page, query)} disabled={loading}><RefreshCw size={16} className={loading ? 'college-staff-spin' : ''} /> {translate('Refresh')}</button>
        </div>
      </div>
      <div className="college-staff-summary">
        {summaryCards.map(([label, count, Icon]) => <article key={label}><span><Icon size={18} /></span><strong>{Number(count || 0).toLocaleString(language === 'am' ? 'am-ET' : undefined)}</strong><small>{translate(label)}</small></article>)}
      </div>
      <section className="college-staff-card">
        <div className="college-staff-toolbar">
          <label className="college-staff-search"><Search size={17} /><span className="sr-only">{translate('Search staff')}</span><input value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} placeholder={translate('Search name, Staff ID, email or phone')} /></label>
          <select aria-label={translate('Filter by department')} value={filters.departmentId} onChange={(event) => setFilters((previous) => ({ ...previous, departmentId: event.target.value }))}><option value="">{translate('All departments')}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
          <select aria-label={translate('Filter by status')} value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}><option value="">{translate('All statuses')}</option><option value="active">{translate('Active')}</option><option value="inactive">{translate('Inactive')}</option></select>
          <select aria-label={translate('Sort staff')} value={`${filters.sortBy}:${filters.sortOrder}`} onChange={(event) => { const [sortBy, sortOrder] = event.target.value.split(':'); setFilters((previous) => ({ ...previous, sortBy, sortOrder })); }}>
            <option value="fullName:ASC">{translate('Name A to Z')}</option><option value="fullName:DESC">{translate('Name Z to A')}</option><option value="department:ASC">{translate('Department A to Z')}</option><option value="createdAt:DESC">{translate('Newest first')}</option><option value="createdAt:ASC">{translate('Oldest first')}</option>
          </select>
        </div>
        {loading ? <div className="college-staff-state" role="status"><RefreshCw className="college-staff-spin" /> {translate('Loading college staff...')}</div> : error ? <div className="college-staff-state college-staff-error" role="alert"><strong>{translate('Unable to load college staff.')}</strong><span>{error}</span><button type="button" onClick={() => loadStaff(page, query)}>{translate('Retry')}</button></div> : !rows.length ? <div className="college-staff-state"><Users size={26} /><strong>{translate('No staff members found for this college.')}</strong><span>{translate('Try adjusting your search or filters.')}</span>{canManage && <button type="button" className="college-staff-primary" onClick={openCreate}><Plus size={16} /> {translate('Add Staff')}</button>}</div> : (
          <div className="college-staff-table-wrap"><table><thead><tr>{['Staff ID', 'Full Name', 'Email', 'Phone', 'Department', 'Assigned Assets', 'Status', 'Created Date', 'Actions'].map((heading) => <th key={heading}>{translate(heading)}</th>)}</tr></thead><tbody>
            {rows.map((staff) => <tr key={staff.id}>
              <td>{staff.staffId || staff.username}</td><td><strong>{staff.fullName || missing}</strong></td><td>{staff.email || missing}</td><td>{staff.phone || missing}</td><td>{staff.departmentRecord?.name || missing}</td><td>{Number(staff.assignedAssetsCount || 0)}</td><td><span className={`college-staff-status college-staff-status--${staff.active ? 'active' : 'inactive'}`}>{translate(staff.active ? 'Active' : 'Inactive')}</span></td><td>{staff.createdAt ? new Date(staff.createdAt).toLocaleDateString(language === 'am' ? 'am-ET' : undefined) : translate(missing)}</td>
              <td><div className="college-staff-row-actions"><button className="college-staff-view" type="button" onClick={() => openDetails(staff)} aria-label={`${translate('View')}: ${staff.staffId || staff.username}`}><Eye size={15} /> {translate('View')}</button>{canManage && <button className="college-staff-icon" type="button" onClick={() => openEdit(staff)} aria-label={`${translate('Edit')}: ${staff.staffId || staff.username}`}><Edit3 size={15} /></button>}</div></td>
            </tr>)}
          </tbody></table></div>
        )}
        {!loading && !error && pagination.total > 0 && <div className="college-staff-pagination"><span>{translate('Showing page')} {pagination.page || 1} {translate('of')} {Math.max(pagination.pages || pagination.totalPages || 1, 1)} ({pagination.total} {translate('records')})</span><div><button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{translate('Previous')}</button><button type="button" disabled={(pagination.page || 1) >= (pagination.pages || pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>{translate('Next')}</button></div></div>}
      </section>

      {formOpen && <div className="college-staff-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setFormOpen(false)}>
        <section className="college-staff-modal college-staff-form-modal" role="dialog" aria-modal="true" aria-labelledby="college-staff-form-title">
          <div className="college-staff-modal-heading"><div><h2 id="college-staff-form-title">{translate(editing ? 'Edit Staff' : 'Register Staff')}</h2><p>{translate('Staff accounts are restricted to the staff role.')}</p></div><button type="button" aria-label={translate('Close')} onClick={() => setFormOpen(false)} disabled={saving}><X size={19} /></button></div>
          <form className="college-staff-form" onSubmit={saveStaff}>
            <label><span>{translate('Full Name')} *</span><input value={form.fullName} onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))} required maxLength={255} /></label>
            <label><span>{translate('Staff ID / Employee Number')} *</span><input value={form.staffId} onChange={(event) => setForm((previous) => ({ ...previous, staffId: event.target.value }))} required minLength={3} maxLength={100} autoComplete="off" /></label>
            <label><span>{translate('Email address')}</span><input type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} maxLength={255} /></label>
            <label><span>{translate('Phone number')}</span><input type="tel" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} maxLength={50} /></label>
            <label className="college-staff-form-wide"><span>{translate('Department')}</span><select value={form.departmentId} onChange={(event) => setForm((previous) => ({ ...previous, departmentId: event.target.value }))}><option value="">{translate('Select department')}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <div className="college-staff-form-actions"><button type="button" onClick={() => setFormOpen(false)} disabled={saving}>{translate('Cancel')}</button><button type="submit" className="college-staff-primary" disabled={saving}>{saving && <RefreshCw size={15} className="college-staff-spin" />}{translate(saving ? 'Saving...' : editing ? 'Save Staff' : 'Register Staff')}</button></div>
          </form>
        </section>
      </div>}

      {temporaryPassword && <div className="college-staff-modal-backdrop"><section className="college-staff-modal" role="dialog" aria-modal="true" aria-labelledby="temporary-password-title"><div className="college-staff-modal-heading"><div><h2 id="temporary-password-title">{translate('Temporary password')}</h2><p>{translate('The temporary password is shown only once. Share it securely with the staff member.')}</p></div><button type="button" aria-label={translate('Close')} onClick={() => setTemporaryPassword('')}><X size={19} /></button></div><code className="college-staff-temp-password">{temporaryPassword}</code><div className="college-staff-form-actions"><button type="button" className="college-staff-primary" onClick={copyTemporaryPassword}><Clipboard size={15} /> {translate('Copy temporary password')}</button><button type="button" onClick={() => setTemporaryPassword('')}>{translate('Close')}</button></div></section></div>}

      {selected && <div className="college-staff-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
        <section className="college-staff-modal college-staff-detail-modal" role="dialog" aria-modal="true" aria-labelledby="staff-details-title">
          <div className="college-staff-modal-heading"><div><h2 id="staff-details-title">{translate('Staff Details')}</h2><p>{selected.fullName || selected.username}</p></div><button type="button" aria-label={translate('Close staff details')} onClick={() => { setSelected(null); setAssignmentOptions([]); setAssignmentOptionsLoaded(false); }}><X size={19} /></button></div>
          {selected.loadingDetails ? <div className="college-staff-state" role="status"><RefreshCw className="college-staff-spin" /> {translate('Loading college staff...')}</div> : <>
            <dl className="college-staff-detail-grid">{[
              ['Staff ID', selected.staffId || selected.username], ['Full Name', selected.fullName], ['Username', selected.username], ['Email', selected.email], ['Phone', selected.phone], ['Department', selected.departmentRecord?.name || selected.department], ['Role', selected.role], ['Status', translate(selected.active ? 'Active' : 'Inactive')], ['Assigned Assets', Number(selected.assignedAssetsCount || 0)], ['Created Date', selected.createdAt ? new Date(selected.createdAt).toLocaleString() : ''], ['Updated Date', selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : ''],
            ].map(([label, fieldValue]) => <React.Fragment key={label}><dt>{translate(label)}</dt><dd>{fieldValue || translate(missing)}</dd></React.Fragment>)}</dl>
            <div className="college-staff-detail-actions">
              {canManage && <button className="college-staff-view" type="button" onClick={() => { openEdit(selected); setSelected(null); }}><Edit3 size={15} /> {translate('Edit')}</button>}
              {canManage && <button className="college-staff-view" type="button" onClick={() => updateStatus(selected)}>{translate(selected.active ? 'Deactivate' : 'Activate')}</button>}
              {canAssign && selected.active && <button className="college-staff-primary" type="button" onClick={() => loadAssignmentOptions(selected)}><Plus size={15} /> {translate('Assign Asset')}</button>}
            </div>
            {assignmentOptions.length > 0 && <div className="college-staff-assign-form"><label><span>{translate('Choose an available asset')}</span><select aria-label={translate('Choose an available asset')} value={assignmentAssetId} onChange={(event) => setAssignmentAssetId(event.target.value)}><option value="">{translate('Select asset')}</option>{assignmentOptions.map((asset) => <option value={asset.id} key={asset.id}>{asset.assetCode} — {asset.name}</option>)}</select></label><button type="button" className="college-staff-primary" disabled={!assignmentAssetId || assigning} onClick={assignAsset}>{assigning ? translate('Saving...') : translate('Confirm Assign')}</button></div>}
            {assignmentOptionsLoaded && !assignmentOptions.length && <p className="college-staff-muted">{translate('No available assets match this staff member.')}</p>}
            <h3 className="college-staff-section-title">{translate('Asset assignment history')}</h3>
            {selected.assignedAssets?.length ? <div className="college-staff-assignment-list">{selected.assignedAssets.map((assignment) => <article key={assignment.id}><div><strong>{assignment.asset?.assetCode} — {assignment.asset?.name}</strong><span>{translate('Assignment status')}: {translate(assignment.status === 'active' ? 'Active' : 'Returned')}</span><span>{translate('Assignment Date')}: {assignment.assignmentDate ? new Date(assignment.assignmentDate).toLocaleString() : translate(missing)}</span><span>{translate('Return Date')}: {assignment.returnDate ? new Date(assignment.returnDate).toLocaleString() : translate(missing)}</span><span>{translate('Condition')}: {assignment.asset?.condition || translate(missing)}</span></div>{canAssign && assignment.status === 'active' && <button type="button" className="college-staff-view" onClick={() => returnAsset(assignment)}>{translate('Return Asset')}</button>}</article>)}</div> : <p className="college-staff-muted">{translate('No asset assignment history is available.')}</p>}
            <h3 className="college-staff-section-title">{translate('Activity summary')}</h3>
            {selected.activity?.length ? <ul className="college-staff-activity">{selected.activity.map((activity, index) => <li key={`${activity.type}-${activity.createdAt}-${index}`}><strong>{activity.type}</strong><span>{activity.description ? ` · ${activity.description}` : ''} · {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : translate(missing)}</span></li>)}</ul> : <p className="college-staff-muted">{translate('No staff activity is recorded.')}</p>}
          </>}
        </section>
      </div>}
    </div>
  );
};

export default CollegeStaff;
