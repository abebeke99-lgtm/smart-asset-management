import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, CircleAlert, FlaskConical, Package, RefreshCw, Search, Wrench } from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './DeptLaboratories.css';

const laboratoryStatuses = ['Active', 'Temporarily Closed', 'Under Maintenance', 'Restricted', 'Inactive'];
const hasNumericSummary = (summary, fields) => summary && fields.every((field) => Number.isFinite(Number(summary[field])));

const DeptLaboratories = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = language === 'am' ? amharic : english;
  const [laboratories, setLaboratories] = useState([]);
  const [department, setDepartment] = useState(null);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, assets: 0 });
  const [dashboard, setDashboard] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
          || !hasNumericSummary(payload.summary, ['total', 'active', 'inactive', 'assets'])
        ) throw new Error(t.loadError);
        setLaboratories(payload.data);
        setSummary(payload.summary);
        setDepartment(payload.department || null);
      }
    } catch (requestError) {
      if (currentRequest !== requestSequence.current) return;
      const message = getApiErrorMessage(requestError, t.loadError);
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
        laboratory.building,
        laboratory.responsibleStaff,
        laboratory.department,
      ].some((value) => String(value || '').toLowerCase().includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || laboratory.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [laboratories, search, statusFilter]);

  const display = (value) => (value === null || value === undefined || value === '' ? t.notAvailable : value);
  const statusLabel = (value) => t.statusValues[value] || value || t.notAvailable;
  const openLaboratory = (laboratory) => navigate(`/department-head/laboratories/${laboratory.id}`);

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
            <SummaryCard label={t.inactiveLaboratories} value={summary.inactive} />
            <SummaryCard label={t.totalAssets} value={summary.assets} />
          </section>
          <div className="department-laboratories-toolbar">
            <label className="department-laboratories-search"><Search size={18} aria-hidden="true" /><span className="sr-only">{t.search}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} /></label>
            <label className="department-laboratories-filter"><span>{t.filterStatus}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t.filterStatus}>
              <option value="all">{t.allStatuses}</option>
              {laboratoryStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select></label>
          </div>
          {visibleLaboratories.length === 0
            ? <div className="department-laboratories-state"><FlaskConical size={27} aria-hidden="true" /><span>{laboratories.length ? t.noMatches : t.empty}</span></div>
            : <div className="department-laboratories-grid">
              {visibleLaboratories.map((laboratory) => (
                <article className="department-laboratory-card" key={laboratory.id}>
                  <div className="department-laboratory-card-top">
                    <div className="department-laboratory-icon"><Building2 size={22} aria-hidden="true" /></div>
                    <span className={`department-laboratory-status status-${String(laboratory.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{statusLabel(laboratory.status)}</span>
                  </div>
                  <h2>{display(laboratory.name)}</h2>
                  <span className="department-laboratory-id">{t.laboratoryId}: {display(laboratory.id)} · {display(laboratory.roomCode)}</span>
                  <div className="department-laboratory-facts">
                    <Fact label={t.building} value={display(laboratory.building)} />
                    <Fact label={t.room} value={display(laboratory.room)} />
                    <Fact label={t.capacity} value={display(laboratory.capacity)} />
                    <Fact label={t.responsibleStaff} value={display(laboratory.responsibleStaff)} />
                    <Fact label={t.department} value={display(laboratory.department || department?.name)} />
                    <Fact label={t.condition} value={display(laboratory.condition)} />
                  </div>
                  <button type="button" className="department-laboratory-open" onClick={() => openLaboratory(laboratory)}><Package size={16} aria-hidden="true" />{laboratory.assetCount} {t.assets}<span>{t.viewDashboard}<ChevronRight size={16} aria-hidden="true" /></span></button>
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
        <div><span>{t.laboratoryId}: {display(laboratory.id)}</span><h2>{display(laboratory.name)}</h2><p>{display(laboratory.building)} · {display(laboratory.room)} · {t.capacity}: {display(laboratory.capacity)}</p>
          <div className="department-laboratory-detail-facts"><Fact label={t.responsibleStaff} value={display(laboratory.responsibleStaff)} /><Fact label={t.department} value={display(laboratory.department)} /><Fact label={t.condition} value={display(laboratory.condition)} /></div>
        </div>
        <span className={`department-laboratory-status status-${String(laboratory.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{statusLabel(laboratory.status)}</span>
      </div>
      <div className="department-laboratories-summary department-laboratory-metrics">
        {metrics.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} />)}
      </div>
      <section className="department-laboratory-section">
        <h2><Package size={19} aria-hidden="true" />{t.inventory}</h2>
        {inventory.length === 0 ? <p className="department-laboratory-empty">{t.noInventory}</p> : (
          <div className="department-laboratory-table-wrap"><table><thead><tr><th>{t.asset}</th><th>{t.assetCode}</th><th>{t.category}</th><th>{t.condition}</th><th>{t.status}</th></tr></thead>
            <tbody>{inventory.map((asset) => <tr key={asset.id}><td>{display(asset.name)}</td><td>{display(asset.assetCode)}</td><td>{display(asset.category)}</td><td>{display(asset.condition)}</td><td>{display(asset.status)}</td></tr>)}</tbody>
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

const english = {
  breadcrumb: 'Department / Facilities',
  title: 'Laboratories',
  subtitle: 'Laboratories and their assets in your authorized department.',
  dashboardSubtitle: 'Laboratory operations and inventory',
  summary: 'Laboratory summary',
  totalLaboratories: 'Total laboratories',
  activeLaboratories: 'Active laboratories',
  inactiveLaboratories: 'Inactive laboratories',
  totalAssets: 'Total assets',
  functionalAssets: 'Functional assets',
  damagedAssets: 'Damaged assets',
  assetsUnderMaintenance: 'Assets under maintenance',
  openServiceRequests: 'Open service requests',
  laboratoryId: 'Laboratory ID',
  building: 'Building',
  room: 'Room',
  capacity: 'Capacity',
  responsibleStaff: 'Responsible staff',
  department: 'Department',
  condition: 'Condition',
  status: 'Status',
  assetCount: 'Asset count',
  assets: 'assets',
  search: 'Search laboratories',
  searchPlaceholder: 'Search laboratory, building, staff, or department',
  filterStatus: 'Filter by status',
  allStatuses: 'All statuses',
  viewDashboard: 'View dashboard',
  refresh: 'Refresh',
  back: 'All laboratories',
  loading: 'Loading laboratories...',
  loadError: 'Unable to load laboratories.',
  retry: 'Retry',
  empty: 'No laboratories are recorded for this department.',
  noMatches: 'No laboratories match your search and status filter.',
  notAvailable: 'Not assigned',
  inventory: 'Inventory',
  noInventory: 'No assets are recorded in this laboratory.',
  asset: 'Asset',
  assetCode: 'Asset ID',
  category: 'Category',
  recentMaintenance: 'Recent maintenance',
  noMaintenance: 'No maintenance activity is recorded.',
  recentTransfers: 'Recent transfers',
  noTransfers: 'No transfers are recorded for this laboratory.',
  outgoing: 'Outgoing',
  incoming: 'Incoming',
  statusValues: {
    Active: 'Active',
    'Temporarily Closed': 'Temporarily Closed',
    'Under Maintenance': 'Under Maintenance',
    Restricted: 'Restricted',
    Inactive: 'Inactive',
  },
};

const amharic = {
  breadcrumb: 'ዲፓርትመንት / ተቋማት',
  title: 'ላቦራቶሪዎች',
  subtitle: 'በተፈቀደልዎ ዲፓርትመንት ያሉ ላቦራቶሪዎችና ንብረቶቻቸው።',
  dashboardSubtitle: 'የላቦራቶሪ አሠራርና የንብረት ዝርዝር',
  summary: 'የላቦራቶሪ ማጠቃለያ',
  totalLaboratories: 'ጠቅላላ ላቦራቶሪዎች',
  activeLaboratories: 'ንቁ ላቦራቶሪዎች',
  inactiveLaboratories: 'ንቁ ያልሆኑ ላቦራቶሪዎች',
  totalAssets: 'ጠቅላላ ንብረቶች',
  functionalAssets: 'የሚሰሩ ንብረቶች',
  damagedAssets: 'የተበላሹ ንብረቶች',
  assetsUnderMaintenance: 'በጥገና ላይ ያሉ ንብረቶች',
  openServiceRequests: 'ክፍት የአገልግሎት ጥያቄዎች',
  laboratoryId: 'የላቦራቶሪ መለያ',
  building: 'ሕንፃ',
  room: 'ክፍል',
  capacity: 'አቅም',
  responsibleStaff: 'ተጠሪ ሰራተኛ',
  department: 'ዲፓርትመንት',
  condition: 'ሁኔታ',
  status: 'ሁኔታ',
  assetCount: 'የንብረት ብዛት',
  assets: 'ንብረቶች',
  search: 'ላቦራቶሪዎችን ፈልግ',
  searchPlaceholder: 'ላቦራቶሪ፣ ሕንፃ፣ ሰራተኛ ወይም ዲፓርትመንት ፈልግ',
  filterStatus: 'በሁኔታ አጣራ',
  allStatuses: 'ሁሉም ሁኔታዎች',
  viewDashboard: 'ዳሽቦርድ ይመልከቱ',
  refresh: 'አድስ',
  back: 'ሁሉም ላቦራቶሪዎች',
  loading: 'ላቦራቶሪዎችን በመጫን ላይ...',
  loadError: 'ላቦራቶሪዎችን መጫን አልተቻለም።',
  retry: 'እንደገና ሞክር',
  empty: 'ለዚህ ዲፓርትመንት ምንም ላቦራቶሪ አልተመዘገበም።',
  noMatches: 'ከፍለጋዎ ጋር የሚዛመድ ላቦራቶሪ የለም።',
  notAvailable: 'አልተመደበም',
  inventory: 'የንብረት ዝርዝር',
  noInventory: 'በዚህ ላቦራቶሪ ውስጥ ምንም ንብረት አልተመዘገበም።',
  asset: 'ንብረት',
  assetCode: 'የንብረት መለያ',
  category: 'ምድብ',
  recentMaintenance: 'የቅርብ ጊዜ ጥገና',
  noMaintenance: 'የጥገና እንቅስቃሴ አልተመዘገበም።',
  recentTransfers: 'የቅርብ ጊዜ ዝውውሮች',
  noTransfers: 'ለዚህ ላቦራቶሪ ዝውውር አልተመዘገበም።',
  outgoing: 'ወደ ውጭ',
  incoming: 'ወደ ውስጥ',
  statusValues: {
    Active: 'ንቁ',
    'Temporarily Closed': 'ለጊዜው ዝግ',
    'Under Maintenance': 'በጥገና ላይ',
    Restricted: 'የተገደበ',
    Inactive: 'ንቁ ያልሆነ',
  },
};

export default DeptLaboratories;
