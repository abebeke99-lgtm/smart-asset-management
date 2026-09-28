import React, { useEffect, useMemo, useState } from 'react';
import { Search, Download, RefreshCw, Filter, Eye, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/UiContext';
import { getAssetsUnderMaintenance, getAssetMaintenanceDetail } from '../../services/maintenanceApi';

const statusPalette = {
  'awaiting-inspection': { bg: '#fef3c7', color: '#92400e' },
  'work-order-created': { bg: '#dbeafe', color: '#1d4ed8' },
  'in-repair': { bg: '#fee2e2', color: '#b91c1c' },
  'waiting-for-parts': { bg: '#f5d0fe', color: '#7e22ce' },
  'waiting-for-vendor': { bg: '#e0f2fe', color: '#0369a1' },
  'testing': { bg: '#dcfce7', color: '#166534' },
  'quality-control': { bg: '#ede9fe', color: '#6d28d9' },
  'ready-for-return': { bg: '#bbf7d0', color: '#166534' },
  completed: { bg: '#dbeafe', color: '#1e3a8a' },
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDowntime = (hours) => {
  const totalHours = Number(hours) || 0;
  const days = Math.floor(totalHours / 24);
  const hrs = Math.round(totalHours % 24);
  return `${days}d ${hrs}h`;
};

const MaintAssetsUnderMaintenance = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAssetsUnderMaintenance({ search, status, limit: 50 });
      setRows(result.items || []);
      setSummary(result.summary || {});
    } catch (err) {
      setError(err?.message || 'Failed to load assets under maintenance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [search, status]);

  const handleOpenDetails = async (assetId) => {
    try {
      const detail = await getAssetMaintenanceDetail(assetId);
      setSelectedAsset(detail);
    } catch (err) {
      setError(err?.message || 'Unable to load maintenance details');
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ['Asset ID', 'Asset Name', 'Department', 'Location', 'Status', 'Technician', 'Work Order', 'Start Date', 'Expected Completion'];
    const csv = [headers.join(',')].concat(rows.map((row) => [row.assetId, row.assetName, row.department, row.location, row.displayStatus || row.status, row.technician || '', row.workOrderNumber || '', formatDate(row.startDate), formatDate(row.expectedCompletionDate)].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assets-under-maintenance.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => [
    { label: 'Total Under Maintenance', value: summary.totalUnderMaintenance || rows.length || 0, tone: '#f59e0b' },
    { label: 'Awaiting Inspection', value: summary.awaitingInspection || 0, tone: '#f97316' },
    { label: 'In Repair', value: summary.inRepair || 0, tone: '#ef4444' },
    { label: 'Waiting for Parts', value: summary.waitingForParts || 0, tone: '#a855f7' },
    { label: 'Testing / QC', value: summary.testingQualityControl || 0, tone: '#10b981' },
    { label: 'Overdue', value: summary.overdue || 0, tone: '#dc2626' },
    { label: 'Ready for Return', value: summary.readyForReturn || 0, tone: '#16a34a' },
  ], [summary, rows]);

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>Assets Under Maintenance</h1>
          <p style={{ margin: '6px 0 0', color: isDark ? '#b6c2d1' : '#4b5563' }}>Monitor, track, and manage university assets currently undergoing maintenance.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => loadData()} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={16} /> Refresh</button>
          <button onClick={exportCsv} style={{ background: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#e2e8f0' : '#111827', border: `1px solid ${isDark ? '#334155' : '#dbe3f0'}`, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Download size={16} /> Export</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{ background: isDark ? '#111827' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: stat.tone }}>{stat.value}</div>
            <div style={{ marginTop: '4px', color: isDark ? '#cbd5e1' : '#475569', fontSize: '0.82rem' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: isDark ? '#111827' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, borderRadius: '12px', padding: '14px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset, serial, technician, work order..." style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, background: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#e2e8f0' : '#111827' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="#64748b" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, background: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#e2e8f0' : '#111827' }}>
              <option value="">All statuses</option>
              <option value="awaiting-inspection">Awaiting Inspection</option>
              <option value="in-repair">In Repair</option>
              <option value="waiting-for-parts">Waiting for Parts</option>
              <option value="testing">Testing</option>
              <option value="quality-control">Quality Control</option>
              <option value="ready-for-return">Ready for Return</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <div style={{ background: isDark ? '#111827' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>Loading assets…</div>
      ) : rows.length === 0 ? (
        <div style={{ background: isDark ? '#111827' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
          <AlertTriangle size={28} style={{ margin: '0 auto 12px', color: '#f59e0b' }} />
          <h3 style={{ margin: '0 0 8px' }}>No Assets Under Maintenance</h3>
          <p style={{ margin: 0, color: isDark ? '#cbd5e1' : '#4b5563' }}>There are currently no university assets undergoing maintenance.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: isDark ? '#111827' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#dfe7f5'}`, borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
            <thead>
              <tr style={{ background: isDark ? '#1e293b' : '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Asset ID</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Asset Name</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Department</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Location</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Condition</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Technician</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Work Order</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Start Date</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Expected Completion</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Downtime</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.82rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.assetId}-${row.id}`} style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{row.assetCode || row.assetId}</td>
                  <td style={{ padding: '12px' }}>{row.assetName}</td>
                  <td style={{ padding: '12px' }}>{row.department || '—'}</td>
                  <td style={{ padding: '12px' }}>{row.location || '—'}</td>
                  <td style={{ padding: '12px' }}>{row.condition || '—'}</td>
                  <td style={{ padding: '12px' }}>{row.technician || 'Unassigned'}</td>
                  <td style={{ padding: '12px' }}>{row.workOrderNumber || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '999px', background: statusPalette[row.status]?.bg || '#e2e8f0', color: statusPalette[row.status]?.color || '#475569', fontSize: '0.75rem', fontWeight: 600 }}>{row.displayStatus || row.status || 'In Repair'}</span>
                  </td>
                  <td style={{ padding: '12px' }}>{formatDate(row.startDate)}</td>
                  <td style={{ padding: '12px' }}>{formatDate(row.expectedCompletionDate)}</td>
                  <td style={{ padding: '12px', color: row.isOverdue ? '#dc2626' : '#475569', fontWeight: 600 }}>{formatDowntime(row.downtimeHours)}</td>
                  <td style={{ padding: '12px' }}>
                    <button onClick={() => handleOpenDetails(row.assetId)} style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Eye size={14} /> Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAsset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, padding: '16px' }}>
          <div style={{ width: 'min(860px, 100%)', background: isDark ? '#0f172a' : '#ffffff', borderRadius: '14px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedAsset.assetName}</h3>
                <div style={{ fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#64748b' }}>{selectedAsset.assetCode || selectedAsset.id}</div>
              </div>
              <button onClick={() => setSelectedAsset(null)} style={{ border: 'none', background: 'transparent', color: isDark ? '#e2e8f0' : '#334155', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
              <div style={{ background: isDark ? '#111827' : '#f8fafc', borderRadius: '10px', padding: '12px' }}><strong>Department</strong><div>{selectedAsset.department || '—'}</div></div>
              <div style={{ background: isDark ? '#111827' : '#f8fafc', borderRadius: '10px', padding: '12px' }}><strong>Location</strong><div>{selectedAsset.location || '—'}</div></div>
              <div style={{ background: isDark ? '#111827' : '#f8fafc', borderRadius: '10px', padding: '12px' }}><strong>Condition</strong><div>{selectedAsset.condition || '—'}</div></div>
              <div style={{ background: isDark ? '#111827' : '#f8fafc', borderRadius: '10px', padding: '12px' }}><strong>Status</strong><div>{selectedAsset.displayStatus || selectedAsset.status}</div></div>
              <div style={{ background: isDark ? '#111827' : '#f8fafc', borderRadius: '10px', padding: '12px' }}><strong>Technician</strong><div>{selectedAsset.technician || 'Unassigned'}</div></div>
              <div style={{ background: isDark ? '#111827' : '#f8fafc', borderRadius: '10px', padding: '12px' }}><strong>Work Order</strong><div>{selectedAsset.workOrderNumber || 'N/A'}</div></div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <h4 style={{ margin: '0 0 8px' }}>Maintenance Timeline</h4>
              {(selectedAsset.history || []).length ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {selectedAsset.history.slice(0, 8).map((event, index) => (
                    <div key={`${event.id || index}`} style={{ borderLeft: '3px solid #2563eb', paddingLeft: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{event.actionType || 'Update'}</div>
                      <div style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: '0.82rem' }}>{formatDate(event.actionDate || event.createdAt)}</div>
                      <div style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: '0.78rem' }}>{event.description || 'No description provided'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: isDark ? '#cbd5e1' : '#475569' }}>No maintenance activity logged yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintAssetsUnderMaintenance;