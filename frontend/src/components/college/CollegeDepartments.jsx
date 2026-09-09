import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../utils/api';
import { useLanguage } from '../../contexts/UiContext';

const CollegeDepartments = () => {
  const { language } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [form, setForm] = useState({ department_name: '', department_code: '', description: '', head_user_id: '', phone: '', email: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const text = language === 'am' ? { title: 'የኮሌጅ ክፍሎች', create: 'ክፍል ፍጠር', save: 'አስቀምጥ', edit: 'አርትዕ', active: 'ንቁ', inactive: 'የተዘጋ' } : { title: 'College Departments', create: 'Create Department', save: 'Save Department', edit: 'Edit', active: 'Active', inactive: 'Inactive' };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/api/college/departments', { params: { search: search || undefined, page, limit: 20 } });
      setDepartments(response.data?.data || []);
      setPagination(response.data?.pagination || { page, pages: 0, total: 0 });
    } catch (loadError) { setDepartments([]); setError(loadError.response?.data?.message || 'Unable to load departments.'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, head_user_id: form.head_user_id || null };
      if (editingId) await apiClient.put(`/api/college/departments/${editingId}`, payload);
      else await apiClient.post('/api/college/departments', payload);
      setForm({ department_name: '', department_code: '', description: '', head_user_id: '', phone: '', email: '' }); setEditingId(null); await load();
    } catch (saveError) { setError(saveError.response?.data?.message || 'Unable to save department.'); }
    finally { setSaving(false); }
  };

  const edit = (department) => setForm({ department_name: department.name || '', department_code: department.code || '', description: department.description || '', head_user_id: department.headId || '', phone: department.phone || '', email: department.email || '' }) || setEditingId(department.id);
  const toggle = async (department) => { if (!window.confirm(`Set ${department.name} ${department.status === 'inactive' ? 'active' : 'inactive'}?`)) return; await apiClient.patch(`/api/college/departments/${department.id}/status`, { status: department.status === 'inactive' ? 'active' : 'inactive' }); await load(); };

  return <section className="college-workspace-page">
    <header><div><div className="college-breadcrumb">College / Organization</div><h1>{text.title}</h1><p>Departments belonging to your authorized college.</p></div></header>
    <form className="college-form" onSubmit={submit}><input required minLength={2} placeholder="Department name" value={form.department_name} onChange={(event) => setForm({ ...form, department_name: event.target.value })} /><input required placeholder="Department code" value={form.department_code} onChange={(event) => setForm({ ...form, department_code: event.target.value })} /><input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /><input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button type="submit" disabled={saving}>{editingId ? text.save : text.create}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ department_name: '', department_code: '', description: '', head_user_id: '', phone: '', email: '' }); }}>Cancel</button>}</form>
    <div className="college-toolbar"><input placeholder="Search departments" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><span>{pagination.total || 0} departments</span></div>
    {error && <div role="alert" className="college-error">{error}</div>}
    {loading ? <div className="college-state">Loading departments...</div> : departments.length === 0 ? <div className="college-state">No departments found.</div> : <div className="college-table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Actions</th></tr></thead><tbody>{departments.map((department) => <tr key={department.id}><td><Link to={`/college/departments/${department.id}`}>{department.name}</Link></td><td>{department.code || '-'}</td><td>{department.status === 'inactive' ? text.inactive : text.active}</td><td><button type="button" onClick={() => edit(department)}>{text.edit}</button><button type="button" onClick={() => toggle(department)}>{department.status === 'inactive' ? text.active : text.inactive}</button></td></tr>)}</tbody></table></div>}
    {pagination.pages > 1 && <nav className="college-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {pagination.pages}</span><button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </section>;
};

export default CollegeDepartments;
