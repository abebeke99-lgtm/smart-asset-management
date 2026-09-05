import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';

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

const FinanceReports = () => {
  const { language, theme } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [disposedAssets, setDisposedAssets] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Filter states
  const [filters, setFilters] = useState({
    financialYear: new Date().getFullYear(),
    dateFrom: '',
    dateTo: '',
    department: '',
    category: '',
    status: '',
    location: ''
  });

  const [reportData, setReportData] = useState({
    assetValuation: {},
    depreciation: {},
    lifecycle: {},
    financialAnalysis: {}
  });

  const printRef = useRef();

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, maintRes, disposedRes] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 1000, include_financial: true } }),
        axios.get('/api/maintenance', { params: { limit: 500 } }),
        axios.get('/api/assets', { params: { limit: 500, status: 'Disposed' } })
      ]);

      setAssets(assetsRes.data?.assets || assetsRes.data?.data || []);
      setMaintenanceRequests(maintRes.data?.requests || []);
      setDisposedAssets(disposedRes.data?.assets || []);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load data');
      setAssets([]);
    }
    setLoading(false);
  }, [t]);

  const generateFallbackAssets = () => {
    const departments = ['IT', 'Facilities', 'HR', 'Finance', 'Operations', 'Marketing', 'Production'];
    const categories = ['Hardware', 'Software', 'Vehicles', 'Furniture', 'Machinery', 'Electronics', 'Building'];
    const statuses = ['Active', 'Under Maintenance', 'Inactive', 'Disposed'];
    const locations = ['Head Office', 'Branch A', 'Branch B', 'Warehouse', 'Data Center'];
    
    return Array.from({ length: 150 }, (_, i) => {
      const purchaseCost = 50000 + Math.random() * 2000000;
      const currentValue = purchaseCost * (0.3 + Math.random() * 0.6);
      const purchaseDate = new Date(2016 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28));
      const status = statuses[i % statuses.length];
      
      return {
        id: `asset_${i + 1}`,
        asset_tag: `ICT-${String(i + 1).padStart(4, '0')}`,
        name: `${categories[i % categories.length]} ${i + 1}`,
        description: `Description for asset ${i + 1}`,
        department_name: departments[i % departments.length],
        category_name: categories[i % categories.length],
        status: status,
        location: locations[i % locations.length],
        purchase_cost: purchaseCost,
        current_value: currentValue,
        residual_value: purchaseCost * 0.1,
        useful_life: 3 + Math.floor(Math.random() * 7),
        purchase_date: purchaseDate.toISOString(),
        disposal_date: status === 'Disposed' ? new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString() : null,
        disposal_value: status === 'Disposed' ? currentValue * 0.3 : 0,
        is_damaged: i % 7 === 0,
        is_lost: i % 11 === 0,
        depreciation_method: ['straight-line', 'reducing-balance'][i % 2],
        maintenance_count: Math.floor(Math.random() * 10),
        last_maintenance_date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString()
      };
    });
  };

  const generateReports = useCallback(() => {
    const filteredAssets = assets.filter(asset => {
      const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null;
      const matchesFinancialYear = !filters.financialYear ||
        !purchaseDate || purchaseDate.getFullYear() === filters.financialYear;
      const matchesDateFrom = !filters.dateFrom ||
        (purchaseDate && purchaseDate >= new Date(`${filters.dateFrom}T00:00:00`));
      const matchesDateTo = !filters.dateTo ||
        (purchaseDate && purchaseDate <= new Date(`${filters.dateTo}T23:59:59.999`));
      const matchesDepartment = !filters.department || asset.department_name === filters.department;
      const matchesCategory = !filters.category || asset.category_name === filters.category;
      const matchesStatus = !filters.status || asset.status === filters.status;
      const matchesLocation = !filters.location || asset.location === filters.location;

      return matchesFinancialYear && matchesDateFrom && matchesDateTo &&
        matchesDepartment && matchesCategory && matchesStatus && matchesLocation;
    });

    const totalPurchase = filteredAssets.reduce((sum, asset) => sum + (asset.purchase_cost || 0), 0);
    const totalValue = filteredAssets.reduce((sum, asset) => sum + (asset.current_value || 0), 0);
    const totalResidual = filteredAssets.reduce((sum, asset) => sum + (asset.residual_value || 0), 0);

    const byDepartment = filteredAssets.reduce((acc, asset) => {
      const department = asset.department_name || 'Other';
      acc[department] = (acc[department] || 0) + (asset.current_value || 0);
      return acc;
    }, {});

    const byCategory = filteredAssets.reduce((acc, a) => {
      const cat = a.category_name || 'Other';
      acc[cat] = (acc[cat] || 0) + (a.current_value || 0);
      return acc;
    }, {});

    // Depreciation Reports
    const totalDepreciation = totalPurchase - totalValue;
    const fullyDepreciated = filteredAssets.filter(a => 
      (a.purchase_cost - a.current_value) / a.purchase_cost > 0.9
    );

    // Monthly depreciation (last 12 months)
    const monthlyDepreciation = Array.from({ length: 12 }, (_, i) => {
      const month = new Date();
      month.setMonth(month.getMonth() - (11 - i));
      const monthAssets = filteredAssets.filter(a => {
        const date = new Date(a.purchase_date);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      });
      return {
        month: month.toLocaleString('default', { month: 'short' }),
        depreciation: monthAssets.reduce((sum, a) => sum + ((a.purchase_cost || 0) - (a.current_value || 0)), 0)
      };
    });

    // Lifecycle Reports
    const newAssets = filteredAssets.filter(a => {
      const purchaseDate = new Date(a.purchase_date);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return purchaseDate >= sixMonthsAgo;
    });

    const disposed = filteredAssets.filter(a => a.status === 'Disposed');
    const damaged = filteredAssets.filter(a => a.is_damaged);
    const lost = filteredAssets.filter(a => a.is_lost);
    const underMaintenance = filteredAssets.filter(a => a.status === 'Under Maintenance');

    // Financial Analysis
    const avgPurchaseCost = filteredAssets.length > 0 ? totalPurchase / filteredAssets.length : 0;
    const avgCurrentValue = filteredAssets.length > 0 ? totalValue / filteredAssets.length : 0;
    const avgDepreciation = filteredAssets.length > 0 ? totalDepreciation / filteredAssets.length : 0;
    const valueRetentionRate = totalPurchase > 0 ? (totalValue / totalPurchase) * 100 : 0;

    setReportData({
      assetValuation: {
        totalValue,
        totalPurchase,
        totalResidual,
        byDepartment,
        byCategory,
        avgPurchaseCost,
        avgCurrentValue
      },
      depreciation: {
        totalDepreciation,
        fullyDepreciated: fullyDepreciated.length,
        monthlyDepreciation,
        avgDepreciation,
        valueRetentionRate
      },
      lifecycle: {
        newAssets: newAssets.length,
        disposed: disposed.length,
        damaged: damaged.length,
        lost: lost.length,
        underMaintenance: underMaintenance.length,
        totalAssets: filteredAssets.length
      },
      financialAnalysis: {
        totalPurchase,
        totalValue,
        totalDepreciation,
        totalResidual,
        avgPurchaseCost,
        avgCurrentValue,
        avgDepreciation,
        valueRetentionRate,
        maintenanceCost: maintenanceRequests.reduce((sum, m) => sum + (m.actual_cost || 0), 0)
      }
    });
  }, [assets, filters, maintenanceRequests]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (assets.length > 0) {
      generateReports();
    }
  }, [assets, maintenanceRequests, filters, generateReports]);

  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(20);
    doc.setTextColor(isDark ? '#c8dcf5' : '#1a365d');
    doc.text(t.reports, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Financial Year: ${filters.financialYear}`, 14, 34);

    // Summary
    const summaryData = [
      [t.totalAssets, reportData.lifecycle?.totalAssets || 0],
      [t.totalValue, `$${(reportData.assetValuation?.totalValue || 0).toLocaleString()}`],
      [t.purchaseCost, `$${(reportData.assetValuation?.totalPurchase || 0).toLocaleString()}`],
      [t.depreciation, `$${(reportData.depreciation?.totalDepreciation || 0).toLocaleString()}`],
      [t.valueRetention, `${(reportData.depreciation?.valueRetentionRate || 0).toFixed(1)}%`],
      [t.maintenanceCost, `$${(reportData.financialAnalysis?.maintenanceCost || 0).toLocaleString()}`]
    ];

    doc.autoTable({
      head: [['Metric', 'Value']],
      body: summaryData,
      startY: 42,
      theme: isDark ? 'dark' : 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: isDark ? [30, 45, 69] : [55, 65, 81] }
    });

    // Asset list
    const assetData = assets.slice(0, 30).map(a => [
      a.asset_tag || '',
      a.name || '',
      a.department_name || '',
      a.category_name || '',
      `$${(a.purchase_cost || 0).toLocaleString()}`,
      `$${(a.current_value || 0).toLocaleString()}`,
      a.status || ''
    ]);

    doc.autoTable({
      head: [[t.assetTag, t.name, t.department, t.category, t.purchaseCost, t.currentValue, t.status]],
      body: assetData,
      startY: doc.lastAutoTable.finalY + 10,
      theme: isDark ? 'dark' : 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: isDark ? [30, 45, 69] : [55, 65, 81] }
    });

    doc.save('financial_report.pdf');
    toast.success(t.exportSuccess || 'PDF exported successfully');
  };

  const exportToExcel = () => {
    const assetData = assets.map(a => ({
      'Asset Tag': a.asset_tag || '',
      'Name': a.name || '',
      'Department': a.department_name || '',
      'Category': a.category_name || '',
      'Location': a.location || '',
      'Status': a.status || '',
      'Purchase Cost': a.purchase_cost || 0,
      'Current Value': a.current_value || 0,
      'Residual Value': a.residual_value || 0,
      'Depreciation': (a.purchase_cost || 0) - (a.current_value || 0),
      'Depreciation %': a.purchase_cost > 0 ? ((((a.purchase_cost || 0) - (a.current_value || 0)) / a.purchase_cost) * 100).toFixed(1) : 0,
      'Purchase Date': a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '',
      'Useful Life': a.useful_life || 0,
      'Maintenance Count': a.maintenance_count || 0,
      'Damaged': a.is_damaged ? 'Yes' : 'No',
      'Lost': a.is_lost ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(assetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Report');
    XLSX.writeFile(wb, 'financial_report.xlsx');
    toast.success(t.exportSuccess || 'Excel exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      financialYear: new Date().getFullYear(),
      dateFrom: '',
      dateTo: '',
      department: '',
      category: '',
      status: '',
      location: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Active': '#48bb78',
      'Under Maintenance': '#ed8936',
      'Inactive': '#a0aec0',
      'Disposed': '#fc8181'
    };
    return colors[status] || '#a0aec0';
  };

  // Chart configurations
  const chartOptions = {
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
      }
    },
    scales: {
      y: {
        ticks: { 
          color: isDark ? '#8896b0' : '#4a5568',
          callback: (value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value;
          }
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { color: isDark ? '#8896b0' : '#4a5568' },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      }
    }
  };

  const chartColors = {
    primary: isDark ? '#63b3ed' : '#2b6cb0',
    success: isDark ? '#68d391' : '#38a169',
    warning: isDark ? '#f6ad55' : '#dd6b20',
    danger: isDark ? '#fc8181' : '#e53e3e',
    purple: isDark ? '#b794f4' : '#805ad5',
    pink: isDark ? '#f687b3' : '#d53f8c',
    teal: isDark ? '#81e6d9' : '#319795'
  };

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
    pdfButton: {
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    printButton: {
      background: 'linear-gradient(135deg, #63b3ed, #3182ce)',
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
      outline: 'none'
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
    tabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: '24px',
      flexWrap: 'wrap',
      background: isDark ? '#1e2d45' : '#f7fafc',
      padding: '4px',
      borderRadius: '12px'
    },
    tab: {
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.9rem',
      transition: 'all 0.2s'
    },
    activeTab: {
      background: isDark ? '#2d4a6f' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,100,0.08)'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      textAlign: 'center'
    },
    statNumber: {
      fontSize: '1.4rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
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
      marginBottom: '20px'
    },
    chartTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1rem',
      fontWeight: 600,
      marginBottom: '16px'
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
    statusBadge: {
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      display: 'inline-block'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    lifecycleGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    },
    lifecycleCard: {
      padding: '16px',
      borderRadius: '12px',
      textAlign: 'center',
      background: isDark ? '#1e2d45' : '#ffffff',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    lifecycleNumber: {
      fontSize: '2rem',
      fontWeight: 700
    },
    lifecycleLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.8rem'
    },
    assetTag: {
      display: 'inline-block',
      padding: '2px 10px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '4px',
      fontSize: '0.8rem',
      fontWeight: 600,
      color: isDark ? '#c8dcf5' : '#1a365d'
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

  const tabs = [
    { id: 'overview', label: t.overview || 'Overview' },
    { id: 'valuation', label: t.assetValuation || 'Asset Valuation' },
    { id: 'depreciation', label: t.depreciationReports || 'Depreciation' },
    { id: 'lifecycle', label: t.lifecycle || 'Lifecycle' },
    { id: 'financial', label: t.financialAnalysis || 'Financial Analysis' },
    { id: 'assets', label: t.assets || 'Assets' }
  ];

  return (
    <div style={styles.container} ref={printRef}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 {t.reports}</h1>
          <p style={styles.subtitle}>{t.financialSummary}</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
          <button style={styles.pdfButton} onClick={exportToPDF}>
            📄 {t.exportPDF}
          </button>
          <button style={styles.printButton} onClick={handlePrint}>
            🖨️ {t.print}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersBar}>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.financialYear}</span>
          <select
            style={styles.filterSelect}
            value={filters.financialYear}
            onChange={(e) => handleFilterChange('financialYear', parseInt(e.target.value))}
          >
            {[2025, 2024, 2023, 2022, 2021, 2020].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
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
            {[...new Set(assets.map(a => a.department_name).filter(Boolean))].map(dept => (
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
            {[...new Set(assets.map(a => a.category_name).filter(Boolean))].map(cat => (
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
        <button style={styles.clearFiltersButton} onClick={clearFilters}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {})
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{reportData.lifecycle?.totalAssets || 0}</div>
              <div style={styles.statLabel}>{t.totalAssets}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.assetValuation?.totalValue || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.currentValue}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.assetValuation?.totalPurchase || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.purchaseCost}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.danger }}>
                ${(reportData.depreciation?.totalDepreciation || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.depreciation}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.warning }}>
                ${(reportData.financialAnalysis?.maintenanceCost || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.maintenanceCost}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.success }}>
                {(reportData.depreciation?.valueRetentionRate || 0).toFixed(1)}%
              </div>
              <div style={styles.statLabel}>{t.valueRetention}</div>
            </div>
          </div>

          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.valueByDepartment}</h3>
              <div style={{ height: '250px' }}>
                <Doughnut 
                  data={{
                    labels: Object.keys(reportData.assetValuation?.byDepartment || {}),
                    datasets: [{
                      data: Object.values(reportData.assetValuation?.byDepartment || {}),
                      backgroundColor: ['#2b6cb0', '#4299e1', '#48bb78', '#ed8936', '#805ad5', '#fc8181', '#81e6d9'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.valueByCategory}</h3>
              <div style={{ height: '250px' }}>
                <Pie 
                  data={{
                    labels: Object.keys(reportData.assetValuation?.byCategory || {}),
                    datasets: [{
                      data: Object.values(reportData.assetValuation?.byCategory || {}),
                      backgroundColor: ['#fc8181', '#ed8936', '#4299e1', '#48bb78', '#805ad5', '#81e6d9'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.monthlyDepreciation}</h3>
            <div style={{ height: '240px' }}>
              <Line 
                data={{
                  labels: reportData.depreciation?.monthlyDepreciation?.map(d => d.month) || [],
                  datasets: [{
                    label: t.depreciation,
                    data: reportData.depreciation?.monthlyDepreciation?.map(d => d.depreciation) || [],
                    borderColor: chartColors.primary,
                    backgroundColor: isDark ? 'rgba(99, 179, 237, 0.1)' : 'rgba(43, 108, 176, 0.1)',
                    fill: true,
                    tension: 0.4
                  }]
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Valuation Tab */}
      {activeTab === 'valuation' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.assetValuation?.totalPurchase || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.acquisitionCost}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.assetValuation?.totalValue || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.currentBookValue}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.assetValuation?.totalResidual || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.residualValue}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                ${(reportData.assetValuation?.avgPurchaseCost || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.avgPurchaseCost}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                ${(reportData.assetValuation?.avgCurrentValue || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.avgCurrentValue}</div>
            </div>
          </div>

          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.valueByDepartment}</h3>
              <div style={{ height: '250px' }}>
                <Bar 
                  data={{
                    labels: Object.keys(reportData.assetValuation?.byDepartment || {}),
                    datasets: [{
                      label: t.currentValue,
                      data: Object.values(reportData.assetValuation?.byDepartment || {}),
                      backgroundColor: '#63b3ed',
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.valueByCategory}</h3>
              <div style={{ height: '250px' }}>
                <Bar 
                  data={{
                    labels: Object.keys(reportData.assetValuation?.byCategory || {}),
                    datasets: [{
                      label: t.currentValue,
                      data: Object.values(reportData.assetValuation?.byCategory || {}),
                      backgroundColor: '#68d391',
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Depreciation Tab */}
      {activeTab === 'depreciation' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.danger }}>
                ${(reportData.depreciation?.totalDepreciation || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.totalDepreciation}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.warning }}>
                {reportData.depreciation?.fullyDepreciated || 0}
              </div>
              <div style={styles.statLabel}>{t.fullyDepreciated}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                ${(reportData.depreciation?.avgDepreciation || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.avgDepreciation}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.success }}>
                {(reportData.depreciation?.valueRetentionRate || 0).toFixed(1)}%
              </div>
              <div style={styles.statLabel}>{t.valueRetention}</div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.monthlyDepreciation}</h3>
            <div style={{ height: '250px' }}>
              <Bar 
                data={{
                  labels: reportData.depreciation?.monthlyDepreciation?.map(d => d.month) || [],
                  datasets: [{
                    label: t.depreciation,
                    data: reportData.depreciation?.monthlyDepreciation?.map(d => d.depreciation) || [],
                    backgroundColor: '#fc8181',
                    borderColor: isDark ? '#1e2d45' : '#ffffff',
                    borderWidth: 2
                  }]
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle Tab */}
      {activeTab === 'lifecycle' && (
        <div>
          <div style={styles.lifecycleGrid}>
            <div style={{ ...styles.lifecycleCard, borderLeft: `4px solid ${chartColors.success}` }}>
              <div style={{ ...styles.lifecycleNumber, color: chartColors.success }}>
                {reportData.lifecycle?.newAssets || 0}
              </div>
              <div style={styles.lifecycleLabel}>{t.newAssets}</div>
            </div>
            <div style={{ ...styles.lifecycleCard, borderLeft: `4px solid ${chartColors.danger}` }}>
              <div style={{ ...styles.lifecycleNumber, color: chartColors.danger }}>
                {reportData.lifecycle?.disposed || 0}
              </div>
              <div style={styles.lifecycleLabel}>{t.disposedAssets}</div>
            </div>
            <div style={{ ...styles.lifecycleCard, borderLeft: `4px solid ${chartColors.danger}` }}>
              <div style={{ ...styles.lifecycleNumber, color: chartColors.danger }}>
                {reportData.lifecycle?.damaged || 0}
              </div>
              <div style={styles.lifecycleLabel}>{t.damagedAssets}</div>
            </div>
            <div style={{ ...styles.lifecycleCard, borderLeft: `4px solid ${chartColors.warning}` }}>
              <div style={{ ...styles.lifecycleNumber, color: chartColors.warning }}>
                {reportData.lifecycle?.lost || 0}
              </div>
              <div style={styles.lifecycleLabel}>{t.lostAssets}</div>
            </div>
            <div style={{ ...styles.lifecycleCard, borderLeft: `4px solid ${chartColors.warning}` }}>
              <div style={{ ...styles.lifecycleNumber, color: chartColors.warning }}>
                {reportData.lifecycle?.underMaintenance || 0}
              </div>
              <div style={styles.lifecycleLabel}>{t.underMaintenance}</div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.assetLifecycleDistribution}</h3>
            <div style={{ height: '250px' }}>
              <Doughnut 
                data={{
                  labels: [
                    t.active, 
                    t.underMaintenance, 
                    t.disposed,
                    t.damaged,
                    t.lost
                  ],
                  datasets: [{
                    data: [
                      reportData.lifecycle?.totalAssets - 
                      (reportData.lifecycle?.disposed || 0) - 
                      (reportData.lifecycle?.damaged || 0) - 
                      (reportData.lifecycle?.lost || 0) - 
                      (reportData.lifecycle?.underMaintenance || 0),
                      reportData.lifecycle?.underMaintenance || 0,
                      reportData.lifecycle?.disposed || 0,
                      reportData.lifecycle?.damaged || 0,
                      reportData.lifecycle?.lost || 0
                    ],
                    backgroundColor: ['#48bb78', '#ed8936', '#fc8181', '#f687b3', '#b794f4'],
                    borderColor: isDark ? '#1e2d45' : '#ffffff',
                    borderWidth: 2
                  }]
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Financial Analysis Tab */}
      {activeTab === 'financial' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.financialAnalysis?.totalPurchase || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.purchaseCost}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.financialAnalysis?.totalValue || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.currentValue}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.danger }}>
                ${(reportData.financialAnalysis?.totalDepreciation || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.depreciation}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.financialAnalysis?.totalResidual || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.residualValue}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>${(reportData.financialAnalysis?.maintenanceCost || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>{t.maintenanceCost}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: chartColors.success }}>
                {(reportData.financialAnalysis?.valueRetentionRate || 0).toFixed(1)}%
              </div>
              <div style={styles.statLabel}>{t.valueRetention}</div>
            </div>
          </div>

          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.costComparison}</h3>
              <div style={{ height: '250px' }}>
                <Bar 
                  data={{
                    labels: [t.purchaseCost, t.currentValue, t.residualValue],
                    datasets: [{
                      label: t.costComparison,
                      data: [
                        reportData.financialAnalysis?.totalPurchase || 0,
                        reportData.financialAnalysis?.totalValue || 0,
                        reportData.financialAnalysis?.totalResidual || 0
                      ],
                      backgroundColor: ['#63b3ed', '#68d391', '#f6ad55'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.financialSummary}</h3>
              <div style={{ height: '250px' }}>
                <Doughnut 
                  data={{
                    labels: [t.currentValue, t.depreciation, t.residualValue],
                    datasets: [{
                      data: [
                        reportData.financialAnalysis?.totalValue || 0,
                        reportData.financialAnalysis?.totalDepreciation || 0,
                        reportData.financialAnalysis?.totalResidual || 0
                      ],
                      backgroundColor: ['#48bb78', '#fc8181', '#f6ad55'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.assetList}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t.assetTag}</th>
                  <th style={styles.th}>{t.name}</th>
                  <th style={styles.th}>{t.department}</th>
                  <th style={styles.th}>{t.category}</th>
                  <th style={styles.th}>{t.location}</th>
                  <th style={styles.th}>{t.purchaseCost}</th>
                  <th style={styles.th}>{t.currentValue}</th>
                  <th style={styles.th}>{t.depreciation}</th>
                  <th style={styles.th}>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {assets.slice(0, 50).map(asset => (
                  <tr key={asset.id}>
                    <td style={styles.td}>
                      <span style={styles.assetTag}>{asset.asset_tag}</span>
                    </td>
                    <td style={styles.td}>{asset.name}</td>
                    <td style={styles.td}>{asset.department_name || '-'}</td>
                    <td style={styles.td}>{asset.category_name || '-'}</td>
                    <td style={styles.td}>{asset.location || '-'}</td>
                    <td style={styles.td}>${(asset.purchase_cost || 0).toLocaleString()}</td>
                    <td style={styles.td}>${(asset.current_value || 0).toLocaleString()}</td>
                    <td style={styles.td}>
                      ${((asset.purchase_cost || 0) - (asset.current_value || 0)).toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        background: `${getStatusColor(asset.status)}22`,
                        color: getStatusColor(asset.status)
                      }}>
                        {asset.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assets.length > 50 && (
              <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                {t.showingFirst} 50 {t.of} {assets.length}
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
  reports: 'Financial Reports',
  financialSummary: 'Complete financial and asset-accounting reports',
  exportExcel: 'Export to Excel',
  exportPDF: 'Export to PDF',
  print: 'Print',
  loading: 'Loading...',
  currentValue: 'Current Value',
  purchaseCost: 'Purchase Cost',
  depreciation: 'Depreciation',
  maintenanceCost: 'Maintenance Cost',
  totalAssets: 'Total Assets',
  valueRetention: 'Value Retention',
  showingFirst: 'Showing first',
  of: 'of',
  assetTag: 'Asset Tag',
  name: 'Name',
  department: 'Department',
  category: 'Category',
  location: 'Location',
  status: 'Status',
  financialYear: 'Financial Year',
  dateFrom: 'Date From',
  dateTo: 'Date To',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allStatuses: 'All Statuses',
  clearFilters: 'Clear Filters',
  fetchError: 'Failed to load data',
  exportSuccess: 'Exported successfully',
  
  // Tabs
  overview: 'Overview',
  assetValuation: 'Asset Valuation',
  depreciationReports: 'Depreciation Reports',
  lifecycle: 'Lifecycle',
  financialAnalysis: 'Financial Analysis',
  assets: 'Assets',
  
  // Valuation
  acquisitionCost: 'Acquisition Cost',
  currentBookValue: 'Current Book Value',
  residualValue: 'Residual Value',
  avgPurchaseCost: 'Avg Purchase Cost',
  avgCurrentValue: 'Avg Current Value',
  valueByDepartment: 'Value by Department',
  valueByCategory: 'Value by Category',
  
  // Depreciation
  totalDepreciation: 'Total Depreciation',
  fullyDepreciated: 'Fully Depreciated',
  avgDepreciation: 'Avg Depreciation',
  monthlyDepreciation: 'Monthly Depreciation',
  annualDepreciation: 'Annual Depreciation',
  accumulatedDepreciation: 'Accumulated Depreciation',
  
  // Lifecycle
  newAssets: 'New Assets',
  disposedAssets: 'Disposed Assets',
  damagedAssets: 'Damaged Assets',
  lostAssets: 'Lost Assets',
  underMaintenance: 'Under Maintenance',
  active: 'Active',
  assetLifecycleDistribution: 'Asset Lifecycle Distribution',
  disposed: 'Disposed',
  damaged: 'Damaged',
  lost: 'Lost',
  
  // Financial
  costComparison: 'Cost Comparison',
  financialSummary: 'Financial Summary',
  assetList: 'Asset List'
};

const amharicTranslations = {
  reports: 'የፋይናንስ ሪፖርቶች',
  financialSummary: 'ሙሉ የፋይናንስ እና የንብረት ሂሳብ ሪፖርቶች',
  exportExcel: 'ወደ Excel ላክ',
  exportPDF: 'ወደ PDF ላክ',
  print: 'አትም',
  loading: 'በመጫን ላይ...',
  currentValue: 'የአሁኑ ዋጋ',
  purchaseCost: 'የግዢ ዋጋ',
  depreciation: 'የእሴት መቀነስ',
  maintenanceCost: 'የጥገና ዋጋ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  valueRetention: 'የእሴት ማቆየት',
  showingFirst: 'የመጀመሪያዎቹን',
  of: 'ከ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  department: 'ክፍል',
  category: 'ምድብ',
  location: 'አካባቢ',
  status: 'ሁኔታ',
  financialYear: 'የፋይናንስ ዓመት',
  dateFrom: 'ከቀን',
  dateTo: 'እስከ ቀን',
  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allStatuses: 'ሁሉም ሁኔታዎች',
  clearFilters: 'ማጣሪያ አጽዳ',
  fetchError: 'ውሂብ ማግኘት አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  
  // Tabs
  overview: 'አጠቃላይ እይታ',
  assetValuation: 'የንብረት ዋጋ ምዘና',
  depreciationReports: 'የእሴት መቀነስ ሪፖርቶች',
  lifecycle: 'የህይወት ዑደት',
  financialAnalysis: 'የፋይናንስ ትንተና',
  assets: 'ንብረቶች',
  
  // Valuation
  acquisitionCost: 'የግዢ ዋጋ',
  currentBookValue: 'የአሁኑ የመጽሐፍ ዋጋ',
  residualValue: 'ቀሪ ዋጋ',
  avgPurchaseCost: 'አማካኝ የግዢ ዋጋ',
  avgCurrentValue: 'አማካኝ የአሁኑ ዋጋ',
  valueByDepartment: 'በክፍል ዋጋ',
  valueByCategory: 'በምድብ ዋጋ',
  
  // Depreciation
  totalDepreciation: 'ጠቅላላ የእሴት መቀነስ',
  fullyDepreciated: 'ሙሉ በሙሉ የተቀነሰ',
  avgDepreciation: 'አማካኝ ቅናሽ',
  monthlyDepreciation: 'ወርሃዊ ቅናሽ',
  annualDepreciation: 'ዓመታዊ ቅናሽ',
  accumulatedDepreciation: 'የተጠራቀመ ቅናሽ',
  
  // Lifecycle
  newAssets: 'አዳዲስ ንብረቶች',
  disposedAssets: 'የተወገዱ ንብረቶች',
  damagedAssets: 'የተጎዱ ንብረቶች',
  lostAssets: 'የጠፉ ንብረቶች',
  underMaintenance: 'በጥገና ላይ',
  active: 'ንቁ',
  assetLifecycleDistribution: 'የንብረት ህይወት ዑደት ስርጭት',
  disposed: 'የተወገዱ',
  damaged: 'የተጎዱ',
  lost: 'የጠፉ',
  
  // Financial
  costComparison: 'የዋጋ ንጽጽር',
  assetList: 'የንብረት ዝርዝር'
};

export default FinanceReports;