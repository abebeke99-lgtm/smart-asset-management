import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const FinanceAudit = () => {
  const { language, theme } = useLanguage();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    module: '',
    user: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    assetId: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchLogs();
  }, [filters.action, filters.module, filters.user, filters.status, filters.dateFrom, filters.dateTo, currentPage]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        ...(filters.action && { action: filters.action }),
        ...(filters.module && { module: filters.module }),
        ...(filters.user && { user: filters.user }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.assetId && { assetId: filters.assetId })
      };
      
      const response = await axios.get('/api/finance/audit', { params });
      setLogs(response.data.logs || []);
      setTotalItems(response.data.total || response.data.logs?.length || 0);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load audit logs');
      setLogs([]);
      setTotalItems(0);
    }
    setLoading(false);
  };

  const generateFallbackLogs = () => {
    const users = ['Finance Officer', 'Asset Manager', 'Accountant', 'Auditor', 'Department Head'];
    const actions = ['VALUATION_CHANGE', 'PURCHASE_COST_CHANGE', 'RESIDUAL_VALUE_CHANGE', 'USEFUL_LIFE_CHANGE', 
                     'DEPRECIATION_ADJUST', 'ASSET_DISPOSED', 'ASSET_WRITTEN_OFF', 'FINANCIAL_RECORD_CREATED', 
                     'FINANCIAL_RECORD_DELETED', 'FINANCIAL_RECORD_VOIDED', 'REVALUATION', 'COST_ADDITION'];
    const modules = ['Asset Valuation', 'Depreciation', 'Asset Register', 'Financial Reports', 'Asset Disposal'];
    const statuses = ['Success', 'Failed', 'Pending Review'];
    const assetTags = ['ICT-0001', 'ICT-0002', 'ICT-0003', 'ICT-0004', 'ICT-0005', 'ICT-0006', 'ICT-0007'];
    const assetNames = ['Laptop', 'Printer', 'Server', 'Vehicle', 'Furniture', 'Machinery', 'Building'];
    
    return Array.from({ length: 150 }, (_, i) => {
      const action = actions[i % actions.length];
      const user = users[i % users.length];
      const module = modules[i % modules.length];
      const status = statuses[i % statuses.length];
      const oldValue = 50000 + Math.random() * 1000000;
      const newValue = oldValue * (0.8 + Math.random() * 0.4);
      const assetIdx = i % assetTags.length;
      
      return {
        id: `audit_${i + 1}`,
        audit_id: `AUD-${String(i + 1).padStart(6, '0')}`,
        user_id: `user_${(i % 10) + 1}`,
        username: user,
        user_role: ['Finance', 'Asset Management', 'Audit'][i % 3],
        action: action,
        module: module,
        asset_id: `asset_${assetIdx + 1}`,
        asset_tag: assetTags[assetIdx],
        asset_name: assetNames[assetIdx],
        old_value: Math.round(oldValue),
        new_value: Math.round(newValue),
        difference: Math.round(newValue - oldValue),
        reason: `${action} performed due to ${['revaluation', 'market adjustment', 'policy change', 'asset review', 'correction'][i % 5]}`,
        notes: `Additional notes for audit entry ${i + 1}`,
        timestamp: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28), 
                           Math.floor(Math.random() * 24), Math.floor(Math.random() * 60)).toISOString(),
        status: status,
        ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        session_id: `sess_${Math.random().toString(36).substring(2, 10)}`,
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
    });
  };

  const getActionColor = (action) => {
    const colors = {
      'VALUATION_CHANGE': '#805ad5',
      'PURCHASE_COST_CHANGE': '#4299e1',
      'RESIDUAL_VALUE_CHANGE': '#ed8936',
      'USEFUL_LIFE_CHANGE': '#f6ad55',
      'DEPRECIATION_ADJUST': '#fc8181',
      'ASSET_DISPOSED': '#e53e3e',
      'ASSET_WRITTEN_OFF': '#d53f8c',
      'FINANCIAL_RECORD_CREATED': '#48bb78',
      'FINANCIAL_RECORD_DELETED': '#fc8181',
      'FINANCIAL_RECORD_VOIDED': '#a0aec0',
      'REVALUATION': '#805ad5',
      'COST_ADDITION': '#4299e1'
    };
    return colors[action] || '#a0aec0';
  };

  const getActionLabel = (action) => {
    const labels = {
      'VALUATION_CHANGE': 'Valuation Change',
      'PURCHASE_COST_CHANGE': 'Purchase Cost Change',
      'RESIDUAL_VALUE_CHANGE': 'Residual Value Change',
      'USEFUL_LIFE_CHANGE': 'Useful Life Change',
      'DEPRECIATION_ADJUST': 'Depreciation Adjust',
      'ASSET_DISPOSED': 'Asset Disposed',
      'ASSET_WRITTEN_OFF': 'Asset Written Off',
      'FINANCIAL_RECORD_CREATED': 'Record Created',
      'FINANCIAL_RECORD_DELETED': 'Record Deleted',
      'FINANCIAL_RECORD_VOIDED': 'Record Voided',
      'REVALUATION': 'Revaluation',
      'COST_ADDITION': 'Cost Addition'
    };
    return labels[action] || action;
  };

  const getStatusColor = (status) => {
    const colors = {
      'Success': '#48bb78',
      'Failed': '#fc8181',
      'Pending Review': '#ed8936'
    };
    return colors[status] || '#a0aec0';
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      module: '',
      user: '',
      dateFrom: '',
      dateTo: '',
      status: '',
      assetId: ''
    });
    setCurrentPage(1);
  };

  const handleLogClick = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const exportToExcel = () => {
    const data = filteredLogs.map(log => ({
      'Audit ID': log.audit_id,
      'User': log.username,
      'Role': log.user_role || '',
      'Action': getActionLabel(log.action),
      'Module': log.module,
      'Asset Tag': log.asset_tag || '',
      'Asset Name': log.asset_name || '',
      'Old Value': log.old_value || 0,
      'New Value': log.new_value || 0,
      'Difference': log.difference || 0,
      'Reason': log.reason || '',
      'Status': log.status,
      'Timestamp': new Date(log.timestamp).toLocaleString(),
      'IP Address': log.ip_address || '',
      'Session ID': log.session_id || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, 'audit_trail.xlsx');
    toast.success(t.exportSuccess || 'Exported successfully');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.setTextColor(isDark ? '#c8dcf5' : '#1a365d');
    doc.text(t.auditTrail, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Records: ${filteredLogs.length}`, 14, 34);

    const tableData = filteredLogs.slice(0, 100).map(log => [
      log.audit_id || '',
      log.username || '',
      getActionLabel(log.action) || '',
      log.module || '',
      log.asset_tag || '',
      log.old_value ? `$${log.old_value.toLocaleString()}` : '',
      log.new_value ? `$${log.new_value.toLocaleString()}` : '',
      log.status || '',
      new Date(log.timestamp).toLocaleString() || ''
    ]);

    doc.autoTable({
      head: [[t.auditId, t.user, t.action, t.module, t.asset, t.oldValue, t.newValue, t.status, t.timestamp]],
      body: tableData,
      startY: 42,
      theme: isDark ? 'dark' : 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: isDark ? [30, 45, 69] : [55, 65, 81] }
    });

    doc.save('audit_trail.pdf');
    toast.success(t.exportSuccess || 'PDF exported successfully');
  };

  // Get unique values for filters
  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.action))], [logs]);
  const uniqueModules = useMemo(() => [...new Set(logs.map(l => l.module))], [logs]);
  const uniqueUsers = useMemo(() => [...new Set(logs.map(l => l.username))], [logs]);

  // Filter logs for display
  const filteredLogs = useMemo(() => {
    let result = logs;
    
    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(l => 
        l.username?.toLowerCase().includes(term) ||
        l.asset_name?.toLowerCase().includes(term) ||
        l.asset_tag?.toLowerCase().includes(term) ||
        l.reason?.toLowerCase().includes(term) ||
        l.audit_id?.toLowerCase().includes(term)
      );
    }
    
    if (filters.assetId) {
      result = result.filter(l => l.asset_tag?.toLowerCase().includes(filters.assetId.toLowerCase()));
    }
    
    return result;
  }, [logs, filters]);

  // Paginate
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

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
    pdfButton: {
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    filtersBar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '16px',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '24px',
      alignItems: 'center'
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flex: '1 1 140px',
      minWidth: '120px'
    },
    filterLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.7rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    filterInput: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem',
      outline: 'none'
    },
    filterSelect: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem',
      cursor: 'pointer',
      outline: 'none'
    },
    clearFiltersButton: {
      padding: '6px 16px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      fontSize: '0.85rem',
      marginTop: '16px',
      alignSelf: 'flex-end'
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
    statusBadge: {
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      display: 'inline-block'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 0',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    pageButton: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      cursor: 'pointer',
      fontSize: '0.85rem',
      margin: '0 4px'
    },
    activePageButton: {
      background: isDark ? '#2d4a6f' : '#2b6cb0',
      color: 'white',
      border: 'none'
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
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '16px'
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
    valueChange: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px',
      marginTop: '8px'
    },
    oldValue: {
      color: '#fc8181',
      textDecoration: 'line-through'
    },
    newValue: {
      color: '#48bb78',
      fontWeight: 700
    },
    arrow: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '1.2rem'
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
          <h1 style={styles.title}>🔍 {t.auditTrail}</h1>
          <p style={styles.subtitle}>{t.auditDesc}</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
          <button style={styles.pdfButton} onClick={exportToPDF}>
            📄 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersBar}>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.search}</span>
          <input
            type="text"
            style={styles.filterInput}
            placeholder={t.searchPlaceholder}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.action}</span>
          <select
            style={styles.filterSelect}
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
          >
            <option value="">{t.allActions}</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{getActionLabel(action)}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.module}</span>
          <select
            style={styles.filterSelect}
            value={filters.module}
            onChange={(e) => handleFilterChange('module', e.target.value)}
          >
            <option value="">{t.allModules}</option>
            {uniqueModules.map(module => (
              <option key={module} value={module}>{module}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.user}</span>
          <select
            style={styles.filterSelect}
            value={filters.user}
            onChange={(e) => handleFilterChange('user', e.target.value)}
          >
            <option value="">{t.allUsers}</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.dateFrom}</span>
          <input
            type="date"
            style={styles.filterInput}
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.dateTo}</span>
          <input
            type="date"
            style={styles.filterInput}
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
        <button style={styles.clearFiltersButton} onClick={clearFilters}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Audit Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.auditId}</th>
              <th style={styles.th}>{t.user}</th>
              <th style={styles.th}>{t.action}</th>
              <th style={styles.th}>{t.module}</th>
              <th style={styles.th}>{t.asset}</th>
              <th style={styles.th}>{t.oldValue}</th>
              <th style={styles.th}>{t.newValue}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.timestamp}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                  {t.noLogs}
                </td>
              </tr>
            ) : (
              paginatedLogs.map(log => (
                <tr 
                  key={log.id} 
                  style={styles.clickableRow}
                  onClick={() => handleLogClick(log)}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={styles.td}>
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '2px 8px', 
                      background: isDark ? '#2d4a6f' : '#e8edf5', 
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: isDark ? '#c8dcf5' : '#1a365d'
                    }}>
                      {log.audit_id}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div>{log.username}</div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                      {log.user_role || ''}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: getActionColor(log.action) }}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td style={styles.td}>{log.module}</td>
                  <td style={styles.td}>
                    {log.asset_tag && (
                      <span style={{ 
                        display: 'inline-block', 
                        padding: '2px 8px', 
                        background: isDark ? '#141e2d' : '#f7fafc', 
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {log.asset_tag}
                      </span>
                    )}
                    {log.asset_name && (
                      <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {log.asset_name}
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>
                    {log.old_value !== undefined && log.old_value !== null && 
                      <span style={{ color: '#fc8181' }}>
                        ${log.old_value.toLocaleString()}
                      </span>
                    }
                  </td>
                  <td style={styles.td}>
                    {log.new_value !== undefined && log.new_value !== null && 
                      <span style={{ color: '#48bb78', fontWeight: 600 }}>
                        ${log.new_value.toLocaleString()}
                      </span>
                    }
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background: `${getStatusColor(log.status)}22`,
                      color: getStatusColor(log.status)
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div style={styles.pagination}>
          <div>
            {t.showing} {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} {t.of} {filteredLogs.length}
          </div>
          <div>
            <button 
              style={styles.pageButton} 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ◀
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  style={{
                    ...styles.pageButton,
                    ...(currentPage === pageNum ? styles.activePageButton : {})
                  }}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button 
              style={styles.pageButton} 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              ▶
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {t.auditDetail} - {selectedLog.audit_id}
              </h2>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.user}</div>
                <div style={styles.detailValue}>
                  {selectedLog.username}
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                    {selectedLog.user_role || ''}
                  </div>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.action}</div>
                <div style={{ ...styles.detailValue, color: getActionColor(selectedLog.action) }}>
                  {getActionLabel(selectedLog.action)}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.module}</div>
                <div style={styles.detailValue}>{selectedLog.module}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={{ ...styles.detailValue, color: getStatusColor(selectedLog.status) }}>
                  {selectedLog.status}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.asset}</div>
                <div style={styles.detailValue}>
                  {selectedLog.asset_tag && (
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '2px 10px', 
                      background: isDark ? '#2d4a6f' : '#e8edf5', 
                      borderRadius: '4px',
                      fontSize: '0.85rem'
                    }}>
                      {selectedLog.asset_tag}
                    </span>
                  )}
                  <div>{selectedLog.asset_name || ''}</div>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.timestamp}</div>
                <div style={styles.detailValue}>
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Value Change Display */}
            {(selectedLog.old_value !== undefined || selectedLog.new_value !== undefined) && (
              <div style={{ marginBottom: '16px' }}>
                <div style={styles.detailLabel}>{t.valueChange}</div>
                <div style={styles.valueChange}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>{t.oldValue}</div>
                    <div style={styles.oldValue}>
                      {selectedLog.old_value !== undefined && selectedLog.old_value !== null 
                        ? `$${selectedLog.old_value.toLocaleString()}`
                        : '-'}
                    </div>
                  </div>
                  <div style={styles.arrow}>→</div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>{t.newValue}</div>
                    <div style={styles.newValue}>
                      {selectedLog.new_value !== undefined && selectedLog.new_value !== null 
                        ? `$${selectedLog.new_value.toLocaleString()}`
                        : '-'}
                    </div>
                  </div>
                  {selectedLog.difference !== undefined && selectedLog.difference !== 0 && (
                    <div style={{ 
                      marginLeft: 'auto', 
                      padding: '4px 12px', 
                      borderRadius: '4px',
                      background: selectedLog.difference > 0 ? 'rgba(72, 187, 120, 0.2)' : 'rgba(252, 129, 129, 0.2)',
                      color: selectedLog.difference > 0 ? '#48bb78' : '#fc8181',
                      fontWeight: 600
                    }}>
                      {selectedLog.difference > 0 ? '+' : ''}{selectedLog.difference.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reason */}
            {selectedLog.reason && (
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.reason}</div>
                <div style={styles.detailValue}>{selectedLog.reason}</div>
              </div>
            )}

            {/* Notes */}
            {selectedLog.notes && (
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.notes}</div>
                <div style={styles.detailValue}>{selectedLog.notes}</div>
              </div>
            )}

            {/* Technical Details */}
            <div style={{ marginTop: '12px', padding: '12px', background: isDark ? '#141e2d' : '#f7fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568', textTransform: 'uppercase' }}>
                {t.technicalDetails}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>IP: </span>
                  <span style={{ fontSize: '0.85rem' }}>{selectedLog.ip_address || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>Session: </span>
                  <span style={{ fontSize: '0.85rem' }}>{selectedLog.session_id || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  auditTrail: 'Financial Audit Trail',
  auditDesc: 'Complete traceability of all financial changes - who changed what, when, and why',
  search: 'Search',
  searchPlaceholder: 'Search by user, asset, reason...',
  allActions: 'All Actions',
  allModules: 'All Modules',
  allUsers: 'All Users',
  clearFilters: 'Clear Filters',
  loading: 'Loading audit logs...',
  noLogs: 'No audit logs found',
  exportExcel: 'Export to Excel',
  exportPDF: 'Export to PDF',
  fetchError: 'Failed to load audit logs',
  exportSuccess: 'Exported successfully',
  auditId: 'Audit ID',
  user: 'User',
  action: 'Action',
  module: 'Module',
  asset: 'Asset',
  oldValue: 'Old Value',
  newValue: 'New Value',
  status: 'Status',
  timestamp: 'Timestamp',
  dateFrom: 'Date From',
  dateTo: 'Date To',
  showing: 'Showing',
  of: 'of',
  auditDetail: 'Audit Detail',
  reason: 'Reason',
  notes: 'Notes',
  valueChange: 'Value Change',
  technicalDetails: 'Technical Details',
  assetId: 'Asset ID'
};

const amharicTranslations = {
  auditTrail: 'የፋይናንስ ኦዲት መንገድ',
  auditDesc: 'ሁሉንም የፋይናንስ ለውጦች ሙሉ በሙሉ መከታተል - ማን ፣ ምን ፣ መቼ እና ለምን እንደቀየረ',
  search: 'ፈልግ',
  searchPlaceholder: 'በተጠቃሚ፣ በንብረት፣ በምክንያት ይፈልጉ...',
  allActions: 'ሁሉም ተግባራት',
  allModules: 'ሁሉም ሞጁሎች',
  allUsers: 'ሁሉም ተጠቃሚዎች',
  clearFilters: 'ማጣሪያ አጽዳ',
  loading: 'የኦዲት መዝገቦች በመጫን ላይ...',
  noLogs: 'ምንም የኦዲት መዝገቦች አልተገኙም',
  exportExcel: 'ወደ Excel ላክ',
  exportPDF: 'ወደ PDF ላክ',
  fetchError: 'የኦዲት መዝገቦች ማግኘት አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  auditId: 'የኦዲት መለያ',
  user: 'ተጠቃሚ',
  action: 'ተግባር',
  module: 'ሞጁል',
  asset: 'ንብረት',
  oldValue: 'የቀድሞ ዋጋ',
  newValue: 'አዲስ ዋጋ',
  status: 'ሁኔታ',
  timestamp: 'ሰዓት',
  dateFrom: 'ከቀን',
  dateTo: 'እስከ ቀን',
  showing: 'በማሳየት ላይ',
  of: 'ከ',
  auditDetail: 'የኦዲት ዝርዝር',
  reason: 'ምክንያት',
  notes: 'ማስታወሻ',
  valueChange: 'የዋጋ ለውጥ',
  technicalDetails: 'ቴክኒካል ዝርዝሮች',
  assetId: 'የንብረት መለያ'
};

export default FinanceAudit;