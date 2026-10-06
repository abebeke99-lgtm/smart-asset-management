import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, MapPin, Package, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/apiClient';
import './CollegeLocations.css';

const pageSize = 20;
const display = (value) => value === null || value === undefined || value === '' ? 'Not available' : value;

const CollegeLocations = () => {
  const { hasPermission } = useAuth();
  const canManageLocations = hasPermission('college.locations.manage');
  const [campuses, setCampuses] = useState([]);
  const [college, setCollege] = useState(null);
  const [summary, setSummary] = useState({ total: 0, campuses: 0, buildings: 0, rooms: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'building', campusId: '', buildingId: '', name: '', code: '', description: '', floorCount: 1, roomType: 'laboratory' });

  const loadLocations = async (requestedPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/college/locations', { params: { ...filters, page: requestedPage, limit: pageSize } });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      const nextCampuses = Array.isArray(response.data?.campuses) ? response.data.campuses : [];
      setCampuses(nextCampuses.length ? nextCampuses : data.filter((item) => item.type === 'campus'));
      setCollege(response.data?.college || null);
      setSummary(response.data?.summary || { total: 0, campuses: 0, buildings: 0, rooms: 0 });
      setPagination(response.data?.pagination || { page: requestedPage, pages: 1, total: 0 });
    } catch (requestError) {
      setCampuses([]);
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load college locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); loadLocations(1); }, 250);
    return () => clearTimeout(timer);
  }, [filters.search, filters.status]);

  useEffect(() => {
    if (page > 1 || !campuses.length) return;
    loadLocations(page);
  }, [page]);

  const campusOptions = useMemo(() => campuses.flatMap((campus) => campus.children?.length ? [campus] : []), [campuses]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canManageLocations) return;
    try {
      const payload = { type: form.type, name: form.name, code: form.code, description: form.description, campusId: form.campusId || undefined, buildingId: form.buildingId || undefined, roomType: form.roomType, floor: form.floorCount ? Number(form.floorCount) : undefined, floorCount: form.floorCount ? Number(form.floorCount) : undefined };
      if (!payload.name) return;
      await api.post('/api/college/locations', payload);
      setShowForm(false);
      setForm({ type: 'building', campusId: '', buildingId: '', name: '', code: '', description: '', floorCount: 1, roomType: 'laboratory' });
      loadLocations(page);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save location.');
    }
  };

  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const totalPages = Math.max(pagination.pages || pagination.totalPages || 1, 1);

  return <div className="college-locations-page">
    <div className="college-locations-heading">
      <div><span className="college-locations-eyebrow">College Management</span><p className="college-locations-subtitle">View and manage locations belonging to your authorized college.</p></div>
      <div className="college-locations-college"><Building2 size={18} /><span>{display(college?.name)}</span><small>{display(college?.code)}</small></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" className="college-locations-refresh" onClick={() => loadLocations(page)}><RefreshCw size={16} /> Refresh</button>
        {canManageLocations && <button type="button" className="college-locations-refresh" onClick={() => setShowForm((value) => !value)}><Plus size={16} /> Add Location</button>}
      </div>
    </div>

    <div className="college-locations-summary">
      <SummaryCard icon={MapPin} label="Campuses" value={summary.campuses || campuses.length || 0} />
      <SummaryCard icon={Building2} label="Buildings" value={summary.buildings || 0} />
      <SummaryCard icon={Package} label="Rooms" value={summary.rooms || 0} />
    </div>

    <section className="college-locations-card">
      <div className="college-locations-toolbar">
        <label className="college-locations-search"><Search size={17} /><span className="sr-only">Search locations</span><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search campus, building or room" /></label>
        <select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {showForm && canManageLocations && <form className="college-locations-form" onSubmit={handleCreate}><div className="college-locations-form-row"><label>Location Type<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="building">Building</option><option value="room">Room</option></select></label><label>Campus<select value={form.campusId} onChange={(event) => setForm((current) => ({ ...current, campusId: event.target.value }))}><option value="">Select campus</option>{campusOptions.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label></div>{form.type === 'room' && <label>Building<select value={form.buildingId} onChange={(event) => setForm((current) => ({ ...current, buildingId: event.target.value }))}><option value="">Select building</option>{campusOptions.flatMap((campus) => (campus.children || []).filter((node) => node.type === 'building').map((building) => <option key={building.id} value={building.id}>{campus.name} / {building.name}</option>))}</select></label>}<label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label>Code<input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label><label>Description<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>{form.type === 'room' && <div className="college-locations-form-row"><label>Room Type<select value={form.roomType} onChange={(event) => setForm((current) => ({ ...current, roomType: event.target.value }))}><option value="laboratory">Laboratory</option><option value="office">Office</option></select></label><label>Floor<input type="number" min="0" value={form.floorCount} onChange={(event) => setForm((current) => ({ ...current, floorCount: event.target.value }))} /></label></div>}<div className="college-locations-form-actions"><button type="button" className="college-locations-refresh" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="college-locations-refresh">Save Location</button></div></form>}

      {loading ? <div className="college-locations-state" role="status">Loading college locations...</div> : error ? <div className="college-locations-state college-locations-error"><strong>Unable to load locations.</strong><span>{error}</span><button type="button" onClick={() => loadLocations(page)}>Retry</button></div> : !campuses.length ? <div className="college-locations-state"><MapPin size={28} /><strong>No locations found for this college.</strong>{canManageLocations && <span>Add your first location</span>}</div> : <div className="college-locations-tree">{campuses.map((campus) => <LocationNode key={campus.id} node={campus} onSelect={setSelected} />)}</div>}

      {!loading && !error && pagination.total > 0 && <div className="college-locations-pagination"><span>Showing page {pagination.page || page} of {totalPages} ({pagination.total} records)</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
    </section>

    {selected && <div className="college-locations-modal-backdrop"><section className="college-locations-modal" role="dialog" aria-modal="true" aria-labelledby="location-details-title"><div className="college-locations-modal-heading"><div><span className="college-locations-eyebrow">Location Details</span><h2 id="location-details-title">{selected.name}</h2></div><button type="button" aria-label="Close location details" onClick={() => setSelected(null)}><X size={19} /></button></div><dl><dt>Type</dt><dd>{display(selected.type)}</dd><dt>Name</dt><dd>{display(selected.name)}</dd><dt>Code</dt><dd>{display(selected.code || selected.campusCode || selected.buildingCode || selected.roomCode)}</dd><dt>Status</dt><dd>{display(selected.status)}</dd><dt>Description</dt><dd>{display(selected.description)}</dd>{selected.type === 'room' && <><dt>Room Type</dt><dd>{display(selected.roomType)}</dd><dt>Building</dt><dd>{display(selected.parentName || selected.buildingName)}</dd></>}{selected.type === 'building' && <><dt>Campus</dt><dd>{display(selected.parentName || selected.campusName)}</dd></>}</dl></section></div>}
  </div>;
};

const LocationNode = ({ node, level = 0, onSelect }) => (
  <div className="college-locations-tree-item" style={{ marginLeft: `${level * 16}px` }}>
    <button type="button" className="college-locations-tree-node" onClick={() => onSelect(node)}>
      <ChevronRight size={14} /> <span>{node.name}</span>
      <small>{node.type}</small>
    </button>
    {(node.children || []).map((child) => <LocationNode key={`${node.id}-${child.id}`} node={child} level={level + 1} onSelect={onSelect} />)}
  </div>
);

const SummaryCard = ({ icon: Icon, label, value }) => <article className="college-locations-summary-card"><span><Icon size={19} /></span><strong>{Number(value || 0).toLocaleString()}</strong><small>{label}</small></article>;

export default CollegeLocations;
