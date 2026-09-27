import React, { useEffect, useState } from 'react';
import { Eye, FileText, RefreshCw, Search, X } from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import './CollegeRequests.css';

const statuses = ['pending', 'approved', 'rejected', 'cancelled'];
const emptySummary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
const emptyPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value, translate) => value === null || value === undefined || value === '' ? translate('Not recorded') : value;
const date = (value, translate) => value ? new Date(value).toLocaleString() : translate('Not recorded');
const AMHARIC_COPY = {
  pending: 'በመጠባበቅ ላይ', Pending: 'በመጠባበቅ ላይ', approved: 'ጸድቋል', Approved: 'ጸድቋል', rejected: 'ውድቅ ተደርጓል', Rejected: 'ውድቅ ተደርጓል', cancelled: 'ተሰርዟል', Cancelled: 'ተሰርዟል', low: 'ዝቅተኛ', Low: 'ዝቅተኛ', medium: 'መካከለኛ', Medium: 'መካከለኛ', high: 'ከፍተኛ', High: 'ከፍተኛ', critical: 'አስቸኳይ', Critical: 'አስቸኳይ',
  'Not recorded': 'አልተመዘገበም', 'You are not authorized to view college requests.': 'የኮሌጅ ጥያቄዎችን ለማየት ፈቃድ የለዎትም።', 'Unable to load college requests.': 'የኮሌጅ ጥያቄዎችን መጫን አልተቻለም።', 'Loading asset requests...': 'የንብረት ጥያቄዎችን በመጫን ላይ...', Retry: 'እንደገና ሞክር',
  'College Manager': 'የኮሌጅ አስተዳዳሪ', 'Asset Requests': 'የንብረት ጥያቄዎች', 'Manage asset requests within your college.': 'በኮሌጅዎ ውስጥ የንብረት ጥያቄዎችን ያስተዳድሩ።', Refresh: 'አድስ', 'Request summary': 'የጥያቄ ማጠቃለያ', 'Total Requests': 'ጠቅላላ ጥያቄዎች', 'Request filters': 'የጥያቄ ማጣሪያዎች', 'Search requests': 'ጥያቄዎችን ይፈልጉ', 'Search ID, requester, item, department...': 'መለያ፣ ጠያቂ፣ እቃ ወይም ዲፓርትመንት ይፈልጉ...',
  Status: 'ሁኔታ', Department: 'ዲፓርትመንት', Priority: 'ቅድሚያ', 'All statuses': 'ሁሉም ሁኔታዎች', 'All departments': 'ሁሉም ዲፓርትመንቶች', 'All priorities': 'ሁሉም ቅድሚያዎች', 'Clear Filters': 'ማጣሪያዎችን አጽዳ',
  'No requests match your filters': 'ከማጣሪያዎችዎ ጋር የሚዛመድ ጥያቄ የለም', 'No requests found': 'ምንም ጥያቄ አልተገኘም', 'No requests match your current filters.': 'ከአሁኑ ማጣሪያዎች ጋር የሚዛመድ ጥያቄ የለም።', 'No asset requests found.': 'ምንም የንብረት ጥያቄ አልተገኘም።', 'College asset requests': 'የኮሌጅ ንብረት ጥያቄዎች',
  'Request ID': 'የጥያቄ መለያ', Date: 'ቀን', Requester: 'ጠያቂ', 'Requested Item': 'የተጠየቀው እቃ', Quantity: 'ብዛት', 'Last Updated': 'የመጨረሻ ማሻሻያ', Actions: 'እርምጃዎች', 'Request pages': 'የጥያቄ ገጾች', Previous: 'ቀዳሚ', Next: 'ቀጣይ', Page: 'ገጽ', of: 'ከ', 'View details': 'ዝርዝሩን ይመልከቱ', 'Request details': 'የጥያቄ ዝርዝር መረጃ', 'Close request details': 'የጥያቄውን ዝርዝር ዝጋ',
  'Request Date': 'የጥያቄ ቀን', Type: 'አይነት', Username: 'የተጠቃሚ ስም', Category: 'ምድብ', 'Reviewed By': 'የገመገመው', Reason: 'ምክንያት'
};

const CollegeRequests = () => {
  const { language } = useLanguage();
  const translate = (value) => language === 'am' ? AMHARIC_COPY[value] || AMHARIC_COPY[String(value).toLowerCase()] || value : value;
  const [state, setState] = useState({ loading: true, tableLoading: false, error: '', requests: [], summary: emptySummary, filters: { departments: [], statuses }, pagination: emptyPagination });
  const [query, setQuery] = useState({ search: '', status: '', departmentId: '', priority: '', requestType: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadRequests = async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/requests', { params: { ...query, page, limit: 20, search: query.search || undefined } });
      const payload = response.data?.data || {};
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, requests: payload.requests || [], summary: payload.summary || emptySummary, filters: payload.filters || previous.filters, pagination: payload.pagination || emptyPagination }));
    } catch (error) {
      const message = error.response?.status === 403 ? 'You are not authorized to view college requests.' : 'Unable to load college requests.';
      setState((previous) => ({ ...previous, loading: false, tableLoading: false, error: translate(message) }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadRequests(!state.requests.length && state.loading), 300);
    return () => clearTimeout(timer);
  }, [page, query.search, query.status, query.departmentId, query.priority, query.requestType]);

  const updateQuery = (field, value) => { setPage(1); setQuery((previous) => ({ ...previous, [field]: value })); };
  const clearFilters = () => { setPage(1); setQuery({ search: '', status: '', departmentId: '', priority: '', requestType: '' }); };
  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  if (state.loading) return <div className="college-requests-state" aria-busy="true"><RefreshCw className="college-requests-spin" /> {translate('Loading asset requests...')}</div>;
  if (state.error) return <div className="college-requests-state college-requests-error" role="alert"><strong>{state.error}</strong><button type="button" onClick={() => loadRequests(true)}><RefreshCw size={16} /> {translate('Retry')}</button></div>;

  return <div className="college-requests-page">
    <header className="college-requests-heading"><div><span className="college-requests-eyebrow"><FileText size={15} /> {translate('College Manager')}</span><h1>{translate('Asset Requests')}</h1><p>{translate('Manage asset requests within your college.')}</p></div><button className="college-requests-refresh" type="button" onClick={() => loadRequests()} disabled={state.tableLoading}><RefreshCw size={16} className={state.tableLoading ? 'college-requests-spin' : ''} /> {translate('Refresh')}</button></header>
    <section className="college-requests-summary" aria-label={translate('Request summary')}>{[['total', 'Total Requests'], ...statuses.map((value) => [value, label(value)])].map(([key, title]) => <div className="college-requests-stat" key={key}><span>{translate(title)}</span><strong>{Number(state.summary[key] || 0).toLocaleString(language === 'am' ? 'am-ET' : undefined)}</strong></div>)}</section>
    <section className="college-requests-toolbar" aria-label={translate('Request filters')}><label className="college-requests-search"><Search size={17} /><span className="sr-only">{translate('Search requests')}</span><input value={query.search} onChange={(event) => updateQuery('search', event.target.value)} placeholder={translate('Search ID, requester, item, department...')} /></label><label><span className="sr-only">{translate('Status')}</span><select aria-label={translate('Status')} value={query.status} onChange={(event) => updateQuery('status', event.target.value)}><option value="">{translate('All statuses')}</option>{(state.filters.statuses || statuses).map((value) => <option value={value} key={value}>{translate(label(value))}</option>)}</select></label><label><span className="sr-only">{translate('Department')}</span><select aria-label={translate('Department')} value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}><option value="">{translate('All departments')}</option>{(state.filters.departments || []).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label><label><span className="sr-only">{translate('Priority')}</span><select aria-label={translate('Priority')} value={query.priority} onChange={(event) => updateQuery('priority', event.target.value)}><option value="">{translate('All priorities')}</option>{['low', 'medium', 'high', 'critical'].map((value) => <option value={value} key={value}>{translate(label(value))}</option>)}</select></label>{hasFilters && <button className="college-requests-clear" type="button" onClick={clearFilters}><X size={15} /> {translate('Clear Filters')}</button>}</section>
    <section className="college-requests-table-panel">
      <div className="college-requests-table-meta"><strong>{pagination.total ? language === 'am' ? `ከ${pagination.total} ጥያቄዎች ${first}-${last} በማሳየት ላይ` : `Showing ${first}-${last} of ${pagination.total} requests` : translate(hasFilters ? 'No requests match your filters' : 'No requests found')}</strong>{state.tableLoading && <RefreshCw size={15} className="college-requests-spin" />}</div>
      {state.requests.length ? <div className="college-requests-table-wrap"><table>
        <caption className="sr-only">{translate('College asset requests')}</caption>
        <thead><tr>{['Request ID', 'Date', 'Requester', 'Department', 'Requested Item', 'Quantity', 'Priority', 'Status', 'Last Updated', 'Actions'].map((heading) => <th key={heading}>{translate(heading)}</th>)}</tr></thead>
        <tbody>{state.requests.map((request) => <tr key={request.id}><td><strong>{request.requestNumber}</strong></td><td>{date(request.createdAt, translate)}</td><td>{display(request.requester?.name, translate)}</td><td>{display(request.department?.name, translate)}</td><td>{display(request.item || request.asset?.name, translate)}{request.asset?.assetCode && <small>{request.asset.assetCode}</small>}</td><td>{display(request.quantity, translate)}</td><td><span className={`college-requests-badge priority-${request.priority}`}>{translate(label(request.priority))}</span></td><td><span className={`college-requests-badge status-${request.status}`}>{translate(label(request.status))}</span></td><td>{date(request.updatedAt, translate)}</td><td><button className="college-requests-icon-button" type="button" onClick={() => setSelected(request)} aria-label={`${translate('View details')}: ${request.requestNumber}`} title={translate('View details')}><Eye size={17} /></button></td></tr>)}</tbody>
      </table></div> : <div className="college-requests-empty"><FileText size={30} /><strong>{translate(hasFilters ? 'No requests match your current filters.' : 'No asset requests found.')}</strong>{hasFilters && <button type="button" onClick={clearFilters}>{translate('Clear Filters')}</button>}</div>}
      <nav className="college-requests-pagination" aria-label={translate('Request pages')}><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>{translate('Previous')}</button><span>{translate('Page')} {pagination.page} {translate('of')} {Math.max(1, pagination.totalPages || 1)}</span><button type="button" disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>{translate('Next')}</button></nav>
    </section>
    {selected && <div className="college-requests-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="college-requests-modal" role="dialog" aria-modal="true" aria-labelledby="college-request-details-title"><div className="college-requests-modal-head"><div><span className="college-requests-eyebrow">{translate('Request details')}</span><h2 id="college-request-details-title">{selected.requestNumber}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label={translate('Close request details')}><X /></button></div><div className="college-requests-details">{[['Request Date', date(selected.createdAt, translate)], ['Type', translate(label(selected.type))], ['Status', translate(label(selected.status))], ['Priority', translate(label(selected.priority))], ['Requester', display(selected.requester?.name, translate)], ['Username', display(selected.requester?.username, translate)], ['Department', display(selected.department?.name, translate)], ['Requested Item', display(selected.item || selected.asset?.name, translate)], ['Category', display(selected.asset?.category, translate)], ['Quantity', display(selected.quantity, translate)], ['Last Updated', date(selected.updatedAt, translate)], ['Reviewed By', display(selected.reviewer?.name, translate)]].map(([title, value]) => <div key={title}><span>{translate(title)}</span><strong>{value}</strong></div>)}</div><div className="college-requests-description"><span>{translate('Reason')}</span><p>{display(selected.reason, translate)}</p></div></section></div>}
  </div>;
};

export default CollegeRequests;