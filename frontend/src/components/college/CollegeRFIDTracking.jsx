import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';

const initialState = {
  loading: true,
  error: '',
  assets: [],
  logs: [],
  summary: { totalAssets: 0, taggedAssets: 0, untaggedAssets: 0, uniqueLocations: 0, recentScans: 0 },
  filters: { departments: [], statuses: [], locations: [] },
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
};

const CollegeRFIDTracking = () => {
  const [state, setState] = useState(initialState);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [location, setLocation] = useState('');

  const loadData = async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/college/rfid', {
        params: {
          page,
          limit: 25,
          search: search || undefined,
          status: status || undefined,
          departmentId: departmentId || undefined,
          location: location || undefined,
        },
      });
      const payload = response.data || {};
      setState({
        loading: false,
        error: '',
        assets: payload.data || [],
        logs: payload.logs || [],
        summary: payload.summary || initialState.summary,
        filters: payload.filters || initialState.filters,
        pagination: payload.pagination || initialState.pagination,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error.response?.data?.message || 'Unable to load RFID tracking data for this college.',
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, status, departmentId, location]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.logs;
    return state.logs.filter((entry) => {
      const haystack = [
        entry.tag,
        entry.action,
        entry.location,
        entry.asset?.name,
        entry.asset?.assetCode,
        entry.asset?.serialNumber,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [state.logs, search]);

  const hasFilters = Boolean(search || status || departmentId || location);

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        {[
          { key: 'totalAssets', label: 'Tracked Assets', value: state.summary.totalAssets },
          { key: 'taggedAssets', label: 'Tagged', value: state.summary.taggedAssets },
          { key: 'untaggedAssets', label: 'Untagged', value: state.summary.untaggedAssets },
          { key: 'uniqueLocations', label: 'Locations', value: state.summary.uniqueLocations },
          { key: 'recentScans', label: 'Recent Scans', value: state.summary.recentScans },
        ].map((item) => (
          <div key={item.key} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f8fafc', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{item.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          Search
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Asset, tag or location"
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          Status
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          >
            <option value="">All statuses</option>
            {state.filters.statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          Department
          <select
            value={departmentId}
            onChange={(event) => {
              setPage(1);
              setDepartmentId(event.target.value);
            }}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          >
            <option value="">All departments</option>
            {state.filters.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#475569' }}>
          Location
          <select
            value={location}
            onChange={(event) => {
              setPage(1);
              setLocation(event.target.value);
            }}
            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          >
            <option value="">All locations</option>
            {state.filters.locations.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch('');
              setStatus('');
              setDepartmentId('');
              setLocation('');
            }}
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {state.loading ? (
        <div style={{ padding: '24px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' }}>Loading RFID tracking data…</div>
      ) : state.error ? (
        <div style={{ padding: '24px', border: '1px solid #fecaca', borderRadius: '12px', background: '#fff1f2', color: '#991b1b' }}>{state.error}</div>
      ) : (
        <>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
              <strong>College RFID / QR asset register</strong>
              <span style={{ color: '#64748b' }}>{state.pagination.total} items</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={thStyle}>Asset</th>
                    <th style={thStyle}>RFID Tag</th>
                    <th style={thStyle}>Department</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {state.assets.length ? (
                    state.assets.map((asset) => (
                      <tr key={asset.id} style={{ borderTop: '1px solid #eef2f7' }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{asset.name || 'Unnamed asset'}</div>
                          <small style={{ color: '#64748b' }}>{asset.assetCode || '—'}</small>
                        </td>
                        <td style={tdStyle}>{asset.rfidTag || 'Not linked'}</td>
                        <td style={tdStyle}>{asset.department || 'Unassigned'}</td>
                        <td style={tdStyle}>{asset.location || 'Unknown'}</td>
                        <td style={tdStyle}>{asset.status || '—'}</td>
                        <td style={tdStyle}>{asset.condition || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '22px', textAlign: 'center', color: '#64748b' }}>
                        No matching RFID-tagged assets found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
              <strong>Recent RFID scan activity</strong>
              <span style={{ color: '#64748b' }}>{filteredLogs.length} logs</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Asset</th>
                    <th style={thStyle}>Tag</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id} style={{ borderTop: '1px solid #eef2f7' }}>
                        <td style={tdStyle}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td style={tdStyle}>{log.asset?.name || 'Unknown asset'}</td>
                        <td style={tdStyle}>{log.tag || '—'}</td>
                        <td style={tdStyle}>{log.location || '—'}</td>
                        <td style={tdStyle}>{log.action || 'scan'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '22px', textAlign: 'center', color: '#64748b' }}>
                        No recent scan activity available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.6 : 1 }}
            >
              Previous
            </button>
            <span style={{ color: '#475569' }}>Page {page} of {Math.max(1, state.pagination.totalPages || 1)}</span>
            <button
              type="button"
              disabled={page >= (state.pagination.totalPages || 1)}
              onClick={() => setPage((value) => Math.min(state.pagination.totalPages || 1, value + 1))}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: page >= (state.pagination.totalPages || 1) ? 'not-allowed' : 'pointer', opacity: page >= (state.pagination.totalPages || 1) ? 0.6 : 1 }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  fontSize: '12px',
  color: '#475569',
  fontWeight: 700,
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  verticalAlign: 'top',
};

export default CollegeRFIDTracking;
