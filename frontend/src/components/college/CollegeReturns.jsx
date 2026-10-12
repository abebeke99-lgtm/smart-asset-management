/* eslint-disable react-hooks/exhaustive-deps, jsx-a11y/role-has-required-aria-props */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardCheck,
  Clock3,
  Eye,
  Filter,
  Inbox,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import './CollegeReturns.css';

const emptyData = {
  summary: { total: 0, byStatus: {} },
  returns: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

const STATUS_OPTIONS = ['Requested', 'Approved', 'Ready for Return', 'In Transit', 'Received', 'Inspected', 'Completed', 'Rejected', 'Cancelled'];
const CONDITIONS = ['Good', 'Fair', 'Damaged', 'Heavily damaged', 'Missing parts', 'Non-functional'];
const REASONS = ['End of Assignment', 'Replacement', 'Damage', 'Maintenance', 'Employee Transfer', 'Employee Separation', 'Department Transfer', 'Temporary Return', 'Inventory Verification', 'Other'];
const ACTIONABLE_STATUS = 'Requested';
const CANCELLABLE_STATUSES = ['Requested', 'Approved'];

const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value) => (value === null || value === undefined || value === '' ? 'Not recorded' : value);
const localDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};
const dateValue = (record) => record.returnDate || record.return_date || record.receivedAt || record.requestedAt || record.createdAt || null;
const errorMessage = (error, action = 'load returns') => ({
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not authorized to view college asset returns.',
  404: 'The return records were not found.',
}[error.response?.status] || `Unable to ${action}.`);

const getReturnStatusMeta = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'requested' || normalized === 'pending') return { label: 'Requested', tone: 'pending', icon: Clock3 };
  if (normalized === 'approved') return { label: 'Approved', tone: 'approved', icon: CheckCircle2 };
  if (normalized === 'ready for return' || normalized === 'ready') return { label: 'Ready for Return', tone: 'ready', icon: Package };
  if (normalized === 'in transit') return { label: 'In Transit', tone: 'transit', icon: Truck };
  if (normalized === 'received') return { label: 'Received', tone: 'received', icon: Inbox };
  if (normalized === 'inspected') return { label: 'Inspected', tone: 'inspected', icon: ClipboardCheck };
  if (normalized === 'completed') return { label: 'Completed', tone: 'completed', icon: BadgeCheck };
  if (normalized === 'rejected') return { label: 'Rejected', tone: 'rejected', icon: CircleX };
  if (normalized === 'cancelled' || normalized === 'canceled') return { label: 'Cancelled', tone: 'cancelled', icon: Ban };
  return { label: label(status) || 'Unknown', tone: 'unknown', icon: AlertTriangle };
};

const returnTranslations = {
  'Asset Returns': 'የንብረት መመለሻዎች',
  'College manager': 'የኮሌጅ አስተዳዳሪ',
  'Review asset return requests, approve or reject them, and track returned assets within the authorized college scope.': 'በተፈቀደው የኮሌጅ ወሰን ውስጥ የንብረት መመለሻ ጥያቄዎችን ይመልከቱ፣ ያጽድቁ ወይም ውድቅ ያድርጉ፣ እና የተመለሱ ንብረቶችን ይከታተሉ።',
  'Register Return': 'መመለሻ መዝግብ',
  Refresh: 'አድስ',
  Retry: 'እንደገና ሞክር',
  'Total Returns': 'ጠቅላላ መመለሻዎች',
  Requested: 'የተጠየቀ',
  Approved: 'የጸደቀ',
  Completed: 'የተጠናቀቀ',
  'All statuses': 'ሁሉም ሁኔታዎች',
  'Search asset, tag, serial, person...': 'ንብረት፣ መለያ፣ ተከታታይ ቁጥር ወይም ሰው ፈልግ...',
  'Search returns': 'መመለሻዎችን ፈልግ',
  'Filter by return status': 'በመመለሻ ሁኔታ አጣራ',
  'Clear filters': 'ማጣሪያዎችን አጽዳ',
  'No returns match your filters.': 'ከማጣሪያዎችዎ ጋር የሚስማማ መመለሻ የለም።',
  'No return records found.': 'የመመለሻ መዝገብ አልተገኘም።',
  'No returns match your current filters.': 'ከአሁኑ ማጣሪያዎችዎ ጋር የሚስማማ መመለሻ የለም።',
  'No asset returns found.': 'የንብረት መመለሻ አልተገኘም።',
  'Loading returns...': 'መመለሻዎችን በመጫን ላይ...',
  'Return': 'መመለሻ',
  Asset: 'ንብረት',
  'Return Number': 'የመመለሻ ቁጥር',
  'Returning Person': 'የሚመልሰው ሰው',
  'Return Date': 'የመመለሻ ቀን',
  Condition: 'ሁኔታ',
  Reason: 'ምክንያት',
  Status: 'ሁኔታ',
  Actions: 'እርምጃዎች',
  'View details': 'ዝርዝሮችን ይመልከቱ',
  Approve: 'አጽድቅ',
  Reject: 'ውድቅ አድርግ',
  Cancel: 'ሰርዝ',
  'Cancel return': 'መመለሻውን ሰርዝ',
  'Approve this asset return?': 'ይህን የንብረት መመለሻ ማጽደቅ?',
  'Return approved successfully.': 'መመለሻው በተሳካ ሁኔታ ጸድቋል።',
  'Unable to approve return.': 'መመለሻውን ማጽደቅ አልተቻለም።',
  'Reject this asset return?': 'ይህን የንብረት መመለሻ ውድቅ ማድረግ?',
  'Rejection reason': 'የውድቅ ምክንያት',
  'A rejection reason is required.': 'የውድቅ ምክንያት ያስፈልጋል።',
  'Return rejected.': 'መመለሻው ውድቅ ተደርጓል።',
  'Unable to reject return.': 'መመለሻውን ውድቅ ማድረግ አልተቻለም።',
  'Cancel this asset return?': 'ይህን የንብረት መመለሻ ሰርዝ?',
  'Return cancelled.': 'መመለሻው ተሰርዟል።',
  'Unable to cancel return.': 'መመለሻውን መሰረዝ አልተቻለም።',
  'Return details': 'የመመለሻ ዝርዝሮች',
  'Register an asset return': 'የንብረት መመለሻ መዝግብ',
  'Select an assigned asset held within your college.': 'በኮሌጅዎ ውስጥ ያለ የተመደበ ንብረት ይምረጡ።',
  'Asset *': 'ንብረት *',
  'Choose assigned asset': 'የተመደበ ንብረት ይምረጡ',
  'Returning person': 'የሚመልሰው ሰው',
  Quantity: 'ብዛት',
  'Return date *': 'የመመለሻ ቀን *',
  'Return reason *': 'የመመለሻ ምክንያት *',
  'Condition *': 'ሁኔታ *',
  Notes: 'ማስታወሻዎች',
  'Register Return ': 'መመለሻ መዝግብ ',
  'Saving...': 'በማስቀመጥ ላይ...',
  'Return request created successfully.': 'የመመለሻ ጥያቄው በተሳካ ሁኔታ ተፈጥሯል።',
  'Unable to create return request.': 'የመመለሻ ጥያቄ መፍጠር አልተቻለም።',
  'Unable to load return options.': 'የመመለሻ አማራጮችን መጫን አልተቻለም።',
  'Select an asset.': 'ንብረት ይምረጡ።',
  'Return date is required.': 'የመመለሻ ቀን ያስፈልጋል።',
  'Return date cannot be in the future.': 'የመመለሻ ቀን ወደፊት ቀን መሆን አይችልም።',
  'Quantity must be a positive whole number.': 'ብዛቱ ከዜሮ የሚበልጥ ሙሉ ቁጥር መሆን አለበት።',
  'Quantity cannot exceed the assigned quantity.': 'ብዛቱ ከተመደበው ብዛት መብለጥ የለበትም።',
  'No assigned assets are eligible for return in this college.': 'በዚህ ኮሌጅ ውስጥ ለመመለስ የሚመች የተመደበ ንብረት የለም።',
  'No person recorded': 'የተመዘገበ ሰው የለም',
  'Not recorded': 'አልተመዘገበም',
  'Showing page': 'ገጽ በማሳየት ላይ',
  Previous: 'ቀዳሚ',
  Next: 'ቀጣይ',
  'Asset ID': 'የንብረት መለያ',
};

const normalizeList = (payload) => {
  const data = payload?.data?.data ?? payload?.data ?? {};
  const rows = Array.isArray(data.returns)
    ? data.returns
    : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];
  return {
    summary: data.summary || { total: rows.length, byStatus: {} },
    returns: rows,
    pagination: data.pagination || { page: 1, limit: 20, total: rows.length, totalPages: 1 },
  };
};

const CollegeReturns = () => {
  const { language } = useLanguage();
  const auth = useAuth() || {};
  const role = String(auth.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const canManage = role === 'college_manager' && Boolean(auth.hasPermission?.('college.returns.manage'));
  const text = (value) => (language === 'am' ? returnTranslations[value] || value : value);

  const [state, setState] = useState({ ...emptyData, loading: true, tableLoading: false, error: '' });
  const [query, setQuery] = useState({ search: '', status: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState([]);
  const [form, setForm] = useState({ assetId: '', quantity: '1', returnDate: localDateValue(), condition: 'Good', reason: 'End of Assignment', notes: '' });
  const [formErrors, setFormErrors] = useState({});
  const [actionId, setActionId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const loadReturns = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/returns', {
        params: { page, limit: 20, search: query.search || undefined, status: query.status || undefined },
      });
      const payload = normalizeList(response.data);
      setState((previous) => ({ ...previous, ...payload, loading: false, tableLoading: false, error: '' }));
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: errorMessage(error) }));
    }
  };

  const openCreateForm = async () => {
    setOptionsLoading(true);
    setFormOpen(true);
    setFormErrors({});
    setForm({ assetId: '', quantity: '1', returnDate: localDateValue(), condition: 'Good', reason: 'End of Assignment', notes: '' });
    try {
      const response = await apiClient.get('/api/college/returns/options');
      const data = response.data?.data ?? response.data;
      if (!Array.isArray(data)) throw new Error('The server returned invalid return options.');
      setOptions(data);
    } catch (error) {
      setFormOpen(false);
      toast.error(text(error.response?.data?.message || 'Unable to load return options.'));
    } finally {
      setOptionsLoading(false);
    }
  };

  const selectedAsset = options.find((asset) => String(asset.id) === String(form.assetId));
  const updateFormField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const saveReturn = async (event) => {
    event.preventDefault();
    if (saving) return;
    const errors = {};
    const quantity = Number(form.quantity);
    if (!form.assetId) errors.assetId = text('Select an asset.');
    if (!Number.isSafeInteger(quantity) || quantity < 1) errors.quantity = text('Quantity must be a positive whole number.');
    else if (selectedAsset && quantity > Number(selectedAsset.availableQuantity)) errors.quantity = text('Quantity cannot exceed the assigned quantity.');
    if (!form.returnDate) errors.returnDate = text('Return date is required.');
    else if (new Date(`${form.returnDate}T00:00:00`) > new Date()) errors.returnDate = text('Return date cannot be in the future.');
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const response = await apiClient.post('/api/college/returns', {
        asset_id: Number(form.assetId),
        quantity,
        return_date: form.returnDate,
        condition: form.condition,
        reason: form.reason,
        notes: form.notes.trim(),
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to create return request.');
      setFormOpen(false);
      toast.success(text('Return request created successfully.'));
      await loadReturns(true);
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      if (/return date/i.test(message || '')) setFormErrors((previous) => ({ ...previous, returnDate: text('Return date cannot be in the future.') }));
      else if (/quantity/i.test(message || '')) setFormErrors((previous) => ({ ...previous, quantity: text('Quantity cannot exceed the assigned quantity.') }));
      toast.error(message || text('Unable to create return request.'));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (record, action, body = {}) => {
    setActionId(record.id);
    try {
      const response = await apiClient.post(`/api/college/returns/${record.id}/${action}`, body);
      if (!response.data?.success) throw new Error(response.data?.message || `Unable to ${action} return.`);
      return true;
    } catch (error) {
      toast.error(text(error.response?.data?.message || `Unable to ${action} return.`));
      return false;
    } finally {
      setActionId(null);
    }
  };

  const approveReturn = async (record) => {
    if (actionId || !window.confirm(text('Approve this asset return?'))) return;
    if (await changeStatus(record, 'approve')) {
      toast.success(text('Return approved successfully.'));
      setSelected(null);
      await loadReturns(true);
    }
  };

  const submitReject = async () => {
    if (!rejecting || actionId) return;
    if (!rejectReason.trim()) {
      setRejectError(text('A rejection reason is required.'));
      return;
    }
    if (await changeStatus(rejecting, 'reject', { reason: rejectReason.trim() })) {
      toast.success(text('Return rejected.'));
      setRejecting(null);
      setRejectReason('');
      setSelected(null);
      await loadReturns(true);
    }
  };

  const cancelReturn = async (record) => {
    if (actionId || !window.confirm(text('Cancel this asset return?'))) return;
    if (await changeStatus(record, 'cancel')) {
      toast.success(text('Return cancelled.'));
      setSelected(null);
      await loadReturns(true);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadReturns(page === 1 && !state.returns.length && state.loading), 250);
    return () => clearTimeout(timer);
  }, [page, query.search, query.status]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setRejecting(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const summaryCards = useMemo(() => {
    const rows = Array.isArray(state.returns) ? state.returns : [];
    const byStatus = state.summary?.byStatus || {};
    const count = (statuses) => statuses.reduce((total, status) => total + Number(byStatus[status] || 0), 0)
      || rows.filter((row) => statuses.includes(row.status)).length;
    return [
      { label: 'Total Returns', value: Number(state.summary?.total ?? rows.length ?? 0), icon: Undo2, tone: 'primary' },
      { label: 'Requested', value: count(['Requested']), icon: Clock3, tone: 'warning' },
      { label: 'Approved', value: count(['Approved']), icon: CheckCircle2, tone: 'success' },
      { label: 'Completed', value: count(['Received', 'Inspected', 'Completed']), icon: BadgeCheck, tone: 'slate' },
    ];
  }, [state.returns, state.summary]);

  const updateQuery = (field, value) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setQuery({ search: '', status: '' });
  };

  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination || emptyData.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) {
    return (
      <div className="college-returns-page">
        <div className="college-returns-state" aria-busy="true">
          <RefreshCw className="college-returns-spin" size={22} />
          <strong>{text('Loading returns...')}</strong>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="college-returns-page">
        <div className="college-returns-state college-returns-error" role="alert">
          <ShieldCheck size={22} />
          <strong>{text(state.error)}</strong>
          <button type="button" onClick={() => loadReturns(true)}>
            <RefreshCw size={16} /> {text('Retry')}
          </button>
        </div>
      </div>
    );
  }

  const rows = Array.isArray(state.returns) ? state.returns : [];

  return (
    <div className="college-returns-page">
      <header className="college-returns-header">
        <div className="college-returns-title-block">
          <span className="college-returns-eyebrow">
            <Undo2 size={14} /> {text('College manager')}
          </span>
          <h1>{text('Asset Returns')}</h1>
          <p>{text('Review asset return requests, approve or reject them, and track returned assets within the authorized college scope.')}</p>
        </div>
        <div className="college-returns-header-actions">
          {canManage && <button type="button" className="college-returns-action-button college-returns-create-button" onClick={openCreateForm} disabled={state.tableLoading}><Plus size={16} /> {text('Register Return')}</button>}
          <button type="button" className="college-returns-action-button" onClick={() => loadReturns()} disabled={state.tableLoading}>
            <RefreshCw size={16} className={state.tableLoading ? 'college-returns-spin' : ''} />
            {text('Refresh')}
          </button>
        </div>
      </header>

      <section className="college-returns-metrics" aria-label={text('Return summary')}>
        {summaryCards.map(({ label: cardLabel, value, icon: Icon, tone }) => (
          <article key={cardLabel} className="college-returns-metric-card">
            <div className={`college-returns-metric-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <div>
              <span>{text(cardLabel)}</span>
              <strong>{Number(value).toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="college-returns-toolbar" aria-label={text('Return filters')}>
        <label className="college-returns-search-field">
          <Search size={16} />
          <input
            type="search"
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            placeholder={text('Search asset, tag, serial, person...')}
            aria-label={text('Search returns')}
          />
        </label>

        <label className="college-returns-select-field">
          <Filter size={14} />
          <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)} aria-label={text('Filter by return status')}>
            <option value="">{text('All statuses')}</option>
            {STATUS_OPTIONS.map((status) => (
              <option value={status} key={status}>{text(status === 'Requested' ? 'Requested' : status)}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button type="button" className="college-returns-clear-button" onClick={clearFilters}>
            {text('Clear filters')}
          </button>
        )}
      </section>

      <section className="college-returns-table-panel">
        <div className="college-returns-table-meta">
          <strong>
            {pagination.total
              ? `${text('Showing page')} ${first}-${last} (${pagination.total})`
              : hasFilters
                ? text('No returns match your filters.')
                : text('No return records found.')}
          </strong>
          {state.tableLoading && <RefreshCw size={15} className="college-returns-spin" />}
        </div>

        {rows.length ? (
          <div className="college-returns-table-wrap">
            <table>
              <caption className="sr-only">College asset returns</caption>
              <thead>
                <tr>
                  <th>{text('Return Number')}</th>
                  <th>{text('Asset')}</th>
                  <th>{text('Returning Person')}</th>
                  <th>{text('Return Date')}</th>
                  <th>{text('Condition')}</th>
                  <th>{text('Reason')}</th>
                  <th>{text('Status')}</th>
                  <th>{text('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => {
                  const statusMeta = getReturnStatusMeta(record.status);
                  const StatusIcon = statusMeta.icon;
                  const assetName = record.asset_name || record.Asset?.name || record.asset?.name;
                  const assetTag = record.Asset?.assetCode || record.asset?.code || record.asset_id || record.assetId;
                  const person = record.returning_person_name || record.returning_person?.fullName || record.ReturningPerson?.fullName;
                  return (
                    <tr key={record.id}>
                      <td><strong>{record.return_number || record.returnNumber || `#${record.id}`}</strong></td>
                      <td>
                        <div className="college-returns-asset-cell">
                          <strong>{display(assetName)}</strong>
                          <small>{display(assetTag)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="college-returns-user-cell">
                          <span>{display(person || '?').slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{display(person || text('No person recorded'))}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="college-returns-date-cell">
                          <CalendarDays size={14} />
                          <span>{formatDate(dateValue(record))}</span>
                        </div>
                      </td>
                      <td>{display(record.condition)}</td>
                      <td>{display(record.reason)}</td>
                      <td>
                        <span className={`college-returns-badge status-${statusMeta.tone}`}>
                          <StatusIcon size={12} />
                          {record.status === 'Requested' ? text('Requested') : statusMeta.label}
                        </span>
                      </td>
                      <td>
                        <div className="college-returns-row-actions">
                          <button
                            type="button"
                            className="college-returns-icon-button"
                            onClick={() => setSelected(record)}
                            aria-label={`View return ${record.id} details`}
                            title={text('View details')}
                          >
                            <Eye size={16} />
                          </button>
                          {canManage && record.status === ACTIONABLE_STATUS && (
                            <>
                              <button type="button" className="college-returns-approve-button" onClick={() => approveReturn(record)} disabled={actionId === record.id}>{text('Approve')}</button>
                              <button type="button" className="college-returns-reject-button" onClick={() => { setRejecting(record); setRejectReason(''); setRejectError(''); }} disabled={actionId === record.id}>{text('Reject')}</button>
                            </>
                          )}
                          {canManage && CANCELLABLE_STATUSES.includes(record.status) && (
                            <button type="button" className="college-returns-icon-button" onClick={() => cancelReturn(record)} aria-label={`${text('Cancel return')} ${record.id}`} title={text('Cancel return')} disabled={actionId === record.id}>
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-returns-empty">
            <Undo2 size={30} />
            <strong>{text(hasFilters ? 'No returns match your current filters.' : 'No asset returns found.')}</strong>
            {hasFilters && <button type="button" onClick={clearFilters}>{text('Clear filters')}</button>}
          </div>
        )}

        <nav className="college-returns-pagination" aria-label={text('Return pages')}>
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
        <div className="college-returns-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setFormOpen(false)}>
          <section className="college-returns-modal college-returns-form-modal" role="dialog" aria-modal="true" aria-labelledby="return-create-title">
            <div className="college-returns-modal-head">
              <div>
                <span className="college-returns-eyebrow">{text('Asset Returns')}</span>
                <h2 id="return-create-title">{text('Register an asset return')}</h2>
                <p>{text('Select an assigned asset held within your college.')}</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label={text('Cancel')} disabled={saving}><X size={18} /></button>
            </div>
            {optionsLoading ? (
              <div className="college-returns-state" aria-busy="true"><RefreshCw className="college-returns-spin" size={20} />{text('Loading returns...')}</div>
            ) : (
              <form className="college-returns-form" onSubmit={saveReturn} noValidate>
                <label className="college-returns-form-wide">
                  <span>{text('Asset *')}</span>
                  <select value={form.assetId} onChange={(event) => updateFormField('assetId', event.target.value)} aria-invalid={Boolean(formErrors.assetId)} aria-describedby={formErrors.assetId ? 'return-asset-error' : undefined}>
                    <option value="">{text('Choose assigned asset')}</option>
                    {options.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} — {asset.assetCode || `#${asset.id}`} · {text('Available:')} {asset.availableQuantity}</option>)}
                  </select>
                  {formErrors.assetId && <small className="college-returns-field-error" id="return-asset-error">{formErrors.assetId}</small>}
                  {!options.length && <small className="college-returns-field-hint">{text('No assigned assets are eligible for return in this college.')}</small>}
                </label>
                <label>
                  <span>{text('Returning person')}</span>
                  <input readOnly value={selectedAsset?.custodian?.name || selectedAsset?.custodian?.fullName || ''} placeholder={text('No person recorded')} />
                </label>
                <label>
                  <span>{text('Quantity')}</span>
                  <input type="number" min="1" max={selectedAsset?.availableQuantity || undefined} step="1" value={form.quantity} onChange={(event) => updateFormField('quantity', event.target.value)} aria-invalid={Boolean(formErrors.quantity)} aria-describedby={formErrors.quantity ? 'return-quantity-error' : undefined} />
                  {formErrors.quantity && <small className="college-returns-field-error" id="return-quantity-error">{formErrors.quantity}</small>}
                </label>
                <label>
                  <span>{text('Return date *')}</span>
                  <input type="date" value={form.returnDate} max={localDateValue()} onChange={(event) => updateFormField('returnDate', event.target.value)} required aria-invalid={Boolean(formErrors.returnDate)} aria-describedby={formErrors.returnDate ? 'return-date-error' : undefined} />
                  {formErrors.returnDate && <small className="college-returns-field-error" id="return-date-error">{formErrors.returnDate}</small>}
                </label>
                <label>
                  <span>{text('Condition *')}</span>
                  <select value={form.condition} onChange={(event) => updateFormField('condition', event.target.value)}>
                    {CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
                  </select>
                </label>
                <label>
                  <span>{text('Return reason *')}</span>
                  <select value={form.reason} onChange={(event) => updateFormField('reason', event.target.value)}>
                    {REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                  </select>
                </label>
                <label className="college-returns-form-wide">
                  <span>{text('Notes')}</span>
                  <textarea value={form.notes} maxLength={5000} rows="3" onChange={(event) => updateFormField('notes', event.target.value)} />
                </label>
                <div className="college-returns-form-actions">
                  <button type="button" className="college-returns-clear-button" onClick={() => setFormOpen(false)} disabled={saving}>{text('Cancel')}</button>
                  <button type="submit" className="college-returns-action-button college-returns-create-button" disabled={saving || optionsLoading}>
                    {saving ? <RefreshCw size={15} className="college-returns-spin" /> : <Plus size={15} />}
                    {text(saving ? 'Saving...' : 'Register Return')}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {rejecting && (
        <div className="college-returns-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !actionId && setRejecting(null)}>
          <section className="college-returns-modal college-returns-reject-modal" role="dialog" aria-modal="true" aria-labelledby="return-reject-title">
            <div className="college-returns-modal-head">
              <div>
                <span className="college-returns-eyebrow">{text('Reject')}</span>
                <h2 id="return-reject-title">{text('Reject this asset return?')}</h2>
              </div>
              <button type="button" onClick={() => setRejecting(null)} aria-label={text('Cancel')} disabled={actionId === rejecting.id}><X size={18} /></button>
            </div>
            <label className="college-returns-reject-field">
              <span>{text('Rejection reason')}</span>
              <textarea value={rejectReason} rows="3" onChange={(event) => { setRejectReason(event.target.value); setRejectError(''); }} aria-invalid={Boolean(rejectError)} />
              {rejectError && <small className="college-returns-field-error">{rejectError}</small>}
            </label>
            <div className="college-returns-form-actions">
              <button type="button" className="college-returns-clear-button" onClick={() => setRejecting(null)} disabled={actionId === rejecting.id}>{text('Cancel')}</button>
              <button type="button" className="college-returns-reject-button" onClick={submitReject} disabled={actionId === rejecting.id}>{text('Reject')}</button>
            </div>
          </section>
        </div>
      )}

      {selected && (
        <div className="college-returns-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="college-returns-modal" role="dialog" aria-modal="true" aria-labelledby="return-details-title">
            <div className="college-returns-modal-head">
              <div>
                <span className="college-returns-eyebrow">{text('Return details')}</span>
                <h2 id="return-details-title">{selected.return_number || selected.returnNumber || `Return #${selected.id}`}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label={text('Cancel')}>
                <X size={18} />
              </button>
            </div>

            <div className="college-returns-details">
              {[
                [text('Asset'), selected.asset_name || selected.Asset?.name || selected.asset?.name],
                [text('Asset ID'), selected.Asset?.assetCode || selected.asset?.code || selected.asset_id || selected.assetId],
                [text('Returning Person'), selected.returning_person_name || selected.returning_person?.fullName || selected.ReturningPerson?.fullName],
                [text('Return Date'), formatDate(dateValue(selected))],
                [text('Condition'), selected.condition],
                [text('Reason'), selected.reason],
                [text('Status'), selected.status === 'Requested' ? text('Requested') : getReturnStatusMeta(selected.status).label],
                [text('Quantity'), selected.quantity],
                [text('Outcome'), selected.outcome],
                [text('Requested'), formatDate(selected.requestedAt || selected.createdAt)],
              ].map(([title, value]) => (
                <div key={title} className="college-returns-detail-item">
                  <span>{title}</span>
                  <strong>{display(value)}</strong>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="college-returns-notes">
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

export default CollegeReturns;
