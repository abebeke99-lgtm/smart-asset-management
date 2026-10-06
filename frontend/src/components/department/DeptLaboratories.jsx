import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, CircleAlert, FlaskConical, Package, RefreshCw, Search, Wrench } from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
import { messages } from '../../i18n/messages';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './DeptLaboratories.css';

const laboratoryStatuses = ['Active', 'Temporarily Closed', 'Under Maintenance', 'Restricted', 'Inactive'];
const summaryFields = ['total', 'active', 'temporarilyClosed', 'underMaintenance', 'restricted', 'inactive', 'assets'];
const hasNumericSummary = (summary, fields) => summary && fields.every((field) => Number.isFinite(Number(summary[field])));
const statusTranslationKeys = {
  active: 'active',
  'temporarily closed': 'temporarilyClosed',
  'under maintenance': 'underMaintenance',
  restricted: 'restricted',
  inactive: 'inactive',
};

const DeptLaboratories = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = messages[language === 'am' ? 'am' : 'en'].departmentLaboratories;
  const [laboratories, setLaboratories] = useState([]);
  const [department, setDepartment] = useState(null);
  const [summary, setSummary] = useState(Object.fromEntries(summaryFields.map((field) => [field, 0])));
  const [dashboard, setDashboard] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const loadLaboratories = useCallback(async () => {
    const currentRequest = requestSequence.current + 1;
    requestSequence.current = currentRequest;
    setLoading(true);
    setError('');
    try {
      if (id) {
        const response = await apiClient.get(`/department-head/laboratories/${encodeURIComponent(id)}`);
        if (currentRequest !== requestSequence.current) return;
        const payload = response.data;
        if (
          !payload?.laboratory
          || !hasNumericSummary(payload.summary, ['totalAssets', 'functionalAssets', 'damagedAssets', 'assetsUnderMaintenance', 'openServiceRequests'])
          || !Array.isArray(payload.inventory)
          || !Array.isArray(payload.recentMaintenance)
          || !Array.isArray(payload.recentTransfers)
        ) throw new Error(t.loadError);
        setDashboard(payload);
      } else {
        const response = await apiClient.get('/department-head/laboratories');
        if (currentRequest !== requestSequence.current) return;
        const payload = response.data;
        if (
          !Array.isArray(payload?.data)
          || !hasNumericSummary(payload.summary, summaryFields)
        ) throw new Error(t.loadError);
        setLaboratories(payload.data);
        setSummary(payload.summary);
        setDepartment(payload.department || null);
      }
    } catch (requestError) {
      if (currentRequest !== requestSequence.current) return;
      if (process.env.NODE_ENV === 'development') {
        console.error('Department laboratory request failed', {
          status: requestError?.response?.status || 0,
          url: id ? `/api/department-head/laboratories/${id}` : '/api/department-head/laboratories',
          message: requestError?.response?.data?.message,
        });
      }
      const message = requestError?.response?.status >= 500
        ? t.loadError
        : getApiErrorMessage(requestError, t.loadError);
      setError(message);
      setLaboratories([]);
      setDashboard(null);
    } finally {
      if (currentRequest === requestSequence.current) setLoading(false);
    }
  }, [id, t.loadError]);

  useEffect(() => {
    loadLaboratories();
    return () => { requestSequence.current += 1; };
  }, [loadLaboratories]);

  const visibleLaboratories = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return laboratories.filter((laboratory) => {
      const matchesSearch = !searchTerm || [
        laboratory.id,
        laboratory.name,
        laboratory.roomCode,
        laboratory.room,
        laboratory.building,
        laboratory.responsibleStaff,
        laboratory.department,
      ].some((value) => String(value || '').toLowerCase().includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || laboratory.status === statusFilter;
      const matchesBuilding = buildingFilter === 'all' || laboratory.building === buildingFilter;
      return matchesSearch && matchesStatus && matchesBuilding;
    });
  }, [laboratories, search, statusFilter, buildingFilter]);

  const display = (value) => (value === null || value === undefined || value === '' ? t.notAvailable : value);
  const statusLabel = (value) => {
    const key = statusTranslationKeys[String(value || '').trim().toLowerCase()];
    return (key && t.statusValues[key]) || value || t.notAvailable;
  };
  const buildingOptions = useMemo(
    () => [...new Set(laboratories.map((laboratory) => laboratory.building).filter(Boolean))].sort((first, second) => first.localeCompare(second)),
    [laboratories],
  );
  const hasFilters = search !== '' || statusFilter !== 'all' || buildingFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setBuildingFilter('all');
  };
  const openLaboratory = (laboratory, viewAssets = false) => navigate({
    pathname: `/department-head/laboratories/${laboratory.id}`,
    hash: viewAssets ? '#laboratory-assets' : '',
  });

  useEffect(() => {
    if (id && dashboard && location.hash === '#laboratory-assets') {
      const assetSection = document.getElementById('laboratory-assets');
      if (typeof assetSection?.scrollIntoView === 'function') {
        assetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [dashboard, id, location.hash]);

  return (
    <main className="department-laboratories-page">
      <header className="department-laboratories-header">
        <div>
          <div className="department-laboratories-eyebrow"><FlaskConical size={16} aria-hidden="true" />{t.breadcrumb}</div>
          <h1>{id ? display(dashboard?.laboratory?.name) : t.title}</h1>
          <p>{department?.name ? `${department.name} · ` : ''}{id ? t.dashboardSubtitle : t.subtitle}</p>
        </div>
        <div className="department-laboratories-actions">
          {id && <button type="button" className="department-laboratories-button" onClick={() => navigate('/department-head/laboratories')}><ArrowLeft size={17} aria-hidden="true" />{t.back}</button>}
          <button type="button" className="department-laboratories-button" onClick={loadLaboratories} disabled={loading}>
            <RefreshCw size={17} aria-hidden="true" className={loading ? 'department-laboratories-spin' : ''} />{t.refresh}
          </button>
        </div>
      </header>

      {loading && <div className="department-laboratories-state" role="status"><RefreshCw size={22} className="department-laboratories-spin" aria-hidden="true" /><span>{t.loading}</span></div>}
      {!loading && error && <div className="department-laboratories-state department-laboratories-error" role="alert"><CircleAlert size={21} aria-hidden="true" /><span>{error}</span><button className="department-laboratories-button" type="button" onClick={loadLaboratories}>{t.retry}</button></div>}

      {!id && !loading && !error && (
        <>
          <section className="department-laboratories-summary" aria-label={t.summary}>
            <SummaryCard label={t.totalLaboratories} value={summary.total} />
            <SummaryCard label={t.activeLaboratories} value={summary.active} />
            <SummaryCard label={t.temporarilyClosedLaboratories} value={summary.temporarilyClosed} />
            <SummaryCard label={t.underMaintenanceLaboratories} value={summary.underMaintenance} />
            <SummaryCard label={t.restrictedLaboratories} value={summary.restricted} />
            <SummaryCard label={t.inactiveLaboratories} value={summary.inactive} />
            <SummaryCard label={t.totalAssets} value={summary.assets} />
          </section>
          <div className="department-laboratories-toolbar">
            <label className="department-laboratories-search"><Search size={18} aria-hidden="true" /><span className="sr-only">{t.search}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} /></label>
            <label className="department-laboratories-filter"><span>{t.filterStatus}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t.filterStatus}>
              <option value="all">{t.allStatuses}</option>
              {laboratoryStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select></label>
            {buildingOptions.length > 1 && <label className="department-laboratories-filter"><span>{t.filterBuilding}</span><select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)} aria-label={t.filterBuilding}>
              <option value="all">{t.allBuildings}</option>
              {buildingOptions.map((building) => <option key={building} value={building}>{building}</option>)}
            </select></label>}
            {hasFilters && <button type="button" className="department-laboratories-button" onClick={clearFilters}>{t.clearFilters}</button>}
          </div>
          {visibleLaboratories.length === 0
            ? <div className="department-laboratories-state"><FlaskConical size={27} aria-hidden="true" /><div>{laboratories.length ? <span>{t.noMatches}</span> : <><strong>{t.emptyTitle}</strong><span>{t.empty}</span></>}</div></div>
            : <div className="department-laboratories-grid">
              {visibleLaboratories.map((laboratory) => (
                <article className="department-laboratory-card" key={laboratory.id}>
                  <div className="department-laboratory-card-top">
                    <div className="department-laboratory-icon"><Building2 size={22} aria-hidden="true" /></div>
                    <span className={`department-laboratory-status status-${String(laboratory.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{statusLabel(laboratory.status)}</span>
                  </div>
                  <h2>{display(laboratory.name)}</h2>
                  <span className="department-laboratory-id">{t.laboratoryId}: {display(laboratory.id)}</span>
                  <div className="department-laboratory-facts">
                    <Fact label={t.building} value={display(laboratory.building)} />
                    <Fact label={t.room} value={display(laboratory.room)} />
                    <Fact label={t.capacity} value={display(laboratory.capacity)} />
                    <Fact label={t.responsibleStaff} value={display(laboratory.responsibleStaff)} />
                    <Fact label={t.department} value={display(laboratory.department || department?.name)} />
                    <Fact label={t.assetCount} value={laboratory.assetCount} />
                    <Fact label={t.condition} value={display(laboratory.condition)} />
                  </div>
                  <div className="department-laboratory-card-actions">
                    <button type="button" className="department-laboratory-open" onClick={() => openLaboratory(laboratory)}>{t.view}<span><ChevronRight size={16} aria-hidden="true" /></span></button>
                    <button type="button" className="department-laboratory-open" onClick={() => openLaboratory(laboratory, true)}><Package size={16} aria-hidden="true" />{t.viewAssets}<span><ChevronRight size={16} aria-hidden="true" /></span></button>
                  </div>
                </article>
              ))}
            </div>}
        </>
      )}

      {id && !loading && !error && dashboard && (
        <LaboratoryDashboard dashboard={dashboard} t={t} display={display} statusLabel={statusLabel} language={language} />
      )}
    </main>
  );
};

const SummaryCard = ({ label, value }) => <div className="department-laboratories-summary-card"><span>{label}</span><strong>{value}</strong></div>;
const Fact = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;

const LaboratoryDashboard = ({ dashboard, t, display, statusLabel, language }) => {
  const { laboratory, summary, inventory = [], recentMaintenance = [], recentTransfers = [] } = dashboard;
  const metrics = [
    [t.totalAssets, summary.totalAssets],
    [t.functionalAssets, summary.functionalAssets],
    [t.damagedAssets, summary.damagedAssets],
    [t.assetsUnderMaintenance, summary.assetsUnderMaintenance],
    [t.openServiceRequests, summary.openServiceRequests],
  ];

  return (
    <section className="department-laboratory-dashboard">
      <div className="department-laboratory-overview">
        <div><span>{t.laboratoryId}: {display(laboratory.id)}</span><h2>{display(laboratory.name)}</h2><p>{t.building}: {display(laboratory.building)} · {t.room}: {display(laboratory.room)} · {t.capacity}: {display(laboratory.capacity)}</p>
          <div className="department-laboratory-detail-facts"><Fact label={t.responsibleStaff} value={display(laboratory.responsibleStaff)} /><Fact label={t.department} value={display(laboratory.department)} /><Fact label={t.assetCount} value={laboratory.assetCount} /><Fact label={t.condition} value={display(laboratory.condition)} /></div>
        </div>
        <span className={`department-laboratory-status status-${String(laboratory.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{statusLabel(laboratory.status)}</span>
      </div>
      <div className="department-laboratories-summary department-laboratory-metrics">
        {metrics.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} />)}
      </div>
      <section className="department-laboratory-section" id="laboratory-assets">
        <h2><Package size={19} aria-hidden="true" />{t.inventory}</h2>
        {inventory.length === 0 ? <p className="department-laboratory-empty">{t.noInventory}</p> : (
          <div className="department-laboratory-table-wrap"><table><thead><tr><th>{t.assetId}</th><th>{t.assetCode}</th><th>{t.asset}</th><th>{t.category}</th><th>{t.condition}</th><th>{t.status}</th><th>{t.assignedUser}</th></tr></thead>
            <tbody>{inventory.map((asset) => <tr key={asset.id}><td>{display(asset.id)}</td><td>{display(asset.assetCode)}</td><td>{display(asset.name)}</td><td>{display(asset.category)}</td><td>{display(asset.condition)}</td><td>{display(asset.status)}</td><td>{display(asset.assignedUser)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
      <div className="department-laboratory-activity-grid">
        <ActivitySection title={t.recentMaintenance} icon={<Wrench size={18} aria-hidden="true" />} entries={recentMaintenance} empty={t.noMaintenance} dateKey="createdAt" t={t} display={display} language={language}>
          {(entry) => <><strong>{display(entry.title)}</strong><span>{display(entry.asset?.name)} · {display(entry.status)}</span></>}
        </ActivitySection>
        <ActivitySection title={t.recentTransfers} icon={<ArrowLeft size={18} aria-hidden="true" />} entries={recentTransfers} empty={t.noTransfers} dateKey="transferDate" t={t} display={display} language={language}>
          {(entry) => <><strong>{display(entry.asset?.name)} · {display(entry.transferNumber)}</strong><span>{entry.direction === 'outgoing' ? t.outgoing : t.incoming} · {display(entry.status)}</span></>}
        </ActivitySection>
      </div>
    </section>
  );
};

const ActivitySection = ({ title, icon, entries, empty, dateKey, display, language, children }) => (
  <section className="department-laboratory-section">
    <h2>{icon}{title}</h2>
    {entries.length === 0 ? <p className="department-laboratory-empty">{empty}</p> : <ul className="department-laboratory-activity-list">
      {entries.map((entry) => <li key={entry.id}><div>{children(entry)}</div><time dateTime={entry[dateKey] || undefined}>{entry[dateKey] ? new Date(entry[dateKey]).toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US') : display(null)}</time></li>)}
    </ul>}
  </section>
);

export default DeptLaboratories;
