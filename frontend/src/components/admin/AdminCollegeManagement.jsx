import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { Building2, Download, Edit2, Search, Plus, Power, PowerOff, X, Save, Eye, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const emptyForm = {
  collegeCode: '',
  collegeName: '',
  description: '',
  managerId: '',
  location: '',
  address: '',
  phone: '',
  email: '',
  establishedDate: '',
  status: 'active',
};

const normalizeArray = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.colleges)) return data.colleges;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const AdminCollegeManagement = ({ initialCreate = false }) => {
  const [colleges, setColleges] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, departments: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fetchColleges = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/admin/colleges', { params: { page, limit, search, status: statusFilter, sortBy: 'name', sortOrder: 'ASC' } });
      const data = normalizeArray(response);
      setColleges(data);
      const pagination = response?.data?.pagination || {};
      const summary = response?.data?.summary || {};
      setTotalPages(Math.max(1, pagination.totalPages || pagination.pages || 1));
      setStats({
        total: Number(summary.totalColleges ?? pagination.total ?? response?.data?.total ?? data.length),
        active: Number(summary.activeColleges ?? data.filter((college) => college.status === 'active').length),
        inactive: Number(summary.inactiveColleges ?? data.filter((college) => college.status === 'inactive').length),
        departments: Number(summary.totalDepartments ?? data.reduce((sum, college) => sum + Number(college.departmentCount || 0), 0)),
      });
    } catch (error) {
      setErrors({ load: error?.response?.status === 403 ? 'Access denied.' : error?.response?.status === 401 ? 'Authentication required.' : "We couldn't retrieve college information. Please try again." });
      setColleges([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/admin/colleges/manager-candidates');
      const data = normalizeArray(response);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setUsers([]);
      setErrors((current) => ({ ...current, managers: error?.response?.data?.message || 'Unable to load College Manager candidates.' }));
    }
  }, []);

  useEffect(() => {
    fetchColleges();
    fetchUsers();
  }, [fetchColleges, fetchUsers]);

  const filteredColleges = useMemo(() => colleges, [colleges]);

  const validate = () => {
    const nextErrors = {};
    if (!String(form.collegeCode || '').trim()) nextErrors.collegeCode = 'College code is required';
    if (!String(form.collegeName || '').trim()) nextErrors.collegeName = 'College name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(String(form.email))) nextErrors.email = 'Enter a valid email';
    return nextErrors;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowForm(true);
  };

  useEffect(() => {
    if (initialCreate) openCreate();
  }, [initialCreate]);

  const openEdit = (college) => {
    setEditingId(college.id);
    setForm({
      collegeCode: college.collegeCode || '',
      collegeName: college.collegeName || '',
      description: college.description || '',
      managerId: college.managerId || '',
      location: college.location || '',
      address: college.address || '',
      phone: college.phone || '',
      email: college.email || '',
      establishedDate: college.establishedDate || '',
      status: college.status || 'active',
    });
    setErrors({});
    setShowForm(true);
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    const college = colleges.find((item) => String(item.id) === String(editId));
    if (college) openEdit(college);
  }, [colleges, searchParams]);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        collegeCode: form.collegeCode.trim().toUpperCase(),
        collegeName: form.collegeName.trim(),
        description: form.description.trim(),
        managerId: form.managerId ? Number(form.managerId) : null,
        location: form.location.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        establishedDate: form.establishedDate || null,
        status: form.status,
      };

      if (editingId) {
        await apiClient.put(`/api/admin/colleges/${editingId}`, payload);
        toast.success('College updated successfully');
      } else {
        await apiClient.post('/api/admin/colleges', payload);
        toast.success('College created successfully');
      }

      setShowForm(false);
      setForm(emptyForm);
      await fetchColleges();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (college) => {
    try {
      const newStatus = college.status === 'active' ? 'inactive' : 'active';
      await apiClient.patch(`/api/admin/colleges/${college.id}/status`, { status: newStatus });
      toast.success('College status updated');
      await fetchColleges();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to update status');
    }
  };

  const downloadColleges = async () => {
    try {
      const response = await apiClient.get('/api/admin/colleges', { params: { page: 1, limit: 100, search, status: statusFilter, sortBy: 'name', sortOrder: 'ASC' } });
      const rows = normalizeArray(response);
      const headers = ['College', 'Code', 'Manager', 'Departments', 'Staff', 'Assets', 'Status', 'Created'];
      const csv = [headers, ...rows.map((college) => [
        college.collegeName || college.name,
        college.collegeCode || college.code,
        college.manager?.name || 'Unassigned',
        college.departmentCount ?? 0,
        college.staffCount ?? 0,
        college.assetCount ?? 0,
        college.status || '',
        college.createdAt || '',
      ])].map((row) => row.map((value) => JSON.stringify(value ?? '')).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'colleges.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('College list downloaded');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to download colleges');
    }
  };

  return (
    <section className="admin-workspace-page admin-colleges-page">
      <div className="admin-page-header colleges-page-header">
        <div>
          <div className="admin-breadcrumb">
            <Building2 size={16} /> Organization / Colleges
          </div>
          <h1 className="admin-page-title">Colleges</h1>
          <p className="admin-page-subtitle">Manage college records, contacts, and operational status.</p>
        </div>
        <button className="admin-primary-button inline-flex items-center gap-2 shadow-sm" onClick={openCreate}>
          <Plus size={16} /> Create College
        </button>
      </div>

      <div className="admin-kpi-grid colleges-kpi-grid">
        <div className="admin-card college-kpi-card college-kpi-total"><span>Total Colleges</span><strong>{stats.total}</strong><small>Organization records</small></div>
        <div className="admin-card college-kpi-card college-kpi-active"><span>Active Colleges</span><strong>{stats.active}</strong><small>Operational now</small></div>
        <div className="admin-card college-kpi-card college-kpi-inactive"><span>Inactive Colleges</span><strong>{stats.inactive}</strong><small>Require review</small></div>
        <div className="admin-card college-kpi-card college-kpi-departments"><span>Departments</span><strong>{stats.departments}</strong><small>Across all colleges</small></div>
      </div>

      <div className="admin-toolbar colleges-toolbar">
        <div className="admin-search-box">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search college code, name, location..." />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="admin-select">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="admin-secondary-button inline-flex items-center gap-2" onClick={fetchColleges} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        <button className="admin-secondary-button inline-flex items-center gap-2" onClick={downloadColleges} disabled={loading}><Download size={16} /> Download CSV</button>
      </div>

      {errors.load && <div className="admin-error-state" role="alert"><span>{errors.load}</span><button className="admin-secondary-button" onClick={fetchColleges}>Retry</button></div>}
      {errors.managers && <div className="admin-error-state" role="alert"><span>{errors.managers}</span><button className="admin-secondary-button" onClick={fetchUsers}>Retry manager candidates</button></div>}

      {showForm && (
        <div className="admin-card admin-form-card college-form-card">
          <div className="admin-card-title">
            <span>{editingId ? 'Edit College' : 'Create College'}</span>
            <button className="icon-button" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
          <form onSubmit={submit} className="admin-form-grid">
            <div className="admin-form-field">
              <label>College Code</label>
              <input value={form.collegeCode} onChange={(event) => setForm({ ...form, collegeCode: event.target.value })} />
              {errors.collegeCode && <span className="field-error">{errors.collegeCode}</span>}
            </div>
            <div className="admin-form-field">
              <label>College Name</label>
              <input value={form.collegeName} onChange={(event) => setForm({ ...form, collegeName: event.target.value })} />
              {errors.collegeName && <span className="field-error">{errors.collegeName}</span>}
            </div>
            <div className="admin-form-field">
              <label>Location</label>
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </div>
            <div className="admin-form-field">
              <label>Address</label>
              <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </div>
            <div className="admin-form-field">
              <label>Phone</label>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div className="admin-form-field">
              <label>Email</label>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <div className="admin-form-field">
              <label>Established Date</label>
              <input type="date" value={form.establishedDate} onChange={(event) => setForm({ ...form, establishedDate: event.target.value })} />
            </div>
            <div className="admin-form-field">
              <label>College Manager</label>
              <select value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name || user.fullName || user.username || user.email || `User ${user.id}`}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-field">
              <label>Status</label>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="admin-form-field admin-form-wide">
              <label>Description</label>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="admin-form-actions">
              <button type="button" className="admin-secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="admin-primary-button" disabled={saving}>{saving ? 'Saving...' : <><Save size={16} /> Save</>}</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-card college-table-card">
        {loading ? (
          <div className="admin-empty-state">Loading colleges...</div>
        ) : filteredColleges.length === 0 ? (
          <div className="admin-empty-state" style={{ flexDirection: 'column', gap: 8 }}><Building2 size={32} /><strong>No Colleges Found</strong><span>Create your first college to organize departments, staff, assets and locations.</span><button className="admin-primary-button" onClick={openCreate}><Plus size={16} /> Create College</button></div>
        ) : (
          <>
          <div className="admin-table-scroll"><table className="admin-table">
            <thead>
              <tr>
                <th>College</th>
                <th>Code</th>
                <th>Manager</th>
                <th>Departments</th>
                <th>Staff</th>
                <th>Assets</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredColleges.map((college) => (
                <tr key={college.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={18} color="#2563EB" /><div><strong>{college.collegeName || college.name}</strong><div style={{ color: '#64748b', fontSize: '0.78rem' }}>{college.description || 'No description'}</div></div></div></td>
                  <td><strong>{college.collegeCode}</strong></td>
                  <td>{college.manager?.name || 'Unassigned'}</td>
                  <td>{college.departmentCount ?? 0}</td>
                  <td>{college.staffCount ?? 0}</td>
                  <td>{college.assetCount ?? 0}</td>
                  <td><span className={`admin-status-badge ${college.status === 'active' ? 'active' : 'inactive'}`}>{college.status}</span></td>
                  <td>{college.createdAt ? new Date(college.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="icon-button" title="View college" onClick={() => navigate(`/admin/colleges/${college.id}`)}><Eye size={15} /></button>
                      <button className="icon-button" onClick={() => openEdit(college)}><Edit2 size={15} /></button>
                      <button className="icon-button" onClick={() => toggleStatus(college)}>{college.status === 'active' ? <PowerOff size={15} /> : <Power size={15} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="admin-pagination"><button className="icon-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button className="icon-button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button></div>
          </>
        )}
      </div>
    </section>
  );
};

export default AdminCollegeManagement;
