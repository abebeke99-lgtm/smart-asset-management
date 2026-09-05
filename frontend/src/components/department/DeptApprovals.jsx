import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { getDepartmentLabel } from '../../utils/department';

const DeptApprovals = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalReason, setApprovalReason] = useState('');
  
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    byType: {},
    byPriority: {}
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchRequests();
  }, [filter, filterType, filterPriority]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {
        department: user?.department,
        status: filter || undefined,
        type: filterType || undefined,
        priority: filterPriority || undefined,
        limit: 200
      };
      const response = await axios.get('/api/approvals', { params });
      const data = response.data.requests || [];
      const normalizedRequests = data.map((request) => ({
        ...request,
        status: request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1).toLowerCase() : request.status,
        priority: request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1).toLowerCase() : request.priority,
      }));
      setRequests(normalizedRequests);
      calculateStats(normalizedRequests);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load requests');
      setRequests([]);
      calculateStats([]);
    }
    setLoading(false);
  };

  const generateFallbackRequests = () => {
    const types = ['Asset Request', 'Asset Assignment', 'Asset Transfer', 'Maintenance Request', 'Asset Return', 'New Equipment Request', 'Disposal Request'];
    const priorities = ['Critical', 'High', 'Medium', 'Low'];
    const statuses = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
    const employees = ['Abebe Kebede', 'Almaz Taddesse', 'Dawit Solomon', 'Eden Eshetu', 'Fikru Hailu', 'Genet Assefa'];
    const items = ['Laptop', 'Printer', 'Monitor', 'Desk', 'Chair', 'Server', 'Software License', 'Vehicle'];
    const departments = ['Finance', 'IT', 'HR', 'Operations', 'Marketing'];
    
    return Array.from({ length: 25 }, (_, i) => {
      const status = statuses[i % statuses.length];
      const type = types[i % types.length];
      const priority = priorities[i % priorities.length];
      const createdDate = new Date(Date.now() - (i + 1) * 2 * 24 * 3600000);
      
      return {
        id: `req_${i + 1}`,
        request_id: `REQ-${String(i + 1).padStart(4, '0')}`,
        type: type,
        priority: priority,
        status: status,
        requested_by: employees[i % employees.length],
        requested_by_id: `user_${(i % 6) + 1}`,
        department: departments[i % departments.length],
        item: items[i % items.length],
        quantity: Math.floor(Math.random() * 5) + 1,
        reason: `${type} request for ${items[i % items.length]} - ${['New employee', 'Replacement', 'Upgrade', 'Maintenance', 'Transfer'][i % 5]}`,
        description: `Detailed description for request ${i + 1}. ${type} required for ${['business operations', 'new hire', 'equipment failure', 'upgrade', 'compliance'][i % 5]}.`,
        priority_reason: priority === 'Critical' ? 'Urgent operational need' : priority === 'High' ? 'Important for operations' : 'Standard request',
        created_at: createdDate.toISOString(),
        updated_at: new Date(createdDate.getTime() + Math.random() * 5 * 24 * 3600000).toISOString(),
        approved_at: status === 'Approved' ? new Date(createdDate.getTime() + Math.random() * 3 * 24 * 3600000).toISOString() : null,
        rejected_at: status === 'Rejected' ? new Date(createdDate.getTime() + Math.random() * 2 * 24 * 3600000).toISOString() : null,
        approved_by: status === 'Approved' ? 'Department Head' : null,
        rejected_by: status === 'Rejected' ? 'Department Head' : null,
        approval_comment: status === 'Approved' ? 'Approved for business use' : status === 'Rejected' ? 'Not approved at this time' : null,
        approval_reason: status === 'Approved' ? 'Meets department requirements' : status === 'Rejected' ? 'Budget constraints' : null,
        is_urgent: priority === 'Critical' || priority === 'High'
      };
    });
  };

  const calculateStats = (data) => {
    const pending = data.filter(r => r.status === 'Pending').length;
    const approved = data.filter(r => r.status === 'Approved').length;
    const rejected = data.filter(r => r.status === 'Rejected').length;
    const cancelled = data.filter(r => r.status === 'Cancelled').length;
    
    const byType = data.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});
    
    const byPriority = data.reduce((acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    }, {});
    
    setStats({ pending, approved, rejected, cancelled, byType, byPriority });
  };

  const handleApproval = async (decision) => {
    if (!selectedRequest) return;
    
    try {
      await axios.patch(`/api/approvals/${selectedRequest.id}`, {
        status: decision.toLowerCase(),
        comment: approvalComment,
        reason: approvalReason
      });
      
      toast.success(
        decision === 'Approved' 
          ? t.approvalSuccess 
          : t.rejectionSuccess
      );
      
      setShowModal(false);
      setApprovalComment('');
      setApprovalReason('');
      await fetchRequests();
    } catch (error) {
      toast.error(t.approvalError || 'Failed to process approval');
    }
  };

  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setModalMode('view');
    setShowModal(true);
  };

  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setModalMode('approve');
    setShowModal(true);
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setModalMode('reject');
    setShowModal(true);
  };

  const exportToExcel = () => {
    const data = filteredRequests.map(r => ({
      'Request ID': r.request_id,
      'Type': r.type,
      'Priority': r.priority,
      'Status': r.status,
      'Requested By': r.requested_by,
      'Department': r.department,
      'Item': r.item,
      'Quantity': r.quantity,
      'Reason': r.reason,
      'Created': new Date(r.created_at).toLocaleString(),
      'Approved/Rejected At': r.approved_at ? new Date(r.approved_at).toLocaleString() : r.rejected_at ? new Date(r.rejected_at).toLocaleString() : '-',
      'Decision By': r.approved_by || r.rejected_by || '-',
      'Comment': r.approval_comment || '-',
      'Approval Reason': r.approval_reason || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Approvals');
    XLSX.writeFile(wb, 'department_approvals.xlsx');
    toast.success(t.exportSuccess || 'Exported successfully');
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': '#ed8936',
      'Approved': '#48bb78',
      'Rejected': '#fc8181',
      'Cancelled': '#a0aec0'
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

  const getTypeIcon = (type) => {
    const icons = {
      'Asset Request': '📋',
      'Asset Assignment': '📤',
      'Asset Transfer': '🔄',
      'Maintenance Request': '🔧',
      'Asset Return': '📥',
      'New Equipment Request': '🆕',
      'Disposal Request': '🗑️'
    };
    return icons[type] || '📄';
  };

  const filteredRequests = useMemo(() => {
    let result = requests;
    
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(r => 
        r.request_id?.toLowerCase().includes(term) ||
        r.requested_by?.toLowerCase().includes(term) ||
        r.item?.toLowerCase().includes(term) ||
        r.reason?.toLowerCase().includes(term)
      );
    }
    
    if (filter && filter !== 'all') {
      result = result.filter(r => r.status === filter);
    }
    
    if (filterType) {
      result = result.filter(r => r.type === filterType);
    }
    
    if (filterPriority) {
      result = result.filter(r => r.priority === filterPriority);
    }
    
    return result;
  }, [requests, search, filter, filterType, filterPriority]);

  // Unique types for filter
  const uniqueTypes = useMemo(() => [...new Set(requests.map(r => r.type).filter(Boolean))], [requests]);

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1600px',
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
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,100,0.08)'
      }
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
      minWidth: '180px',
      flex: '1 1 150px',
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
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    th: {
      padding: '10px 14px',
      textAlign: 'left',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap'
    },
    td: {
      padding: '10px 14px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem'
    },
    clickableRow: {
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    statusBadge: (status) => ({
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: getStatusColor(status) + '22',
      color: getStatusColor(status)
    }),
    priorityBadge: (priority) => ({
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: getPriorityColor(priority) + '22',
      color: getPriorityColor(priority)
    }),
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    requestId: {
      display: 'inline-block',
      padding: '2px 10px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '4px',
      fontSize: '0.8rem',
      fontWeight: 600,
      color: isDark ? '#c8dcf5' : '#1a365d'
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
      maxWidth: '700px',
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
    descriptionBox: {
      padding: '12px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px',
      marginBottom: '20px',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      lineHeight: 1.6
    },
    formGroup: {
      marginBottom: '16px'
    },
    formLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.8rem',
      fontWeight: 600,
      display: 'block',
      marginBottom: '4px'
    },
    formInput: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      outline: 'none'
    },
    formTextarea: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      outline: 'none',
      minHeight: '80px',
      resize: 'vertical'
    },
    modalActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '20px',
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    },
    buttonPrimary: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #4299e1, #3182ce)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonSecondary: {
      padding: '10px 24px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      color: isDark ? '#c8dcf5' : '#1a365d',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonSuccess: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #48bb78, #38a169)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonDanger: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    approvalRecord: {
      padding: '16px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px',
      marginTop: '12px',
      borderLeft: `4px solid ${isDark ? '#48bb78' : '#48bb78'}`
    },
    rejectionRecord: {
      padding: '16px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px',
      marginTop: '12px',
      borderLeft: `4px solid ${isDark ? '#fc8181' : '#fc8181'}`
    },
    actionButtons: {
      display: 'flex',
      gap: '12px',
      marginTop: '20px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    },
    actionButtonPrimary: {
      padding: '12px 32px',
      background: 'linear-gradient(135deg, #48bb78, #38a169)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: '1rem',
      minWidth: '120px'
    },
    actionButtonDanger: {
      padding: '12px 32px',
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: '1rem',
      minWidth: '120px'
    },
    actionButtonSecondary: {
      padding: '12px 32px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      color: isDark ? '#c8dcf5' : '#1a365d',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: '1rem',
      minWidth: '120px'
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
          <h1 style={styles.title}>✅ {t.approvals}</h1>
          <p style={styles.subtitle}>
            {t.approvalsDesc} - {user?.department || 'Department'}
            <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568' }}>
              {stats.pending} {t.pendingRequests}
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
        <div style={styles.statCard} onClick={() => setFilter('Pending')}>
          <div style={{ ...styles.statNumber, color: '#ed8936' }}>{stats.pending}</div>
          <div style={styles.statLabel}>{t.pending}</div>
        </div>
        <div style={styles.statCard} onClick={() => setFilter('Approved')}>
          <div style={{ ...styles.statNumber, color: '#48bb78' }}>{stats.approved}</div>
          <div style={styles.statLabel}>{t.approved}</div>
        </div>
        <div style={styles.statCard} onClick={() => setFilter('Rejected')}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>{stats.rejected}</div>
          <div style={styles.statLabel}>{t.rejected}</div>
        </div>
        <div style={styles.statCard} onClick={() => setFilter('Cancelled')}>
          <div style={{ ...styles.statNumber, color: '#a0aec0' }}>{stats.cancelled}</div>
          <div style={styles.statLabel}>{t.cancelled}</div>
        </div>
        <div style={styles.statCard} onClick={() => setFilter('all')}>
          <div style={styles.statNumber}>{requests.length}</div>
          <div style={styles.statLabel}>{t.totalRequests}</div>
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
        <select style={styles.select} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">{t.allTypes}</option>
          {uniqueTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select style={styles.select} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">{t.allPriorities}</option>
          <option value="Critical">{t.critical}</option>
          <option value="High">{t.high}</option>
          <option value="Medium">{t.medium}</option>
          <option value="Low">{t.low}</option>
        </select>
        <button style={styles.clearButton} onClick={() => {
          setSearch('');
          setFilterType('');
          setFilterPriority('');
          setFilter('pending');
        }}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Requests Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.requestId}</th>
              <th style={styles.th}>{t.type}</th>
              <th style={styles.th}>{t.priority}</th>
              <th style={styles.th}>{t.requestedBy}</th>
              <th style={styles.th}>{t.item}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.created}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                  {t.noRequests}
                </td>
              </tr>
            ) : (
              filteredRequests.map(request => (
                <tr
                  key={request.id}
                  style={styles.clickableRow}
                  onClick={() => handleViewRequest(request)}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={styles.td}>
                    <span style={styles.requestId}>{request.request_id}</span>
                    {request.is_urgent && (
                      <span style={{ marginLeft: '6px', color: '#fc8181' }}>🚨</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={{ marginRight: '4px' }}>{getTypeIcon(request.type)}</span>
                    {request.type}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.priorityBadge(request.priority)}>
                      {request.priority}
                    </span>
                  </td>
                  <td style={styles.td}>{request.requested_by}</td>
                  <td style={styles.td}>
                    {request.item}
                    {request.quantity > 1 && (
                      <span style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568', marginLeft: '4px' }}>
                        x{request.quantity}
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge(request.status)}>
                      {request.status}
                    </span>
                  </td>
                  <td style={{ ...styles.td, fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td style={styles.td}>
                    {request.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          style={{ ...styles.actionButton, background: 'linear-gradient(135deg, #48bb78, #38a169)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                          onClick={(e) => { e.stopPropagation(); handleApproveClick(request); }}
                        >
                          {t.approve}
                        </button>
                        <button
                          style={{ ...styles.actionButton, background: 'linear-gradient(135deg, #fc8181, #e53e3e)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                          onClick={(e) => { e.stopPropagation(); handleRejectClick(request); }}
                        >
                          {t.reject}
                        </button>
                      </div>
                    )}
                    {request.status !== 'Pending' && (
                      <button
                        style={{ ...styles.actionButton, background: isDark ? '#2d4a6f' : '#e8edf5', color: isDark ? '#c8dcf5' : '#1a365d', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                        onClick={(e) => { e.stopPropagation(); handleViewRequest(request); }}
                      >
                        {t.view}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail/Approval Modal */}
      {showModal && selectedRequest && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {selectedRequest.request_id}
                  <span style={{ marginLeft: '12px', fontSize: '0.9rem', fontWeight: 'normal' }}>
                    {getTypeIcon(selectedRequest.type)} {selectedRequest.type}
                  </span>
                </h2>
                <div style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.9rem', marginTop: '4px' }}>
                  {t.requestedBy}: {selectedRequest.requested_by} • {getDepartmentLabel(selectedRequest.department) || '-'}
                </div>
              </div>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Request Details */}
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={styles.detailValue}>
                  <span style={styles.statusBadge(selectedRequest.status)}>
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.priority}</div>
                <div style={styles.detailValue}>
                  <span style={styles.priorityBadge(selectedRequest.priority)}>
                    {selectedRequest.priority}
                  </span>
                  {selectedRequest.priority_reason && (
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568', marginTop: '2px' }}>
                      {selectedRequest.priority_reason}
                    </div>
                  )}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.item}</div>
                <div style={styles.detailValue}>
                  {selectedRequest.item}
                  {selectedRequest.quantity > 1 && (
                    <span style={{ marginLeft: '4px' }}>x{selectedRequest.quantity}</span>
                  )}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.created}</div>
                <div style={styles.detailValue}>
                  {new Date(selectedRequest.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Reason & Description */}
            {selectedRequest.reason && (
              <div style={{ marginBottom: '12px' }}>
                <div style={styles.detailLabel}>{t.reason}</div>
                <div style={styles.descriptionBox}>
                  {selectedRequest.reason}
                </div>
              </div>
            )}

            {selectedRequest.description && (
              <div style={{ marginBottom: '12px' }}>
                <div style={styles.detailLabel}>{t.description}</div>
                <div style={styles.descriptionBox}>
                  {selectedRequest.description}
                </div>
              </div>
            )}

            {/* Approval Record */}
            {selectedRequest.status === 'Approved' && (
              <div style={styles.approvalRecord}>
                <div style={{ fontWeight: 600, color: '#48bb78' }}>✅ {t.approved}</div>
                <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                  {t.by}: {selectedRequest.approved_by || 'Department Head'}
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  {t.date}: {selectedRequest.approved_at ? new Date(selectedRequest.approved_at).toLocaleString() : '-'}
                </div>
                {selectedRequest.approval_comment && (
                  <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                    {t.comment}: {selectedRequest.approval_comment}
                  </div>
                )}
                {selectedRequest.approval_reason && (
                  <div style={{ fontSize: '0.9rem' }}>
                    {t.reason}: {selectedRequest.approval_reason}
                  </div>
                )}
              </div>
            )}

            {selectedRequest.status === 'Rejected' && (
              <div style={styles.rejectionRecord}>
                <div style={{ fontWeight: 600, color: '#fc8181' }}>❌ {t.rejected}</div>
                <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                  {t.by}: {selectedRequest.rejected_by || 'Department Head'}
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  {t.date}: {selectedRequest.rejected_at ? new Date(selectedRequest.rejected_at).toLocaleString() : '-'}
                </div>
                {selectedRequest.approval_comment && (
                  <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                    {t.comment}: {selectedRequest.approval_comment}
                  </div>
                )}
                {selectedRequest.approval_reason && (
                  <div style={{ fontSize: '0.9rem' }}>
                    {t.reason}: {selectedRequest.approval_reason}
                  </div>
                )}
              </div>
            )}

            {/* Approval/Rejection Form */}
            {(modalMode === 'approve' || modalMode === 'reject') && (
              <div style={{ marginTop: '16px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {modalMode === 'approve' ? t.approvalComment : t.rejectionComment}
                  </label>
                  <textarea
                    style={styles.formTextarea}
                    placeholder={modalMode === 'approve' ? t.approvalCommentPlaceholder : t.rejectionCommentPlaceholder}
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.reason}</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    placeholder={t.reasonPlaceholder}
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedRequest.status === 'Pending' && modalMode === 'view' && (
              <div style={styles.actionButtons}>
                <button style={styles.actionButtonSecondary} onClick={() => setShowModal(false)}>
                  {t.close}
                </button>
                <button style={styles.actionButtonDanger} onClick={() => { setModalMode('reject'); }}>
                  ❌ {t.reject}
                </button>
                <button style={styles.actionButtonPrimary} onClick={() => { setModalMode('approve'); }}>
                  ✅ {t.approve}
                </button>
              </div>
            )}

            {(modalMode === 'approve' || modalMode === 'reject') && (
              <div style={styles.modalActions}>
                <button style={styles.buttonSecondary} onClick={() => { setModalMode('view'); setApprovalComment(''); setApprovalReason(''); }}>
                  {t.back}
                </button>
                <button 
                  style={modalMode === 'approve' ? styles.buttonSuccess : styles.buttonDanger}
                  onClick={() => handleApproval(modalMode === 'approve' ? 'Approved' : 'Rejected')}
                >
                  {modalMode === 'approve' ? `✅ ${t.confirmApprove}` : `❌ ${t.confirmReject}`}
                </button>
              </div>
            )}

            {selectedRequest.status !== 'Pending' && modalMode === 'view' && (
              <div style={styles.modalActions}>
                <button style={styles.buttonSecondary} onClick={() => setShowModal(false)}>
                  {t.close}
                </button>
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
  approvals: 'Department Approvals',
  approvalsDesc: 'Review and manage department approval requests',
  pendingRequests: 'Pending Requests',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  totalRequests: 'Total Requests',
  searchPlaceholder: 'Search by ID, requester, item...',
  allTypes: 'All Types',
  allPriorities: 'All Priorities',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  clearFilters: 'Clear Filters',
  requestId: 'Request ID',
  type: 'Type',
  priority: 'Priority',
  requestedBy: 'Requested By',
  item: 'Item',
  status: 'Status',
  created: 'Created',
  actions: 'Actions',
  approve: 'Approve',
  reject: 'Reject',
  view: 'View',
  close: 'Close',
  reason: 'Reason',
  description: 'Description',
  comment: 'Comment',
  by: 'By',
  date: 'Date',
  back: 'Back',
  confirmApprove: 'Confirm Approve',
  confirmReject: 'Confirm Reject',
  approvalComment: 'Approval Comment',
  rejectionComment: 'Rejection Comment',
  approvalCommentPlaceholder: 'Enter approval comment...',
  rejectionCommentPlaceholder: 'Enter rejection reason...',
  reasonPlaceholder: 'Enter reason for decision...',
  loading: 'Loading...',
  noRequests: 'No requests found',
  exportExcel: 'Export to Excel',
  fetchError: 'Failed to load requests',
  exportSuccess: 'Exported successfully',
  approvalSuccess: 'Request approved successfully',
  rejectionSuccess: 'Request rejected successfully',
  approvalError: 'Failed to process approval',
  requestedAt: 'Requested At'
};

const amharicTranslations = {
  approvals: 'የክፍል ማጽደቂያዎች',
  approvalsDesc: 'የክፍል ማጽደቂያ ጥያቄዎችን ይገምግሙ እና ያስተዳድሩ',
  pendingRequests: 'በመጠባበቅ ላይ ያሉ ጥያቄዎች',
  pending: 'በመጠባበቅ ላይ',
  approved: 'ጸድቋል',
  rejected: 'ውድቅ ተደርጓል',
  cancelled: 'ተሰርዟል',
  totalRequests: 'ጠቅላላ ጥያቄዎች',
  searchPlaceholder: 'በመለያ፣ በጠያቂ፣ በእቃ ይፈልጉ...',
  allTypes: 'ሁሉም ዓይነቶች',
  allPriorities: 'ሁሉም ቅድሚያዎች',
  critical: 'አስቸኳይ',
  high: 'ከፍተኛ',
  medium: 'መካከለኛ',
  low: 'ዝቅተኛ',
  clearFilters: 'ማጣሪያ አጽዳ',
  requestId: 'የጥያቄ መለያ',
  type: 'አይነት',
  priority: 'ቅድሚያ',
  requestedBy: 'የጠየቀው',
  item: 'እቃ',
  status: 'ሁኔታ',
  created: 'ተፈጥሯል',
  actions: 'ተግባራት',
  approve: 'ጸድቅ',
  reject: 'ውድቅ አድርግ',
  view: 'ተመልከት',
  close: 'ዝጋ',
  reason: 'ምክንያት',
  description: 'መግለጫ',
  comment: 'አስተያየት',
  by: 'በ',
  date: 'ቀን',
  back: 'ተመለስ',
  confirmApprove: 'ማጽደቅ አረጋግጥ',
  confirmReject: 'ውድቅ ማድረግ አረጋግጥ',
  approvalComment: 'የማጽደቂያ አስተያየት',
  rejectionComment: 'የውድቅ ማድረጊያ አስተያየት',
  approvalCommentPlaceholder: 'የማጽደቂያ አስተያየት ያስገቡ...',
  rejectionCommentPlaceholder: 'የውድቅ ማድረጊያ ምክንያት ያስገቡ...',
  reasonPlaceholder: 'ለውሳኔው ምክንያት ያስገቡ...',
  loading: 'በመጫን ላይ...',
  noRequests: 'ምንም ጥያቄዎች አልተገኙም',
  exportExcel: 'ወደ Excel ላክ',
  fetchError: 'ጥያቄዎች መጫን አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  approvalSuccess: 'ጥያቄ በተሳካ ሁኔታ ጸድቋል',
  rejectionSuccess: 'ጥያቄ በተሳካ ሁኔታ ውድቅ ተደርጓል',
  approvalError: 'ማጽደቂያውን ማከናወን አልተቻለም',
  requestedAt: 'የተጠየቀበት ቀን'
};

export default DeptApprovals;