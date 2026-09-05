import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/UiContext';

const MaintRequests = () => {
  const [requests, setRequests] = useState([
    { id: 'REQ-001', asset: 'Printer A', requester: 'Admin', department: 'IT', problem: 'Paper jam', priority: 'High', status: 'Approved', requestedDate: '2026-09-01', assignedTech: 'John Doe' },
    { id: 'REQ-002', asset: 'Server Room AC', requester: 'Building Mgr', department: 'Facilities', problem: 'Temperature control failing', priority: 'Critical', status: 'Assigned', requestedDate: '2026-08-31', assignedTech: 'Jane Smith' },
    { id: 'REQ-003', asset: 'Backup Generator', requester: 'Finance', department: 'Finance', problem: 'Fuel sensor error', priority: 'Medium', status: 'Pending', requestedDate: '2026-08-30', assignedTech: null }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ asset: '', requester: '', department: '', problem: '', priority: 'Medium' });
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#d9e2f2';

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = search === '' || req.asset.toLowerCase().includes(search.toLowerCase()) || req.problem.toLowerCase().includes(search.toLowerCase()) || req.id.toLowerCase().includes(search.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || req.department === departmentFilter;
      return matchesSearch && matchesPriority && matchesStatus && matchesDept;
    });
  }, [requests, search, priorityFilter, statusFilter, departmentFilter]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSubmit = () => {
    if (!formData.asset || !formData.problem) return;
    if (editingId) {
      setRequests(requests.map(r => r.id === editingId ? { ...r, ...formData } : r));
      setEditingId(null);
    } else {
      const newReq = { id: `REQ-${String(requests.length + 1).padStart(3, '0')}`, ...formData, status: 'Pending', requestedDate: new Date().toISOString().split('T')[0], assignedTech: null };
      setRequests([newReq, ...requests]);
    }
    setFormData({ asset: '', requester: '', department: '', problem: '', priority: 'Medium' });
    setShowForm(false);
  };

  const handleEdit = (req) => {
    setEditingId(req.id);
    setFormData({ asset: req.asset, requester: req.requester, department: req.department, problem: req.problem, priority: req.priority });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setRequests(requests.filter(r => r.id !== id));
  };

  const handleStatusChange = (id, newStatus) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const getPriorityColor = (priority) => {
    const colors = { 'Critical': '#fee2e2', 'High': '#fef3c7', 'Medium': '#dbeafe', 'Low': '#dcfce7' };
    return colors[priority] || '#e5e7eb';
  };

  const getPriorityTextColor = (priority) => {
    const colors = { 'Critical': '#991b1b', 'High': '#92400e', 'Medium': '#075985', 'Low': '#166534' };
    return colors[priority] || '#4b5563';
  };

  const getStatusColor = (status) => {
    const colors = { 'Pending': '#fef3c7', 'Approved': '#dcfce7', 'Rejected': '#fee2e2', 'Assigned': '#dbeafe', 'In Progress': '#f3e8ff', 'Completed': '#dcfce7', 'Cancelled': '#fee2e2' };
    return colors[status] || '#e5e7eb';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>🔧 Maintenance Requests</h1>
        <button onClick={() => { setEditingId(null); setFormData({ asset: '', requester: '', department: '', problem: '', priority: 'Medium' }); setShowForm(!showForm); }} style={{ padding: '10px 20px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ New Request</button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>{editingId ? 'Edit Request' : 'Create New Request'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input type="text" placeholder="Asset Name" value={formData.asset} onChange={(e) => setFormData({...formData, asset: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <input type="text" placeholder="Requester" value={formData.requester} onChange={(e) => setFormData({...formData, requester: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }} />
            <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option value="">Select Department</option>
              <option value="IT">IT</option>
              <option value="Facilities">Facilities</option>
              <option value="Finance">Finance</option>
              <option value="HR">HR</option>
            </select>
            <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
              <option value="Critical">Critical Priority</option>
            </select>
          </div>
          <textarea placeholder="Problem Description" value={formData.problem} onChange={(e) => setFormData({...formData, problem: e.target.value})} rows="4" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}`, marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleSubmit} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Submit</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
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
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Assigned">Assigned</option>
          </select>
          <select value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
            <option value="all">All Departments</option>
            <option value="IT">IT</option>
            <option value="Facilities">Facilities</option>
            <option value="Finance">Finance</option>
            <option value="HR">HR</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
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
            {paginatedRequests.map((req) => (
              <tr key={req.id} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '600' }}>{req.id}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{req.asset}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{req.problem.substring(0, 30)}...</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getPriorityColor(req.priority), color: getPriorityTextColor(req.priority), fontSize: '0.85rem', fontWeight: '600' }}>{req.priority}</span>
                </td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                  <select value={req.status} onChange={(e) => handleStatusChange(req.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getStatusColor(req.status), border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Completed">Completed</option>
                  </select>
                </td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{req.assignedTech || '—'}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem', display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleEdit(req)} style={{ padding: '6px 10px', backgroundColor: '#2864E8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                  <button onClick={() => handleDelete(req.id)} style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: '8px 12px', backgroundColor: currentPage === 1 ? '#cbd5e1' : '#2864E8', color: 'white', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'default' : 'pointer' }}>← Previous</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={{ padding: '8px 12px', backgroundColor: currentPage === page ? '#2864E8' : cardBg, color: currentPage === page ? 'white' : 'inherit', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', fontWeight: currentPage === page ? '600' : '400' }}>
                {page}
              </button>
            ))}
          </div>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 12px', backgroundColor: currentPage === totalPages ? '#cbd5e1' : '#2864E8', color: 'white', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages ? 'default' : 'pointer' }}>Next →</button>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
        Showing {paginatedRequests.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} requests
      </div>
    </div>
  );
};

export default MaintRequests;
