import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ICTAssets = () => {
  const navigate = useNavigate();
  const { language, theme } = useLanguage();
  
  // State
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingAsset, setEditingAsset] = useState(null);
  const importInputRef = useRef(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
    condition: 'all',
    department: 'all',
    location: 'all',
    dateFrom: '',
    dateTo: '',
    warrantyStatus: 'all'
  });
  
  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch assets with filters
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.itemsPerPage,
        offset: (pagination.currentPage - 1) * pagination.itemsPerPage,
        ...filters
      };
      
      // Remove 'all' values
      Object.keys(params).forEach(key => {
        if (params[key] === 'all' || params[key] === '') {
          delete params[key];
        }
      });

      const response = await axios.get('/api/assets', { params });
      setAssets(response.data.assets || []);
      setPagination(prev => ({
        ...prev,
        totalItems: response.data.total || 0,
        totalPages: Math.ceil((response.data.total || 0) / prev.itemsPerPage)
      }));
    } catch (error) {
      toast.error('Failed to load assets');
    }
    setLoading(false);
  }, [filters, pagination.currentPage, pagination.itemsPerPage]);

  // Fetch options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [deptsRes, catsRes] = await Promise.all([
          axios.get('/api/departments'),
          axios.get('/api/categories')
        ]);
        setDepartments(deptsRes.data.departments || []);
        setCategories(catsRes.data.categories || []);
      } catch (error) {
        console.error('Failed to load options');
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchAssets();
  };

  // View asset details
  const handleViewAsset = async (assetId) => {
    try {
      const response = await axios.get(`/api/assets/${assetId}`);
      setSelectedAsset(response.data.asset);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load asset details');
    }
  };

  // Edit asset
  const handleEditAsset = (asset) => {
    setEditingAsset({ ...asset });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`/api/assets/${editingAsset.id}`, editingAsset);
      toast.success('Asset updated successfully');
      setShowEditModal(false);
      fetchAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update asset');
    }
    setLoading(false);
  };

  // Delete asset
  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;
    try {
      await axios.delete(`/api/assets/${assetId}`);
      toast.success('Asset deleted successfully');
      fetchAssets();
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const handleCloneAsset = (asset) => {
    navigate('/ict/create-asset', {
      state: {
        cloneFrom: {
          ...asset,
          name: `${asset.name || 'Asset'} (Copy)`,
          assetCode: '',
          serialNumber: '',
          rfidTag: ''
        }
      }
    });
  };

  const handleImportAssets = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      if (!rows.length) {
        toast.error('The selected file has no asset rows');
        return;
      }

      const results = await Promise.allSettled(rows.map(row => axios.post('/api/assets', {
        name: row.Name || row['Asset Name'],
        assetCode: row['Asset ID'] || row.ID || row['Asset Code'],
        category: row.Category,
        brand: row.Brand,
        model: row.Model,
        serialNumber: row['Serial Number'],
        rfidTag: row.RFID,
        status: row.Status || 'Available',
        condition: row.Condition || 'Good',
        department: row.Department,
        location: row.Location,
        purchaseDate: row['Purchase Date'],
        purchasePrice: row['Purchase Cost'] || 0,
        warrantyExpiry: row['Warranty Expiry']
      })));
      const imported = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - imported;
      toast.success(`${imported} assets imported${failed ? `, ${failed} failed` : ''}`);
      fetchAssets();
    } catch (error) {
      toast.error('Failed to import assets');
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = assets.map(asset => ({
      'Asset ID': asset.id,
      'Name': asset.name,
      'Category': asset.category_name,
      'Brand': asset.brand,
      'Model': asset.model,
      'Serial Number': asset.serial_number,
      'RFID': asset.rfid_tag,
      'Status': asset.status,
      'Condition': asset.condition_status,
      'Department': asset.department_name,
      'Location': asset.location,
      'Purchase Date': asset.purchase_date,
      'Purchase Cost': asset.purchase_cost,
      'Warranty Expiry': asset.warranty_expiry
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'ICT Assets');
    XLSX.writeFile(wb, `ICT_Assets_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export successful');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ICT Assets Report', 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    
    const tableData = assets.map(asset => [
      asset.id,
      asset.name,
      asset.category_name || 'N/A',
      asset.status || 'N/A',
      asset.department_name || 'N/A',
      asset.location || 'N/A'
    ]);

    doc.autoTable({
      head: [['ID', 'Name', 'Category', 'Status', 'Department', 'Location']],
      body: tableData.slice(0, 50),
      startY: 35
    });

    doc.save(`ICT_Assets_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Export successful');
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Available': '#48bb78',
      'Assigned': '#4299e1',
      'Under-Maintenance': '#ed8936',
      'Lost': '#fc8181',
      'Disposed': '#805ad5'
    };
    return colors[status] || '#718096';
  };

  // Get condition color
  const getConditionColor = (condition) => {
    const colors = {
      'Excellent': '#48bb78',
      'Good': '#4299e1',
      'Fair': '#ed8936',
      'Poor': '#fc8181',
      'Damaged': '#e53e3e'
    };
    return colors[condition] || '#718096';
  };

  // Styles
  const styles = {
    container: { padding: '20px', maxWidth: '1600px', margin: '0 auto' },
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
    actions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    },
    actionBtn: (bg = 'linear-gradient(135deg, #2b6cb0, #4299e1)') => ({
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      background: bg,
      color: 'white',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '14px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }),
    filterSection: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '24px',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    filterGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px'
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    filterLabel: {
      fontSize: '12px',
      fontWeight: 600,
      color: isDark ? '#8896b0' : '#4a5568',
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    },
    filterInput: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e2e8f0',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      width: '100%'
    },
    filterSelect: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e2e8f0',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      width: '100%',
      cursor: 'pointer'
    },
    tableWrapper: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      overflow: 'hidden',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    th: {
      padding: '14px 16px',
      textAlign: 'left',
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
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
    row: {
      cursor: 'pointer',
      transition: 'background 0.15s ease'
    },
    rowHover: {
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
    },
    statusBadge: (color) => ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`
    }),
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderTop: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    paginationBtn: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: isDark ? '1px solid #32465f' : '1px solid #e2e8f0',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      cursor: 'pointer',
      margin: '0 4px'
    },
    paginationBtnActive: {
      background: isDark ? '#2b6cb0' : '#2b6cb0',
      color: 'white',
      border: 'none'
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
      maxWidth: '900px',
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
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    detailItem: {
      padding: '8px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    detailLabel: {
      fontSize: '12px',
      color: isDark ? '#8896b0' : '#4a5568',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    },
    detailValue: {
      fontSize: '14px',
      color: isDark ? '#c8dcf5' : '#1a365d',
      marginTop: '2px'
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d',
      margin: '16px 0 12px 0',
      paddingBottom: '8px',
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    loadingSpinner: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    }
  };

  if (loading && assets.length === 0) {
    return <div style={styles.loadingSpinner}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📂 {t.assets}</h1>
          <p style={styles.subtitle}>{t.assetsDesc}</p>
        </div>
        <div style={styles.actions}>
          <button 
            style={styles.actionBtn('linear-gradient(135deg, #2b6cb0, #4299e1)')}
            onClick={() => navigate('/ict/create-asset')}
          >
            ➕ {t.createNew}
          </button>
          <button 
            style={styles.actionBtn('linear-gradient(135deg, #48bb78, #68d391)')}
            onClick={exportToExcel}
          >
            📊 {t.exportExcel}
          </button>
          <button
            style={styles.actionBtn('linear-gradient(135deg, #319795, #4fd1c5)')}
            onClick={() => importInputRef.current?.click()}
          >
            📥 {t.importAssets}
          </button>
          <input ref={importInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportAssets} style={{ display: 'none' }} />
          <button 
            style={styles.actionBtn('linear-gradient(135deg, #805ad5, #b794f4)')}
            onClick={exportToPDF}
          >
            📄 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterSection}>
        <form onSubmit={handleSearch}>
          <div style={styles.filterGrid}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.search}</label>
              <input
                type="text"
                style={styles.filterInput}
                placeholder={t.searchPlaceholder}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.category}</label>
              <select
                style={styles.filterSelect}
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="all">{t.allCategories}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.status}</label>
              <select
                style={styles.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">{t.allStatus}</option>
                <option value="Available">{t.available}</option>
                <option value="Assigned">{t.assigned}</option>
                <option value="Under-Maintenance">{t.inMaintenance}</option>
                <option value="Lost">{t.lost}</option>
                <option value="Disposed">{t.disposed}</option>
              </select>
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.condition}</label>
              <select
                style={styles.filterSelect}
                value={filters.condition}
                onChange={(e) => handleFilterChange('condition', e.target.value)}
              >
                <option value="all">{t.allConditions}</option>
                <option value="Excellent">{t.excellent}</option>
                <option value="Good">{t.good}</option>
                <option value="Fair">{t.fair}</option>
                <option value="Poor">{t.poor}</option>
                <option value="Damaged">{t.damaged}</option>
              </select>
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.department}</label>
              <select
                style={styles.filterSelect}
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="all">{t.allDepartments}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.location}</label>
              <input
                type="text"
                style={styles.filterInput}
                placeholder={t.locationPlaceholder}
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.dateFrom}</label>
              <input
                type="date"
                style={styles.filterInput}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.dateTo}</label>
              <input
                type="date"
                style={styles.filterInput}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>{t.warrantyStatus}</label>
              <select
                style={styles.filterSelect}
                value={filters.warrantyStatus}
                onChange={(e) => handleFilterChange('warrantyStatus', e.target.value)}
              >
                <option value="all">{t.allWarranty}</option>
                <option value="active">{t.activeWarranty}</option>
                <option value="expired">{t.expiredWarranty}</option>
                <option value="expiring">{t.expiringWarranty}</option>
              </select>
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>&nbsp;</label>
              <button type="submit" style={styles.actionBtn()}>
                🔍 {t.search}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>{t.name}</th>
              <th style={styles.th}>{t.category}</th>
              <th style={styles.th}>{t.serialNumber}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.condition}</th>
              <th style={styles.th}>{t.department}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan="9" style={{...styles.td, textAlign: 'center', padding: '40px'}}>
                  {t.noAssets}
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr
                  key={asset.id}
                  style={styles.row}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.rowHover)}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <span style={{ fontWeight: 600, color: isDark ? '#63b3ed' : '#2b6cb0' }}>
                      {asset.id}
                    </span>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{asset.name}</div>
                      <div style={{ fontSize: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                        {asset.brand} {asset.model}
                      </div>
                    </div>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    {asset.category_name || 'N/A'}
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <code style={{ fontSize: '12px' }}>{asset.serial_number || 'N/A'}</code>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <span style={styles.statusBadge(getStatusColor(asset.status))}>
                      {asset.status || 'N/A'}
                    </span>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <span style={styles.statusBadge(getConditionColor(asset.condition_status))}>
                      {asset.condition_status || 'N/A'}
                    </span>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    {asset.department_name || 'N/A'}
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    {asset.location || 'N/A'}
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{ 
                        ...styles.actionBtn('linear-gradient(135deg, #4299e1, #63b3ed)'),
                        padding: '4px 12px',
                        fontSize: '12px',
                        marginRight: '4px'
                      }}
                      onClick={() => handleViewAsset(asset.id)}
                    >
                      👁️
                    </button>
                    <button
                      style={{ 
                        ...styles.actionBtn('linear-gradient(135deg, #ed8936, #f6ad55)'),
                        padding: '4px 12px',
                        fontSize: '12px',
                        marginRight: '4px'
                      }}
                      onClick={() => handleEditAsset(asset)}
                    >
                      ✏️
                    </button>
                    <button
                      style={{ 
                        ...styles.actionBtn('linear-gradient(135deg, #fc8181, #f6ad55)'),
                        padding: '4px 12px',
                        fontSize: '12px'
                      }}
                      onClick={() => handleDeleteAsset(asset.id)}
                    >
                      🗑️
                    </button>
                    <button
                      style={{ ...styles.actionBtn('linear-gradient(135deg, #805ad5, #b794f4)'), padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleCloneAsset(asset)}
                      title={t.cloneAsset}
                    >
                      📑
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={styles.pagination}>
          <span style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '14px' }}>
            {t.showing} {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} - 
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} {t.of} {pagination.totalItems}
          </span>
          <div>
            <button
              style={styles.paginationBtn}
              onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
              disabled={pagination.currentPage === 1}
            >
              ◀
            </button>
            {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  style={{
                    ...styles.paginationBtn,
                    ...(page === pagination.currentPage ? styles.paginationBtnActive : {})
                  }}
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: page }))}
                >
                  {page}
                </button>
              );
            })}
            {pagination.totalPages > 5 && (
              <span style={{ color: isDark ? '#8896b0' : '#4a5568' }}>...</span>
            )}
            <button
              style={styles.paginationBtn}
              onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* Asset Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📋 {selectedAsset.name}</h3>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            {/* Basic Information */}
            <h4 style={styles.sectionTitle}>{t.basicInfo}</h4>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assetId}</div>
                <div style={styles.detailValue}>{selectedAsset.id}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.name}</div>
                <div style={styles.detailValue}>{selectedAsset.name}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.category}</div>
                <div style={styles.detailValue}>{selectedAsset.category_name || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.department}</div>
                <div style={styles.detailValue}>{selectedAsset.department_name || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.brand}</div>
                <div style={styles.detailValue}>{selectedAsset.brand || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.model}</div>
                <div style={styles.detailValue}>{selectedAsset.model || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.serialNumber}</div>
                <div style={styles.detailValue}>
                  <code>{selectedAsset.serial_number || 'N/A'}</code>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.rfidTag}</div>
                <div style={styles.detailValue}>
                  <code>{selectedAsset.rfid_tag || 'N/A'}</code>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status}</div>
                <div style={styles.detailValue}>
                  <span style={styles.statusBadge(getStatusColor(selectedAsset.status))}>
                    {selectedAsset.status || 'N/A'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.condition}</div>
                <div style={styles.detailValue}>
                  <span style={styles.statusBadge(getConditionColor(selectedAsset.condition_status))}>
                    {selectedAsset.condition_status || 'N/A'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.location}</div>
                <div style={styles.detailValue}>{selectedAsset.location || 'N/A'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.description}</div>
                <div style={styles.detailValue}>{selectedAsset.description || 'N/A'}</div>
              </div>
            </div>

            {/* Financial Information */}
            <h4 style={styles.sectionTitle}>{t.financialInfo}</h4>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.purchaseDate}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.purchaseCost}</div>
                <div style={styles.detailValue}>
                  ${selectedAsset.purchase_cost?.toLocaleString() || 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.warrantyExpiry}</div>
                <div style={styles.detailValue}>
                  {selectedAsset.warranty_expiry ? new Date(selectedAsset.warranty_expiry).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.currentValue}</div>
                <div style={styles.detailValue}>
                  ${selectedAsset.current_value?.toLocaleString() || 'N/A'}
                </div>
              </div>
            </div>

            {/* Assignment Information */}
            {selectedAsset.assignment && (
              <>
                <h4 style={styles.sectionTitle}>{t.assignmentInfo}</h4>
                <div style={styles.detailGrid}>
                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}>{t.assignedTo}</div>
                    <div style={styles.detailValue}>{selectedAsset.assignment.assigned_to_name || 'N/A'}</div>
                  </div>
                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}>{t.assignedDate}</div>
                    <div style={styles.detailValue}>
                      {selectedAsset.assignment.start_date ? new Date(selectedAsset.assignment.start_date).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}>{t.expectedReturn}</div>
                    <div style={styles.detailValue}>
                      {selectedAsset.assignment.end_date ? new Date(selectedAsset.assignment.end_date).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* QR Code */}
            <div style={{ marginTop: '20px', textAlign: 'center', padding: '16px', background: isDark ? '#0d1b2a' : '#f7fafc', borderRadius: '8px' }}>
              <div style={{ display: 'inline-block', background: 'white', padding: '16px', borderRadius: '8px' }}>
                <QRCodeCanvas value={selectedAsset.id} size={120} />
              </div>
              <p style={{ marginTop: '8px', color: isDark ? '#8896b0' : '#4a5568', fontSize: '12px' }}>
                {t.assetId}: {selectedAsset.id}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingAsset && (
        <div style={styles.modal} onClick={() => setShowEditModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>✏️ {t.editAsset}</h3>
              <button style={styles.modalClose} onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div style={styles.detailGrid}>
                <div>
                  <label style={styles.filterLabel}>{t.name}</label>
                  <input
                    type="text"
                    style={styles.filterInput}
                    value={editingAsset.name || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.serialNumber}</label>
                  <input
                    type="text"
                    style={styles.filterInput}
                    value={editingAsset.serial_number || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, serial_number: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.brand}</label>
                  <input
                    type="text"
                    style={styles.filterInput}
                    value={editingAsset.brand || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, brand: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.model}</label>
                  <input
                    type="text"
                    style={styles.filterInput}
                    value={editingAsset.model || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, model: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.status}</label>
                  <select
                    style={styles.filterSelect}
                    value={editingAsset.status || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value })}
                  >
                    <option value="Available">{t.available}</option>
                    <option value="Assigned">{t.assigned}</option>
                    <option value="Under-Maintenance">{t.inMaintenance}</option>
                    <option value="Lost">{t.lost}</option>
                    <option value="Disposed">{t.disposed}</option>
                  </select>
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.condition}</label>
                  <select
                    style={styles.filterSelect}
                    value={editingAsset.condition_status || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, condition_status: e.target.value })}
                  >
                    <option value="Excellent">{t.excellent}</option>
                    <option value="Good">{t.good}</option>
                    <option value="Fair">{t.fair}</option>
                    <option value="Poor">{t.poor}</option>
                    <option value="Damaged">{t.damaged}</option>
                  </select>
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.location}</label>
                  <input
                    type="text"
                    style={styles.filterInput}
                    value={editingAsset.location || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.purchaseCost}</label>
                  <input
                    type="number"
                    style={styles.filterInput}
                    value={editingAsset.purchase_cost || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, purchase_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={styles.actionBtn()} disabled={loading}>
                  {loading ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
                <button
                  type="button"
                  style={{ ...styles.actionBtn('linear-gradient(135deg, #718096, #4a5568)') }}
                  onClick={() => setShowEditModal(false)}
                >
                  ❌ Cancel
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
  assets: 'ICT Assets',
  assetsDesc: 'Manage all ICT equipment and devices',
  createNew: 'Create New Asset',
  exportExcel: 'Export Excel',
  exportPDF: 'Export PDF',
  importAssets: 'Import Assets',
  cloneAsset: 'Clone Asset',
  search: 'Search',
  searchPlaceholder: 'Search by name, ID, serial, RFID...',
  allCategories: 'All Categories',
  allStatus: 'All Status',
  allConditions: 'All Conditions',
  allDepartments: 'All Departments',
  allWarranty: 'All Warranty',
  activeWarranty: 'Active',
  expiredWarranty: 'Expired',
  expiringWarranty: 'Expiring Soon',
  locationPlaceholder: 'Enter location...',
  dateFrom: 'Date From',
  dateTo: 'Date To',
  warrantyStatus: 'Warranty Status',
  name: 'Asset Name',
  category: 'Category',
  serialNumber: 'Serial Number',
  status: 'Status',
  condition: 'Condition',
  department: 'Department',
  location: 'Location',
  actions: 'Actions',
  noAssets: 'No assets found',
  showing: 'Showing',
  of: 'of',
  loading: 'Loading assets...',
  assetId: 'Asset ID',
  brand: 'Brand',
  model: 'Model',
  rfidTag: 'RFID Tag',
  description: 'Description',
  basicInfo: 'Basic Information',
  financialInfo: 'Financial Information',
  assignmentInfo: 'Assignment Information',
  purchaseDate: 'Purchase Date',
  purchaseCost: 'Purchase Cost',
  warrantyExpiry: 'Warranty Expiry',
  currentValue: 'Current Value',
  assignedTo: 'Assigned To',
  assignedDate: 'Assigned Date',
  expectedReturn: 'Expected Return',
  editAsset: 'Edit Asset',
  available: 'Available',
  assigned: 'Assigned',
  inMaintenance: 'Under Maintenance',
  lost: 'Lost',
  disposed: 'Disposed',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged'
};

const amharicTranslations = {
  assets: 'የICT ንብረቶች',
  assetsDesc: 'ሁሉንም ICT መሳሪያዎች እና መገልገያዎች ያስተዳድሩ',
  createNew: 'አዲስ ንብረት ፍጠር',
  exportExcel: 'Excel ወጣ',
  exportPDF: 'PDF ወጣ',
  importAssets: 'ንብረቶችን አስገባ',
  cloneAsset: 'ንብረት ቅጂ',
  search: 'ፈልግ',
  searchPlaceholder: 'በስም፣ መለያ፣ ተከታታይ፣ RFID... ፈልግ',
  allCategories: 'ሁሉም ምድቦች',
  allStatus: 'ሁሉም ሁኔታዎች',
  allConditions: 'ሁሉም ሁኔታዎች',
  allDepartments: 'ሁሉም ክፍሎች',
  allWarranty: 'ሁሉም ዋስትና',
  activeWarranty: 'ንቁ',
  expiredWarranty: 'ያለቀ',
  expiringWarranty: 'የሚያልቅ',
  locationPlaceholder: 'ቦታ ያስገቡ...',
  dateFrom: 'ከቀን',
  dateTo: 'ወደ ቀን',
  warrantyStatus: 'የዋስትና ሁኔታ',
  name: 'የንብረት ስም',
  category: 'ምድብ',
  serialNumber: 'ተከታታይ ቁጥር',
  status: 'ሁኔታ',
  condition: 'ጥራት',
  department: 'ክፍል',
  location: 'ቦታ',
  actions: 'ተግባራት',
  noAssets: 'ምንም ንብረቶች አልተገኙም',
  showing: 'በማሳየት ላይ',
  of: 'ከ',
  loading: 'ንብረቶችን በመጫን ላይ...',
  assetId: 'የንብረት መለያ',
  brand: 'ብራንድ',
  model: 'ሞዴል',
  rfidTag: 'RFID መለያ',
  description: 'መግለጫ',
  basicInfo: 'መሰረታዊ መረጃ',
  financialInfo: 'የፋይናንስ መረጃ',
  assignmentInfo: 'የምደባ መረጃ',
  purchaseDate: 'የግዢ ቀን',
  purchaseCost: 'የግዢ ዋጋ',
  warrantyExpiry: 'የዋስትና ማብቂያ',
  currentValue: 'ወቅታዊ ዋጋ',
  assignedTo: 'የተመደበለት',
  assignedDate: 'የተመደበበት ቀን',
  expectedReturn: 'የሚጠበቀው መመለስ',
  editAsset: 'ንብረት አርትዕ',
  available: 'ይገኛል',
  assigned: 'የተመደበ',
  inMaintenance: 'በጥገና ላይ',
  lost: 'የጠፋ',
  disposed: 'የተወገደ',
  excellent: 'እጅግ ጥሩ',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  damaged: 'የተበላሸ'
};

export default ICTAssets;