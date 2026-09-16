import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, FileText, RefreshCw, Search, X, Wrench, AlertTriangle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeMaintenance.css';

const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '-').replace(/^-+|-+$/g, '');
const label = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const display = (value, fallback = 'Not recorded') => value === null || value === undefined || value === '' ? fallback : value;
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'ETB' });
};

const emptySummary = { total: 0, open: 0, inProgress: 0, completed: 0, overdue: 0, underMaintenance: 0 };
const emptyPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };

const CollegeMaintenance = () => {
  const [state, setState] = useState({
    loading: true,
    tableLoading: false,
    error: '',
    records: [],
    summary: emptySummary,
    filters: { departments: [], statuses: [], types: [] },
    pagination: emptyPagination,
    college: null,
  });
  const [query, setQuery] = useState({ search: '', departmentId: '', status: '', type: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadMaintenance = useCallback(async (initial = false) => {
    setState((previous) => ({ ...previous, loading: initial, tableLoading: !initial, error: '' }));
    try {
      const response = await apiClient.get('/api/college/maintenance', {
        params: {
          ...query,
          page,
          limit: 10,
          search: query.search || undefined,
          departmentId: query.departmentId || undefined,
          status: query.status || undefined,
          type: query.type || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      });
      const payload = response.data || {};
      setState((previous) => ({
        ...previous,
        loading: false,
        tableLoading: false,
        records: payload.data || [],
        summary: payload.summary || emptySummary,
        filters: payload.filters || previous.filters,
        pagination: payload.pagination || emptyPagination,
        college: payload.college || previous.college,
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        tableLoading: false,
        error: error.response?.data?.message || 'Failed to load maintenance data.',
      }));
    }
  }, [page, query]);

  useEffect(() => {
    const timer = setTimeout(() => loadMaintenance(!state.records.length && state.loading), 200);
    return () => clearTimeout(timer);
  }, [loadMaintenance, state.loading, state.records.length]);

  const updateQuery = (field, value) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setQuery({ search: '', departmentId: '', status: '', type: '', dateFrom: '', dateTo: '' });
  };

  const openDetails = async (record) => {
    setSelected({ ...record, loading: true });
    setDetailsLoading(true);
    try {
      const response = await apiClient.get(`/api/college/maintenance/${record.id}`);
      setSelected(response.data?.data || record);
    } catch (error) {
      setSelected({ ...record, detailError: error.response?.data?.message || 'Unable to load maintenance details.' });
    } finally {
      setDetailsLoading(false);
    }
  };

  const hasFilters = Object.values(query).some(Boolean);
  const pagination = state.pagination;
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  const statusBadgeClass = (status) => {
    const normalized = normalizeStatus(status);
    if (['open', 'pending'].includes(normalized)) return 'status-open';
    if (['in-progress', 'in_progress', 'assigned'].includes(normalized)) return 'status-progress';
    if (['completed', 'resolved', 'closed'].includes(normalized)) return 'status-completed';
    if (['cancelled', 'rejected'].includes(normalized)) return 'status-cancelled';
    if (['overdue'].includes(normalized)) return 'status-overdue';
    return 'status-default';
  };

  const priorityBadgeClass = (priority) => {
    const normalized = normalizeStatus(priority);
    if (['critical', 'urgent'].includes(normalized)) return 'priority-critical';
    if (['high'].includes(normalized)) return 'priority-high';
    if (['medium', 'normal'].includes(normalized)) return 'priority-medium';
    if (['low'].includes(normalized)) return 'priority-low';
    return 'priority-default';
  };

  if (state.loading) {
    return (
      <div className="college-maintenance-state" aria-busy="true">
        <RefreshCw className="college-maintenance-spin" />
        <span>Loading maintenance records...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="college-maintenance-state college-maintenance-error" role="alert">
        <strong>{state.error}</strong>
        <button type="button" onClick={() => loadMaintenance(true)}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="college-maintenance-page">
      <header className="college-maintenance-header">
        <div>
          <span className="college-maintenance-eyebrow"><Wrench size={15} /> College Manager</span>
          <h1>Maintenance</h1>
          <p>{state.college?.name ? `${state.college.name} · ` : ''}Monitor maintenance and repair activity for the authenticated college.</p>
        </div>
        <button className="college-maintenance-refresh" type="button" onClick={() => loadMaintenance()} disabled={state.tableLoading}>
          <RefreshCw size={16} className={state.tableLoading ? 'college-maintenance-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="college-maintenance-summary" aria-label="Maintenance summary">
        {[
          ['total', 'Total Maintenance Records'],
          ['open', 'Open'],
          ['inProgress', 'In Progress'],
          ['completed', 'Completed'],
          ['overdue', 'Overdue'],
          ['underMaintenance', 'Assets Under Maintenance'],
        ].map(([key, title]) => (
          <div className="college-maintenance-stat" key={key}>
            <span>{title}</span>
            <strong>{Number(state.summary[key] || 0).toLocaleString()}</strong>
          </div>
        ))}
      </section>

      <section className="college-maintenance-toolbar" aria-label="Maintenance filters">
        <label className="college-maintenance-search">
          <Search size={17} />
          <span className="sr-only">Search maintenance</span>
          <input
            value={query.search}
            onChange={(event) => updateQuery('search', event.target.value)}
            placeholder="Search ID, asset, serial, department, technician..."
          />
        </label>

        <label>
          <span className="sr-only">Department</span>
          <select value={query.departmentId} onChange={(event) => updateQuery('departmentId', event.target.value)}>
            <option value="">All departments</option>
            {(state.filters.departments || []).map((department) => (
              <option value={department.id} key={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Status</span>
          <select value={query.status} onChange={(event) => updateQuery('status', event.target.value)}>
            <option value="">All statuses</option>
            {(state.filters.statuses || []).map((value) => <option value={value} key={value}>{label(value)}</option>)}
          </select>
        </label>

        <label>
          <span className="sr-only">Type</span>
          <select value={query.type} onChange={(event) => updateQuery('type', event.target.value)}>
            <option value="">All types</option>
            {(state.filters.types || []).map((value) => <option value={value} key={value}>{label(value)}</option>)}
          </select>
        </label>

        <label>
          <span className="sr-only">Date from</span>
          <input type="date" value={query.dateFrom} onChange={(event) => updateQuery('dateFrom', event.target.value)} />
        </label>

        <label>
          <span className="sr-only">Date to</span>
          <input type="date" value={query.dateTo} onChange={(event) => updateQuery('dateTo', event.target.value)} />
        </label>

        {hasFilters && (
          <button className="college-maintenance-clear" type="button" onClick={clearFilters}>
            <X size={15} /> Clear Filters
          </button>
        )}
      </section>

      <section className="college-maintenance-table-panel">
        <div className="college-maintenance-table-meta">
          <strong>
            {pagination.total
              ? `Showing ${first}-${last} of ${pagination.total} records`
              : hasFilters
                ? 'No maintenance records match your filters'
                : 'No maintenance records found'}
          </strong>
          {state.tableLoading && <RefreshCw size={15} className="college-maintenance-spin" />}
        </div>

        {state.records.length ? (
          <div className="college-maintenance-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Maintenance ID</th>
                  <th>Asset</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Reported</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Technician</th>
                  <th>Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>#{record.id}</strong></td>
                    <td>
                      <div className="college-maintenance-asset-cell">
                        <strong>{display(record.asset?.name || record.assetName, 'Unknown asset')}</strong>
                        <small>{display(record.asset?.assetCode || record.assetCode, 'No asset code')}</small>
                      </div>
                    </td>
                    <td>{display(record.department?.name || record.departmentName || record.asset?.department || record.department, 'Not assigned')}</td>
                    <td>{display(record.type || record.maintenanceType || record.category, 'Not recorded')}</td>
                    <td>{formatDate(record.reportedDate || record.requestedAt || record.createdAt)}</td>
                    <td>{formatDate(record.scheduledDate || record.preferredRepairDate)}</td>
                    <td><span className={`college-maintenance-badge ${statusBadgeClass(record.status)}`}>{label(record.status || 'unknown')}</span></td>
                    <td><span className={`college-maintenance-priority ${priorityBadgeClass(record.priority)}`}>{label(record.priority || 'normal')}</span></td>
                    <td>{display(record.technician?.fullName || record.technicianName || record.assignedToName || record.assignedTo, 'Not assigned')}</td>
                    <td>{formatMoney(record.actualCost || record.estimatedCost || record.cost)}</td>
                    <td>
                      <button className="college-maintenance-icon-button" type="button" onClick={() => openDetails(record)} aria-label={`View details for maintenance ${record.id}`} title="View details">
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="college-maintenance-empty">
            <FileText size={28} />
            <strong>{hasFilters ? 'No maintenance records match your current filters.' : 'No maintenance records found.'}</strong>
            {hasFilters && <button type="button" onClick={clearFilters}>Clear Filters</button>}
          </div>
        )}

        <nav className="college-maintenance-pagination" aria-label="Maintenance pages">
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
          <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </nav>
      </section>

      {selected && (
        <div className="college-maintenance-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="college-maintenance-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-details-title">
            <div className="college-maintenance-modal-head">
              <div>
                <span className="college-maintenance-eyebrow">Maintenance details</span>
                <h2 id="maintenance-details-title">#{display(selected.id)}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close maintenance details">
                <X />
              </button>
            </div>

            {detailsLoading ? (
              <div className="college-maintenance-modal-loading"><RefreshCw className="college-maintenance-spin" /> Loading details...</div>
            ) : selected.detailError ? (
              <p className="college-maintenance-error-text">{selected.detailError}</p>
            ) : (
              <div className="college-maintenance-details">
                {[
                  ['Maintenance ID', selected.id],
                  ['Asset Code', selected.asset?.assetCode || selected.assetCode],
                  ['Asset Name', selected.asset?.name || selected.assetName],
                  ['Category', selected.asset?.category || selected.category],
                  ['Department', selected.department?.name || selected.departmentName || selected.asset?.department],
                  ['College', selected.college?.name || selected.collegeName],
                  ['Location', selected.asset?.location || selected.location],
                  ['Serial Number', selected.asset?.serialNumber || selected.serialNumber],
                  ['Maintenance Type', selected.type || selected.maintenanceType || selected.category],
                  ['Description', selected.description || selected.problem],
                  ['Reported Date', formatDate(selected.reportedDate || selected.requestedAt || selected.createdAt)],
                  ['Scheduled Date', formatDate(selected.scheduledDate || selected.preferredRepairDate)],
                  ['Started Date', formatDate(selected.startedAt)],
                  ['Completed Date', formatDate(selected.completedAt)],
                  ['Status', label(selected.status)],
                  ['Priority', label(selected.priority || 'normal')],
                  ['Technician', selected.technician?.fullName || selected.technicianName || selected.assignedToName],
                  ['Maintenance Provider', selected.provider || selected.maintenanceProvider],
                  ['Estimated Cost', formatMoney(selected.estimatedCost)],
                  ['Actual Cost', formatMoney(selected.actualCost)],
                  ['Notes', selected.notes || selected.reason],
                  ['Created Date', formatDate(selected.createdAt)],
                  ['Updated Date', formatDate(selected.updatedAt)],
                ].map(([title, value]) => (
                  <div key={title} className="college-maintenance-detail-item">
                    <span>{title}</span>
                    <strong>{display(value, 'Not recorded')}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default CollegeMaintenance;
