import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const englishTranslations = {
    assetRequests: 'Asset Requests',
    allRequests: 'All Requests',
    pendingRequests: 'Pending',
    approvedRequests: 'Approved',
    rejectedRequests: 'Rejected',
    requestID: 'Request ID',
    type: 'Type',
    priority: 'Priority',
    status: 'Status',
    requestedBy: 'Requested By',
    department: 'Department',
    item: 'Item',
    quantity: 'Quantity',
    reason: 'Reason',
    createdDate: 'Created Date',
    approvedDate: 'Approved Date',
    rejectedDate: 'Rejected Date',
    approvalComment: 'Approval Comment',
    rejectionReason: 'Rejection Reason',
    view: 'View',
    approve: 'Approve',
    reject: 'Reject',
    export: 'Export to Excel',
    refresh: 'Refresh',
    search: 'Search by Request ID or Item...',
    noRequests: 'No asset requests found',
    loading: 'Loading requests...',
    approvalSuccess: 'Request approved successfully',
    rejectionSuccess: 'Request rejected successfully',
    actionError: 'Failed to process request',
    fetchError: 'Failed to load requests',
    comment: 'Comment',
    reason: 'Reason',
    submittedBy: 'Submitted By',
    requestDetails: 'Request Details',
    requestedItem: 'Requested Item',
    comments: 'Comments',
    approveButton: 'Approve Request',
    rejectButton: 'Reject Request',
    cancel: 'Cancel',
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled'
};

const amharicTranslations = {
    assetRequests: 'ንብረት ጠየቅ',
    allRequests: 'ሁሉም ጠየቆች',
    pendingRequests: 'በመጠባበቅ ላይ',
    approvedRequests: 'ተጋግዖ',
    rejectedRequests: 'ተከልክሎ',
    requestID: 'ጠየቅ ID',
    type: 'ዓይነት',
    priority: 'ቅድሚያ',
    status: 'ሁኔታ',
    requestedBy: 'ተጠየቀ በ',
    department: 'ክፍል',
    item: 'ንብረት',
    quantity: 'ብዛት',
    reason: 'ምክንያት',
    createdDate: 'ተፈጠረ',
    approvedDate: 'ጋግዞ',
    rejectedDate: 'ተከልክሎ',
    approvalComment: 'ማጠናከሪያ አስተያየት',
    rejectionReason: 'ሳይቀበል ምክንያት',
    view: 'ይመልከቱ',
    approve: 'ማጠናከር',
    reject: 'ይቀበላሉ',
    export: 'Excelに書き出す',
    refresh: 'ዳግም ሙላት',
    search: 'በጠየቅ ID ወይም ንብረት ይፈልጉ...',
    noRequests: 'ንብረት ጠየቆች አልተገኙም',
    loading: 'ጠየቆችን በማስጫን ላይ...',
    approvalSuccess: 'ጠየቅ በተሳካ ሁኔታ ተጋግዞ',
    rejectionSuccess: 'ጠየቅ በተሳካ ሁኔታ ተከልክሎ',
    actionError: 'ጠየቅን መስተናገድ ወደ ውድቅ ደረሰ',
    fetchError: 'ጠየቆችን ማስጫን ወደ ውድቅ ደረሰ',
    comment: 'አስተያየት',
    reason: 'ምክንያት',
    submittedBy: 'ከሞሌ',
    requestDetails: 'ጠየቅ ዝርዝር',
    requestedItem: 'ታሳቢ ንብረት',
    comments: 'አስተያየቶች',
    approveButton: 'ጠየቅ ማጠናከር',
    rejectButton: 'ጠየቅ ውድቅ',
    cancel: 'ተወው',
    critical: 'ወሳኝ',
    high: 'ከፍተኛ',
    medium: 'መካከለኛ',
    low: 'ዝቅተኛ',
    pending: 'በመጠባበቅ ላይ',
    approved: 'ተጋግዖ',
    rejected: 'ተከልክሎ',
    cancelled: 'ተወው'
};

const ICTAssetRequests = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  // State
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalReason, setApprovalReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    byPriority: {}
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/approvals', {
        params: {
          limit: 200,
          status: activeTab === 'all' ? undefined : activeTab
        }
      });

      let data = response.data.requests || response.data.approvals || [];
      
      // Filter for ICT-relevant requests
      data = data.filter(r => 
        r.type && (
          r.type.toLowerCase().includes('ict') ||
          r.type.toLowerCase().includes('equipment') ||
          r.type.toLowerCase().includes('computer') ||
          r.type.toLowerCase().includes('network') ||
          r.type.toLowerCase().includes('tech') ||
          r.type === 'Asset Request' ||
          r.type === 'New Equipment Request'
        )
      );

      // Normalize status
      const normalizedRequests = data.map(r => ({
        ...r,
        status: r.status ? String(r.status).charAt(0).toUpperCase() + String(r.status).slice(1).toLowerCase() : 'Pending',
        priority: r.priority ? String(r.priority).charAt(0).toUpperCase() + String(r.priority).slice(1).toLowerCase() : 'Medium'
      }));

      setRequests(normalizedRequests);
      calculateStats(normalizedRequests);
      applyFilters(normalizedRequests);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load requests');
      setRequests([]);
      calculateStats([]);
    }
    setLoading(false);
  }, [activeTab, t]);

  // Apply filters
  const applyFilters = useCallback((data) => {
    let filtered = data;

    // Status filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status?.toLowerCase() === activeTab.toLowerCase());
    }

    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(r => r.priority?.toLowerCase() === filterPriority.toLowerCase());
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(r =>
        (r.request_id && r.request_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.item && r.item.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.type && r.type.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredRequests(filtered);
  }, [activeTab, filterPriority, searchQuery]);

  const calculateStats = (data) => {
    const pending = data.filter(r => r.status === 'Pending').length;
    const approved = data.filter(r => r.status === 'Approved').length;
    const rejected = data.filter(r => r.status === 'Rejected').length;
    const byPriority = data.reduce((acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    }, {});

    setStats({
      total: data.length,
      pending,
      approved,
      rejected,
      byPriority
    });
  };

  const handleApproval = async (decision) => {
    if (!selectedRequest) return;

    try {
      await axios.patch(`/api/approvals/${selectedRequest.id}`, {
        status: decision.toLowerCase(),
        comment: approvalComment,
        reason: approvalReason
      });

      toast.success(decision === 'Approved' ? t.approvalSuccess : t.rejectionSuccess);
      setShowModal(false);
      setApprovalComment('');
      setApprovalReason('');
      fetchRequests();
    } catch (error) {
      toast.error(t.actionError || 'Failed to process request');
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
    if (filteredRequests.length === 0) {
      toast.warning('No data to export');
      return;
    }

    const data = filteredRequests.map(r => ({
      'Request ID': r.request_id,
      'Type': r.type,
      'Item': r.item,
      'Quantity': r.quantity,
      'Priority': r.priority,
      'Status': r.status,
      'Requested By': r.requested_by,
      'Department': r.department,
      'Reason': r.reason,
      'Created Date': r.created_at ? new Date(r.created_at).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Requests');
    XLSX.writeFile(wb, 'asset_requests.xlsx');
    toast.success('File exported successfully');
  };

  // Effects
  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  useEffect(() => {
    applyFilters(requests);
  }, [searchQuery, filterPriority, applyFilters, requests]);

  // Styles
  const styles = {
    container: {
      padding: '20px',
      backgroundColor: isDark ? '#0f1419' : '#f8f9fa',
      borderRadius: '8px',
      minHeight: 'calc(100vh - 120px)'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      flexWrap: 'wrap',
      gap: '12px'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#000000',
      margin: 0
    },
    buttonGroup: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },
    button: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      fontSize: '14px',
      transition: 'all 0.3s ease'
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      color: '#ffffff'
    },
    primaryButtonHover: {
      backgroundColor: '#2563eb',
      transform: 'translateY(-2px)'
    },
    secondaryButton: {
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      color: isDark ? '#f3f4f6' : '#111827'
    },
    statsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '8px',
      padding: '16px',
      textAlign: 'center'
    },
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#3b82f6',
      margin: '8px 0 0 0'
    },
    statLabel: {
      fontSize: '14px',
      color: isDark ? '#9ca3af' : '#6b7280'
    },
    tabsContainer: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px',
      borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      overflowX: 'auto'
    },
    tab: {
      padding: '12px 16px',
      borderBottom: '3px solid transparent',
      cursor: 'pointer',
      fontWeight: '500',
      color: isDark ? '#9ca3af' : '#6b7280',
      whiteSpace: 'nowrap',
      transition: 'all 0.3s ease'
    },
    tabActive: {
      borderBottomColor: '#3b82f6',
      color: '#3b82f6'
    },
    filterContainer: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    },
    input: {
      flex: 1,
      minWidth: '200px',
      padding: '10px 14px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      color: isDark ? '#f3f4f6' : '#000000',
      fontSize: '14px'
    },
    select: {
      padding: '10px 14px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      color: isDark ? '#f3f4f6' : '#000000',
      fontSize: '14px',
      cursor: 'pointer'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '8px',
      overflow: 'hidden'
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      backgroundColor: isDark ? '#111827' : '#f3f4f6',
      fontWeight: '600',
      color: isDark ? '#f3f4f6' : '#111827',
      borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      fontSize: '13px'
    },
    td: {
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      color: isDark ? '#e5e7eb' : '#111827',
      fontSize: '13px'
    },
    statusBadge: (status) => {
      const baseStyle = {
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'inline-block'
      };
      if (status === 'Pending') return { ...baseStyle, backgroundColor: '#fef3c7', color: '#92400e' };
      if (status === 'Approved') return { ...baseStyle, backgroundColor: '#dcfce7', color: '#15803d' };
      if (status === 'Rejected') return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
      return baseStyle;
    },
    priorityBadge: (priority) => {
      const baseStyle = {
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'inline-block'
      };
      if (priority === 'Critical') return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
      if (priority === 'High') return { ...baseStyle, backgroundColor: '#fed7aa', color: '#92400e' };
      if (priority === 'Medium') return { ...baseStyle, backgroundColor: '#fef3c7', color: '#ca8a04' };
      if (priority === 'Low') return { ...baseStyle, backgroundColor: '#dbeafe', color: '#0c4a6e' };
      return baseStyle;
    },
    modal: {
      display: showModal ? 'flex' : 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modalContent: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: '8px',
      padding: '24px',
      maxWidth: '600px',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
    },
    modalHeader: {
      fontSize: '20px',
      fontWeight: '700',
      marginBottom: '16px',
      color: isDark ? '#f3f4f6' : '#000000'
    },
    fieldGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      marginBottom: '6px',
      color: isDark ? '#e5e7eb' : '#374151'
    },
    textarea: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
      backgroundColor: isDark ? '#111827' : '#f9fafb',
      color: isDark ? '#f3f4f6' : '#000000',
      fontSize: '14px',
      fontFamily: 'inherit',
      minHeight: '80px',
      resize: 'vertical'
    },
    modalActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: isDark ? '#9ca3af' : '#6b7280'
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{t.assetRequests}</h1>
        <div style={styles.buttonGroup}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onMouseEnter={(e) => Object.assign(e.target.style, styles.primaryButtonHover)}
            onMouseLeave={(e) => Object.assign(e.target.style, { backgroundColor: '#3b82f6', transform: 'none' })}
            onClick={fetchRequests}
          >
            {t.refresh}
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={exportToExcel}
          >
            {t.export}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.allRequests}</div>
          <div style={styles.statValue}>{stats.total}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.pendingRequests}</div>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.pending}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.approvedRequests}</div>
          <div style={{ ...styles.statValue, color: '#10b981' }}>{stats.approved}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.rejectedRequests}</div>
          <div style={{ ...styles.statValue, color: '#ef4444' }}>{stats.rejected}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        {['all', 'pending', 'approved', 'rejected'].map(tab => (
          <div
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? t.allRequests : tab === 'pending' ? t.pendingRequests : tab === 'approved' ? t.approvedRequests : t.rejectedRequests}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filterContainer}>
        <input
          type="text"
          placeholder={t.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.input}
        />
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Priorities</option>
          <option value="critical">{t.critical}</option>
          <option value="high">{t.high}</option>
          <option value="medium">{t.medium}</option>
          <option value="low">{t.low}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⏳</div>
          <p>{t.loading}</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <p>{t.noRequests}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.requestID}</th>
                <th style={styles.th}>{t.type}</th>
                <th style={styles.th}>{t.item}</th>
                <th style={styles.th}>{t.quantity}</th>
                <th style={styles.th}>{t.priority}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.requestedBy}</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => (
                <tr key={request.id}>
                  <td style={styles.td}>{request.request_id}</td>
                  <td style={styles.td}>{request.type}</td>
                  <td style={styles.td}>{request.item}</td>
                  <td style={styles.td}>{request.quantity}</td>
                  <td style={styles.td}>
                    <span style={styles.priorityBadge(request.priority)}>
                      {request.priority}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge(request.status)}>
                      {request.status}
                    </span>
                  </td>
                  <td style={styles.td}>{request.requested_by}</td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.button, ...styles.secondaryButton, fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => handleViewRequest(request)}
                    >
                      {t.view}
                    </button>
                    {request.status === 'Pending' && (
                      <>
                        <button
                          style={{
                            ...styles.button,
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            fontSize: '12px',
                            padding: '6px 12px',
                            marginLeft: '4px'
                          }}
                          onClick={() => handleApproveClick(request)}
                        >
                          {t.approve}
                        </button>
                        <button
                          style={{
                            ...styles.button,
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            fontSize: '12px',
                            padding: '6px 12px',
                            marginLeft: '4px'
                          }}
                          onClick={() => handleRejectClick(request)}
                        >
                          {t.reject}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            {modalMode === 'view' ? t.requestDetails : modalMode === 'approve' ? t.approveButton : t.rejectButton}
          </div>

          {selectedRequest && (
            <>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.requestID}</div>
                <div>{selectedRequest.request_id}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.type}</div>
                <div>{selectedRequest.type}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.requestedItem}</div>
                <div>{selectedRequest.item}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.quantity}</div>
                <div>{selectedRequest.quantity}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.priority}</div>
                <div>
                  <span style={styles.priorityBadge(selectedRequest.priority)}>
                    {selectedRequest.priority}
                  </span>
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.reason}</div>
                <div>{selectedRequest.reason}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.requestedBy}</div>
                <div>{selectedRequest.requested_by}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.department}</div>
                <div>{selectedRequest.department}</div>
              </div>

              {(modalMode === 'approve' || modalMode === 'reject') && (
                <>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                      {modalMode === 'approve' ? t.approvalComment : t.rejectionReason}
                    </label>
                    <textarea
                      style={styles.textarea}
                      value={modalMode === 'approve' ? approvalComment : approvalReason}
                      onChange={(e) => modalMode === 'approve' ? setApprovalComment(e.target.value) : setApprovalReason(e.target.value)}
                      placeholder={modalMode === 'approve' ? 'Add approval comment...' : 'Provide rejection reason...'}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div style={styles.modalActions}>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => setShowModal(false)}
            >
              {t.cancel}
            </button>
            {(modalMode === 'approve' || modalMode === 'reject') && (
              <button
                style={{
                  ...styles.button,
                  backgroundColor: modalMode === 'approve' ? '#10b981' : '#ef4444',
                  color: '#ffffff'
                }}
                onClick={() => handleApproval(modalMode === 'approve' ? 'Approved' : 'Rejected')}
              >
                {modalMode === 'approve' ? t.approveButton : t.rejectButton}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ICTAssetRequests;
