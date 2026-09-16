import React, { useEffect, useState } from 'react';
import { Eye, Mail, Phone, RefreshCw, Search, Users, X } from 'lucide-react';
import api from '../../services/apiClient';
import './CollegeStaff.css';

const pageSize = 10;
const value = (item) => item || 'Not available';
const date = (item) => item ? new Date(item).toLocaleDateString() : 'Not available';

const CollegeStaff = () => {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, withDepartments: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', departmentId: '', role: '', status: '' });
  const [query, setQuery] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { const timer = setTimeout(() => setQuery(filters), 350); return () => clearTimeout(timer); }, [filters]);
  useEffect(() => { api.get('/api/college/departments', { params: { limit: 100 } }).then((response) => setDepartments(response.data?.data || [])).catch((requestError) => console.error('College departments lookup failed', requestError)); }, []);
  useEffect(() => { loadStaff(); }, [query]);

  const loadStaff = async (page = 1) => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/api/college/staff', { params: { ...query, page, limit: pageSize } });
      setRows(response.data?.data || []); setSummary(response.data?.summary || { total: 0, active: 0, inactive: 0, withDepartments: 0 }); setPagination({ ...(response.data?.pagination || {}), page });
    } catch (requestError) {
      console.error('College staff API failed', requestError); setRows([]); setError(requestError.response?.data?.message || requestError.message || 'Unable to load college staff.');
    } finally { setLoading(false); }
  };

  const roles = [...new Set(rows.map((staff) => staff.role).filter(Boolean))];
  return <div className="college-staff-page">
    <div className="college-staff-heading"><div><span className="college-staff-eyebrow">College management</span><h1>College Staff</h1><p>View staff members belonging to your assigned college.</p></div><button type="button" className="college-staff-refresh" onClick={() => loadStaff(pagination.page)}><RefreshCw size={16} /> Refresh</button></div>
    <div className="college-staff-summary">{[['Total Staff', summary.total, Users], ['Active Staff', summary.active, Users], ['Inactive Staff', summary.inactive, Users], ['With Departments', summary.withDepartments, Users]].map(([label, count, Icon]) => <article key={label}><span><Icon size={18} /></span><strong>{Number(count || 0).toLocaleString()}</strong><small>{label}</small></article>)}</div>
    <section className="college-staff-card"><div className="college-staff-toolbar"><label className="college-staff-search"><Search size={17} /><span className="sr-only">Search staff</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search name, username, email or phone" /></label><select aria-label="Filter by department" value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select aria-label="Filter by role" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">All roles</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      {loading ? <div className="college-staff-state" role="status">Loading college staff...</div> : error ? <div className="college-staff-state college-staff-error"><strong>Unable to load college staff.</strong><span>{error}</span><button type="button" onClick={() => loadStaff(pagination.page)}>Retry</button></div> : !rows.length ? <div className="college-staff-state"><Users size={26} /><strong>No staff members found for this college.</strong><span>Try adjusting your search or filters.</span></div> : <div className="college-staff-table-wrap"><table><thead><tr><th>Staff ID</th><th>Name</th><th>Department</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((staff) => <tr key={staff.id}><td>#{staff.id}</td><td><strong>{value(staff.fullName || staff.username)}</strong><small>{value(staff.username)}</small></td><td>{value(staff.departmentRecord?.name || staff.department)}</td><td>{value(staff.role)}</td><td>{value(staff.phone)}</td><td>{value(staff.email)}</td><td><span className={`college-staff-status college-staff-status--${staff.active ? 'active' : 'inactive'}`}>{staff.active ? 'Active' : 'Inactive'}</span></td><td><button className="college-staff-view" type="button" onClick={() => setSelected(staff)}><Eye size={15} /> View</button></td></tr>)}</tbody></table></div>}
      {!loading && !error && pagination.total > 0 && <div className="college-staff-pagination"><span>Showing page {pagination.page || 1} of {Math.max(pagination.pages || pagination.totalPages || 1, 1)} ({pagination.total} records)</span><div><button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => loadStaff((pagination.page || 1) - 1)}>Previous</button><button type="button" disabled={(pagination.page || 1) >= (pagination.pages || pagination.totalPages || 1)} onClick={() => loadStaff((pagination.page || 1) + 1)}>Next</button></div></div>}
    </section>
    {selected && <div className="college-staff-modal-backdrop"><section className="college-staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-details"><div className="college-staff-modal-heading"><div><h2 id="staff-details">Staff Details</h2><p>{value(selected.fullName || selected.username)}</p></div><button type="button" aria-label="Close staff details" onClick={() => setSelected(null)}><X size={19} /></button></div><dl><dt>Full Name</dt><dd>{value(selected.fullName)}</dd><dt>Username</dt><dd>{value(selected.username)}</dd><dt>Email</dt><dd><Mail size={14} /> {value(selected.email)}</dd><dt>Phone</dt><dd><Phone size={14} /> {value(selected.phone)}</dd><dt>Department</dt><dd>{value(selected.departmentRecord?.name || selected.department)}</dd><dt>Role</dt><dd>{value(selected.role)}</dd><dt>Status</dt><dd>{selected.active ? 'Active' : 'Inactive'}</dd><dt>Created Date</dt><dd>{date(selected.createdAt)}</dd><dt>Updated Date</dt><dd>{date(selected.updatedAt)}</dd></dl></section></div>}
  </div>;
};

export default CollegeStaff;
