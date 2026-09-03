/*
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import axios from 'axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const FinanceDashboard = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPurchaseCost: 0,
    depreciation: 0,
    totalMaintenanceCost: 0,
    assetCount: 0,
    byDepartment: {},
    byCategory: {}
  });
  const [loading, setLoading] = useState(true);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [assetsRes, maintRes] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 500 } }),
        axios.get('/api/maintenance', { params: { limit: 500 } })
      ]);

      const assets = assetsRes.data?.assets || [];
      const maintenance = maintRes.data?.requests || [];

      const totalValue = assets.reduce((sum, a) => sum + (a.current_value || 0), 0);
      const totalPurchaseCost = assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
      const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.actual_cost || 0), 0);

      const byDepartment = assets.reduce((acc, a) => {
        const dept = a.department_name || 'Other';
        acc[dept] = (acc[dept] || 0) + (a.current_value || 0);
        return acc;
      }, {});

      const byCategory = assets.reduce((acc, a) => {
        const cat = a.category_name || 'Other';
        acc[cat] = (acc[cat] || 0) + (a.current_value || 0);
        return acc;
      }, {});

      setStats({
        totalValue,
        totalPurchaseCost,
        depreciation: totalPurchaseCost - totalValue,
        totalMaintenanceCost,
        assetCount: assets.length,
        byDepartment,
        byCategory
      });
    } catch (error) {
      toast.error('Failed to load financial data');
    }
    setLoading(false);
  };

  const deptChartData = {
    labels: Object.keys(stats.byDepartment),
    datasets: [{
      label: 'Value by Department',
      data: Object.values(stats.byDepartment),
      backgroundColor: ['#2b6cb0', '#4299e1', '#48bb78', '#ed8936', '#805ad5', '#fc8181'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#c8dcf5' : '#1a365d'
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

  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' },
    subtitle: { color: isDark ? '#8896b0' : '#4a5568', marginBottom: '24px' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '30px' },
    statCard: { background: isDark ? '#1e2d45' : '#ffffff', padding: '20px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, textAlign: 'center' },
    statNumber: { fontSize: '1.75rem', fontWeight: 700, color: isDark ? '#c8dcf5' : '#1a365d' },
    statLabel: { color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.85rem' },
    chartCard: { background: isDark ? '#1e2d45' : '#ffffff', padding: '20px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, marginBottom: '24px' },
    chartTitle: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px' },
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  if (loading) {
    return <div style={styles.emptyState}>â³ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>ðŸ’° {t.dashboard}</h1>
      <p style={styles.subtitle}>{t.welcome}, {user?.fullName || user?.username} ðŸ‘‹</p>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>${stats.totalValue.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.totalValue}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>${stats.totalPurchaseCost.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.totalPurchaseCost}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>${stats.depreciation.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.depreciation}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#ed8936' }}>${stats.totalMaintenanceCost.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.totalMaintenanceCost}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.assetCount}</div>
          <div style={styles.statLabel}>{t.totalAssets}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>
            {stats.totalPurchaseCost > 0 ? Math.round((stats.totalValue / stats.totalPurchaseCost) * 100) + '%' : '0%'}
          </div>
          <div style={styles.statLabel}>{t.valueRetention}</div>
        </div>
      </div>

      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>{t.valueByDepartment}</h3>
        <div style={{ height: '300px' }}>
          <Bar data={deptChartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

const englishTranslations = {
  dashboard: 'Finance Dashboard',
  welcome: 'Welcome',
  totalValue: 'Total Current Value',
  totalPurchaseCost: 'Total Purchase Cost',
  depreciation: 'Total Depreciation',
  totalMaintenanceCost: 'Total Maintenance Cost',
  totalAssets: 'Total Assets',
  valueRetention: 'Value Retention',
  valueByDepartment: 'Value by Department',
  loading: 'Loading...'
};

const amharicTranslations = {
  dashboard: 'á‹¨á‹á‹­áŠ“áŠ•áˆµ á‹³áˆ½á‰¦áˆ­á‹µ',
  welcome: 'áŠ¥áŠ•áŠ³áŠ• á‹°áˆ…áŠ“ áˆ˜áŒ¡',
  totalValue: 'áŒ á‰…áˆ‹áˆ‹ áŠ áˆáŠ• á‹«áˆˆá‹ á‹‹áŒ‹',
  totalPurchaseCost: 'áŒ á‰…áˆ‹áˆ‹ á‹¨áŒá‹¢ á‹‹áŒ‹',
  depreciation: 'áŒ á‰…áˆ‹áˆ‹ á‹á‹µáˆ˜á‰µ',
  totalMaintenanceCost: 'áŒ á‰…áˆ‹áˆ‹ á‹¨áŒ¥áŒˆáŠ“ á‹‹áŒ‹',
  totalAssets: 'áŒ á‰…áˆ‹áˆ‹ áŠ•á‰¥áˆ¨á‰¶á‰½',
  valueRetention: 'á‹¨á‹‹áŒ‹ áˆ›á‰†á‹¨á‰µ',
  valueByDepartment: 'á‰ áŠ­ááˆ á‹¨á‰°áŠ¨á‹áˆáˆˆ á‹‹áŒ‹',
  loading: 'á‰ áˆ˜áŒ«áŠ• áˆ‹á‹­...'
};

export default FinanceDashboard;
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

const FinanceDashboard = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [disposedAssets, setDisposedAssets] = useState([]);
  const [financialActivities, setFinancialActivities] = useState([]);
  const [auditAlerts, setAuditAlerts] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailType, setDetailType] = useState('');

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    department: '',
    category: '',
    status: '',
    financialYear: ''
  });

  const [stats, setStats] = useState({
    totalAssetCost: 0,
    currentBookValue: 0,
    accumulatedDepreciation: 0,
    totalAssets: 0,
    activeAssets: 0,
    underMaintenance: 0,
    disposed: 0,
    requiringValuation: 0,
    byDepartment: {},
    byCategory: {},
    byStatus: {},
    monthlyTrend: [],
    departmentCosts: {},
    categoryCosts: {}
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (assets.length > 0 || maintenanceRequests.length > 0) {
      calculateStats();
    }
  }, [assets, maintenanceRequests, disposedAssets, filters]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [assetsRes, maintRes, auditRes] = await Promise.all([
        axios.get('/api/finance/valuation', { params: { limit: 1000 } }),
        axios.get('/api/maintenance', { params: { limit: 500 } }),
        axios.get('/api/finance/audit', { params: { limit: 50 } })
      ]);

      const assetData = assetsRes.data?.assets || [];
      const maintenanceData = maintRes.data?.requests || [];
      const auditData = auditRes.data?.logs || [];
      setAssets(assetData);
      setMaintenanceRequests(maintenanceData);
      setDisposedAssets(assetData.filter(asset => asset.status === 'disposed' || asset.status === 'Disposed'));
      setFinancialActivities(auditData);
      setAuditAlerts([]);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load financial data');
      setAssets([]);
      setMaintenanceRequests([]);
      setDisposedAssets([]);
      setFinancialActivities([]);
      setAuditAlerts([]);
    }
    setLoading(false);
  };

  const calculateStats = () => {
    // Apply filters
    let filteredAssets = [...assets];
    
    if (filters.dateFrom) {
      filteredAssets = filteredAssets.filter(a => 
        new Date(a.purchase_date) >= new Date(filters.dateFrom)
      );
    }
    if (filters.dateTo) {
      filteredAssets = filteredAssets.filter(a => 
        new Date(a.purchase_date) <= new Date(filters.dateTo)
      );
    }
    if (filters.financialYear) {
      filteredAssets = filteredAssets.filter(a => {
        const purchaseDate = new Date(a.purchase_date);
        return purchaseDate.getFullYear() === Number(filters.financialYear);
      });
    }
    if (filters.department) {
      filteredAssets = filteredAssets.filter(a => a.department_name === filters.department);
    }
    if (filters.category) {
      filteredAssets = filteredAssets.filter(a => a.category_name === filters.category);
    }
    if (filters.status) {
      filteredAssets = filteredAssets.filter(a => a.status === filters.status);
    }

    const totalAssetCost = filteredAssets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
    const currentBookValue = filteredAssets.reduce((sum, a) => sum + (a.current_value || 0), 0);
    const accumulatedDepreciation = totalAssetCost - currentBookValue;

    const byDepartment = filteredAssets.reduce((acc, a) => {
      const dept = a.department_name || 'Other';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const byCategory = filteredAssets.reduce((acc, a) => {
      const cat = a.category_name || 'Other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const byStatus = filteredAssets.reduce((acc, a) => {
      const status = a.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const departmentCosts = filteredAssets.reduce((acc, a) => {
      const dept = a.department_name || 'Other';
      acc[dept] = (acc[dept] || 0) + (a.current_value || 0);
      return acc;
    }, {});

    const categoryCosts = filteredAssets.reduce((acc, a) => {
      const cat = a.category_name || 'Other';
      acc[cat] = (acc[cat] || 0) + (a.current_value || 0);
      return acc;
    }, {});

    // Monthly trend (last 12 months)
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const month = new Date();
      month.setMonth(month.getMonth() - (11 - i));
      const monthAssets = filteredAssets.filter(a => {
        const date = new Date(a.purchase_date);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      });
      return {
        month: month.toLocaleString('default', { month: 'short' }),
        value: monthAssets.reduce((sum, a) => sum + (a.current_value || 0), 0)
      };
    });

    setStats({
      totalAssetCost,
      currentBookValue,
      accumulatedDepreciation,
      totalAssets: filteredAssets.length,
      activeAssets: filteredAssets.filter(a => a.status === 'Active').length,
      underMaintenance: maintenanceRequests.length,
      disposed: disposedAssets.length,
      requiringValuation: filteredAssets.filter(a => a.requires_valuation).length,
      byDepartment,
      byCategory,
      byStatus,
      monthlyTrend,
      departmentCosts,
      categoryCosts
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      department: '',
      category: '',
      status: '',
      financialYear: ''
    });
  };

  const handleStatClick = (type, filter = {}) => {
    setDetailType(type);
    setSelectedAsset(filter);
    setShowDetailModal(true);
  };

  const exportToExcel = () => {
    const data = assets.map(a => ({
      'Asset Name': a.name || '',
      'Department': a.department_name || '',
      'Category': a.category_name || '',
      'Status': a.status || '',
      'Purchase Cost': a.purchase_cost || 0,
      'Current Value': a.current_value || 0,
      'Depreciation': (a.purchase_cost || 0) - (a.current_value || 0),
      'Purchase Date': a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '',
      'Last Valuation': a.last_valuation_date ? new Date(a.last_valuation_date).toLocaleDateString() : ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Assets');
    XLSX.writeFile(wb, 'finance_dashboard_data.xlsx');
    toast.success(t.exportSuccess || 'Data exported successfully');
  };

  // Chart configurations
  const chartColors = {
    primary: isDark ? '#63b3ed' : '#2b6cb0',
    success: isDark ? '#68d391' : '#38a169',
    warning: isDark ? '#f6ad55' : '#dd6b20',
    danger: isDark ? '#fc8181' : '#e53e3e',
    info: isDark ? '#81e6d9' : '#319795',
    purple: isDark ? '#b794f4' : '#805ad5',
    pink: isDark ? '#f687b3' : '#d53f8c',
    lightBg: isDark ? '#1e2d45' : '#ffffff',
    darkBg: isDark ? '#141e2d' : '#f7fafc'
  };

  const getChartOptions = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#c8dcf5' : '#1a365d',
          boxWidth: 12,
          padding: 15
        }
      },
      title: {
        display: !!title,
        text: title,
        color: isDark ? '#c8dcf5' : '#1a365d',
        font: { size: 14, weight: 'bold' }
      }
    },
    scales: {
      y: {
        ticks: { 
          color: isDark ? '#8896b0' : '#4a5568',
          callback: (value) => {
            const numericValue = Number(value) || 0;
            if (numericValue >= 1000000) return `${(numericValue / 1000000).toFixed(1)}M`;
            if (numericValue >= 1000) return `${(numericValue / 1000).toFixed(1)}K`;
            return numericValue.toFixed(0);
          }
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { color: isDark ? '#8896b0' : '#4a5568' },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      }
    }
  });

  // Format currency for display
  const formatCurrency = (value) => {
    const numericValue = Number(value) || 0;
    if (numericValue >= 1000000) return `${(numericValue / 1000000).toFixed(1)}M`;
    if (numericValue >= 1000) return `${(numericValue / 1000).toFixed(1)}K`;
    return numericValue.toFixed(0);
  };

  // Styles
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
    actionButton: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
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
      outline: 'none',
      transition: 'border-color 0.2s'
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
    mainStatsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '30px'
    },
    statCard: { 
      background: isDark ? '#1e2d45' : '#ffffff', 
      padding: '18px', 
      borderRadius: '12px', 
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,100,0.08)'
      }
    },
    statIcon: {
      fontSize: '1.5rem',
      marginBottom: '6px'
    },
    statNumber: { 
      fontSize: '1.6rem', 
      fontWeight: 700, 
      color: isDark ? '#c8dcf5' : '#1a365d',
      lineHeight: 1.2
    },
    statLabel: { 
      color: isDark ? '#8896b0' : '#4a5568', 
      fontSize: '0.8rem',
      marginTop: '2px'
    },
    statTrend: {
      fontSize: '0.75rem',
      color: isDark ? '#68d391' : '#38a169',
      marginTop: '4px'
    },
    chartsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    chartCard: { 
      background: isDark ? '#1e2d45' : '#ffffff', 
      padding: '20px', 
      borderRadius: '12px', 
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      transition: 'box-shadow 0.2s'
    },
    chartTitle: { 
      color: isDark ? '#c8dcf5' : '#1a365d', 
      fontSize: '0.95rem', 
      marginBottom: '16px',
      fontWeight: 600
    },
    alertCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    alertSeverity: {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase'
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
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '24px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '80vh',
      overflow: 'auto',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
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
      borderRadius: '4px',
      ':hover': {
        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
      }
    },
    detailTable: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    detailTh: {
      padding: '8px 12px',
      textAlign: 'left',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc'
    },
    detailTd: {
      padding: '8px 12px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem'
    },
    activitiesList: {
      maxHeight: '300px',
      overflow: 'auto'
    },
    activityItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      alignItems: 'center'
    },
    '@media print': {
      container: { background: 'white' },
      statCard: { background: 'white', border: '1px solid #ddd' },
      chartCard: { background: 'white', border: '1px solid #ddd' },
      filtersBar: { display: 'none' },
      headerActions: { display: 'none' }
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
          <h1 style={styles.title}>💰 {t.dashboard}</h1>
          <p style={styles.subtitle}>
            {t.welcome}, {user?.fullName || user?.username || 'User'} 👋
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersBar}>
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
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.department}</span>
          <select
            style={styles.filterSelect}
            value={filters.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
          >
            <option value="">{t.allDepartments}</option>
            {Object.keys(stats.byDepartment).map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.category}</span>
          <select
            style={styles.filterSelect}
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">{t.allCategories}</option>
            {Object.keys(stats.byCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.status}</span>
          <select
            style={styles.filterSelect}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">{t.allStatuses}</option>
            <option value="Active">Active</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Inactive">Inactive</option>
            <option value="Disposed">Disposed</option>
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.financialYear}</span>
          <select
            style={styles.filterSelect}
            value={filters.financialYear}
            onChange={(e) => handleFilterChange('financialYear', e.target.value ? parseInt(e.target.value, 10) : '')}
          >
            <option value="">{t.allYears}</option>
            {[2025, 2024, 2023, 2022, 2021, 2020].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <button style={styles.clearFiltersButton} onClick={clearFilters}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Main Stats */}
      <div style={styles.mainStatsGrid}>
        <div style={styles.statCard} onClick={() => handleStatClick('totalCost')}>
          <div style={styles.statIcon}>💰</div>
          <div style={styles.statNumber}>{formatCurrency(stats.totalAssetCost)} ETB</div>
          <div style={styles.statLabel}>{t.totalAssetCost}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('bookValue')}>
          <div style={styles.statIcon}>📊</div>
          <div style={{ ...styles.statNumber, color: chartColors.success }}>{formatCurrency(stats.currentBookValue)} ETB</div>
          <div style={styles.statLabel}>{t.currentBookValue}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('depreciation')}>
          <div style={styles.statIcon}>📉</div>
          <div style={{ ...styles.statNumber, color: chartColors.danger }}>{formatCurrency(stats.accumulatedDepreciation)} ETB</div>
          <div style={styles.statLabel}>{t.accumulatedDepreciation}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('assets')}>
          <div style={styles.statIcon}>📦</div>
          <div style={styles.statNumber}>{stats.totalAssets}</div>
          <div style={styles.statLabel}>{t.totalAssets}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('active')}>
          <div style={styles.statIcon}>✅</div>
          <div style={{ ...styles.statNumber, color: chartColors.success }}>{stats.activeAssets}</div>
          <div style={styles.statLabel}>{t.activeAssets}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('maintenance')}>
          <div style={styles.statIcon}>🔧</div>
          <div style={{ ...styles.statNumber, color: chartColors.warning }}>{stats.underMaintenance}</div>
          <div style={styles.statLabel}>{t.underMaintenance}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('disposed')}>
          <div style={styles.statIcon}>🗑️</div>
          <div style={{ ...styles.statNumber, color: chartColors.danger }}>{stats.disposed}</div>
          <div style={styles.statLabel}>{t.disposed}</div>
        </div>
        <div style={styles.statCard} onClick={() => handleStatClick('valuation')}>
          <div style={styles.statIcon}>🔍</div>
          <div style={{ ...styles.statNumber, color: chartColors.purple }}>{stats.requiringValuation}</div>
          <div style={styles.statLabel}>{t.requiringValuation}</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={styles.chartsRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByDepartment}</h3>
          <div style={{ height: '260px' }}>
            <Doughnut 
              data={{
                labels: Object.keys(stats.byDepartment),
                datasets: [{
                  data: Object.values(stats.byDepartment),
                  backgroundColor: ['#2b6cb0', '#4299e1', '#48bb78', '#ed8936', '#805ad5', '#fc8181', '#81e6d9'],
                  borderColor: isDark ? '#1e2d45' : '#ffffff',
                  borderWidth: 2
                }]
              }}
              options={getChartOptions('')}
            />
          </div>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByCategory}</h3>
          <div style={{ height: '260px' }}>
            <Pie 
              data={{
                labels: Object.keys(stats.byCategory),
                datasets: [{
                  data: Object.values(stats.byCategory),
                  backgroundColor: ['#fc8181', '#ed8936', '#4299e1', '#48bb78', '#805ad5', '#81e6d9', '#b794f4'],
                  borderColor: isDark ? '#1e2d45' : '#ffffff',
                  borderWidth: 2
                }]
              }}
              options={getChartOptions('')}
            />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={styles.chartsRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetsByStatus}</h3>
          <div style={{ height: '260px' }}>
            <Bar 
              data={{
                labels: Object.keys(stats.byStatus),
                datasets: [{
                  label: t.assetsByStatus,
                  data: Object.values(stats.byStatus),
                  backgroundColor: ['#48bb78', '#ed8936', '#fc8181', '#4299e1'],
                  borderColor: isDark ? '#1e2d45' : '#ffffff',
                  borderWidth: 2
                }]
              }}
              options={getChartOptions('')}
            />
          </div>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.valueTrend}</h3>
          <div style={{ height: '260px' }}>
            <Line 
              data={{
                labels: stats.monthlyTrend.map(d => d.month),
                datasets: [{
                  label: t.valueTrend,
                  data: stats.monthlyTrend.map(d => d.value),
                  borderColor: chartColors.primary,
                  backgroundColor: isDark ? 'rgba(99, 179, 237, 0.1)' : 'rgba(43, 108, 176, 0.1)',
                  fill: true,
                  tension: 0.4
                }]
              }}
              options={getChartOptions('')}
            />
          </div>
        </div>
      </div>

      {/* Audit Alerts */}
      {auditAlerts.length > 0 && (
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>⚠️ {t.auditAlerts}</h3>
          {auditAlerts.slice(0, 5).map(alert => (
            <div key={alert.id} style={styles.alertCard}>
              <div>
                <div style={{ fontWeight: 500, color: isDark ? '#c8dcf5' : '#1a365d' }}>
                  {alert.message}
                </div>
                <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568', marginTop: '4px' }}>
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
              <span style={{
                ...styles.alertSeverity,
                background: alert.severity === 'high' ? 'rgba(252, 129, 129, 0.2)' :
                           alert.severity === 'medium' ? 'rgba(246, 173, 85, 0.2)' :
                           'rgba(104, 211, 145, 0.2)',
                color: alert.severity === 'high' ? '#fc8181' :
                       alert.severity === 'medium' ? '#f6ad55' :
                       '#68d391'
              }}>
                {alert.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Financial Activities */}
      {financialActivities.length > 0 && (
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>📋 {t.recentActivities}</h3>
          <div style={styles.activitiesList}>
            {financialActivities.slice(0, 10).map(activity => (
              <div key={activity.id} style={styles.activityItem}>
                <div>
                  <span style={{ fontWeight: 500, color: isDark ? '#c8dcf5' : '#1a365d' }}>
                    {activity.type}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568', marginLeft: '12px' }}>
                    {activity.description}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: isDark ? '#8896b0' : '#4a5568', marginTop: '2px' }}>
                    {activity.asset_name} • {new Date(activity.date).toLocaleDateString()}
                  </div>
                </div>
                <span style={{ 
                  fontWeight: 600,
                  color: activity.type === 'Purchase' || activity.type === 'Valuation' ? chartColors.success : 
                         activity.type === 'Sale' || activity.type === 'Depreciation' ? chartColors.danger :
                         chartColors.primary
                }}>
                  {activity.type === 'Purchase' || activity.type === 'Valuation' ? '+' : 
                   activity.type === 'Sale' || activity.type === 'Depreciation' ? '-' : ''}
                  {formatCurrency(activity.amount)} ETB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {detailType === 'totalCost' && '💰 Total Asset Cost Details'}
                {detailType === 'bookValue' && '📊 Current Book Value Details'}
                {detailType === 'depreciation' && '📉 Depreciation Details'}
                {detailType === 'assets' && '📦 Total Assets Details'}
                {detailType === 'active' && '✅ Active Assets Details'}
                {detailType === 'maintenance' && '🔧 Assets Under Maintenance'}
                {detailType === 'disposed' && '🗑️ Disposed Assets'}
                {detailType === 'valuation' && '🔍 Assets Requiring Valuation'}
              </h2>
              <button style={styles.modalClose} onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div>
              <table style={styles.detailTable}>
                <thead>
                  <tr>
                    <th style={styles.detailTh}>Asset Name</th>
                    <th style={styles.detailTh}>Department</th>
                    <th style={styles.detailTh}>Category</th>
                    <th style={styles.detailTh}>Status</th>
                    <th style={styles.detailTh}>Current Value</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.slice(0, 20).map(asset => (
                    <tr key={asset.id}>
                      <td style={styles.detailTd}>{asset.name}</td>
                      <td style={styles.detailTd}>{asset.department_name || '-'}</td>
                      <td style={styles.detailTd}>{asset.category_name || '-'}</td>
                      <td style={styles.detailTd}>{asset.status}</td>
                      <td style={styles.detailTd}>{formatCurrency(asset.current_value || 0)} ETB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assets.length > 20 && (
                <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                  Showing first 20 of {assets.length} assets
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  dashboard: 'Finance Dashboard',
  welcome: 'Welcome',
  totalAssetCost: 'Total Asset Cost',
  currentBookValue: 'Current Book Value',
  accumulatedDepreciation: 'Accumulated Depreciation',
  totalAssets: 'Total Assets',
  activeAssets: 'Active Assets',
  underMaintenance: 'Under Maintenance',
  disposed: 'Disposed',
  requiringValuation: 'Requiring Valuation',
  assetsByDepartment: 'Assets by Department',
  assetsByCategory: 'Assets by Category',
  assetsByStatus: 'Assets by Status',
  valueTrend: 'Asset Value Trend',
  auditAlerts: 'Audit Alerts',
  recentActivities: 'Recent Financial Activities',
  dateFrom: 'Date From',
  dateTo: 'Date To',
  department: 'Department',
  category: 'Category',
  status: 'Status',
  financialYear: 'Financial Year',
  allYears: 'All Years',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allStatuses: 'All Statuses',
  clearFilters: 'Clear Filters',
  exportExcel: 'Export to Excel',
  loading: 'Loading financial data...',
  fetchError: 'Failed to load financial data',
  exportSuccess: 'Data exported successfully'
};

const amharicTranslations = {
  dashboard: 'የፋይናንስ ዳሽቦርድ',
  welcome: 'እንኳን ደህና መጡ',
  totalAssetCost: 'ጠቅላላ የንብረት ዋጋ',
  currentBookValue: 'የአሁኑ የመጽሐፍ ዋጋ',
  accumulatedDepreciation: 'የተጠራቀመ የእሴት መቀነስ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  activeAssets: 'ንቁ ንብረቶች',
  underMaintenance: 'በጥገና ላይ',
  disposed: 'የተወገዱ',
  requiringValuation: 'ምዘና የሚፈልጉ',
  assetsByDepartment: 'ንብረቶች በክፍል',
  assetsByCategory: 'ንብረቶች በምድብ',
  assetsByStatus: 'ንብረቶች በሁኔታ',
  valueTrend: 'የንብረት እሴት አዝማሚያ',
  auditAlerts: 'የኦዲት ማንቂያዎች',
  recentActivities: 'የቅርብ ጊዜ የፋይናንስ እንቅስቃሴዎች',
  dateFrom: 'ከቀን',
  dateTo: 'እስከ ቀን',
  department: 'ክፍል',
  category: 'ምድብ',
  status: 'ሁኔታ',
  financialYear: 'የፋይናንስ ዓመት',
  allYears: 'ሁሉም ዓመታት',
  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allStatuses: 'ሁሉም ሁኔታዎች',
  clearFilters: 'ማጣሪያ አጽዳ',
  exportExcel: 'ወደ Excel ላክ',
  loading: 'የፋይናንስ ውሂብ በመጫን ላይ...',
  fetchError: 'የፋይናንስ ውሂብ ማግኘት አልተቻለም',
  exportSuccess: 'ውሂብ በተሳካ ሁኔታ ተላከ'
};

export default FinanceDashboard;