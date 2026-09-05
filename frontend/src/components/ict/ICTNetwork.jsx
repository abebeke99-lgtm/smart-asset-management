import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const ICTNetwork = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  // State
  const [allAssets, setAllAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkType, setNetworkType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    byType: {},
    online: 0,
    offline: 0,
    maintenance: 0
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const englishTranslations = {
    networkEquipment: 'Network & Technical Equipment',
    allEquipment: 'All Equipment',
    networkEquip: 'Network Equipment',
    routers: 'Routers',
    switches: 'Switches',
    accessPoints: 'Access Points',
    servers: 'Servers',
    ipInformation: 'IP Information',
    deviceStatus: 'Device Status',
    assetTag: 'Asset Tag',
    assetName: 'Asset Name',
    category: 'Category',
    serialNumber: 'Serial Number',
    brand: 'Brand',
    model: 'Model',
    ipAddress: 'IP Address',
    macAddress: 'MAC Address',
    hostname: 'Hostname',
    location: 'Location',
    status: 'Status',
    department: 'Department',
    lastUpdate: 'Last Updated',
    search: 'Search by asset, IP, or hostname...',
    noEquipment: 'No network equipment found',
    loading: 'Loading network equipment...',
    export: 'Export to Excel',
    refresh: 'Refresh',
    fetchError: 'Failed to load equipment',
    online: 'Online',
    offline: 'Offline',
    maintenance: 'Maintenance',
    unknown: 'Unknown',
    total: 'Total',
    page: 'Page',
    of: 'of',
    previousPage: 'Previous',
    nextPage: 'Next',
    note: 'IP information displayed only if configured in the system'
  };

  const amharicTranslations = {
    networkEquipment: 'ネットワーク & ቴክኒካል መሳሪያ',
    allEquipment: 'ሁሉም መሳሪያ',
    networkEquip: 'ネットワーク መሳሪያ',
    routers: 'ራውተሮች',
    switches: 'ስዊቶች',
    accessPoints: 'ዳራ ነጥቦች',
    servers: 'አገልግሎት ሰጪዎች',
    ipInformation: 'IP መረጃ',
    deviceStatus: 'ስልት ሁኔታ',
    assetTag: 'ንብረት ታግ',
    assetName: 'ንብረት ስም',
    category: 'ምድብ',
    serialNumber: 'ተከታታይ ቁጥር',
    brand: 'ብራንድ',
    model: 'ሞዴል',
    ipAddress: 'IP አድራሻ',
    macAddress: 'MAC አድራሻ',
    hostname: 'ሆስታዊ ስም',
    location: 'ቦታ',
    status: 'ሁኔታ',
    department: 'ክፍል',
    lastUpdate: 'ቅርብ ጊዜ ተሻሽሏል',
    search: 'በንብረት፣ IP ወይም ሆስታዊ ስም ይፈልጉ...',
    noEquipment: 'ネットワーク መሳሪያ አልተገኙም',
    loading: 'ネットワーク መሳሪያን በማስጫን ላይ...',
    export: 'Excelに書き出す',
    refresh: 'ዳግም ሙላት',
    fetchError: 'መሳሪያን ማስጫን ወደ ውድቅ ደረሰ',
    online: 'በመስመር ላይ',
    offline: 'ከመስመር ውጭ',
    maintenance: 'ጥገና',
    unknown: 'ያልታወቀ',
    total: 'አጠቃላይ',
    page: 'ገጽ',
    of: 'ስብስብ',
    previousPage: 'ቀደም',
    nextPage: 'ተከታዩ',
    note: 'IP መረጃ በስርዓቱ ውስጥ ከተዋቀረ ብቻ ይታያል'
  };

  const networkCategories = [
    { value: 'routers', label: t.routers, filter: c => c && c.toLowerCase().includes('router') },
    { value: 'switches', label: t.switches, filter: c => c && c.toLowerCase().includes('switch') },
    { value: 'access_points', label: t.accessPoints, filter: c => c && (c.toLowerCase().includes('access point') || c.toLowerCase().includes('ap')) },
    { value: 'servers', label: t.servers, filter: c => c && c.toLowerCase().includes('server') },
  ];

  // Fetch network equipment
  const fetchEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/assets', {
        params: { limit: 1000 }
      });

      let assets = response.data.assets || [];
      
      // Filter for network equipment
      assets = assets.filter(a => 
        a.category_name && (
          a.category_name.toLowerCase().includes('router') ||
          a.category_name.toLowerCase().includes('switch') ||
          a.category_name.toLowerCase().includes('access point') ||
          a.category_name.toLowerCase().includes('network') ||
          a.category_name.toLowerCase().includes('server') ||
          a.category_name.toLowerCase().includes('firewall') ||
          a.category_name.toLowerCase().includes('modem') ||
          a.category_name.toLowerCase().includes('gateway')
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
    assets.forEach(a => {
      const category = a.category_name || 'Other';
      byType[category] = (byType[category] || 0) + 1;
    });

    setStats({
      total: assets.length,
      byType,
      online: assets.filter(a => a.status && a.status.toLowerCase() === 'available').length,
      offline: assets.filter(a => a.status && a.status.toLowerCase() === 'missing').length,
      maintenance: assets.filter(a => a.status && a.status.toLowerCase() === 'maintenance').length
    });
  };

  // Apply filters
  const applyFilters = useCallback((assets) => {
    let filtered = assets;

    // Network type filter
    if (networkType !== 'all') {
      const selectedCategory = networkCategories.find(c => c.value === networkType);
      if (selectedCategory) {
        filtered = filtered.filter(a => selectedCategory.filter(a.category_name));
      }
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status && a.status.toLowerCase() === filterStatus.toLowerCase());
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
  }, [networkType, filterStatus, searchQuery]);

  const exportToExcel = () => {
    if (filteredAssets.length === 0) {
      toast.warning('No data to export');
      return;
    }

    const data = filteredAssets.map(a => ({
      'Asset Tag': a.asset_tag,
      'Asset Name': a.name,
      'Category': a.category_name,
      'Serial Number': a.serial_number || '-',
      'Brand': a.brand || a.manufacturer || '-',
      'Model': a.model || '-',
      'Status': a.status,
      'Department': a.department_name || a.department || '-',
      'Location': a.location || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Network Equipment');
    XLSX.writeFile(wb, 'network_equipment.xlsx');
    toast.success('File exported successfully');
  };

  // Effects
  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  useEffect(() => {
    applyFilters(allAssets);
  }, [networkType, filterStatus, searchQuery, applyFilters]);

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
      if (status === 'Maintenance') return { ...baseStyle, backgroundColor: '#fed7aa', color: '#92400e' };
      if (status === 'Missing') return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
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
    },
    note: {
      padding: '12px 16px',
      backgroundColor: isDark ? '#1f2937' : '#f3f4f6',
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '6px',
      marginBottom: '20px',
      fontSize: '13px',
      color: isDark ? '#d1d5db' : '#6b7280'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{t.networkEquipment}</h1>
        <div style={styles.buttonGroup}>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={fetchEquipment}>
            {t.refresh}
          </button>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={exportToExcel}>
            {t.export}
          </button>
        </div>
      </div>

      {/* Note about IP information */}
      <div style={styles.note}>
        ℹ️ {t.note}
      </div>

      {/* Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.total}</div>
          <div style={styles.statValue}>{stats.total}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.online}</div>
          <div style={{ ...styles.statValue, color: '#10b981' }}>{stats.online}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.maintenance}</div>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.maintenance}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t.offline}</div>
          <div style={{ ...styles.statValue, color: '#ef4444' }}>{stats.offline}</div>
        </div>
      </div>

      {/* Network Type Categories */}
      <div style={styles.categoriesContainer}>
        <button
          style={styles.categoryButton(networkType === 'all')}
          onClick={() => setNetworkType('all')}
        >
          {t.allEquipment}
        </button>
        {networkCategories.map(cat => (
          <button
            key={cat.value}
            style={styles.categoryButton(networkType === cat.value)}
            onClick={() => setNetworkType(cat.value)}
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
          <option value="available">{t.online}</option>
          <option value="maintenance">{t.maintenance}</option>
          <option value="missing">{t.offline}</option>
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
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
                  <th style={styles.th}>{t.location}</th>
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
                    <td style={styles.td}>{asset.location || '-'}</td>
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

export default ICTNetwork;
