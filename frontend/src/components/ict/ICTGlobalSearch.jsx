import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Package, Headset, AlertTriangle, Wrench, User, MapPin, X, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import './ICTGlobalSearch.css';

const categoryConfig = [
  { key: 'assets', label: 'Assets', icon: Package },
  { key: 'tickets', label: 'Tickets', icon: Headset },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'users', label: 'Users', icon: User },
  { key: 'locations', label: 'Locations', icon: MapPin },
];

export default function ICTGlobalSearch() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (query) => {
    if (!query.trim()) { setResults(null); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/ict/search', { params: { search: query } });
      setResults(response.data?.data || null);
      setOpen(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Search failed. Please try again.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) { setResults(null); setError(''); return; }
    debounceRef.current = setTimeout(() => runSearch(search), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search, runSearch]);

  const totalResults = results ? categoryConfig.reduce((sum, cat) => sum + (Array.isArray(results[cat.key]) ? results[cat.key].length : 0), 0) : 0;

  const handleSelect = (category, item) => {
    setOpen(false);
    setSearch('');
    if (category === 'assets') navigate(`/ict/assets?search=${encodeURIComponent(item.name || item.assetCode || '')}`);
    else if (category === 'tickets') navigate(`/ict/support?search=${encodeURIComponent(item.requestCode || item.title || '')}`);
    else if (category === 'incidents') navigate(`/ict/incidents?search=${encodeURIComponent(item.title || item.incidentNumber || '')}`);
    else if (category === 'maintenance') navigate(`/ict/maintenance?search=${encodeURIComponent(item.description || '')}`);
  };

  return (
    <div className="ict-global-search">
      <div className="ict-global-search-bar">
        <Search size={18} className="ict-global-search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search assets, tickets, users, serial numbers..."
          aria-label="Global ICT search"
        />
        {search && <button type="button" className="ict-global-search-clear" onClick={() => { setSearch(''); setResults(null); inputRef.current?.focus(); }}><X size={16} /></button>}
        {loading && <LoaderCircle size={16} className="ict-global-search-spinner spin" />}
      </div>
      {open && results && (
        <div className="ict-global-search-panel">
          {error && <div className="ict-global-search-error">{error}</div>}
          {!error && totalResults === 0 && <div className="ict-global-search-empty">No results found for "{search}".</div>}
          {!error && totalResults > 0 && categoryConfig.map(({ key, label, icon: Icon }) => {
            const items = results[key];
            if (!Array.isArray(items) || !items.length) return null;
            return (
              <div key={key} className="ict-global-search-group">
                <div className="ict-global-search-group-header"><Icon size={14} /> {label} <span>{items.length}</span></div>
                {items.slice(0, 5).map((item) => (
                  <button key={`${key}-${item.id}`} type="button" className="ict-global-search-item" onClick={() => handleSelect(key, item)}>
                    <div className="ict-global-search-item-main">
                      <strong>{item.name || item.title || item.requestCode || item.incidentNumber || item.fullName || item.username || item.type}</strong>
                      <span>{item.assetCode || item.serialNumber || item.requestCode || item.incidentNumber || item.email || item.type || ''}</span>
                    </div>
                    {item.status && <span className={`status status-${String(item.status).toLowerCase().replace(/[\s-]+/g, '-')}`}>{item.status}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
