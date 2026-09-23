import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Building2, CalendarDays, Check,
  ClipboardCheck, ClipboardList, Clock, Download, Eye, FileDown, FileText,
  Filter, Loader2, MoreVertical, PackageCheck, PackageOpen, RefreshCw,
  Search, TriangleAlert, UserPlus, Users, X, CircleCheck, CircleX,
  MinusCircle, ThumbsUp,
} from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];
const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified';
const displayUser = (item) => item?.full_name || item?.fullName || item?.name || item?.username || `User #${item?.id || ''}`;
const displayAsset = (item) => item?.name || item?.asset_name || 'Unnamed asset';
const displayTag = (item) => item?.asset_tag || item?.assetCode || item?.asset_code || `AST-${item?.id || ''}`;
const isReturned = (item) => Boolean(item?.returned_at) || String(item?.status).toLowerCase() === 'returned';
const getStatus = (item) => isReturned(item) ? 'returned' : item?.expected_return_date && new Date(item.expected_return_date) < new Date() ? 'overdue' : 'active';
const conditionIcons = { Excellent: CircleCheck, Good: ThumbsUp, Fair: MinusCircle, Poor: TriangleAlert, Damaged: CircleX };

function IconButton({ label, children, onClick }) {
  return <button type="button" className="ia-icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function SearchSelect({ label, required, placeholder, value, options, onChange, describe, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((item) => String(item.id) === String(value));
  const filtered = options.filter((item) => describe(item).toLowerCase().includes(query.toLowerCase()));
  return <div className="ia-field ia-combobox">
    <label>{label}{required ? ' *' : ''}</label>
    <div className={`ia-combobox-control ${error ? 'has-error' : ''}`}>
      <Search size={16} aria-hidden="true" />
      <input aria-label={label} value={open ? query : selected ? describe(selected) : ''} placeholder={placeholder} onFocus={() => { setOpen(true); setQuery(''); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)} />
      {selected && <IconButton label={`Clear ${label}`} onClick={() => { onChange(''); setQuery(''); }}><X size={15} /></IconButton>}
    </div>
    {open && <div className="ia-options" role="listbox">{filtered.length ? filtered.map((item) => <button type="button" role="option" key={item.id} onClick={() => { onChange(String(item.id)); setOpen(false); setQuery(''); }}>{describe(item)}</button>) : <div className="ia-option-empty">No matching options</div>}</div>}
    {error && <span className="ia-error">{error}</span>}
  </div>;
}

function StatusBadge({ status }) {
  const config = { active: ['Active', CircleCheck], returned: ['Returned', Check], overdue: ['Overdue', TriangleAlert] }[status] || ['Pending Return', Clock];
  const StatusIcon = config[1];
  return <span className={`ia-status ${status}`}><StatusIcon size={14} aria-hidden="true" />{config[0]}</span>;
}

const ICTAssignments = () => {
  const { user } = useAuth();
  const canManage = ['admin', 'ict_officer', 'store_manager'].includes(String(user?.role || '').toLowerCase());
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [details, setDetails] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ field: 'assigned_date', direction: 'desc' });
  const [form, setForm] = useState({ asset: '', assignedTo: '', department: '', assignmentDate: today(), expectedReturn: '', condition: 'Good', remarks: '' });
  const [errors, setErrors] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [assetsResponse, usersResponse, departmentsResponse, assignmentsResponse] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/users', { params: { limit: 1000 } }),
        axios.get('/api/departments'),
        axios.get('/api/assignments', { params: { page: 1, limit: 500 } }),
      ]);
      setAssets(assetsResponse.data?.assets || assetsResponse.data?.data || []);
      setUsers(usersResponse.data?.users || usersResponse.data?.data || []);
      setDepartments(departmentsResponse.data?.departments || departmentsResponse.data?.data || []);
      setAssignments(assignmentsResponse.data?.assignments || assignmentsResponse.data?.data || []);
    } catch (error) {
      console.error('Failed to load ICT assignments:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeAssetIds = useMemo(() => new Set(assignments.filter((item) => !isReturned(item)).map((item) => String(item.asset_id))), [assignments]);
  const availableAssets = useMemo(() => assets.filter((item) => String(item.status || '').toLowerCase() === 'available' && !activeAssetIds.has(String(item.id))), [assets, activeAssetIds]);
  const rows = useMemo(() => assignments.filter((item) => {
    const haystack = [item.asset_tag, item.asset_name, item.assigned_to_name, item.department_name, getStatus(item)].join(' ').toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (statusFilter === 'all' || getStatus(item) === statusFilter) && (departmentFilter === 'all' || String(item.department_id || item.department_name) === String(departmentFilter));
  }).sort((left, right) => {
    const a = String(left[sort.field] || '').toLowerCase();
    const b = String(right[sort.field] || '').toLowerCase();
    return (a > b ? 1 : a < b ? -1 : 0) * (sort.direction === 'asc' ? 1 : -1);
  }), [assignments, departmentFilter, search, sort, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const validate = () => {
    const next = {};
    if (!form.asset) next.asset = 'Please select an asset.';
    if (!form.assignedTo) next.assignedTo = 'Please select a user.';
    if (!form.assignmentDate) next.assignmentDate = 'Assignment date is required.';
    if (form.expectedReturn && form.expectedReturn < form.assignmentDate) next.expectedReturn = 'Expected return date must be equal to or later than assignment date.';
    if (form.asset && !availableAssets.some((item) => String(item.id) === String(form.asset))) next.asset = 'This asset is no longer available.';
    setErrors(next);
    return !Object.keys(next).length;
  };
  const assign = async (event) => {
    event.preventDefault();
    if (saving || !canManage || !validate()) return;
    const selectedAsset = availableAssets.find((item) => String(item.id) === String(form.asset));
    const selectedUser = users.find((item) => String(item.id) === String(form.assignedTo));
    setSaving(true);
    try {
      await axios.post('/api/assignments', { asset_id: form.asset, assigned_to: form.assignedTo, department_id: form.department || null, assigned_date: form.assignmentDate, expected_return_date: form.expectedReturn || null, condition_at_assignment: form.condition, remarks: form.remarks, assigned_by: user?.id });
      toast.success(`${displayAsset(selectedAsset)} has been assigned to ${displayUser(selectedUser)}.`);
      setForm({ asset: '', assignedTo: '', department: '', assignmentDate: today(), expectedReturn: '', condition: 'Good', remarks: '' });
      setErrors({});
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Assignment could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const confirmReturn = async () => {
    if (!returnTarget || returning) return;
    setReturning(true);
    try {
      await axios.post(`/api/assignments/${returnTarget.id}/return`, { condition_at_return: 'Good', returned_by: user?.id });
      toast.success('Asset returned successfully.');
      setReturnTarget(null);
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to return this asset.');
    } finally {
      setReturning(false);
    }
  };
  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text('ICT Assignment History', 14, 15);
    doc.autoTable({ startY: 24, head: [['Asset', 'Assigned To', 'Department', 'Assignment Date', 'Status']], body: rows.map((item) => [item.asset_name || 'N/A', item.assigned_to_name || 'N/A', item.department_name || 'N/A', dateLabel(item.assigned_date), getStatus(item)]) });
    doc.save(`ICT_Assignments_${today()}.pdf`);
  };
  const toggleSort = (field) => setSort((current) => ({ field, direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc' }));
  const SortButton = ({ field, children }) => <button type="button" className="ia-sort" onClick={() => toggleSort(field)}>{children}{sort.field === field ? sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : <ArrowUpDown size={14} />}</button>;
  const stats = [
    ['Active Assignments', 'Currently assigned assets', assignments.filter((item) => !isReturned(item)).length, ClipboardCheck, 'blue', () => setStatusFilter('active')],
    ['Returned', 'Assets successfully returned', assignments.filter(isReturned).length, PackageCheck, 'green', () => setStatusFilter('returned')],
    ['Available Assets', 'Ready for assignment', availableAssets.length, PackageOpen, 'amber', () => document.getElementById('assignment-form')?.scrollIntoView({ behavior: 'smooth' })],
    ['Total Users', 'Registered system users', users.length, Users, 'slate'],
  ];

  return <div className="ia-page"><style>{styles}</style><main className="ia-container">
    <div className="ia-breadcrumb"><span>Dashboard</span><span>/</span><span>Asset Management</span><span>/</span><strong>Assignments</strong></div>
    <header className="ia-header"><div><div className="ia-title-row"><div className="ia-title-icon"><ClipboardList size={22} /></div><div><h1>Asset Assignments</h1><p>Manage asset assignments, current holders, returns, and assignment history.</p></div></div><div className="ia-updated"><Clock size={14} /> Last updated: {loading ? 'Updating...' : 'just now'}</div></div><div className="ia-header-actions"><button type="button" className="ia-button secondary" onClick={fetchData}><RefreshCw size={16} /> Refresh</button><button type="button" className="ia-button secondary" onClick={() => setShowFilters((value) => !value)}><Filter size={16} /> Filter</button><button type="button" className="ia-button secondary" onClick={exportPdf}><FileDown size={16} /> Export PDF</button></div></header>
    <div className="ia-stats">{stats.map(([label, description, value, Icon, tone, action]) => <button type="button" className="ia-stat-card" key={label} onClick={action} disabled={!action}><div className={`ia-stat-icon ${tone}`}><Icon size={21} /></div><strong>{value}</strong><span>{label}</span><small>{description}</small></button>)}</div>
    <section className="ia-card" id="assignment-form"><div className="ia-section-heading"><div className="ia-section-icon"><UserPlus size={20} /></div><div><h2>Assign New Asset</h2><p>Assign an ICT asset to a user and record its condition.</p></div></div>{!canManage && <div className="ia-permission"><TriangleAlert size={17} /> You have view-only access to assignments.</div>}<form onSubmit={assign} className="ia-form">
      <SearchSelect label="Asset" required placeholder="Search and select an asset..." value={form.asset} options={availableAssets} onChange={(value) => setField('asset', value)} describe={(item) => `${displayAsset(item)} ${displayTag(item)} Available`} error={errors.asset} />
      <SearchSelect label="User" required placeholder="Search users..." value={form.assignedTo} options={users} onChange={(value) => setField('assignedTo', value)} describe={(item) => `${displayUser(item)} ${item.username || ''} ${item.department || ''}`} error={errors.assignedTo} />
      <div className="ia-field"><label htmlFor="department">Department</label><div className="ia-input-with-icon"><Building2 size={16} /><select id="department" value={form.department} onChange={(event) => setField('department', event.target.value)}><option value="">Select department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name || item.department_name}</option>)}</select></div></div>
      <div className="ia-field"><label htmlFor="assignment-date">Assignment Date *</label><div className="ia-input-with-icon"><CalendarDays size={16} /><input id="assignment-date" type="date" value={form.assignmentDate} onChange={(event) => setField('assignmentDate', event.target.value)} /></div>{errors.assignmentDate && <span className="ia-error">{errors.assignmentDate}</span>}</div>
      <div className="ia-field"><label htmlFor="expected-return">Expected Return Date</label><div className="ia-input-with-icon"><CalendarDays size={16} /><input id="expected-return" type="date" min={form.assignmentDate || today()} value={form.expectedReturn} onChange={(event) => setField('expectedReturn', event.target.value)} /></div>{errors.expectedReturn && <span className="ia-error">{errors.expectedReturn}</span>}</div>
      <div className="ia-field"><label htmlFor="condition">Condition</label><div className="ia-input-with-icon"><CircleCheck size={16} /><select id="condition" value={form.condition} onChange={(event) => setField('condition', event.target.value)}>{['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <div className="ia-field ia-full"><label htmlFor="remarks">Remarks</label><textarea id="remarks" maxLength="500" value={form.remarks} onChange={(event) => setField('remarks', event.target.value)} placeholder="Add any relevant notes about this assignment..." /><small className="ia-character-count">{form.remarks.length} / 500</small></div><div className="ia-form-actions"><button type="submit" className="ia-button primary" disabled={saving || !canManage}>{saving ? <><Loader2 size={16} /> Assigning...</> : <><UserPlus size={16} /> Assign Asset</>}</button></div>
    </form></section>
    <section className="ia-card ia-history"><div className="ia-section-heading"><div className="ia-section-icon"><FileText size={20} /></div><div><h2>Assignment History</h2><p>Track active and returned asset assignments.</p></div></div><div className="ia-toolbar"><div className="ia-search"><Search size={17} /><input aria-label="Search assignments" placeholder="Search assignments..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div><button type="button" className="ia-button secondary" onClick={() => setShowFilters((value) => !value)}><Filter size={16} /> Filters</button><button type="button" className="ia-button secondary" onClick={exportPdf}><Download size={16} /> Export</button></div>
      {showFilters && <div className="ia-filters"><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="returned">Returned</option><option value="overdue">Overdue</option></select></label><label>Department<select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name || item.department_name}</option>)}</select></label><button type="button" className="ia-link" onClick={() => { setStatusFilter('all'); setDepartmentFilter('all'); }}>Reset filters</button></div>}
      {loading ? <div className="ia-skeletons">{[1, 2, 3, 4, 5].map((item) => <div className="ia-skeleton" key={item}><i /><i /><i /><i /></div>)}</div> : loadError ? <div className="ia-empty"><TriangleAlert size={32} /><h3>Unable to load assignments</h3><p>We couldn't retrieve assignment data.</p><button type="button" className="ia-button secondary" onClick={fetchData}><RefreshCw size={16} /> Retry</button></div> : !rows.length ? <div className="ia-empty"><ClipboardList size={34} /><h3>{assignments.length ? 'No assignments found' : 'No asset assignments yet'}</h3><p>There are currently no asset assignments matching your selected filters.</p><button type="button" className="ia-button primary" onClick={() => document.getElementById('assignment-form')?.scrollIntoView({ behavior: 'smooth' })}><UserPlus size={16} /> Assign New Asset</button></div> : <><div className="ia-table-wrap"><table><caption className="ia-sr-only">Asset assignment history</caption><thead><tr><th><SortButton field="asset_name">Asset</SortButton></th><th><SortButton field="assigned_to_name">Assigned To</SortButton></th><th><SortButton field="department_name">Department</SortButton></th><th><SortButton field="assigned_date">Assignment Date</SortButton></th><th>Expected Return</th><th>Condition</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pageRows.map((item) => { const state = getStatus(item); const ConditionIcon = conditionIcons[item.condition_at_assignment] || CircleCheck; return <tr key={item.id}><td><div className="ia-asset-cell"><strong>{item.asset_name || 'Unnamed asset'}</strong><small>{item.asset_tag || `AST-${item.asset_id}`}</small></div></td><td><div className="ia-user-cell"><span>{(item.assigned_to_name || 'U').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>{item.assigned_to_name || 'Unknown user'}</strong><small>{item.user_department || item.department_name || 'No department'}</small></div></div></td><td>{item.department_name || 'Not specified'}</td><td>{dateLabel(item.assigned_date)}</td><td>{dateLabel(item.expected_return_date)}</td><td><span className="ia-condition"><ConditionIcon size={15} />{item.condition_at_assignment || item.condition || 'Good'}</span></td><td><StatusBadge status={state} /></td><td><div className="ia-row-actions"><IconButton label="View details" onClick={() => setDetails(item)}><Eye size={17} /></IconButton>{state !== 'returned' && canManage && <IconButton label="Return asset" onClick={() => setReturnTarget(item)}><PackageCheck size={17} /></IconButton>}<IconButton label="More actions" onClick={() => setMenuId(menuId === item.id ? null : item.id)}><MoreVertical size={17} /></IconButton>{menuId === item.id && <div className="ia-menu"><button type="button" onClick={() => setDetails(item)}><Eye size={15} /> View Details</button><button type="button" onClick={() => window.print()}><FileText size={15} /> Print Assignment</button></div>}</div></td></tr>; })}</tbody></table></div><div className="ia-pagination"><span>Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, rows.length)} of {rows.length} assignments</span><div><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}</select><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><strong>{page} / {pageCount}</strong><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></>}
    </section>
  </main>
  {details && <div className="ia-modal-backdrop" onClick={() => setDetails(null)}><section className="ia-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" onClick={(event) => event.stopPropagation()}><div className="ia-modal-header"><div><span className="ia-eyebrow">Assignment details</span><h2 id="details-title">{details.asset_name || 'Unnamed asset'}</h2></div><IconButton label="Close details" onClick={() => setDetails(null)}><X size={18} /></IconButton></div><div className="ia-detail-grid">{[['Asset tag', details.asset_tag], ['Assigned to', details.assigned_to_name], ['Department', details.department_name || 'Not specified'], ['Assignment date', dateLabel(details.assigned_date)], ['Expected return', dateLabel(details.expected_return_date)], ['Condition', details.condition_at_assignment || details.condition || 'Good'], ['Status', getStatus(details)], ['Remarks', details.notes || details.remarks || 'No remarks']].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></section></div>}
  {returnTarget && <div className="ia-modal-backdrop" onClick={() => !returning && setReturnTarget(null)}><section className="ia-modal" role="dialog" aria-modal="true" aria-labelledby="return-title" onClick={(event) => event.stopPropagation()}><div className="ia-modal-header"><div><span className="ia-eyebrow">Return asset</span><h2 id="return-title">Confirm return</h2></div><IconButton label="Close confirmation" onClick={() => setReturnTarget(null)}><X size={18} /></IconButton></div><p>Are you sure you want to mark this asset as returned?</p><div className="ia-confirm-detail"><strong>{returnTarget.asset_name}</strong><span>{returnTarget.asset_tag}</span><span>Assigned to {returnTarget.assigned_to_name}</span></div><div className="ia-modal-actions"><button type="button" className="ia-button secondary" onClick={() => setReturnTarget(null)} disabled={returning}>Cancel</button><button type="button" className="ia-button primary" onClick={confirmReturn} disabled={returning}>{returning ? <><Loader2 size={16} /> Returning...</> : <><PackageCheck size={16} /> Confirm Return</>}</button></div></section></div>}
  </div>;
};

const styles = `
*{box-sizing:border-box}.ia-page{min-height:100vh;background:#f8fafc;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ia-container{max-width:1560px;margin:0 auto;padding:28px}.ia-breadcrumb{display:flex;gap:9px;color:#94a3b8;font-size:12px;margin-bottom:22px}.ia-breadcrumb strong{color:#475569}.ia-header{display:flex;justify-content:space-between;gap:20px;margin-bottom:26px}.ia-title-row{display:flex;gap:13px}.ia-title-icon,.ia-section-icon{display:grid;place-items:center;background:#dbeafe;color:#2563eb;border-radius:12px;flex:none}.ia-title-icon{width:44px;height:44px}.ia-header h1{font-size:30px;margin:0;font-weight:750}.ia-header p,.ia-section-heading p{margin:7px 0 0;color:#64748b;font-size:14px}.ia-updated{display:flex;gap:6px;color:#94a3b8;font-size:12px;margin:13px 0 0 57px}.ia-header-actions,.ia-toolbar,.ia-row-actions,.ia-form-actions,.ia-modal-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.ia-button{border:1px solid transparent;border-radius:9px;min-height:40px;padding:0 14px;display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13px;cursor:pointer}.ia-button.primary{background:#2563eb;color:#fff}.ia-button.secondary{background:#fff;border-color:#e2e8f0;color:#334155}.ia-button:disabled{opacity:.55;cursor:not-allowed}.ia-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.ia-stat-card{min-height:153px;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;cursor:pointer}.ia-stat-card:disabled{cursor:default}.ia-stat-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;margin-bottom:17px}.ia-stat-icon.blue{background:#dbeafe;color:#2563eb}.ia-stat-icon.green{background:#dcfce7;color:#16a34a}.ia-stat-icon.amber{background:#fef3c7;color:#d97706}.ia-stat-icon.slate{background:#f1f5f9;color:#475569}.ia-stat-card strong{display:block;font-size:30px}.ia-stat-card span{display:block;margin-top:7px;font-size:14px;font-weight:700}.ia-stat-card small{display:block;color:#64748b;margin-top:5px;font-size:12px}.ia-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:22px}.ia-section-heading{display:flex;gap:12px;margin-bottom:22px}.ia-section-icon{width:38px;height:38px;border-radius:10px}.ia-section-heading h2{font-size:19px;margin:1px 0 0}.ia-permission{display:flex;gap:8px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:11px;margin-bottom:18px;font-size:13px}.ia-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 20px}.ia-field{position:relative}.ia-field label{display:block;color:#334155;font-size:13px;font-weight:700;margin-bottom:7px}.ia-field input,.ia-field select,.ia-field textarea,.ia-search input,.ia-pagination select{width:100%;border:1px solid #cbd5e1;background:#fff;border-radius:9px;color:#0f172a;font:inherit;font-size:14px;min-height:42px;padding:0 12px;outline:none}.ia-field textarea{display:block;padding:11px;min-height:88px;resize:vertical}.ia-input-with-icon,.ia-combobox-control{display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;color:#64748b;min-height:42px}.ia-input-with-icon input,.ia-input-with-icon select{border:0;box-shadow:none;padding:0}.ia-full,.ia-form-actions{grid-column:1/-1}.ia-form-actions{justify-content:flex-end}.ia-error{display:block;color:#dc2626;font-size:12px;margin-top:5px}.ia-combobox{z-index:3}.ia-combobox-control input{border:0;outline:0;min-width:0;flex:1;padding:0;box-shadow:none}.ia-options{position:absolute;left:0;right:0;top:70px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 14px 30px #0f172a1c;padding:5px;max-height:240px;overflow:auto;z-index:5}.ia-options button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:10px;border-radius:7px;color:#334155;cursor:pointer}.ia-option-empty{padding:12px;color:#94a3b8}.ia-toolbar{margin-bottom:16px}.ia-search{height:40px;display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;border-radius:9px;padding:0 12px;color:#64748b;flex:1;min-width:220px}.ia-search input{border:0;min-height:36px;padding:0}.ia-filters{display:flex;align-items:flex-end;gap:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px;margin-bottom:16px}.ia-filters label{font-size:12px;color:#64748b;font-weight:700}.ia-filters select{display:block;margin-top:5px;min-height:38px}.ia-link{background:none;border:0;color:#2563eb;font-weight:700;font-size:12px;padding:8px;cursor:pointer}.ia-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:11px}.ia-table-wrap table{width:100%;min-width:980px;border-collapse:collapse;font-size:13px}.ia-table-wrap th{background:#f8fafc;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;padding:12px 14px}.ia-table-wrap td{padding:14px;border-top:1px solid #eef2f7;color:#475569;vertical-align:middle}.ia-sort{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;padding:0;cursor:pointer}.ia-asset-cell strong,.ia-user-cell strong{display:block;color:#0f172a}.ia-asset-cell small,.ia-user-cell small{display:block;color:#64748b;font-size:11px;margin-top:4px}.ia-user-cell{display:flex;align-items:center;gap:9px;min-width:150px}.ia-user-cell>span{width:30px;height:30px;border-radius:50%;background:#dbeafe;color:#1d4ed8;display:grid;place-items:center;font-size:10px;font-weight:800}.ia-condition{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.ia-status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 9px;font-weight:700;font-size:11px}.ia-status.active{background:#dbeafe;color:#1d4ed8}.ia-status.returned{background:#dcfce7;color:#15803d}.ia-status.overdue{background:#fee2e2;color:#b91c1c}.ia-icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid #e2e8f0;background:#fff;color:#64748b;border-radius:8px;cursor:pointer}.ia-row-actions{position:relative;flex-wrap:nowrap}.ia-menu{position:absolute;right:0;top:38px;width:170px;padding:5px;background:#fff;border:1px solid #e2e8f0;border-radius:9px;box-shadow:0 12px 25px #0f172a1c;z-index:4}.ia-menu button{display:flex;gap:8px;width:100%;background:#fff;border:0;text-align:left;padding:9px;color:#475569;font-size:12px;cursor:pointer}.ia-pagination{display:flex;justify-content:space-between;padding-top:15px;color:#64748b;font-size:12px}.ia-pagination>div{display:flex;align-items:center;gap:7px}.ia-pagination select,.ia-pagination button{min-height:32px;border:1px solid #e2e8f0;background:#fff;border-radius:7px;padding:0 8px}.ia-empty{text-align:center;padding:50px 20px;color:#64748b}.ia-empty h3{margin:12px 0 6px;color:#0f172a}.ia-skeletons{display:grid;gap:8px}.ia-skeleton{height:64px;border-radius:8px;background:#e2e8f0;animation:ia-pulse 1.3s infinite}.ia-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.ia-modal-backdrop{position:fixed;inset:0;background:#0f172a66;display:grid;place-items:center;padding:20px;z-index:20}.ia-modal{width:min(620px,100%);background:#fff;border-radius:15px;padding:24px;box-shadow:0 20px 60px #0f172a33}.ia-modal-header{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:17px;margin-bottom:20px}.ia-modal h2{margin:5px 0;font-size:20px}.ia-eyebrow{color:#2563eb;text-transform:uppercase;font-size:10px;font-weight:800}.ia-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.ia-detail-grid div{display:grid;gap:5px}.ia-detail-grid div:last-child{grid-column:1/-1}.ia-detail-grid small{color:#94a3b8;font-size:11px;text-transform:uppercase}.ia-detail-grid strong{color:#334155;font-size:14px}.ia-confirm-detail{display:grid;gap:5px;padding:15px;background:#f8fafc;border-radius:9px;color:#64748b;margin:18px 0}.ia-confirm-detail strong{color:#0f172a}.ia-modal-actions{justify-content:flex-end}@keyframes ia-pulse{50%{opacity:.55}}@media(max-width:900px){.ia-header{flex-direction:column}.ia-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.ia-container{padding:18px 14px}.ia-header h1{font-size:25px}.ia-header-actions .ia-button{flex:1}.ia-stats,.ia-form{grid-template-columns:1fr}.ia-full,.ia-form-actions{grid-column:auto}.ia-form-actions .ia-button{width:100%}.ia-filters{align-items:stretch;flex-direction:column}.ia-pagination{align-items:flex-start;flex-direction:column}.ia-detail-grid{grid-template-columns:1fr}.ia-detail-grid div:last-child{grid-column:auto}.ia-toolbar{align-items:stretch}.ia-search{width:100%;flex-basis:100%}}
`;

export default ICTAssignments;
