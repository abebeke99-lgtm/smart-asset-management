import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
import { Building2, CheckCircle2, CircleX, Eye, Filter, MapPin, Package, RefreshCw, Search, X } from 'lucide-react';
import './DeptLocations.css';

const pageSize = 25;
const display = (value) => value === null || value === undefined || value === '' ? 'Not available' : value;

const DeptLocations = () => {
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, locationsWithAssets: 0 });
  const [department, setDepartment] = useState(null);
  const [college, setCollege] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [page, setPage] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const loadLocations = useCallback(async (requestedPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/department/locations', { params: { ...filters, page: requestedPage, limit: pageSize } });
      setLocations(Array.isArray(response.data?.data) ? response.data.data : []);
      setSummary(response.data?.summary || { total: 0, active: 0, inactive: 0, locationsWithAssets: 0 });
      setDepartment(response.data?.department || null);
      setCollege(response.data?.college || null);
      setPagination(response.data?.pagination || { page: requestedPage, pages: 1, total: 0 });
    } catch (requestError) {
      setLocations([]);
      setError(requestError.response?.data?.message || 'Unable to load department locations.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadLocations(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters.search, filters.status, loadLocations]);

  useEffect(() => {
    if (!selectedLocation) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedLocation(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedLocation]);

  const totalPages = Math.max(pagination.pages || pagination.totalPages || 1, 1);
  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));

  return (
    <section className="department-locations-page">
      <header className="department-locations-header">
        <div>
          <div className="department-locations-breadcrumb"><MapPin size={15} aria-hidden="true" /> Department / Management</div>
          <h1>Department Locations</h1>
          <p>Manage locations belonging to your department.</p>
        </div>
        <button className="department-location-button" type="button" onClick={() => loadLocations(page)} disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'department-location-spin' : ''} />
          Refresh
        </button>
      </header>

      {!loading && !error && (
        <div className="department-location-summary" aria-label="Location summary">
          <div><MapPin size={20} aria-hidden="true" /><span>Total locations</span><strong>{summary.total}</strong></div>
          <div><CheckCircle2 size={20} aria-hidden="true" /><span>Active locations</span><strong>{summary.active}</strong></div>
          <div><CircleX size={20} aria-hidden="true" /><span>Inactive locations</span><strong>{summary.inactive}</strong></div>
          <div><Package size={20} aria-hidden="true" /><span>Locations with assets</span><strong>{summary.locationsWithAssets}</strong></div>
        </div>
      )}

      <div className="department-location-toolbar">
        <label className="department-location-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search department locations</span>
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search by name, code, or description" />
        </label>
        <label className="department-location-filter"><Filter size={17} aria-hidden="true" /><span className="sr-only">Filter by location status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        {!loading && !error && pagination.total > 0 && <span className="department-location-count">{pagination.total} locations</span>}
      </div>

      {loading && <div className="department-location-state"><RefreshCw size={22} className="department-location-spin" aria-hidden="true" /><p>Loading department locations...</p></div>}
      {error && <div className="department-location-state department-location-error" role="alert"><p>{error}</p><button className="department-location-button" type="button" onClick={() => loadLocations(page)}>Retry</button></div>}
      {!loading && !error && locations.length === 0 && <div className="department-location-state"><MapPin size={28} aria-hidden="true" /><p>No locations found.</p></div>}
      {!loading && !error && locations.length > 0 && (
        <div className="department-location-grid">
          {locations.map((location) => (
            <article className="department-location-card" key={`${location.id || 'location'}-${location.name}`}>
              <div className="department-location-card-icon"><Building2 size={22} aria-hidden="true" /></div>
              <div className="department-location-card-content">
                <div className="department-location-card-heading"><div><h2>{location.name}</h2><span>{display(location.code)}</span></div><span className={`department-location-status department-location-status-${location.status || 'unknown'}`}>{display(location.status)}</span></div>
                <p>{display(location.description)}</p>
                <div className="department-location-card-footer"><span><Package size={16} aria-hidden="true" /> {Number(location.assetCount || 0)} assets</span><button className="department-location-view" type="button" onClick={() => setSelectedLocation(location)}><Eye size={16} aria-hidden="true" /> View</button></div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && pagination.total > 0 && <nav className="department-location-pagination" aria-label="Location pagination"><span>Page {pagination.page || page} of {totalPages}</span><div><button type="button" disabled={page <= 1} onClick={() => { setPage(page - 1); loadLocations(page - 1); }}>Previous</button><button type="button" disabled={page >= totalPages} onClick={() => { setPage(page + 1); loadLocations(page + 1); }}>Next</button></div></nav>}

      {selectedLocation && <div className="department-location-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLocation(null); }}>
        <section className="department-location-modal" role="dialog" aria-modal="true" aria-labelledby="department-location-details-title">
          <header><div><span className="department-location-modal-label">Location details</span><h2 id="department-location-details-title">{selectedLocation.name}</h2></div><button className="department-location-icon-button" type="button" onClick={() => setSelectedLocation(null)} aria-label="Close location details" title="Close"><X size={19} aria-hidden="true" /></button></header>
          <div className="department-location-details"><div><span>Location ID</span><strong>{display(selectedLocation.id)}</strong></div><div><span>Location code</span><strong>{display(selectedLocation.code)}</strong></div><div><span>Location status</span><strong>{display(selectedLocation.status)}</strong></div><div><span>Recorded assets</span><strong>{Number(selectedLocation.assetCount || 0)}</strong></div><div><span>Department</span><strong>{display(department?.name)}</strong></div><div><span>College</span><strong>{display(college?.name)}</strong></div><div className="department-location-description"><span>Description</span><strong>{display(selectedLocation.description)}</strong></div></div>
        </section>
      </div>}
    </section>
  );
};

export default DeptLocations;
