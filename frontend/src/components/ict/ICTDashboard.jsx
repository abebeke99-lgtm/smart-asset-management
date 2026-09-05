import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

const ICTDashboard = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const navigate = useNavigate();
  
  // State
  const [stats, setStats] = useState({
    totalICT: 0,
    available: 0,
    assigned: 0,
    inMaintenance: 0,
    lost: 0,
    disposed: 0,
    totalInventory: 0,
    lowStock: 0,
    outOfStock: 0,
    pendingMaintenance: 0,
    inProgressMaintenance: 0,
    completedMaintenance: 0,
    overdueMaintenance: 0,
    rfidAlerts: 0,
    recentAssignments: [],
    recentMovements: [],
    recentActivities: [],
    assetByStatus: [],
    assetByCategory: [],
    inventoryByStatus: [],
    maintenanceByStatus: [],
    monthlyTrends: []
  });
  
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    department: 'all',
    category: 'all',
    search: ''
  });
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedStat, setSelectedStat] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch assets
      const assetsRes = await axios.get('/api/assets', { 
        params: { limit: 1000, ...filters } 
      });
      const assets = assetsRes.data?.assets || [];

      // Fetch inventory
      const inventoryRes = await axios.get('/api/inventory', { 
        params: { limit: 1000 } 
      });
      const inventory = inventoryRes.data?.inventory || inventoryRes.data?.items || [];

      // Fetch maintenance
      const maintRes = await axios.get('/api/maintenance', { 
        params: { limit: 1000 } 
      });
      const maintenance = maintRes.data?.requests || [];

      // Fetch RFID logs
      const rfidRes = await axios.get('/api/rfid', {
        params: { limit: 500 } 
      });
      const rfidLogs = rfidRes.data?.logs || [];

      // Fetch assignments
      const assignRes = await axios.get('/api/assignments', { 
        params: { limit: 500 } 
      });
      const assignments = assignRes.data?.assignments || [];

      // Filter ICT assets
      const ictAssets = assets.filter(a => 
        a.category_name === 'Computers' || 
        a.category_name === 'Printers' ||
        a.category_name === 'Servers' ||
        a.category_name === 'Projectors' ||
        a.category_name === 'Networking' ||
        a.category_name === 'Software' ||
        a.department_name === 'Information Technology'
      );

      // Asset statistics
      const byStatus = ictAssets.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});

      const byCategory = ictAssets.reduce((acc, a) => {
        acc[a.category_name || 'Other'] = (acc[a.category_name || 'Other'] || 0) + 1;
        return acc;
      }, {});

      // Inventory statistics
      const inventoryByStatus = inventory.reduce((acc, item) => {
        const status = item.quantity <= 0 ? 'Out of Stock' : 
                       item.quantity <= item.minQuantity ? 'Low Stock' : 'Normal Stock';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Maintenance statistics
      const maintenanceByStatus = maintenance.reduce((acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
      }, {});

      // Calculate overdue
      const overdue = maintenance.filter(m => {
        if (m.status !== 'Pending' && m.status !== 'In-Progress') return false;
        const daysOld = (Date.now() - new Date(m.created_at)) / (1000 * 60 * 60 * 24);
        return daysOld > 7;
      }).length;

      // RFID alerts
      const rfidAlerts = rfidLogs.filter(l => l.is_anomaly).length;

      // Recent assignments (last 10)
      const recentAssignments = assignments
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
        .map(a => ({
          ...a,
          assetName: assets.find(asset => asset.id === a.asset_id)?.name || 'Unknown',
          userName: a.assigned_to_name || 'Unknown'
        }));

      // Recent movements (last 10)
      const recentMovements = rfidLogs
        .filter(l => l.type === 'movement')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

      // Recent activities (combined)
      const activities = [
        ...ictAssets.slice(0, 5).map(a => ({
          type: 'asset',
          title: `📦 ${a.name} - ${a.status}`,
          time: a.updated_at,
          icon: '📦'
        })),
        ...maintenance.slice(0, 5).map(m => ({
          type: 'maintenance',
          title: `🔧 ${m.title} - ${m.status}`,
          time: m.updated_at,
          icon: '🔧'
        })),
        ...assignments.slice(0, 5).map(a => ({
          type: 'assignment',
          title: `📋 ${a.asset_name || 'Asset'} assigned to ${a.assigned_to_name || 'User'}`,
          time: a.created_at,
          icon: '📋'
        }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20);

      // Monthly trends (last 6 months)
      const monthlyTrends = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const monthStart = new Date(year, date.getMonth(), 1);
        const monthEnd = new Date(year, date.getMonth() + 1, 0);
        
        const count = ictAssets.filter(a => {
          const created = new Date(a.created_at);
          return created >= monthStart && created <= monthEnd;
        }).length;
        
        monthlyTrends.push({ month: `${month} ${year}`, count });
      }

      // Update state
      setStats({
        totalICT: ictAssets.length,
        available: byStatus['Available'] || 0,
        assigned: byStatus['Assigned'] || 0,
        inMaintenance: byStatus['Under-Maintenance'] || 0,
        lost: byStatus['Lost'] || 0,
        disposed: byStatus['Disposed'] || 0,
        totalInventory: inventory.length,
        lowStock: inventoryByStatus['Low Stock'] || 0,
        outOfStock: inventoryByStatus['Out of Stock'] || 0,
        pendingMaintenance: maintenanceByStatus['Pending'] || 0,
        inProgressMaintenance: maintenanceByStatus['In-Progress'] || 0,
        completedMaintenance: maintenanceByStatus['Completed'] || 0,
        overdueMaintenance: overdue,
        rfidAlerts: rfidAlerts,
        recentAssignments: recentAssignments,
        recentMovements: recentMovements,
        recentActivities: activities,
        assetByStatus: Object.entries(byStatus).map(([key, value]) => ({ label: key, value })),
        assetByCategory: Object.entries(byCategory).map(([key, value]) => ({ label: key, value })),
        inventoryByStatus: Object.entries(inventoryByStatus).map(([key, value]) => ({ label: key, value })),
        maintenanceByStatus: Object.entries(maintenanceByStatus).map(([key, value]) => ({ label: key, value })),
        monthlyTrends: monthlyTrends
      });

      // Get unique departments and categories for filters
      const depts = [...new Set(assets.map(a => a.department_name).filter(Boolean))];
      const cats = [...new Set(assets.map(a => a.category_name).filter(Boolean))];
      setDepartments(depts);
      setCategories(cats);

    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error(t.fetchError);
    }
    setLoading(false);
  }, [filters, t.fetchError]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Export reports
  const exportReport = async (format) => {
    try {
      if (format === 'excel') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([
          ...stats.assetByStatus.map(s => ({ Type: 'Asset Status', Status: s.label, Count: s.value })),
          ...stats.inventoryByStatus.map(s => ({ Type: 'Inventory Status', Status: s.label, Count: s.value })),
          ...stats.maintenanceByStatus.map(s => ({ Type: 'Maintenance Status', Status: s.label, Count: s.value }))
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Dashboard');
        XLSX.writeFile(wb, `ICT_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(t.exportSuccess);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        doc.text('ICT Dashboard Report', 14, 15);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
        
        const tableData = [
          ...stats.assetByStatus.map(s => ['Asset Status', s.label, s.value]),
          ...stats.inventoryByStatus.map(s => ['Inventory Status', s.label, s.value]),
          ...stats.maintenanceByStatus.map(s => ['Maintenance Status', s.label, s.value])
        ];
        
        doc.autoTable({
          head: [['Category', 'Status', 'Count']],
          body: tableData,
          startY: 35
        });
        
        doc.save(`ICT_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success(t.exportSuccess);
      }
    } catch (error) {
      toast.error(t.exportError);
    }
  };

  // View details on stat click
  const handleStatClick = async (statType, status) => {
    setSelectedStat({ type: statType, status });
    setShowDetailModal(true);
    
    try {
      let endpoint = '/api/assets';
      let params = { limit: 500 };
      
      if (statType === 'assets') {
        params.status = status;
      } else if (statType === 'inventory') {
        endpoint = '/api/inventory';
        if (status === 'Low Stock') params.low_stock = true;
        else if (status === 'Out of Stock') params.out_of_stock = true;
      } else if (statType === 'maintenance') {
        endpoint = '/api/maintenance';
        params.status = status;
      }
      
      const response = await axios.get(endpoint, { params });
      setDetailData(response.data?.assets || response.data?.items || response.data?.requests || []);
    } catch (error) {
      toast.error('Failed to load details');
    }
  };

  // Chart colors
  const chartColors = {
    light: {
      primary: '#2b6cb0',
      secondary: '#4299e1',
      success: '#48bb78',
      warning: '#ed8936',
      danger: '#fc8181',
      purple: '#805ad5',
      background: 'rgba(43, 108, 176, 0.2)'
    },
    dark: {
      primary: '#63b3ed',
      secondary: '#4299e1',
      success: '#48bb78',
      warning: '#ed8936',
      danger: '#fc8181',
      purple: '#805ad5',
      background: 'rgba(99, 179, 237, 0.2)'
    }
  };

  const colors = isDark ? chartColors.dark : chartColors.light;
  const visibleActivities = stats.recentActivities.filter(activity => {
    const query = filters.search.trim().toLowerCase();
    return !query || activity.title.toLowerCase().includes(query);
  });

  // Chart configurations
  const statusChartData = {
    labels: stats.assetByStatus.map(item => item.label),
    datasets: [{
      label: 'Assets by Status',
      data: stats.assetByStatus.map(item => item.value),
      backgroundColor: [colors.success, colors.primary, colors.warning, colors.danger, colors.purple],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const categoryChartData = {
    labels: stats.assetByCategory.map(item => item.label),
    datasets: [{
      label: 'Assets by Category',
      data: stats.assetByCategory.map(item => item.value),
      backgroundColor: ['#2b6cb0', '#4299e1', '#48bb78', '#ed8936', '#805ad5', '#fc8181'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const inventoryChartData = {
    labels: stats.inventoryByStatus.map(item => item.label),
    datasets: [{
      label: 'Inventory Status',
      data: stats.inventoryByStatus.map(item => item.value),
      backgroundColor: [colors.success, colors.warning, colors.danger],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const maintenanceChartData = {
    labels: stats.maintenanceByStatus.map(item => item.label),
    datasets: [{
      label: 'Maintenance Status',
      data: stats.maintenanceByStatus.map(item => item.value),
      backgroundColor: [colors.warning, colors.primary, colors.success, colors.danger],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const trendChartData = {
    labels: stats.monthlyTrends.map(item => item.month),
    datasets: [{
      label: 'Assets Added',
      data: stats.monthlyTrends.map(item => item.count),
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(99, 179, 237, 0.2)' : 'rgba(43, 108, 176, 0.2)',
      fill: true,
      tension: 0.4
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#c8dcf5' : '#1a365d',
          padding: 20
        }
      }
    },
    scales: {
      y: {
        ticks: { color: isDark ? '#8896b0' : '#4a5568' },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { color: isDark ? '#8896b0' : '#4a5568' },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      }
    }
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
    headerLeft: { flex: 1 },
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
    headerRight: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    filterGroup: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    filterSelect: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e8edf5',
      background: isDark ? '#1e2d45' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      cursor: 'pointer'
    },
    filterInput: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e8edf5',
      background: isDark ? '#1e2d45' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px',
      minWidth: '150px'
    },
    exportBtn: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      background: 'linear-gradient(135deg, #2b6cb0, #4299e1)',
      color: 'white',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '14px',
      transition: 'all 0.2s ease'
    },
    statsGrid: { 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
      gap: '16px', 
      marginBottom: '30px' 
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      position: 'relative',
      overflow: 'hidden'
    },
    statCardHover: {
      transform: 'translateY(-2px)',
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,100,0.12)'
    },
    statIcon: (bg) => ({ 
      background: bg, 
      borderRadius: '10px', 
      padding: '12px', 
      color: 'white', 
      fontSize: '1.5rem',
      minWidth: '48px',
      textAlign: 'center'
    }),
    statNumber: { 
      fontSize: '1.75rem', 
      fontWeight: 700, 
      color: isDark ? '#c8dcf5' : '#1a365d' 
    },
    statLabel: { 
      fontSize: '0.85rem', 
      color: isDark ? '#8896b0' : '#4a5568',
      whiteSpace: 'nowrap'
    },
    chartsGrid: { 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
      gap: '24px', 
      marginBottom: '30px' 
    },
    chartCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    chartTitle: { 
      color: isDark ? '#c8dcf5' : '#1a365d', 
      fontSize: '1rem', 
      marginBottom: '16px',
      fontWeight: 600
    },
    activityCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      marginBottom: '30px'
    },
    activityItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      transition: 'all 0.2s ease'
    },
    activityItemHover: {
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
    },
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
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '30px',
      maxWidth: '800px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
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
    modalTable: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    modalTh: {
      padding: '10px',
      textAlign: 'left',
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600
    },
    modalTd: {
      padding: '10px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d'
    }
  };

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>💻 {t.dashboard}</h1>
          <p style={styles.subtitle}>{t.welcome}, {user?.fullName || user?.username} 👋</p>
        </div>
        
        <div style={styles.headerRight}>
          <div style={styles.filterGroup}>
            <select 
              style={styles.filterSelect}
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            >
              <option value="all">📅 {t.allDates}</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>
            
            <select 
              style={styles.filterSelect}
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
            >
              <option value="all">🏢 {t.allDepartments}</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            
            <select 
              style={styles.filterSelect}
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="all">📂 {t.allCategories}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <input 
              style={styles.filterInput}
              type="text"
              placeholder={t.searchPlaceholder}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          
          <button 
            style={styles.exportBtn}
            onClick={() => exportReport('excel')}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            📊 Export
          </button>
        </div>
      </div>

      {/* Asset Statistics */}
      <h3 style={{...styles.chartTitle, marginBottom: '12px'}}>📦 Asset Overview</h3>
      <div style={styles.statsGrid}>
        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('assets', 'Total')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #2b6cb0, #4299e1)')}>💻</div>
          <div>
            <div style={styles.statNumber}>{stats.totalICT}</div>
            <div style={styles.statLabel}>{t.totalICT}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('assets', 'Available')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #48bb78, #68d391)')}>✅</div>
          <div>
            <div style={styles.statNumber}>{stats.available}</div>
            <div style={styles.statLabel}>{t.available}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('assets', 'Assigned')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #4299e1, #63b3ed)')}>📋</div>
          <div>
            <div style={styles.statNumber}>{stats.assigned}</div>
            <div style={styles.statLabel}>{t.assigned}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('assets', 'Under-Maintenance')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #ed8936, #f6ad55)')}>🔧</div>
          <div>
            <div style={styles.statNumber}>{stats.inMaintenance}</div>
            <div style={styles.statLabel}>{t.inMaintenance}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('assets', 'Lost')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #fc8181, #f6ad55)')}>❌</div>
          <div>
            <div style={styles.statNumber}>{stats.lost}</div>
            <div style={styles.statLabel}>{t.lost}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('assets', 'Disposed')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #805ad5, #b794f4)')}>🗑️</div>
          <div>
            <div style={styles.statNumber}>{stats.disposed}</div>
            <div style={styles.statLabel}>{t.disposed}</div>
          </div>
        </div>
      </div>

      {/* Inventory Statistics */}
      <h3 style={{...styles.chartTitle, marginBottom: '12px'}}>📦 Inventory Overview</h3>
      <div style={styles.statsGrid}>
        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('inventory', 'Total')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #2b6cb0, #4299e1)')}>📦</div>
          <div>
            <div style={styles.statNumber}>{stats.totalInventory}</div>
            <div style={styles.statLabel}>{t.totalInventory}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('inventory', 'Low Stock')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #ed8936, #f6ad55)')}>⚠️</div>
          <div>
            <div style={styles.statNumber}>{stats.lowStock}</div>
            <div style={styles.statLabel}>{t.lowStock}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('inventory', 'Out of Stock')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #fc8181, #f6ad55)')}>🚫</div>
          <div>
            <div style={styles.statNumber}>{stats.outOfStock}</div>
            <div style={styles.statLabel}>{t.outOfStock}</div>
          </div>
        </div>
      </div>

      {/* Maintenance Statistics */}
      <h3 style={{...styles.chartTitle, marginBottom: '12px'}}>🔧 Maintenance Overview</h3>
      <div style={styles.statsGrid}>
        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('maintenance', 'Pending')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #ed8936, #f6ad55)')}>⏳</div>
          <div>
            <div style={styles.statNumber}>{stats.pendingMaintenance}</div>
            <div style={styles.statLabel}>{t.pendingMaintenance}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('maintenance', 'In-Progress')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #4299e1, #63b3ed)')}>🔄</div>
          <div>
            <div style={styles.statNumber}>{stats.inProgressMaintenance}</div>
            <div style={styles.statLabel}>{t.inProgressMaintenance}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('maintenance', 'Completed')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #48bb78, #68d391)')}>✅</div>
          <div>
            <div style={styles.statNumber}>{stats.completedMaintenance}</div>
            <div style={styles.statLabel}>{t.completedMaintenance}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('maintenance', 'Overdue')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #fc8181, #f6ad55)')}>🔴</div>
          <div>
            <div style={styles.statNumber}>{stats.overdueMaintenance}</div>
            <div style={styles.statLabel}>{t.overdueMaintenance}</div>
          </div>
        </div>

        <div 
          style={styles.statCard}
          onClick={() => handleStatClick('maintenance', 'RFID Alerts')}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.statCardHover)}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = styles.statCard.boxShadow; }}
        >
          <div style={styles.statIcon('linear-gradient(135deg, #805ad5, #b794f4)')}>🚨</div>
          <div>
            <div style={styles.statNumber}>{stats.rfidAlerts}</div>
            <div style={styles.statLabel}>{t.rfidAlerts}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByStatus}</h3>
          <div style={{ height: '280px' }}>
            <Doughnut data={statusChartData} options={chartOptions} />
          </div>
        </div>
        
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByCategory}</h3>
          <div style={{ height: '280px' }}>
            <Doughnut data={categoryChartData} options={chartOptions} />
          </div>
        </div>
        
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.inventoryStatus}</h3>
          <div style={{ height: '280px' }}>
            <Doughnut data={inventoryChartData} options={chartOptions} />
          </div>
        </div>
        
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.maintenanceStatus}</h3>
          <div style={{ height: '280px' }}>
            <Doughnut data={maintenanceChartData} options={chartOptions} />
          </div>
        </div>
        
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.monthlyTrends}</h3>
          <div style={{ height: '280px' }}>
            <Line data={trendChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div style={styles.activityCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={styles.chartTitle}>{t.recentActivities}</h3>
          <span style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.85rem' }}>{visibleActivities.length} {t.activities}</span>
        </div>
        {visibleActivities.length === 0 ? <p style={styles.emptyState}>{t.noRecentActivities}</p> : visibleActivities.slice(0, 10).map((activity, index) => (
          <div key={index} style={styles.activityItem}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ fontSize: '1.2rem' }}>{activity.icon}</span><span>{activity.title}</span></div>
            <span style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>{new Date(activity.time).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* System health and performance */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}><h3 style={styles.chartTitle}>🩺 {t.systemHealth}</h3>
          {[['Server', t.operational], ['Database', t.operational], ['RFID System', stats.rfidAlerts ? t.attentionRequired : t.operational], ['Backup', t.ready]].map(([label, value]) => <div key={label} style={{ ...styles.activityItem, padding: '10px 0' }}><span>{label}</span><strong style={{ color: value === t.operational || value === t.ready ? colors.success : colors.warning }}>{value}</strong></div>)}
        </div>
        <div style={styles.chartCard}><h3 style={styles.chartTitle}>📈 {t.performance}</h3>
          <div style={{ ...styles.activityItem, padding: '10px 0' }}><span>{t.assetUtilization}</span><strong>{stats.totalICT ? Math.round((stats.assigned / stats.totalICT) * 100) : 0}%</strong></div>
          <div style={{ ...styles.activityItem, padding: '10px 0' }}><span>{t.maintenanceCompletion}</span><strong>{stats.pendingMaintenance + stats.inProgressMaintenance + stats.completedMaintenance ? Math.round((stats.completedMaintenance / (stats.pendingMaintenance + stats.inProgressMaintenance + stats.completedMaintenance)) * 100) : 0}%</strong></div>
          <div style={{ ...styles.activityItem, padding: '10px 0' }}><span>{t.rfidAlerts}</span><strong>{stats.rfidAlerts}</strong></div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={styles.activityCard}><h3 style={styles.chartTitle}>⚡ {t.quickActions}</h3><div style={styles.headerRight}>
        {[[t.createAsset, '/ict/assets/create'], [t.assignAsset, '/ict/assets/assign'], [t.logMaintenance, '/ict/maintenance'], [t.generateReport, '/ict/reports'], [t.monitorRFID, '/ict/rfid']].map(([label, route]) => <button key={route} style={styles.exportBtn} onClick={() => navigate(route)}>{label}</button>)}
      </div></div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {selectedStat?.status} {selectedStat?.type === 'assets' ? 'Assets' : 
                 selectedStat?.type === 'inventory' ? 'Inventory Items' : 'Maintenance Requests'}
              </h3>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            {detailData.length === 0 ? (
              <p style={styles.emptyState}>No records found</p>
            ) : (
              <table style={styles.modalTable}>
                <thead>
                  <tr>
                    <th style={styles.modalTh}>#</th>
                    <th style={styles.modalTh}>Name</th>
                    <th style={styles.modalTh}>Status</th>
                    <th style={styles.modalTh}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.slice(0, 20).map((item, index) => (
                    <tr key={index}>
                      <td style={styles.modalTd}>{index + 1}</td>
                      <td style={styles.modalTd}>{item.name || item.title || 'N/A'}</td>
                      <td style={styles.modalTd}>{item.status || 'N/A'}</td>
                      <td style={styles.modalTd}>
                        {new Date(item.created_at || item.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {detailData.length > 20 && (
              <p style={{ color: isDark ? '#8896b0' : '#4a5568', marginTop: '12px', textAlign: 'center' }}>
                Showing 20 of {detailData.length} records
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  dashboard: 'ICT Dashboard',
  welcome: 'Welcome',
  totalICT: 'Total ICT Assets',
  available: 'Available',
  assigned: 'Assigned',
  inMaintenance: 'In Maintenance',
  lost: 'Lost',
  disposed: 'Disposed',
  totalInventory: 'Total Inventory',
  lowStock: 'Low Stock Items',
  outOfStock: 'Out of Stock',
  pendingMaintenance: 'Pending',
  inProgressMaintenance: 'In Progress',
  completedMaintenance: 'Completed',
  overdueMaintenance: 'Overdue',
  rfidAlerts: 'RFID Alerts',
  assetsByStatus: 'Assets by Status',
  assetsByCategory: 'Assets by Category',
  inventoryStatus: 'Inventory Status',
  maintenanceStatus: 'Maintenance Status',
  monthlyTrends: 'Monthly Trends',
  recentActivities: 'Recent Activities',
  activities: 'activities',
  noRecentActivities: 'No recent activities',
  loading: 'Loading...',
  fetchError: 'Failed to load dashboard data',
  exportSuccess: 'Report exported successfully',
  exportError: 'Failed to export report',
  allDates: 'All Dates',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  searchPlaceholder: 'Search...',
  systemHealth: 'System Health',
  performance: 'Performance Metrics',
  operational: 'Operational',
  attentionRequired: 'Attention required',
  ready: 'Ready',
  assetUtilization: 'Asset Utilization',
  maintenanceCompletion: 'Maintenance Completion',
  quickActions: 'Quick Actions',
  createAsset: 'Create Asset',
  assignAsset: 'Assign Asset',
  logMaintenance: 'Log Maintenance',
  generateReport: 'Generate Report',
  monitorRFID: 'Monitor RFID'
};

const amharicTranslations = {
  dashboard: 'የICT ዳሽቦርድ',
  welcome: 'እንኳን ደህና መጡ',
  totalICT: 'ጠቅላላ ICT ንብረቶች',
  available: 'ይገኛል',
  assigned: 'የተመደቡ',
  inMaintenance: 'በጥገና ላይ',
  lost: 'የጠፉ',
  disposed: 'የተወገዱ',
  totalInventory: 'ጠቅላላ ክምችት',
  lowStock: 'አነስተኛ ክምችት',
  outOfStock: 'ክምችት የሌለ',
  pendingMaintenance: 'በመጠባበቅ ላይ',
  inProgressMaintenance: 'በሂደት ላይ',
  completedMaintenance: 'ተጠናቅቋል',
  overdueMaintenance: 'የዘገየ',
  rfidAlerts: 'RFID ማስጠንቀቂያዎች',
  assetsByStatus: 'በሁኔታ የተከፋፈሉ ንብረቶች',
  assetsByCategory: 'በምድብ የተከፋፈሉ ንብረቶች',
  inventoryStatus: 'የክምችት ሁኔታ',
  maintenanceStatus: 'የጥገና ሁኔታ',
  monthlyTrends: 'ወርሃዊ አዝማሚያዎች',
  recentActivities: 'የቅርብ ጊዜ እንቅስቃሴዎች',
  activities: 'እንቅስቃሴዎች',
  noRecentActivities: 'ምንም የቅርብ ጊዜ እንቅስቃሴዎች የሉም',
  loading: 'በመጫን ላይ...',
  fetchError: 'የዳሽቦርድ መረጃ መጫን አልተሳካም',
  exportSuccess: 'ሪፖርት በተሳካ ሁኔታ ወጥቷል',
  exportError: 'ሪፖርት ማውጣት አልተሳካም',
  allDates: 'ሁሉም ቀናት',
  allDepartments: 'ሁሉም ዲፓርትመንቶች',
  allCategories: 'ሁሉም ምድቦች',
  searchPlaceholder: 'ፈልግ...',
  systemHealth: 'የስርዓት ጤና',
  performance: 'አፈጻጸም መለኪያዎች',
  operational: 'ሥራ ላይ',
  attentionRequired: 'ትኩረት ያስፈልጋል',
  ready: 'ዝግጁ',
  assetUtilization: 'ንብረቶች ጥቅም ላይ መዋል',
  maintenanceCompletion: 'ጥገና ማጠናቀቅ',
  quickActions: 'ፈጣን እርምጃዎች',
  createAsset: 'ንብረት ፍጠር',
  assignAsset: 'ንብረት ምደባ',
  logMaintenance: 'ጥገናን ምዝግብ',
  generateReport: 'ሪፖርት ፍጠር',
  monitorRFID: 'RFID ክትትል'
};

export default ICTDashboard;