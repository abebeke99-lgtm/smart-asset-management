import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const ICTTechnicalSupport = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  // State
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [responseComment, setResponseComment] = useState('');
  const [backendLimit, setBackendLimit] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    byPriority: {}
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const englishTranslations = {
    technicalSupport: 'Technical Support',
    supportRequests: 'Support Requests',
    allTickets: 'All Tickets',
    openTickets: 'Open',
    inProgress: 'In Progress',
    resolved: 'Resolved',
    priority: 'Priority',
    status: 'Status',
    requester: 'Requester',
    asset: 'Asset',
    problem: 'Problem',
    description: 'Description',
    createdDate: 'Created Date',
    closedDate: 'Closed Date',
    assignedTo: 'Assigned To',
    resolution: 'Resolution',
    notes: 'Notes',
    view: 'View',
    updateStatus: 'Update Status',
    resolve: 'Resolve',
    reopen: 'Reopen',
    export: 'Export to Excel',
    refresh: 'Refresh',
    search: 'Search by ticket ID or problem...',
    noTickets: 'No support tickets found',
    loading: 'Loading tickets...',
    fetchError: 'Failed to load tickets',
    comment: 'Comment',
    resolution: 'Resolution',
    submitButton: 'Submit Update',
    cancel: 'Cancel',
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    open: 'Open',
    inProgress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    pending: 'Pending',
    backendLimitationMessage: 'Technical Support ticketing system requires backend API support. The following data is displayed for demonstration purposes.',
    backendLimitationTitle: 'System Limitation',
    noSupportSystem: 'Technical Support Ticketing System',
    createTicket: 'Create Ticket',
    assignTicket: 'Assign Ticket',
    closeTicket: 'Close Ticket',
    ticketDetails: 'Ticket Details',
    updateTicket: 'Update Ticket Status',
    responseNote: 'Add Response/Comment',
    page: 'Page',
    of: 'of',
    previousPage: 'Previous',
    nextPage: 'Next'
  };

  const amharicTranslations = {
    technicalSupport: 'ቴክኒካል ድጋፍ',
    supportRequests: 'የድጋፍ ጠየቆች',
    allTickets: 'ሁሉም አስጫዋ',
    openTickets: 'ክፍት',
    inProgress: 'በሂደት ላይ',
    resolved: 'ተፈታ',
    priority: 'ቅድሚያ',
    status: 'ሁኔታ',
    requester: 'ተጠይቋል ከ',
    asset: 'ንብረት',
    problem: 'ችግር',
    description: 'ገለጻ',
    createdDate: 'ተፈጠረ',
    closedDate: 'ታሸገ',
    assignedTo: 'ተሰጠ ለ',
    resolution: 'ቅል',
    notes: 'ማሳሰቢያዎች',
    view: 'ይመልከቱ',
    updateStatus: 'ሁኔታን ዳግም አስገብ',
    resolve: 'ምላሽ',
    reopen: 'ዳግም ክፈት',
    export: 'Excelに書き出す',
    refresh: 'ዳግም ሙላት',
    search: 'በ ticket ID ወይም ችግር ይፈልጉ...',
    noTickets: 'ድጋፍ አስጫዋ አልተገኙም',
    loading: 'አስጫዋ በማስጫን ላይ...',
    fetchError: 'አስጫዋ ማስጫን ወደ ውድቅ ደረሰ',
    comment: 'አስተያየት',
    resolution: 'ቅል',
    submitButton: 'ዝማሪያ ያስገቡ',
    cancel: 'ተወው',
    critical: 'ወሳኝ',
    high: 'ከፍተኛ',
    medium: 'መካከለኛ',
    low: 'ዝቅተኛ',
    open: 'ክፍት',
    inProgress: 'በሂደት ላይ',
    resolved: 'ተፈታ',
    closed: 'ታሸገ',
    pending: 'በመጠባበቅ ላይ',
    backendLimitationMessage: 'ቴክኒካል ድጋፍ አስጫዋ ስርዓት በ backend API ድጋፍ ይፈልጋል። ከዚህ በታች ያለው ውሂብ ለማሳያ ስሪት ተገቢ ነው።',
    backendLimitationTitle: 'ስርዓት ገደብ',
    noSupportSystem: 'ቴክኒካል ድጋፍ አስጫዋ ስርዓት',
    createTicket: 'አስጫዋ ይፍጠሩ',
    assignTicket: 'አስጫዋ ይመደቡ',
    closeTicket: 'አስጫዋ ያግዱ',
    ticketDetails: 'አስጫዋ ዝርዝር',
    updateTicket: 'አስጫዋ ሁኔታ ዝማሪያ',
    responseNote: 'ምላሽ/ማሳሰቢያ ይጨምሩ',
    page: 'ገጽ',
    of: 'ስብስብ',
    previousPage: 'ቀደም',
    nextPage: 'ተከታዩ'
  };

  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Attempt to fetch from backend
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from support endpoints
      try {
        const response = await axios.get('/api/support', { params: { limit: 200 } });
        const data = response.data.tickets || response.data.requests || [];
        setTickets(data);
        setBackendLimit(false);
        calculateStats(data);
        applyFilters(data);
        setLoading(false);
        return;
      } catch (error) {
        // Support endpoint doesn't exist, use demo data
      }

      // If no support endpoint, generate demo data
      const demoTickets = generateDemoTickets();
      setTickets(demoTickets);
      setBackendLimit(true);
      calculateStats(demoTickets);
      applyFilters(demoTickets);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load tickets');
      setTickets([]);
    }
    setLoading(false);
  }, [t]);

  // Generate demo data for demonstration
  const generateDemoTickets = () => {
    const problems = [
      'Network connectivity issue',
      'Printer malfunction',
      'Email server down',
      'Password reset required',
      'Software installation needed',
      'Hardware failure',
      'VPN connection issues',
      'Database performance problem'
    ];

    const assets = ['PC-001', 'LAP-002', 'PRT-003', 'SRV-001', 'NET-001'];
    const statuses = ['Open', 'In Progress', 'Resolved'];
    const priorities = ['Critical', 'High', 'Medium', 'Low'];

    return Array.from({ length: 15 }, (_, i) => {
      const createdDate = new Date(Date.now() - (i + 1) * 2 * 24 * 3600000);
      const status = statuses[i % statuses.length];

      return {
        id: `ticket_${i + 1}`,
        ticket_id: `TKT-${String(i + 1).padStart(5, '0')}`,
        problem: problems[i % problems.length],
        description: `Description for ticket ${i + 1}: Technical issue requiring immediate attention`,
        priority: priorities[i % priorities.length],
        status: status,
        requester: `User ${i + 1}`,
        requester_id: `user_${i + 1}`,
        asset: assets[i % assets.length],
        asset_id: `asset_${i + 1}`,
        assigned_to: status !== 'Resolved' ? `Technician ${(i % 3) + 1}` : `Technician ${(i % 3) + 1}`,
        created_at: createdDate.toISOString(),
        resolved_at: status === 'Resolved' ? new Date(createdDate.getTime() + 3 * 24 * 3600000).toISOString() : null,
        resolution: status === 'Resolved' ? 'Issue has been successfully resolved' : null,
        notes: `Technical notes for ticket ${i + 1}`
      };
    });
  };

  // Calculate stats
  const calculateStats = (data) => {
    const open = data.filter(t => t.status === 'Open').length;
    const inProgress = data.filter(t => t.status === 'In Progress').length;
    const resolved = data.filter(t => t.status === 'Resolved').length;
    const byPriority = data.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});

    setStats({
      total: data.length,
      open,
      inProgress,
      resolved,
      byPriority
    });
  };

  // Apply filters
  const applyFilters = useCallback((data) => {
    let filtered = data;

    // Status filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(t => t.status?.toLowerCase() === activeTab.toLowerCase());
    }

    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(t => t.priority?.toLowerCase() === filterPriority.toLowerCase());
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.ticket_id && t.ticket_id.toLowerCase().includes(query)) ||
        (t.problem && t.problem.toLowerCase().includes(query))
      );
    }

    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [activeTab, filterPriority, searchQuery]);

  const exportToExcel = () => {
    if (filteredTickets.length === 0) {
      toast.warning('No data to export');
      return;
    }

    const data = filteredTickets.map(t => ({
      'Ticket ID': t.ticket_id,
      'Problem': t.problem,
      'Priority': t.priority,
      'Status': t.status,
      'Requester': t.requester,
      'Asset': t.asset,
      'Assigned To': t.assigned_to,
      'Created Date': t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
      'Resolved Date': t.resolved_at ? new Date(t.resolved_at).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Support Tickets');
    XLSX.writeFile(wb, 'support_tickets.xlsx');
    toast.success('File exported successfully');
  };

  const handleViewTicket = (ticket) => {
    setSelectedTicket(ticket);
    setModalMode('view');
    setShowModal(true);
  };

  const handleUpdateStatus = (ticket) => {
    setSelectedTicket(ticket);
    setModalMode('update');
    setStatusUpdate(ticket.status);
    setShowModal(true);
  };

  const submitStatusUpdate = async () => {
    if (!selectedTicket) return;

    try {
      // Attempt to update via backend
      await axios.patch(`/api/support/${selectedTicket.id}`, {
        status: statusUpdate,
        comment: responseComment
      });

      toast.success('Ticket updated successfully');
      setShowModal(false);
      setStatusUpdate('');
      setResponseComment('');
      fetchTickets();
    } catch (error) {
      toast.info('Status update functionality requires backend API support');
    }
  };

  // Effects
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    applyFilters(tickets);
  }, [activeTab, filterPriority, searchQuery, applyFilters, tickets]);

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / pageSize);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
      color: isDark ? '#ffffff' : '#000000'
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
      fontSize: '14px'
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      color: '#ffffff'
    },
    secondaryButton: {
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      color: isDark ? '#f3f4f6' : '#111827'
    },
    warningBox: {
      backgroundColor: isDark ? '#78350f' : '#fffbeb',
      border: `1px solid ${isDark ? '#b45309' : '#fcd34d'}`,
      color: isDark ? '#fef3c7' : '#92400e',
      padding: '12px 16px',
      borderRadius: '6px',
      marginBottom: '20px',
      fontSize: '13px'
    },
    statsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
      marginBottom: '20px'
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
        fontWeight: '600'
      };
      if (status === 'Open') return { ...baseStyle, backgroundColor: '#dbeafe', color: '#0c4a6e' };
      if (status === 'In Progress') return { ...baseStyle, backgroundColor: '#fed7aa', color: '#92400e' };
      if (status === 'Resolved') return { ...baseStyle, backgroundColor: '#dcfce7', color: '#15803d' };
      return baseStyle;
    },
    priorityBadge: (priority) => {
      const baseStyle = {
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600'
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
      overflowY: 'auto'
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
    fieldValue: {
      padding: '8px 0',
      color: isDark ? '#d1d5db' : '#6b7280'
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
      minHeight: '80px'
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
    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      marginTop: '20px'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{t.technicalSupport}</h1>
        <div style={styles.buttonGroup}>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={fetchTickets}>
            {t.refresh}
          </button>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={exportToExcel}>
            {t.export}
          </button>
        </div>
      </div>

      {/* Backend Limitation Warning */}
      {backendLimit && (
        <div style={styles.warningBox}>
          ⚠️ <strong>{t.backendLimitationTitle}:</strong> {t.backendLimitationMessage}
        </div>
      )}

      {/* Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.allTickets}</div>
          <div style={styles.statValue}>{stats.total}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.openTickets}</div>
          <div style={{ ...styles.statValue, color: '#3b82f6' }}>{stats.open}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.inProgress}</div>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.inProgress}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.resolved}</div>
          <div style={{ ...styles.statValue, color: '#10b981' }}>{stats.resolved}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        {['all', 'open', 'in progress', 'resolved'].map(tab => (
          <div
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? t.allTickets : tab === 'open' ? t.openTickets : tab === 'in progress' ? t.inProgress : t.resolved}
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
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={styles.select}>
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p>{t.loading}</p>
        </div>
      ) : paginatedTickets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎫</div>
          <p>{t.noTickets}</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ticket ID</th>
                  <th style={styles.th}>{t.problem}</th>
                  <th style={styles.th}>{t.priority}</th>
                  <th style={styles.th}>{t.status}</th>
                  <th style={styles.th}>{t.requester}</th>
                  <th style={styles.th}>{t.asset}</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td style={styles.td}>{ticket.ticket_id}</td>
                    <td style={styles.td}>{ticket.problem}</td>
                    <td style={styles.td}>
                      <span style={styles.priorityBadge(ticket.priority)}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(ticket.status)}>
                        {ticket.status}
                      </span>
                    </td>
                    <td style={styles.td}>{ticket.requester}</td>
                    <td style={styles.td}>{ticket.asset}</td>
                    <td style={styles.td}>
                      <button
                        style={{ ...styles.button, ...styles.secondaryButton, fontSize: '12px', padding: '6px 12px' }}
                        onClick={() => handleViewTicket(ticket)}
                      >
                        {t.view}
                      </button>
                      {ticket.status !== 'Resolved' && (
                        <button
                          style={{
                            ...styles.button,
                            backgroundColor: '#f59e0b',
                            color: '#ffffff',
                            fontSize: '12px',
                            padding: '6px 12px',
                            marginLeft: '4px'
                          }}
                          onClick={() => handleUpdateStatus(ticket)}
                        >
                          {t.updateStatus}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                {t.previousPage}
              </button>
              <span style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                {t.page} {currentPage} {t.of} {totalPages}
              </span>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                {t.nextPage}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            {modalMode === 'view' ? t.ticketDetails : t.updateTicket}
          </div>

          {selectedTicket && (
            <>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>Ticket ID</div>
                <div style={styles.fieldValue}>{selectedTicket.ticket_id}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.problem}</div>
                <div style={styles.fieldValue}>{selectedTicket.problem}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.description}</div>
                <div style={styles.fieldValue}>{selectedTicket.description}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.priority}</div>
                <div>
                  <span style={styles.priorityBadge(selectedTicket.priority)}>
                    {selectedTicket.priority}
                  </span>
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.status}</div>
                <div>
                  <span style={styles.statusBadge(selectedTicket.status)}>
                    {selectedTicket.status}
                  </span>
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.requester}</div>
                <div style={styles.fieldValue}>{selectedTicket.requester}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.asset}</div>
                <div style={styles.fieldValue}>{selectedTicket.asset}</div>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.label}>{t.createdDate}</div>
                <div style={styles.fieldValue}>
                  {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleDateString() : '-'}
                </div>
              </div>

              {modalMode === 'update' && (
                <>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>{t.status}</label>
                    <select
                      value={statusUpdate}
                      onChange={(e) => setStatusUpdate(e.target.value)}
                      style={styles.select}
                    >
                      <option value="Open">{t.open}</option>
                      <option value="In Progress">{t.inProgress}</option>
                      <option value="Resolved">{t.resolved}</option>
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>{t.responseNote}</label>
                    <textarea
                      style={styles.textarea}
                      value={responseComment}
                      onChange={(e) => setResponseComment(e.target.value)}
                      placeholder="Add your comment or resolution notes..."
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
            {modalMode === 'update' && (
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={submitStatusUpdate}
              >
                {t.submitButton}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ICTTechnicalSupport;
