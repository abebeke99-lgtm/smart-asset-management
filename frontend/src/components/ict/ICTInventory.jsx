import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ICTInventory = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  
  // State
  const [inventory, setInventory] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    min_quantity: 0,
    max_quantity: 0,
    location: '',
    supplier: '',
    unit_cost: 0,
    description: ''
  });
  const [issueData, setIssueData] = useState({
    quantity: 0,
    assigned_to: '',
    department: '',
    remarks: ''
  });
  const [returnData, setReturnData] = useState({
    quantity: 0,
    remarks: ''
  });
  const [adjustData, setAdjustData] = useState({
    quantity: 0,
    reason: '',
    remarks: ''
  });
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    totalQuantity: 0,
    lowStock: 0,
    outOfStock: 0,
    issued: 0,
    byCategory: {},
    byLocation: {},
    byStatus: {}
  });

  // Fetch data
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [inventoryRes, assetsRes, usersRes, deptsRes] = await Promise.all([
        axios.get('/api/inventory', { params: { limit: 1000 } }),
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/users', { params: { limit: 500 } }),
        axios.get('/api/departments')
      ]);

      const inventoryData = inventoryRes.data.inventory || inventoryRes.data.items || [];
      setInventory(inventoryData);
      setAssets(assetsRes.data.assets || []);
      setUsers(usersRes.data.users || []);
      setDepartments(deptsRes.data.departments || []);

      // Extract categories and locations
      const cats = [...new Set(inventoryData.map(item => item.category).filter(Boolean))];
      const locs = [...new Set(inventoryData.map(item => item.location).filter(Boolean))];
      setCategories(cats);
      setLocations(locs);

      // Calculate stats
      const byCategory = {};
      const byLocation = {};
      const byStatus = {};
      let totalQuantity = 0;
      let lowStock = 0;
      let outOfStock = 0;
      let issued = 0;

      inventoryData.forEach(item => {
        const cat = item.category || 'Unknown';
        byCategory[cat] = (byCategory[cat] || 0) + item.quantity;
        
        const loc = item.location || 'Unknown';
        byLocation[loc] = (byLocation[loc] || 0) + item.quantity;
        
        const status = item.quantity <= 0 ? 'Out of Stock' : 
                      item.quantity <= item.min_quantity ? 'Low Stock' : 'Normal';
        byStatus[status] = (byStatus[status] || 0) + 1;

        totalQuantity += item.quantity || 0;
        if (item.quantity <= 0) outOfStock++;
        else if (item.quantity <= item.min_quantity) lowStock++;
        issued += item.issued_quantity || 0;
      });

      setStats({
        totalItems: inventoryData.length,
        totalQuantity: totalQuantity,
        lowStock: lowStock,
        outOfStock: outOfStock,
        issued: issued,
        byCategory,
        byLocation,
        byStatus
      });
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load inventory');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Get filtered inventory
  const getFilteredInventory = () => {
    let filtered = inventory;
    
    if (filter) {
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(filter.toLowerCase()) ||
        item.category?.toLowerCase().includes(filter.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(filter.toLowerCase()) ||
        item.id?.toString().includes(filter)
      );
    }
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => item.category === filterCategory);
    }
    
    if (filterStatus === 'low') {
      filtered = filtered.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity);
    } else if (filterStatus === 'out') {
      filtered = filtered.filter(item => item.quantity <= 0);
    } else if (filterStatus === 'normal') {
      filtered = filtered.filter(item => item.quantity > item.min_quantity);
    }
    
    if (filterLocation !== 'all') {
      filtered = filtered.filter(item => item.location === filterLocation);
    }
    
    return filtered;
  };

  // Get status
  const getItemStatus = (item) => {
    if (item.quantity <= 0) return { label: 'Out of Stock', color: '#fc8181', icon: '🚫' };
    if (item.quantity <= item.min_quantity) return { label: 'Low Stock', color: '#ed8936', icon: '⚠️' };
    return { label: 'Normal', color: '#48bb78', icon: '✅' };
  };

  // Handle create item
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory', formData);
      toast.success('Inventory item created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create item');
    }
  };

  // Handle issue item
  const handleIssue = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory/transactions', { ...issueData, asset_id: selectedItem.asset_id, type: 'issue' });
      toast.success('Item issued successfully');
      setShowIssueModal(false);
      resetIssueData();
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to issue item');
    }
  };

  // Handle return item
  const handleReturn = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory/transactions', { ...returnData, asset_id: selectedItem.asset_id, type: 'return' });
      toast.success('Item returned successfully');
      setShowReturnModal(false);
      resetReturnData();
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to return item');
    }
  };

  // Handle adjust stock
  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory/transactions', { ...adjustData, asset_id: selectedItem.asset_id, type: 'adjustment' });
      toast.success('Stock adjusted successfully');
      setShowAdjustModal(false);
      resetAdjustData();
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to adjust stock');
    }
  };

  // View history
  const viewHistory = async (item) => {
    setSelectedItem(item);
    setShowHistoryModal(true);
    try {
      const response = await axios.get('/api/transactions', { params: { asset_id: item.asset_id } });
      setHistoryData(response.data.transactions || []);
    } catch (error) {
      toast.error('Failed to load history');
    }
  };

  // Delete item
  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await axios.delete(`/api/inventory/${item.id}`);
      toast.success('Item deleted successfully');
      fetchInventory();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  // Reset functions
  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      quantity: 0,
      min_quantity: 0,
      max_quantity: 0,
      location: '',
      supplier: '',
      unit_cost: 0,
      description: ''
    });
  };

  const resetIssueData = () => {
    setIssueData({
      quantity: 0,
      assigned_to: '',
      department: '',
      remarks: ''
    });
  };

  const resetReturnData = () => {
    setReturnData({
      quantity: 0,
      remarks: ''
    });
  };

  const resetAdjustData = () => {
    setAdjustData({
      quantity: 0,
      reason: '',
      remarks: ''
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = getFilteredInventory().map(item => ({
      'ID': item.id,
      'Name': item.name,
      'Category': item.category || 'N/A',
      'Quantity': item.quantity || 0,
      'Available': (item.quantity - (item.issued_quantity || 0)) || 0,
      'Issued': item.issued_quantity || 0,
      'Min Stock': item.min_quantity || 0,
      'Max Stock': item.max_quantity || 0,
      'Status': getItemStatus(item).label,
      'Location': item.location || 'N/A',
      'Supplier': item.supplier || 'N/A',
      'Unit Cost': item.unit_cost || 0,
      'Total Value': (item.quantity || 0) * (item.unit_cost || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export successful');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ICT Inventory Report', 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    
    const tableData = getFilteredInventory().slice(0, 100).map(item => [
      item.id,
      item.name,
      item.category || 'N/A',
      item.quantity || 0,
      (item.quantity - (item.issued_quantity || 0)) || 0,
      getItemStatus(item).label,
      item.location || 'N/A'
    ]);

    doc.autoTable({
      head: [['ID', 'Name', 'Category', 'Qty', 'Available', 'Status', 'Location']],
      body: tableData,
      startY: 35
    });

    doc.save(`Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Export successful');
  };

  const filteredInventory = getFilteredInventory();

  // Styles
  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '24px'
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
    controls: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      alignItems: 'center'
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
      marginBottom: '16px',
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    input: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      flex: 1,
      minWidth: '150px'
    },
    select: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
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
    statusBadge: (status) => ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: `${status.color}20`,
      color: status.color,
      border: `1px solid ${status.color}40`
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
      maxWidth: '600px',
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
    textarea: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      minHeight: '60px',
      resize: 'vertical'
    },
    actionButton: (color) => ({
      padding: '4px 10px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '11px',
      background: color,
      color: 'white',
      marginRight: '4px'
    })
  };

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📦 {t.inventory}</h1>
          <p style={styles.subtitle}>{t.inventoryDesc}</p>
        </div>
        <div style={styles.controls}>
          <button style={styles.button()} onClick={() => setShowCreateModal(true)}>
            ➕ {t.addItem}
          </button>
          <button style={styles.button('linear-gradient(135deg, #48bb78, #38a169)')} onClick={exportToExcel}>
            📊 {t.exportExcel}
          </button>
          <button style={styles.button('linear-gradient(135deg, #805ad5, #b794f4)')} onClick={exportToPDF}>
            📄 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.totalItems}</div>
          <div style={styles.statLabel}>{t.totalItems}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.totalQuantity}</div>
          <div style={styles.statLabel}>{t.totalQuantity}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#ed8936' }}>{stats.lowStock}</div>
          <div style={styles.statLabel}>{t.lowStock}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>{stats.outOfStock}</div>
          <div style={styles.statLabel}>{t.outOfStock}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#4299e1' }}>{stats.issued}</div>
          <div style={styles.statLabel}>{t.issued}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          style={styles.input}
          placeholder={t.searchPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        
        <select 
          style={styles.select} 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">{t.allCategories}</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select 
          style={styles.select} 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">{t.allStatus}</option>
          <option value="normal">{t.normal}</option>
          <option value="low">{t.lowStock}</option>
          <option value="out">{t.outOfStock}</option>
        </select>

        <select 
          style={styles.select} 
          value={filterLocation} 
          onChange={(e) => setFilterLocation(e.target.value)}
        >
          <option value="all">{t.allLocations}</option>
          {locations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>{t.itemName}</th>
              <th style={styles.th}>{t.category}</th>
              <th style={styles.th}>{t.quantity}</th>
              <th style={styles.th}>{t.available}</th>
              <th style={styles.th}>{t.issued}</th>
              <th style={styles.th}>{t.minStock}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan="10" style={{...styles.td, textAlign: 'center', padding: '40px'}}>
                  {t.noItems}
                </td>
              </tr>
            ) : (
              filteredInventory.map((item, index) => {
                const status = getItemStatus(item);
                const available = (item.quantity || 0) - (item.issued_quantity || 0);
                return (
                  <tr key={item.id}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: isDark ? '#8896b0' : '#4a5568' }}>
                        ID: {item.id}
                      </div>
                    </td>
                    <td style={styles.td}>{item.category || '-'}</td>
                    <td style={styles.td}>
                      <strong>{item.quantity || 0}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: available < item.min_quantity ? '#ed8936' : '#48bb78' }}>
                        {available}
                      </span>
                    </td>
                    <td style={styles.td}>{item.issued_quantity || 0}</td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {item.min_quantity || 0}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(status)}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td style={styles.td}>{item.location || '-'}</td>
                    <td style={styles.td}>
                      <button 
                        style={styles.actionButton('#4299e1')}
                        onClick={() => viewHistory(item)}
                      >
                        📜
                      </button>
                      <button 
                        style={styles.actionButton('#48bb78')}
                        onClick={() => {
                          setSelectedItem(item);
                          setShowIssueModal(true);
                        }}
                        disabled={item.quantity <= 0}
                      >
                        📤
                      </button>
                      <button 
                        style={styles.actionButton('#ed8936')}
                        onClick={() => {
                          setSelectedItem(item);
                          setShowReturnModal(true);
                        }}
                        disabled={!item.issued_quantity}
                      >
                        📥
                      </button>
                      <button 
                        style={styles.actionButton('#805ad5')}
                        onClick={() => {
                          setSelectedItem(item);
                          setShowAdjustModal(true);
                        }}
                      >
                        ⚖️
                      </button>
                      <button 
                        style={styles.actionButton('#fc8181')}
                        onClick={() => handleDelete(item)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>➕ {t.addItem}</h3>
              <button style={styles.modalClose} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div style={styles.grid}>
                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.itemName} *</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.category}</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.location}</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.quantity} *</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.minStock}</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({...formData, min_quantity: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.maxStock}</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={formData.max_quantity}
                    onChange={(e) => setFormData({...formData, max_quantity: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.supplier}</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.unitCost}</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({...formData, unit_cost: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div style={styles.fullWidth}>
                  <label style={styles.label}>{t.description}</label>
                  <textarea
                    style={styles.textarea}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.button()}>
                  ✅ {t.create}
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

      {/* Issue Modal */}
      {showIssueModal && selectedItem && (
        <div style={styles.modal} onClick={() => setShowIssueModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📤 {t.issueItem}</h3>
              <button style={styles.modalClose} onClick={() => setShowIssueModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleIssue}>
              <div>
                <label style={styles.label}>{t.item}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedItem.name} (Available: {(selectedItem.quantity - (selectedItem.issued_quantity || 0))})
                </div>
              </div>

              <div>
                <label style={styles.label}>{t.quantity} *</label>
                <input
                  type="number"
                  style={styles.input}
                  value={issueData.quantity}
                  onChange={(e) => setIssueData({...issueData, quantity: parseInt(e.target.value) || 0})}
                  min="1"
                  max={selectedItem.quantity - (selectedItem.issued_quantity || 0)}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>{t.issueTo}</label>
                <select
                  style={styles.select}
                  value={issueData.assigned_to}
                  onChange={(e) => setIssueData({...issueData, assigned_to: e.target.value})}
                >
                  <option value="">{t.selectUser}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>{t.department}</label>
                <select
                  style={styles.select}
                  value={issueData.department}
                  onChange={(e) => setIssueData({...issueData, department: e.target.value})}
                >
                  <option value="">{t.selectDepartment}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>{t.remarks}</label>
                <textarea
                  style={styles.textarea}
                  value={issueData.remarks}
                  onChange={(e) => setIssueData({...issueData, remarks: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.button('linear-gradient(135deg, #48bb78, #38a169)')}>
                  ✅ {t.issue}
                </button>
                <button 
                  type="button" 
                  style={styles.button('linear-gradient(135deg, #718096, #4a5568)')}
                  onClick={() => setShowIssueModal(false)}
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedItem && (
        <div style={styles.modal} onClick={() => setShowReturnModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📥 {t.returnItem}</h3>
              <button style={styles.modalClose} onClick={() => setShowReturnModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleReturn}>
              <div>
                <label style={styles.label}>{t.item}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedItem.name} (Issued: {selectedItem.issued_quantity || 0})
                </div>
              </div>

              <div>
                <label style={styles.label}>{t.quantity} *</label>
                <input
                  type="number"
                  style={styles.input}
                  value={returnData.quantity}
                  onChange={(e) => setReturnData({...returnData, quantity: parseInt(e.target.value) || 0})}
                  min="1"
                  max={selectedItem.issued_quantity || 0}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>{t.remarks}</label>
                <textarea
                  style={styles.textarea}
                  value={returnData.remarks}
                  onChange={(e) => setReturnData({...returnData, remarks: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.button('linear-gradient(135deg, #ed8936, #f6ad55)')}>
                  ✅ {t.return}
                </button>
                <button 
                  type="button" 
                  style={styles.button('linear-gradient(135deg, #718096, #4a5568)')}
                  onClick={() => setShowReturnModal(false)}
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedItem && (
        <div style={styles.modal} onClick={() => setShowAdjustModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>⚖️ {t.adjustStock}</h3>
              <button style={styles.modalClose} onClick={() => setShowAdjustModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleAdjust}>
              <div>
                <label style={styles.label}>{t.item}</label>
                <div style={{ ...styles.input, background: isDark ? '#0d1b2a' : '#f7fafc' }}>
                  {selectedItem.name} (Current: {selectedItem.quantity})
                </div>
              </div>

              <div>
                <label style={styles.label}>{t.newQuantity} *</label>
                <input
                  type="number"
                  style={styles.input}
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({...adjustData, quantity: parseInt(e.target.value) || 0})}
                  min="0"
                  required
                />
              </div>

              <div>
                <label style={styles.label}>{t.reason} *</label>
                <select
                  style={styles.select}
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({...adjustData, reason: e.target.value})}
                  required
                >
                  <option value="">{t.selectReason}</option>
                  <option value="Stock Count">{t.stockCount}</option>
                  <option value="Damaged">{t.damaged}</option>
                  <option value="Lost">{t.lost}</option>
                  <option value="Found">{t.found}</option>
                  <option value="Correction">{t.correction}</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>{t.remarks}</label>
                <textarea
                  style={styles.textarea}
                  value={adjustData.remarks}
                  onChange={(e) => setAdjustData({...adjustData, remarks: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.button('linear-gradient(135deg, #805ad5, #b794f4)')}>
                  ✅ {t.adjust}
                </button>
                <button 
                  type="button" 
                  style={styles.button('linear-gradient(135deg, #718096, #4a5568)')}
                  onClick={() => setShowAdjustModal(false)}
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedItem && (
        <div style={styles.modal} onClick={() => setShowHistoryModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📜 {t.movementHistory}</h3>
              <button style={styles.modalClose} onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            
            <h4 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '12px' }}>
              {selectedItem.name}
            </h4>
            
            {historyData.length === 0 ? (
              <p style={styles.emptyState}>{t.noHistory}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{t.date}</th>
                      <th style={styles.th}>{t.type}</th>
                      <th style={styles.th}>{t.quantity}</th>
                      <th style={styles.th}>{t.details}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((h, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>
                          {new Date(h.created_at).toLocaleString()}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: h.type === 'issue' ? 'rgba(66, 153, 225, 0.15)' :
                                       h.type === 'return' ? 'rgba(237, 137, 54, 0.15)' :
                                       'rgba(128, 90, 213, 0.15)',
                            color: h.type === 'issue' ? '#4299e1' :
                                   h.type === 'return' ? '#ed8936' :
                                   '#805ad5'
                          }}>
                            {h.type === 'issue' ? '📤 Issue' :
                             h.type === 'return' ? '📥 Return' :
                             '⚖️ Adjust'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <strong>{h.quantity}</strong>
                        </td>
                        <td style={styles.td}>{h.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  inventory: 'Inventory Management',
  inventoryDesc: 'Manage ICT stock, quantities, and movements',
  addItem: 'Add Item',
  exportExcel: 'Export Excel',
  exportPDF: 'Export PDF',
  totalItems: 'Total Items',
  totalQuantity: 'Total Quantity',
  lowStock: 'Low Stock',
  outOfStock: 'Out of Stock',
  issued: 'Issued',
  allCategories: 'All Categories',
  allStatus: 'All Status',
  normal: 'Normal',
  allLocations: 'All Locations',
  searchPlaceholder: 'Search by name, category, or supplier...',
  itemName: 'Item Name',
  category: 'Category',
  quantity: 'Quantity',
  available: 'Available',
  issued: 'Issued',
  minStock: 'Min Stock',
  status: 'Status',
  location: 'Location',
  actions: 'Actions',
  noItems: 'No inventory items found',
  loading: 'Loading...',
  item: 'Item',
  create: 'Create',
  cancel: 'Cancel',
  remarks: 'Remarks',
  description: 'Description',
  supplier: 'Supplier',
  unitCost: 'Unit Cost',
  minStock: 'Min Stock',
  maxStock: 'Max Stock',
  newQuantity: 'New Quantity',
  reason: 'Reason',
  selectReason: 'Select Reason',
  stockCount: 'Stock Count',
  damaged: 'Damaged',
  lost: 'Lost',
  found: 'Found',
  correction: 'Correction',
  adjust: 'Adjust Stock',
  adjustStock: 'Adjust Stock',
  issueItem: 'Issue Item',
  issue: 'Issue',
  returnItem: 'Return Item',
  return: 'Return',
  issueTo: 'Issue To',
  selectUser: 'Select User',
  selectDepartment: 'Select Department',
  department: 'Department',
  movementHistory: 'Movement History',
  noHistory: 'No movement history found',
  date: 'Date',
  type: 'Type',
  details: 'Details'
};

const amharicTranslations = {
  inventory: 'የንብረት ክምችት አስተዳደር',
  inventoryDesc: 'የICT ክምችት፣ ብዛቶች እና እንቅስቃሴዎችን ያስተዳድሩ',
  addItem: 'ንጥል ጨምር',
  exportExcel: 'Excel ወጣ',
  exportPDF: 'PDF ወጣ',
  totalItems: 'ጠቅላላ ንጥሎች',
  totalQuantity: 'ጠቅላላ ብዛት',
  lowStock: 'ዝቅተኛ ክምችት',
  outOfStock: 'ክምችት የሌለ',
  allCategories: 'ሁሉም ምድቦች',
  allStatus: 'ሁሉም ሁኔታዎች',
  normal: 'መደበኛ',
  allLocations: 'ሁሉም ቦታዎች',
  searchPlaceholder: 'በስም፣ ምድብ ወይም አቅራቢ ይፈልጉ...',
  itemName: 'የንጥል ስም',
  category: 'ምድብ',
  quantity: 'ብዛት',
  available: 'ይገኛል',
  issued: 'የተሰጠ',
  status: 'ሁኔታ',
  location: 'ቦታ',
  actions: 'ተግባራት',
  noItems: 'ምንም የክምችት ንጥሎች አልተገኙም',
  loading: 'በመጫን ላይ...',
  item: 'ንጥል',
  create: 'ፍጠር',
  cancel: 'ሰርዝ',
  remarks: 'ማስታወሻዎች',
  description: 'መግለጫ',
  supplier: 'አቅራቢ',
  unitCost: 'የአንድ ዋጋ',
  minStock: 'ዝቅተኛ ክምችት',
  maxStock: 'ከፍተኛ ክምችት',
  newQuantity: 'አዲስ ብዛት',
  reason: 'ምክንያት',
  selectReason: 'ምክንያት ይምረጡ',
  stockCount: 'የክምችት ቆጠራ',
  damaged: 'የተበላሸ',
  lost: 'የጠፋ',
  found: 'ተገኝቷል',
  correction: 'ማስተካከያ',
  adjust: 'ክምችት አስተካክል',
  adjustStock: 'ክምችት አስተካክል',
  issueItem: 'ንጥል ስጥ',
  issue: 'ስጥ',
  returnItem: 'ንጥል መልስ',
  return: 'መልስ',
  issueTo: 'ለማን ስጥ',
  selectUser: 'ተጠቃሚ ይምረጡ',
  selectDepartment: 'ክፍል ይምረጡ',
  department: 'ክፍል',
  movementHistory: 'የእንቅስቃሴ ታሪክ',
  noHistory: 'ምንም የእንቅስቃሴ ታሪክ አልተገኘም',
  date: 'ቀን',
  type: 'አይነት',
  details: 'ዝርዝሮች'
};

export default ICTInventory;