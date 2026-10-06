import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Eye, ExternalLink, FileText, Plus, RefreshCw, Search, Send, X } from 'lucide-react';
import { apiClient, getApiErrorMessage, resolveAssetUrl } from '../../utils/api';
import './DeptAssetRequests.css';

const REQUEST_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Changes Requested', 'Escalated', 'Completed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const emptyForm = {
  requestedItem: '',
  assetId: '',
  category: '',
  quantity: '1',
  unit: 'unit',
  priority: 'medium',
  justification: '',
  description: '',
  estimatedValue: '',
  neededBy: '',
  status: 'Submitted',
};
const emptySummary = REQUEST_STATUSES.reduce((summary, status) => ({ ...summary, [status]: 0 }), { total: 0 });

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const DeptAssetRequests = () => {
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittingDraft, setSubmittingDraft] = useState(null);

  const loadRequests = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await apiClient.get('/api/department-head/asset-requests', {
        params: {
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          page,
          limit: 20,
        },
      });
      setRequests(Array.isArray(response.data?.data) ? response.data.data : []);
      setSummary(response.data?.summary || emptySummary);
      setPagination(response.data?.pagination || { page: 1, pages: 1, total: 0 });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load asset requests.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, priorityFilter, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => loadRequests(true), 200);
    return () => clearTimeout(timer);
  }, [loadRequests]);

  useEffect(() => {
    let active = true;
    apiClient.get('/api/department-head/assets', { params: { limit: 100 } })
      .then((response) => {
        if (active) setAssets(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((assetError) => {
        if (active) setError(getApiErrorMessage(assetError, 'Unable to load department assets for an optional request reference.'));
      });
    return () => { active = false; };
  }, []);

  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updateFilter = (setter) => (event) => {
    setPage(1);
    setter(event.target.value);
  };

  const createRequest = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.justification.trim()) {
      setFormError('Justification is required.');
      return;
    }
    setSaving(true);
    try {
      const response = await apiClient.post('/api/department-head/asset-requests', {
        ...form,
        quantity: Number(form.quantity),
        assetId: form.assetId ? Number(form.assetId) : null,
        estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue),
      });
      setShowForm(false);
      setForm(emptyForm);
      await loadRequests();
      if (response.data?.data) setSelected(response.data.data);
    } catch (createError) {
      setFormError(getApiErrorMessage(createError, 'Unable to create asset request.'));
    } finally {
      setSaving(false);
    }
  };

  const viewRequest = async (request) => {
    setSelected(request);
    try {
      const response = await apiClient.get(`/api/department-head/asset-requests/${request.id}`);
      if (response.data?.data) setSelected(response.data.data);
    } catch (detailError) {
      setError(getApiErrorMessage(detailError, 'Unable to load request details.'));
    }
  };

  const submitDraft = async (request) => {
    setSubmittingDraft(request.id);
    setError('');
    try {
      const response = await apiClient.post(`/api/department-head/asset-requests/${request.id}/submit`, {});
      setRequests((current) => current.map((item) => item.id === request.id ? response.data.data : item));
      if (selected?.id === request.id) setSelected(response.data.data);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Unable to submit draft request.'));
    } finally {
      setSubmittingDraft(null);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setFormError('');
  };

  return (
    <main className="dept-asset-requests">
      <header className="dar-heading">
        <div>
          <span className="dar-eyebrow"><ClipboardList size={16} /> Department workspace</span>
          <h1>Asset Requests</h1>
          <p>Create and track asset requests for your department.</p>
        </div>
        <div className="dar-heading-actions">
          <button type="button" className="dar-secondary-button" onClick={() => loadRequests()} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'dar-spin' : ''} /> Refresh
          </button>
          <button type="button" className="dar-primary-button" onClick={() => setShowForm(true)}>
            <Plus size={17} /> New request
          </button>
        </div>
      </header>

      <section className="dar-summary" aria-label="Asset request status summary">
        <div><span>Total</span><strong>{summary.total}</strong></div>
        {REQUEST_STATUSES.map((status) => (
          <div key={status}><span>{status}</span><strong>{summary[status]}</strong></div>
        ))}
      </section>

      <section className="dar-toolbar" aria-label="Search and filter requests">
        <label className="dar-search">
          <Search size={17} />
          <span className="sr-only">Search asset requests</span>
          <input value={search} onChange={updateFilter(setSearch)} placeholder="Search request, item, justification..." />
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={statusFilter} onChange={updateFilter(setStatusFilter)}>
            <option value="">All statuses</option>
            {REQUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by priority</span>
          <select value={priorityFilter} onChange={updateFilter(setPriorityFilter)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((priority) => <option value={priority} key={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
          </select>
        </label>
      </section>

      {error && <div className="dar-alert" role="alert">{error}</div>}

      <section className="dar-table-panel" aria-label="Department asset requests">
        {loading ? (
          <div className="dar-state" aria-busy="true"><RefreshCw className="dar-spin" size={18} /> Loading asset requests...</div>
        ) : requests.length ? (
          <div className="dar-table-wrap">
            <table>
              <caption className="sr-only">Asset requests in your department</caption>
              <thead><tr>
                <th>Request</th><th>Requested item</th><th>Quantity</th><th>Priority</th><th>Status</th><th>Requested</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.requestCode}</strong><small>{request.department?.name || 'Department'}</small></td>
                    <td>{request.requestedItem}<small>{request.category || 'Uncategorized'}</small></td>
                    <td>{request.quantity} {request.unit}</td>
                    <td><span className={`dar-priority priority-${request.priority}`}>{request.priority}</span></td>
                    <td><span className={`dar-status status-${request.status.toLowerCase().replaceAll(' ', '-')}`}>{request.status}</span></td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td className="dar-actions">
                      <button type="button" className="dar-icon-button" onClick={() => viewRequest(request)} aria-label={`View ${request.requestCode}`}><Eye size={17} /></button>
                      {['Draft', 'Changes Requested'].includes(request.status) && (
                        <button type="button" className="dar-submit-button" onClick={() => submitDraft(request)} disabled={submittingDraft === request.id}>
                          <Send size={15} /> {submittingDraft === request.id ? 'Submitting' : 'Submit'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dar-state"><FileText size={22} /><strong>No asset requests found</strong><span>Try changing the filters or create a new request.</span></div>
        )}
      </section>
      {pagination.pages > 1 && (
        <nav className="dar-pagination" aria-label="Asset request pages">
          <span>Showing page {pagination.page} of {pagination.pages} ({pagination.total} requests)</span>
          <div>
            <button type="button" className="dar-secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pagination.page <= 1}>Previous</button>
            <button type="button" className="dar-secondary-button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={pagination.page >= pagination.pages}>Next</button>
          </div>
        </nav>
      )}

      {showForm && (
        <div className="dar-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="dar-dialog" role="dialog" aria-modal="true" aria-labelledby="dar-form-title">
            <header><div><span className="dar-eyebrow">Department asset request</span><h2 id="dar-form-title">Create request</h2></div><button type="button" className="dar-icon-button" onClick={closeForm} aria-label="Close form"><X size={19} /></button></header>
            <form onSubmit={createRequest}>
              <div className="dar-form-grid">
                <label className="dar-wide">Requested item <span>*</span><input name="requestedItem" required maxLength="255" value={form.requestedItem} onChange={updateForm} /></label>
                <label>Category<input name="category" maxLength="120" value={form.category} onChange={updateForm} /></label>
                <label>Quantity <span>*</span><input type="number" name="quantity" min="1" step="1" required value={form.quantity} onChange={updateForm} /></label>
                <label>Unit<input name="unit" maxLength="50" value={form.unit} onChange={updateForm} /></label>
                <label className="dar-wide">Related existing asset<select name="assetId" value={form.assetId} onChange={updateForm}><option value="">No existing asset</option>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.name} {asset.assetCode ? `(${asset.assetCode})` : ''}</option>)}</select></label>
                <label>Priority<select name="priority" value={form.priority} onChange={updateForm}>{PRIORITIES.map((priority) => <option value={priority} key={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
                <label>Estimated value<input type="number" name="estimatedValue" min="0" step="0.01" value={form.estimatedValue} onChange={updateForm} /></label>
                <label>Needed by<input type="date" name="neededBy" value={form.neededBy} onChange={updateForm} /></label>
                <label>Status<select name="status" value={form.status} onChange={updateForm}><option>Submitted</option><option>Draft</option></select></label>
                <label className="dar-wide">Justification <span>*</span><textarea name="justification" required minLength="1" rows="4" value={form.justification} onChange={updateForm} /></label>
                <label className="dar-wide">Additional details<textarea name="description" rows="3" value={form.description} onChange={updateForm} /></label>
              </div>
              {formError && <div className="dar-alert" role="alert">{formError}</div>}
              <footer><button type="button" className="dar-secondary-button" onClick={closeForm}>Cancel</button><button type="submit" className="dar-primary-button" disabled={saving}>{saving ? 'Saving...' : form.status === 'Draft' ? 'Save draft' : 'Submit request'}</button></footer>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="dar-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="dar-dialog dar-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="dar-detail-title">
            <header><div><span className="dar-eyebrow">{selected.requestCode}</span><h2 id="dar-detail-title">{selected.requestedItem}</h2></div><button type="button" className="dar-icon-button" onClick={() => setSelected(null)} aria-label="Close request details"><X size={19} /></button></header>
            <div className="dar-detail-status"><span className={`dar-status status-${selected.status.toLowerCase().replaceAll(' ', '-')}`}>{selected.status}</span><span>{selected.priority} priority</span></div>
            <dl className="dar-details">
              <div><dt>Category</dt><dd>{selected.category || 'Not recorded'}</dd></div>
              <div><dt>Quantity</dt><dd>{selected.quantity} {selected.unit}</dd></div>
              <div><dt>Estimated value</dt><dd>{selected.estimatedValue == null ? 'Not recorded' : selected.estimatedValue}</dd></div>
              <div><dt>Needed by</dt><dd>{formatDate(selected.neededBy)}</dd></div>
              <div className="dar-wide"><dt>Justification</dt><dd>{selected.justification}</dd></div>
              <div className="dar-wide"><dt>Additional details</dt><dd>{selected.description || 'Not recorded'}</dd></div>
            </dl>
            <section className="dar-history"><h3>Request history</h3>
              {selected.history?.length ? <ol>{selected.history.map((entry) => <li key={entry.id}><strong>{entry.newStatus}</strong><span>{entry.comment || 'Status updated'} · {entry.changedByName || 'User'} · {formatDate(entry.createdAt)}</span></li>)}</ol> : <p>No history recorded.</p>}
            </section>
            <section className="dar-history"><h3>Supporting documents</h3>
              {selected.supportingDocuments?.length ? <ul className="dar-documents">{selected.supportingDocuments.map((document) => <li key={document.id}><FileText size={16} /><span>{document.name}{document.description ? ` — ${document.description}` : ''}</span><a href={resolveAssetUrl(document.filePath)} target="_blank" rel="noreferrer" aria-label={`Open ${document.name}`}><ExternalLink size={16} /></a></li>)}</ul> : <p>No supporting documents are attached.</p>}
            </section>
          </section>
        </div>
      )}
    </main>
  );
};

export default DeptAssetRequests;
