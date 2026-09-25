import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Clock3, FileText, Filter, History, RefreshCw, Search, X } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import { getAssetHistory, getAssetHistoryByAsset } from '../../services/ictAssetHistoryService';

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';
const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${displayValue(item)}`).join(' | ');
  return String(value);
};
const eventTone = (eventType = '') => {
  const type = eventType.toLowerCase();
  if (type.includes('assign')) return 'history-badge history-badge-blue';
  if (type.includes('maintenance') || type.includes('repair')) return 'history-badge history-badge-amber';
  if (type.includes('rfid') || type.includes('qr')) return 'history-badge history-badge-teal';
  if (type.includes('delete') || type.includes('dispose')) return 'history-badge history-badge-red';
  return 'history-badge history-badge-slate';
};

const ICTAssetHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: legacyAssetId } = useParams();
  const assetId = searchParams.get('assetId') || legacyAssetId || '';
  const [filters, setFilters] = useState({ search: searchParams.get('search') || '', eventType: '', category: '', departmentId: '', location: '', dateFrom: '', dateTo: '' });
  const [records, setRecords] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [options, setOptions] = useState({ categories: [], departments: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const query = useMemo(() => ({ ...filters, ...(assetId ? { assetId } : {}), page: pagination.page, limit: pagination.limit }), [assetId, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/ict/options').then((response) => {
      if (!mounted) return;
      const data = response.data || {};
      setOptions({ categories: data.categories || [], departments: data.departments || [] });
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      getAssetHistory(query).then((response) => {
        if (!mounted) return;
        const body = response.data || {};
        setRecords(body.data || []);
        setEventTypes(body.eventTypes || []);
        setPagination((current) => ({ ...current, ...(body.pagination || {}) }));
      }).catch((requestError) => {
        if (mounted) setError(getApiErrorMessage(requestError, 'Unable to load asset history.'));
      }).finally(() => { if (mounted) setLoading(false); });
    }, filters.search ? 350 : 0);
    return () => { mounted = false; clearTimeout(timer); };
  }, [query, filters.search]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };
  const clearFilters = () => {
    setFilters({ search: '', eventType: '', category: '', departmentId: '', location: '', dateFrom: '', dateTo: '' });
    setPagination((current) => ({ ...current, page: 1 }));
  };
  const loadHistory = () => {
    setRefreshing(true);
    getAssetHistory(query).then((response) => {
      const body = response.data || {};
      setRecords(body.data || []);
      setEventTypes(body.eventTypes || []);
      setPagination((current) => ({ ...current, ...(body.pagination || {}) }));
      setError('');
    }).catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to refresh asset history.'))).finally(() => setRefreshing(false));
  };

  useEffect(() => {
    if (!selected?.asset?.id) {
      setTimeline([]);
      return undefined;
    }
    let mounted = true;
    setTimelineLoading(true);
    getAssetHistoryByAsset(selected.asset.id, { page: 1, limit: 100 }).then((response) => {
      if (mounted) setTimeline(response.data?.data || []);
    }).catch(() => {
      if (mounted) setTimeline([]);
    }).finally(() => { if (mounted) setTimelineLoading(false); });
    return () => { mounted = false; };
  }, [selected]);

  return <main className="ict-history-page">
    <style>{`.ict-history-page{padding:32px;max-width:1500px;margin:0 auto;color:#17212b}.history-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px}.history-eyebrow{color:#0f766e;text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700;margin:0 0 6px}.history-title{display:flex;gap:10px;align-items:center}.history-header h1{font-size:30px;margin:0 0 8px}.history-header p{margin:0;color:#667585}.history-actions{display:flex;gap:10px}.history-button{border:1px solid #d5dde5;background:#fff;border-radius:7px;padding:10px 13px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#263746}.history-button:disabled{opacity:.55;cursor:not-allowed}.history-filter-panel,.history-table-panel{background:#fff;border:1px solid #dce3e8;border-radius:8px;box-shadow:0 5px 18px rgba(23,33,43,.05)}.history-filter-panel{padding:16px;margin-bottom:18px}.history-filter-head,.history-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.history-filter-head{margin-bottom:14px}.history-filter-head h2,.history-table-head h2{font-size:16px;margin:0;display:flex;align-items:center;gap:7px}.history-filters{display:grid;grid-template-columns:2fr repeat(6,1fr);gap:10px}.history-field{display:flex;flex-direction:column;gap:5px;min-width:0}.history-field label{font-size:11px;color:#637381;font-weight:700}.history-field input,.history-field select{border:1px solid #d5dde5;border-radius:6px;padding:9px 10px;min-width:0;background:#fff;color:#253746;font:inherit}.history-search{position:relative}.history-search svg{position:absolute;left:10px;top:30px;color:#83909b}.history-search input{padding-left:34px;width:100%}.history-table-head{padding:18px 20px;border-bottom:1px solid #e8edf0}.history-count,.history-muted{font-size:12px;color:#71808c}.history-table-wrap{overflow-x:auto}.history-table{width:100%;border-collapse:collapse;min-width:920px}.history-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#71808c;background:#f8fafb;padding:12px 16px}.history-table td{padding:14px 16px;border-top:1px solid #edf1f3;vertical-align:top;font-size:13px}.history-asset strong{display:block;color:#1a2c3a}.history-asset span{color:#71808c;font-size:12px}.history-badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}.history-badge-blue{background:#e8f1ff;color:#245ea8}.history-badge-amber{background:#fff4dc;color:#93620b}.history-badge-teal{background:#e3f7f3;color:#087568}.history-badge-red{background:#ffebeb;color:#b43c3c}.history-badge-slate{background:#edf1f4;color:#50616e}.history-empty,.history-error{padding:56px 20px;text-align:center;color:#667585}.history-error{color:#9d3d3d}.history-pagination{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;color:#667585;font-size:13px}.history-pagination-controls{display:flex;gap:8px;align-items:center}.history-pagination select{border:1px solid #d5dde5;border-radius:6px;padding:9px}.history-drawer-backdrop{position:fixed;inset:0;background:rgba(15,31,43,.35);z-index:20}.history-drawer{position:absolute;right:0;top:0;height:100%;width:min(520px,100%);background:#fff;overflow:auto;padding:26px;box-shadow:-8px 0 28px rgba(15,31,43,.18)}.history-drawer-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #e7edf0;padding-bottom:18px;margin-bottom:18px}.history-drawer h2{font-size:21px;margin:8px 0}.history-close{border:0;background:transparent;cursor:pointer;color:#667585}.history-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.history-detail dt{font-size:11px;color:#71808c;text-transform:uppercase;font-weight:700;margin-bottom:4px}.history-detail dd{margin:0;line-height:1.45;word-break:break-word}.history-value{padding:12px;background:#f7f9fa;border:1px solid #e8edf0;border-radius:6px;margin-top:6px}.history-spin{animation:history-spin 1s linear infinite}@keyframes history-spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.history-filters{grid-template-columns:repeat(3,1fr)}.history-header{flex-direction:column}}@media(max-width:640px){.ict-history-page{padding:18px}.history-filters{grid-template-columns:1fr 1fr}.history-filter-head,.history-table-head{align-items:flex-start;flex-direction:column}.history-detail-grid{grid-template-columns:1fr}.history-actions{width:100%}.history-actions button{flex:1;justify-content:center}}`}</style>
    <header className="history-header"><div><p className="history-eyebrow">Tracking / ICT</p><div className="history-title"><History size={27} aria-hidden="true" /><h1>Asset History</h1></div><p>View the complete recorded lifecycle and activity history of ICT assets.</p></div><div className="history-actions"><button type="button" className="history-button" onClick={loadHistory} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'history-spin' : ''} /> Refresh</button></div></header>
    {assetId && <div className="history-filter-panel"><strong>Asset-specific history</strong><button type="button" className="history-button" style={{ marginLeft: 12 }} onClick={() => { searchParams.delete('assetId'); setSearchParams(searchParams); }}><X size={15} /> Show all assets</button></div>}
    <section className="history-filter-panel" aria-label="Asset history filters"><div className="history-filter-head"><h2><Filter size={17} /> Find recorded events</h2><button type="button" className="history-button" onClick={clearFilters}>Clear filters</button></div><div className="history-filters">
      <div className="history-field history-search"><label htmlFor="history-search">Search</label><Search size={16} /><input id="history-search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Asset, tag, serial, event user" /></div>
      <div className="history-field"><label htmlFor="history-event">Event type</label><select id="history-event" value={filters.eventType} onChange={(event) => updateFilter('eventType', event.target.value)}><option value="">All recorded events</option>{eventTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></div>
      <div className="history-field"><label htmlFor="history-category">Category</label><select id="history-category" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{options.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></div>
      <div className="history-field"><label htmlFor="history-department">Department</label><select id="history-department" value={filters.departmentId} onChange={(event) => updateFilter('departmentId', event.target.value)}><option value="">All departments</option>{options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
      <div className="history-field"><label htmlFor="history-location">Location</label><input id="history-location" value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} placeholder="Location" /></div>
      <div className="history-field"><label htmlFor="history-from">From</label><input id="history-from" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></div>
      <div className="history-field"><label htmlFor="history-to">To</label><input id="history-to" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></div>
    </div></section>
    <section className="history-table-panel"><div className="history-table-head"><div><h2>Recorded activity</h2><span className="history-count">{pagination.total} event{pagination.total === 1 ? '' : 's'}</span></div></div>{loading ? <div className="history-empty"><Activity size={28} className="history-spin" /><p>Loading recorded history...</p></div> : error ? <div className="history-error"><FileText size={28} /><p>{error}</p><button type="button" className="history-button" onClick={loadHistory}>Retry</button></div> : records.length === 0 ? <div className="history-empty"><Clock3 size={30} /><strong>No asset history found.</strong><p>Activity will appear here when asset lifecycle events are recorded.</p></div> : <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Date & time</th><th>Asset</th><th>Event</th><th>Description</th><th>Performed by</th><th>Location</th><th>Action</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDate(record.performedAt)}</td><td className="history-asset"><strong>{record.asset.name}</strong><span>{record.asset.assetTag || record.asset.serialNumber || 'No asset tag recorded'}</span></td><td><span className={eventTone(record.eventType)}>{record.eventLabel}</span></td><td>{record.description || <span className="history-muted">Not recorded</span>}</td><td>{record.performedBy?.name || <span className="history-muted">Not recorded</span>}</td><td>{record.location || <span className="history-muted">Not recorded</span>}</td><td><button type="button" className="history-button" onClick={() => setSelected(record)}>View</button></td></tr>)}</tbody></table></div>}
      {!loading && !error && records.length > 0 && <footer className="history-pagination"><span>Page {pagination.page} of {pagination.totalPages || 1}</span><div className="history-pagination-controls"><select aria-label="Events per page" value={pagination.limit} onChange={(event) => setPagination((current) => ({ ...current, limit: Number(event.target.value), page: 1 }))}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select><button type="button" className="history-button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={16} /> Previous</button><button type="button" className="history-button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next <ChevronRight size={16} /></button></div></footer>}
    </section>
    {selected && <div className="history-drawer-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="history-drawer" role="dialog" aria-modal="true" aria-labelledby="history-event-title" onClick={(event) => event.stopPropagation()}><div className="history-drawer-head"><div><span className={eventTone(selected.eventType)}>{selected.eventLabel}</span><h2 id="history-event-title">Event details</h2><span className="history-muted">{formatDate(selected.performedAt)}</span></div><button type="button" className="history-close" aria-label="Close event details" onClick={() => setSelected(null)}><X size={22} /></button></div><dl className="history-detail-grid"><div className="history-detail"><dt>Asset</dt><dd>{selected.asset.name}<br /><span className="history-muted">{selected.asset.assetTag || 'No asset tag recorded'}</span></dd></div><div className="history-detail"><dt>Category</dt><dd>{displayValue(selected.asset.category)}</dd></div><div className="history-detail"><dt>Performed by</dt><dd>{selected.performedBy?.name || 'Not recorded'}</dd></div><div className="history-detail"><dt>Location</dt><dd>{selected.location || 'Not recorded'}</dd></div></dl><div className="history-detail" style={{ marginTop: 20 }}><dt>Asset lifecycle</dt><dd>{timelineLoading ? 'Loading recorded events...' : timeline.length ? <div className="history-timeline">{timeline.map((item) => <div className="history-timeline-item" key={item.id}><span className="history-muted">{formatDate(item.performedAt)}</span><strong>{item.eventLabel}</strong><span>{item.description || 'No description recorded.'}</span></div>)}</div> : 'No recorded lifecycle events.'}</dd></div><div className="history-detail" style={{ marginTop: 20 }}><dt>Description</dt><dd className="history-value">{selected.description || 'Not recorded'}</dd></div><div className="history-detail" style={{ marginTop: 16 }}><dt>Previous value</dt><dd className="history-value">{displayValue(selected.previousValue)}</dd></div><div className="history-detail" style={{ marginTop: 16 }}><dt>New value</dt><dd className="history-value">{displayValue(selected.newValue)}</dd></div><div className="history-detail" style={{ marginTop: 16 }}><dt>Reference</dt><dd>{displayValue(selected.reference)}</dd></div></aside></div>}
  </main>;
};

export default ICTAssetHistory;
