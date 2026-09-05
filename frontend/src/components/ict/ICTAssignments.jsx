import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ICTAssignments = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  
  // State
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [conditionAtAssignment, setConditionAtAssignment] = useState('Good');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAssetId, setHistoryAssetId] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ assetId: null, newUserId: '', newDepartment: '' });
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverData, setHandoverData] = useState(null);
  const [saving, setSaving] = useState(false);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, usersRes, departmentsRes, assignmentsRes, historyRes] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/users', { params: { limit: 1000 } }),
        axios.get('/api/departments'),
        axios.get('/api/assignments', { params: { limit: 500 } }),
        axios.get('/api/assignments/history', { params: { limit: 500 } })
      ]);
      
      setAssets(assetsRes.data.assets || []);
      setUsers(usersRes.data.users || []);
      setDepartments(departmentsRes.data.departments || []);
      setAssignments(assignmentsRes.data.assignments || []);
      setAssignmentHistory(historyRes.data.history || []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error(t.fetchError);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get available assets (not assigned or maintenance)
  const getAvailableAssets = () => {
    const assignedIds = assignments
      .filter(a => !a.returned_at)
      .map(a => a.asset_id);
    
    return assets.filter(a => 
      String(a.status || '').toLowerCase() === 'available' && 
      !assignedIds.includes(a.id)
    );
  };

  // Get active assignments
  const getActiveAssignments = () => {
    return assignments.filter(a => !a.returned_at);
  };

  // Get returned assignments
  const getReturnedAssignments = () => {
    return assignments.filter(a => a.returned_at);
  };

  // Handle assign asset
  const handleAssign = async (e) => {
    e.preventDefault();
    
    if (!selectedAsset || !selectedUser) {
      toast.error(t.selectBoth);
      return;
    }

    // Check if asset is already assigned
    const isAssigned = assignments.some(a => 
      a.asset_id === parseInt(selectedAsset) && 
      !a.returned_at
    );

    if (isAssigned) {
      toast.error(t.assetAlreadyAssigned);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        asset_id: selectedAsset,
        assigned_to: selectedUser,
        department_id: selectedDepartment || null,
        assigned_date: assignmentDate,
        expected_return_date: returnDate || null,
        condition_at_assignment: conditionAtAssignment,
        remarks: remarks,
        assigned_by: user?.id
      };

      const response = await axios.post('/api/assignments', payload);
      toast.success(response.data?.message || t.assetAssigned);
      
      // Reset form
      setSelectedAsset('');
      setSelectedUser('');
      setSelectedDepartment('');
      setReturnDate('');
      setRemarks('');
      setConditionAtAssignment('Good');
      
      fetchData();
    } catch (error) {
      toast.error(error.response?.status === 401 ? 'Your session has expired.' : error.response?.status === 403 ? 'You are not authorized to assign assets.' : error.response?.data?.message || error.message || t.assignError);
    } finally {
      setSaving(false);
    }
  };

  // Handle return asset
  const handleReturn = async (assignmentId, assetId) => {
    if (!window.confirm(t.confirmReturn)) return;
    
    try {
      await axios.post(`/api/assignments/${assignmentId}/return`, {
        condition_at_return: 'Good',
        returned_by: user?.id
      });
      
      toast.success(t.assetReturned);
      fetchData();
    } catch (error) {
      toast.error(t.returnError);
    }
  };

  // Handle transfer asset
  const handleTransfer = async (e) => {
    e.preventDefault();
    
    if (!transferData.assetId || !transferData.newUserId) {
      toast.error(t.selectBoth);
      return;
    }

    try {
      await axios.post(`/api/assignments/${transferData.assetId}/transfer`, {
        new_user_id: transferData.newUserId,
        new_department_id: transferData.newDepartment || null,
        transferred_by: user?.id
      });
      
      toast.success(t.assetTransferred);
      setShowTransferModal(false);
      setTransferData({ assetId: null, newUserId: '', newDepartment: '' });
      fetchData();
    } catch (error) {
      toast.error(t.transferError);
    }
  };

  // View assignment history
  const viewHistory = async (assetId) => {
    setHistoryAssetId(assetId);
    setShowHistoryModal(true);
    
    try {
      const response = await axios.get(`/api/assignments/history/${assetId}`);
      setAssignmentHistory(response.data.history || []);
    } catch (error) {
      toast.error(t.historyError);
    }
  };

  // Generate handover document
  const generateHandover = (assignment) => {
    setHandoverData(assignment);
    setShowHandoverModal(true);
  };

  // Print handover document
  const printHandover = () => {
    window.print();
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ICT Assignments Report', 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    
    const tableData = assignments.map(a => [
      a.asset_tag || a.id,
      a.asset_name || 'N/A',
      a.assigned_to_name || 'N/A',
      a.department_name || 'N/A',
      new Date(a.assigned_date).toLocaleDateString(),
      a.expected_return_date ? new Date(a.expected_return_date).toLocaleDateString() : 'N/A',
      a.returned_at ? 'Returned' : 'Active'
    ]);

    doc.autoTable({
      head: [['Asset ID', 'Asset', 'Assigned To', 'Department', 'Assigned Date', 'Expected Return', 'Status']],
      body: tableData,
      startY: 35
    });

    doc.save(`ICT_Assignments_${new Date().toISOString().split('T')[0]}.pdf`);
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
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
    card: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '24px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      marginBottom: '24px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      color: isDark ? '#c8dcf5' : '#2d3748',
      fontWeight: 600,
      fontSize: '0.85rem'
    },
    select: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      marginBottom: '4px',
      cursor: 'pointer'
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
    button: {
      padding: '12px 24px',
      background: 'linear-gradient(135deg, #1a365d, #2b6cb0)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    buttonSuccess: {
      padding: '6px 14px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.8rem',
      background: '#48bb78',
      color: 'white',
      marginRight: '4px'
    },
    buttonWarning: {
      padding: '6px 14px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.8rem',
      background: '#ed8936',
      color: 'white',
      marginRight: '4px'
    },
    buttonInfo: {
      padding: '6px 14px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.8rem',
      background: '#4299e1',
      color: 'white',
      marginRight: '4px'
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
    statusBadge: (isActive) => ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: isActive ? 'rgba(72, 187, 120, 0.15)' : 'rgba(237, 137, 54, 0.15)',
      color: isActive ? '#48bb78' : '#ed8936',
      border: `1px solid ${isActive ? 'rgba(72, 187, 120, 0.3)' : 'rgba(237, 137, 54, 0.3)'}`
    }),
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: isDark ? '#8896b0' : '#4a5568'
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
    // Print styles
    printHidden: {
      '@media print': { display: 'none' }
    },
    handoverDocument: {
      padding: '40px',
      maxWidth: '800px',
      margin: '0 auto'
    }
  };

  const availableAssets = getAvailableAssets();
  const activeAssignments = getActiveAssignments();
  const returnedAssignments = getReturnedAssignments();

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📋 {t.assignments}</h1>
          <p style={styles.subtitle}>{t.assignmentsDesc}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={styles.button} onClick={exportToPDF}>
            📊 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{activeAssignments.length}</div>
          <div style={styles.statLabel}>{t.activeAssignments}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{returnedAssignments.length}</div>
          <div style={styles.statLabel}>{t.returnedAssignments}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{availableAssets.length}</div>
          <div style={styles.statLabel}>{t.availableAssets}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{users.length}</div>
          <div style={styles.statLabel}>{t.totalUsers}</div>
        </div>
      </div>

      {/* Assign Form */}
      <div style={styles.card}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '16px' }}>
          📋 {t.assignNew}
        </h3>
        <form onSubmit={handleAssign}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label style={styles.label}>{t.selectAsset} *</label>
              <select 
                style={styles.select} 
                value={selectedAsset} 
                onChange={(e) => setSelectedAsset(e.target.value)} 
                required
              >
                <option value="">{t.selectAsset}</option>
                {availableAssets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} - {a.name} ({a.serial_number || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>{t.selectUser} *</label>
              <select 
                style={styles.select} 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)} 
                required
              >
                <option value="">{t.selectUser}</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username} ({u.role || 'User'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>{t.selectDepartment}</label>
              <select 
                style={styles.select} 
                value={selectedDepartment} 
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">{t.selectDepartment}</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>{t.assignmentDate}</label>
              <input 
                type="date" 
                style={styles.input} 
                value={assignmentDate} 
                onChange={(e) => setAssignmentDate(e.target.value)} 
              />
            </div>

            <div>
              <label style={styles.label}>{t.expectedReturn}</label>
              <input 
                type="date" 
                style={styles.input} 
                value={returnDate} 
                onChange={(e) => setReturnDate(e.target.value)} 
              />
            </div>

            <div>
              <label style={styles.label}>{t.conditionAtAssignment}</label>
              <select 
                style={styles.select} 
                value={conditionAtAssignment} 
                onChange={(e) => setConditionAtAssignment(e.target.value)}
              >
                <option value="Excellent">{t.excellent}</option>
                <option value="Good">{t.good}</option>
                <option value="Fair">{t.fair}</option>
                <option value="Poor">{t.poor}</option>
                <option value="Damaged">{t.damaged}</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.label}>{t.remarks}</label>
              <textarea 
                style={styles.textarea} 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)} 
                placeholder={t.remarksPlaceholder}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px' }}>
              <button type="submit" style={{ ...styles.button, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                {saving ? 'Saving...' : `✅ ${t.assignAsset}`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Assignments Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>{t.assetTag}</th>
              <th style={styles.th}>{t.assetName}</th>
              <th style={styles.th}>{t.assignedTo}</th>
              <th style={styles.th}>{t.department}</th>
              <th style={styles.th}>{t.assignedDate}</th>
              <th style={styles.th}>{t.expectedReturn}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan="9" style={{...styles.td, textAlign: 'center', padding: '40px'}}>
                  {t.noAssignments}
                </td>
              </tr>
            ) : (
              assignments.map((assignment, index) => {
                const isActive = !assignment.returned_at;
                return (
                  <tr key={assignment.id}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}>
                      <code>{assignment.asset_tag || assignment.id}</code>
                    </td>
                    <td style={styles.td}>{assignment.asset_name || 'N/A'}</td>
                    <td style={styles.td}>{assignment.assigned_to_name || 'N/A'}</td>
                    <td style={styles.td}>{assignment.department_name || 'N/A'}</td>
                    <td style={styles.td}>
                      {new Date(assignment.assigned_date).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      {assignment.expected_return_date 
                        ? new Date(assignment.expected_return_date).toLocaleDateString() 
                        : '-'}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(isActive)}>
                        {isActive ? '✅ Active' : '📋 Returned'}
                      </span>
                      {isActive && assignment.expected_return_date && 
                        new Date(assignment.expected_return_date) < new Date() && (
                          <span style={{ 
                            marginLeft: '8px', 
                            color: '#fc8181', 
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            ⚠️ Overdue
                          </span>
                        )}
                    </td>
                    <td style={styles.td}>
                      {isActive ? (
                        <>
                          <button 
                            style={styles.buttonSuccess}
                            onClick={() => handleReturn(assignment.id, assignment.asset_id)}
                          >
                            ↩ {t.return}
                          </button>
                          <button 
                            style={styles.buttonWarning}
                            onClick={() => {
                              setTransferData({ 
                                assetId: assignment.asset_id, 
                                newUserId: '', 
                                newDepartment: '' 
                              });
                              setShowTransferModal(true);
                            }}
                          >
                            🔄 {t.transfer}
                          </button>
                        </>
                      ) : (
                        <button 
                          style={styles.buttonInfo}
                          onClick={() => generateHandover(assignment)}
                        >
                          📄 {t.handover}
                        </button>
                      )}
                      <button 
                        style={styles.buttonInfo}
                        onClick={() => viewHistory(assignment.asset_id)}
                      >
                        📜 {t.history}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div style={styles.modal} onClick={() => setShowHistoryModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📜 {t.assignmentHistory}</h3>
              <button style={styles.modalClose} onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            
            {assignmentHistory.length === 0 ? (
              <p style={styles.emptyState}>{t.noHistory}</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>{t.assignedTo}</th>
                    <th style={styles.th}>{t.assignedDate}</th>
                    <th style={styles.th}>{t.returnDate}</th>
                    <th style={styles.th}>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentHistory.map((h, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{idx + 1}</td>
                      <td style={styles.td}>{h.assigned_to_name || 'N/A'}</td>
                      <td style={styles.td}>
                        {new Date(h.assigned_date).toLocaleDateString()}
                      </td>
                      <td style={styles.td}>
                        {h.returned_at ? new Date(h.returned_at).toLocaleDateString() : '-'}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(!h.returned_at)}>
                          {h.returned_at ? '📋 Returned' : '✅ Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div style={styles.modal} onClick={() => setShowTransferModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>🔄 {t.transferAsset}</h3>
              <button style={styles.modalClose} onClick={() => setShowTransferModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleTransfer}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={styles.label}>{t.transferTo} *</label>
                  <select 
                    style={styles.select}
                    value={transferData.newUserId}
                    onChange={(e) => setTransferData({ ...transferData, newUserId: e.target.value })}
                    required
                  >
                    <option value="">{t.selectUser}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={styles.label}>{t.newDepartment}</label>
                  <select 
                    style={styles.select}
                    value={transferData.newDepartment}
                    onChange={(e) => setTransferData({ ...transferData, newDepartment: e.target.value })}
                  >
                    <option value="">{t.selectDepartment}</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" style={styles.button}>
                    ✅ {t.confirmTransfer}
                  </button>
                  <button 
                    type="button" 
                    style={{...styles.button, background: '#718096'}}
                    onClick={() => setShowTransferModal(false)}
                  >
                    ❌ {t.cancel}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover Document Modal */}
      {showHandoverModal && handoverData && (
        <div style={styles.modal} onClick={() => setShowHandoverModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📄 {t.handoverDocument}</h3>
              <button style={styles.modalClose} onClick={() => setShowHandoverModal(false)}>✕</button>
            </div>
            
            <div style={styles.handoverDocument}>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ color: isDark ? '#c8dcf5' : '#1a365d' }}>
                  🏛️ {t.assetHandover}
                </h2>
                <p style={{ color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.handoverDate}: {new Date().toLocaleDateString()}
                </p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.assetTag}:</td>
                    <td style={{ padding: '8px' }}>{handoverData.asset_tag}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.assetName}:</td>
                    <td style={{ padding: '8px' }}>{handoverData.asset_name}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.assignedTo}:</td>
                    <td style={{ padding: '8px' }}>{handoverData.assigned_to_name}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.department}:</td>
                    <td style={{ padding: '8px' }}>{handoverData.department_name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.assignedDate}:</td>
                    <td style={{ padding: '8px' }}>
                      {new Date(handoverData.assigned_date).toLocaleDateString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.returnDate}:</td>
                    <td style={{ padding: '8px' }}>
                      {handoverData.returned_at 
                        ? new Date(handoverData.returned_at).toLocaleDateString() 
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.status}:</td>
                    <td style={{ padding: '8px' }}>
                      {handoverData.returned_at ? '✅ Returned' : '📋 Active'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '30px', display: 'flex', gap: '12px' }}>
                <button style={styles.button} onClick={printHandover}>
                  🖨️ {t.print}
                </button>
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
  assignments: 'ICT Assignments',
  assignmentsDesc: 'Manage asset assignments and track current holders',
  assignNew: 'Assign New Asset',
  selectAsset: 'Select Asset',
  selectUser: 'Select User',
  selectDepartment: 'Select Department',
  assignmentDate: 'Assignment Date',
  expectedReturn: 'Expected Return Date',
  conditionAtAssignment: 'Condition at Assignment',
  remarks: 'Remarks',
  remarksPlaceholder: 'Any additional remarks or notes',
  assignAsset: 'Assign Asset',
  assetTag: 'Asset Tag',
  assetName: 'Asset Name',
  assignedTo: 'Assigned To',
  department: 'Department',
  assignedDate: 'Assigned Date',
  returnDate: 'Return Date',
  status: 'Status',
  actions: 'Actions',
  return: 'Return',
  transfer: 'Transfer',
  history: 'History',
  handover: 'Handover',
  exportPDF: 'Export PDF',
  activeAssignments: 'Active Assignments',
  returnedAssignments: 'Returned',
  availableAssets: 'Available Assets',
  totalUsers: 'Total Users',
  loading: 'Loading...',
  noAssignments: 'No assignments found',
  assetAssigned: 'Asset assigned successfully',
  assetReturned: 'Asset returned successfully',
  assetTransferred: 'Asset transferred successfully',
  assignError: 'Failed to assign asset',
  returnError: 'Failed to return asset',
  transferError: 'Failed to transfer asset',
  historyError: 'Failed to load history',
  exportSuccess: 'Report exported successfully',
  selectBoth: 'Please select both asset and user',
  assetAlreadyAssigned: 'This asset is already assigned',
  confirmReturn: 'Are you sure you want to return this asset?',
  transferAsset: 'Transfer Asset',
  transferTo: 'Transfer To',
  newDepartment: 'New Department',
  confirmTransfer: 'Confirm Transfer',
  cancel: 'Cancel',
  handoverDocument: 'Handover Document',
  assetHandover: 'Asset Handover Document',
  handoverDate: 'Handover Date',
  print: 'Print',
  assignmentHistory: 'Assignment History',
  noHistory: 'No history found',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  fetchError: 'Failed to load data'
};

const amharicTranslations = {
  assignments: 'የICT ምደባዎች',
  assignmentsDesc: 'የንብረት ምደባዎችን ያስተዳድሩ እና ወቅታዊ ተጠቃሚዎችን ይከታተሉ',
  assignNew: 'አዲስ ንብረት መድብ',
  selectAsset: 'ንብረት ይምረጡ',
  selectUser: 'ተጠቃሚ ይምረጡ',
  selectDepartment: 'ክፍል ይምረጡ',
  assignmentDate: 'የምደባ ቀን',
  expectedReturn: 'የሚጠበቀው የመመለሻ ቀን',
  conditionAtAssignment: 'በምደባ ጊዜ ሁኔታ',
  remarks: 'ማስታወሻዎች',
  remarksPlaceholder: 'ተጨማሪ ማስታወሻዎች ወይም ማጠቃለያዎች',
  assignAsset: 'ንብረት መድብ',
  assetTag: 'የንብረት መለያ',
  assetName: 'የንብረት ስም',
  assignedTo: 'ተመድቦለት',
  department: 'ክፍል',
  assignedDate: 'የተመደበበት ቀን',
  returnDate: 'የመመለሻ ቀን',
  status: 'ሁኔታ',
  actions: 'ተግባራት',
  return: 'መልስ',
  transfer: 'አስተላልፍ',
  history: 'ታሪክ',
  handover: 'አስረክብ',
  exportPDF: 'PDF ወጣ',
  activeAssignments: 'ንቁ ምደባዎች',
  returnedAssignments: 'የተመለሱ',
  availableAssets: 'ይገኛሉ',
  totalUsers: 'ጠቅላላ ተጠቃሚዎች',
  loading: 'በመጫን ላይ...',
  noAssignments: 'ምንም ምደባዎች አልተገኙም',
  assetAssigned: 'ንብረት በተሳካ ሁኔታ ተመድቧል',
  assetReturned: 'ንብረት በተሳካ ሁኔታ ተመልሷል',
  assetTransferred: 'ንብረት በተሳካ ሁኔታ ተላልፏል',
  assignError: 'ንብረት መመደብ አልተሳካም',
  returnError: 'ንብረት መመለስ አልተሳካም',
  transferError: 'ንብረት ማስተላለፍ አልተሳካም',
  historyError: 'ታሪክ መጫን አልተሳካም',
  exportSuccess: 'ሪፖርት በተሳካ ሁኔታ ወጥቷል',
  selectBoth: 'እባክዎ ሁለቱንም ንብረት እና ተጠቃሚ ይምረጡ',
  assetAlreadyAssigned: 'ይህ ንብረት ቀድሞ ተመድቧል',
  confirmReturn: 'ይህን ንብረት መመለስ እንደሚፈልጉ እርግጠኛ ነዎት?',
  transferAsset: 'ንብረት አስተላልፍ',
  transferTo: 'አስተላልፍ ለ',
  newDepartment: 'አዲስ ክፍል',
  confirmTransfer: 'ማስተላለፍ አረጋግጥ',
  cancel: 'ሰርዝ',
  handoverDocument: 'የማስረከቢያ ሰነድ',
  assetHandover: 'የንብረት ማስረከቢያ ሰነድ',
  handoverDate: 'የማስረከቢያ ቀን',
  print: 'አትም',
  assignmentHistory: 'የምደባ ታሪክ',
  noHistory: 'ምንም ታሪክ አልተገኘም',
  excellent: 'እጅግ ጥሩ',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  damaged: 'የተበላሸ',
  fetchError: 'መረጃ መጫን አልተሳካም'
};

export default ICTAssignments;