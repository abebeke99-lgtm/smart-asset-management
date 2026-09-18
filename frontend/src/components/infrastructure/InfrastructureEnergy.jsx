import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Eye, Filter, Gauge, Loader2, RefreshCw, Search, Settings, Wrench, X, Zap } from 'lucide-react';
import api from '../../services/api';

const PAGE_SIZE = 10;

function display(value) {
  return value === null || value === undefined || value === '' ? 'Not available' : String(value);
}

function statusClass(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('fault') || value.includes('critical') || value.includes('failed') || value.includes('damaged')) return 'energy-status danger';
  if (value.includes('maintenance')) return 'energy-status warning';
  if (value.includes('operational') || value.includes('active') || value.includes('working')) return 'energy-status success';
  return 'energy-status';
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatCapacity(system) {
  if (system.capacity === null || system.capacity === undefined || system.capacity === '') return 'Not available';
  return `${system.capacity}${system.capacityUnit ? ` ${system.capacityUnit}` : ''}`;
}

export default function InfrastructureEnergy() {
  const [systems, setSystems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [energyType, setEnergyType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSystem, setSelectedSystem] = useState(null);

  const loadSystems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/infrastructure/energy', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          status: status || undefined,
          energyType: energyType || undefined,
        },
      });
      const payload = response?.data || {};
      setSystems(Array.isArray(payload.data) ? payload.data : []);
      setSummary(payload.summary || null);
      setPagination(payload.pagination || { page, pages: 1, total: 0 });
    } catch (requestError) {
      setSystems([]);
      setSummary(null);
      setError(requestError?.response?.data?.message || 'Unable to load energy systems.');
    } finally {
      setLoading(false);
    }
  }, [energyType, page, search, status]);

  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

  const updateFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setEnergyType('');
    setPage(1);
  };

  const kpis = [
    ['Total systems', summary?.total, Settings, ''],
    ['Operational', summary?.operational, CheckCircle2, ''],
    ['Under maintenance', summary?.underMaintenance, Wrench, 'warning'],
    ['Faulty or critical', summary?.faulty, AlertCircle, 'danger'],
  ];

  return (
    <main className="energy-page">
      <style>{`
        .energy-page { min-height: 100vh; padding: 24px; background: #f8fafc; color: #0f172a; }
        .energy-container { max-width: 1600px; margin: 0 auto; }
        .energy-header, .energy-header-actions, .energy-filter-row, .energy-pagination, .energy-system-heading, .energy-detail-header { display: flex; align-items: center; gap: 12px; }
        .energy-header { justify-content: space-between; align-items: flex-start; margin-bottom: 22px; gap: 20px; }
        .energy-header h1 { margin: 0 0 5px; font-size: 28px; line-height: 1.15; }
        .energy-header p, .energy-muted { margin: 0; color: #64748b; font-size: 14px; }
        .energy-title { display: flex; align-items: flex-start; gap: 14px; }
        .energy-title-icon { display: grid; place-items: center; width: 48px; height: 48px; flex: 0 0 auto; border-radius: 12px; background: linear-gradient(135deg, #0ea5e9, #2563eb); color: #fff; }
        .energy-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 0 13px; border: 1px solid #dbe4ee; border-radius: 8px; background: #fff; color: #1e293b; font-weight: 700; cursor: pointer; }
        .energy-btn:disabled { cursor: not-allowed; opacity: .55; }
        .energy-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        .energy-card { border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; box-shadow: 0 4px 14px rgba(15, 23, 42, .04); }
        .energy-kpi { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; }
        .energy-kpi-label { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
        .energy-kpi-value { margin-top: 7px; font-size: 26px; font-weight: 800; }
        .energy-kpi-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: #e0f2fe; color: #0284c7; }
        .energy-kpi.warning .energy-kpi-icon { background: #fef3c7; color: #b45309; }
        .energy-kpi.danger .energy-kpi-icon { background: #fee2e2; color: #b91c1c; }
        .energy-filter-row { flex-wrap: wrap; padding: 14px; margin-bottom: 14px; }
        .energy-search { position: relative; flex: 1 1 260px; }
        .energy-search svg { position: absolute; top: 11px; left: 11px; color: #94a3b8; }
        .energy-input, .energy-select { width: 100%; min-height: 40px; padding: 0 11px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #0f172a; }
        .energy-search .energy-input { padding-left: 36px; }
        .energy-select { width: 170px; }
        .energy-table-wrap { overflow-x: auto; }
        .energy-table { width: 100%; min-width: 880px; border-collapse: collapse; }
        .energy-table th, .energy-table td { padding: 13px 15px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; }
        .energy-table th { color: #64748b; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        .energy-system-name { font-weight: 750; }
        .energy-system-code { margin-top: 3px; color: #64748b; font-size: 12px; }
        .energy-status { display: inline-flex; padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 750; white-space: nowrap; }
        .energy-status.success { background: #dcfce7; color: #166534; }
        .energy-status.warning { background: #fef3c7; color: #92400e; }
        .energy-status.danger { background: #fee2e2; color: #991b1b; }
        .energy-empty, .energy-alert { padding: 28px; text-align: center; color: #64748b; }
        .energy-alert { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; border: 1px solid #fecaca; border-radius: 8px; background: #fff1f2; color: #991b1b; text-align: left; }
        .energy-alert button { margin-left: auto; color: inherit; font-weight: 800; text-decoration: underline; border: 0; background: transparent; cursor: pointer; }
        .energy-pagination { justify-content: space-between; padding: 13px 15px; }
        .energy-pagination-actions { display: flex; gap: 8px; }
        .energy-drawer-backdrop { position: fixed; inset: 0; z-index: 20; border: 0; background: rgba(15, 23, 42, .35); cursor: default; }
        .energy-drawer { position: fixed; top: 0; right: 0; z-index: 21; width: min(520px, 100%); height: 100%; overflow-y: auto; padding: 24px; background: #fff; box-shadow: -8px 0 28px rgba(15, 23, 42, .18); }
        .energy-detail-header { justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .energy-detail-header h2 { margin: 0 0 4px; font-size: 22px; }
        .energy-close { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #e2e8f0; border-radius: 7px; background: #fff; cursor: pointer; }
        .energy-detail-section { margin-top: 22px; }
        .energy-detail-section h3 { margin: 0 0 10px; color: #0f172a; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
        .energy-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .energy-detail-item { padding: 11px; border: 1px solid #e2e8f0; border-radius: 7px; background: #f8fafc; }
        .energy-detail-item span { display: block; color: #64748b; font-size: 11px; }
        .energy-detail-item strong { display: block; margin-top: 4px; font-size: 14px; overflow-wrap: anywhere; }
        @media (max-width: 900px) { .energy-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .energy-header { flex-direction: column; } }
        @media (max-width: 520px) { .energy-page { padding: 14px; } .energy-kpis { grid-template-columns: 1fr; } .energy-filter-row > * { width: 100%; } .energy-select { width: 100%; } .energy-pagination { align-items: flex-start; flex-direction: column; } }
      `}</style>

      <div className="energy-container">
        <header className="energy-header">
          <div className="energy-title"><div className="energy-title-icon"><Zap size={24} aria-hidden="true" /></div><div><h1>Energy Management</h1><p>Existing infrastructure energy systems and their recorded operational state.</p></div></div>
          <div className="energy-header-actions"><button type="button" className="energy-btn" onClick={loadSystems} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Refresh</button></div>
        </header>

        {error && <div className="energy-alert" role="alert"><AlertCircle size={17} aria-hidden="true" />{error}<button type="button" onClick={loadSystems}>Retry</button></div>}

        <section className="energy-kpis" aria-label="Energy system summary">
          {kpis.map(([label, value, Icon, tone]) => <div className={`energy-card energy-kpi ${tone}`} key={label}><div><div className="energy-kpi-label">{label}</div><div className="energy-kpi-value">{loading ? <Loader2 size={22} aria-label="Loading" /> : display(value)}</div></div><div className="energy-kpi-icon"><Icon size={19} aria-hidden="true" /></div></div>)}
        </section>

        <section className="energy-card energy-filter-row" aria-label="Energy system filters">
          <div className="energy-search"><Search size={17} aria-hidden="true" /><input className="energy-input" value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search system, asset number, building, location" aria-label="Search energy systems" /></div>
          <select className="energy-select" value={energyType} onChange={(event) => updateFilter(setEnergyType, event.target.value)} aria-label="Energy system type"><option value="">All system types</option><option value="Electrical">Electrical</option><option value="Generator">Generator</option><option value="Transformer">Transformer</option><option value="UPS">UPS</option><option value="Solar">Solar</option></select>
          <select className="energy-select" value={status} onChange={(event) => updateFilter(setStatus, event.target.value)} aria-label="System status"><option value="">All statuses</option><option value="Operational">Operational</option><option value="Under Maintenance">Under Maintenance</option><option value="Inactive">Inactive</option><option value="Critical">Critical</option></select>
          <button type="button" className="energy-btn" onClick={clearFilters}><Filter size={16} aria-hidden="true" />Clear</button>
        </section>

        <section className="energy-card" aria-labelledby="system-list-heading">
          <div className="energy-system-heading" style={{ padding: '16px 15px' }}><Activity size={18} color="#0284c7" aria-hidden="true" /><div><h2 id="system-list-heading" style={{ margin: 0, fontSize: '17px' }}>Energy systems</h2><p className="energy-muted">{pagination.total ?? 0} persisted system records</p></div></div>
          {loading ? <div className="energy-empty"><Loader2 size={22} aria-label="Loading energy systems" /></div> : systems.length === 0 ? <div className="energy-empty">No energy data available.</div> : <div className="energy-table-wrap"><table className="energy-table"><thead><tr><th>System / asset number</th><th>Type</th><th>Building / location</th><th>Capacity</th><th>Status</th><th>Maintenance</th><th>Actions</th></tr></thead><tbody>{systems.map((system) => <tr key={system.id}><td><div className="energy-system-name">{display(system.name)}</div><div className="energy-system-code">{display(system.assetCode)}</div></td><td>{display(system.type)}</td><td><div>{display(system.building)}</div><div className="energy-system-code">{display(system.location)}</div></td><td>{formatCapacity(system)}</td><td><span className={statusClass(system.status)}>{display(system.status)}</span></td><td>{formatDate(system.lastMaintenanceDate)}</td><td><button type="button" className="energy-btn" onClick={() => setSelectedSystem(system)} aria-label={`View details for ${system.name}`}><Eye size={16} aria-hidden="true" />Details</button></td></tr>)}</tbody></table></div>}
          <footer className="energy-pagination"><span className="energy-muted">Page {pagination.page || page} of {Math.max(1, pagination.pages || 1)}</span><div className="energy-pagination-actions"><button type="button" className="energy-btn" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" />Previous</button><button type="button" className="energy-btn" disabled={loading || page >= (pagination.pages || 1)} onClick={() => setPage((current) => current + 1)} aria-label="Next page">Next<ChevronRight size={16} aria-hidden="true" /></button></div></footer>
        </section>

        <section className="energy-card" style={{ marginTop: 18, padding: 18 }} aria-labelledby="measurement-heading"><div className="energy-system-heading"><Gauge size={18} color="#0284c7" aria-hidden="true" /><div><h2 id="measurement-heading" style={{ margin: 0, fontSize: '17px' }}>Energy readings</h2><p className="energy-muted">No energy meter or reading model is configured in this installation.</p></div></div><div style={{ marginTop: 14, padding: 13, border: '1px dashed #cbd5e1', borderRadius: 7, color: '#64748b', fontSize: 14 }}>Energy readings, consumption, generation, cost, peak demand, and efficiency are not available.</div></section>
+      </div>
+
      {selectedSystem && <><button type="button" className="energy-drawer-backdrop" onClick={() => setSelectedSystem(null)} aria-label="Close details" /><aside className="energy-drawer" aria-labelledby="energy-detail-title"><div className="energy-detail-header"><div><h2 id="energy-detail-title">{display(selectedSystem.name)}</h2><p className="energy-muted">{display(selectedSystem.assetCode)}</p></div><button type="button" className="energy-close" onClick={() => setSelectedSystem(null)} aria-label="Close details"><X size={18} /></button></div><div className="energy-detail-section"><h3>System</h3><div className="energy-detail-grid"><div className="energy-detail-item"><span>Type</span><strong>{display(selectedSystem.type)}</strong></div><div className="energy-detail-item"><span>Status</span><strong>{display(selectedSystem.status)}</strong></div><div className="energy-detail-item"><span>Condition</span><strong>{display(selectedSystem.condition)}</strong></div><div className="energy-detail-item"><span>Capacity</span><strong>{formatCapacity(selectedSystem)}</strong></div></div></div><div className="energy-detail-section"><h3>Location</h3><div className="energy-detail-grid"><div className="energy-detail-item"><span>Building</span><strong>{display(selectedSystem.building)}</strong></div><div className="energy-detail-item"><span>Location</span><strong>{display(selectedSystem.location)}</strong></div></div></div><div className="energy-detail-section"><h3>Maintenance and readings</h3><div className="energy-detail-grid"><div className="energy-detail-item"><span>Last maintenance</span><strong>{formatDate(selectedSystem.lastMaintenanceDate)}</strong></div><div className="energy-detail-item"><span>Last inspection</span><strong>{formatDate(selectedSystem.lastInspectionDate)}</strong></div><div className="energy-detail-item"><span>Meter</span><strong>{display(selectedSystem.meter)}</strong></div><div className="energy-detail-item"><span>Latest reading</span><strong>Not available</strong></div></div></div></aside></>}
    </main>
  );
}
