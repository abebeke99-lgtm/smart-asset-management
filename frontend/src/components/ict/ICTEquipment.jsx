import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const ICTEquipment = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  // State
  const [allAssets, setAllAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [equipmentType, setEquipmentType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    byType: {},
    byStatus: {},
    byCondition: {}
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const englishTranslations = {
    itEquipment: 'IT Equipment',
    allEquipment: 'All Equipment',
    computers: 'Computers',
    laptops: 'Laptops',
    printers: 'Printers',
    servers: 'Servers',
    networkDevices: 'Network Devices',
    monitors: 'Monitors',
    ups: 'UPS',
    otherDevices: 'Other Devices',
    assetTag: 'Asset Tag',
    assetName: 'Asset Name',
    category: 'Category',
    serialNumber: 'Serial Number',
    brand: 'Brand',
    model: 'Model',
    department: 'Department',
    location: 'Location',
    status: 'Status',
    condition: 'Condition',
    assignedTo: 'Assigned To',
    purchaseDate: 'Purchase Date',
    warranty: 'Warranty',
    search: 'Search by asset tag, name, or serial number...',
    noEquipment: 'No equipment found',
    loading: 'Loading equipment...',
    export: 'Export to Excel',
    refresh: 'Refresh',
    view: 'View',
    details: 'Details',
    fetchError: 'Failed to load equipment',
    available: 'Available',
    assigned: 'Assigned',
    maintenance: 'Maintenance',
    damaged: 'Damaged',
    missing: 'Missing',
    new: 'New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    total: 'Total',
    page: 'Page',
    of: 'of',
    previousPage: 'Previous',
    nextPage: 'Next'
  };

  const amharicTranslations = {
    itEquipment: 'ኢቲ መሳሪያ',
    allEquipment: 'ሁሉም መሳሪያ',
    computers: 'ኮምፒተሮች',
    laptops: 'ላፕቶፖች',
    printers: 'ገፁ ማተሚያ',
    servers: 'አገልግሎት ሰጪ',
    networkDevices: 'ネットワーク ডিভাইস',
    monitors: 'ስክሪኖች',
    ups: 'UPS',
    otherDevices: 'ሌሎች መሳሪያ',
    assetTag: 'ንብረት ታግ',
    assetName: 'ንብረት ስም',
    category: 'ምድብ',
    serialNumber: 'ተከታታይ ቁጥር',
    brand: 'ብራንድ',
    model: 'ሞዴል',
    department: 'ክፍል',
    location: 'ቦታ',
    status: 'ሁኔታ',
    condition: 'ሁኔታ',
    assignedTo: 'ተሰጠ ለ',
    purchaseDate: 'ወደ ገንዘብ ታሪክ',
    warranty: 'ትዋቅይት',
    search: 'የንብረት ታግ፣ ስም ወይም ተከታታይ ቁጥር ይፈልጉ...',
    noEquipment: 'መሳሪያ አልተገኙም',
    loading: 'መሳሪያን በማስጫን ላይ...',
    export: 'Excelに書き出す',
    refresh: 'ዳግም ሙላት',
    view: 'ይመልከቱ',
    details: 'ዝርዝር',
    fetchError: 'መሳሪያን ማስጫን ወደ ውድቅ ደረሰ',
    available: 'አመቻች',
    assigned: 'ተሰጠ',
    maintenance: 'ጥገና',
    damaged: 'ተሰቅፎ',
    missing: 'የጠፋ',
    new: '새로운',
    good: 'ጥሩ',
    fair: 'ፍትሃዊ',
    poor: 'ደካማ',
    total: 'አጠቃላይ',
    page: 'ገጽ',
    of: 'ስብስብ',
    previousPage: 'ቀደም',
    nextPage: 'ተከታዩ'
  };

  const equipmentCategories = [
    { value: 'computers', label: t.computers, filter: c => c && (c.toLowerCase().includes('computer') || c.toLowerCase().includes('desktop')) },
    { value: 'laptops', label: t.laptops, filter: c => c && c.toLowerCase().includes('laptop') },
    { value: 'printers', label: t.printers, filter: c => c && c.toLowerCase().includes('printer') },
    { value: 'servers', label: t.servers, filter: c => c && c.toLowerCase().includes('server') },
    { value: 'network', label: t.networkDevices, filter: c => c && (c.toLowerCase().includes('network') || c.toLowerCase().includes('router') || c.toLowerCase().includes('switch')) },
    { value: 'monitors', label: t.monitors, filter: c => c && c.toLowerCase().includes('monitor') },
    { value: 'ups', label: t.ups, filter: c => c && c.toLowerCase().includes('ups') },
    { value: 'other', label: t.otherDevices, filter: () => true }
  ];

  // Fetch equipment
  const fetchEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/assets', {
        params: { limit: 1000 }
      });

      let assets = response.data.assets || [];
      
      // Filter for ICT equipment
      assets = assets.filter(a => 
        a.category_name && (
          a.category_name.toLowerCase().includes('computer') ||
          a.category_name.toLowerCase().includes('printer') ||
          a.category_name.toLowerCase().includes('server') ||
          a.category_name.toLowerCase().includes('network') ||
          a.category_name.toLowerCase().includes('monitor') ||
          a.category_name.toLowerCase().includes('ups') ||
          a.category_name.toLowerCase().includes('keyboard') ||
          a.category_name.toLowerCase().includes('mouse') ||
          a.category_name.toLowerCase().includes('device') ||
          a.category_name.toLowerCase().includes('equipment')
        )
      );

      setAllAssets(assets);
      calculateStats(assets);
      applyFilters(assets);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load equipment');
      setAllAssets([]);
    }
    setLoading(false);
  }, [t]);

  // Calculate statistics
  const calculateStats = (assets) => {
    const byType = {};
    const byStatus = {};
    const byCondition = {};

    assets.forEach(a => {
      const category = a.category_name || 'Other';
      const status = a.status || 'Unknown';
      const condition = a.condition || 'Unknown';

      byType[category] = (byType[category] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
      byCondition[condition] = (byCondition[condition] || 0) + 1;
    });

    setStats({
      total: assets.length,
      byType,
      byStatus,
      byCondition
    });
  };

  // Apply filters
  const applyFilters = useCallback((assets) => {
    let filtered = assets;

    // Equipment type filter
    if (equipmentType !== 'all') {
      const selectedCategory = equipmentCategories.find(c => c.value === equipmentType);
      if (selectedCategory) {
        filtered = filtered.filter(a => selectedCategory.filter(a.category_name));
      }
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status && a.status.toLowerCase() === filterStatus.toLowerCase());
    }

    // Condition filter
    if (filterCondition !== 'all') {
      filtered = filtered.filter(a => a.condition && a.condition.toLowerCase() === filterCondition.toLowerCase());
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        (a.asset_tag && a.asset_tag.toLowerCase().includes(query)) ||
        (a.name && a.name.toLowerCase().includes(query)) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(query))
      );
    }

    setFilteredAssets(filtered);
    setCurrentPage(1);
  }, [equipmentType, filterStatus, filterCondition, searchQuery]);

  const exportToExcel = () => {
    if (filteredAssets.length === 0) {
      toast.warning('No data to export');
      return;
    }

    const data = filteredAssets.map(a => ({
      'Asset Tag': a.asset_tag,
      'Asset Name': a.name,
      'Category': a.category_name,
      'Serial Number': a.serial_number,
      'Brand': a.brand || a.manufacturer,
      'Model': a.model,
      'Status': a.status,
      'Condition': a.condition,
      'Department': a.department_name || a.department,
      'Location': a.location,
      'Assigned To': a.assigned_to_name || 'Unassigned',
      'Purchase Date': a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '',
      'Warranty Expiry': a.warranty_expiry ? new Date(a.warranty_expiry).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'IT Equipment');
    XLSX.writeFile(wb, 'it_equipment.xlsx');
    toast.success('File exported successfully');
  };

  // Effects
  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  useEffect(() => {
    applyFilters(allAssets);
  }, [equipmentType, filterStatus, filterCondition, searchQuery, applyFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredAssets.length / pageSize);
  const paginatedAssets = filteredAssets.slice(
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
    categoriesContainer: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px',
      overflowX: 'auto',
      paddingBottom: '8px'
    },
    categoryButton: (isActive) => ({
      padding: '8px 14px',
      borderRadius: '6px',
      border: isActive ? '2px solid #3b82f6' : `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
      backgroundColor: isActive ? '#3b82f6' : isDark ? '#1f2937' : '#ffffff',
      color: isActive ? '#ffffff' : isDark ? '#e5e7eb' : '#111827',
      cursor: 'pointer',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      fontSize: '13px'
    }),
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
      if (status === 'Available') return { ...baseStyle, backgroundColor: '#dcfce7', color: '#15803d' };
      if (status === 'Assigned') return { ...baseStyle, backgroundColor: '#dbeafe', color: '#0c4a6e' };
      if (status === 'Maintenance') return { ...baseStyle, backgroundColor: '#fed7aa', color: '#92400e' };
      if (status === 'Damaged') return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
      if (status === 'Missing') return { ...baseStyle, backgroundColor: '#e9d5ff', color: '#6b21a8' };
      return baseStyle;
    },
    conditionBadge: (condition) => {
      const baseStyle = {
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600'
      };
      if (condition === 'New') return { ...baseStyle, backgroundColor: '#d1fae5', color: '#065f46' };
      if (condition === 'Good') return { ...baseStyle, backgroundColor: '#dcfce7', color: '#15803d' };
      if (condition === 'Fair') return { ...baseStyle, backgroundColor: '#fef3c7', color: '#92400e' };
      if (condition === 'Poor') return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
      return baseStyle;
    },
    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      marginTop: '20px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: isDark ? '#9ca3af' : '#6b7280'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{t.itEquipment}</h1>
        <div style={styles.buttonGroup}>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={fetchEquipment}>
            {t.refresh}
          </button>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={exportToExcel}>
            {t.export}
          </button>
        </div>
      </div>

      {/* Equipment Type Categories */}
      <div style={styles.categoriesContainer}>
        <button
          style={styles.categoryButton(equipmentType === 'all')}
          onClick={() => setEquipmentType('all')}
        >
          {t.allEquipment}
        </button>
        {equipmentCategories.map(cat => (
          <button
            key={cat.value}
            style={styles.categoryButton(equipmentType === cat.value)}
            onClick={() => setEquipmentType(cat.value)}
          >
            {cat.label}
          </button>
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
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.select}>
          <option value="all">All Status</option>
          <option value="available">{t.available}</option>
          <option value="assigned">{t.assigned}</option>
          <option value="maintenance">{t.maintenance}</option>
          <option value="damaged">{t.damaged}</option>
          <option value="missing">{t.missing}</option>
        </select>
        <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} style={styles.select}>
          <option value="all">All Conditions</option>
          <option value="new">{t.new}</option>
          <option value="good">{t.good}</option>
          <option value="fair">{t.fair}</option>
          <option value="poor">{t.poor}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p>{t.loading}</p>
        </div>
      ) : paginatedAssets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💻</div>
          <p>{t.noEquipment}</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t.assetTag}</th>
                  <th style={styles.th}>{t.assetName}</th>
                  <th style={styles.th}>{t.category}</th>
                  <th style={styles.th}>{t.serialNumber}</th>
                  <th style={styles.th}>{t.brand}</th>
                  <th style={styles.th}>{t.model}</th>
                  <th style={styles.th}>{t.status}</th>
                  <th style={styles.th}>{t.condition}</th>
                  <th style={styles.th}>{t.department}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.map(asset => (
                  <tr key={asset.id}>
                    <td style={styles.td}>{asset.asset_tag}</td>
                    <td style={styles.td}>{asset.name}</td>
                    <td style={styles.td}>{asset.category_name}</td>
                    <td style={styles.td}>{asset.serial_number || '-'}</td>
                    <td style={styles.td}>{asset.brand || asset.manufacturer || '-'}</td>
                    <td style={styles.td}>{asset.model || '-'}</td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(asset.status)}>
                        {asset.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.conditionBadge(asset.condition)}>
                        {asset.condition}
                      </span>
                    </td>
                    <td style={styles.td}>{asset.department_name || asset.department || '-'}</td>
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
    </div>
  );
};

export default ICTEquipment;
