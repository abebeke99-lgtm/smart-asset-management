import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const DeptAssets = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const location = useLocation();
  
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMaintenance, setFilterMaintenance] = useState('');
  
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionData, setActionData] = useState({});
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Parse URL params for status filter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [location.search]);

  useEffect(() => {
    fetchAssets();
  }, [search, filterStatus, filterCategory, filterCondition, filterLocation, filterEmployee, filterMaintenance]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = {
        department: user?.department,
        limit: 500,
        search: search || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        condition: filterCondition || undefined,
        location: filterLocation || undefined,
        assigned_to: filterEmployee || undefined,
        maintenance_status: filterMaintenance || undefined
      };
      const response = await axios.get('/api/assets', { params });
      setAssets(response.data.assets || response.data.data || []);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load assets');
      setAssets([]);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      'In-Use': '#48bb78',
      'Available': '#4299e1',
      'Under-Maintenance': '#ed8936',
      'In-Repair': '#fc8181',
      'Disposed': '#a0aec0',
      'Lost': '#fc8181',
      'Reserved': '#805ad5'
    };
    return colors[status] || '#a0aec0';
  };

  const getConditionColor = (condition) => {
    const colors = {
      'Good': '#48bb78',
      'Fair': '#f6ad55',
      'Poor': '#ed8936',
      'Damaged': '#fc8181'
    };
    return colors[condition] || '#a0aec0';
  };

  const getMaintenanceStatusColor = (status) => {
    const colors = {
      'None': '#a0aec0',
      'Pending': '#ed8936',
      'In-Progress': '#4299e1',
      'Completed': '#48bb78'
    };
    return colors[status] || '#a0aec0';
  };

  const handleAssetClick = async (asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
    
    // Fetch assignment history
    try {
      const response = await axios.get(`/api/assignments/history/${asset.id}`);
      setAssignmentHistory(response.data.history || []);
    } catch (error) {
      setAssignmentHistory([]);
    }
    
    // Fetch maintenance history
    try {
      const response = await axios.get('/api/maintenance', { params: { asset_id: asset.id } });
      setMaintenanceHistory(response.data.history || response.data.requests || response.data.data || []);
    } catch (error) {
      setMaintenanceHistory([]);
    }
  };

  const handleAction = (type, asset) => {
    setSelectedAsset(asset);
    setActionType(type);
    setActionData({});
    setShowActionModal(true);
  };

  const submitAction = async () => {
    try {
      if (actionType === 'request_maintenance') {
        if (!actionData.description?.trim()) {
          toast.error('Please describe the maintenance problem.');
          return;
        }
        await axios.post('/api/maintenance', { asset_id: selectedAsset.id, title: actionData.type || 'Maintenance request', description: actionData.description.trim(), priority: actionData.priority || 'medium' });
      } else if (actionType === 'report_damaged') {
        await axios.post('/api/approvals', {
          asset_id: selectedAsset.id,
          type: 'Asset Damage Report',
          item: selectedAsset.name,
          quantity: 1,
          priority: actionData.severity === 'Critical' ? 'critical' : 'high',
          reason: `${actionData.severity || 'Damaged asset'}: ${actionData.description || 'Damage reported by department'}`
        });
      } else {
        await axios.post('/api/approvals', { asset_id: selectedAsset.id, type: actionType === 'request_transfer' ? 'Asset Transfer' : 'Asset Request', item: selectedAsset.name, quantity: 1, reason: actionData.reason || actionData.target || 'Department asset request' });
      }
      toast.success(t.actionSuccess || 'Action completed successfully');
      setShowActionModal(false);
      fetchAssets();
    } catch (error) {
      toast.error(t.actionError || 'Failed to perform action');
    }
  };

  const exportToExcel = () => {
    const data = assets.map(a => ({
      'Asset Tag': a.asset_tag,
      'Name': a.name,
      'Category': a.category_name || '',
      'Serial Number': a.serial_number || '',
      'Status': a.status || '',
      'Condition': a.condition || '',
      'Location': a.location || '',
      'Assigned To': a.assigned_to_name || '',
      'Assignment Date': a.assignment_date ? new Date(a.assignment_date).toLocaleDateString() : '',
      'Maintenance Status': a.maintenance_status || 'None',
      'Last Maintenance': a.last_maintenance_date ? new Date(a.last_maintenance_date).toLocaleDateString() : '',
      'Value': a.current_value || 0,
      'Is Damaged': a.is_damaged ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Department Assets');
    XLSX.writeFile(wb, 'department_assets.xlsx');
    toast.success(t.exportSuccess || 'Exported successfully');
  };

  // Get unique values for filters
  const uniqueCategories = useMemo(() => [...new Set(assets.map(a => a.category_name).filter(Boolean))], [assets]);
  const uniqueLocations = useMemo(() => [...new Set(assets.map(a => a.location).filter(Boolean))], [assets]);
  const uniqueEmployees = useMemo(() => [...new Set(assets.map(a => a.assigned_to_name).filter(Boolean))], [assets]);

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
    conditionBadge: (condition) => ({
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: getConditionColor(condition) + '22',
      color: getConditionColor(condition)
    }),
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    assetTag: {
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
      maxWidth: '900px',
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
    actionButtons: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginBottom: '16px'
    },
    actionButton: (color) => ({
      padding: '6px 14px',
      borderRadius: '6px',
      border: 'none',
      background: color || 'linear-gradient(135deg, #4299e1, #3182ce)',
      color: 'white',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: 500
    }),
    historyList: {
      maxHeight: '200px',
      overflow: 'auto'
    },
    historyItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      fontSize: '0.85rem'
    },
    // Action modal
    actionModalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '28px',
      maxWidth: '500px',
      width: '100%',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
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
      justifyContent: 'flex-end'
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
    buttonSuccess: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #48bb78, #38a169)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterCategory('');
    setFilterCondition('');
    setFilterLocation('');
    setFilterEmployee('');
    setFilterMaintenance('');
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
          <h1 style={styles.title}>📦 {t.assets}</h1>
          <p style={styles.subtitle}>
            {t.departmentAssets} <strong>{user?.department || 'Department'}</strong>
            <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568' }}>
              {assets.length} {t.totalAssets}
            </span>
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
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
        <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">{t.allStatus}</option>
          <option value="In-Use">{t.inUse}</option>
          <option value="Available">{t.available}</option>
          <option value="Under-Maintenance">{t.underMaintenance}</option>
          <option value="In-Repair">{t.inRepair}</option>
          <option value="Disposed">{t.disposed}</option>
        </select>
        <select style={styles.select} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">{t.allCategories}</option>
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select style={styles.select} value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
          <option value="">{t.allConditions}</option>
          <option value="Good">{t.good}</option>
          <option value="Fair">{t.fair}</option>
          <option value="Poor">{t.poor}</option>
          <option value="Damaged">{t.damaged}</option>
        </select>
        <select style={styles.select} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">{t.allLocations}</option>
          {uniqueLocations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <select style={styles.select} value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
          <option value="">{t.allEmployees}</option>
          {uniqueEmployees.map(emp => (
            <option key={emp} value={emp}>{emp}</option>
          ))}
        </select>
        <button style={styles.clearButton} onClick={clearFilters}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Assets Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.assetTag}</th>
              <th style={styles.th}>{t.name}</th>
              <th style={styles.th}>{t.category}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.condition}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.assignedTo}</th>
              <th style={styles.th}>{t.maintenance}</th>
              <th style={styles.th}>{t.value}</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                  {t.noAssets}
                </td>
              </tr>
            ) : (
              assets.map(asset => (
                <tr
                  key={asset.id}
                  style={styles.clickableRow}
                  onClick={() => handleAssetClick(asset)}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={styles.td}>
                    <span style={styles.assetTag}>{asset.asset_tag}</span>
                  </td>
                  <td style={styles.td}>{asset.name}</td>
                  <td style={styles.td}>{asset.category_name || '-'}</td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge(asset.status)}>
                      {asset.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.conditionBadge(asset.condition)}>
                      {asset.condition || 'Unknown'}
                    </span>
                  </td>
                  <td style={styles.td}>{asset.location || '-'}</td>
                  <td style={styles.td}>
                    {asset.assigned_to_name ? (
                      <div>
                        <div>{asset.assigned_to_name}</div>
                        {asset.assignment_date && (
                          <div style={{ fontSize: '0.7rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                            {new Date(asset.assignment_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td style={styles.td}>
                    {asset.maintenance_status && asset.maintenance_status !== 'None' ? (
                      <span style={{
                        ...styles.statusBadge(asset.maintenance_status),
                        background: getMaintenanceStatusColor(asset.maintenance_status) + '22',
                        color: getMaintenanceStatusColor(asset.maintenance_status)
                      }}>
                        {asset.maintenance_status}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={styles.td}>${(asset.current_value || 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Asset Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {selectedAsset.asset_tag} - {selectedAsset.name}
                </h2>
                <div style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.9rem', marginTop: '4px' }}>
                  {selectedAsset.category_name} • {selectedAsset.department_name}
                </div>
              </div>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            {/* Asset Details */}
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={styles.detailValue}>
                  <span style={styles.statusBadge(selectedAsset.status)}>
                    {selectedAsset.status}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.condition}</div>
                <div style={styles.detailValue}>
                  <span style={styles.conditionBadge(selectedAsset.condition)}>
                    {selectedAsset.condition || 'Unknown'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.location}</div>
                <div style={styles.detailValue}>{selectedAsset.location || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.serialNumber}</div>
                <div style={styles.detailValue}>{selectedAsset.serial_number || '-'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assignedTo}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.assigned_to_name || 'Not assigned'}
                  {selectedAsset.assignment_date && (
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                      Since {new Date(selectedAsset.assignment_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.value}</div>
                <div style={styles.detailValue}>${(selectedAsset.current_value || 0).toLocaleString()}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.lastMaintenance}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.last_maintenance_date 
                    ? new Date(selectedAsset.last_maintenance_date).toLocaleDateString()
                    : 'Never'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.maintenanceStatus}</div>
                <div style={styles.detailValue}>
                  <span style={{
                    ...styles.statusBadge(selectedAsset.maintenance_status || 'None'),
                    background: getMaintenanceStatusColor(selectedAsset.maintenance_status || 'None') + '22',
                    color: getMaintenanceStatusColor(selectedAsset.maintenance_status || 'None')
                  }}>
                    {selectedAsset.maintenance_status || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={styles.actionButtons}>
              <button 
                style={styles.actionButton('#48bb78')}
                onClick={() => handleAction('request_transfer', selectedAsset)}
              >
                📤 {t.requestTransfer}
              </button>
              <button 
                style={styles.actionButton('#ed8936')}
                onClick={() => handleAction('request_maintenance', selectedAsset)}
              >
                🔧 {t.requestMaintenance}
              </button>
              <button 
                style={styles.actionButton('#fc8181')}
                onClick={() => handleAction('report_damaged', selectedAsset)}
              >
                ⚠️ {t.reportDamaged}
              </button>
              <button 
                style={styles.actionButton('#805ad5')}
                onClick={() => handleAction('request_asset', selectedAsset)}
              >
                📋 {t.requestAsset}
              </button>
            </div>

            {/* Assignment History */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '8px' }}>
                {t.assignmentHistory}
              </h4>
              <div style={styles.historyList}>
                {assignmentHistory.length === 0 ? (
                  <div style={{ color: isDark ? '#8896b0' : '#4a5568', padding: '8px 0' }}>
                    {t.noHistory}
                  </div>
                ) : (
                  assignmentHistory.map((item, index) => (
                    <div key={index} style={styles.historyItem}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{item.employee || item.user || 'Unknown'}</span>
                        <span style={{ color: isDark ? '#8896b0' : '#4a5568', marginLeft: '8px' }}>
                          {item.action || 'Updated'}
                        </span>
                      </div>
                      <div style={{ color: isDark ? '#8896b0' : '#4a5568' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Maintenance History */}
            <div>
              <h4 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '8px' }}>
                {t.maintenanceHistory}
              </h4>
              <div style={styles.historyList}>
                {maintenanceHistory.length === 0 ? (
                  <div style={{ color: isDark ? '#8896b0' : '#4a5568', padding: '8px 0' }}>
                    {t.noMaintenanceHistory}
                  </div>
                ) : (
                  maintenanceHistory.map((item, index) => (
                    <div key={index} style={styles.historyItem}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{item.type || 'Maintenance'}</span>
                        <span style={{ 
                          ...styles.statusBadge(item.status),
                          background: getMaintenanceStatusColor(item.status) + '22',
                          color: getMaintenanceStatusColor(item.status),
                          marginLeft: '8px'
                        }}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ color: isDark ? '#8896b0' : '#4a5568' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowActionModal(false)}>
          <div style={styles.actionModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {actionType === 'request_transfer' && '📤 ' + t.requestTransfer}
                {actionType === 'request_maintenance' && '🔧 ' + t.requestMaintenance}
                {actionType === 'report_damaged' && '⚠️ ' + t.reportDamaged}
                {actionType === 'request_asset' && '📋 ' + t.requestAsset}
              </h2>
              <button style={styles.modalClose} onClick={() => setShowActionModal(false)}>✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: isDark ? '#8896b0' : '#4a5568' }}>
                {t.asset}: <strong>{selectedAsset.asset_tag} - {selectedAsset.name}</strong>
              </div>
            </div>

            {actionType === 'request_transfer' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t.transferTo}</label>
                <input
                  type="text"
                  style={styles.formInput}
                  placeholder={t.enterEmployeeName}
                  value={actionData.target || ''}
                  onChange={(e) => setActionData({ ...actionData, target: e.target.value })}
                />
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.reason}</label>
                  <textarea
                    style={styles.formTextarea}
                    placeholder={t.transferReasonPlaceholder}
                    value={actionData.reason || ''}
                    onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                  />
                </div>
              </div>
            )}

            {actionType === 'request_maintenance' && (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.maintenanceType}</label>
                  <select
                    style={styles.formInput}
                    value={actionData.type || ''}
                    onChange={(e) => setActionData({ ...actionData, type: e.target.value })}
                  >
                    <option value="">{t.selectType}</option>
                    <option value="Routine">{t.routine}</option>
                    <option value="Repair">{t.repair}</option>
                    <option value="Emergency">{t.emergency}</option>
                    <option value="Preventive">{t.preventive}</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.description}</label>
                  <textarea
                    style={styles.formTextarea}
                    placeholder={t.maintenanceDescriptionPlaceholder}
                    value={actionData.description || ''}
                    onChange={(e) => setActionData({ ...actionData, description: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Priority</label>
                  <select
                    style={styles.formInput}
                    value={actionData.priority || 'medium'}
                    onChange={(e) => setActionData({ ...actionData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
            )}

            {actionType === 'report_damaged' && (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.damageSeverity}</label>
                  <select
                    style={styles.formInput}
                    value={actionData.severity || ''}
                    onChange={(e) => setActionData({ ...actionData, severity: e.target.value })}
                  >
                    <option value="">{t.selectSeverity}</option>
                    <option value="Minor">{t.minor}</option>
                    <option value="Moderate">{t.moderate}</option>
                    <option value="Major">{t.major}</option>
                    <option value="Critical">{t.critical}</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.damageDescription}</label>
                  <textarea
                    style={styles.formTextarea}
                    placeholder={t.damageDescriptionPlaceholder}
                    value={actionData.description || ''}
                    onChange={(e) => setActionData({ ...actionData, description: e.target.value })}
                  />
                </div>
              </div>
            )}

            {actionType === 'request_asset' && (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.requestReason}</label>
                  <textarea
                    style={styles.formTextarea}
                    placeholder={t.requestReasonPlaceholder}
                    value={actionData.reason || ''}
                    onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.requiredBy}</label>
                  <input
                    type="date"
                    style={styles.formInput}
                    value={actionData.requiredBy || ''}
                    onChange={(e) => setActionData({ ...actionData, requiredBy: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div style={styles.modalActions}>
              <button style={styles.buttonSecondary} onClick={() => setShowActionModal(false)}>
                {t.cancel}
              </button>
              <button style={styles.buttonPrimary} onClick={submitAction}>
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  assets: 'Department Assets',
  departmentAssets: 'Assets for',
  searchPlaceholder: 'Search by name or tag...',
  allStatus: 'All Status',
  inUse: 'In-Use',
  available: 'Available',
  underMaintenance: 'Under Maintenance',
  inRepair: 'In Repair',
  disposed: 'Disposed',
  allCategories: 'All Categories',
  allConditions: 'All Conditions',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  allLocations: 'All Locations',
  allEmployees: 'All Employees',
  clearFilters: 'Clear Filters',
  search: 'Search',
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  status: 'Status',
  condition: 'Condition',
  location: 'Location',
  assignedTo: 'Assigned To',
  value: 'Value',
  maintenance: 'Maintenance',
  loading: 'Loading...',
  noAssets: 'No assets found in this department',
  exportExcel: 'Export to Excel',
  fetchError: 'Failed to load assets',
  exportSuccess: 'Exported successfully',
  totalAssets: 'Total Assets',
  serialNumber: 'Serial Number',
  lastMaintenance: 'Last Maintenance',
  maintenanceStatus: 'Maintenance Status',
  assignmentHistory: 'Assignment History',
  maintenanceHistory: 'Maintenance History',
  noHistory: 'No assignment history',
  noMaintenanceHistory: 'No maintenance history',
  
  // Actions
  requestTransfer: 'Request Transfer',
  requestMaintenance: 'Request Maintenance',
  reportDamaged: 'Report Damaged',
  requestAsset: 'Request Asset',
  transferTo: 'Transfer To',
  reason: 'Reason',
  transferReasonPlaceholder: 'Enter reason for transfer...',
  maintenanceType: 'Maintenance Type',
  selectType: 'Select Type',
  routine: 'Routine',
  repair: 'Repair',
  emergency: 'Emergency',
  preventive: 'Preventive',
  description: 'Description',
  maintenanceDescriptionPlaceholder: 'Describe the maintenance required...',
  damageSeverity: 'Damage Severity',
  selectSeverity: 'Select Severity',
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  critical: 'Critical',
  damageDescription: 'Damage Description',
  damageDescriptionPlaceholder: 'Describe the damage...',
  requestReason: 'Request Reason',
  requestReasonPlaceholder: 'Why do you need this asset?',
  requiredBy: 'Required By',
  cancel: 'Cancel',
  submit: 'Submit',
  actionSuccess: 'Action completed successfully',
  actionError: 'Failed to perform action',
  enterEmployeeName: 'Enter employee name...'
};

const amharicTranslations = {
  assets: 'የክፍል ንብረቶች',
  departmentAssets: 'ንብረቶች ለ',
  searchPlaceholder: 'በስም ወይም በመለያ ይፈልጉ...',
  allStatus: 'ሁሉም ሁኔታዎች',
  inUse: 'በመጠቀም ላይ',
  available: 'ይገኛል',
  underMaintenance: 'በጥገና ላይ',
  inRepair: 'በመጠገን ላይ',
  disposed: 'የተወገዱ',
  allCategories: 'ሁሉም ምድቦች',
  allConditions: 'ሁሉም ሁኔታዎች',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  damaged: 'የተጎዳ',
  allLocations: 'ሁሉም አካባቢዎች',
  allEmployees: 'ሁሉም ሰራተኞች',
  clearFilters: 'ማጣሪያ አጽዳ',
  search: 'ፈልግ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  status: 'ሁኔታ',
  condition: 'ሁኔታ',
  location: 'አካባቢ',
  assignedTo: 'ተመድቧል',
  value: 'ዋጋ',
  maintenance: 'ጥገና',
  loading: 'በመጫን ላይ...',
  noAssets: 'በዚህ ክፍል ውስጥ ምንም ንብረቶች አልተገኙም',
  exportExcel: 'ወደ Excel ላክ',
  fetchError: 'ንብረቶች መጫን አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  serialNumber: 'ተከታታይ ቁጥር',
  lastMaintenance: 'የመጨረሻ ጥገና',
  maintenanceStatus: 'የጥገና ሁኔታ',
  assignmentHistory: 'የምደባ ታሪክ',
  maintenanceHistory: 'የጥገና ታሪክ',
  noHistory: 'ምንም የምደባ ታሪክ የለም',
  noMaintenanceHistory: 'ምንም የጥገና ታሪክ የለም',
  
  // Actions
  requestTransfer: 'ዝውውር ጠይቅ',
  requestMaintenance: 'ጥገና ጠይቅ',
  reportDamaged: 'ብልሽት ዘግብ',
  requestAsset: 'ንብረት ጠይቅ',
  transferTo: 'ወደ ያስተላልፉ',
  reason: 'ምክንያት',
  transferReasonPlaceholder: 'ለዝውውር ምክንያት ያስገቡ...',
  maintenanceType: 'የጥገና አይነት',
  selectType: 'አይነት ይምረጡ',
  routine: 'መደበኛ',
  repair: 'ጥገና',
  emergency: 'አስቸኳይ',
  preventive: 'መከላከያ',
  description: 'መግለጫ',
  maintenanceDescriptionPlaceholder: 'የሚፈለገውን ጥገና ይግለጹ...',
  damageSeverity: 'የብልሽት ክብደት',
  selectSeverity: 'ክብደት ይምረጡ',
  minor: 'ቀላል',
  moderate: 'መካከለኛ',
  major: 'ከባድ',
  critical: 'አስቸኳይ',
  damageDescription: 'የብልሽት መግለጫ',
  damageDescriptionPlaceholder: 'ብልሽቱን ይግለጹ...',
  requestReason: 'የጥያቄ ምክንያት',
  requestReasonPlaceholder: 'ለምን ይህን ንብረት ይፈልጋሉ?',
  requiredBy: 'በሚያስፈልግበት ቀን',
  cancel: 'ይቅር',
  submit: 'አስገባ',
  actionSuccess: 'ተግባር በተሳካ ሁኔታ ተጠናቋል',
  actionError: 'ተግባሩን ማከናወን አልተቻለም',
  enterEmployeeName: 'የሰራተኛ ስም ያስገቡ...'
};

export default DeptAssets;