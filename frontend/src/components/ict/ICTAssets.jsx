import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ChevronLeft, ChevronRight, Eye, Edit2, Trash2, Download, Upload, AlertCircle, TrendingUp } from 'lucide-react';

const ICTAssets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  // State for assets
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for filters
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
    condition: 'all',
    department: 'all',
    location: '',
    dateFrom: '',
    dateTo: '',
  });

  // State for pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0,
  });

  // State for summary
  const [summary, setSummary] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    maintenance: 0,
    damaged: 0,
    missing: 0,
    retired: 0,
  });

  // State for options
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);

  // State for modals
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const importInputRef = useRef(null);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Verify authentication
  useEffect(() => {
    if (!user || !['admin', 'ict_officer'].includes(user.role)) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [deptsRes, catsRes] = await Promise.all([
        axios.get('/api/departments'),
        axios.get('/api/categories'),
      ]);

      setDepartments(deptsRes.data.departments || []);
      setCategories(catsRes.data.categories || catsRes.data.items || []);
    } catch (err) {
      console.error('Failed to load options:', err);
      toast.error(t.failedLoadOptions || 'Failed to load filter options');
    }

    await fetchAssets();
  }, []);

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        limit: pagination.itemsPerPage,
        page: pagination.currentPage,
      };

      // Add filters
      if (filters.search?.trim()) {
        params.search = filters.search.trim();
      }
      if (filters.category && filters.category !== 'all') {
        params.category = filters.category;
      }
      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.condition && filters.condition !== 'all') {
        params.condition = filters.condition;
      }
      if (filters.department && filters.department !== 'all') {
        params.department = filters.department;
      }
      if (filters.location?.trim()) {
        params.location = filters.location.trim();
      }
      if (filters.dateFrom) {
        params.dateFrom = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.dateTo = filters.dateTo;
      }

      const response = await axios.get('/api/assets', { params });

      const assetList = response.data.assets || response.data.data || [];
      setAssets(assetList);
      setSummary(response.data.summary || summary);

      setPagination((prev) => ({
        ...prev,
        totalItems: response.data.total || 0,
        totalPages: Math.ceil((response.data.total || 0) / prev.itemsPerPage),
      }));
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError(err.response?.data?.message || t.failedLoadAssets || 'Failed to load assets');
      if (err.response?.status === 403) {
        toast.error(t.accessDenied || 'You do not have permission to view ICT assets');
      } else if (err.response?.status === 401) {
        navigate('/login');
      } else {
        toast.error(t.failedLoadAssets || 'Failed to load assets');
      }
    }

    setLoading(false);
  }, [filters, pagination.currentPage, pagination.itemsPerPage, navigate, t]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch assets when filters/pagination change
  useEffect(() => {
    if (!loading) {
      fetchAssets();
    }
  }, [filters, pagination.currentPage, pagination.itemsPerPage, fetchAssets, loading]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      status: 'all',
      condition: 'all',
      department: 'all',
      location: '',
      dateFrom: '',
      dateTo: '',
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // View asset details
  const handleViewAsset = async (assetId) => {
    try {
      const response = await axios.get(`/api/assets/${assetId}`);
      setSelectedAsset(response.data.asset || response.data.data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load asset details:', err);
      toast.error(t.failedLoadDetails || 'Failed to load asset details');
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
      toast.success(t.assetUpdated || 'Asset updated successfully');
      setShowEditModal(false);
      fetchAssets();
    } catch (err) {
      console.error('Failed to update asset:', err);
      toast.error(err.response?.data?.message || t.failedUpdate || 'Failed to update asset');
    }

    setLoading(false);
  };

  // Delete asset
  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm(t.confirmDelete || 'Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      await axios.delete(`/api/assets/${assetId}`);
      toast.success(t.assetDeleted || 'Asset deleted successfully');
      fetchAssets();
    } catch (err) {
      console.error('Failed to delete asset:', err);
      toast.error(err.response?.data?.message || t.failedDelete || 'Failed to delete asset');
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = assets.map((asset) => ({
      'Asset ID': asset.id,
      'Name': asset.name,
      'Category': asset.category || asset.category_name || 'N/A',
      'Asset Code': asset.assetCode || asset.asset_tag || 'N/A',
      'Serial Number': asset.serialNumber || asset.serial_number || 'N/A',
      'RFID Tag': asset.rfidTag || asset.rfid_tag || 'N/A',
      'Status': asset.status || 'N/A',
      'Condition': asset.condition || asset.condition_status || 'N/A',
      'Department': asset.department || asset.department_name || 'N/A',
      'Location': asset.location || 'N/A',
      'Manufacturer': asset.manufacturer || 'N/A',
      'Model': asset.model || 'N/A',
      'Purchase Date': asset.purchaseDate || asset.purchase_date || 'N/A',
      'Purchase Cost': asset.purchasePrice || asset.purchase_cost || 0,
      'Warranty Expiry': asset.warrantyExpiry || asset.warranty_expiry || 'N/A',
      'Assigned To': asset.assigned_to_name || 'Unassigned',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'ICT Assets');
    XLSX.writeFile(wb, `ICT_Assets_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t.exportSuccess || 'Export successful');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(t.assets || 'ICT Assets Report', 14, 15);
    doc.text(`${t.generatedDate || 'Generated'}: ${new Date().toLocaleString()}`, 14, 25);

    const tableData = assets.slice(0, 50).map((asset) => [
      asset.id,
      asset.name,
      asset.category || asset.category_name || 'N/A',
      asset.status || 'N/A',
      asset.department || asset.department_name || 'N/A',
      asset.location || 'N/A',
    ]);

    doc.autoTable({
      head: [[t.assetId || 'ID', t.name || 'Name', t.category || 'Category', t.status || 'Status', t.department || 'Department', t.location || 'Location']],
      body: tableData,
      startY: 35,
    });

    doc.save(`ICT_Assets_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success(t.exportSuccess || 'Export successful');
  };

  // Import assets
  const handleImportAssets = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

      if (!rows.length) {
        toast.error(t.noAssetRows || 'The selected file has no asset rows');
        return;
      }

      const results = await Promise.allSettled(
        rows.map((row) =>
          axios.post('/api/assets', {
            name: row.Name || row['Asset Name'] || '',
            assetCode: row['Asset ID'] || row.ID || row['Asset Code'] || '',
            category: row.Category || '',
            manufacturer: row.Brand || row.Manufacturer || '',
            model: row.Model || '',
            serialNumber: row['Serial Number'] || '',
            rfidTag: row.RFID || '',
            status: row.Status || 'available',
            condition: row.Condition || 'Good',
            department: row.Department || '',
            location: row.Location || '',
            purchaseDate: row['Purchase Date'] || null,
            purchasePrice: Number(row['Purchase Cost'] || 0),
            warrantyExpiry: row['Warranty Expiry'] || null,
            notes: row.Notes || '',
          })
        )
      );

      const imported = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - imported;

      toast.success(`${imported} ${t.assetsImported || 'assets imported'}${failed ? `, ${failed} ${t.failed || 'failed'}` : ''}`);
      fetchAssets();
    } catch (err) {
      console.error('Failed to import assets:', err);
      toast.error(t.failedImport || 'Failed to import assets');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      available: '#48bb78',
      assigned: '#4299e1',
      'in-use': '#4299e1',
      'under-maintenance': '#ed8936',
      maintenance: '#ed8936',
      'in-maintenance': '#ed8936',
      lost: '#fc8181',
      missing: '#fc8181',
      disposed: '#805ad5',
      retired: '#805ad5',
      damaged: '#e53e3e',
    };
    const key = String(status || '').toLowerCase().replace(/[_\s]/g, '-');
    return colors[key] || '#718096';
  };

  // Get condition color
  const getConditionColor = (condition) => {
    const colors = {
      excellent: '#48bb78',
      good: '#4299e1',
      fair: '#ed8936',
      poor: '#fc8181',
      damaged: '#e53e3e',
    };
    const key = String(condition || '').toLowerCase();
    return colors[key] || '#718096';
  };

  // Check if any filters are active
  const isFilterActive =
    filters.search ||
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    filters.condition !== 'all' ||
    filters.department !== 'all' ||
    filters.location ||
    filters.dateFrom ||
    filters.dateTo;

  // Styles
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1800px',
      margin: '0 auto',
      backgroundColor: isDark ? '#0d1b2a' : '#f8f9fa',
      minHeight: '100vh',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      flexWrap: 'wrap',
      gap: '16px',
    },
    titleSection: {
      flex: 1,
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '2rem',
      fontWeight: 700,
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '14px',
      margin: '0',
    },
    actions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
    },
    actionBtn: (bg = '#2b6cb0') => ({
      padding: '10px 16px',
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
      gap: '8px',
      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
    }),
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    },
    summaryCard: (borderColor = '#2b6cb0') => ({
      background: isDark ? '#1e2d45' : '#ffffff',
      border: `2px solid ${borderColor}`,
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark ? '0 6px 16px rgba(0,0,0,0.4)' : '0 6px 16px rgba(0,0,100,0.1)',
      },
    }),
    summaryNumber: {
      fontSize: '28px',
      fontWeight: 700,
      color: isDark ? '#63b3ed' : '#2b6cb0',
      margin: '8px 0',
    },
    summaryLabel: {
      fontSize: '12px',
      color: isDark ? '#8896b0' : '#4a5568',
      textTransform: 'uppercase',
      fontWeight: 600,
      letterSpacing: '0.5px',
    },
    filterSection: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '24px',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
    },
    filterGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    filterLabel: {
      fontSize: '12px',
      fontWeight: 600,
      color: isDark ? '#8896b0' : '#4a5568',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    },
    filterInput: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e2e8f0',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      width: '100%',
      fontFamily: 'inherit',
    },
    filterSelect: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e2e8f0',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      width: '100%',
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    filterButtons: {
      display: 'flex',
      gap: '8px',
      marginTop: '12px',
      gridColumn: '1 / -1',
    },
    tableWrapper: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      overflow: 'hidden',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      padding: '14px 16px',
      textAlign: 'left',
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      backgroundColor: isDark ? '#0d1b2a' : '#f7fafc',
    },
    td: {
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
    },
    row: {
      cursor: 'pointer',
      transition: 'background 0.15s ease',
      ':hover': {
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      },
    },
    statusBadge: (color) => ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
    }),
    actionBtnSmall: (bg = '#4299e1') => ({
      padding: '6px 12px',
      borderRadius: '6px',
      border: 'none',
      background: bg,
      color: 'white',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '12px',
      transition: 'all 0.2s ease',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }),
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderTop: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
    },
    paginationBtn: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: isDark ? '1px solid #32465f' : '1px solid #e2e8f0',
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      cursor: 'pointer',
      margin: '0 4px',
      fontFamily: 'inherit',
    },
    paginationBtnActive: {
      background: '#2b6cb0',
      color: 'white',
      border: 'none',
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
      padding: '20px',
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '30px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      paddingBottom: '16px',
    },
    modalTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: 0,
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: isDark ? '#8896b0' : '#4a5568',
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568',
    },
    errorState: {
      padding: '20px',
      borderRadius: '12px',
      background: isDark ? 'rgba(252, 129, 129, 0.1)' : 'rgba(245, 202, 202, 0.5)',
      border: `2px solid #fc8181`,
      color: '#e53e3e',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
  };

  // Render loading state
  if (loading && assets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div>{t.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <div style={styles.title}>
            <TrendingUp size={32} style={{ color: '#2b6cb0' }} />
            {t.assets}
          </div>
          <p style={styles.subtitle}>{t.assetsDesc}</p>
        </div>
        <div style={styles.actions}>
          {user?.role === 'ict_officer' || user?.role === 'admin' ? (
            <button
              style={styles.actionBtn('#2b6cb0')}
              onClick={() => navigate('/ict/assets/create')}
            >
              ➕ {t.createNew}
            </button>
          ) : null}
          <button style={styles.actionBtn('#48bb78')} onClick={exportToExcel}>
            <Download size={16} /> {t.exportExcel}
          </button>
          <button style={styles.actionBtn('#319795')} onClick={() => importInputRef.current?.click()}>
            <Upload size={16} /> {t.importAssets}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImportAssets}
            style={{ display: 'none' }}
          />
          <button style={styles.actionBtn('#805ad5')} onClick={exportToPDF}>
            📄 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={styles.errorState}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', ...styles.actionBtnSmall('#fc8181') }} onClick={() => fetchAssets()}>
            {t.retry || 'Retry'}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary.total > 0 && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard('#2b6cb0')}>
            <div style={styles.summaryLabel}>{t.totalAssets || 'Total Assets'}</div>
            <div style={styles.summaryNumber}>{summary.total || 0}</div>
          </div>
          <div style={styles.summaryCard('#48bb78')}>
            <div style={styles.summaryLabel}>{t.available}</div>
            <div style={styles.summaryNumber}>{summary.available || 0}</div>
          </div>
          <div style={styles.summaryCard('#4299e1')}>
            <div style={styles.summaryLabel}>{t.assigned}</div>
            <div style={styles.summaryNumber}>{summary.assigned || 0}</div>
          </div>
          <div style={styles.summaryCard('#ed8936')}>
            <div style={styles.summaryLabel}>{t.inMaintenance}</div>
            <div style={styles.summaryNumber}>{summary.maintenance || 0}</div>
          </div>
          <div style={styles.summaryCard('#e53e3e')}>
            <div style={styles.summaryLabel}>{t.damaged}</div>
            <div style={styles.summaryNumber}>{summary.damaged || 0}</div>
          </div>
          <div style={styles.summaryCard('#fc8181')}>
            <div style={styles.summaryLabel}>{t.missing || 'Missing'}</div>
            <div style={styles.summaryNumber}>{summary.missing || 0}</div>
          </div>
          <div style={styles.summaryCard('#805ad5')}>
            <div style={styles.summaryLabel}>{t.retired || 'Retired'}</div>
            <div style={styles.summaryNumber}>{summary.retired || 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filterSection}>
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
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name || cat.id}>
                  {cat.name}
                </option>
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
              <option value="available">{t.available}</option>
              <option value="assigned">{t.assigned}</option>
              <option value="in-use">{t.assigned}</option>
              <option value="under-maintenance">{t.inMaintenance}</option>
              <option value="damaged">{t.damaged}</option>
              <option value="missing">{t.missing}</option>
              <option value="lost">{t.lost}</option>
              <option value="disposed">{t.disposed}</option>
              <option value="retired">{t.retired || 'Retired'}</option>
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
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name || dept.id}>
                  {dept.name}
                </option>
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

          <div style={styles.filterButtons}>
            <button style={styles.actionBtn('#2b6cb0')} onClick={() => fetchAssets()}>
              🔍 {t.search}
            </button>
            {isFilterActive && (
              <button style={styles.actionBtn('#8896b0')} onClick={handleClearFilters}>
                ✕ {t.clearFilters || 'Clear Filters'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.assetId}</th>
              <th style={styles.th}>{t.name}</th>
              <th style={styles.th}>{t.category}</th>
              <th style={styles.th}>{t.serialNumber}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.department}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ ...styles.td, textAlign: 'center', padding: '40px' }}>
                  {isFilterActive ? (t.noAssetsMatch || 'No ICT assets match your current filters') : (t.noAssets || 'No ICT assets found')}
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr
                  key={asset.id}
                  style={styles.row}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <span style={{ fontWeight: 600, color: isDark ? '#63b3ed' : '#2b6cb0', cursor: 'pointer' }}>
                      #{asset.id}
                    </span>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <div style={{ fontWeight: 600, cursor: 'pointer' }}>{asset.name}</div>
                    <div style={{ fontSize: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                      {asset.assetCode || asset.asset_tag || 'N/A'}
                    </div>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    {asset.category || asset.category_name || 'N/A'}
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <code style={{ fontSize: '12px' }}>{asset.serialNumber || asset.serial_number || '—'}</code>
                  </td>
                  <td style={styles.td} onClick={() => handleViewAsset(asset.id)}>
                    <span style={styles.statusBadge(getStatusColor(asset.status))}>
                      {asset.status || 'N/A'}
                    </span>
                  </td>
                  <td style={styles.td}>{asset.department || asset.department_name || 'N/A'}</td>
                  <td style={styles.td}>{asset.location || '—'}</td>
                  <td style={styles.td}>
                    <button style={styles.actionBtnSmall('#4299e1')} onClick={() => handleViewAsset(asset.id)}>
                      <Eye size={14} />
                    </button>
                    {user?.role === 'ict_officer' || user?.role === 'admin' ? (
                      <>
                        <button style={styles.actionBtnSmall('#ed8936')} onClick={() => handleEditAsset(asset)}>
                          <Edit2 size={14} />
                        </button>
                        <button style={styles.actionBtnSmall('#fc8181')} onClick={() => handleDeleteAsset(asset.id)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {assets.length > 0 && (
          <div style={styles.pagination}>
            <span style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '14px' }}>
              {t.showing} {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} — {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} {t.of} {pagination.totalItems}
            </span>
            <div>
              <button
                style={styles.paginationBtn}
                onClick={() => setPagination((prev) => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                disabled={pagination.currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    style={{
                      ...styles.paginationBtn,
                      ...(page === pagination.currentPage ? styles.paginationBtnActive : {}),
                    }}
                    onClick={() => setPagination((prev) => ({ ...prev, currentPage: page }))}
                  >
                    {page}
                  </button>
                );
              })}
              {pagination.totalPages > 5 && <span style={{ color: isDark ? '#8896b0' : '#4a5568' }}>...</span>}
              <button
                style={styles.paginationBtn}
                onClick={() => setPagination((prev) => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📋 {selectedAsset.name}</h3>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={styles.filterLabel}>{t.assetId}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  {selectedAsset.id}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.name}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  {selectedAsset.name}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.category}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  {selectedAsset.category || selectedAsset.category_name || 'N/A'}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.status}</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={styles.statusBadge(getStatusColor(selectedAsset.status))}>
                    {selectedAsset.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.serialNumber}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px', fontFamily: 'monospace' }}>
                  {selectedAsset.serialNumber || selectedAsset.serial_number || 'N/A'}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.rfidTag}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px', fontFamily: 'monospace' }}>
                  {selectedAsset.rfidTag || selectedAsset.rfid_tag || 'N/A'}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.department}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  {selectedAsset.department || selectedAsset.department_name || 'N/A'}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.location}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  {selectedAsset.location || '—'}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.purchaseDate}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  {selectedAsset.purchaseDate || selectedAsset.purchase_date
                    ? new Date(selectedAsset.purchaseDate || selectedAsset.purchase_date).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
              <div>
                <div style={styles.filterLabel}>{t.purchaseCost}</div>
                <div style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '14px', marginTop: '4px' }}>
                  ${Number(selectedAsset.purchasePrice || selectedAsset.purchase_cost || 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '16px', background: isDark ? '#0d1b2a' : '#f7fafc', borderRadius: '8px' }}>
              <div style={{ display: 'inline-block', background: 'white', padding: '16px', borderRadius: '8px' }}>
                <QRCodeCanvas value={String(selectedAsset.id)} size={120} />
              </div>
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
              <button style={styles.modalClose} onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={styles.filterLabel}>{t.name}</label>
                  <input
                    type="text"
                    style={styles.filterInput}
                    value={editingAsset.name}
                    onChange={(e) => setEditingAsset((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={styles.filterLabel}>{t.status}</label>
                  <select
                    style={styles.filterSelect}
                    value={editingAsset.status || ''}
                    onChange={(e) => setEditingAsset((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="available">{t.available}</option>
                    <option value="assigned">{t.assigned}</option>
                    <option value="under-maintenance">{t.inMaintenance}</option>
                    <option value="damaged">{t.damaged}</option>
                    <option value="missing">{t.missing}</option>
                    <option value="disposed">{t.disposed}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={styles.actionBtn('#8896b0')}
                  onClick={() => setShowEditModal(false)}
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button type="submit" style={styles.actionBtn('#48bb78')} disabled={loading}>
                  {loading ? '...' : t.save || 'Save'}
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
  assetsDesc: 'View, search, monitor, and manage ICT assets across the university',
  totalAssets: 'Total ICT Assets',
  createNew: 'Create New Asset',
  exportExcel: 'Export Excel',
  exportPDF: 'Export PDF',
  importAssets: 'Import Assets',
  cloneAsset: 'Clone Asset',
  search: 'Search',
  searchPlaceholder: 'Search by name, code, serial, RFID, department, location...',
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
  noAssets: 'No ICT assets found',
  noAssetsMatch: 'No ICT assets match your current filters',
  showing: 'Showing',
  of: 'of',
  loading: 'Loading ICT assets...',
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
  damaged: 'Damaged',
  missing: 'Missing',
  lost: 'Lost',
  disposed: 'Disposed',
  retired: 'Retired',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  clearFilters: 'Clear Filters',
  failedLoadAssets: 'Failed to load ICT assets',
  failedLoadOptions: 'Failed to load filter options',
  failedLoadDetails: 'Failed to load asset details',
  failedUpdate: 'Failed to update asset',
  failedDelete: 'Failed to delete asset',
  failedImport: 'Failed to import assets',
  assetUpdated: 'Asset updated successfully',
  assetDeleted: 'Asset deleted successfully',
  confirmDelete: 'Are you sure you want to delete this asset?',
  retry: 'Retry',
  accessDenied: 'You do not have permission to view ICT assets',
  exportSuccess: 'Export successful',
  assetsImported: 'assets imported',
  failed: 'failed',
  noAssetRows: 'The selected file has no asset rows',
  generatedDate: 'Generated',
  save: 'Save',
  cancel: 'Cancel',
};

const amharicTranslations = {
  assets: 'የICT ንብረቶች',
  assetsDesc: 'ሁሉንም ICT ንብረቶችን በጎ ሙ እይ አሳይ፣ ፈልግ፣ ተከታተል እና ያስተዳድሩ',
  totalAssets: 'ጠቅላላ ICT ንብረቶች',
  createNew: 'አዲስ ንብረት ፍጠር',
  exportExcel: 'Excel ወጣ',
  exportPDF: 'PDF ወጣ',
  importAssets: 'ንብረቶችን አስገባ',
  cloneAsset: 'ንብረት ቅጂ',
  search: 'ፈልግ',
  searchPlaceholder: 'በስም፣ ኮድ፣ ተከታታይ፣ RFID፣ ክፍል፣ ቦታ... ፈልግ',
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
  noAssets: 'ምንም ICT ንብረቶች አልተገኙም',
  noAssetsMatch: 'ምንም ICT ንብረቶች ከአሁኑ ማጣሪያ ጋር አይዛመዱም',
  showing: 'በማሳየት ላይ',
  of: 'ከ',
  loading: 'ICT ንብረቶችን በመጫን ላይ...',
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
  damaged: 'የተበላሸ',
  missing: 'የጠፋ',
  lost: 'የጠፋ',
  disposed: 'የተወገደ',
  retired: 'ተጠናቅቋል',
  excellent: 'እጅግ ጥሩ',
  good: 'ጥሩ',
  fair: 'መካከለኛ',
  poor: 'ደካማ',
  clearFilters: 'ማጣሪያዎች ይጥቀሙ',
  failedLoadAssets: 'ICT ንብረቶችን ማድረጋት ተስኖ',
  failedLoadOptions: 'ማጣሪያ አማራጮችን ማድረጋት ተስኖ',
  failedLoadDetails: 'የንብረት ዝርዝሮችን ማድረጋት ተስኖ',
  failedUpdate: 'ንብረትን ማሻሻል ተስኖ',
  failedDelete: 'ንብረትን ማስወገድ ተስኖ',
  failedImport: 'ንብረቶችን ማስገባት ተስኖ',
  assetUpdated: 'ንብረት በሳቡ ተሻሽሏል',
  assetDeleted: 'ንብረት በሳቡ ተወግዷል',
  confirmDelete: 'ይህን ንብረት ለመሰረዝ እርግጠኛ ነዎት?',
  retry: 'ደግመህ ሞክር',
  accessDenied: 'ICT ንብረቶችን ለማየት ፈቃድ የሎትም',
  exportSuccess: 'ወጣ በሳቡ',
  assetsImported: 'ንብረቶች ገብተዋል',
  failed: 'ተስኖ',
  noAssetRows: 'ተመረጠው ፋይል ምንም ንብረት ረድፎች አላቸው',
  generatedDate: 'ተፈጠረ',
  save: 'ማዳን',
  cancel: 'ተወው',
};

export default ICTAssets;
