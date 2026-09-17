import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../services/api';
import './FinanceSuppliers.css';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : 'Not recorded';

export default function FinanceSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiClient.get('/api/finance/suppliers', { params: { search, page, limit: 20 } })
      .then(({ data }) => {
        if (!active) return;
        setSuppliers(data.data || []);
        setPagination(data.pagination || { page, pages: 1, total: 0 });
      })
      .catch((requestError) => {
        if (!active) return;
        const status = requestError.response?.status;
        setError(status === 401 ? 'Please sign in to view suppliers.' : status === 403 ? 'You are not authorized to view suppliers.' : 'Unable to load suppliers. Please try again.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [search, page, retryToken]);

  return (
    <main className="finance-suppliers">
      <header className="suppliers-heading"><div><p className="eyebrow">Procurement</p><h1>Suppliers</h1><p>Supplier records linked to assets in the university database.</p></div><div className="supplier-total"><Building2 size={20} /><strong>{pagination.total}</strong><span>Total suppliers</span></div></header>
      <section className="supplier-toolbar" aria-label="Supplier search"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search supplier name" aria-label="Search supplier name" />{search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} title="Clear search"><X size={16} /></button>}</section>
      {error && <div className="supplier-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => setRetryToken((current) => current + 1)}><RefreshCw size={15} /> Retry</button></div>}
      <section className="supplier-table-card">{loading ? <div className="supplier-state"><RefreshCw className="spin" size={24} /><span>Loading suppliers...</span></div> : suppliers.length === 0 ? <div className="supplier-state"><Building2 size={30} /><span>No suppliers found.</span></div> : <><div className="supplier-table-wrap"><table><thead><tr><th>Supplier name</th><th>Linked assets</th><th>Last purchase date</th><th>First recorded</th><th aria-label="Actions" /></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.supplierName}><td>{supplier.supplierName}</td><td>{supplier.assetCount}</td><td>{formatDate(supplier.lastPurchaseDate)}</td><td>{formatDate(supplier.firstRecordedAt)}</td><td><button type="button" onClick={() => setSelected(supplier)}><Eye size={15} /> Details</button></td></tr>)}</tbody></table></div><footer className="supplier-pagination"><span>Page {pagination.page} of {Math.max(1, pagination.pages)}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} title="Previous page"><ChevronLeft size={17} /></button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} title="Next page"><ChevronRight size={17} /></button></div></footer></>}</section>
      {selected && <div className="supplier-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="supplier-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-details-title" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setSelected(null)} title="Close details"><X size={18} /></button><p className="eyebrow">Supplier details</p><h2 id="supplier-details-title">{selected.supplierName}</h2><dl><dt>Linked assets</dt><dd>{selected.assetCount}</dd><dt>Last purchase date</dt><dd>{formatDate(selected.lastPurchaseDate)}</dd><dt>First recorded</dt><dd>{formatDate(selected.firstRecordedAt)}</dd></dl></section></div>}
    </main>
  );
}