import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ICTMaintenance = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  
  // State
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterDate, setFilterDate] = useState('all');

  // Form Data
  const [formData, setFormData] = useState({
    asset_id: '',
    problem: '',
    priority: 'Medium',
    reported_by: '',
    department: '',
    assigned_to: '',
    status: 'Pending',
    diagnosis: '',
    repair: '',
    parts_used: '',
    cost: '',
    remarks: '',
    scheduled_date: '',
    completion_date: '',
    maintenance_type: 'Corrective'
  });

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    rejected: 0,
    overdue: 0
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [maintenanceRes, assetsRes, usersRes] = await Promise.all([
        axios.get('/api/maintenance', { params: { limit: 1000 } }),
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/users', { params: { limit: 1000 } })
      ]);

      setMaintenanceRequests(maintenanceRes.data.requests || []);
      setAssets(assetsRes.data.assets || []);
      setUsers(usersRes.data.users || []);
      
      // Calculate statistics
      const requests = maintenanceRes.data.requests || [];
      const now = new Date();
      const overdue = requests.filter(r => 
        r.status !== 'Completed' && 
        r.status !== 'Rejected' && 
        r.status !== 'Cancelled' &&
        r.scheduled_date && 
        new Date(r.scheduled_date) < now
      ).length;

      setStats({
        total: requests.length,
        pending: requests.filter(r => r.status === 'Pending').length,
        inProgress: requests.filter(r => r.status === 'In Progress' || r.status === 'Assigned').length,
        completed: requests.filter(r => r.status === 'Completed').length,
        rejected: requests.filter(r => r.status === 'Rejected' || r.status === 'Cancelled').length,
        overdue: overdue
      });
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error(t.fetchError);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get filtered requests
  const getFilteredRequests = () => {
    let filtered = maintenanceRequests;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    
    if (filterPriority !== 'all') {
      filtered = filtered.filter(r => r.priority === filterPriority);
    }
    
    if (filterDate === 'today') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(r => r.created_at?.startsWith(today));
    } else if (filterDate === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(r => new Date(r.created_at) >= weekAgo);
    } else if (filterDate === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(r => new Date(r.created_at) >= monthAgo);
    }
    
    return filtered;
  };

  // Handle create request
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        title: formData.problem,
        description: formData.problem,
        reported_by: user?.id || formData.reported_by,
        created_at: new Date().toISOString()
      };
      
      const response = await axios.post('/api/maintenance', payload);
      toast.success(t.requestCreated);
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || t.createError);
    }
  };

  // Handle update request
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/maintenance/${selectedRequest.id}`, formData);
      toast.success(t.requestUpdated);
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      toast.error(t.updateError);
    }
  };

  // Handle status change
  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`/api/maintenance/${id}/status`, { status });
      toast.success(t.statusUpdated);
      fetchData();
    } catch (error) {
      toast.error(t.statusError);
    }
  };

  // Handle delete request
  const handleDelete = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await axios.delete(`/api/maintenance/${id}`);
      toast.success(t.requestDeleted);
      fetchData();
    } catch (error) {
      toast.error(t.deleteError);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      asset_id: '',
      problem: '',
      priority: 'Medium',
      reported_by: '',
      department: '',
      assigned_to: '',
      status: 'Pending',
      diagnosis: '',
      repair: '',
      parts_used: '',
      cost: '',
      remarks: '',
      scheduled_date: '',
      completion_date: '',
      maintenance_type: 'Corrective'
    });
  };

  // Edit request
  const handleEdit = (request) => {
    setSelectedRequest(request);
    setFormData({
      asset_id: request.asset_id,
      problem: request.problem,
      priority: request.priority || 'Medium',
      reported_by: request.reported_by_name || '',
      department: request.department || '',
      assigned_to: request.assigned_to || '',
      status: request.status,
      diagnosis: request.diagnosis || '',
      repair: request.repair || '',
      parts_used: request.parts_used || '',
      cost: request.cost || '',
      remarks: request.remarks || '',
      scheduled_date: request.scheduled_date?.split('T')[0] || '',
      completion_date: request.completion_date?.split('T')[0] || '',
      maintenance_type: request.maintenance_type || 'Corrective'
    });
    setShowEditModal(true);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ICT Maintenance Report', 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    
    const tableData = getFilteredRequests().map(r => [
      r.id,
      r.asset_name || 'N/A',
      r.problem?.substring(0, 30) || 'N/A',
      r.priority || 'N/A',
      r.status,
      r.assigned_to_name || 'Unassigned'
    ]);

    doc.autoTable({
      head: [['ID', 'Asset', 'Problem', 'Priority', 'Status', 'Technician']],
      body: tableData,
      startY: 35
    });

    doc.save(`ICT_Maintenance_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success(t.exportSuccess);
  };

  // Styles
  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      flexWrap: 'wrap',
      gap: '16px'
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.75rem',
      fontWeight: 700,
      margin: 0
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      margin: '4px 0 0 0'
    },
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      textAlign: 'center'
    },
    statNumber: {
      fontSize: '1.75rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    statLabel: {
      fontSize: '0.85rem',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    filters: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '24px',
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    select: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #d0d8e8',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      cursor: 'pointer',
      minWidth: '140px'
    },
    button: (bg = 'linear-gradient(135deg, #1a365d, #2b6cb0)') => ({
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      background: bg,
      color: 'white',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }),
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    },
    td: {
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px'
    },
    statusBadge: (status) => {
      const colors = {
        'Pending': { bg: 'rgba(237, 137, 54, 0.15)', text: '#ed8936' },
        'Approved': { bg: 'rgba(43, 108, 176, 0.15)', text: '#4299e1' },
        'Assigned': { bg: 'rgba(43, 108, 176, 0.15)', text: '#4299e1' },
        'In Progress': { bg: 'rgba(237, 137, 54, 0.15)', text: '#ed8936' },
        'Waiting for Parts': { bg: 'rgba(237, 137, 54, 0.15)', text: '#ed8936' },
        'Completed': { bg: 'rgba(72, 187, 120, 0.15)', text: '#48bb78' },
        'Rejected': { bg: 'rgba(252, 129, 129, 0.15)', text: '#fc8181' },
        'Cancelled': { bg: 'rgba(252, 129, 129, 0.15)', text: '#fc8181' }
      };
      const color = colors[status] || { bg: 'rgba(128, 90, 213, 0.15)', text: '#805ad5' };
      return {
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.text}40`
      };
    },
    priorityBadge: (priority) => {
      const colors = {
        'Critical': { bg: 'rgba(252, 129, 129, 0.15)', text: '#fc8181' },
        'High': { bg: 'rgba(237, 137, 54, 0.15)', text: '#ed8936' },
        'Medium': { bg: 'rgba(43, 108, 176, 0.15)', text: '#4299e1' },
        'Low': { bg: 'rgba(72, 187, 120, 0.15)', text: '#48bb78' }
      };
      const color = colors[priority] || colors['Medium'];
      return {
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 700,
        background: color.bg,
        color: color.text
      };
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
      padding: '20px'
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '30px',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      paddingBottom: '16px'
    },
    modalTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.25rem',
      fontWeight: 700
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    fullWidth: {
      gridColumn: '1 / -1'
    },
    label: {
      display: 'block',
      marginBottom: '4px',
      color: isDark ? '#c8dcf5' : '#2d3748',
      fontWeight: 600,
      fontSize: '0.85rem'
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      marginBottom: '4px'
    },
    textarea: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      minHeight: '60px',
      resize: 'vertical',
      marginBottom: '4px'
    },
    select: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      cursor: 'pointer',
      marginBottom: '4px'
    },
    actionButton: (color) => ({
      padding: '4px 10px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '12px',
      background: color,
      color: 'white',
      marginRight: '4px'
    }),
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: isDark ? '#8896b0' : '#4a5568'
    }
  };

  const filteredRequests = getFilteredRequests();

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🔧 {t.maintenance}</h1>
          <p style={styles.subtitle}>{t.maintenanceDesc}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={styles.button()} onClick={() => setShowCreateModal(true)}>
            ➕ {t.newRequest}
          </button>
          <button style={styles.button('linear-gradient(135deg, #48bb78, #68d391)')} onClick={exportToPDF}>
            📊 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.total}</div>
          <div style={styles.statLabel}>{t.totalRequests}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.pending}</div>
          <div style={styles.statLabel}>{t.pending}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.inProgress}</div>
          <div style={styles.statLabel}>{t.inProgress}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.completed}</div>
          <div style={styles.statLabel}>{t.completed}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.overdue}</div>
          <div style={styles.statLabel}>{t.overdue}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.rejected}</div>
          <div style={styles.statLabel}>{t.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">{t.allStatus}</option>
          <option value="Pending">{t.pending}</option>
          <option value="Approved">{t.approved}</option>
          <option value="Assigned">{t.assigned}</option>
          <option value="In Progress">{t.inProgress}</option>
          <option value="Waiting for Parts">{t.waitingForParts}</option>
          <option value="Completed">{t.completed}</option>
          <option value="Rejected">{t.rejected}</option>
          <option value="Cancelled">{t.cancelled}</option>
        </select>

        <select style={styles.select} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="all">{t.allPriority}</option>
          <option value="Critical">{t.critical}</option>
          <option value="High">{t.high}</option>
          <option value="Medium">{t.medium}</option>
          <option value="Low">{t.low}</option>
        </select>

        <select style={styles.select} value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
          <option value="all">{t.allDates}</option>
          <option value="today">{t.today}</option>
          <option value="week">{t.thisWeek}</option>
          <option value="month">{t.thisMonth}</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>{t.asset}</th>
              <th style={styles.th}>{t.problem}</th>
              <th style={styles.th}>{t.priority}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.technician}</th>
              <th style={styles.th}>{t.requestDate}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="8" style={{...styles.td, textAlign: 'center', padding: '40px'}}>
                  {t.noRequests}
                </td>
              </tr>
            ) : (
              filteredRequests.map((req, index) => (
                <tr key={req.id}>
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}>
                    <strong>{req.asset_name || 'N/A'}</strong>
                    <br />
                    <span style={{ fontSize: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                      {req.asset_tag || ''}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.problem || 'N/A'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.priorityBadge(req.priority)}>
                      {req.priority || 'Medium'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge(req.status)}>
                      {req.status || 'Pending'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {req.assigned_to_name || 'Unassigned'}
                  </td>
                  <td style={styles.td}>
                    {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={styles.td}>
                    <button 
                      style={styles.actionButton('#4299e1')}
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowDetailModal(true);
                      }}
                    >
                      👁️
                    </button>
                    <button 
                      style={styles.actionButton('#ed8936')}
                      onClick={() => handleEdit(req)}
                    >
                      ✏️
                    </button>
                    <button 
                      style={styles.actionButton('#fc8181')}
                      onClick={() => handleDelete(req.id)}
                    >
                      🗑️
                    </button>
                    {req.status !== 'Completed' && req.status !== 'Rejected' && req.status !== 'Cancelled' && (
                      <select 
                        style={{...styles.select, padding: '4px 8px', fontSize: '11px', width: '100px'}}
                        onChange={(e) => handleStatusChange(req.id, e.target.value)}
                        value={req.status}
                      >
                        <option value="Pending">{t.pending}</option>
                        <option value="Approved">{t.approved}</option>
                        <option value="Assigned">{t.assigned}</option>
                        <option value="In Progress">{t.inProgress}</option>
                        <option value="Waiting for Parts">{t.waitingForParts}</option>
                        <option value="Completed">{t.completed}</option>
                        <option value="Rejected">{t.rejected}</option>
                        <option value="Cancelled">{t.cancelled}</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>➕ {t.newRequest}</h3>
              <button style={styles.modalClose} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div style={styles.grid}>
                <div>
                  <label style={styles.label}>{t.asset} *</label>
                  <select 
                    style={styles.select}
                    value={formData.asset_id}
                    onChange={(e) => setFormData({...formData, asset_id: e.target.value})}
                    required
                  >
                    <option value="">{t.selectAsset}</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.maintenanceType}</label>
                  <select 
                    style={styles.select}
                    value={formData.maintenance_type}
                    onChange={(e) => setFormData({...formData, maintenance_type: e.target.value})}
                  >
                    <option value="Corrective">{t.corrective}</option>
                    <option value="Preventive">{t.preventive}</option>
                    <option value="Emergency">{t.emergency}</option>
                  </select>
                </div>

                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.problem} *</label>
                  <textarea 
                    style={styles.textarea}
                    value={formData.problem}
                    onChange={(e) => setFormData({...formData, problem: e.target.value})}
                    placeholder={t.problemPlaceholder}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.priority}</label>
                  <select 
                    style={styles.select}
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="Critical">{t.critical}</option>
                    <option value="High">{t.high}</option>
                    <option value="Medium">{t.medium}</option>
                    <option value="Low">{t.low}</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.department}</label>
                  <input 
                    type="text"
                    style={styles.input}
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.scheduledDate}</label>
                  <input 
                    type="date"
                    style={styles.input}
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  />
                </div>

                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.remarks}</label>
                  <textarea 
                    style={styles.textarea}
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    placeholder={t.remarksPlaceholder}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.button()}>
                  ✅ {t.submitRequest}
                </button>
                <button 
                  type="button" 
                  style={styles.button('linear-gradient(135deg, #718096, #4a5568)')}
                  onClick={() => setShowCreateModal(false)}
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📋 {t.requestDetails}</h3>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            
            <div style={styles.grid}>
              <div>
                <label style={styles.label}>{t.requestId}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  #{selectedRequest.id}
                </div>
              </div>
              <div>
                <label style={styles.label}>{t.asset}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedRequest.asset_name} ({selectedRequest.asset_tag})
                </div>
              </div>
              <div style={styles.fullWidth}>
                <label style={styles.label}>{t.problem}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc', minHeight: '40px' }}>
                  {selectedRequest.problem}
                </div>
              </div>
              <div>
                <label style={styles.label}>{t.priority}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  <span style={styles.priorityBadge(selectedRequest.priority)}>
                    {selectedRequest.priority}
                  </span>
                </div>
              </div>
              <div>
                <label style={styles.label}>{t.status}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  <span style={styles.statusBadge(selectedRequest.status)}>
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
              <div>
                <label style={styles.label}>{t.technician}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedRequest.assigned_to_name || 'Unassigned'}
                </div>
              </div>
              <div>
                <label style={styles.label}>{t.requestDate}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div>
                <label style={styles.label}>{t.completionDate}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedRequest.completion_date ? new Date(selectedRequest.completion_date).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              {selectedRequest.diagnosis && (
                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.diagnosis}</label>
                  <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc', minHeight: '40px' }}>
                    {selectedRequest.diagnosis}
                  </div>
                </div>
              )}
              {selectedRequest.repair && (
                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.repair}</label>
                  <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc', minHeight: '40px' }}>
                    {selectedRequest.repair}
                  </div>
                </div>
              )}
              {selectedRequest.parts_used && (
                <div>
                  <label style={styles.label}>{t.partsUsed}</label>
                  <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                    {selectedRequest.parts_used}
                  </div>
                </div>
              )}
              {selectedRequest.cost && (
                <div>
                  <label style={styles.label}>{t.cost}</label>
                  <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                    ${selectedRequest.cost}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRequest && (
        <div style={styles.modal} onClick={() => setShowEditModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>✏️ {t.editRequest}</h3>
              <button style={styles.modalClose} onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div style={styles.grid}>
                <div>
                  <label style={styles.label}>{t.asset}</label>
                  <select 
                    style={styles.select}
                    value={formData.asset_id}
                    onChange={(e) => setFormData({...formData, asset_id: e.target.value})}
                  >
                    <option value="">{t.selectAsset}</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.technician}</label>
                  <select 
                    style={styles.select}
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                  >
                    <option value="">{t.selectTechnician}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.problem} *</label>
                  <textarea 
                    style={styles.textarea}
                    value={formData.problem}
                    onChange={(e) => setFormData({...formData, problem: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.diagnosis}</label>
                  <textarea 
                    style={styles.textarea}
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({...formData, diagnosis: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.repair}</label>
                  <textarea 
                    style={styles.textarea}
                    value={formData.repair}
                    onChange={(e) => setFormData({...formData, repair: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.partsUsed}</label>
                  <input 
                    type="text"
                    style={styles.input}
                    value={formData.parts_used}
                    onChange={(e) => setFormData({...formData, parts_used: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.cost}</label>
                  <input 
                    type="number"
                    style={styles.input}
                    value={formData.cost}
                    onChange={(e) => setFormData({...formData, cost: e.target.value})}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.completionDate}</label>
                  <input 
                    type="date"
                    style={styles.input}
                    value={formData.completion_date}
                    onChange={(e) => setFormData({...formData, completion_date: e.target.value})}
                  />
                </div>

                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.remarks}</label>
                  <textarea 
                    style={styles.textarea}
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.button()}>
                  💾 {t.updateRequest}
                </button>
                <button 
                  type="button" 
                  style={styles.button('linear-gradient(135deg, #718096, #4a5568)')}
                  onClick={() => setShowEditModal(false)}
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  maintenance: 'ICT Maintenance',
  maintenanceDesc: 'Manage maintenance requests for ICT assets',
  newRequest: 'New Request',
  exportPDF: 'Export PDF',
  totalRequests: 'Total Requests',
  pending: 'Pending',
  inProgress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  rejected: 'Rejected',
  allStatus: 'All Status',
  allPriority: 'All Priority',
  allDates: 'All Dates',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  asset: 'Asset',
  problem: 'Problem',
  priority: 'Priority',
  status: 'Status',
  technician: 'Technician',
  requestDate: 'Request Date',
  actions: 'Actions',
  noRequests: 'No maintenance requests found',
  loading: 'Loading...',
  fetchError: 'Failed to load data',
  requestCreated: 'Maintenance request created successfully',
  requestUpdated: 'Maintenance request updated successfully',
  requestDeleted: 'Maintenance request deleted',
  statusUpdated: 'Status updated successfully',
  createError: 'Failed to create request',
  updateError: 'Failed to update request',
  statusError: 'Failed to update status',
  deleteError: 'Failed to delete request',
  exportSuccess: 'Report exported successfully',
  confirmDelete: 'Are you sure you want to delete this request?',
  newRequest: 'New Maintenance Request',
  selectAsset: 'Select Asset',
  selectTechnician: 'Select Technician',
  problemPlaceholder: 'Describe the problem in detail',
  remarksPlaceholder: 'Additional remarks or notes',
  submitRequest: 'Submit Request',
  cancel: 'Cancel',
  editRequest: 'Edit Request',
  updateRequest: 'Update Request',
  requestDetails: 'Request Details',
  requestId: 'Request ID',
  maintenanceType: 'Maintenance Type',
  corrective: 'Corrective',
  preventive: 'Preventive',
  emergency: 'Emergency',
  scheduledDate: 'Scheduled Date',
  completionDate: 'Completion Date',
  diagnosis: 'Diagnosis',
  repair: 'Repair',
  partsUsed: 'Parts Used',
  cost: 'Cost',
  remarks: 'Remarks',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  approved: 'Approved',
  assigned: 'Assigned',
  waitingForParts: 'Waiting for Parts',
  cancelled: 'Cancelled'
};

const amharicTranslations = {
  maintenance: 'የICT ጥገና',
  maintenanceDesc: 'የICT ንብረቶች ጥገና ጥያቄዎችን ያስተዳድሩ',
  newRequest: 'አዲስ ጥያቄ',
  exportPDF: 'PDF ወጣ',
  totalRequests: 'ጠቅላላ ጥያቄዎች',
  pending: 'በመጠባበቅ ላይ',
  inProgress: 'በሂደት ላይ',
  completed: 'ተጠናቅቋል',
  overdue: 'የዘገየ',
  rejected: 'የተሰረዘ',
  allStatus: 'ሁሉም ሁኔታዎች',
  allPriority: 'ሁሉም ቅድሚያዎች',
  allDates: 'ሁሉም ቀናት',
  today: 'ዛሬ',
  thisWeek: 'ይህ ሳምንት',
  thisMonth: 'ይህ ወር',
  asset: 'ንብረት',
  problem: 'ችግር',
  priority: 'ቅድሚያ',
  status: 'ሁኔታ',
  technician: 'ቴክኒሻን',
  requestDate: 'የጥያቄ ቀን',
  actions: 'ተግባራት',
  noRequests: 'ምንም የጥገና ጥያቄዎች አልተገኙም',
  loading: 'በመጫን ላይ...',
  fetchError: 'መረጃ መጫን አልተሳካም',
  requestCreated: 'የጥገና ጥያቄ በተሳካ ሁኔታ ተፈጥሯል',
  requestUpdated: 'የጥገና ጥያቄ በተሳካ ሁኔታ ተሻሽሏል',
  requestDeleted: 'የጥገና ጥያቄ ተሰርዟል',
  statusUpdated: 'ሁኔታ በተሳካ ሁኔታ ተሻሽሏል',
  createError: 'ጥያቄ መፍጠር አልተሳካም',
  updateError: 'ጥያቄ ማሻሻል አልተሳካም',
  statusError: 'ሁኔታ ማሻሻል አልተሳካም',
  deleteError: 'ጥያቄ መሰረዝ አልተሳካም',
  exportSuccess: 'ሪፖርት በተሳካ ሁኔታ ወጥቷል',
  confirmDelete: 'ይህን ጥያቄ መሰረዝ እንደሚፈልጉ እርግጠኛ ነዎት?',
  newRequest: 'አዲስ የጥገና ጥያቄ',
  selectAsset: 'ንብረት ይምረጡ',
  selectTechnician: 'ቴክኒሻን ይምረጡ',
  problemPlaceholder: 'ችግሩን በዝርዝር ይግለጹ',
  remarksPlaceholder: 'ተጨማሪ ማስታወሻዎች',
  submitRequest: 'ጥያቄ አስገባ',
  cancel: 'ሰርዝ',
  editRequest: 'ጥያቄ አርትዕ',
  updateRequest: 'ጥያቄ አሻሽል',
  requestDetails: 'የጥያቄ ዝርዝሮች',
  requestId: 'የጥያቄ መለያ',
  maintenanceType: 'የጥገና አይነት',
  corrective: 'ማስተካከያ',
  preventive: 'መከላከያ',
  emergency: 'ድንገተኛ',
  scheduledDate: 'የታቀደ ቀን',
  completionDate: 'የማጠናቀቂያ ቀን',
  diagnosis: 'ምርመራ',
  repair: 'ጥገና',
  partsUsed: 'የተጠቀሙት ክፍሎች',
  cost: 'ወጪ',
  remarks: 'ማስታወሻዎች',
  critical: 'አስቸኳይ',
  high: 'ከፍተኛ',
  medium: 'መካከለኛ',
  low: 'ዝቅተኛ',
  approved: 'የጸደቀ',
  assigned: 'የተመደበ',
  waitingForParts: 'ክፍሎችን በመጠባበቅ ላይ',
  cancelled: 'የተሰረዘ'
};

export default ICTMaintenance;