import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Clock3,
  ClipboardList,
  Filter,
  FileText,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const EMPTY = {
  data: [],
  summary: {},
  filters: { types: [], priorities: [], statuses: [] },
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

const statusMeta = {
  pending: { label: 'Pending', color: '#f59e0b', background: '#fff7ed', icon: Clock3 },
  approved: { label: 'Approved', color: '#2563eb', background: '#eff6ff', icon: ShieldCheck },
  rejected: { label: 'Rejected', color: '#dc2626', background: '#fef2f2', icon: X },
  cancelled: { label: 'Cancelled', color: '#6b7280', background: '#f3f4f6', icon: X },
};

const priorityMeta = {
  low: { label: 'Low', color: '#64748b', background: '#f1f5f9' },
  medium: { label: 'Medium', color: '#2563eb', background: '#eff6ff' },
  high: { label: 'High', color: '#f59e0b', background: '#fff7ed' },
  critical: { label: 'Critical', color: '#dc2626', background: '#fef2f2' },
};

const title = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');
const display = (value) => (value === null || value === undefined || value === '' ? 'Not recorded' : value);

const InfrastructureRequests = () => {
  const [state, setState] = useState({ ...EMPTY, loading: true, error: '', tableLoading: false });
  const [query, setQuery] = useState({ search: '', status: '', type: '', priority: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: '', item: '', quantity: 1, priority: 'medium', reason: '' });

  const load = useCallback(async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));

    try {
      const response = await api.get('/infrastructure/requests', {
        params: { ...query, page, limit: 20, search: query.search || undefined },
      });

      const payload = response.data || EMPTY;
      setState({
        ...EMPTY,
        ...payload,
        loading: false,
        tableLoading: false,
        error: '',
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        tableLoading: false,
        error: error.response?.data?.message || 'Unable to load infrastructure requests.',
      }));
    }
  }, [page, query]);

  useEffect(() => {
    const timer = setTimeout(() => load(page === 1), 250);
    return () => clearTimeout(timer);
  }, [load, page]);

  useEffect(() => {
    if (state.filters.types?.length && !form.type) {
      setForm((previous) => ({ ...previous, type: state.filters.types[0] }));
    }
  }, [form.type, state.filters.types]);

  const updateQuery = (field, value) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setQuery({ search: '', status: '', type: '', priority: '' });
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.post('/infrastructure/requests', {
        ...form,
        quantity: Number(form.quantity),
      });

      toast.success('Infrastructure request submitted successfully.');
      setShowForm(false);
      setForm({ type: state.filters.types[0] || '', item: '', quantity: 1, priority: 'medium', reason: '' });
      await load(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit request.');
    } finally {
      setSaving(false);
    }
  };

  const submitDecision = async () => {
    if (!decision || (decision.value === 'rejected' && !reason.trim())) return;

    setSaving(true);

    try {
      await api.patch(`/infrastructure/requests/${decision.request.id}/decision`, {
        decision: decision.value,
        comment: reason.trim(),
      });

      toast.success(`Request ${decision.value}.`);
      setDecision(null);
      setReason('');
      await load(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to process request.');
    } finally {
      setSaving(false);
    }
  };

  const summary = state.summary || {};
  const pagination = state.pagination || EMPTY.pagination;
  const requests = Array.isArray(state.data) ? state.data : [];
  const hasFilters = Object.values(query).some(Boolean);

  const summaryCards = useMemo(() => [
    { key: 'total', label: 'Total Requests', icon: ClipboardList, value: summary.total ?? 0 },
    { key: 'pending', label: 'Pending', icon: Clock3, value: summary.pending ?? 0 },
    { key: 'approved', label: 'Approved', icon: ShieldCheck, value: summary.approved ?? 0 },
    { key: 'rejected', label: 'Rejected', icon: AlertTriangle, value: summary.rejected ?? 0 },
    { key: 'cancelled', label: 'Cancelled', icon: X, value: summary.cancelled ?? 0 },
  ], [summary.total, summary.pending, summary.approved, summary.rejected, summary.cancelled]);

  if (state.loading) {
    return (
      <div style={styles.loadingState} aria-live="polite">
        <LoaderCircle size={22} style={{ animation: 'none' }} />
        Loading infrastructure requests...
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={styles.errorState} role="alert">
        <strong>{state.error}</strong>
        <button type="button" style={styles.secondaryButton} onClick={() => load(true)}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <span>Infrastructure</span>
            <span style={{ color: '#94a3b8' }}> / </span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>Requests</span>
          </div>
          <h1 style={styles.pageTitle}>Infrastructure Requests</h1>
          <p style={styles.pageDescription}>
            Create, track, assign, approve, and manage infrastructure service requests across the university.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={() => load(true)} disabled={state.tableLoading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Request
          </button>
        </div>
      </header>

      <section style={styles.summaryGrid} aria-label="Request summary">
        {summaryCards.map(({ key, label, icon: Icon, value }) => (
          <article key={key} style={styles.summaryCard}>
            <div style={styles.summaryIconWrap}>
              <Icon size={18} />
            </div>
            <div>
              <div style={styles.summaryLabel}>{label}</div>
              <strong style={styles.summaryValue}>{Number(value).toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <section style={styles.filterCard} aria-label="Request filters">
        <div style={styles.searchWrap}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            style={styles.searchInput}
            placeholder="Search title, description, department, requester..."
            aria-label="Search infrastructure requests"
          />
        </div>

        <div style={styles.filterSelects}>
          <label style={styles.selectField}>
            <span style={styles.selectLabel}>Status</span>
            <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)}>
              <option value="">All statuses</option>
              {(state.filters.statuses || []).map((status) => (
                <option key={status} value={status}>{title(status)}</option>
              ))}
            </select>
          </label>

          <label style={styles.selectField}>
            <span style={styles.selectLabel}>Type</span>
            <select value={query.type} onChange={(event) => updateQuery('type', event.target.value)}>
              <option value="">All types</option>
              {(state.filters.types || []).map((type) => (
                <option key={type} value={type}>{title(type)}</option>
              ))}
            </select>
          </label>

          <label style={styles.selectField}>
            <span style={styles.selectLabel}>Priority</span>
            <select value={query.priority} onChange={(event) => updateQuery('priority', event.target.value)}>
              <option value="">All priorities</option>
              {(state.filters.priorities || []).map((priority) => (
                <option key={priority} value={priority}>{title(priority)}</option>
              ))}
            </select>
          </label>
        </div>

        {hasFilters && (
          <button type="button" style={styles.filterResetButton} onClick={clearFilters}>
            <Filter size={15} /> Clear filters
          </button>
        )}
      </section>

      <section style={styles.tablePanel}>
        <div style={styles.tableMeta}>
          <span>
            {pagination.total
              ? `Showing ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} requests`
              : 'No request records found'}
          </span>
          {state.tableLoading && <RefreshCw size={15} style={{ animation: 'none' }} />}
        </div>

        {requests.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Request ID</th>
                  <th style={styles.tableHeader}>Title</th>
                  <th style={styles.tableHeader}>Type</th>
                  <th style={styles.tableHeader}>Requester</th>
                  <th style={styles.tableHeader}>Department</th>
                  <th style={styles.tableHeader}>Priority</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={styles.tableHeader}>Created</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const statusValue = String(request.status || '').toLowerCase();
                  const priorityValue = String(request.priority || '').toLowerCase();
                  const status = statusMeta[statusValue] || { label: title(statusValue), color: '#64748b', background: '#f1f5f9', icon: Clock3 };
                  const priority = priorityMeta[priorityValue] || { label: title(priorityValue), color: '#64748b', background: '#f1f5f9' };

                  return (
                    <tr key={request.id} style={styles.tableRow}>
                      <td style={styles.cellStrong}>{request.requestNumber || `REQ-${String(request.id).padStart(6, '0')}`}</td>
                      <td style={styles.cellMain}>
                        <div style={{ fontWeight: 700 }}>{display(request.item || request.asset?.name || 'Infrastructure request')}</div>
                        <div style={styles.subtleText}>{display(request.asset?.assetCode) !== 'Not recorded' ? `Asset: ${display(request.asset?.assetCode)}` : 'Asset not specified'}</div>
                      </td>
                      <td style={styles.cellMain}>{title(request.type)}</td>
                      <td style={styles.cellMain}>{display(request.requester?.name || request.requester?.username)}</td>
                      <td style={styles.cellMain}>{display(request.department?.name)}</td>
                      <td style={styles.cellMain}>
                        <span style={{ ...styles.badge, background: priority.background, color: priority.color }}>{priority.label}</span>
                      </td>
                      <td style={styles.cellMain}>
                        <span style={{ ...styles.badge, background: status.background, color: status.color }}>{status.label}</span>
                      </td>
                      <td style={styles.cellMain}>{date(request.createdAt)}</td>
                      <td style={styles.actionsCell}>
                        <button type="button" style={styles.iconButton} onClick={() => setSelected(request)} title="View details" aria-label="View request details">
                          <FileText size={15} />
                        </button>
                        {request.status === 'pending' && (
                          <>
                            <button type="button" style={{ ...styles.iconButton, background: '#e0f2fe', color: '#0369a1' }} onClick={() => setDecision({ request, value: 'approved' })} title="Approve request" aria-label="Approve request">
                              <ShieldCheck size={15} />
                            </button>
                            <button type="button" style={{ ...styles.iconButton, background: '#fef2f2', color: '#b91c1c' }} onClick={() => setDecision({ request, value: 'rejected' })} title="Reject request" aria-label="Reject request">
                              <X size={15} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <ClipboardList size={28} color="#94a3b8" />
            <strong>No infrastructure requests found</strong>
            <p>Create a new request to begin tracking infrastructure work.</p>
            <button type="button" style={styles.primaryButton} onClick={() => setShowForm(true)}>
              <Plus size={16} /> New Request
            </button>
          </div>
        )}

        <div style={styles.paginationRow}>
          <button type="button" style={styles.paginationButton} disabled={page <= 1 || state.tableLoading} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span style={styles.pageMeta}>Page {pagination.page} of {pagination.totalPages || 1}</span>
          <button type="button" style={styles.paginationButton} disabled={page >= (pagination.totalPages || 1) || state.tableLoading} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      </section>

      {showForm && (
        <div style={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}>
          <div style={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="new-request-title">
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.breadcrumb}>Create infrastructure request</div>
                <h2 id="new-request-title" style={styles.modalTitle}>New Request</h2>
              </div>
              <button type="button" style={styles.closeButton} onClick={() => setShowForm(false)} aria-label="Close form">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitRequest} style={styles.formGrid}>
              <label style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>Request type</span>
                <select
                  value={form.type}
                  onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))}
                  required
                >
                  {(state.filters.types || []).map((type) => (
                    <option key={type} value={type}>{title(type)}</option>
                  ))}
                </select>
              </label>

              <label style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>Request title</span>
                <input
                  type="text"
                  value={form.item}
                  onChange={(event) => setForm((previous) => ({ ...previous, item: event.target.value }))}
                  placeholder="Example: Generator service request"
                  required
                />
              </label>

              <label style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))}
                >
                  {(state.filters.priorities || []).map((priority) => (
                    <option key={priority} value={priority}>{title(priority)}</option>
                  ))}
                </select>
              </label>

              <label style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => setForm((previous) => ({ ...previous, quantity: Number(event.target.value) || 1 }))}
                />
              </label>

              <label style={{ ...styles.fieldGroup, gridColumn: '1 / -1' }}>
                <span style={styles.fieldLabel}>Details</span>
                <textarea
                  rows="5"
                  value={form.reason}
                  onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
                  placeholder="Provide clear details for the infrastructure request."
                  required
                />
              </label>

              <div style={{ ...styles.modalActions, gridColumn: '1 / -1' }}>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton} disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div style={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div style={styles.modalCardLarge} role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.breadcrumb}>Request details</div>
                <h2 id="request-detail-title" style={styles.modalTitle}>{selected.requestNumber || `REQ-${String(selected.id).padStart(6, '0')}`}</h2>
              </div>
              <button type="button" style={styles.closeButton} onClick={() => setSelected(null)} aria-label="Close detail view">
                <X size={18} />
              </button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}><FileText size={16} /> Request Information</div>
                <div style={styles.detailRow}><span>Type</span><strong>{title(selected.type)}</strong></div>
                <div style={styles.detailRow}><span>Item</span><strong>{display(selected.item || selected.asset?.name)}</strong></div>
                <div style={styles.detailRow}><span>Priority</span><strong>{title(selected.priority)}</strong></div>
                <div style={styles.detailRow}><span>Status</span><strong>{title(selected.status)}</strong></div>
                <div style={styles.detailRow}><span>Created</span><strong>{date(selected.createdAt)}</strong></div>
                <div style={styles.detailRow}><span>Updated</span><strong>{date(selected.updatedAt)}</strong></div>
              </div>

              <div style={styles.detailCard}>
                <div style={styles.detailHeading}><UserRound size={16} /> Requester</div>
                <div style={styles.detailRow}><span>Name</span><strong>{display(selected.requester?.name || selected.requester?.username)}</strong></div>
                <div style={styles.detailRow}><span>Department</span><strong>{display(selected.department?.name)}</strong></div>
                <div style={styles.detailRow}><span>Reviewed by</span><strong>{display(selected.reviewer?.name || selected.reviewer?.username)}</strong></div>
              </div>

              <div style={styles.detailCard}>
                <div style={styles.detailHeading}><MapPin size={16} /> Location</div>
                <div style={styles.detailRow}><span>Asset</span><strong>{display(selected.asset?.name || selected.asset?.assetCode)}</strong></div>
                <div style={styles.detailRow}><span>Department</span><strong>{display(selected.department?.name)}</strong></div>
                <div style={styles.detailRow}><span>Quantity</span><strong>{display(selected.quantity)}</strong></div>
              </div>

              <div style={styles.detailCard}>
                <div style={styles.detailHeading}><Building2 size={16} /> Details</div>
                <div style={styles.detailRow}><span>Reason</span><strong>{display(selected.reason || selected.comment)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {decision && (
        <div style={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setDecision(null)}>
          <div style={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="decision-title">
            <div style={styles.modalHeader}>
              <h2 id="decision-title" style={styles.modalTitle}>{decision.value === 'approved' ? 'Approve request' : 'Reject request'}</h2>
              <button type="button" style={styles.closeButton} onClick={() => setDecision(null)} aria-label="Close decision modal">
                <X size={18} />
              </button>
            </div>

            <p style={{ marginBottom: 16 }}>
              {decision.request.requestNumber || `REQ-${String(decision.request.id).padStart(6, '0')}`} • {display(decision.request.item || decision.request.asset?.name)}
            </p>

            {decision.value === 'rejected' && (
              <label style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>Rejection reason</span>
                <textarea rows="4" value={reason} onChange={(event) => setReason(event.target.value)} required />
              </label>
            )}

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setDecision(null)}>
                Cancel
              </button>
              <button type="button" style={styles.primaryButton} onClick={submitDecision} disabled={saving || (decision.value === 'rejected' && !reason.trim())}>
                {saving ? 'Processing...' : `Confirm ${decision.value}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  page: {
    padding: '24px',
    background: '#f8fafc',
    minHeight: '100%',
    color: '#0f172a',
    fontFamily: 'Inter, Segoe UI, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: '8px',
  },
  pageTitle: {
    margin: 0,
    fontSize: '2.1rem',
    fontWeight: 800,
    lineHeight: 1.15,
  },
  pageDescription: {
    margin: '8px 0 0',
    maxWidth: '760px',
    color: '#475569',
    fontSize: '0.98rem',
    lineHeight: 1.6,
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(37, 99, 235, 0.18)',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    border: '1px solid #dfe7f3',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '18px 16px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.03)',
  },
  summaryIconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#eff6ff',
    color: '#1d4ed8',
  },
  summaryLabel: {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  summaryValue: {
    display: 'block',
    fontSize: '1.8rem',
    marginTop: '4px',
    lineHeight: 1.1,
  },
  filterCard: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '18px',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.02)',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '0 12px',
    background: '#f8fafc',
    minWidth: '290px',
    flex: '1 1 260px',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    width: '100%',
    padding: '12px 0',
    fontSize: '0.95rem',
    outline: 'none',
    color: '#0f172a',
  },
  filterSelects: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    flex: '1 1 560px',
  },
  selectField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '150px',
    flex: '1 1 150px',
    fontSize: '0.78rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  selectLabel: {
    fontWeight: 700,
  },
  filterResetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    border: '1px solid #dfe7f3',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tablePanel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.03)',
    overflow: 'hidden',
  },
  tableMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '14px 18px',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontWeight: 600,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '980px',
  },
  tableHeader: {
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: '0.75rem',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  tableRow: {
    borderBottom: '1px solid #eef2f7',
    verticalAlign: 'top',
  },
  cellStrong: {
    padding: '14px 16px',
    fontWeight: 800,
    color: '#0f172a',
  },
  cellMain: {
    padding: '14px 16px',
    color: '#334155',
    fontSize: '0.95rem',
  },
  subtleText: {
    marginTop: '4px',
    color: '#64748b',
    fontSize: '0.78rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '6px 10px',
    fontWeight: 700,
    fontSize: '0.72rem',
    letterSpacing: '0.02em',
  },
  actionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 16px',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    color: '#0f172a',
    cursor: 'pointer',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '16px 18px',
    borderTop: '1px solid #e2e8f0',
  },
  paginationButton: {
    border: '1px solid #dfe7f3',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 600,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  pageMeta: {
    color: '#475569',
    fontWeight: 600,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '12px',
    padding: '40px 20px',
    color: '#475569',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    minHeight: '240px',
    fontSize: '1.05rem',
    color: '#475569',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    minHeight: '220px',
    color: '#b91c1c',
    background: '#fff7f7',
    border: '1px solid #fecaca',
    borderRadius: '16px',
    padding: '24px',
    margin: '24px',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: '560px',
    background: '#fff',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
    padding: '22px',
  },
  modalCardLarge: {
    width: '100%',
    maxWidth: '780px',
    background: '#fff',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
    padding: '22px',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.55rem',
    fontWeight: 800,
  },
  closeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e8f0',
    background: '#fff',
    borderRadius: '10px',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    color: '#334155',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#475569',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  fieldLabel: {
    fontWeight: 700,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  detailCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '16px',
    minHeight: '160px',
  },
  detailHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#475569',
    fontWeight: 800,
    marginBottom: '12px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '7px 0',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '0.9rem',
  },
};

export default InfrastructureRequests;
