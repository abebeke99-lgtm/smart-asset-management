import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Clock3,
  Eye,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import './CollegeAssignments.css';

const emptyData = {
  summary: { total: 0 },
  assignments: [],
  filters: { departments: [], statuses: [], users: [], categories: [], locations: [] },
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value, translate) => (value === null || value === undefined || value === '' ? translate('Not recorded') : value);
const date = (value, translate) => (value ? new Date(value).toLocaleString() : translate('Not recorded'));
const errorMessage = (error, translate) => {
  const message = ({
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not authorized to view college assignments.',
  404: 'The assignment records were not found.',
  }[error.response?.status] || 'Unable to load assignments.');
  return translate(message);
};

const getAssignmentStatusMeta = (status, translate) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['returned', 'closed', 'completed'].includes(normalized)) return { label: translate('Returned'), tone: 'returned', icon: BadgeCheck };
  if (['pending', 'waiting', 'approval', 'awaiting-approval', 'pending-return'].includes(normalized)) return { label: translate('Pending'), tone: 'pending', icon: Clock3 };
  if (['overdue', 'late'].includes(normalized)) return { label: translate('Overdue'), tone: 'overdue', icon: AlertTriangle };
  if (['cancelled', 'canceled', 'rejected'].includes(normalized)) return { label: translate('Cancelled'), tone: 'cancelled', icon: CircleX };
  return { label: translate('Active'), tone: 'active', icon: CheckCircle2 };
};

const AMHARIC_COPY = {
  'Not recorded': 'አልተመዘገበም', 'Your session has expired. Please sign in again.': 'የመግቢያ ጊዜዎ አልቋል። እባክዎ እንደገና ይግቡ።', 'You are not authorized to view college assignments.': 'የኮሌጅ ምደባዎችን ለማየት ፈቃድ የለዎትም።', 'The assignment records were not found.': 'የምደባ መዝገቦች አልተገኙም።', 'Unable to load assignments.': 'ምደባዎችን መጫን አልተቻለም።',
  'Total Assignments': 'ጠቅላላ ምደባዎች', Active: 'ንቁ', Pending: 'በመጠባበቅ ላይ', Returned: 'ተመልሷል', Overdue: 'ጊዜው አልፏል', Cancelled: 'ተሰርዟል',
  'Loading assignments...': 'ምደባዎችን በመጫን ላይ...', Retry: 'እንደገና ሞክር', 'College manager': 'የኮሌጅ አስተዳዳሪ', 'Asset Assignments': 'የንብረት ምደባዎች', 'Review active assignments, track assigned assets, and confirm details within the authorized college scope.': 'በተፈቀደው የኮሌጅ ወሰን ውስጥ ንቁ ምደባዎችን ይገምግሙ፣ የተመደቡ ንብረቶችን ይከታተሉ እና ዝርዝሮችን ያረጋግጡ።', Refresh: 'አድስ',
  'Assignment summary': 'የምደባ ማጠቃለያ', 'Assignment filters': 'የምደባ ማጣሪያዎች', 'Search asset, tag, assignee, serial...': 'ንብረት፣ መለያ፣ ተመዳቢ ወይም ተከታታይ ቁጥር ይፈልጉ...', 'Search assignments': 'ምደባዎችን ይፈልጉ', 'Filter by department': 'በዲፓርትመንት ያጣሩ', 'Filter by assignment status': 'በምደባ ሁኔታ ያጣሩ', 'Filter by assignee': 'በተመዳቢ ያጣሩ', 'All departments': 'ሁሉም ዲፓርትመንቶች', 'All statuses': 'ሁሉም ሁኔታዎች', 'All assignees': 'ሁሉም ተመዳቢዎች', 'All categories': 'ሁሉም ምድቦች', 'All locations': 'ሁሉም ቦታዎች', 'Clear filters': 'ማጣሪያዎችን አጽዳ',
  'No assignments match your filters.': 'ከማጣሪያዎችዎ ጋር የሚዛመድ ምደባ የለም።', 'No assignment records found.': 'ምንም የምደባ መዝገብ አልተገኘም።', 'No assignments match your current filters.': 'ከአሁኑ ማጣሪያዎች ጋር የሚዛመድ ምደባ የለም።', 'No asset assignments found.': 'ምንም የንብረት ምደባ አልተገኘም።',
  'College asset assignments': 'የኮሌጅ ንብረት ምደባዎች', 'Asset ID': 'የንብረት መለያ', Asset: 'ንብረት', 'Assigned To': 'የተመደበለት', Department: 'ዲፓርትመንት', Location: 'ቦታ', Category: 'ምድብ', 'Assignment Date': 'የምደባ ቀን', Status: 'ሁኔታ', Actions: 'እርምጃዎች', 'Not specified': 'አልተገለጸም', Unassigned: 'አልተመደበም', 'No username': 'የተጠቃሚ ስም የለም',
  'Assignment pages': 'የምደባ ገጾች', Previous: 'ቀዳሚ', Next: 'ቀጣይ', Page: 'ገጽ', of: 'ከ', 'View details': 'ዝርዝሩን ይመልከቱ', 'Assignment details': 'የምደባ ዝርዝር መረጃ', 'Asset Tag': 'የንብረት መለያ', 'Serial Number': 'ተከታታይ ቁጥር', 'Expected Return': 'የሚመለስበት ቀን', Created: 'የተፈጠረበት', Updated: 'የተሻሻለበት', Notes: 'ማስታወሻዎች'
};

const CollegeAssignments = () => {
  const { language } = useLanguage();
  const translate = (value) => language === 'am' ? AMHARIC_COPY[value] || value : value;
  const [state, setState] = useState({ ...emptyData, loading: true, tableLoading: false, error: '' });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadAssignments = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/assignments', {
        params: { ...query, page, limit: 20, search: query.search || undefined },
      });
      const payload = response.data?.data || response.data || emptyData;
      setState((previous) => ({ ...previous, ...payload, loading: false, tableLoading: false, error: '' }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: errorMessage(error, translate) }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAssignments(page === 1 && !state.assignments.length && state.loading), 250);
    return () => clearTimeout(timer);
  }, [page, query.search, query.departmentId, query.status, query.assignedTo, query.location, query.category]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const summaryCards = useMemo(() => {
    const assignments = Array.isArray(state.assignments) ? state.assignments : [];
    const total = Number(state.summary?.total || assignments.length || 0);
    const active = Number(state.summary?.active || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status, (value) => value).tone === 'active').length || 0);
    const pending = Number(state.summary?.pending || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status, (value) => value).tone === 'pending').length || 0);
    const returned = Number(state.summary?.returned || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status, (value) => value).tone === 'returned').length || 0);

    return [
      { label: 'Total Assignments', value: total, icon: ClipboardList, tone: 'primary' },
      { label: 'Active', value: active, icon: CheckCircle2, tone: 'success' },
      { label: 'Pending', value: pending, icon: Clock3, tone: 'warning' },
      { label: 'Returned', value: returned, icon: BadgeCheck, tone: 'slate' },
    ];
  }, [state.assignments, state.summary]);

  const updateQuery = (field, value) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setQuery({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' });
  };

  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination || emptyData.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) {
    return (
      <div className="college-assignments-page">
        <div className="college-assignments-state" aria-busy="true">
          <RefreshCw className="college-assignments-spin" size={22} />
          <strong>{translate('Loading assignments...')}</strong>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="college-assignments-page">
        <div className="college-assignments-state college-assignments-error" role="alert">
          <ShieldCheck size={22} />
          <strong>{state.error}</strong>
          <button type="button" onClick={() => loadAssignments(true)}>
            <RefreshCw size={16} /> {translate('Retry')}
          </button>
        </div>
      </div>
    );
  }

  const rows = Array.isArray(state.assignments) ? state.assignments : [];

  return (
    <div className="college-assignments-page">
      <header className="college-assignments-header">
        <div className="college-assignments-title-block">
          <span className="college-assignments-eyebrow">
            <ClipboardList size={14} /> {translate('College manager')}
          </span>
          <h1>{translate('Asset Assignments')}</h1>
          <p>{translate('Review active assignments, track assigned assets, and confirm details within the authorized college scope.')}</p>
        </div>
        <button type="button" className="college-assignments-action-button" onClick={() => loadAssignments()} disabled={state.tableLoading}>
          <RefreshCw size={16} className={state.tableLoading ? 'college-assignments-spin' : ''} />
          {translate('Refresh')}
        </button>
      </header>

      <section className="college-assignments-metrics" aria-label={translate('Assignment summary')}>
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="college-assignments-metric-card">
            <div className={`college-assignments-metric-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <div>
              <span>{translate(label)}</span>
              <strong>{Number(value).toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="college-assignments-toolbar" aria-label={translate('Assignment filters')}>
        <label className="college-assignments-search-field">
          <Search size={16} />
          <input
            type="search"
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            placeholder={translate('Search asset, tag, assignee, serial...')}
            aria-label={translate('Search assignments')}
          />
        </label>

        <label className="college-assignments-select-field">
          <Building2 size={14} />
          <select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)} aria-label={translate('Filter by department')}>
            <option value="">{translate('All departments')}</option>
            {(state.filters?.departments || []).map((department) => (
              <option value={department.id} key={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <Filter size={14} />
          <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)} aria-label={translate('Filter by assignment status')}>
            <option value="">{translate('All statuses')}</option>
            {(state.filters?.statuses || []).map((status) => (
              <option value={status} key={status}>{translate(label(status))}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <UserRound size={14} />
          <select value={query.assignedTo} onChange={(event) => updateQuery('assignedTo', event.target.value)} aria-label={translate('Filter by assignee')}>
            <option value="">{translate('All assignees')}</option>
            {(state.filters?.users || []).map((user) => (
              <option value={user.id} key={user.id}>{user.fullName || user.username}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <Package size={14} />
          <select value={query.category} onChange={(event) => updateQuery('category', event.target.value)} aria-label={language === 'am' ? 'በምድብ ያጣሩ' : 'Filter by category'}>
            <option value="">{translate('All categories')}</option>
            {(state.filters?.categories || []).map((category) => (
              <option value={category} key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <MapPin size={14} />
          <select value={query.location} onChange={(event) => updateQuery('location', event.target.value)} aria-label={language === 'am' ? 'በቦታ ያጣሩ' : 'Filter by location'}>
            <option value="">{translate('All locations')}</option>
            {(state.filters?.locations || []).map((location) => (
              <option value={location} key={location}>{location}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button type="button" className="college-assignments-clear-button" onClick={clearFilters}>
            {translate('Clear filters')}
          </button>
        )}
      </section>

      <section className="college-assignments-table-panel">
        <div className="college-assignments-table-meta">
          <strong>
            {pagination.total
              ? language === 'am' ? `ከ${pagination.total} ምደባዎች ${first}-${last} በማሳየት ላይ` : `Showing ${first}-${last} of ${pagination.total} assignments`
              : hasFilters
                ? translate('No assignments match your filters.')
                : translate('No assignment records found.')}
          </strong>
          {state.tableLoading && <RefreshCw size={15} className="college-assignments-spin" />}
        </div>

        {rows.length ? (
          <div className="college-assignments-table-wrap">
            <table>
              <caption className="sr-only">{translate('College asset assignments')}</caption>
              <thead>
                <tr>
                  <th>{translate('Asset ID')}</th>
                  <th>{translate('Asset')}</th>
                  <th>{translate('Assigned To')}</th>
                  <th>{translate('Department')}</th>
                  <th>{translate('Location')}</th>
                  <th>{translate('Assignment Date')}</th>
                  <th>{translate('Status')}</th>
                  <th>{translate('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((assignment) => {
                  const assignmentStatus = getAssignmentStatusMeta(assignment.status, translate);
                  const StatusIcon = assignmentStatus.icon;
                  return (
                    <tr key={assignment.id}>
                      <td>
                        <strong>#{assignment.assetId || assignment.id}</strong>
                      </td>
                      <td>
                        <div className="college-assignments-asset-cell">
                          <strong>{display(assignment.asset?.name, translate)}</strong>
                          <small>{display(assignment.asset?.code || assignment.asset?.serialNumber, translate)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="college-assignments-user-cell">
                          <span>{display(assignment.assignee?.name || assignment.assignee?.username || 'Unassigned', translate).slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{display(assignment.assignee?.name || assignment.assignee?.username || 'Unassigned', translate)}</strong>
                            <small>{display(assignment.assignee?.username || 'No username', translate)}</small>
                          </div>
                        </div>
                      </td>
                      <td>{display(assignment.department?.name || assignment.asset?.department || 'Not specified', translate)}</td>
                      <td>{display(assignment.location || 'Not specified', translate)}</td>
                      <td>
                        <div className="college-assignments-date-cell">
                          <CalendarDays size={14} />
                          <span>{date(assignment.assignedDate, translate)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`college-assignments-badge status-${assignmentStatus.tone}`}>
                          <StatusIcon size={12} />
                          {assignmentStatus.label}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="college-assignments-icon-button"
                          onClick={() => setSelected(assignment)}
                          aria-label={`${translate('View details')} #${assignment.id}`}
                          title={translate('View details')}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-assignments-empty">
            <ClipboardList size={30} />
            <strong>{translate(hasFilters ? 'No assignments match your current filters.' : 'No asset assignments found.')}</strong>
            {hasFilters && <button type="button" onClick={clearFilters}>{translate('Clear filters')}</button>}
          </div>
        )}

        <nav className="college-assignments-pagination" aria-label={translate('Assignment pages')}>
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>
            {translate('Previous')}
          </button>
          <span>
            {translate('Page')} {pagination.page} {translate('of')} {Math.max(1, pagination.totalPages || 1)}
          </span>
          <button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>
            {translate('Next')}
          </button>
        </nav>
      </section>

      {selected && (
        <div className="college-assignments-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="college-assignments-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-details-title">
            <div className="college-assignments-modal-head">
              <div>
                <span className="college-assignments-eyebrow">{translate('Assignment details')}</span>
                <h2 id="assignment-details-title">{language === 'am' ? 'ምደባ' : 'Assignment'} #{selected.id}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label={language === 'am' ? 'የምደባ ዝርዝሩን ዝጋ' : 'Close assignment details'}>
                <X size={18} />
              </button>
            </div>

            <div className="college-assignments-details">
              {[
                ['Asset', selected.asset?.name],
                ['Asset Tag', selected.asset?.code],
                ['Serial Number', selected.asset?.serialNumber],
                ['Category', selected.asset?.category],
                ['Assigned To', selected.assignee?.name || selected.assignee?.username],
                ['Department', selected.department?.name || selected.asset?.department],
                ['Location', selected.location],
                ['Assignment Date', date(selected.assignedDate, translate)],
                ['Expected Return', date(selected.expectedReturnDate, translate)],
                ['Status', translate(label(selected.status))],
                ['Created', date(selected.createdAt, translate)],
                ['Updated', date(selected.updatedAt, translate)],
              ].map(([title, value]) => (
                <div key={title} className="college-assignments-detail-item">
                  <span>{translate(title)}</span>
                  <strong>{display(value, translate)}</strong>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="college-assignments-notes">
                <span>{translate('Notes')}</span>
                <p>{selected.notes}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default CollegeAssignments;
