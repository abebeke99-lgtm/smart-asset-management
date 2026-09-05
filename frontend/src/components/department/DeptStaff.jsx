import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const DeptStaff = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [outstandingRequests, setOutstandingRequests] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, assetsRes] = await Promise.all([
        axios.get('/api/users', { params: { department: user?.department, limit: 200 } }),
        axios.get('/api/assets', { params: { department: user?.department, limit: 500 } })
      ]);

      const staffData = staffRes.data?.users || [];
      const assetsData = assetsRes.data?.assets || assetsRes.data?.data || [];
      
      // Enrich staff with asset counts
      const enrichedStaff = staffData.map(s => ({
        ...s,
        assigned_assets: assetsData.filter(a => a.assigned_to_id === s.id).length,
        assigned_assets_list: assetsData.filter(a => a.assigned_to_id === s.id)
      }));

      setStaff(enrichedStaff);
      setAssets(assetsData);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load staff data');
      setStaff([]);
    }
    setLoading(false);
  };

  const handleStaffClick = async (staffMember) => {
    setSelectedStaff(staffMember);
    setShowDetailModal(true);
    
    // Fetch assignment history
    try {
      const response = await axios.get('/api/assignments', { params: { assigned_to: staffMember.id } });
      setAssignmentHistory(response.data.history || []);
    } catch (error) {
      setAssignmentHistory([]);
    }
    
    // Fetch outstanding requests
    try {
      const response = await axios.get('/api/approvals', { params: { requested_by: staffMember.id } });
      setOutstandingRequests(response.data.requests || []);
    } catch (error) {
      setOutstandingRequests([]);
    }
  };


  const getRoleLabel = (role) => {
    const map = {
      'admin': '👑 Admin',
      'ict_officer': '💻 ICT Officer',
      'department_head': '📋 Department Head',
      'finance': '💰 Finance',
      'store_manager': '🏪 Store Manager',
      'maintenance': '🔧 Maintenance',
      'staff': '👤 Staff',
      'Manager': '👔 Manager',
      'Supervisor': '📊 Supervisor',
      'Senior Staff': '⭐ Senior Staff',
      'Intern': '🎓 Intern',
      'Contractor': '🔨 Contractor'
    };
    return map[role] || role;
  };

  const getRoleIcon = (role) => {
    const icons = {
      'Manager': '👔',
      'Supervisor': '📊',
      'Senior Staff': '⭐',
      'Staff': '👤',
      'Intern': '🎓',
      'Contractor': '🔨',
      'department_head': '📋',
      'admin': '👑',
      'ict_officer': '💻',
      'finance': '💰',
      'store_manager': '🏪',
      'maintenance': '🔧'
    };
    return icons[role] || '👤';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Active': '#48bb78',
      'Inactive': '#fc8181',
      'Pending': '#ed8936',
      'In Progress': '#4299e1',
      'Completed': '#48bb78',
      'Approved': '#48bb78',
      'Rejected': '#fc8181'
    };
    return colors[status] || '#a0aec0';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Critical': '#fc8181',
      'High': '#ed8936',
      'Medium': '#f6ad55',
      'Low': '#48bb78'
    };
    return colors[priority] || '#a0aec0';
  };

  const exportToExcel = () => {
    const data = filteredStaff.map(s => ({
      'Employee ID': s.employee_id || '',
      'Name': s.full_name || s.username || '',
      'Role': s.role || '',
      'Department': s.department || '',
      'Email': s.email || '',
      'Phone': s.phone_number || '',
      'Status': s.is_active ? 'Active' : 'Inactive',
      'Assigned Assets': s.assigned_assets || 0,
      'Joined Date': s.joined_date ? new Date(s.joined_date).toLocaleDateString() : ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Department Staff');
    XLSX.writeFile(wb, `department_staff_${user?.department}.xlsx`);
    toast.success(t.exportSuccess || 'Exported successfully');
  };

  const filteredStaff = useMemo(() => {
    let result = staff;
    
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(s => 
        s.full_name?.toLowerCase().includes(term) ||
        s.username?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.employee_id?.toLowerCase().includes(term)
      );
    }
    
    if (filterRole) {
      result = result.filter(s => s.role === filterRole);
    }
    
    if (filterStatus) {
      result = result.filter(s => 
        filterStatus === 'Active' ? s.is_active : !s.is_active
      );
    }
    
    return result;
  }, [staff, search, filterRole, filterStatus]);

  const uniqueRoles = useMemo(() => [...new Set(staff.map(s => s.role).filter(Boolean))], [staff]);
  const totalStaff = staff.length;
  const activeStaff = staff.filter(s => s.is_active).length;
  const inactiveStaff = staff.filter(s => !s.is_active).length;

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      background: isDark ? '#0d1a2e' : '#f0f4f8',
      minHeight: '100vh'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      marginBottom: '24px'
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.75rem',
      fontWeight: 700,
      marginBottom: '4px'
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.95rem'
    },
    headerActions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '8px'
    },
    exportButton: {
      background: 'linear-gradient(135deg, #48bb78, #38a169)',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '12px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      textAlign: 'center'
    },
    statNumber: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    statLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.8rem',
      marginTop: '2px'
    },
    controls: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '16px',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '20px',
      alignItems: 'center'
    },
    input: {
      padding: '8px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      minWidth: '200px',
      flex: '1 1 180px',
      outline: 'none'
    },
    select: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      cursor: 'pointer',
      minWidth: '130px',
      flex: '1 1 130px',
      outline: 'none'
    },
    clearButton: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      fontSize: '0.85rem'
    },
    card: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      ':hover': {
        transform: 'translateX(4px)',
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
      }
    },
    avatar: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #1a365d, #2b6cb0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '1.2rem',
      fontWeight: 700,
      flexShrink: 0
    },
    statusBadge: (active) => ({
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: active ? '#48bb7820' : '#fc818120',
      color: active ? '#48bb78' : '#fc8181'
    }),
    assetCountBadge: {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: '#4299e120',
      color: '#4299e1'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    // Modal styles
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '28px',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'auto',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    modalTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.3rem',
      fontWeight: 700
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px'
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    },
    detailItem: {
      padding: '12px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px'
    },
    detailLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    detailValue: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1rem',
      fontWeight: 500,
      marginTop: '2px'
    },
    sectionTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1rem',
      fontWeight: 600,
      marginBottom: '12px',
      marginTop: '16px'
    },
    listItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      alignItems: 'center'
    },
    requestItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '8px'
    },
    statusBadgeInline: (status) => ({
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: getStatusColor(status) + '22',
      color: getStatusColor(status)
    }),
    priorityBadgeInline: (priority) => ({
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: getPriorityColor(priority) + '22',
      color: getPriorityColor(priority)
    }),
    assetTag: {
      display: 'inline-block',
      padding: '2px 8px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: isDark ? '#c8dcf5' : '#1a365d'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <div>{t.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>👥 {t.staff}</h1>
          <p style={styles.subtitle}>
            {t.staffIn} <strong>{user?.department || 'Department'}</strong>
            <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568' }}>
              {totalStaff} {t.totalMembers}
            </span>
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{totalStaff}</div>
          <div style={styles.statLabel}>{t.totalStaff}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#48bb78' }}>{activeStaff}</div>
          <div style={styles.statLabel}>{t.active}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>{inactiveStaff}</div>
          <div style={styles.statLabel}>{t.inactive}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#4299e1' }}>
            {staff.reduce((sum, s) => sum + (s.assigned_assets || 0), 0)}
          </div>
          <div style={styles.statLabel}>{t.totalAssignedAssets}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <input
          type="text"
          style={styles.input}
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={styles.select} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">{t.allRoles}</option>
          {uniqueRoles.map(role => (
            <option key={role} value={role}>{getRoleLabel(role)}</option>
          ))}
        </select>
        <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">{t.allStatus}</option>
          <option value="Active">{t.active}</option>
          <option value="Inactive">{t.inactive}</option>
        </select>
        <button style={styles.clearButton} onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); }}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Staff List */}
      {filteredStaff.length === 0 ? (
        <div style={styles.emptyState}>{t.noStaff}</div>
      ) : (
        filteredStaff.map(member => (
          <div 
            key={member.id} 
            style={styles.card}
            onClick={() => handleStaffClick(member)}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = isDark ? '#4a6f8f' : '#b0c4de'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = isDark ? '#32465f' : '#e8edf5'}
          >
            <div style={styles.avatar}>
              {member.avatar || member.full_name?.charAt(0).toUpperCase() || member.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <div style={{ fontWeight: 600, color: isDark ? '#c8dcf5' : '#1a365d' }}>
                {member.full_name || member.username}
                {member.id === user?.id && (
                  <span style={{ fontSize: '0.7rem', color: '#4299e1', marginLeft: '8px' }}>({t.you})</span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                {getRoleLabel(member.role)}
                {member.department && ` • ${member.department}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={styles.assetCountBadge}>
                📦 {member.assigned_assets || 0} {t.assets}
              </span>
              <span style={styles.statusBadge(member.is_active)}>
                {member.is_active ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Staff Detail Modal */}
      {showDetailModal && selectedStaff && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {selectedStaff.full_name || selectedStaff.username}
                </h2>
                <div style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.9rem', marginTop: '4px' }}>
                  {selectedStaff.employee_id} • {getRoleLabel(selectedStaff.role)}
                </div>
              </div>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            {/* Staff Details */}
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.employeeId}</div>
                <div style={styles.detailValue}>{selectedStaff.employee_id || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.email}</div>
                <div style={styles.detailValue}>{selectedStaff.email || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.phone}</div>
                <div style={styles.detailValue}>{selectedStaff.phone_number || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={styles.detailValue}>
                  <span style={styles.statusBadge(selectedStaff.is_active)}>
                    {selectedStaff.is_active ? '✅ Active' : '❌ Inactive'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.department}</div>
                <div style={styles.detailValue}>{selectedStaff.department || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.joinedDate}</div>
                <div style={styles.detailValue}>
                  {selectedStaff.joined_date ? new Date(selectedStaff.joined_date).toLocaleDateString() : '-'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assignedAssets}</div>
                <div style={styles.detailValue}>
                  <span style={styles.assetCountBadge}>
                    📦 {selectedStaff.assigned_assets || 0} {t.assets}
                  </span>
                </div>
              </div>
            </div>

            {/* Assigned Assets */}
            {selectedStaff.assigned_assets_list && selectedStaff.assigned_assets_list.length > 0 && (
              <div>
                <h4 style={styles.sectionTitle}>📦 {t.assignedAssets}</h4>
                {selectedStaff.assigned_assets_list.map(asset => (
                  <div key={asset.id} style={styles.listItem}>
                    <div>
                      <span style={styles.assetTag}>{asset.asset_tag}</span>
                      <span style={{ marginLeft: '8px' }}>{asset.name}</span>
                    </div>
                    <div>
                      <span style={styles.statusBadgeInline(asset.status)}>
                        {asset.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Assignment History */}
            {assignmentHistory.length > 0 && (
              <div>
                <h4 style={styles.sectionTitle}>📋 {t.assignmentHistory}</h4>
                {assignmentHistory.map((item, index) => (
                  <div key={index} style={styles.listItem}>
                    <div>
                      <span style={styles.assetTag}>{item.asset_tag}</span>
                      <span style={{ marginLeft: '8px' }}>{item.asset_name}</span>
                      <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {item.action}
                      </span>
                    </div>
                    <div>
                      <span style={styles.statusBadgeInline(item.status)}>
                        {item.status}
                      </span>
                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outstanding Requests */}
            {outstandingRequests.length > 0 && (
              <div>
                <h4 style={styles.sectionTitle}>📨 {t.outstandingRequests}</h4>
                {outstandingRequests.map((req, index) => (
                  <div key={index} style={styles.requestItem}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{req.request_id}</span>
                      <span style={{ marginLeft: '8px' }}>{req.type}</span>
                      <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {req.item}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={styles.priorityBadgeInline(req.priority)}>
                        {req.priority}
                      </span>
                      <span style={styles.statusBadgeInline(req.status)}>
                        {req.status}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {new Date(req.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  staff: 'Department Staff',
  staffIn: 'Staff in',
  loading: 'Loading...',
  noStaff: 'No staff found in this department',
  searchPlaceholder: 'Search by name, email, ID...',
  allRoles: 'All Roles',
  allStatus: 'All Status',
  active: 'Active',
  inactive: 'Inactive',
  clearFilters: 'Clear Filters',
  exportExcel: 'Export to Excel',
  totalMembers: 'Members',
  totalStaff: 'Total Staff',
  totalAssignedAssets: 'Assigned Assets',
  you: 'You',
  assets: 'Assets',
  employeeId: 'Employee ID',
  email: 'Email',
  phone: 'Phone',
  status: 'Status',
  department: 'Department',
  joinedDate: 'Joined Date',
  assignedAssets: 'Assigned Assets',
  assignmentHistory: 'Assignment History',
  outstandingRequests: 'Outstanding Requests',
  fetchError: 'Failed to load staff data',
  exportSuccess: 'Exported successfully'
};

const amharicTranslations = {
  staff: 'የክፍል ሰራተኞች',
  staffIn: 'ሰራተኞች በ',
  loading: 'በመጫን ላይ...',
  noStaff: 'በዚህ ክፍል ውስጥ ምንም ሰራተኞች አልተገኙም',
  searchPlaceholder: 'በስም፣ በኢሜይል፣ በመለያ ይፈልጉ...',
  allRoles: 'ሁሉም ሚናዎች',
  allStatus: 'ሁሉም ሁኔታዎች',
  active: 'ንቁ',
  inactive: 'ንቁ ያልሆነ',
  clearFilters: 'ማጣሪያ አጽዳ',
  exportExcel: 'ወደ Excel ላክ',
  totalMembers: 'አባላት',
  totalStaff: 'ጠቅላላ ሰራተኞች',
  totalAssignedAssets: 'የተመደቡ ንብረቶች',
  you: 'እርስዎ',
  assets: 'ንብረቶች',
  employeeId: 'የሰራተኛ መለያ',
  email: 'ኢሜይል',
  phone: 'ስልክ',
  status: 'ሁኔታ',
  department: 'ክፍል',
  joinedDate: 'የተቀላቀሉበት ቀን',
  assignedAssets: 'የተመደቡ ንብረቶች',
  assignmentHistory: 'የምደባ ታሪክ',
  outstandingRequests: 'ያልተጠናቀቁ ጥያቄዎች',
  fetchError: 'የሰራተኞች ውሂብ ማግኘት አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ'
};

export default DeptStaff;