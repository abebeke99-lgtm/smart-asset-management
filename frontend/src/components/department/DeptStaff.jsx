import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import {
  Archive,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './DeptStaff.css';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 100;

const getStaffName = (member) => member.fullName || member.username || '';
const getStaffStatus = (member) => {
  const status = String(member.status || '').toLowerCase();
  if (status && status !== 'active') return status;
  return Boolean(member.active ?? member.is_active) ? 'active' : 'inactive';
};
const getStaffPosition = (member) => member.position || member.departmentRole || '';
const getEmployeeId = (member) => member.employeeId || member.employee_id || '';
const getStaffOffice = (member) => member.laboratory || member.office || member.location || '';
const formatRole = (role) => String(role || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const DeptStaff = () => {
  const auth = useAuth();
  const { user } = auth;
  const { language, theme } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const lastRequestKeyRef = useRef('');
  const isDark = theme === 'dark';
  const t = useMemo(() => (language === 'en' ? englishTranslations : amharicTranslations), [language]);
  const canExport = typeof auth.hasPermission === 'function'
    ? auth.hasPermission('reports.export')
    : Array.isArray(user?.permissions) && user.permissions.includes('reports.export');

  const queryParams = useMemo(() => ({
    search: search || undefined,
    position: filterPosition || undefined,
    status: filterStatus || undefined,
  }), [filterPosition, filterStatus, search]);

  const loadStaff = useCallback(async () => {
    const requestKey = JSON.stringify({ ...queryParams, page });
    if (lastRequestKeyRef.current === requestKey) {
      return;
    }
    lastRequestKeyRef.current = requestKey;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/department-head/staff', {
        params: { ...queryParams, page, limit: PAGE_SIZE },
      });
      const payload = response.data || {};
      setStaff(Array.isArray(payload.data) ? payload.data : []);
      setSummary(payload.summary || { total: 0, active: 0, inactive: 0 });
      setPositions(Array.isArray(payload.filters?.positions) ? payload.filters.positions : []);
      setPagination(payload.pagination || { page, pages: 1, total: 0 });
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, t.loadError) || requestError?.message || t.loadError;
      setError(message);
      setStaff([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, queryParams, t.loadError]);

  const retryLoadStaff = useCallback(() => {
    lastRequestKeyRef.current = '';
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const exportStaff = async () => {
    if (!canExport || exporting) return;
    setExporting(true);
    try {
      const firstResponse = await apiClient.get('/department-head/staff', {
        params: { ...queryParams, page: 1, limit: EXPORT_PAGE_SIZE },
      });
      const firstPayload = firstResponse.data || {};
      const allStaff = Array.isArray(firstPayload.data) ? [...firstPayload.data] : [];
      const pages = Math.max(1, Number(firstPayload.pagination?.pages) || 1);

      for (let currentPage = 2; currentPage <= pages; currentPage += 1) {
        const response = await apiClient.get('/department-head/staff', {
          params: { ...queryParams, page: currentPage, limit: EXPORT_PAGE_SIZE },
        });
        const rows = response.data?.data;
        if (!Array.isArray(rows)) throw new Error(t.exportError);
        allStaff.push(...rows);
      }

      const rows = allStaff.map((member) => ({
        [t.staffId]: member.id ?? '',
        [t.fullName]: getStaffName(member),
        [t.employeeId]: getEmployeeId(member),
        [t.position]: getStaffPosition(member) || formatRole(member.role) || t.notProvided,
        [t.email]: member.email || '',
        [t.phone]: member.phone || '',
        [t.role]: formatRole(member.role) || t.notProvided,
        [t.office]: getStaffOffice(member) || t.notProvided,
        [t.status]: t.statusValues[getStaffStatus(member)] || t.statusValues.inactive,
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new() || {};
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Department Staff');
      XLSX.writeFile(workbook, 'department-staff.xlsx');
      toast.success(t.exportSuccess);
    } catch (exportError) {
      const message = getApiErrorMessage(exportError, t.exportError);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setFilterPosition('');
    setFilterStatus('');
    setPage(1);
  };

  const displayValue = (value) => String(value ?? '').trim() || t.notProvided;

  return (
    <main className={`department-staff-page${isDark ? ' is-dark' : ''}`}>
      <header className="department-staff-header">
        <div>
          <div className="department-staff-eyebrow"><Building2 size={15} aria-hidden="true" /> {user?.department || t.department}</div>
          <h1><Users size={27} aria-hidden="true" /> {t.staff}</h1>
          <p>{t.subtitle}</p>
        </div>
        {canExport && (
          <button className="staff-button staff-button-secondary" type="button" onClick={exportStaff} disabled={loading || exporting || summary.total === 0}>
            <Download size={17} aria-hidden="true" /> {exporting ? t.exporting : t.exportExcel}
          </button>
        )}
      </header>

      <section className="staff-summary-grid" aria-label={t.summary}>
        <SummaryCard icon={Users} label={t.totalStaff} value={summary.total} />
        <SummaryCard icon={CheckCircle2} label={t.active} value={summary.active} tone="success" />
        <SummaryCard icon={XCircle} label={t.inactive} value={summary.inactive} tone="muted" />
      </section>

      <section className="staff-panel">
        <div className="staff-toolbar">
          <label className="staff-search">
            <span className="sr-only">{t.search}</span>
            <Search size={18} aria-hidden="true" />
            <input
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSearch(event.target.value.trim());
                setPage(1);
              }}
              placeholder={t.searchPlaceholder}
            />
          </label>
          <label className="staff-select-label">
            <span className="sr-only">{t.position}</span>
            <select value={filterPosition} onChange={(event) => { setFilterPosition(event.target.value); setPage(1); }}>
              <option value="">{t.allPositions}</option>
              {positions.map((position) => <option key={position} value={position}>{formatRole(position)}</option>)}
            </select>
          </label>
          <label className="staff-select-label">
            <span className="sr-only">{t.status}</span>
            <select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }}>
              <option value="">{t.allStatus}</option>
              <option value="active">{t.active}</option>
              <option value="inactive">{t.inactive}</option>
            </select>
          </label>
          <button className="staff-button staff-button-quiet" type="button" onClick={clearFilters} disabled={!searchInput && !filterPosition && !filterStatus}>
            <X size={16} aria-hidden="true" /> {t.clearFilters}
          </button>
          <button className="staff-icon-button" type="button" onClick={retryLoadStaff} disabled={loading} aria-label={t.refresh} title={t.refresh}>
            <RefreshCw size={17} aria-hidden="true" className={loading ? 'spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="staff-state" role="status"><Users size={30} aria-hidden="true" /><p>{t.loading}</p></div>
        ) : error ? (
          <div className="staff-state staff-state-error" role="alert">
            <XCircle size={30} aria-hidden="true" /><p>{error}</p>
            <button className="staff-button staff-button-primary" type="button" onClick={retryLoadStaff}><RefreshCw size={16} aria-hidden="true" /> {t.retry}</button>
          </div>
        ) : staff.length === 0 ? (
          <div className="staff-state"><UserRound size={30} aria-hidden="true" /><p>{t.empty}</p></div>
        ) : (
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead><tr>
                <th>{t.staffId}</th><th>{t.fullName}</th><th>{t.employeeId}</th><th>{t.position}</th>
                <th>{t.email}</th><th>{t.phone}</th><th>{t.role}</th><th>{t.office}</th><th>{t.status}</th>
                <th><span className="sr-only">{t.actions}</span></th>
              </tr></thead>
              <tbody>
                {staff.map((member) => (
                  <StaffRow key={member.id} member={member} displayValue={displayValue} onView={() => setSelectedStaff(member)} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pagination.pages > 1 && (
          <div className="staff-pagination">
            <span>{pagination.total} {t.totalMembers}</span>
            <div>
              <button className="staff-icon-button" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} aria-label={t.previous}><ChevronLeft size={17} /></button>
              <span>{page} / {pagination.pages}</span>
              <button className="staff-icon-button" type="button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages} aria-label={t.next}><ChevronRight size={17} /></button>
            </div>
          </div>
        )}
      </section>
      {selectedStaff && <StaffDetails member={selectedStaff} displayValue={displayValue} onClose={() => setSelectedStaff(null)} t={t} />}
    </main>
  );
};

const SummaryCard = ({ icon: Icon, label, value, tone = '' }) => (
  <div className={`staff-summary-card ${tone}`}>
    <div className="staff-summary-icon"><Icon size={19} aria-hidden="true" /></div>
    <div><strong>{Number(value || 0)}</strong><span>{label}</span></div>
  </div>
);

const StaffRow = ({ member, displayValue, onView, t }) => {
  const status = getStaffStatus(member);
  const statusLabel = t.statusValues[status] || formatRole(status) || t.notProvided;
  return (
    <tr>
      <td className="staff-id">{displayValue(member.id)}</td>
      <td><div className="staff-name"><span className="staff-avatar"><UserRound size={16} aria-hidden="true" /></span><strong>{displayValue(getStaffName(member))}</strong></div></td>
      <td>{displayValue(getEmployeeId(member))}</td>
      <td><span className="staff-with-icon"><BriefcaseBusiness size={15} aria-hidden="true" /> {displayValue(getStaffPosition(member) || formatRole(member.role))}</span></td>
      <td><span className="staff-with-icon"><Mail size={15} aria-hidden="true" /> {displayValue(member.email)}</span></td>
      <td><span className="staff-with-icon"><Phone size={15} aria-hidden="true" /> {displayValue(member.phone)}</span></td>
      <td>{displayValue(formatRole(member.role))}</td>
      <td><span className="staff-with-icon"><MapPin size={15} aria-hidden="true" /> {displayValue(getStaffOffice(member))}</span></td>
      <td><span className={`staff-status ${status === 'active' ? 'active' : 'inactive'}`}>{status === 'active' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {statusLabel}</span></td>
      <td><button className="staff-view-button" type="button" onClick={onView}><UserRound size={15} aria-hidden="true" /> {t.view}</button></td>
    </tr>
  );
};

const StaffDetails = ({ member, displayValue, onClose, t }) => {
  const status = getStaffStatus(member);
  return (
    <div className="staff-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-details-title" onClick={(event) => event.stopPropagation()}>
        <div className="staff-modal-header">
          <div><div className="department-staff-eyebrow"><UserRound size={15} aria-hidden="true" /> {t.staffDetails}</div><h2 id="staff-details-title">{displayValue(getStaffName(member))}</h2></div>
          <button className="staff-icon-button" type="button" onClick={onClose} aria-label={t.close} title={t.close}><X size={18} /></button>
        </div>
        <div className="staff-detail-grid">
          <DetailItem icon={Archive} label={t.staffId} value={displayValue(member.id)} />
          <DetailItem icon={Archive} label={t.employeeId} value={displayValue(getEmployeeId(member))} />
          <DetailItem icon={BriefcaseBusiness} label={t.position} value={displayValue(getStaffPosition(member) || formatRole(member.role))} />
          <DetailItem icon={Mail} label={t.email} value={displayValue(member.email)} />
          <DetailItem icon={Phone} label={t.phone} value={displayValue(member.phone)} />
          <DetailItem icon={UserRound} label={t.role} value={displayValue(formatRole(member.role))} />
          <DetailItem icon={MapPin} label={t.office} value={displayValue(getStaffOffice(member))} />
          <DetailItem icon={status === 'active' ? CheckCircle2 : XCircle} label={t.status} value={t.statusValues[status] || formatRole(status)} />
        </div>
      </section>
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="staff-detail-item"><span><Icon size={16} aria-hidden="true" /> {label}</span><strong>{value}</strong></div>
);

const englishTranslations = {
  staff: 'Department Staff',
  subtitle: 'View staff members assigned to your department.',
  department: 'Department',
  summary: 'Staff summary',
  totalStaff: 'Total Staff',
  active: 'Active Staff',
  inactive: 'Inactive Staff',
  search: 'Search staff',
  searchPlaceholder: 'Search by ID, name, employee ID, email, phone, position, or role',
  allPositions: 'All Positions',
  allStatus: 'All Status',
  clearFilters: 'Clear filters',
  refresh: 'Refresh staff',
  loading: 'Loading department staff...',
  loadError: 'Unable to load department staff.',
  retry: 'Retry',
  empty: 'No staff members found.',
  staffId: 'Staff ID',
  fullName: 'Full Name',
  employeeId: 'Employee ID',
  position: 'Position',
  email: 'Email',
  phone: 'Phone',
  role: 'Role',
  office: 'Laboratory/Office',
  status: 'Status',
  statusValues: { active: 'Active', inactive: 'Inactive', suspended: 'Suspended' },
  notProvided: 'Not provided',
  actions: 'Actions',
  view: 'View',
  close: 'Close',
  staffDetails: 'Staff details',
  totalMembers: 'staff members',
  previous: 'Previous page',
  next: 'Next page',
  exportExcel: 'Export',
  exporting: 'Exporting...',
  exportSuccess: 'Staff exported successfully.',
  exportError: 'Unable to export department staff.',
};

const amharicTranslations = {
  staff: 'የዲፓርትመንት ሰራተኞች',
  subtitle: 'በዲፓርትመንትዎ የተመደቡ ሰራተኞችን ይመልከቱ።',
  department: 'ዲፓርትመንት',
  summary: 'የሰራተኞች ማጠቃለያ',
  totalStaff: 'ጠቅላላ ሰራተኞች',
  active: 'ንቁ ሰራተኞች',
  inactive: 'ንቁ ያልሆኑ ሰራተኞች',
  search: 'ሰራተኞችን ፈልግ',
  searchPlaceholder: 'በመለያ፣ ስም፣ የሰራተኛ መለያ፣ ኢሜይል፣ ስልክ፣ የስራ መደብ ወይም ሚና ፈልግ',
  allPositions: 'ሁሉም የስራ መደቦች',
  allStatus: 'ሁሉም ሁኔታዎች',
  clearFilters: 'ማጣሪያዎችን አጽዳ',
  refresh: 'የሰራተኞችን ዝርዝር አድስ',
  loading: 'የዲፓርትመንት ሰራተኞችን በመጫን ላይ...',
  loadError: 'የዲፓርትመንት ሰራተኞችን መጫን አልተቻለም።',
  retry: 'እንደገና ሞክር',
  empty: 'ምንም ሰራተኛ አልተገኘም።',
  staffId: 'የሰራተኛ መለያ',
  fullName: 'ሙሉ ስም',
  employeeId: 'የሰራተኛ መለያ ቁጥር',
  position: 'የስራ መደብ',
  email: 'ኢሜይል',
  phone: 'ስልክ',
  role: 'ሚና',
  office: 'ላቦራቶሪ/ቢሮ',
  status: 'ሁኔታ',
  statusValues: { active: 'ንቁ', inactive: 'ንቁ ያልሆነ', suspended: 'ታግዷል' },
  notProvided: 'አልተገለጸም',
  actions: 'እርምጃዎች',
  view: 'ይመልከቱ',
  close: 'ዝጋ',
  staffDetails: 'የሰራተኛ ዝርዝር',
  totalMembers: 'ሰራተኞች',
  previous: 'ቀዳሚ ገጽ',
  next: 'ቀጣይ ገጽ',
  exportExcel: 'ወደ ውጭ ላክ',
  exporting: 'በመላክ ላይ...',
  exportSuccess: 'የሰራተኞች መረጃ በተሳካ ሁኔታ ወደ ውጭ ተልኳል።',
  exportError: 'የዲፓርትመንት ሰራተኞችን ወደ ውጭ መላክ አልተቻለም።',
};

export default DeptStaff;
