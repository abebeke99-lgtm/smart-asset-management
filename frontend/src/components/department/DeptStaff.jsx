import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { Archive, BriefcaseBusiness, Building2, CheckCircle2, ChevronLeft, ChevronRight, Download, Mail, Phone, RefreshCw, Search, UserRound, Users, X, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './DeptStaff.css';

const PAGE_SIZE = 25;
const getStaffName = (member) => member.fullName || member.username || 'Unnamed staff member';
const getStaffStatus = (member) => Boolean(member.active ?? member.is_active);

const DeptStaff = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const loadStaff = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/department/staff', { params: { page, limit: PAGE_SIZE, search: search || undefined, role: filterRole || undefined, status: filterStatus || undefined } });
      const payload = response.data || {};
      setStaff(Array.isArray(payload.data) ? payload.data : []);
      setSummary(payload.summary || { total: payload.pagination?.total || 0, active: 0, inactive: 0 });
      setPagination(payload.pagination || { page, pages: 1, total: 0 });
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Unable to load department staff.');
      setError(message); setStaff([]); toast.error(message);
    } finally { setLoading(false); }
  }, [filterRole, filterStatus, page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => { loadStaff(); }, [loadStaff]);

  const uniqueRoles = useMemo(() => [...new Set(staff.map((member) => member.role).filter(Boolean))].sort(), [staff]);
  const exportToExcel = () => {
    const rows = staff.map((member) => ({ 'Staff ID': member.id, 'Full Name': getStaffName(member), Position: member.role || '', Department: member.department || user?.department || '', Email: member.email || '', Phone: member.phone || '', Status: getStaffStatus(member) ? 'Active' : 'Inactive' }));
    const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Department Staff'); XLSX.writeFile(workbook, 'department-staff.xlsx'); toast.success(t.exportSuccess);
  };
  const clearFilters = () => { setSearchInput(''); setSearch(''); setFilterRole(''); setFilterStatus(''); setPage(1); };

  return <main className={`department-staff-page${isDark ? ' is-dark' : ''}`}>
    <header className="department-staff-header"><div><div className="department-staff-eyebrow"><Building2 size={15} aria-hidden="true" /> {user?.department || t.department}</div><h1><Users size={27} aria-hidden="true" /> {t.staff}</h1><p>{t.subtitle}</p></div><button className="staff-button staff-button-secondary" type="button" onClick={exportToExcel} disabled={loading || staff.length === 0}><Download size={17} aria-hidden="true" /> {t.exportExcel}</button></header>
    <section className="staff-summary-grid" aria-label={t.summary}><SummaryCard icon={Users} label={t.totalStaff} value={summary.total} /><SummaryCard icon={CheckCircle2} label={t.active} value={summary.active} tone="success" /><SummaryCard icon={XCircle} label={t.inactive} value={summary.inactive} tone="muted" /></section>
    <section className="staff-panel"><div className="staff-toolbar"><label className="staff-search"><span className="sr-only">{t.search}</span><Search size={18} aria-hidden="true" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t.searchPlaceholder} /></label><label className="staff-select-label"><span className="sr-only">{t.position}</span><select value={filterRole} onChange={(event) => { setFilterRole(event.target.value); setPage(1); }}><option value="">{t.allPositions}</option>{uniqueRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label className="staff-select-label"><span className="sr-only">{t.status}</span><select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }}><option value="">{t.allStatus}</option><option value="active">{t.active}</option><option value="inactive">{t.inactive}</option></select></label><button className="staff-button staff-button-quiet" type="button" onClick={clearFilters} disabled={!searchInput && !filterRole && !filterStatus}><X size={16} aria-hidden="true" /> {t.clearFilters}</button><button className="staff-icon-button" type="button" onClick={loadStaff} disabled={loading} aria-label={t.refresh} title={t.refresh}><RefreshCw size={17} aria-hidden="true" className={loading ? 'spin' : ''} /></button></div>
      {loading ? <div className="staff-state"><Users size={30} aria-hidden="true" /><p>{t.loading}</p></div> : error ? <div className="staff-state staff-state-error"><XCircle size={30} aria-hidden="true" /><p>{t.error}</p><button className="staff-button staff-button-primary" type="button" onClick={loadStaff}><RefreshCw size={16} aria-hidden="true" /> {t.retry}</button></div> : staff.length === 0 ? <div className="staff-state"><UserRound size={30} aria-hidden="true" /><p>{t.empty}</p></div> : <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>{t.staffId}</th><th>{t.fullName}</th><th>{t.position}</th><th>{t.email}</th><th>{t.phone}</th><th>{t.department}</th><th>{t.status}</th><th><span className="sr-only">{t.actions}</span></th></tr></thead><tbody>{staff.map((member) => <StaffRow key={member.id} member={member} onView={() => setSelectedStaff(member)} t={t} />)}</tbody></table></div>}
      {!loading && !error && pagination.pages > 1 && <div className="staff-pagination"><span>{pagination.total} {t.totalMembers}</span><div><button className="staff-icon-button" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} aria-label={t.previous}><ChevronLeft size={17} /></button><span>{page} / {pagination.pages}</span><button className="staff-icon-button" type="button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages} aria-label={t.next}><ChevronRight size={17} /></button></div></div>}
    </section>{selectedStaff && <StaffDetails member={selectedStaff} onClose={() => setSelectedStaff(null)} t={t} />}</main>;
};

const SummaryCard = ({ icon: Icon, label, value, tone = '' }) => <div className={`staff-summary-card ${tone}`}><div className="staff-summary-icon"><Icon size={19} aria-hidden="true" /></div><div><strong>{value}</strong><span>{label}</span></div></div>;
const StaffRow = ({ member, onView, t }) => { const active = getStaffStatus(member); return <tr><td className="staff-id">{member.id}</td><td><div className="staff-name"><span className="staff-avatar"><UserRound size={16} aria-hidden="true" /></span><strong>{getStaffName(member)}</strong></div><small>{member.username || ''}</small></td><td><span className="staff-with-icon"><BriefcaseBusiness size={15} aria-hidden="true" /> {member.role || '-'}</span></td><td><span className="staff-with-icon"><Mail size={15} aria-hidden="true" /> {member.email || '-'}</span></td><td><span className="staff-with-icon"><Phone size={15} aria-hidden="true" /> {member.phone || '-'}</span></td><td>{member.department || '-'}</td><td><span className={`staff-status ${active ? 'active' : 'inactive'}`}>{active ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {active ? t.active : t.inactive}</span></td><td><button className="staff-view-button" type="button" onClick={onView}><UserRound size={15} aria-hidden="true" /> {t.view}</button></td></tr>; };
const StaffDetails = ({ member, onClose, t }) => <div className="staff-modal-backdrop" role="presentation" onClick={onClose}><section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-details-title" onClick={(event) => event.stopPropagation()}><div className="staff-modal-header"><div><div className="department-staff-eyebrow"><UserRound size={15} aria-hidden="true" /> {t.staffDetails}</div><h2 id="staff-details-title">{getStaffName(member)}</h2></div><button className="staff-icon-button" type="button" onClick={onClose} aria-label={t.close} title={t.close}><X size={18} /></button></div><div className="staff-detail-grid"><DetailItem icon={Archive} label={t.staffId} value={member.id} /><DetailItem icon={BriefcaseBusiness} label={t.position} value={member.role || '-'} /><DetailItem icon={Mail} label={t.email} value={member.email || '-'} /><DetailItem icon={Phone} label={t.phone} value={member.phone || '-'} /><DetailItem icon={Building2} label={t.department} value={member.department || '-'} /><DetailItem icon={getStaffStatus(member) ? CheckCircle2 : XCircle} label={t.status} value={getStaffStatus(member) ? t.active : t.inactive} /></div></section></div>;
const DetailItem = ({ icon: Icon, label, value }) => <div className="staff-detail-item"><span><Icon size={16} aria-hidden="true" /> {label}</span><strong>{value}</strong></div>;
const englishTranslations = { staff: 'Department Staff', subtitle: 'Manage staff members within your department.', department: 'Department', summary: 'Staff summary', totalStaff: 'Total Staff', active: 'Active Staff', inactive: 'Inactive Staff', search: 'Search staff', searchPlaceholder: 'Search by staff ID, name, email, phone, or position', allPositions: 'All Positions', allStatus: 'All Status', clearFilters: 'Clear filters', refresh: 'Refresh staff', loading: 'Loading department staff...', error: 'Unable to load department staff.', retry: 'Retry', empty: 'No staff members found.', staffId: 'Staff ID', fullName: 'Full Name', position: 'Position', email: 'Email', phone: 'Phone', status: 'Status', actions: 'Actions', view: 'View', close: 'Close', staffDetails: 'Staff details', totalMembers: 'staff members', previous: 'Previous page', next: 'Next page', exportExcel: 'Export', exportSuccess: 'Staff exported successfully' };
const amharicTranslations = { ...englishTranslations, staff: 'የክፍል ሰራተኞች', subtitle: 'በክፍልዎ ውስጥ ያሉ ሰራተኞችን ያስተዳድሩ።' };
export default DeptStaff;