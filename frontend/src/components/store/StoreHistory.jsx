import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../utils/api';

const getDateRange = (preset) => {
  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);

  switch (preset) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'yesterday':
      from.setDate(today.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(today.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'thisWeek':
      from.setDate(today.getDate() - today.getDay());
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'thisMonth':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'lastMonth':
      from.setMonth(today.getMonth() - 1, 1);
      from.setHours(0, 0, 0, 0);
      to.setMonth(today.getMonth(), 0);
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    default:
      return {};
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const formatMovementType = (value) => {
  if (!value) return 'Movement';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const StoreHistory = () => {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalMovements: 0, today: 0, thisMonth: 0, transfers: 0, issues: 0, returns: 0 });
  const [filtersMeta, setFiltersMeta] = useState({ movementTypes: [], locations: [], departments: [] });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [totalPages, setTotalPages] = useState(1);

  const buildParams = useMemo(() => {
    const params = {
      page,
      pageSize,
      search,
    };

    if (movementType) params.movementType = movementType;
    if (locationFilter) params.location = locationFilter;
    if (departmentFilter) params.department = departmentFilter;

    const dateRange = datePreset === 'custom' ? { from: customFrom, to: customTo } : getDateRange(datePreset);
    if (dateRange.from) params.dateFrom = dateRange.from;
    if (dateRange.to) params.dateTo = dateRange.to;

    return params;
  }, [page, pageSize, search, movementType, locationFilter, departmentFilter, datePreset, customFrom, customTo]);

  const loadHistory = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/api/store/history', { params: buildParams });
      const payload = response.data?.data || {};
      setItems(payload.items || []);
      setSummary(payload.summary || { totalMovements: 0, today: 0, thisMonth: 0, transfers: 0, issues: 0, returns: 0 });
      setFiltersMeta(payload.filters || { movementTypes: [], locations: [], departments: [] });
      setTotalPages(Math.max(1, Number(payload.totalPages) || 1));
    } catch (loadError) {
      setItems([]);
      setError(loadError.response?.status === 403 ? 'You do not have permission to view asset movement history.' : 'Unable to load asset movement history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildParams]);

  const timeline = useMemo(() => {
    if (!selectedRecord) return [];
    return items.filter((item) => item.assetId === selectedRecord.assetId).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }, [items, selectedRecord]);

  const resetFilters = () => {
    setSearch('');
    setMovementType('');
    setLocationFilter('');
    setDepartmentFilter('');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Store Manager</p>
          <h1 style={styles.title}>Asset Movement History</h1>
          <p style={styles.subtitle}>Track the complete movement and lifecycle history of university assets.</p>
        </div>
      </header>

      <section style={styles.summaryGrid} aria-label="Movement summary statistics">
        <div style={styles.summaryCard}><span>Total Movements</span><strong>{summary.totalMovements || 0}</strong></div>
        <div style={styles.summaryCard}><span>Today</span><strong>{summary.today || 0}</strong></div>
        <div style={styles.summaryCard}><span>This Month</span><strong>{summary.thisMonth || 0}</strong></div>
        <div style={styles.summaryCard}><span>Transfers</span><strong>{summary.transfers || 0}</strong></div>
        <div style={styles.summaryCard}><span>Issues</span><strong>{summary.issues || 0}</strong></div>
        <div style={styles.summaryCard}><span>Returns</span><strong>{summary.returns || 0}</strong></div>
      </section>

      <section style={styles.panel}>
        <div style={styles.toolbar}>
          <input
            aria-label="Search movements"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by asset, code, serial, reference..."
            style={styles.input}
          />

          <select aria-label="Movement type filter" value={movementType} onChange={(event) => { setMovementType(event.target.value); setPage(1); }} style={styles.input}>
            <option value="">All movement types</option>
            {(filtersMeta.movementTypes || []).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select aria-label="From location filter" value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); setPage(1); }} style={styles.input}>
            <option value="">All locations</option>
            {(filtersMeta.locations || []).map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>

          <select aria-label="Department filter" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1); }} style={styles.input}>
            <option value="">All departments</option>
            {(filtersMeta.departments || []).map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>

          <select aria-label="Date filter" value={datePreset} onChange={(event) => setDatePreset(event.target.value)} style={styles.input}>
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisWeek">This week</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="custom">Custom range</option>
          </select>

          <button type="button" onClick={() => loadHistory()} style={styles.primaryButton}>Apply</button>
          <button type="button" onClick={resetFilters} style={styles.secondaryButton}>Reset</button>
        </div>

        {datePreset === 'custom' && (
          <div style={styles.dateRow}>
            <label style={styles.fieldLabel}>From <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} style={styles.input} /></label>
            <label style={styles.fieldLabel}>To <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} style={styles.input} /></label>
          </div>
        )}
      </section>

      {error ? (
        <section style={styles.alertBox} role="alert">{error}</section>
      ) : null}

      {loading ? (
        <section style={styles.panel}><p>Loading asset movement history...</p></section>
      ) : items.length === 0 ? (
        <section style={styles.panel}><p>No asset movement history found for the selected filters.</p></section>
      ) : (
        <>
          <section style={styles.panel}>
            <div style={styles.tableWrap}>
              <table style={styles.table} aria-label="Asset movement history list">
                <thead>
                  <tr>
                    <th style={styles.th}>Date & Time</th>
                    <th style={styles.th}>Asset</th>
                    <th style={styles.th}>Movement</th>
                    <th style={styles.th}>From</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>Performed By</th>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.td}>{formatDate(item.createdAt)}</td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>{item.assetName || 'Asset'}</div>
                        <small style={styles.muted}>{item.assetCode || '—'}</small>
                      </td>
                      <td style={styles.td}>{formatMovementType(item.movementLabel || item.movementType)}</td>
                      <td style={styles.td}>{item.from || '—'}</td>
                      <td style={styles.td}>{item.to || '—'}</td>
                      <td style={styles.td}>{item.performedByName || 'System'}</td>
                      <td style={styles.td}>{item.referenceNumber || item.referenceType || '—'}</td>
                      <td style={styles.td}><span style={styles.badge}>{item.status || 'Recorded'}</span></td>
                      <td style={styles.td}>
                        <button type="button" onClick={() => setSelectedRecord(item)} style={styles.linkButton}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.pagination}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} style={styles.pageButton}>Previous</button>
              <span style={styles.pageLabel}>Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} style={styles.pageButton}>Next</button>
            </div>
          </section>

          {selectedRecord && (
            <section style={styles.detailPanel} aria-label="Movement details">
              <div style={styles.detailHeader}>
                <div>
                  <p style={styles.eyebrow}>Movement Details</p>
                  <h2 style={styles.detailTitle}>{selectedRecord.assetName || 'Asset'} · {formatMovementType(selectedRecord.movementLabel || selectedRecord.movementType)}</h2>
                </div>
                <button type="button" onClick={() => setSelectedRecord(null)} style={styles.secondaryButton}>Close</button>
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailCard}>
                  <h3>Event</h3>
                  <p><strong>Movement ID:</strong> {selectedRecord.id}</p>
                  <p><strong>Type:</strong> {formatMovementType(selectedRecord.movementLabel || selectedRecord.movementType)}</p>
                  <p><strong>Date:</strong> {formatDate(selectedRecord.createdAt)}</p>
                  <p><strong>Status:</strong> {selectedRecord.status || 'Recorded'}</p>
                  <p><strong>Reference:</strong> {selectedRecord.referenceNumber || selectedRecord.referenceType || '—'}</p>
                </div>

                <div style={styles.detailCard}>
                  <h3>Asset</h3>
                  <p><strong>Asset name:</strong> {selectedRecord.assetName || '—'}</p>
                  <p><strong>Asset code:</strong> {selectedRecord.assetCode || '—'}</p>
                  <p><strong>Serial number:</strong> {selectedRecord.serialNumber || '—'}</p>
                  <p><strong>Category:</strong> {selectedRecord.category || '—'}</p>
                  <p><strong>Current location:</strong> {selectedRecord.currentLocation || '—'}</p>
                </div>

                <div style={styles.detailCard}>
                  <h3>Origin</h3>
                  <p><strong>From:</strong> {selectedRecord.from || '—'}</p>
                  <p><strong>Source type:</strong> {selectedRecord.sourceType || '—'}</p>
                </div>

                <div style={styles.detailCard}>
                  <h3>Destination</h3>
                  <p><strong>To:</strong> {selectedRecord.to || '—'}</p>
                  <p><strong>Destination type:</strong> {selectedRecord.destinationType || '—'}</p>
                </div>

                <div style={styles.detailCard}>
                  <h3>User</h3>
                  <p><strong>Performed by:</strong> {selectedRecord.performedByName || 'System'}</p>
                </div>

                <div style={styles.detailCard}>
                  <h3>Reason / Notes</h3>
                  <p>{selectedRecord.notes || 'No additional movement notes recorded.'}</p>
                </div>
              </div>

              {timeline.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h3>Asset Timeline</h3>
                  <div style={styles.timeline}>
                    {timeline.map((event) => (
                      <div key={event.id} style={styles.timelineItem}>
                        <div style={styles.timelineDot} />
                        <div>
                          <strong>{formatDate(event.createdAt)}</strong>
                          <div>{formatMovementType(event.movementLabel || event.movementType)}</div>
                          <small>{event.from || '—'} → {event.to || '—'}</small>
                          <div>By {event.performedByName || 'System'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
};

const styles = {
  page: { padding: '24px 16px 48px', maxWidth: 1280, margin: '0 auto', fontFamily: 'Inter, Arial, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  eyebrow: { margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4f46e5', fontSize: 12, fontWeight: 700 },
  title: { margin: '8px 0 8px', fontSize: 32, color: '#0f172a' },
  subtitle: { margin: 0, color: '#475569', maxWidth: 720 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 },
  summaryCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 16px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)', display: 'flex', flexDirection: 'column', gap: 6, color: '#475569' },
  panel: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)', marginBottom: 20 },
  toolbar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' },
  input: { width: '100%', minHeight: 42, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', background: '#fff', fontSize: 14 },
  primaryButton: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', minHeight: 42, cursor: 'pointer', fontWeight: 600 },
  secondaryButton: { background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 10, padding: '0 14px', minHeight: 42, cursor: 'pointer', fontWeight: 600 },
  linkButton: { background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', padding: 0 },
  dateRow: { display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: 6, color: '#475569', fontSize: 13 },
  alertBox: { background: '#fff7ed', color: '#9a4d00', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 14px', marginBottom: 20 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 980 },
  th: { textAlign: 'left', padding: '12px 10px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  td: { padding: '12px 10px', borderBottom: '1px solid #f1f5f9', color: '#1f2937', verticalAlign: 'top' },
  tr: { background: '#fff' },
  muted: { color: '#64748b' },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: '#e2e8f0', color: '#0f172a', padding: '4px 8px', fontSize: 12, fontWeight: 600 },
  pagination: { display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center', paddingTop: 12 },
  pageButton: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 },
  pageLabel: { color: '#475569', fontSize: 14 },
  detailPanel: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailTitle: { margin: '6px 0 0', fontSize: 24, color: '#0f172a' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  detailCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, color: '#1e293b' },
  timeline: { display: 'grid', gap: 12, marginTop: 12 },
  timelineItem: { display: 'flex', gap: 12, padding: '12px 14px', borderLeft: '3px solid #4f46e5', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' },
  timelineDot: { width: 10, height: 10, borderRadius: '50%', background: '#4f46e5', marginTop: 6 },
};

export default StoreHistory;
