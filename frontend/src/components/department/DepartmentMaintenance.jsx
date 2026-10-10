import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, CircleX, Clock3, Eye, FileText, Flag, LifeBuoy, LoaderCircle, MapPin, Package, Plus, RefreshCw, Search, SlidersHorizontal, UserRound, Wrench, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import './DepartmentMaintenance.css';

const STATUS_OPTIONS = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'rejected', 'cancelled'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const displayStatus = (status) => String(status || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';
const displayPriority = (priority) => String(priority || '').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';
const formatDate = (value, includeTime = false) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};
const getAsset = (record) => record?.Asset || record?.asset || {};
const getAssetName = (record) => getAsset(record).name || '-';
const getAssetCode = (record) => getAsset(record).assetCode || '-';

const DepartmentMaintenance = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isServiceRequestRoute = /\/(?:service-requests|maintenance-requests)(?:\/|$)/.test(pathname);
  const role = String(user?.role || '').toLowerCase();
  const [records, setRecords] = useState([]);
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
  const [summary, setSummary] = useState({ total: 0, pending: 0, assigned: 0, 'in-progress': 0, completed: 0, overdue: 0 });
  const [form, setForm] = useState({ asset_id: '', problem: '', priority: 'medium' });
  const [selected, setSelected] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [serviceForm, setServiceForm] = useState({ title: '', category: 'Facilities', priority: 'medium', description: '', responsibleRole: '', assignedTo: '' });
  const [serviceEvidence, setServiceEvidence] = useState([]);
  const [serviceRoutingOptions, setServiceRoutingOptions] = useState({ categories: [], roles_by_category: {} });
  const [serviceRoutingLoading, setServiceRoutingLoading] = useState(false);
  const [serviceRoutingError, setServiceRoutingError] = useState('');
  const [serviceAssignees, setServiceAssignees] = useState([]);
  const [serviceAssigneesLoading, setServiceAssigneesLoading] = useState(false);
  const [serviceAssigneesError, setServiceAssigneesError] = useState('');
  const [serviceSummary, setServiceSummary] = useState({ total: 0, submitted: 0, scheduled: 0, 'in-progress': 0, completed: 0, escalated: 0, cancelled: 0 });
  const [serviceTechnicians, setServiceTechnicians] = useState([]);
  const [serviceFeedback, setServiceFeedback] = useState({ rating: 5, feedback: '' });
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const serviceSubmitLock = useRef(false);

  const canCreate = ['department_head'].includes(role);
  const canCancel = (record) => record?.requestedBy === user?.id && ['pending', 'approved'].includes(record?.status);
  const serviceRoles = ['admin', 'maintenance', 'ict_officer', 'infrastructure'];
  const canAssignServiceRequests = serviceRoles.includes(role);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [maintenanceResponse, assetsResponse] = await Promise.all([
        apiClient.get('/api/department/maintenance', { params: { limit: 100, search: filters.search.trim() || undefined, status: filters.status || undefined, priority: filters.priority || undefined } }),
        apiClient.get('/api/department/assets', { params: { limit: 500 } }),
      ]);
      setRecords(Array.isArray(maintenanceResponse.data?.data) ? maintenanceResponse.data.data : []);
      setSummary(maintenanceResponse.data?.summary || { total: 0, pending: 0, assigned: 0, 'in-progress': 0, completed: 0 });
      const assetData = assetsResponse.data?.data || assetsResponse.data?.assets || [];
      setAssets(Array.isArray(assetData) ? assetData : []);
    } catch (loadError) {
      setRecords([]);
      setSummary({ total: 0, pending: 0, assigned: 0, 'in-progress': 0, completed: 0 });
      setError(loadError.response?.data?.message || loadError.message || 'Unable to load maintenance requests.');
    } finally {
      setLoading(false);
    }
  }, [filters.priority, filters.search, filters.status]);

  const loadServiceRequests = useCallback(async () => {
    setServiceLoading(true);
    setServiceError('');
    try {
      const response = await apiClient.get('/api/service-requests', { params: { limit: 100, status: filters.status || undefined, priority: filters.priority || undefined, search: filters.search.trim() || undefined } });
      const rows = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data?.requests) ? response.data.requests : [];
      setRecords(rows);
      setServiceSummary(response.data?.summary || { total: rows.length, submitted: 0, scheduled: 0, 'in-progress': 0, completed: 0, escalated: 0, cancelled: 0 });
      if (canAssignServiceRequests) {
        try {
          const technicianResponse = await apiClient.get('/api/service-requests/technicians');
          setServiceTechnicians(Array.isArray(technicianResponse.data?.data) ? technicianResponse.data.data : []);
        } catch (technicianError) {
          setServiceTechnicians([]);
        }
      }
    } catch (loadError) {
      setRecords([]);
      setServiceSummary({ total: 0, submitted: 0, scheduled: 0, 'in-progress': 0, completed: 0, escalated: 0, cancelled: 0 });
      setServiceError(loadError.response?.data?.message || loadError.message || 'Unable to load service requests.');
    } finally {
      setServiceLoading(false);
    }
  }, [canAssignServiceRequests, filters.priority, filters.search, filters.status]);

  const loadServiceRoutingOptions = useCallback(async () => {
    setServiceRoutingLoading(true);
    setServiceRoutingError('');
    try {
      const response = await apiClient.get('/api/service-requests/routing-options');
      const data = response.data?.data || {};
      const categories = Array.isArray(data.categories) ? data.categories : [];
      const rolesByCategory = data.roles_by_category && typeof data.roles_by_category === 'object' ? data.roles_by_category : {};
      setServiceRoutingOptions({ categories, roles_by_category: rolesByCategory });
      setServiceForm((current) => {
        const options = rolesByCategory[current.category] || [];
        const selected = options.some((item) => item.name === current.responsibleRole) ? current.responsibleRole : options[0]?.name || '';
        return { ...current, responsibleRole: selected, assignedTo: '' };
      });
    } catch (loadError) {
      setServiceRoutingError(loadError.response?.data?.message || 'Unable to load active request roles. Retry to continue.');
    } finally {
      setServiceRoutingLoading(false);
    }
  }, []);

  const loadServiceAssignees = useCallback(async (category, responsibleRole) => {
    if (!category || !responsibleRole) {
      setServiceAssignees([]);
      setServiceAssigneesError('');
      return;
    }
    setServiceAssigneesLoading(true);
    setServiceAssigneesError('');
    try {
      const response = await apiClient.get('/api/service-requests/eligible-assignees', {
        params: { category, role: responsibleRole },
      });
      setServiceAssignees(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (loadError) {
      setServiceAssignees([]);
      setServiceAssigneesError(loadError.response?.data?.message || 'Unable to load eligible users.');
    } finally {
      setServiceAssigneesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isServiceRequestRoute) {
      loadServiceRequests();
      return;
    }
    loadRecords();
  }, [filters.search, filters.status, filters.priority, isServiceRequestRoute, loadRecords, loadServiceRequests]);

  useEffect(() => {
    if (!showForm || !serviceForm.responsibleRole) return;
    loadServiceAssignees(serviceForm.category, serviceForm.responsibleRole);
  }, [loadServiceAssignees, serviceForm.category, serviceForm.responsibleRole, showForm]);

  const visibleRecords = useMemo(() => records, [records]);

  const submitRequest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/api/department/maintenance', { ...form, asset_id: Number(form.asset_id) });
      toast.success('Maintenance request created.');
      setForm({ asset_id: '', problem: '', priority: 'medium' });
      setShowForm(false);
      await loadRecords();
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Unable to create the maintenance request.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitServiceRequest = async (event) => {
    event.preventDefault();
    if (serviceSubmitLock.current) return;
    if (!serviceForm.title.trim() || !serviceForm.description.trim() || !serviceForm.responsibleRole) {
      setServiceError('Title, details, and responsible role are required.');
      return;
    }
    const selectedRole = (serviceRoutingOptions.roles_by_category[serviceForm.category] || [])
      .find((item) => item.name === serviceForm.responsibleRole);
    if (!selectedRole) {
      setServiceError('Select an active responsible role for this request category.');
      return;
    }
    serviceSubmitLock.current = true;
    setServiceSubmitting(true);
    setServiceError('');
    try {
      const payload = {
        title: serviceForm.title,
        description: serviceForm.description,
        justification: serviceForm.description,
        priority: serviceForm.priority,
        category: serviceForm.category,
        requestType: 'maintenance',
        responsibleRoleId: Number(selectedRole.id),
        ...(serviceForm.assignedTo ? { assignedTo: Number(serviceForm.assignedTo) } : {}),
        attachments: serviceEvidence.map((item) => ({
          data: item.data,
          fileName: item.name,
          mimeType: item.type,
          attachmentType: 'photo',
        })),
      };
      const response = await apiClient.post('/api/service-requests', payload);
      if (response.data?.notificationStatus === 'failed') {
        toast.error(response.data.warning || 'Request saved, but its notification could not be delivered.');
      } else {
        toast.success(`Service request ${response.data?.data?.requestCode || ''} created and routed to ${selectedRole.displayName}.`.trim());
      }
      setServiceForm({ title: '', category: 'Facilities', priority: 'medium', description: '', responsibleRole: '', assignedTo: '' });
      setServiceEvidence([]);
      setShowForm(false);
      await loadServiceRequests();
    } catch (submitError) {
      setServiceError(submitError.response?.data?.message || submitError.message || 'Unable to create the service request.');
    } finally {
      serviceSubmitLock.current = false;
      setServiceSubmitting(false);
    }
  };

  const openServiceRequestForm = () => {
    setServiceForm({ title: '', category: serviceRoutingOptions.categories[0] || 'Facilities', priority: 'medium', description: '', responsibleRole: '', assignedTo: '' });
    setServiceEvidence([]);
    setShowForm(true);
    loadServiceRoutingOptions();
  };

  const updateServiceRequestCategory = (category) => {
    const roles = serviceRoutingOptions.roles_by_category[category] || [];
    setServiceForm((current) => ({
      ...current,
      category,
      responsibleRole: roles[0]?.name || '',
      assignedTo: '',
    }));
  };

  const openDetails = async (record) => {
    setSelected(record);
    setLoadingDetails(true);
    try {
      const response = isServiceRequestRoute ? await apiClient.get(`/api/service-requests/${record.id}`) : await apiClient.get(`/api/department/maintenance/${record.id}`);
      const details = response.data?.data || record;
      setSelected(details);
      if (isServiceRequestRoute && response.data?.feedback) {
        setServiceFeedback({ rating: response.data.feedback.rating || 5, feedback: response.data.feedback.feedback || response.data.feedback.comment || '' });
      }
      if (isServiceRequestRoute && details.responsible_role) {
        const assigneeResponse = await apiClient.get('/api/service-requests/eligible-assignees', {
          params: { category: details.category || details.requestType, role: details.responsible_role },
        });
        setServiceTechnicians(Array.isArray(assigneeResponse.data?.data) ? assigneeResponse.data.data : []);
      } else if (isServiceRequestRoute && canAssignServiceRequests) {
        const technicianResponse = await apiClient.get('/api/service-requests/technicians');
        setServiceTechnicians(Array.isArray(technicianResponse.data?.data) ? technicianResponse.data.data : []);
      }
    } catch (detailError) {
      toast.error(detailError.response?.data?.message || 'Unable to load details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const cancelRequest = async () => {
    if (!confirmCancel) return;
    setProcessingId(confirmCancel.id);
    try {
      await apiClient.post(`/api/department/maintenance/${confirmCancel.id}/cancel`);
      toast.success('Maintenance request cancelled.');
      setConfirmCancel(null);
      setSelected(null);
      await loadRecords();
    } catch (cancelError) {
      toast.error(cancelError.response?.data?.message || 'Unable to cancel the maintenance request.');
    } finally {
      setProcessingId(null);
    }
  };

  const updateServiceStatus = async (status) => {
    if (!selected) return;
    try {
      const statusMap = {
        ack: '/acknowledge',
        start: '/start',
        complete: '/complete',
        cancel: '/cancel',
        cancelled: '/cancel',
      };
      const endpoint = statusMap[status];
      if (endpoint) {
        await apiClient.post(`/api/service-requests/${selected.id}${endpoint}`, { status, comment: 'Updated from department head view.' });
      } else {
        await apiClient.patch(`/api/service-requests/${selected.id}/status`, { status });
      }
      toast.success(`Service request status updated to ${displayStatus(status)}`);
      setSelected(null);
      await loadServiceRequests();
    } catch (statusError) {
      toast.error(statusError.response?.data?.message || 'Unable to update the service request status.');
    }
  };

  const assignServiceTechnician = async (requestId, technicianId) => {
    if (!technicianId) return;
    try {
      await apiClient.post(`/api/service-requests/${requestId}/assign`, { assignedTo: Number(technicianId) });
      toast.success('Technician assigned.');
      await loadServiceRequests();
    } catch (assignError) {
      toast.error(assignError.response?.data?.message || 'Unable to assign the technician.');
    }
  };

  const submitServiceFeedback = async (requestId) => {
    try {
      await apiClient.post(`/api/service-requests/${requestId}/feedback`, {
        rating: Number(serviceFeedback.rating),
        feedback: serviceFeedback.feedback,
        comment: serviceFeedback.feedback,
      });
      toast.success('Feedback submitted.');
      setServiceFeedback({ rating: 5, feedback: '' });
      setSelected(null);
      await loadServiceRequests();
    } catch (feedbackError) {
      toast.error(feedbackError.response?.data?.message || 'Unable to submit the feedback.');
    }
  };

  if (isServiceRequestRoute) {
    return (
      <section className="department-maintenance-page">
        <header className="maintenance-page-header">
          <div>
            <p className="maintenance-eyebrow"><LifeBuoy size={15} aria-hidden="true" /> Service operations</p>
            <h1>Service Requests</h1>
            <p className="maintenance-subtitle">Track service requests, route work by category, and monitor technician progress.</p>
          </div>
          <div className="maintenance-header-actions">
            <button className="maintenance-button secondary" type="button" onClick={loadServiceRequests} disabled={serviceLoading}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
            {canCreate && <button className="maintenance-button primary" type="button" onClick={openServiceRequestForm}><Plus size={17} aria-hidden="true" /> New request</button>}
          </div>
        </header>

        <div className="maintenance-summary" aria-label="Service request summary">
          <SummaryCard icon={FileText} label="Total requests" value={serviceSummary.total || 0} />
          <SummaryCard icon={Clock3} label="Submitted" value={serviceSummary.submitted || 0} tone="warning" />
          <SummaryCard icon={UserRound} label="Scheduled" value={serviceSummary.scheduled || 0} tone="info" />
          <SummaryCard icon={LoaderCircle} label="In progress" value={serviceSummary['in-progress'] || 0} tone="info" />
          <SummaryCard icon={CheckCircle2} label="Completed" value={serviceSummary.completed || 0} tone="success" />
        </div>

        {showForm && canCreate && (
          <form className="maintenance-request-form" onSubmit={submitServiceRequest}>
            <div className="form-heading">
              <div>
                <h2>New service request</h2>
                <p>Submit a maintenance, facilities, or ICT request for your department.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close request form" title="Close"><X size={18} /></button>
            </div>
            <div className="form-grid">
              <label className="full-width">Title<input aria-label="Request title" required value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} placeholder="Brief description of the issue" /></label>
              <label>Category<select aria-label="Request category" required disabled={serviceRoutingLoading || serviceRoutingOptions.categories.length === 0} value={serviceForm.category} onChange={(event) => updateServiceRequestCategory(event.target.value)}>{serviceRoutingOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>Priority<select aria-label="Request priority" value={serviceForm.priority} onChange={(event) => setServiceForm({ ...serviceForm, priority: event.target.value })}>{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{displayPriority(priority)}</option>)}</select></label>
              <label className="full-width">Responsible role
                <select aria-label="Responsible role" required disabled={serviceRoutingLoading || Boolean(serviceRoutingError)} value={serviceForm.responsibleRole} onChange={(event) => setServiceForm({ ...serviceForm, responsibleRole: event.target.value, assignedTo: '' })}>
                  {(serviceRoutingOptions.roles_by_category[serviceForm.category] || []).map((option) => <option key={option.id} value={option.name}>{option.displayName} — {option.description}</option>)}
                </select>
                {serviceRoutingLoading && <small>Loading active roles...</small>}
                {serviceRoutingError && <small role="alert">{serviceRoutingError} <button type="button" className="maintenance-link-button" onClick={loadServiceRoutingOptions}>Retry</button></small>}
              </label>
              <label className="full-width">Responsible user (optional)
                <select aria-label="Responsible user" disabled={!serviceForm.responsibleRole || serviceAssigneesLoading || Boolean(serviceAssigneesError)} value={serviceForm.assignedTo} onChange={(event) => setServiceForm({ ...serviceForm, assignedTo: event.target.value })}>
                  <option value="">Assign to the selected role</option>
                  {serviceAssignees.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                </select>
                {serviceAssigneesLoading && <small>Loading eligible users...</small>}
                {serviceAssigneesError && <small role="alert">{serviceAssigneesError} <button type="button" className="maintenance-link-button" onClick={() => loadServiceAssignees(serviceForm.category, serviceForm.responsibleRole)}>Retry</button></small>}
                {!serviceAssigneesLoading && !serviceAssigneesError && serviceForm.responsibleRole && serviceAssignees.length === 0 && <small>No eligible users are available in your organization; this request will remain assigned to the role.</small>}
              </label>
              <label className="full-width">Details<textarea aria-label="Request details" required rows="4" value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Describe the issue, impact, and any relevant context" /></label>
              <label className="full-width">Evidence / photos<input type="file" accept="image/*" multiple onChange={(event) => {
                const attachments = Array.from(event.target.files || []).map((file) => new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] || '' });
                  reader.onerror = () => reject(new Error('Failed to read file'));
                  reader.readAsDataURL(file);
                }));
                Promise.all(attachments).then(setServiceEvidence).catch(() => toast.error('Unable to read uploaded file(s).'));
              }} />
              {serviceEvidence.length > 0 && <div className="asset-preview full-width"><span><Package size={15} aria-hidden="true" /> Attached evidence</span><small>{serviceEvidence.map((file) => file.name).join(', ')}</small></div>}</label>
            </div>
            <div className="form-actions">
              <button className="maintenance-button secondary" type="button" onClick={() => setShowForm(false)} disabled={serviceSubmitting}>Cancel</button>
              <button className="maintenance-button primary" type="submit" disabled={serviceSubmitting || serviceRoutingLoading || Boolean(serviceRoutingError) || !serviceForm.responsibleRole}>{serviceSubmitting ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} {serviceSubmitting ? 'Submitting...' : 'Submit request'}</button>
            </div>
          </form>
        )}

        {serviceError && <div className="maintenance-alert" role="alert"><CircleX size={18} aria-hidden="true" /><span>{serviceError}</span><button type="button" onClick={loadServiceRequests}>Retry</button></div>}

        <div className="maintenance-toolbar">
          <label className="maintenance-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search service requests</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search title, status, request code or description" /></label>
          <label><SlidersHorizontal size={16} aria-hidden="true" /><span className="sr-only">Status filter</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{['submitted', 'scheduled', 'in-progress', 'completed', 'escalated', 'cancelled'].map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
          <label><Flag size={16} aria-hidden="true" /><span className="sr-only">Priority filter</span><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{displayPriority(priority)}</option>)}</select></label>
          <button className="maintenance-button secondary clear-filters" type="button" onClick={() => setFilters({ search: '', status: '', priority: '' })} disabled={!filters.search && !filters.status && !filters.priority}><X size={15} aria-hidden="true" /> Clear filters</button>
        </div>

        <div className="maintenance-table-wrap">
          {serviceLoading ? <LoadingState /> : visibleRecords.length === 0 ? <EmptyState canCreate={false} onCreate={openServiceRequestForm} /> : <table className="maintenance-table"><thead><tr><th>Request</th><th>Category</th><th>Priority</th><th>Status</th><th>Responsible</th><th>Created</th><th>Actions</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td><strong>{record.requestCode || `SR-${String(record.id).padStart(3, '0')}`}</strong><span>{record.title || record.description || '-'}</span></td><td><strong>{record.category || record.routed_to_label || 'Unassigned'}</strong><span>{record.routed_to_label || 'Not routed'}</span></td><td><span className={`priority-badge priority-${(record.priority || 'medium').toLowerCase()}`}>{displayPriority(record.priority)}</span></td><td><span className={`status-badge status-${(record.status || 'submitted').toLowerCase()}`}><StatusIcon status={(record.status || 'submitted').toLowerCase()} /> {displayStatus(record.status)}</span></td><td><strong>{record.assignee_name || record.Assignee?.fullName || record.responsible_role_label || 'Not assigned'}</strong><span>{record.assigned_to ? `User #${record.assigned_to}` : `Role: ${record.responsible_role_label || 'Not assigned'}`}</span></td><td>{formatDate(record.created_at || record.createdAt)}</td><td><div className="row-actions"><button className="icon-button" type="button" onClick={() => openDetails(record)} title="View request details" aria-label={`View service request ${record.id}`}><Eye size={17} /></button></div></td></tr>)}</tbody></table>}
        </div>

        {selected && (
          <div className="dialog-backdrop" role="presentation">
            <div className="maintenance-dialog" role="dialog" aria-modal="true" aria-labelledby="service-request-details-title">
              <div className="dialog-header">
                <div>
                  <p className="maintenance-eyebrow"><FileText size={15} /> Service request</p>
                  <h2 id="service-request-details-title">{selected.requestCode || `SR-${String(selected.id).padStart(3, '0')}`}</h2>
                </div>
                <button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Close service request details" title="Close"><X size={18} /></button>
              </div>
              {loadingDetails ? <LoadingState /> : <>
                <div className="detail-status-row">
                  <span className={`status-badge status-${String(selected.status || 'submitted').toLowerCase()}`}><StatusIcon status={String(selected.status || 'submitted').toLowerCase()} /> {displayStatus(selected.status)}</span>
                  <span className={`priority-badge priority-${String(selected.priority || 'medium').toLowerCase()}`}>{displayPriority(selected.priority)} priority</span>
                </div>
                <div className="detail-grid">
                  <Detail label="Title" value={selected.title || '-'} icon={FileText} />
                  <Detail label="Category" value={selected.category || selected.routed_to_label || 'Uncategorized'} icon={Package} />
                  <Detail label="Priority" value={displayPriority(selected.priority)} icon={Flag} />
                  <Detail label="Responsible role" value={selected.responsible_role_label || selected.routed_to_label || 'Unassigned'} icon={UserRound} />
                  <Detail label="Assigned user" value={selected.assignee_name || selected.Assignee?.fullName || 'Role queue'} icon={UserRound} />
                  <Detail label="Created" value={formatDate(selected.created_at || selected.createdAt, true)} icon={CalendarDays} />
                  <Detail label="Updated" value={formatDate(selected.updated_at || selected.updatedAt, true)} icon={RefreshCw} />
                  <div className="detail-field full-width"><span>Description</span><p>{selected.description || '-'}</p></div>
                  {selected.RequestAttachments?.length > 0 && <div className="detail-field full-width"><span>Evidence</span>{selected.RequestAttachments.map((attachment) => <p key={attachment.id}>{attachment.originalName}</p>)}</div>}
                </div>
                <div className="dialog-actions">
                  {selected.can_process && serviceTechnicians.length > 0 && (
                    <select value={selected.assigned_to || ''} onChange={(event) => assignServiceTechnician(selected.id, event.target.value)} aria-label="Assign technician">
                      <option value="">Assign to responsible role</option>
                      {serviceTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name || technician.fullName || technician.username}</option>)}
                    </select>
                  )}
                  {selected.status === 'submitted' && selected.can_process && <button className="maintenance-button primary" type="button" onClick={() => updateServiceStatus('scheduled')}>Acknowledge</button>}
                  {selected.status === 'scheduled' && selected.can_process && <button className="maintenance-button primary" type="button" onClick={() => updateServiceStatus('in-progress')}>Start</button>}
                  {selected.status === 'in-progress' && selected.can_process && <button className="maintenance-button primary" type="button" onClick={() => updateServiceStatus('completed')}>Complete</button>}
                  {selected.can_process && selected.status !== 'cancelled' && <button className="maintenance-button secondary" type="button" onClick={() => updateServiceStatus('cancelled')}>Cancel</button>}
                  {!selected.can_process && selected.can_cancel && <button className="maintenance-button secondary" type="button" onClick={() => updateServiceStatus('cancelled')}>Cancel request</button>}
                </div>
                {selected.status === 'completed' && (
                  <div className="maintenance-request-form" style={{ marginTop: 16 }}>
                    <div className="form-heading"><div><h2>Feedback</h2><p>Share the outcome of this completed request.</p></div></div>
                    <div className="form-grid">
                      <label>Rating<select value={serviceFeedback.rating} onChange={(event) => setServiceFeedback({ ...serviceFeedback, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
                      <label className="full-width">Comment<textarea rows="3" value={serviceFeedback.feedback} onChange={(event) => setServiceFeedback({ ...serviceFeedback, feedback: event.target.value })} placeholder="Add your feedback for the service request" /></label>
                    </div>
                    <div className="form-actions"><button className="maintenance-button primary" type="button" onClick={() => submitServiceFeedback(selected.id)}>Submit feedback</button></div>
                  </div>
                )}
              </>}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="department-maintenance-page">
      <header className="maintenance-page-header">
        <div>
          <p className="maintenance-eyebrow"><Wrench size={15} aria-hidden="true" /> Department operations</p>
            <h1>Maintenance Requests</h1>
          <p className="maintenance-subtitle">Track maintenance requests for assets in your authorized department scope.</p>
        </div>
        <div className="maintenance-header-actions">
          <button className="maintenance-button secondary" type="button" onClick={loadRecords} disabled={loading} title="Refresh maintenance records"><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
          {canCreate && <button className="maintenance-button primary" type="button" onClick={() => setShowForm((visible) => !visible)}><Plus size={17} aria-hidden="true" /> Request maintenance</button>}
        </div>
      </header>

      <div className="maintenance-summary" aria-label="Maintenance summary">
        <SummaryCard icon={FileText} label="Total requests" value={summary.total || 0} />
        <SummaryCard icon={Clock3} label="Pending" value={summary.pending || 0} tone="warning" />
        <SummaryCard icon={UserRound} label="Assigned" value={summary.assigned || 0} tone="info" />
        <SummaryCard icon={LoaderCircle} label="In progress" value={summary['in-progress'] || 0} tone="info" />
        <SummaryCard icon={CheckCircle2} label="Completed" value={summary.completed || 0} tone="success" />
        {summary.overdue > 0 && <SummaryCard icon={Clock3} label="Overdue" value={summary.overdue || 0} tone="danger" />}
      </div>

      {showForm && canCreate && <form className="maintenance-request-form" onSubmit={submitRequest}>
        <div className="form-heading"><div><h2>New maintenance request</h2><p>Submit a request for an asset in your department.</p></div><button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close request form" title="Close"><X size={18} /></button></div>
        <div className="form-grid">
          <label>Asset<select required value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })}><option value="">Select an asset</option>{assets.filter((asset) => !['disposed', 'missing'].includes(String(asset.status || '').toLowerCase())).map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetCode || asset.id})</option>)}</select></label>
          <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{displayPriority(priority)}</option>)}</select></label>
          {form.asset_id && <AssetPreview asset={assets.find((asset) => String(asset.id) === String(form.asset_id))} />}
          <label className="full-width">Problem description<textarea required rows="4" value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} placeholder="Describe the maintenance problem" /></label>
        </div>
        <div className="form-actions"><button className="maintenance-button secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="maintenance-button primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} {submitting ? 'Submitting...' : 'Submit request'}</button></div>
      </form>}

      {error && <div className="maintenance-alert" role="alert"><CircleX size={18} aria-hidden="true" /><span>{error}</span><button type="button" onClick={loadRecords}>Retry</button></div>}

      <div className="maintenance-toolbar">
        <label className="maintenance-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search maintenance records</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search asset, code, request or description" /></label>
        <label><SlidersHorizontal size={16} aria-hidden="true" /><span className="sr-only">Status filter</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
        <label><Flag size={16} aria-hidden="true" /><span className="sr-only">Priority filter</span><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{displayPriority(priority)}</option>)}</select></label>
        <button className="maintenance-button secondary clear-filters" type="button" onClick={() => setFilters({ search: '', status: '', priority: '' })} disabled={!filters.search && !filters.status && !filters.priority}><X size={15} aria-hidden="true" /> Clear filters</button>
      </div>

      <div className="maintenance-table-wrap">
        {loading ? <LoadingState /> : visibleRecords.length === 0 ? <EmptyState canCreate={canCreate} onCreate={() => setShowForm(true)} /> : <table className="maintenance-table"><thead><tr><th>Request</th><th>Asset</th><th>Priority</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td><strong>REQ-{String(record.id).padStart(3, '0')}</strong><span>{record.title || record.description || '-'}</span></td><td><strong>{getAssetName(record)}</strong><span>{getAssetCode(record)}</span></td><td><span className={`priority-badge priority-${record.priority}`}>{displayPriority(record.priority)}</span></td><td><span className={`status-badge status-${record.status}`}><StatusIcon status={record.status} /> {displayStatus(record.status)}</span></td><td>{formatDate(record.createdAt || record.created_at)}</td><td><div className="row-actions"><button className="icon-button" type="button" onClick={() => openDetails(record)} title="View maintenance details" aria-label={`View request ${record.id}`}><Eye size={17} /></button>{canCancel(record) && <button className="icon-button danger" type="button" onClick={() => setConfirmCancel(record)} disabled={processingId === record.id} title="Cancel maintenance request" aria-label={`Cancel request ${record.id}`}><CircleX size={17} /></button>}</div></td></tr>)}</tbody></table>}
      </div>

      {selected && <DetailsDialog record={selected} loading={loadingDetails} canCancel={canCancel(selected)} onCancel={() => setConfirmCancel(selected)} onClose={() => setSelected(null)} />}
      {confirmCancel && <ConfirmDialog record={confirmCancel} processing={processingId === confirmCancel.id} onConfirm={cancelRequest} onClose={() => setConfirmCancel(null)} />}
    </section>
  );
};

const SummaryCard = ({ icon: Icon, label, value, tone = 'default' }) => (
  <div className={`summary-card tone-${tone}`}>
    <span className="summary-icon"><Icon size={19} aria-hidden="true" /></span>
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  </div>
);
const StatusIcon = ({ status }) => {
  const Icon = status === 'completed' ? CheckCircle2 : ['in-progress', 'testing', 'waiting-for-parts'].includes(status) ? LoaderCircle : status === 'rejected' || status === 'cancelled' ? CircleX : Clock3;
  return <Icon size={14} aria-hidden="true" />;
};
const LoadingState = () => <div className="maintenance-loading"><LoaderCircle className="spin" size={25} /><span>Loading maintenance records...</span></div>;
const EmptyState = ({ canCreate, onCreate }) => <div className="maintenance-empty"><h2>No maintenance records found</h2><p>Requests created for this department will appear here after they are saved.</p>{canCreate && <button className="maintenance-button primary" type="button" onClick={onCreate}><Plus size={16} /> Request maintenance</button>}</div>;

const AssetPreview = ({ asset }) => <div className="asset-preview full-width"><span><Package size={15} aria-hidden="true" /> Selected asset</span><strong>{asset?.name || '-'}</strong><small>{[asset?.assetCode, asset?.category, asset?.condition, asset?.status, asset?.location].filter(Boolean).join(' | ') || 'Asset information unavailable'}</small></div>;
const DetailsDialog = ({ record, loading, canCancel, onCancel, onClose }) => { 
  const asset = getAsset(record); 
  const requester = record.Requester?.fullName || record.Requester?.username || record.requestedBy || record.requested_by; 
  const technician = record.Technician?.fullName || record.Technician?.username || record.assignedTo || record.assigned_to;
  const workOrder = record.workOrder || (Array.isArray(record.workOrders) ? record.workOrders[0] : null);
  const costBreakdown = record.costBreakdown || {};
  const costDetails = record.costDetails || [];
  const history = record.history || record.MaintenanceHistories || [];
  
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="maintenance-dialog" role="dialog" aria-modal="true" aria-labelledby="maintenance-details-title">
        <div className="dialog-header">
          <div>
            <p className="maintenance-eyebrow"><FileText size={15} /> Maintenance request</p>
            <h2 id="maintenance-details-title">REQ-{String(record.id).padStart(3, '0')}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close maintenance details" title="Close"><X size={18} /></button>
        </div>
        {loading ? <LoadingState /> : (
          <>
            <div className="detail-status-row">
              <span className={`status-badge status-${record.status}`}><StatusIcon status={record.status} /> {displayStatus(record.status)}</span>
              <span className={`priority-badge priority-${record.priority}`}>{displayPriority(record.priority)} priority</span>
              {record.isOverdue && <span className={`status-badge status-overdue`}><Clock3 size={14} /> Overdue</span>}
            </div>
            <div className="detail-grid">
              <Detail label="Asset" value={asset.name} icon={Package} />
              <Detail label="Asset code" value={asset.assetCode} icon={Package} />
              <Detail label="Serial number" value={asset.serialNumber} icon={Package} />
              <Detail label="Category" value={asset.category} icon={Package} />
              <Detail label="Condition" value={asset.condition} icon={FileText} />
              <Detail label="Asset status" value={asset.status} icon={CheckCircle2} />
              <Detail label="Department" value={asset.department || asset.departmentId} icon={Building2} />
              <Detail label="Location" value={asset.location} icon={MapPin} />
              <Detail label="Request date" value={formatDate(record.createdAt || record.created_at, true)} icon={CalendarDays} />
              <Detail label="Last updated" value={formatDate(record.updatedAt || record.updated_at, true)} icon={RefreshCw} />
              <Detail label="Requested by" value={requester} icon={UserRound} />
              <Detail label="Technician" value={technician || 'Not assigned'} icon={UserRound} />
              <div className="detail-field full-width">
                <span>Problem description</span>
                <p>{record.description || record.title || '-'}</p>
              </div>
            </div>

            {workOrder && (
              <div className="detail-section">
                <h3><Wrench size={16} /> Work Order</h3>
                <div className="detail-grid">
                  <Detail label="Work order #" value={workOrder.workOrderNumber} icon={FileText} />
                  <Detail label="Status" value={displayStatus(workOrder.status)} icon={CheckCircle2} />
                  <Detail label="Priority" value={displayPriority(workOrder.priority)} icon={Flag} />
                  <Detail label="Assigned technician" value={workOrder.Technician?.fullName || workOrder.Technician?.username || 'Not assigned'} icon={UserRound} />
                  <Detail label="Start date" value={formatDate(workOrder.startDate, true)} icon={CalendarDays} />
                  <Detail label="Expected completion" value={formatDate(workOrder.expectedCompletionDate, true)} icon={CalendarDays} />
                  <Detail label="Actual completion" value={formatDate(workOrder.actualCompletionDate, true)} icon={CheckCircle2} />
                  <Detail label="Estimated cost" value={`$${Number(workOrder.estimatedCost || 0).toFixed(2)}`} icon={FileText} />
                  <Detail label="Actual cost" value={`$${Number(workOrder.actualCost || 0).toFixed(2)}`} icon={CheckCircle2} />
                  {workOrder.diagnosis && <div className="detail-field full-width"><span>Diagnosis</span><p>{workOrder.diagnosis}</p></div>}
                  {workOrder.requiredWork && <div className="detail-field full-width"><span>Required work</span><p>{workOrder.requiredWork}</p></div>}
                </div>
              </div>
            )}

            {costBreakdown && costBreakdown.totalCost > 0 && (
              <div className="detail-section">
                <h3><FileText size={16} /> Cost Breakdown</h3>
                <div className="cost-summary">
                  <div className="cost-item"><span>Total cost</span><strong>${Number(costBreakdown.totalCost || 0).toFixed(2)}</strong></div>
                  {costBreakdown.labor > 0 && <div className="cost-item"><span>Labor</span><span>${Number(costBreakdown.labor || 0).toFixed(2)}</span></div>}
                  {costBreakdown.parts > 0 && <div className="cost-item"><span>Parts</span><span>${Number(costBreakdown.parts || 0).toFixed(2)}</span></div>}
                  {costBreakdown.materials > 0 && <div className="cost-item"><span>Materials</span><span>${Number(costBreakdown.materials || 0).toFixed(2)}</span></div>}
                  {costBreakdown.service > 0 && <div className="cost-item"><span>Service</span><span>${Number(costBreakdown.service || 0).toFixed(2)}</span></div>}
                  {costBreakdown.repair > 0 && <div className="cost-item"><span>Repair</span><span>${Number(costBreakdown.repair || 0).toFixed(2)}</span></div>}
                  {costBreakdown.other > 0 && <div className="cost-item"><span>Other</span><span>${Number(costBreakdown.other || 0).toFixed(2)}</span></div>}
                </div>
                {costDetails.length > 0 && (
                  <table className="cost-details-table">
                    <thead><tr><th>Category</th><th>Description</th><th>Quantity</th><th>Unit Cost</th><th>Amount</th><th>Date</th></tr></thead>
                    <tbody>
                      {costDetails.map((cost) => (
                        <tr key={cost.id}>
                          <td><strong>{cost.costCategory}</strong></td>
                          <td><small>{cost.description || '-'}</small></td>
                          <td><small>{cost.quantity}</small></td>
                          <td><small>${Number(cost.unitCost || 0).toFixed(2)}</small></td>
                          <td><strong>${Number(cost.amount || 0).toFixed(2)}</strong></td>
                          <td><small>{formatDate(cost.costDate)}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {history && history.length > 0 && (
              <div className="detail-section">
                <h3><RefreshCw size={16} /> Maintenance History</h3>
                <div className="history-timeline">
                  {history.map((entry) => (
                    <div key={entry.id} className="history-entry">
                      <span className="history-date">{formatDate(entry.actionDate || entry.createdAt, true)}</span>
                      <span className="history-action"><strong>{entry.actionType || entry.action || 'Update'}</strong></span>
                      <span className="history-description">{entry.actionDescription || entry.description || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canCancel && (
              <div className="dialog-actions">
                <button className="maintenance-button danger-button" type="button" onClick={onCancel}>
                  <CircleX size={16} /> Cancel request
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
const Detail = ({ label, value, icon: Icon }) => <div className="detail-field"><span><Icon size={14} aria-hidden="true" /> {label}</span><strong>{value || '-'}</strong></div>;
const ConfirmDialog = ({ record, processing, onConfirm, onClose }) => <div className="dialog-backdrop" role="presentation"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-maintenance-title"><CircleX className="confirm-icon" size={28} aria-hidden="true" /><h2 id="cancel-maintenance-title">Cancel maintenance request?</h2><p>This will cancel request REQ-{String(record.id).padStart(3, '0')} for {getAssetName(record)}. The current status is {displayStatus(record.status)}.</p><div className="dialog-actions"><button className="maintenance-button secondary" type="button" onClick={onClose} disabled={processing}>Keep request</button><button className="maintenance-button danger-button" type="button" onClick={onConfirm} disabled={processing}>{processing ? <LoaderCircle className="spin" size={16} /> : <CircleX size={16} />} Confirm cancellation</button></div></div></div>;

export default DepartmentMaintenance;
