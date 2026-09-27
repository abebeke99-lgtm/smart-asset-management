import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';

const stateLabelMap = {
  verified: 'Verified',
  missing: 'Missing',
  wrong_location: 'Wrong location',
  damaged: 'Damaged',
  unidentified: 'Unidentified',
  needs_review: 'Needs review',
  pending: 'Pending',
  draft: 'Draft',
  in_progress: 'In progress',
  submitted: 'Submitted',
  finalized: 'Finalized',
};

const statusBadges = {
  verified: 'status-success',
  missing: 'status-danger',
  wrong_location: 'status-warning',
  damaged: 'status-warning',
  unidentified: 'status-warning',
  needs_review: 'status-warning',
  pending: 'status-muted',
  draft: 'status-muted',
  in_progress: 'status-info',
  submitted: 'status-info',
  finalized: 'status-success',
};

const formatDate = (value, language) => value ? new Date(value).toLocaleString(language === 'am' ? 'am-ET' : undefined) : '—';
const safeValue = (value) => value === null || value === undefined || value === '' ? '—' : value;
const AMHARIC_COPY = {
  Verified: 'ተረጋግጧል', Missing: 'ጠፍቷል', 'Wrong location': 'በተሳሳተ ቦታ ነው', Damaged: 'ተጎድቷል', Unidentified: 'ያልታወቀ', 'Needs review': 'ግምገማ ያስፈልጋል', Pending: 'በመጠባበቅ ላይ', Draft: 'ረቂቅ', 'In progress': 'በሂደት ላይ', Submitted: 'ቀርቧል', Finalized: 'ተጠናቋል',
  'Loading verification data...': 'የማረጋገጫ መረጃን በመጫን ላይ...', 'Failed to load verification data.': 'የማረጋገጫ መረጃን መጫን አልተቻለም።', Retry: 'እንደገና ሞክር', 'Verification Overview': 'የማረጋገጫ አጠቃላይ እይታ', 'Physical verification for the authorized college': 'ለተፈቀደው ኮሌጅ አካላዊ ማረጋገጫ', Refresh: 'አድስ', 'Refreshing...': 'በማደስ ላይ...',
  'Total Assets': 'ጠቅላላ ንብረቶች', 'Not Found': 'አልተገኘም', Discrepancies: 'ልዩነቶች', Sessions: 'ክፍለ ጊዜዎች', 'Verification KPI cards': 'የማረጋገጫ መለኪያዎች', 'Verification filters': 'የማረጋገጫ ማጣሪያዎች', 'Search asset code, asset tag, name or department': 'የንብረት ኮድ፣ መለያ፣ ስም ወይም ዲፓርትመንት ይፈልጉ', 'Search verification assets': 'የማረጋገጫ ንብረቶችን ይፈልጉ',
  'All departments': 'ሁሉም ዲፓርትመንቶች', 'All statuses': 'ሁሉም ሁኔታዎች', 'All asset statuses': 'ሁሉም የንብረት ሁኔታዎች', 'All locations': 'ሁሉም ቦታዎች', 'Clear Filters': 'ማጣሪያዎችን አጽዳ', 'Verification Sessions': 'የማረጋገጫ ክፍለ ጊዜዎች', total: 'ጠቅላላ', 'No verification sessions found.': 'ምንም የማረጋገጫ ክፍለ ጊዜ አልተገኘም።',
  'Session ID': 'የክፍለ ጊዜ መለያ', Date: 'ቀን', Department: 'ዲፓርትመንት', 'Started By': 'የጀመረው', 'Total Items': 'ጠቅላላ እቃዎች', Status: 'ሁኔታ', Actions: 'እርምጃዎች', View: 'ይመልከቱ', 'Asset status': 'የንብረት ሁኔታ', Available: 'ያለ', Good: 'ጥሩ', Fair: 'መካከለኛ', Poor: 'ደካማ',
  'Verification Status': 'የማረጋገጫ ሁኔታ', Previous: 'ቀዳሚ', Next: 'ቀጣይ', Page: 'ገጽ', of: 'ከ', 'Verification session details': 'የማረጋገጫ ክፍለ ጊዜ ዝርዝር መረጃ', Close: 'ዝጋ', 'Loading session details...': 'የክፍለ ጊዜ ዝርዝሩን በመጫን ላይ...', 'Verification items': 'የማረጋገጫ እቃዎች', Asset: 'ንብረት', 'Asset Tag': 'የንብረት መለያ', Condition: 'ሁኔታ', Notes: 'ማስታወሻዎች', 'No items recorded for this session.': 'ለዚህ ክፍለ ጊዜ ምንም እቃ አልተመዘገበም።'
};

const CollegeVerification = () => {
  const { language } = useLanguage();
  const translate = (value) => language === 'am' ? AMHARIC_COPY[value] || value : value;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalAssets: 0, verified: 0, pending: 0, notFound: 0, discrepancies: 0, sessions: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, pages: 1 });
  const [filters, setFilters] = useState({ departments: [], statuses: [], locations: [], assetStatuses: [] });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', assetStatus: '', location: '' });
  const [page, setPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadVerification = useCallback(async (showLoader = true, requestedPage = page) => {
    try {
      if (showLoader) setLoading(true);
      setError('');
      const response = await apiClient.get('/api/college/verification', {
        params: {
          page: requestedPage,
          limit: pagination.limit,
          ...query,
          search: query.search || undefined,
          departmentId: query.departmentId || undefined,
          status: query.status || undefined,
          assetStatus: query.assetStatus || undefined,
          locationId: query.location || undefined,
        },
      });
      const payload = response.data?.data || {};
      const rows = payload.sessions || [];
      setItems(rows);
      setSummary((current) => payload.summary || current);
      setFilters((current) => payload.filters || current);
      setPagination((current) => payload.pagination || current);
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Failed to load verification data.';
      setError(language === 'am' ? AMHARIC_COPY['Failed to load verification data.'] : message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language, page, pagination.limit, query]);

  useEffect(() => {
    const timer = setTimeout(() => loadVerification(true, page), 250);
    return () => clearTimeout(timer);
  }, [loadVerification, page]);

  const hasFilters = Object.values(query).some(Boolean);

  const stats = useMemo(() => [
    { label: 'Total Assets', value: summary.totalAssets },
    { label: 'Verified', value: summary.verified },
    { label: 'Pending', value: summary.pending },
    { label: 'Not Found', value: summary.notFound },
    { label: 'Discrepancies', value: summary.discrepancies },
    { label: 'Sessions', value: summary.sessions },
  ], [summary]);

  const handleFilterChange = (field, value) => {
    const nextValue = value === 'All' ? '' : value;
    setPage(1);
    setQuery((current) => ({ ...current, [field]: nextValue }));
  };

  const clearFilters = () => { setPage(1); setQuery({ search: '', departmentId: '', status: '', assetStatus: '', location: '' }); };

  const refresh = () => {
    setRefreshing(true);
    loadVerification(false, page);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
  };

  const openSession = async (sessionId) => {
    setSelectedSession(null);
    setDetailLoading(true);
    setDetailError('');
    try {
      const response = await apiClient.get(`/api/college/verification/${sessionId}`);
      setSelectedSession(response.data?.data || null);
    } catch (requestError) {
      setDetailError(language === 'am' ? 'የክፍለ ጊዜውን ዝርዝር መጫን አልተቻለም።' : requestError.response?.data?.message || 'Unable to load verification session details.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div className="college-verification-state" aria-busy="true"><RefreshCw className="college-verification-spin" /><span>{translate('Loading verification data...')}</span></div>;
  }

  if (error) {
    return <div className="college-verification-state college-verification-error" role="alert"><AlertTriangle size={18} /><div><strong>{error}</strong><button type="button" onClick={() => loadVerification(true, page)}>{translate('Retry')}</button></div></div>;
  }

  const totalPages = Math.max(1, pagination.totalPages || pagination.pages || 1);

  return (
    <div className="college-verification-page">
      <header className="college-verification-header">
        <div>
          <p className="college-verification-eyebrow"><ShieldCheck size={15} /> {translate('Verification Overview')}</p>
          <h3>{translate('Physical verification for the authorized college')}</h3>
        </div>
        <button type="button" className="college-verification-refresh" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {translate(refreshing ? 'Refreshing...' : 'Refresh')}
        </button>
      </header>

      <section className="college-verification-kpis" aria-label={translate('Verification KPI cards')}>
        {stats.map((stat) => <div key={stat.label} className="college-verification-kpi"><span>{translate(stat.label)}</span><strong>{stat.value}</strong></div>)}
      </section>

      <section className="college-verification-toolbar" aria-label={translate('Verification filters')}>
        <form onSubmit={handleSearch} className="college-verification-search">
          <Search size={16} />
          <input value={query.search} onChange={(event) => { setPage(1); setQuery((current) => ({ ...current, search: event.target.value })); }} placeholder={translate('Search asset code, asset tag, name or department')} aria-label={translate('Search verification assets')} />
        </form>
        <select value={query.departmentId} onChange={(event) => handleFilterChange('departmentId', event.target.value)} aria-label={translate('Department')}>
          <option value="">{translate('All departments')}</option>
          {filters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <select value={query.status} onChange={(event) => handleFilterChange('status', event.target.value)} aria-label={translate('Status')}>
          <option value="">{translate('All statuses')}</option>
          {filters.statuses.map((status) => <option key={status} value={status}>{translate(stateLabelMap[status] || status)}</option>)}
        </select>
        <select value={query.assetStatus} onChange={(event) => handleFilterChange('assetStatus', event.target.value)} aria-label={translate('Asset status')}>
          <option value="">{translate('All asset statuses')}</option>
          {filters.assetStatuses.map((status) => <option key={status} value={status}>{translate(stateLabelMap[status] || status)}</option>)}
        </select>
        <select value={query.location} onChange={(event) => handleFilterChange('location', event.target.value)} aria-label={translate('Location')}>
          <option value="">{translate('All locations')}</option>
          {filters.locations.map((location) => <option key={location} value={location}>{location}</option>)}
        </select>
        {hasFilters && <button type="button" className="college-verification-clear" onClick={clearFilters}>{translate('Clear Filters')}</button>}
      </section>

      <section className="college-verification-panel">
        <div className="college-verification-panel-header"><h4>{translate('Verification Sessions')}</h4><span>{pagination.total} {translate('total')}</span></div>
        {items.length === 0 ? <div className="college-verification-empty">{translate('No verification sessions found.')}</div> : (
          <div className="college-verification-table-wrap">
            <table className="college-verification-table">
              <thead><tr>{['Session ID', 'Date', 'Department', 'Started By', 'Total Items', 'Verified', 'Pending', 'Status', 'Actions'].map((heading) => <th key={heading}>{translate(heading)}</th>)}</tr></thead>
              <tbody>{items.map((session) => (
                <tr key={session.id}>
                  <td>#{session.id}</td><td>{formatDate(session.createdAt, language)}</td><td>{safeValue(session.Department?.name || session.department?.name)}</td>
                  <td>{safeValue(session.Starter?.fullName || session.Starter?.username || session.startedBy)}</td><td>{session.totalItems || 0}</td><td>{session.verified || 0}</td><td>{session.pending || 0}</td>
                  <td><span className={`status-pill ${statusBadges[session.status] || 'status-muted'}`}>{translate(stateLabelMap[session.status] || session.status)}</span></td>
                  <td><button type="button" className="college-verification-action" onClick={() => openSession(session.id)} disabled={detailLoading}>{translate('View')}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="college-verification-panel secondary">
        <div className="college-verification-panel-header"><h4>{translate('Verification Status')}</h4></div>
        <div className="college-verification-status-list">{['verified', 'pending', 'missing', 'wrong_location', 'damaged', 'needs_review'].map((code) => (
          <div key={code} className="college-verification-status-item"><span className={`status-pill ${statusBadges[code] || 'status-muted'}`}>{translate(stateLabelMap[code] || code)}</span><strong>{code === 'verified' ? summary.verified : code === 'pending' ? summary.pending : code === 'missing' ? summary.notFound : summary.discrepancies}</strong></div>
        ))}</div>
      </section>

      <div className="college-verification-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{translate('Previous')}</button>
        <span>{translate('Page')} {pagination.page} {translate('of')} {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{translate('Next')}</button>
      </div>

      {(detailLoading || selectedSession || detailError) && <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && (setSelectedSession(null), setDetailError(''))} style={{ position: 'fixed', zIndex: 1000, inset: 0, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, .52)' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="verification-session-title" style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 22, borderRadius: 8, background: '#fff', color: '#0f172a' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
            <div><h2 id="verification-session-title">{translate('Verification session details')} {selectedSession?.id ? `#${selectedSession.id}` : ''}</h2>{selectedSession && <p>{selectedSession.name} · {translate(stateLabelMap[selectedSession.status] || selectedSession.status)}</p>}</div>
            <button type="button" onClick={() => { setSelectedSession(null); setDetailError(''); }} aria-label={translate('Close')}>×</button>
          </header>
          {detailLoading ? <p aria-busy="true">{translate('Loading session details...')}</p> : detailError ? <p role="alert">{detailError}</p> : <>
            <h3>{translate('Verification items')}</h3>
            {selectedSession?.VerificationItems?.length ? <div style={{ overflowX: 'auto' }}><table><thead><tr>{['Asset', 'Asset Tag', 'Status', 'Condition', 'Notes'].map((heading) => <th key={heading}>{translate(heading)}</th>)}</tr></thead><tbody>
              {selectedSession.VerificationItems.map((item) => <tr key={item.id}><td>{safeValue(item.Asset?.name)}</td><td>{safeValue(item.Asset?.assetCode)}</td><td>{translate(stateLabelMap[item.state] || item.state)}</td><td>{translate(stateLabelMap[item.Asset?.condition] || item.Asset?.condition)}</td><td>{safeValue(item.notes)}</td></tr>)}
            </tbody></table></div> : <p>{translate('No items recorded for this session.')}</p>}
          </>}
        </section>
      </div>}
    </div>
  );
};

export default CollegeVerification;
