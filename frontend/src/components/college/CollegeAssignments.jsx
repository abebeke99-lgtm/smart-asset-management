/* eslint-disable react-hooks/exhaustive-deps, jsx-a11y/role-has-required-aria-props */
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
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import './CollegeAssignments.css';

const emptyData = {
  summary: { total: 0 },
  assignments: [],
  filters: { departments: [], statuses: [], users: [], categories: [], locations: [] },
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) => (value === null || value === undefined || value === '' ? 'Not recorded' : value);
const date = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');
const localDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const errorMessage = (error, action = 'load assignments') => ({
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not authorized to view college assignments.',
  404: 'The assignment records were not found.',
}[error.response?.status] || `Unable to ${action}.`);
const assignmentTranslations = {
  'Asset Assignments': 'የንብረት ምደባዎች',
  'College manager': 'የኮሌጅ አስተዳዳሪ',
  'Review active assignments, track assigned assets, and confirm details within the authorized college scope.': 'በተፈቀደው የኮሌጅ ወሰን ውስጥ ንቁ ምደባዎችን ይመልከቱ፣ የተመደቡ ንብረቶችን ይከታተሉ እና ዝርዝሮችን ያረጋግጡ።',
  'Create Assignment': 'ምደባ ፍጠር',
  Refresh: 'አድስ',
  'Total Assignments': 'ጠቅላላ ምደባዎች',
  Active: 'ንቁ',
  Pending: 'በመጠባበቅ ላይ',
  Returned: 'ተመልሷል',
  'Search asset, tag, assignee, serial...': 'ንብረት፣ መለያ፣ ተመዳቢ ወይም ተከታታይ ቁጥር ፈልግ...',
  'Search assignments': 'ምደባዎችን ፈልግ',
  'Filter by department': 'በዲፓርትመንት አጣራ',
  'All departments': 'ሁሉም ዲፓርትመንቶች',
  'Filter by assignment status': 'በምደባ ሁኔታ አጣራ',
  'All statuses': 'ሁሉም ሁኔታዎች',
  'Filter by assignee': 'በተመዳቢ አጣራ',
  'All assignees': 'ሁሉም ተመዳቢዎች',
  'All categories': 'ሁሉም ምድቦች',
  'All locations': 'ሁሉም ቦታዎች',
  'Clear filters': 'ማጣሪያዎችን አጽዳ',
  'No assignments match your filters.': 'ከማጣሪያዎችዎ ጋር የሚስማማ ምደባ የለም።',
  'No assignment records found.': 'የምደባ መዝገብ አልተገኘም።',
  'No assignments match your current filters.': 'ከአሁኑ ማጣሪያዎችዎ ጋር የሚስማማ ምደባ የለም።',
  'No asset assignments found.': 'የንብረት ምደባ አልተገኘም።',
  'Loading assignments...': 'ምደባዎችን በመጫን ላይ...',
  Retry: 'እንደገና ሞክር',
  'Assignment details': 'የምደባ ዝርዝሮች',
  'Asset ID': 'የንብረት መለያ',
  Asset: 'ንብረት',
  'Asset Tag': 'የንብረት መለያ ቁጥር',
  'Assigned To': 'የተመደበለት',
  Department: 'ዲፓርትመንት',
  Location: 'ቦታ',
  'Assignment Date': 'የምደባ ቀን',
  'Expected Return': 'የሚጠበቀው የመመለሻ ቀን',
  Status: 'ሁኔታ',
  Actions: 'እርምጃዎች',
  'View details': 'ዝርዝሮችን ይመልከቱ',
  'Return Asset': 'ንብረት መልስ',
  'Return this assignment and restore its quantity to available inventory?': 'ይህን ምደባ መመለስ እና ብዛቱን ወደ ያለ ክምችት መመለስ?',
  'Asset returned successfully.': 'ንብረቱ በተሳካ ሁኔታ ተመልሷል።',
  'Unable to return assignment.': 'ምደባውን መመለስ አልተቻለም።',
  'Create an asset assignment': 'የንብረት ምደባ ፍጠር',
  'Select an available asset and active staff member in your college.': 'በኮሌጅዎ ውስጥ ያለ ንብረት እና ንቁ ሰራተኛ ይምረጡ።',
  'Asset *': 'ንብረት *',
  'Choose available asset': 'ያለ ንብረት ይምረጡ',
  'Staff member *': 'ሰራተኛ *',
  'Choose active staff': 'ንቁ ሰራተኛ ይምረጡ',
  'Use staff department': 'የሰራተኛውን ዲፓርትመንት ተጠቀም',
  Quantity: 'ብዛት',
  'Available:': 'ያለው:',
  'Assignment date *': 'የምደባ ቀን *',
  'Expected return date': 'የሚጠበቀው የመመለሻ ቀን',
  Purpose: 'ዓላማ',
  Remarks: 'ማስታወሻ',
  Cancel: 'ሰርዝ',
  'Register Assignment': 'ምደባ መዝግብ',
  'Saving...': 'በማስቀመጥ ላይ...',
  'Asset assignment created successfully.': 'የንብረት ምደባው በተሳካ ሁኔታ ተፈጥሯል።',
  'Unable to create assignment.': 'ምደባ መፍጠር አልተቻለም።',
  'Unable to load assignment options.': 'የምደባ አማራጮችን መጫን አልተቻለም።',
  'Select an asset.': 'ንብረት ይምረጡ።',
  'Select an active staff member.': 'ንቁ ሰራተኛ ይምረጡ።',
  'Assignment date is required.': 'የምደባ ቀን ያስፈልጋል።',
  'Quantity must be a positive whole number.': 'ብዛቱ ከዜሮ የሚበልጥ ሙሉ ቁጥር መሆን አለበት።',
  'Quantity cannot exceed available inventory.': 'ብዛቱ ካለው ክምችት መብለጥ የለበትም።',
  'Expected return date must be on or after the assignment date.': 'የመመለሻ ቀኑ ከምደባ ቀን በኋላ ወይም በዚያው ቀን መሆን አለበት።',
  'Assignment date cannot be in the future.': 'የምደባ ቀን ወደፊት ቀን መሆን አይችልም።',
  'Serialized assets can only be assigned one unit at a time.': 'ተከታታይ ቁጥር ያላቸው ንብረቶች በአንድ ጊዜ አንድ ብቻ ሊመደቡ ይችላሉ።',
  'No available assets are eligible for assignment.': 'ለምደባ የሚገኝ ንብረት የለም።',
  'No active staff members are available in this college.': 'በዚህ ኮሌጅ ውስጥ ንቁ ሰራተኛ የለም።',
  'Unable to load college assignments.': 'የኮሌጅ ምደባዎችን መጫን አልተቻለም።',
  'Not recorded': 'አልተመዘገበም',
  'Not specified': 'አልተገለጸም',
  Unassigned: 'ያልተመደበ',
  'No username': 'የተጠቃሚ ስም የለም',
  'Serial Number': 'ተከታታይ ቁጥር',
  Category: 'ምድብ',
  Created: 'የተፈጠረበት ቀን',
  Updated: 'የተዘመነበት ቀን',
  Notes: 'ማስታወሻዎች',
  'Showing page': 'ገጽ በማሳየት ላይ',
  Previous: 'ቀዳሚ',
  Next: 'ቀጣይ',
};

const getAssignmentStatusMeta = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['returned', 'closed', 'completed'].includes(normalized)) return { label: 'Returned', tone: 'returned', icon: BadgeCheck };
  if (['pending', 'waiting', 'approval', 'awaiting-approval', 'pending-return'].includes(normalized)) return { label: 'Pending', tone: 'pending', icon: Clock3 };
  if (['overdue', 'late'].includes(normalized)) return { label: 'Overdue', tone: 'overdue', icon: AlertTriangle };
  if (['cancelled', 'canceled', 'rejected'].includes(normalized)) return { label: 'Cancelled', tone: 'cancelled', icon: CircleX };
  return { label: 'Active', tone: 'active', icon: CheckCircle2 };
};

const CollegeAssignments = () => {
  const { language } = useLanguage();
  const auth = useAuth() || {};
  const role = String(auth.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const canManage = role === 'college_manager' && Boolean(auth.hasPermission?.('college.assignments.manage'));
  const text = (value) => language === 'am' ? assignmentTranslations[value] || value : value;
  const [state, setState] = useState({ ...emptyData, loading: true, tableLoading: false, error: '' });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assignedTo: '', location: '', category: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [options, setOptions] = useState({ assets: [], staff: [], departments: [] });
  const [form, setForm] = useState({ assetId: '', staffId: '', departmentId: '', quantity: '1', assignedDate: localDateValue(), expectedReturnDate: '', purpose: '', notes: '' });
  const [formErrors, setFormErrors] = useState({});

  const loadAssignments = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/assignments', {
        params: { ...query, page, limit: 20, search: query.search || undefined },
      });
      const payload = response.data?.data || response.data || emptyData;
      setState((previous) => ({ ...previous, ...payload, loading: false, tableLoading: false, error: '' }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: errorMessage(error) }));
    }
  };

  const openCreateForm = async () => {
    setOptionsLoading(true);
    setFormOpen(true);
    setFormErrors({});
    setForm({ assetId: '', staffId: '', departmentId: '', quantity: '1', assignedDate: localDateValue(), expectedReturnDate: '', purpose: '', notes: '' });
    try {
      const response = await apiClient.get('/api/college/assignment-options');
      const data = response.data?.data;
      if (!Array.isArray(data?.assets) || !Array.isArray(data?.staff) || !Array.isArray(data?.departments)) {
        throw new Error('The server returned invalid assignment options.');
      }
      setOptions(data);
    } catch (error) {
      setFormOpen(false);
      toast.error(text(error.response?.data?.message || 'Unable to load assignment options.'));
    } finally {
      setOptionsLoading(false);
    }
  };

  const selectedAsset = options.assets.find((asset) => String(asset.id) === String(form.assetId));
  const updateFormField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    if (saving) return;
    const errors = {};
    const quantity = Number(form.quantity);
    if (!form.assetId) errors.assetId = text('Select an asset.');
    if (!form.staffId) errors.staffId = text('Select an active staff member.');
    if (!Number.isSafeInteger(quantity) || quantity < 1) errors.quantity = text('Quantity must be a positive whole number.');
    else if (selectedAsset && quantity > Number(selectedAsset.availableQuantity)) errors.quantity = text('Quantity cannot exceed available inventory.');
    else if (selectedAsset?.serialNumber && quantity !== 1) errors.quantity = text('Serialized assets can only be assigned one unit at a time.');
    if (!form.assignedDate) errors.assignedDate = text('Assignment date is required.');
    else if (new Date(`${form.assignedDate}T00:00:00`) > new Date()) errors.assignedDate = text('Assignment date cannot be in the future.');
    if (form.expectedReturnDate && form.assignedDate && form.expectedReturnDate < form.assignedDate) errors.expectedReturnDate = text('Expected return date must be on or after the assignment date.');
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const response = await apiClient.post('/api/assignments', {
        asset_id: Number(form.assetId),
        assigned_to_type: 'user',
        assigned_to_id: Number(form.staffId),
        ...(form.departmentId ? { department_id: Number(form.departmentId) } : {}),
        quantity,
        assigned_date: form.assignedDate,
        expected_return_date: form.expectedReturnDate || null,
        purpose: form.purpose.trim(),
        notes: form.notes.trim(),
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to create assignment.');
      setFormOpen(false);
      toast.success(text('Asset assignment created successfully.'));
      await loadAssignments(true);
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      if (/expected return date/i.test(message || '')) setFormErrors((previous) => ({ ...previous, expectedReturnDate: text('Expected return date must be on or after the assignment date.') }));
      else if (/assignment date/i.test(message || '')) setFormErrors((previous) => ({ ...previous, assignedDate: text('Assignment date cannot be in the future.') }));
      else if (/quantity|inventory|serialized/i.test(message || '')) setFormErrors((previous) => ({ ...previous, quantity: text(/serialized/i.test(message) ? 'Serialized assets can only be assigned one unit at a time.' : 'Quantity cannot exceed available inventory.') }));
      toast.error(message || text('Unable to create assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const returnAssignment = async (assignment) => {
    if (returningId || !window.confirm(text('Return this assignment and restore its quantity to available inventory?'))) return;
    setReturningId(assignment.id);
    try {
      const response = await apiClient.post(`/api/assignments/${assignment.id}/return`, {});
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to return assignment.');
      toast.success(text('Asset returned successfully.'));
      setSelected(null);
      await loadAssignments(true);
    } catch (error) {
      toast.error(text(error.response?.data?.message || 'Unable to return assignment.'));
    } finally {
      setReturningId(null);
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
    const active = Number(state.summary?.active || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status).tone === 'active').length || 0);
    const pending = Number(state.summary?.pending || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status).tone === 'pending').length || 0);
    const returned = Number(state.summary?.returned || assignments.filter((assignment) => getAssignmentStatusMeta(assignment.status).tone === 'returned').length || 0);

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
          <strong>{text('Loading assignments...')}</strong>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="college-assignments-page">
        <div className="college-assignments-state college-assignments-error" role="alert">
          <ShieldCheck size={22} />
          <strong>{text(state.error === 'Unable to load assignments.' ? 'Unable to load college assignments.' : state.error)}</strong>
          <button type="button" onClick={() => loadAssignments(true)}>
            <RefreshCw size={16} /> {text('Retry')}
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
            <ClipboardList size={14} /> {text('College manager')}
          </span>
          <h1>{text('Asset Assignments')}</h1>
          <p>{text('Review active assignments, track assigned assets, and confirm details within the authorized college scope.')}</p>
        </div>
        <div className="college-assignments-header-actions">
          {canManage && <button type="button" className="college-assignments-action-button college-assignments-create-button" onClick={openCreateForm} disabled={state.tableLoading}><Plus size={16} /> {text('Create Assignment')}</button>}
          <button type="button" className="college-assignments-action-button" onClick={() => loadAssignments()} disabled={state.tableLoading}>
            <RefreshCw size={16} className={state.tableLoading ? 'college-assignments-spin' : ''} />
            {text('Refresh')}
          </button>
        </div>
      </header>

      <section className="college-assignments-metrics" aria-label={text('Assignment summary')}>
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="college-assignments-metric-card">
            <div className={`college-assignments-metric-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <div>
              <span>{text(label)}</span>
              <strong>{Number(value).toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="college-assignments-toolbar" aria-label={text('Assignment filters')}>
        <label className="college-assignments-search-field">
          <Search size={16} />
          <input
            type="search"
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            placeholder={text('Search asset, tag, assignee, serial...')}
            aria-label={text('Search assignments')}
          />
        </label>

        <label className="college-assignments-select-field">
          <Building2 size={14} />
          <select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)} aria-label={text('Filter by department')}>
            <option value="">{text('All departments')}</option>
            {(state.filters?.departments || []).map((department) => (
              <option value={department.id} key={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <Filter size={14} />
          <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)} aria-label={text('Filter by assignment status')}>
            <option value="">{text('All statuses')}</option>
            {(state.filters?.statuses || []).map((status) => (
              <option value={status} key={status}>{text(label(status))}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <UserRound size={14} />
          <select value={query.assignedTo} onChange={(event) => updateQuery('assignedTo', event.target.value)} aria-label={text('Filter by assignee')}>
            <option value="">{text('All assignees')}</option>
            {(state.filters?.users || []).map((user) => (
              <option value={user.id} key={user.id}>{user.fullName || user.username}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <Package size={14} />
          <select value={query.category} onChange={(event) => updateQuery('category', event.target.value)} aria-label={text('Filter by category')}>
            <option value="">{text('All categories')}</option>
            {(state.filters?.categories || []).map((category) => (
              <option value={category} key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label className="college-assignments-select-field">
          <MapPin size={14} />
          <select value={query.location} onChange={(event) => updateQuery('location', event.target.value)} aria-label={text('Filter by location')}>
            <option value="">{text('All locations')}</option>
            {(state.filters?.locations || []).map((location) => (
              <option value={location} key={location}>{location}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button type="button" className="college-assignments-clear-button" onClick={clearFilters}>
            {text('Clear filters')}
          </button>
        )}
      </section>

      <section className="college-assignments-table-panel">
        <div className="college-assignments-table-meta">
          <strong>
            {pagination.total
              ? `${text('Showing page')} ${first}-${last} (${pagination.total})`
              : hasFilters
                ? text('No assignments match your filters.')
                : text('No assignment records found.')}
          </strong>
          {state.tableLoading && <RefreshCw size={15} className="college-assignments-spin" />}
        </div>

        {rows.length ? (
          <div className="college-assignments-table-wrap">
            <table>
              <caption className="sr-only">College asset assignments</caption>
              <thead>
                <tr>
                  <th>{text('Asset ID')}</th>
                  <th>{text('Asset')}</th>
                  <th>{text('Assigned To')}</th>
                  <th>{text('Department')}</th>
                  <th>{text('Location')}</th>
                  <th>{text('Assignment Date')}</th>
                  <th>{text('Status')}</th>
                  <th>{text('Expected Return')}</th>
                  <th>{text('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((assignment) => {
                  const assignmentStatus = getAssignmentStatusMeta(assignment.status);
                  const StatusIcon = assignmentStatus.icon;
                  return (
                    <tr key={assignment.id}>
                      <td>
                        <strong>#{assignment.assetId || assignment.id}</strong>
                      </td>
                      <td>
                        <div className="college-assignments-asset-cell">
                          <strong>{display(assignment.asset?.name)}</strong>
                          <small>{display(assignment.asset?.code || assignment.asset?.serialNumber)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="college-assignments-user-cell">
                          <span>{display(assignment.assignee?.name || assignment.assignee?.username || 'Unassigned').slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{display(assignment.assignee?.name || assignment.assignee?.username || 'Unassigned')}</strong>
                            <small>{display(assignment.assignee?.username || text('No username'))}</small>
                          </div>
                        </div>
                      </td>
                      <td>{display(assignment.department?.name || assignment.asset?.department || 'Not specified')}</td>
                      <td>{display(assignment.location || 'Not specified')}</td>
                      <td>
                        <div className="college-assignments-date-cell">
                          <CalendarDays size={14} />
                          <span>{date(assignment.assignedDate)}</span>
                        </div>
                      </td>
                      <td>{date(assignment.expectedReturnDate)}</td>
                      <td>
                        <span className={`college-assignments-badge status-${assignmentStatus.tone}`}>
                          <StatusIcon size={12} />
                          {text(assignmentStatus.label)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="college-assignments-icon-button"
                          onClick={() => setSelected(assignment)}
                          aria-label={`View assignment ${assignment.id} details`}
                          title={text('View details')}
                        >
                          <Eye size={16} />
                        </button>
                        {canManage && assignmentStatus.tone === 'active' && <button type="button" className="college-assignments-return-button" onClick={() => returnAssignment(assignment)} disabled={returningId === assignment.id}>{returningId === assignment.id ? text('Saving...') : text('Return Asset')}</button>}
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
            <strong>{text(hasFilters ? 'No assignments match your current filters.' : 'No asset assignments found.')}</strong>
            {hasFilters && <button type="button" onClick={clearFilters}>{text('Clear filters')}</button>}
          </div>
        )}

        <nav className="college-assignments-pagination" aria-label={text('Assignment pages')}>
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>
            {text('Previous')}
          </button>
          <span>
            {text('Showing page')} {pagination.page} of {Math.max(1, pagination.totalPages || 1)}
          </span>
          <button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>
            {text('Next')}
          </button>
        </nav>
      </section>

      {formOpen && (
        <div className="college-assignments-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setFormOpen(false)}>
          <section className="college-assignments-modal college-assignments-form-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-create-title">
            <div className="college-assignments-modal-head">
              <div>
                <span className="college-assignments-eyebrow">{text('Asset Assignments')}</span>
                <h2 id="assignment-create-title">{text('Create an asset assignment')}</h2>
                <p>{text('Select an available asset and active staff member in your college.')}</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label={text('Cancel')} disabled={saving}><X size={18} /></button>
            </div>
            {optionsLoading ? (
              <div className="college-assignments-state" aria-busy="true"><RefreshCw className="college-assignments-spin" size={20} />{text('Loading assignments...')}</div>
            ) : (
              <form className="college-assignments-form" onSubmit={saveAssignment} noValidate>
                <label className="college-assignments-form-wide">
                  <span>{text('Asset *')}</span>
                  <select value={form.assetId} onChange={(event) => updateFormField('assetId', event.target.value)} aria-invalid={Boolean(formErrors.assetId)} aria-describedby={formErrors.assetId ? 'assignment-asset-error' : undefined}>
                    <option value="">{text('Choose available asset')}</option>
                    {options.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} — {asset.assetCode || `#${asset.id}`} · {asset.category || text('Not recorded')} · {text('Available:')} {asset.availableQuantity}</option>)}
                  </select>
                  {formErrors.assetId && <small className="college-assignments-field-error" id="assignment-asset-error">{formErrors.assetId}</small>}
                  {selectedAsset && <small className="college-assignments-selected-asset">{selectedAsset.category || text('Not recorded')} · {text('Asset Tag')}: {selectedAsset.assetCode || selectedAsset.id} · {text('Serial Number')}: {selectedAsset.serialNumber || text('Not recorded')} · {text('Available:')} {selectedAsset.availableQuantity}</small>}
                  {!options.assets.length && <small className="college-assignments-field-hint">{text('No available assets are eligible for assignment.')}</small>}
                </label>
                <label>
                  <span>{text('Staff member *')}</span>
                  <select value={form.staffId} onChange={(event) => {
                    const staffId = event.target.value;
                    const staffMember = options.staff.find((person) => String(person.id) === staffId);
                    setForm((previous) => ({ ...previous, staffId, departmentId: staffMember?.departmentId ? String(staffMember.departmentId) : '' }));
                    setFormErrors((previous) => ({ ...previous, staffId: '' }));
                  }} aria-invalid={Boolean(formErrors.staffId)} aria-describedby={formErrors.staffId ? 'assignment-staff-error' : undefined}>
                    <option value="">{text('Choose active staff')}</option>
                    {options.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName || staff.username}{staff.department?.name ? ` — ${staff.department.name}` : ''}</option>)}
                  </select>
                  {formErrors.staffId && <small className="college-assignments-field-error" id="assignment-staff-error">{formErrors.staffId}</small>}
                  {!options.staff.length && <small className="college-assignments-field-hint">{text('No active staff members are available in this college.')}</small>}
                </label>
                <label>
                  <span>{text('Department')}</span>
                  <select value={form.departmentId} onChange={(event) => updateFormField('departmentId', event.target.value)}>
                    <option value="">{text('Use staff department')}</option>
                    {options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>{text('Quantity')}</span>
                  <input type="number" min="1" max={selectedAsset?.availableQuantity || undefined} step="1" value={form.quantity} onChange={(event) => updateFormField('quantity', event.target.value)} aria-invalid={Boolean(formErrors.quantity)} aria-describedby={formErrors.quantity ? 'assignment-quantity-error' : undefined} />
                  {formErrors.quantity && <small className="college-assignments-field-error" id="assignment-quantity-error">{formErrors.quantity}</small>}
                  {selectedAsset && <small className="college-assignments-field-hint">{text('Available:')} {selectedAsset.availableQuantity}</small>}
                </label>
                <label>
                  <span>{text('Assignment date *')}</span>
                  <input type="date" value={form.assignedDate} max={localDateValue()} onChange={(event) => updateFormField('assignedDate', event.target.value)} required aria-invalid={Boolean(formErrors.assignedDate)} aria-describedby={formErrors.assignedDate ? 'assignment-date-error' : undefined} />
                  {formErrors.assignedDate && <small className="college-assignments-field-error" id="assignment-date-error">{formErrors.assignedDate}</small>}
                </label>
                <label>
                  <span>{text('Expected return date')}</span>
                  <input type="date" min={form.assignedDate || undefined} value={form.expectedReturnDate} onChange={(event) => updateFormField('expectedReturnDate', event.target.value)} aria-invalid={Boolean(formErrors.expectedReturnDate)} aria-describedby={formErrors.expectedReturnDate ? 'assignment-return-date-error' : undefined} />
                  {formErrors.expectedReturnDate && <small className="college-assignments-field-error" id="assignment-return-date-error">{formErrors.expectedReturnDate}</small>}
                </label>
                <label className="college-assignments-form-wide">
                  <span>{text('Purpose')}</span>
                  <input value={form.purpose} maxLength={500} onChange={(event) => updateFormField('purpose', event.target.value)} />
                </label>
                <label className="college-assignments-form-wide">
                  <span>{text('Remarks')}</span>
                  <textarea value={form.notes} maxLength={5000} rows="3" onChange={(event) => updateFormField('notes', event.target.value)} />
                </label>
                <div className="college-assignments-form-actions">
                  <button type="button" className="college-assignments-clear-button" onClick={() => setFormOpen(false)} disabled={saving}>{text('Cancel')}</button>
                  <button type="submit" className="college-assignments-action-button college-assignments-create-button" disabled={saving || optionsLoading}>
                    {saving ? <RefreshCw size={15} className="college-assignments-spin" /> : <Save size={15} />}
                    {text(saving ? 'Saving...' : 'Register Assignment')}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {selected && (
        <div className="college-assignments-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="college-assignments-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-details-title">
            <div className="college-assignments-modal-head">
              <div>
                <span className="college-assignments-eyebrow">{text('Assignment details')}</span>
                <h2 id="assignment-details-title">Assignment #{selected.id}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label={text('Cancel')}>
                <X size={18} />
              </button>
            </div>

            <div className="college-assignments-details">
              {[
                ['Asset', selected.asset?.name],
                [text('Asset'), selected.asset?.name],
                [text('Asset Tag'), selected.asset?.code],
                [text('Serial Number'), selected.asset?.serialNumber],
                [text('Category'), selected.asset?.category],
                [text('Assigned To'), selected.assignee?.name || selected.assignee?.username],
                [text('Department'), selected.department?.name || selected.asset?.department],
                [text('Location'), selected.location],
                [text('Assignment Date'), date(selected.assignedDate)],
                [text('Expected Return'), date(selected.expectedReturnDate)],
                [text('Status'), text(label(selected.status))],
                [text('Created'), date(selected.createdAt)],
                [text('Updated'), date(selected.updatedAt)],
              ].map(([title, value]) => (
                <div key={title} className="college-assignments-detail-item">
                  <span>{title}</span>
                  <strong>{text(display(value))}</strong>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="college-assignments-notes">
                <span>{text('Notes')}</span>
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
