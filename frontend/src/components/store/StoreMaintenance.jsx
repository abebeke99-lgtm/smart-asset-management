import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

const StoreMaintenance = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // State
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [sendForm, setSendForm] = useState({
    assetId: '',
    problem: '',
    maintenanceProvider: '',
    expectedReturnDate: '',
    notes: ''
  });

  const [assets, setAssets] = useState([]);
  const [providers, setProviders] = useState([
    { id: 1, name: 'Internal Maintenance Team' },
    { id: 2, name: 'External Service Provider' },
    { id: 3, name: 'Manufacturer Support' },
    { id: 4, name: 'Specialized Technician' }
  ]);

  // Fetch data
  useEffect(() => {
    fetchMaintenanceRequests();
    fetchAssets();
  }, [filterStatus]);

  const fetchMaintenanceRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/maintenance', { params: { limit: 500 } });
      const data = response.data.maintenance || response.data.data || [];
      setMaintenanceRequests(data);
    } catch (error) {
      toast.error(t.fetchError);
      setMaintenanceRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await axios.get('/api/assets');
      setAssets(response.data.assets || response.data.data || []);
    } catch (error) {
      setAssets([]);
    }
  };

  // Filter and search
  useEffect(() => {
    let filtered = maintenanceRequests;

    if (activeTab === 'pending') {
      filtered = filtered.filter(req => ['pending', 'requested', 'awaiting approval'].includes(String(req.status || '').toLowerCase()));
    } else if (activeTab === 'under-maintenance') {
      filtered = filtered.filter(req => String(req.status || '').toLowerCase() === 'under maintenance');
    } else if (activeTab === 'returned') {
      filtered = filtered.filter(req => ['completed', 'returned', 'finished'].includes(String(req.status || '').toLowerCase()));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req =>
        (req.assetCode || '').toLowerCase().includes(query) ||
        (req.assetName || req.asset_name || '').toLowerCase().includes(query) ||
        (req.problem || '').toLowerCase().includes(query) ||
        (req.maintenanceProvider || req.provider || '').toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  }, [maintenanceRequests, activeTab, searchQuery]);

  // Handle send for maintenance
  const handleSendForMaintenance = async (e) => {
    e.preventDefault();

    if (!sendForm.assetId || !sendForm.problem || !sendForm.maintenanceProvider) {
      toast.error(t.fillAllFields || 'Please fill all required fields');
      return;
    }

    setIsProcessing(true);
    try {
      await axios.post('/api/maintenance', {
        asset_id: sendForm.assetId,
        problem: sendForm.problem,
        maintenance_provider: sendForm.maintenanceProvider,
        expected_return_date: sendForm.expectedReturnDate,
        notes: sendForm.notes,
        requested_by: user?.id
      });

      toast.success(t.sendSuccess || 'Asset sent for maintenance successfully');
      setSendForm({
        assetId: '',
        problem: '',
        maintenanceProvider: '',
        expectedReturnDate: '',
        notes: ''
      });
      setShowSendModal(false);
      await fetchMaintenanceRequests();
    } catch (error) {
      toast.error(t.sendError || error.response?.data?.message || 'Failed to send asset for maintenance');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle update maintenance status
  const handleUpdateStatus = async (requestId, newStatus) => {
    try {
      await axios.patch(`/api/maintenance/${requestId}`, {
        status: newStatus,
        updated_by: user?.id
      });

      toast.success(t.statusUpdateSuccess || 'Status updated successfully');
      await fetchMaintenanceRequests();
      setShowDetailModal(false);
    } catch (error) {
      toast.error(t.statusUpdateError || 'Failed to update status');
    }
  };

  // Export to Excel
  const handleExport = () => {
    try {
      const exportData = filteredRequests.map(req => ({
        'Asset Tag': req.assetCode || req.asset_tag || '',
        'Asset Name': req.assetName || req.asset_name || '',
        'Problem': req.problem || '',
        'Provider': req.maintenanceProvider || req.provider || '',
        'Status': req.status || 'N/A',
        'Requested Date': req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '',
        'Expected Return': req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString() : '',
        'Notes': req.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance');
      XLSX.writeFile(wb, `store_maintenance_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(t.exportSuccess || 'Exported successfully');
    } catch (error) {
      toast.error(t.exportError || 'Export failed');
    }
  };

  const styles = {
    container: {
      padding: isDark ? '20px' : '24px',
      background: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: '12px',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)'
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e2e8f0'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      color: isDark ? '#fff' : '#1a365d',
      margin: '0 0 8px 0'
    },
    subtitle: {
      fontSize: '14px',
      color: isDark ? '#aaa' : '#5a6b8a',
      margin: 0
    },
    tabs: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e2e8f0',
      flexWrap: 'wrap'
    },
    tab: (active) => ({
      padding: '12px 16px',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? '3px solid #2b6cb0' : '3px solid transparent',
      color: active ? '#2b6cb0' : isDark ? '#aaa' : '#5a6b8a',
      cursor: 'pointer',
      fontWeight: active ? '600' : '500',
      fontSize: '14px'
    }),
    controls: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchInput: {
      flex: 1,
      minWidth: '250px',
      padding: '10px 12px',
      border: isDark ? '1px solid #444' : '1px solid #cbd5e1',
      borderRadius: '8px',
      background: isDark ? '#2a2a3e' : '#fff',
      color: isDark ? '#fff' : '#000',
      fontSize: '14px'
    },
    button: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px',
      transition: 'all 0.2s'
    },
    primaryButton: {
      background: '#2b6cb0',
      color: '#fff'
    },
    secondaryButton: {
      background: isDark ? '#444' : '#e2e8f0',
      color: isDark ? '#fff' : '#1a365d'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '16px'
    },
    th: {
      padding: '12px',
      textAlign: 'left',
      background: isDark ? '#2a2a3e' : '#f7fafc',
      color: isDark ? '#fff' : '#1a365d',
      fontWeight: '600',
      fontSize: '13px',
      borderBottom: isDark ? '1px solid #444' : '1px solid #e2e8f0'
    },
    td: {
      padding: '12px',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e2e8f0',
      color: isDark ? '#ddd' : '#2d3748',
      fontSize: '14px'
    },
    statusBadge: (status) => {
      const statusLower = String(status || '').toLowerCase();
      const colors = {
        'pending': { bg: '#fef3c7', color: '#92400e' },
        'requested': { bg: '#fef3c7', color: '#92400e' },
        'awaiting approval': { bg: '#fef3c7', color: '#92400e' },
        'under maintenance': { bg: '#dbeafe', color: '#0c4a6e' },
        'completed': { bg: '#dcfce7', color: '#166534' },
        'returned': { bg: '#dcfce7', color: '#166534' },
        'finished': { bg: '#dcfce7', color: '#166534' }
      };
      const style = colors[statusLower] || colors['pending'];
      return {
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: '12px',
        background: style.bg,
        color: style.color,
        fontWeight: '600',
        fontSize: '12px'
      };
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: isDark ? '#2a2a3e' : '#fff',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '90vh',
      overflow: 'auto'
    },
    modalHeader: {
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '16px',
      color: isDark ? '#fff' : '#1a365d'
    },
    formGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontWeight: '600',
      color: isDark ? '#ddd' : '#2d3748',
      fontSize: '14px'
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      border: isDark ? '1px solid #444' : '1px solid #cbd5e1',
      borderRadius: '8px',
      background: isDark ? '#1a1a2e' : '#fff',
      color: isDark ? '#fff' : '#000',
      fontSize: '14px',
      fontFamily: 'inherit'
    },
    textarea: {
      width: '100%',
      padding: '10px 12px',
      border: isDark ? '1px solid #444' : '1px solid #cbd5e1',
      borderRadius: '8px',
      background: isDark ? '#1a1a2e' : '#fff',
      color: isDark ? '#fff' : '#000',
      fontSize: '14px',
      fontFamily: 'inherit',
      resize: 'vertical',
      minHeight: '100px'
    },
    select: {
      width: '100%',
      padding: '10px 12px',
      border: isDark ? '1px solid #444' : '1px solid #cbd5e1',
      borderRadius: '8px',
      background: isDark ? '#1a1a2e' : '#fff',
      color: isDark ? '#fff' : '#000',
      fontSize: '14px',
      fontFamily: 'inherit'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: isDark ? '#aaa' : '#4a5568'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🔧 {t.maintenance}</h1>
        <p style={styles.subtitle}>{t.maintenanceDesc || 'Manage asset maintenance requests and tracking'}</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={styles.tab(activeTab === 'pending')}
          onClick={() => setActiveTab('pending')}
        >
          📋 {t.pendingMaintenance || 'Pending'}
        </button>
        <button
          style={styles.tab(activeTab === 'under-maintenance')}
          onClick={() => setActiveTab('under-maintenance')}
        >
          🔧 {t.underMaintenance || 'Under Maintenance'}
        </button>
        <button
          style={styles.tab(activeTab === 'returned')}
          onClick={() => setActiveTab('returned')}
        >
          ✅ {t.returnedMaintenance || 'Returned'}
        </button>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder={t.search || 'Search by asset, problem, or provider...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={() => setShowSendModal(true)}
        >
          ➕ {t.sendMaintenance || 'Send for Maintenance'}
        </button>
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={handleExport}
        >
          📥 {t.export || 'Export'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={styles.emptyState}>
          {t.loading || 'Loading...'}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRequests.length === 0 && (
        <div style={styles.emptyState}>
          {t.noRequests || 'No maintenance requests found'}
        </div>
      )}

      {/* Table */}
      {!loading && filteredRequests.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.assetTag || 'Asset Tag'}</th>
              <th style={styles.th}>{t.assetName || 'Asset Name'}</th>
              <th style={styles.th}>{t.problem || 'Problem'}</th>
              <th style={styles.th}>{t.provider || 'Provider'}</th>
              <th style={styles.th}>{t.status || 'Status'}</th>
              <th style={styles.th}>{t.expectedReturn || 'Expected Return'}</th>
              <th style={styles.th}>{t.actions || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req) => (
              <tr key={req.id}>
                <td style={styles.td}>{req.assetCode || req.asset_tag || 'N/A'}</td>
                <td style={styles.td}>{req.assetName || req.asset_name || 'N/A'}</td>
                <td style={styles.td}>{req.problem || 'N/A'}</td>
                <td style={styles.td}>{req.maintenanceProvider || req.provider || 'N/A'}</td>
                <td style={styles.td}>
                  <span style={styles.statusBadge(req.status)}>{req.status || 'Unknown'}</span>
                </td>
                <td style={styles.td}>
                  {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString() : 'N/A'}
                </td>
                <td style={styles.td}>
                  <button
                    style={{ ...styles.button, ...styles.secondaryButton, fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      setSelectedRequest(req);
                      setShowDetailModal(true);
                    }}
                  >
                    {t.view || 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Send for Maintenance Modal */}
      {showSendModal && (
        <div style={styles.modal} onClick={() => setShowSendModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>🔧 {t.sendMaintenance || 'Send for Maintenance'}</div>

            <form onSubmit={handleSendForMaintenance}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.asset || 'Asset'} *</label>
                <select
                  style={styles.select}
                  value={sendForm.assetId}
                  onChange={(e) => setSendForm({ ...sendForm, assetId: e.target.value })}
                  required
                >
                  <option value="">{t.selectAsset || 'Select Asset'}</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.assetCode || asset.asset_code || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.problem || 'Problem'} *</label>
                <textarea
                  style={styles.textarea}
                  value={sendForm.problem}
                  onChange={(e) => setSendForm({ ...sendForm, problem: e.target.value })}
                  placeholder={t.problemDescription || 'Describe the problem...'}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.maintenanceProvider || 'Maintenance Provider'} *</label>
                <select
                  style={styles.select}
                  value={sendForm.maintenanceProvider}
                  onChange={(e) => setSendForm({ ...sendForm, maintenanceProvider: e.target.value })}
                  required
                >
                  <option value="">{t.selectProvider || 'Select Provider'}</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.expectedReturnDate || 'Expected Return Date'}</label>
                <input
                  type="date"
                  style={styles.input}
                  value={sendForm.expectedReturnDate}
                  onChange={(e) => setSendForm({ ...sendForm, expectedReturnDate: e.target.value })}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.notes || 'Notes'}</label>
                <textarea
                  style={styles.textarea}
                  value={sendForm.notes}
                  onChange={(e) => setSendForm({ ...sendForm, notes: e.target.value })}
                  placeholder={t.notesPlaceholder || 'Optional notes...'}
                />
              </div>

              <div style={styles.buttonGroup}>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.secondaryButton }}
                  onClick={() => setShowSendModal(false)}
                  disabled={isProcessing}
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.primaryButton }}
                  disabled={isProcessing}
                >
                  {isProcessing ? t.sending || 'Sending...' : t.submit || 'Submit'}
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
            <div style={styles.modalHeader}>📋 {t.maintenanceDetails || 'Maintenance Details'}</div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.assetTag || 'Asset Tag'}:</strong> {selectedRequest.assetCode || 'N/A'}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.assetName || 'Asset Name'}:</strong> {selectedRequest.assetName || 'N/A'}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.problem || 'Problem'}:</strong> {selectedRequest.problem || 'N/A'}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.provider || 'Provider'}:</strong> {selectedRequest.maintenanceProvider || 'N/A'}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.status || 'Status'}:</strong> <span style={styles.statusBadge(selectedRequest.status)}>{selectedRequest.status || 'N/A'}</span>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.expectedReturn || 'Expected Return'}:</strong> {selectedRequest.expectedReturnDate ? new Date(selectedRequest.expectedReturnDate).toLocaleDateString() : 'N/A'}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{t.notes || 'Notes'}:</strong> {selectedRequest.notes || 'N/A'}
              </div>
            </div>

            <div style={styles.buttonGroup}>
              <button
                type="button"
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setShowDetailModal(false)}
              >
                {t.close || 'Close'}
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
  maintenance: 'Maintenance',
  maintenanceDesc: 'Manage asset maintenance requests and tracking',
  sendMaintenance: 'Send for Maintenance',
  search: 'Search by asset, problem, or provider...',
  pendingMaintenance: 'Pending',
  underMaintenance: 'Under Maintenance',
  returnedMaintenance: 'Returned',
  assetTag: 'Asset Tag',
  assetName: 'Asset Name',
  problem: 'Problem',
  provider: 'Maintenance Provider',
  status: 'Status',
  expectedReturn: 'Expected Return',
  actions: 'Actions',
  export: 'Export',
  view: 'View',
  loading: 'Loading...',
  noRequests: 'No maintenance requests found',
  selectAsset: 'Select Asset',
  problemDescription: 'Describe the problem...',
  selectProvider: 'Select Provider',
  expectedReturnDate: 'Expected Return Date',
  notes: 'Notes',
  notesPlaceholder: 'Optional notes...',
  cancel: 'Cancel',
  submit: 'Submit',
  sending: 'Sending...',
  maintenanceDetails: 'Maintenance Details',
  close: 'Close',
  fillAllFields: 'Please fill all required fields',
  sendSuccess: 'Asset sent for maintenance successfully',
  sendError: 'Failed to send asset for maintenance',
  statusUpdateSuccess: 'Status updated successfully',
  statusUpdateError: 'Failed to update status',
  exportSuccess: 'Exported successfully',
  exportError: 'Export failed',
  fetchError: 'Failed to load maintenance requests',
  asset: 'Asset'
};

const amharicTranslations = {
  maintenance: 'ጥገና',
  maintenanceDesc: 'የንብረት ጥገና ጥያቄዎችን እና ክትትልን ያስተዳድሩ',
  sendMaintenance: 'ለጥገና ይላኩ',
  search: 'በንብረት፣ ችግር ወይም አቅራቢ ይፈልጉ...',
  pendingMaintenance: 'በመጠባበቅ ላይ',
  underMaintenance: 'በጥገናው ላይ',
  returnedMaintenance: 'ተመልሷል',
  assetTag: 'የንብረት ትር',
  assetName: 'የንብረት ስም',
  problem: 'ችግር',
  provider: 'ጥገና አቅራቢ',
  status: 'ሁኔታ',
  expectedReturn: 'የሚጠበቀው መመለስ',
  actions: 'ተግባራት',
  export: 'ላክ',
  view: 'ተመልከት',
  loading: 'በመጫን ላይ...',
  noRequests: 'ምንም ጥገና ጥያቄዎች አልተገኙም',
  selectAsset: 'ንብረት ይምረጡ',
  problemDescription: 'ችግሩን ይግለጹ...',
  selectProvider: 'አቅራቢ ይምረጡ',
  expectedReturnDate: 'የሚጠበቀው መመለስ ቀን',
  notes: 'ማስታወሻዎች',
  notesPlaceholder: '선택 ማስታወሳ...',
  cancel: 'ይቅር',
  submit: 'አስገባ',
  sending: 'በመላክ ላይ...',
  maintenanceDetails: 'ጥገና ዝርዝሮች',
  close: 'ዝጋ',
  fillAllFields: 'እባክዎ ሁሉንም የግዴታ መስኮችን ይሙሉ',
  sendSuccess: 'ንብረት ለጥገና በተሳካ ሁኔታ ተላከ',
  sendError: 'ንብረት ለጥገና መላክ አልተቻለም',
  statusUpdateSuccess: 'ሁኔታ በተሳካ ሁኔታ ተዘመነ',
  statusUpdateError: 'ሁኔታ ማዘመን አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  exportError: 'ላክ አልተቻለም',
  fetchError: 'ጥገና ጥያቄዎችን መጫን አልተቻለም',
  asset: 'ንብረት'
};

export default StoreMaintenance;
