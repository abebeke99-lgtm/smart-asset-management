import React, { useEffect, useState } from 'react';
import { Building2, CalendarDays, Eye, MapPin, Package, RefreshCw, Search, X } from 'lucide-react';
import api from '../../services/apiClient';
import './CollegeLocations.css';

const pageSize = 10;
const display = (value) => value === null || value === undefined || value === '' ? 'Not available' : value;
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : 'Not available';

const CollegeLocations = () => {
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [college, setCollege] = useState(null);
  const [summary, setSummary] = useState({ total: 0, locationsWithAssets: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', departmentId: '' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(filters); }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    api.get('/api/college/departments', { params: { limit: 100 } })
      .then((response) => setDepartments(response.data?.data || []))
      .catch((requestError) => console.error('College departments lookup failed', requestError));
  }, []);

  useEffect(() => { loadLocations(page); }, [query, page]);

  const loadLocations = async (requestedPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/college/locations', { params: { ...query, page: requestedPage, limit: pageSize } });
      setLocations(response.data?.data || []);
      setCollege(response.data?.college || null);
      setSummary(response.data?.summary || { total: 0, locationsWithAssets: 0 });
      setPagination(response.data?.pagination || { page: requestedPage, pages: 1, total: 0 });
    } catch (requestError) {
      console.error('College locations API failed', requestError);
      setLocations([]);
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load college locations.');
    } finally { setLoading(false); }
  };

  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const totalPages = Math.max(pagination.pages || pagination.totalPages || 1, 1);

  return <div className="college-locations-page">
    <div className="college-locations-heading">
      <div><span className="college-locations-eyebrow">College management</span><p className="college-locations-subtitle">Manage buildings, rooms, and asset locations within your college.</p></div>
      <div className="college-locations-college"><Building2 size={18} /><span>{display(college?.name)}</span><small>{display(college?.code)}</small></div>
      <button type="button" className="college-locations-refresh" onClick={() => loadLocations(page)}><RefreshCw size={16} /> Refresh</button>
    </div>

    <div className="college-locations-summary">
      <SummaryCard icon={MapPin} label="Total Locations" value={summary.total} />
      <SummaryCard icon={Package} label="Locations With Assets" value={summary.locationsWithAssets} />
    </div>

    <section className="college-locations-card">
      <div className="college-locations-toolbar">
        <label className="college-locations-search"><Search size={17} /><span className="sr-only">Search locations</span><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search location, asset, department or description" /></label>
        <select aria-label="Filter by department" value={filters.departmentId} onChange={(event) => updateFilter('departmentId', event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
      </div>

      {loading ? <div className="college-locations-state" role="status">Loading college locations...</div> : error ? <div className="college-locations-state college-locations-error"><strong>Unable to load college locations.</strong><span>{error}</span><button type="button" onClick={() => loadLocations(page)}>Retry</button></div> : !locations.length ? <div className="college-locations-state"><MapPin size={28} /><strong>No locations found for this college.</strong><span>Locations appear when assets have a recorded location.</span></div> : <div className="college-locations-table-wrap"><table><thead><tr><th>Location</th><th>Departments</th><th>Assets</th><th>Created</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{locations.map((location) => <tr key={location.name}><td><strong>{location.name}</strong></td><td>{location.departments?.length ? location.departments.join(', ') : 'Not available'}</td><td>{location.assetCount ?? 0}</td><td>{formatDate(location.createdAt)}</td><td>{formatDate(location.updatedAt)}</td><td><button className="college-locations-view" type="button" onClick={() => setSelected(location)}><Eye size={15} /> View</button></td></tr>)}</tbody></table></div>}
      {!loading && !error && pagination.total > 0 && <div className="college-locations-pagination"><span>Showing page {pagination.page || page} of {totalPages} ({pagination.total} locations)</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
    </section>

    {selected && <div className="college-locations-modal-backdrop"><section className="college-locations-modal" role="dialog" aria-modal="true" aria-labelledby="location-details-title"><div className="college-locations-modal-heading"><div><span className="college-locations-eyebrow">Location details</span><h2 id="location-details-title">{selected.name}</h2></div><button type="button" aria-label="Close location details" onClick={() => setSelected(null)}><X size={19} /></button></div><dl><dt>Location ID</dt><dd>{display(selected.id)}</dd><dt>Location Name</dt><dd>{display(selected.name)}</dd><dt>College</dt><dd>{display(college?.name)}</dd><dt>Departments</dt><dd>{selected.departments?.length ? selected.departments.join(', ') : 'Not available'}</dd><dt>Asset Count</dt><dd>{selected.assetCount ?? 0}</dd><dt>Building / Floor / Room</dt><dd>Not available</dd><dt>Status</dt><dd>Not available</dd><dt>Created Date</dt><dd><CalendarDays size={14} /> {formatDate(selected.createdAt)}</dd><dt>Updated Date</dt><dd>{formatDate(selected.updatedAt)}</dd></dl></section></div>}
  </div>;
};

const SummaryCard = ({ icon: Icon, label, value }) => <article className="college-locations-summary-card"><span><Icon size={19} /></span><strong>{Number(value || 0).toLocaleString()}</strong><small>{label}</small></article>;

export default CollegeLocations;
