import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../utils/api';
import './AdminChemicalQuarantine.css';

const PAGE_SIZE = 50;

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString();
};

const getRequestError = (error) => {
  const status = error?.response?.status;
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'You are not authorized to manage chemical quarantine.';
  if (!navigator.onLine) return 'Unable to connect to the server. Check your connection and retry.';
  return 'Unable to load quarantine records. Please retry.';
};

const AdminChemicalQuarantine = () => {
  const [chemicals, setChemicals] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasingId, setReleasingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const loadQuarantine = useCallback(async (requestedPage = page, searchTerm = search) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/admin/inventory/quarantine', {
        params: { page: requestedPage, limit: PAGE_SIZE, ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}) },
      });
      const payload = response?.data || {};
      setChemicals(Array.isArray(payload.data) ? payload.data : []);
      setPagination(payload.pagination || { total: payload.total || 0, pages: 1 });
    } catch (requestError) {
      setChemicals([]);
      setError(getRequestError(requestError));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(() => loadQuarantine(page, search), 250);
    return () => clearTimeout(timer);
  }, [loadQuarantine, page, search]);

  const releaseQuarantine = async (chemical) => {
    if (!window.confirm(`Release ${chemical.name || 'this chemical'} from quarantine?`)) return;
    setReleasingId(chemical.id);
    setActionError('');
    try {
      await apiClient.put(`/api/admin/inventory/${chemical.id}`, { remove_quarantine: true });
      await loadQuarantine(page);
    } catch (requestError) {
      setActionError(getRequestError(requestError));
    } finally {
      setReleasingId(null);
    }
  };

  return (
    <main className="admin-workspace-page admin-quarantine-page">
      <header className="admin-page-header">
        <div>
          <div className="admin-breadcrumb">Inventory / Safety</div>
          <h1 className="admin-page-title">Chemical quarantine</h1>
          <p className="admin-page-subtitle">Review restricted chemicals and release records after the safety issue is resolved.</p>
        </div>
        <button type="button" className="admin-secondary-button quarantine-refresh" onClick={() => loadQuarantine(page)} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </header>

      <section className="quarantine-summary" aria-label="Quarantine summary">
        <ShieldAlert size={20} aria-hidden="true" />
        <div><strong>{pagination.total}</strong><span>quarantined records</span></div>
      </section>

      <div className="quarantine-toolbar">
        <label className="quarantine-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search quarantine records</span>
          <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search name, code, CAS number, or reason" />
        </label>
      </div>

      {actionError && <div className="admin-error-state" role="alert">{actionError}</div>}
      {error && <div className="admin-error-state" role="alert"><span>{error}</span><button type="button" className="admin-secondary-button" onClick={() => loadQuarantine(page)}>Retry</button></div>}

      <section className="admin-table-card" aria-label="Quarantined chemicals">
        {loading ? (
          <div className="admin-empty-state" role="status">Loading quarantine records...</div>
        ) : chemicals.length === 0 ? (
          <div className="admin-empty-state">{search ? 'No quarantine records match your search.' : 'No chemicals are currently quarantined.'}</div>
        ) : (
          <div className="admin-table-scroll quarantine-table-scroll">
            <table className="admin-table quarantine-table">
              <thead><tr><th>Chemical</th><th>Code / CAS</th><th>Quantity</th><th>Quarantine reason</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {chemicals.map((chemical) => (
                  <tr key={chemical.id}>
                    <td><strong>{chemical.name || 'Unnamed chemical'}</strong><small>{chemical.formula || chemical.ghsHazardClass || 'Hazard details unavailable'}</small></td>
                    <td>{chemical.chemicalCode || '—'}<small>{chemical.casNumber || 'No CAS number'}</small></td>
                    <td>{Number(chemical.quantity || 0).toLocaleString()} {chemical.unit || ''}</td>
                    <td className="quarantine-reason">{chemical.quarantineReason || 'No reason recorded'}</td>
                    <td>{formatDate(chemical.updatedAt || chemical.updated_at)}</td>
                    <td><button type="button" className="quarantine-release-button" onClick={() => releaseQuarantine(chemical)} disabled={releasingId === chemical.id}>
                      {releasingId === chemical.id ? 'Releasing...' : 'Release'}
                    </button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && pagination.pages > 1 && (
          <div className="admin-pagination">
            <button type="button" className="admin-secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
            <span>Page {page} of {pagination.pages}</span>
            <button type="button" className="admin-secondary-button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages}>Next</button>
          </div>
        )}
      </section>
    </main>
  );
};

export default AdminChemicalQuarantine;
