import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Package,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ICTInventory.css';

const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/ict/inventory`;
const PAGE_SIZE = 25;
const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

const SUMMARY_CARDS = [
  { key: 'totalItems', label: 'Total Items', icon: Package, tone: 'blue' },
  { key: 'available', label: 'Available', icon: CheckCircle2, tone: 'green' },
  { key: 'assigned', label: 'Assigned', icon: Package, tone: 'purple' },
  { key: 'damaged', label: 'Damaged', icon: AlertCircle, tone: 'red' },
  { key: 'missing', label: 'Missing', icon: AlertCircle, tone: 'orange' },
  { key: 'underMaintenance', label: 'Under Maintenance', icon: RefreshCw, tone: 'amber' },
  { key: 'replaced', label: 'Replaced', icon: RefreshCw, tone: 'slate' },
  { key: 'expired', label: 'Expired', icon: AlertCircle, tone: 'red' },
];

const EMPTY_SUMMARY = SUMMARY_CARDS.reduce((summary, card) => {
  summary[card.key] = 0;
  return summary;
}, {});

const displayDate = (date) => {
  if (!date) return '—';
  const value = String(date).slice(0, 10);
  return value === 'Invalid ' ? '—' : value;
};

const displayName = (asset) => asset.name || asset.itemName || 'Unnamed asset';

const getToken = () =>
  localStorage.getItem('token')
  || localStorage.getItem('accessToken')
  || sessionStorage.getItem('token')
  || '';

const requestJson = async (url, options = {}) => {
  const token = getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `Request failed with status ${response.status}`);
  }
  return body;
};

const ICTInventory = () => {
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [options, setOptions] = useState({
    categories: [],
    statuses: [],
    conditions: [],
    campuses: [],
    colleges: [],
    departments: [],
    locations: [],
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    condition: '',
    campusId: '',
    collegeId: '',
    departmentId: '',
    location: '',
  });
  const [sort, setSort] = useState({ sortBy: 'updatedAt', sortOrder: 'DESC' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const loadInventory = useCallback(async (signal, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      ...sort,
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });

    try {
      const result = await requestJson(`${API_URL}?${query.toString()}`, { signal });
      setAssets(Array.isArray(result.data) ? result.data : []);
      setSummary({ ...EMPTY_SUMMARY, ...(result.summary || {}) });
      setOptions((previous) => ({ ...previous, ...(result.options || {}) }));
      setPagination(result.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters, page, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadInventory(controller.signal), 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadInventory]);

  const updateFilter = (field, value) => {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      condition: '',
      campusId: '',
      collegeId: '',
      departmentId: '',
      location: '',
    });
    setPage(1);
  };

  const toggleSort = (field) => {
    setSort((previous) => ({
      sortBy: field,
      sortOrder: previous.sortBy === field && previous.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
    setPage(1);
  };

  const sortIcon = (field) => {
    if (sort.sortBy !== field) return null;
    return sort.sortOrder === 'ASC' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    setImportSummary(null);
    if (!/\.(csv|xls|xlsx)$/i.test(file.name)) {
      setImportError('Select an Excel (.xls, .xlsx) or CSV file.');
      return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
      setImportError('The spreadsheet must be 10 MB or smaller.');
      return;
    }

    setImportBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error('The selected file does not contain a worksheet.');
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '', raw: false });
      if (!rows.length) throw new Error('The first worksheet does not contain any inventory rows.');
      if (rows.length > 2000) throw new Error('A maximum of 2,000 rows may be imported at a time.');

      const response = await requestJson(`${API_URL}/import`, {
        method: 'POST',
        body: JSON.stringify({ rows, preview: true }),
      });
      setImportPreview({ fileName: file.name, rows, results: response.results || [], summary: response.summary });
    } catch (previewError) {
      setImportError(previewError.message || 'Unable to read or validate this spreadsheet.');
    } finally {
      setImportBusy(false);
    }
  };

  const saveImport = async () => {
    if (!importPreview) return;
    setImportBusy(true);
    setImportError('');
    try {
      const response = await requestJson(`${API_URL}/import`, {
        method: 'POST',
        body: JSON.stringify({ rows: importPreview.rows }),
      });
      setImportSummary(response.summary);
      setImportPreview(null);
      setPage(1);
      await loadInventory(undefined, true);
    } catch (saveError) {
      setImportError(saveError.message || 'The inventory import could not be saved.');
    } finally {
      setImportBusy(false);
    }
  };

  const exportCsv = () => {
    const columns = ['assetCode', 'name', 'category', 'serialNumber', 'status', 'condition', 'campus', 'college', 'departmentName', 'location', 'purchaseDate', 'expiryDate'];
    const lines = [
      columns,
      ...assets.map((asset) => columns.map((column) => asset[column] ?? '')),
    ];
    const csv = lines.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `ict-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const filterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'search' && value).length,
    [filters],
  );

  const setFilterFromEvent = (event) => updateFilter(event.target.name, event.target.value);

  return (
    <main className="ict-inventory-page">
      <header className="inventory-header">
        <div>
          <p className="eyebrow">ICT ASSET MANAGEMENT</p>
          <h1>ICT Inventory</h1>
          <p>Central inventory visibility for ICT assets across your organization.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={exportCsv} disabled={!assets.length}>
            Export CSV
          </button>
          <label className={`primary-button import-trigger${importBusy ? ' is-disabled' : ''}`}>
            <Upload size={16} />
            {importBusy ? 'Validating…' : 'Import Excel / CSV'}
            <input
              aria-label="Import Excel or CSV inventory"
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={importFile}
              disabled={importBusy}
            />
          </label>
          <button className="secondary-button" type="button" onClick={() => loadInventory(undefined, true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => loadInventory(undefined, true)}>Retry</button>
        </div>
      )}

      <section className="summary-grid" aria-label="Inventory summary">
        {SUMMARY_CARDS.map(({ key, label, icon: Icon, tone }) => (
          <article className={`summary-card ${tone}`} key={key}>
            <span className="summary-icon"><Icon size={19} /></span>
            <strong>{loading ? '—' : Number(summary[key] || 0).toLocaleString()}</strong>
            <small>{label}</small>
          </article>
        ))}
      </section>

      {importError && <div className="error-banner" role="alert"><AlertCircle size={18} /><span>{importError}</span><button type="button" onClick={() => setImportError('')}>Dismiss</button></div>}
      {importSummary && (
        <section className="import-report" role="status" aria-label="Import summary">
          <div className="import-report-heading">
            <div><CheckCircle2 size={19} /><strong>Import complete</strong></div>
            <button type="button" aria-label="Dismiss import summary" onClick={() => setImportSummary(null)}><X size={17} /></button>
          </div>
          <div className="import-totals">
            {['total', 'imported', 'rejected', 'duplicates', 'errors'].map((key) => (
              <span key={key}><strong>{Number(importSummary[key] || 0).toLocaleString()}</strong>{key[0].toUpperCase() + key.slice(1)}</span>
            ))}
          </div>
        </section>
      )}

      <section className="filter-panel" aria-label="Inventory filters">
        <label className="search-input">
          <Search size={17} />
          <span className="sr-only">Search inventory</span>
          <input
            name="search"
            value={filters.search}
            onChange={setFilterFromEvent}
            placeholder="Search name, asset tag, serial number…"
          />
        </label>
        <select aria-label="Filter by category" name="category" value={filters.category} onChange={setFilterFromEvent}>
          <option value="">All categories</option>
          {options.categories.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by status" name="status" value={filters.status} onChange={setFilterFromEvent}>
          <option value="">All statuses</option>
          {options.statuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Filter by condition" name="condition" value={filters.condition} onChange={setFilterFromEvent}>
          <option value="">All conditions</option>
          {options.conditions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Filter by campus" name="campusId" value={filters.campusId} onChange={setFilterFromEvent}>
          <option value="">All campuses</option>
          {options.campuses.map((item) => <option key={item.id} value={item.id}>{item.campusName}</option>)}
        </select>
        <select aria-label="Filter by college" name="collegeId" value={filters.collegeId} onChange={setFilterFromEvent}>
          <option value="">All colleges</option>
          {options.colleges.map((item) => <option key={item.id} value={item.id}>{item.collegeName}</option>)}
        </select>
        <select aria-label="Filter by department" name="departmentId" value={filters.departmentId} onChange={setFilterFromEvent}>
          <option value="">All departments</option>
          {options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by location" name="location" value={filters.location} onChange={setFilterFromEvent}>
          <option value="">All locations</option>
          {options.locations.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        {filterCount > 0 && <button className="clear-button" type="button" onClick={clearFilters}>Clear filters ({filterCount})</button>}
      </section>

      <section className="table-panel">
        <div className="panel-heading">
          <div><h2>Inventory records</h2><p>{Number(pagination.total || 0).toLocaleString()} matching assets</p></div>
          <span>Central MySQL asset records</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  ['assetCode', 'Asset tag'],
                  ['name', 'Asset'],
                  ['category', 'Category'],
                  ['serialNumber', 'Serial number'],
                  ['status', 'Status'],
                  ['condition', 'Condition'],
                  ['campusId', 'Campus'],
                  ['collegeId', 'College'],
                  ['department', 'Department'],
                  ['location', 'Location'],
                ].map(([field, label]) => (
                  <th key={field}>
                    <button type="button" onClick={() => toggleSort(field)}>{label}{sortIcon(field)}</button>
                  </th>
                ))}
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="empty-cell" colSpan="11">Loading inventory from the central database…</td></tr>
              ) : assets.length ? assets.map((asset) => (
                <tr key={asset.id}>
                  <td><strong>{asset.assetCode || asset.assetTag || '—'}</strong></td>
                  <td><strong>{displayName(asset)}</strong><small>{asset.model || asset.manufacturer || ''}</small></td>
                  <td>{asset.category || '—'}</td>
                  <td>{asset.serialNumber || '—'}</td>
                  <td><span className={`status-badge ${String(asset.status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{asset.status || '—'}</span></td>
                  <td>{asset.condition || '—'}</td>
                  <td>{asset.campus || '—'}</td>
                  <td>{asset.college || '—'}</td>
                  <td>{asset.departmentName || asset.department || '—'}</td>
                  <td>{asset.location || '—'}</td>
                  <td><button className="view-button" type="button" onClick={() => setSelectedAsset(asset)} aria-label={`View ${displayName(asset)}`}><Eye size={16} /> View</button></td>
                </tr>
              )) : (
                <tr><td className="empty-cell" colSpan="11"><Package size={24} /><strong>No inventory records found</strong><span>Try changing or clearing the selected filters.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="pagination">
          <span>Page {pagination.page || page} of {Math.max(1, pagination.totalPages || 1)}</span>
          <div>
            <button type="button" aria-label="Previous page" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}><ChevronLeft size={16} /> Previous</button>
            <button type="button" aria-label="Next page" onClick={() => setPage((value) => Math.min(pagination.totalPages || 1, value + 1))} disabled={page >= (pagination.totalPages || 1)}>Next <ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      {importPreview && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="modal-title">
              <div><span className="modal-icon"><FileSpreadsheet size={20} /></span><div><h2 id="import-title">Review spreadsheet import</h2><p>{importPreview.fileName} · {importPreview.summary?.total || 0} rows</p></div></div>
              <button type="button" aria-label="Close import preview" onClick={() => setImportPreview(null)}><X size={18} /></button>
            </div>
            <div className="import-totals preview-totals">
              {['total', 'imported', 'rejected', 'duplicates', 'errors'].map((key) => (
                <span key={key}><strong>{Number(importPreview.summary?.[key] || 0).toLocaleString()}</strong>{key[0].toUpperCase() + key.slice(1)}</span>
              ))}
            </div>
            <p className="preview-note">Review the server validation below. Only valid, non-duplicate rows will be saved.</p>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead><tr><th>Row</th><th>Asset</th><th>Serial number</th><th>Category</th><th>Status</th><th>Validation</th></tr></thead>
                <tbody>
                  {importPreview.results.map((item) => (
                    <tr key={item.row}>
                      <td>{item.row}</td>
                      <td>{item.record?.name || '—'}</td>
                      <td>{item.record?.serialNumber || '—'}</td>
                      <td>{item.record?.category || '—'}</td>
                      <td>{item.record?.status || '—'}</td>
                      <td>{item.valid ? <span className="valid-label">Ready</span> : <span className="invalid-label">{item.duplicate ? 'Duplicate serial number' : ''}{item.errors?.map((issue) => `${issue.field}: ${issue.message}`).join('; ')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setImportPreview(null)} disabled={importBusy}>Cancel</button>
              <button className="primary-button" type="button" onClick={saveImport} disabled={importBusy || !importPreview.summary?.valid}>
                {importBusy ? 'Saving…' : `Import ${importPreview.summary?.valid || 0} valid records`}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedAsset && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAsset(null); }}>
          <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="asset-detail-title">
            <div className="modal-title">
              <div><span className="modal-icon"><Package size={20} /></span><div><h2 id="asset-detail-title">{displayName(selectedAsset)}</h2><p>{selectedAsset.assetCode || selectedAsset.assetTag || 'Asset details'}</p></div></div>
              <button type="button" aria-label="Close asset details" onClick={() => setSelectedAsset(null)}><X size={18} /></button>
            </div>
            <dl className="detail-grid">
              {[
                ['Serial number', selectedAsset.serialNumber],
                ['Category', selectedAsset.category],
                ['Status', selectedAsset.status],
                ['Condition', selectedAsset.condition],
                ['Campus', selectedAsset.campus],
                ['College', selectedAsset.college],
                ['Department', selectedAsset.departmentName || selectedAsset.department],
                ['Location', selectedAsset.location],
                ['Manufacturer', selectedAsset.manufacturer],
                ['Model', selectedAsset.model],
                ['Purchase date', displayDate(selectedAsset.purchaseDate)],
                ['Expiry date', displayDate(selectedAsset.expiryDate)],
                ['Warranty expiry', displayDate(selectedAsset.warrantyExpiry)],
                ['Description', selectedAsset.description],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
            </dl>
            <div className="modal-actions"><button className="primary-button" type="button" onClick={() => setSelectedAsset(null)}>Close</button></div>
          </section>
        </div>
      )}
    </main>
  );
};

export default ICTInventory;
