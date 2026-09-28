import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { getMaintenancePage, createMaintenance, updateMaintenance, setMaintenanceStatus, removeMaintenance, getAssets, getTechnicians, assignMaintenance } from '../../services/maintenanceApi';

const priorityOptions = ['Low', 'Medium', 'High', 'Critical'];
const statusOptions = ['Pending', 'Approved', 'Rejected', 'Assigned', 'In Progress', 'Waiting for Parts', 'Testing', 'Completed', 'Cancelled'];

const normalizePriority = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Medium';
  const lowered = normalized.toLowerCase();
  if (lowered === 'critical') return 'Critical';
  if (lowered === 'high') return 'High';
  if (lowered === 'low') return 'Low';
  return 'Medium';
};

const normalizeStatus = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Pending';
  const lowered = normalized.toLowerCase();
  if (lowered === 'in-progress' || lowered === 'in progress') return 'In Progress';
  if (lowered === 'waiting-for-parts' || lowered === 'waiting for parts') return 'Waiting for Parts';
  if (lowered === 'rejected') return 'Rejected';
  if (lowered === 'approved') return 'Approved';
  if (lowered === 'completed') return 'Completed';
  if (lowered === 'testing') return 'Testing';
  if (lowered === 'assigned') return 'Assigned';
  if (lowered === 'cancelled') return 'Cancelled';
  if (lowered === 'pending') return 'Pending';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const MaintRequests = () => {
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ asset: '', problem: '', priority: 'Medium' });
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [saving, setSaving] = useState(false);
  const itemsPerPage = 5;

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMaintenancePage({
        page: currentPage,
        limit: itemsPerPage,
        search: search.trim() || undefined,
        priority: priorityFilter === 'all' ? undefined : priorityFilter.toLowerCase(),
        status: statusFilter === 'all' ? undefined : statusFilter,
        department: departmentFilter === 'all' ? undefined : departmentFilter,
      });
      setRequests(result.items);
      setPagination(result.pagination);
      setError('');
    } catch (err) {
      setError(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Unable to load maintenance requests. Please check the server connection.'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, departmentFilter, priorityFilter, search, statusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getAssets({ limit: 1000 }),
      getTechnicians(),
      apiClient.get('/api/departments', { params: { limit: 1000 } })
    ])
      .then(([assetList, technicianList, departmentResponse]) => {
        if (!isMounted) return;
        const departmentRows = Array.isArray(departmentResponse?.data?.data)
          ? departmentResponse.data.data
          : Array.isArray(departmentResponse?.data?.departments)
            ? departmentResponse.data.departments
            : [];
        setAssets(assetList || []);
        setTechnicians(technicianList || []);
        setDepartments(departmentRows.map((department) => department.name || department.departmentName || department.code || '').filter(Boolean));
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : 'Unable to load maintenance requests. Please check the server connection.');
      });

    return () => { isMounted = false; };
  }, []);

  const totalPages = pagination.pages || 1;
  const paginatedRequests = requests;

  const openForm = (request = null) => {
    setEditingId(request ? request.id : null);
    setFormData({
      asset: request ? String(request.assetId || request.asset_id || '') : '',
      problem: request ? (request.problem || request.description || request.title || '') : '',
      priority: request ? normalizePriority(request.priority) : 'Medium',
    });
    setShowForm(true);
    setMessage('');
  };

  const handleSubmit = async () => {
    if (!formData.asset || !formData.problem.trim()) {
      setMessage('Select an asset and enter a problem description.');
      return;
    }
    const asset = assets.find((item) => String(item.id) === String(formData.asset));
    if (!asset) {
      setMessage('Please select a valid asset.');
      return;
    }
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        asset_id: Number(asset.id),
        title: formData.problem.trim(),
        problem: formData.problem.trim(),
        description: formData.problem.trim(),
        priority: String(formData.priority || 'medium').toLowerCase(),
      };

      if (editingId) {
        await updateMaintenance(editingId, { description: payload.description, priority: payload.priority });
      } else {
        await createMaintenance(payload);
      }

      setEditingId(null);
      setFormData({ asset: '', problem: '', priority: 'Medium' });
      setShowForm(false);
      setCurrentPage(1);
      setMessage(editingId ? 'Maintenance request updated.' : 'Maintenance request created successfully.');
      await loadAll();
    } catch (err) {
      setMessage(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Request failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this maintenance request? This action cannot be undone.')) return;
    try {
      await removeMaintenance(id);
      await loadAll();
      setMessage('Maintenance request deleted.');
    } catch (err) {
      setMessage(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Delete failed'));
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await setMaintenanceStatus(id, newStatus.toLowerCase());
      await loadAll();
      setMessage(`Status updated to ${newStatus}.`);
    } catch (err) {
      setMessage(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Status update failed'));
    }
  };

  const handleAssignment = async (id, technicianId) => {
    if (!technicianId) return;
    try {
      await assignMaintenance(id, technicianId);
      await loadAll();
      setMessage('Technician assigned successfully.');
    } catch (err) {
      setMessage(err && err.response && err.response.data && err.response.data.message ? err.response.data.message : (err.message || 'Technician assignment failed'));
    }
  };

  const getPriorityColor = (priority) => {
    const colors = { Critical: '#fee2e2', High: '#fef3c7', Medium: '#dbeafe', Low: '#dcfce7' };
    return colors[normalizePriority(priority)] || '#e5e7eb';
  };

  const getPriorityTextColor = (priority) => {
    const colors = { Critical: '#991b1b', High: '#92400e', Medium: '#075985', Low: '#166534' };
    return colors[normalizePriority(priority)] || '#4b5563';
  };

  const getStatusColor = (status) => {
    const colors = { Pending: '#fef3c7', Approved: '#dcfce7', Rejected: '#fee2e2', Assigned: '#dbeafe', 'In Progress': '#f3e8ff', 'Waiting for Parts': '#fed7aa', Testing: '#cffafe', Completed: '#dcfce7', Cancelled: '#fee2e2' };
    return colors[normalizeStatus(status)] || '#e5e7eb';
  };

  if (loading && requests.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>
        <div aria-live="polite">Loading maintenance requests…</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔧 Maintenance Requests</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ asset: '', problem: '', priority: 'Medium' });
            setShowForm((current) => !current);
          }}
          style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
        >
          + New Request
        </button>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>Error: {error}</div>}
      {message && <div style={{ padding: '12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>{message}</div>}

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>{editingId ? 'Edit Request' : 'Create New Request'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <select value={formData.asset} onChange={(e) => setFormData({ ...formData, asset: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option value="">Select Asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={String(asset.id)}>
                  {asset.name || 'Unnamed asset'} ({asset.assetCode || asset.asset_code || asset.serialNumber || asset.serial_number || `#${asset.id}`})
                </option>
              ))}
            </select>
            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              {priorityOptions.map((label) => (
                <option key={label} value={label}>{label} Priority</option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Problem Description"
            value={formData.problem}
            onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
            rows="4"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, marginBottom: '16px' }}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
              {saving ? 'Submitting...' : 'Submit'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
          <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Status</option>
            {statusOptions.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          <select value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Departments</option>
            {[...new Set([...departments, ...assets.map((asset) => asset.department).filter(Boolean)])].sort().map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDark ? '#334155' : '#f0f5ff', borderBottom: `1px solid ${cardBorder}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Asset</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Problem</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Priority</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Technician</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRequests.map((request) => {
              const priority = normalizePriority(request.priority);
              const status = normalizeStatus(request.status);
              return (
                <tr key={request.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '600' }}>{request.refId || `REQ-${String(request.id).padStart(3, '0')}`}</td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: '600' }}>{request.asset || request.asset_name || '—'}</div>
                    {request.assetTag || request.asset_tag || request.assetCode ? (
                      <div style={{ color: isDark ? '#cbd5e1' : '#64748b', fontSize: '0.8rem' }}>{request.assetTag || request.asset_tag || request.assetCode}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>{request.problem || request.description || request.title || '—'}</td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getPriorityColor(priority), color: getPriorityTextColor(priority), fontSize: '0.85rem', fontWeight: '600' }}>{priority}</span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                    <select value={status} onChange={(e) => handleStatusChange(request.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getStatusColor(status), border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                      {statusOptions.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                    <select
                      aria-label={`Assign technician for ${request.refId || `request ${request.id}`}`}
                      value={request.assigned_to || ''}
                      onChange={(event) => handleAssignment(request.id, event.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: `1px solid ${cardBorder}`, maxWidth: '180px' }}
                    >
                      <option value="">{request.technician || request.assigned_to_name || 'Unassigned'}</option>
                      {technicians.map((technician) => (
                        <option key={technician.id} value={technician.id}>{technician.fullName || technician.full_name || technician.username}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button onClick={() => openForm(request)} style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                      <button onClick={() => handleDelete(request.id)} style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedRequests.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>No maintenance requests match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: '8px 12px', backgroundColor: currentPage === 1 ? '#cbd5e1' : '#2864E8', color: 'white', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'default' : 'pointer' }}>← Previous</button>
          <span aria-live="polite">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 12px', backgroundColor: currentPage === totalPages ? '#cbd5e1' : '#2864E8', color: 'white', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages ? 'default' : 'pointer' }}>Next →</button>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        {pagination.total === 0 ? 'No maintenance requests found.' : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, pagination.total)} of ${pagination.total} requests`}
      </div>
    </div>
  );
};

export default MaintRequests;