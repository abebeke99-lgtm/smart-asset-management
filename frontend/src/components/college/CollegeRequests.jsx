/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Edit3, Eye, FileText, Plus, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import CollegeAssetRequestForm from './CollegeAssetRequestForm';
import './CollegeRequests.css';

const statuses = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Changes Requested', 'Escalated', 'Completed', 'Cancelled'];
const pendingStatuses = ['Submitted', 'Under Review', 'Escalated'];
const emptySummary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
const emptyPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value, translate) => value === null || value === undefined || value === '' ? translate('Not recorded') : value;
const date = (value, translate) => value ? new Date(value).toLocaleString() : translate('Not recorded');

const AMHARIC_COPY = {
  'Not recorded': 'አልተመዘገበም',
  'You are not authorized to view college requests.': 'የኮሌጅ ጥያቄዎችን ለማየት ፈቃድ የለዎትም።',
  'Unable to load college requests.': 'የኮሌጅ ጥያቄዎችን መጫን አልተቻለም።',
  'Loading asset requests...': 'የንብረት ጥያቄዎችን በመጫን ላይ...',
  Retry: 'እንደገና ሞክር',
  'College Manager': 'የኮሌጅ አስተዳዳሪ',
  'Asset Requests': 'የንብረት ጥያቄዎች',
  'Manage asset requests within your college.': 'በኮሌጅዎ ውስጥ የንብረት ጥያቄዎችን ያስተዳድሩ።',
  Refresh: 'አድስ',
  'Request summary': 'የጥያቄ ማጠቃለያ',
  'Total Requests': 'ጠቅላላ ጥያቄዎች',
  'Request filters': 'የጥያቄ ማጣሪያዎች',
  'Search requests': 'ጥያቄዎችን ይፈልጉ',
  'Search ID, requester, item, department...': 'መለያ፣ ጠያቂ፣ እቃ ወይም ዲፓርትመንት ይፈልጉ...',
  'Create Request': 'ጥያቄ ፍጠር',
  Pending: 'በመጠባበቅ ላይ',
  Approved: 'ጸድቋል',
  Rejected: 'ውድቅ ተደርጓል',
  Cancelled: 'ተሰርዟል',
  Submitted: 'ገብቷል',
  'Under Review': 'በግምገማ ላይ',
  'Changes Requested': 'ለማሻሻያ ተመልቷል',
  Escalated: 'ወደ ከፍተኛ ደረጃ ተላክ',
  Completed: 'ተጠናቋል',
  low: 'ዝቅተኛ',
  medium: 'መካከለኛ',
  high: 'ከፍተኛ',
  urgent: 'አስቸኳይ',
  critical: 'አስቸኳይ',
  Status: 'ሁኔታ',
  Department: 'ዲፓርትመንት',
  Priority: 'ቅድሚያ',
  'All statuses': 'ሁሉም ሁኔታዎች',
  'All departments': 'ሁሉም ዲፓርትመንቶች',
  'All priorities': 'ሁሉም ቅድሚያዎች',
  'Clear Filters': 'ማጣሪያዎችን አጽዳ',
  'No requests match your filters': 'ከማጣሪያዎችዎ ጋር የሚዛመድ ጥያቄ የለም',
  'No requests found': 'ምንም ጥያቄ አልተገኘም',
  'No requests match your current filters.': 'ከአሁኑ ማጣሪያዎች ጋር የሚዛመድ ጥያቄ የለም።',
  'No asset requests found.': 'ምንም የንብረት ጥያቄ አልተገኘም።',
  'College asset requests': 'የኮሌጅ ንብረት ጥያቄዎች',
  'Request ID': 'የጥያቄ መለያ',
  'Request Title': 'የጥያቄ ርዕስ',
  Requester: 'ጠያቂ',
  Username: 'የተጠቃሚ ስም',
  Quantity: 'ብዛት',
  'Last Updated': 'የመጨረሻ ማሻሻያ',
  Actions: 'እርምጃዎች',
  'Request pages': 'የጥያቄ ገጾች',
  Previous: 'ቀዳሚ',
  Next: 'ቀጣይ',
  Page: 'ገጽ',
  of: 'ከ',
  'View details': 'ዝርዝሩን ይመልከቱ',
  'Request details': 'የጥያቄ ዝርዝር መረጃ',
  'Close request details': 'የጥያቄውን ዝርዝር ዝጋ',
  'Create asset request': 'የንብረት ጥያቄ ፍጠር',
  'Edit asset request': 'የንብረት ጥያቄ አርትዕ',
  'Close request form': 'የጥያቄ ቅጹን ዝጋ',
  'Request title': 'የጥያቄ ርዕስ',
  'Requested Item': 'የተጠየቀው እቃ',
  Category: 'ምድብ',
  'Request Date': 'የጥያቄ ቀን',
  'Requested delivery date': 'የሚፈለግበት ቀን',
  'Preferred location': 'ተመራጭ ቦታ',
  'Estimated cost': 'ግምታዊ ወጪ',
  Description: 'መግለጫ',
  'Business justification': 'የጥያቄ ምክንያት',
  'Request history': 'የጥያቄ ታሪክ',
  'Edit request': 'ጥያቄን አርትዕ',
  'Cancel request': 'ጥያቄን ሰርዝ',
  Approve: 'አጽድቅ',
  Reject: 'ውድቅ አድርግ',
  'Return for revision': 'ለማሻሻያ መልስ',
  'Request created successfully.': 'ጥያቄው በተሳካ ሁኔታ ተፈጥሯል።',
  'Request updated successfully.': 'ጥያቄው በተሳካ ሁኔታ ተሻሽሏል።',
  'Request cancelled successfully.': 'ጥያቄው በተሳካ ሁኔታ ተሰርዟል።',
  'The server returned invalid request data.': 'ከአገልጋዩ የተሳሳተ የጥያቄ መረጃ ተመልሷል።',
  'Unable to load request options.': 'የጥያቄ አማራጮችን መጫን አልተቻለም።',
  'The server returned invalid request options.': 'ከአገልጋዩ የተሳሳቱ የጥያቄ አማራጮች ተመልሰዋል።',
  'The request could not be saved.': 'ጥያቄውን ማስቀመጥ አልተቻለም።',
  Cancel: 'ሰርዝ',
  'Unable to cancel request.': 'ጥያቄውን መሰረዝ አልተቻለም።',
  'Unable to process request.': 'ጥያቄውን ማከናወን አልተቻለም።',
  'Request decision recorded.': 'የጥያቄው ውሳኔ ተመዝግቧል።',
  'College scope is not configured for this account': 'ለዚህ መለያ የኮሌጅ ወሰን አልተዋቀረም።',
  'Invalid request status filter': 'የጥያቄ ሁኔታ ማጣሪያው ትክክል አይደለም።',
  'Invalid request priority filter': 'የጥያቄ ቅድሚያ ማጣሪያው ትክክል አይደለም።',
  'Department is not part of your college': 'ዲፓርትመንቱ የኮሌጅዎ አካል አይደለም።',
  'Request date range is invalid': 'የጥያቄ ቀን ክልሉ ትክክል አይደለም።',
  'Asset request not found in your college': 'በኮሌጅዎ ውስጥ ይህ የንብረት ጥያቄ አልተገኘም።',
  'Only the request owner may edit this request': 'ይህን ጥያቄ ማርትዕ የሚችለው ባለቤቱ ብቻ ነው።',
  'Only draft or returned requests can be edited': 'ረቂቅ ወይም ለማሻሻያ የተመለሱ ጥያቄዎችን ብቻ ማርትዕ ይቻላል።',
  'Only the request owner may cancel this request': 'ይህን ጥያቄ መሰረዝ የሚችለው ባለቤቱ ብቻ ነው።',
  'This request can no longer be cancelled': 'ይህ ጥያቄ ከእንግዲህ መሰረዝ አይቻልም።',
  'Invalid request decision': 'የጥያቄው ውሳኔ ትክክል አይደለም።',
  'A reason is required for this decision': 'ለዚህ ውሳኔ ምክንያት ማስገባት ያስፈልጋል።',
  'The decision reason cannot exceed 1000 characters': 'የውሳኔ ምክንያቱ ከ1000 ቁምፊዎች መብለጥ የለበትም።',
  'A requester cannot review their own request': 'ጠያቂው የራሱን ጥያቄ መገምገም አይችልም።',
  'Only requests awaiting College Manager review can be processed': 'የኮሌጅ አስተዳዳሪ ግምገማን የሚጠብቁ ጥያቄዎች ብቻ ሊከናወኑ ይችላሉ።',
  'Select a department in your college': 'ከኮሌጅዎ ውስጥ ዲፓርትመንት ይምረጡ።',
  'A request title of 1 to 255 characters is required': 'ከ1 እስከ 255 ቁምፊዎች ያሉት የጥያቄ ርዕስ ያስፈልጋል።',
  'An item name of 1 to 255 characters is required': 'ከ1 እስከ 255 ቁምፊዎች ያሉት የእቃ ስም ያስፈልጋል።',
  'Preferred location cannot exceed 255 characters': 'ተመራጭ ቦታው ከ255 ቁምፊዎች መብለጥ የለበትም።',
  'Description cannot exceed 5000 characters': 'መግለጫው ከ5000 ቁምፊዎች መብለጥ የለበትም።',
  'An asset category is required': 'የንብረት ምድብ ማስገባት ያስፈልጋል።',
  'Select an active asset category': 'ንቁ የንብረት ምድብ ይምረጡ።',
  'Business justification is required': 'የንግድ ምክንያት ማስገባት ያስፈልጋል።',
  'Business justification cannot exceed 5000 characters': 'የንግድ ምክንያቱ ከ5000 ቁምፊዎች መብለጥ የለበትም።',
  'Quantity must be a positive whole number': 'ብዛቱ ከዜሮ በላይ የሆነ ሙሉ ቁጥር መሆን አለበት።',
  'Unit of measurement is required': 'የመለኪያ አሃድ ማስገባት ያስፈልጋል።',
  'Select a valid priority': 'ትክክለኛ ቅድሚያ ይምረጡ።',
  'Estimated cost must be zero or greater': 'ግምታዊ ወጪው ዜሮ ወይም ከዚያ በላይ መሆን አለበት።',
  'Requested delivery date must be a valid YYYY-MM-DD date': 'የሚፈለግበት ቀን ትክክለኛ የYYYY-MM-DD ቅርጸት መሆን አለበት።',
  'Requested delivery date cannot be in the past': 'የሚፈለግበት ቀን ያለፈ መሆን የለበትም።',
  'Select category': 'ምድብ ይምረጡ',
  'Select department': 'ዲፓርትመንት ይምረጡ',
  'Asset category': 'የንብረት ምድብ',
  'Requesting department': 'ጥያቄ ያቀረበው ዲፓርትመንት',
  'Asset or item name': 'የንብረት ወይም እቃ ስም',
  'Requested quantity': 'የተጠየቀው ብዛት',
  'Unit of measurement': 'የመለኪያ አሃድ',
  'Submitting...': 'በማስገባት ላይ...',
  'Save changes': 'ለውጦችን አስቀምጥ',
  'Submit request': 'ጥያቄ አስገባ',
  'Loading request options...': 'የጥያቄ አማራጮችን በመጫን ላይ...',
  'From date': 'ከቀን',
  'To date': 'እስከ ቀን',
  'Sort requests': 'ጥያቄዎችን ደርድር',
  'Newest first': 'አዲሶቹን መጀመሪያ',
  'Oldest first': 'አሮጌዎቹን መጀመሪያ',
  'Create request': 'ጥያቄ ፍጠር',
  'Cancel this request?': 'ይህን ጥያቄ መሰረዝ ይፈልጋሉ?',
  'Approve this request?': 'ይህን ጥያቄ ማጽደቅ ይፈልጋሉ?',
  'Reason for rejection': 'የመከልከሉ ምክንያት',
  'Changes required': 'የሚያስፈልጉ ለውጦች',
  'This request has no active categories or departments. Contact your administrator.': 'ለዚህ ጥያቄ ንቁ ምድቦች ወይም ዲፓርትመንቶች የሉም። አስተዳዳሪዎን ያነጋግሩ።',
  'Low': 'ዝቅተኛ',
  'Medium': 'መካከለኛ',
  'High': 'ከፍተኛ',
  'Urgent': 'አስቸኳይ',
  'Critical': 'አስቸኳይ',
};

const CollegeRequests = () => {
  const { language } = useLanguage();
  const auth = useAuth() || {};
  const role = String(auth.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const canCreate = role === 'college_manager' && Boolean(auth.hasPermission?.('college.requests.create'));
  const canUpdate = role === 'college_manager' && Boolean(auth.hasPermission?.('college.requests.update'));
  const canCancel = role === 'college_manager' && Boolean(auth.hasPermission?.('college.requests.cancel'));
  const canReview = role === 'college_manager' && Boolean(auth.hasPermission?.('college.approvals.approve'));
  const translate = useCallback((value) => language === 'am' ? AMHARIC_COPY[value] || value : value, [language]);
  const [state, setState] = useState({ loading: true, tableLoading: false, error: '', requests: [], summary: emptySummary, filters: { departments: [], statuses, priorities: [] }, pagination: emptyPagination });
  const [query, setQuery] = useState({ search: '', status: '', departmentId: '', priority: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'DESC' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [formRequest, setFormRequest] = useState(undefined);
  const [processing, setProcessing] = useState(false);

  const loadRequests = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/requests', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const payload = response.data?.data;
      if (!Array.isArray(payload?.requests) || !payload.summary || !payload.filters || !payload.pagination) {
        throw new Error('The server returned invalid request data.');
      }
      setState((previous) => ({
        ...previous,
        loading: false,
        tableLoading: false,
        requests: payload.requests,
        summary: { ...emptySummary, ...payload.summary },
        filters: { ...previous.filters, ...payload.filters },
        pagination: { ...emptyPagination, ...payload.pagination },
      }));
    } catch (error) {
      const message = error.response?.status === 401 || error.response?.status === 403
        ? 'You are not authorized to view college requests.'
        : error.message || 'Unable to load college requests.';
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: translate(message) }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadRequests(!state.requests.length && state.loading), 300);
    return () => clearTimeout(timer);
  }, [page, query.search, query.status, query.departmentId, query.priority, query.dateFrom, query.dateTo, query.sortBy, query.sortOrder]);

  const updateQuery = (field, value) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: value })); };
  const clearFilters = () => { setPage(1); setQuery({ search: '', status: '', departmentId: '', priority: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'DESC' }); };
  const hasFilters = Boolean(query.search || query.status || query.departmentId || query.priority || query.dateFrom || query.dateTo);
  const pagination = state.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);
  const isOwner = (request) => Number(request.requestedBy) === Number(auth.user?.id);
  const mayEdit = (request) => canUpdate && isOwner(request) && ['Draft', 'Changes Requested'].includes(request.status);
  const mayCancel = (request) => canCancel && isOwner(request) && ['Draft', 'Submitted', 'Under Review', 'Changes Requested', 'Escalated'].includes(request.status);
  const mayReview = (request) => canReview && !isOwner(request) && pendingStatuses.includes(request.status);

  const saveForm = async (saved) => {
    setFormRequest(undefined);
    toast.success(translate(formRequest ? 'Request updated successfully.' : 'Request created successfully.'));
    setSelected(saved);
    await loadRequests();
  };

  const cancelRequest = async (request) => {
    if (!window.confirm(`${translate('Cancel this request?')} (${request.requestNumber})`)) return;
    setProcessing(true);
    try {
      await apiClient.post(`/api/college/requests/${request.id}/cancel`, {});
      toast.success(translate('Request cancelled successfully.'));
      setSelected(null);
      await loadRequests();
    } catch (error) {
      toast.error(translate(error.response?.data?.message || 'Unable to cancel request.'));
    } finally {
      setProcessing(false);
    }
  };

  const decideRequest = async (request, decision) => {
    const comment = decision === 'approve' ? '' : window.prompt(translate(decision === 'reject' ? 'Reason for rejection' : 'Changes required'));
    if (decision !== 'approve' && !String(comment || '').trim()) return;
    if (decision === 'approve' && !window.confirm(`${translate('Approve this request?')} (${request.requestNumber})`)) return;
    setProcessing(true);
    try {
      await apiClient.post(`/api/college/requests/${request.id}/${decision === 'requestChanges' ? 'request-changes' : decision}`, comment ? { reason: comment.trim() } : {});
      toast.success(translate('Request decision recorded.'));
      setSelected(null);
      await loadRequests();
    } catch (error) {
      toast.error(translate(error.response?.data?.message || 'Unable to process request.'));
    } finally {
      setProcessing(false);
    }
  };

  if (state.loading) return <div className="college-requests-state" aria-busy="true"><RefreshCw className="college-requests-spin" /> {translate('Loading asset requests...')}</div>;
  if (state.error) return <div className="college-requests-state college-requests-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => loadRequests(true)}><RefreshCw size={16} /> {translate('Retry')}</button></div>;

  return (
    <div className="college-requests-page">
      <header className="college-requests-heading">
        <div><span className="college-requests-eyebrow"><FileText size={15} /> {translate('College Manager')}</span><h1>{translate('Asset Requests')}</h1><p>{translate('Manage asset requests within your college.')}</p></div>
        <div className="college-requests-header-actions">
          {canCreate && <button className="college-requests-create" type="button" onClick={() => setFormRequest(null)}><Plus size={16} /> {translate('Create Request')}</button>}
          <button className="college-requests-refresh" type="button" onClick={() => loadRequests()} disabled={state.tableLoading}><RefreshCw size={16} className={state.tableLoading ? 'college-requests-spin' : ''} /> {translate('Refresh')}</button>
        </div>
      </header>
      <section className="college-requests-summary" aria-label={translate('Request summary')}>
        {[
          ['total', 'Total Requests'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled'],
        ].map(([key, title]) => <div className="college-requests-stat" key={key}><span>{translate(title)}</span><strong>{Number(state.summary[key] || 0).toLocaleString(language === 'am' ? 'am-ET' : undefined)}</strong></div>)}
      </section>
      <section className="college-requests-toolbar" aria-label={translate('Request filters')}>
        <label className="college-requests-search"><Search size={17} /><span className="sr-only">{translate('Search requests')}</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder={translate('Search ID, requester, item, department...')} /></label>
        <label><span className="sr-only">{translate('Status')}</span><select aria-label={translate('Status')} value={query.status} onChange={(event) => updateQuery('status', event.target.value)}><option value="">{translate('All statuses')}</option>{(state.filters.statuses || statuses).map((value) => <option value={value} key={value}>{translate(label(value))}</option>)}</select></label>
        <label><span className="sr-only">{translate('Department')}</span><select aria-label={translate('Department')} value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}><option value="">{translate('All departments')}</option>{(state.filters.departments || []).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label>
        <label><span className="sr-only">{translate('Priority')}</span><select aria-label={translate('Priority')} value={query.priority} onChange={(event) => updateQuery('priority', event.target.value)}><option value="">{translate('All priorities')}</option>{['low', 'medium', 'high', 'urgent', 'critical'].map((value) => <option value={value} key={value}>{translate(label(value))}</option>)}</select></label>
        <label><span className="sr-only">{translate('From date')}</span><input aria-label={translate('From date')} type="date" value={query.dateFrom} onChange={(event) => updateQuery('dateFrom', event.target.value)} /></label>
        <label><span className="sr-only">{translate('To date')}</span><input aria-label={translate('To date')} type="date" value={query.dateTo} onChange={(event) => updateQuery('dateTo', event.target.value)} /></label>
        <label><span className="sr-only">{translate('Sort requests')}</span><select aria-label={translate('Sort requests')} value={`${query.sortBy}:${query.sortOrder}`} onChange={(event) => { const [sortBy, sortOrder] = event.target.value.split(':'); setQuery((previous) => ({ ...previous, sortBy, sortOrder })); }}><option value="createdAt:DESC">{translate('Newest first')}</option><option value="createdAt:ASC">{translate('Oldest first')}</option><option value="priority:DESC">{translate('Priority')}</option><option value="status:ASC">{translate('Status')}</option></select></label>
        {hasFilters && <button className="college-requests-clear" type="button" onClick={clearFilters}><X size={15} /> {translate('Clear Filters')}</button>}
      </section>
      <section className="college-requests-table-panel">
        <div className="college-requests-table-meta"><strong>{pagination.total ? language === 'am' ? `ከ${pagination.total} ጥያቄዎች ${first}-${last} በማሳየት ላይ` : `Showing ${first}-${last} of ${pagination.total} requests` : translate(hasFilters ? 'No requests match your filters' : 'No requests found')}</strong>{state.tableLoading && <RefreshCw size={15} className="college-requests-spin" />}</div>
        {state.requests.length ? (
          <div className="college-requests-table-wrap">
            <table>
              <caption className="sr-only">{translate('College asset requests')}</caption>
              <thead><tr>{['Request ID', 'Request Title', 'Requester', 'Department', 'Requested Item', 'Quantity', 'Priority', 'Status', 'Last Updated', 'Actions'].map((heading) => <th key={heading}>{translate(heading)}</th>)}</tr></thead>
              <tbody>{state.requests.map((request) => <tr key={request.id}>
                <td><strong>{request.requestNumber}</strong></td><td>{display(request.requestTitle, translate)}</td><td>{display(request.requester?.name, translate)}</td><td>{display(request.department?.name, translate)}</td><td>{display(request.requestedItem, translate)}</td><td>{display(`${request.quantity} ${request.unit || ''}`.trim(), translate)}</td>
                <td><span className={`college-requests-badge priority-${request.priority}`}>{translate(label(request.priority))}</span></td><td><span className={`college-requests-badge status-${String(request.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{translate(label(request.status))}</span></td><td>{date(request.updatedAt, translate)}</td>
                <td><div className="college-requests-row-actions">
                  <button className="college-requests-icon-button" type="button" onClick={() => setSelected(request)} aria-label={`${translate('View details')}: ${request.requestNumber}`} title={translate('View details')}><Eye size={17} /></button>
                  {mayEdit(request) && <button className="college-requests-icon-button" type="button" onClick={() => setFormRequest(request)} aria-label={`${translate('Edit request')}: ${request.requestNumber}`} title={translate('Edit request')}><Edit3 size={16} /></button>}
                  {mayCancel(request) && <button className="college-requests-text-button" type="button" disabled={processing} onClick={() => cancelRequest(request)}>{translate('Cancel request')}</button>}
                  {mayReview(request) && <button className="college-requests-icon-button" type="button" disabled={processing} onClick={() => decideRequest(request, 'approve')} aria-label={`${translate('Approve')}: ${request.requestNumber}`} title={translate('Approve')}><Check size={16} /></button>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <div className="college-requests-empty"><FileText size={30} /><strong>{translate(hasFilters ? 'No requests match your current filters.' : 'No asset requests found.')}</strong>{canCreate && <button type="button" onClick={() => setFormRequest(null)}><Plus size={16} /> {translate('Create Request')}</button>}{hasFilters && <button type="button" onClick={clearFilters}>{translate('Clear Filters')}</button>}</div>}
        <nav className="college-requests-pagination" aria-label={translate('Request pages')}><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>{translate('Previous')}</button><span>{translate('Page')} {pagination.page} {translate('of')} {Math.max(1, pagination.totalPages || 1)}</span><button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>{translate('Next')}</button></nav>
      </section>
      {selected && (
        <div className="college-requests-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="college-requests-modal" role="dialog" aria-modal="true" aria-labelledby="college-request-details-title">
            <div className="college-requests-modal-head"><div><span className="college-requests-eyebrow">{translate('Request details')}</span><h2 id="college-request-details-title">{selected.requestNumber}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label={translate('Close request details')}><X /></button></div>
            <div className="college-requests-details">{[
              ['Request Title', selected.requestTitle], ['Requested Item', selected.requestedItem], ['Category', selected.category], ['Request Date', date(selected.createdAt, translate)], ['Status', translate(label(selected.status))], ['Priority', translate(label(selected.priority))], ['Requester', selected.requester?.name], ['Username', selected.requester?.username], ['Department', selected.department?.name], ['Quantity', `${selected.quantity} ${selected.unit || ''}`], ['Requested delivery date', selected.neededBy], ['Preferred location', selected.preferredLocation], ['Estimated cost', selected.estimatedValue], ['Last Updated', date(selected.updatedAt, translate)],
            ].map(([title, value]) => <div key={title}><span>{translate(title)}</span><strong>{display(value, translate)}</strong></div>)}</div>
            <div className="college-requests-description"><span>{translate('Description')}</span><p>{display(selected.description, translate)}</p></div>
            <div className="college-requests-description"><span>{translate('Business justification')}</span><p>{display(selected.justification, translate)}</p></div>
            {selected.history?.length > 0 && <div className="college-requests-history"><h3>{translate('Request history')}</h3>{selected.history.map((item) => <article key={item.id}><strong>{translate(label(item.newStatus))}</strong><span>{display(item.changedByName, translate)} · {date(item.createdAt, translate)}</span><p>{item.comment}</p></article>)}</div>}
            {mayReview(selected) && <div className="college-requests-decision-actions"><button type="button" disabled={processing} onClick={() => decideRequest(selected, 'approve')}>{translate('Approve')}</button><button type="button" disabled={processing} onClick={() => decideRequest(selected, 'reject')}>{translate('Reject')}</button><button type="button" disabled={processing} onClick={() => decideRequest(selected, 'requestChanges')}>{translate('Return for revision')}</button></div>}
            {mayEdit(selected) && <button type="button" className="college-requests-text-button" onClick={() => { setFormRequest(selected); setSelected(null); }}>{translate('Edit request')}</button>}
            {mayCancel(selected) && <button type="button" className="college-requests-text-button" disabled={processing} onClick={() => cancelRequest(selected)}>{translate('Cancel request')}</button>}
          </section>
        </div>
      )}
      {formRequest !== undefined && <CollegeAssetRequestForm request={formRequest || null} onClose={() => setFormRequest(undefined)} onSaved={saveForm} translate={translate} />}
    </div>
  );
};

export default CollegeRequests;
