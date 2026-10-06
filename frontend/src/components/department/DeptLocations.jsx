import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import {
  Building2,
  CheckCircle2,
  CircleX,
  Download,
  Eye,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import './DeptLocations.css';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 100;

const DeptLocations = () => {
  const auth = useAuth();
  const { language } = useLanguage();
  const [locations, setLocations] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, locationsWithAssets: 0 });
  const [department, setDepartment] = useState(null);
  const [college, setCollege] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'all', type: 'all', campus: 'all' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedLocationAssets, setSelectedLocationAssets] = useState(null);
  const [locationAssetsLoading, setLocationAssetsLoading] = useState(false);
  const [locationAssetsError, setLocationAssetsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const t = language === 'am' ? amharicTranslations : englishTranslations;
  const canExport = typeof auth.hasPermission === 'function'
    ? auth.hasPermission('reports.export')
    : Array.isArray(auth.user?.permissions) && auth.user.permissions.includes('reports.export');

  const loadLocations = useCallback(async (requestedPage = page) => {
    const currentRequest = requestSequence.current + 1;
    requestSequence.current = currentRequest;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/department-head/locations', {
        params: { ...filters, page: requestedPage, limit: PAGE_SIZE },
      });
      if (currentRequest !== requestSequence.current) return;
      const payload = response.data || {};
      setLocations(Array.isArray(payload.data) ? payload.data : []);
      setSummary(payload.summary || { total: 0, active: 0, inactive: 0, locationsWithAssets: 0 });
      setLocationTypes(Array.isArray(payload.filters?.types) ? payload.filters.types : []);
      setCampuses(Array.isArray(payload.filters?.campuses) ? payload.filters.campuses : []);
      setDepartment(payload.department || null);
      setCollege(payload.college || null);
      setPagination(payload.pagination || { page: requestedPage, pages: 1, total: 0 });
    } catch (requestError) {
      if (currentRequest !== requestSequence.current) return;
      const message = requestError?.message || getApiErrorMessage(requestError, t.loadError) || t.loadError;
      setError(message);
      setLocations([]);
      toast.error(message);
    } finally {
      if (currentRequest === requestSequence.current) setLoading(false);
    }
  }, [filters, page, t.loadError]);

  useEffect(() => {
    const search = searchInput.trim();
    if (search === filters.search) return undefined;
    const timer = window.setTimeout(() => {
      setPage(1);
      setFilters((current) => {
        return current.search === search ? current : { ...current, search };
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters.search, searchInput]);

  useEffect(() => {
    loadLocations(page);
  }, [loadLocations, page]);

  useEffect(() => {
    if (!selectedLocation) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedLocation(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedLocation]);

  const pageCount = Math.max(Number(pagination.pages || pagination.totalPages || 1), 1);
  const updateFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };
  const display = (value) => String(value ?? '').trim() || t.notAvailable;
  const formatType = (type) => t.locationTypes[String(type || '').toLowerCase()] || String(type || '').replace(/[_-]+/g, ' ');

  const exportLocations = async () => {
    if (!canExport || exporting || pagination.total === 0) return;
    setExporting(true);
    try {
      const firstResponse = await apiClient.get('/department-head/locations', {
        params: { ...filters, export: true, page: 1, limit: EXPORT_PAGE_SIZE },
      });
      const firstPayload = firstResponse.data || {};
      const allLocations = Array.isArray(firstPayload.data) ? [...firstPayload.data] : [];
      const pages = Math.max(Number(firstPayload.pagination?.pages) || 1, 1);

      for (let currentPage = 2; currentPage <= pages; currentPage += 1) {
        const response = await apiClient.get('/department-head/locations', {
          params: { ...filters, export: true, page: currentPage, limit: EXPORT_PAGE_SIZE },
        });
        if (!Array.isArray(response.data?.data)) throw new Error(t.exportError);
        allLocations.push(...response.data.data);
      }

      const rows = allLocations.map((location) => ({
        [t.locationId]: location.id ?? '',
        [t.building]: location.building || '',
        [t.room]: location.room || '',
        [t.locationType]: formatType(location.type),
        [t.department]: location.department || '',
        [t.responsibleStaff]: location.responsibleStaff || '',
        [t.assetCount]: Number(location.assetCount || 0),
        [t.status]: t.statusValues[String(location.status || '').toLowerCase()] || location.status || '',
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Department Locations');
      XLSX.writeFile(workbook, 'department-locations.xlsx');
      toast.success(t.exportSuccess);
    } catch (exportError) {
      const message = exportError?.message || getApiErrorMessage(exportError, t.exportError) || t.exportError;
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ search: '', status: 'all', type: 'all', campus: 'all' });
    setPage(1);
  };

  const viewLocationAssets = async (location) => {
    setSelectedLocationAssets({ location, assets: [] });
    setLocationAssetsLoading(true);
    setLocationAssetsError('');
    try {
      const response = await apiClient.get(`/department-head/locations/${encodeURIComponent(location.recordType)}/${encodeURIComponent(location.id)}/assets`);
      setSelectedLocationAssets({ location, assets: Array.isArray(response.data?.data) ? response.data.data : [] });
    } catch (requestError) {
      setLocationAssetsError(getApiErrorMessage(requestError, t.assetsLoadError) || t.assetsLoadError);
    } finally {
      setLocationAssetsLoading(false);
    }
  };

  return (
    <section className="department-locations-page">
      <header className="department-locations-header">
        <div>
          <div className="department-locations-breadcrumb"><MapPin size={15} aria-hidden="true" /> {t.breadcrumb}</div>
          <h1>{t.title}</h1>
          <p>{department?.name ? `${department.name} - ${t.subtitle}` : t.subtitle}</p>
        </div>
        <div className="department-location-header-actions">
          {canExport && (
            <button className="department-location-button" type="button" onClick={exportLocations} disabled={loading || exporting || pagination.total === 0}>
              <Download size={17} aria-hidden="true" /> {exporting ? t.exporting : t.export}
            </button>
          )}
          <button className="department-location-button" type="button" onClick={() => loadLocations(page)} disabled={loading}>
            <RefreshCw size={17} aria-hidden="true" className={loading ? 'department-location-spin' : ''} />
            {t.refresh}
          </button>
        </div>
      </header>

      {!loading && !error && (
        <div className="department-location-summary" aria-label={t.summary}>
          <div><MapPin size={20} aria-hidden="true" /><span>{t.total}</span><strong>{summary.total}</strong></div>
          <div><CheckCircle2 size={20} aria-hidden="true" /><span>{t.active}</span><strong>{summary.active}</strong></div>
          <div><CircleX size={20} aria-hidden="true" /><span>{t.inactive}</span><strong>{summary.inactive}</strong></div>
          <div><Package size={20} aria-hidden="true" /><span>{t.withAssets}</span><strong>{summary.locationsWithAssets}</strong></div>
        </div>
      )}

      <div className="department-location-toolbar">
        <label className="department-location-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{t.search}</span>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t.searchPlaceholder} />
        </label>
        <label className="department-location-filter">
          <Filter size={17} aria-hidden="true" />
          <span className="sr-only">{t.filterStatus}</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">{t.allStatuses}</option><option value="active">{t.active}</option><option value="inactive">{t.inactive}</option>
          </select>
        </label>
        <label className="department-location-filter">
          <Building2 size={17} aria-hidden="true" />
          <span className="sr-only">{t.filterType}</span>
          <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
            <option value="all">{t.allTypes}</option>
            {locationTypes.map((type) => <option key={type} value={type}>{formatType(type)}</option>)}
          </select>
        </label>
        {campuses.length > 0 && <label className="department-location-filter">
          <MapPin size={17} aria-hidden="true" />
          <span className="sr-only">{t.filterCampus}</span>
          <select value={filters.campus} onChange={(event) => updateFilter('campus', event.target.value)}>
            <option value="all">{t.allCampuses}</option>
            {campuses.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
          </select>
        </label>}
        <button className="department-location-button department-location-clear" type="button" onClick={clearFilters} disabled={!searchInput && filters.status === 'all' && filters.type === 'all' && filters.campus === 'all'}>
          <X size={16} aria-hidden="true" /> {t.clearFilters}
        </button>
        {!loading && !error && <span className="department-location-count">{pagination.total} {t.locations}</span>}
      </div>

      {loading && <div className="department-location-state" role="status"><RefreshCw size={22} className="department-location-spin" aria-hidden="true" /><p>{t.loading}</p></div>}
      {!loading && error && <div className="department-location-state department-location-error" role="alert"><p>{error}</p><button className="department-location-button" type="button" onClick={() => loadLocations(page)}>{t.retry}</button></div>}
      {!loading && !error && locations.length === 0 && <div className="department-location-state"><MapPin size={28} aria-hidden="true" /><p>{t.empty}</p></div>}
      {!loading && !error && locations.length > 0 && (
        <div className="department-location-grid">
          {locations.map((location) => (
            <article className="department-location-card" key={`${location.recordType || 'location'}-${location.id ?? location.name}`}>
              <div className="department-location-card-icon"><Building2 size={22} aria-hidden="true" /></div>
              <div className="department-location-card-content">
                <div className="department-location-card-heading">
                  <div><h2>{display(location.name)}</h2><span>{t.locationId}: {display(location.id)} · {display(location.code)}</span></div>
                  <span className={`department-location-status department-location-status-${location.status || 'unknown'}`}>
                    {t.statusValues[String(location.status || '').toLowerCase()] || display(location.status)}
                  </span>
                </div>
                <p>{display(location.description)}</p>
                <div className="department-location-card-facts">
                  <Fact label={t.building} value={display(location.building)} />
                  <Fact label={t.campus} value={display(location.campus)} />
                  <Fact label={t.floor} value={display(location.floor)} />
                  <Fact label={t.room} value={display(location.room)} />
                  <Fact label={t.locationType} value={formatType(location.type)} />
                  <Fact label={t.department} value={display(location.department || department?.name)} />
                  <Fact label={t.responsibleStaff} value={display(location.responsibleStaff)} />
                </div>
                <div className="department-location-card-footer">
                  <span><Package size={16} aria-hidden="true" /> {Number(location.assetCount || 0)} {t.assets}</span>
                  <div className="department-location-card-actions">
                    <button className="department-location-view" type="button" onClick={() => setSelectedLocation(location)}><Eye size={16} aria-hidden="true" /> {t.view}</button>
                    <button className="department-location-view" type="button" onClick={() => viewLocationAssets(location)}><Package size={16} aria-hidden="true" /> {t.viewAssets}</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && pagination.total > 0 && (
        <nav className="department-location-pagination" aria-label={t.pagination}>
          <span>{t.page} {pagination.page || page} {t.of} {pageCount}</span>
          <div>
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t.previous}</button>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>{t.next}</button>
          </div>
        </nav>
      )}

      {selectedLocation && (
        <div className="department-location-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLocation(null); }}>
          <section className="department-location-modal" role="dialog" aria-modal="true" aria-labelledby="department-location-details-title">
            <header>
              <div><span className="department-location-modal-label">{t.details}</span><h2 id="department-location-details-title">{display(selectedLocation.name)}</h2></div>
              <button className="department-location-icon-button" type="button" onClick={() => setSelectedLocation(null)} aria-label={t.close} title={t.close}><X size={19} aria-hidden="true" /></button>
            </header>
            <div className="department-location-details">
              <Fact label={t.locationId} value={display(selectedLocation.id)} />
              <Fact label={t.building} value={display(selectedLocation.building)} />
              <Fact label={t.campus} value={display(selectedLocation.campus)} />
              <Fact label={t.floor} value={display(selectedLocation.floor)} />
              <Fact label={t.room} value={display(selectedLocation.room)} />
              <Fact label={t.locationType} value={formatType(selectedLocation.type)} />
              <Fact label={t.department} value={display(selectedLocation.department || department?.name)} />
              <Fact label={t.responsibleStaff} value={display(selectedLocation.responsibleStaff)} />
              <Fact label={t.assetCount} value={Number(selectedLocation.assetCount || 0)} />
              <Fact label={t.status} value={t.statusValues[String(selectedLocation.status || '').toLowerCase()] || display(selectedLocation.status)} />
              <Fact label={t.locationCode} value={display(selectedLocation.code)} />
              <Fact label={t.college} value={display(college?.name)} />
              <Fact className="department-location-description" label={t.description} value={display(selectedLocation.description)} />
            </div>
          </section>
        </div>
      )}

      {selectedLocationAssets && (
        <div className="department-location-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLocationAssets(null); }}>
          <section className="department-location-modal department-location-assets-modal" role="dialog" aria-modal="true" aria-labelledby="department-location-assets-title">
            <header>
              <div><span className="department-location-modal-label">{t.assetsAtLocation}</span><h2 id="department-location-assets-title">{display(selectedLocationAssets.location.name)}</h2></div>
              <button className="department-location-icon-button" type="button" onClick={() => setSelectedLocationAssets(null)} aria-label={t.close} title={t.close}><X size={19} aria-hidden="true" /></button>
            </header>
            <div className="department-location-assets-content">
              {locationAssetsLoading && <div className="department-location-state" role="status"><RefreshCw size={22} className="department-location-spin" aria-hidden="true" /><p>{t.loadingAssets}</p></div>}
              {!locationAssetsLoading && locationAssetsError && <div className="department-location-state department-location-error" role="alert"><p>{locationAssetsError}</p></div>}
              {!locationAssetsLoading && !locationAssetsError && selectedLocationAssets.assets.length === 0 && <div className="department-location-state"><Package size={24} aria-hidden="true" /><p>{t.noAssetsAtLocation}</p></div>}
              {!locationAssetsLoading && !locationAssetsError && selectedLocationAssets.assets.length > 0 && <div className="department-location-assets-table-wrap"><table className="department-location-assets-table"><thead><tr><th>{t.assetId}</th><th>{t.assetTag}</th><th>{t.assetName}</th><th>{t.category}</th><th>{t.condition}</th><th>{t.status}</th></tr></thead><tbody>{selectedLocationAssets.assets.map((asset) => <tr key={asset.id}><td>{display(asset.id)}</td><td>{display(asset.assetCode)}</td><td>{display(asset.name)}</td><td>{display(asset.category)}</td><td>{display(asset.condition)}</td><td>{display(asset.status)}</td></tr>)}</tbody></table></div>}
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

const Fact = ({ label, value, className = '' }) => (
  <div className={className}><span>{label}</span><strong>{value}</strong></div>
);

const englishTranslations = {
  breadcrumb: 'Department / Management',
  title: 'Department Locations',
  subtitle: 'Locations recorded for your authorized department.',
  summary: 'Location summary',
  total: 'Total locations',
  active: 'Active locations',
  inactive: 'Inactive locations',
  withAssets: 'Locations with assets',
  search: 'Search department locations',
  searchPlaceholder: 'Search building, room, type, staff, code, or status',
  filterStatus: 'Filter by status',
  filterType: 'Filter by location type',
  filterCampus: 'Filter by campus',
  allStatuses: 'All statuses',
  allTypes: 'All types',
  allCampuses: 'All campuses',
  clearFilters: 'Clear filters',
  refresh: 'Refresh',
  loading: 'Loading department locations...',
  loadError: 'Unable to load department locations.',
  empty: 'No department locations found.',
  retry: 'Retry',
  locations: 'locations',
  locationId: 'Location ID',
  locationCode: 'Location code',
  building: 'Building',
  campus: 'Campus',
  floor: 'Floor',
  room: 'Room',
  locationType: 'Location type',
  department: 'Department',
  responsibleStaff: 'Responsible staff',
  assetCount: 'Asset count',
  assets: 'assets',
  status: 'Status',
  statusValues: { active: 'Active', inactive: 'Inactive' },
  description: 'Description',
  college: 'College',
  notAvailable: 'Not available',
  view: 'View',
  viewAssets: 'View assets',
  assetsAtLocation: 'Assets at location',
  loadingAssets: 'Loading location assets...',
  assetsLoadError: 'Unable to load location assets.',
  noAssetsAtLocation: 'No assets are assigned to this location.',
  assetId: 'Asset ID',
  assetTag: 'Asset tag',
  assetName: 'Asset name',
  category: 'Category',
  condition: 'Condition',
  details: 'Location details',
  close: 'Close location details',
  pagination: 'Location pagination',
  page: 'Page',
  of: 'of',
  previous: 'Previous',
  next: 'Next',
  export: 'Export',
  exporting: 'Exporting...',
  exportSuccess: 'Department locations exported successfully.',
  exportError: 'Unable to export department locations.',
  locationTypes: { campus: 'Campus', building: 'Building', floor: 'Floor', room: 'Room', laboratory: 'Laboratory', office: 'Office', storage_area: 'Storage Area', other: 'Other', department_location: 'Department location' },
};

const amharicTranslations = {
  breadcrumb: 'ዲፓርትመንት / አስተዳደር',
  title: 'የዲፓርትመንት ቦታዎች',
  subtitle: 'ለተፈቀደው ዲፓርትመንትዎ የተመዘገቡ ቦታዎች።',
  summary: 'የቦታዎች ማጠቃለያ',
  total: 'ጠቅላላ ቦታዎች',
  active: 'ንቁ ቦታዎች',
  inactive: 'ንቁ ያልሆኑ ቦታዎች',
  withAssets: 'ንብረት ያላቸው ቦታዎች',
  search: 'የዲፓርትመንት ቦታዎችን ፈልግ',
  searchPlaceholder: 'ሕንፃ፣ ክፍል፣ ዓይነት፣ ሰራተኛ፣ ኮድ ወይም ሁኔታ ፈልግ',
  filterStatus: 'በሁኔታ አጣራ',
  filterType: 'በቦታ ዓይነት አጣራ',
  filterCampus: 'በካምፓስ አጣራ',
  allStatuses: 'ሁሉም ሁኔታዎች',
  allTypes: 'ሁሉም ዓይነቶች',
  allCampuses: 'ሁሉም ካምፓሶች',
  clearFilters: 'ማጣሪያዎችን አጽዳ',
  refresh: 'አድስ',
  loading: 'የዲፓርትመንት ቦታዎችን በመጫን ላይ...',
  loadError: 'የዲፓርትመንት ቦታዎችን መጫን አልተቻለም።',
  empty: 'ምንም የዲፓርትመንት ቦታ አልተገኘም።',
  retry: 'እንደገና ሞክር',
  locations: 'ቦታዎች',
  locationId: 'የቦታ መለያ',
  locationCode: 'የቦታ ኮድ',
  building: 'ሕንፃ',
  campus: 'ካምፓስ',
  floor: 'ፎቅ',
  room: 'ክፍል',
  locationType: 'የቦታ ዓይነት',
  department: 'ዲፓርትመንት',
  responsibleStaff: 'ተጠሪ ሰራተኛ',
  assetCount: 'የንብረት ብዛት',
  assets: 'ንብረቶች',
  status: 'ሁኔታ',
  statusValues: { active: 'ንቁ', inactive: 'ንቁ ያልሆነ' },
  description: 'መግለጫ',
  college: 'ኮሌጅ',
  notAvailable: 'አልተገለጸም',
  view: 'ይመልከቱ',
  viewAssets: 'ንብረቶችን ይመልከቱ',
  assetsAtLocation: 'በቦታው ያሉ ንብረቶች',
  loadingAssets: 'የቦታ ንብረቶችን በመጫን ላይ...',
  assetsLoadError: 'የቦታ ንብረቶችን መጫን አልተቻለም።',
  noAssetsAtLocation: 'በዚህ ቦታ የተመደቡ ንብረቶች የሉም።',
  assetId: 'የንብረት መለያ',
  assetTag: 'የንብረት መለያ',
  assetName: 'የንብረት ስም',
  category: 'ምድብ',
  condition: 'ሁኔታ',
  details: 'የቦታ ዝርዝር',
  close: 'የቦታ ዝርዝርን ዝጋ',
  pagination: 'የቦታ ገጽ ቁጥጥር',
  page: 'ገጽ',
  of: 'ከ',
  previous: 'ቀዳሚ',
  next: 'ቀጣይ',
  export: 'ወደ ውጭ ላክ',
  exporting: 'በመላክ ላይ...',
  exportSuccess: 'የዲፓርትመንት ቦታዎች መረጃ በተሳካ ሁኔታ ወደ ውጭ ተልኳል።',
  exportError: 'የዲፓርትመንት ቦታዎችን ወደ ውጭ መላክ አልተቻለም።',
  locationTypes: { campus: 'ካምፓስ', building: 'ሕንፃ', floor: 'ፎቅ', room: 'ክፍል', laboratory: 'ላቦራቶሪ', office: 'ቢሮ', storage_area: 'የማከማቻ ቦታ', other: 'ሌላ', department_location: 'የዲፓርትመንት ቦታ' },
};

export default DeptLocations;
